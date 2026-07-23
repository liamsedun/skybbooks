import { db, bankAccounts, bankTransactions, bankConnections, paymentGatewayTransactions, organisations, paymentGatewayConfigs, journalEntries, journalLines, accounts } from '../db/schema';
import { eq, and, gte, lte, or, sql, desc, asc } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { monoProvider } from './providers/mono.provider';
import { paystackProvider } from './providers/paystack.provider';
import { flutterwavePaymentProvider } from './providers/flutterwave.provider';
import { moniepointProvider } from './providers/moniepoint.provider';
import { createAuditLog, extractReqMeta } from './audit.service';
import { BaseBankFeedProvider } from './providers/base.provider';
import { BankFeedTransaction, PaymentGatewayTransaction, AutoMatchResult } from './providers/types';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || '';
const MONIEPOINT_API_KEY = process.env.MONIEPOINT_API_KEY || '';
const MONIEPOINT_SECRET = process.env.MONIEPOINT_SECRET || '';

function getFeedProvider(providerType: string): BaseBankFeedProvider {
  switch (providerType) {
    case 'mono': return monoProvider as any;
    default: throw new AppError(`Unsupported feed provider: ${providerType}`, 400);
  }
}

function getActiveProviders(orgId: string): { feed: string[]; gateway: string[] } {
  const feed: string[] = ['mono'];
  const gateway: string[] = [];
  if (PAYSTACK_SECRET_KEY) gateway.push('paystack');
  if (FLW_SECRET_KEY) gateway.push('flutterwave');
  if (MONIEPOINT_API_KEY && MONIEPOINT_SECRET) gateway.push('moniepoint');
  return { feed, gateway };
}

export async function getOrgGatewayConfigs(orgId: string): Promise<Record<string, { publicKey: string; secretKey: string; webhookSecret: string; environment: string; isActive: boolean; isDefault: boolean }>> {
  const rows = await db
    .select()
    .from(paymentGatewayConfigs)
    .where(eq(paymentGatewayConfigs.orgId, orgId));
  const result: Record<string, any> = {};
  for (const row of rows) {
    result[row.gateway] = {
      publicKey: row.publicKey || '',
      secretKey: row.secretKey || '',
      webhookSecret: row.webhookSecret || '',
      environment: row.environment || 'live',
      isActive: row.isActive ?? true,
      isDefault: row.isDefault ?? false,
    };
  }
  return result;
}

export async function saveOrgGatewayConfig(orgId: string, gateway: string, data: {
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  environment?: string;
  isActive?: boolean;
  isDefault?: boolean;
}): Promise<void> {
  await db
    .insert(paymentGatewayConfigs)
    .values({
      orgId,
      gateway,
      publicKey: data.publicKey || null,
      secretKey: data.secretKey || null,
      webhookSecret: data.webhookSecret || null,
      environment: data.environment || 'live',
      isActive: data.isActive ?? true,
      isDefault: data.isDefault ?? false,
    })
    .onConflictDoUpdate({
      target: [paymentGatewayConfigs.orgId, paymentGatewayConfigs.gateway],
      set: {
        publicKey: data.publicKey || null,
        secretKey: data.secretKey || null,
        webhookSecret: data.webhookSecret || null,
        environment: data.environment || 'live',
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
        updatedAt: new Date(),
      },
    });
}

export async function deleteOrgGatewayConfig(orgId: string, gateway: string): Promise<void> {
  await db
    .delete(paymentGatewayConfigs)
    .where(and(eq(paymentGatewayConfigs.orgId, orgId), eq(paymentGatewayConfigs.gateway, gateway)));
}

