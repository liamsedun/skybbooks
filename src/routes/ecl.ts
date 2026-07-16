import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { createAuditLog, extractReqMeta } from '../services/audit.service';
import {
  getEclParameters,
  saveEclParameters,
  computeEcl,
  postEclProvision,
  getEclHistory,
  getEclDetail,
} from '../services/ecl.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const bucketSchema = z.object({
  id: z.string().optional(),
  bucketLabel: z.string().min(1),
  minDays: z.number().int(),
  maxDays: z.number().int(),
  lossRate: z.number().min(0).max(1),
  stage: z.enum(['1', '2', '3']),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

// GET /api/ecl/parameters — get ECL provision matrix rates
router.get('/parameters', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const result = await getEclParameters(orgId);
    res.json(result);
  } catch (err) { next(err); }
});

// PUT /api/ecl/parameters — save ECL provision matrix rates
router.put('/parameters', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = z.array(bucketSchema).parse(req.body);
    const result = await saveEclParameters(orgId, body);
    createAuditLog({ orgId, userId, action: 'update', entityType: 'ecl-parameters', newValues: { bucketCount: body.length }, ...extractReqMeta(req) });
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
    next(err);
  }
});

// GET /api/ecl/compute?asOfDate=YYYY-MM-DD — preview ECL computation (no JE)
router.get('/compute', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().split('T')[0];
    const result = await computeEcl(orgId, asOfDate);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/ecl/post — compute + post ECL provision JE
router.post('/post', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const asOfDate = (req.body.asOfDate as string) || new Date().toISOString().split('T')[0];
    const result = await postEclProvision(orgId, userId, asOfDate);
    createAuditLog({
      orgId, userId, action: 'create', entityType: 'ecl-provision',
      entityId: result.eclRecord.id,
      newValues: { totalProvision: result.computation.totalProvision, adjustmentAmount: result.computation.adjustmentAmount },
      ...extractReqMeta(req),
    });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/ecl/history — list past ECL computations
router.get('/history', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const result = await getEclHistory(orgId);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/ecl/history/:id — get single ECL computation detail
router.get('/history/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await getEclDetail(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
