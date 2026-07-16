/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { eq, and, desc, or, like, sql, inArray } from 'drizzle-orm';
import { getTrialBalance } from '../services/ledger.service';
import {
  db,
  bankAccounts,
  bankTransactions,
  bankTransfers,
  bankRules,
  currencyRates,
  accounts,
  journalLines,
  journalEntries,
  paymentsReceived,
  paymentsMade,
  paymentAllocations,
  paymentMadeAllocations,
  contacts,
  invoices,
  bills,
  expenses,
  payrollRuns,
  users
} from '../db/schema';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import {
  initiateFlutterwaveConnect,
  exchangeFlutterwaveCode,
  syncFlutterwaveTransactions,
} from '../services/flutterwave.service';
import {
  matchBankTransaction,
  autoMatchTransactions,
  applyBankRule,
  createTransactionFromBankFeed,
  getBankReconciliationStatement
} from '../services/reconciliation.service';
import { fetchLatestRates } from '../services/cbn.service';
import { createJournalEntry, reverseJournalEntry } from '../services/ledger.service';
import { createAuditLog, extractReqMeta } from '../services/audit.service';

const router = Router();

// Apply session authentication and organization guards
router.use(authenticate);
router.use(requireOrg);

// Zod schemas for input validation
const addBankAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required.'),
  accountNumber: z.string().min(5, 'Account number must be at least 5 digits.'),
  bankName: z.string().min(1, 'Bank name is required.'),
  bankCode: z.string().optional(),
  accountId: z.string().uuid('A valid general ledger Cash Account ID is required.'),
  currency: z.string().default('NGN'),
  currentBalance: z.number().default(0), // in kobo
  openingBalanceDate: z.string().optional()
});

const patchBankAccountSchema = z.object({
  name: z.string().optional(),
  accountNumber: z.string().optional(),
  bankName: z.string().optional(),
  bankCode: z.string().optional(),
  isActive: z.boolean().optional(),
  accountId: z.string().uuid().optional(),
  currentBalance: z.number().optional(),
  type: z.string().optional(),
  openingBalanceDate: z.string().optional(),
});

const flutterwaveCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required.')
});

const syncTransactionsSchema = z.object({
  lastSyncDate: z.string().optional().transform((val) => val ? new Date(val) : undefined)
});

const listTransactionsQuerySchema = z.object({
  status: z.enum(['reconciled', 'unreconciled', 'all']).default('all'),
  type: z.enum(['debit', 'credit', 'all']).default('all'),
  search: z.string().optional(),
  limit: z.string().optional().transform((val) => val ? Math.min(parseInt(val), 3000) : 100),
  offset: z.string().optional().transform((val) => val ? parseInt(val) : 0)
});

const manualReconcileSchema = z.object({
  journalLineId: z.string().uuid('A valid journal line target index is required.')
});

const createRecordFromFeedSchema = z.object({
  type: z.enum(['expense', 'payment_received', 'payment_made', 'transfer']),
  accountId: z.string().uuid('A valid category general ledger account target is required.'),
  contactId: z.string().uuid().optional(),
  description: z.string().min(1, 'A visual journal narration description is required.'),
  allocations: z.array(z.object({
    id: z.string().uuid(),
    amount: z.number().int().nonnegative()
  })).optional().default([])
});

const bankRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required.'),
  conditions: z.any(), // JSON logic tree schema
  actions: z.any(),    // JSON execution schema
  priority: z.number().default(0),
  isActive: z.boolean().default(true)
});

// =========================================================================
// 1. BANK ACCOUNTS CRUD ENDPOINTS
// =========================================================================

// GET all bank accounts inside organization
router.get('/accounts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select({
        id: bankAccounts.id,
        orgId: bankAccounts.orgId,
        name: bankAccounts.name,
        accountNumber: bankAccounts.accountNumber,
        bankName: bankAccounts.bankName,
        bankCode: bankAccounts.bankCode,
        accountId: bankAccounts.accountId,
        currency: bankAccounts.currency,
        currentBalance: bankAccounts.currentBalance,
        openingBalance: bankAccounts.openingBalance,
        openingBalanceDate: bankAccounts.openingBalanceDate,
        monoAccountId: bankAccounts.monoAccountId,
        lastSyncedAt: bankAccounts.lastSyncedAt,
        isActive: bankAccounts.isActive,
        createdAt: bankAccounts.createdAt
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.orgId, orgId))
      .orderBy(desc(bankAccounts.createdAt));

    // Attach TB-computed balance for each bank account
    const now = new Date();
    const tbRows = await getTrialBalance(orgId, new Date('2000-01-01'), now);
    const tbMap = new Map<string, number>();
    for (const r of tbRows) {
      tbMap.set(r.accountId, (r.closingDebit || 0) - (r.closingCredit || 0));
    }
    const enriched = list.map(acct => ({
      ...acct,
      tbBalance: tbMap.get(acct.accountId) ?? acct.currentBalance ?? 0,
    }));

    return res.status(200).json(enriched);
  } catch (err) {
    next(err);
  }
});

// GET all active general ledger accounts
router.get('/gl-accounts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.isActive, true)))
      .orderBy(accounts.code);

    return res.status(200).json(list);
  } catch (err) {
    next(err);
  }
});

// POST register a new bank account structure tied to GL Cash
router.post('/accounts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = addBankAccountSchema.parse(req.body);

    // Verify target Cash account exists and belongs to organization
    const [targetAcc] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, body.accountId), eq(accounts.orgId, orgId)))
      .limit(1);

    if (!targetAcc) {
      throw new AppError('The target bank cash ledger account was not found in Chart of Accounts.', 404);
    }

    const insertData: Record<string, any> = {
      orgId,
      name: body.name,
      accountNumber: body.accountNumber,
      bankName: body.bankName,
      bankCode: body.bankCode || null,
      accountId: body.accountId,
      currency: body.currency,
      currentBalance: body.currentBalance,
      openingBalance: body.currentBalance,
      isActive: true
    };
    if (body.openingBalanceDate) {
      insertData.openingBalanceDate = new Date(body.openingBalanceDate);
    }

    const [newBa] = await db
      .insert(bankAccounts)
      .values(insertData)
      .returning();

    await createAuditLog({ orgId, userId: req.user!.userId, action: 'create', entityType: 'bank-account', entityId: newBa.id, newValues: { name: body.name, accountNumber: body.accountNumber }, ...extractReqMeta(req) });

    return res.status(201).json(newBa);
  } catch (err) {
    next(err);
  }
});

