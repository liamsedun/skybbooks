import { Router, Response } from 'express';
import { z } from 'zod';
import * as pe from '../services/promotionsEngine.service';
import { authenticate as requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';

const router = Router();

// All routes require auth
router.use(requireAuth);

// ── Campaigns ──

router.get('/campaigns', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const campaigns = await pe.getCampaigns(req.user!.orgId!);
  res.json(ok(campaigns));
}));

router.get('/campaigns/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const campaign = await pe.getCampaign(req.params.id, req.user!.orgId!);
  res.json(ok(campaign));
}));

router.post('/campaigns', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const campaign = await pe.createCampaign(req.body, req.user!.orgId!, req.user?.userId);
  res.status(201).json(ok(campaign));
}));

router.put('/campaigns/:id', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const campaign = await pe.updateCampaign(req.params.id, req.body, req.user!.orgId!, req.user?.userId);
  res.json(ok(campaign));
}));

router.delete('/campaigns/:id', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await pe.deleteCampaign(req.params.id, req.user!.orgId!);
  res.json(ok({ deleted: true }));
}));

// ── Referral Codes ──

router.get('/referrals', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const referrals = await pe.getReferralCodes(req.user!.orgId!);
  res.json(ok(referrals));
}));

router.get('/referrals/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const referral = await pe.getReferralCode(req.params.id, req.user!.orgId!);
  res.json(ok(referral));
}));

router.post('/referrals', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { orgId: _orgId, ...data } = req.body;
  const referral = await pe.createReferralCode(data, req.user!.orgId!, req.user?.userId);
  res.status(201).json(ok(referral));
}));

router.put('/referrals/:id', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const referral = await pe.updateReferralCode(req.params.id, req.body, req.user!.orgId!);
  res.json(ok(referral));
}));

router.delete('/referrals/:id', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await pe.deleteReferralCode(req.params.id, req.user!.orgId!);
  res.json(ok({ deleted: true }));
}));

// ── Partner Discounts ──

router.get('/partners', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const partners = await pe.getPartnerDiscounts(req.user!.orgId!);
  res.json(ok(partners));
}));

router.get('/partners/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const partner = await pe.getPartnerDiscount(req.params.id, req.user!.orgId!);
  res.json(ok(partner));
}));

router.post('/partners', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const partner = await pe.createPartnerDiscount(req.body, req.user!.orgId!, req.user?.userId);
  res.status(201).json(ok(partner));
}));

router.put('/partners/:id', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const partner = await pe.updatePartnerDiscount(req.params.id, req.body, req.user!.orgId!);
  res.json(ok(partner));
}));

router.delete('/partners/:id', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await pe.deletePartnerDiscount(req.params.id, req.user!.orgId!);
  res.json(ok({ deleted: true }));
}));

// ── Redemption History ──

router.get('/redemptions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { type, subscriptionId, invoiceId } = req.query;
  const redemptions = await pe.getRedemptionHistory(req.user!.orgId!, {
    type: type as string | undefined,
    subscriptionId: subscriptionId as string | undefined,
    invoiceId: invoiceId as string | undefined,
  });
  res.json(ok(redemptions));
}));

// ── Extended Coupon/Promotion Management ──

router.post('/coupons', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const coupon = await pe.createCouponExtended(req.body, req.user!.orgId!, req.user?.userId);
  res.status(201).json(ok(coupon));
}));

router.put('/coupons/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const coupon = await pe.updateCouponExtended(req.params.id, req.body, req.user!.orgId!);
  res.json(ok(coupon));
}));

router.post('/promotions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const promo = await pe.createPromotionExtended(req.body, req.user!.orgId!, req.user?.userId);
  res.status(201).json(ok(promo));
}));

router.put('/promotions/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const promo = await pe.updatePromotionExtended(req.params.id, req.body, req.user!.orgId!);
  res.json(ok(promo));
}));

// ── Discount Application ──

const applySchema = z.object({
  planId: z.string().uuid(),
  amountKobo: z.number().int().min(1),
  couponCode: z.string().optional(),
  referralCode: z.string().optional(),
  partnerCode: z.string().optional(),
  isFirstOrder: z.boolean().optional(),
  region: z.string().optional(),
});

router.post('/apply', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = applySchema.parse(req.body);
  const result = await pe.applyDiscounts({ ...parsed, orgId: req.user!.orgId! });
  res.json(ok(result));
}));

router.post('/auto-apply', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { planId, amountKobo, isFirstOrder, region } = req.body;
  if (!planId || !amountKobo) throw new Error('planId and amountKobo are required');
  const result = await pe.autoApplyPromotions({ orgId: req.user!.orgId!, planId, amountKobo, isFirstOrder, region });
  res.json(ok(result));
}));

// ── Record Redemption ──

const recordSchema = z.object({
  subscriptionId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  redemptionType: z.enum(['coupon', 'promotion', 'referral', 'partner', 'campaign']),
  sourceId: z.string().uuid(),
  sourceCode: z.string().optional(),
  discountType: z.string(),
  discountValue: z.number().int(),
  discountKobo: z.number().int(),
  freeMonths: z.number().int(),
  originalAmountKobo: z.number().int(),
  finalAmountKobo: z.number().int(),
  metadata: z.any().optional(),
});

router.post('/record', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = recordSchema.parse(req.body);
  const record = await pe.recordRedemption({ ...parsed, orgId: req.user!.orgId!, redeemedBy: req.user?.userId });
  res.status(201).json(ok(record));
}));

export default router;
