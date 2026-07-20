import { Router, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { ValidationError } from '../lib/errors';
import { db, subscriptions, subscriptionPlans, subscriptionInvoices, subscriptionPayments, paymentReceipts, subscriptionUsage, coupons, promotions, subscriptionAddons, paymentGatewayConfigs, auditLog } from '../db/schema';
import { getOrgSubscription, changePlan as subChangePlan, renewSubscription as subRenew, cancelSubscription, getSubscriptionInvoices, getOrgEntitlements, getUsage, checkUsageLimit, validateCoupon, createSubscription } from '../services/subscription.service';
import { transitionSubscription, schedulePlanChange, cancelAtPeriodEnd, cancelImmediately } from '../services/subscriptionLifecycle.service';
import { initializePayment, getPaymentHistory, getPaymentStats, getOrgGatewayConfigs, saveGatewayConfig } from '../services/subscriptionBilling.service';
import * as addonService from '../services/addon.service';
import * as promoEngine from '../services/promotionsEngine.service';
import { getPlan } from '../services/subscription.service';
import { createAuditLog, extractReqMeta } from '../services/audit.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Portal Dashboard — full snapshot ──

router.get('/portal/dashboard', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const sub = await getOrgSubscription(orgId);
  if (!sub) return res.json(ok({ subscription: null, plans: [], invoices: [], paymentHistory: [], usage: [], addons: [], entitlements: null }));

  const [plans, invoices, paymentHistory, usage, addons, entitlements] = await Promise.all([
    db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true)).orderBy(subscriptionPlans.sortOrder),
    getSubscriptionInvoices(orgId, sub.id),
    getPaymentHistory(orgId, sub.id),
    getUsage(orgId, sub.id),
    addonService.getAddons(orgId, sub.id),
    getOrgEntitlements(orgId).catch(() => null),
  ]);

  res.json(ok({ subscription: sub, plans, invoices, paymentHistory, usage, addons, entitlements }));
}));

// ── Billing Cycle Change ──

router.put('/portal/billing-cycle', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { billingCycle } = z.object({ billingCycle: z.enum(['monthly', 'annual']) }).parse(req.body);
  const sub = await getOrgSubscription(orgId);
  if (!sub) throw new ValidationError('No active subscription.', {});

  const plan = await getPlan(sub.planId);
  const newPrice = billingCycle === 'annual' ? Number(plan.annualPriceKobo) : Number(plan.monthlyPriceKobo);
  if (!newPrice) throw new ValidationError('This plan does not support the selected billing cycle.', {});

  await db.update(subscriptions).set({ billingCycle, updatedAt: new Date() } as any).where(eq(subscriptions.id, sub.id));
  await createAuditLog({ orgId, userId: req.user!.userId, action: 'BILLING_CYCLE_CHANGE', entityType: 'subscription', entityId: sub.id, newValues: { billingCycle }, ...extractReqMeta(req) });

  res.json(ok({ billingCycle, newPriceKobo: newPrice }));
}));

// ── Update Payment Method (returns gateway link) ──

router.get('/portal/payment-method-link', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const sub = await getOrgSubscription(orgId);
  if (!sub) throw new ValidationError('No active subscription.', {});

  const configs = await getOrgGatewayConfigs(orgId);
  const defaultGw = configs.find((c: any) => c.isDefault) || configs[0];
  if (!defaultGw) throw new ValidationError('No payment gateway configured.', {});

  const link = defaultGw.gateway === 'paystack'
    ? `https://paystack.com/update-card?code=${defaultGw.publicKey}`
    : defaultGw.gateway === 'flutterwave'
      ? `https://flutterwave.com/dashboard/account`
      : null;

  res.json(ok({ gateway: defaultGw.gateway, updateLink: link }));
}));

// ── Redeem Coupon at Portal ──

router.post('/portal/redeem-coupon', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { code } = z.object({ code: z.string().min(1) }).parse(req.body);

  const sub = await getOrgSubscription(orgId);
  if (!sub) throw new ValidationError('No active subscription.', {});

  const coupon = await validateCoupon(code, sub.planId);
  if (!coupon) throw new ValidationError('Invalid or expired coupon code.', {});

  // If coupon is already on the subscription, reject
  if (sub.couponId === coupon.id) throw new ValidationError('This coupon is already applied.', {});

  await db.update(subscriptions).set({ couponId: coupon.id, updatedAt: new Date() } as any).where(eq(subscriptions.id, sub.id));
  await promoEngine.recordRedemption({
    orgId, subscriptionId: sub.id, redemptionType: 'coupon', sourceId: coupon.id, sourceCode: coupon.code,
    discountType: coupon.discountType, discountValue: coupon.discountPercent || coupon.discountAmountKobo || 0,
    discountKobo: 0, freeMonths: coupon.freeMonths || 0, originalAmountKobo: 0, finalAmountKobo: 0, redeemedBy: req.user?.userId,
  });
  await createAuditLog({ orgId, userId: req.user!.userId, action: 'COUPON_REDEEM', entityType: 'subscription', entityId: sub.id, newValues: { couponCode: code }, ...extractReqMeta(req) });

  res.json(ok({ coupon, message: `Coupon "${code}" applied!` }));
}));

// ── Invoice Download (HTML receipt) ──

router.get('/portal/invoices/:id/download', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const [inv] = await db.select().from(subscriptionInvoices).where(and(eq(subscriptionInvoices.id, req.params.id), eq(subscriptionInvoices.orgId, orgId))).limit(1);
  if (!inv) throw new ValidationError('Invoice not found.', {});

  // Find matching payment for receipt
  const [pay] = await db.select().from(subscriptionPayments).where(and(eq(subscriptionPayments.invoiceId, inv.id), eq(subscriptionPayments.status, 'success'))).limit(1);
  const [receipt] = pay ? await db.select().from(paymentReceipts).where(eq(paymentReceipts.paymentId, pay.id)).limit(1) : [];

  const html = receipt?.htmlContent || generateInvoiceHtml(inv);
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${inv.invoiceNumber}.html"`);
  res.send(html);
}));

