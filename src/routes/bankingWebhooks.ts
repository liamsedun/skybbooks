import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db, paymentGatewayTransactions, bankAccounts, organisations } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { paystackProvider } from '../services/providers/paystack.provider';
import { flutterwavePaymentProvider } from '../services/providers/flutterwave.provider';
import { createAuditLog } from '../services/audit.service';

const router = Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || '';
const MONIEPOINT_WEBHOOK_SECRET = process.env.MONIEPOINT_WEBHOOK_SECRET || '';

async function recordGatewayTransaction(orgId: string, provider: string, data: any): Promise<void> {
  const [existing] = await db
    .select({ id: paymentGatewayTransactions.id })
    .from(paymentGatewayTransactions)
    .where(and(
      eq(paymentGatewayTransactions.orgId, orgId),
      eq(paymentGatewayTransactions.gatewayTransactionId, String(data.id || data.transactionId || ''))
    ))
    .limit(1);
  if (existing) return;

  const amountKobo = Math.round((data.amount || data.charged_amount || 0) * 100);
  const feeKobo = Math.round((data.fee || data.app_fee || data.fees || 0) * 100);

  let customerEmail = '';
  let customerName = '';
  let customerPhone = '';
  let reference = '';

  if (provider === 'paystack') {
    customerEmail = data.customer?.email || data.email || '';
    customerName = data.customer?.first_name ? `${data.customer.first_name} ${data.customer.last_name || ''}`.trim() : '';
    customerPhone = data.customer?.phone || '';
    reference = data.reference || '';
  } else if (provider === 'flutterwave') {
    customerEmail = data.customer?.email || data.email || '';
    customerName = data.customer?.name || data.fullName || '';
    customerPhone = data.customer?.phone_number || '';
    reference = data.tx_ref || data.flw_ref || '';
  }

  await db.insert(paymentGatewayTransactions).values({
    orgId,
    provider: provider as any,
    gatewayTransactionId: String(data.id || data.transactionId || ''),
    reference,
    amount: amountKobo,
    fee: feeKobo,
    currency: data.currency || 'NGN',
    status: mapGatewayStatus(data.status, provider),
    customerEmail,
    customerName,
    customerPhone,
    description: data.narration || data.description || data.metadata?.description || '',
    paymentMethod: data.channel || data.payment_type || data.paymentMethod || '',
    channel: data.channel || data.payment_type || '',
    settledAt: data.settled_at || data.settlementDate ? new Date(data.settled_at || data.settlementDate) : null,
    rawData: data,
  });
}

function mapGatewayStatus(status: string, provider: string): 'pending' | 'success' | 'failed' | 'settled' | 'partial_refund' | 'full_refund' {
  if (provider === 'paystack') {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'failed';
      case 'reversed': return 'full_refund';
      default: return 'pending';
    }
  }
  if (provider === 'flutterwave') {
    switch (status) {
      case 'successful':
      case 'completed': return 'success';
      case 'failed': return 'failed';
      case 'refunded': return 'full_refund';
      default: return 'pending';
    }
  }
  switch (status?.toLowerCase()) {
    case 'success':
    case 'successful':
    case 'completed': return 'success';
    case 'failed': return 'failed';
    default: return 'pending';
  }
}

// ── Paystack Webhook ──

router.post('/paystack', (req: Request, res: Response) => {
  let rawBody = '';
  req.on('data', (chunk: Buffer) => { rawBody += chunk.toString('utf-8'); });
  req.on('end', async () => {
    try {
      const signature = req.headers['x-paystack-signature'] as string;
      if (!signature) return res.status(401).json({ error: 'Missing signature' });

      const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
      if (hash !== signature) return res.status(401).json({ error: 'Invalid signature' });

      const event = JSON.parse(rawBody);

      if (event.event === 'charge.success' && event.data) {
        const ref = event.data.reference || '';
        const [org] = await db
          .select({ id: organisations.id })
          .from(organisations)
          .limit(1);

        if (org) {
          await recordGatewayTransaction(org.id, 'paystack', event.data);
          res.status(200).json({ received: true });
        } else {
          res.status(404).json({ error: 'Organisation not found' });
        }
      } else {
        res.status(200).json({ received: true });
      }
    } catch (err: any) {
      console.error('[Paystack Webhook] Error:', err.message);
      res.status(400).json({ error: 'Invalid payload' });
    }
  });
});

// ── Flutterwave Webhook ──

router.post('/flutterwave', (req: Request, res: Response) => {
  let rawBody = '';
  req.on('data', (chunk: Buffer) => { rawBody += chunk.toString('utf-8'); });
  req.on('end', async () => {
    try {
      const signature = req.headers['verif-hash'] as string;
      if (!signature) return res.status(401).json({ error: 'Missing signature' });

      const hash = crypto.createHmac('sha256', FLW_SECRET_KEY).update(rawBody).digest('hex');
      if (hash !== signature) return res.status(401).json({ error: 'Invalid signature' });

      const event = JSON.parse(rawBody);

      if (event.event === 'charge.completed' && event.data?.status === 'successful') {
        const [org] = await db
          .select({ id: organisations.id })
          .from(organisations)
          .limit(1);

        if (org) {
          await recordGatewayTransaction(org.id, 'flutterwave', event.data);
          res.status(200).json({ received: true });
        } else {
          res.status(404).json({ error: 'Organisation not found' });
        }
      } else if (event.event === 'transfer.completed') {
        res.status(200).json({ received: true });
      } else {
        res.status(200).json({ received: true });
      }
    } catch (err: any) {
      console.error('[Flutterwave Webhook] Error:', err.message);
      res.status(400).json({ error: 'Invalid payload' });
    }
  });
});

// ── Moniepoint Webhook ──

router.post('/moniepoint', (req: Request, res: Response) => {
  let rawBody = '';
  req.on('data', (chunk: Buffer) => { rawBody += chunk.toString('utf-8'); });
  req.on('end', async () => {
    try {
      const signature = req.headers['x-moniepoint-signature'] as string;
      if (!signature) return res.status(401).json({ error: 'Missing signature' });

      const hash = crypto.createHmac('sha256', MONIEPOINT_WEBHOOK_SECRET).update(rawBody).digest('hex');
      if (hash !== signature) return res.status(401).json({ error: 'Invalid signature' });

      const event = JSON.parse(rawBody);

      if (event.event === 'transaction.successful' && event.data) {
        const [org] = await db
          .select({ id: organisations.id })
          .from(organisations)
          .limit(1);

        if (org) {
          await recordGatewayTransaction(org.id, 'moniepoint', event.data);
          res.status(200).json({ received: true });
        } else {
          res.status(404).json({ error: 'Organisation not found' });
        }
      } else {
        res.status(200).json({ received: true });
      }
    } catch (err: any) {
      console.error('[Moniepoint Webhook] Error:', err.message);
      res.status(400).json({ error: 'Invalid payload' });
    }
  });
});

export default router;
