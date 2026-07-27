import { Router } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getStages,
  getDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  updateDealStage,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  getDashboard,
} from '../services/crm.service';

const router = Router();

router.use(authenticate);
router.use(requireOrg);

// ── Stages ──

router.get('/stages', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const stages = await getStages(orgId);
  res.json({ success: true, data: stages });
}));

// ── Deals ──

router.get('/deals', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const { stageId, status } = req.query as any;
  const deals = await getDeals(orgId, { stageId, status });
  res.json({ success: true, data: deals });
}));

router.get('/deals/:id', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const deal = await getDeal(orgId, req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
  res.json({ success: true, data: deal });
}));

router.post('/deals', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId!;
  const deal = await createDeal(orgId, userId, req.body);
  res.status(201).json({ success: true, data: deal });
}));

router.put('/deals/:id', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const deal = await updateDeal(orgId, req.params.id, req.body);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
  res.json({ success: true, data: deal });
}));

router.delete('/deals/:id', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const deleted = await deleteDeal(orgId, req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Deal not found' });
  res.json({ success: true, data: { id: deleted.id } });
}));

router.patch('/deals/:id/stage', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const { stageId } = req.body;
  if (!stageId) return res.status(400).json({ success: false, error: 'stageId is required' });
  const deal = await updateDealStage(orgId, req.params.id, stageId);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal or stage not found' });
  res.json({ success: true, data: deal });
}));

// ── Activities ──

router.get('/activities', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const { type, status, dealId, contactId } = req.query as any;
  const activities = await getActivities(orgId, { type, status, dealId, contactId });
  res.json({ success: true, data: activities });
}));

router.post('/activities', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const activity = await createActivity(orgId, req.body);
  res.status(201).json({ success: true, data: activity });
}));

router.put('/activities/:id', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const activity = await updateActivity(orgId, req.params.id, req.body);
  if (!activity) return res.status(404).json({ success: false, error: 'Activity not found' });
  res.json({ success: true, data: activity });
}));

router.delete('/activities/:id', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const deleted = await deleteActivity(orgId, req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Activity not found' });
  res.json({ success: true, data: { id: deleted.id } });
}));

// ── Dashboard ──

router.get('/dashboard', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const dashboard = await getDashboard(orgId);
  res.json({ success: true, data: dashboard });
}));

export default router;
