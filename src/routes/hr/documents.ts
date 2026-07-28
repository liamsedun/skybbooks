import { Router } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../../middleware/auth';
import { requireTenantPermission } from '../../middleware/tenantAuth';
import { asyncHandler } from '../../middleware/asyncHandler';
import {
  getDocDashboard, getDocCategories, getDocCategory, createDocCategory, updateDocCategory, deleteDocCategory,
  getDocFiles, getDocFile, createDocFile, updateDocFile, uploadNewVersion, deleteDocFile,
  getDocVersions,
  getDocPermissions, setDocPermission, removeDocPermission,
  getDocEmployeeLinks, linkDocToEmployee, unlinkDocFromEmployee,
  getEmployeeDocs,
} from '../../services/hr/document.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// Dashboard
router.get('/documents/dashboard', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getDocDashboard(req.user!.orgId!) });
}));

// Categories
router.get('/documents/categories', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getDocCategories(req.user!.orgId!) });
}));
router.get('/documents/categories/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getDocCategory(req.user!.orgId!, req.params.id) });
}));
router.post('/documents/categories', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await createDocCategory(req.user!.orgId!, { ...req.body, userId: req.user!.id }) });
}));
router.put('/documents/categories/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await updateDocCategory(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id }) });
}));
router.delete('/documents/categories/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  await deleteDocCategory(req.user!.orgId!, req.params.id);
  res.json({ success: true });
}));

// Files
router.get('/documents/files', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const { categoryId, status, search, employeeId, expiryBefore } = req.query as any;
  res.json({ success: true, data: await getDocFiles(req.user!.orgId!, { categoryId, status, search, employeeId, expiryBefore }) });
}));
router.get('/documents/files/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getDocFile(req.user!.orgId!, req.params.id) });
}));
router.post('/documents/files', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await createDocFile(req.user!.orgId!, { ...req.body, uploadedBy: req.user!.id }) });
}));
router.put('/documents/files/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await updateDocFile(req.user!.orgId!, req.params.id, { ...req.body, userId: req.user!.id }) });
}));
router.post('/documents/files/:id/version', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await uploadNewVersion(req.user!.orgId!, req.params.id, { ...req.body, uploadedBy: req.user!.id }) });
}));
router.delete('/documents/files/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  await deleteDocFile(req.user!.orgId!, req.params.id);
  res.json({ success: true });
}));

// Versions
router.get('/documents/files/:id/versions', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getDocVersions(req.user!.orgId!, req.params.id) });
}));

// Permissions
router.get('/documents/files/:id/permissions', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getDocPermissions(req.user!.orgId!, req.params.id) });
}));
router.post('/documents/permissions', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await setDocPermission(req.user!.orgId!, { ...req.body, grantedBy: req.user!.id }) });
}));
router.delete('/documents/permissions/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  await removeDocPermission(req.user!.orgId!, req.params.id);
  res.json({ success: true });
}));

// Employee Links
router.get('/documents/files/:id/employees', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getDocEmployeeLinks(req.user!.orgId!, req.params.id) });
}));
router.post('/documents/employee-links', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await linkDocToEmployee(req.user!.orgId!, req.body) });
}));
router.delete('/documents/employee-links/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  await unlinkDocFromEmployee(req.user!.orgId!, req.params.id);
  res.json({ success: true });
}));

// Employee-specific docs
router.get('/documents/employee/:employeeId', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  res.json({ success: true, data: await getEmployeeDocs(req.user!.orgId!, req.params.employeeId) });
}));

export default router;
