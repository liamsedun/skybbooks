import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, resolveSuperAdmin, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { getFeatureRollouts, createFeatureRollout, updateFeatureRollout, getRolloutEvents, isFeatureEnabled } from '../services/featureRollout.service';

const router = Router();
router.use(authenticate);
router.use(resolveSuperAdmin);
router.use(requireRole('super_admin'));

router.get('/', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const data = await getFeatureRollouts();
  res.json(ok(data));
}));

router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await createFeatureRollout({ ...req.body, createdBy: req.user!.userId! });
  res.status(201).json(ok(data));
}));

router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await updateFeatureRollout(req.params.id, req.body);
  res.json(ok(data));
}));

router.get('/:id/events', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await getRolloutEvents(req.params.id);
  res.json(ok(data));
}));

router.get('/check/:featureKey/:orgId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const enabled = await isFeatureEnabled(req.params.featureKey, req.params.orgId);
  res.json(ok({ featureKey: req.params.featureKey, enabled }));
}));

export default router;
