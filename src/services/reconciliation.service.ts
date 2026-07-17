/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sql, eq, and, desc, asc, inArray, lte, gte, or, not } from 'drizzle-orm';
import {
  db,
  bankAccounts,
  bankTransactions,
  bankRules,
  journalLines,
  journalEntries,
  users,
  expenses,
  paymentsReceived,
  paymentsMade,
  contacts,
  bills,
  invoices,
  paymentMadeAllocations,
  paymentAllocations,
  reconciliationAdjustments
} from '../db/schema';
import { AppError } from '../lib/errors';
import { createJournalEntry, getAccountBalance } from './ledger.service';
import { postToGL } from './posting.service';

// ==============================
// FUZZY MATCHING HELPERS
// ==============================

function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length, bLen = b.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= aLen; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= bLen; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[aLen][bLen];
}

function descriptionSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const aLow = a.toLowerCase().trim();
  const bLow = b.toLowerCase().trim();
  if (aLow === bLow) return 1;
  if (aLow.includes(bLow) || bLow.includes(aLow)) return 0.9;
  const dist = levenshteinDistance(aLow, bLow);
  const maxLen = Math.max(aLow.length, bLow.length);
  if (maxLen === 0) return 0;
  return Math.max(0, 1 - dist / maxLen);
}

function computeConfidence(
  bankTxn: any,
  glLine: any,
  glEntry: any,
  amountDiff: number,
  dateDiffDays: number,
  maxAmountDiff: number = 1,
  maxDateDays: number = 90
): number {
  let score = 0;

  // Amount proximity (0-40 points)
  if (amountDiff <= 1) score += 40;
  else if (amountDiff <= 10) score += 35;
  else if (amountDiff <= 100) score += 25;
  else if (amountDiff <= 1000) score += 15;
  else score += Math.max(0, 40 * (1 - amountDiff / Math.max(1, bankTxn.amount)));

  // Date proximity (0-25 points)
  if (dateDiffDays <= 1) score += 25;
  else if (dateDiffDays <= 3) score += 20;
  else if (dateDiffDays <= 7) score += 15;
  else if (dateDiffDays <= 30) score += 8;
  else score += Math.max(0, 25 * (1 - dateDiffDays / maxDateDays));

  // Direction match (0-10 points)
  const directionOk =
    (bankTxn.type === 'debit' && glLine.creditAmount > 0) ||
    (bankTxn.type === 'credit' && glLine.debitAmount > 0);
  if (directionOk) score += 10;

  // Description similarity (0-25 points)
  const descMatch = descriptionSimilarity(bankTxn.description, glEntry.description || glEntry.reference || '');
  score += Math.round(descMatch * 25);

  return Math.min(100, score);
}

// ==============================
// 1. MATCH BANK TRANSACTION (MANUAL)
// ==============================
export async function matchBankTransaction(
  bankTransactionId: string,
  journalLineId: string,
  matchMethod: string = 'manual'
): Promise<any> {
  return await db.transaction(async (tx) => {
    const [bt] = await tx.select().from(bankTransactions).where(eq(bankTransactions.id, bankTransactionId)).limit(1);
    if (!bt) throw new AppError('Bank transaction not found.', 404);
    if (bt.status === 'reconciled') throw new AppError('This bank transaction is already reconciled.', 400);

    const [jl] = await tx.select().from(journalLines).where(eq(journalLines.id, journalLineId)).limit(1);
    if (!jl) throw new AppError('Target ledger journal line not found.', 404);

    const [je] = await tx.select().from(journalEntries).where(eq(journalEntries.id, jl.entryId)).limit(1);
    if (!je || je.orgId !== bt.orgId) throw new AppError('Target ledger line and bank transaction must belong to the same organisation.', 400);

    const [ba] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, bt.bankAccountId)).limit(1);
    if (!ba) throw new AppError('Associated bank account not found.', 404);
    if (ba.accountId !== jl.accountId) throw new AppError('The target journal line account does not map to the cash ledger account of this bank account.', 400);

    const isDrCrMatched = (bt.type === 'debit' && jl.creditAmount > 0) || (bt.type === 'credit' && jl.debitAmount > 0);
    if (!isDrCrMatched) throw new AppError('Debit/credit bookkeeping direction of the ledger line does not match the bank transaction flow.', 400);

    const jlValue = jl.debitAmount > 0 ? jl.debitAmount : jl.creditAmount;
    const amountDiff = Math.abs(bt.amount - jlValue);
    if (amountDiff > 1) throw new AppError(`Amounts do not match within acceptable 1 kobo tolerance.`, 400);

    await tx.update(bankTransactions).set({
      journalLineId: jl.id,
      status: 'reconciled',
      matchMethod,
      matchConfidence: '100',
      reconciledAt: new Date(),
    }).where(eq(bankTransactions.id, bt.id));

    return { success: true, message: 'Bank transaction successfully matched and reconciled.' };
  });
}

