import { z } from 'zod';
import { eq, and, inArray, sql, desc, lte, gte, lt, gt, isNull } from 'drizzle-orm';
import { db, subscriptions, subscriptionPlans, subscriptionStatusHistory, subscriptionInvoices, organisations } from '../db/schema';
import { AppError } from '../lib/errors';
import { createAuditLog, extractReqMeta } from './audit.service';
import { processAutoRenewalPayment } from './subscriptionBilling.service';

const VALID_TRANSITIONS: Record<string, string[]> = {
  'free_trial': ['active', 'expired', 'cancelled', 'pending_payment'],
  'active': ['grace_period', 'cancelled', 'expired', 'paused', 'pending_payment', 'renewing', 'downgraded', 'upgraded'],
  'grace_period': ['active', 'suspended', 'expired', 'cancelled'],
  'suspended': ['active', 'expired', 'cancelled'],
  'expired': ['active', 'cancelled'],
  'cancelled': ['active'],
  'pending_payment': ['active', 'failed_payment', 'cancelled', 'expired'],
  'failed_payment': ['active', 'grace_period', 'cancelled', 'expired'],
  'renewing': ['active', 'failed_payment', 'expired'],
  'downgraded': ['active', 'cancelled'],
  'upgraded': ['active', 'cancelled'],
  'paused': ['active', 'cancelled', 'expired'],
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addBillingDuration(from: Date, cycle: string): Date {
  switch (cycle) {
    case 'monthly': return addDays(from, 30);
    case 'quarterly': return addDays(from, 90);
    case 'yearly': return addDays(from, 365);
    default: return addDays(from, 30);
  }
}

function billingCycleToDays(cycle: string): number {
  switch (cycle) {
    case 'monthly': return 30;
    case 'quarterly': return 90;
    case 'yearly': return 365;
    default: return 30;
  }
}

export async function generateInvoiceNumber(orgId: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const prefix = `SUB-INV-${year}-`;

  const [last] = await db
    .select({ lastNum: sql<string>`MAX(${subscriptionInvoices.invoiceNumber})` })
    .from(subscriptionInvoices)
    .where(and(
      eq(subscriptionInvoices.orgId, orgId),
      sql`${subscriptionInvoices.invoiceNumber} LIKE ${prefix}%`,
    ));

  let nextSeq = 1;
  if (last?.lastNum) {
    const parts = last.lastNum.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) nextSeq = lastNum + 1;
  }

  return `${prefix}${String(nextSeq).padStart(7, '0')}`;
}

function calculateDiscount(amountKobo: number, coupon?: any, promotion?: any): { discountKobo: number; description: string } {
  let discountKobo = 0;
  const parts: string[] = [];

  if (coupon && coupon.isActive) {
    if (coupon.discountType === 'percentage' && coupon.discountPercent) {
      const d = Math.round(amountKobo * (coupon.discountPercent / 100));
      discountKobo += d;
      parts.push(`Coupon: ${coupon.discountPercent}% off`);
    } else if (coupon.discountType === 'fixed_amount' && coupon.discountAmountKobo) {
      discountKobo += coupon.discountAmountKobo;
      parts.push(`Coupon: ${coupon.discountAmountKobo} kobo off`);
    }
  }

  if (promotion && promotion.isActive) {
    if (promotion.discountType === 'percentage' && promotion.discountPercent) {
      const d = Math.round(amountKobo * (promotion.discountPercent / 100));
      discountKobo += d;
      parts.push(`Promotion: ${promotion.discountPercent}% off`);
    } else if (promotion.discountType === 'fixed_amount' && promotion.discountAmountKobo) {
      discountKobo += promotion.discountAmountKobo;
      parts.push(`Promotion: ${promotion.discountAmountKobo} kobo off`);
    }
  }

  discountKobo = Math.min(discountKobo, amountKobo);

  return { discountKobo, description: parts.join('; ') || 'No discount' };
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function generateInvoice(
  orgId: string,
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date,
  coupon?: any,
  promotion?: any,
  overrideAmountKobo?: number,
): Promise<any> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  const plan = await getPlan(sub.planId);
  const amountKobo = overrideAmountKobo != null ? overrideAmountKobo
    : sub.billingCycle === 'yearly' || sub.billingCycle === 'annual' ? (plan.annualPriceKobo || 0)
    : sub.billingCycle === 'quarterly' ? ((plan.monthlyPriceKobo || 0) * 3)
    : (plan.monthlyPriceKobo || 0);

  const { discountKobo, description: discountDesc } = calculateDiscount(
    amountKobo,
    coupon || null,
    promotion || null,
  );

  const invoiceNumber = await generateInvoiceNumber(orgId);
  const totalKobo = Math.max(0, amountKobo - discountKobo);
  const taxKobo = 0;

  const [invoice] = await db.insert(subscriptionInvoices).values({
    orgId,
    subscriptionId,
    invoiceNumber,
    description: `${plan.name} — ${formatDate(periodStart)} to ${formatDate(periodEnd)}`,
    amountKobo,
    taxKobo,
    discountKobo,
    totalKobo,
    status: 'pending',
    periodStart,
    periodEnd,
    dueDate: addDays(new Date(), 7),
    couponId: coupon?.id || sub.couponId || null,
    promotionId: promotion?.id || sub.promotionId || null,
  } as any).returning();

  return invoice;
}

