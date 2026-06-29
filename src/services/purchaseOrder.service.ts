/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { eq, and, lte, gte, sql, desc } from 'drizzle-orm';
import {
  db,
  purchaseOrders,
  contacts,
  bills,
  billLines,
  accounts
} from '../db/schema';
import { AppError } from '../lib/errors';
import { createBill } from './bill.service';
import { createExpense } from './expense.service';
import { getOrgSettings } from './settings.service';

// ==========================================
// UTILITIES FOR STORAGE OF VIRTUAL PO LINES
// ==========================================

export function serializePoNotesAndLines(rawNotes: string | null | undefined, lines: any[]): string {
  return JSON.stringify({
    userNotes: rawNotes || '',
    virtualLines: lines || []
  });
}

export function deserializePoNotesAndLines(serialized: string | null | undefined): { userNotes: string; virtualLines: any[] } {
  if (!serialized) {
    return { userNotes: '', virtualLines: [] };
  }
  try {
    const parsed = JSON.parse(serialized);
    if (parsed && Array.isArray(parsed.virtualLines)) {
      return {
        userNotes: parsed.userNotes || '',
        virtualLines: parsed.virtualLines
      };
    }
  } catch (e) {
    // Treat as raw text note
  }
  return { userNotes: serialized || '', virtualLines: [] };
}

// ==========================================
// CORE PURCHASE ORDER SERVICES
// ==========================================

export async function createPO(input: any, createdBy: string): Promise<any> {
  const orgId = input.orgId;
  const settings = await getOrgSettings(orgId);
  const defaultTaxRate = settings.general?.defaultTaxRate ?? 7.5;
  const defaultCurrency = settings.general?.defaultCurrency || 'NGN';
  const poSeries = (settings.txnNumbering?.series || []).find((s: any) => s.module === 'Purchase Order');
  const numPrefix = poSeries?.prefix || 'PO-';
  const startStr = poSeries?.start || '00001';
  const startNum = parseInt(startStr, 10);
  const padLen = Math.max(4, startStr.length);

  return await db.transaction(async (tx) => {
    // 1. Generate sequential PO number
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.orgId, orgId));

    const poCount = Number(countResult?.count || 0);
    const poNumber = `${numPrefix}${String(startNum + poCount).padStart(padLen, '0')}`;

    // 2. Calculations based on input lines
    let subtotal = 0;
    let totalTax = 0;
    const validatedLines: any[] = [];

    if (input.lines && input.lines.length > 0) {
      for (const line of input.lines) {
        const qty = Number(line.quantity || 0);
        const price = Number(line.unitPrice || 0);
        const taxRate = Number(line.taxRate !== undefined ? line.taxRate : defaultTaxRate);

        if (qty <= 0 || price < 0) {
          throw new AppError('Quantity must be positive and price must be non-negative.', 400);
        }

        const lineSubtotal = qty * price;
        const lineTaxAmount = Math.round(lineSubtotal * (taxRate / 100));
        const lineTotal = lineSubtotal + lineTaxAmount;

        subtotal += lineSubtotal;
        totalTax += lineTaxAmount;

        validatedLines.push({
          itemId: line.itemId || null,
          description: line.description || '',
          quantity: qty,
          unitPrice: price,
          taxRate,
          taxAmount: lineTaxAmount,
          lineTotal,
          accountId: line.accountId || null
        });
      }
    }

    const total = subtotal + totalTax;
    const serializedNotes = serializePoNotesAndLines(input.notes, validatedLines);

    // 3. Save purchase order
    const [po] = await tx
      .insert(purchaseOrders)
      .values({
        orgId,
        poNumber,
        vendorId: input.vendorId,
        date: input.date ? new Date(input.date) : new Date(),
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        status: 'draft', // defaults directly to draft
        currency: input.currency || defaultCurrency,
        subtotal,
        tax: totalTax,
        total,
        notes: serializedNotes,
        createdBy
      })
      .returning();

    return {
      ...po,
      notes: input.notes || '',
      lines: validatedLines
    };
  });
}

