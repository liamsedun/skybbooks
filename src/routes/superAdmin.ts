import { Router, Response, NextFunction } from 'express';
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
import { startImpersonation, stopImpersonation } from '../middleware/impersonation';
import {
  platformAuthenticate,
  platformUserGuard,
  requirePlatformPermission,
  PlatformAuthenticatedRequest,
} from '../middleware/platformAuth';
import { PlatformPermission } from '../lib/platformPermissions';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(platformAuthenticate);
router.use(platformUserGuard);

// ── Dashboard & Overview ──
router.get('/dashboard', requirePlatformPermission(PlatformPermission.AnalyticsRead),
  asyncHandler(async (_req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await getDashboard();
    res.json({ success: true, data });
  })
);

router.get('/organizations', requirePlatformPermission(PlatformPermission.OrgsRead),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const data = await getOrganizations(page, pageSize, search, status);
    res.json({ success: true, ...data });
  })
);

router.get('/organizations/:id', requirePlatformPermission(PlatformPermission.OrgsRead),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await getOrganizationDetail(req.params.id);
    res.json({ success: true, data });
  })
);

router.put('/organizations/:id/status', requirePlatformPermission(PlatformPermission.OrgsManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await updateOrganizationStatus(req.params.id, req.body.status);
    res.json({ success: true, data });
  })
);

router.get('/revenue', requirePlatformPermission(PlatformPermission.BillingRead),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const data = await getRevenueAnalytics(startDate, endDate);
    res.json({ success: true, data });
  })
);

router.get('/failed-payments', requirePlatformPermission(PlatformPermission.BillingRead),
  asyncHandler(async (_req: PlatformAuthenticatedRequest, res: Response) => {
    const limit = Number(_req.query.limit) || 20;
    const data = await getFailedPayments(limit);
    res.json({ success: true, data });
  })
);

router.get('/system-health', requirePlatformPermission(PlatformPermission.SystemRead),
  asyncHandler(async (_req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await getSystemHealth();
    res.json({ success: true, data });
  })
);

router.get('/audit-logs', requirePlatformPermission(PlatformPermission.AuditLogsRead),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 50;
    const action = req.query.action as string | undefined;
    const data = await getAuditLogs(page, pageSize, action);
    res.json({ success: true, ...data });
  })
);

// ── Plans ──
router.get('/plans', requirePlatformPermission(PlatformPermission.PlansRead),
  asyncHandler(async (_req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await getPlans();
    res.json({ success: true, data });
  })
);

router.post('/plans', requirePlatformPermission(PlatformPermission.PlansManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await createPlan(req.body);
    res.status(201).json({ success: true, data });
  })
);

router.put('/plans/:id', requirePlatformPermission(PlatformPermission.PlansManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await updatePlan(req.params.id, req.body);
    res.json({ success: true, data });
  })
);

// ── Coupons, Subscriptions, Growth, Usage, Analytics ──
router.get('/coupons', requirePlatformPermission(PlatformPermission.SubscriptionsRead),
  asyncHandler(async (_req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await getCoupons();
    res.json({ success: true, data });
  })
);

router.get('/subscriptions', requirePlatformPermission(PlatformPermission.SubscriptionsRead),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const status = req.query.status as string | undefined;
    const data = await getSubscriptions(page, pageSize, status);
    res.json({ success: true, ...data });
  })
);

router.get('/growth', requirePlatformPermission(PlatformPermission.GrowthRead),
  asyncHandler(async (_req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await getGrowthMetrics();
    res.json({ success: true, data });
  })
);

router.get('/usage', requirePlatformPermission(PlatformPermission.AnalyticsRead),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const orgId = req.query.orgId as string | undefined;
    const data = await getUsageStats(orgId);
    res.json({ success: true, data });
  })
);

router.get('/analytics', requirePlatformPermission(PlatformPermission.AnalyticsRead),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      planId: req.query.planId as string | undefined,
      region: req.query.region as string | undefined,
      billingCycle: req.query.billingCycle as string | undefined,
    };
    const data = await getSaaSAnalytics(filters);
    res.json({ success: true, data });
  })
);

// ── Regional Pricing ──
router.get('/regional-pricing', requirePlatformPermission(PlatformPermission.RegionalPricingManage),
  asyncHandler(async (_req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await getRegionalPricing();
    res.json({ success: true, data });
  })
);

