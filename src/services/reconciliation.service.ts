/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sql, eq, and, desc, inArray, lte } from 'drizzle-orm';
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
  contacts
} from '../db/schema';
import { AppError } from '../lib/errors';
import { createJournalEntry, getAccountBalance } from './ledger.service';

/**
 * 1. MATCH BANK TRANSACTION (MANUAL RECONCILIATION)
 */
export async function matchBankTransaction(
  bankTransactionId: string,
  journalLineId: string
): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Fetch bank transaction
    const [bt] = await tx
      .select()
      .from(bankTransactions)
      .where(eq(bankTransactions.id, bankTransactionId))
      .limit(1);

    if (!bt) {
      throw new AppError('Bank transaction not found.', 404);
    }
    if (bt.status === 'reconciled') {
      throw new AppError('This bank transaction is already reconciled.', 400);
    }

    // 2. Fetch target journal line
    const [jl] = await tx
      .select()
      .from(journalLines)
      .where(eq(journalLines.id, journalLineId))
      .limit(1);

    if (!jl) {
      throw new AppError('Target ledger journal line not found.', 404);
    }

    // Fetch parent journal entry to verify org
    const [je] = await tx
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, jl.entryId))
      .limit(1);

    if (!je || je.orgId !== bt.orgId) {
      throw new AppError('Target ledger line and bank transaction must belong to the same organisation.', 400);
    }

    // 3. Fetch bank account to verify cash ledger account routing matches
    const [ba] = await tx
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, bt.bankAccountId))
      .limit(1);

    if (!ba) {
      throw new AppError('Associated bank account not found.', 404);
    }

    if (ba.accountId !== jl.accountId) {
      throw new AppError('The target journal line account does not map to the cash ledger account of this bank account.', 400);
    }

    // 4. Validate opposing bookkeeping directions
    // Bank Debit (Money Out) maps to Ledger Credit
    // Bank Credit (Money In) maps to Ledger Debit
    const isDrCrMatched =
      (bt.type === 'debit' && jl.creditAmount > 0) ||
      (bt.type === 'credit' && jl.debitAmount > 0);

    if (!isDrCrMatched) {
      throw new AppError('Debit/credit bookkeeping direction of the ledger line does not match the bank transaction flow.', 400);
    }

    // 5. Compare amount values (with 1 kobo tolerance)
    const jlValue = jl.debitAmount > 0 ? jl.debitAmount : jl.creditAmount;
    const amountDiff = Math.abs(bt.amount - jlValue);
    if (amountDiff > 1) {
      throw new AppError(`Amounts do not match within acceptable 1 kobo tolerance. Bank has ${bt.amount} kobo, Ledger has ${jlValue} kobo.`, 400);
    }

    // 6. Complete connection link
    await tx
      .update(bankTransactions)
      .set({
        journalLineId: jl.id,
        status: 'reconciled'
      })
      .where(eq(bankTransactions.id, bt.id));

    return { success: true, message: 'Bank transaction successfully matched and reconciled.' };
  });
}

/**
 * 2. AUTO-MATCH TRANSACTION BOT
 */
