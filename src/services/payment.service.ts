/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import {
  db,
  accounts,
  invoices,
  paymentAllocations,
  paymentsReceived,
  bills,
  paymentsMade,
  paymentMadeAllocations,
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
        eq(accounts.type, 'asset'),
        sql`lower(${accounts.name}) like '%receivable%'`
      )
    )
    .limit(1);

  if (arAccount) return arAccount.id;

  const [fallbackAsset] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'asset')))
    .limit(1);

  if (fallbackAsset) return fallbackAsset.id;

  throw new AppError(
    "Accounts Receivable account not configured. Please create an asset account with 'Receivable' in its name.",
    400
  );
}

async function resolveAccountsPayable(orgId: string, tx: any): Promise<string> {
  const [apAccount] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'liability'),
        sql`lower(${accounts.name}) like '%payable%'`
      )
    )
    .limit(1);

  if (apAccount) return apAccount.id;

  const [fallbackLiability] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'liability')))
    .limit(1);

  if (fallbackLiability) return fallbackLiability.id;

  throw new AppError(
    "Accounts Payable account not configured. Please create a liability account with 'Payable' in its name.",
    400
  );
}

// ==========================================
// CORE SERVICES
// ==========================================

export async function recordPaymentReceived(input: any, createdBy: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const orgId = input.orgId;
    const amount = Number(input.amount || 0);

    if (amount <= 0) {
      throw new AppError('Payment amount must be greater than zero.', 400);
    }

    // 1. Check allocations
    const allocations = input.allocations || [];
    let allocatedSum = 0;
    for (const alloc of allocations) {
      allocatedSum += Number(alloc.amount || 0);
    }

    if (allocatedSum !== amount) {
      throw new AppError(`Total allocated sum (${allocatedSum} kobo) must exactly match payment amount (${amount} kobo).`, 400);
    }

    // 2. Validate allocations against invoices outstanding balance_due
    for (const alloc of allocations) {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, alloc.invoiceId))
        .limit(1);

      if (!invoice) {
        throw new AppError(`Invoice with ID ${alloc.invoiceId} not found.`, 404);
      }
      if (invoice.status === 'draft' || invoice.status === 'void') {
        throw new AppError(`Cannot allocate receipt to a draft or void invoice ${invoice.invoiceNumber}.`, 400);
      }
      if (Number(alloc.amount) > invoice.balanceDue) {
        throw new AppError(`Allocated amount (${alloc.amount} kobo) exceeds balance due (${invoice.balanceDue} kobo) on Invoice ${invoice.invoiceNumber}.`, 400);
      }
    }

    // 3. Generate sequential payment number
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(paymentsReceived)
      .where(eq(paymentsReceived.orgId, orgId));

    const pmtCount = Number(countResult?.count || 0) + 1;
    const paymentNumber = `PMT-${String(pmtCount).padStart(6, '0')}`;

    // 4. Record Payment Received
    const [payment] = await tx
      .insert(paymentsReceived)
      .values({
        orgId,
        paymentNumber,
        customerId: input.customerId,
        date: new Date(input.date || new Date()),
        amount,
        currency: input.currency || 'NGN',
        fxRate: input.fxRate ? String(input.fxRate) : '1.00000000',
        paymentMethod: input.paymentMethod || 'bank_transfer',
        reference: input.reference || null,
        accountId: input.accountId, // Selected asset bank account
        notes: input.notes || null,
        createdBy
      })
      .returning();

    // 5. Save allocations and update invoices
    const recordedAllocations: any[] = [];
    for (const alloc of allocations) {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, alloc.invoiceId))
        .limit(1);

      const allocAmt = Number(alloc.amount);
      const nextAmountPaid = invoice.amountPaid + allocAmt;
      const nextBalanceDue = invoice.total - nextAmountPaid;
      const nextStatus = nextBalanceDue <= 0 ? 'paid' : 'partial';

      // Update invoice fields
      await tx
        .update(invoices)
        .set({
          amountPaid: nextAmountPaid,
          balanceDue: nextBalanceDue,
          status: nextStatus
        })
        .where(eq(invoices.id, invoice.id));

      const [recordedAlloc] = await tx
        .insert(paymentAllocations)
        .values({
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount: allocAmt
        })
        .returning();

      recordedAllocations.push(recordedAlloc);
    }

    // 6. Generate Journal Entry
    // DR Bank Account (paymentsReceived.accountId)
    // CR Accounts Receivable (contact's receivable account)
    const arAccountId = await resolveAccountsReceivable(orgId, tx);

    await createJournalEntry({
      orgId,
      date: payment.date,
      description: `Journal posting of Payment Received ${payment.paymentNumber}`,
      reference: payment.paymentNumber,
      source: 'payment',
      sourceId: payment.id,
      createdBy,
      lines: [
        {
          accountId: payment.accountId, // Bank account ledger
          debit: amount,
          description: `Receipt mapping for payment ${payment.paymentNumber}`
        },
        {
          accountId: arAccountId, // Customer debtor ledger
          credit: amount,
          description: `AR application for payment ${payment.paymentNumber}`
        }
      ]
    }, tx);

    return {
      ...payment,
      allocations: recordedAllocations
    };
  });
}