async function getPlan(planId: string): Promise<any> {
  const [row] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);
  if (!row) throw new AppError('Plan not found.', 404);
  return row;
}

export async function transitionSubscription(
  subscriptionId: string,
  toStatus: string,
  options?: { reason?: string; changedBy?: string; metadata?: any },
): Promise<any> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  const fromStatus = sub.status as string;
  const allowed = VALID_TRANSITIONS[fromStatus];
  if (!allowed || !allowed.includes(toStatus)) {
    throw new AppError(`Cannot transition subscription from '${fromStatus}' to '${toStatus}'.`, 400);
  }

  const now = new Date();
  const updateData: any = {
    status: toStatus as any,
    updatedAt: now,
  };

  if (toStatus === 'grace_period') {
    updateData.gracePeriodEnd = addDays(now, 7);
  }

  if (toStatus === 'suspended') {
    updateData.suspendedAt = now;
  }

  if (toStatus === 'expired') {
    updateData.gracePeriodEnd = null;
    updateData.suspendedAt = null;
  }

  if (toStatus === 'paused') {
    updateData.pausedAt = now;
  }

  if (toStatus === 'active') {
    updateData.suspendedAt = null;
    updateData.pausedAt = null;
    updateData.pausedEnd = null;
    updateData.gracePeriodEnd = null;
    updateData.paymentFailureCount = 0;
  }

  if (toStatus === 'cancelled') {
    const cancelAtPeriodEnd = options?.metadata?.cancelAtPeriodEnd === true;
    if (cancelAtPeriodEnd && sub.currentPeriodEnd) {
      updateData.canceledAt = sub.currentPeriodEnd;
      updateData.cancelAtPeriodEnd = true;
    } else {
      updateData.canceledAt = now;
      updateData.cancelAtPeriodEnd = false;
    }
    updateData.autoRenew = false;
  }

  if (toStatus === 'free_trial') {
    const plan = await getPlan(sub.planId);
    updateData.trialStart = now;
    updateData.trialEnd = addDays(now, plan.trialDays || 14);
  }

  const [updated] = await db.update(subscriptions)
    .set(updateData)
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  const reason = options?.reason || null;
  const changedBy = options?.changedBy || null;
  const metadata = options?.metadata || null;

  await db.insert(subscriptionStatusHistory).values({
    subscriptionId,
    fromStatus: fromStatus as any,
    toStatus: toStatus as any,
    reason,
    changedBy: changedBy || undefined,
    metadata: metadata || {},
  } as any);

  if (changedBy) {
    const meta = options?.metadata?.reqMeta ? extractReqMeta(options.metadata.reqMeta) : { ipAddress: null, userAgent: null };
    await createAuditLog({
      orgId: sub.orgId,
      userId: changedBy,
      action: 'update',
      entityType: 'subscription',
      entityId: subscriptionId,
      oldValues: { status: fromStatus },
      newValues: { status: toStatus, ...updateData },
      ...meta,
    });
  }

  return updated;
}

