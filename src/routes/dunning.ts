import { Router, Response } from 'express';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { getDunningRuns, getAllActiveDunningRuns, executeDunningPipeline } from '../services/dunning.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

router.get('/admin/dunning/runs', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const runs = await getAllActiveDunningRuns();
  res.json(ok(runs));
}));

router.post('/admin/dunning/execute', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await executeDunningPipeline();
  res.json(ok(result));
}));

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const runs = await getDunningRuns(req.user!.orgId!);
  res.json(ok(runs));
}));

export default router;