export async function updatePO(poId: string, input: any, userId: string): Promise<any> {
  const [poOrg] = await db.select({ orgId: purchaseOrders.orgId }).from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
  const settings = poOrg?.orgId ? await getOrgSettings(poOrg.orgId) : undefined;
  const defaultTaxRate = settings?.general?.defaultTaxRate ?? 7.5;

  return await db.transaction(async (tx) => {
    const [po] = await tx
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, poId))
      .limit(1);

    if (!po) throw new AppError('Purchase order not found.', 404);
    if (po.status !== 'draft') {
      throw new AppError('Only draft purchase orders can be modified.', 400);
    }

    let subtotal = po.subtotal;
    let totalTax = po.tax;
    let total = po.total;
    let validatedLines: any[] = [];

    // Decode existing lines if none provided, to preserve them
    const decoded = deserializePoNotesAndLines(po.notes);
    validatedLines = decoded.virtualLines;

    if (input.lines) {
      subtotal = 0;
      totalTax = 0;
      validatedLines = [];

      for (const line of input.lines) {
        const qty = Number(line.quantity || 0);
        const price = Number(line.unitPrice || 0);
        const taxRate = Number(line.taxRate !== undefined ? line.taxRate : defaultTaxRate);

        if (qty <= 0 || price < 0) {
          throw new AppError('Quantity must be positive and price must be non-negative.', 400);
        }

        const lineSubtotal = qty * price;
        const lineTaxAmount = Math.round(lineSubtotal * (taxRate / 100));
        const lineTotal = lineSubtotal + lineTaxAmount;

        subtotal += lineSubtotal;
        totalTax += lineTaxAmount;

        validatedLines.push({
          itemId: line.itemId || null,
          description: line.description || '',
          quantity: qty,
          unitPrice: price,
          taxRate,
          taxAmount: lineTaxAmount,
          lineTotal,
          accountId: line.accountId || null
        });
      }
      total = subtotal + totalTax;
    }

    const currentNotesPlain = input.notes !== undefined ? input.notes : decoded.userNotes;
    const serializedNotes = serializePoNotesAndLines(currentNotesPlain, validatedLines);

    // Update PO header
    const updatePayload: any = {
      notes: serializedNotes,
      subtotal,
      tax: totalTax,
      total
    };

    if (input.vendorId) updatePayload.vendorId = input.vendorId;
    if (input.date) updatePayload.date = new Date(input.date);
    if (input.expectedDate !== undefined) {
      updatePayload.expectedDate = input.expectedDate ? new Date(input.expectedDate) : null;
    }
    if (input.currency) updatePayload.currency = input.currency;

    const [updatedPo] = await tx
      .update(purchaseOrders)
      .set(updatePayload)
      .where(eq(purchaseOrders.id, poId))
      .returning();

    return {
      ...updatedPo,
      notes: currentNotesPlain,
      lines: validatedLines
    };
  });
}

export async function sendPO(poId: string, userId: string): Promise<any> {
  const [po] = await db
    .update(purchaseOrders)
    .set({ status: 'sent' })
    .where(eq(purchaseOrders.id, poId))
    .returning();

  if (!po) throw new AppError('Purchase order not found.', 404);

  const decoded = deserializePoNotesAndLines(po.notes);
  return {
    ...po,
    notes: decoded.userNotes,
    lines: decoded.virtualLines
  };
}

export async function convertToBill(poId: string, userId: string): Promise<any> {
  const [poRow] = await db.select({ orgId: purchaseOrders.orgId }).from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
  const orgId = poRow?.orgId;
  const settings = orgId ? await getOrgSettings(orgId) : undefined;
  const billSeries = (settings?.txnNumbering?.series || []).find((s: any) => s.module === 'Bill' || s.module === 'Vendor Bill');
  const numPrefix = billSeries?.prefix || 'BILL-';
  const startStr = billSeries?.start || '00001';
  const startNum = parseInt(startStr, 10);
  const padLen = Math.max(4, startStr.length);

  return await db.transaction(async (tx) => {
    // 1. Fetch source PO
    const [po] = await tx
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, poId))
      .limit(1);

    if (!po) throw new AppError('Purchase order not found.', 404);
    if (po.status === 'cancelled') {
      throw new AppError('Cancelled purchase orders cannot be converted to bills.', 400);
    }

    const decoded = deserializePoNotesAndLines(po.notes);

    // 2. Format lines as active bill lines
    const billLinesInput = decoded.virtualLines.map((vl) => ({
      itemId: vl.itemId,
      description: vl.description,
      quantity: vl.quantity,
      unitPrice: vl.unitPrice,
      taxRate: vl.taxRate,
      accountId: vl.accountId
    }));

    // 3. Call CreateBill standard transaction internally
    // We construct invoice/bill style creation payload
    // Set matching poId pointer inside the bill header
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(bills)
      .where(eq(bills.orgId, po.orgId));

    const billCount = Number(countResult?.count || 0);
    const billNumber = `${numPrefix}${String(startNum + billCount).padStart(padLen, '0')}`;

    const [bill] = await tx
      .insert(bills)
      .values({
        orgId: po.orgId,
        billNumber,
        vendorId: po.vendorId,
        poId: po.id,
        date: new Date(),
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // default 30 days due
        status: 'draft',
        currency: po.currency,
        fxRate: '1.0',
        subtotal: po.subtotal,
        taxAmount: po.tax,
        total: po.total,
        amountPaid: 0,
        balanceDue: po.total,
        createdBy: userId
      })
      .returning();

    // Insert bill lines
    for (const block of billLinesInput) {
      await tx.insert(billLines).values({
        billId: bill.id,
        itemId: block.itemId || null,
        description: block.description || '',
        quantity: String(block.quantity),
        unitPrice: block.unitPrice,
        taxRate: String(block.taxRate),
        taxAmount: Math.round((block.quantity * block.unitPrice) * (block.taxRate / 100)),
        lineTotal: Math.round((block.quantity * block.unitPrice) * (1 + block.taxRate / 100)),
        accountId: block.accountId || null
      });
    }

    // 4. Update parent PO status to received
    await tx
      .update(purchaseOrders)
      .set({ status: 'received' })
      .where(eq(purchaseOrders.id, poId));

    const finalBillLines = await tx
      .select()
      .from(billLines)
      .where(eq(billLines.billId, bill.id));

    return {
      message: `Purchase Order ${po.poNumber} converted successfully into Draft Bill ${bill.billNumber}.`,
      bill: {
        ...bill,
        lines: finalBillLines
      }
    };
  });
}

