import { Router, Response } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { getUsageDashboard, checkResourceLimit, getUsageHistory, resourceTypes, ResourceType } from '../services/usageMonitor.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

router.get('/usage-monitor/dashboard', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const data = await getUsageDashboard(orgId);
  res.json(ok(data));
}));

router.get('/usage-monitor/check/:resource', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { resource } = req.params;
  if (!resourceTypes.includes(resource as ResourceType)) {
    return res.status(400).json(ok({ error: `Unknown resource. Valid: ${resourceTypes.join(', ')}` }));
  }
  const result = await checkResourceLimit(orgId, resource as ResourceType);
  res.json(ok(result));
}));

router.get('/usage-monitor/history', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const resource = req.query.resource as string | undefined;
  const history = await getUsageHistory(orgId, resource as ResourceType | undefined);
  res.json(ok(history));
}));

export default router;
