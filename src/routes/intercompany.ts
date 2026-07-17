import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import * as icService from '../services/intercompany.service';
import { AppError } from '../lib/errors';
import { createAuditLog, extractReqMeta } from '../services/audit.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const createICTransactionSchema = z.object({
  groupId: z.string().uuid(),
  fromOrgId: z.string().uuid(),
  toOrgId: z.string().uuid(),
  transactionType: z.enum(['loan', 'goods', 'service', 'royalty', 'dividend', 'management_fee', 'other']),
  description: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string().length(3).optional(),
  fxRate: z.number().positive().optional(),
  date: z.string().transform(v => new Date(v)),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const settleSchema = z.object({
  settledAmount: z.number().int().positive(),
  settledDate: z.string().transform(v => new Date(v)),
});

const listQuerySchema = z.object({
  status: z.string().optional(),
  fromOrgId: z.string().uuid().optional(),
  toOrgId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().optional().transform(v => v ? parseInt(v, 10) : undefined),
});

router.get('/group/:groupId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const filters = listQuerySchema.parse(req.query);
    const parsed = {
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    };
    const limit = parsed.limit ?? 50;
    const transactions = await icService.listTransactions(groupId, parsed, limit);
    return res.status(200).json(transactions);
  } catch (error) {
    if (error instanceof z.ZodError) { return next(new AppError(error.issues[0]?.message || 'Validation failed', 400)); }
    return next(error);
  }
});

router.get('/:txnId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { txnId } = req.params;
    const transaction = await icService.getTransaction(txnId);
    return res.status(200).json(transaction);
  } catch (error) { return next(error); }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const orgId = req.user!.orgId!;
    const body = createICTransactionSchema.parse(req.body);
    const transaction = await icService.createTransaction(body, userId);
    createAuditLog({ orgId, userId, action: 'create', entityType: 'intercompany_transaction', entityId: transaction.id, newValues: body, ...extractReqMeta(req) });
    return res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) { return next(new AppError(error.issues[0]?.message || 'Validation failed', 400)); }
    return next(error);
  }
});

router.post('/:txnId/settle', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const orgId = req.user!.orgId!;
    const { txnId } = req.params;
    const body = settleSchema.parse(req.body);
    const transaction = await icService.settleTransaction(txnId, body.settledAmount, body.settledDate, userId);
    createAuditLog({ orgId, userId, action: 'settle', entityType: 'intercompany_transaction', entityId: txnId, newValues: body, ...extractReqMeta(req) });
    return res.status(200).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) { return next(new AppError(error.issues[0]?.message || 'Validation failed', 400)); }
    return next(error);
  }
});

router.post('/group/:groupId/match', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const orgId = req.user!.orgId!;
    const { groupId } = req.params;
    const result = await icService.matchTransactions(groupId);
    createAuditLog({ orgId, userId, action: 'match', entityType: 'intercompany_transaction', entityId: groupId, description: `Auto-matched ${result.matchedCount} pending transactions in group ${groupId}`, ...extractReqMeta(req) });
    return res.status(200).json(result);
  } catch (error) { return next(error); }
});

router.get('/group/:groupId/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const asOfDate = req.query.asOfDate ? new Date(String(req.query.asOfDate)) : undefined;
    const summary = await icService.getIntercompanySummary(groupId, asOfDate);
    return res.status(200).json(summary);
  } catch (error) { return next(error); }
});

router.delete('/:txnId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const orgId = req.user!.orgId!;
    const { txnId } = req.params;
    await icService.deleteTransaction(txnId);
    createAuditLog({ orgId, userId, action: 'delete', entityType: 'intercompany_transaction', entityId: txnId, description: `Intercompany transaction deleted`, ...extractReqMeta(req) });
    return res.status(200).json({ message: 'Intercompany transaction deleted successfully.' });
  } catch (error) { return next(error); }
});

export default router;
