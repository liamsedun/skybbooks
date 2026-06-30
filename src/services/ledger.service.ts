/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { eq, and, lte, gte, sql, asc } from 'drizzle-orm';
import { db, accounts, journalEntries, journalLines, bankAccounts, fixedAssets, contacts, inventoryLots, closedPeriods } from '../db/schema';
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
  source: 'manual' | 'invoice' | 'bill' | 'payment' | 'payroll' | 'bank_feed' | 'opening_balance';
  sourceId?: string;
  createdBy: string;
  lines: JournalLineInput[];
};

export type TrialBalanceRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
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
      const [newLine] = await dbClient
        .insert(journalLines)
        .values({
          entryId: newEntry.id,
          accountId: line.accountId,
          debitAmount: line.debit || 0,
          creditAmount: line.credit || 0,
          description: line.description || null,
          currency: line.currency || 'NGN',
          fxRate: line.fxRate ? String(line.fxRate) : null
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
  const arAccount = orgAccounts.find(a => a.type === 'asset' && (a.name.toLowerCase().includes('receivable') || a.code.startsWith('12')));
  const apAccount = orgAccounts.find(a => a.type === 'liability' && a.name.toLowerCase().includes('creditor'))
    || orgAccounts.find(a => a.type === 'liability' && a.name.toLowerCase().includes('payable'));
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
      const jeAr = (openingDebits + periodDebits) - (openingCredits + periodCredits);
      const extraAr = Math.max(0, customerOB - jeAr);
      if (extraAr > 0) { openingDebits += extraAr; }
    }

    // Vendor opening balance → single AP account only
    if (vendorOB > 0 && apAccount && acct.id === apAccount.id) {
      const jeAp = (openingCredits + periodCredits) - (openingDebits + periodDebits);
      const extraAp = Math.max(0, vendorOB - jeAp);
      if (extraAp > 0) { openingCredits += extraAp; }
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

  // System suspense account absorbs unreconciled sub-ledger vs GL differences
  const totalDr = resultList.reduce((s, r) => s + r.closingDebit, 0);
  const totalCr = resultList.reduce((s, r) => s + r.closingCredit, 0);
  const tbDiff = totalDr - totalCr;
  if (Math.abs(tbDiff) > 1) {
    resultList.push({
      accountId: 'system-suspense',
      accountCode: 'SYS-SUSPENSE',
      accountName: 'System (Unreconciled sub-ledger differences)',
      accountType: 'equity',
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

  const revenues: any[] = [];
  const cogs: any[] = [];
  const operatingExpenses: any[] = [];

  let totalRevenue = 0;
  let totalCogs = 0;
  let totalOperatingExpenses = 0;

  for (const acct of orgAccounts) {
    const matchedLines = records.filter((r) => r.accountId === acct.id);
    const drSum = matchedLines.reduce((sum, curr) => sum + (curr.currency && curr.currency !== 'NGN' ? toNgn(curr.debitAmount, curr.fxRate) : curr.debitAmount), 0);
    const crSum = matchedLines.reduce((sum, curr) => sum + (curr.currency && curr.currency !== 'NGN' ? toNgn(curr.creditAmount, curr.fxRate) : curr.creditAmount), 0);

    if (acct.type === 'revenue') {
      const balance = crSum - drSum;
      if (balance !== 0) {
        revenues.push({
          accountId: acct.id,
          code: acct.code,
          name: acct.name,
          balance
        });
        totalRevenue += balance;
      }
    } else if (acct.type === 'expense') {
      const balance = drSum - crSum;
      if (balance !== 0) {
        const isCOGS = acct.subType?.toLowerCase().includes('cogs') ||
                       acct.subType?.toLowerCase().includes('cost') ||
                       acct.name.toLowerCase().includes('cost of goods') ||
                       acct.name.toLowerCase().includes('cogs') ||
                       acct.name.toLowerCase().includes('cost of sales');

        const item = {
          accountId: acct.id,
          code: acct.code,
          name: acct.name,
          balance
        };

        if (isCOGS) {
          cogs.push(item);
          totalCogs += balance;
        } else {
          operatingExpenses.push(item);
          totalOperatingExpenses += balance;
        }
      }
    }
  }

  const grossProfit = totalRevenue - totalCogs;
  const operatingProfit = grossProfit - totalOperatingExpenses;
  const netProfit = operatingProfit;

  return {
    revenue: {
      accounts: revenues,
      total: totalRevenue
    },
    costOfGoodsSold: {
      accounts: cogs,
      total: totalCogs
    },
    expense: {
      accounts: operatingExpenses,
      total: totalOperatingExpenses
    },
    grossProfit,
    operatingProfit,
    netProfit
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

  const assets: any[] = [];
  const liabilities: any[] = [];
  const equities: any[] = [];

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquityBeforeRetained = 0;
  let cumulativeNetIncome = 0;

  for (const acct of orgAccounts) {
    const matched = records.filter((r) => r.accountId === acct.id);
    const dr = matched.reduce((sum, curr) => sum + (curr.currency && curr.currency !== 'NGN' ? toNgn(curr.debitAmount, curr.fxRate) : curr.debitAmount), 0);
    const cr = matched.reduce((sum, curr) => sum + (curr.currency && curr.currency !== 'NGN' ? toNgn(curr.creditAmount, curr.fxRate) : curr.creditAmount), 0);

    const item = {
      accountId: acct.id,
      code: acct.code,
      name: acct.name
    };

    if (acct.type === 'asset') {
      const balance = dr - cr;
      if (balance !== 0) {
        assets.push({ ...item, balance });
        totalAssets += balance;
      }
    } else if (acct.type === 'liability') {
      const balance = cr - dr;
      if (balance !== 0) {
        liabilities.push({ ...item, balance });
        totalLiabilities += balance;
      }
    } else if (acct.type === 'equity') {
      const balance = cr - dr;
      if (balance !== 0) {
        equities.push({ ...item, balance });
        totalEquityBeforeRetained += balance;
      }
    } else if (acct.type === 'revenue') {
      cumulativeNetIncome += (cr - dr); // Cr increases revenue
    } else if (acct.type === 'expense') {
      cumulativeNetIncome -= (dr - cr); // Dr increases expense
    }
  }

  // Inject period net income seamlessly into Equity section to close books balanced
  if (cumulativeNetIncome !== 0) {
    equities.push({
      accountId: 'dynamic-retained-earnings',
      code: 'RE-RETAINED',
      name: 'Retained Earnings (Current period net earnings)',
      balance: cumulativeNetIncome
    });
  }

  let totalEquity = totalEquityBeforeRetained + cumulativeNetIncome;
  let liabilitiesAndEquity = totalLiabilities + totalEquity;

  const accountingDifference = totalAssets - liabilitiesAndEquity;
  if (Math.abs(accountingDifference) > 1) {
    equities.push({
      accountId: 'system-suspense',
      code: 'SYS-SUSPENSE',
      name: 'System (Unreconciled sub-ledger differences)',
      balance: accountingDifference,
    });
    totalEquity += accountingDifference;
    liabilitiesAndEquity = totalLiabilities + totalEquity;
  }

  const result = {
    assets: {
      accounts: assets,
      total: totalAssets
    },
    liabilities: {
      accounts: liabilities,
      total: totalLiabilities
    },
    equity: {
      accounts: equities,
      total: totalEquity
    },
    totalAssets,
    totalLiabilities,
    totalEquity,
    liabilitiesAndEquity
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

  // Determine which accounts qualify as Cash / Cash Equivalents
  const isCashAccount = (a: any) =>
    a.type === 'asset' &&
    (a.subType?.toLowerCase().includes('cash') ||
      a.subType?.toLowerCase().includes('bank') ||
      a.name.toLowerCase().includes('cash') ||
      a.name.toLowerCase().includes('bank') ||
      a.code.startsWith('10') // standard cash code prefix
    );

  const cashAccountsList = orgAccounts.filter(isCashAccount);
  const nonCashAccountsList = orgAccounts.filter((a) => !isCashAccount(a));

  // 1. Calculate opening and ending cash parameters
  let openingCashVal = 0;
  let closingCashVal = 0;

  for (const cashAcct of cashAccountsList) {
    const balanceBeforeStar = await getAccountBalance(cashAcct.id, new Date(startDate.getTime() - 1));
    openingCashVal += balanceBeforeStar;

    const balanceEnd = await getAccountBalance(cashAcct.id, endDate);
    closingCashVal += balanceEnd;
  }

  // 2. Fetch income statement structures for net income
  const incomeStmt = await getProfitAndLoss(orgId, startDate, endDate);
  const netIncome = incomeStmt.current.netProfit;

  // 3. Calculate shifts in all non-cash accounts during the period to construct adjustments
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

  const operatingAdjustments: { name: string; amount: number }[] = [];
  const workingCapitalAdjustments: { name: string; amount: number }[] = [];
  const investingItems: { name: string; amount: number }[] = [];
  const financingItems: { name: string; amount: number }[] = [];

  let depreciationAddback = 0;
  let operatingAdjustmentsTotal = 0;
  let workingCapitalTotal = 0;
  let investingTotal = 0;
  let financingTotal = 0;

  for (const acct of nonCashAccountsList) {
    const matched = records.filter((r) => r.accountId === acct.id);
    const dr = matched.reduce((sum, curr) => sum + (curr.currency && curr.currency !== 'NGN' ? toNgn(curr.debitAmount, curr.fxRate) : curr.debitAmount), 0);
    const cr = matched.reduce((sum, curr) => sum + (curr.currency && curr.currency !== 'NGN' ? toNgn(curr.creditAmount, curr.fxRate) : curr.creditAmount), 0);

    const netPeriodDebitDiff = dr - cr; 
    const netPeriodCreditDiff = cr - dr;

    // Detect Depreciation Expenses (Non-cash Addbacks)
    const isDepreciation = acct.type === 'expense' && 
                           (acct.name.toLowerCase().includes('depreciation') || 
                            acct.name.toLowerCase().includes('amortization'));

    if (isDepreciation && netPeriodDebitDiff !== 0) {
      depreciationAddback += netPeriodDebitDiff;
      continue; // Skip adding to ordinary working capital
    }

    // Operating Working Capitals (receivables, payables, inventories, prepayments, operating taxes)
    const isReceivable = acct.type === 'asset' && 
                         (acct.subType?.toLowerCase().includes('receivable') || 
                          acct.name.toLowerCase().includes('receivable') || 
                          acct.name.toLowerCase().includes('debtor'));

    const isInventory = acct.type === 'asset' && 
                        (acct.subType?.toLowerCase().includes('inventory') || 
                         acct.name.toLowerCase().includes('inventory') || 
                         acct.name.toLowerCase().includes('stock'));

    const isPayable = acct.type === 'liability' &&
                      (acct.subType?.toLowerCase().includes('payable') || 
                       acct.name.toLowerCase().includes('payable') || 
                       acct.name.toLowerCase().includes('creditor'));

    if (isReceivable && netPeriodDebitDiff !== 0) {
      // Increase in receivables reduces cash flows (Asset Dr diff is cash outflow)
      const change = -netPeriodDebitDiff;
      workingCapitalAdjustments.push({
        name: `Change in Accounts Receivable (${acct.name})`,
        amount: change
      });
      workingCapitalTotal += change;
    } else if (isInventory && netPeriodDebitDiff !== 0) {
      // Increase in inventory reduces cash flows
      const change = -netPeriodDebitDiff;
      workingCapitalAdjustments.push({
        name: `Change in Inventory (${acct.name})`,
        amount: change
      });
      workingCapitalTotal += change;
    } else if (isPayable && netPeriodCreditDiff !== 0) {
      // Increase in Accounts Payable raises cash flows (Liability Cr diff is cash inflow)
      const change = netPeriodCreditDiff;
      workingCapitalAdjustments.push({
        name: `Change in Accounts Payable (${acct.name})`,
        amount: change
      });
      workingCapitalTotal += change;
    } else if (acct.type === 'asset' && netPeriodDebitDiff !== 0) {
      // General non-fixed investment properties / operating prepayment shifts
      const isFixedAsset = acct.subType?.toLowerCase().includes('fixed') || 
                          acct.subType?.toLowerCase().includes('property') || 
                          acct.name.toLowerCase().includes('equipment') || 
                          acct.name.toLowerCase().includes('property') || 
                          acct.name.toLowerCase().includes('furniture') || 
                          acct.name.toLowerCase().includes('vehicle');

      if (isFixedAsset) {
        // Investing cash flow outflow (Acquisitions of Fixed Assets)
        const change = -netPeriodDebitDiff;
        investingItems.push({
          name: `Purchase/Disposal of Fixed Asset (${acct.name})`,
          amount: change
        });
        investingTotal += change;
      } else {
        // Other Operating Assets
        const change = -netPeriodDebitDiff;
        workingCapitalAdjustments.push({
          name: `Change in Other Assets (${acct.name})`,
          amount: change
        });
        workingCapitalTotal += change;
      }
    } else if (acct.type === 'liability' && netPeriodCreditDiff !== 0) {
      // Determine if long-term loan/shareholder financing vs operating credits
      const isFinancingLiability = acct.subType?.toLowerCase().includes('loan') || 
                                   acct.subType?.toLowerCase().includes('equity') || 
                                   acct.name.toLowerCase().includes('loan') || 
                                   acct.name.toLowerCase().includes('debt') || 
                                   acct.name.toLowerCase().includes('borrowing');
      
      if (isFinancingLiability) {
        const change = netPeriodCreditDiff;
        financingItems.push({
          name: `Net Borrowings / (Repayments) (${acct.name})`,
          amount: change
        });
        financingTotal += change;
      } else {
        const change = netPeriodCreditDiff;
        workingCapitalAdjustments.push({
          name: `Change in Other Accruals (${acct.name})`,
          amount: change
        });
        workingCapitalTotal += change;
      }
    } else if (acct.type === 'equity' && netPeriodCreditDiff !== 0) {
      // Capital investments / distributions (excluding dynamic periods earnings)
      const change = netPeriodCreditDiff;
      financingItems.push({
        name: `Equity Transactions (${acct.name})`,
        amount: change
      });
      financingTotal += change;
    }
  }

  // Adjust non-cash addbacks
  if (depreciationAddback !== 0) {
    operatingAdjustments.push({
      name: 'Adjust for Depreciation and Amortization (Non-Cash Expense)',
      amount: depreciationAddback
    });
    operatingAdjustmentsTotal += depreciationAddback;
  }

  const netCashFromOperating = netIncome + operatingAdjustmentsTotal + workingCapitalTotal;
  const netCashFlowSum = netCashFromOperating + investingTotal + financingTotal;

  return {
    netIncome,
    operatingActivities: {
      adjustments: operatingAdjustments,
      workingCapitalChanges: workingCapitalAdjustments,
      total: netCashFromOperating
    },
    investingActivities: {
      items: investingItems,
      total: investingTotal
    },
    financingActivities: {
      items: financingItems,
      total: financingTotal
    },
    netChangeInCash: netCashFlowSum,
    openingCash: openingCashVal,
    closingCash: closingCashVal
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