export async function startFreeTrial(orgId: string, planId: string, userId?: string): Promise<any> {
  const existing = await db
    .select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.orgId, orgId),
      inArray(subscriptions.status as any, ['free_trial', 'active', 'grace_period'] as any),
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError('Organization already has an active or trialing subscription.', 409);
  }

  const plan = await getPlan(planId);
  const now = new Date();
  const trialDays = plan.trialDays || 14;
  const trialEnd = addDays(now, trialDays);
  const billingCycle = plan.billingCycle || 'monthly';
  const periodEnd = addBillingDuration(trialEnd, billingCycle);

  const [subscription] = await db.insert(subscriptions).values({
    orgId,
    planId,
    status: 'free_trial' as any,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    trialStart: now,
    trialEnd,
    billingCycleAnchor: now,
    autoRenew: true,
    nextBillingDate: trialEnd,
    metadata: {},
  } as any).returning();

  await db.insert(subscriptionStatusHistory).values({
    subscriptionId: subscription.id,
    fromStatus: null,
    toStatus: 'free_trial' as any,
    reason: 'Free trial started',
    changedBy: userId || undefined,
    metadata: { planId },
  } as any);

  if (userId) {
    await createAuditLog({
      orgId,
      userId,
      action: 'create',
      entityType: 'subscription',
      entityId: subscription.id,
      oldValues: {},
      newValues: subscription,
      ipAddress: null,
      userAgent: null,
    });
  }

  return { ...subscription, plan };
}

export async function activateAfterPayment(subscriptionId: string, userId?: string): Promise<any> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  if (sub.status !== 'pending_payment' && sub.status !== 'free_trial') {
    throw new AppError(`Cannot activate subscription with status '${sub.status}'. Must be 'pending_payment' or 'free_trial'.`, 400);
  }

  const now = new Date();
  const [updated] = await db.update(subscriptions)
    .set({
      status: 'active' as any,
      lastPaymentDate: now,
      nextBillingDate: sub.currentPeriodEnd || addDays(now, 30),
      paymentFailureCount: 0,
      suspendedAt: null,
      pausedAt: null,
      pausedEnd: null,
      gracePeriodEnd: null,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  await db.insert(subscriptionStatusHistory).values({
    subscriptionId,
    fromStatus: sub.status as any,
    toStatus: 'active' as any,
    reason: 'Payment successful',
    changedBy: userId || undefined,
    metadata: {},
  } as any);

  if (userId) {
    await createAuditLog({
      orgId: sub.orgId,
      userId,
      action: 'update',
      entityType: 'subscription',
      entityId: subscriptionId,
      oldValues: { status: sub.status },
      newValues: { status: 'active', lastPaymentDate: now },
      ipAddress: null,
      userAgent: null,
    });
  }

  return updated;
}

export async function handleFailedPayment(subscriptionId: string, userId?: string): Promise<any> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  const newFailureCount = (sub.paymentFailureCount || 0) + 1;

  let toStatus: string;
  if (sub.status === 'active') {
    toStatus = 'grace_period';
  } else if (sub.status === 'grace_period') {
    toStatus = 'suspended';
  } else {
    toStatus = 'failed_payment';
  }

  const updateData: any = {
    paymentFailureCount: newFailureCount,
    updatedAt: new Date(),
  };

  if (toStatus === 'grace_period') {
    updateData.status = 'grace_period' as any;
    updateData.gracePeriodEnd = addDays(new Date(), 7);
  } else if (toStatus === 'suspended') {
    updateData.status = 'suspended' as any;
    updateData.suspendedAt = new Date();
  } else {
    updateData.status = 'failed_payment' as any;
  }

  const [updated] = await db.update(subscriptions)
    .set(updateData)
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  await db.insert(subscriptionStatusHistory).values({
    subscriptionId,
    fromStatus: sub.status as any,
    toStatus: updateData.status,
    reason: `payment_failed: ${newFailureCount} attempt(s)`,
    changedBy: userId || undefined,
    metadata: { paymentFailureCount: newFailureCount },
  } as any);

  if (userId) {
    await createAuditLog({
      orgId: sub.orgId,
      userId,
      action: 'update',
      entityType: 'subscription',
      entityId: subscriptionId,
      oldValues: { status: sub.status, paymentFailureCount: sub.paymentFailureCount },
      newValues: { status: updateData.status, paymentFailureCount: newFailureCount },
      ipAddress: null,
      userAgent: null,
    });
  }

  return updated;
}

