import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { platformAuthenticate, platformUserGuard, PlatformAuthenticatedRequest } from '../middleware/platformAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { getAllAnnouncements, createAnnouncement, dismissAnnouncement } from '../services/announcement.service';

const router = Router();

router.get('/', platformAuthenticate, platformUserGuard, asyncHandler(async (_req: PlatformAuthenticatedRequest, res: Response) => {
  const data = await getAllAnnouncements();
  res.json(ok(data));
}));

router.post('/', platformAuthenticate, platformUserGuard, asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
  const body = { ...req.body };
  if (body.startsAt) body.startsAt = new Date(body.startsAt);
  if (body.endsAt) body.endsAt = new Date(body.endsAt);
  if (body.orgId === '') delete body.orgId;
  const data = await createAnnouncement({ ...body, userId: req.platformUser!.id });
  res.status(201).json(ok(data));
}));

router.post('/:id/dismiss', authenticate, requireOrg, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await dismissAnnouncement(req.params.id, req.user!.orgId!);
  res.json(ok(data));
}));

export default router;
