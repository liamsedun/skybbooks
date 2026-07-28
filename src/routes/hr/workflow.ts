import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import {
  getWorkflowTemplates, getWorkflowTemplate, createWorkflowTemplate,
  updateWorkflowTemplate, deleteWorkflowTemplate,
  getAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule,
  executeWorkflow, dispatchEvent,
  createNotification, getNotifications, markNotificationRead,
  markAllNotificationsRead, getUnreadCount,
  getReminderConfigs, createReminderConfig, deleteReminderConfig,
  runScheduledAlerts, getWorkflowDashboard,
  createCalendarEvent, getCalendarEvents, markCalendarEventRead,
  createDocumentRequest, getDocumentRequests, completeDocumentRequest,
  createRenewalRecord, getRenewalRecords, processRenewal, getUpcomingRenewals, checkUpcomingRenewals,
  requestPolicyAcknowledgement, acknowledgePolicy, getPendingAcknowledgements, getAcknowledgementReport,
} from '../../services/hr/workflow.service';

const router = Router();

function asUser(req: Request) { return req.user?.employeeId || req.user?.id || 'system'; }
function orgId(req: Request) { return req.user?.orgId || req.user?.organisationId; }

// ── Workflow Templates ──
router.get('/workflow/templates', authenticate, async (req, res) => {
  const rows = await getWorkflowTemplates(orgId(req));
  res.json({ success: true, data: rows });
});

router.get('/workflow/templates/:id', authenticate, async (req, res) => {
  const row = await getWorkflowTemplate(orgId(req), req.params.id);
  res.json({ success: true, data: row });
});

router.post('/workflow/templates', authenticate, async (req, res) => {
  const row = await createWorkflowTemplate(orgId(req), { ...req.body, userId: asUser(req) });
  res.json({ success: true, data: row });
});

router.put('/workflow/templates/:id', authenticate, async (req, res) => {
  const row = await updateWorkflowTemplate(orgId(req), req.params.id, { ...req.body, userId: asUser(req) });
  res.json({ success: true, data: row });
});

router.delete('/workflow/templates/:id', authenticate, async (req, res) => {
  const row = await deleteWorkflowTemplate(orgId(req), req.params.id, asUser(req));
  res.json({ success: true, data: row });
});

// ── Workflow Instances / Execution ──
router.post('/workflow/execute', authenticate, async (req, res) => {
  const { templateId, trigger, sourceId, data } = req.body;
  const row = await executeWorkflow(orgId(req), templateId, trigger, sourceId, data, asUser(req));
  res.json({ success: true, data: row });
});

router.post('/workflow/dispatch', authenticate, async (req, res) => {
  const { event, sourceId, data } = req.body;
  const results = await dispatchEvent(orgId(req), event, sourceId, data, asUser(req));
  res.json({ success: true, data: results });
});

// ── Automation Rules ──
router.get('/automation-rules', authenticate, async (req, res) => {
  const rows = await getAutomationRules(orgId(req), req.query.event as string);
  res.json({ success: true, data: rows });
});

router.post('/automation-rules', authenticate, async (req, res) => {
  const row = await createAutomationRule(orgId(req), req.body);
  res.json({ success: true, data: row });
});

router.put('/automation-rules/:id', authenticate, async (req, res) => {
  const row = await updateAutomationRule(orgId(req), req.params.id, req.body);
  res.json({ success: true, data: row });
});

router.delete('/automation-rules/:id', authenticate, async (req, res) => {
  const row = await deleteAutomationRule(orgId(req), req.params.id);
  res.json({ success: true, data: row });
});

// ── Notifications ──
router.get('/notifications', authenticate, async (req, res) => {
  const empId = req.query.employeeId as string || asUser(req);
  const rows = await getNotifications(orgId(req), empId, req.query.unreadOnly === 'true');
  res.json({ success: true, data: rows });
});

router.get('/notifications/unread-count', authenticate, async (req, res) => {
  const empId = req.query.employeeId as string || asUser(req);
  const count = await getUnreadCount(orgId(req), empId);
  res.json({ success: true, data: count });
});

router.patch('/notifications/:id/read', authenticate, async (req, res) => {
  await markNotificationRead(orgId(req), req.params.id);
  res.json({ success: true });
});

router.post('/notifications', authenticate, async (req, res) => {
  const { employeeId, type, title, body, link } = req.body;
  const row = await createNotification(orgId(req), employeeId, type, title, body, link);
  res.json({ success: true, data: row });
});

router.post('/notifications/mark-all-read', authenticate, async (req, res) => {
  const empId = req.body.employeeId || asUser(req);
  await markAllNotificationsRead(orgId(req), empId);
  res.json({ success: true });
});

