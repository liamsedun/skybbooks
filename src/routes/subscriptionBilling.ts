import { Router, Request, Response } from 'express';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import {
  initializePayment, verifyPayment, retryPayment,
  saveGatewayConfig, getOrgGatewayConfigs, getOrgDefaultGateway,
  getReceipt, getPaymentHistory, getPaymentStats,
  handlePaymentWebhook,
} from '../services/subscriptionBilling.service';
import { verifyPaystackWebhook, verifyFlutterwaveWebhook } from '../services/paymentGateway.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Gateway Configuration ──

router.get('/billing/gateway-config', async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const configs = await getOrgGatewayConfigs(req.user!.orgId!);
    res.json(configs);
  } catch (err) { next(err); }
});

router.put('/billing/gateway-config', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const config = await saveGatewayConfig(req.user!.orgId!, req.body, req.user!.userId!);
    res.json(config);
  } catch (err) { next(err); }
});

router.get('/billing/gateway-default', async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const defaultGw = await getOrgDefaultGateway(req.user!.orgId!);
    res.json(defaultGw);
  } catch (err) { next(err); }
});

// ── Payment Initialization & Verification ──

router.post('/billing/initialize', async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const { invoiceId, gateway, channels } = req.body;
    if (!invoiceId) throw new AppError('invoiceId is required.', 400);
    const result = await initializePayment(req.user!.orgId!, invoiceId, req.user!.userId!, { gateway, channels });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/billing/verify', async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const { reference, invoiceId } = req.body;
    if (!reference || !invoiceId) throw new AppError('reference and invoiceId are required.', 400);
    const result = await verifyPayment(req.user!.orgId!, reference, invoiceId);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/billing/retry', async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const { invoiceId, gateway, channels } = req.body;
    if (!invoiceId) throw new AppError('invoiceId is required.', 400);
    const result = await retryPayment(req.user!.orgId!, invoiceId, req.user!.userId!, { gateway, channels });
    res.json(result);
  } catch (err) { next(err); }
});

// ── Payment History ──

router.get('/billing/payments', async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const subscriptionId = req.query.subscriptionId as string | undefined;
    const history = await getPaymentHistory(req.user!.orgId!, subscriptionId);
    res.json(history);
  } catch (err) { next(err); }
});

router.get('/billing/payments/stats', async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const stats = await getPaymentStats(req.user!.orgId!);
    res.json(stats);
  } catch (err) { next(err); }
});

// ── Receipts ──

router.get('/billing/receipts/:paymentId', async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const receipt = await getReceipt(req.user!.orgId!, req.params.paymentId);
    if (req.query.format === 'html' || !req.query.format) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(receipt.htmlContent);
    }
    res.json(receipt);
  } catch (err) { next(err); }
});

// ── Webhook Routes (exported separately for raw body) ──

export const billingWebhookRouter = Router();

billingWebhookRouter.post('/webhooks/paystack', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    const secret = process.env.PAYSTACK_SECRET_KEY || '';
    if (secret && !verifyPaystackWebhook(signature, secret, JSON.stringify(req.body))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const result = await handlePaymentWebhook('paystack', req.headers, req.body);
    res.json(result);
  } catch (err: any) {
    console.error('[Billing Webhook] Paystack error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

billingWebhookRouter.post('/webhooks/flutterwave', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['verif-hash'] as string;
    const secret = process.env.FLW_SECRET_KEY || '';
    if (secret && !verifyFlutterwaveWebhook(signature, secret, JSON.stringify(req.body))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const result = await handlePaymentWebhook('flutterwave', req.headers, req.body);
    res.json(result);
  } catch (err: any) {
    console.error('[Billing Webhook] Flutterwave error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

billingWebhookRouter.post('/webhooks/stripe', async (req: Request, res: Response) => {
  try {
    const result = await handlePaymentWebhook('stripe', req.headers, req.body);
    res.json(result);
  } catch (err: any) {
    console.error('[Billing Webhook] Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
