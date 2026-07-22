import { Router, Request, Response, NextFunction } from 'express';
import { requirePlatformPermission } from '../middleware/platformAuth';
import { AppError } from '../lib/errors';
import {
  getPlans, getPlan, createPlan, updatePlan, deactivatePlan,
  getOrgSubscription, createSubscription, changePlan, renewSubscription,
  getCoupons, getCoupon, createCoupon, validateCoupon,
  getPromotions, getPromotion, createPromotion, updatePromotion,
  getSubscriptionInvoices, markInvoicePaid,
  getOrgEntitlements, checkFeatureAccess, recordUsage, getUsage, checkUsageLimit,
} from '../services/subscription.service';

const router = Router();

// ── Plans ──

router.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const publicOnly = req.query.publicOnly === 'true';
    const plans = await getPlans((req as any).user!.orgId!, publicOnly);
    res.json(plans);
  } catch (err) { next(err); }
});

router.get('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await getPlan(req.params.id);
    res.json(plan);
  } catch (err) { next(err); }
});

router.post('/plans', requirePlatformPermission('plans:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await createPlan(req.body, (req as any).user!.orgId!, (req as any).user!.userId!, req);
    res.status(201).json(plan);
  } catch (err) { next(err); }
});

router.put('/plans/:id', requirePlatformPermission('plans:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await updatePlan(req.params.id, req.body, (req as any).user!.orgId!, (req as any).user!.userId!, req);
    res.json(plan);
  } catch (err) { next(err); }
});

router.delete('/plans/:id', requirePlatformPermission('plans:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await deactivatePlan(req.params.id);
    res.json(plan);
  } catch (err) { next(err); }
});

// ── Subscriptions ──

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscription = await getOrgSubscription((req as any).user!.orgId!);
    res.json(subscription);
  } catch (err) { next(err); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId, couponCode, promotionId, billingCycle } = req.body;
    const subscription = await createSubscription((req as any).user!.orgId!, (req as any).user!.userId!, { planId, couponCode, promotionId, billingCycle }, req);
    res.status(201).json(subscription);
  } catch (err) { next(err); }
});

router.put('/:id/plan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId, prorate } = req.body;
    const subscription = await changePlan(req.params.id, planId, (req as any).user!.orgId!, (req as any).user!.userId!, prorate, req);
    res.json(subscription);
  } catch (err) { next(err); }
});

router.post('/:id/renew', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscription = await renewSubscription(req.params.id, (req as any).user!.orgId!, (req as any).user!.userId!, req);
    res.json(subscription);
  } catch (err) { next(err); }
});

// ── Coupons ──

router.get('/coupons', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupons = await getCoupons((req as any).user!.orgId!);
    res.json(coupons);
  } catch (err) { next(err); }
});

router.get('/coupons/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupon = await getCoupon(req.params.id, (req as any).user!.orgId!);
    res.json(coupon);
  } catch (err) { next(err); }
});

router.post('/coupons', requirePlatformPermission('billing:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupon = await createCoupon(req.body, (req as any).user!.userId!, req);
    res.status(201).json(coupon);
  } catch (err) { next(err); }
});

router.post('/coupons/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, planId, amountKobo } = req.body;
    const coupon = await validateCoupon(code, (req as any).user!.orgId!, planId, amountKobo);
    res.json(coupon);
  } catch (err) { next(err); }
});

// ── Promotions ──

router.get('/promotions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const promotions = await getPromotions((req as any).user!.orgId!);
    res.json(promotions);
  } catch (err) { next(err); }
});

router.get('/promotions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const promotion = await getPromotion(req.params.id, (req as any).user!.orgId!);
    res.json(promotion);
  } catch (err) { next(err); }
});

router.post('/promotions', requirePlatformPermission('billing:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const promotion = await createPromotion(req.body, (req as any).user!.userId!, req);
    res.status(201).json(promotion);
  } catch (err) { next(err); }
});

router.put('/promotions/:id', requirePlatformPermission('billing:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const promotion = await updatePromotion(req.params.id, req.body, (req as any).user!.orgId!, (req as any).user!.userId!, req);
    res.json(promotion);
  } catch (err) { next(err); }
});

// ── Invoices ──

router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscriptionId = req.query.subscriptionId as string | undefined;
    const invoices = await getSubscriptionInvoices((req as any).user!.orgId!, subscriptionId);
    res.json(invoices);
  } catch (err) { next(err); }
});

// ── Entitlements & Usage ──

router.get('/entitlements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entitlements = await getOrgEntitlements((req as any).user!.orgId!);
    res.json(entitlements);
  } catch (err) { next(err); }
});

router.get('/entitlements/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const featureKey = req.query.featureKey as string;
    const result = await checkFeatureAccess((req as any).user!.orgId!, featureKey);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { featureKey, count } = req.body;
    const subscription = await getOrgSubscription((req as any).user!.orgId!);
    if (!subscription) throw new AppError('No active subscription found.', 404);
    const result = await recordUsage((req as any).user!.orgId!, subscription.id, featureKey, count);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const featureKey = req.query.featureKey as string | undefined;
    const subscription = await getOrgSubscription((req as any).user!.orgId!);
    if (!subscription) throw new AppError('No active subscription found.', 404);
    const usage = await getUsage((req as any).user!.orgId!, subscription.id, featureKey);
    res.json(usage);
  } catch (err) { next(err); }
});

router.get('/usage/check-limit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const featureKey = req.query.featureKey as string;
    const result = await checkUsageLimit((req as any).user!.orgId!, featureKey);
    res.json(result);
  } catch (err) { next(err); }
});

// ── Webhook router (no auth) ──

export const subscriptionWebhookRouter = Router();

subscriptionWebhookRouter.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoiceId, status } = req.body;
    if (status === 'paid') {
      await markInvoicePaid(invoiceId, 'webhook');
    }
    res.json({ received: true });
  } catch (err) { next(err); }
});

export default router;
