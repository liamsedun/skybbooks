import { z } from 'zod';
import { eq, and, or, inArray, sql, desc, asc, lt, gt, lte, gte, isNull } from 'drizzle-orm';
import { db, subscriptionPlans, subscriptions, coupons, promotions, subscriptionInvoices, subscriptionUsage, subscriptionFeatureOverrides, organisations, users } from '../db/schema';
import { AppError } from '../lib/errors';
import { createAuditLog, extractReqMeta } from './audit.service';

// ── Zod Schemas ──

export const planSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  monthlyPriceKobo: z.number().int().min(0).default(0),
  annualPriceKobo: z.number().int().min(0).default(0),
  currency: z.string().default('NGN'),
  billingCycle: z.enum(['monthly', 'yearly', 'quarterly']).default('monthly'),
  trialDays: z.number().int().min(0).default(0),
  userLimit: z.number().int().min(1).default(1),
  maxCompanies: z.number().int().min(0).default(1),
  storageLimitGb: z.number().int().min(0).default(1),
  apiRequests: z.number().int().min(0).default(0),
  maxCustomers: z.number().int().min(0).default(0),
  maxVendors: z.number().int().min(0).default(0),
  maxProducts: z.number().int().min(0).default(0),
  maxInvoices: z.number().int().min(0).default(0),
  maxTransactions: z.number().int().min(0).default(0),
  maxBankAccounts: z.number().int().min(0).default(0),
  maxWarehouses: z.number().int().min(0).default(0),
  maxProjects: z.number().int().min(0).default(0),
  maxAssets: z.number().int().min(0).default(0),
  maxReports: z.number().int().min(0).default(0),
  maxAiRequests: z.number().int().min(0).default(0),
  maxOcrDocuments: z.number().int().min(0).default(0),
  supportLevel: z.string().default('community'),
  popularBadge: z.boolean().default(false),
  recommendedBadge: z.boolean().default(false),
  ribbonColor: z.string().nullable().optional(),
  buttonText: z.string().default('Subscribe'),
  isActive: z.boolean().default(true),
  isArchived: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  isPublic: z.boolean().default(true),
});

export const couponSchema = z.object({
  code: z.string().min(1),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed_amount']).default('percentage'),
  discountPercent: z.number().int().min(0).max(100).optional(),
  discountAmountKobo: z.number().int().min(0).optional(),
  maxRedemptions: z.number().int().min(0).default(0),
  minAmountKobo: z.number().int().min(0).optional(),
  maxAmountKobo: z.number().int().min(0).optional(),
  applicablePlanIds: z.array(z.string().uuid()).optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().default(true),
  isFirstOrderOnly: z.boolean().default(false),
});

export const promotionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed_amount']).default('percentage'),
  discountPercent: z.number().int().min(0).max(100).optional(),
  discountAmountKobo: z.number().int().min(0).optional(),
  applicablePlanIds: z.array(z.string().uuid()).optional(),
  startDate: z.string().transform(v => new Date(v)),
  endDate: z.string().transform(v => new Date(v)),
  maxRedemptions: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const subscriptionCreateSchema = z.object({
  planId: z.string().uuid(),
  couponCode: z.string().optional(),
  promotionId: z.string().uuid().optional(),
  billingCycle: z.enum(['monthly', 'yearly', 'quarterly']).optional(),
});

// ── Plans ──

export async function getPlans(orgId?: string, publicOnly?: boolean): Promise<any[]> {
  const conditions: any[] = [];
  if (orgId) {
    conditions.push(or(eq(subscriptionPlans.orgId, orgId), isNull(subscriptionPlans.orgId)));
  }
  if (publicOnly) {
    conditions.push(eq(subscriptionPlans.isPublic, true));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return await db
    .select()
    .from(subscriptionPlans)
    .where(whereClause)
    .orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.name));
}

export async function getPlan(planId: string): Promise<any> {
  const [row] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);
  if (!row) throw new AppError('Plan not found.', 404);
  return row;
}

