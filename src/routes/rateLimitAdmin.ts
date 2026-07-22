import { Router, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { getRateLimitConfigs, createRateLimitConfig, updateRateLimitConfig, deleteRateLimitConfig } from '../services/rateLimit.service';
import {
  platformAuthenticate,
  platformUserGuard,
  requirePlatformPermission,
  PlatformAuthenticatedRequest,
} from '../middleware/platformAuth';
import { PlatformPermission } from '../lib/platformPermissions';

const router = Router();
router.use(platformAuthenticate);
router.use(platformUserGuard);
router.use(requirePlatformPermission(PlatformPermission.SystemManage));

router.get('/', asyncHandler(async (_req: PlatformAuthenticatedRequest, res: Response) => {
  const data = await getRateLimitConfigs();
  res.json(ok(data));
}));

router.post('/', asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
  const data = await createRateLimitConfig(req.body);
  res.status(201).json(ok(data));
}));

router.put('/:id', asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
  const data = await updateRateLimitConfig(req.params.id, req.body);
  res.json(ok(data));
}));

router.delete('/:id', asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
  await deleteRateLimitConfig(req.params.id);
  res.json(ok({ deleted: true }));
}));

export default router;
