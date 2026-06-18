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
  invoices,
  invoiceLines,
  contacts,
  salesOrders
} from '../db/schema';
import { AppError } from '../lib/errors';
import { createJournalEntry, reverseJournalEntry } from './ledger.service';

// ==========================================
// 1. HELPER FUNCTIONS & ACCOUNTS RESOLUTION
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

  // Fallback to any active asset account
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

async function resolveVatPayable(orgId: string, tx: any): Promise<string> {
  const [vatAccount] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'liability'),
        sql`lower(${accounts.name}) like '%vat%' or lower(${accounts.name}) like '%tax%' or lower(${accounts.name}) like '%payable%'`
      )
    )
    .limit(1);

  if (vatAccount) return vatAccount.id;

  // Fallback to any active liability
  const [fallbackLiability] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'liability')))
    .limit(1);

  if (fallbackLiability) return fallbackLiability.id;

  throw new AppError(
    "VAT Payable or Tax Liability account not found. Please create a liability account styled 'VAT Payable'.",
    400
  );
}

async function resolveRevenueAccount(orgId: string, accountId: string | null | undefined, tx: any): Promise<string> {
  if (accountId) {
    const [existing] = await tx
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.orgId, orgId)))
      .limit(1);
    if (existing) return existing.id;
  }

  // Find standard revenue account
  const [revAccount] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'revenue')))
    .limit(1);

  if (revAccount) return revAccount.id;

  throw new AppError("A valid Sales/Revenue general ledger account is required.", 400);
}

/**
 * Creates the matching bookkeeping journal entries for an invoice.
 */
async function createInvoiceJournalEntry(invoiceId: string, orgId: string, userId: string, tx: any): Promise<string> {
  // 1. Get the invoice with its lines
  const [invoice] = await tx
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) throw new AppError('Invoice not found.', 404);

  const lines = await tx
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId));

  if (lines.length === 0) {
    throw new AppError('The target invoice contains no transaction lines to post.', 400);
  }

  // Find standard accounts
  const arAccountId = await resolveAccountsReceivable(orgId, tx);
  const vatAccountId = await resolveVatPayable(orgId, tx);

  const journalLinesPayload: any[] = [];

  // DR Accounts Receivable (for total invoice value)
  journalLinesPayload.push({
    accountId: arAccountId,
    debit: invoice.total,
    description: `Accounts Receivable for invoice ${invoice.invoiceNumber}`
  });

  // Keep track of revenue per account item
  const revenueGroup: Record<string, number> = {};
  let totalTaxSum = 0;

  for (const line of lines) {
    const revAccountId = await resolveRevenueAccount(orgId, line.accountId, tx);
    
    // Line base sum after discount is applied
    const qty = Number(line.quantity || 0);
    const price = Number(line.unitPrice || 0);
    const discPct = Number(line.discountPct || 0);
    const baseSubtotal = qty * price;
    const discAmt = Math.round(baseSubtotal * (discPct / 100));
    const netBase = baseSubtotal - discAmt;

    revenueGroup[revAccountId] = (revenueGroup[revAccountId] || 0) + netBase;
    totalTaxSum += line.taxAmount;
  }

  // CR Revenue Accounts
  for (const [revAccId, creditAmt] of Object.entries(revenueGroup)) {
    if (creditAmt > 0) {
      journalLinesPayload.push({
        accountId: revAccId,
        credit: creditAmt,
        description: `Revenue for invoice ${invoice.invoiceNumber}`
      });
    }
  }

  // CR VAT Payable (if tax occurs)
  if (totalTaxSum > 0) {
    journalLinesPayload.push({
      accountId: vatAccountId,
      credit: totalTaxSum,
      description: `VAT Payable portion of invoice ${invoice.invoiceNumber}`
    });
  }

  // Create general balanced journal entry
  const journalEntry = await createJournalEntry({
    orgId,
    date: invoice.date,
    description: `Journal posting of Invoice ${invoice.invoiceNumber}`,
    reference: invoice.invoiceNumber,
    source: 'invoice',
    sourceId: invoice.id,
    createdBy: userId,
    lines: journalLinesPayload
  }, tx);

  return journalEntry.id;
}

// ==========================================
// 2. MAIN CORE BUSINESS SERVICES
// ==========================================

