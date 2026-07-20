import { eq, and, or, inArray, sql, desc, lt, gt, lte, gte, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db, subscriptions, subscriptionPlans, coupons, promotions, promotionalCampaigns, referralCodes, partnerDiscounts, redemptionHistory, subscriptionInvoices, organisations, users } from '../db/schema';
import { AppError, ValidationError } from '../lib/errors';
import { createAuditLog, extractReqMeta } from './audit.service';

// ── Zod Schemas ──

export const campaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['general', 'seasonal', 'holiday', 'product_launch', 'reactivation']).default('general'),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).default('draft'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budgetKobo: z.number().int().min(0).optional(),
  targetPlanIds: z.array(z.string().uuid()).optional(),
  targetRegions: z.array(z.string()).optional(),
  maxRedemptions: z.number().int().min(0).default(0),
});

export const referralCodeSchema = z.object({
  code: z.string().min(3).max(20),
  description: z.string().optional(),
  rewardType: z.enum(['percentage', 'fixed_amount', 'free_months']).default('fixed_amount'),
  rewardValue: z.number().int().min(0).default(0),
  rewardFreeMonths: z.number().int().min(0).default(0),
  maxRedemptions: z.number().int().min(0).default(0),
  rewardExpiresInDays: z.number().int().min(0).optional(),
  applicablePlanIds: z.array(z.string().uuid()).optional(),
  expiresAt: z.string().optional(),
});

export const partnerDiscountSchema = z.object({
  partnerName: z.string().min(1),
  partnerCode: z.string().min(3).max(20),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed_amount', 'free_months']).default('percentage'),
  discountPercent: z.number().int().min(0).max(100).optional(),
  discountAmountKobo: z.number().int().min(0).optional(),
  freeMonths: z.number().int().min(0).default(0),
  commissionPercent: z.number().int().min(0).max(100).default(0),
  commissionAmountKobo: z.number().int().min(0).optional(),
  applicablePlanIds: z.array(z.string().uuid()).optional(),
  maxRedemptions: z.number().int().min(0).default(0),
  regionRestrictions: z.array(z.string()).optional(),
  expiresAt: z.string().optional(),
});

export const couponSchemaExtended = z.object({
  code: z.string().min(1),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed_amount', 'free_months']).default('percentage'),
  discountPercent: z.number().int().min(0).max(100).optional(),
  discountAmountKobo: z.number().int().min(0).optional(),
  freeMonths: z.number().int().min(0).default(0),
  maxRedemptions: z.number().int().min(0).default(0),
  minAmountKobo: z.number().int().min(0).optional(),
  maxAmountKobo: z.number().int().min(0).optional(),
  applicablePlanIds: z.array(z.string().uuid()).optional(),
  minPlanId: z.string().uuid().optional(),
  maxPlanId: z.string().uuid().optional(),
  regionRestrictions: z.array(z.string()).optional(),
  campaignId: z.string().uuid().optional(),
  isStackable: z.boolean().default(false),
  priority: z.number().int().default(0),
  requireMinimumPayment: z.boolean().default(false),
  expiresAt: z.string().optional(),
  isFirstOrderOnly: z.boolean().default(false),
});

export const promotionSchemaExtended = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed_amount', 'free_months']).default('percentage'),
  discountPercent: z.number().int().min(0).max(100).optional(),
  discountAmountKobo: z.number().int().min(0).optional(),
  freeMonths: z.number().int().min(0).default(0),
  applicablePlanIds: z.array(z.string().uuid()).optional(),
  minPlanId: z.string().uuid().optional(),
  maxPlanId: z.string().uuid().optional(),
  regionRestrictions: z.array(z.string()).optional(),
  campaignId: z.string().uuid().optional(),
  isStackable: z.boolean().default(false),
  priority: z.number().int().default(0),
  budgetKobo: z.number().int().min(0).optional(),
  startDate: z.string().transform(v => new Date(v)),
  endDate: z.string().transform(v => new Date(v)),
  maxRedemptions: z.number().int().min(0).default(0),
});

export interface DiscountResult {
  discountKobo: number;
  freeMonths: number;
  description: string;
  breakdown: Array<{ type: string; source: string; amountKobo: number; freeMonths: number }>;
}

