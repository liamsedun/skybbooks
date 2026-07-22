import { Router, Request, Response } from 'express';
import { requirePlatformPermission } from '../middleware/platformAuth';
import { AppError } from '../lib/errors';
import {
  initializePayment, verifyPayment, retryPayment,
  saveGatewayConfig, getOrgGatewayConfigs, getOrgDefaultGateway,
  getReceipt, getPaymentHistory, getPaymentStats,
  handlePaymentWebhook,
} from '../services/subscriptionBilling.service';
import { verifyPaystackWebhook, verifyFlutterwaveWebhook } from '../services/paymentGateway.service';

const router = Router();

// ── Gateway Configuration ──

router.get('/billing/gateway-config', async (req: Request, res: Response, next: any) => {
  try {
    const configs = await getOrgGatewayConfigs((req as any).user!.orgId!);
    res.json(configs);
  } catch (err) { next(err); }
});

router.put('/billing/gateway-config', requirePlatformPermission('billing:manage'), async (req: Request, res: Response, next: any) => {
  try {
    const config = await saveGatewayConfig((req as any).user!.orgId!, req.body, (req as any).user!.userId!);
    res.json(config);
  } catch (err) { next(err); }
});

router.get('/billing/gateway-default', async (req: Request, res: Response, next: any) => {
  try {
    const defaultGw = await getOrgDefaultGateway((req as any).user!.orgId!);
    res.json(defaultGw);
  } catch (err) { next(err); }
});

// ── Payment Initialization & Verification ──

router.post('/billing/initialize', async (req: Request, res: Response, next: any) => {
  try {
    const { invoiceId, gateway, channels } = req.body;
    if (!invoiceId) throw new AppError('invoiceId is required.', 400);
    const result = await initializePayment((req as any).user!.orgId!, invoiceId, (req as any).user!.userId!, { gateway, channels });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/billing/verify', async (req: Request, res: Response, next: any) => {
  try {
    const { reference, invoiceId } = req.body;
    if (!reference || !invoiceId) throw new AppError('reference and invoiceId are required.', 400);
    const result = await verifyPayment((req as any).user!.orgId!, reference, invoiceId);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/billing/retry', async (req: Request, res: Response, next: any) => {
  try {
    const { invoiceId, gateway, channels } = req.body;
    if (!invoiceId) throw new AppError('invoiceId is required.', 400);
    const result = await retryPayment((req as any).user!.orgId!, invoiceId, (req as any).user!.userId!, { gateway, channels });
    res.json(result);
  } catch (err) { next(err); }
});

// ── Payment History ──

router.get('/billing/payments', async (req: Request, res: Response, next: any) => {
  try {
    const subscriptionId = req.query.subscriptionId as string | undefined;
    const history = await getPaymentHistory((req as any).user!.orgId!, subscriptionId);
    res.json(history);
  } catch (err) { next(err); }
});

router.get('/billing/payments/stats', async (req: Request, res: Response, next: any) => {
  try {
    const stats = await getPaymentStats((req as any).user!.orgId!);
    res.json(stats);
  } catch (err) { next(err); }
});

// ── Receipts ──

router.get('/billing/receipts/:paymentId', async (req: Request, res: Response, next: any) => {
  try {
    const receipt = await getReceipt((req as any).user!.orgId!, req.params.paymentId);
    if (req.query.format === 'html' || !req.query.format) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(receipt.htmlContent);
    }
    res.json(receipt);
  } catch (err) { next(err); }
});

// ── Webhook Routes (exported separately for raw body) ──

import express from 'express';

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

// Stripe webhook needs raw body for signature verification
billingWebhookRouter.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'] as string;
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
    let event: any;
    if (secret) {
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, secret);
      } catch (err: any) {
        console.error('[Billing Webhook] Stripe signature verification failed:', err.message);
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    const payload = event || JSON.parse(req.body.toString());
    const result = await handlePaymentWebhook('stripe', req.headers, payload);
    res.json(result);
  } catch (err: any) {
    console.error('[Billing Webhook] Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