// PATCH edit single bank account metadata
router.patch('/accounts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = patchBankAccountSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, orgId)))
      .limit(1);

    if (!existing) {
      throw new AppError('Bank account details not found.', 404);
    }

    // Convert openingBalanceDate string to Date for timestamp column
    const setData: Record<string, any> = { ...body };
    if (setData.openingBalanceDate) {
      setData.openingBalanceDate = new Date(setData.openingBalanceDate);
    }
    // Strip type — column does not exist on bank_accounts
    delete setData.type;

    const [updated] = await db
      .update(bankAccounts)
      .set(setData)
      .where(eq(bankAccounts.id, id))
      .returning();

    await createAuditLog({ orgId, userId: req.user!.userId, action: 'update', entityType: 'bank-account', entityId: id, newValues: body, ...extractReqMeta(req) });

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE remove single bank account
router.delete('/accounts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, orgId)))
      .limit(1);

    if (!existing) {
      throw new AppError('Bank account not found.', 404);
    }

    // Verify no linked reconciled bank transactions exist to maintain audit trails
    const [linkedTxn] = await db
      .select({ id: bankTransactions.id })
      .from(bankTransactions)
      .where(and(eq(bankTransactions.bankAccountId, id), eq(bankTransactions.status, 'reconciled')))
      .limit(1);

    if (linkedTxn) {
      throw new AppError('This bank account carries reconciled bank feed transactions and cannot be deleted to prevent audit breaks. Deactivate it instead.', 400);
    }

    // Safely purge unreconciled transactions
    await db
      .delete(bankTransactions)
      .where(eq(bankTransactions.bankAccountId, id));

    await db
      .delete(bankAccounts)
      .where(eq(bankAccounts.id, id));

    await createAuditLog({ orgId, userId: req.user!.userId, action: 'delete', entityType: 'bank-account', entityId: id, ...extractReqMeta(req) });

    return res.status(200).json({ success: true, message: 'Bank account and pending transactions purged.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /accounts/:id/balance — set opening/adjusted balance via journal entry
router.patch('/accounts/:id/balance', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const { currentBalance } = z.object({ currentBalance: z.number() }).parse(req.body);

    const [ba] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, orgId)))
      .limit(1);

    if (!ba) {
      throw new AppError('Bank account not found.', 404);
    }

    if (!ba.accountId) {
      throw new AppError('Bank account has no linked GL account. Set one first.', 400);
    }

    // Resolve the Clearing Suspense account (207000)
    const [clearing] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.code, '207000')))
      .limit(1);

    if (!clearing) {
      throw new AppError('Bank Clearing Suspense account (207000) not found for this org.', 500);
    }

    const delta = currentBalance - ba.currentBalance;
    if (delta === 0) {
      return res.status(200).json(ba); // no change needed
    }

    const description = ba.currentBalance === 0 && !ba.openingBalanceDate
      ? `Opening balance — ${ba.name}`
      : `Balance adjustment — ${ba.name}`;

    if (delta > 0) {
      await createJournalEntry({
        orgId,
        date: new Date(),
        description,
        source: 'opening_balance',
        lines: [
          { accountId: ba.accountId, debit: delta, credit: 0, description: 'Bank balance increase' },
          { accountId: clearing.id, debit: 0, credit: delta, description: 'Contra to clearing' },
        ],
        createdBy: req.user!.userId,
        currency: 'NGN',
      });
    } else {
      await createJournalEntry({
        orgId,
        date: new Date(),
        description,
        source: 'opening_balance',
        lines: [
          { accountId: ba.accountId, debit: 0, credit: -delta, description: 'Bank balance decrease' },
          { accountId: clearing.id, debit: -delta, credit: 0, description: 'Contra to clearing' },
        ],
        createdBy: req.user!.userId,
        currency: 'NGN',
      });
    }

    // Also set openingBalanceDate on first-time setup
    if (!ba.openingBalanceDate) {
      await db
        .update(bankAccounts)
        .set({ openingBalance: currentBalance, openingBalanceDate: new Date() })
        .where(eq(bankAccounts.id, id));
    }

    // Re-fetch to return updated currentBalance (updated by createJournalEntry)
    const [updated] = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, id))
      .limit(1);

    await createAuditLog({ orgId, userId: req.user!.userId, action: 'adjust', entityType: 'bank-account', entityId: id, newValues: { newBalance: currentBalance }, ...extractReqMeta(req) });

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /accounts/import-opening-balances — single row from CSV import
router.post('/accounts/import-opening-balances', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { bankIdentifier, openingBalance } = req.body;
    if (!bankIdentifier) throw new AppError('bankIdentifier (bank name or account number) is required.', 400);

    const balanceKobo = Math.round(parseFloat(openingBalance || '0') * 100);

    // Look up by account number first, then by bank name
    let [ba] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.accountNumber, bankIdentifier)))
      .limit(1);

    if (!ba) {
      [ba] = await db
        .select()
        .from(bankAccounts)
        .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.name, bankIdentifier)))
        .limit(1);
    }

    if (!ba) {
      throw new AppError(`Bank account "${bankIdentifier}" not found.`, 404);
    }

    if (!ba.accountId) {
      throw new AppError('Bank account has no linked GL account. Set one first.', 400);
    }

    // Resolve the Clearing Suspense account (207000)
    const [clearing] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.code, '207000')))
      .limit(1);

    if (!clearing) {
      throw new AppError('Bank Clearing Suspense account (207000) not found for this org.', 500);
    }

    const delta = balanceKobo - ba.currentBalance;
    if (delta !== 0) {
      if (delta > 0) {
        await createJournalEntry({
          orgId,
          date: new Date(),
          description: `Opening balance import — ${ba.name}`,
          source: 'opening_balance',
          lines: [
            { accountId: ba.accountId, debit: delta, credit: 0, description: 'Opening balance from CSV import' },
            { accountId: clearing.id, debit: 0, credit: delta, description: 'Contra to clearing' },
          ],
          createdBy: req.user!.userId,
          currency: 'NGN',
        });
      } else {
        await createJournalEntry({
          orgId,
          date: new Date(),
          description: `Opening balance import — ${ba.name}`,
          source: 'opening_balance',
          lines: [
            { accountId: ba.accountId, debit: 0, credit: -delta, description: 'Opening balance from CSV import' },
            { accountId: clearing.id, debit: -delta, credit: 0, description: 'Contra to clearing' },
          ],
          createdBy: req.user!.userId,
          currency: 'NGN',
        });
      }
    }

    const [updated] = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, ba.id))
      .limit(1);

    await createAuditLog({ orgId, userId: req.user!.userId, action: 'import', entityType: 'bank-account', entityId: ba.id, newValues: { openingBalance: req.body.openingBalance }, ...extractReqMeta(req) });

    return res.status(200).json({ message: 'Opening balance updated.', account: updated.name, currentBalance: updated.currentBalance });
  } catch (err) {
    next(err);
  }
});

// DELETE /accounts/:id/clear-imported-statements — remove all CSV-imported transactions and reset balance
router.delete('/accounts/:id/clear-imported-statements', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [ba] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, orgId)))
      .limit(1);

    if (!ba) {
      throw new AppError('Bank account not found.', 404);
    }

    // Delete all unreconciled transactions that were imported via CSV upload
    const result = await db
      .delete(bankTransactions)
      .where(
        and(
          eq(bankTransactions.bankAccountId, id),
          eq(bankTransactions.orgId, orgId),
          eq(bankTransactions.status, 'unreconciled'),
          like(bankTransactions.monoTransactionId, 'uploaded_stmt_%')
        )
      )
      .returning({ id: bankTransactions.id });

    // Reset balance to 0 so user can set a fresh opening balance
    await db
      .update(bankAccounts)
      .set({ currentBalance: 0, openingBalance: 0 })
      .where(eq(bankAccounts.id, id));

    await createAuditLog({ orgId, userId: req.user!.userId, action: 'delete', entityType: 'bank-transaction', entityId: id, newValues: { cleared: true }, ...extractReqMeta(req) });

    return res.status(200).json({
      success: true,
      message: `Cleared ${result.length} imported statement transaction(s). Balance reset to 0.`,
      clearedCount: result.length
    });
  } catch (err) {
    next(err);
  }
});