export interface ApplyPromoParams {
  orgId: string;
  planId: string;
  amountKobo: number;
  couponCode?: string;
  referralCode?: string;
  partnerCode?: string;
  isFirstOrder?: boolean;
  region?: string;
  billingCycle?: string;
}

// ── Campaigns ──

export async function getCampaigns(orgId?: string): Promise<any[]> {
  const conditions: any[] = [];
  if (orgId) conditions.push(or(eq(promotionalCampaigns.orgId, orgId), isNull(promotionalCampaigns.orgId)));
  return await db.select().from(promotionalCampaigns).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(promotionalCampaigns.createdAt));
}

export async function getCampaign(campaignId: string, orgId?: string): Promise<any> {
  const conditions: any[] = [eq(promotionalCampaigns.id, campaignId)];
  if (orgId) conditions.push(eq(promotionalCampaigns.orgId, orgId));
  const [row] = await db.select().from(promotionalCampaigns).where(and(...conditions)).limit(1);
  if (!row) throw new AppError('Campaign not found.', 404);
  return row;
}

export async function createCampaign(data: any, orgId: string, userId?: string): Promise<any> {
  const parsed = campaignSchema.parse(data);
  const [campaign] = await db.insert(promotionalCampaigns).values({
    ...parsed,
    orgId,
    startDate: parsed.startDate ? new Date(parsed.startDate) : null,
    endDate: parsed.endDate ? new Date(parsed.endDate) : null,
    createdBy: userId || null,
  } as any).returning();
  return campaign;
}

export async function updateCampaign(campaignId: string, data: any, orgId?: string, userId?: string): Promise<any> {
  const existing = await getCampaign(campaignId, orgId);
  const parsed = campaignSchema.partial().parse(data);
  const conditions: any[] = [eq(promotionalCampaigns.id, campaignId)];
  if (orgId) conditions.push(eq(promotionalCampaigns.orgId, orgId));
  const [updated] = await db.update(promotionalCampaigns).set({ ...parsed, updatedAt: new Date() } as any).where(and(...conditions)).returning();
  return updated;
}

export async function deleteCampaign(campaignId: string, orgId?: string): Promise<void> {
  const conditions: any[] = [eq(promotionalCampaigns.id, campaignId)];
  if (orgId) conditions.push(eq(promotionalCampaigns.orgId, orgId));
  await db.delete(promotionalCampaigns).where(and(...conditions));
}

// ── Referral Codes ──

export async function getReferralCodes(orgId?: string): Promise<any[]> {
  const conditions: any[] = [];
  if (orgId) conditions.push(eq(referralCodes.orgId, orgId));
  return await db.select().from(referralCodes).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(referralCodes.createdAt));
}

export async function getReferralCode(id: string, orgId?: string): Promise<any> {
  const conditions: any[] = [eq(referralCodes.id, id)];
  if (orgId) conditions.push(eq(referralCodes.orgId, orgId));
  const [row] = await db.select().from(referralCodes).where(and(...conditions)).limit(1);
  if (!row) throw new AppError('Referral code not found.', 404);
  return row;
}

export async function createReferralCode(data: any, orgId: string, userId?: string): Promise<any> {
  const parsed = referralCodeSchema.parse(data);
  const [existing] = await db.select({ id: referralCodes.id }).from(referralCodes).where(eq(referralCodes.code, parsed.code)).limit(1);
  if (existing) throw new AppError('Referral code already exists.', 409);
  const [ref] = await db.insert(referralCodes).values({
    ...parsed,
    orgId,
    expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    createdBy: userId || null,
  } as any).returning();
  return ref;
}

export async function updateReferralCode(id: string, data: any, orgId?: string): Promise<any> {
  const parsed = referralCodeSchema.partial().parse(data);
  const conditions: any[] = [eq(referralCodes.id, id)];
  if (orgId) conditions.push(eq(referralCodes.orgId, orgId));
  const [updated] = await db.update(referralCodes).set({ ...parsed, updatedAt: new Date() } as any).where(and(...conditions)).returning();
  return updated;
}