export async function createInvoice(input: any, createdBy: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const orgId = input.orgId;

    // 1. Generate sequential Invoice Number
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(eq(invoices.orgId, orgId));

    const invoiceCount = Number(countResult?.count || 0) + 1;
    const invoiceNumber = `INV-${String(invoiceCount).padStart(4, '0')}`;

    // 2. Calculations
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    const lineObjectsToInsert: any[] = [];

    if (!input.lines || input.lines.length === 0) {
      throw new AppError('Each invoice must contain at least one invoice line.', 400);
    }

    for (const line of input.lines) {
      const qty = Number(line.quantity || 0);
      const price = Number(line.unitPrice || 0);
      const discPct = Number(line.discountPct || 0);
      const taxRate = Number(line.taxRate !== undefined ? line.taxRate : 7.5);

      if (qty <= 0 || price < 0) {
        throw new AppError('Quantity must be greater than 0 and price must be non-negative.', 400);
      }

      const lineSubtotalBeforeDiscount = qty * price;
      const discountAmount = Math.round(lineSubtotalBeforeDiscount * (discPct / 100));
      const lineSubtotalAfterDiscount = lineSubtotalBeforeDiscount - discountAmount;
      const lineTaxAmount = Math.round(lineSubtotalAfterDiscount * (taxRate / 100));
      const lineTotal = lineSubtotalAfterDiscount + lineTaxAmount;

      subtotal += lineSubtotalBeforeDiscount;
      totalDiscount += discountAmount;
      totalTax += lineTaxAmount;

      lineObjectsToInsert.push({
        itemId: line.itemId || null,
        description: line.description || '',
        quantity: String(qty),
        unitPrice: price,
        discountPct: String(discPct),
        taxRate: String(taxRate),
        taxAmount: lineTaxAmount,
        lineTotal,
        accountId: line.accountId || null
      });
    }

    const total = subtotal - totalDiscount + totalTax;
    const amountPaid = 0;
    const balanceDue = total;

    // 3. Insert Invoice root node
    const [invoice] = await tx
      .insert(invoices)
      .values({
        orgId,
        invoiceNumber,
        customerId: input.customerId,
        soId: input.soId || null,
        date: new Date(input.date || new Date()),
        dueDate: new Date(input.dueDate || new Date()),
        status: input.status || 'draft',
        currency: input.currency || 'NGN',
        fxRate: input.fxRate ? String(input.fxRate) : '1.00000000',
        subtotal,
        discountAmount: totalDiscount,
        taxAmount: totalTax,
        total,
        amountPaid,
        balanceDue,
        paymentTerms: input.paymentTerms || null,
        notes: input.notes || null,
        terms: input.terms || null,
        recurringId: input.recurringId || null,
        createdBy
      })
      .returning();

    if (!invoice) throw new AppError('Failed to record invoice root structure.', 500);

    // 4. Record invoice lines
    const createdLines: any[] = [];
    for (const lineObj of lineObjectsToInsert) {
      const [insertedLine] = await tx
        .insert(invoiceLines)
        .values({
          invoiceId: invoice.id,
          ...lineObj
        })
        .returning();
      createdLines.push(insertedLine);
    }

    let finalInvoice = { ...invoice, lines: createdLines };

    // 5. If status is already sent, trigger automatic double-entry posting
    if (invoice.status === 'sent') {
      const journalEntryId = await createInvoiceJournalEntry(invoice.id, orgId, createdBy, tx);
      await tx
        .update(invoices)
        .set({ journalEntryId })
        .where(eq(invoices.id, invoice.id));

      finalInvoice.journalEntryId = journalEntryId;
    }

    return finalInvoice;
  });
}