// ==============================
// 2. AUTO-MATCH WITH CONFIDENCE SCORING
// ==============================
export async function autoMatchTransactions(bankAccountId: string): Promise<{
  autoMatched: number;
  needsReview: number;
  unmatched: number;
  suggestions: number;
}> {
  const [ba] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, bankAccountId)).limit(1);
  if (!ba) throw new AppError('Bank account structure not found.', 404);

  const unreconciledTxns = await db.select().from(bankTransactions).where(
    and(eq(bankTransactions.bankAccountId, bankAccountId), eq(bankTransactions.status, 'unreconciled'))
  );
  if (unreconciledTxns.length === 0) return { autoMatched: 0, needsReview: 0, unmatched: 0, suggestions: 0 };

  const reconciledLineIds = (await db
    .select({ journalLineId: bankTransactions.journalLineId })
    .from(bankTransactions)
    .where(and(eq(bankTransactions.bankAccountId, bankAccountId), eq(bankTransactions.status, 'reconciled')))
  ).map(r => r.journalLineId).filter(Boolean) as string[];

  let autoMatched = 0, needsReview = 0, unmatched = 0, suggestions = 0;

  // Fetch all candidate GL lines for this bank account once
  const allCandidates = await db
    .select({ line: journalLines, entry: journalEntries })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(
      eq(journalLines.accountId, ba.accountId),
      eq(journalEntries.orgId, ba.orgId),
      sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
    ));

  for (const bt of unreconciledTxns) {
    const scored = allCandidates
      .filter(({ line }) => !reconciledLineIds.includes(line.id))
      .map(({ line, entry }) => {
        const directionMatches = (bt.type === 'debit' && line.creditAmount > 0) || (bt.type === 'credit' && line.debitAmount > 0);
        if (!directionMatches) return null;
        const lineAmt = line.debitAmount > 0 ? line.debitAmount : line.creditAmount;
        const amountDiff = Math.abs(bt.amount - lineAmt);
        const dateDiffDays = Math.abs(bt.date.getTime() - entry.date.getTime()) / (24 * 60 * 60 * 1000);
        const confidence = computeConfidence(bt, line, entry, amountDiff, dateDiffDays);
        return { line, entry, confidence, amountDiff, dateDiffDays };
      })
      .filter(Boolean)
      .sort((a, b) => b!.confidence - a!.confidence);

    if (scored.length === 0) { unmatched++; continue; }

    const best = scored[0]!;

    if (best.confidence >= 90 && best.amountDiff <= 1 && best.dateDiffDays <= 3) {
      // High-confidence auto-match
      await db.update(bankTransactions).set({
        journalLineId: best.line.id,
        status: 'reconciled',
        matchMethod: 'auto',
        matchConfidence: best.confidence.toString(),
        reconciledAt: new Date(),
      }).where(eq(bankTransactions.id, bt.id));
      reconciledLineIds.push(best.line.id);
      autoMatched++;
    } else if (best.confidence >= 50) {
      // Medium confidence - suggest but don't auto-match
      suggestions++;
    } else {
      unmatched++;
    }
  }

  return { autoMatched, needsReview, unmatched, suggestions };
}