export async function deleteReferralCode(id: string, orgId?: string): Promise<void> {
  const conditions: any[] = [eq(referralCodes.id, id)];
  if (orgId) conditions.push(eq(referralCodes.orgId, orgId));
  await db.delete(referralCodes).where(and(...conditions));
}

// ── Partner Discounts ──

export async function getPartnerDiscounts(orgId?: string): Promise<any[]> {
  const conditions: any[] = [];
  if (orgId) conditions.push(or(eq(partnerDiscounts.orgId, orgId), isNull(partnerDiscounts.orgId)));
  return await db.select().from(partnerDiscounts).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(partnerDiscounts.createdAt));
}

export async function getPartnerDiscount(id: string, orgId?: string): Promise<any> {
  const conditions: any[] = [eq(partnerDiscounts.id, id)];
  if (orgId) conditions.push(eq(partnerDiscounts.orgId, orgId));
  const [row] = await db.select().from(partnerDiscounts).where(and(...conditions)).limit(1);
  if (!row) throw new AppError('Partner discount not found.', 404);
  return row;
}

export async function createPartnerDiscount(data: any, orgId: string, userId?: string): Promise<any> {
  const parsed = partnerDiscountSchema.parse(data);
  const [existing] = await db.select({ id: partnerDiscounts.id }).from(partnerDiscounts).where(eq(partnerDiscounts.partnerCode, parsed.partnerCode)).limit(1);
  if (existing) throw new AppError('Partner code already exists.', 409);
  const [partner] = await db.insert(partnerDiscounts).values({
    ...parsed,
    orgId,
    expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    createdBy: userId || null,
  } as any).returning();
  return partner;
}

export async function updatePartnerDiscount(id: string, data: any, orgId?: string): Promise<any> {
  const parsed = partnerDiscountSchema.partial().parse(data);
  const conditions: any[] = [eq(partnerDiscounts.id, id)];
  if (orgId) conditions.push(eq(partnerDiscounts.orgId, orgId));
  const [updated] = await db.update(partnerDiscounts).set({ ...parsed, updatedAt: new Date() } as any).where(and(...conditions)).returning();
  return updated;
}

export async function deletePartnerDiscount(id: string, orgId?: string): Promise<void> {
  const conditions: any[] = [eq(partnerDiscounts.id, id)];
  if (orgId) conditions.push(eq(partnerDiscounts.orgId, orgId));
  await db.delete(partnerDiscounts).where(and(...conditions));
}

// ── Redemption History ──

export async function getRedemptionHistory(orgId: string, filters?: { type?: string; subscriptionId?: string; invoiceId?: string }): Promise<any[]> {
  const conditions: any[] = [eq(redemptionHistory.orgId, orgId)];
  if (filters?.type) conditions.push(eq(redemptionHistory.redemptionType, filters.type));
  if (filters?.subscriptionId) conditions.push(eq(redemptionHistory.subscriptionId, filters.subscriptionId));
  if (filters?.invoiceId) conditions.push(eq(redemptionHistory.invoiceId, filters.invoiceId));
  return await db.select().from(redemptionHistory).where(and(...conditions)).orderBy(desc(redemptionHistory.createdAt));
}

// ── Extended Coupon/Promotion CRUD ──

export async function createCouponExtended(data: any, orgId: string, userId?: string): Promise<any> {
  const parsed = couponSchemaExtended.parse(data);
  const [coupon] = await db.insert(coupons).values({
    ...parsed,
    orgId,
    expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    createdBy: userId || null,
  } as any).returning();
  return coupon;
}

export async function updateCouponExtended(couponId: string, data: any, orgId?: string): Promise<any> {
  const conditions: any[] = [eq(coupons.id, couponId)];
  if (orgId) conditions.push(or(eq(coupons.orgId, orgId), isNull(coupons.orgId)));
  const [existing] = await db.select().from(coupons).where(and(...conditions)).limit(1);
  if (!existing) throw new AppError('Coupon not found.', 404);
  const parsed = couponSchemaExtended.partial().parse(data);
  const [updated] = await db.update(coupons).set({ ...parsed, updatedAt: new Date() } as any).where(and(...conditions)).returning();
  return updated;
}