export async function createPlan(data: any, orgId?: string, userId?: string, req?: any): Promise<any> {
  const parsed = planSchema.parse(data);
  const [plan] = await db.insert(subscriptionPlans).values({
    ...parsed,
    orgId: orgId || null,
  } as any).returning();
  if (userId) {
    const meta = req ? extractReqMeta(req) : { ipAddress: null, userAgent: null };
    await createAuditLog({
      orgId: plan.orgId || orgId || '',
      userId,
      action: 'create',
      entityType: 'subscription_plan',
      entityId: plan.id,
      oldValues: {},
      newValues: plan,
      ...meta,
    });
  }
  return plan;
}

export async function updatePlan(planId: string, data: any, orgId?: string, userId?: string, req?: any): Promise<any> {
  const existing = await getPlan(planId);
  const parsed = planSchema.partial().parse(data);
  const [updated] = await db.update(subscriptionPlans)
    .set({ ...parsed, updatedAt: new Date() } as any)
    .where(eq(subscriptionPlans.id, planId))
    .returning();
  if (userId) {
    const meta = req ? extractReqMeta(req) : { ipAddress: null, userAgent: null };
    await createAuditLog({
      orgId: orgId || updated.orgId || '',
      userId,
      action: 'update',
      entityType: 'subscription_plan',
      entityId: planId,
      oldValues: existing,
      newValues: updated,
      ...meta,
    });
  }
  return updated;
}

export async function deactivatePlan(planId: string): Promise<any> {
  const existing = await getPlan(planId);
  const [updated] = await db.update(subscriptionPlans)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(subscriptionPlans.id, planId))
    .returning();
  return updated;
}

// ── Subscriptions ──

export async function getOrgSubscription(orgId: string): Promise<any> {
  const rows = await db
    .select({
      subscription: subscriptions,
      plan: subscriptionPlans,
    })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(and(
      eq(subscriptions.orgId, orgId),
      inArray(subscriptions.status, ['active', 'free_trial', 'grace_period']),
    ))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  if (rows.length === 0) return null;
  return { ...rows[0].subscription, plan: rows[0].plan };
}

export async function createSubscription(orgId: string, userId: string, data: any, req?: any): Promise<any> {
  const parsed = subscriptionCreateSchema.parse(data);
  const plan = await getPlan(parsed.planId);
  if (!plan.isActive) throw new AppError('Plan is not active.', 400);

  // Check for existing active/trialing subscription
  const existing = await getOrgSubscription(orgId);
  if (existing) throw new AppError('Organization already has an active subscription.', 409);

  let coupon: any = null;
  let promotion: any = null;

  // Validate coupon
  if (parsed.couponCode) {
    coupon = await validateCoupon(parsed.couponCode, orgId, parsed.planId, plan.monthlyPriceKobo);
    if (coupon.isFirstOrderOnly) {
      const prevInvoices = await db
        .select({ id: subscriptionInvoices.id })
        .from(subscriptionInvoices)
        .where(eq(subscriptionInvoices.orgId, orgId))
        .limit(1);
      if (prevInvoices.length > 0) throw new AppError('Coupon is for first order only.', 400);
    }
  }

  // Validate promotion
  if (parsed.promotionId) {
    promotion = await validatePromotion(parsed.promotionId, orgId, parsed.planId);
  }

  const now = new Date();
  const billingCycle = parsed.billingCycle || plan.billingCycle;
  const periodEnd = addBillingDuration(now, billingCycle);
  const billingCycleAnchor = now;
  const hasTrial = plan.trialDays > 0;
  const status = plan.monthlyPriceKobo === 0 ? 'active' : hasTrial ? 'trialing' : 'incomplete';

  const [subscription] = await db.insert(subscriptions).values({
    orgId,
    planId: plan.id,
    status,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    trialStart: hasTrial ? now : null,
    trialEnd: hasTrial ? addDays(now, plan.trialDays) : null,
    billingCycleAnchor,
    couponId: coupon?.id || null,
    promotionId: promotion?.id || null,
    autoRenew: true,
    nextBillingDate: hasTrial ? addDays(now, plan.trialDays) : now,
    metadata: {},
  } as any).returning();

  // Create initial invoice
  if (plan.monthlyPriceKobo > 0) {
    const periodStart = hasTrial ? addDays(now, plan.trialDays) : now;
    const periodEndInv = hasTrial ? addDays(addDays(now, plan.trialDays), billingCycleToDays(billingCycle)) : periodEnd;
    await generateInvoice(orgId, subscription.id, periodStart, periodEndInv, coupon, promotion);
  }

  const meta = req ? extractReqMeta(req) : { ipAddress: null, userAgent: null };
  await createAuditLog({
    orgId,
    userId,
    action: 'create',
    entityType: 'subscription',
    entityId: subscription.id,
    oldValues: {},
    newValues: subscription,
    ...meta,
  });

  return { ...subscription, plan };
}

