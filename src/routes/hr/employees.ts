import { Router } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../../middleware/auth';
import { requireTenantPermission } from '../../middleware/tenantAuth';
import { asyncHandler } from '../../middleware/asyncHandler';
import {
  getDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment,
  getDesignations, getDesignation, createDesignation, updateDesignation, deleteDesignation,
  getEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee, generateEmployeeCode,
  softDeleteEmployee, restoreEmployee, updateEmployeePhoto,
  getEmployeeDocuments, createEmployeeDocument, deleteEmployeeDocument,
  getEmergencyContacts, createEmergencyContact, updateEmergencyContact, deleteEmergencyContact,
  getOffboardingTasks, createOffboardingTask, completeOffboardingTask,
  getExitInterviews, getExitInterview, createExitInterview,
  getEmployeeDashboard, getEmployeeFullProfile,
  getEmployeeDependants, createEmployeeDependant, updateEmployeeDependant, deleteEmployeeDependant,
  getEmployeeEducation, createEmployeeEducation, updateEmployeeEducation, deleteEmployeeEducation,
  getEmployeeEmploymentHistory, createEmployeeEmploymentHistory, updateEmployeeEmploymentHistory, deleteEmployeeEmploymentHistory,
  getEmployeeSkills, createEmployeeSkill, updateEmployeeSkill, deleteEmployeeSkill,
  getEmployeeCertifications, createEmployeeCertification, updateEmployeeCertification, deleteEmployeeCertification,
  getEmployeeMedical, upsertEmployeeMedical,
  getEmployeeTimeline, addTimelineEntry,
  transferEmployee, getEmployeeTransfers,
  promoteEmployee, getEmployeePromotions,
  confirmEmployee,
  suspendEmployee, terminateEmployee, reinstateEmployee, reactivateEmployee,
  getEmployeeDisciplinaryRecords,
  bulkImportEmployees, bulkExportEmployees,
} from '../../services/hr/employee.service';
import { extractReqMeta } from '../../services/audit.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Departments ──

router.get('/departments', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getDepartments(orgId);
  res.json({ success: true, data: result });
}));

router.get('/departments/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getDepartment(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/departments', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createDepartment(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/departments/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateDepartment(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/departments/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await deleteDepartment(orgId, req.params.id, { userId });
  res.json({ success: true, data: result });
}));

// ── Designations ──

router.get('/designations', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getDesignations(orgId);
  res.json({ success: true, data: result });
}));

router.post('/designations', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createDesignation(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/designations/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateDesignation(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/designations/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await deleteDesignation(orgId, req.params.id, { userId });
  res.json({ success: true, data: result });
}));

// ── Employees ──

router.get('/employees/code/next', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const code = await generateEmployeeCode(orgId);
  res.json({ success: true, data: { code } });
}));

router.get('/employees', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployees(orgId, req.query);
  res.json({ success: true, data: result });
}));

router.get('/employees/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployee(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/employees', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createEmployee(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/employees/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateEmployee(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/employees/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await deleteEmployee(orgId, req.params.id, { userId });
  res.json({ success: true, data: result });
}));

// ── Employee Documents ──

router.get('/employees/:employeeId/documents', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeeDocuments(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/employees/:employeeId/documents', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createEmployeeDocument(orgId, { ...req.body, employeeId: req.params.employeeId, userId });
  res.json({ success: true, data: result });
}));

router.delete('/documents/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await deleteEmployeeDocument(orgId, req.params.id, { userId });
  res.json({ success: true, data: result });
}));

// ── Emergency Contacts ──

router.get('/employees/:employeeId/emergency-contacts', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmergencyContacts(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/employees/:employeeId/emergency-contacts', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createEmergencyContact(orgId, { ...req.body, employeeId: req.params.employeeId, userId });
  res.json({ success: true, data: result });
}));

router.put('/emergency-contacts/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateEmergencyContact(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/emergency-contacts/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await deleteEmergencyContact(orgId, req.params.id, { userId });
  res.json({ success: true, data: result });
}));

// ── Offboarding ──

router.get('/offboarding/:employeeId', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getOffboardingTasks(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/offboarding/tasks', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createOffboardingTask(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.patch('/offboarding/tasks/:id/complete', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await completeOffboardingTask(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Exit Interviews ──

router.get('/exit-interviews', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getExitInterviews(orgId);
  res.json({ success: true, data: result });
}));

router.get('/exit-interviews/:employeeId', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getExitInterview(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/exit-interviews', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createExitInterview(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

// ── Soft Delete / Restore ──

router.patch('/employees/:id/soft-delete', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await softDeleteEmployee(orgId, req.params.id, { userId });
  res.json({ success: true, data: result });
}));

