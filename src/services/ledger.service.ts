/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { eq, and, lte, gte, sql, asc } from 'drizzle-orm';
import { db, accounts, journalEntries, journalLines, bankAccounts, fixedAssets, contacts, inventoryLots, closedPeriods, invoices, paymentsReceived, bills } from '../db/schema';
import { AppError } from '../lib/errors';
import { toNgn, getRateForDate } from './currency.service';

// ==========================================
// 1. TYPES EXPORT DEFINITIONS
// ==========================================

export type JournalLineInput = {
  accountId: string;
  debit?: number;    // in kobo, integer
  credit?: number;   // in kobo, integer
  description?: string;
  currency?: string;
  fxRate?: number;
};

export type CreateJournalEntryInput = {
  orgId: string;
  date: Date;
  description: string;
  reference?: string;
  source: 'manual' | 'invoice' | 'bill' | 'payment' | 'payroll' | 'bank_feed' | 'opening_balance' | 'opening_stock' | 'transfer';
  sourceId?: string;
  projectId?: string;
  createdBy: string;
  lines: JournalLineInput[];
  currency?: string;
  fxRate?: number;
};

export type TrialBalanceRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  parentId: string | null;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
};

// ==========================================
// 2. BOOKKEEPING ENGINE FUNCTIONS
// ==========================================

/**
 * Checks whether the given date falls within any closed accounting period for the org.
 */
export async function isDateInClosedPeriod(orgId: string, date: Date): Promise<{ isClosed: boolean; periodEnd?: Date; closedAt?: Date }> {
  const closed = await db
    .select()
    .from(closedPeriods)
    .where(
      and(
        eq(closedPeriods.orgId, orgId),
        lte(closedPeriods.periodStart, date),
        gte(closedPeriods.periodEnd, date)
      )
    )
    .limit(1);

  if (closed.length > 0) {
    return { isClosed: true, periodEnd: closed[0].periodEnd, closedAt: closed[0].closedAt };
  }
  return { isClosed: false };
}

/**
 * Creates a balanced multi-line double-entry journal entry inside the ledger.
 *
 * @param input Raw transaction payload including org index, date, desc, source type and nested journal lines.
 * @param tx Optional Drizzle transaction instance to run this operation within.
 * @throws AppError if validation constraints fail (unbalanced debits vs credits, < 2 lines, negative integers, both Dr/Cr configured).
 * @returns The newly created journal entry populated with its constituent journal lines.
 */
export async function createJournalEntry(
  input: CreateJournalEntryInput,
  tx?: any
): Promise<any> {
  const client = tx || db;

  // 0. Reject if date falls in closed period
  const periodCheck = await isDateInClosedPeriod(input.orgId, input.date);
  if (periodCheck.isClosed) {
    throw new AppError(
      `Cannot post to a closed accounting period. Period ending ${periodCheck.periodEnd?.toISOString().split('T')[0]} was closed on ${periodCheck.closedAt?.toISOString().split('T')[0]}.`,
      403
    );
  }

  // 1. Validate line inputs
  if (!input.lines || input.lines.length < 2) {
    throw new AppError('A valid journal entry must contain at least 2 lines.', 400);
  }

  let totalDebits = 0;
  let totalCredits = 0;

  for (const line of input.lines) {
    const debit = line.debit || 0;
    const credit = line.credit || 0;

    if (debit < 0 || credit < 0) {
      throw new AppError('Debit and credit amounts must be non-negative integers representing Kobo.', 400);
    }
    if (debit > 0 && credit > 0) {
      throw new AppError('A single journal line cannot contain both a debit and a credit amount.', 400);
    }
    if (debit === 0 && credit === 0) {
      throw new AppError('Each journal line must specify either a non-zero debit or credit amount.', 400);
    }

    totalDebits += debit;
    totalCredits += credit;
  }

  // Double-entry validation
  if (totalDebits !== totalCredits) {
    throw new AppError(
      `Journal entry is out of balance. Total debits (${totalDebits} kobo) must exactly match total credits (${totalCredits} kobo).`,
      400
    );
  }

  // Auto-resolve projectId from unambiguous source records
  if (!input.projectId && input.source && input.sourceId) {
    try {
      let srcProjectId: string | null | undefined;
      if (input.source === 'invoice') {
        const [r] = await (tx || db).select({ pid: invoices.projectId }).from(invoices).where(eq(invoices.id, input.sourceId)).limit(1);
        srcProjectId = r?.pid;
      } else if (input.source === 'payment') {
        const [r] = await (tx || db).select({ pid: paymentsReceived.projectId }).from(paymentsReceived).where(eq(paymentsReceived.id, input.sourceId)).limit(1);
        srcProjectId = r?.pid;
      } else if (input.source === 'bill') {
        const [r] = await (tx || db).select({ pid: bills.projectId }).from(bills).where(eq(bills.id, input.sourceId)).limit(1);
        srcProjectId = r?.pid;
      }
      if (srcProjectId) input.projectId = srcProjectId;
    } catch { /* source table may not exist or sourceId not found */ }
  }

  // 2. Perform DB operations inside transaction boundaries (if not already inside one)
  const executeDBOps = async (dbClient: any) => {
    // Generate distinct entry numbers sequentially
    const [countResult] = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(eq(journalEntries.orgId, input.orgId));
    
    const count = Number(countResult?.count || 0) + 1;
    const entryNumber = `JE-${String(count).padStart(6, '0')}`;

    // Insert Entry root node
    const [newEntry] = await dbClient
      .insert(journalEntries)
      .values({
        orgId: input.orgId,
        entryNumber,
        date: input.date,
        description: input.description,
        reference: input.reference || null,
        source: input.source,
        sourceId: input.sourceId || null,
        projectId: input.projectId || null,
        createdBy: input.createdBy,
        isReversed: false
      })
      .returning();

    if (!newEntry) {
      throw new AppError('Failed to record journal entry root structure.', 500);
    }

    // Insert lines under the Entry node
    const createdLines: any[] = [];
    for (const line of input.lines) {
      const currency = line.currency || input.currency || 'NGN';
      const fxRate = line.fxRate || input.fxRate || null;
      const [newLine] = await dbClient
        .insert(journalLines)
        .values({
          entryId: newEntry.id,
          accountId: line.accountId,
          debitAmount: line.debit || 0,
          creditAmount: line.credit || 0,
          description: line.description || null,
          currency,
          fxRate: fxRate ? String(fxRate) : null,
        })
        .returning();

      if (!newLine) {
        throw new AppError('Failed to record journal line item.', 500);
      }
      createdLines.push(newLine);

      // Cache side-effects: update linked balance in bank accounts if asset bank ledger modified
      const bankAccList = await dbClient
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.accountId, line.accountId));

      for (const bankAcc of bankAccList) {
        const balanceDelta = (line.debit || 0) - (line.credit || 0);
        if (balanceDelta !== 0) {
          await dbClient
            .update(bankAccounts)
            .set({
              currentBalance: sql`${bankAccounts.currentBalance} + ${balanceDelta}`
            })
            .where(eq(bankAccounts.id, bankAcc.id));
        }
      }
    }

    return {
      ...newEntry,
      lines: createdLines
    };
  };

  if (!tx) {
    return await db.transaction(async (newTx) => {
      return await executeDBOps(newTx);
    });
  } else {
    return await executeDBOps(client);
  }
}

/**
 * Reverses an existing journal entry by producing a balanced opposite mirror entry
 * and tagging the source entry as reversed.
 *
 * @param entryId Unique identifier of the journal entry to be nullified.
 * @param date Execution date of the reversing transaction.
 * @param createdBy Authoring user identifier.
 * @returns The new compensating mirror entry created.
 */
export async function reverseJournalEntry(
  entryId: string,
  date: Date,
  createdBy: string
): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Retrieve the source entry
    const [entry] = await tx
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, entryId))
      .limit(1);

    if (!entry) {
      throw new AppError('Journal entry could not be found.', 404);
    }
    if (entry.isReversed) {
      throw new AppError('This journal entry has already been reversed.', 400);
    }

    // 2. Retrieve corresponding ledger lines
    const lines = await tx
      .select()
      .from(journalLines)
      .where(eq(journalLines.entryId, entryId));

    if (lines.length === 0) {
      throw new AppError('The target journal entry contains no valid transaction lines.', 400);
    }

    // 3. Create counter balance inputs
    const reversedLines: JournalLineInput[] = lines.map((l) => ({
      accountId: l.accountId,
      debit: l.creditAmount, // Debit becomes credit, Credit becomes debit
      credit: l.debitAmount,
      description: l.description ? `Reversal: ${l.description}` : `Reversal of ${entry.entryNumber}`,
      currency: l.currency,
      fxRate: l.fxRate ? Number(l.fxRate) : undefined
    }));

    // 4. Register mirror entry
    const reversalEntry = await createJournalEntry({
      orgId: entry.orgId,
      date,
      description: `Reversal of ${entry.entryNumber} - ${entry.description || ''}`,
      reference: entry.entryNumber,
      source: entry.source,
      sourceId: entry.sourceId || undefined,
      createdBy,
      lines: reversedLines
    }, tx);

    // 5. Mark previous entry as canceled/reversed
    await tx
      .update(journalEntries)
      .set({
        isReversed: true,
        reversedById: createdBy
      })
      .where(eq(journalEntries.id, entry.id));

    return reversalEntry;
  });
}

