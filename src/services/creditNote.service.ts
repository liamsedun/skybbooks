/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { eq, and, sql } from 'drizzle-orm';
import {
  db,
  accounts,
  invoices,
  creditNotes,
  journalEntries
} from '../db/schema';
import { AppError } from '../lib/errors';
import { createJournalEntry, reverseJournalEntry } from './ledger.service';

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function resolveAccountsReceivable(orgId: string, tx: any): Promise<string> {
  const [arAccount] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.systemAccountRole, 'accounts_receivable')
      )
    )
    .limit(1);

  if (arAccount) return arAccount.id;

  throw new AppError(
    'Accounts Receivable account not configured. Go to Chart of Accounts, select an asset account, and set its System Role to \'Accounts Receivable\'.',
    400
  );
}

async function resolveVatPayable(orgId: string, tx: any): Promise<string> {
  const [vatAccount] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.systemAccountRole, 'vat_payable')
      )
    )
    .limit(1);

  if (vatAccount) return vatAccount.id;

  throw new AppError(
    'VAT Payable account not configured. Go to Chart of Accounts, select a liability account, and set its System Role to \'VAT Payable\'.',
    400
  );
}

async function resolveRevenueAccount(orgId: string, tx: any): Promise<string> {
  const [revAccount] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'revenue')))
    .limit(1);

  if (revAccount) return revAccount.id;

  throw new AppError("A valid Sales/Revenue general ledger account is required.", 400);
}

// ==========================================
// CORE SERVICES
// ==========================================

export async function createCreditNote(input: any, createdBy: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const orgId = input.orgId;
    const subtotal = Number(input.subtotal || 0);
    const tax = Number(input.tax || 0);
    const total = subtotal + tax;

    if (total <= 0) {
      throw new AppError('Credit note total must be greater than zero.', 400);
    }

    // 1. Generate sequential Credit Note number
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(creditNotes)
      .where(eq(creditNotes.orgId, orgId));

    const cnCount = Number(countResult?.count || 0) + 1;
    const cnNumber = `CN-${String(cnCount).padStart(6, '0')}`;

    // 2. Insert Credit Note in database
    const [creditNote] = await tx
      .insert(creditNotes)
      .values({
        orgId,
        cnNumber,
        customerId: input.customerId,
        invoiceId: input.invoiceId || null,
        date: new Date(input.date || new Date()),
        status: 'issued', // defaults directly to issued for bookkeeping
        subtotal,
        tax,
        total,
        remainingCredit: total,
        notes: input.notes || null,
        createdBy
      })
      .returning();

    // 3. Create General Ledger Journal Entry
    // DR Revenue Account
    // DR VAT Payable (if taxes present)
    // CR Accounts Receivable
    const arAccountId = await resolveAccountsReceivable(orgId, tx);
    const vatAccountId = await resolveVatPayable(orgId, tx);
    const revAccountId = await resolveRevenueAccount(orgId, tx);

    const journalLines: any[] = [];

    // DR Revenue
    journalLines.push({
      accountId: revAccountId,
      debit: subtotal,
      description: `Sales revenue reversal for credit note ${cnNumber}`
    });

    // DR VAT Payable portion
    if (tax > 0) {
      journalLines.push({
        accountId: vatAccountId,
        debit: tax,
        description: `VAT adjustment portion of credit note ${cnNumber}`
      });
    }

    // CR Accounts Receivable
    journalLines.push({
      accountId: arAccountId,
      credit: total,
      description: `AR offset application for credit note ${cnNumber}`
    });

    const journalEntry = await createJournalEntry({
      orgId,
      date: creditNote.date,
      description: `Journal posting of Credit Note ${cnNumber}`,
      reference: cnNumber,
      source: 'manual', // standard general ledger
      sourceId: creditNote.id,
      createdBy,
      lines: journalLines
    }, tx);

    // 4. Update credit note linked journal
    const [finalCreditNote] = await tx
      .update(creditNotes)
      .set({ journalEntryId: journalEntry.id })
      .where(eq(creditNotes.id, creditNote.id))
      .returning();

    return finalCreditNote;
  });
}