// ==============================
// 3. SUGGEST MATCHES (ML-STYLE)
// ==============================
export async function suggestMatches(bankTransactionId: string): Promise<any[]> {
  const [bt] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, bankTransactionId)).limit(1);
  if (!bt) throw new AppError('Bank transaction not found.', 404);

  const [ba] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, bt.bankAccountId)).limit(1);
  if (!ba) throw new AppError('Bank account not found.', 404);

  // Get already-reconciled line IDs to exclude
  const reconciledLineIds = (await db
    .select({ journalLineId: bankTransactions.journalLineId })
    .from(bankTransactions)
    .where(and(eq(bankTransactions.bankAccountId, bt.bankAccountId), eq(bankTransactions.status, 'reconciled')))
  ).map(r => r.journalLineId).filter(Boolean) as string[];

  const candidates = await db
    .select({ line: journalLines, entry: journalEntries })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(
      eq(journalLines.accountId, ba.accountId),
      eq(journalEntries.orgId, ba.orgId),
      sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
    ));

  const scored = candidates
    .filter(({ line }) => !reconciledLineIds.includes(line.id))
    .map(({ line, entry }) => {
      const directionMatches = (bt.type === 'debit' && line.creditAmount > 0) || (bt.type === 'credit' && line.debitAmount > 0);
      if (!directionMatches) return null;
      const lineAmt = line.debitAmount > 0 ? line.debitAmount : line.creditAmount;
      const amountDiff = Math.abs(bt.amount - lineAmt);
      const dateDiffDays = Math.abs(bt.date.getTime() - entry.date.getTime()) / (24 * 60 * 60 * 1000);
      const confidence = computeConfidence(bt, line, entry, amountDiff, dateDiffDays);
      const descMatchPct = descriptionSimilarity(bt.description, entry.description || entry.reference || '');
      return {
        journalLineId: line.id,
        journalEntryId: entry.id,
        entryNumber: entry.entryNumber,
        entryDate: entry.date,
        entryDescription: entry.description,
        reference: entry.reference,
        lineAmount: lineAmt,
        lineDebit: line.debitAmount,
        lineCredit: line.creditAmount,
        confidence: Math.round(confidence),
        amountDiff,
        dateDiffDays: Math.round(dateDiffDays * 10) / 10,
        descriptionMatch: Math.round(descMatchPct * 100),
        directionMatch: true,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.confidence - a!.confidence);

  return scored.slice(0, 10);
}

// ==============================
// 4. PARTIAL MATCH
// ==============================
export async function partialMatchBankTransaction(
  bankTransactionId: string,
  journalLineId: string,
  allocatedAmount: number
): Promise<any> {
  return await db.transaction(async (tx) => {
    const [bt] = await tx.select().from(bankTransactions).where(eq(bankTransactions.id, bankTransactionId)).limit(1);
    if (!bt) throw new AppError('Bank transaction not found.', 404);
    if (bt.status === 'reconciled') throw new AppError('Already reconciled.', 400);

    const [jl] = await tx.select().from(journalLines).where(eq(journalLines.id, journalLineId)).limit(1);
    if (!jl) throw new AppError('Journal line not found.', 404);

    const [je] = await tx.select().from(journalEntries).where(eq(journalEntries.id, jl.entryId)).limit(1);
    if (!je || je.orgId !== bt.orgId) throw new AppError('Org mismatch.', 400);

    const [ba] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, bt.bankAccountId)).limit(1);
    if (!ba) throw new AppError('Bank account not found.', 404);
    if (ba.accountId !== jl.accountId) throw new AppError('Account mismatch.', 400);

    const jlValue = jl.debitAmount > 0 ? jl.debitAmount : jl.creditAmount;
    if (allocatedAmount > jlValue) throw new AppError('Allocated amount exceeds journal line value.', 400);
    if (allocatedAmount <= 0) throw new AppError('Allocated amount must be positive.', 400);

    // Determine remaining unallocated amount on this bank transaction
    const existingPartialMatch = await tx.select().from(bankTransactions)
      .where(and(
        eq(bankTransactions.relatedJournalEntryId, bt.id),
        eq(bankTransactions.status, 'reconciled')
      ));
    const alreadyAllocated = existingPartialMatch.reduce((s: number, t: any) => s + t.amount, 0);
    const remaining = bt.amount - alreadyAllocated;

    if ((remaining - allocatedAmount) < 0) throw new AppError('Total allocations exceed bank transaction amount.', 400);

    // Create a split record - we link this bank txn to the journal line
    if (remaining - allocatedAmount <= 1) {
      // Fully allocated
      await tx.update(bankTransactions).set({
        journalLineId: jl.id,
        status: 'reconciled',
        matchMethod: 'partial',
        matchConfidence: '85',
        reconciledAt: new Date(),
      }).where(eq(bankTransactions.id, bt.id));
    } else {
      // Partially allocated — mark with partial method
      await tx.update(bankTransactions).set({
        journalLineId: jl.id,
        status: 'reconciled',
        matchMethod: 'partial',
        matchConfidence: '85',
        reconciledAt: new Date(),
      }).where(eq(bankTransactions.id, bt.id));
    }

    return { success: true, remainingAllocated: remaining - allocatedAmount <= 1 };
  });
}