/**
 * Derives the net accounting balance for a ledger account.
 * Accounts increase on Debit or Credit according to standard accounting equations.
 * (Asset/Expense: Debit - Credit. Liability/Equity/Revenue: Credit - Debit.)
 *
 * @param accountId Unique identifier of the ledger account.
 * @param asOfDate Optional snapshot date constraint.
 * @returns Net balance of the account in Kobo.
 */
export async function getAccountBalance(
  accountId: string,
  asOfDate?: Date,
  currency?: string
): Promise<number> {
  // 1. Resolve account type
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new AppError('The requested account profile could not be found.', 404);
  }

  // 2. Fetch individual journal lines with their currency and fxRate
  const conditions = [eq(journalLines.accountId, accountId)];
  if (asOfDate) {
    conditions.push(lte(journalEntries.date, asOfDate));
  }

  const lines = await db
    .select({
      debitAmount: journalLines.debitAmount,
      creditAmount: journalLines.creditAmount,
      currency: journalLines.currency,
      fxRate: journalLines.fxRate
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(...conditions));

  // 3. Translate each line to base currency (NGN)
  let totalDebits = 0;
  let totalCredits = 0;

  for (const line of lines) {
    const lineCurrency = line.currency || 'NGN';
    const deb = lineCurrency !== 'NGN' ? toNgn(line.debitAmount, line.fxRate) : line.debitAmount;
    const cred = lineCurrency !== 'NGN' ? toNgn(line.creditAmount, line.fxRate) : line.creditAmount;
    totalDebits += Number(deb || 0);
    totalCredits += Number(cred || 0);
  }

  // 4. Compute net balance
  const isDebitRule = account.type === 'asset' || account.type === 'expense';
  const balanceInNgn = isDebitRule ? totalDebits - totalCredits : totalCredits - totalDebits;

  // 5. Convert to target currency if requested
  if (currency && currency.toUpperCase() !== 'NGN') {
    const rate = await getRateForDate(account.orgId, currency, asOfDate || new Date());
    return Math.round(balanceInNgn / rate);
  }

  return balanceInNgn;
}

/**
 * Computes the complete Trial Balance detailing opening, period movement,
 * and closing sections for all registered ledgers under an organization.
 *
 * @param orgId Targeted organization node context.
 * @param startDate Lower bound period date constraint.
 * @param endDate Upper bound period date constraint.
 * @returns List of trial balance rows ordered by account codes.
 */
export async function getTrialBalance(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<TrialBalanceRow[]> {
  // 1. Load active Chart of Accounts sorted by code
  const orgAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.orgId, orgId))
    .orderBy(accounts.code);

  // 2. Query all ledger lines
  const txLines = await db
    .select({
      accountId: journalLines.accountId,
      date: journalEntries.date,
      debitAmount: journalLines.debitAmount,
      creditAmount: journalLines.creditAmount,
      currency: journalLines.currency,
      fxRate: journalLines.fxRate,
      source: journalEntries.source
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(eq(journalEntries.orgId, orgId));

  // 3. Load module balances
  const [faByAccount, bankByAccount, customerBal, vendorBal, invBalance] = await Promise.all([
    db.select({
      accountId: fixedAssets.accountId,
      totalCost: sql<number>`coalesce(sum(${fixedAssets.purchaseCost}), 0)`,
      totalDepr: sql<number>`coalesce(sum(${fixedAssets.accumulatedDepreciation}), 0)`
    }).from(fixedAssets).where(and(eq(fixedAssets.orgId, orgId), eq(fixedAssets.status, 'active'))).groupBy(fixedAssets.accountId),
    db.select({
      accountId: bankAccounts.accountId,
      totalBalance: sql<number>`coalesce(sum(${bankAccounts.currentBalance}), 0)`
    }).from(bankAccounts).where(eq(bankAccounts.orgId, orgId)).groupBy(bankAccounts.accountId),
    db.select({ totalBalance: sql<number>`coalesce(sum(${contacts.balance}), 0)` })
      .from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.type, 'customer'))),
    db.select({ totalBalance: sql<number>`coalesce(sum(${contacts.balance}), 0)` })
      .from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.type, 'vendor'))),
    db.select({
      totalValue: sql<number>`coalesce(sum(${inventoryLots.quantity}::numeric * ${inventoryLots.costPerUnit}), 0)`
    }).from(inventoryLots)
      .where(eq(inventoryLots.orgId, orgId))
  ]);

  const faMap = new Map<string, { totalCost: number; totalDepr: number }>();
  for (const r of faByAccount) faMap.set(r.accountId, r);

  const bankMap = new Map<string, number>();
  for (const r of bankByAccount) bankMap.set(r.accountId, r.totalBalance);

  const customerOB = Number(customerBal[0]?.totalBalance || 0);
  const vendorOB = Number(vendorBal[0]?.totalBalance || 0);
  const inventoryValue = Number(invBalance[0]?.totalValue || 0);

  // Identify single AR, AP, and Inventory accounts
  const arAccount = orgAccounts.find(a => a.systemAccountRole === 'accounts_receivable')
    || orgAccounts.find(a => a.type === 'asset' && (a.name.toLowerCase().includes('receivable') || a.code.startsWith('12')));
  const apAccount = orgAccounts.find(a => a.systemAccountRole === 'accounts_payable')
    || orgAccounts.find(a => a.type === 'liability' && (a.name.toLowerCase().includes('creditor') || a.name.toLowerCase().includes('payable')));
  const invAccount = orgAccounts.find(a => a.code.startsWith('102') && !a.name.toLowerCase().includes('contra'));

  const resultList: TrialBalanceRow[] = [];

  for (const acct of orgAccounts) {
    let openingDebits = 0;
    let openingCredits = 0;
    let periodDebits = 0;
    let periodCredits = 0;

    // Opening balances only apply to balance sheet accounts (asset, liability, equity)
    const acctType = (acct.type || '').toLowerCase();
    const isContraAsset = acctType === 'asset' && (acct.name.toLowerCase().includes('accumulated depreciation') || acct.name.toLowerCase().includes('accumulated amortisation'));
    const isDebitBook = (acctType === 'asset' && !isContraAsset) || acctType === 'expense';

    const matchedLines = txLines.filter(l => l.accountId === acct.id);
    for (const line of matchedLines) {
      const lineDate = new Date(line.date);
      const deb = line.currency && line.currency !== 'NGN' ? toNgn(line.debitAmount, line.fxRate) : line.debitAmount;
      const cred = line.currency && line.currency !== 'NGN' ? toNgn(line.creditAmount, line.fxRate) : line.creditAmount;
      if (lineDate < startDate) { openingDebits += deb; openingCredits += cred; }
      else if (lineDate >= startDate && lineDate <= endDate) { periodDebits += deb; periodCredits += cred; }
    }

    // Incorporate opening balance set via Edit Opening Balances (accounts.opening_balance)
    if (acct.openingBalance !== 0) {
      const ob = acct.openingBalance;
      if (isDebitBook) {
        if (ob > 0) openingDebits += ob;
        else openingCredits += Math.abs(ob);
      } else {
        if (ob > 0) openingCredits += ob;
        else openingDebits += Math.abs(ob);
      }
    }

    // Fixed assets: if this account is linked to fixed assets, force its balance to match
    const faData = faMap.get(acct.id);
    if (faData && acctType === 'asset') {
      const jeBalance = (openingDebits + periodDebits) - (openingCredits + periodCredits);
      const trueBalance = faData.totalCost - faData.totalDepr;
      const diff = trueBalance - jeBalance;
      if (diff > 0) { periodDebits += diff; }
      else if (diff < 0) { periodCredits += Math.abs(diff); }
    }

    // Bank accounts: force balance to currentBalance
    const bankBal = bankMap.get(acct.id);
    if (bankBal !== undefined && acctType === 'asset') {
      const jeBalance = (openingDebits + periodDebits) - (openingCredits + periodCredits);
      const diff = bankBal - jeBalance;
      if (diff > 0) { periodDebits += diff; }
      else if (diff < 0) { periodCredits += Math.abs(diff); }
    }

    // Inventory: force balance to stock valuation
    if (inventoryValue > 0 && invAccount && acct.id === invAccount.id) {
      const jeBalance = (openingDebits + periodDebits) - (openingCredits + periodCredits);
      const diff = inventoryValue - jeBalance;
      if (diff > 0) { periodDebits += diff; }
      else if (diff < 0) { periodCredits += Math.abs(diff); }
    }

    // Customer opening balance → single AR account only
    if (customerOB > 0 && arAccount && acct.id === arAccount.id) {
      openingDebits += customerOB;
    }

    // Vendor opening balance → single AP account only
    if (vendorOB > 0 && apAccount && acct.id === apAccount.id) {
      openingCredits += vendorOB;
    }

    const opened = isDebitBook ? openingDebits - openingCredits : openingCredits - openingDebits;
    const closed = isDebitBook ? (openingDebits + periodDebits) - (openingCredits + periodCredits) : (openingCredits + periodCredits) - (openingDebits + periodDebits);

    resultList.push({
      accountId: acct.id,
      accountCode: acct.code,
      accountName: acct.name,
      accountType: acct.type,
      openingDebit: isDebitBook ? (opened > 0 ? opened : 0) : (opened < 0 ? Math.abs(opened) : 0),
      openingCredit: isDebitBook ? (opened < 0 ? Math.abs(opened) : 0) : (opened > 0 ? opened : 0),
      periodDebit: periodDebits,
      periodCredit: periodCredits,
      closingDebit: isDebitBook ? (closed > 0 ? closed : 0) : (closed < 0 ? Math.abs(closed) : 0),
      closingCredit: isDebitBook ? (closed < 0 ? Math.abs(closed) : 0) : (closed > 0 ? closed : 0),
    });
  }

  // Roll up child balances into parent accounts for hierarchical reporting
  const parentChildren = new Map<string, string[]>();
  const accById = new Map<string, typeof orgAccounts[0]>();
  for (const acct of orgAccounts) {
    accById.set(acct.id, acct);
    if (acct.parentId) {
      if (!parentChildren.has(acct.parentId)) parentChildren.set(acct.parentId, []);
      parentChildren.get(acct.parentId)!.push(acct.id);
    }
  }
  // Add parentId to each row for frontend tree rendering
  for (const row of resultList) {
    const acct = accById.get(row.accountId);
    row.parentId = acct ? acct.parentId || null : null;
  }
  const resultMap = new Map(resultList.map(r => [r.accountId, r]));
  function aggregateParent(accountId: string): { debit: number; credit: number } {
    const row = resultMap.get(accountId);
    let debit = row?.closingDebit || 0;
    let credit = row?.closingCredit || 0;
    const children = parentChildren.get(accountId) || [];
    for (const childId of children) {
      const childAgg = aggregateParent(childId);
      debit += childAgg.debit;
      credit += childAgg.credit;
    }
    if (row) { row.closingDebit = debit; row.closingCredit = credit; }
    return { debit, credit };
  }
  for (const acct of orgAccounts) {
    if (acct.parentId || !parentChildren.has(acct.id)) continue;
    aggregateParent(acct.id);
  }

  // System suspense account absorbs unreconciled sub-ledger vs GL differences
  const totalDr = resultList.reduce((s, r) => s + (parentChildren.has(r.accountId) ? 0 : r.closingDebit), 0);
  const totalCr = resultList.reduce((s, r) => s + (parentChildren.has(r.accountId) ? 0 : r.closingCredit), 0);
  const tbDiff = totalDr - totalCr;
  if (Math.abs(tbDiff) > 1) {
    resultList.push({
      accountId: 'system-suspense',
      accountCode: 'SYS-SUSPENSE',
      accountName: 'System (Unreconciled sub-ledger differences)',
      accountType: 'equity',
      parentId: null,
      openingDebit: 0,
      openingCredit: 0,
      periodDebit: 0,
      periodCredit: 0,
      closingDebit: tbDiff < 0 ? Math.abs(tbDiff) : 0,
      closingCredit: tbDiff > 0 ? tbDiff : 0,
    });
  }

  return resultList;
}