// POST /accounts/reset-account — TEMPORARY: delete all data for a bank account and reset to opening balance
router.post('/accounts/reset-account', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { bankAccountId } = req.body;
    if (!bankAccountId) throw new AppError('bankAccountId is required.', 400);

    const [ba] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.orgId, orgId)))
      .limit(1);
    if (!ba) throw new AppError('Bank account not found.', 404);

    const glAccountId = ba.accountId;
    const results: any = {};

    // 1. Delete all bank transactions for this account
    const deletedTxns = await db
      .delete(bankTransactions)
      .where(and(eq(bankTransactions.bankAccountId, bankAccountId), eq(bankTransactions.orgId, orgId)))
      .returning({ id: bankTransactions.id });
    results.deletedTransactions = deletedTxns.length;

    // 2. Find all journal lines that credit this GL account (filter by org via journal entries)
    const creditLines = await db
      .select({ entryId: journalLines.entryId })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(eq(journalLines.accountId, glAccountId), eq(journalEntries.orgId, orgId)))
      .groupBy(journalLines.entryId);
    const entryIds = creditLines.map(r => r.entryId);

    if (entryIds.length > 0) {
      // 3. Find expenses linked to these entries
      const linkedExpenses = await db
        .select({ id: expenses.id, journalEntryId: expenses.journalEntryId })
        .from(expenses)
        .where(inArray(expenses.journalEntryId, entryIds));
      results.foundExpenses = linkedExpenses.length;

      // 4. Delete expenses (their journal entries are reversed by deleteExpense service)
      const { deleteExpense } = await import('../services/expense.service');
      for (const exp of linkedExpenses) {
        try {
          await deleteExpense(exp.id, req.user!.userId, orgId);
        } catch (e: any) {
          console.warn(`Failed to delete expense ${exp.id}: ${e.message}`);
        }
      }

      // 5. For remaining journal entries (opening balance, manual JEs), zero out the lines for this account
      const remainingEntryIds = entryIds.filter(eid => !linkedExpenses.some(e => e.journalEntryId === eid));
      if (remainingEntryIds.length > 0) {
        // Delete lines belonging to this account (org filter not needed — entryId scope is enough)
        await db
          .delete(journalLines)
          .where(and(
            eq(journalLines.accountId, glAccountId),
            inArray(journalLines.entryId, remainingEntryIds)
          ));
        results.clearedOtherJournalLines = remainingEntryIds.length;
      }
    }

    // 6. Reset bank account current balance to opening balance
    await db
      .update(bankAccounts)
      .set({ currentBalance: ba.openingBalance })
      .where(eq(bankAccounts.id, bankAccountId));

    await createAuditLog({
      orgId, userId: req.user!.userId, action: 'delete',
      entityType: 'bank-account', entityId: bankAccountId,
      newValues: { reset: true, ...results },
      ...extractReqMeta(req)
    });

    return res.json({
      success: true,
      message: 'Bank account reset complete.',
      results,
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 2. FLUTTERWAVE CONNECT INTEGRATION ENDPOINTS
// =========================================================================

// POST validate bank account before opening Mono Connect widget
// The widget runs client-side — this route just confirms the account exists.
router.post('/accounts/:id/connect-flutterwave', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [ba] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, orgId)))
      .limit(1);

    if (!ba) {
      throw new AppError('Bank account not found.', 404);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST exchange widget callback code for account_id
router.post('/accounts/:id/flutterwave-callback', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const { code } = flutterwaveCallbackSchema.parse(req.body);

    const [ba] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, orgId)))
      .limit(1);

    if (!ba) {
      throw new AppError('Target bank account not found.', 404);
    }

    const authResult = await exchangeFlutterwaveCode(code, id);
    await createAuditLog({ orgId, userId: req.user!.userId, action: 'connect', entityType: 'bank-account', entityId: id, newValues: { flutterwaveConnected: true }, ...extractReqMeta(req) });

    return res.status(200).json({ success: true, flutterwaveAccountId: authResult.id });
  } catch (err) {
    next(err);
  }
});

// POST pull latest bank transactions from Mono
router.post('/accounts/:id/sync', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const { lastSyncDate } = syncTransactionsSchema.parse(req.body);

    const [ba] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, orgId)))
      .limit(1);

    if (!ba) {
      throw new AppError('Bank account not found.', 404);
    }

    if (!ba.monoAccountId) {
      throw new AppError('This bank account must be connected to Flutterwave before syncing.', 400);
    }

    // Determine last sync cutoff (default to 30 days ago if never synced)
    const syncCutoff = lastSyncDate || ba.lastSyncedAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const count = await syncFlutterwaveTransactions(id, syncCutoff);

    // currentBalance is only updated via journal entries (createJournalEntry).
    // Synced transactions are imported as 'unreconciled' — the GL balance
    // (from JEs) is independent of the bank statement. Reconciliation matches
    // them later; the difference appears in Bank Clearing Suspense (207000).
    await createAuditLog({ orgId, userId: req.user!.userId, action: 'sync', entityType: 'bank-account', entityId: id, newValues: { synced: true }, ...extractReqMeta(req) });

    return res.status(200).json({ success: true, newTransactionsSynced: count });
  } catch (err) {
    next(err);
  }
});

// Configure Multer for processing statements (up to 50MB for large multi-page files)
const statementStorage = multer.memoryStorage();
const uploadStatement = multer({
  storage: statementStorage,
  limits: { fileSize: 50 * 1024 * 1024 }
}).single('file');

// ── Helpers ──

/** Detect column indices from a header row using flexible matching */
function detectCols(headers: string[]): { dateIdx: number; descIdx: number; depositIdx: number; withdrawalIdx: number; balanceIdx: number } {
  const h = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  const find = (keywords: string[], fallback: number) => {
    const idx = h.findIndex(s => keywords.some(k => s.includes(k)));
    return idx >= 0 ? idx : fallback;
  };
  return {
    dateIdx:      find(['date', 'posting', 'value', 'transdate', 'txndate', 'trandate'], 0),
    descIdx:      find(['description', 'narration', 'details', 'transaction', 'particulars', 'remark', 'reference', 'narrative'], 1),
    depositIdx:   find(['deposit', 'credit', 'inflow', 'receipt'], -1),
    withdrawalIdx: find(['withdrawal', 'debit', 'outflow', 'payment'], -1),
    balanceIdx:   find(['balance', 'running', 'ledger', 'available', 'closing', 'newbalance'], -1),
  };
}

/** Try to parse a date from various formats */
function parseDateStrict(raw: string): Date | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  // Try ISO first
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // DD/MM/YYYY or DD-MM-YYYY
  const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dm) {
    d = new Date(+dm[3], +dm[2] - 1, +dm[1]);
    if (!isNaN(d.getTime())) return d;
  }
  // MM/DD/YYYY or MM-DD-YYYY
  const mm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mm) {
    d = new Date(+mm[3], +mm[1] - 1, +mm[2]);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/** Parse a single numeric amount, handling parentheses for negatives */
function parseAmountStrict(raw: string): number | null {
  if (!raw?.trim()) return 0;
  const s = raw.trim().replace(/[^0-9.\-()]/g, '');
  if (!s) return 0;
  const neg = s.includes('(') && s.includes(')') ? -1 : 1;
  const v = parseFloat(s.replace(/[()]/g, ''));
  return isNaN(v) ? null : v * neg;
}

/** Parse an amount from a raw cell value (number or string) */
function parseAmountRaw(raw: any): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return raw;
  return parseAmountStrict(String(raw));
}

/** Parse tab-separated or space-aligned text lines into structured rows */
function parseTabularText(text: string): { date: string; description: string; deposit: number; withdrawal: number; balance: number }[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results: { date: string; description: string; deposit: number; withdrawal: number; balance: number }[] = [];

  for (const line of lines) {
    // Try pipe-delimited
    if (line.includes('|')) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 3) {
        const dateVal = parseDateStrict(cols[0]);
        if (!dateVal) continue;
        const rawDesc = cols.slice(1, -2).join(' ') || cols[1];
        const amt = parseAmountStrict(cols[cols.length - 2]) ?? 0;
        const bal = parseAmountStrict(cols[cols.length - 1]) ?? 0;
        results.push({
          date: dateVal.toISOString(),
          description: rawDesc,
          deposit: amt > 0 ? amt : 0,
          withdrawal: amt < 0 ? Math.abs(amt) : 0,
          balance: bal,
        });
        continue;
      }
    }

    // Try whitespace-delimited with date at start
    const dateMatch = line.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (!dateMatch) continue;
    const dateVal = parseDateStrict(dateMatch[1]);
    if (!dateVal) continue;

    // Extract amount and balance from end of line
    const parts = line.split(/\s{2,}|\t+/);
    if (parts.length >= 3) {
      const lastNum = parseAmountStrict(parts[parts.length - 1]) ?? 0;
      const secondLastNum = parseAmountStrict(parts[parts.length - 2]) ?? 0;
      const desc = parts.slice(1, -2).join(' ') || parts[1] || '';
      let deposit = 0, withdrawal = 0;
      if (secondLastNum >= 0 && lastNum >= 0) {
        // Both positive — deposit is the change amount
        deposit = Math.abs(secondLastNum - (parseAmountStrict(parts[parts.length - 3]) ?? 0));
        withdrawal = 0;
      }
      results.push({
        date: dateVal.toISOString(),
        description: desc,
        deposit,
        withdrawal,
        balance: lastNum,
      });
    }
  }
  return results;
}