// ==============================
// 5. BATCH RECONCILE
// ==============================
export async function batchReconcile(
  orgId: string,
  matches: { bankTransactionId: string; journalLineId: string }[]
): Promise<{ matched: number; errors: { bankTransactionId: string; error: string }[] }> {
  let matched = 0;
  const errors: { bankTransactionId: string; error: string }[] = [];

  for (const m of matches) {
    try {
      await matchBankTransaction(m.bankTransactionId, m.journalLineId, 'batch');
      matched++;
    } catch (err: any) {
      errors.push({ bankTransactionId: m.bankTransactionId, error: err.message || 'Unknown error' });
    }
  }

  return { matched, errors };
}

// ==============================
// 6. GENERATE ADJUSTMENT JOURNAL
// ==============================
export async function generateAdjustmentJournal(
  orgId: string,
  userId: string,
  bankAccountId: string,
  data: {
    adjustmentType: 'bank_charge' | 'interest_income' | 'correction' | 'difference';
    amount: number;
    description: string;
    reference?: string;
    date: string;
    contraAccountId?: string;
  }
): Promise<any> {
  const [ba] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.orgId, orgId))).limit(1);
  if (!ba) throw new AppError('Bank account not found.', 404);

  // Resolve appropriate contra accounts
  const getAcct = async (role: string) => {
    const [a] = await db.select().from(journalLines);
    return a; // placeholder - will use provided contraAccountId or defaults
  };

  let lines: any[];

  if (data.adjustmentType === 'bank_charge') {
    // DR Bank Charges Expense, CR Bank GL
    lines = [
      { accountId: data.contraAccountId!, debit: data.amount, description: data.description || 'Bank charges' },
      { accountId: ba.accountId, credit: data.amount, description: 'Bank charges' },
    ];
  } else if (data.adjustmentType === 'interest_income') {
    // DR Bank GL, CR Interest Income
    lines = [
      { accountId: ba.accountId, debit: data.amount, description: data.description || 'Interest income' },
      { accountId: data.contraAccountId!, credit: data.amount, description: 'Interest income' },
    ];
  } else if (data.adjustmentType === 'correction') {
    // Balancing entry
    const isCredit = data.amount < 0;
    const absAmount = Math.abs(data.amount);
    lines = isCredit
      ? [{ accountId: ba.accountId, debit: absAmount, description: data.description }, { accountId: data.contraAccountId!, credit: absAmount, description: data.description }]
      : [{ accountId: data.contraAccountId!, debit: absAmount, description: data.description }, { accountId: ba.accountId, credit: absAmount, description: data.description }];
  } else {
    // difference — DR/CR to suspense/clearing
    lines = [
      { accountId: data.contraAccountId || ba.accountId, debit: data.amount > 0 ? data.amount : 0, description: data.description },
      { accountId: ba.accountId, credit: data.amount > 0 ? data.amount : 0, description: data.description },
    ];
  }

  const je = await postToGL({
    orgId,
    date: new Date(data.date),
    description: data.description || `Reconciliation adjustment — ${data.adjustmentType}`,
    reference: data.reference || `ADJ-${data.adjustmentType}-${Date.now().toString(36)}`,
    source: 'journal_entry' as any,
    createdBy: userId,
    lines,
  });

  // Find the bank GL line to auto-reconcile
  const bankLine = je.lines?.find((l: any) =>
    data.adjustmentType === 'bank_charge'
      ? (l.accountId === ba.accountId && l.creditAmount === data.amount)
      : (l.accountId === ba.accountId && l.debitAmount === data.amount)
  );

  // Record the adjustment
  const [adj] = await db.insert(reconciliationAdjustments).values({
    orgId,
    bankAccountId,
    adjustmentType: data.adjustmentType,
    amount: data.amount,
    description: data.description,
    reference: data.reference || null,
    journalEntryId: je.id,
    createdBy: userId,
  }).returning();

  return { adjustment: adj, journalEntry: je, bankLineId: bankLine?.id };
}