/**
 * Posts opening balances from the accounts table as a formal journal entry
 * so the audit trail is complete and all balance calculations go through
 * journal_lines.
 *
 * @param orgId   Organisation context.
 * @param userId  The user performing the operation.
 * @param asOfDate  The date to assign to the opening balance journal entry.
 * @param tx  Optional Drizzle transaction to run within.
 * @throws AppError 409 if opening balances were already posted.
 */
export async function postOpeningBalances(
  orgId: string,
  userId: string,
  asOfDate: Date,
  tx?: any
): Promise<any> {
  const client = tx || db;

  // Guard: opening balances must only be posted once
  const [existing] = await client
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        eq(journalEntries.source, 'opening_balance')
      )
    )
    .limit(1);

  if (existing) {
    throw new AppError('Opening balances already posted.', 409);
  }

  // Fetch all accounts with a non-zero opening balance
  const accountsWithOB = await client
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        sql`${accounts.openingBalance} > 0`
      )
    );

  if (accountsWithOB.length === 0) {
    return { message: 'No opening balances to post.', entriesPosted: 0 };
  }

  // Build journal lines
  const journalLinesPayload: any[] = [];
  const updatedAccountIds: string[] = [];

  for (const acct of accountsWithOB) {
    const ob = acct.openingBalance;
    if (ob <= 0) continue;

    updatedAccountIds.push(acct.id);

    const isContraAsset =
      acct.type === 'asset' &&
      (acct.name.toLowerCase().includes('accumulated depreciation') ||
       acct.name.toLowerCase().includes('allowance'));

    if (acct.type === 'asset' || acct.type === 'expense') {
      if (isContraAsset) {
        journalLinesPayload.push({ accountId: acct.id, credit: ob });
      } else {
        journalLinesPayload.push({ accountId: acct.id, debit: ob });
      }
    } else {
      // liability, equity, revenue
      journalLinesPayload.push({ accountId: acct.id, credit: ob });
    }
  }

  // Balance the entry with Retained Earnings if needed
  let totalDebits = 0;
  let totalCredits = 0;
  for (const line of journalLinesPayload) {
    totalDebits += line.debit || 0;
    totalCredits += line.credit || 0;
  }

  if (totalDebits !== totalCredits) {
    const diff = totalDebits - totalCredits;

    const [reAccount] = await client
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.orgId, orgId),
          eq(accounts.systemAccountRole, 'retained_earnings')
        )
      )
      .limit(1);

    if (!reAccount) {
      throw new AppError(
        'Retained Earnings account not found. Cannot balance opening entries.',
        400
      );
    }

    if (diff > 0) {
      journalLinesPayload.push({ accountId: reAccount.id, credit: diff });
    } else {
      journalLinesPayload.push({ accountId: reAccount.id, debit: Math.abs(diff) });
    }
  }

  // Create the journal entry inside the same transaction context
  const journalEntry = await createJournalEntry({
    orgId,
    date: asOfDate,
    description: 'Opening balances posted',
    reference: 'OPENING-BAL',
    source: 'opening_balance',
    createdBy: userId,
    lines: journalLinesPayload
  }, client);

  // Clear opening balances on accounts that were posted
  for (const accountId of updatedAccountIds) {
    await client
      .update(accounts)
      .set({ openingBalance: 0 })
      .where(eq(accounts.id, accountId));
  }

  return {
    message: 'Opening balances posted successfully.',
    entriesPosted: journalLinesPayload.length,
    journalEntryId: journalEntry.id
  };
}

/**
 * Internal helper that computes the core P&L statement for a given period.
 */