router.post('/regional-pricing', requirePlatformPermission(PlatformPermission.RegionalPricingManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await createRegionalPricing(req.body);
    res.status(201).json({ success: true, data });
  })
);

router.put('/regional-pricing/:id', requirePlatformPermission(PlatformPermission.RegionalPricingManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await updateRegionalPricing(req.params.id, req.body);
    res.json({ success: true, data });
  })
);

router.delete('/regional-pricing/:id', requirePlatformPermission(PlatformPermission.RegionalPricingManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    await deleteRegionalPricing(req.params.id);
    res.json({ success: true });
  })
);

// ── Enterprise Contracts ──
router.get('/enterprise-contracts', requirePlatformPermission(PlatformPermission.EnterpriseContractsManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const search = req.query.search as string | undefined;
    const data = await getEnterpriseContracts(search);
    res.json({ success: true, data });
  })
);

router.post('/enterprise-contracts', requirePlatformPermission(PlatformPermission.EnterpriseContractsManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await createEnterpriseContract({ ...req.body, createdBy: req.platformUser!.id });
    res.status(201).json({ success: true, data });
  })
);

router.put('/enterprise-contracts/:id', requirePlatformPermission(PlatformPermission.EnterpriseContractsManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await updateEnterpriseContract(req.params.id, req.body);
    res.json({ success: true, data });
  })
);

router.delete('/enterprise-contracts/:id', requirePlatformPermission(PlatformPermission.EnterpriseContractsManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    await deleteEnterpriseContract(req.params.id);
    res.json({ success: true });
  })
);

// ── Reseller Contracts ──
router.get('/reseller-contracts', requirePlatformPermission(PlatformPermission.ResellerContractsManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const search = req.query.search as string | undefined;
    const data = await getResellerContracts(search);
    res.json({ success: true, data });
  })
);

router.post('/reseller-contracts', requirePlatformPermission(PlatformPermission.ResellerContractsManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await createResellerContract({ ...req.body, createdBy: req.platformUser!.id });
    res.status(201).json({ success: true, data });
  })
);

router.put('/reseller-contracts/:id', requirePlatformPermission(PlatformPermission.ResellerContractsManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await updateResellerContract(req.params.id, req.body);
    res.json({ success: true, data });
  })
);

router.delete('/reseller-contracts/:id', requirePlatformPermission(PlatformPermission.ResellerContractsManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    await deleteResellerContract(req.params.id);
    res.json({ success: true });
  })
);

// ── Org Config ──
router.get('/org-configs', requirePlatformPermission(PlatformPermission.OrgConfigManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const orgId = req.query.orgId as string | undefined;
    const data = await getOrgConfigs(orgId);
    res.json({ success: true, data });
  })
);

router.post('/org-configs', requirePlatformPermission(PlatformPermission.OrgConfigManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const { orgId, key, value, description } = req.body;
    const data = await setOrgConfigKey(orgId, key, value, description);
    res.status(201).json({ success: true, data });
  })
);

router.delete('/org-configs/:id', requirePlatformPermission(PlatformPermission.OrgConfigManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    await deleteOrgConfig(req.params.id);
    res.json({ success: true });
  })
);

// ── White Label ──
router.get('/white-label', requirePlatformPermission(PlatformPermission.WhiteLabelManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const orgId = req.query.orgId as string | undefined;
    const data = await getWhiteLabelConfigs(orgId);
    res.json({ success: true, data });
  })
);

router.post('/white-label', requirePlatformPermission(PlatformPermission.WhiteLabelManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    const data = await upsertWhiteLabelConfig(req.body);
    res.json({ success: true, data });
  })
);

router.delete('/white-label/:id', requirePlatformPermission(PlatformPermission.WhiteLabelManage),
  asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
    await deleteWhiteLabelConfig(req.params.id);
    res.json({ success: true });
  })
);

// ── Impersonation ──
router.post('/impersonate', requirePlatformPermission(PlatformPermission.ImpersonationUse), startImpersonation);
router.post('/impersonate/stop', requirePlatformPermission(PlatformPermission.ImpersonationUse), stopImpersonation);

export default router;
