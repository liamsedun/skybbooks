import { Router, Response, NextFunction } from 'express';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import {
  getFeatureDefinitions,
  getFeatureDefinition,
  evaluateFeatureFlag,
  evaluateOrgFeatures,
  setOrgFeatureFlag,
  setPlanFeatureFlag,
  bulkSetPlanFeatureFlags,
  getPlanFeatureFlags,
  getOrgFeatureFlags,
  resetOrgFeatureFlag,
} from '../services/featureFlag.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Feature Definitions ──

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const category = req.query.category as string | undefined;
    const flags = await getFeatureDefinitions(category);
    res.json(flags);
  } catch (err) { next(err); }
});

router.get('/:code', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const flag = await getFeatureDefinition(req.params.code);
    if (!flag) throw new AppError('Feature definition not found.', 404);
    res.json(flag);
  } catch (err) { next(err); }
});

// ── Evaluation ──

router.get('/evaluate/:code', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.query.userId as string | undefined;
    const result = await evaluateFeatureFlag(req.user!.orgId!, req.params.code, userId);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/evaluate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.query.userId as string | undefined;
    const results = await evaluateOrgFeatures(req.user!.orgId!, userId);
    res.json(results);
  } catch (err) { next(err); }
});

// ── Org Overrides (admin) ──

router.get('/org', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const overrides = await getOrgFeatureFlags(req.user!.orgId!);
    res.json(overrides);
  } catch (err) { next(err); }
});

router.put('/org/:code', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { state, usageLimit } = req.body;
    const result = await setOrgFeatureFlag(req.user!.orgId!, req.params.code, { state, usageLimit });
    res.json(result);
  } catch (err) { next(err); }
});

router.delete('/org/:code', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await resetOrgFeatureFlag(req.user!.orgId!, req.params.code);
    res.json(result);
  } catch (err) { next(err); }
});

// ── Plan Feature Flags (admin) ──

router.get('/plan/:planId', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const flags = await getPlanFeatureFlags(req.params.planId);
    res.json(flags);
  } catch (err) { next(err); }
});

router.put('/plan/:planId/:code', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { state, usageLimit } = req.body;
    const result = await setPlanFeatureFlag(req.params.planId, req.params.code, { state, usageLimit });
    res.json(result);
  } catch (err) { next(err); }
});

router.put('/plan/:planId/bulk', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { flags } = req.body;
    const results = await bulkSetPlanFeatureFlags(req.params.planId, flags);
    res.json(results);
  } catch (err) { next(err); }
});

export default router;