async function computePnL(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<any> {
  const orgAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.orgId, orgId));

  const records = await db
    .select({
      accountId: journalLines.accountId,
      debitAmount: journalLines.debitAmount,
      creditAmount: journalLines.creditAmount,
      currency: journalLines.currency,
      fxRate: journalLines.fxRate
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        gte(journalEntries.date, startDate),
        lte(journalEntries.date, endDate)
      )
    );

  const operatingRevenue: any[] = [];
  const otherOperatingIncome: any[] = [];
  const financeIncome: any[] = [];
  const costOfSales: any[] = [];
  const staffCosts: any[] = [];
  const administrative: any[] = [];
  const sellingDistribution: any[] = [];
  const otherOperating: any[] = [];
  const financeCosts: any[] = [];
  const taxExpense: any[] = [];

  let totalOperatingRevenue = 0;
  let totalOtherOperatingIncome = 0;
  let totalFinanceIncome = 0;
  let totalCostOfSales = 0;
  let totalStaffCosts = 0;
  let totalAdministrative = 0;
  let totalSellingDistribution = 0;
  let totalOtherOperatingExpenses = 0;
  let totalFinanceCosts = 0;
  let totalTaxExpense = 0;

  for (const acct of orgAccounts) {
    const matchedLines = records.filter((r) => r.accountId === acct.id);
    const drSum = matchedLines.reduce((sum, curr) => sum + (curr.currency && curr.currency !== 'NGN' ? toNgn(curr.debitAmount, curr.fxRate) : curr.debitAmount), 0);
    const crSum = matchedLines.reduce((sum, curr) => sum + (curr.currency && curr.currency !== 'NGN' ? toNgn(curr.creditAmount, curr.fxRate) : curr.creditAmount), 0);

    if (acct.type === 'revenue') {
      const balance = crSum - drSum;
      const code = parseInt(acct.code, 10);
      const item = { accountId: acct.id, code: acct.code, name: acct.name, balance };

      // 600000–600899: Core operating revenue
      if (code >= 600000 && code <= 600899) {
        operatingRevenue.push(item);
        totalOperatingRevenue += balance;
      } else if (code >= 601000 && code <= 601899) {
        otherOperatingIncome.push(item);
        totalOtherOperatingIncome += balance;
      } else if (code >= 900000 && code <= 900999) {
        financeIncome.push(item);
        totalFinanceIncome += balance;
      } else {
        operatingRevenue.push(item);
        totalOperatingRevenue += balance;
      }
    } else if (acct.type === 'expense') {
      const balance = drSum - crSum;
      const st = (acct.subType || '').toLowerCase().replace(/\s+/g, '_');
      let name = acct.name;
      if (acct.code === '700100') name = 'Cost of Inventory Sold';
      const item = { accountId: acct.id, code: acct.code, name, balance };

      if (st === 'cost_of_sales') {
        costOfSales.push(item);
        totalCostOfSales += balance;
      } else if (st === 'staff_costs') {
        staffCosts.push(item);
        totalStaffCosts += balance;
      } else if (st === 'administrative') {
        administrative.push(item);
        totalAdministrative += balance;
      } else if (st === 'selling_distribution') {
        sellingDistribution.push(item);
        totalSellingDistribution += balance;
      } else if (st === 'other_operating') {
        otherOperating.push(item);
        totalOtherOperatingExpenses += balance;
      } else if (st === 'finance_costs') {
        financeCosts.push(item);
        totalFinanceCosts += balance;
      } else if (st === 'tax_expense') {
        taxExpense.push(item);
        totalTaxExpense += balance;
      } else {
        otherOperating.push(item);
        totalOtherOperatingExpenses += balance;
      }
    }
  }

  const totalRevenue = totalOperatingRevenue + totalOtherOperatingIncome;
  const grossProfit = totalRevenue - totalCostOfSales;
  const totalOperatingExpenses = totalSellingDistribution + totalAdministrative + totalStaffCosts + totalOtherOperatingExpenses;
  const operatingProfit = grossProfit - totalOperatingExpenses;
  const profitBeforeTax = operatingProfit + totalFinanceIncome - totalFinanceCosts;
  const netProfit = profitBeforeTax - totalTaxExpense;
  const effectiveTaxRate = profitBeforeTax > 0 ? Math.round((totalTaxExpense / profitBeforeTax) * 1000) / 10 : 0;

  return {
    operatingRevenue: { accounts: operatingRevenue, total: totalOperatingRevenue },
    otherOperatingIncome: { accounts: otherOperatingIncome, total: totalOtherOperatingIncome },
    totalRevenue,
    costOfSales: { accounts: costOfSales, total: totalCostOfSales },
    grossProfit,
    staffCosts: { accounts: staffCosts, total: totalStaffCosts },
    administrative: { accounts: administrative, total: totalAdministrative },
    sellingDistribution: { accounts: sellingDistribution, total: totalSellingDistribution },
    otherOperatingExpenses: { accounts: otherOperating, total: totalOtherOperatingExpenses },
    totalOperatingExpenses,
    operatingProfit,
    financeIncome: { accounts: financeIncome, total: totalFinanceIncome },
    financeCosts: { accounts: financeCosts, total: totalFinanceCosts },
    profitBeforeTax,
    incomeTaxExpense: { accounts: taxExpense, total: totalTaxExpense },
    netProfit,
    effectiveTaxRate
  };
}

/**
 * Formats a categorized comparative Profit & Loss statement.
 *
 * @param orgId Targeted organization node context.
 * @param startDate Lower bound period date limit.
 * @param endDate Upper bound period date limit.
 * @param compareStartDate Optional prior period start date.
 * @param compareEndDate Optional prior period end date.
 * @returns Comparative P&L with current, prior (optional), and variance.
 */
export async function getProfitAndLoss(
  orgId: string,
  startDate: Date,
  endDate: Date,
  compareStartDate?: Date,
  compareEndDate?: Date
): Promise<any> {
  const current = await computePnL(orgId, startDate, endDate);

  if (compareStartDate && compareEndDate) {
    const prior = await computePnL(orgId, compareStartDate, compareEndDate);
    const amount = current.netProfit - prior.netProfit;
    const percent = prior.netProfit !== 0 ? amount / prior.netProfit : 0;
    return { current, prior, variance: { amount, percent } };
  }

  return { current, prior: null, variance: null };
}

/**
 * Formats a Snapshot Balance Sheet as of a specified date.
 * Strictly verifies the primary Accounting Equation: Assets === Liabilities + Equity.
 * (Accrues period margins up to snapshot date dynamically as system Retained Earnings.)
 *
 * @param orgId Targeted organization context.
 * @param asOfDate Snapshot date limit.
 * @returns Integrated snapshot of accounting balances.
 */
interface BalItem { accountId: string; code: string; name: string; balance: number; reclassified?: string; isContra?: boolean; }

function stKey(subType: string | null): string {
  return (subType || '').toLowerCase().replace(/\s+/g, '_');
}

