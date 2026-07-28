import { Router } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../../middleware/auth';
import { requireTenantPermission } from '../../middleware/tenantAuth';
import { asyncHandler } from '../../middleware/asyncHandler';
import {
  getTravelAdvances, getTravelAdvance, createTravelAdvance, updateTravelAdvance,
  approveTravelAdvance, disburseTravelAdvance, deleteTravelAdvance,
  getExpenseReports, linkExpenseToTravel,
  getTravelSettlements, getTravelSettlement, createTravelSettlement, settleTravel,
  getTravelHistory, getTravelReport, getTravelDashboard,
} from '../../services/hr/travel.service';
import {
  getTravelRequests, getTravelRequest, createTravelRequest, updateTravelRequest,
  deleteTravelRequest, approveTravelRequest, declineTravelRequest,
} from '../../services/hr/operations.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Travel Dashboard ──

router.get('/travel/dashboard', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getTravelDashboard(req.user!.orgId!) });
}));

// ── Travel Requests ──

router.get('/travel-requests', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const { employeeId, status, dateFrom, dateTo } = req.query as any;
  const filters = { employeeId, status, dateFrom, dateTo };
  res.json({ success: true, data: await getTravelRequests(req.user!.orgId!, Object.keys(filters).length ? filters : undefined) });
}));

router.get('/travel-requests/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getTravelRequest(req.user!.orgId!, req.params.id) });
}));

router.post('/travel-requests', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await createTravelRequest(req.user!.orgId!, { ...req.body, userId: req.user!.id }) });
}));

router.put('/travel-requests/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await updateTravelRequest(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id }) });
}));

router.patch('/travel-requests/:id/submit', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await updateTravelRequest(req.user!.orgId!, req.params.id, { status: 'submitted', userId: req.user!.id }) });
}));

router.patch('/travel-requests/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await approveTravelRequest(req.user!.orgId!, req.params.id, req.user!.id) });
}));

router.patch('/travel-requests/:id/decline', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await declineTravelRequest(req.user!.orgId!, req.params.id, req.body.reason) });
}));

router.delete('/travel-requests/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  await deleteTravelRequest(req.user!.orgId!, req.params.id);
  res.json({ success: true });
}));

// ── Travel Advances ──

router.get('/travel-advances', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getTravelAdvances(req.user!.orgId!, req.query.employeeId as string) });
}));

router.get('/travel-advances/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getTravelAdvance(req.user!.orgId!, req.params.id) });
}));

router.post('/travel-advances', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await createTravelAdvance(req.user!.orgId!, { ...req.body, userId: req.user!.id }) });
}));

router.put('/travel-advances/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await updateTravelAdvance(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id }) });
}));

router.patch('/travel-advances/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await approveTravelAdvance(req.user!.orgId!, req.params.id, req.user!.id) });
}));

router.patch('/travel-advances/:id/disburse', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await disburseTravelAdvance(req.user!.orgId!, req.params.id) });
}));

router.delete('/travel-advances/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  await deleteTravelAdvance(req.user!.orgId!, req.params.id);
  res.json({ success: true });
}));

// ── Expense Reports (travel-linked) ──

router.get('/travel-expenses', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const { employeeId, status, travelRequestId } = req.query as any;
  res.json({ success: true, data: await getExpenseReports(req.user!.orgId!, { employeeId, status, travelRequestId }) });
}));

router.patch('/travel-expenses/:id/link', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await linkExpenseToTravel(req.user!.orgId!, req.params.id, req.body.travelRequestId) });
}));

// ── Settlements ──

router.get('/travel-settlements', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getTravelSettlements(req.user!.orgId!, req.query.travelRequestId as string) });
}));

router.get('/travel-settlements/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getTravelSettlement(req.user!.orgId!, req.params.id) });
}));

router.post('/travel-settlements', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await createTravelSettlement(req.user!.orgId!, { ...req.body, userId: req.user!.id }) });
}));

router.post('/travel-settlements/auto-settle/:travelRequestId', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await settleTravel(req.user!.orgId!, req.params.travelRequestId, req.user!.id) });
}));

// ── Travel History ──

router.get('/travel-history', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getTravelHistory(req.user!.orgId!, req.query.employeeId as string) });
}));

// ── Travel Report ──

router.get('/travel-report', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const { dateFrom, dateTo } = req.query as any;
  res.json({ success: true, data: await getTravelReport(req.user!.orgId!, { dateFrom, dateTo }) });
}));

export default router;
