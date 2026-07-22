import { Router, Request, Response, NextFunction } from 'express';
import { requirePlatformPermission } from '../middleware/platformAuth';
import { AppError } from '../lib/errors';
import {
  cancelAtPeriodEnd,
  cancelImmediately,
  pauseSubscription,
  resumeSubscription,
  schedulePlanChange,
  getStatusHistory,
  checkAccess,
  processRenewals,
  processExpirations,
  processGracePeriodEndings,
  startLifecycleScheduler,
} from '../services/subscriptionLifecycle.service';

const router = Router();

// ── Lifecycle Actions ──

router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pauseSubscription(req.params.id, req.body.pauseDays, (req as any).user.userId);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await resumeSubscription(req.params.id, (req as any).user.userId);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cancelAtPeriodEnd(req.params.id, (req as any).user.userId, req.body.reason);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/cancel-now', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cancelImmediately(req.params.id, (req as any).user.userId, req.body.reason);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/schedule-change', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId, changeType } = req.body;
    const result = await schedulePlanChange(req.params.id, planId, changeType, (req as any).user.userId, req);
    res.json(result);
  } catch (err) { next(err); }
});

// ── History ──

router.get('/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const history = await getStatusHistory(req.params.id);
    res.json(history);
  } catch (err) { next(err); }
});

// ── Access Check ──

router.get('/:id/access', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await checkAccess((req as any).user!.orgId!);
    res.json(result);
  } catch (err) { next(err); }
});

// ── Scheduler Triggers (admin only) ──

router.post('/scheduler/renewals', requirePlatformPermission('subscriptions:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await processRenewals();
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/scheduler/expirations', requirePlatformPermission('subscriptions:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await processExpirations();
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/scheduler/grace-period', requirePlatformPermission('subscriptions:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await processGracePeriodEndings();
    res.json(result);
  } catch (err) { next(err); }
});

export function initLifecycleScheduler() {
  const handle = startLifecycleScheduler(5 * 60 * 1000);
  console.log('[Scheduler] Subscription lifecycle scheduler started.');
  return handle;
}

export default router;
