/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { eq, and, lte, gte, sql, desc } from 'drizzle-orm';
import {
  db,
  accounts,
  journalEntries,
  journalLines,
  bills,
  billLines,
  contacts
} from '../db/schema';
import { AppError } from '../lib/errors';
import { createJournalEntry, reverseJournalEntry } from './ledger.service';

// ==========================================
// 1. HELPER FUNCTIONS & ACCOUNTS RESOLUTION
// ==========================================

async function resolveAccountsPayable(orgId: string, tx: any): Promise<string> {
  const [apAccount] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'liability'),
        sql`lower(${accounts.name}) like '%payable%' or lower(${accounts.name}) like '%creditor%'`
      )
    )
    .limit(1);

  if (apAccount) return apAccount.id;

  // Fallback to any active liability account
  const [fallbackLiability] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'liability')))
    .limit(1);

  if (fallbackLiability) return fallbackLiability.id;

  throw new AppError(
    "Accounts Payable account not configured. Please create a liability account with 'Payable' or 'Creditor' in its name.",
    400
  );
}

async function resolveVatInput(orgId: string, tx: any): Promise<string> {
  const [vatAccount] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'asset'),
        sql`lower(${accounts.name}) like '%vat%' or lower(${accounts.name}) like '%tax%' or lower(${accounts.name}) like '%input%'`
      )
    )
    .limit(1);

  if (vatAccount) return vatAccount.id;

  // Fallback to any active asset
  const [fallbackAsset] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'asset')))
    .limit(1);

  if (fallbackAsset) return fallbackAsset.id;

  throw new AppError(
    "VAT Input or Tax Asset account not found. Please create an asset account styled 'VAT Input'.",
    400
  );
}

async function resolveExpenseAccount(orgId: string, accountId: string | null | undefined, tx: any): Promise<string> {
  if (accountId) {
    const [existing] = await tx
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.orgId, orgId)))
      .limit(1);
    if (existing) return existing.id;
  }

  // Find standard expense account
  const [expAccount] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'expense')))
    .limit(1);

  if (expAccount) return expAccount.id;

  throw new AppError("A valid Expense general ledger account is required.", 400);
}

/**
 * Creates the matching bookkeeping journal entries for an approved bill.
 */
async function createBillJournalEntry(billId: string, orgId: string, userId: string, tx: any): Promise<string> {
  // 1. Get the bill with its lines
  const [bill] = await tx
    .select()
    .from(bills)
    .where(eq(bills.id, billId))
    .limit(1);

  if (!bill) throw new AppError('Bill not found.', 404);

  const lines = await tx
    .select()
    .from(billLines)
    .where(eq(billLines.billId, billId));

  if (lines.length === 0) {
    throw new AppError('The target bill contains no transaction lines to post.', 400);
  }

  // Find standard accounts
  const apAccountId = await resolveAccountsPayable(orgId, tx);
  const vatAccountId = await resolveVatInput(orgId, tx);

  const journalLinesPayload: any[] = [];

  // CR Accounts Payable (for total bill liability)
  journalLinesPayload.push({
    accountId: apAccountId,
    credit: bill.total,
    description: `Accounts Payable for bill ${bill.billNumber}`
  });

  // Keep track of expenses per account item
  const expenseGroup: Record<string, number> = {};
  let totalTaxSum = 0;

  for (const line of lines) {
    const expAccountId = await resolveExpenseAccount(orgId, line.accountId, tx);
    
    // Line net subtotal sum
    const qty = Number(line.quantity || 0);
    const price = Number(line.unitPrice || 0);
    const lineSubtotal = qty * price;

    expenseGroup[expAccountId] = (expenseGroup[expAccountId] || 0) + lineSubtotal;
    totalTaxSum += line.taxAmount;
  }

  // DR Expense Accounts
  for (const [expAccId, debitAmt] of Object.entries(expenseGroup)) {
    if (debitAmt > 0) {
      journalLinesPayload.push({
        accountId: expAccId,
        debit: debitAmt,
        description: `Expense allocation for bill ${bill.billNumber}`
      });
    }
  }

  // DR VAT Input (if tax occurs)
  if (totalTaxSum > 0) {
    journalLinesPayload.push({
      accountId: vatAccountId,
      debit: totalTaxSum,
      description: `VAT Input portion of bill ${bill.billNumber}`
    });
  }

  // Create general balanced journal entry
  const journalEntry = await createJournalEntry({
    orgId,
    date: bill.date,
    description: `Journal posting of Bill ${bill.billNumber}`,
    reference: bill.billNumber,
    source: 'bill',
    sourceId: bill.id,
    createdBy: userId,
    lines: journalLinesPayload
  }, tx);

  return journalEntry.id;
}

