/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { db, bankAccounts, bankTransactions } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../lib/errors';

const MONO_SECRET_KEY = process.env.MONO_SECRET_KEY || '';
const MONO_BASE = 'https://api.withmono.com/v2';

async function monoFetch(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${MONO_BASE}${path}`, {
    ...options,
    headers: {
      'mono-sec-key': MONO_SECRET_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mono API error ${res.status} on ${path}: ${body}`);
  }
  return res.json();
}

// Kept for backward compatibility — Mono widget runs entirely client-side.
export async function initiateFlutterwaveConnect(_orgId: string, _userId: string): Promise<{ token: string; connectUrl: string }> {
  return { token: 'mono_connect_ready', connectUrl: '' };
}

export async function exchangeFlutterwaveCode(code: string, bankAccountId: string): Promise<{ id: string }> {
  const [bankAccount] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankAccountId))
    .limit(1);

  if (!bankAccount) {
    throw new AppError('Bank account not found.', 404);
  }

  // Exchange the Mono code for a permanent account ID
  let monoAccountId: string;
  try {
    const data = await monoFetch('/accounts/auth', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    monoAccountId = data._id;
    if (!monoAccountId) throw new Error('No account _id in Mono response');
  } catch (err: any) {
    if (err.message?.includes('400') || err.message?.includes('expired')) {
      throw new AppError('The link code has expired or was already used. Please reconnect your bank account.', 400);
    }
    throw new AppError(`Failed to link bank account: ${err.message}`, 502);
  }

  await db
    .update(bankAccounts)
    .set({
      monoAccountId,
      monoAccountStatus: 'pending',
      lastSyncedAt: new Date(),
    })
    .where(eq(bankAccounts.id, bankAccountId));

  return { id: monoAccountId };
}

async function checkDataStatus(monoAccountId: string): Promise<{ dataStatus: string; syncStatus: string }> {
  const data = await monoFetch(`/accounts/${monoAccountId}`);
  const meta = data?.meta || {};
  return {
    dataStatus: (meta.data_status || 'UNAVAILABLE') as string,
    syncStatus: (meta.sync_status || '') as string,
  };
}

export async function syncFlutterwaveTransactions(bankAccountId: string, lastSyncDate: Date): Promise<number> {
  const [bankAccount] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankAccountId))
    .limit(1);

  if (!bankAccount) {
    throw new AppError('Bank account not found.', 404);
  }

  const monoAccountId = bankAccount.monoAccountId;
  if (!monoAccountId) {
    throw new AppError('This bank account has not been linked with Mono yet.', 400);
  }

  // Check data status before pulling transactions
  const { dataStatus, syncStatus } = await checkDataStatus(monoAccountId);

  if (syncStatus === 'REAUTHORISATION_REQUIRED') {
    await db.update(bankAccounts).set({ monoAccountStatus: 'reauth_required' }).where(eq(bankAccounts.id, bankAccountId));
    throw new AppError('Bank account reauthorisation is required. Please unlink and re-link the account.', 400);
  }

  if (dataStatus !== 'AVAILABLE' && dataStatus !== 'PARTIAL') {
    await db.update(bankAccounts).set({ monoAccountStatus: 'pending' }).where(eq(bankAccounts.id, bankAccountId));
    return 0;
  }

  let rawTxns: any[] = [];
  try {
    // Pull transactions since the last sync
    const startDate = lastSyncDate.toISOString().split('T')[0];
    const data = await monoFetch(`/accounts/${monoAccountId}/transactions?paginate=false&start=${startDate}`);
    rawTxns = data?.data || data?.results || data || [];
    if (!Array.isArray(rawTxns)) rawTxns = [];
  } catch (err: any) {
    throw new AppError(`Failed to sync transactions from Mono: ${err.message}`, 502);
  }

  let newTxnsCount = 0;

  for (const raw of rawTxns) {
    const monoTransactionId = raw._id || raw.id;
    if (!monoTransactionId) continue;

    const [exists] = await db
      .select({ id: bankTransactions.id })
      .from(bankTransactions)
      .where(eq(bankTransactions.monoTransactionId, String(monoTransactionId)))
      .limit(1);

    if (exists) continue;

    const amountValue = Number(raw.amount) || 0;
    const amountKobo = Math.round(Math.abs(amountValue) * 100);

    const txType: 'debit' | 'credit' =
      raw.type?.toLowerCase() === 'debit' ? 'debit' :
      raw.type?.toLowerCase() === 'credit' ? 'credit' :
      amountValue < 0 ? 'debit' : 'credit';

    const txDate = raw.date ? new Date(raw.date) : new Date();
    const balanceAfterKobo = raw.balance != null ? Math.round(Number(raw.balance) * 100) : null;

    await db.insert(bankTransactions).values({
      bankAccountId: bankAccount.id,
      orgId: bankAccount.orgId,
      date: txDate,
      description: raw.narration || raw.description || raw.counterparty || 'Mono Bank Feed Transaction',
      amount: amountKobo,
      type: txType,
      balanceAfter: balanceAfterKobo,
      reference: raw.reference || null,
      monoTransactionId: String(monoTransactionId),
      status: 'unreconciled',
    });

    newTxnsCount++;
  }

  // Update status to active and bump sync timestamp
  await db
    .update(bankAccounts)
    .set({
      monoAccountStatus: 'active',
      lastSyncedAt: new Date(),
    })
    .where(eq(bankAccounts.id, bankAccountId));

  return newTxnsCount;
}

export async function getFlutterwaveAccountBalance(_flutterwaveAccountId: string): Promise<number> {
  // No longer used — balance is derived from journal entries per the new architecture.
  return 0;
}