export async function cancelAtPeriodEnd(subscriptionId: string, userId?: string, reason?: string): Promise<any> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  const now = new Date();
  const [updated] = await db.update(subscriptions)
    .set({
      cancelAtPeriodEnd: true,
      canceledAt: sub.currentPeriodEnd || now,
      autoRenew: false,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  await db.insert(subscriptionStatusHistory).values({
    subscriptionId,
    fromStatus: sub.status as any,
    toStatus: sub.status as any,
    reason: reason || 'cancel_at_period_end',
    changedBy: userId || undefined,
    metadata: { cancelAtPeriodEnd: true, scheduledCancelDate: sub.currentPeriodEnd },
  } as any);

  if (userId) {
    await createAuditLog({
      orgId: sub.orgId,
      userId,
      action: 'update',
      entityType: 'subscription',
      entityId: subscriptionId,
      oldValues: { cancelAtPeriodEnd: sub.cancelAtPeriodEnd, autoRenew: sub.autoRenew },
      newValues: { cancelAtPeriodEnd: true, autoRenew: false },
      ipAddress: null,
      userAgent: null,
    });
  }

  return updated;
}

export async function cancelImmediately(subscriptionId: string, userId?: string, reason?: string): Promise<any> {
  return await transitionSubscription(subscriptionId, 'cancelled', {
    reason: reason || 'immediate_cancellation',
    changedBy: userId,
    metadata: { cancelAtPeriodEnd: false },
  });
}

export async function pauseSubscription(subscriptionId: string, pauseDays?: number, userId?: string): Promise<any> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  const allowed = VALID_TRANSITIONS[sub.status as string];
  if (!allowed || !allowed.includes('paused')) {
    throw new AppError(`Cannot pause subscription with status '${sub.status}'.`, 400);
  }

  const now = new Date();
  const updateData: any = {
    status: 'paused' as any,
    pausedAt: now,
    pausedEnd: pauseDays ? addDays(now, pauseDays) : null,
    updatedAt: now,
  };

  const [updated] = await db.update(subscriptions)
    .set(updateData)
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  await db.insert(subscriptionStatusHistory).values({
    subscriptionId,
    fromStatus: sub.status as any,
    toStatus: 'paused' as any,
    reason: pauseDays ? `paused for ${pauseDays} days` : 'paused indefinitely',
    changedBy: userId || undefined,
    metadata: { pauseDays: pauseDays || null, pausedEnd: updateData.pausedEnd },
  } as any);

  if (userId) {
    await createAuditLog({
      orgId: sub.orgId,
      userId,
      action: 'update',
      entityType: 'subscription',
      entityId: subscriptionId,
      oldValues: { status: sub.status },
      newValues: { status: 'paused', pausedAt: now, pausedEnd: updateData.pausedEnd },
      ipAddress: null,
      userAgent: null,
    });
  }

  return updated;
}

