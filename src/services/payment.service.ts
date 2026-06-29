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
import { populateFxRate } from './currency.service';
import { getOrgSettings } from './settings.service';

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

async function resolveAccountsPayable(orgId: string, tx: any): Promise<string> {
  const [apAccount] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.systemAccountRole, 'accounts_payable')
      )
    )
    .limit(1);

  if (apAccount) return apAccount.id;

  throw new AppError(
    'Accounts Payable account not configured. Go to Chart of Accounts, select a liability account, and set its System Role to \'Accounts Payable\'.',
    400
  );
}

// ==========================================
// CORE SERVICES
// ==========================================

export async function recordPaymentReceived(input: any, createdBy: string): Promise<any> {
  const orgId = input.orgId;
  const settings = await getOrgSettings(orgId);
  const defaultCurrency = settings.general?.defaultCurrency || 'NGN';
  const pmtSeries = (settings.txnNumbering?.series || []).find((s: any) => s.module === 'Customer Payment');
  const numPrefix = pmtSeries?.prefix || 'PMT-';
  const startStr = pmtSeries?.start || '000001';
  const startNum = parseInt(startStr, 10);
  const padLen = Math.max(6, startStr.length);

  return await db.transaction(async (tx) => {
    const amount = Number(input.amount || 0);
    const category = input.category || 'sales_invoice';

    if (amount <= 0) {
      throw new AppError('Payment amount must be greater than zero.', 400);
    }

    const allocations = category === 'sales_invoice' ? (input.allocations || []) : [];

    if (category === 'sales_invoice') {
      // 1. Check allocations sum matches amount
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
    } else {
      // Non-invoice income receipt (e.g. fixed asset disposal, donation/grant)
      if (!input.incomeAccountId) {
        throw new AppError('An income account must be specified for non-invoice receipts.', 400);
      }
      if (!input.customerId && !input.payerName) {
        throw new AppError('Provide either a customer or a payer name for this receipt.', 400);
      }
    }

    // 3. Generate sequential payment number
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(paymentsReceived)
      .where(eq(paymentsReceived.orgId, orgId));

    const pmtCount = Number(countResult?.count || 0);
    const paymentNumber = `${numPrefix}${String(startNum + pmtCount).padStart(padLen, '0')}`;

    // 4. Record Payment Received
    const [payment] = await tx
      .insert(paymentsReceived)
      .values({
        orgId,
        paymentNumber,
        category,
        customerId: input.customerId || null,
        payerName: input.payerName || null,
        date: new Date(input.date || new Date()),
        amount,
        currency: input.currency || defaultCurrency,
        fxRate: input.fxRate ? String(input.fxRate) : await populateFxRate(orgId, input.currency || defaultCurrency, input.date),
        paymentMethod: input.paymentMethod || 'bank_transfer',
        reference: input.reference || null,
        accountId: input.accountId, // Selected asset bank account
        incomeAccountId: category === 'other_income' ? input.incomeAccountId : null,
        notes: input.notes || null,
        createdBy
      })
      .returning();

    // 5. Save allocations and update invoices (sales_invoice category only)
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
    // Sales invoice receipt: DR Bank, CR Accounts Receivable
    // Other income receipt:  DR Bank, CR the chosen income account
    const creditAccountId = category === 'sales_invoice'
      ? await resolveAccountsReceivable(orgId, tx)
      : input.incomeAccountId;

    await createJournalEntry({
      orgId,
      date: payment.date,
      description: category === 'sales_invoice'
        ? `Journal posting of Payment Received ${payment.paymentNumber}`
        : `Journal posting of Other Income Receipt ${payment.paymentNumber}`,
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
          accountId: creditAccountId,
          credit: amount,
          description: category === 'sales_invoice'
            ? `AR application for payment ${payment.paymentNumber}`
            : `Income recognition for receipt ${payment.paymentNumber}`
        }
      ]
    }, tx);

    return {
      ...payment,
      allocations: recordedAllocations
    };
  });
}

/**
 * Update an existing payment received. Because payments carry journal entries and (optionally)
 * invoice allocations, an edit is implemented as: reverse the old journal entry and allocations,
 * then re-apply with the new values — while keeping the same payment id and payment number.
 */