router.patch('/employees/:id/restore', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await restoreEmployee(orgId, req.params.id, { userId });
  res.json({ success: true, data: result });
}));

// ── Photo ──

router.patch('/employees/:id/photo', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateEmployeePhoto(orgId, req.params.id, req.body.photoUrl, { userId });
  res.json({ success: true, data: result });
}));

// ── Full Profile ──

router.get('/employees/:id/profile', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeeFullProfile(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Dependants ──

router.get('/employees/:employeeId/dependants', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeeDependants(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/employees/:employeeId/dependants', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createEmployeeDependant(orgId, { ...req.body, employeeId: req.params.employeeId, userId });
  res.json({ success: true, data: result });
}));

router.put('/dependants/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateEmployeeDependant(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/dependants/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await deleteEmployeeDependant(orgId, req.params.id, { userId });
  res.json({ success: true, data: result });
}));

// ── Education ──

router.get('/employees/:employeeId/education', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeeEducation(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/employees/:employeeId/education', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createEmployeeEducation(orgId, { ...req.body, employeeId: req.params.employeeId, userId });
  res.json({ success: true, data: result });
}));

router.put('/education/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateEmployeeEducation(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/education/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await deleteEmployeeEducation(orgId, req.params.id, { userId });
  res.json({ success: true, data: result });
}));

// ── Employment History ──

router.get('/employees/:employeeId/employment-history', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeeEmploymentHistory(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/employees/:employeeId/employment-history', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createEmployeeEmploymentHistory(orgId, { ...req.body, employeeId: req.params.employeeId, userId });
  res.json({ success: true, data: result });
}));

router.put('/employment-history/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateEmployeeEmploymentHistory(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/employment-history/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await deleteEmployeeEmploymentHistory(orgId, req.params.id, { userId });
  res.json({ success: true, data: result });
}));

// ── Skills ──

router.get('/employees/:employeeId/skills', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeeSkills(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/employees/:employeeId/skills', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createEmployeeSkill(orgId, { ...req.body, employeeId: req.params.employeeId, userId });
  res.json({ success: true, data: result });
}));

router.put('/skills/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateEmployeeSkill(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/skills/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await deleteEmployeeSkill(orgId, req.params.id, { userId });
  res.json({ success: true, data: result });
}));

// ── Certifications ──

router.get('/employees/:employeeId/certifications', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeeCertifications(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/employees/:employeeId/certifications', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createEmployeeCertification(orgId, { ...req.body, employeeId: req.params.employeeId, userId });
  res.json({ success: true, data: result });
}));

router.put('/certifications/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateEmployeeCertification(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/certifications/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await deleteEmployeeCertification(orgId, req.params.id, { userId });
  res.json({ success: true, data: result });
}));

// ── Medical ──

router.get('/employees/:employeeId/medical', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeeMedical(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.put('/employees/:employeeId/medical', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await upsertEmployeeMedical(orgId, req.params.employeeId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

// ── Timeline ──

router.get('/employees/:employeeId/timeline', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeeTimeline(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

router.post('/employees/:employeeId/timeline', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await addTimelineEntry(orgId, { ...req.body, employeeId: req.params.employeeId, userId });
  res.json({ success: true, data: result });
}));

// ── Lifecycle: Transfer ──

router.post('/employees/:id/transfer', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await transferEmployee(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.get('/employees/:employeeId/transfers', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeeTransfers(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

// ── Lifecycle: Promotion ──

router.post('/employees/:id/promote', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await promoteEmployee(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.get('/employees/:employeeId/promotions', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeePromotions(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

// ── Lifecycle: Confirmation ──

router.post('/employees/:id/confirm', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await confirmEmployee(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

// ── Lifecycle: Suspension ──

router.post('/employees/:id/suspend', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await suspendEmployee(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

// ── Lifecycle: Termination ──

router.post('/employees/:id/terminate', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await terminateEmployee(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

// ── Lifecycle: Reinstatement ──

router.post('/employees/:id/reinstate', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await reinstateEmployee(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

// ── Lifecycle: Reactivation ──

router.post('/employees/:id/reactivate', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await reactivateEmployee(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

// ── Disciplinary Records ──

router.get('/employees/:employeeId/disciplinary', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeeDisciplinaryRecords(orgId, req.params.employeeId);
  res.json({ success: true, data: result });
}));

// ── Bulk Import / Export ──

router.post('/employees/bulk-import', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await bulkImportEmployees(orgId, req.body.employees || []);
  res.json({ success: true, data: result });
}));

router.post('/employees/bulk-export', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await bulkExportEmployees(orgId, req.body);
  res.json({ success: true, data: result });
}));

// ── Dashboard ──

router.get('/dashboard', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEmployeeDashboard(orgId);
  res.json({ success: true, data: result });
}));

export default router;