export async function resumeSubscription(subscriptionId: string, userId?: string): Promise<any> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  if (sub.status !== 'paused') {
    throw new AppError(`Can only resume a paused subscription, but status is '${sub.status}'.`, 400);
  }

  const now = new Date();
  const pausedAt = sub.pausedAt ? new Date(sub.pausedAt) : now;
  const daysPaused = Math.floor((now.getTime() - pausedAt.getTime()) / (1000 * 60 * 60 * 24));

  const currentPeriodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : addDays(now, 30);
  const newPeriodEnd = addDays(currentPeriodEnd, Math.max(0, daysPaused));

  const [updated] = await db.update(subscriptions)
    .set({
      status: 'active' as any,
      pausedAt: null,
      pausedEnd: null,
      currentPeriodEnd: newPeriodEnd,
      suspendedAt: null,
      gracePeriodEnd: null,
      paymentFailureCount: 0,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  await db.insert(subscriptionStatusHistory).values({
    subscriptionId,
    fromStatus: 'paused' as any,
    toStatus: 'active' as any,
    reason: `resumed after ${daysPaused} day(s)`,
    changedBy: userId || undefined,
    metadata: { daysPaused, periodEndExtended: true, newPeriodEnd },
  } as any);

  if (userId) {
    await createAuditLog({
      orgId: sub.orgId,
      userId,
      action: 'update',
      entityType: 'subscription',
      entityId: subscriptionId,
      oldValues: { status: 'paused', pausedAt: sub.pausedAt, currentPeriodEnd: sub.currentPeriodEnd },
      newValues: { status: 'active', currentPeriodEnd: newPeriodEnd },
      ipAddress: null,
      userAgent: null,
    });
  }

  return updated;
}

export async function schedulePlanChange(
  subscriptionId: string,
  newPlanId: string,
  changeType: 'upgrade' | 'downgrade',
  userId?: string,
  req?: any,
): Promise<any> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  const newPlan = await getPlan(newPlanId);
  if (!newPlan.isActive) throw new AppError('New plan is not active.', 400);

  const now = new Date();

  if (changeType === 'upgrade') {
    const [updated] = await db.update(subscriptions)
      .set({
        planId: newPlanId,
        previousPlanId: sub.planId,
        nextPlanId: null,
        scheduledChangeAt: null,
        status: 'upgraded' as any,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, subscriptionId))
      .returning();

    await db.insert(subscriptionStatusHistory).values({
      subscriptionId,
      fromStatus: sub.status as any,
      toStatus: 'upgraded' as any,
      reason: 'upgrade',
      changedBy: userId || undefined,
      metadata: { newPlanId, previousPlanId: sub.planId, changeType: 'upgrade' },
    } as any);

    if (userId) {
      const meta = req ? extractReqMeta(req) : { ipAddress: null, userAgent: null };
      await createAuditLog({
        orgId: sub.orgId,
        userId,
        action: 'update',
        entityType: 'subscription',
        entityId: subscriptionId,
        oldValues: { planId: sub.planId, status: sub.status },
        newValues: { planId: newPlanId, status: 'upgraded' },
        ...meta,
      });
    }

    return updated;
  }

  const scheduledChangeAt = sub.currentPeriodEnd || addDays(now, 30);
  const [updated] = await db.update(subscriptions)
    .set({
      nextPlanId: newPlanId,
      previousPlanId: sub.planId,
      scheduledChangeAt,
      status: 'downgraded' as any,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  await db.insert(subscriptionStatusHistory).values({
    subscriptionId,
    fromStatus: sub.status as any,
    toStatus: 'downgraded' as any,
    reason: `downgrade scheduled for ${formatDate(scheduledChangeAt)}`,
    changedBy: userId || undefined,
    metadata: { newPlanId, previousPlanId: sub.planId, changeType: 'downgrade', scheduledChangeAt },
  } as any);

  if (userId) {
    const meta = req ? extractReqMeta(req) : { ipAddress: null, userAgent: null };
    await createAuditLog({
      orgId: sub.orgId,
      userId,
      action: 'update',
      entityType: 'subscription',
      entityId: subscriptionId,
      oldValues: { planId: sub.planId, status: sub.status },
      newValues: { nextPlanId: newPlanId, status: 'downgraded', scheduledChangeAt },
      ...meta,
    });
  }

  return updated;
}

export async function processScheduledChanges(): Promise<any[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(
      lte(subscriptions.scheduledChangeAt, now),
      sql`${subscriptions.nextPlanId} IS NOT NULL`,
    ));

  const results: any[] = [];

  for (const sub of rows) {
    try {
      const [updated] = await db.update(subscriptions)
        .set({
          planId: sub.nextPlanId!,
          nextPlanId: null,
          scheduledChangeAt: null,
          status: 'active' as any,
          previousPlanId: sub.planId,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id))
        .returning();

      await db.insert(subscriptionStatusHistory).values({
        subscriptionId: sub.id,
        fromStatus: sub.status as any,
        toStatus: 'active' as any,
        reason: 'scheduled_plan_change_applied',
        metadata: { newPlanId: sub.nextPlanId, previousPlanId: sub.planId },
      } as any);

      results.push(updated);
    } catch (err: any) {
      console.error(`[Lifecycle] Failed to process scheduled change for subscription ${sub.id}:`, err.message);
    }
  }

  return results;
}

export async function processExpirations(): Promise<any[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(
      lt(subscriptions.currentPeriodEnd, now),
      sql`${subscriptions.status} NOT IN ('expired', 'cancelled')`,
    ));

  const results: any[] = [];

  for (const sub of rows) {
    try {
      const updated = await transitionSubscription(sub.id, 'expired', {
        reason: 'period_ended',
      });
      results.push(updated);
    } catch (err: any) {
      console.error(`[Lifecycle] Failed to expire subscription ${sub.id}:`, err.message);
    }
  }

  return results;
}

