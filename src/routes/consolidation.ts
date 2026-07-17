import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';
import * as consolService from '../services/consolidation.service';
import { AppError } from '../lib/errors';
import { createAuditLog, extractReqMeta } from '../services/audit.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const runConsolidationSchema = z.object({
  groupId: z.string().uuid(),
  reportType: z.enum(['balance_sheet', 'profit_and_loss', 'cash_flow', 'trial_balance']),
  periodStart: z.string().transform(v => new Date(v)),
  periodEnd: z.string().transform(v => new Date(v)),
  asOfDate: z.string().transform(v => new Date(v)).optional(),
  includesEliminations: z.boolean().optional().default(true),
  includesNci: z.boolean().optional().default(true),
  currencyTranslationMethod: z.enum(['closing_rate', 'average_rate', 'historical_rate']).optional(),
});

const historyQuerySchema = z.object({
  limit: z.string().optional().transform(v => v ? parseInt(v, 10) : undefined),
});

const eliminateSchema = z.object({
  groupId: z.string().uuid(),
  periodStart: z.string().transform(v => new Date(v)),
  periodEnd: z.string().transform(v => new Date(v)),
});

router.post('/run', requireRole('owner', 'accountant'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const orgId = req.user!.orgId!;
    const body = runConsolidationSchema.parse(req.body);
    const result = await consolService.runConsolidation(body, userId);
    createAuditLog({ orgId, userId, action: 'create', entityType: 'consolidation_run', entityId: result.id, newValues: body, ...extractReqMeta(req) });
    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) { return next(new AppError(error.issues[0]?.message || 'Validation failed', 400)); }
    return next(error);
  }
});

router.get('/history/:groupId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const { limit } = historyQuerySchema.parse(req.query);
    const history = await consolService.getConsolidationHistory(groupId, limit);
    return res.status(200).json(history);
  } catch (error) {
    if (error instanceof z.ZodError) { return next(new AppError(error.issues[0]?.message || 'Validation failed', 400)); }
    return next(error);
  }
});

router.get('/runs/:runId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;
    const run = await consolService.getConsolidationRun(runId);
    return res.status(200).json(run);
  } catch (error) { return next(error); }
});

router.post('/eliminate', requireRole('owner', 'accountant'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const orgId = req.user!.orgId!;
    const body = eliminateSchema.parse(req.body);
    const eliminations = await consolService.generateAutoEliminations(body.groupId, body.periodStart, body.periodEnd, userId);
    createAuditLog({ orgId, userId, action: 'create', entityType: 'consolidation_elimination', entityId: body.groupId, newValues: body, ...extractReqMeta(req) });
    return res.status(201).json(eliminations);
  } catch (error) {
    if (error instanceof z.ZodError) { return next(new AppError(error.issues[0]?.message || 'Validation failed', 400)); }
    return next(error);
  }
});

export default router;