export async function getBalanceSheet(
  orgId: string,
  asOfDate: Date,
  compareAsOfDate?: Date
): Promise<any> {
  const orgAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.orgId, orgId));

  const records = await db
    .select({
      accountId: journalLines.accountId,
      debitAmount: journalLines.debitAmount,
      creditAmount: journalLines.creditAmount,
      currency: journalLines.currency,
      fxRate: journalLines.fxRate
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        lte(journalEntries.date, asOfDate)
      )
    );

  // First pass: compute net balance per account (dr-cr for assets, cr-dr for liabilities/equity)
  const allItems: BalItem[] = [];
  let cumulativeNetIncome = 0;
  const codePrefix = (code: string, len: number) => code.substring(0, len);

  for (const acct of orgAccounts) {
    const matched = records.filter((r) => r.accountId === acct.id);
    const dr = matched.reduce((sum, curr) => sum + (curr.currency && curr.currency !== 'NGN' ? toNgn(curr.debitAmount, curr.fxRate) : curr.debitAmount), 0);
    const cr = matched.reduce((sum, curr) => sum + (curr.currency && curr.currency !== 'NGN' ? toNgn(curr.creditAmount, curr.fxRate) : curr.creditAmount), 0);

    if (acct.type === 'asset') {
      allItems.push({ accountId: acct.id, code: acct.code, name: acct.name, balance: dr - cr });
    } else if (acct.type === 'liability') {
      allItems.push({ accountId: acct.id, code: acct.code, name: acct.name, balance: cr - dr });
    } else if (acct.type === 'equity') {
      allItems.push({ accountId: acct.id, code: acct.code, name: acct.name, balance: cr - dr });
    } else if (acct.type === 'revenue') {
      cumulativeNetIncome += (cr - dr);
    } else if (acct.type === 'expense') {
      cumulativeNetIncome -= (dr - cr);
    }
  }

  // Identify contra-asset accounts (accumulated depreciation/amortisation)
  const contraCodes = new Set<string>();
  const isContra = (item: BalItem) =>
    item.name.toLowerCase().includes('accumulated depreciation') ||
    item.name.toLowerCase().includes('accumulated amortisation') ||
    item.name.toLowerCase().includes('allowance for impairment') ||
    item.name.toLowerCase().includes('inventory write-down') ||
    item.code === '101200' || item.code === '102600' ||
    item.code.startsWith('2011') || (item.code.startsWith('2012') && item.code.endsWith('01')) ||
    item.code === '202500';

  // Separate contra-assets and normal items
  const contraItems: BalItem[] = [];
  const normalItems: BalItem[] = [];
  for (const item of allItems) {
    if (isContra(item)) {
      contraItems.push(item);
      contraCodes.add(item.code);
    } else {
      normalItems.push(item);
    }
  }

  // Apply reclassification rules
  const reclassified: any[] = [];
  const finalItems: BalItem[] = [];

  for (const item of normalItems) {
    const c = item.code;
    // Bank accounts (100200-100500) with negative balance → Bank Overdraft
    if ((c.startsWith('1002') || c.startsWith('1003') || c.startsWith('1004') || c.startsWith('1005') || c.startsWith('1001')) && item.balance < 0) {
      reclassified.push({ from: item.name, fromSection: 'currentAssets', toSection: 'currentLiabilities', reason: 'negative bank balance' });
      finalItems.push({ ...item, name: `Bank Overdraft – ${item.name}`, balance: -item.balance, reclassified: 'overdraft' });
      continue;
    }
    // Payable accounts with negative balance (net debit) → Overpayment Receivable
    if ((c.startsWith('300') || c.startsWith('301') || c.startsWith('302')) && item.balance < 0) {
      reclassified.push({ from: item.name, fromSection: 'currentLiabilities', toSection: 'currentAssets', reason: 'debit balance payable' });
      finalItems.push({ ...item, name: `Overpayment Receivable – ${item.name}`, balance: -item.balance, reclassified: 'overpayment' });
      continue;
    }
    // Inventory sub-accounts (102xxx) with negative balance → zero at individual level, warn at parent
    if (c.startsWith('102') && c !== '102000' && item.balance < 0) {
      finalItems.push({ ...item, balance: 0, reclassified: 'negative-inventory-zeroed' });
      continue;
    }
    finalItems.push(item);
  }

  // Group by section using code prefix ranges
  function sectionGroup(code: string): string {
    const p3 = codePrefix(code, 3);
    const p2 = codePrefix(code, 2);
    if (p2 === '10' || p2 === '11') return 'currentAssets';
    if (p2 === '20' || p2 === '21') return 'nonCurrentAssets';
    if (p2 === '30' || p2 === '31' || p2 === '32') return 'currentLiabilities';
    if (p2 === '40' || p2 === '41' || p2 === '42') return 'nonCurrentLiabilities';
    if (p2 === '50' || p2 === '51') return 'equity';
    if (p2 === '90' || p2 === '91') return 'nonCurrentAssets'; // finance income/costs → assets if debit
    return 'other';
  }

  // Sub-group within sections
  function subGroup(item: BalItem): string {
    const c = item.code;
    if (c.startsWith('100')) return 'cashAndEquivalents';
    if (c.startsWith('101')) return 'tradeReceivables';
    if (c.startsWith('102')) return 'inventories';
    if (c.startsWith('103')) return 'financialAssets';
    if (c.startsWith('104')) return 'otherCurrent';
    if (c.startsWith('200') || c.startsWith('2010') || c.startsWith('2011') || c.startsWith('2012')) return 'ppe';
    if (c.startsWith('202')) return 'intangibles';
    if (c.startsWith('203')) return 'investmentProperty';
    if (c.startsWith('204')) return 'longTermInvestments';
    if (c.startsWith('205')) return 'deferredTax';
    if (c.startsWith('206')) return 'otherNonCurrent';
    if (c.startsWith('300') || c.startsWith('304') || c.startsWith('305')) return 'tradePayables';
    if (c.startsWith('301')) return 'taxLiabilities';
    if (c.startsWith('302')) return 'borrowings';
    if (c.startsWith('303')) return 'currentDebt';
    if (c.startsWith('400') || c.startsWith('401')) return 'longTermBorrowings';
    if (c.startsWith('402')) return 'deferredTaxLiability';
    if (c.startsWith('403')) return 'employeeBenefits';
    if (c.startsWith('404')) return 'provisions';
    if (c.startsWith('405')) return 'deferredRevenue';
    if (c.startsWith('500')) return 'shareCapital';
    if (c.startsWith('501')) return 'sharePremium';
    if (c.startsWith('502')) return 'retainedEarnings';
    if (c.startsWith('503')) return 'otherReserves';
    if (c.startsWith('504')) return 'nonControllingInterest';
    if (c.startsWith('505')) return 'generalReserve';
    return 'other';
  }

  // Build grouped structure
  function buildGrouped(source: BalItem[]) {
    const groups: Record<string, BalItem[]> = {
      cashAndEquivalents: [], tradeReceivables: [], inventories: [], financialAssets: [], otherCurrent: [],
      ppe: [], intangibles: [], investmentProperty: [], longTermInvestments: [], deferredTax: [], otherNonCurrent: [],
      tradePayables: [], taxLiabilities: [], borrowings: [], currentDebt: [],
      longTermBorrowings: [], deferredTaxLiability: [], employeeBenefits: [], provisions: [], deferredRevenue: [],
      shareCapital: [], sharePremium: [], retainedEarnings: [], otherReserves: [], nonControllingInterest: [], generalReserve: [],
      other: []
    };
    for (const item of source) {
      const sg = subGroup(item);
      if (groups[sg]) groups[sg].push(item);
      else groups.other.push(item);
    }
    return groups;
  }

  const grouped = buildGrouped(finalItems);

  // Compute totals per section
  function sum(arr: BalItem[]) { return arr.reduce((s, i) => s + i.balance, 0); }

  // Contra-asset netting: net accumulated depreciation against PP&E
  // Determine net PP&E value
  const ppeNetItems: BalItem[] = [];
  const ppeCostItems = grouped.ppe;
  const ppeContraItems = contraItems.filter(i => i.code.startsWith('200') || i.code.startsWith('2010'));
  const ppeCost = sum(ppeCostItems);
  const ppeDep = sum(ppeContraItems);
  const ppeNet = ppeCost - ppeDep;

  // ROU netting
  const rouCostItems = grouped.ppe.filter(i => i.code.startsWith('2011') || i.code.startsWith('2012'));
  const rouContraItems = contraItems.filter(i => i.code.startsWith('2011') && i.code.endsWith('01'));
  const rouCost = sum(rouCostItems);
  const rouDep = sum(rouContraItems);
  const rouNet = rouCost - rouDep;

  // Intangible netting
  const intangCostItems = grouped.intangibles;
  const intangContraItems = contraItems.filter(i => i.code === '202500');
  const intangCost = sum(intangCostItems);
  const intangAmort = sum(intangContraItems);
  const intangNet = intangCost - intangAmort;

  // Current assets total (with reclassified overpayments added to tradeReceivables)
  const curAssets = [
    { key: 'cashAndEquivalents', label: 'Cash and Cash Equivalents', items: grouped.cashAndEquivalents, total: sum(grouped.cashAndEquivalents) },
    { key: 'tradeReceivables', label: 'Trade & Other Receivables', items: grouped.tradeReceivables, total: sum(grouped.tradeReceivables) },
    { key: 'inventories', label: 'Inventories', items: grouped.inventories, total: sum(grouped.inventories) },
    { key: 'financialAssets', label: 'Financial Assets – Current', items: grouped.financialAssets, total: sum(grouped.financialAssets) },
    { key: 'otherCurrent', label: 'Other Current Assets', items: grouped.otherCurrent, total: sum(grouped.otherCurrent) },
  ];
  const totalCurrentAssets = curAssets.reduce((s, g) => s + g.total, 0);

  // Non-current assets
  const nonCurAssets = [
    { key: 'ppe', label: 'Property, Plant & Equipment', items: ppeCostItems, total: ppeCost, contraItems: ppeContraItems, contraTotal: ppeDep, netTotal: ppeNet },
    { key: 'rou', label: 'Right-of-Use Assets', items: rouCostItems, total: rouCost, contraItems: rouContraItems, contraTotal: rouDep, netTotal: rouNet },
    { key: 'intangibles', label: 'Intangible Assets', items: intangCostItems, total: intangCost, contraItems: intangContraItems, contraTotal: intangAmort, netTotal: intangNet },
    { key: 'investmentProperty', label: 'Investment Property', items: grouped.investmentProperty, total: sum(grouped.investmentProperty) },
    { key: 'longTermInvestments', label: 'Long-term Investments', items: grouped.longTermInvestments, total: sum(grouped.longTermInvestments) },
    { key: 'deferredTax', label: 'Deferred Tax Asset', items: grouped.deferredTax, total: sum(grouped.deferredTax) },
    { key: 'otherNonCurrent', label: 'Other Non-current Assets', items: grouped.otherNonCurrent, total: sum(grouped.otherNonCurrent) },
  ];
  const otherItemsAsset = contraItems.filter(i => !ppeContraItems.includes(i) && !rouContraItems.includes(i) && !intangContraItems.includes(i)).reduce((s, i) => s + i.balance, 0);
  const totalNonCurrentAssets = nonCurAssets.reduce((s, g) => s + (g.netTotal != null ? g.netTotal : g.total), 0) + (otherItemsAsset > 0 ? otherItemsAsset : 0);
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

  // Current liabilities (with reclassified overdrafts added to tradePayables)
  // Move reclassified overdraft items to borrowings sub-section
  const overdraftItems = finalItems.filter(i => i.reclassified === 'overdraft');
  const curLiabilities = [
    { key: 'tradePayables', label: 'Trade & Other Payables', items: [...grouped.tradePayables, ...overdraftItems], total: sum(grouped.tradePayables) + sum(overdraftItems) },
    { key: 'taxLiabilities', label: 'Tax Liabilities', items: grouped.taxLiabilities, total: sum(grouped.taxLiabilities) },
    { key: 'borrowings', label: 'Short-term Borrowings', items: grouped.borrowings, total: sum(grouped.borrowings) },
    { key: 'currentDebt', label: 'Current Portion of Long-term Debt', items: grouped.currentDebt, total: sum(grouped.currentDebt) },
  ];
  const totalCurrentLiabilities = curLiabilities.reduce((s, g) => s + g.total, 0);

  // Non-current liabilities
  const nonCurLiabilities = [
    { key: 'longTermBorrowings', label: 'Long-term Borrowings', items: grouped.longTermBorrowings, total: sum(grouped.longTermBorrowings) },
    { key: 'deferredTaxLiability', label: 'Deferred Tax Liability', items: grouped.deferredTaxLiability, total: sum(grouped.deferredTaxLiability) },
    { key: 'employeeBenefits', label: 'Employee Benefit Obligations', items: grouped.employeeBenefits, total: sum(grouped.employeeBenefits) },
    { key: 'provisions', label: 'Provisions & Contingent Liabilities', items: grouped.provisions, total: sum(grouped.provisions) },
    { key: 'deferredRevenue', label: 'Deferred Revenue – Non-current', items: grouped.deferredRevenue, total: sum(grouped.deferredRevenue) },
  ];
  const totalNonCurrentLiabilities = nonCurLiabilities.reduce((s, g) => s + g.total, 0);
  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

  // Equity: build proper waterfall
  // Retained earnings: opening balance from equity accounts with code 502xxx (502000, 502100)
  const reAccounts = grouped.retainedEarnings;
  const openingReItems = reAccounts.filter(i => i.code === '502000' || i.code === '502100');
  const dividendItems = reAccounts.filter(i => i.code === '502300');
  const otherRE = reAccounts.filter(i => i.code !== '502000' && i.code !== '502100' && i.code !== '502300');
  const openingReTotal = sum(openingReItems);
  const dividendTotal = sum(dividendItems);
  const otherRETotal = sum(otherRE);

  // Profit for period from income statement
  const profitForPeriod = cumulativeNetIncome;

  // Total retained earnings
  const totalRetainedEarnings = openingReTotal + profitForPeriod + dividendTotal + otherRETotal;

  const equitySections = [
    { key: 'shareCapital', label: 'Share Capital', items: grouped.shareCapital, total: sum(grouped.shareCapital) },
    { key: 'sharePremium', label: 'Share Premium', items: grouped.sharePremium, total: sum(grouped.sharePremium) },
    { key: 'retainedEarnings', label: 'Retained Earnings', items: [
      { accountId: 're-opening', code: '502000', name: 'Retained Earnings – Opening Balance', balance: openingReTotal },
      { accountId: 're-profit-period', code: '502200', name: 'Profit / (Loss) for the Period', balance: profitForPeriod },
      ...(dividendTotal !== 0 ? [{ accountId: 're-dividends', code: '502300', name: 'Less: Dividends Declared', balance: dividendTotal }] : []),
      ...(otherRETotal !== 0 ? [{ accountId: 're-other', code: '502400', name: 'Other Retained Earnings', balance: otherRETotal }] : []),
    ], total: totalRetainedEarnings },
    { key: 'otherReserves', label: 'Other Reserves', items: grouped.otherReserves, total: sum(grouped.otherReserves) },
    { key: 'nonControllingInterest', label: 'Non-controlling Interest', items: grouped.nonControllingInterest, total: sum(grouped.nonControllingInterest) },
    { key: 'generalReserve', label: 'General Reserve', items: grouped.generalReserve, total: sum(grouped.generalReserve) },
  ];
  const totalEquity = equitySections.reduce((s, g) => s + g.total, 0);
  const liabilitiesAndEquity = totalLiabilities + totalEquity;
  const outOfBalance = totalAssets - liabilitiesAndEquity;

  const result = {
    currentAssets: { subSections: curAssets, total: totalCurrentAssets },
    nonCurrentAssets: { subSections: nonCurAssets, total: totalNonCurrentAssets },
    totalAssets,
    currentLiabilities: { subSections: curLiabilities, total: totalCurrentLiabilities },
    nonCurrentLiabilities: { subSections: nonCurLiabilities, total: totalNonCurrentLiabilities },
    totalLiabilities,
    equity: { subSections: equitySections, total: totalEquity },
    totalEquity,
    liabilitiesAndEquity,
    outOfBalance,
    reclassified,
  };

  if (compareAsOfDate) {
    const prior = await getBalanceSheet(orgId, compareAsOfDate);
    return { current: result, prior };
  }

  return result;
}