export async function getBankConnections(orgId: string) {
  return db
    .select({
      id: bankConnections.id,
      bankAccountId: bankConnections.bankAccountId,
      provider: bankConnections.provider,
      providerAccountId: bankConnections.providerAccountId,
      providerAccountName: bankConnections.providerAccountName,
      status: bankConnections.status,
      lastSyncedAt: bankConnections.lastSyncedAt,
      errorMessage: bankConnections.errorMessage,
      meta: bankConnections.meta,
      createdAt: bankConnections.createdAt,
      bankAccountName: bankAccounts.name,
      bankAccountNumber: bankAccounts.accountNumber,
      bankName: bankAccounts.bankName,
    })
    .from(bankConnections)
    .leftJoin(bankAccounts, eq(bankConnections.bankAccountId, bankAccounts.id))
    .where(eq(bankConnections.orgId, orgId))
    .orderBy(desc(bankConnections.createdAt));
}

export async function getPaymentGatewayTransactions(orgId: string, params?: {
  provider?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const conditions = [eq(paymentGatewayTransactions.orgId, orgId)];
  if (params?.provider) conditions.push(eq(paymentGatewayTransactions.provider, params.provider as any));
  if (params?.status) conditions.push(eq(paymentGatewayTransactions.status, params.status as any));
  if (params?.from) conditions.push(gte(paymentGatewayTransactions.createdAt, new Date(params.from)));
  if (params?.to) conditions.push(lte(paymentGatewayTransactions.createdAt, new Date(params.to)));

  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: paymentGatewayTransactions.id,
        provider: paymentGatewayTransactions.provider,
        gatewayTransactionId: paymentGatewayTransactions.gatewayTransactionId,
        reference: paymentGatewayTransactions.reference,
        amount: paymentGatewayTransactions.amount,
        fee: paymentGatewayTransactions.fee,
        currency: paymentGatewayTransactions.currency,
        status: paymentGatewayTransactions.status,
        customerEmail: paymentGatewayTransactions.customerEmail,
        customerName: paymentGatewayTransactions.customerName,
        customerPhone: paymentGatewayTransactions.customerPhone,
        description: paymentGatewayTransactions.description,
        paymentMethod: paymentGatewayTransactions.paymentMethod,
        channel: paymentGatewayTransactions.channel,
        settledAt: paymentGatewayTransactions.settledAt,
        createdAt: paymentGatewayTransactions.createdAt,
        bankAccountId: paymentGatewayTransactions.bankAccountId,
        matchedTransactionId: paymentGatewayTransactions.matchedTransactionId,
        bankAccountName: bankAccounts.name,
      })
      .from(paymentGatewayTransactions)
      .leftJoin(bankAccounts, eq(paymentGatewayTransactions.bankAccountId, bankAccounts.id))
      .where(and(...conditions))
      .orderBy(desc(paymentGatewayTransactions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(paymentGatewayTransactions)
      .where(and(...conditions))
      .then(r => Number(r[0]?.count || 0)),
  ]);

  return { data, total: totalResult, page, limit };
}

export async function syncBankFeed(connectionId: string, orgId: string): Promise<{ transactionsAdded: number; accountName?: string }> {
  const [conn] = await db
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.id, connectionId), eq(bankConnections.orgId, orgId)))
    .limit(1);
  if (!conn) throw new AppError('Bank connection not found', 404);

  const provider = getFeedProvider(conn.provider);
  const lastSync = conn.lastSyncedAt || new Date(0);
  const result = await provider.fetchTransactions(connectionId, lastSync);

  let added = 0;
  for (const txn of result.transactions) {
    const [existing] = await db
      .select({ id: bankTransactions.id })
      .from(bankTransactions)
      .where(and(
        eq(bankTransactions.bankAccountId, conn.bankAccountId),
        eq(bankTransactions.orgId, orgId),
        or(
          eq(bankTransactions.reference, txn.reference || ''),
          eq(bankTransactions.monoTransactionId, txn.externalId)
        )
      ))
      .limit(1);
    if (existing) continue;

    const amountKobo = Math.round(txn.amount * 100);
    await db.insert(bankTransactions).values({
      bankAccountId: conn.bankAccountId,
      orgId,
      date: txn.date,
      description: txn.description,
      amount: amountKobo,
      type: txn.type,
      balanceAfter: txn.balanceAfter != null ? Math.round(txn.balanceAfter * 100) : null,
      reference: txn.reference || null,
      monoTransactionId: txn.externalId || null,
      status: 'unreconciled',
    });
    added++;
  }

  await db.update(bankConnections)
    .set({ lastSyncedAt: new Date(), status: 'active', errorMessage: null })
    .where(eq(bankConnections.id, connectionId));

  return { transactionsAdded: added, accountName: result.accountName };
}

