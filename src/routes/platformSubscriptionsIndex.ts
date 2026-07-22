import { Router } from 'express';
import { platformAuthenticate, platformUserGuard, PlatformAuthenticatedRequest } from '../middleware/platformAuth';
import subscriptionRouter, { subscriptionWebhookRouter } from './subscriptions';
import lifecycleRouter from './subscriptionLifecycle';
import billingRouter, { billingWebhookRouter } from './subscriptionBilling';
import billingEngineRouter from './subscriptionBillingEngine';
import portalRouter from './subscriptionPortal';
import addonMarketplaceRouter from './addonMarketplace';

const router = Router();

// Platform auth for all subscription routes
router.use(platformAuthenticate);
router.use(platformUserGuard);

// Map platform user context to req.user shim for backward compat with route handlers
router.use((req: PlatformAuthenticatedRequest, _res, next) => {
  const orgId = (req.headers['x-org-id'] as string) || (req.query.orgId as string) || (req.body?.orgId as string);
  (req as any).user = {
    userId: req.platformUser?.id,
    orgId: orgId || null,
    role: req.platformUser?.role,
    email: req.platformUser?.email,
  };
  next();
});

// Mount all sub-routers
router.use(subscriptionRouter);
router.use(lifecycleRouter);
router.use(billingRouter);
router.use(billingEngineRouter);
router.use(portalRouter);
router.use(addonMarketplaceRouter);

export { subscriptionWebhookRouter, billingWebhookRouter };

export default router;
