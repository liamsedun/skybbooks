import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import {
  getContracts, getContract, createContract, updateContract, deleteContract,
  getObligations, getObligation, createObligation, updateObligation, deleteObligation,
  getSchedules, generateSchedule, addManualSchedule,
  recognizeRevenue, recognizeAllPending,
  getRecognitionReport, getDeferredRevenueSummary,
} from '../services/revenue.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Contracts ──

router.get('/contracts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const contracts = await getContracts(req.user!.orgId!);
    res.json(contracts);
  } catch (err) { next(err); }
});

router.get('/contracts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const contract = await getContract(req.user!.orgId!, req.params.id);
    res.json(contract);
  } catch (err) { next(err); }
});

router.post('/contracts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const contract = await createContract(req.user!.orgId!, req.user!.userId!, req.body);
    res.status(201).json(contract);
  } catch (err) { next(err); }
});

router.put('/contracts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const contract = await updateContract(req.user!.orgId!, req.user!.userId!, req.params.id, req.body);
    res.json(contract);
  } catch (err) { next(err); }
});

router.delete('/contracts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await deleteContract(req.user!.orgId!, req.user!.userId!, req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Performance Obligations ──

router.get('/contracts/:contractId/obligations', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const obligations = await getObligations(req.user!.orgId!, req.params.contractId);
    res.json(obligations);
  } catch (err) { next(err); }
});

router.get('/obligations/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const obligation = await getObligation(req.user!.orgId!, req.params.id);
    res.json(obligation);
  } catch (err) { next(err); }
});

router.post('/obligations', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const obligation = await createObligation(req.user!.orgId!, req.user!.userId!, req.body);
    res.status(201).json(obligation);
  } catch (err) { next(err); }
});

router.put('/obligations/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const obligation = await updateObligation(req.user!.orgId!, req.user!.userId!, req.params.id, req.body);
    res.json(obligation);
  } catch (err) { next(err); }
});

router.delete('/obligations/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await deleteObligation(req.user!.orgId!, req.user!.userId!, req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Revenue Schedules ──

router.get('/obligations/:obligationId/schedules', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schedules = await getSchedules(req.params.obligationId);
    res.json(schedules);
  } catch (err) { next(err); }
});

router.post('/obligations/:obligationId/schedules', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schedule = await addManualSchedule(req.params.obligationId, req.body);
    res.status(201).json(schedule);
  } catch (err) { next(err); }
});

router.post('/obligations/:obligationId/generate-schedule', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schedules = await generateSchedule(req.user!.orgId!, req.user!.userId!, req.params.obligationId, req.body);
    res.json(schedules);
  } catch (err) { next(err); }
});

// ── Revenue Recognition ──

router.post('/recognize/:scheduleId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recognizedDate = req.body.recognizedDate ? new Date(req.body.recognizedDate) : new Date();
    const result = await recognizeRevenue(req.user!.orgId!, req.user!.userId!, req.params.scheduleId, recognizedDate, req);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/recognize-all', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const asOfDate = req.body.asOfDate ? new Date(req.body.asOfDate) : new Date();
    const results = await recognizeAllPending(req.user!.orgId!, req.user!.userId!, asOfDate, req);
    res.json(results);
  } catch (err) { next(err); }
});

// ── Reports ──

router.get('/recognition-report', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const report = await getRecognitionReport(req.user!.orgId!, startDate, endDate);
    res.json(report);
  } catch (err) { next(err); }
});

router.get('/deferred-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : undefined;
    const summary = await getDeferredRevenueSummary(req.user!.orgId!, asOfDate);
    res.json(summary);
  } catch (err) { next(err); }
});

export default router;