// ==========================================
// 2. MAIN CORE BUSINESS SERVICES
// ==========================================

export async function createBill(input: any, createdBy: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const orgId = input.orgId;

    // 1. Generate sequential Bill Number
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(bills)
      .where(eq(bills.orgId, orgId));

    const billCount = Number(countResult?.count || 0) + 1;
    const billNumber = `BILL-${String(billCount).padStart(4, '0')}`;

    // 2. Calculations
    let subtotal = 0;
    let totalTax = 0;

    const lineObjectsToInsert: any[] = [];

    if (!input.lines || input.lines.length === 0) {
      throw new AppError('Each bill must contain at least one bill line.', 400);
    }

    for (const line of input.lines) {
      const qty = Number(line.quantity || 0);
      const price = Number(line.unitPrice || 0);
      const taxRate = Number(line.taxRate !== undefined ? line.taxRate : 7.5);

      if (qty <= 0 || price < 0) {
        throw new AppError('Quantity must be greater than 0 and price must be non-negative.', 400);
      }

      const lineSubtotal = qty * price;
      const lineTaxAmount = Math.round(lineSubtotal * (taxRate / 100));
      const lineTotal = lineSubtotal + lineTaxAmount;

      subtotal += lineSubtotal;
      totalTax += lineTaxAmount;

      lineObjectsToInsert.push({
        itemId: line.itemId || null,
        description: line.description || '',
        quantity: String(qty),
        unitPrice: price,
        taxRate: String(taxRate),
        taxAmount: lineTaxAmount,
        lineTotal,
        accountId: line.accountId || null
      });
    }

    const total = subtotal + totalTax;

    // 3. Create Bill Header in DB
    const [bill] = await tx
      .insert(bills)
      .values({
        orgId,
        billNumber,
        vendorId: input.vendorId,
        poId: input.poId || null,
        date: input.date ? new Date(input.date) : new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : new Date(),
        status: 'draft', // always starts as draft
        currency: input.currency || 'NGN',
        fxRate: String(input.fxRate || 1.0),
        subtotal,
        taxAmount: totalTax,
        total,
        amountPaid: 0,
        balanceDue: total,
        createdBy
      })
      .returning();

    // 4. Create and attach line objects
    for (const lineObj of lineObjectsToInsert) {
      await tx.insert(billLines).values({
        ...lineObj,
        billId: bill.id
      });
    }

    return {
      ...bill,
      lines: lineObjectsToInsert
    };
  });
}

export async function updateBill(billId: string, input: any, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Fetch bill and check status
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .limit(1);

    if (!bill) throw new AppError('Bill not found.', 404);
    if (bill.status === 'paid') {
      throw new AppError('Paid bills cannot be modified.', 400);
    }
    if (bill.status === 'void') {
      throw new AppError('Void bills cannot be modified.', 400);
    }

    // 2. Clear old lines if lines are provided
    if (input.lines) {
      await tx.delete(billLines).where(eq(billLines.billId, billId));

      let subtotal = 0;
      let totalTax = 0;
      const lineObjectsToInsert: any[] = [];

      for (const line of input.lines) {
        const qty = Number(line.quantity || 0);
        const price = Number(line.unitPrice || 0);
        const taxRate = Number(line.taxRate !== undefined ? line.taxRate : 7.5);

        if (qty <= 0 || price < 0) {
          throw new AppError('Quantity must be greater than 0 and price must be non-negative.', 400);
        }

        const lineSubtotal = qty * price;
        const lineTaxAmount = Math.round(lineSubtotal * (taxRate / 100));
        const lineTotal = lineSubtotal + lineTaxAmount;

        subtotal += lineSubtotal;
        totalTax += lineTaxAmount;

        lineObjectsToInsert.push({
          billId,
          itemId: line.itemId || null,
          description: line.description || '',
          quantity: String(qty),
          unitPrice: price,
          taxRate: String(taxRate),
          taxAmount: lineTaxAmount,
          lineTotal,
          accountId: line.accountId || null
        });
      }

      await tx.insert(billLines).values(lineObjectsToInsert);

      const total = subtotal + totalTax;
      input.subtotal = subtotal;
      input.taxAmount = totalTax;
      input.total = total;
      input.balanceDue = total - bill.amountPaid;
    }

    // 3. Update fields
    const updatePayload: any = {};
    if (input.vendorId) updatePayload.vendorId = input.vendorId;
    if (input.poId !== undefined) updatePayload.poId = input.poId;
    if (input.date) updatePayload.date = new Date(input.date);
    if (input.dueDate) updatePayload.dueDate = new Date(input.dueDate);
    if (input.currency) updatePayload.currency = input.currency;
    if (input.fxRate) updatePayload.fxRate = String(input.fxRate);
    if (input.subtotal !== undefined) updatePayload.subtotal = input.subtotal;
    if (input.taxAmount !== undefined) updatePayload.taxAmount = input.taxAmount;
    if (input.total !== undefined) updatePayload.total = input.total;
    if (input.balanceDue !== undefined) updatePayload.balanceDue = input.balanceDue;
    if (input.notes !== undefined) updatePayload.notes = input.notes;

    const [updated] = await tx
      .update(bills)
      .set(updatePayload)
      .where(eq(bills.id, billId))
      .returning();

    const finalLines = await tx
      .select()
      .from(billLines)
      .where(eq(billLines.billId, billId));

    return {
      ...updated,
      lines: finalLines
    };
  });
}