export async function autoMatchTransactions(bankAccountId: string): Promise<{
  autoMatched: number;
  needsReview: number;
  unmatched: number;
}> {
  // Fetch bank account cash ledger config
  const [ba] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankAccountId))
    .limit(1);

  if (!ba) {
    throw new AppError('Bank account structure not found.', 404);
  }

  // Fetch all unreconciled bank transactions for this account
  const unreconciledTxns = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.status, 'unreconciled')
      )
    );

  if (unreconciledTxns.length === 0) {
    return { autoMatched: 0, needsReview: 0, unmatched: 0 };
  }

  // Find all journal lines already reconciled under this bank account to skip duplicate allocations
  const reconciledLinesResult = await db
    .select({ journalLineId: bankTransactions.journalLineId })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.status, 'reconciled')
      )
    );

  const matchedLineIds = reconciledLinesResult
    .map((r) => r.journalLineId)
    .filter(Boolean) as string[];

  let autoMatched = 0;
  let needsReview = 0;
  let unmatched = 0;

  for (const bt of unreconciledTxns) {
    // 1. Fetch potential matching journal lines mapped to this bank cash account code,
    // where amounts match within ±1 kobo tolerance
    const matchesCandidates = await db
      .select({
        line: journalLines,
        entry: journalEntries
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.accountId, ba.accountId),
          eq(journalEntries.orgId, ba.orgId)
        )
      );

    // Apply strict filters: date ± 3 days, direction check (Dr/Cr mismatch), amount check (±1 kobo), avoid already matched lines
    const validMatches = matchesCandidates.filter(({ line, entry }) => {
      if (matchedLineIds.includes(line.id)) return false;

      // Bookkeeping direction verification
      const directionMatches =
        (bt.type === 'debit' && line.creditAmount > 0) ||
        (bt.type === 'credit' && line.debitAmount > 0);
      if (!directionMatches) return false;

      // Amount verification (±1 kobo)
      const lineAmt = line.debitAmount > 0 ? line.debitAmount : line.creditAmount;
      if (Math.abs(bt.amount - lineAmt) > 1) return false;

      // Date verification (±3 days)
      const btMs = bt.date.getTime();
      const jeMs = entry.date.getTime();
      const dateDiffMs = Math.abs(btMs - jeMs);
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      return dateDiffMs <= threeDaysMs;
    });

    if (validMatches.length === 1) {
      // Perfect single mapping match automatically linked
      const winningMatch = validMatches[0];
      await db
        .update(bankTransactions)
        .set({
          journalLineId: winningMatch.line.id,
          status: 'reconciled'
        })
        .where(eq(bankTransactions.id, bt.id));

      matchedLineIds.push(winningMatch.line.id);
      autoMatched++;
    } else if (validMatches.length > 1) {
      // Ambiguous multiple ledger candidates, register for user review
      needsReview++;
    } else {
      // Unmapped transaction balance
      unmatched++;
    }
  }

  return { autoMatched, needsReview, unmatched };
}

/**
 * 3. APPLY BANK RULES ENGINE
 */
