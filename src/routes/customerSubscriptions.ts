import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getPlans,
  getOrgSubscription,
  changePlan,
  getSubscriptionInvoices,
  getOrgEntitlements,
} from '../services/subscription.service';
import { createAuditLog, extractReqMeta } from '../services/audit.service';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authenticate);

router.get('/plans', asyncHandler(async (req: Request, res: Response) => {
  const plans = await getPlans(undefined, true);
  res.json({ success: true, data: plans });
}));

router.get('/current', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user.orgId;
  if (!orgId) return res.status(400).json({ success: false, error: 'Organisation context required.' });
  const subscription = await getOrgSubscription(orgId);
  res.json({ success: true, data: subscription });
}));

router.put('/change-plan', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user.orgId;
  const userId = (req as any).user.id;
  if (!orgId) return res.status(400).json({ success: false, error: 'Organisation context required.' });
  const { subscriptionId, planId, prorate } = req.body;
  if (!subscriptionId || !planId) {
    return res.status(400).json({ success: false, error: 'subscriptionId and planId are required.' });
  }
  const updated = await changePlan(subscriptionId, planId, orgId, userId, prorate ?? true, req);
  await createAuditLog({
    orgId,
    userId,
    action: 'update',
    entityType: 'subscription',
    entityId: subscriptionId,
    oldValues: {},
    newValues: { planId },
    ...extractReqMeta(req),
  });
  res.json({ success: true, data: updated });
}));

router.get('/invoices', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user.orgId;
  if (!orgId) return res.status(400).json({ success: false, error: 'Organisation context required.' });
  const invoices = await getSubscriptionInvoices(orgId);
  res.json({ success: true, data: invoices });
}));

export default router;