// ── Reminder Configs ──
router.get('/reminder-configs', authenticate, async (req, res) => {
  const rows = await getReminderConfigs(orgId(req), req.query.type as string);
  res.json({ success: true, data: rows });
});

router.post('/reminder-configs', authenticate, async (req, res) => {
  const row = await createReminderConfig(orgId(req), req.body);
  res.json({ success: true, data: row });
});

router.delete('/reminder-configs/:id', authenticate, async (req, res) => {
  const row = await deleteReminderConfig(orgId(req), req.params.id);
  res.json({ success: true, data: row });
});

// ── Scheduled Alerts ──
router.post('/run-alerts', authenticate, async (req, res) => {
  const results = await runScheduledAlerts(orgId(req));
  res.json({ success: true, data: results });
});

// ── Dashboard ──
router.get('/workflow/dashboard', authenticate, async (req, res) => {
  const empId = req.query.employeeId as string || asUser(req);
  const data = await getWorkflowDashboard(orgId(req), empId);
  res.json({ success: true, data });
});

// ── Calendar Events ──
router.get('/calendar-events', authenticate, async (req, res) => {
  const { employeeId, from, to } = req.query;
  const rows = await getCalendarEvents(orgId(req), employeeId as string, from ? new Date(from as string) : undefined, to ? new Date(to as string) : undefined);
  res.json({ success: true, data: rows });
});

router.post('/calendar-events', authenticate, async (req, res) => {
  const row = await createCalendarEvent(orgId(req), req.body);
  res.json({ success: true, data: row });
});

router.patch('/calendar-events/:id/read', authenticate, async (req, res) => {
  await markCalendarEventRead(orgId(req), req.params.id);
  res.json({ success: true });
});

// ── Document Requests ──
router.get('/document-requests', authenticate, async (req, res) => {
  const { employeeId, status } = req.query;
  const rows = await getDocumentRequests(orgId(req), employeeId as string, status as string);
  res.json({ success: true, data: rows });
});

router.post('/document-requests', authenticate, async (req, res) => {
  const row = await createDocumentRequest(orgId(req), { ...req.body, requestedBy: asUser(req) });
  res.json({ success: true, data: row });
});

router.patch('/document-requests/:id/complete', authenticate, async (req, res) => {
  const row = await completeDocumentRequest(orgId(req), req.params.id);
  res.json({ success: true, data: row });
});

// ── Renewal Tracking ──
router.get('/renewals', authenticate, async (req, res) => {
  const { type, status, employeeId } = req.query;
  const rows = await getRenewalRecords(orgId(req), type as string, status as string, employeeId as string);
  res.json({ success: true, data: rows });
});

router.get('/renewals/upcoming', authenticate, async (req, res) => {
  const days = req.query.days ? parseInt(req.query.days as string) : 30;
  const rows = await getUpcomingRenewals(orgId(req), days);
  res.json({ success: true, data: rows });
});

router.post('/renewals', authenticate, async (req, res) => {
  const row = await createRenewalRecord(orgId(req), req.body);
  res.json({ success: true, data: row });
});

router.patch('/renewals/:id/renew', authenticate, async (req, res) => {
  const { renewedDate, newExpiryDate, notes } = req.body;
  const row = await processRenewal(orgId(req), req.params.id, new Date(renewedDate), new Date(newExpiryDate), notes);
  res.json({ success: true, data: row });
});

router.post('/renewals/check', authenticate, async (req, res) => {
  const results = await checkUpcomingRenewals(orgId(req));
  res.json({ success: true, data: results });
});

// ── Policy Acknowledgements ──
router.get('/policy-acknowledgements', authenticate, async (req, res) => {
  const { employeeId, policyId } = req.query;
  const rows = policyId ? await getAcknowledgementReport(orgId(req), policyId as string) : await getPendingAcknowledgements(orgId(req), employeeId as string);
  res.json({ success: true, data: rows });
});

router.post('/policy-acknowledgements', authenticate, async (req, res) => {
  const row = await requestPolicyAcknowledgement(orgId(req), req.body);
  res.json({ success: true, data: row });
});

router.patch('/policy-acknowledgements/:id/acknowledge', authenticate, async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] as string;
  const row = await acknowledgePolicy(orgId(req), req.params.id, ip);
  res.json({ success: true, data: row });
});

// ── Manual Trigger (admin only) ──
router.post('/run-scheduled-tasks', authenticate, requireRole('admin'), async (req, res) => {
  const { tasks } = req.body;
  const results: any = {};
  if (!tasks || tasks.includes('alerts')) results.alerts = await runScheduledAlerts(orgId(req));
  if (!tasks || tasks.includes('renewals')) results.renewals = await checkUpcomingRenewals(orgId(req));
  res.json({ success: true, data: results });
});

export default router;