export async function changePlan(subscriptionId: string, newPlanId: string, orgId: string, userId: string, prorate?: boolean, req?: any): Promise<any> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.orgId, orgId)))
    .limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  const newPlan = await getPlan(newPlanId);
  if (!newPlan.isActive) throw new AppError('New plan is not active.', 400);

  const oldPlan = await getPlan(sub.planId);
  const oldPrice = oldPlan.priceKobo;
  const newPrice = newPlan.priceKobo;

  let credit = 0;
  let charge = 0;

  if (prorate && oldPrice > 0) {
    const now = new Date();
    const totalDays = billingCycleToDays(oldPlan.billingCycle);
    const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : addDays(now, totalDays);
    const daysRemaining = Math.max(0, Math.floor((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const prorata = prorateAmount(oldPrice, newPrice, daysRemaining, totalDays);
    credit = prorata.creditKobo;
    charge = prorata.chargeKobo;
  }

  const now = new Date();
  const billingCycle = oldPlan.billingCycle;
  const newPeriodEnd = addBillingDuration(now, billingCycle);

  const [updated] = await db.update(subscriptions)
    .set({
      planId: newPlanId,
      currentPeriodStart: now,
      currentPeriodEnd: newPeriodEnd,
      billingCycleAnchor: now,
      updatedAt: now,
    } as any)
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  // Create adjustment invoice if prorated amounts differ
  if (prorate && (credit > 0 || charge > 0)) {
    const netCharge = charge > credit ? charge - credit : 0;
    if (netCharge > 0) {
      await generateInvoice(orgId, subscriptionId, now, newPeriodEnd, null, null, netCharge);
    }
    if (credit >= charge) {
      // Credit applies to future invoices — create zero-amount invoice as credit note
    }
  }

  const meta = req ? extractReqMeta(req) : { ipAddress: null, userAgent: null };
  await createAuditLog({
    orgId,
    userId,
    action: 'update',
    entityType: 'subscription',
    entityId: subscriptionId,
    oldValues: { planId: sub.planId },
    newValues: { planId: newPlanId },
    ...meta,
  });

  return { ...updated, plan: newPlan };
}

export async function cancelSubscription(subscriptionId: string, orgId: string, userId: string, atPeriodEnd?: boolean, req?: any): Promise<any> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.orgId, orgId)))
    .limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  const updateData: any = { updatedAt: new Date() };

  if (atPeriodEnd && sub.currentPeriodEnd) {
    updateData.canceledAt = sub.currentPeriodEnd;
  } else {
    updateData.status = 'canceled';
    updateData.canceledAt = new Date();
    updateData.autoRenew = false;
  }

  const [updated] = await db.update(subscriptions)
    .set(updateData)
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  const meta = req ? extractReqMeta(req) : { ipAddress: null, userAgent: null };
  await createAuditLog({
    orgId,
    userId,
    action: 'update',
    entityType: 'subscription',
    entityId: subscriptionId,
    oldValues: { status: sub.status },
    newValues: { status: updated.status, canceledAt: updated.canceledAt },
    ...meta,
  });

  return updated;
}

export async function renewSubscription(subscriptionId: string, orgId: string, userId: string, req?: any): Promise<any> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.orgId, orgId)))
    .limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  const plan = await getPlan(sub.planId);
  const now = new Date();
  const billingCycle = plan.billingCycle;
  const newPeriodEnd = addBillingDuration(now, billingCycle);

  const [updated] = await db.update(subscriptions)
    .set({
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: newPeriodEnd,
      canceledAt: null,
      nextBillingDate: now,
      updatedAt: now,
    } as any)
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  // Generate new invoice for renewal period
  await generateInvoice(orgId, subscriptionId, now, newPeriodEnd);

  const meta = req ? extractReqMeta(req) : { ipAddress: null, userAgent: null };
  await createAuditLog({
    orgId,
    userId,
    action: 'update',
    entityType: 'subscription',
    entityId: subscriptionId,
    oldValues: { status: sub.status },
    newValues: { status: 'active' },
    ...meta,
  });

  return updated;
}