export async function syncPaymentGatewayTransactions(orgId: string, provider: string): Promise<number> {
  let transactions: PaymentGatewayTransaction[] = [];

  try {
    switch (provider) {
      case 'paystack': {
        const result = await paystackProvider.listTransactions({ perPage: 100 });
        transactions = result;
        break;
      }
      case 'flutterwave': {
        const result = await flutterwavePaymentProvider.listTransactions();
        transactions = result;
        break;
      }
      case 'moniepoint': {
        const result = await moniepointProvider.getTransactions({ limit: 100 });
        transactions = result;
        break;
      }
      default:
        throw new AppError(`Unsupported payment gateway: ${provider}`, 400);
    }
  } catch (err: any) {
    throw new AppError(`Failed to sync ${provider} transactions: ${err.message}`, 502);
  }

  let added = 0;
  for (const txn of transactions) {
    const [existing] = await db
      .select({ id: paymentGatewayTransactions.id })
      .from(paymentGatewayTransactions)
      .where(and(
        eq(paymentGatewayTransactions.orgId, orgId),
        eq(paymentGatewayTransactions.gatewayTransactionId, txn.gatewayTransactionId)
      ))
      .limit(1);
    if (existing) continue;

    await db.insert(paymentGatewayTransactions).values({
      orgId,
      provider: provider as any,
      gatewayTransactionId: txn.gatewayTransactionId,
      reference: txn.reference,
      amount: txn.amount,
      fee: txn.fee,
      currency: txn.currency,
      status: txn.status,
      customerEmail: txn.customerEmail || null,
      customerName: txn.customerName || null,
      customerPhone: txn.customerPhone || null,
      description: txn.description || null,
      paymentMethod: txn.paymentMethod || null,
      channel: txn.channel || null,
      settledAt: txn.settledAt || null,
      rawData: txn.rawData as any,
    });
    added++;
  }

  return added;
}

