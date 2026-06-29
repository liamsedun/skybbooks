/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { eq, and, sql } from 'drizzle-orm';
import {
  db,
  accounts,
  expenses,
  contacts,
  journalEntries,
  journalLines
} from '../db/schema';
import { AppError } from '../lib/errors';
import { createJournalEntry, reverseJournalEntry } from './ledger.service';
import { getOrgSettings } from './settings.service';
import Tesseract from 'tesseract.js';

// ==========================================
// HELPER FUNCTIONS & RESOLVERS
// ==========================================

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

  throw new AppError('Accounts Payable account not configured. Go to Chart of Accounts, select a liability account, and set its System Role to \'Accounts Payable\'.', 404);
}

async function resolveBankOrCashAccount(orgId: string, paymentAccountId: string | null | undefined, tx: any): Promise<string> {
  if (paymentAccountId) {
    const [existing] = await tx
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, paymentAccountId), eq(accounts.orgId, orgId)))
      .limit(1);
    if (existing) return existing.id;
  }

  const [cashAccount] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.systemAccountRole, 'bank')
      )
    )
    .limit(1);

  if (cashAccount) return cashAccount.id;

  throw new AppError('Bank or Cash account not configured. Go to Chart of Accounts, select an asset account, and set its System Role to \'Bank\'.', 404);
}

async function resolveVatInput(orgId: string, tx: any): Promise<string> {
  const [vatAccount] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.systemAccountRole, 'vat_receivable')
      )
    )
    .limit(1);

  if (vatAccount) return vatAccount.id;

  throw new AppError('VAT Receivable account not configured. Go to Chart of Accounts, select an asset account, and set its System Role to \'VAT Receivable\'.', 404);
}
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'asset')))
    .limit(1);

  if (fallbackAsset) return fallbackAsset.id;

  throw new AppError('VAT Input account could not be resolved.', 404);
}

// ==========================================
// CORE EXPENSES SERVICE
// ==========================================

export async function createExpense(input: any, createdBy: string): Promise<any> {
  const orgId = input.orgId;
  const settings = await getOrgSettings(orgId);
  const defaultCurrency = settings.general?.defaultCurrency || 'NGN';
  const expSeries = (settings.txnNumbering?.series || []).find((s: any) => s.module === 'Expense' || s.module === 'Vendor Payment');
  const numPrefix = expSeries?.prefix || 'EXP-';
  const startStr = expSeries?.start || '00001';
  const startNum = parseInt(startStr, 10);
  const padLen = Math.max(5, startStr.length);

  return await db.transaction(async (tx) => {
    const amount = Number(input.amount || 0);
    const taxAmount = Number(input.taxAmount || 0);
    const onAccount = !!input.onAccount;

    if (amount <= 0) {
      throw new AppError('Expense amount must be greater than zero.', 400);
    }

    // Generate unique sequential expense number
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(expenses)
      .where(eq(expenses.orgId, orgId));

    const expCount = Number(countResult?.count || 0);
    const expenseNumber = `${numPrefix}${String(startNum + expCount).padStart(padLen, '0')}`;

    // Compute net expense debit portion
    const netExpenseAmt = amount - taxAmount;

    // Resolve target accounts
    const expenseAccountId = input.accountId; // DR Expense Account
    const creditAccountId = onAccount
      ? await resolveAccountsPayable(orgId, tx) // CR Accounts Payable
      : await resolveBankOrCashAccount(orgId, input.paymentAccountId, tx); // CR Bank/Cash Account

    const vatAccountId = await resolveVatInput(orgId, tx);

    // Create primary expense record
    const [expense] = await tx
      .insert(expenses)
      .values({
        orgId,
        expenseNumber,
        vendorId: input.vendorId || null,
        date: input.date ? new Date(input.date) : new Date(),
        accountId: expenseAccountId,
        amount,
        taxAmount,
        currency: input.currency || defaultCurrency,
        paymentMethod: input.paymentMethod || 'cash',
        reference: input.reference || null,
        description: input.description || null,
        isBillable: !!input.isBillable,
        customerId: input.customerId || null,
        receiptUrl: input.receiptUrl || null,
        createdBy
      })
      .returning();

    // Create balanced accounting journal posting
    const journalLinesPayload: any[] = [];

    // DR Expense Account portion
    journalLinesPayload.push({
      accountId: expenseAccountId,
      debit: netExpenseAmt,
      description: `Expense debit posting: ${expenseNumber} - ${input.description || 'Direct Expense'}`
    });

    // DR VAT Input portion
    if (taxAmount > 0) {
      journalLinesPayload.push({
        accountId: vatAccountId,
        debit: taxAmount,
        description: `VAT portion of expense ${expenseNumber}`
      });
    }

    // CR Payment Bank/Cash Account or Accounts Payable liability
    journalLinesPayload.push({
      accountId: creditAccountId,
      credit: amount,
      description: onAccount
        ? `AP posting liability for expense ${expenseNumber}`
        : `Bank/Cash credit disbursement for expense ${expenseNumber}`
    });

    const journalEntry = await createJournalEntry({
      orgId,
      date: expense.date,
      description: `Bookkeeping entry for expense ${expenseNumber}`,
      reference: expenseNumber,
      source: 'manual', // standard journal classification
      sourceId: expense.id,
      createdBy,
      lines: journalLinesPayload
    }, tx);

    // Update original expense record with journal link
    const [finalExpense] = await tx
      .update(expenses)
      .set({ journalEntryId: journalEntry.id })
      .where(eq(expenses.id, expense.id))
      .returning();

    return finalExpense;
  });
}

