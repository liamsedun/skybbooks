import { Router } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../../middleware/auth';
import { requireTenantPermission } from '../../middleware/tenantAuth';
import { asyncHandler } from '../../middleware/asyncHandler';
import {
  getHelpTickets, getHelpTicket, createHelpTicket, updateHelpTicket, assignHelpTicket, resolveHelpTicket, reopenHelpTicket, closeHelpTicket,
  getTicketResponses, createTicketResponse,
  getApprovalRequests, getApprovalRequest, createApprovalRequest, approveRequest, rejectRequest, cancelApprovalRequest,
  getApprovalConfigs, createApprovalConfig, updateApprovalConfig, deleteApprovalConfig,
  getEmployeeHeadcountReport, getTurnoverReport, getAttendanceReport, getLeaveReport, getTravelExpenseReport, getPerformanceSummaryReport, getRecruitmentFunnelReport, getCostReport, getComplianceReport, getCustomReport,
  getHrSettings, getHrSetting, upsertHrSetting,
  getPolicies, getPolicy, createPolicy, updatePolicy, deletePolicy,
  syncToAccounting, syncToPayroll, sendNotification, sendEmail, createCalendarEvent, createDocument,
} from '../../services/hr/support.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Help Desk ──

router.get('/help-tickets', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getHelpTickets(orgId, req.query as any);
  res.json({ success: true, data: result });
}));

router.get('/help-tickets/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getHelpTicket(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/help-tickets', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createHelpTicket(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/help-tickets/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateHelpTicket(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.patch('/help-tickets/:id/assign', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await assignHelpTicket(orgId, req.params.id, req.body.assigneeId);
  res.json({ success: true, data: result });
}));

router.patch('/help-tickets/:id/resolve', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await resolveHelpTicket(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/help-tickets/:id/reopen', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await reopenHelpTicket(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/help-tickets/:id/close', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await closeHelpTicket(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.get('/ticket-responses/:ticketId', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getTicketResponses(orgId, req.params.ticketId);
  res.json({ success: true, data: result });
}));

router.post('/ticket-responses', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createTicketResponse(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

// ── Approval Requests ──

router.get('/approval-requests', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getApprovalRequests(orgId, req.query as any);
  res.json({ success: true, data: result });
}));

router.get('/approval-requests/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getApprovalRequest(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/approval-requests', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createApprovalRequest(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.patch('/approval-requests/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await approveRequest(orgId, req.params.id, userId, req.body.comment);
  res.json({ success: true, data: result });
}));

router.patch('/approval-requests/:id/reject', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await rejectRequest(orgId, req.params.id, userId, req.body.comment);
  res.json({ success: true, data: result });
}));

router.patch('/approval-requests/:id/cancel', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await cancelApprovalRequest(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Approval Configs ──

router.get('/approval-configs', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getApprovalConfigs(orgId);
  res.json({ success: true, data: result });
}));

router.post('/approval-configs', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createApprovalConfig(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/approval-configs/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateApprovalConfig(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/approval-configs/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await deleteApprovalConfig(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Reports & Analytics ──

router.get('/reports/headcount', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await getEmployeeHeadcountReport(orgId, { ...req.query as any, userId });
  res.json({ success: true, data: result });
}));

router.get('/reports/turnover', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await getTurnoverReport(orgId, { ...req.query as any, userId });
  res.json({ success: true, data: result });
}));

router.get('/reports/attendance', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await getAttendanceReport(orgId, { ...req.query as any, userId });
  res.json({ success: true, data: result });
}));

router.get('/reports/leave', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await getLeaveReport(orgId, { ...req.query as any, userId });
  res.json({ success: true, data: result });
}));

router.get('/reports/travel-expense', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await getTravelExpenseReport(orgId, { ...req.query as any, userId });
  res.json({ success: true, data: result });
}));

router.get('/reports/performance-summary', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await getPerformanceSummaryReport(orgId, { ...req.query as any, userId });
  res.json({ success: true, data: result });
}));

router.get('/reports/recruitment-funnel', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await getRecruitmentFunnelReport(orgId, { ...req.query as any, userId });
  res.json({ success: true, data: result });
}));

router.get('/reports/cost', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await getCostReport(orgId, { ...req.query as any, userId });
  res.json({ success: true, data: result });
}));

router.get('/reports/compliance', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await getComplianceReport(orgId, { ...req.query as any, userId });
  res.json({ success: true, data: result });
}));

router.post('/reports/custom', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await getCustomReport(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

// ── Settings ──

router.get('/settings', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getHrSettings(orgId);
  res.json({ success: true, data: result });
}));

router.get('/settings/:key', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getHrSetting(orgId, req.params.key);
  res.json({ success: true, data: result });
}));

router.put('/settings/:key', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await upsertHrSetting(orgId, req.params.key, req.body.value);
  res.json({ success: true, data: result });
}));

// ── Policies ──

router.get('/policies', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getPolicies(orgId);
  res.json({ success: true, data: result });
}));

router.get('/policies/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getPolicy(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/policies', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createPolicy(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/policies/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updatePolicy(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/policies/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await deletePolicy(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Integrations ──

router.post('/integrations/sync-to-accounting', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await syncToAccounting(req.body);
  res.json({ success: true, data: result });
}));

router.post('/integrations/sync-to-payroll', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await syncToPayroll(req.body);
  res.json({ success: true, data: result });
}));

router.post('/integrations/send-notification', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await sendNotification(req.body);
  res.json({ success: true, data: result });
}));

router.post('/integrations/send-email', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await sendEmail(req.body);
  res.json({ success: true, data: result });
}));

router.post('/integrations/create-calendar-event', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await createCalendarEvent(req.body);
  res.json({ success: true, data: result });
}));

router.post('/integrations/create-document', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await createDocument(req.body);
  res.json({ success: true, data: result });
}));

export default router;
