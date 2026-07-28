import { Router } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../../middleware/auth';
import { requireTenantPermission } from '../../middleware/tenantAuth';
import { asyncHandler } from '../../middleware/asyncHandler';
import {
  getLetterTemplates, createLetterTemplate, updateLetterTemplate, deleteLetterTemplate,
  getLetters, getLetter, generateLetter, deleteLetter,
  getTravelRequests, getTravelRequest, createTravelRequest, updateTravelRequest, deleteTravelRequest, approveTravelRequest, declineTravelRequest,
  getExpenseReports, getExpenseReport, createExpenseReport, updateExpenseReport, deleteExpenseReport, submitExpenseReport, approveExpenseReport, reimburseExpenseReport,
  getExpenseEntries, createExpenseEntry, updateExpenseEntry, deleteExpenseEntry,
  getCompensationBands, createCompensationBand, updateCompensationBand, deleteCompensationBand,
  getEmployeeCompensation, createEmployeeCompensation, updateEmployeeCompensation,
  getBenefits, createBenefit, updateBenefit, deleteBenefit,
  getEmployeeBenefits, enrollBenefit, disenrollBenefit,
  getAllowances, getAllowance, createAllowance, updateAllowance, deleteAllowance,
  getEmployeeAllowances, assignEmployeeAllowance, removeEmployeeAllowance,
  getBonuses, getBonus, createBonus, updateBonus, approveBonus, deleteBonus,
  getDeductions, getDeduction, createDeduction, updateDeduction, deleteDeduction,
  getEmployeeDeductions, assignEmployeeDeduction, removeEmployeeDeduction,
  getSalaryReviews, getSalaryReview, createSalaryReview, approveSalaryReview, rejectSalaryReview, deleteSalaryReview,
  getCompensationHistory,
  getCompensationReport,
  getHrTasks, createHrTask, updateHrTask, completeHrTask, deleteHrTask,
  getWorkflowTemplates, createWorkflowTemplate, updateWorkflowTemplate, deleteWorkflowTemplate,
  getOperationsDashboard
} from '../../services/hr/operations.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Letter Templates ──

router.get('/letter-templates', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await getLetterTemplates(req.user!.orgId!);
  res.json({ success: true, data: result });
}));

router.post('/letter-templates', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await createLetterTemplate(req.user!.orgId!, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.put('/letter-templates/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await updateLetterTemplate(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.delete('/letter-templates/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await deleteLetterTemplate(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Letters ──

router.get('/letters', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const filters = {
    ...(req.query.employeeId ? { employeeId: req.query.employeeId as string } : {}),
    ...(req.query.type ? { type: req.query.type as string } : {}),
  };
  const result = await getLetters(req.user!.orgId!, Object.keys(filters).length ? filters : undefined);
  res.json({ success: true, data: result });
}));

router.get('/letters/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await getLetter(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/letters/generate', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await generateLetter(req.user!.orgId!, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.delete('/letters/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await deleteLetter(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Travel Requests ──

router.get('/travel-requests', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const filters = {
    ...(req.query.employeeId ? { employeeId: req.query.employeeId as string } : {}),
    ...(req.query.status ? { status: req.query.status as string } : {}),
  };
  const result = await getTravelRequests(req.user!.orgId!, Object.keys(filters).length ? filters : undefined);
  res.json({ success: true, data: result });
}));

router.get('/travel-requests/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await getTravelRequest(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/travel-requests', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await createTravelRequest(req.user!.orgId!, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.put('/travel-requests/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await updateTravelRequest(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.delete('/travel-requests/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await deleteTravelRequest(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/travel-requests/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await approveTravelRequest(req.user!.orgId!, req.params.id, req.user!.id);
  res.json({ success: true, data: result });
}));

router.patch('/travel-requests/:id/decline', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await declineTravelRequest(req.user!.orgId!, req.params.id, req.body.reason);
  res.json({ success: true, data: result });
}));

// ── Expense Reports ──

router.get('/expense-reports', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const filters = {
    ...(req.query.employeeId ? { employeeId: req.query.employeeId as string } : {}),
    ...(req.query.status ? { status: req.query.status as string } : {}),
  };
  const result = await getExpenseReports(req.user!.orgId!, Object.keys(filters).length ? filters : undefined);
  res.json({ success: true, data: result });
}));