export async function updateSubscriptionStatus(subscriptionId: string, status: string, orgId?: string): Promise<any> {
  const validStatuses = ['active', 'trialing', 'canceled', 'past_due', 'incomplete', 'incomplete_expired'];
  if (!validStatuses.includes(status)) throw new AppError(`Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}`, 400);

  const conditions: any[] = [eq(subscriptions.id, subscriptionId)];
  if (orgId) conditions.push(eq(subscriptions.orgId, orgId));

  const [updated] = await db.update(subscriptions)
    .set({ status: status as any, updatedAt: new Date() })
    .where(and(...conditions))
    .returning();

  if (!updated) throw new AppError('Subscription not found.', 404);
  return updated;
}

// ── Coupons ──

export async function getCoupons(orgId?: string): Promise<any[]> {
  const conditions: any[] = [];
  if (orgId) {
    conditions.push(or(eq(coupons.orgId, orgId), isNull(coupons.orgId)));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return await db
    .select()
    .from(coupons)
    .where(whereClause)
    .orderBy(desc(coupons.createdAt));
}

export async function getCoupon(couponId: string, orgId?: string): Promise<any> {
  const conditions: any[] = [eq(coupons.id, couponId)];
  if (orgId) conditions.push(or(eq(coupons.orgId, orgId), isNull(coupons.orgId)));
  const [row] = await db
    .select()
    .from(coupons)
    .where(and(...conditions))
    .limit(1);
  if (!row) throw new AppError('Coupon not found.', 404);
  return row;
}

export async function createCoupon(data: any, userId?: string, req?: any): Promise<any> {
  const parsed = couponSchema.parse(data);
  const [coupon] = await db.insert(coupons).values({
    ...parsed,
    expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    createdBy: userId || null,
  } as any).returning();
  if (userId) {
    const meta = req ? extractReqMeta(req) : { ipAddress: null, userAgent: null };
    await createAuditLog({
      orgId: coupon.orgId || '',
      userId,
      action: 'create',
      entityType: 'coupon',
      entityId: coupon.id,
      oldValues: {},
      newValues: coupon,
      ...meta,
    });
  }
  return coupon;
}

export async function validateCoupon(code: string, orgId: string, planId?: string, amountKobo?: number): Promise<any> {
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.code, code), or(eq(coupons.orgId, orgId), isNull(coupons.orgId))))
    .limit(1);
  if (!coupon) throw new AppError('Coupon not found.', 404);
  if (!coupon.isActive) throw new AppError('Coupon is no longer active.', 400);
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) throw new AppError('Coupon has expired.', 400);
  if ((coupon.maxRedemptions ?? 0) > 0 && coupon.currentRedemptions >= (coupon.maxRedemptions ?? 0)) {
    throw new AppError('Coupon has reached maximum redemptions.', 400);
  }
  if (planId && coupon.applicablePlanIds && coupon.applicablePlanIds.length > 0) {
    if (!coupon.applicablePlanIds.includes(planId)) {
      throw new AppError('Coupon is not applicable to this plan.', 400);
    }
  }
  if (amountKobo != null && coupon.minAmountKobo != null && amountKobo < coupon.minAmountKobo) {
    throw new AppError(`Minimum amount of ${coupon.minAmountKobo} kobo required for this coupon.`, 400);
  }
  if (amountKobo != null && coupon.maxAmountKobo != null && amountKobo > coupon.maxAmountKobo) {
    throw new AppError(`Coupon only applies to amounts up to ${coupon.maxAmountKobo} kobo.`, 400);
  }
  return coupon;
}