export async function updateInvoice(id: string, input: any, updatedBy: string): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Only allow updates when status is draft
    const [existingInvoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    if (!existingInvoice) throw new AppError('Invoice not found.', 404);
    if (existingInvoice.status !== 'draft') {
      throw new AppError('Changes can only be applied to draft invoices.', 400);
    }

    // 2. Perform recalculations if new lines are provided
    let subtotal = existingInvoice.subtotal;
    let totalDiscount = existingInvoice.discountAmount;
    let totalTax = existingInvoice.taxAmount;
    let total = existingInvoice.total;

    let hasLinesUpdate = input.lines && input.lines.length > 0;
    const lineObjectsToInsert: any[] = [];

    if (hasLinesUpdate) {
      subtotal = 0;
      totalDiscount = 0;
      totalTax = 0;

      for (const line of input.lines) {
        const qty = Number(line.quantity || 0);
        const price = Number(line.unitPrice || 0);
        const discPct = Number(line.discountPct || 0);
        const taxRate = Number(line.taxRate !== undefined ? line.taxRate : 7.5);

        if (qty <= 0 || price < 0) {
          throw new AppError('Quantity must be greater than 0 and price must be non-negative.', 400);
        }

        const lineSubtotalBeforeDiscount = qty * price;
        const discountAmount = Math.round(lineSubtotalBeforeDiscount * (discPct / 100));
        const lineSubtotalAfterDiscount = lineSubtotalBeforeDiscount - discountAmount;
        const lineTaxAmount = Math.round(lineSubtotalAfterDiscount * (taxRate / 100));
        const lineTotal = lineSubtotalAfterDiscount + lineTaxAmount;

        subtotal += lineSubtotalBeforeDiscount;
        totalDiscount += discountAmount;
        totalTax += lineTaxAmount;

        lineObjectsToInsert.push({
          itemId: line.itemId || null,
          description: line.description || '',
          quantity: String(qty),
          unitPrice: price,
          discountPct: String(discPct),
          taxRate: String(taxRate),
          taxAmount: lineTaxAmount,
          lineTotal,
          accountId: line.accountId || null
        });
      }

      total = subtotal - totalDiscount + totalTax;
    }

    const amountPaid = 0; 
    const balanceDue = total;

    // Update parent invoice
    const [updatedInvoice] = await tx
      .update(invoices)
      .set({
        customerId: input.customerId ?? existingInvoice.customerId,
        soId: input.soId !== undefined ? input.soId : existingInvoice.soId,
        date: input.date ? new Date(input.date) : existingInvoice.date,
        dueDate: input.dueDate ? new Date(input.dueDate) : existingInvoice.dueDate,
        status: input.status ?? existingInvoice.status,
        currency: input.currency ?? existingInvoice.currency,
        fxRate: input.fxRate ? String(input.fxRate) : existingInvoice.fxRate,
        subtotal,
        discountAmount: totalDiscount,
        taxAmount: totalTax,
        total,
        amountPaid,
        balanceDue,
        paymentTerms: input.paymentTerms !== undefined ? input.paymentTerms : existingInvoice.paymentTerms,
        notes: input.notes !== undefined ? input.notes : existingInvoice.notes,
        terms: input.terms !== undefined ? input.terms : existingInvoice.terms
      })
      .where(eq(invoices.id, id))
      .returning();

    // 4. Update lines if provided
    let finalLines: any[] = [];
    if (hasLinesUpdate) {
      await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
      for (const lineObj of lineObjectsToInsert) {
        const [insertedLine] = await tx
          .insert(invoiceLines)
          .values({
            invoiceId: id,
            ...lineObj
          })
          .returning();
        finalLines.push(insertedLine);
      }
    } else {
      finalLines = await tx
        .select()
        .from(invoiceLines)
        .where(eq(invoiceLines.invoiceId, id));
    }

    return {
      ...updatedInvoice,
      lines: finalLines
    };
  });
}

export async function sendInvoice(id: string, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    if (!invoice) throw new AppError('Invoice not found.', 404);

    let journalEntryId = invoice.journalEntryId;

    // Check if the journal entry is not yet created
    if (!journalEntryId) {
      journalEntryId = await createInvoiceJournalEntry(id, invoice.orgId, userId, tx);
    }

    const [updatedInvoice] = await tx
      .update(invoices)
      .set({
        status: 'sent',
        journalEntryId
      })
      .where(eq(invoices.id, id))
      .returning();

    const lines = await tx
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, id));

    return {
      ...updatedInvoice,
      lines
    };
  });
}

export async function voidInvoice(id: string, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    if (!invoice) throw new AppError('Invoice not found.', 404);
    if (invoice.status === 'void') return invoice;

    // Reverse corresponding journal entry if exists
    if (invoice.journalEntryId) {
      await reverseJournalEntry(invoice.journalEntryId, new Date(), userId);
    }

    const [updatedInvoice] = await tx
      .update(invoices)
      .set({
        status: 'void',
        balanceDue: 0,
        amountPaid: 0
      })
      .where(eq(invoices.id, id))
      .returning();

    const lines = await tx
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, id));

    return {
      ...updatedInvoice,
      lines
    };
  });
}

export async function duplicateInvoice(id: string, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    if (!invoice) throw new AppError('Origin invoice not found.', 404);

    const lines = await tx
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, id));

    const payload = {
      orgId: invoice.orgId,
      customerId: invoice.customerId,
      soId: invoice.soId,
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days due
      status: 'draft',
      currency: invoice.currency,
      fxRate: invoice.fxRate,
      paymentTerms: invoice.paymentTerms,
      notes: invoice.notes,
      terms: invoice.terms,
      recurringId: invoice.recurringId,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: l.unitPrice,
        discountPct: Number(l.discountPct),
        taxRate: Number(l.taxRate),
        accountId: l.accountId
      }))
    };

    return await createInvoice(payload, userId);
  });
}