export async function deletePaymentReceived(paymentId: string, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Fetch payment
    const [payment] = await tx
      .select()
      .from(paymentsReceived)
      .where(eq(paymentsReceived.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new AppError('Payment not found.', 404);
    }

    // 2. Fetch allocations
    const allocations = await tx
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, paymentId));

    // 3. Unallocate invoices
    for (const alloc of allocations) {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, alloc.invoiceId))
        .limit(1);

      if (invoice) {
        const nextAmountPaid = Math.max(0, invoice.amountPaid - alloc.amount);
        const nextBalanceDue = invoice.total - nextAmountPaid;
        const nextStatus = nextAmountPaid === 0 ? 'sent' : 'partial';

        await tx
          .update(invoices)
          .set({
            amountPaid: nextAmountPaid,
            balanceDue: nextBalanceDue,
            status: nextStatus
          })
          .where(eq(invoices.id, invoice.id));
      }
    }

    // 4. Delete payment allocations
    await tx.delete(paymentAllocations).where(eq(paymentAllocations.paymentId, paymentId));

    // 5. Reverse corresponding journal entry
    const entryList = await tx
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.source, 'payment'),
          eq(journalEntries.sourceId, paymentId),
          eq(journalEntries.isReversed, false)
        )
      );

    for (const jr of entryList) {
      await reverseJournalEntry(jr.id, new Date(), userId);
    }

    // 6. Delete payment
    await tx.delete(paymentsReceived).where(eq(paymentsReceived.id, paymentId));

    return { message: 'Payment successfully unallocated and deleted.' };
  });
}

export async function unallocatePayment(paymentId: string, allocationId: string, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [alloc] = await tx
      .select()
      .from(paymentAllocations)
      .where(and(eq(paymentAllocations.id, allocationId), eq(paymentAllocations.paymentId, paymentId)))
      .limit(1);

    if (!alloc) throw new AppError('Allocation not found.', 404);

    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, alloc.invoiceId))
      .limit(1);

    if (invoice) {
      const nextAmountPaid = Math.max(0, invoice.amountPaid - alloc.amount);
      const nextBalanceDue = invoice.total - nextAmountPaid;
      const nextStatus = nextAmountPaid === 0 ? 'sent' : 'partial';

      await tx
        .update(invoices)
        .set({
          amountPaid: nextAmountPaid,
          balanceDue: nextBalanceDue,
          status: nextStatus
        })
        .where(eq(invoices.id, invoice.id));
    }

    await tx.delete(paymentAllocations).where(eq(paymentAllocations.id, allocationId));

    // Note: Standard unallocation leaves the remaining payment credits unallocated within the payment entity.
    return { message: 'Unallocated successfully.' };
  });
}

// ==========================================
// VENDOR PAYMENTS MADE (MIRROR)
// ==========================================