// POST upload manual bank statements — supports CSV, Excel, PDF, Word (up to 50MB)
router.post('/accounts/:id/upload-statement', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  uploadStatement(req, res, async (err) => {
    if (err) {
      return next(new AppError(`File upload error: ${err.message}`, 400));
    }

    try {
      const orgId = req.user!.orgId!;
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        throw new AppError('Statement file is required. Please upload a CSV, Excel, PDF, or Word document.', 400);
      }

      const [ba] = await db
        .select()
        .from(bankAccounts)
        .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, orgId)))
        .limit(1);

      if (!ba) {
        throw new AppError('Bank account not found.', 404);
      }

      const rawRows: { date: Date; description: string; deposit: number; withdrawal: number; balance: number | null }[] = [];
      const fileName = file.originalname.toLowerCase();
      const ext = fileName.split('.').pop() || '';
      let diagnosticSample = '';

      // ── Parse file content ──

      // 1. CSV (note: .xls files have mimetype application/vnd.ms-excel but must NOT go here — they go to Excel branch below)
      if (ext === 'csv' || file.mimetype === 'text/csv') {
        const csvText = file.buffer.toString('utf-8');
        let lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        if (lines.length < 2) throw new AppError('CSV file appears empty.', 400);

        // Detect header row
        const headerWords = ['date', 'description', 'narration', 'amount', 'deposit', 'withdrawal', 'balance', 'credit', 'debit', 'transaction', 'details'];
        const headerIdx = lines.findIndex(l => headerWords.some(w => l.toLowerCase().includes(w)));

        let colMap: ReturnType<typeof detectCols>;
        if (headerIdx >= 0) {
          const hCols = lines[headerIdx].split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
          colMap = detectCols(hCols);
          lines.splice(0, headerIdx + 1); // remove header rows
        } else {
          colMap = { dateIdx: 0, descIdx: 1, depositIdx: -1, withdrawalIdx: -1, balanceIdx: -1 };
        }

        for (const line of lines) {
          const cols = line.split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
          if (cols.length < 3) continue;

          // Check if first column looks like a date
          const dateVal = parseDateStrict(cols[colMap.dateIdx]);
          if (!dateVal) continue;

          const description = (colMap.descIdx >= 0 && cols[colMap.descIdx]) || 'Statement line';

          // Determine amount: use Deposit/Withdrawal columns if available, otherwise try a single Amount column
          let deposit = 0, withdrawal = 0;
          if (colMap.depositIdx >= 0 && cols[colMap.depositIdx]) {
            deposit = parseAmountStrict(cols[colMap.depositIdx]) ?? 0;
          }
          if (colMap.withdrawalIdx >= 0 && cols[colMap.withdrawalIdx]) {
            withdrawal = parseAmountStrict(cols[colMap.withdrawalIdx]) ?? 0;
          }
          if (colMap.depositIdx < 0 && colMap.withdrawalIdx < 0) {
            // Try a single amount column at index 2
            const amt = parseAmountStrict(cols[2]) ?? 0;
            if (amt > 0) deposit = amt;
            else withdrawal = Math.abs(amt);
          }

          if (deposit === 0 && withdrawal === 0) continue;

          const balanceVal = colMap.balanceIdx >= 0 && cols[colMap.balanceIdx]
            ? (parseAmountStrict(cols[colMap.balanceIdx]) ?? null)
            : null;

          rawRows.push({ date: dateVal, description, deposit, withdrawal, balance: balanceVal });
        }
      }

      // 2. Excel (.xlsx, .xls) — uses SheetJS (xlsx) which handles both formats
      else if (['xlsx', 'xls'].includes(ext) || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.mimetype === 'application/vnd.ms-excel') {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new AppError('Excel file has no worksheets.', 400);

        // Parse as raw values (keeps dates as serial numbers, numbers as numbers)
        const rawRowsFromExcel: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })
          .filter((r: any) => (r as any[]).some(v => v != null && v !== ''));

        if (rawRowsFromExcel.length < 2) throw new AppError('Excel file appears empty.', 400);

        diagnosticSample = `rows=${rawRowsFromExcel.length}, first=${JSON.stringify(rawRowsFromExcel[0])}, second=${JSON.stringify(rawRowsFromExcel[1] || '')}`;

        // Detect header using stringified first rows
        const headerWords = ['date', 'description', 'narration', 'amount', 'deposit', 'withdrawal', 'balance', 'credit', 'debit', 'transaction'];
        const headerIdx = rawRowsFromExcel.findIndex(r => headerWords.some(w => (r as any[]).some((c: any) => String(c ?? '').toLowerCase().includes(w))));

        let colMap: ReturnType<typeof detectCols>;
        if (headerIdx >= 0) {
          const headerRow = (rawRowsFromExcel[headerIdx] as any[]).map((c: any) => String(c ?? '').trim());
          colMap = detectCols(headerRow);
          diagnosticSample += `, headerFound=true, colMap=${JSON.stringify(colMap)}, headerRow=${JSON.stringify(headerRow)}`;
          rawRowsFromExcel.splice(0, headerIdx + 1);
        } else {
          colMap = { dateIdx: 0, descIdx: 1, depositIdx: -1, withdrawalIdx: -1, balanceIdx: -1 };
          diagnosticSample += ', headerFound=false, using fallback colMap';
        }

        diagnosticSample += `, firstDataRow=${JSON.stringify(rawRowsFromExcel[0] || '')}`;

        for (const cols of rawRowsFromExcel) {
          const cell = (idx: number) => cols[idx] as any;
          if (cols.length < 3) continue;

          // Parse date: handle number (serial), Date object, or string
          let dateVal: Date | null = null;
          const rawDate = cell(colMap.dateIdx);
          if (typeof rawDate === 'number' && rawDate > 1) {
            // Excel serial date number
            const parsed = XLSX.SSF?.parse_date_code?.(rawDate);
            if (parsed) dateVal = new Date(parsed.y, parsed.m - 1, parsed.d);
          } else if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            dateVal = rawDate;
          } else if (rawDate) {
            dateVal = parseDateStrict(String(rawDate).trim());
          }
          if (!dateVal) continue;

          const rawDesc = cell(colMap.descIdx);
          const description = rawDesc ? String(rawDesc).trim() : 'Statement line';

          let deposit = 0, withdrawal = 0;
          if (colMap.depositIdx >= 0) {
            const v = parseAmountRaw(cell(colMap.depositIdx));
            if (v != null) deposit = v > 0 ? v : 0;
          }
          if (colMap.withdrawalIdx >= 0) {
            const v = parseAmountRaw(cell(colMap.withdrawalIdx));
            if (v != null) withdrawal = Math.abs(v);
          }
          if (colMap.depositIdx < 0 && colMap.withdrawalIdx < 0) {
            const amt = parseAmountRaw(cell(2)) ?? 0;
            if (amt > 0) deposit = amt;
            else withdrawal = Math.abs(amt);
          }

          if (deposit === 0 && withdrawal === 0) continue;

          const balanceVal = colMap.balanceIdx >= 0
            ? (parseAmountRaw(cell(colMap.balanceIdx)) ?? null)
            : null;

          rawRows.push({ date: dateVal, description, deposit, withdrawal, balance: balanceVal });
        }
      }

      // 3. Word (.docx)
      else if (ext === 'docx' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        const text = result.value;
        if (!text.trim()) throw new AppError('Word document appears empty or unreadable.', 400);

        // Try structured table extraction first
        const tableResult = await mammoth.convertToHtml({ buffer: file.buffer });
        const html = tableResult.value;

        // Extract HTML tables
        const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
        let tableMatch: RegExpExecArray | null;
        let foundTableRows = false;

        while ((tableMatch = tableRegex.exec(html)) !== null) {
          const trRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
          let trMatch: RegExpExecArray | null;
          while ((trMatch = trRegex.exec(tableMatch[0])) !== null) {
            const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
            const cells: string[] = [];
            let tdMatch: RegExpExecArray | null;
            while ((tdMatch = tdRegex.exec(trMatch[0])) !== null) {
              cells.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
            }
            if (cells.length >= 3) {
              const dateVal = parseDateStrict(cells[0]);
              if (!dateVal) continue;
              const amt1 = parseAmountStrict(cells[cells.length - 2]) ?? 0;
              const amt2 = parseAmountStrict(cells[cells.length - 1]) ?? 0;
              const desc = cells.slice(1, -2).join(' ') || cells[1] || '';
              rawRows.push({
                date: dateVal,
                description: desc,
                deposit: amt1 > 0 ? amt1 : (amt2 > 0 ? 0 : 0),
                withdrawal: amt1 < 0 ? Math.abs(amt1) : (amt2 < 0 ? Math.abs(amt2) : 0),
                balance: null,
              });
              foundTableRows = true;
            }
          }
        }

        if (foundTableRows && rawRows.length > 0) {
          // Tables worked; skip to write
        } else {
          // Fall back to raw text line-by-line parsing
          const tabular = parseTabularText(text);
          for (const row of tabular) {
            const d = new Date(row.date);
            rawRows.push({
              date: d,
              description: row.description,
              deposit: row.deposit,
              withdrawal: row.withdrawal,
              balance: row.balance || null,
            });
          }
        }
      }

      // 4. PDF
      else if (ext === 'pdf' || file.mimetype === 'application/pdf') {
        // Use pdfjs-dist to extract text from every page (no page limit)
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(file.buffer) }).promise;

        let fullText = '';
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          for (const item of content.items as any[]) {
            fullText += (item.str || '') + ' ';
          }
          fullText += '\n';
        }

        // Try structured table extraction via regex
        // Bank statements often have lines starting with a date
        const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const dateLike = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;

        for (const line of lines) {
          const dm = line.match(dateLike);
          if (!dm) continue;
          const dateVal = parseDateStrict(dm[1]);
          if (!dateVal) continue;

          // Extract numbers from the line
          const numbers = line.match(/\d[\d,]*\.?\d*/g);
          if (!numbers || numbers.length < 2) continue;

          // Last two numbers are typically amount and balance, or just amount
          const lastNum = parseFloat(numbers[numbers.length - 1].replace(/,/g, ''));
          const secondLastNum = parseFloat(numbers[numbers.length - 2].replace(/,/g, ''));

          // Determine which is amount and which is balance based on size
          // Amount is usually the smaller non-zero, balance is the larger
          const amt = Math.abs(lastNum - secondLastNum) > Math.min(lastNum, secondLastNum)
            ? Math.min(lastNum, secondLastNum)
            : Math.abs(lastNum - secondLastNum);

          const balanceVal = Math.max(lastNum, secondLastNum);

          // Reconstruct description (everything between date and the numbers)
          const dateEnd = line.indexOf(dm[1]) + dm[1].length;
          const descText = line.slice(dateEnd).replace(/\d[\d,]*\.?\d*/g, '').trim() || 'Statement line';

          rawRows.push({
            date: dateVal,
            description: descText,
            deposit: lastNum >= 0 && secondLastNum >= 0 ? Math.abs(lastNum - secondLastNum) : Math.abs(amt),
            withdrawal: lastNum < 0 || secondLastNum < 0 ? Math.abs(lastNum < 0 ? lastNum : secondLastNum) : 0,
            balance: balanceVal,
          });
        }

        // If pdfjs extracted nothing meaningful, try Gemini as fallback
        if (rawRows.length === 0) {
          const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
          if (GEMINI_API_KEY && GEMINI_API_KEY !== 'test') {
            try {
              const { GoogleGenAI } = await import('@google/genai');
              const ai = new GoogleGenAI({
                apiKey: GEMINI_API_KEY,
                httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
              });
              const prompt = `Extract all transactions from this bank statement PDF. Return ONLY valid JSON:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "transaction details",
      "deposit": number (credit amount or 0),
      "withdrawal": number (debit amount or 0),
      "balance": number (running balance after transaction or 0)
    }
  ]
}`;
              const response = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: [{ inlineData: { data: file.buffer.toString('base64'), mimeType: 'application/pdf' } }, prompt]
              });
              const jsonText = (response.text || '').match(/\{[\s\S]*\}/)?.[0] || '';
              const parsed = JSON.parse(jsonText);
              if (parsed?.transactions) {
                for (const tx of parsed.transactions) {
                  const d = tx.date ? new Date(tx.date) : null;
                  if (!d || isNaN(d.getTime())) continue;
                  rawRows.push({
                    date: d,
                    description: tx.description || '',
                    deposit: Math.abs(Number(tx.deposit) || 0),
                    withdrawal: Math.abs(Number(tx.withdrawal) || 0),
                    balance: Number(tx.balance) || null,
                  });
                }
              }
            } catch { /* Gemini fallback failed — will return error */ }
          }
        }
      } else {
        throw new AppError(`Unsupported file format (.${ext}). Please upload CSV, Excel (.xlsx/.xls), PDF, or Word (.docx).`, 400);
      }

      // ── Guard: require at least one parsed row ──
      if (rawRows.length === 0) {
        throw new AppError('Could not parse any transactions from the file. Check that the file contains a table with date, amount, and description columns.' + (diagnosticSample ? ` Diagnostic: ${diagnosticSample}` : ''), 400);
      }

      // ── Write to bank_transactions ──
      let insertedCount = 0;
      const ts = Date.now();
      for (const row of rawRows) {
        const amountKobo = Math.round(Math.max(row.deposit, row.withdrawal) * 100);
        const txnType = row.withdrawal > 0 ? 'debit' : 'credit';
        const monoTxId = `uploaded_stmt_${ts}_${Math.random().toString(36).substring(2, 6)}_${insertedCount}`;

        await db.insert(bankTransactions).values({
          bankAccountId: ba.id,
          orgId,
          date: row.date,
          description: row.description || 'Statement line',
          amount: amountKobo,
          type: txnType,
          balanceAfter: row.balance !== null ? Math.round(row.balance * 100) : null,
          reference: `STMT-${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'unreconciled',
          monoTransactionId: monoTxId,
        });
        insertedCount++;
      }

      await createAuditLog({
        orgId, userId: req.user!.userId, action: 'upload', entityType: 'bank-account', entityId: id,
        newValues: { statementUploaded: true, transactionsParsed: insertedCount },
        ...extractReqMeta(req)
      });

      return res.status(200).json({
        success: true,
        message: `Successfully processed statement! Extracted ${insertedCount} transactions.`,
        transactionsParsed: insertedCount,
      });

    } catch (err) {
      next(err);
    }
  });
});

// Helper to generate perfectly realistic mock statement lines for Nigerian SMEs bank statements
function generateMockStatementLines(): any[] {
  const currentYear = new Date().getFullYear();
  return [
    { date: new Date(currentYear, 4, 1), description: 'FLW*SKYHOUSE WORKSPACE PRE-BILLING', amountKobo: 12500000, type: 'debit', balanceKobo: 247000000 },
    { date: new Date(currentYear, 4, 2), description: 'ZENITH CORPORATE PAYOUT WEBSETTLE', amountKobo: 41800000, type: 'credit', balanceKobo: 288800000 },
    { date: new Date(currentYear, 4, 4), description: 'INTERSWITCH FEES SWEEP TRN:91823', amountKobo: 450000, type: 'debit', balanceKobo: 288350000 },
    { date: new Date(currentYear, 4, 6), description: 'TRANSFER FROM DANGOTE GROUP REVENUE', amountKobo: 125000000, type: 'credit', balanceKobo: 413350000 },
    { date: new Date(currentYear, 4, 10), description: 'FIRS LIRS VALUE-ADDED TAX REMIT', amountKobo: 18450000, type: 'debit', balanceKobo: 394900000 },
    { date: new Date(currentYear, 4, 12), description: 'CORPORATE CAR ACQUISITION LEASE PAY', amountKobo: 35000000, type: 'debit', balanceKobo: 359900000 },
    { date: new Date(currentYear, 4, 15), description: 'STAFF MID-MONTH COMMISSIONS OUTFLOW', amountKobo: 4200000, type: 'debit', balanceKobo: 355700000 },
    { date: new Date(currentYear, 4, 18), description: 'PAYSTACK MERC PAYOUT INT:029472', amountKobo: 84000000, type: 'credit', balanceKobo: 439700000 }
  ];
}

// =========================================================================
// 3. TRANSACTION BANK FEEDS & RECONCILIATION
// =========================================================================

// GET list of feed transactions for a bank account with status/direction filters
router.get('/accounts/:id/transactions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const q = listTransactionsQuerySchema.parse(req.query);

    // Verify account ownership
    const [ba] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, orgId)))
      .limit(1);

    if (!ba) {
      throw new AppError('Bank account details not resolved.', 404);
    }

    // Build filters dynamically
    const clauses = [eq(bankTransactions.bankAccountId, id), eq(bankTransactions.orgId, orgId)];

    if (q.status !== 'all') {
      clauses.push(eq(bankTransactions.status, q.status));
    }
    if (q.type !== 'all') {
      clauses.push(eq(bankTransactions.type, q.type));
    }
    if (q.search) {
      clauses.push(like(bankTransactions.description, `%${q.search}%`));
    }

    const list = await db
      .select()
      .from(bankTransactions)
      .where(and(...clauses))
      .orderBy(desc(bankTransactions.date))
      .limit(q.limit)
      .offset(q.offset);

    // For each unreconciled transaction, support a quick check to see if there's any perfect ±3 day matching candidate
    // which makes reconciliation screens amazingly useful and interactive!
    const enrichedList = await Promise.all(
      list.map(async (txn) => {
        if (txn.status === 'reconciled') {
          return { ...txn, suggestedMatches: [] };
        }

        // Search journal lines of that org mapping to bank account GL, that are unreconciled
        // (to make reconciliation suggestion highly interactive)
        const candidates = await db
          .select({
            lineId: journalLines.id,
            debitAmount: journalLines.debitAmount,
            creditAmount: journalLines.creditAmount,
            description: journalLines.description,
            entryDate: journalEntries.date,
            entryNum: journalEntries.entryNumber
          })
          .from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .where(
            and(
              eq(journalLines.accountId, ba.accountId),
              eq(journalEntries.orgId, orgId)
            )
          )
          .limit(10);

        // Filter valid candidates
        const suggestions = candidates.filter((item) => {
          const directMatch =
            (txn.type === 'debit' && item.creditAmount > 0) ||
            (txn.type === 'credit' && item.debitAmount > 0);
          if (!directMatch) return false;

          const itemAmt = item.debitAmount > 0 ? item.debitAmount : item.creditAmount;
          if (Math.abs(txn.amount - itemAmt) > 1) return false;

          const dateDiff = Math.abs(txn.date.getTime() - item.entryDate.getTime());
          return dateDiff <= 3 * 24 * 60 * 60 * 1000; // ±3 days
        });

        return {
          ...txn,
          suggestedMatches: suggestions
        };
      })
    );

    return res.status(200).json(enrichedList);
  } catch (err) {
    next(err);
  }
});

// GET bank reconciliation statement
router.get('/accounts/:bankAccountId/reconciliation-statement', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { bankAccountId } = req.params;
    const { asOfDate } = z.object({ asOfDate: z.string().optional() }).parse(req.query);

    const date = asOfDate ? new Date(asOfDate) : new Date();

    const statement = await getBankReconciliationStatement(bankAccountId, orgId, date);
    return res.status(200).json({ success: true, data: statement });
  } catch (err) {
    next(err);
  }
});

// PATCH manual ledger match and reconciliation
router.patch('/transactions/:id/reconcile', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { journalLineId } = manualReconcileSchema.parse(req.body);

    const result = await matchBankTransaction(id, journalLineId);
    await createAuditLog({ orgId: req.user!.orgId!, userId: req.user!.userId, action: 'reconcile', entityType: 'bank-transaction', entityId: id, newValues: { status: 'reconciled' }, ...extractReqMeta(req) });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST create a fresh financial record (expense, payment, transfer) and journalize matched
router.post('/transactions/:id/create-record', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = createRecordFromFeedSchema.parse(req.body);
    const userId = req.user!.userId;

    const result = await createTransactionFromBankFeed(id, body, userId);
    await createAuditLog({ orgId: req.user!.orgId!, userId, action: 'create', entityType: 'bank-transaction', entityId: id, newValues: { recordCreated: true }, ...extractReqMeta(req) });
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST batch create records from multiple bank feed items (e.g. select all bank charges)
router.post('/transactions/batch-create-record', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ ids: z.array(z.string()).min(1), data: createRecordFromFeedSchema }).parse(req.body);
    const userId = req.user!.userId;
    const results: any[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const id of body.ids) {
      try {
        const result = await createTransactionFromBankFeed(id, body.data, userId);
        results.push(result);
      } catch (err: any) {
        errors.push({ id, error: err.message || 'Unknown error' });
      }
    }

    await createAuditLog({ orgId: req.user!.orgId!, userId, action: 'create', entityType: 'bank-transaction', entityId: body.ids.join(','), newValues: { batchCount: body.ids.length, successCount: results.length, errorCount: errors.length }, ...extractReqMeta(req) });

    return res.status(201).json({ success: results.length, errors });
  } catch (err) {
    next(err);
  }
});

// POST run automated transactions match bot for bank account
router.post('/accounts/:id/auto-match', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [ba] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, orgId)))
      .limit(1);

    if (!ba) {
      throw new AppError('Bank account not resolved.', 404);
    }

    const result = await autoMatchTransactions(id);

    // Also run rules engine on any remaining unreconciled items
    let rulesMatchedCount = 0;
    const remainingUnreconciled = await db
      .select({ id: bankTransactions.id })
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.bankAccountId, id),
          eq(bankTransactions.status, 'unreconciled')
        )
      );

    for (const item of remainingUnreconciled) {
      const matchFound = await applyBankRule(item.id);
      if (matchFound) {
        rulesMatchedCount++;
      }
    }

    await createAuditLog({ orgId, userId: req.user!.userId, action: 'reconcile', entityType: 'bank-transaction', entityId: id, newValues: { autoMatched: true }, ...extractReqMeta(req) });

    return res.status(200).json({
      success: true,
      autoMatchedLedgerLines: result.autoMatched,
      rulesMatchedFeedRecords: rulesMatchedCount,
      needsReviewCount: result.needsReview,
      unmatchedCount: result.unmatched - rulesMatchedCount
    });
  } catch (err) {
    next(err);
  }
});

// GET list of unmatched general ledger journal lines for a bank account's paired cash GL account
router.get('/accounts/:id/unmatched-journal-lines', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [ba] = await db
      .select({ id: bankAccounts.id, accountId: bankAccounts.accountId })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, orgId)))
      .limit(1);

    if (!ba) {
      throw new AppError('Bank account details not resolved.', 404);
    }

    // Fetch all journal lines already reconciled to exclude them
    const reconciledLines = await db
      .select({ id: bankTransactions.journalLineId })
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.bankAccountId, id),
          eq(bankTransactions.status, 'reconciled')
        )
      );

    const excludedIds = reconciledLines
      .map((item) => item.id)
      .filter((lineId): lineId is string => !!lineId);

    // Query journal lines on the cash account code
    const lines = await db
      .select({
        id: journalLines.id,
        entryId: journalLines.entryId,
        debitAmount: journalLines.debitAmount,
        creditAmount: journalLines.creditAmount,
        description: journalLines.description,
        entryDate: journalEntries.date,
        entryNum: journalEntries.entryNumber,
        source: journalEntries.source,
        sourceId: journalEntries.sourceId
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.accountId, ba.accountId),
          eq(journalEntries.orgId, orgId)
        )
      )
      .orderBy(desc(journalEntries.date))
      .limit(150);

    // Filter out journal lines that are already reconciled
    const unmatchedLines = lines.filter((line) => !excludedIds.includes(line.id));

    return res.status(200).json(unmatchedLines);
  } catch (err) {
    next(err);
  }
});

// GET journal-ledger view for a bank account's paired GL cash account
router.get('/accounts/:id/payments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const { from, to } = req.query;

    const [ba] = await db
      .select({
        accountId: bankAccounts.accountId,
        accountCode: accounts.code,
        accountName: accounts.name,
        currentBalance: bankAccounts.currentBalance,
        openingBalanceDate: bankAccounts.openingBalanceDate
      })
      .from(bankAccounts)
      .leftJoin(accounts, eq(bankAccounts.accountId, accounts.id))
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, orgId)))
      .limit(1);

    if (!ba) throw new AppError('Bank account not found.', 404);

    // Calculate opening balance:
    // Use the user-stored currentBalance as the seed, then add ledger activity
    // between the openingBalanceDate and the from date (if any).
    // If no from date, the stored balance is the opening balance directly.
    let openingBalance = Number(ba.currentBalance || 0);
    if (from && ba.openingBalanceDate) {
      const preResult = await db.execute(sql`
        SELECT COALESCE(SUM(
          CASE WHEN jl.debit_amount > 0 THEN jl.debit_amount ELSE -jl.credit_amount END
        ), 0) AS balance
        FROM journal_lines jl
        INNER JOIN journal_entries je ON jl.entry_id = je.id
        WHERE jl.account_id = ${ba.accountId}::uuid
          AND je.org_id = ${orgId}::uuid
          AND je.is_reversed = false
          AND je.date >= ${ba.openingBalanceDate}::date
          AND je.date < ${from}::date
      `);
      const preRow = preResult.rows ? preResult.rows[0] : preResult[0];
      openingBalance += Number(preRow?.balance || 0);
    } else if (from && !ba.openingBalanceDate) {
      // No opening balance date — use full ledger history before from
      const preResult = await db.execute(sql`
        SELECT COALESCE(SUM(
          CASE WHEN jl.debit_amount > 0 THEN jl.debit_amount ELSE -jl.credit_amount END
        ), 0) AS balance
        FROM journal_lines jl
        INNER JOIN journal_entries je ON jl.entry_id = je.id
        WHERE jl.account_id = ${ba.accountId}::uuid
          AND je.org_id = ${orgId}::uuid
          AND je.is_reversed = false
          AND je.date < ${from}::date
      `);
      const preRow = preResult.rows ? preResult.rows[0] : preResult[0];
      openingBalance = Number(preRow?.balance || 0);
    }

    // Build date filter clause
    const dateFilter = from && to
      ? sql`AND je.date >= ${from}::date AND je.date <= ${to}::date`
      : from
        ? sql`AND je.date >= ${from}::date`
        : to
          ? sql`AND je.date <= ${to}::date`
          : sql``;

    // Fetch filtered journal lines hitting this cash GL account
    const rows = await db.execute(sql`
      WITH bank_lines AS (
        SELECT
          jl.id,
          je.id AS entry_id,
          je.entry_number,
          je.date,
          je.source,
          je.source_id,
          jl.debit_amount,
          jl.credit_amount,
          jl.description AS line_desc,
          jl.account_id
        FROM journal_lines jl
        INNER JOIN journal_entries je ON jl.entry_id = je.id
        WHERE jl.account_id = ${ba.accountId}::uuid
          AND je.org_id = ${orgId}::uuid
          AND je.is_reversed = false
          ${dateFilter}
      ),
      contra AS (
        SELECT
          jl.entry_id,
          a.name AS contra_name,
          a.code AS contra_code,
          jl.description AS contra_desc
        FROM journal_lines jl
        INNER JOIN accounts a ON jl.account_id = a.id
        WHERE jl.entry_id IN (SELECT entry_id FROM bank_lines)
          AND jl.account_id != ${ba.accountId}::uuid
      )
      SELECT
        bl.id,
        bl.entry_number,
        bl.date,
        bl.source,
        bl.source_id,
        bl.debit_amount,
        bl.credit_amount,
        bl.line_desc,
        COALESCE(
          (SELECT string_agg(contra_name, '; ' ORDER BY contra_name) FROM contra WHERE contra.entry_id = bl.entry_id),
          ''
        ) AS contra_accounts,
        COALESCE(
          (SELECT string_agg(contra_desc, '; ' ORDER BY contra_desc) FROM contra WHERE contra.entry_id = bl.entry_id),
          ''
        ) AS contra_descs
      FROM bank_lines bl
      ORDER BY bl.date ASC, bl.entry_number ASC
    `);

    // Enrich with source document details
    const enriched: any[] = [];
    for (const row of rows.rows || rows) {
      let txnType = row.source;
      let txnNumber = row.entry_number;
      let contactName = '';
      let docRef = '';
      let sourceDocType = '';
      let sourceDocId = row.source_id;

      // Look up source document for description enrichment
      switch (row.source) {
        case 'invoice': {
          const [inv] = await db
            .select({
              number: invoices.invoiceNumber,
              contact: contacts.name,
              lineItems: sql<string>`string_agg(DISTINCT inv_lines.description, '; ')`
            })
            .from(invoices)
            .leftJoin(contacts, eq(invoices.customerId, contacts.id))
            .leftJoin(sql`invoice_lines inv_lines`, eq(sql`inv_lines.invoice_id`, invoices.id))
            .where(eq(invoices.id, row.source_id))
            .groupBy(invoices.id, contacts.name)
            .limit(1);
          if (inv) { txnType = 'Receipt'; txnNumber = inv.number; contactName = inv.contact || ''; docRef = inv.lineItems || ''; sourceDocType = 'invoice'; }
          break;
        }
        case 'payment': {
          // payment could be received or made — check both
          const [pmtRec] = await db
            .select({ number: paymentsReceived.paymentNumber, contact: contacts.name })
            .from(paymentsReceived)
            .leftJoin(contacts, eq(paymentsReceived.customerId, contacts.id))
            .where(eq(paymentsReceived.id, row.source_id))
            .limit(1);
          if (pmtRec) { txnType = 'Receipt'; txnNumber = pmtRec.number; contactName = pmtRec.contact || ''; sourceDocType = 'receipt'; break; }
          const [pmtMade] = await db
            .select({ number: paymentsMade.paymentNumber, contact: contacts.name })
            .from(paymentsMade)
            .leftJoin(contacts, eq(paymentsMade.vendorId, contacts.id))
            .where(eq(paymentsMade.id, row.source_id))
            .limit(1);
          if (pmtMade) { txnType = 'Payment'; txnNumber = pmtMade.number; contactName = pmtMade.contact || ''; sourceDocType = 'payment'; }
          break;
        }
        case 'opening_balance':
          txnType = 'Opening Balance';
          break;
        case 'manual': {
          const [exp] = await db
            .select({ number: expenses.expenseNumber })
            .from(expenses)
            .where(eq(expenses.id, row.source_id))
            .limit(1);
          if (exp) { txnType = 'Expense'; txnNumber = exp.number; sourceDocType = 'expense'; }
          break;
        }
        case 'payroll': {
          const [pr] = await db
            .select({ runNumber: payrollRuns.runNumber })
            .from(payrollRuns)
            .where(eq(payrollRuns.id, row.source_id))
            .limit(1);
          if (pr) { txnType = 'Payroll'; txnNumber = pr.runNumber; sourceDocType = 'payroll'; }
          break;
        }
        case 'transfer': {
          const [tf] = await db
            .select({ transferNumber: bankTransfers.transferNumber })
            .from(bankTransfers)
            .where(eq(bankTransfers.id, row.source_id))
            .limit(1);
          if (tf) { txnType = 'Transfer'; txnNumber = tf.transferNumber; sourceDocType = 'transfer'; }
          break;
        }
      }

      const amount = Number(row.debit_amount || 0) - Number(row.credit_amount || 0);
      enriched.push({
        id: row.id,
        date: row.date,
        txnType,
        txnNumber,
        contraAccounts: row.contra_accounts || '',
        contactName,
        description: row.line_desc || docRef,
        // Debit positive = money in, Credit positive = money out (for asset account)
        amount: amount > 0 ? amount : -Number(row.credit_amount || 0),
        isDebit: row.debit_amount > 0,
        sourceDocType,
        sourceDocId
      });
    }

    // Compute running balance starting from opening balance.
    // row.amount already carries the correct sign:
    //   positive for debits (inflow), negative for credits (outflow)
    let running = openingBalance;
    for (const row of enriched) {
      running += row.amount;
      row.balance = running;
    }

    return res.status(200).json({
      accountCode: ba.accountCode,
      accountName: ba.accountName,
      openingBalance,
      openingBalanceDate: ba.openingBalanceDate,
      transactions: enriched.reverse()
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 4. BANK FEED TRANSACTION CATEGORIZATION RULES
// =========================================================================

// GET list of active bank rules
router.get('/rules', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(bankRules)
      .where(eq(bankRules.orgId, orgId))
      .orderBy(desc(bankRules.priority));

    return res.status(200).json(list);
  } catch (err) {
    next(err);
  }
});

// POST create a smart bank rule
router.post('/rules', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = bankRuleSchema.parse(req.body);

    const [newRule] = await db
      .insert(bankRules)
      .values({
        orgId,
        name: body.name,
        conditions: body.conditions,
        actions: body.actions,
        priority: body.priority,
        isActive: body.isActive
      })
      .returning();

    await createAuditLog({ orgId, userId: req.user!.userId, action: 'create', entityType: 'bank-rule', entityId: newRule.id, newValues: { name: body.name }, ...extractReqMeta(req) });

    return res.status(201).json(newRule);
  } catch (err) {
    next(err);
  }
});

// PATCH update bank rule
router.patch('/rules/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = bankRuleSchema.partial().parse(req.body);

    const [existing] = await db
      .select()
      .from(bankRules)
      .where(and(eq(bankRules.id, id), eq(bankRules.orgId, orgId)))
      .limit(1);

    if (!existing) {
      throw new AppError('Matching bank rule not found.', 404);
    }

    const [updated] = await db
      .update(bankRules)
      .set(body)
      .where(eq(bankRules.id, id))
      .returning();

    await createAuditLog({ orgId, userId: req.user!.userId, action: 'update', entityType: 'bank-rule', entityId: id, newValues: body, ...extractReqMeta(req) });

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE bank rule
router.delete('/rules/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(bankRules)
      .where(and(eq(bankRules.id, id), eq(bankRules.orgId, orgId)))
      .limit(1);

    if (!existing) {
      throw new AppError('Bank rule not found.', 404);
    }

    await db
      .delete(bankRules)
      .where(eq(bankRules.id, id));

    await createAuditLog({ orgId, userId: req.user!.userId, action: 'delete', entityType: 'bank-rule', entityId: id, ...extractReqMeta(req) });

    return res.status(200).json({ success: true, message: 'Bank rule successfully removed.' });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 4. INTER ACCOUNT TRANSFERS ENDPOINTS
// =========================================================================

const createTransferSchema = z.object({
  fromBankAccountId: z.string().uuid(),
  toBankAccountId: z.string().uuid(),
  date: z.string(),
  amount: z.number().positive('Amount must be positive.'),
  currency: z.string().default('NGN'),
  fxRate: z.number().positive().optional(),
  description: z.string().optional(),
  reference: z.string().optional(),
});

const updateTransferSchema = z.object({
  date: z.string().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  fxRate: z.number().positive().optional(),
  description: z.string().optional(),
  reference: z.string().optional(),
});

function generateTransferNumber(): string {
  return `TF-${Date.now().toString(36).toUpperCase()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
}

// GET all transfers
router.get('/transfers', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { from, to } = req.query;

    const result = await db.execute(sql`
      SELECT
        bt.id,
        bt.org_id AS "orgId",
        bt.transfer_number AS "transferNumber",
        bt.from_bank_account_id AS "fromBankAccountId",
        bt.to_bank_account_id AS "toBankAccountId",
        bt.date,
        bt.amount,
        bt.currency,
        bt.fx_rate AS "fxRate",
        bt.description,
        bt.reference,
        bt.journal_entry_id AS "journalEntryId",
        bt.created_by AS "createdBy",
        bt.created_at AS "createdAt",
        fa.name AS "fromAccountName",
        fa.account_number AS "fromAccountNumber",
        fa.bank_name AS "fromBankName",
        ta.name AS "toAccountName",
        ta.account_number AS "toAccountNumber",
        ta.bank_name AS "toBankName"
      FROM bank_transfers bt
      LEFT JOIN bank_accounts fa ON fa.id = bt.from_bank_account_id
      LEFT JOIN bank_accounts ta ON ta.id = bt.to_bank_account_id
      WHERE bt.org_id = ${orgId}
      ${from && typeof from === 'string' && from.trim() ? sql`AND bt.date >= ${from}::date` : sql``}
      ${to && typeof to === 'string' && to.trim() ? sql`AND bt.date <= ${to}::date` : sql``}
      ORDER BY bt.date DESC
    `);
    return res.status(200).json(result.rows || []);
  } catch (err) {
    next(err);
  }
});

// POST create a new transfer
router.post('/transfers', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const body = createTransferSchema.parse(req.body);

    if (body.fromBankAccountId === body.toBankAccountId) {
      throw new AppError('Source and destination accounts must be different.', 400);
    }

    // Verify both bank accounts exist
    const [fromAcc] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, body.fromBankAccountId), eq(bankAccounts.orgId, orgId)))
      .limit(1);
    if (!fromAcc) throw new AppError('Source bank account not found.', 404);

    const [toAcc] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, body.toBankAccountId), eq(bankAccounts.orgId, orgId)))
      .limit(1);
    if (!toAcc) throw new AppError('Destination bank account not found.', 404);

    const amountKobo = Math.round(body.amount * 100);

    // Create journal entry + transfer record in a transaction
    const result = await db.transaction(async (tx) => {
      const je = await createJournalEntry(
        {
          orgId,
          date: new Date(body.date),
          description: body.description || `Transfer from ${fromAcc.name} to ${toAcc.name}`,
          source: 'transfer',
          reference: body.reference || undefined,
          createdBy: userId,
          lines: [
            {
              accountId: fromAcc.accountId,
              debit: 0,
              credit: amountKobo,
              description: `Transfer to ${toAcc.name}`,
              currency: body.currency || 'NGN',
              fxRate: body.fxRate,
            },
            {
              accountId: toAcc.accountId,
              debit: amountKobo,
              credit: 0,
              description: `Transfer from ${fromAcc.name}`,
              currency: body.currency || 'NGN',
              fxRate: body.fxRate,
            },
          ],
        },
        tx
      );

      // Insert transfer record
      const [transfer] = await tx
        .insert(bankTransfers)
        .values({
          orgId,
          transferNumber: je.entryNumber,
          fromBankAccountId: body.fromBankAccountId,
          toBankAccountId: body.toBankAccountId,
          date: new Date(body.date),
          amount: amountKobo,
          currency: body.currency || 'NGN',
          fxRate: body.fxRate ? String(body.fxRate) : null,
          description: body.description || null,
          reference: body.reference || null,
          journalEntryId: je.id,
          createdBy: userId,
        })
        .returning();

      return transfer;
    });

    await createAuditLog({ orgId, userId, action: 'create', entityType: 'transfer', entityId: result.id, newValues: { fromAccountId: body.fromBankAccountId, toAccountId: body.toBankAccountId, amount: body.amount }, ...extractReqMeta(req) });

    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH update a transfer (only date, description, reference — amount changes require reversal)