export async function createPromotionExtended(data: any, orgId: string, userId?: string): Promise<any> {
  const parsed = promotionSchemaExtended.parse(data);
  const [promo] = await db.insert(promotions).values({
    ...parsed,
    orgId,
    createdBy: userId || null,
  } as any).returning();
  return promo;
}

export async function updatePromotionExtended(promotionId: string, data: any, orgId?: string): Promise<any> {
  const conditions: any[] = [eq(promotions.id, promotionId)];
  if (orgId) conditions.push(or(eq(promotions.orgId, orgId), isNull(promotions.orgId)));
  const [existing] = await db.select().from(promotions).where(and(...conditions)).limit(1);
  if (!existing) throw new AppError('Promotion not found.', 404);
  const parsed = promotionSchemaExtended.partial().parse(data);
  const [updated] = await db.update(promotions).set({ ...parsed, updatedAt: new Date() } as any).where(and(...conditions)).returning();
  return updated;
}

// ── Discount Application Engine ──

export async function applyDiscounts(params: ApplyPromoParams): Promise<DiscountResult> {
  const { orgId, planId, amountKobo, isFirstOrder, region } = params;
  const plan = await getPlan(planId);
  const breakdown: Array<{ type: string; source: string; amountKobo: number; freeMonths: number }> = [];
  let totalDiscountKobo = 0;
  let totalFreeMonths = 0;
  const descriptions: string[] = [];

  // 1. Apply coupon if provided
  if (params.couponCode) {
    const couponResult = await validateAndApplyCoupon(params.couponCode, orgId, planId, amountKobo, isFirstOrder, region);
    if (couponResult) {
      totalDiscountKobo += couponResult.discountKobo;
      totalFreeMonths += (couponResult.freeMonths || 0);
      breakdown.push({ type: 'coupon', source: params.couponCode, amountKobo: couponResult.discountKobo, freeMonths: couponResult.freeMonths || 0 });
      descriptions.push(couponResult.description);
    }
  }

  // 2. Apply referral code if provided
  if (params.referralCode) {
    const referralResult = await validateAndApplyReferral(params.referralCode, orgId, planId, amountKobo);
    if (referralResult) {
      totalDiscountKobo += referralResult.discountKobo;
      totalFreeMonths += (referralResult.freeMonths || 0);
      breakdown.push({ type: 'referral', source: params.referralCode, amountKobo: referralResult.discountKobo, freeMonths: referralResult.freeMonths || 0 });
      descriptions.push(referralResult.description);
    }
  }

  // 3. Apply partner code if provided
  if (params.partnerCode) {
    const partnerResult = await validateAndApplyPartner(params.partnerCode, orgId, planId, amountKobo, region);
    if (partnerResult) {
      totalDiscountKobo += partnerResult.discountKobo;
      totalFreeMonths += (partnerResult.freeMonths || 0);
      breakdown.push({ type: 'partner', source: params.partnerCode, amountKobo: partnerResult.discountKobo, freeMonths: partnerResult.freeMonths || 0 });
      descriptions.push(partnerResult.description);
    }
  }

  // 4. Find and apply any active auto promotions (not tied to a specific coupon/referral/partner)
  const autoPromotions = await findActivePromotions(orgId, planId, amountKobo, region);
  for (const promo of autoPromotions) {
    const promoResult = calculatePromotionDiscount(promo, amountKobo);
    if (promoResult.discountKobo > 0 || (promoResult.freeMonths || 0) > 0) {
      totalDiscountKobo += promoResult.discountKobo;
      totalFreeMonths += (promoResult.freeMonths || 0);
      breakdown.push({ type: 'promotion', source: promo.name, amountKobo: promoResult.discountKobo, freeMonths: promoResult.freeMonths || 0 });
      descriptions.push(promoResult.description);
    }
  }

  // Cap total discount at amount
  totalDiscountKobo = Math.min(totalDiscountKobo, amountKobo);

  return {
    discountKobo: totalDiscountKobo,
    freeMonths: totalFreeMonths,
    description: descriptions.join('; ') || 'No discount',
    breakdown,
  };
}