export async function redeemCoupon(couponId: string): Promise<any> {
  const [updated] = await db.update(coupons)
    .set({
      currentRedemptions: sql`${coupons.currentRedemptions} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(coupons.id, couponId))
    .returning();
  return updated;
}

// ── Promotions ──

export async function getPromotions(orgId?: string): Promise<any[]> {
  const conditions: any[] = [];
  if (orgId) {
    conditions.push(or(eq(promotions.orgId, orgId), isNull(promotions.orgId)));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return await db
    .select()
    .from(promotions)
    .where(whereClause)
    .orderBy(desc(promotions.createdAt));
}

export async function getPromotion(promotionId: string, orgId?: string): Promise<any> {
  const conditions: any[] = [eq(promotions.id, promotionId)];
  if (orgId) conditions.push(or(eq(promotions.orgId, orgId), isNull(promotions.orgId)));
  const [row] = await db
    .select()
    .from(promotions)
    .where(and(...conditions))
    .limit(1);
  if (!row) throw new AppError('Promotion not found.', 404);
  return row;
}

export async function createPromotion(data: any, userId?: string, req?: any): Promise<any> {
  const parsed = promotionSchema.parse(data);
  const [promotion] = await db.insert(promotions).values({
    ...parsed,
    createdBy: userId || null,
  } as any).returning();
  if (userId) {
    const meta = req ? extractReqMeta(req) : { ipAddress: null, userAgent: null };
    await createAuditLog({
      orgId: promotion.orgId || '',
      userId,
      action: 'create',
      entityType: 'promotion',
      entityId: promotion.id,
      oldValues: {},
      newValues: promotion,
      ...meta,
    });
  }
  return promotion;
}

export async function updatePromotion(promotionId: string, data: any, orgId?: string, userId?: string, req?: any): Promise<any> {
  const existing = await getPromotion(promotionId, orgId);
  const parsed = promotionSchema.partial().parse(data);
  const [updated] = await db.update(promotions)
    .set({ ...parsed, updatedAt: new Date() } as any)
    .where(eq(promotions.id, promotionId))
    .returning();
  if (userId) {
    const meta = req ? extractReqMeta(req) : { ipAddress: null, userAgent: null };
    await createAuditLog({
      orgId: orgId || updated.orgId || '',
      userId,
      action: 'update',
      entityType: 'promotion',
      entityId: promotionId,
      oldValues: existing,
      newValues: updated,
      ...meta,
    });
  }
  return updated;
}

export async function validatePromotion(promotionId: string, orgId: string, planId?: string): Promise<any> {
  const promo = await getPromotion(promotionId, orgId);
  if (!promo.isActive) throw new AppError('Promotion is no longer active.', 400);
  const now = new Date();
  if (new Date(promo.startDate) > now) throw new AppError('Promotion has not started yet.', 400);
  if (new Date(promo.endDate) < now) throw new AppError('Promotion has ended.', 400);
  if ((promo.maxRedemptions ?? 0) > 0 && promo.currentRedemptions >= (promo.maxRedemptions ?? 0)) {
    throw new AppError('Promotion has reached maximum redemptions.', 400);
  }
  if (planId && promo.applicablePlanIds && promo.applicablePlanIds.length > 0) {
    if (!promo.applicablePlanIds.includes(planId)) {
      throw new AppError('Promotion is not applicable to this plan.', 400);
    }
  }
  return promo;
}

// ── Invoices ──

export async function getSubscriptionInvoices(orgId: string, subscriptionId?: string): Promise<any[]> {
  const conditions: any[] = [eq(subscriptionInvoices.orgId, orgId)];
  if (subscriptionId) {
    conditions.push(eq(subscriptionInvoices.subscriptionId, subscriptionId));
  }
  return await db
    .select({
      invoice: subscriptionInvoices,
      subscription: {
        id: subscriptions.id,
        status: subscriptions.status,
        planId: subscriptions.planId,
      },
      plan: {
        id: subscriptionPlans.id,
        name: subscriptionPlans.name,
        code: subscriptionPlans.code,
      },
    })
    .from(subscriptionInvoices)
    .leftJoin(subscriptions, eq(subscriptionInvoices.subscriptionId, subscriptions.id))
    .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(and(...conditions))
    .orderBy(desc(subscriptionInvoices.createdAt));
}

export async function generateInvoice(
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
  const amountKobo = overrideAmountKobo != null ? overrideAmountKobo : plan.monthlyPriceKobo;

  // Calculate discount
  const { discountKobo, description: discountDesc } = calculateDiscount(
    amountKobo,
    coupon || (sub.couponId ? await getCoupon(sub.couponId, orgId) : null),
    promotion || (sub.promotionId ? await getPromotion(sub.promotionId, orgId) : null),
  );

  const invoiceNumber = await generateInvoiceNumber(orgId);
  const totalKobo = Math.max(0, amountKobo - discountKobo);
  const taxKobo = 0; // No tax by default on subscription invoices

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

  // Increment coupon redemptions if applicable
  const effectiveCoupon = coupon || (sub.couponId ? await getCoupon(sub.couponId, orgId).catch(() => null) : null);
  if (effectiveCoupon) {
    await redeemCoupon(effectiveCoupon.id);
  }
  // Increment promotion redemptions if applicable
  const effectivePromo = promotion || (sub.promotionId ? await getPromotion(sub.promotionId, orgId).catch(() => null) : null);
  if (effectivePromo) {
    await db.update(promotions)
      .set({ currentRedemptions: sql`${promotions.currentRedemptions} + 1`, updatedAt: new Date() })
      .where(eq(promotions.id, effectivePromo.id));
  }

  return invoice;
}

export async function markInvoicePaid(invoiceId: string, paidBy: string): Promise<any> {
  const [updated] = await db.update(subscriptionInvoices)
    .set({
      status: 'paid',
      paidAt: new Date(),
      paidBy,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionInvoices.id, invoiceId))
    .returning();
  if (!updated) throw new AppError('Invoice not found.', 404);

  // Update subscription's last payment date
  if (updated.subscriptionId) {
    await db.update(subscriptions)
      .set({ lastPaymentDate: new Date(), status: 'active', updatedAt: new Date() })
      .where(eq(subscriptions.id, updated.subscriptionId));
  }

  return updated;
}

export async function markInvoiceOverdue(invoiceId: string): Promise<any> {
  const [updated] = await db.update(subscriptionInvoices)
    .set({ status: 'overdue', updatedAt: new Date() })
    .where(eq(subscriptionInvoices.id, invoiceId))
    .returning();
  if (!updated) throw new AppError('Invoice not found.', 404);

  // Mark subscription as past_due
  if (updated.subscriptionId) {
    await db.update(subscriptions)
      .set({ status: 'grace_period', updatedAt: new Date() })
      .where(eq(subscriptions.id, updated.subscriptionId));
  }

  return updated;
}

// ── Usage & Entitlements ──

export async function getOrgEntitlements(orgId: string): Promise<{ plan: any; features: Record<string, any>; limits: Record<string, number> }> {
  const sub = await getOrgSubscription(orgId);
  if (!sub) {
    return { plan: null, features: {}, limits: {} };
  }

  const plan = sub.plan || await getPlan(sub.planId);
  const features: Record<string, any> = {
    invoicing: true,
    expenses: true,
    banking: true,
    multiUser: plan.userLimit > 1,
    api: plan.apiRequests > 0,
    support: plan.supportLevel,
    currency: plan.currency,
  };
  const limits: Record<string, number> = {
    users: plan.userLimit,
    companies: plan.maxCompanies,
    storageGb: plan.storageLimitGb,
    apiRequests: plan.apiRequests,
    customers: plan.maxCustomers,
    vendors: plan.maxVendors,
    products: plan.maxProducts,
    invoices: plan.maxInvoices,
    transactions: plan.maxTransactions,
    bankAccounts: plan.maxBankAccounts,
    warehouses: plan.maxWarehouses,
    projects: plan.maxProjects,
    assets: plan.maxAssets,
    reports: plan.maxReports,
    aiRequests: plan.maxAiRequests,
    ocrDocuments: plan.maxOcrDocuments,
  };

  // Apply plan-level overrides
  const planOverrides = await db
    .select()
    .from(subscriptionFeatureOverrides)
    .where(and(
      eq(subscriptionFeatureOverrides.planId, plan.id),
      isNull(subscriptionFeatureOverrides.subscriptionId),
    ));

  for (const ov of planOverrides) {
    features[ov.featureKey] = ov.featureValue;
    if (ov.isLimit && typeof ov.featureValue === 'number') {
      limits[ov.featureKey] = ov.featureValue;
    }
  }

  // Apply subscription-level overrides (higher priority)
  const subOverrides = await db
    .select()
    .from(subscriptionFeatureOverrides)
    .where(eq(subscriptionFeatureOverrides.subscriptionId, sub.id));

  for (const ov of subOverrides) {
    features[ov.featureKey] = ov.featureValue;
    if (ov.isLimit && typeof ov.featureValue === 'number') {
      limits[ov.featureKey] = ov.featureValue;
    }
  }

  return { plan, features, limits };
}

export async function checkFeatureAccess(orgId: string, featureKey: string): Promise<boolean> {
  const { features } = await getOrgEntitlements(orgId);
  return features[featureKey] === true || features[featureKey] === 'true' || features[featureKey] === 1;
}

export async function recordUsage(orgId: string, subscriptionId: string, featureKey: string, count?: number): Promise<any> {
  const increment = count || 1;
  const now = new Date();

  // Get current period bounds
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  const periodStart = sub.currentPeriodStart;
  const periodEnd = sub.currentPeriodEnd;

  // Upsert usage record
  const [existing] = await db
    .select()
    .from(subscriptionUsage)
    .where(and(
      eq(subscriptionUsage.subscriptionId, subscriptionId),
      eq(subscriptionUsage.featureKey, featureKey),
      eq(subscriptionUsage.periodStart, periodStart),
      eq(subscriptionUsage.periodEnd, periodEnd),
    ))
    .limit(1);

  if (existing) {
    const [updated] = await db.update(subscriptionUsage)
      .set({
        usageCount: sql`${subscriptionUsage.usageCount} + ${increment}`,
        updatedAt: now,
      })
      .where(eq(subscriptionUsage.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(subscriptionUsage).values({
    orgId,
    subscriptionId,
    featureKey,
    usageCount: increment,
    periodStart,
    periodEnd,
  } as any).returning();
  return created;
}

export async function getUsage(orgId: string, subscriptionId: string, featureKey?: string): Promise<any[]> {
  const conditions: any[] = [
    eq(subscriptionUsage.orgId, orgId),
    eq(subscriptionUsage.subscriptionId, subscriptionId),
  ];
  if (featureKey) {
    conditions.push(eq(subscriptionUsage.featureKey, featureKey));
  }
  return await db
    .select()
    .from(subscriptionUsage)
    .where(and(...conditions))
    .orderBy(desc(subscriptionUsage.createdAt));
}

export async function checkUsageLimit(orgId: string, featureKey: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const sub = await getOrgSubscription(orgId);
  if (!sub) return { allowed: false, current: 0, limit: 0 };

  const { limits } = await getOrgEntitlements(orgId);
  const limit = limits[featureKey];
  if (limit == null) return { allowed: true, current: 0, limit: 0 };

  // Sum usage for current period
  const now = new Date();
  const [usageRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${subscriptionUsage.usageCount}), 0)`,
    })
    .from(subscriptionUsage)
    .where(and(
      eq(subscriptionUsage.subscriptionId, sub.id),
      eq(subscriptionUsage.featureKey, featureKey),
      lte(subscriptionUsage.periodStart, now),
      gte(subscriptionUsage.periodEnd, now),
    ));

  const current = Number(usageRow?.total || 0);
  return { allowed: current < limit, current, limit };
}

