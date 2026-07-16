import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { createAuditLog, extractReqMeta } from '../services/audit.service';
import {
  createLease,
  getLeases,
  getLease,
  updateLease,
  postCommencementEntry,
  processLeasePayment,
  postLeaseDepreciation,
  modifyLease,
  terminateLease,
  getLeaseReport,
  batchProcessPayments,
  batchPostDepreciation,
} from '../services/lease.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const createLeaseSchema = z.object({
  lessorName: z.string().min(1),
  description: z.string().optional(),
  assetCategory: z.enum(['buildings', 'motor_vehicles', 'equipment', 'other']),
  rouAssetAccountId: z.string().uuid(),
  accumDepreciationAccountId: z.string().uuid(),
  depreciationExpenseAccountId: z.string().uuid(),
  leaseLiabilityAccountId: z.string().uuid().optional(),
  currentLiabilityAccountId: z.string().uuid().optional(),
  interestExpenseAccountId: z.string().uuid().optional(),
  bankAccountId: z.string().uuid().optional(),
  commencementDate: z.string().min(1),
  endDate: z.string().min(1),
  leaseTermMonths: z.number().int().positive(),
  paymentAmount: z.number().int(),
  paymentFrequency: z.enum(['monthly', 'quarterly', 'semi_annual', 'annual']).default('monthly'),
  totalPayments: z.number().int().positive(),
  incrementalBorrowingRate: z.number().min(0).max(100),
  initialDirectCosts: z.number().int().optional(),
  depreciationMethod: z.enum(['straight_line', 'declining_balance', 'no_depreciation']).default('straight_line'),
  residualValue: z.number().int().optional(),
  notes: z.string().optional(),
});

const updateLeaseSchema = z.object({
  lessorName: z.string().min(1).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['draft', 'active', 'modified', 'terminated', 'expired']).optional(),
  bankAccountId: z.string().uuid().optional(),
});

const modifyLeaseSchema = z.object({
  newPaymentAmount: z.number().int().positive(),
  newTermMonths: z.number().int().positive().optional(),
  newTotalPayments: z.number().int().positive().optional(),
  newBorrowingRate: z.number().min(0).max(100).optional(),
  modificationDate: z.string().min(1),
  description: z.string().min(1),
});

// GET /api/leases — list all leases for org
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const result = await getLeases(orgId);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/leases/report — lease summary report
router.get('/report', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const result = await getLeaseReport(orgId);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/leases — create a new lease with amortization schedule
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = createLeaseSchema.parse(req.body);
    const result = await createLease({ ...body, orgId, createdBy: userId, paymentAmount: body.paymentAmount });
    createAuditLog({
      orgId, userId,
      action: 'create',
      entityType: 'lease',
      entityId: result.lease.id,
      newValues: { leaseNumber: result.lease.leaseNumber, lessorName: body.lessorName },
      ...extractReqMeta(req),
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
    next(err);
  }
});

// GET /api/leases/:id — get single lease with schedule
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await getLease(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

// PUT /api/leases/:id — update lease (non-financial fields)
router.put('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const body = updateLeaseSchema.parse(req.body);
    const result = await updateLease(req.params.id, body);
    createAuditLog({
      orgId, userId,
      action: 'update',
      entityType: 'lease',
      entityId: req.params.id,
      newValues: body,
      ...extractReqMeta(req),
    });
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
    next(err);
  }
});

// POST /api/leases/:id/commencement — post commencement JE (DR ROU Asset, CR Lease Liability)
router.post('/:id/commencement', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const je = await postCommencementEntry(req.params.id, userId);
    createAuditLog({
      orgId, userId,
      action: 'create',
      entityType: 'lease',
      entityId: req.params.id,
      newValues: { entryType: 'commencement', journalEntryId: je.id },
      ...extractReqMeta(req),
    });
    res.json(je);
  } catch (err) { next(err); }
});

// POST /api/leases/:id/payments — process a payment for a period
router.post('/:id/payments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { periodNumber, paymentDate } = req.body;
    if (!periodNumber) return res.status(400).json({ error: 'periodNumber is required' });
    const je = await processLeasePayment(req.params.id, periodNumber, userId, paymentDate);
    createAuditLog({
      orgId, userId,
      action: 'create',
      entityType: 'lease',
      entityId: req.params.id,
      newValues: { entryType: 'payment', periodNumber, journalEntryId: je.id },
      ...extractReqMeta(req),
    });
    res.json(je);
  } catch (err) { next(err); }
});

// POST /api/leases/:id/payments/batch — process all unpaid payments up to period
router.post('/:id/payments/batch', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { upToPeriod } = req.body;
    const results = await batchProcessPayments(req.params.id, userId, upToPeriod);
    createAuditLog({
      orgId, userId,
      action: 'create',
      entityType: 'lease',
      entityId: req.params.id,
      newValues: { entryType: 'payment_batch', results },
      ...extractReqMeta(req),
    });
    res.json(results);
  } catch (err) { next(err); }
});

// POST /api/leases/:id/depreciation — post depreciation for a period
router.post('/:id/depreciation', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { periodNumber } = req.body;
    if (!periodNumber) return res.status(400).json({ error: 'periodNumber is required' });
    const je = await postLeaseDepreciation(req.params.id, periodNumber, userId);
    createAuditLog({
      orgId, userId,
      action: 'create',
      entityType: 'lease',
      entityId: req.params.id,
      newValues: { entryType: 'depreciation', periodNumber, journalEntryId: je.id },
      ...extractReqMeta(req),
    });
    res.json(je);
  } catch (err) { next(err); }
});

// POST /api/leases/:id/depreciation/batch — post all unpaid depreciation up to period
router.post('/:id/depreciation/batch', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { upToPeriod } = req.body;
    const results = await batchPostDepreciation(req.params.id, userId, upToPeriod);
    createAuditLog({
      orgId, userId,
      action: 'create',
      entityType: 'lease',
      entityId: req.params.id,
      newValues: { entryType: 'depreciation_batch', results },
      ...extractReqMeta(req),
    });
    res.json(results);
  } catch (err) { next(err); }
});

// POST /api/leases/:id/modify — modify lease (change payment, term, rate)
router.post('/:id/modify', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const body = modifyLeaseSchema.parse(req.body);
    const je = await modifyLease(req.params.id, body, userId);
    createAuditLog({
      orgId, userId,
      action: 'update',
      entityType: 'lease',
      entityId: req.params.id,
      newValues: { entryType: 'modification', ...body },
      ...extractReqMeta(req),
    });
    res.json(je);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
    next(err);
  }
});

// POST /api/leases/:id/terminate — terminate lease
router.post('/:id/terminate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { terminationDate } = req.body;
    if (!terminationDate) return res.status(400).json({ error: 'terminationDate is required' });
    const je = await terminateLease(req.params.id, terminationDate, userId);
    createAuditLog({
      orgId, userId,
      action: 'update',
      entityType: 'lease',
      entityId: req.params.id,
      newValues: { entryType: 'termination', terminationDate, journalEntryId: je.id },
      ...extractReqMeta(req),
    });
    res.json(je);
  } catch (err) { next(err); }
});

export default router;