router.get('/expense-reports/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await getExpenseReport(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/expense-reports', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await createExpenseReport(req.user!.orgId!, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.put('/expense-reports/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await updateExpenseReport(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.delete('/expense-reports/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await deleteExpenseReport(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/expense-reports/:id/submit', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await submitExpenseReport(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/expense-reports/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await approveExpenseReport(req.user!.orgId!, req.params.id, req.user!.id);
  res.json({ success: true, data: result });
}));

router.patch('/expense-reports/:id/reimburse', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await reimburseExpenseReport(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Expense Entries ──

router.get('/expense-entries/:reportId', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await getExpenseEntries(req.user!.orgId!, req.params.reportId);
  res.json({ success: true, data: result });
}));

router.post('/expense-entries', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await createExpenseEntry(req.user!.orgId!, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.put('/expense-entries/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await updateExpenseEntry(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.delete('/expense-entries/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await deleteExpenseEntry(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Compensation Bands ──

router.get('/compensation-bands', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await getCompensationBands(req.user!.orgId!);
  res.json({ success: true, data: result });
}));

router.post('/compensation-bands', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await createCompensationBand(req.user!.orgId!, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.put('/compensation-bands/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await updateCompensationBand(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.delete('/compensation-bands/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await deleteCompensationBand(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Employee Compensation ──

router.get('/employee-compensation/:employeeId', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await getEmployeeCompensation(req.user!.orgId!, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/employee-compensation', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await createEmployeeCompensation(req.user!.orgId!, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.put('/employee-compensation/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await updateEmployeeCompensation(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

// ── Benefits ──

router.get('/benefits', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await getBenefits(req.user!.orgId!);
  res.json({ success: true, data: result });
}));

router.post('/benefits', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await createBenefit(req.user!.orgId!, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.put('/benefits/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await updateBenefit(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.delete('/benefits/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await deleteBenefit(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

router.get('/employee-benefits/:employeeId', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await getEmployeeBenefits(req.user!.orgId!, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/employee-benefits/enroll', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await enrollBenefit(req.user!.orgId!, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.delete('/employee-benefits/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await disenrollBenefit(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Tasks ──

router.get('/tasks', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const filters: Record<string, any> = {};
  if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo as string;
  if (req.query.priority) filters.priority = req.query.priority as string;
  if (req.query.isCompleted !== undefined) filters.isCompleted = req.query.isCompleted === 'true';
  if (req.query.category) filters.category = req.query.category as string;
  const result = await getHrTasks(req.user!.orgId!, Object.keys(filters).length ? filters : undefined);
  res.json({ success: true, data: result });
}));

router.post('/tasks', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await createHrTask(req.user!.orgId!, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.put('/tasks/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await updateHrTask(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.patch('/tasks/:id/complete', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await completeHrTask(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

router.delete('/tasks/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await deleteHrTask(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Workflow Templates ──

router.get('/workflow-templates', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await getWorkflowTemplates(req.user!.orgId!);
  res.json({ success: true, data: result });
}));

router.post('/workflow-templates', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await createWorkflowTemplate(req.user!.orgId!, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.put('/workflow-templates/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await updateWorkflowTemplate(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.delete('/workflow-templates/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await deleteWorkflowTemplate(req.user!.orgId!, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Allowances ──

router.get('/allowances', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getAllowances(req.user!.orgId!) });
}));

router.get('/allowances/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getAllowance(req.user!.orgId!, req.params.id) });
}));

router.post('/allowances', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await createAllowance(req.user!.orgId!, { ...req.body, userId: req.user!.id }) });
}));

router.put('/allowances/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await updateAllowance(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id }) });
}));

router.delete('/allowances/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  await deleteAllowance(req.user!.orgId!, req.params.id);
  res.json({ success: true });
}));

// ── Employee Allowances ──

router.get('/employee-allowances/:employeeId', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getEmployeeAllowances(req.user!.orgId!, req.params.employeeId) });
}));

router.post('/employee-allowances', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await assignEmployeeAllowance(req.user!.orgId!, req.body) });
}));

router.delete('/employee-allowances/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  await removeEmployeeAllowance(req.user!.orgId!, req.params.id);
  res.json({ success: true });
}));

// ── Bonuses ──

router.get('/bonuses', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getBonuses(req.user!.orgId!, req.query.employeeId as string) });
}));

router.get('/bonuses/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getBonus(req.user!.orgId!, req.params.id) });
}));

router.post('/bonuses', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await createBonus(req.user!.orgId!, { ...req.body, userId: req.user!.id }) });
}));

router.put('/bonuses/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await updateBonus(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id }) });
}));

router.patch('/bonuses/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await approveBonus(req.user!.orgId!, req.params.id, req.user!.id) });
}));

router.delete('/bonuses/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  await deleteBonus(req.user!.orgId!, req.params.id);
  res.json({ success: true });
}));

// ── Deductions ──

router.get('/deductions', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getDeductions(req.user!.orgId!) });
}));

router.get('/deductions/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getDeduction(req.user!.orgId!, req.params.id) });
}));

router.post('/deductions', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await createDeduction(req.user!.orgId!, { ...req.body, userId: req.user!.id }) });
}));

router.put('/deductions/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await updateDeduction(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id }) });
}));

router.delete('/deductions/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  await deleteDeduction(req.user!.orgId!, req.params.id);
  res.json({ success: true });
}));

// ── Employee Deductions ──

router.get('/employee-deductions/:employeeId', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getEmployeeDeductions(req.user!.orgId!, req.params.employeeId) });
}));

router.post('/employee-deductions', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await assignEmployeeDeduction(req.user!.orgId!, req.body) });
}));

router.delete('/employee-deductions/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  await removeEmployeeDeduction(req.user!.orgId!, req.params.id);
  res.json({ success: true });
}));

// ── Salary Reviews ──

router.get('/salary-reviews', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getSalaryReviews(req.user!.orgId!, req.query.employeeId as string) });
}));

router.get('/salary-reviews/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getSalaryReview(req.user!.orgId!, req.params.id) });
}));

router.post('/salary-reviews', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await createSalaryReview(req.user!.orgId!, { ...req.body, userId: req.user!.id }) });
}));

router.patch('/salary-reviews/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await approveSalaryReview(req.user!.orgId!, req.params.id, req.user!.id) });
}));

router.patch('/salary-reviews/:id/reject', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await rejectSalaryReview(req.user!.orgId!, req.params.id) });
}));

router.delete('/salary-reviews/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  await deleteSalaryReview(req.user!.orgId!, req.params.id);
  res.json({ success: true });
}));

// ── Compensation History ──

router.get('/compensation-history', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getCompensationHistory(req.user!.orgId!, req.query.employeeId as string) });
}));

// ── Compensation Report ──

router.get('/compensation-report', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getCompensationReport(req.user!.orgId!) });
}));

// ── Operations Dashboard ──

router.get('/operations/dashboard', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const result = await getOperationsDashboard(req.user!.orgId!);
  res.json({ success: true, data: result });
}));

export default router;