export async function processGracePeriodEndings(): Promise<any[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(
      lt(subscriptions.gracePeriodEnd, now),
      eq(subscriptions.status as any, 'grace_period' as any),
    ));

  const results: any[] = [];

  for (const sub of rows) {
    try {
      const updated = await transitionSubscription(sub.id, 'suspended', {
        reason: 'grace_period_ended',
      });
      results.push(updated);
    } catch (err: any) {
      console.error(`[Lifecycle] Failed to suspend subscription ${sub.id} after grace period:`, err.message);
    }
  }

  return results;
}

export async function processRenewals(): Promise<any[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.autoRenew, true),
      lte(subscriptions.nextBillingDate, now),
      eq(subscriptions.cancelAtPeriodEnd, false),
      eq(subscriptions.status as any, 'active' as any),
    ));

  const results: any[] = [];

  for (const sub of rows) {
    try {
      const plan = await getPlan(sub.planId);

      await db.update(subscriptions)
        .set({
          status: 'renewing' as any,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id));

      await db.insert(subscriptionStatusHistory).values({
        subscriptionId: sub.id,
        fromStatus: 'active' as any,
        toStatus: 'renewing' as any,
        reason: 'auto_renew_initiated',
        metadata: {},
      } as any);

      const billingCycle = plan.billingCycle || 'monthly';
      const newPeriodStart = sub.currentPeriodEnd || now;
      const newPeriodEnd = addBillingDuration(newPeriodStart, billingCycle);

      await generateInvoice(sub.orgId, sub.id, newPeriodStart, newPeriodEnd);

      // Attempt auto-payment through configured gateway
      try {
        const paymentResult = await processAutoRenewalPayment(sub.orgId, sub.id);
        if (paymentResult) {
          console.log(`[Lifecycle] Auto-payment initiated for subscription ${sub.id}: ${paymentResult.reference}`);
        }
      } catch (payErr: any) {
        console.error(`[Lifecycle] Auto-payment failed for subscription ${sub.id}:`, payErr.message);
      }

      const [updated] = await db.update(subscriptions)
        .set({
          status: 'active' as any,
          currentPeriodStart: newPeriodStart,
          currentPeriodEnd: newPeriodEnd,
          renewalCount: sql`${subscriptions.renewalCount} + 1`,
          lastRenewalAttempt: now,
          nextBillingDate: newPeriodEnd,
          suspendedAt: null,
          pausedAt: null,
          pausedEnd: null,
          gracePeriodEnd: null,
          paymentFailureCount: 0,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id))
        .returning();

      await db.insert(subscriptionStatusHistory).values({
        subscriptionId: sub.id,
        fromStatus: 'renewing' as any,
        toStatus: 'active' as any,
        reason: 'auto_renew_success',
        metadata: { renewalCount: (sub.renewalCount || 0) + 1, newPeriodStart, newPeriodEnd },
      } as any);

      results.push(updated);
    } catch (err: any) {
      console.error(`[Lifecycle] Auto-renew failed for subscription ${sub.id}:`, err.message);

      await db.update(subscriptions)
        .set({
          status: 'failed_payment' as any,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id));

      await db.insert(subscriptionStatusHistory).values({
        subscriptionId: sub.id,
        fromStatus: 'renewing' as any,
        toStatus: 'failed_payment' as any,
        reason: `auto_renew_failed: ${err.message}`,
        metadata: { error: err.message },
      } as any);

      results.push({ id: sub.id, status: 'failed_payment', error: err.message });
    }
  }

  return results;
}