export async function getPO(poId: string, orgId: string): Promise<any> {
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.orgId, orgId)))
    .limit(1);

  if (!po) throw new AppError('Purchase order not found.', 404);

  const [vendor] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, po.vendorId))
    .limit(1);

  const decoded = deserializePoNotesAndLines(po.notes);

  return {
    ...po,
    vendor,
    notes: decoded.userNotes,
    lines: decoded.virtualLines
  };
}

export async function deletePO(poId: string, orgId: string): Promise<any> {
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.orgId, orgId)))
    .limit(1);

  if (!po) throw new AppError('Purchase order not found.', 404);
  if (po.status !== 'draft') {
    throw new AppError('Only draft purchase orders can be deleted.', 400);
  }

  const [deleted] = await db
    .delete(purchaseOrders)
    .where(eq(purchaseOrders.id, poId))
    .returning();

  return { message: `Purchase order ${deleted.poNumber} deleted successfully.` };
}

export async function convertToExpense(poId: string, userId: string): Promise<any> {
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId))
    .limit(1);

  if (!po) throw new AppError('Purchase order not found.', 404);
  if (po.status === 'cancelled') {
    throw new AppError('Cancelled purchase orders cannot be converted to expenses.', 400);
  }

  const decoded = deserializePoNotesAndLines(po.notes);

  // Find an expense account for the org
  const [expAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, po.orgId), eq(accounts.type, 'expense')))
    .limit(1);

  if (!expAccount) {
    throw new AppError('No expense GL account found. Please create an expense account first.', 400);
  }

  const expense = await createExpense({
    orgId: po.orgId,
    vendorId: po.vendorId,
    accountId: expAccount.id,
    date: new Date().toISOString(),
    amount: po.total,
    taxAmount: po.tax,
    currency: po.currency || 'NGN',
    paymentMethod: 'bank_transfer',
    description: decoded.userNotes || `Expense from PO ${po.poNumber}`,
    reference: po.poNumber,
    isBillable: false,
    onAccount: true,
  }, userId);

  // Update PO status to received
  await db
    .update(purchaseOrders)
    .set({ status: 'received' })
    .where(eq(purchaseOrders.id, poId));

  return {
    message: `Purchase Order ${po.poNumber} converted successfully into Expense ${expense.expenseNumber}.`,
    expense,
  };
}

export async function listPOs(
  orgId: string,
  filters: { status?: string; vendorId?: string; dateFrom?: string; dateTo?: string },
  pagination: { page?: number; limit?: number } = { page: 1, limit: 10 }
): Promise<any> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 10;
  const offset = (page - 1) * limit;

  const conditions = [eq(purchaseOrders.orgId, orgId)];

  if (filters.status) conditions.push(eq(purchaseOrders.status, filters.status as any));
  if (filters.vendorId) conditions.push(eq(purchaseOrders.vendorId, filters.vendorId));
  if (filters.dateFrom) conditions.push(gte(purchaseOrders.date, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(purchaseOrders.date, new Date(filters.dateTo)));

  const list = await db
    .select()
    .from(purchaseOrders)
    .where(and(...conditions))
    .orderBy(desc(purchaseOrders.date))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(purchaseOrders)
    .where(and(...conditions));

  const totalItems = Number(countResult?.count || 0);

  const parsedList = list.map((item) => {
    const decoded = deserializePoNotesAndLines(item.notes);
    return {
      ...item,
      notes: decoded.userNotes,
      lines: decoded.virtualLines
    };
  });

  return {
    purchaseOrders: parsedList,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit)
    }
  };
}