// ── Request Refund ──

router.post('/portal/refund', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { invoiceId, reason } = z.object({ invoiceId: z.string().uuid(), reason: z.string().min(1) }).parse(req.body);

  const [inv] = await db.select().from(subscriptionInvoices).where(and(eq(subscriptionInvoices.id, invoiceId), eq(subscriptionInvoices.orgId, orgId))).limit(1);
  if (!inv) throw new ValidationError('Invoice not found.', {});
  if (inv.status !== 'paid') throw new ValidationError('Only paid invoices can be refunded.', {});
  if (inv.refundedAt) throw new ValidationError('This invoice has already been refunded.', {});

  const [pay] = await db.select().from(subscriptionPayments).where(and(eq(subscriptionPayments.invoiceId, invoiceId), eq(subscriptionPayments.status, 'success'))).limit(1);

  // Mark as refunded
  const now = new Date();
  await db.update(subscriptionInvoices).set({ status: 'refunded', refundedAt: now, refundedAmountKobo: inv.totalKobo, refundReason: reason, updatedAt: now } as any).where(eq(subscriptionInvoices.id, invoiceId));
  if (pay) {
    await db.update(subscriptionPayments).set({ status: 'refunded', refundedAt: now, refundedAmountKobo: pay.amountKobo, refundReason: reason, updatedAt: now } as any).where(eq(subscriptionPayments.id, pay.id));
  }
  await createAuditLog({ orgId, userId: req.user!.userId, action: 'REFUND_REQUEST', entityType: 'subscription_invoice', entityId: invoiceId, newValues: { amountKobo: inv.totalKobo, reason }, ...extractReqMeta(req) });

  res.json(ok({ refunded: true, amountKobo: inv.totalKobo }));
}));

// ── Usage Dashboard ──

router.get('/portal/usage', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const sub = await getOrgSubscription(orgId);
  if (!sub) return res.json(ok({ usage: [], entitlements: null }));

  const [usage, entitlements] = await Promise.all([
    getUsage(orgId, sub.id),
    getOrgEntitlements(orgId).catch(() => null),
  ]);
  res.json(ok({ usage, entitlements }));
}));

// ── Add-on CRUD at Portal ──

router.get('/portal/addons', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const sub = await getOrgSubscription(orgId);
  const addons = sub ? await addonService.getAddons(orgId, sub.id) : [];
  res.json(ok(addons));
}));

router.post('/portal/addons', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const sub = await getOrgSubscription(orgId);
  if (!sub) throw new ValidationError('No active subscription.', {});

  const data = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    priceKobo: z.number().int().min(0),
    quantity: z.number().int().min(1).default(1),
    billingCycle: z.enum(['monthly', 'annual']).default('monthly'),
  }).parse(req.body);

  const addon = await addonService.createAddon(orgId, { ...data, subscriptionId: sub.id });
  await createAuditLog({ orgId, userId: req.user!.userId, action: 'ADDON_PURCHASE', entityType: 'subscription_addon', entityId: addon.id, newValues: data, ...extractReqMeta(req) });
  res.status(201).json(ok(addon));
}));

router.delete('/portal/addons/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const addon = await addonService.deactivateAddon(req.params.id, orgId);
  res.json(ok(addon));
}));

// ── Helper ──

function generateInvoiceHtml(inv: any): string {
  const fmt = (v: number) => `₦${(Number(v) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${inv.invoiceNumber}</title>
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#333}
h1{color:#1a1a2e;border-bottom:2px solid #1a1a2e;padding-bottom:10px}
table{width:100%;border-collapse:collapse;margin:20px 0}
th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}
th{background:#f5f5f5}.total{font-size:1.2em;font-weight:bold;text-align:right;margin-top:20px}
.status{display:inline-block;padding:4px 12px;border-radius:4px;font-size:.85em}
.status-paid{background:#d4edda;color:#155724}.status-pending{background:#fff3cd;color:#856404}
.footer{margin-top:40px;font-size:.85em;color:#666;border-top:1px solid #ddd;padding-top:15px}
</style></head><body>
<h1>Invoice #${inv.invoiceNumber}</h1>
<p><strong>Date:</strong> ${new Date(inv.createdAt).toLocaleDateString('en-GB')}</p>
<p><strong>Status:</strong> <span class="status status-${inv.status}">${inv.status.toUpperCase()}</span></p>
<p>${inv.description || ''}</p>
<table><tr><th>Description</th><th style="text-align:right">Amount</th></tr>
<tr><td>${inv.description || 'Subscription'}</td><td style="text-align:right">${fmt(inv.amountKobo)}</td></tr>
${inv.discountKobo > 0 ? `<tr><td>Discount</td><td style="text-align:right;color:#e53e3e">-${fmt(inv.discountKobo)}</td></tr>` : ''}
${inv.taxKobo > 0 ? `<tr><td>Tax</td><td style="text-align:right">${fmt(inv.taxKobo)}</td></tr>` : ''}
<tr style="font-weight:bold"><td>Total</td><td style="text-align:right">${fmt(inv.totalKobo)}</td></tr>
</table>
${inv.paidAt ? `<p><strong>Paid:</strong> ${new Date(inv.paidAt).toLocaleDateString('en-GB')}</p>` : ''}
<div class="footer"><p>SkyBooks — ${new Date().getFullYear()}</p></div>
</body></html>`;
}

export default router;