export async function recordRedemption(params: {
  orgId: string;
  subscriptionId?: string;
  invoiceId?: string;
  redemptionType: string;
  sourceId: string;
  sourceCode?: string;
  discountType: string;
  discountValue: number;
  discountKobo: number;
  freeMonths: number;
  originalAmountKobo: number;
  finalAmountKobo: number;
  metadata?: any;
  redeemedBy?: string;
}): Promise<any> {
  const [record] = await db.insert(redemptionHistory).values({
    orgId: params.orgId,
    subscriptionId: params.subscriptionId || null,
    invoiceId: params.invoiceId || null,
    redemptionType: params.redemptionType,
    sourceId: params.sourceId,
    sourceCode: params.sourceCode || null,
    discountType: params.discountType as any,
    discountValue: params.discountValue,
    discountKobo: params.discountKobo,
    freeMonths: params.freeMonths,
    originalAmountKobo: params.originalAmountKobo,
    finalAmountKobo: params.finalAmountKobo,
    metadata: params.metadata || {},
    redeemedBy: params.redeemedBy || null,
  } as any).returning();

  // Increment counters on the source
  await incrementSourceRedemption(params.redemptionType, params.sourceId, params.discountKobo);

  return record;
}

// ── Auto-Apply at Checkout ──

export async function autoApplyPromotions(params: { orgId: string; planId: string; amountKobo: number; isFirstOrder?: boolean; region?: string }): Promise<{ coupons: any[]; promotions: any[]; referrals: any[] }> {
  const { orgId, planId, amountKobo, isFirstOrder, region } = params;

  // Find active coupons that auto-apply (no code required — for campaigns)
  const activeCoupons = await db.select().from(coupons).where(and(
    eq(coupons.isActive, true),
    or(eq(coupons.orgId, orgId), isNull(coupons.orgId)),
    or(isNull(coupons.expiresAt), gt(coupons.expiresAt, new Date())),
    or(eq(coupons.maxRedemptions, 0), lt(coupons.currentRedemptions, coupons.maxRedemptions)),
  )).orderBy(desc(coupons.priority));

  // Filter coupons matching plan & first-order
  const validCoupons = activeCoupons.filter(c => {
    if (c.isFirstOrderOnly && !isFirstOrder) return false;
    if (c.applicablePlanIds?.length && !c.applicablePlanIds.includes(planId)) return false;
    if (c.minPlanId && c.minPlanId !== planId) return false;
    if (c.maxPlanId && c.maxPlanId !== planId) return false;
    if (c.regionRestrictions?.length && region && !c.regionRestrictions.includes(region)) return false;
    if (c.minAmountKobo && amountKobo < c.minAmountKobo) return false;
    if (c.maxAmountKobo && amountKobo > c.maxAmountKobo) return false;
    return true;
  });

  // Find active promotions
  const now = new Date();
  const activePromotions = await db.select().from(promotions).where(and(
    eq(promotions.isActive, true),
    or(eq(promotions.orgId, orgId), isNull(promotions.orgId)),
    lte(promotions.startDate, now),
    gte(promotions.endDate, now),
    or(eq(promotions.maxRedemptions, 0), lt(promotions.currentRedemptions, promotions.maxRedemptions)),
  ));

  const validPromotions = activePromotions.filter(p => {
    if (p.applicablePlanIds?.length && !p.applicablePlanIds.includes(planId)) return false;
    if (p.minPlanId && p.minPlanId !== planId) return false;
    if (p.maxPlanId && p.maxPlanId !== planId) return false;
    if (p.regionRestrictions?.length && region && !p.regionRestrictions.includes(region)) return false;
    if (p.budgetKobo && (p.spentKobo || 0) >= p.budgetKobo) return false;
    return true;
  });

  return { coupons: validCoupons, promotions: validPromotions, referrals: [] };
}

// ── Internal Helpers ──