export async function applyBankRule(bankTransactionId: string): Promise<boolean> {
  const [bt] = await db
    .select()
    .from(bankTransactions)
    .where(eq(bankTransactions.id, bankTransactionId))
    .limit(1);

  if (!bt) {
    throw new AppError('Bank transaction record not found.', 404);
  }
  if (bt.status === 'reconciled') {
    return false; // Skip if already reconciled
  }

  // Load rules ordered by ascending/descending priority
  const rulesList = await db
    .select()
    .from(bankRules)
    .where(and(eq(bankRules.orgId, bt.orgId), eq(bankRules.isActive, true)))
    .orderBy(desc(bankRules.priority));

  for (const rule of rulesList) {
    if (evaluateRuleConditions(rule.conditions, bt)) {
      // Apply matched action parameters
      const actionsObj = rule.actions as any;
      if (actionsObj && actionsObj.type) {
        await createTransactionFromBankFeed(bt.id, {
          type: actionsObj.type, // 'expense' | 'payment_received' | 'payment_made' | 'transfer'
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

// Deep checker helper to validate JSON logic clauses
function evaluateRuleConditions(conditions: any, txn: any): boolean {
  if (!conditions) return false;
  const matchType = conditions.matchType || 'all'; // all | any
  const clauses = conditions.clauses || [];
  if (clauses.length === 0) return false;

  const results = clauses.map((clause: any) => {
    const { field, operator, value, minAmount, maxAmount } = clause;
    let targetText = '';

    if (field === 'description') {
      targetText = txn.description || '';
    } else if (field === 'reference') {
      targetText = txn.reference || '';
    } else if (field === 'amount') {
      const amtKobo = txn.amount;
      if (operator === 'amountBetween') {
        return amtKobo >= Number(minAmount) && amtKobo <= Number(maxAmount);
      }
      if (operator === 'equals') {
        return amtKobo === Number(value);
      }
      return false;
    } else {
      return false;
    }

    if (operator === 'equals') {
      return targetText.toLowerCase() === String(value).toLowerCase();
    }
    if (operator === 'contains') {
      return targetText.toLowerCase().includes(String(value).toLowerCase());
    }
    if (operator === 'startsWith') {
      return targetText.toLowerCase().startsWith(String(value).toLowerCase());
    }
    return false;
  });

  if (matchType === 'any') {
    return results.some((r: boolean) => r === true);
  }
  return results.every((r: boolean) => r === true);
}

/**
 * 4. CREATE TRANSACTION ROOT RECORD FROM BANK FEED WITH AUTOMATIC BOOKKEEPING
 */
export async function createTransactionFromBankFeed(
  bankTransactionId: string,
  input: {
    type: 'expense' | 'payment_received' | 'payment_made' | 'transfer';
    accountId: string; // Opposing balancing category/contra ledger account ID
    contactId?: string;
    description: string;
  },
  userId?: string
): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Load context bank transaction
    const [bt] = await tx
      .select()
      .from(bankTransactions)
      .where(eq(bankTransactions.id, bankTransactionId))
      .limit(1);

    if (!bt) {
      throw new AppError('Bank transaction record not found.', 404);
    }
    if (bt.status === 'reconciled') {
      throw new AppError('This bank feed item is already reconciled.', 400);
    }

    // 2. Fetch associated bank account structure
    const [ba] = await tx
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, bt.bankAccountId))
      .limit(1);

    if (!ba) {
      throw new AppError('Associated bank account model missing.', 404);
    }

    // 3. Resolve actor ID to guarantee schema audit conformance
    let runByUserId = userId;
    if (!runByUserId) {
      const [u] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.organisationId, bt.orgId), eq(users.isActive, true)))
        .limit(1);
      
      if (!u) {
        throw new AppError('An active user in your organization is required to authorize bookkeeping postings.', 400);
      }
      runByUserId = u.id;
    }

    let journalParams: any;

    if (input.type === 'expense') {
      // Retrieve sequential code
      const [countResult] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(expenses)
        .where(eq(expenses.orgId, bt.orgId));
      
      const count = Number(countResult?.count || 0) + 1;
      const expenseNumber = `EXP-${String(count).padStart(6, '0')}`;

      // Insert record
      const [newExp] = await tx
        .insert(expenses)
        .values({
          orgId: bt.orgId,
          expenseNumber,
          vendorId: input.contactId || null,
          date: bt.date,
          accountId: input.accountId,
          amount: bt.amount,
          taxAmount: 0,
          currency: 'NGN',
          paymentMethod: 'bank_transfer',
          reference: bt.reference || null,
          description: input.description,
          createdBy: runByUserId!
        })
        .returning();

      // Expense bookkeeping: Debit opposing category account ID, Credit bank account cash ledger
      journalParams = {
        orgId: bt.orgId,
        date: bt.date,
        description: input.description || `Expense transaction booking - Feed match`,
        reference: bt.reference || undefined,
        source: 'bank_feed' as const,
        sourceId: newExp.id,
        createdBy: runByUserId!,
        lines: [
          {
            accountId: input.accountId,
            debit: bt.amount,
            description: input.description
          },
          {
            accountId: ba.accountId,
            credit: bt.amount,
            description: input.description
          }
        ]
      };

      const entry = await createJournalEntry(journalParams, tx);

      // Back-reference Expense table with generated ledger entry ID
      await tx
        .update(expenses)
        .set({ journalEntryId: entry.id })
        .where(eq(expenses.id, newExp.id));

      const reconciledLine = entry.lines.find((l: any) => l.accountId === ba.accountId && l.creditAmount === bt.amount);
      if (!reconciledLine) {
        throw new AppError('Accounting engine mismatch: unable to capture cash credit reconciliation target.', 500);
      }

      // Link to auto-reconcile
      await tx
        .update(bankTransactions)
        .set({
          journalLineId: reconciledLine.id,
          status: 'reconciled'
        })
        .where(eq(bankTransactions.id, bt.id));

      return { success: true, expenseId: newExp.id, entryId: entry.id };

    } else if (input.type === 'payment_received') {
      // Retrieve sequential code
      const [countResult] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(paymentsReceived)
        .where(eq(paymentsReceived.orgId, bt.orgId));
      
      const count = Number(countResult?.count || 0) + 1;
      const paymentNumber = `PAY-REC-${String(count).padStart(6, '0')}`;

      if (!input.contactId) {
        throw new AppError('Contact ID is strictly required to post Customer payments received.', 400);
      }

      const [newPayRec] = await tx
        .insert(paymentsReceived)
        .values({
          orgId: bt.orgId,
          paymentNumber,
          customerId: input.contactId,
          date: bt.date,
          amount: bt.amount,
          currency: 'NGN',
          paymentMethod: 'bank_transfer',
          reference: bt.reference || null,
          accountId: ba.accountId, // Local cash account receiving funds
          notes: input.description,
          createdBy: runByUserId!
        })
        .returning();

      // Credit Customer Receivables/Allocations (input.accountId), Debit Cash Bank (ba.accountId)
      journalParams = {
        orgId: bt.orgId,
        date: bt.date,
        description: input.description || `Payment Received - Bank Feed match`,
        reference: bt.reference || undefined,
        source: 'bank_feed' as const,
        sourceId: newPayRec.id,
        createdBy: runByUserId!,
        lines: [
          {
            accountId: ba.accountId,
            debit: bt.amount,
            description: input.description
          },
          {
            accountId: input.accountId,
            credit: bt.amount,
            description: input.description
          }
        ]
      };

      const entry = await createJournalEntry(journalParams, tx);

      const reconciledLine = entry.lines.find((l: any) => l.accountId === ba.accountId && l.debitAmount === bt.amount);
      if (!reconciledLine) {
        throw new AppError('Accounting engine mismatch: unable to capture cash debit reconciliation target.', 500);
      }

      await tx
        .update(bankTransactions)
        .set({
          journalLineId: reconciledLine.id,
          status: 'reconciled'
        })
        .where(eq(bankTransactions.id, bt.id));

      return { success: true, paymentId: newPayRec.id, entryId: entry.id };

    } else if (input.type === 'payment_made') {
      // Retrieve sequential code
      const [countResult] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(paymentsMade)
        .where(eq(paymentsMade.orgId, bt.orgId));
      
      const count = Number(countResult?.count || 0) + 1;
      const paymentNumber = `PAY-MADE-${String(count).padStart(6, '0')}`;

      if (!input.contactId) {
        throw new AppError('Contact ID is strictly required to post Vendor payments made.', 400);
      }

      const [newPayMade] = await tx
        .insert(paymentsMade)
        .values({
          orgId: bt.orgId,
          paymentNumber,
          vendorId: input.contactId,
          date: bt.date,
          amount: bt.amount,
          currency: 'NGN',
          paymentMethod: 'bank_transfer',
          reference: bt.reference || null,
          accountId: ba.accountId, // Local cash account dispersing funds
          notes: input.description,
          createdBy: runByUserId!
        })
        .returning();

      // Debit Liabilities Category / Accounts Payable (input.accountId), Credit Cash (ba.accountId)
      journalParams = {
        orgId: bt.orgId,
        date: bt.date,
        description: input.description || `Payment Made - Bank Feed match`,
        reference: bt.reference || undefined,
        source: 'bank_feed' as const,
        sourceId: newPayMade.id,
        createdBy: runByUserId!,
        lines: [
          {
            accountId: input.accountId,
            debit: bt.amount,
            description: input.description
          },
          {
            accountId: ba.accountId,
            credit: bt.amount,
            description: input.description
          }
        ]
      };

      const entry = await createJournalEntry(journalParams, tx);

      const reconciledLine = entry.lines.find((l: any) => l.accountId === ba.accountId && l.creditAmount === bt.amount);
      if (!reconciledLine) {
        throw new AppError('Accounting engine mismatch: unable to capture cash credit reconciliation target.', 500);
      }

      await tx
        .update(bankTransactions)
        .set({
          journalLineId: reconciledLine.id,
          status: 'reconciled'
        })
        .where(eq(bankTransactions.id, bt.id));

      return { success: true, paymentId: newPayMade.id, entryId: entry.id };

    } else if (input.type === 'transfer') {
      const [targetBa] = await tx
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.accountId, input.accountId))
        .limit(1);

      if (!targetBa) {
        throw new AppError('Target destination transfer bank account not found by its General Ledger account.', 404);
      }

      // Check transaction direction:
      // If bank feed shows credit/inbound, then ba.accountId is DEBITED, opposing input.accountId is CREDITED.
      // If bank feed shows debit/outbound, then opposing input.accountId is DEBITED, ba.accountId is CREDITED.
      const isBankFeedOutbound = bt.type === 'debit';
      const drAccountId = isBankFeedOutbound ? input.accountId : ba.accountId;
      const crAccountId = isBankFeedOutbound ? ba.accountId : input.accountId;

      journalParams = {
        orgId: bt.orgId,
        date: bt.date,
        description: input.description || `Contra Transfer Inter-account`,
        reference: bt.reference || undefined,
        source: 'bank_feed' as const,
        sourceId: bt.id,
        createdBy: runByUserId!,
        lines: [
          {
            accountId: drAccountId,
            debit: bt.amount,
            description: input.description
          },
          {
            accountId: crAccountId,
            credit: bt.amount,
            description: input.description
          }
        ]
      };

      const entry = await createJournalEntry(journalParams, tx);

      // Find the specific reconciled component representing our source ledger Cash bank account
      const reconciledLine = entry.lines.find((l: any) => l.accountId === ba.accountId && 
        (isBankFeedOutbound ? l.creditAmount === bt.amount : l.debitAmount === bt.amount));

      if (!reconciledLine) {
        throw new AppError('Accounting engine mismatch: unable to capture corresponding contra transfer line.', 500);
      }

      await tx
        .update(bankTransactions)
        .set({
          journalLineId: reconciledLine.id,
          status: 'reconciled'
        })
        .where(eq(bankTransactions.id, bt.id));

      return { success: true, entryId: entry.id };

    } else {
      throw new AppError(`Unsupported transaction matching type: ${input.type}`, 400);
    }
  });
}

