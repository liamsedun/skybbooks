import { Router, Response } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../../middleware/auth';
import { requireTenantPermission } from '../../middleware/tenantAuth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { extractReqMeta } from '../../services/audit.service';
import {
  getLeaveTypes, getLeaveType, createLeaveType, updateLeaveType, deleteLeaveType,
  getLeaveRequests, getLeaveRequest, createLeaveRequest, approveLeaveRequest, rejectLeaveRequest, cancelLeaveRequest, recallLeaveRequest,
  getLeaveBalances, allocateLeaveBalance, recalculateLeaveBalance,
  getLeavePolicies, getLeavePolicy, createLeavePolicy, updateLeavePolicy, deleteLeavePolicy,
  getHolidays, getHoliday, createHoliday, updateHoliday, deleteHoliday, getHolidayCalendar,
  getCompensatoryLeaves, getCompensatoryLeave, createCompensatoryLeave, approveCompensatoryLeave, deleteCompensatoryLeave,
  runLeaveAccrual, getAccrualLogs,
  getLeaveCalendar, getLeaveReport,
  getAttendanceRecords, getAttendanceRecord, getTodayAttendance, clockIn, clockOut, breakIn, breakOut, updateAttendance, approveAttendance, getAttendanceSummary, getAttendanceReport, recalculateAllAttendance, generateTimesheetsFromAttendance,
  getShiftAssignments, assignShift, updateShiftAssignment, deleteShiftAssignment,
  getShiftRotations, getShiftRotation, createShiftRotation, updateShiftRotation, deleteShiftRotation, addRotationAssignee, removeRotationAssignee,
  getAttendanceExceptions, createAttendanceException, approveAttendanceException, rejectAttendanceException, deleteAttendanceException,
  getOvertimePolicies, createOvertimePolicy, updateOvertimePolicy, deleteOvertimePolicy,
  getShifts, getShift, createShift, updateShift, deleteShift,
  getTimesheets, getTimesheet, createTimesheet, updateTimesheet, submitTimesheet, approveTimesheet,
  getTimesheetEntries, createTimesheetEntry, updateTimesheetEntry, deleteTimesheetEntry,
  getTimeDashboard,
} from '../../services/hr/time.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Leave Types ──

router.get('/leave-types', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getLeaveTypes(orgId);
  res.json({ success: true, data: result });
}));

router.get('/leave-types/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getLeaveType(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/leave-types', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await createLeaveType(orgId, { ...req.body, userId });
  res.status(201).json({ success: true, data: result });
}));

router.put('/leave-types/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await updateLeaveType(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/leave-types/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  await deleteLeaveType(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Leave Policies ──

router.get('/leave-policies', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getLeavePolicies(orgId);
  res.json({ success: true, data: result });
}));

router.get('/leave-policies/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getLeavePolicy(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/leave-policies', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await createLeavePolicy(orgId, { ...req.body, userId });
  res.status(201).json({ success: true, data: result });
}));

router.put('/leave-policies/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await updateLeavePolicy(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/leave-policies/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  await deleteLeavePolicy(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Holidays ──

router.get('/holidays', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
  const result = await getHolidays(orgId, year);
  res.json({ success: true, data: result });
}));

router.get('/holidays/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getHoliday(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/holidays', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await createHoliday(orgId, { ...req.body, userId });
  res.status(201).json({ success: true, data: result });
}));

router.put('/holidays/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await updateHoliday(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/holidays/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  await deleteHoliday(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

router.get('/holidays/calendar/:year', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getHolidayCalendar(orgId, parseInt(req.params.year, 10));
  res.json({ success: true, data: result });
}));

// ── Compensatory Leave ──

router.get('/compensatory-leaves', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { employeeId } = req.query as any;
  const result = await getCompensatoryLeaves(orgId, employeeId);
  res.json({ success: true, data: result });
}));

router.get('/compensatory-leaves/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getCompensatoryLeave(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/compensatory-leaves', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await createCompensatoryLeave(orgId, { ...req.body, userId });
  res.status(201).json({ success: true, data: result });
}));

router.patch('/compensatory-leaves/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await approveCompensatoryLeave(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.delete('/compensatory-leaves/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  await deleteCompensatoryLeave(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Leave Requests ──

router.get('/leave-requests', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { employeeId, leaveTypeId, status, year } = req.query as any;
  const result = await getLeaveRequests(orgId, { employeeId, leaveTypeId, status, year: year ? parseInt(year as string, 10) : undefined });
  res.json({ success: true, data: result });
}));