async function validateAndApplyCoupon(code: string, orgId: string, planId: string, amountKobo: number, isFirstOrder?: boolean, region?: string): Promise<{ discountKobo: number; freeMonths: number; description: string; sourceId: string } | null> {
  const [coupon] = await db.select().from(coupons).where(and(eq(coupons.code, code), or(eq(coupons.orgId, orgId), isNull(coupons.orgId)))).limit(1);
  if (!coupon) return null;
  if (!coupon.isActive) return null;
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return null;
    if ((coupon.maxRedemptions ?? 0) > 0 && (coupon.currentRedemptions ?? 0) >= (coupon.maxRedemptions ?? 0)) return null;
  if (coupon.isFirstOrderOnly && !isFirstOrder) return null;
  if (coupon.applicablePlanIds?.length && !coupon.applicablePlanIds.includes(planId)) return null;
  if (coupon.minPlanId && coupon.minPlanId !== planId) return null;
  if (coupon.maxPlanId && coupon.maxPlanId !== planId) return null;
  if (coupon.regionRestrictions?.length && region && !coupon.regionRestrictions.includes(region)) return null;
  if (coupon.minAmountKobo != null && amountKobo < coupon.minAmountKobo) return null;
  if (coupon.maxAmountKobo != null && amountKobo > coupon.maxAmountKobo) return null;

  let discountKobo = 0;
  let freeMonths = 0;
  if (coupon.discountType === 'percentage' && coupon.discountPercent) {
    discountKobo = Math.round(amountKobo * (coupon.discountPercent / 100));
  } else if (coupon.discountType === 'fixed_amount' && coupon.discountAmountKobo) {
    discountKobo = coupon.discountAmountKobo;
  } else if (coupon.discountType === 'free_months' && coupon.freeMonths) {
    freeMonths = coupon.freeMonths || 0;
  }

  return { discountKobo, freeMonths, description: coupon.description || `Coupon ${code}`, sourceId: coupon.id };
}

async function validateAndApplyReferral(code: string, orgId: string, planId: string, amountKobo: number): Promise<{ discountKobo: number; freeMonths: number; description: string; sourceId: string } | null> {
  const [ref] = await db.select().from(referralCodes).where(and(eq(referralCodes.code, code), or(eq(referralCodes.orgId, orgId), isNull(referralCodes.orgId)))).limit(1);
  if (!ref) return null;
  if (!ref.isActive) return null;
  if (ref.expiresAt && new Date(ref.expiresAt) < new Date()) return null;
  if ((ref.maxRedemptions ?? 0) > 0 && (ref.currentRedemptions ?? 0) >= (ref.maxRedemptions ?? 0)) return null;
  if (ref.applicablePlanIds?.length && !ref.applicablePlanIds.includes(planId)) return null;

  let discountKobo = 0;
  let freeMonths = 0;
  if (ref.rewardType === 'percentage' && ref.rewardValue) {
    discountKobo = Math.round(amountKobo * (ref.rewardValue / 100));
  } else if (ref.rewardType === 'fixed_amount' && ref.rewardValue) {
    discountKobo = ref.rewardValue;
  } else if (ref.rewardType === 'free_months' && ref.rewardFreeMonths) {
    freeMonths = ref.rewardFreeMonths;
  }

  return { discountKobo, freeMonths, description: `Referral ${code}`, sourceId: ref.id };
}

async function validateAndApplyPartner(code: string, orgId: string, planId: string, amountKobo: number, region?: string): Promise<{ discountKobo: number; freeMonths: number; description: string; sourceId: string } | null> {
  const [partner] = await db.select().from(partnerDiscounts).where(and(eq(partnerDiscounts.partnerCode, code), or(eq(partnerDiscounts.orgId, orgId), isNull(partnerDiscounts.orgId)))).limit(1);
  if (!partner) return null;
  if (!partner.isActive) return null;
  if (partner.expiresAt && new Date(partner.expiresAt) < new Date()) return null;
  if ((partner.maxRedemptions ?? 0) > 0 && (partner.currentRedemptions ?? 0) >= (partner.maxRedemptions ?? 0)) return null;
  if (partner.applicablePlanIds?.length && !partner.applicablePlanIds.includes(planId)) return null;
  if (partner.regionRestrictions?.length && region && !partner.regionRestrictions.includes(region)) return null;

  let discountKobo = 0;
  let freeMonths = 0;
  if (partner.discountType === 'percentage' && partner.discountPercent) {
    discountKobo = Math.round(amountKobo * (partner.discountPercent / 100));
  } else if (partner.discountType === 'fixed_amount' && partner.discountAmountKobo) {
    discountKobo = partner.discountAmountKobo;
  } else if (partner.discountType === 'free_months' && partner.freeMonths) {
    freeMonths = partner.freeMonths;
  }

  return { discountKobo, freeMonths, description: `Partner ${partner.partnerName}`, sourceId: partner.id };
}

