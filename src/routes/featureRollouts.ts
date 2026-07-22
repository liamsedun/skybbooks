import { Router, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { getFeatureRollouts, createFeatureRollout, updateFeatureRollout, getRolloutEvents, isFeatureEnabled } from '../services/featureRollout.service';
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
router.use(requirePlatformPermission(PlatformPermission.FeatureFlagsManage));

router.get('/', asyncHandler(async (_req: PlatformAuthenticatedRequest, res: Response) => {
  const data = await getFeatureRollouts();
  res.json(ok(data));
}));

router.post('/', asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
  const data = await createFeatureRollout({ ...req.body, createdBy: req.platformUser!.id });
  res.status(201).json(ok(data));
}));

router.put('/:id', asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
  const data = await updateFeatureRollout(req.params.id, req.body);
  res.json(ok(data));
}));

export default router;
