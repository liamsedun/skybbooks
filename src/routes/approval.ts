import { Router, Response, NextFunction } from 'express';
import { db, approvalWorkflows, approvalHistory, users } from '../db/schema';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import {
  getWorkflowConfig,
  setWorkflowConfig,
  deleteWorkflowConfig,
  getAllWorkflowConfigs,
  getApprovalHistory,
  validateAndExecuteTransition,
} from '../services/approval.service';
import { createAuditLog, extractReqMeta } from '../services/audit.service';
import { AppError } from '../lib/errors';

const router = Router();
router.use(authenticate);
router.use(requireOrg);
router.use(requireRole('admin', 'owner'));

// ===== WORKFLOW CONFIGURATION =====

const setConfigSchema = z.object({
  module: z.enum(['bills', 'expenses', 'journals', 'payments_received', 'payments_made', 'purchase_orders', 'fixed_assets', 'inventory_adjustments']),
  level: z.number().int().min(1).max(3),
});

router.get('/workflows', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const configs = await getAllWorkflowConfigs(orgId);
    res.json(configs);
  } catch (err) {
    next(err);
  }
});

router.put('/workflows', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = setConfigSchema.parse(req.body);
    const config = await setWorkflowConfig(orgId, body.module, body.level as 1 | 2 | 3);
    await createAuditLog({
      orgId,
      userId: req.user!.userId,
      action: 'approval_workflow_update',
      entityType: 'approval_workflow',
      entityId: config.id,
      description: `Set ${body.module} approval level to ${body.level}`,
      ...extractReqMeta(req),
    });
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.delete('/workflows/:module', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { module } = req.params;
    await deleteWorkflowConfig(orgId, module as any);
    await createAuditLog({
      orgId,
      userId: req.user!.userId,
      action: 'approval_workflow_delete',
      entityType: 'approval_workflow',
      description: `Cleared approval workflow for ${module}`,
      ...extractReqMeta(req),
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ===== APPROVAL HISTORY =====

router.get('/history/:module/:entityId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { module, entityId } = req.params;
    const history = await getApprovalHistory(orgId, module as any, entityId);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

export default router;
