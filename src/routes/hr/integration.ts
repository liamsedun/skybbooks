import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import {
  syncHrEmployeeToPayroll, syncTerminationToPayroll, bulkSyncAllHrToPayroll,
  getHrDataForPayrollRun, postHrCostEntry, postTimesheetToProject,
  createCrossModuleTask, getCrossModuleTasks, createCrossModuleEvent,
  getHrSystemNotifications, getHrAiInsights, syncHrDocToSystem,
  createOnboardingTasks, createOffboardingTasks, enrichPayrollRunWithHrData,
} from '../../services/hr/integration.service';

const router = Router();

function orgId(req: Request) { return req.user?.orgId || req.user?.organisationId; }
function asUser(req: Request) { return req.user?.employeeId || req.user?.id || 'system'; }

// ── Payroll Sync ──
router.post('/integrate/payroll/sync-employee/:hrEmployeeId', authenticate, async (req, res) => {
  const row = await syncHrEmployeeToPayroll(orgId(req), req.params.hrEmployeeId, asUser(req));
  res.json({ success: true, data: row });
});

router.post('/integrate/payroll/sync-termination/:hrEmployeeId', authenticate, async (req, res) => {
  const { exitDate, reason } = req.body;
  const row = await syncTerminationToPayroll(orgId(req), req.params.hrEmployeeId, new Date(exitDate), reason, asUser(req));
  res.json({ success: true, data: row });
});

router.post('/integrate/payroll/bulk-sync', authenticate, requireRole('admin'), async (req, res) => {
  const results = await bulkSyncAllHrToPayroll(orgId(req), asUser(req));
  res.json({ success: true, data: results });
});

router.get('/integrate/payroll/hr-data', authenticate, async (req, res) => {
  const data = await getHrDataForPayrollRun(orgId(req));
  res.json({ success: true, data });
});

router.get('/integrate/payroll/enrich-run/:runId', authenticate, async (req, res) => {
  const data = await enrichPayrollRunWithHrData(orgId(req), req.params.runId);
  res.json({ success: true, data });
});

// ── Accounting ──
router.post('/integrate/accounting/post-cost', authenticate, async (req, res) => {
  const result = await postHrCostEntry(orgId(req), { ...req.body, createdBy: asUser(req) });
  res.json({ success: true, data: result });
});

// ── Projects ──
router.post('/integrate/projects/post-timesheet', authenticate, async (req, res) => {
  const result = await postTimesheetToProject(orgId(req), { ...req.body, createdBy: asUser(req) });
  res.json({ success: true, data: result });
});

// ── Cross-Module Tasks ──
router.get('/integrate/tasks', authenticate, async (req, res) => {
  const { assignedTo, status, category, relatedTo, relatedId } = req.query;
  const rows = await getCrossModuleTasks(orgId(req), { assignedTo: assignedTo as string, status: status as string, category: category as string, relatedTo: relatedTo as string, relatedId: relatedId as string });
  res.json({ success: true, data: rows });
});

router.post('/integrate/tasks', authenticate, async (req, res) => {
  const row = await createCrossModuleTask(orgId(req), { ...req.body, createdBy: asUser(req) });
  res.json({ success: true, data: row });
});

// ── Cross-Module Calendar ──
router.post('/integrate/calendar/events', authenticate, async (req, res) => {
  const row = await createCrossModuleEvent(orgId(req), req.body);
  res.json({ success: true, data: row });
});

// ── System Notifications ──
router.get('/integrate/notifications', authenticate, async (req, res) => {
  const items = await getHrSystemNotifications(orgId(req));
  res.json({ success: true, data: items });
});

// ── AI Insights ──
router.get('/integrate/ai/insights', authenticate, async (req, res) => {
  const data = await getHrAiInsights(orgId(req));
  res.json({ success: true, data });
});

// ── Document Bridge ──
router.post('/integrate/documents/sync/:hrDocFileId', authenticate, async (req, res) => {
  const row = await syncHrDocToSystem(orgId(req), req.params.hrDocFileId, asUser(req));
  res.json({ success: true, data: row });
});

// ── Onboarding/Offboarding Automation ──
router.post('/integrate/onboarding/:employeeId', authenticate, async (req, res) => {
  const { departmentId } = req.body;
  const result = await createOnboardingTasks(orgId(req), req.params.employeeId, departmentId, asUser(req));
  res.json({ success: true, data: result });
});

router.post('/integrate/offboarding/:employeeId', authenticate, async (req, res) => {
  const { exitDate, reason } = req.body;
  const result = await createOffboardingTasks(orgId(req), req.params.employeeId, new Date(exitDate), reason, asUser(req));
  res.json({ success: true, data: result });
});

export default router;
