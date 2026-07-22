import { eq, and, desc, sql } from 'drizzle-orm';
import { db, subscriptions, subscriptionPlans, subscriptionInvoices, subscriptionPayments, paymentReceipts, paymentGatewayConfigs, organisations } from '../db/schema';
import { AppError } from '../lib/errors';
import { createPaymentGateway, generateReference, verifyPaystackWebhook, verifyFlutterwaveWebhook, verifyStripeWebhook, PaymentGatewayAdapter, PaymentVerifyResult, GatewayConfig } from './paymentGateway.service';
import { createAuditLog, extractReqMeta } from './audit.service';
import { transitionSubscription } from './subscriptionLifecycle.service';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function getOrgGatewayConfig(orgId: string, gateway?: string): Promise<{ gateway: string; config: GatewayConfig } | null> {
  const conditions: any[] = [eq(paymentGatewayConfigs.orgId, orgId), eq(paymentGatewayConfigs.isActive, true)];
  if (gateway) conditions.push(eq(paymentGatewayConfigs.gateway, gateway));
  const rows = await db.select().from(paymentGatewayConfigs).where(and(...conditions));
  if (rows.length === 0) {
    // Try global env-based default gateways
    if (process.env.PAYSTACK_SECRET_KEY && (!gateway || gateway === 'paystack')) {
      return { gateway: 'paystack', config: { secretKey: process.env.PAYSTACK_SECRET_KEY, publicKey: process.env.PAYSTACK_PUBLIC_KEY, environment: process.env.NODE_ENV === 'production' ? 'live' : 'test' } };
    }
    if (process.env.FLW_SECRET_KEY && (!gateway || gateway === 'flutterwave')) {
      return { gateway: 'flutterwave', config: { secretKey: process.env.FLW_SECRET_KEY, publicKey: process.env.FLW_PUBLIC_KEY, environment: process.env.NODE_ENV === 'production' ? 'live' : 'test' } };
    }
    return null;
  }
  const cfg = rows[0];
  return { gateway: cfg.gateway, config: { publicKey: cfg.publicKey || undefined, secretKey: cfg.secretKey || '', webhookSecret: cfg.webhookSecret || undefined, environment: cfg.environment } };
}

export async function getOrgDefaultGateway(orgId: string): Promise<{ gateway: string; config: GatewayConfig } | null> {
  // Try org-specific default
  const [defaultCfg] = await db.select().from(paymentGatewayConfigs).where(and(eq(paymentGatewayConfigs.orgId, orgId), eq(paymentGatewayConfigs.isDefault, true))).limit(1);
  if (defaultCfg) return { gateway: defaultCfg.gateway, config: { publicKey: defaultCfg.publicKey || undefined, secretKey: defaultCfg.secretKey || '', webhookSecret: defaultCfg.webhookSecret || undefined, environment: defaultCfg.environment } };
  // Try any active config
  return await getOrgGatewayConfig(orgId);
}

export async function saveGatewayConfig(orgId: string, data: { gateway: string; publicKey?: string; secretKey: string; webhookSecret?: string; environment?: string; isDefault?: boolean }, userId?: string): Promise<any> {
  const existing = await db.select().from(paymentGatewayConfigs).where(and(eq(paymentGatewayConfigs.orgId, orgId), eq(paymentGatewayConfigs.gateway, data.gateway))).limit(1);
  if (existing.length > 0) {
    const [updated] = await db.update(paymentGatewayConfigs).set({ ...data, updatedAt: new Date() } as any).where(eq(paymentGatewayConfigs.id, existing[0].id)).returning();
    return updated;
  }
  const [created] = await db.insert(paymentGatewayConfigs).values({ orgId, ...data } as any).returning();
  return created;
}

export async function getOrgGatewayConfigs(orgId: string): Promise<any[]> {
  return await db.select().from(paymentGatewayConfigs).where(eq(paymentGatewayConfigs.orgId, orgId));
}