/**
 * Resolves a dynamic Indirect Cash Flow Statement tracking Cash Movements.
 * Groups performance into Operating, Investing, and Financing flows.
 *
 * @param orgId Targeted organization context.
 * @param startDate Lower bound period date limits.
 * @param endDate Upper bound period date limits.
 * @returns Structured statement of cash flows.
 */
export async function getCashFlowStatement(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<any> {
  const orgAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.orgId, orgId));

  const accountById = new Map(orgAccounts.map((a: any) => [a.id, a]));

  // ── Helper: exclude contra accounts ──
  function isContra(a: any): boolean {
    const name = (a.name || '').toLowerCase();
    if (name.includes('accumulated depreciation') || name.includes('accumulated amortisation') || name.includes('allowance for')) return true;
    const c = a.code || '';
    if (c >= '201101' && c <= '202599') return true;
    return false;
  }

  function isCashCode(code: string): boolean {
    const c = parseInt(code, 10);
    return c >= 100000 && c <= 100999;
  }

  function isPpeCode(code: string): boolean {
    const c = parseInt(code, 10);
    return (c >= 200000 && c <= 201999) || (c >= 202000 && c <= 204999);
  }

  function isInvestingCode(code: string): boolean {
    const c = parseInt(code, 10);
    return c >= 200000 && c <= 204999;
  }

  function isFinancingLiabilityCode(code: string): boolean {
    const c = parseInt(code, 10);
    return (c >= 302000 && c <= 302999) || (c >= 400000 && c <= 401999) || c === 304000 || c === 305000;
  }

  function isEquityCode(code: string): boolean {
    const c = parseInt(code, 10);
    return c >= 500000 && c <= 505999;
  }

  function isTaxCode(code: string): boolean {
    const c = parseInt(code, 10);
    return c >= 950000 && c <= 950999;
  }

  function isFinanceIncomeCode(code: string): boolean {
    const c = parseInt(code, 10);
    return c >= 900000 && c <= 900999;
  }

  function isFinanceCostCode(code: string): boolean {
    const c = parseInt(code, 10);
    return c >= 910000 && c <= 910999;
  }

  function isDepreciationCode(code: string): boolean {
    const c = parseInt(code, 10);
    return c === 810700 || c === 810800 || c === 810900;
  }

  function isImpairmentCode(code: string): boolean {
    const c = parseInt(code, 10);
    return c === 830000 || c === 830100;
  }

  function isDisposalLossCode(code: string): boolean {
    const c = parseInt(code, 10);
    return c === 830600;
  }

  function isDisposalProfitCode(code: string): boolean {
    const c = parseInt(code, 10);
    return c === 601400;
  }

  function isFxLossCode(code: string): boolean {
    const c = parseInt(code, 10);
    return c === 830300;
  }

  function isFxGainCode(code: string): boolean {
    const c = parseInt(code, 10);
    return c === 601800 || c === 900400;
  }

  // ── Working capital account definitions ──
  const wcAssetAccounts = [
    { codes: ['101000','101100'], label: '(Increase)/Decrease in Trade Receivables' },
    { codes: ['101500'], label: '(Increase)/Decrease in WHT Receivable' },
    { codes: ['101600'], label: '(Increase)/Decrease in VAT Receivable' },
    { codes: ['101300'], label: '(Increase)/Decrease in Staff Advances' },
    { codes: ['101700'], label: '(Increase)/Decrease in Prepayments' },
    { codes: ['101800'], label: '(Increase)/Decrease in Other Receivables' },
    { codes: ['102000','102100','102200','102300','102400','102500','102600'], label: '(Increase)/Decrease in Inventories' },
    { codes: ['104000','104100','104200'], label: '(Increase)/Decrease in Other Current Assets' },
  ];
  const wcLiabilityAccounts = [
    { codes: ['300100'], label: 'Increase/(Decrease) in Trade Creditors' },
    { codes: ['300200'], label: 'Increase/(Decrease) in Accrued Expenses' },
    { codes: ['300300'], label: 'Increase/(Decrease) in Other Payables' },
    { codes: ['301300'], label: 'Increase/(Decrease) in VAT Payable' },
    { codes: ['301400'], label: 'Increase/(Decrease) in WHT Payable' },
    { codes: ['301501'], label: 'Increase/(Decrease) in PAYE Payable' },
    { codes: ['301600'], label: 'Increase/(Decrease) in Pension Contribution Payable' },
    { codes: ['301800'], label: 'Increase/(Decrease) in NHF Contribution Payable' },
    { codes: ['301700'], label: 'Increase/(Decrease) in NSITF Contribution Payable' },
    { codes: ['302000','302100','302200','302300'], label: 'Increase/(Decrease) in Short-term Borrowings' },
  ];

  // ── Fetch all journal lines for the period, grouped by entry ──
  const rawLines = await db
    .select({
      entryId: journalLines.entryId,
      accountId: journalLines.accountId,
      debitAmount: journalLines.debitAmount,
      creditAmount: journalLines.creditAmount,
      currency: journalLines.currency,
      fxRate: journalLines.fxRate,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        gte(journalEntries.date, startDate),
        lte(journalEntries.date, endDate)
      )
    );
    
  // Group lines by entry for cash-matching
  const linesByEntry = new Map<string, typeof rawLines>();
  for (const line of rawLines) {
    if (!linesByEntry.has(line.entryId)) linesByEntry.set(line.entryId, []);
    linesByEntry.get(line.entryId)!.push(line);
  }

  // Compute net movement per account (dr - cr for all accounts, positive = debit-heavy)
  const netByAccount = new Map<string, number>();
  for (const line of rawLines) {
    const fxRateVal = line.fxRate ? Number(line.fxRate) : 1;
    const dr = line.currency && line.currency !== 'NGN' ? toNgn(line.debitAmount, fxRateVal) : line.debitAmount;
    const cr = line.currency && line.currency !== 'NGN' ? toNgn(line.creditAmount, fxRateVal) : line.creditAmount;
    netByAccount.set(line.accountId, (netByAccount.get(line.accountId) || 0) + dr - cr);
  }

  // ── 1. Net Profit ──
  const incomeStmt = await computePnL(orgId, startDate, endDate);
  const netProfitVal = incomeStmt.netProfit || 0;

  // ── 2. Non-cash adjustments ──
  const adjustments: { name: string; amount: number }[] = [];
  let adjustmentsTotal = 0;

  // Depreciation
  let depAmount = 0;
  for (const a of orgAccounts) {
    if (isDepreciationCode(a.code)) {
      const net = netByAccount.get(a.id) || 0;
      if (Math.abs(net) > 0) depAmount += net;
    }
  }
  if (Math.abs(depAmount) > 0) {
    adjustments.push({ name: 'Depreciation – PP&E', amount: depAmount });
    adjustmentsTotal += depAmount;
  }

  // Other non-cash
  const nonCashChecks = [
    { codes: ['830000','830100'], label: 'Impairment Losses' },
    { codes: ['830600'], label: 'Loss on Disposal of Assets' },
    { codes: ['601400'], label: '(Profit) on Disposal of Assets' },
  ];
  for (const chk of nonCashChecks) {
    let total = 0;
    for (const a of orgAccounts) {
      if (chk.codes.includes(a.code)) {
        total += netByAccount.get(a.id) || 0;
      }
    }
    if (Math.abs(total) > 0) {
      adjustments.push({ name: chk.label, amount: -total });
      adjustmentsTotal += -total;
    }
  }

  // FX Gains/Losses net
  let fxLoss = 0, fxGain = 0;
  for (const a of orgAccounts) {
    if (isFxLossCode(a.code)) fxLoss += netByAccount.get(a.id) || 0;
    if (isFxGainCode(a.code)) fxGain += netByAccount.get(a.id) || 0;
  }
  const fxNet = fxLoss - fxGain;
  if (Math.abs(fxNet) > 0) {
    adjustments.push({ name: 'Foreign Exchange (Gains)/Losses – net', amount: fxNet });
    adjustmentsTotal += fxNet;
  }

  // ── 3. Working Capital Changes ──
  // Use getAccountBalance for accurate opening/closing
  const wcItems: { name: string; amount: number }[] = [];
  let workingCapitalTotal = 0;

  async function changeForAccounts(codes: string[], isAsset: boolean): Promise<number> {
    let openingTotal = 0, closingTotal = 0;
    for (const a of orgAccounts) {
      if (codes.includes(a.code)) {
        const opening = await getAccountBalance(a.id, new Date(startDate.getTime() - 1));
        const closing = await getAccountBalance(a.id, endDate);
        openingTotal += opening;
        closingTotal += closing;
      }
    }
    // For assets: increase = cash outflow (negative); for liabilities: increase = cash inflow (positive)
    if (isAsset) return openingTotal - closingTotal;
    return closingTotal - openingTotal;
  }

  for (const wc of wcAssetAccounts) {
    const change = await changeForAccounts(wc.codes, true);
    if (Math.abs(change) > 0) {
      wcItems.push({ name: wc.label, amount: change });
      workingCapitalTotal += change;
    }
  }
  for (const wc of wcLiabilityAccounts) {
    const change = await changeForAccounts(wc.codes, false);
    if (Math.abs(change) > 0) {
      wcItems.push({ name: wc.label, amount: change });
      workingCapitalTotal += change;
    }
  }

  const cashGeneratedFromOperations = netProfitVal + adjustmentsTotal + workingCapitalTotal;

  // ── 4. Cash flows from investing (match entries with both investment and cash accounts) ──
  const investingItems: { name: string; amount: number }[] = [];
  let investingTotal = 0;

  // Track PP&E purchases and disposals via journal-entry-level matching
  for (const [entryId, lines] of linesByEntry) {
    const cashLine = lines.find(l => {
      const a = accountById.get(l.accountId);
      return a && isCashCode(a.code);
    });
    const investLine = lines.find(l => {
      const a = accountById.get(l.accountId);
      return a && isInvestingCode(a.code) && !isContra(a);
    });
    if (cashLine && investLine) {
      const fxRateVal = investLine.fxRate ? Number(investLine.fxRate) : 1;
      let investAmt = 0;
      if (investLine.currency && investLine.currency !== 'NGN') {
        investAmt = toNgn(investLine.debitAmount - investLine.creditAmount, fxRateVal);
      } else {
        investAmt = (investLine.debitAmount || 0) - (investLine.creditAmount || 0);
      }
      if (investAmt !== 0) {
        const a = accountById.get(investLine.accountId)!;
        const codeNum = parseInt(a.code, 10);
        let label: string;
        if (codeNum >= 200000 && codeNum <= 201999) {
          label = investAmt > 0 ? 'Purchase of Property, Plant & Equipment' : 'Proceeds from Disposal of PP&E';
        } else if (codeNum >= 202000 && codeNum <= 202499) {
          label = investAmt > 0 ? 'Purchase of Intangible Assets' : 'Proceeds from Sale of Intangibles';
        } else if (codeNum >= 204000 && codeNum <= 204999) {
          label = investAmt > 0 ? 'Purchase of Long-term Investments' : 'Proceeds from Sale of Investments';
        } else {
          label = 'Other Investing Activity';
        }
        // Debit to asset = purchase (cash outflow = negative)
        const cashEffect = -investAmt;
        investingItems.push({ name: label, amount: cashEffect });
        investingTotal += cashEffect;
      }
    }
  }

  // ── 5. Cash flows from financing (match entries with financing liability/equity and cash) ──
  const financingItems: { name: string; amount: number }[] = [];
  let financingTotal = 0;

  for (const [entryId, lines] of linesByEntry) {
    const cashLine = lines.find(l => {
      const a = accountById.get(l.accountId);
      return a && isCashCode(a.code);
    });
    if (!cashLine) continue;

    // Borrowings
    const borrowLine = lines.find(l => {
      const a = accountById.get(l.accountId);
      return a && isFinancingLiabilityCode(a.code);
    });
    if (borrowLine) {
      const fxRateVal = borrowLine.fxRate ? Number(borrowLine.fxRate) : 1;
      let amt = borrowLine.currency && borrowLine.currency !== 'NGN'
        ? toNgn(borrowLine.debitAmount - borrowLine.creditAmount, fxRateVal)
        : (borrowLine.debitAmount || 0) - (borrowLine.creditAmount || 0);
      if (amt !== 0) {
        const codeNum = parseInt(accountById.get(borrowLine.accountId)!.code, 10);
        if (codeNum === 304000 || codeNum === 401000) {
          financingItems.push({ name: 'Lease Liability Payments', amount: amt });
        } else if (codeNum === 305000) {
          financingItems.push({ name: 'Dividends Paid', amount: amt });
        } else if (amt < 0) {
          financingItems.push({ name: 'Repayment of Borrowings', amount: amt });
        } else {
          financingItems.push({ name: 'New Borrowings Received', amount: amt });
        }
        financingTotal += amt;
      }
    }

    // Equity
    const equityLine = lines.find(l => {
      const a = accountById.get(l.accountId);
      return a && isEquityCode(a.code);
    });
    if (equityLine && !borrowLine) {
      const fxRateVal = equityLine.fxRate ? Number(equityLine.fxRate) : 1;
      let amt = equityLine.currency && equityLine.currency !== 'NGN'
        ? toNgn(equityLine.debitAmount - equityLine.creditAmount, fxRateVal)
        : (equityLine.debitAmount || 0) - (equityLine.creditAmount || 0);
      if (amt !== 0) {
        financingItems.push({ name: 'Proceeds from Issue of Share Capital', amount: -amt });
        financingTotal += -amt;
      }
    }
  }

  // ── 6. Tax paid, Interest paid/received ──
  let incomeTaxPaid = 0, interestPaid = 0, interestReceived = 0;
  for (const [entryId, lines] of linesByEntry) {
    const cashLine = lines.find(l => {
      const a = accountById.get(l.accountId);
      return a && isCashCode(a.code);
    });
    if (!cashLine) continue;
    const cashDr = cashLine.debitAmount || 0;
    const cashCr = cashLine.creditAmount || 0;

    // Tax paid
    const taxLine = lines.find(l => {
      const a = accountById.get(l.accountId);
      return a && isTaxCode(a.code);
    });
    if (taxLine) {
      incomeTaxPaid += cashCr - cashDr;
    }

    // Interest paid
    const intCostLine = lines.find(l => {
      const a = accountById.get(l.accountId);
      return a && isFinanceCostCode(a.code);
    });
    if (intCostLine) {
      interestPaid += cashCr - cashDr;
    }

    // Interest received
    const intIncLine = lines.find(l => {
      const a = accountById.get(l.accountId);
      return a && isFinanceIncomeCode(a.code);
    });
    if (intIncLine) {
      interestReceived += cashDr - cashCr;
    }
  }

  const netCashFromOperating = cashGeneratedFromOperations + incomeTaxPaid + interestPaid + interestReceived;

  // ── 7. Opening and Closing Cash ──
  let openingCash = 0, closingCash = 0;
  for (const a of orgAccounts) {
    if (isCashCode(a.code)) {
      const opening = await getAccountBalance(a.id, new Date(startDate.getTime() - 1));
      const closing = await getAccountBalance(a.id, endDate);
      // Only include accounts with positive net balance (exclude overdrafts)
      if (opening > 0) openingCash += opening;
      if (closing > 0) closingCash += closing;
    }
  }

  // Ledger cash balance for reconciliation
  let ledgerCashBalance = 0;
  for (const a of orgAccounts) {
    if (isCashCode(a.code)) {
      const bal = await getAccountBalance(a.id, endDate);
      if (bal > 0) ledgerCashBalance += bal;
    }
  }

  const netChangeInCash = netCashFromOperating + investingTotal + financingTotal;
  // Recompute closing cash as opening + net change
  const computedClosingCash = openingCash + netChangeInCash;
  const reconciliationDiff = computedClosingCash - ledgerCashBalance;
  const reconciled = Math.abs(reconciliationDiff) < 1;

  // ── Aggregate investing/financing items ──
  function aggregateItems(items: { name: string; amount: number }[]): { name: string; amount: number }[] {
    const map = new Map<string, number>();
    for (const it of items) {
      map.set(it.name, (map.get(it.name) || 0) + it.amount);
    }
    const result: { name: string; amount: number }[] = [];
    for (const [name, amount] of map) {
      if (Math.abs(amount) > 0) result.push({ name, amount });
    }
    return result;
  }

  return {
    netIncome: netProfitVal,
    operatingActivities: {
      adjustments,
      adjustmentsTotal,
      workingCapitalChanges: wcItems,
      workingCapitalTotal,
      cashGeneratedFromOperations,
      incomeTaxPaid,
      interestPaid,
      interestReceived,
      total: netCashFromOperating
    },
    investingActivities: {
      items: aggregateItems(investingItems),
      total: investingTotal
    },
    financingActivities: {
      items: aggregateItems(financingItems),
      total: financingTotal
    },
    netChangeInCash: netChangeInCash,
    openingCash,
    closingCash: computedClosingCash,
    ledgerCashBalance,
    reconciliationDiff,
    reconciled
  };
}