export async function sendRenewalReminders(): Promise<any[]> {
  const now = new Date();
  const sevenDaysFromNow = addDays(now, 7);

  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(
      lte(subscriptions.currentPeriodEnd, sevenDaysFromNow),
      gte(subscriptions.currentPeriodEnd, now),
      sql`${subscriptions.expirationReminderSentAt} IS NULL`,
      eq(subscriptions.autoRenew, true),
      eq(subscriptions.cancelAtPeriodEnd, false),
      inArray(subscriptions.status as any, ['active', 'grace_period'] as any),
    ));

  if (rows.length === 0) return [];

  const ids = rows.map(r => r.id);

  await db.update(subscriptions)
    .set({ expirationReminderSentAt: now, updatedAt: now })
    .where(inArray(subscriptions.id, ids));

  const results = rows.map(r => ({
    id: r.id,
    orgId: r.orgId,
    planId: r.planId,
    currentPeriodEnd: r.currentPeriodEnd,
    daysRemaining: Math.max(0, Math.floor((new Date(r.currentPeriodEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
  }));

  return results;
}

export async function getStatusHistory(subscriptionId: string): Promise<any[]> {
  return await db
    .select()
    .from(subscriptionStatusHistory)
    .where(eq(subscriptionStatusHistory.subscriptionId, subscriptionId))
    .orderBy(desc(subscriptionStatusHistory.createdAt));
}

export async function checkAccess(orgId: string): Promise<{ hasAccess: boolean; status: string; reason?: string }> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!sub) {
    return { hasAccess: false, status: 'none', reason: 'No subscription found' };
  }

  const status = sub.status as string;
  const accessOk = ['active', 'free_trial', 'grace_period', 'paused', 'renewing', 'downgraded', 'upgraded'];

  if (accessOk.includes(status)) {
    return { hasAccess: true, status };
  }

  const reasons: Record<string, string> = {
    suspended: 'Access suspended due to non-payment.',
    expired: 'Subscription has expired.',
    cancelled: 'Subscription was cancelled.',
    pending_payment: 'Payment is pending.',
    failed_payment: 'Last payment failed.',
  };

  return { hasAccess: false, status, reason: reasons[status] || `Access denied: ${status}` };
}

export function startLifecycleScheduler(intervalMs?: number): any {
  const interval = intervalMs || 5 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  const mainInterval = setInterval(async () => {
    try {
      const renewed = await processRenewals();
      if (renewed.length > 0) {
        console.log(`[Lifecycle] Processed ${renewed.length} renewal(s).`);
      }

      const expired = await processExpirations();
      if (expired.length > 0) {
        console.log(`[Lifecycle] Expired ${expired.length} subscription(s).`);
      }

      const suspended = await processGracePeriodEndings();
      if (suspended.length > 0) {
        console.log(`[Lifecycle] Suspended ${suspended.length} subscription(s) after grace period.`);
      }

      const changes = await processScheduledChanges();
      if (changes.length > 0) {
        console.log(`[Lifecycle] Applied ${changes.length} scheduled plan change(s).`);
      }
    } catch (err: any) {
      console.error('[Lifecycle] Scheduler error:', err.message);
    }
  }, interval);

  const reminderInterval = setInterval(async () => {
    try {
      const reminders = await sendRenewalReminders();
      if (reminders.length > 0) {
        console.log(`[Lifecycle] Sent ${reminders.length} renewal reminder(s).`);
      }
    } catch (err: any) {
      console.error('[Lifecycle] Reminder scheduler error:', err.message);
    }
  }, hourMs);

  const handle = {
    mainInterval,
    reminderInterval,
    stop() {
      clearInterval(this.mainInterval);
      clearInterval(this.reminderInterval);
    },
  };

  return handle;
}
