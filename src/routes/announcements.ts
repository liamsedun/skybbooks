import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { getAllAnnouncements, createAnnouncement, dismissAnnouncement } from '../services/announcement.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await getAllAnnouncements();
  res.json(ok(data));
}));

router.post('/', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await createAnnouncement({ ...req.body, userId: req.user!.userId! });
  res.status(201).json(ok(data));
}));

router.post('/:id/dismiss', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await dismissAnnouncement(req.params.id, req.user!.orgId!);
  res.json(ok(data));
}));

export default router;
