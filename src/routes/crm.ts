import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { requireTenantPermission } from '../middleware/tenantAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { db, rolePermissions } from '../db/schema';
import { getDefaultPermissionsForRole } from '../lib/tenantPermissions';
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

router.get('/stages', requireTenantPermission('crm:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const stages = await getStages(orgId);
  res.json({ success: true, data: stages });
}));

// ── Deals ──

router.get('/deals', requireTenantPermission('crm:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const { stageId, status } = req.query as any;
  const deals = await getDeals(orgId, { stageId, status });
  res.json({ success: true, data: deals });
}));

router.get('/deals/:id', requireTenantPermission('crm:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const deal = await getDeal(orgId, req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
  res.json({ success: true, data: deal });
}));

router.post('/deals', requireTenantPermission('crm:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId!;
  const deal = await createDeal(orgId, userId, req.body);
  res.status(201).json({ success: true, data: deal });
}));

router.put('/deals/:id', requireTenantPermission('crm:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const deal = await updateDeal(orgId, req.params.id, req.body);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
  res.json({ success: true, data: deal });
}));

router.delete('/deals/:id', requireTenantPermission('crm:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const deleted = await deleteDeal(orgId, req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Deal not found' });
  res.json({ success: true, data: { id: deleted.id } });
}));

router.patch('/deals/:id/stage', requireTenantPermission('crm:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const { stageId } = req.body;
  if (!stageId) return res.status(400).json({ success: false, error: 'stageId is required' });
  const deal = await updateDealStage(orgId, req.params.id, stageId);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal or stage not found' });
  res.json({ success: true, data: deal });
}));

// ── Activities ──

router.get('/activities', requireTenantPermission('crm:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const { type, status, dealId, contactId } = req.query as any;
  const activities = await getActivities(orgId, { type, status, dealId, contactId });
  res.json({ success: true, data: activities });
}));

router.post('/activities', requireTenantPermission('crm:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const activity = await createActivity(orgId, req.body);
  res.status(201).json({ success: true, data: activity });
}));

router.put('/activities/:id', requireTenantPermission('crm:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const activity = await updateActivity(orgId, req.params.id, req.body);
  if (!activity) return res.status(404).json({ success: false, error: 'Activity not found' });
  res.json({ success: true, data: activity });
}));

router.delete('/activities/:id', requireTenantPermission('crm:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const deleted = await deleteActivity(orgId, req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Activity not found' });
  res.json({ success: true, data: { id: deleted.id } });
}));

// ── Dashboard ──

router.get('/dashboard', requireTenantPermission('crm:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const dashboard = await getDashboard(orgId);
  res.json({ success: true, data: dashboard });
}));

// ── Role Permissions (CRM access control) ──

router.get('/role-permissions', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const roles = ['owner', 'admin', 'administrator', 'accountant', 'manager', 'sales', 'inventory', 'cashier', 'auditor', 'hr', 'purchasing', 'staff'];
  const crmPerms = ['crm:read', 'crm:create', 'crm:update', 'crm:delete'];
  const result: { role: string; label: string; defaultPerms: string[]; overridePerms: string[] | null }[] = [];
  for (const role of roles) {
    const defaults = getDefaultPermissionsForRole(role).filter((p: string) => crmPerms.includes(p));
    const overrides = await db.select().from(rolePermissions).where(and(eq(rolePermissions.orgId, orgId), eq(rolePermissions.role, role)));
    const overridePerms = overrides.length > 0 ? overrides.map((r: any) => r.permission).filter((p: string) => crmPerms.includes(p)) : null;
    result.push({ role, label: role.charAt(0).toUpperCase() + role.slice(1), defaultPerms: defaults, overridePerms });
  }
  res.json({ success: true, data: result });
}));

router.put('/role-permissions', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const { role, permissions } = req.body;
  if (!role || !Array.isArray(permissions)) {
    return res.status(400).json({ success: false, error: 'role and permissions array required' });
  }
  const crmPerms = ['crm:read', 'crm:create', 'crm:update', 'crm:delete'];
  const validPerms = permissions.filter((p: string) => crmPerms.includes(p));
  await db.delete(rolePermissions).where(and(eq(rolePermissions.orgId, orgId), eq(rolePermissions.role, role)));
  if (validPerms.length > 0) {
    const defaults = getDefaultPermissionsForRole(role);
    const mergedPerms = [...new Set([...defaults.filter((p: string) => !crmPerms.includes(p)), ...validPerms])] as string[];
    for (const perm of mergedPerms) {
      await db.insert(rolePermissions).values({ orgId, role, permission: perm }).onConflictDoNothing();
    }
  }
  res.json({ success: true, data: { role, permissions: validPerms } });
}));

export default router;