export async function listExpenses(orgId: string): Promise<any[]> {
  return await db
    .select()
    .from(expenses)
    .where(eq(expenses.orgId, orgId))
    .orderBy(sql`${expenses.date} desc`);
}

export async function updateExpense(expenseId: string, input: any, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    // Check if expense exists
    const [expense] = await tx
      .select()
      .from(expenses)
      .where(eq(expenses.id, expenseId))
      .limit(1);

    if (!expense) throw new AppError('Expense not found.', 404);

    // If there is an existing journal entry we must reverse/void it and recreate a clean one
    if (expense.journalEntryId) {
      await reverseJournalEntry(expense.journalEntryId, new Date(), userId);
    }

    const updatedAmount = input.amount !== undefined ? Number(input.amount) : expense.amount;
    const updatedTax = input.taxAmount !== undefined ? Number(input.taxAmount) : expense.taxAmount;
    const updatedNet = updatedAmount - updatedTax;

    const onAccount = input.onAccount !== undefined ? !!input.onAccount : (expense.paymentMethod === 'cheque' || !expense.paymentMethod);

    const expenseAccountId = input.accountId || expense.accountId;
    const creditAccountId = onAccount
      ? await resolveAccountsPayable(expense.orgId, tx)
      : await resolveBankOrCashAccount(expense.orgId, input.paymentAccountId, tx);

    const vatAccountId = await resolveVatInput(expense.orgId, tx);

    // Update expense record
    const [updatedExpense] = await tx
      .update(expenses)
      .set({
        vendorId: input.vendorId !== undefined ? input.vendorId : expense.vendorId,
        date: input.date ? new Date(input.date) : expense.date,
        accountId: expenseAccountId,
        amount: updatedAmount,
        taxAmount: updatedTax,
        currency: input.currency || expense.currency,
        paymentMethod: input.paymentMethod || expense.paymentMethod,
        reference: input.reference !== undefined ? input.reference : expense.reference,
        description: input.description !== undefined ? input.description : expense.description,
        isBillable: input.isBillable !== undefined ? !!input.isBillable : expense.isBillable,
        customerId: input.customerId !== undefined ? input.customerId : expense.customerId,
        receiptUrl: input.receiptUrl !== undefined ? input.receiptUrl : expense.receiptUrl
      })
      .where(eq(expenses.id, expenseId))
      .returning();

    // Insert clean replacement journal
    const journalLinesPayload: any[] = [];

    journalLinesPayload.push({
      accountId: expenseAccountId,
      debit: updatedNet,
      description: `Expense debit posting: ${expense.expenseNumber} (modified) - ${updatedExpense.description || 'Direct Expense'}`
    });

    if (updatedTax > 0) {
      journalLinesPayload.push({
        accountId: vatAccountId,
        debit: updatedTax,
        description: `VAT portion of expense ${expense.expenseNumber} (modified)`
      });
    }

    journalLinesPayload.push({
      accountId: creditAccountId,
      credit: updatedAmount,
      description: onAccount
        ? `AP posting liability for expense ${expense.expenseNumber} (modified)`
        : `Bank/Cash credit disbursement for expense ${expense.expenseNumber} (modified)`
    });

    const journalEntry = await createJournalEntry({
      orgId: expense.orgId,
      date: updatedExpense.date,
      description: `Bookkeeping entry for expense ${expense.expenseNumber} (modified)`,
      reference: expense.expenseNumber,
      source: 'manual',
      sourceId: updatedExpense.id,
      createdBy: userId,
      lines: journalLinesPayload
    }, tx);

    const [finalExpense] = await tx
      .update(expenses)
      .set({ journalEntryId: journalEntry.id })
      .where(eq(expenses.id, expenseId))
      .returning();

    return finalExpense;
  });
}

