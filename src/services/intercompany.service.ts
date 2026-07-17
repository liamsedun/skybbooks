/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { and, eq, sql, gte, lte, inArray, desc } from 'drizzle-orm';
import { db, groups, groupMembers, intercompanyTransactions, intercompanyEliminations, organisations, users, journalEntries, accounts } from '../db/schema';
import { AppError } from '../lib/errors';
import { postToGL } from './posting.service';
import { toNgn } from './currency.service';

function isOrgInGroup(orgId: string, groupId: string): Promise<boolean> {
  return db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.orgId, orgId),
      sql`(${groupMembers.endDate} IS NULL OR ${groupMembers.endDate} >= CURRENT_DATE)`
    ))
    .then(rows => (rows[0]?.count ?? 0) > 0);
}

async function findAccountByCodePrefix(orgId: string, prefix: string) {
  const rows = await db
    .select()
    .from(accounts)
    .where(and(
      eq(accounts.orgId, orgId),
      sql`${accounts.code} LIKE ${prefix + '%'}`
    ))
    .limit(1);

  if (rows.length === 0) {
    // Try with systemAccountRole
    const roleRows = await db
      .select()
      .from(accounts)
      .where(and(
        eq(accounts.orgId, orgId),
        sql`${accounts.systemAccountRole} IS NOT NULL`
      ));

    // Search by role pattern
    const roleMatch = prefix === '104000'
      ? roleRows.find(r => r.systemAccountRole && r.systemAccountRole.includes('intercompany_receivable'))
      : prefix === '304000'
        ? roleRows.find(r => r.systemAccountRole && r.systemAccountRole.includes('intercompany_payable'))
        : undefined;

    if (roleMatch) return roleMatch;
    throw new AppError(`No account found with code prefix ${prefix} in org ${orgId}`, 400);
  }

  return rows[0];
}

async function findAccountByRoleOrPrefix(orgId: string, rolePattern: string, codePrefix: string) {
  const byRole = await db
    .select()
    .from(accounts)
    .where(and(
      eq(accounts.orgId, orgId),
      sql`${accounts.systemAccountRole} ILIKE ${'%' + rolePattern + '%'}`
    ))
    .limit(1);

  if (byRole.length > 0) return byRole[0];

  // Fallback to code prefix
  const byCode = await db
    .select()
    .from(accounts)
    .where(and(
      eq(accounts.orgId, orgId),
      sql`${accounts.code} LIKE ${codePrefix + '%'}`
    ))
    .limit(1);

  if (byCode.length > 0) return byCode[0];

  return null;
}