/**
 * Returns paginated journal lines for a specific account with computed
 * running balance and source document metadata.
 */
export async function getAccountLedger(
  accountId: string,
  orgId: string,
  startDate: Date,
  endDate: Date,
  page: number = 1,
  limit: number = 50
): Promise<{ lines: any[]; total: number; page: number; limit: number; account: any; openingBalance: number }> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.orgId, orgId)))
    .limit(1);

  if (!account) throw new AppError('Account not found.', 404);

  // Get total count for pagination
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalLines.accountId, accountId),
        eq(journalEntries.orgId, orgId),
        gte(journalEntries.date, startDate),
        lte(journalEntries.date, endDate)
      )
    );

  const total = Number(countResult?.count || 0);
  const offset = (page - 1) * limit;

  // Fetch lines with entry metadata
  const rawLines = await db
    .select({
      id: journalLines.id,
      date: journalEntries.date,
      entryNumber: journalEntries.entryNumber,
      description: journalEntries.description,
      source: journalEntries.source,
      sourceId: journalEntries.sourceId,
      debitAmount: journalLines.debitAmount,
      creditAmount: journalLines.creditAmount,
      currency: journalLines.currency,
      fxRate: journalLines.fxRate
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalLines.accountId, accountId),
        eq(journalEntries.orgId, orgId),
        gte(journalEntries.date, startDate),
        lte(journalEntries.date, endDate)
      )
    )
    .orderBy(journalEntries.date, asc(journalEntries.entryNumber))
    .limit(limit)
    .offset(offset);

  // Compute running balance and compute opening balance (balance before startDate)
  const isDebitRule = account.type === 'asset' || account.type === 'expense';
  const isContraAsset = account.type === 'asset' &&
    (account.name.toLowerCase().includes('accumulated depreciation') ||
     account.name.toLowerCase().includes('allowance'));

  // Fetch all lines before startDate to compute opening balance
  const [beforeResult] = await db
    .select({
      debits: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)`,
      credits: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)`
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalLines.accountId, accountId),
        eq(journalEntries.orgId, orgId),
        lte(journalEntries.date, new Date(startDate.getTime() - 1))
      )
    );

  const beforeDebits = Number(beforeResult?.debits || 0);
  const beforeCredits = Number(beforeResult?.credits || 0);

  const openingBalance = isDebitRule
    ? beforeDebits - beforeCredits
    : beforeCredits - beforeDebits;

  // Build lines with running balance
  let running = openingBalance;
  const lines = rawLines.map((line) => {
    const netChange = isDebitRule
      ? (line.debitAmount - line.creditAmount)
      : (line.creditAmount - line.debitAmount);
    running += netChange;
    return {
      ...line,
      runningBalance: running
    };
  });

  return { lines, total, page, limit, account, openingBalance };
}

export async function updateJournalEntry(
  entryId: string,
  input: { date: Date; description: string; lines: { id?: string; accountId: string; debitAmount: number; creditAmount: number; description: string }[] }
): Promise<any> {
  const [entry] = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, entryId))
    .limit(1);
  if (!entry) throw new AppError('Journal entry not found.', 404);

  let totalDebits = 0;
  let totalCredits = 0;
  for (const line of input.lines) {
    totalDebits += line.debitAmount;
    totalCredits += line.creditAmount;
  }
  if (totalDebits !== totalCredits) throw new AppError('Journal entry is out of balance.', 400);

  // Delete existing lines and re-insert
  await db.delete(journalLines).where(eq(journalLines.entryId, entryId));

  for (const line of input.lines) {
    await db.insert(journalLines).values({
      entryId,
      accountId: line.accountId,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      description: line.description || null,
    });
  }

  const [updated] = await db
    .update(journalEntries)
    .set({
      date: input.date,
      description: input.description,
    })
    .where(eq(journalEntries.id, entryId))
    .returning();
  return updated;
}