// ==============================
// 7. FIND PERFECT MATCH FROM GL (for frontend)
// ==============================
export async function findPerfectMatchFromGL(bankTransactionId: string): Promise<any | null> {
  const [bt] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, bankTransactionId)).limit(1);
  if (!bt) return null;

  const [ba] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, bt.bankAccountId)).limit(1);
  if (!ba) return null;

  const candidates = await db
    .select({ line: journalLines, entry: journalEntries })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(
      eq(journalLines.accountId, ba.accountId),
      eq(journalEntries.orgId, ba.orgId),
      sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
    ));

  const reconciledLineIds = (await db
    .select({ journalLineId: bankTransactions.journalLineId })
    .from(bankTransactions)
    .where(and(eq(bankTransactions.bankAccountId, bt.bankAccountId), eq(bankTransactions.status, 'reconciled')))
  ).map(r => r.journalLineId).filter(Boolean) as string[];

  const scored = candidates
    .filter(({ line }) => !reconciledLineIds.includes(line.id))
    .map(({ line, entry }) => {
      const directionMatches = (bt.type === 'debit' && line.creditAmount > 0) || (bt.type === 'credit' && line.debitAmount > 0);
      if (!directionMatches) return null;
      const lineAmt = line.debitAmount > 0 ? line.debitAmount : line.creditAmount;
      const amountDiff = Math.abs(bt.amount - lineAmt);
      const dateDiffDays = Math.abs(bt.date.getTime() - entry.date.getTime()) / (24 * 60 * 60 * 1000);
      const confidence = computeConfidence(bt, line, entry, amountDiff, dateDiffDays);
      return { line, entry, confidence, amountDiff, dateDiffDays };
    })
    .filter(Boolean)
    .sort((a, b) => b!.confidence - a!.confidence);

  if (scored.length === 0) return null;

  const best = scored[0]!;
  return {
    journalLineId: best.line.id,
    journalEntryId: best.entry.id,
    entryNumber: best.entry.entryNumber,
    entryDate: best.entry.date,
    entryDescription: best.entry.description,
    lineAmount: best.line.debitAmount > 0 ? best.line.debitAmount : best.line.creditAmount,
    debit: best.line.debitAmount,
    credit: best.line.creditAmount,
    confidence: Math.round(best.confidence),
    amountDiff: best.amountDiff,
    dateDiffDays: Math.round(best.dateDiffDays * 10) / 10,
  };
}

// ==============================
// 8. ENHANCED RECONCILIATION STATEMENT
// ==============================
export async function getBankReconciliationStatement(
  bankAccountId: string,
  orgId: string,
  asOfDate: Date
): Promise<any> {
  const [ba] = await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.orgId, orgId)))
    .limit(1);

  if (!ba) throw new AppError('Bank account not found.', 404);

  const allTxns = await db
    .select()
    .from(bankTransactions)
    .where(and(
      eq(bankTransactions.bankAccountId, bankAccountId),
      lte(bankTransactions.date, asOfDate)
    ))
    .orderBy(desc(bankTransactions.date));

  const reconciledItems = allTxns.filter(t => t.status === 'reconciled');
  const unreconciledItems = allTxns.filter(t => t.status === 'unreconciled');
  const excludedItems = allTxns.filter(t => t.status === 'excluded');

  // Aging buckets for unreconciled items
  const now = new Date();
  const agingBuckets = (items: typeof unreconciledItems) => {
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    for (const t of items) {
      const daysOld = Math.floor((now.getTime() - t.date.getTime()) / (24 * 60 * 60 * 1000));
      if (daysOld <= 30) buckets['0-30'] += t.amount;
      else if (daysOld <= 60) buckets['31-60'] += t.amount;
      else if (daysOld <= 90) buckets['61-90'] += t.amount;
      else buckets['90+'] += t.amount;
    }
    return buckets;
  };

  const outstandingDeposits = unreconciledItems.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const outstandingPayments = unreconciledItems.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

  const glBalance = await getAccountBalance(ba.accountId, asOfDate);
  const statementClosingBalance = ba.currentBalance;
  const adjustedBankBalance = statementClosingBalance + outstandingDeposits - outstandingPayments;
  const isReconciled = adjustedBankBalance === glBalance;
  const difference = glBalance - adjustedBankBalance;

  // Match method breakdown
  const matchMethods = reconciledItems.reduce((acc: Record<string, number>, t) => {
    const method = t.matchMethod || 'unknown';
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {});

  return {
    bankAccount: { name: ba.name, accountNumber: ba.accountNumber, bankName: ba.bankName },
    statementClosingBalance,
    glBalance,
    reconciledItems,
    unreconciledItems,
    excludedItems,
    outstandingDeposits,
    outstandingPayments,
    adjustedBankBalance,
    isReconciled,
    difference,
    asOfDate,
    aging: {
      outstandingDeposits: agingBuckets(unreconciledItems.filter(t => t.type === 'credit')),
      outstandingPayments: agingBuckets(unreconciledItems.filter(t => t.type === 'debit')),
    },
    matchMethodBreakdown: matchMethods,
    totals: {
      totalTransactions: allTxns.length,
      totalReconciled: reconciledItems.length,
      totalUnreconciled: unreconciledItems.length,
      totalExcluded: excludedItems.length,
    },
  };
}

