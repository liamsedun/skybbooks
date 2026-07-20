import { Router, Response, NextFunction } from 'express';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import {
  getPlans, getPlan, createPlan, updatePlan, deactivatePlan,
  getOrgSubscription, createSubscription, changePlan, cancelSubscription, renewSubscription,
  getCoupons, getCoupon, createCoupon, validateCoupon,
  getPromotions, getPromotion, createPromotion, updatePromotion,
  getSubscriptionInvoices, markInvoicePaid,
  getOrgEntitlements, checkFeatureAccess, recordUsage, getUsage, checkUsageLimit,
} from '../services/subscription.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Plans ──

router.get('/plans', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const publicOnly = req.query.publicOnly === 'true';
    const plans = await getPlans(req.user!.orgId!, publicOnly);
    res.json(plans);
  } catch (err) { next(err); }
});

router.get('/plans/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await getPlan(req.params.id);
    res.json(plan);
  } catch (err) { next(err); }
});

router.post('/plans', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await createPlan(req.body, req.user!.orgId!, req.user!.userId!, req);
    res.status(201).json(plan);
  } catch (err) { next(err); }
});

router.put('/plans/:id', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await updatePlan(req.params.id, req.body, req.user!.orgId!, req.user!.userId!, req);
    res.json(plan);
  } catch (err) { next(err); }
});

router.delete('/plans/:id', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await deactivatePlan(req.params.id);
    res.json(plan);
  } catch (err) { next(err); }
});

// ── Subscriptions ──

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subscription = await getOrgSubscription(req.user!.orgId!);
    res.json(subscription);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { planId, couponCode, promotionId, billingCycle } = req.body;
    const subscription = await createSubscription(req.user!.orgId!, req.user!.userId!, { planId, couponCode, promotionId, billingCycle }, req);
    res.status(201).json(subscription);
  } catch (err) { next(err); }
});

router.put('/:id/plan', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { planId, prorate } = req.body;
    const subscription = await changePlan(req.params.id, planId, req.user!.orgId!, req.user!.userId!, prorate, req);
    res.json(subscription);
  } catch (err) { next(err); }
});

router.post('/:id/cancel', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { atPeriodEnd } = req.body;
    const subscription = await cancelSubscription(req.params.id, req.user!.orgId!, req.user!.userId!, atPeriodEnd, req);
    res.json(subscription);
  } catch (err) { next(err); }
});

router.post('/:id/renew', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subscription = await renewSubscription(req.params.id, req.user!.orgId!, req.user!.userId!, req);
    res.json(subscription);
  } catch (err) { next(err); }
});

// ── Coupons ──

router.get('/coupons', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const coupons = await getCoupons(req.user!.orgId!);
    res.json(coupons);
  } catch (err) { next(err); }
});

router.get('/coupons/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const coupon = await getCoupon(req.params.id);
    res.json(coupon);
  } catch (err) { next(err); }
});

router.post('/coupons', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const coupon = await createCoupon(req.body, req.user!.userId!, req);
    res.status(201).json(coupon);
  } catch (err) { next(err); }
});

router.post('/coupons/validate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { code, planId, amountKobo } = req.body;
    const coupon = await validateCoupon(code, planId, amountKobo);
    res.json(coupon);
  } catch (err) { next(err); }
});

// ── Promotions ──

router.get('/promotions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const promotions = await getPromotions(req.user!.orgId!);
    res.json(promotions);
  } catch (err) { next(err); }
});

router.get('/promotions/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const promotion = await getPromotion(req.params.id);
    res.json(promotion);
  } catch (err) { next(err); }
});

router.post('/promotions', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const promotion = await createPromotion(req.body, req.user!.userId!, req);
    res.status(201).json(promotion);
  } catch (err) { next(err); }
});

router.put('/promotions/:id', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const promotion = await updatePromotion(req.params.id, req.body, req.user!.orgId!, req.user!.userId!, req);
    res.json(promotion);
  } catch (err) { next(err); }
});

// ── Invoices ──

router.get('/invoices', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subscriptionId = req.query.subscriptionId as string | undefined;
    const invoices = await getSubscriptionInvoices(req.user!.orgId!, subscriptionId);
    res.json(invoices);
  } catch (err) { next(err); }
});

// ── Entitlements & Usage ──

router.get('/entitlements', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const entitlements = await getOrgEntitlements(req.user!.orgId!);
    res.json(entitlements);
  } catch (err) { next(err); }
});

router.get('/entitlements/check', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const featureKey = req.query.featureKey as string;
    const result = await checkFeatureAccess(req.user!.orgId!, featureKey);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/usage', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { featureKey, count } = req.body;
    const subscription = await getOrgSubscription(req.user!.orgId!);
    if (!subscription) throw new AppError('No active subscription found.', 404);
    const result = await recordUsage(req.user!.orgId!, subscription.id, featureKey, count);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/usage', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const featureKey = req.query.featureKey as string | undefined;
    const subscription = await getOrgSubscription(req.user!.orgId!);
    if (!subscription) throw new AppError('No active subscription found.', 404);
    const usage = await getUsage(req.user!.orgId!, subscription.id, featureKey);
    res.json(usage);
  } catch (err) { next(err); }
});

router.get('/usage/check-limit', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const featureKey = req.query.featureKey as string;
    const result = await checkUsageLimit(req.user!.orgId!, featureKey);
    res.json(result);
  } catch (err) { next(err); }
});

// ── Webhook router (no auth) ──

export const subscriptionWebhookRouter = Router();

subscriptionWebhookRouter.post('/webhook', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { invoiceId, status } = req.body;
    if (status === 'paid') {
      await markInvoicePaid(invoiceId, 'webhook');
    }
    res.json({ received: true });
  } catch (err) { next(err); }
});

export default router;