export async function approveBill(billId: string, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Load active Bill
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .limit(1);

    if (!bill) throw new AppError('Bill not found.', 404);
    if (bill.status !== 'draft') {
      throw new AppError('Bill is already approved or voided.', 400);
    }

    // 2. Set status to open
    const [approvedBill] = await tx
      .update(bills)
      .set({ status: 'open' })
      .where(eq(bills.id, billId))
      .returning();

    // 3. Create General Ledger entry
    const journalId = await createBillJournalEntry(billId, approvedBill.orgId, userId, tx);

    // 4. Update the bill with the journal link
    const [finalBill] = await tx
      .update(bills)
      .set({ journalEntryId: journalId })
      .where(eq(bills.id, billId))
      .returning();

    const finalLines = await tx
      .select()
      .from(billLines)
      .where(eq(billLines.billId, billId));

    return {
      ...finalBill,
      lines: finalLines
    };
  });
}

export async function voidBill(billId: string, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .limit(1);

    if (!bill) throw new AppError('Bill not found.', 404);
    if (bill.status === 'void') throw new AppError('Bill is already void.', 400);

    // Cannot void part-paid bills directly
    if (bill.amountPaid > 0) {
      throw new AppError('Cannot void a bill with existing payments made against it.', 400);
    }

    // VOID matching GL Journal posting if exists
    if (bill.journalEntryId) {
      await reverseJournalEntry(bill.journalEntryId, new Date(), userId);
    }

    // Reset status and outstanding values
    const [voided] = await tx
      .update(bills)
      .set({
        status: 'void',
        balanceDue: 0
      })
      .where(eq(bills.id, billId))
      .returning();

    return voided;
  });
}

export async function duplicateBill(billId: string, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [origin] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .limit(1);

    if (!origin) throw new AppError('Base bill not found.', 404);

    const oldLines = await tx
      .select()
      .from(billLines)
      .where(eq(billLines.billId, billId));

    // Generate next Bill number sequential
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(bills)
      .where(eq(bills.orgId, origin.orgId));

    const billCount = Number(countResult?.count || 0) + 1;
    const billNumber = `BILL-${String(billCount).padStart(4, '0')}`;

    // Insert duplicated header
    const [duplicated] = await tx
      .insert(bills)
      .values({
        orgId: origin.orgId,
        billNumber,
        vendorId: origin.vendorId,
        poId: origin.poId || null,
        date: new Date(),
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // default +30d
        status: 'draft',
        currency: origin.currency,
        fxRate: origin.fxRate,
        subtotal: origin.subtotal,
        taxAmount: origin.taxAmount,
        total: origin.total,
        amountPaid: 0,
        balanceDue: origin.total,
        createdBy: userId
      })
      .returning();

    // Insert duplicated lines
    for (const oldLine of oldLines) {
      await tx.insert(billLines).values({
        billId: duplicated.id,
        itemId: oldLine.itemId,
        description: oldLine.description,
        quantity: oldLine.quantity,
        unitPrice: oldLine.unitPrice,
        taxRate: oldLine.taxRate,
        taxAmount: oldLine.taxAmount,
        lineTotal: oldLine.lineTotal,
        accountId: oldLine.accountId
      });
    }

    const finalLines = await tx
      .select()
      .from(billLines)
      .where(eq(billLines.billId, duplicated.id));

    return {
      ...duplicated,
      lines: finalLines
    };
  });
}