async function findActivePromotions(orgId: string, planId: string, amountKobo: number, region?: string): Promise<any[]> {
  const now = new Date();
  const rows = await db.select().from(promotions).where(and(
    eq(promotions.isActive, true),
    or(eq(promotions.orgId, orgId), isNull(promotions.orgId)),
    lte(promotions.startDate, now),
    gte(promotions.endDate, now),
    or(eq(promotions.maxRedemptions, 0), lt(promotions.currentRedemptions, promotions.maxRedemptions)),
  ));

  return rows.filter(p => {
    if (p.applicablePlanIds?.length && !p.applicablePlanIds.includes(planId)) return false;
    if (p.minPlanId && p.minPlanId !== planId) return false;
    if (p.maxPlanId && p.maxPlanId !== planId) return false;
    if (p.regionRestrictions?.length && region && !p.regionRestrictions.includes(region)) return false;
    if (p.budgetKobo && (p.spentKobo || 0) >= p.budgetKobo) return false;
    return true;
  });
}

function calculatePromotionDiscount(promo: any, amountKobo: number): { discountKobo: number; freeMonths: number; description: string } {
  let discountKobo = 0;
  let freeMonths = 0;
  if (promo.discountType === 'percentage' && promo.discountPercent) {
    discountKobo = Math.round(amountKobo * (promo.discountPercent / 100));
  } else if (promo.discountType === 'fixed_amount' && promo.discountAmountKobo) {
    discountKobo = promo.discountAmountKobo;
  } else if (promo.discountType === 'free_months' && promo.freeMonths) {
    freeMonths = promo.freeMonths;
  }
  return { discountKobo, freeMonths, description: `Promotion: ${promo.name}` };
}

async function incrementSourceRedemption(type: string, sourceId: string, discountKobo: number): Promise<void> {
  const now = new Date();
  switch (type) {
    case 'coupon':
      await db.update(coupons).set({ currentRedemptions: sql`${coupons.currentRedemptions} + 1`, updatedAt: now }).where(eq(coupons.id, sourceId));
      break;
    case 'promotion':
      await db.update(promotions).set({ currentRedemptions: sql`${promotions.currentRedemptions} + 1`, spentKobo: sql`COALESCE(${promotions.spentKobo}, 0) + ${discountKobo}`, updatedAt: now }).where(eq(promotions.id, sourceId));
      // Also update campaign spent if linked
      const [promo] = await db.select({ campaignId: promotions.campaignId }).from(promotions).where(eq(promotions.id, sourceId)).limit(1);
      if (promo?.campaignId) {
        await db.update(promotionalCampaigns).set({ spentKobo: sql`COALESCE(${promotionalCampaigns.spentKobo}, 0) + ${discountKobo}`, currentRedemptions: sql`${promotionalCampaigns.currentRedemptions} + 1` }).where(eq(promotionalCampaigns.id, promo.campaignId));
      }
      break;
    case 'referral':
      await db.update(referralCodes).set({ currentRedemptions: sql`${referralCodes.currentRedemptions} + 1`, updatedAt: now }).where(eq(referralCodes.id, sourceId));
      break;
    case 'partner':
      await db.update(partnerDiscounts).set({ currentRedemptions: sql`${partnerDiscounts.currentRedemptions} + 1`, updatedAt: now }).where(eq(partnerDiscounts.id, sourceId));
      break;
    case 'campaign':
      await db.update(promotionalCampaigns).set({ spentKobo: sql`COALESCE(${promotionalCampaigns.spentKobo}, 0) + ${discountKobo}`, currentRedemptions: sql`${promotionalCampaigns.currentRedemptions} + 1` }).where(eq(promotionalCampaigns.id, sourceId));
      break;
  }
}

async function getPlan(planId: string): Promise<any> {
  const [row] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
  if (!row) throw new AppError('Plan not found.', 404);
  return row;
}