export async function initializePayment(
  orgId: string,
  invoiceId: string,
  userId: string,
  options?: { gateway?: string; channels?: string[]; isAutoRenewal?: boolean; retryAttempt?: number },
): Promise<{ authorizationUrl: string; reference: string; payment: any }> {
  const [inv] = await db.select().from(subscriptionInvoices).where(and(eq(subscriptionInvoices.id, invoiceId), eq(subscriptionInvoices.orgId, orgId))).limit(1);
  if (!inv) throw new AppError('Invoice not found.', 404);
  if (inv.status === 'paid') throw new AppError('Invoice is already paid.', 400);

  const gatewayInfo = options?.gateway ? await getOrgGatewayConfig(orgId, options.gateway) : await getOrgDefaultGateway(orgId);
  if (!gatewayInfo) throw new AppError('No payment gateway configured. Please configure a gateway in Settings > Billing.', 400);

  const [org] = await db.select({ name: organisations.name, email: organisations.email }).from(organisations).where(eq(organisations.id, orgId)).limit(1);

  const reference = generateReference('sub_pay');
  const adapter = createPaymentGateway(gatewayInfo.gateway);
  const totalKobo = inv.totalKobo || inv.amountKobo || 0;

  const callbackUrl = `${FRONTEND_URL}/subscription/verify?reference=${reference}&invoiceId=${invoiceId}`;

  const result = await adapter.initialize({
    email: org?.email || '',
    amountKobo: totalKobo,
    reference,
    currency: 'NGN',
    channels: options?.channels || ['card', 'bank_transfer', 'ussd'],
    callbackUrl,
    metadata: { orgId, invoiceId, subscriptionId: inv.subscriptionId, reference },
  }, gatewayInfo.config);

  const [payment] = await db.insert(subscriptionPayments).values({
    orgId,
    subscriptionId: inv.subscriptionId || '00000000-0000-0000-0000-000000000000',
    invoiceId,
    gateway: gatewayInfo.gateway,
    gatewayReference: reference,
    gatewayTransactionId: result.gatewayTransactionId || null,
    amountKobo: totalKobo,
    currency: 'NGN',
    status: 'pending',
    authorizationUrl: result.authorizationUrl,
    isAutoRenewal: options?.isAutoRenewal || false,
    isRetry: !!options?.retryAttempt,
    retryAttempt: options?.retryAttempt || 0,
    metadata: { channels: options?.channels, initializedBy: userId },
  } as any).returning();

  // Update invoice with attempt info
  await db.update(subscriptionInvoices)
    .set({ attemptCount: sql`COALESCE(${subscriptionInvoices.attemptCount}, 0) + 1`, lastAttemptAt: new Date(), gatewayReference: reference })
    .where(eq(subscriptionInvoices.id, invoiceId));

  return { authorizationUrl: result.authorizationUrl, reference, payment };
}

export async function verifyPayment(orgId: string, reference: string, invoiceId: string): Promise<{ success: boolean; payment: any; invoice: any }> {
  const [payment] = await db.select().from(subscriptionPayments)
    .where(and(eq(subscriptionPayments.gatewayReference, reference)))
    .limit(1);
  if (!payment) throw new AppError('Payment record not found.', 404);
  if (payment.status === 'success') throw new AppError('Payment already verified.', 400);

  const gatewayInfo = await getOrgGatewayConfig(orgId, payment.gateway);
  if (!gatewayInfo) throw new AppError('Payment gateway configuration not found.', 400);

  const adapter = createPaymentGateway(gatewayInfo.gateway);
  let verifyResult: PaymentVerifyResult;
  try {
    verifyResult = await adapter.verify(reference, gatewayInfo.config);
  } catch (err: any) {
    await db.update(subscriptionPayments)
      .set({ status: 'failed', rawResponse: sql`jsonb_set(COALESCE(raw_response, '{}'::jsonb), '{verifyError}', to_jsonb(${err.message}::text))` })
      .where(eq(subscriptionPayments.id, payment.id));
    throw new AppError(`Payment verification failed: ${err.message}`, 400);
  }

  const now = new Date();
  const updateData: any = {
    status: verifyResult.success ? 'success' : 'failed',
    gatewayTransactionId: verifyResult.gatewayTransactionId,
    feeKobo: verifyResult.feeKobo,
    paymentMethod: mapChannelToMethod(verifyResult.channel || verifyResult.paymentMethod),
    payerEmail: verifyResult.payerEmail,
    payerName: verifyResult.payerName,
    channel: verifyResult.channel,
    rawResponse: verifyResult.rawResponse,
  };
  if (verifyResult.success) {
    updateData.paidAt = now;
    updateData.receiptUrl = `${FRONTEND_URL}/api/platform/subscriptions/billing/receipts/${payment.id}`;
  }

  const [updatedPayment] = await db.update(subscriptionPayments)
    .set(updateData)
    .where(eq(subscriptionPayments.id, payment.id))
    .returning();

  let updatedInvoice: any = null;
  if (verifyResult.success) {
    // Mark invoice paid
    [updatedInvoice] = await db.update(subscriptionInvoices)
      .set({
        status: 'paid',
        paidAt: now,
        paymentMethod: mapChannelToMethod(verifyResult.channel || verifyResult.paymentMethod),
        gatewayReference: reference,
        gatewayResponse: verifyResult.rawResponse,
        receiptUrl: updateData.receiptUrl,
        updatedAt: now,
      })
      .where(eq(subscriptionInvoices.id, invoiceId))
      .returning();

    // Activate subscription if needed
    if (updatedInvoice?.subscriptionId) {
      await db.update(subscriptions)
        .set({
          lastPaymentDate: now,
          paymentFailureCount: 0,
          status: 'active' as any,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, updatedInvoice.subscriptionId));
    }

    // Generate receipt
    await generateReceipt(orgId, payment.id, invoiceId, updatedInvoice);
  }

  return { success: verifyResult.success, payment: updatedPayment, invoice: updatedInvoice };
}

