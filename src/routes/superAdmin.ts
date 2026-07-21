import { Router, Response, NextFunction } from 'express';
import { authenticate, requireRole, resolveSuperAdmin, AuthenticatedRequest } from '../middleware/auth';
import {
  getDashboard, getOrganizations, getOrganizationDetail, updateOrganizationStatus,
  getRevenueAnalytics, getFailedPayments, getSystemHealth, getAuditLogs,
  getPlans, createPlan, updatePlan, getCoupons, getSubscriptions,
  getGrowthMetrics, getUsageStats,
} from '../services/superAdmin.service';

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
    const status = req.query.status as string | undefined;
    const data = await getSubscriptions(status);
    res.json({ success: true, data });
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

export default router;
