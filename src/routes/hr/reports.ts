import { Router, Response } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import {
  getEmployeeReport, getEmployeeDetailReport, getLeaveReportData, getEmployeeLeaveBalances,
  getAttendanceReportData, getPerformanceReportData, getTravelReportData,
  getCompensationReportData, getTurnoverReportData, getRecruitmentReportData,
  getKpiDashboard, getExportData, getDrillDownData,
  getScheduledReports, createScheduledReport, deleteScheduledReport,
} from '../../services/hr/report.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

function orgId(req: AuthenticatedRequest) { return req.user!.orgId!; }

// ── Employee Reports ──
router.get('/employees', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await getEmployeeReport(orgId(req), req.query as any) });
}));

router.get('/employees/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await getEmployeeDetailReport(orgId(req), req.params.id) });
}));

// ── Leave Reports ──
router.get('/leave', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await getLeaveReportData(orgId(req), req.query as any) });
}));

router.get('/leave/balances', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await getEmployeeLeaveBalances(orgId(req), req.query.employeeId as string) });
}));

// ── Attendance Reports ──
router.get('/attendance', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await getAttendanceReportData(orgId(req), req.query as any) });
}));

// ── Performance Reports ──
router.get('/performance', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await getPerformanceReportData(orgId(req), req.query as any) });
}));

// ── Travel Reports ──
router.get('/travel', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await getTravelReportData(orgId(req), req.query as any) });
}));

// ── Compensation Reports ──
router.get('/compensation', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await getCompensationReportData(orgId(req), req.query as any) });
}));

// ── Turnover Reports ──
router.get('/turnover', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await getTurnoverReportData(orgId(req), req.query as any) });
}));

// ── Recruitment Reports ──
router.get('/recruitment', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await getRecruitmentReportData(orgId(req), req.query as any) });
}));

// ── KPI Dashboard ──
router.get('/kpi-dashboard', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await getKpiDashboard(orgId(req)) });
}));

// ── Export ──
router.get('/export/:reportType', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await getExportData(orgId(req), req.params.reportType, req.query as any);
  res.json({ success: true, data });
}));

// ── Drill-down ──
router.get('/drill-down/:reportType/:groupKey/:groupValue', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rows = await getDrillDownData(orgId(req), req.params.reportType, req.params.groupKey, req.params.groupValue, req.query as any);
  res.json({ success: true, data: rows });
}));

// ── Scheduled Reports ──
router.get('/scheduled', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await getScheduledReports(orgId(req)) });
}));

router.post('/scheduled', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await createScheduledReport(orgId(req), req.body) });
}));

router.delete('/scheduled/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await deleteScheduledReport(orgId(req), req.params.id) });
}));

export default router;