router.get('/leave-requests/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getLeaveRequest(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/leave-requests', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await createLeaveRequest(orgId, { ...req.body, userId });
  res.status(201).json({ success: true, data: result });
}));

router.patch('/leave-requests/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.body.userId || req.user!.userId;
  const result = await approveLeaveRequest(orgId, req.params.id, userId, req.body.remarks);
  res.json({ success: true, data: result });
}));

router.patch('/leave-requests/:id/reject', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.body.userId || req.user!.userId;
  const result = await rejectLeaveRequest(orgId, req.params.id, req.body.reason);
  res.json({ success: true, data: result });
}));

router.patch('/leave-requests/:id/cancel', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await cancelLeaveRequest(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/leave-requests/:id/recall', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await recallLeaveRequest(orgId, req.params.id, userId);
  res.json({ success: true, data: result });
}));

// ── Leave Balances ──

router.get('/leave-balances', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { employeeId, year } = req.query as any;
  const result = await getLeaveBalances(orgId, employeeId, year ? parseInt(year as string, 10) : undefined);
  res.json({ success: true, data: result });
}));

router.post('/leave-balances/allocate', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await allocateLeaveBalance(orgId, { ...req.body, userId });
  res.status(201).json({ success: true, data: result });
}));

router.post('/leave-balances/recalculate', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { employeeId, leaveTypeId, year } = req.body;
  const result = await recalculateLeaveBalance(orgId, employeeId, leaveTypeId, year);
  res.json({ success: true, data: result });
}));

// ── Accrual ──

router.post('/leave-accrual/run', requireTenantPermission('hr:admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { period } = req.body;
  const result = await runLeaveAccrual(orgId, period || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  res.json({ success: true, data: result });
}));

router.get('/leave-accrual/logs', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getAccrualLogs(orgId);
  res.json({ success: true, data: result });
}));

// ── Leave Calendar ──

router.get('/leave-calendar', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { dateFrom, dateTo, employeeId } = req.query as any;
  const result = await getLeaveCalendar(orgId, dateFrom, dateTo, employeeId);
  res.json({ success: true, data: result });
}));

// ── Leave Reports ──

router.get('/leave-report', requireTenantPermission('hr:reports'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
  const result = await getLeaveReport(orgId, year);
  res.json({ success: true, data: result });
}));

// ── Attendance ──

router.get('/attendance', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { employeeId, dateFrom, dateTo, status, shiftId, isLate, isRemote } = req.query as any;
  const result = await getAttendanceRecords(orgId, {
    employeeId, dateFrom, dateTo, status, shiftId,
    isLate: isLate === 'true' ? true : isLate === 'false' ? false : undefined,
    isRemote: isRemote === 'true' ? true : isRemote === 'false' ? false : undefined,
  });
  res.json({ success: true, data: result });
}));

router.get('/attendance/today', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { employeeId } = req.query as any;
  if (!employeeId) return res.status(400).json({ success: false, error: 'employeeId is required' });
  const result = await getTodayAttendance(orgId, employeeId as string);
  res.json({ success: true, data: result });
}));

router.get('/attendance/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getAttendanceRecord(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/attendance/clock-in', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await clockIn(orgId, req.body.employeeId, req.body);
  res.status(201).json({ success: true, data: result });
}));

router.post('/attendance/clock-out', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await clockOut(orgId, req.body.employeeId, req.body);
  res.json({ success: true, data: result });
}));

router.post('/attendance/break-in', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await breakIn(orgId, req.body.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/attendance/break-out', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await breakOut(orgId, req.body.employeeId);
  res.json({ success: true, data: result });
}));

router.put('/attendance/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await updateAttendance(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.patch('/attendance/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await approveAttendance(orgId, req.params.id, userId);
  res.json({ success: true, data: result });
}));

router.post('/attendance/calculate', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { dateFrom, dateTo } = req.body;
  const result = await recalculateAllAttendance(orgId, dateFrom, dateTo);
  res.json({ success: true, data: result });
}));

router.get('/attendance/summary', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { employeeId, dateFrom, dateTo } = req.query as any;
  const result = await getAttendanceSummary(orgId, employeeId as string, dateFrom as string, dateTo as string);
  res.json({ success: true, data: result });
}));

router.get('/attendance/report', requireTenantPermission('hr:reports'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { dateFrom, dateTo } = req.query as any;
  if (!dateFrom || !dateTo) return res.status(400).json({ success: false, error: 'dateFrom and dateTo are required' });
  const result = await getAttendanceReport(orgId, dateFrom as string, dateTo as string);
  res.json({ success: true, data: result });
}));