export async function handlePaymentWebhook(gateway: string, headers: any, body: any): Promise<any> {
  let event: any = body;
  let reference = '';
  let status = '';
  let gatewayTransactionId = '';
  let amountKobo = 0;
  let metadata: any = {};

  if (gateway === 'paystack') {
    const eventData = event.data || {};
    reference = eventData.reference || '';
    status = eventData.status || '';
    gatewayTransactionId = String(eventData.id || '');
    amountKobo = Math.round((eventData.amount || 0));
    metadata = eventData.metadata || {};
  } else if (gateway === 'flutterwave') {
    const eventData = event.data || {};
    reference = eventData.tx_ref || '';
    status = eventData.status || '';
    gatewayTransactionId = String(eventData.id || '');
    amountKobo = Math.round(parseFloat(eventData.amount || '0') * 100);
    metadata = eventData.meta || {};
  } else if (gateway === 'stripe') {
    const session = event.data?.object || {};
    reference = session.client_reference_id || '';
    status = session.payment_status === 'paid' ? 'success' : 'failed';
    gatewayTransactionId = session.id || '';
    amountKobo = Math.round((session.amount_total || 0));
    try { metadata = JSON.parse(session.metadata || '{}'); } catch { metadata = {}; }
  }

  const orgId = metadata.orgId || '';
  const invoiceId = metadata.invoiceId || '';
  if (!reference) return { received: true, skipped: 'no reference' };

  const [existing] = await db.select({ id: subscriptionPayments.id, status: subscriptionPayments.status })
    .from(subscriptionPayments).where(eq(subscriptionPayments.gatewayReference, reference)).limit(1);
  if (existing && existing.status === 'success') return { received: true, skipped: 'already processed' };

  const paymentStatus = status === 'success' || status === 'successful' ? 'success' : status === 'failed' ? 'failed' : 'pending';

  if (existing) {
    await db.update(subscriptionPayments)
      .set({ status: paymentStatus as any, gatewayTransactionId, rawResponse: event, paidAt: paymentStatus === 'success' ? new Date() : undefined })
      .where(eq(subscriptionPayments.id, existing.id));
  } else {
    // Create payment record if not exists (webhook-first scenario)
    const [sub] = await db.select({ id: subscriptions.id }).from(subscriptions)
      .where(and(eq(subscriptions.orgId, orgId))).orderBy(desc(subscriptions.createdAt)).limit(1).catch(() => [{ id: null }]);
    await db.insert(subscriptionPayments).values({
      orgId: orgId || '00000000-0000-0000-0000-000000000000',
      subscriptionId: metadata.subscriptionId || sub?.id || '00000000-0000-0000-0000-000000000000',
      invoiceId: invoiceId || null,
      gateway,
      gatewayReference: reference,
      gatewayTransactionId,
      amountKobo,
      currency: 'NGN',
      status: paymentStatus as any,
      rawResponse: event,
      paidAt: paymentStatus === 'success' ? new Date() : undefined,
    } as any);
  }

  if (paymentStatus === 'success' && invoiceId) {
    await db.update(subscriptionInvoices)
      .set({ status: 'paid', paidAt: new Date(), gatewayReference: reference, gatewayResponse: event, updatedAt: new Date() })
      .where(eq(subscriptionInvoices.id, invoiceId));

    const [inv] = await db.select({ subscriptionId: subscriptionInvoices.subscriptionId }).from(subscriptionInvoices).where(eq(subscriptionInvoices.id, invoiceId)).limit(1);
    if (inv?.subscriptionId) {
      await db.update(subscriptions)
        .set({ lastPaymentDate: new Date(), paymentFailureCount: 0, status: 'active' as any, updatedAt: new Date() })
        .where(eq(subscriptions.id, inv.subscriptionId));
    }
  }

  return { received: true, reference, status: paymentStatus };
}