export async function getInvoice(id: string, orgId: string): Promise<any> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, orgId)))
    .limit(1);

  if (!invoice) throw new AppError('Invoice not found.', 404);

  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, id));

  const [customer] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, invoice.customerId))
    .limit(1);

  // Fetch payment/allocations history
  const paymentHistory = await db
    .select({
      allocationId: sql`payment_allocations.id`,
      amountAllocated: sql`payment_allocations.amount`,
      paymentId: sql`payments_received.id`,
      paymentNumber: sql`payments_received.payment_number`,
      date: sql`payments_received.date`,
      paymentMethod: sql`payments_received.payment_method`,
      reference: sql`payments_received.reference`,
      notes: sql`payments_received.notes`
    })
    .from(db.select().from(sql`payment_allocations`).as('payment_allocations') as any)
    .innerJoin(
      db.select().from(sql`payments_received`).as('payments_received') as any,
      sql`payment_allocations.payment_id = payments_received.id`
    )
    .where(sql`payment_allocations.invoice_id = ${id}`);

  return {
    ...invoice,
    lines,
    customer,
    paymentHistory: paymentHistory || []
  };
}

export async function listInvoices(
  orgId: string,
  filters: { status?: string; customerId?: string; dateFrom?: string; dateTo?: string; search?: string },
  pagination: { page?: number; limit?: number } = { page: 1, limit: 10 }
): Promise<any> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 10;
  const offset = (page - 1) * limit;

  const conditions = [eq(invoices.orgId, orgId)];

  if (filters.status) conditions.push(eq(invoices.status, filters.status as any));
  if (filters.customerId) conditions.push(eq(invoices.customerId, filters.customerId));
  if (filters.dateFrom) conditions.push(gte(invoices.date, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(invoices.date, new Date(filters.dateTo)));
  if (filters.search) {
    conditions.push(sql`lower(${invoices.invoiceNumber}) like ${'%' + filters.search.toLowerCase() + '%'}`);
  }

  const allContacts = await db.select({ id: contacts.id, name: contacts.name }).from(contacts).where(eq(contacts.orgId, orgId));
  const custMap = new Map(allContacts.map((c: any) => [c.id, c.name]));

  const itemsList = await db
    .select()
    .from(invoices)
    .where(and(...conditions))
    .orderBy(desc(invoices.date))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(and(...conditions));

  const totalItems = Number(countResult?.count || 0);

  return {
    invoices: itemsList.map((inv: any) => ({ ...inv, clientName: custMap.get(inv.customerId) || null })),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit)
    }
  };
}

export async function getInvoiceAgingReport(orgId: string): Promise<any> {
  // Outstanding invoices (sent, partial, or overdue with positive balance due)
  const unpaidInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      customerId: invoices.customerId,
      date: invoices.date,
      dueDate: invoices.dueDate,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      balanceDue: invoices.balanceDue
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.orgId, orgId),
        sql`${invoices.status} in ('sent', 'partial', 'overdue')`,
        sql`${invoices.balanceDue} > 0`
      )
    );

  const customersList = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.orgId, orgId), eq(contacts.type, 'customer')));

  const customerMap = new Map(customersList.map((c) => [c.id, c.name]));

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
    byCustomer: [] as any[],
    invoices: [] as any[]
  };

  const customerGroup: Record<string, { current: number; days1To30: number; days31To60: number; days61To90: number; daysOver90: number; total: number }> = {};

  for (const inv of unpaidInvoices) {
    const custId = inv.customerId;
    const customerName = customerMap.get(custId) || 'Unknown Customer';

    const dueTime = new Date(inv.dueDate).getTime();
    const diffTime = now.getTime() - dueTime;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let outstanding = inv.balanceDue;
    let bucket = 'current';

    if (!customerGroup[custId]) {
      customerGroup[custId] = { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, daysOver90: 0, total: 0 };
    }

    if (diffDays <= 0) {
      customerGroup[custId].current += outstanding;
      report.summary.current += outstanding;
      bucket = 'current';
    } else if (diffDays <= 30) {
      customerGroup[custId].days1To30 += outstanding;
      report.summary.days1To30 += outstanding;
      bucket = '1-30';
    } else if (diffDays <= 60) {
      customerGroup[custId].days31To60 += outstanding;
      report.summary.days31To60 += outstanding;
      bucket = '31-60';
    } else if (diffDays <= 90) {
      customerGroup[custId].days61To90 += outstanding;
      report.summary.days61To90 += outstanding;
      bucket = '61-90';
    } else {
      customerGroup[custId].daysOver90 += outstanding;
      report.summary.daysOver90 += outstanding;
      bucket = '90+';
    }

    customerGroup[custId].total += outstanding;
    report.summary.totalOutstanding += outstanding;

    report.invoices.push({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName,
      dueDate: inv.dueDate,
      balanceDue: outstanding,
      overdueDays: diffDays > 0 ? diffDays : 0,
      bucket
    });
  }

  for (const [custId, metrics] of Object.entries(customerGroup)) {
    const customerName = customerMap.get(custId) || 'Unknown Customer';
    report.byCustomer.push({
      customerId: custId,
      customerName,
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