export async function applyCreditNote(cnId: string, invoiceId: string, amount: number, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Fetch credit note
    const [creditNote] = await tx
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.id, cnId))
      .limit(1);

    if (!creditNote) throw new AppError('Credit note not found.', 404);
    if (creditNote.status === 'void') throw new AppError('Cannot apply a void credit note.', 400);
    if (creditNote.remainingCredit < amount) {
      throw new AppError(`Applied amount (${amount} kobo) exceeds remaining credit balance (${creditNote.remainingCredit} kobo).`, 400);
    }

    // 2. Fetch invoice
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) throw new AppError('Invoice not found.', 404);
    if (invoice.status === 'draft' || invoice.status === 'void') {
      throw new AppError('Invoice is not in an active open state to receive credits.', 400);
    }
    if (invoice.balanceDue < amount) {
      throw new AppError(`Applied credit (${amount} kobo) exceeds invoice outstanding balance due (${invoice.balanceDue} kobo).`, 400);
    }

    // 3. Update invoice
    const nextAmountPaid = invoice.amountPaid + amount;
    const nextBalanceDue = invoice.total - nextAmountPaid;
    const nextInvoiceStatus = nextBalanceDue <= 0 ? 'paid' : 'partial';

    await tx
      .update(invoices)
      .set({
        amountPaid: nextAmountPaid,
        balanceDue: nextBalanceDue,
        status: nextInvoiceStatus
      })
      .where(eq(invoices.id, invoice.id));

    // 4. Update Credit Note
    const nextRemainingCredit = creditNote.remainingCredit - amount;
    const nextCnStatus = nextRemainingCredit <= 0 ? 'applied' : 'issued';

    await tx
      .update(creditNotes)
      .set({
        remainingCredit: nextRemainingCredit,
        status: nextCnStatus
      })
      .where(eq(creditNotes.id, creditNote.id));

    // 5. Create matching offsetting ledger entry
    // DR Accounts Receivable (credit note allocation offset)
    // CR Accounts Receivable (invoice offset allocation)
    const arAccountId = await resolveAccountsReceivable(creditNote.orgId, tx);

    await createJournalEntry({
      orgId: creditNote.orgId,
      date: new Date(),
      description: `Cross-link offset application: Credit Note ${creditNote.cnNumber} to Invoice ${invoice.invoiceNumber}`,
      reference: creditNote.cnNumber,
      source: 'manual',
      sourceId: creditNote.id,
      createdBy: userId,
      lines: [
        {
          accountId: arAccountId,
          debit: amount,
          description: `Credit application offset references ${creditNote.cnNumber}`
        },
        {
          accountId: arAccountId,
          credit: amount,
          description: `Receivable reduction offset references ${invoice.invoiceNumber}`
        }
      ]
    }, tx);

    return {
      message: `Successfully applied credit note ${creditNote.cnNumber} to invoice ${invoice.invoiceNumber}.`,
      appliedAmount: amount,
      remainingCredit: nextRemainingCredit,
      invoiceBalanceDue: nextBalanceDue
    };
  });
}

/**
 * Void a credit note that has not yet been (fully) applied. Reverses its original
 * journal entry and sets remainingCredit to 0 so it can no longer be allocated.
 * A credit note that has already been partially or fully applied to an invoice
 * cannot be voided here, since that would require also unwinding the invoice's
 * balance — delete/adjust the invoice-side allocation first in that case.
 */
export async function voidCreditNote(cnId: string, orgId: string, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [creditNote] = await tx
      .select()
      .from(creditNotes)
      .where(and(eq(creditNotes.id, cnId), eq(creditNotes.orgId, orgId)))
      .limit(1);

    if (!creditNote) throw new AppError('Credit note not found.', 404);
    if (creditNote.status === 'void') throw new AppError('This credit note is already void.', 400);
    if (creditNote.remainingCredit < creditNote.total) {
      throw new AppError('This credit note has already been partially or fully applied to an invoice and cannot be voided directly.', 400);
    }

    if (creditNote.journalEntryId) {
      await reverseJournalEntry(creditNote.journalEntryId, new Date(), userId);
    }

    const [voided] = await tx
      .update(creditNotes)
      .set({ status: 'void', remainingCredit: 0 })
      .where(eq(creditNotes.id, cnId))
      .returning();

    return voided;
  });
}