export async function deleteExpense(expenseId: string, userId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [expense] = await tx
      .select()
      .from(expenses)
      .where(eq(expenses.id, expenseId))
      .limit(1);

    if (!expense) throw new AppError('Expense not found.', 404);

    if (expense.journalEntryId) {
      await reverseJournalEntry(expense.journalEntryId, new Date(), userId);
    }

    await tx.delete(expenses).where(eq(expenses.id, expenseId));

    return {
      message: 'Expense successfully deleted and matching ledger journal rolled back.',
      deletedExpenseId: expenseId
    };
  });
}

/**
 * Handles optical character recognition OCR using Tesseract.js.
 */
export async function attachReceipt(expenseId: string, fileBuffer: Buffer | string): Promise<any> {
  try {
    const result = await Tesseract.recognize(fileBuffer, 'eng');
    const text = result?.data?.text || '';

    // Heuristics to pull items
    // 1. DATE Extraction
    let extractedDate: Date = new Date();
    const dateRegex = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
      const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
      extractedDate = new Date(`${year}-${dateMatch[2]}-${dateMatch[1]}`);
      if (isNaN(extractedDate.getTime())) extractedDate = new Date();
    }

    // 2. AMOUNT Extraction
    let extractedAmount = 0;
    // Look for lines containing total, sum, pay, amount, etc.
    const amtRegex = /(?:total|amount|pay|net|sum|₦|\$)\s*:?\s*(?:ngn|usd)?\s*([\d,]+\.?\d*)/i;
    const amountMatches = text.match(amtRegex);
    if (amountMatches && amountMatches[1]) {
      const cleaned = anonymousCleanNumber(amountMatches[1]);
      extractedAmount = Math.round(Number(cleaned) * 100); // convert into base currency units (Kobo)
    } else {
      // Find largest numeric block resembling a currency value
      const nums = text.match(/\b\d+[\.,]\d{2}\b/g);
      if (nums) {
        const floatVals = nums.map(n => Number(anonymousCleanNumber(n)));
        extractedAmount = Math.round(Math.max(...floatVals) * 100);
      }
    }

    // 3. VENDOR name extraction
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const extractedVendor = lines[0] || 'Unknown Receipt Vendor';

    // 4. DESCRIPTION extraction
    const extractedDescription = `OCR Receipt scan: ${lines.slice(1, 4).join(' ')}`.substring(0, 200);

    return {
      message: 'Receipt parsed successfully.',
      expenseId,
      receiptTextSnippet: text.substring(0, 500),
      rawOcrText: text,
      extractedData: {
        date: extractedDate.toISOString().split('T')[0],
        amount: extractedAmount, // Kobo
        vendorName: extractedVendor,
        description: extractedDescription
      }
    };
  } catch (err: any) {
    throw new AppError(`Receipt scanning error: ${err.message}`, 500);
  }
}

function anonymousCleanNumber(val: string): string {
  return val.replace(/,/g, '');
}
