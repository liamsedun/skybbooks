import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, resolveSuperAdmin, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { getRateLimitConfigs, createRateLimitConfig, updateRateLimitConfig, deleteRateLimitConfig } from '../services/rateLimit.service';

const router = Router();
router.use(authenticate);
router.use(resolveSuperAdmin);
router.use(requireRole('super_admin'));

router.get('/', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const data = await getRateLimitConfigs();
  res.json(ok(data));
}));

router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await createRateLimitConfig(req.body);
  res.status(201).json(ok(data));
}));

router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await updateRateLimitConfig(req.params.id, req.body);
  res.json(ok(data));
}));

router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await deleteRateLimitConfig(req.params.id);
  res.json(ok({ deleted: true }));
}));

export default router;