export async function getBill(billId: string, orgId: string): Promise<any> {
  const [bill] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.id, billId), eq(bills.orgId, orgId)))
    .limit(1);

  if (!bill) throw new AppError('Bill not found.', 404);

  const lines = await db
    .select()
    .from(billLines)
    .where(eq(billLines.billId, billId));

  const [vendor] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, bill.vendorId))
    .limit(1);

  return {
    ...bill,
    vendor,
    lines
  };
}

export async function listBills(
  orgId: string,
  filters: { status?: string; vendorId?: string; dateFrom?: string; dateTo?: string; search?: string },
  pagination: { page?: number; limit?: number } = { page: 1, limit: 10 }
): Promise<any> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 10;
  const offset = (page - 1) * limit;

  const conditions = [eq(bills.orgId, orgId)];

  if (filters.status) conditions.push(eq(bills.status, filters.status as any));
  if (filters.vendorId) conditions.push(eq(bills.vendorId, filters.vendorId));
  if (filters.dateFrom) conditions.push(gte(bills.date, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(bills.date, new Date(filters.dateTo)));
  if (filters.search) {
    conditions.push(sql`lower(${bills.billNumber}) like ${'%' + filters.search.toLowerCase() + '%'}`);
  }

  const itemsList = await db
    .select()
    .from(bills)
    .where(and(...conditions))
    .orderBy(desc(bills.date))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(bills)
    .where(and(...conditions));

  const totalItems = Number(countResult?.count || 0);

  return {
    bills: itemsList,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit)
    }
  };
}

export async function getBillAgingReport(orgId: string): Promise<any> {
  // Outstanding vendor bills
  const unpaidBills = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      vendorId: bills.vendorId,
      date: bills.date,
      dueDate: bills.dueDate,
      total: bills.total,
      amountPaid: bills.amountPaid,
      balanceDue: bills.balanceDue
    })
    .from(bills)
    .where(
      and(
        eq(bills.orgId, orgId),
        sql`${bills.status} in ('open', 'partial', 'overdue')`,
        sql`${bills.balanceDue} > 0`
      )
    );

  const vendorsList = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.orgId, orgId), eq(contacts.type, 'vendor')));

  const vendorMap = new Map(vendorsList.map((v) => [v.id, v.name]));

  const now = new Date();
  
  const report = {
    summary: {
      current: 0,
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      daysOver90: 0,
      totalOutstanding: 0
    },
    byVendor: [] as any[],
    bills: [] as any[]
  };

  const vendorGroup: Record<string, { current: number; days1To30: number; days31To60: number; days61To90: number; daysOver90: number; total: number }> = {};

  for (const bl of unpaidBills) {
    const vendId = bl.vendorId;
    const vendorName = vendorMap.get(vendId) || 'Unknown Vendor';

    const dueTime = new Date(bl.dueDate).getTime();
    const diffTime = now.getTime() - dueTime;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let outstanding = bl.balanceDue;
    let bucket = 'current';

    if (!vendorGroup[vendId]) {
      vendorGroup[vendId] = { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, daysOver90: 0, total: 0 };
    }

    if (diffDays <= 0) {
      vendorGroup[vendId].current += outstanding;
      report.summary.current += outstanding;
      bucket = 'current';
    } else if (diffDays <= 30) {
      vendorGroup[vendId].days1To30 += outstanding;
      report.summary.days1To30 += outstanding;
      bucket = '1-30';
    } else if (diffDays <= 60) {
      vendorGroup[vendId].days31To60 += outstanding;
      report.summary.days31To60 += outstanding;
      bucket = '31-60';
    } else if (diffDays <= 90) {
      vendorGroup[vendId].days61To90 += outstanding;
      report.summary.days61To90 += outstanding;
      bucket = '61-90';
    } else {
      vendorGroup[vendId].daysOver90 += outstanding;
      report.summary.daysOver90 += outstanding;
      bucket = '90+';
    }

    vendorGroup[vendId].total += outstanding;
    report.summary.totalOutstanding += outstanding;

    report.bills.push({
      id: bl.id,
      billNumber: bl.billNumber,
      vendorName,
      dueDate: bl.dueDate,
      balanceDue: outstanding,
      overdueDays: diffDays > 0 ? diffDays : 0,
      bucket
    });
  }

  for (const [vId, metrics] of Object.entries(vendorGroup)) {
    const vendorName = vendorMap.get(vId) || 'Unknown Vendor';
    report.byVendor.push({
      vendorId: vId,
      vendorName,
      current: metrics.current,
      days1To30: metrics.days1To30,
      days31To60: metrics.days31To60,
      days61To90: metrics.days61To90,
      daysOver90: metrics.daysOver90,
      totalOutstanding: metrics.total
    });
  }

  return report;
}
