import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { ValidationError } from '../lib/errors';
import { extractReqMeta } from '../services/audit.service';
import * as marketplace from '../services/addonMarketplace.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Catalog (public) ──

router.get('/addons/marketplace', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const products = await marketplace.listProducts();
  res.json(ok(products));
}));

router.get('/addons/marketplace/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const product = await marketplace.getProduct(req.params.id);
  res.json(ok(product));
}));

// ── Admin: manage catalog ──

router.post('/addons/marketplace', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = z.object({
    code: z.string().min(1), name: z.string().min(1), description: z.string().optional(), icon: z.string().optional(),
    category: z.string().min(1), monthlyPriceKobo: z.number().int().min(0), annualPriceKobo: z.number().int().min(0),
    usageLimit: z.number().int().optional(), limitKey: z.string().optional(),
    isActive: z.boolean().optional(), isPublic: z.boolean().optional(), sortOrder: z.number().int().optional(),
  }).parse(req.body);
  const product = await marketplace.createProduct(data);
  res.status(201).json(ok(product));
}));

router.put('/addons/marketplace/:id', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const product = await marketplace.updateProduct(req.params.id, req.body);
  res.json(ok(product));
}));

// ── Org purchased add-ons ──

router.get('/addons/my', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const addons = await marketplace.getOrgAddons(orgId);
  res.json(ok(addons));
}));

// ── Purchase ──

const purchaseSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
  billingCycle: z.enum(['monthly', 'annual']).default('monthly'),
  autoRenew: z.boolean().default(true),
});

router.post('/addons/purchase', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId!;
  const data = purchaseSchema.parse(req.body);
  const addon = await marketplace.purchaseAddon(orgId, userId, data, extractReqMeta(req));
  res.status(201).json(ok(addon));
}));

// ── Cancel ──

router.post('/addons/:id/cancel', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId!;
  const addon = await marketplace.cancelAddon(req.params.id, orgId, userId, extractReqMeta(req));
  res.json(ok(addon));
}));

// ── Reactivate ──

router.post('/addons/:id/reactivate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const addon = await marketplace.reactivateAddon(req.params.id, orgId);
  res.json(ok(addon));
}));

// ── Update quantity ──

router.put('/addons/:id/quantity', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { quantity } = z.object({ quantity: z.number().int().min(1) }).parse(req.body);
  const addon = await marketplace.updateAddonQuantity(req.params.id, orgId, quantity);
  res.json(ok(addon));
}));

// ── Toggle auto-renew ──

router.put('/addons/:id/auto-renew', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const { autoRenew } = z.object({ autoRenew: z.boolean() }).parse(req.body);
  const addon = await marketplace.toggleAutoRenew(req.params.id, orgId, autoRenew);
  res.json(ok(addon));
}));

// ── Effective limits (with add-ons applied) ──

router.get('/addons/effective-limits', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.orgId!;
  const limits = await marketplace.getEffectiveLimits(orgId);
  res.json(ok(limits));
}));

// ── Admin: batch renewal ──

router.post('/addons/process-renewals', requireRole('admin'), asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const result = await marketplace.processAddonRenewals();
  res.json(ok(result));
}));

export default router;