// Apply Bank Rules (unchanged — keep backward compatibility)
export async function applyBankRule(bankTransactionId: string): Promise<boolean> {
  const [bt] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, bankTransactionId)).limit(1);
  if (!bt) throw new AppError('Bank transaction record not found.', 404);
  if (bt.status === 'reconciled') return false;

  const rulesList = await db.select().from(bankRules)
    .where(and(eq(bankRules.orgId, bt.orgId), eq(bankRules.isActive, true)))
    .orderBy(desc(bankRules.priority));

  for (const rule of rulesList) {
    if (evaluateRuleConditions(rule.conditions, bt)) {
      const actionsObj = rule.actions as any;
      if (actionsObj && actionsObj.type) {
        await createTransactionFromBankFeed(bt.id, {
          type: actionsObj.type,
          accountId: actionsObj.accountId,
          contactId: actionsObj.contactId,
          description: actionsObj.description || `Auto-Rule [${rule.name}] Match applied`
        });
        return true;
      }
    }
  }
  return false;
}

function evaluateRuleConditions(conditions: any, txn: any): boolean {
  if (!conditions) return false;
  const matchType = conditions.matchType || 'all';
  const clauses = conditions.clauses || [];
  if (clauses.length === 0) return false;

  const results = clauses.map((clause: any) => {
    const { field, operator, value, minAmount, maxAmount } = clause;
    let targetText = '';

    if (field === 'description') targetText = txn.description || '';
    else if (field === 'reference') targetText = txn.reference || '';
    else if (field === 'amount') {
      const amtKobo = txn.amount;
      if (operator === 'amountBetween') return amtKobo >= Number(minAmount) && amtKobo <= Number(maxAmount);
      if (operator === 'equals') return amtKobo === Number(value);
      return false;
    } else return false;

    if (operator === 'equals') return targetText.toLowerCase() === String(value).toLowerCase();
    if (operator === 'contains') return targetText.toLowerCase().includes(String(value).toLowerCase());
    if (operator === 'startsWith') return targetText.toLowerCase().startsWith(String(value).toLowerCase());
    return false;
  });

  return matchType === 'any' ? results.some((r: boolean) => r === true) : results.every((r: boolean) => r === true);
}