export async function listTransactions(
  groupId: string,
  filters?: {
    status?: string;
    fromOrgId?: string;
    toOrgId?: string;
    startDate?: Date;
    endDate?: Date;
  },
  limit = 50
) {
  const conditions = [eq(intercompanyTransactions.groupId, groupId)];

  if (filters?.status) {
    conditions.push(eq(intercompanyTransactions.status, filters.status as any));
  }
  if (filters?.fromOrgId) {
    conditions.push(eq(intercompanyTransactions.fromOrgId, filters.fromOrgId));
  }
  if (filters?.toOrgId) {
    conditions.push(eq(intercompanyTransactions.toOrgId, filters.toOrgId));
  }
  if (filters?.startDate) {
    conditions.push(gte(intercompanyTransactions.date, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(intercompanyTransactions.date, filters.endDate));
  }

  const rows = await db
    .select({
      id: intercompanyTransactions.id,
      groupId: intercompanyTransactions.groupId,
      fromOrgId: intercompanyTransactions.fromOrgId,
      toOrgId: intercompanyTransactions.toOrgId,
      fromOrgName: organisations.name,
      transactionType: intercompanyTransactions.transactionType,
      status: intercompanyTransactions.status,
      reference: intercompanyTransactions.reference,
      description: intercompanyTransactions.description,
      amount: intercompanyTransactions.amount,
      currency: intercompanyTransactions.currency,
      fxRate: intercompanyTransactions.fxRate,
      date: intercompanyTransactions.date,
      dueDate: intercompanyTransactions.dueDate,
      settledAmount: intercompanyTransactions.settledAmount,
      settledDate: intercompanyTransactions.settledDate,
      createdBy: intercompanyTransactions.createdBy,
      notes: intercompanyTransactions.notes,
      createdAt: intercompanyTransactions.createdAt,
    })
    .from(intercompanyTransactions)
    .leftJoin(organisations, eq(intercompanyTransactions.fromOrgId, organisations.id))
    .where(and(...conditions))
    .orderBy(desc(intercompanyTransactions.date))
    .limit(limit);

  return rows;
}

export async function getTransaction(txnId: string) {
  const [txn] = await db
    .select()
    .from(intercompanyTransactions)
    .where(eq(intercompanyTransactions.id, txnId))
    .limit(1);

  if (!txn) {
    throw new AppError('Intercompany transaction not found', 404);
  }

  // Fetch related org names
  const [fromOrg] = await db
    .select({ name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, txn.fromOrgId))
    .limit(1);

  const [toOrg] = await db
    .select({ name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, txn.toOrgId))
    .limit(1);

  // Fetch journal entries if they exist
  let fromJournal = null;
  let toJournal = null;

  if (txn.fromJournalEntryId) {
    [fromJournal] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, txn.fromJournalEntryId))
      .limit(1);
  }

  if (txn.toJournalEntryId) {
    [toJournal] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, txn.toJournalEntryId))
      .limit(1);
  }

  return {
    ...txn,
    fromOrgName: fromOrg?.name || '',
    toOrgName: toOrg?.name || '',
    fromJournal,
    toJournal,
  };
}