export async function autoMatchPaymentGatewayTransactions(orgId: string, bankAccountId?: string): Promise<AutoMatchResult[]> {
  const results: AutoMatchResult[] = [];

  const conditions = [eq(paymentGatewayTransactions.orgId, orgId), eq(paymentGatewayTransactions.status, 'success')];
  if (bankAccountId) conditions.push(eq(paymentGatewayTransactions.bankAccountId, bankAccountId));

  const gateways = await db
    .select()
    .from(paymentGatewayTransactions)
    .where(and(...conditions))
    .orderBy(desc(paymentGatewayTransactions.createdAt));

  for (const gw of gateways) {
    if (gw.matchedTransactionId) continue;

    const bankConditions = [
      eq(bankTransactions.orgId, orgId),
      eq(bankTransactions.status, 'unreconciled'),
    ];
    if (bankAccountId) bankConditions.push(eq(bankTransactions.bankAccountId, bankAccountId));

    const matches = await db
      .select()
      .from(bankTransactions)
      .where(and(...bankConditions))
      .orderBy(desc(bankTransactions.date));

    let bestMatch: typeof matches[0] | null = null;
    let bestScore = 0;

    for (const bt of matches) {
      let score = 0;

      if (Math.abs(bt.amount - gw.amount) <= 1) score += 40;
      else if (Math.abs(bt.amount - gw.amount) <= 100) score += 20;

      const dateDiff = Math.abs(bt.date.getTime() - (gw.settledAt || gw.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (dateDiff <= 1) score += 25;
      else if (dateDiff <= 3) score += 15;
      else if (dateDiff <= 7) score += 5;

      const btDirection = bt.type === 'credit' ? 'credit' : 'debit';
      if (btDirection === 'credit') score += 10;

      if (gw.reference && bt.reference) {
        const gwRef = gw.reference.toLowerCase();
        const btRef = bt.reference.toLowerCase();
        if (gwRef === btRef) score += 25;
        else if (gwRef.includes(btRef) || btRef.includes(gwRef)) score += 15;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = bt;
      }
    }

    if (bestMatch && bestScore >= 60) {
      const method = bestScore >= 90 ? 'auto_gateway_exact' : 'auto_gateway_fuzzy';
      await db.update(paymentGatewayTransactions)
        .set({ matchedTransactionId: bestMatch.id })
        .where(eq(paymentGatewayTransactions.id, gw.id));

      await db.update(bankTransactions)
        .set({
          status: 'reconciled',
          matchConfidence: String(bestScore / 100),
          matchMethod: method,
          reconciledAt: new Date(),
        })
        .where(eq(bankTransactions.id, bestMatch.id));

      results.push({
        bankTransactionId: bestMatch.id,
        gatewayTransactionId: gw.id,
        confidence: bestScore / 100,
        matchedBy: method,
      });
    }
  }

  return results;
}

export async function getProviderStatus(orgId: string) {
  const activeProviders = getActiveProviders(orgId);
  const connections = await db
    .select({
      id: bankConnections.id,
      provider: bankConnections.provider,
      status: bankConnections.status,
      lastSyncedAt: bankConnections.lastSyncedAt,
      errorMessage: bankConnections.errorMessage,
      bankAccountName: bankAccounts.name,
    })
    .from(bankConnections)
    .leftJoin(bankAccounts, eq(bankConnections.bankAccountId, bankAccounts.id))
    .where(eq(bankConnections.orgId, orgId));

  const gatewaySummary = await db
    .select({
      provider: paymentGatewayTransactions.provider,
      total: sql<number>`COUNT(*)`,
      pending: sql<number>`SUM(CASE WHEN ${paymentGatewayTransactions.status} = 'pending' THEN 1 ELSE 0 END)`,
      settled: sql<number>`SUM(CASE WHEN ${paymentGatewayTransactions.status} = 'settled' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN ${paymentGatewayTransactions.status} = 'failed' THEN 1 ELSE 0 END)`,
    })
    .from(paymentGatewayTransactions)
    .where(eq(paymentGatewayTransactions.orgId, orgId))
    .groupBy(paymentGatewayTransactions.provider);

  return {
    availableProviders: activeProviders,
    connections,
    gatewaySummary,
  };
}

export async function disconnectBankConnection(connectionId: string, orgId: string): Promise<void> {
  const [conn] = await db
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.id, connectionId), eq(bankConnections.orgId, orgId)))
    .limit(1);
  if (!conn) throw new AppError('Connection not found', 404);

  const provider = getFeedProvider(conn.provider);
  await provider.disconnect(connectionId);

  await db.update(bankConnections)
    .set({ status: 'disconnected', authToken: null, refreshToken: null })
    .where(eq(bankConnections.id, connectionId));
}

export async function getGatewaySummary(orgId: string) {
  const [totals] = await db
    .select({
      totalAmount: sql<number>`COALESCE(SUM(${paymentGatewayTransactions.amount}), 0)`,
      totalFee: sql<number>`COALESCE(SUM(${paymentGatewayTransactions.fee}), 0)`,
      count: sql<number>`COUNT(*)`,
      successCount: sql<number>`SUM(CASE WHEN ${paymentGatewayTransactions.status} = 'success' OR ${paymentGatewayTransactions.status} = 'settled' THEN 1 ELSE 0 END)`,
    })
    .from(paymentGatewayTransactions)
    .where(eq(paymentGatewayTransactions.orgId, orgId));

  return {
    totalVolume: Number(totals?.totalAmount || 0),
    totalFees: Number(totals?.totalFee || 0),
    transactionCount: Number(totals?.count || 0),
    successCount: Number(totals?.successCount || 0),
  };
}

export {
  getActiveProviders,
  monoProvider,
  paystackProvider,
  flutterwavePaymentProvider,
  moniepointProvider,
};