router.post('/attendance/generate-timesheets', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { weekStart, weekEnd, employeeId } = req.body;
  const result = await generateTimesheetsFromAttendance(orgId, weekStart, weekEnd, employeeId);
  res.json({ success: true, data: result });
}));

// ── Shift Assignments ──

router.get('/shift-assignments', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { employeeId, shiftId } = req.query as any;
  const result = await getShiftAssignments(orgId, employeeId, shiftId);
  res.json({ success: true, data: result });
}));

router.post('/shift-assignments', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await assignShift(orgId, { ...req.body, assignedBy: userId });
  res.status(201).json({ success: true, data: result });
}));

router.put('/shift-assignments/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await updateShiftAssignment(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/shift-assignments/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  await deleteShiftAssignment(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Shift Rotations ──

router.get('/shift-rotations', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getShiftRotations(orgId);
  res.json({ success: true, data: result });
}));

router.get('/shift-rotations/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getShiftRotation(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/shift-rotations', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await createShiftRotation(orgId, { ...req.body, userId });
  res.status(201).json({ success: true, data: result });
}));

router.put('/shift-rotations/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await updateShiftRotation(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/shift-rotations/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  await deleteShiftRotation(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

router.post('/shift-rotations/:id/assignees', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await addRotationAssignee(orgId, { ...req.body, rotationId: req.params.id, orgId });
  res.status(201).json({ success: true, data: result });
}));

router.delete('/shift-rotations/:rotationId/assignees/:assigneeId', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  await removeRotationAssignee(orgId, req.params.assigneeId);
  res.json({ success: true, data: null });
}));

// ── Attendance Exceptions ──

router.get('/attendance-exceptions', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { employeeId } = req.query as any;
  const result = await getAttendanceExceptions(orgId, employeeId);
  res.json({ success: true, data: result });
}));

router.post('/attendance-exceptions', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await createAttendanceException(orgId, { ...req.body, userId });
  res.status(201).json({ success: true, data: result });
}));

router.patch('/attendance-exceptions/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await approveAttendanceException(orgId, req.params.id, userId);
  res.json({ success: true, data: result });
}));

router.patch('/attendance-exceptions/:id/reject', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await rejectAttendanceException(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.delete('/attendance-exceptions/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  await deleteAttendanceException(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Overtime Policies ──

router.get('/overtime-policies', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getOvertimePolicies(orgId);
  res.json({ success: true, data: result });
}));

router.post('/overtime-policies', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await createOvertimePolicy(orgId, { ...req.body, userId });
  res.status(201).json({ success: true, data: result });
}));

router.put('/overtime-policies/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await updateOvertimePolicy(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/overtime-policies/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  await deleteOvertimePolicy(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Shifts ──

router.get('/shifts', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getShifts(orgId);
  res.json({ success: true, data: result });
}));

router.get('/shifts/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getShift(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/shifts', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await createShift(orgId, { ...req.body, userId });
  res.status(201).json({ success: true, data: result });
}));

router.put('/shifts/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await updateShift(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/shifts/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  await deleteShift(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Timesheets ──

router.get('/timesheets', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { employeeId, weekStart, status } = req.query as any;
  const result = await getTimesheets(orgId, { employeeId, weekStart, status });
  res.json({ success: true, data: result });
}));

router.get('/timesheets/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getTimesheet(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/timesheets', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await createTimesheet(orgId, { ...req.body, userId });
  res.status(201).json({ success: true, data: result });
}));

router.put('/timesheets/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await updateTimesheet(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.patch('/timesheets/:id/submit', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await submitTimesheet(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/timesheets/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.body.userId || req.user!.userId;
  const result = await approveTimesheet(orgId, req.params.id, userId);
  res.json({ success: true, data: result });
}));

// ── Timesheet Entries ──

router.get('/timesheet-entries/:timesheetId', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getTimesheetEntries(orgId, req.params.timesheetId);
  res.json({ success: true, data: result });
}));

router.post('/timesheet-entries', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await createTimesheetEntry(orgId, { ...req.body, userId });
  res.status(201).json({ success: true, data: result });
}));

router.put('/timesheet-entries/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await updateTimesheetEntry(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/timesheet-entries/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  await deleteTimesheetEntry(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Time Dashboard ──

router.get('/time/dashboard', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const result = await getTimeDashboard(orgId);
  res.json({ success: true, data: result });
}));

export default router;