export async function retryPayment(orgId: string, invoiceId: string, userId: string, options?: { gateway?: string; channels?: string[] }): Promise<{ authorizationUrl: string; reference: string; payment: any }> {
  const [inv] = await db.select().from(subscriptionInvoices).where(and(eq(subscriptionInvoices.id, invoiceId), eq(subscriptionInvoices.orgId, orgId))).limit(1);
  if (!inv) throw new AppError('Invoice not found.', 404);
  if (inv.status === 'paid') throw new AppError('Invoice is already paid.', 400);

  const attemptCount = (inv.attemptCount || 0) + 1;
  return await initializePayment(orgId, invoiceId, userId, { ...options, retryAttempt: attemptCount, isAutoRenewal: false });
}

export async function processAutoRenewalPayment(orgId: string, subscriptionId: string): Promise<any> {
  // Find latest unpaid invoice for this subscription
  const [inv] = await db.select().from(subscriptionInvoices)
    .where(and(
      eq(subscriptionInvoices.subscriptionId, subscriptionId),
      eq(subscriptionInvoices.orgId, orgId),
      eq(subscriptionInvoices.status, 'pending'),
    ))
    .orderBy(desc(subscriptionInvoices.createdAt))
    .limit(1);
  if (!inv) return null;

  const gatewayInfo = await getOrgDefaultGateway(orgId);
  if (!gatewayInfo) return null; // No gateway configured, skip auto

  const [org] = await db.select({ name: organisations.name, email: organisations.email }).from(organisations).where(eq(organisations.id, orgId)).limit(1);

  const reference = generateReference('sub_auto');
  const adapter = createPaymentGateway(gatewayInfo.gateway);
  const totalKobo = inv.totalKobo || inv.amountKobo || 0;

  const result = await adapter.initialize({
    email: org?.email || '',
    amountKobo: totalKobo,
    reference,
    currency: 'NGN',
    channels: ['card'],
    callbackUrl: `${FRONTEND_URL}/subscription/verify?reference=${reference}&invoiceId=${inv.id}`,
    metadata: { orgId, invoiceId: inv.id, subscriptionId, reference, autoRenewal: true },
  }, gatewayInfo.config);

  const [payment] = await db.insert(subscriptionPayments).values({
    orgId,
    subscriptionId,
    invoiceId: inv.id,
    gateway: gatewayInfo.gateway,
    gatewayReference: reference,
    gatewayTransactionId: result.gatewayTransactionId || null,
    amountKobo: totalKobo,
    currency: 'NGN',
    status: 'pending',
    authorizationUrl: result.authorizationUrl,
    isAutoRenewal: true,
    isRetry: false,
    metadata: { autoRenewal: true },
  } as any).returning();

  await db.update(subscriptionInvoices)
    .set({ attemptCount: sql`COALESCE(${subscriptionInvoices.attemptCount}, 0) + 1`, lastAttemptAt: new Date(), gatewayReference: reference })
    .where(eq(subscriptionInvoices.id, inv.id));

  return { authorizationUrl: result.authorizationUrl, reference, payment, invoice: inv };
}

// ─── Receipts ───