/**
 * 5. BANK RECONCILIATION STATEMENT
 */
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

  if (!ba) {
    throw new AppError('Bank account not found.', 404);
  }

  const reconciledItems = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.status, 'reconciled'),
        lte(bankTransactions.date, asOfDate)
      )
    )
    .orderBy(desc(bankTransactions.date));

  const unreconciledItems = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.status, 'unreconciled'),
        lte(bankTransactions.date, asOfDate)
      )
    )
    .orderBy(desc(bankTransactions.date));

  const outstandingDeposits = unreconciledItems
    .filter((t) => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const outstandingPayments = unreconciledItems
    .filter((t) => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const glBalance = await getAccountBalance(ba.accountId, asOfDate);

  const statementClosingBalance = ba.currentBalance;
  const adjustedBankBalance = statementClosingBalance + outstandingDeposits - outstandingPayments;
  const isReconciled = adjustedBankBalance === glBalance;

  return {
    bankAccount: {
      name: ba.name,
      accountNumber: ba.accountNumber,
      bankName: ba.bankName
    },
    statementClosingBalance,
    glBalance,
    reconciledItems,
    unreconciledItems,
    outstandingDeposits,
    outstandingPayments,
    adjustedBankBalance,
    isReconciled,
    asOfDate
  };
}