export async function recordPaymentMade(input: any, createdBy: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const orgId = input.orgId;
    const amount = Number(input.amount || 0);

    if (amount <= 0) {
      throw new AppError('Payment amount must be greater than zero.', 400);
    }

    const allocations = input.allocations || [];
    let allocatedSum = 0;
    for (const alloc of allocations) {
      allocatedSum += Number(alloc.amount || 0);
    }

    if (allocatedSum !== amount) {
      throw new AppError(`Total allocated sum (${allocatedSum} kobo) must exactly match outbound payment amount (${amount} kobo).`, 400);
    }

    for (const alloc of allocations) {
      const [bill] = await tx
        .select()
        .from(bills)
        .where(eq(bills.id, alloc.billId))
        .limit(1);

      if (!bill) {
        throw new AppError(`Bill with ID ${alloc.billId} not found.`, 404);
      }
      if (bill.status === 'draft' || bill.status === 'void') {
        throw new AppError(`Cannot allocate payment of outbound type to a draft or void bill ${bill.billNumber}.`, 400);
      }
      if (Number(alloc.amount) > bill.balanceDue) {
        throw new AppError(`Allocated amount (${alloc.amount} kobo) exceeds balance due (${bill.balanceDue} kobo) on Bill ${bill.billNumber}.`, 400);
      }
    }

    // Sequential number
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(paymentsMade)
      .where(eq(paymentsMade.orgId, orgId));

    const pmtCount = Number(countResult?.count || 0) + 1;
    const paymentNumber = `VPMT-${String(pmtCount).padStart(6, '0')}`;

    // Record Payment Made
    const [payment] = await tx
      .insert(paymentsMade)
      .values({
        orgId,
        paymentNumber,
        vendorId: input.vendorId,
        date: new Date(input.date || new Date()),
        amount,
        currency: input.currency || 'NGN',
        paymentMethod: input.paymentMethod || 'bank_transfer',
        reference: input.reference || null,
        accountId: input.accountId, // outbound bank account ledger
        notes: input.notes || null,
        createdBy
      })
      .returning();

    // Allocations and bill updates
    const recordedAllocations: any[] = [];
    for (const alloc of allocations) {
      const [bill] = await tx
        .select()
        .from(bills)
        .where(eq(bills.id, alloc.billId))
        .limit(1);

      const allocAmt = Number(alloc.amount);
      const nextAmountPaid = bill.amountPaid + allocAmt;
      const nextBalanceDue = bill.total - nextAmountPaid;
      const nextStatus = nextBalanceDue <= 0 ? 'paid' : 'partial';

      await tx
        .update(bills)
        .set({
          amountPaid: nextAmountPaid,
          balanceDue: nextBalanceDue,
          status: nextStatus
        })
        .where(eq(bills.id, bill.id));

      const [recordedAlloc] = await tx
        .insert(paymentMadeAllocations)
        .values({
          paymentId: payment.id,
          billId: bill.id,
          amount: allocAmt
        })
        .returning();

      recordedAllocations.push(recordedAlloc);
    }

    // Bookkeeping journal entry
    // DR Accounts Payable (vendor's liability account)
    // CR Bank Account (outgoing asset)
    const apAccountId = await resolveAccountsPayable(orgId, tx);

    await createJournalEntry({
      orgId,
      date: payment.date,
      description: `Journal posting of Outbound Supplier Payment ${payment.paymentNumber}`,
      reference: payment.paymentNumber,
      source: 'payment', // using payment as general tag
      sourceId: payment.id,
      createdBy,
      lines: [
        {
          accountId: apAccountId, // vendor control account
          debit: amount,
          description: `AP reduction for payment ${payment.paymentNumber}`
        },
        {
          accountId: payment.accountId, // bank account ledger
          credit: amount,
          description: `Disbursement from bank for payment ${payment.paymentNumber}`
        }
      ]
    }, tx);

    return {
      ...payment,
      allocations: recordedAllocations
    };
  });
}
