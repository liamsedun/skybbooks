import { Router, Response, NextFunction } from 'express';
import { authenticate, requireRole, resolveSuperAdmin, AuthenticatedRequest } from '../middleware/auth';
import {
  getDashboard, getOrganizations, getOrganizationDetail, updateOrganizationStatus,
  getRevenueAnalytics, getFailedPayments, getSystemHealth, getAuditLogs,
  getPlans, createPlan, updatePlan, getCoupons, getSubscriptions,
  getGrowthMetrics, getUsageStats,
  getRegionalPricing, createRegionalPricing, updateRegionalPricing, deleteRegionalPricing,
  getEnterpriseContracts, createEnterpriseContract, updateEnterpriseContract, deleteEnterpriseContract,
  getResellerContracts, createResellerContract, updateResellerContract, deleteResellerContract,
  getOrgConfigs, setOrgConfigKey, deleteOrgConfig,
  getWhiteLabelConfigs, upsertWhiteLabelConfig, deleteWhiteLabelConfig,
} from '../services/superAdmin.service';
import { getSaaSAnalytics } from '../services/saasAnalytics.service';

const router = Router();
router.use(authenticate);
router.use(resolveSuperAdmin);
router.use(requireRole('super_admin'));

router.get('/dashboard', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getDashboard();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/organizations', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const data = await getOrganizations(page, pageSize, search, status);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.get('/organizations/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getOrganizationDetail(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/organizations/:id/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await updateOrganizationStatus(req.params.id, req.body.status);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/revenue', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const data = await getRevenueAnalytics(startDate, endDate);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/failed-payments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const data = await getFailedPayments(limit);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/system-health', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getSystemHealth();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 50;
    const action = req.query.action as string | undefined;
    const data = await getAuditLogs(page, pageSize, action);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.get('/plans', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getPlans();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/plans', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await createPlan(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/plans/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await updatePlan(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/coupons', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getCoupons();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/subscriptions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const status = req.query.status as string | undefined;
    const data = await getSubscriptions(page, pageSize, status);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.get('/growth', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getGrowthMetrics();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/usage', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    const data = await getUsageStats(orgId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/analytics', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      planId: req.query.planId as string | undefined,
      region: req.query.region as string | undefined,
      billingCycle: req.query.billingCycle as string | undefined,
    };
    const data = await getSaaSAnalytics(filters);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// ENTERPRISE MANAGEMENT ROUTES
// ═══════════════════════════════════════

// ── Regional Pricing ──

router.get('/regional-pricing', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getRegionalPricing();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/regional-pricing', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await createRegionalPricing(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/regional-pricing/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await updateRegionalPricing(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/regional-pricing/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await deleteRegionalPricing(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Enterprise Contracts ──

router.get('/enterprise-contracts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const data = await getEnterpriseContracts(search);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/enterprise-contracts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await createEnterpriseContract({ ...req.body, createdBy: req.user!.userId });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/enterprise-contracts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await updateEnterpriseContract(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/enterprise-contracts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await deleteEnterpriseContract(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Reseller Contracts ──

router.get('/reseller-contracts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const data = await getResellerContracts(search);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/reseller-contracts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await createResellerContract({ ...req.body, createdBy: req.user!.userId });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/reseller-contracts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await updateResellerContract(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/reseller-contracts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await deleteResellerContract(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Org Config ──

router.get('/org-configs', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    const data = await getOrgConfigs(orgId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/org-configs', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { orgId, key, value, description } = req.body;
    const data = await setOrgConfigKey(orgId, key, value, description);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/org-configs/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await deleteOrgConfig(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── White Label Config ──

router.get('/white-label', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    const data = await getWhiteLabelConfigs(orgId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/white-label', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await upsertWhiteLabelConfig(req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/white-label/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await deleteWhiteLabelConfig(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