export async function updatePaymentReceived(paymentId: string, orgId: string, input: any, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(paymentsReceived)
      .where(and(eq(paymentsReceived.id, paymentId), eq(paymentsReceived.orgId, orgId)))
      .limit(1);

    if (!existing) throw new AppError('Payment not found.', 404);

    // 1. Reverse old allocations (restore invoice balances)
    const oldAllocations = await tx
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, paymentId));

    for (const alloc of oldAllocations) {
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
          .set({ amountPaid: nextAmountPaid, balanceDue: nextBalanceDue, status: nextStatus })
          .where(eq(invoices.id, invoice.id));
      }
    }

    await tx.delete(paymentAllocations).where(eq(paymentAllocations.paymentId, paymentId));

    // 2. Reverse old journal entry
    const oldEntries = await tx
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.source, 'payment'),
          eq(journalEntries.sourceId, paymentId),
          eq(journalEntries.isReversed, false)
        )
      );

    for (const jr of oldEntries) {
      await reverseJournalEntry(jr.id, new Date(), userId);
    }

    // 3. Merge new values over existing payment
    const category = input.category || existing.category;
    const amount = input.amount !== undefined ? Number(input.amount) : existing.amount;
    const accountId = input.accountId || existing.accountId;
    const date = input.date ? new Date(input.date) : existing.date;
    const allocations = category === 'sales_invoice' ? (input.allocations || []) : [];

    if (category === 'sales_invoice') {
      let allocatedSum = 0;
      for (const alloc of allocations) allocatedSum += Number(alloc.amount || 0);
      if (allocations.length > 0 && allocatedSum !== amount) {
        throw new AppError(`Total allocated sum (${allocatedSum} kobo) must exactly match payment amount (${amount} kobo).`, 400);
      }
      for (const alloc of allocations) {
        const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, alloc.invoiceId)).limit(1);
        if (!invoice) throw new AppError(`Invoice with ID ${alloc.invoiceId} not found.`, 404);
        if (Number(alloc.amount) > invoice.total) {
          throw new AppError(`Allocated amount exceeds invoice total on ${invoice.invoiceNumber}.`, 400);
        }
      }
    } else {
      const incomeAccountId = input.incomeAccountId || existing.incomeAccountId;
      if (!incomeAccountId) throw new AppError('An income account must be specified for non-invoice receipts.', 400);
      if (!(input.customerId ?? existing.customerId) && !(input.payerName ?? existing.payerName)) {
        throw new AppError('Provide either a customer or a payer name for this receipt.', 400);
      }
    }

    // 4. Update the payment row
    const [updated] = await tx
      .update(paymentsReceived)
      .set({
        category,
        customerId: category === 'sales_invoice' ? (input.customerId ?? existing.customerId) : (input.customerId ?? existing.customerId ?? null),
        payerName: input.payerName ?? existing.payerName,
        date,
        amount,
        currency: input.currency || existing.currency,
        paymentMethod: input.paymentMethod || existing.paymentMethod,
        reference: input.reference !== undefined ? input.reference : existing.reference,
        accountId,
        incomeAccountId: category === 'other_income' ? (input.incomeAccountId || existing.incomeAccountId) : null,
        notes: input.notes !== undefined ? input.notes : existing.notes
      })
      .where(eq(paymentsReceived.id, paymentId))
      .returning();

    // 5. Re-apply allocations (sales_invoice only)
    const recordedAllocations: any[] = [];
    for (const alloc of allocations) {
      const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, alloc.invoiceId)).limit(1);
      const allocAmt = Number(alloc.amount);
      const nextAmountPaid = invoice.amountPaid + allocAmt;
      const nextBalanceDue = invoice.total - nextAmountPaid;
      const nextStatus = nextBalanceDue <= 0 ? 'paid' : 'partial';

      await tx
        .update(invoices)
        .set({ amountPaid: nextAmountPaid, balanceDue: nextBalanceDue, status: nextStatus })
        .where(eq(invoices.id, invoice.id));

      const [recordedAlloc] = await tx
        .insert(paymentAllocations)
        .values({ paymentId: updated.id, invoiceId: invoice.id, amount: allocAmt })
        .returning();

      recordedAllocations.push(recordedAlloc);
    }

    // 6. Re-post journal entry
    const creditAccountId = category === 'sales_invoice'
      ? await resolveAccountsReceivable(orgId, tx)
      : updated.incomeAccountId;

    if (!creditAccountId) {
      throw new AppError('An income account is required for non-invoice receipts.', 400);
    }

    await createJournalEntry({
      orgId,
      date: updated.date,
      description: category === 'sales_invoice'
        ? `Journal posting of Payment Received ${updated.paymentNumber} (edited)`
        : `Journal posting of Other Income Receipt ${updated.paymentNumber} (edited)`,
      reference: updated.paymentNumber,
      source: 'payment',
      sourceId: updated.id,
      createdBy: userId,
      lines: [
        { accountId: updated.accountId, debit: amount, description: `Receipt mapping for payment ${updated.paymentNumber}` },
        { accountId: creditAccountId, credit: amount, description: category === 'sales_invoice' ? `AR application for payment ${updated.paymentNumber}` : `Income recognition for receipt ${updated.paymentNumber}` }
      ]
    }, tx);

    return { ...updated, allocations: recordedAllocations };
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
  const orgId = input.orgId;
  const settings = await getOrgSettings(orgId);
  const defaultCurrency = settings.general?.defaultCurrency || 'NGN';
  const pmtSeries = (settings.txnNumbering?.series || []).find((s: any) => s.module === 'Vendor Payment');
  const numPrefix = pmtSeries?.prefix || 'VPMT-';
  const startStr = pmtSeries?.start || '000001';
  const startNum = parseInt(startStr, 10);
  const padLen = Math.max(6, startStr.length);

  return await db.transaction(async (tx) => {
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

    const pmtCount = Number(countResult?.count || 0);
    const paymentNumber = `${numPrefix}${String(startNum + pmtCount).padStart(padLen, '0')}`;

    // Record Payment Made
    const [payment] = await tx
      .insert(paymentsMade)
      .values({
        orgId,
        paymentNumber,
        vendorId: input.vendorId,
        date: new Date(input.date || new Date()),
        amount,
        currency: input.currency || defaultCurrency,
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

    const journalEntry = await createJournalEntry({
      orgId,
      date: payment.date,
      description: `Journal posting of Outbound Supplier Payment ${payment.paymentNumber}`,
      reference: payment.paymentNumber,
      source: 'payment',
      sourceId: payment.id,
      createdBy,
      lines: [
        {
          accountId: apAccountId,
          debit: amount,
          description: `AP reduction for payment ${payment.paymentNumber}`
        },
        {
          accountId: payment.accountId,
          credit: amount,
          description: `Disbursement from bank for payment ${payment.paymentNumber}`
        }
      ]
    }, tx);

    await tx
      .update(paymentsMade)
      .set({ journalEntryId: journalEntry.id })
      .where(eq(paymentsMade.id, payment.id));

    return {
      ...payment,
      allocations: recordedAllocations
    };
  });
}

export async function updatePaymentMade(id: string, input: any, userId: string): Promise<any> {
  const [pmt] = await db
    .select()
    .from(paymentsMade)
    .where(eq(paymentsMade.id, id))
    .limit(1);

  if (!pmt) throw new AppError('Payment not found.', 404);

  const updatePayload: any = {};
  if (input.date) updatePayload.date = new Date(input.date);
  if (input.amount) updatePayload.amount = input.amount;
  if (input.paymentMethod) updatePayload.paymentMethod = input.paymentMethod;
  if (input.reference !== undefined) updatePayload.reference = input.reference;
  if (input.notes !== undefined) updatePayload.notes = input.notes;
  if (input.accountId) updatePayload.accountId = input.accountId;

  const [updated] = await db
    .update(paymentsMade)
    .set(updatePayload)
    .where(eq(paymentsMade.id, id))
    .returning();

  return updated;
}

export async function deletePaymentMade(paymentId: string, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(paymentsMade)
      .where(eq(paymentsMade.id, paymentId))
      .limit(1);

    if (!payment) throw new AppError('Payment not found.', 404);

    const allocations = await tx
      .select()
      .from(paymentMadeAllocations)
      .where(eq(paymentMadeAllocations.paymentId, paymentId));

    for (const alloc of allocations) {
      const [bill] = await tx
        .select()
        .from(bills)
        .where(eq(bills.id, alloc.billId))
        .limit(1);

      if (bill) {
        const nextAmountPaid = Math.max(0, bill.amountPaid - alloc.amount);
        const nextBalanceDue = bill.total - nextAmountPaid;
        const nextStatus = nextAmountPaid === 0 ? 'open' : 'partial';

        await tx
          .update(bills)
          .set({
            amountPaid: nextAmountPaid,
            balanceDue: nextBalanceDue,
            status: nextStatus,
          })
          .where(eq(bills.id, bill.id));
      }
    }

    await tx.delete(paymentMadeAllocations).where(eq(paymentMadeAllocations.paymentId, paymentId));

    if (payment.journalEntryId) {
      await reverseJournalEntry(payment.journalEntryId, new Date(), userId);
    }

    await tx.delete(paymentsMade).where(eq(paymentsMade.id, paymentId));

    return { message: 'Payment successfully deleted and allocations reversed.' };
  });
}