export async function createTransaction(
  data: {
    groupId: string;
    fromOrgId: string;
    toOrgId: string;
    transactionType: 'loan' | 'goods' | 'service' | 'royalty' | 'dividend' | 'management_fee' | 'other';
    description: string;
    amount: number;
    currency?: string;
    fxRate?: number;
    date: Date;
    reference?: string;
    notes?: string;
  },
  userId: string
) {
  // Validate both orgs are active members of the group
  const fromInGroup = await isOrgInGroup(data.fromOrgId, data.groupId);
  if (!fromInGroup) {
    throw new AppError('Source organisation is not an active member of this group', 400);
  }

  const toInGroup = await isOrgInGroup(data.toOrgId, data.groupId);
  if (!toInGroup) {
    throw new AppError('Destination organisation is not an active member of this group', 400);
  }

  if (data.fromOrgId === data.toOrgId) {
    throw new AppError('Source and destination organisations must be different', 400);
  }

  if (data.amount <= 0) {
    throw new AppError('Amount must be positive', 400);
  }

  const currency = data.currency || 'NGN';
  const fxRate = data.fxRate || null;

  // Determine the NGN-equivalent amount for posting
  const amountInNgn = currency !== 'NGN' && fxRate
    ? toNgn(data.amount, fxRate)
    : data.amount;

  // ── Post JE in the source org (fromOrg) ──
  // DR Intercompany Receivable (104000)
  // CR Revenue/Sales (400000) or Bank depending on transaction type
  const fromICAccount = await findAccountByCodePrefix(data.fromOrgId, '104000');

  // Find the counterparty account in fromOrg
  let fromCounterparty = await findAccountByRoleOrPrefix(data.fromOrgId, 'sales', '400000');
  if (!fromCounterparty) {
    // Fallback: try to find any revenue account
    const revAccounts = await db
      .select()
      .from(accounts)
      .where(and(
        eq(accounts.orgId, data.fromOrgId),
        inArray(accounts.type, ['revenue'])
      ))
      .limit(1);
    fromCounterparty = revAccounts[0] || null;
  }

  const fromOrgJournal = await postToGL({
    orgId: data.fromOrgId,
    date: data.date,
    description: `IC ${data.transactionType}: ${data.description}`,
    reference: data.reference,
    source: 'manual' as any,
    sourceId: undefined,
    createdBy: userId,
    lines: [
      {
        accountId: fromICAccount.id,
        debit: amountInNgn,
        description: `Intercompany receivable from ${data.toOrgId}`,
      },
      ...(fromCounterparty
        ? [{
            accountId: fromCounterparty.id,
            credit: amountInNgn,
            description: `IC ${data.transactionType} sale to org ${data.toOrgId}`,
          }]
        : []),
    ],
    currency,
    fxRate: fxRate != null ? Number(fxRate) : undefined,
  });

  // ── Post JE in the destination org (toOrg) ──
  // DR Expense (500000) or appropriate asset
  // CR Intercompany Payable (304000)
  const toICAccount = await findAccountByCodePrefix(data.toOrgId, '304000');

  // Find the expense/asset account in toOrg
  let toCounterparty = await findAccountByRoleOrPrefix(data.toOrgId, 'purchases', '500000');
  if (!toCounterparty) {
    // Fallback: try to find any expense account
    const expAccounts = await db
      .select()
      .from(accounts)
      .where(and(
        eq(accounts.orgId, data.toOrgId),
        eq(accounts.type, 'expense')
      ))
      .limit(1);
    toCounterparty = expAccounts[0] || null;
  }

  const toOrgJournal = await postToGL({
    orgId: data.toOrgId,
    date: data.date,
    description: `IC ${data.transactionType}: ${data.description}`,
    reference: data.reference,
    source: 'manual' as any,
    sourceId: undefined,
    createdBy: userId,
    lines: [
      ...(toCounterparty
        ? [{
            accountId: toCounterparty.id,
            debit: amountInNgn,
            description: `IC ${data.transactionType} purchase from org ${data.fromOrgId}`,
          }]
        : []),
      {
        accountId: toICAccount.id,
        credit: amountInNgn,
        description: `Intercompany payable to ${data.fromOrgId}`,
      },
    ],
    currency,
    fxRate: fxRate != null ? Number(fxRate) : undefined,
  });

  // Create the IC transaction record
  const [txn] = await db
    .insert(intercompanyTransactions)
    .values({
      groupId: data.groupId,
      fromOrgId: data.fromOrgId,
      toOrgId: data.toOrgId,
      transactionType: data.transactionType,
      status: 'pending',
      reference: data.reference,
      description: data.description,
      amount: data.amount,
      currency,
      fxRate: fxRate != null ? String(fxRate) : null,
      date: data.date,
      fromJournalEntryId: fromOrgJournal.id,
      toJournalEntryId: toOrgJournal.id,
      createdBy: userId,
      notes: data.notes || null,
    })
    .returning();

  return {
    ...txn,
    fromJournalEntry: fromOrgJournal,
    toJournalEntry: toOrgJournal,
  };
}

export async function settleTransaction(
  txnId: string,
  settledAmount: number,
  settledDate: Date,
  userId: string
) {
  const [txn] = await db
    .select()
    .from(intercompanyTransactions)
    .where(eq(intercompanyTransactions.id, txnId))
    .limit(1);

  if (!txn) {
    throw new AppError('Intercompany transaction not found', 404);
  }

  if (txn.status === 'settled') {
    throw new AppError('Transaction is already settled', 400);
  }

  const [updated] = await db
    .update(intercompanyTransactions)
    .set({
      status: 'settled',
      settledAmount,
      settledDate,
    })
    .where(eq(intercompanyTransactions.id, txnId))
    .returning();

  return updated;
}