router.patch('/transfers/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = updateTransferSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(bankTransfers)
      .where(and(eq(bankTransfers.id, id), eq(bankTransfers.orgId, orgId)))
      .limit(1);

    if (!existing) throw new AppError('Transfer not found.', 404);

    const updateData: Record<string, any> = {};
    if (body.date) updateData.date = new Date(body.date);
    if (body.description !== undefined) updateData.description = body.description;
    if (body.reference !== undefined) updateData.reference = body.reference;

    // If amount changed, require reversal instead (too complex to edit journal entries)
    if (body.amount && body.amount * 100 !== existing.amount) {
      throw new AppError('Changing transfer amount is not supported. Please reverse and create a new transfer.', 400);
    }

    const [updated] = await db
      .update(bankTransfers)
      .set(updateData)
      .where(eq(bankTransfers.id, id))
      .returning();

    await createAuditLog({ orgId, userId: req.user!.userId, action: 'update', entityType: 'transfer', entityId: id, newValues: body, ...extractReqMeta(req) });

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE reverse a transfer
router.delete('/transfers/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(bankTransfers)
      .where(and(eq(bankTransfers.id, id), eq(bankTransfers.orgId, orgId)))
      .limit(1);

    if (!existing) throw new AppError('Transfer not found.', 404);

    // Reverse the journal entry
    if (existing.journalEntryId) {
      await reverseJournalEntry(existing.journalEntryId, new Date(), userId);
    }

    // Delete the transfer record
    await db.delete(bankTransfers).where(eq(bankTransfers.id, id));

    await createAuditLog({ orgId, userId, action: 'void', entityType: 'transfer', entityId: id, newValues: { status: 'void' }, ...extractReqMeta(req) });

    return res.status(200).json({ success: true, message: 'Transfer reversed and deleted.' });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// 5. CBN CURRENCY RATES ENDPOINTS
// =========================================================================

// GET active currency exchange rates list
router.get('/currency-rates', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(currencyRates)
      .where(eq(currencyRates.orgId, orgId))
      .orderBy(desc(currencyRates.effectiveDate));

    return res.status(200).json(list);
  } catch (err) {
    next(err);
  }
});

// POST trigger a refresh sync from exchangerate API
router.post('/currency-rates/refresh', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rates = await fetchLatestRates(orgId);
    await createAuditLog({ orgId, userId: req.user!.userId, action: 'refresh', entityType: 'currency-rate', newValues: { refreshed: true }, ...extractReqMeta(req) });

    return res.status(200).json({ success: true, updatedRates: rates });
  } catch (err) {
    next(err);
  }
});

export default router;