export async function generateReceipt(orgId: string, paymentId: string, invoiceId: string, invoice: any): Promise<any> {
  const [org] = await db.select({ name: organisations.name, email: organisations.email }).from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const [payment] = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, paymentId)).limit(1);
  if (!payment) throw new AppError('Payment not found.', 404);

  const receiptNumber = `RCP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;
  const planName = invoice.description || 'Subscription';

  const fmtNaira = (v: number) => {
    const abs = Math.abs(v);
    const naira = Math.floor(abs / 100);
    const kobo = abs % 100;
    return '₦' + naira.toLocaleString('en-US') + '.' + String(kobo).padStart(2, '0');
  };

  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const paidDate = payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Payment Receipt — ${receiptNumber}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; color: #1e293b; }
  .receipt { max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .subtitle { color: #64748b; font-size: 14px; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 8px 0; font-size: 14px; }
  .label { color: #64748b; }
  .value { text-align: right; font-weight: 600; }
  .total td { padding-top: 16px; font-size: 18px; font-weight: 700; border-top: 2px solid #1e293b; }
  .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 32px; }
  .status { display: inline-block; background: #dcfce7; color: #166534; font-weight: 600; font-size: 12px; padding: 4px 12px; border-radius: 20px; }
  .header { display: flex; justify-content: space-between; align-items: start; }
</style></head><body>
<div class="receipt">
  <div class="header">
    <div>
      <h1>Payment Receipt</h1>
      <p class="subtitle">${org?.name || 'Your Organisation'}</p>
    </div>
    <span class="status">PAID</span>
  </div>
  <hr class="divider">
  <table>
    <tr><td class="label">Receipt Number</td><td class="value">${receiptNumber}</td></tr>
    <tr><td class="label">Invoice Number</td><td class="value">${invoice.invoiceNumber || '—'}</td></tr>
    <tr><td class="label">Payment Reference</td><td class="value">${payment.gatewayReference}</td></tr>
    <tr><td class="label">Payment Method</td><td class="value" style="text-transform:capitalize">${(payment.paymentMethod || 'unknown').replace(/_/g, ' ')}</td></tr>
    <tr><td class="label">Gateway</td><td class="value" style="text-transform:capitalize">${payment.gateway}</td></tr>
    <tr><td class="label">Date Paid</td><td class="value">${paidDate}</td></tr>
    <tr><td class="label">Due Date</td><td class="value">${dueDate}</td></tr>
  </table>
  <hr class="divider">
  <table>
    <tr><td class="label">Description</td><td class="value">${planName}</td></tr>
    <tr class="total"><td class="label">Total Paid</td><td class="value">${fmtNaira(payment.amountKobo)}</td></tr>
  </table>
  <hr class="divider">
  <p style="font-size:13px; color:#64748b;">Thank you for your payment. This receipt confirms your subscription payment has been processed successfully.</p>
  <div class="footer">
    <p>${org?.name || ''} — Powered by SkyBooks</p>
  </div>
</div></body></html>`;

  const [receipt] = await db.insert(paymentReceipts).values({
    orgId,
    paymentId,
    invoiceId,
    receiptNumber,
    title: `Payment Receipt — ${receiptNumber}`,
    htmlContent,
    metadata: { invoiceNumber: invoice.invoiceNumber, planName, amountKobo: payment.amountKobo, paidAt: paidDate },
  } as any).returning();

  return receipt;
}

export async function getReceipt(orgId: string, paymentId: string): Promise<any> {
  const [receipt] = await db.select().from(paymentReceipts).where(and(eq(paymentReceipts.paymentId, paymentId), eq(paymentReceipts.orgId, orgId))).limit(1);
  if (!receipt) throw new AppError('Receipt not found.', 404);
  return receipt;
}

export async function getPaymentHistory(orgId: string, subscriptionId?: string): Promise<any[]> {
  const conditions: any[] = [eq(subscriptionPayments.orgId, orgId)];
  if (subscriptionId) conditions.push(eq(subscriptionPayments.subscriptionId, subscriptionId));
  return await db
    .select({
      payment: subscriptionPayments,
      invoice: {
        id: subscriptionInvoices.id,
        invoiceNumber: subscriptionInvoices.invoiceNumber,
        status: subscriptionInvoices.status,
        totalKobo: subscriptionInvoices.totalKobo,
        description: subscriptionInvoices.description,
      },
    })
    .from(subscriptionPayments)
    .leftJoin(subscriptionInvoices, eq(subscriptionPayments.invoiceId, subscriptionInvoices.id))
    .where(and(...conditions))
    .orderBy(desc(subscriptionPayments.createdAt));
}

export async function getPaymentStats(orgId: string): Promise<any> {
  const [stats] = await db.select({
    totalPayments: sql<number>`COUNT(*)`,
    successfulPayments: sql<number>`COUNT(*) FILTER (WHERE ${subscriptionPayments.status} = 'success')`,
    failedPayments: sql<number>`COUNT(*) FILTER (WHERE ${subscriptionPayments.status} = 'failed')`,
    totalRevenueKobo: sql<number>`COALESCE(SUM(${subscriptionPayments.amountKobo}) FILTER (WHERE ${subscriptionPayments.status} = 'success'), 0)`,
    totalFeesKobo: sql<number>`COALESCE(SUM(${subscriptionPayments.feeKobo}) FILTER (WHERE ${subscriptionPayments.status} = 'success'), 0)`,
  })
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.orgId, orgId));
  return stats;
}

function mapChannelToMethod(channel: string): any {
  const map: Record<string, string> = {
    card: 'card',
    bank: 'bank_transfer',
    transfer: 'bank_transfer',
    bank_transfer: 'bank_transfer',
    ussd: 'ussd',
    wallet: 'wallet',
    qr: 'card',
    mobile_money: 'wallet',
    payattitude: 'wallet',
  };
  for (const [key, val] of Object.entries(map)) {
    if (channel?.toLowerCase().includes(key)) return val;
  }
  return 'unknown';
}