export async function matchTransactions(groupId: string) {
  // Find pairs of IC transactions with same amount, opposite org directions, pending status
  const pendingTxns = await db
    .select()
    .from(intercompanyTransactions)
    .where(and(
      eq(intercompanyTransactions.groupId, groupId),
      eq(intercompanyTransactions.status, 'pending' as any)
    ));

  const matched: string[] = [];

  for (let i = 0; i < pendingTxns.length; i++) {
    if (matched.includes(pendingTxns[i].id)) continue;

    for (let j = i + 1; j < pendingTxns.length; j++) {
      if (matched.includes(pendingTxns[j].id)) continue;

      const a = pendingTxns[i];
      const b = pendingTxns[j];

      // Match: opposite orgs, same amount, close dates
      if (
        a.fromOrgId === b.toOrgId &&
        a.toOrgId === b.fromOrgId &&
        a.amount === b.amount &&
        a.currency === b.currency
      ) {
        // Mark both as matched
        matched.push(a.id, b.id);
        break;
      }
    }
  }

  if (matched.length > 0) {
    await db
      .update(intercompanyTransactions)
      .set({ status: 'matched' as any })
      .where(inArray(intercompanyTransactions.id, matched));
  }

  return { matchedCount: matched.length / 2, transactionIds: matched };
}

export async function deleteTransaction(txnId: string) {
  const [txn] = await db
    .select()
    .from(intercompanyTransactions)
    .where(eq(intercompanyTransactions.id, txnId))
    .limit(1);

  if (!txn) {
    throw new AppError('Intercompany transaction not found', 404);
  }

  if (txn.status !== 'pending') {
    throw new AppError('Only pending transactions can be deleted', 400);
  }

  await db.delete(intercompanyTransactions).where(eq(intercompanyTransactions.id, txnId));

  return { success: true };
}

export async function getIntercompanySummary(groupId: string, date?: Date) {
  // Verify group exists
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  const asOfDate = date || new Date();

  // Get all non-settled transactions
  const transactions = await db
    .select()
    .from(intercompanyTransactions)
    .where(and(
      eq(intercompanyTransactions.groupId, groupId),
      sql`${intercompanyTransactions.status} != 'settled'`,
      lte(intercompanyTransactions.date, asOfDate)
    ));

  // Group by org pair
  const pairMap = new Map<string, {
    fromOrgId: string;
    toOrgId: string;
    totalOutstanding: number;
    transactionCount: number;
    transactions: typeof transactions;
  }>();

  for (const txn of transactions) {
    const key = `${txn.fromOrgId}-${txn.toOrgId}`;
    const existing = pairMap.get(key) || {
      fromOrgId: txn.fromOrgId,
      toOrgId: txn.toOrgId,
      totalOutstanding: 0,
      transactionCount: 0,
      transactions: [],
    };

    const settled = txn.settledAmount || 0;
    existing.totalOutstanding += txn.amount - settled;
    existing.transactionCount++;
    existing.transactions.push(txn);
    pairMap.set(key, existing);
  }

  // Enrich with org names
  const orgIds = new Set<string>();
  for (const pair of pairMap.values()) {
    orgIds.add(pair.fromOrgId);
    orgIds.add(pair.toOrgId);
  }

  const orgNames = new Map<string, string>();
  if (orgIds.size > 0) {
    const orgs = await db
      .select({ id: organisations.id, name: organisations.name })
      .from(organisations)
      .where(inArray(organisations.id, Array.from(orgIds)));
    for (const org of orgs) {
      orgNames.set(org.id, org.name);
    }
  }

  const summary = Array.from(pairMap.values()).map(p => ({
    ...p,
    fromOrgName: orgNames.get(p.fromOrgId) || '',
    toOrgName: orgNames.get(p.toOrgId) || '',
  }));

  // Calculate total net outstanding
  let totalOutstanding = 0;
  for (const pair of summary) {
    totalOutstanding += pair.totalOutstanding;
  }

  return {
    groupId,
    asOfDate,
    totalOutstanding,
    totalPairs: summary.length,
    pairs: summary,
  };
}