// ── Helper Functions ──

export async function generateInvoiceNumber(orgId: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const prefix = `SUB-INV-${year}-`;

  // Find the last invoice number for this org and year to increment
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

export function calculateDiscount(amountKobo: number, coupon?: any, promotion?: any): { discountKobo: number; description: string } {
  let discountKobo = 0;
  const parts: string[] = [];

  // Apply coupon discount
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

  // Apply promotion discount
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

  // Cap discount at total amount
  discountKobo = Math.min(discountKobo, amountKobo);

  return { discountKobo, description: parts.join('; ') || 'No discount' };
}

export function prorateAmount(
  currentPlanPrice: number,
  newPlanPrice: number,
  daysRemaining: number,
  totalDays: number,
): { creditKobo: number; chargeKobo: number } {
  if (totalDays <= 0) return { creditKobo: 0, chargeKobo: 0 };

  const dailyCurrent = currentPlanPrice / totalDays;
  const dailyNew = newPlanPrice / totalDays;

  // Credit for unused days on current plan
  const creditKobo = Math.round(dailyCurrent * daysRemaining);
  // Charge for new plan for remaining days
  const chargeKobo = Math.round(dailyNew * daysRemaining);

  return { creditKobo, chargeKobo };
}

// ── Internal Helpers ──

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

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}