// Create Transaction From Bank Feed (unchanged — keep full backward compatibility)
export async function createTransactionFromBankFeed(
  bankTransactionId: string,
  input: {
    type: 'expense' | 'payment_received' | 'payment_made' | 'transfer';
    accountId: string;
    contactId?: string;
    description: string;
    allocations?: { id: string; amount: number }[];
  },
  userId?: string
): Promise<any> {
  return await db.transaction(async (tx) => {
    const [bt] = await tx.select().from(bankTransactions).where(eq(bankTransactions.id, bankTransactionId)).limit(1);
    if (!bt) throw new AppError('Bank transaction record not found.', 404);
    if (bt.status === 'reconciled') throw new AppError('This bank feed item is already reconciled.', 400);

    const [ba] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, bt.bankAccountId)).limit(1);
    if (!ba) throw new AppError('Associated bank account model missing.', 404);

    let runByUserId = userId;
    if (!runByUserId) {
      const [u] = await tx.select({ id: users.id }).from(users).where(and(eq(users.organisationId, bt.orgId), eq(users.isActive, true))).limit(1);
      if (!u) throw new AppError('An active user in your organization is required to authorize bookkeeping postings.', 400);
      runByUserId = u.id;
    }

    let journalParams: any;

    if (input.type === 'expense') {
      const [countResult] = await tx.select({ count: sql<number>`count(*)` }).from(expenses).where(eq(expenses.orgId, bt.orgId));
      const count = Number(countResult?.count || 0) + 1;
      const expenseNumber = `EXP-${String(count).padStart(6, '0')}`;

      const [newExp] = await tx.insert(expenses).values({
        orgId: bt.orgId, expenseNumber, vendorId: input.contactId || null, date: bt.date,
        accountId: input.accountId, amount: bt.amount, taxAmount: 0, currency: 'NGN',
        paymentMethod: 'bank_transfer', reference: bt.reference || null, description: input.description, createdBy: runByUserId!
      }).returning();

      journalParams = {
        orgId: bt.orgId, date: bt.date, description: input.description || `Expense transaction booking - Feed match`,
        reference: bt.reference || undefined, source: 'bank_feed' as const, sourceId: newExp.id, createdBy: runByUserId!,
        lines: [
          { accountId: input.accountId, debit: bt.amount, description: input.description },
          { accountId: ba.accountId, credit: bt.amount, description: input.description }
        ]
      };

      const entry = await createJournalEntry(journalParams, tx);
      await tx.update(expenses).set({ journalEntryId: entry.id }).where(eq(expenses.id, newExp.id));
      const reconciledLine = entry.lines.find((l: any) => l.accountId === ba.accountId && l.creditAmount === bt.amount);
      if (!reconciledLine) throw new AppError('Accounting engine mismatch: unable to capture cash credit reconciliation target.', 500);

      await tx.update(bankTransactions).set({ journalLineId: reconciledLine.id, status: 'reconciled', matchMethod: 'rule', reconciledAt: new Date() }).where(eq(bankTransactions.id, bt.id));
      return { success: true, expenseId: newExp.id, entryId: entry.id };

    } else if (input.type === 'payment_received') {
      const [countResult] = await tx.select({ count: sql<number>`count(*)` }).from(paymentsReceived).where(eq(paymentsReceived.orgId, bt.orgId));
      const count = Number(countResult?.count || 0) + 1;
      const paymentNumber = `PAY-REC-${String(count).padStart(6, '0')}`;
      if (!input.contactId) throw new AppError('Contact ID is strictly required to post Customer payments received.', 400);

      const [newPayRec] = await tx.insert(paymentsReceived).values({
        orgId: bt.orgId, paymentNumber, customerId: input.contactId, date: bt.date, amount: bt.amount, currency: 'NGN',
        paymentMethod: 'bank_transfer', reference: bt.reference || null, accountId: ba.accountId, notes: input.description, createdBy: runByUserId!
      }).returning();

      journalParams = {
        orgId: bt.orgId, date: bt.date, description: input.description || `Payment Received - Bank Feed match`,
        reference: bt.reference || undefined, source: 'bank_feed' as const, sourceId: newPayRec.id, createdBy: runByUserId!,
        lines: [
          { accountId: ba.accountId, debit: bt.amount, description: input.description },
          { accountId: input.accountId, credit: bt.amount, description: input.description }
        ]
      };

      const entry = await createJournalEntry(journalParams, tx);
      await tx.update(paymentsReceived).set({ journalEntryId: entry.id }).where(eq(paymentsReceived.id, newPayRec.id));

      if (input.allocations && input.allocations.length > 0) {
        for (const alloc of input.allocations) {
          const [inv] = await tx.select().from(invoices).where(eq(invoices.id, alloc.id)).limit(1);
          if (!inv) throw new AppError(`Invoice ${alloc.id} not found.`, 404);
          const nextAmountPaid = inv.amountPaid + alloc.amount;
          const nextBalanceDue = inv.total - nextAmountPaid;
          const nextStatus = nextBalanceDue <= 0 ? 'paid' : 'partial';
          await tx.update(invoices).set({ amountPaid: nextAmountPaid, balanceDue: nextBalanceDue, status: nextStatus }).where(eq(invoices.id, inv.id));
          await tx.insert(paymentAllocations).values({ paymentId: newPayRec.id, invoiceId: inv.id, amount: alloc.amount });
        }
      }

      const reconciledLine = entry.lines.find((l: any) => l.accountId === ba.accountId && l.debitAmount === bt.amount);
      if (!reconciledLine) throw new AppError('Accounting engine mismatch: unable to capture cash debit reconciliation target.', 500);

      await tx.update(bankTransactions).set({ journalLineId: reconciledLine.id, status: 'reconciled', matchMethod: 'rule', reconciledAt: new Date() }).where(eq(bankTransactions.id, bt.id));
      return { success: true, paymentId: newPayRec.id, entryId: entry.id };

    } else if (input.type === 'payment_made') {
      const [countResult] = await tx.select({ count: sql<number>`count(*)` }).from(paymentsMade).where(eq(paymentsMade.orgId, bt.orgId));
      const count = Number(countResult?.count || 0) + 1;
      const paymentNumber = `PAY-MADE-${String(count).padStart(6, '0')}`;
      let paymentMadeId: string | null = null;

      if (input.contactId) {
        const [newPayMade] = await tx.insert(paymentsMade).values({
          orgId: bt.orgId, paymentNumber, vendorId: input.contactId, date: bt.date, amount: bt.amount, currency: 'NGN',
          paymentMethod: 'bank_transfer', reference: bt.reference || null, accountId: ba.accountId, notes: input.description, createdBy: runByUserId!
        }).returning();
        paymentMadeId = newPayMade.id;
      }

      journalParams = {
        orgId: bt.orgId, date: bt.date, description: input.description || `Payment Made - Bank Feed match`,
        reference: bt.reference || undefined, source: 'bank_feed' as const, sourceId: paymentMadeId || bt.id, createdBy: runByUserId!,
        lines: [
          { accountId: input.accountId, debit: bt.amount, description: input.description },
          { accountId: ba.accountId, credit: bt.amount, description: input.description }
        ]
      };

      const entry = await createJournalEntry(journalParams, tx);
      if (paymentMadeId) await tx.update(paymentsMade).set({ journalEntryId: entry.id }).where(eq(paymentsMade.id, paymentMadeId));

      if (input.allocations && input.allocations.length > 0) {
        for (const alloc of input.allocations) {
          const [bl] = await tx.select().from(bills).where(eq(bills.id, alloc.id)).limit(1);
          if (!bl) throw new AppError(`Bill ${alloc.id} not found.`, 404);
          const nextAmountPaid = bl.amountPaid + alloc.amount;
          const nextBalanceDue = bl.total - nextAmountPaid;
          const nextStatus = nextBalanceDue <= 0 ? 'paid' : 'partial';
          await tx.update(bills).set({ amountPaid: nextAmountPaid, balanceDue: nextBalanceDue, status: nextStatus }).where(eq(bills.id, bl.id));
          if (paymentMadeId) await tx.insert(paymentMadeAllocations).values({ paymentId: paymentMadeId, billId: bl.id, amount: alloc.amount });
        }
      }

      const reconciledLine = entry.lines.find((l: any) => l.accountId === ba.accountId && l.creditAmount === bt.amount);
      if (!reconciledLine) throw new AppError('Accounting engine mismatch: unable to capture cash credit reconciliation target.', 500);

      await tx.update(bankTransactions).set({ journalLineId: reconciledLine.id, status: 'reconciled', matchMethod: 'rule', reconciledAt: new Date() }).where(eq(bankTransactions.id, bt.id));
      return { success: true, paymentId: paymentMadeId, entryId: entry.id };

    } else if (input.type === 'transfer') {
      const [targetBa] = await tx.select().from(bankAccounts).where(eq(bankAccounts.accountId, input.accountId)).limit(1);
      if (!targetBa) throw new AppError('Target destination transfer bank account not found by its General Ledger account.', 404);

      const isBankFeedOutbound = bt.type === 'debit';
      const drAccountId = isBankFeedOutbound ? input.accountId : ba.accountId;
      const crAccountId = isBankFeedOutbound ? ba.accountId : input.accountId;

      journalParams = {
        orgId: bt.orgId, date: bt.date, description: input.description || `Contra Transfer Inter-account`,
        reference: bt.reference || undefined, source: 'bank_feed' as const, sourceId: bt.id, createdBy: runByUserId!,
        lines: [
          { accountId: drAccountId, debit: bt.amount, description: input.description },
          { accountId: crAccountId, credit: bt.amount, description: input.description }
        ]
      };

      const entry = await createJournalEntry(journalParams, tx);
      const reconciledLine = entry.lines.find((l: any) => l.accountId === ba.accountId && (isBankFeedOutbound ? l.creditAmount === bt.amount : l.debitAmount === bt.amount));
      if (!reconciledLine) throw new AppError('Accounting engine mismatch: unable to capture corresponding contra transfer line.', 500);

      await tx.update(bankTransactions).set({ journalLineId: reconciledLine.id, status: 'reconciled', matchMethod: 'rule', reconciledAt: new Date() }).where(eq(bankTransactions.id, bt.id));
      return { success: true, entryId: entry.id };
    } else {
      throw new AppError(`Unsupported transaction matching type: ${input.type}`, 400);
    }
  });
}
