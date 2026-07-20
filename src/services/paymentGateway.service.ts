import axios from 'axios';
import crypto from 'crypto';

export interface PaymentInitializeParams {
  email: string;
  amountKobo: number;
  reference: string;
  currency?: string;
  channels?: string[];
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaymentVerifyResult {
  success: boolean;
  gatewayReference: string;
  gatewayTransactionId: string;
  amountKobo: number;
  feeKobo: number;
  currency: string;
  status: string;
  paymentMethod: string;
  channel: string;
  payerEmail: string;
  payerName: string;
  paidAt: string;
  rawResponse: any;
}

export interface PaymentGatewayAdapter {
  initialize(params: PaymentInitializeParams, config: GatewayConfig): Promise<{ authorizationUrl: string; reference: string; gatewayTransactionId?: string }>;
  verify(reference: string, config: GatewayConfig): Promise<PaymentVerifyResult>;
  charge?(params: PaymentInitializeParams & { authorizationCode: string }, config: GatewayConfig): Promise<PaymentVerifyResult>;
}

export interface GatewayConfig {
  publicKey?: string;
  secretKey: string;
  webhookSecret?: string;
  environment: string;
}

type GatewayType = 'paystack' | 'flutterwave' | 'stripe';

class PaystackAdapter implements PaymentGatewayAdapter {
  private baseUrl = 'https://api.paystack.co';

  async initialize(params: PaymentInitializeParams, config: GatewayConfig): Promise<{ authorizationUrl: string; reference: string; gatewayTransactionId?: string }> {
    const res = await axios.post(`${this.baseUrl}/transaction/initialize`, {
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      currency: params.currency || 'NGN',
      channels: params.channels || ['card', 'bank_transfer', 'ussd'],
      callback_url: params.callbackUrl,
      metadata: params.metadata || {},
    }, {
      headers: { Authorization: `Bearer ${config.secretKey}` },
    });
    const d = res.data;
    if (!d.status) throw new Error(`Paystack init failed: ${d.message}`);
    return { authorizationUrl: d.data.authorization_url, reference: d.data.reference, gatewayTransactionId: String(d.data.id) };
  }

  async verify(reference: string, config: GatewayConfig): Promise<PaymentVerifyResult> {
    const res = await axios.get(`${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${config.secretKey}` },
    });
    const d = res.data;
    if (!d.status) throw new Error(`Paystack verify failed: ${d.message}`);
    return {
      success: d.data.status === 'success',
      gatewayReference: d.data.reference,
      gatewayTransactionId: String(d.data.id),
      amountKobo: Math.round(d.data.amount),
      feeKobo: Math.round(d.data.fees || 0),
      currency: d.data.currency || 'NGN',
      status: d.data.status,
      paymentMethod: d.data.channel || 'unknown',
      channel: d.data.channel || '',
      payerEmail: d.data.customer?.email || '',
      payerName: [d.data.customer?.first_name, d.data.customer?.last_name].filter(Boolean).join(' '),
      paidAt: d.data.paidAt || d.data.transaction_date || '',
      rawResponse: d.data,
    };
  }

  async charge(params: PaymentInitializeParams & { authorizationCode: string }, config: GatewayConfig): Promise<PaymentVerifyResult> {
    const res = await axios.post(`${this.baseUrl}/transaction/charge_authorization`, {
      email: params.email,
      amount: params.amountKobo,
      authorization_code: params.authorizationCode,
      reference: params.reference,
      currency: params.currency || 'NGN',
      metadata: params.metadata || {},
    }, {
      headers: { Authorization: `Bearer ${config.secretKey}` },
    });
    const d = res.data;
    if (!d.status) throw new Error(`Paystack charge failed: ${d.message}`);
    return {
      success: d.data.status === 'success',
      gatewayReference: d.data.reference,
      gatewayTransactionId: String(d.data.id),
      amountKobo: Math.round(d.data.amount),
      feeKobo: Math.round(d.data.fees || 0),
      currency: d.data.currency || 'NGN',
      status: d.data.status,
      paymentMethod: d.data.channel || 'unknown',
      channel: d.data.channel || '',
      payerEmail: d.data.customer?.email || '',
      payerName: [d.data.customer?.first_name, d.data.customer?.last_name].filter(Boolean).join(' '),
      paidAt: d.data.paidAt || d.data.transaction_date || '',
      rawResponse: d.data,
    };
  }
}

class FlutterwaveAdapter implements PaymentGatewayAdapter {
  private baseUrl = 'https://api.flutterwave.com/v3';

  async initialize(params: PaymentInitializeParams, config: GatewayConfig): Promise<{ authorizationUrl: string; reference: string; gatewayTransactionId?: string }> {
    const payload: any = {
      tx_ref: params.reference,
      amount: (params.amountKobo / 100).toFixed(2),
      currency: params.currency || 'NGN',
      redirect_url: params.callbackUrl,
      customer: { email: params.email },
      meta: params.metadata || {},
      payment_options: (params.channels || ['card', 'banktransfer', 'ussd']).join(',')
        .replace(/_/g, ''),
    };
    if (params.channels?.length === 1) {
      payload.payment_options = params.channels[0].replace(/_/g, '');
    }
    const res = await axios.post(`${this.baseUrl}/payments`, payload, {
      headers: { Authorization: `Bearer ${config.secretKey}` },
    });
    const d = res.data;
    if (d.status !== 'success') throw new Error(`Flutterwave init failed: ${d.message}`);
    return { authorizationUrl: d.data.link, reference: params.reference, gatewayTransactionId: String(d.data.id) };
  }

  async verify(reference: string, config: GatewayConfig): Promise<PaymentVerifyResult> {
    const res = await axios.get(`${this.baseUrl}/transactions/by_reference/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${config.secretKey}` },
    });
    const d = res.data;
    if (d.status !== 'success') throw new Error(`Flutterwave verify failed: ${d.message}`);
    const txn = d.data;
    const success = txn.status === 'successful';
    return {
      success,
      gatewayReference: txn.tx_ref || reference,
      gatewayTransactionId: String(txn.id),
      amountKobo: Math.round(parseFloat(txn.amount || '0') * 100),
      feeKobo: Math.round(parseFloat(txn.fees || '0') * 100),
      currency: txn.currency || 'NGN',
      status: txn.status,
      paymentMethod: txn.payment_type || 'unknown',
      channel: txn.channel || '',
      payerEmail: txn.customer?.email || '',
      payerName: txn.customer?.name || '',
      paidAt: txn.created_at || '',
      rawResponse: txn,
    };
  }
}

class StripeAdapter implements PaymentGatewayAdapter {
  private baseUrl = 'https://api.stripe.com/v1';

  async initialize(params: PaymentInitializeParams, config: GatewayConfig): Promise<{ authorizationUrl: string; reference: string; gatewayTransactionId?: string }> {
    const res = await axios.post(`${this.baseUrl}/checkout/sessions`, new URLSearchParams({
      mode: 'payment',
      success_url: params.callbackUrl || `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: params.callbackUrl ? params.callbackUrl.replace('/success', '/cancel') : `${process.env.FRONTEND_URL}/subscription/cancel`,
      client_reference_id: params.reference,
      currency: (params.currency || 'NGN').toLowerCase(),
      amount: String(params.amountKobo),
      customer_email: params.email,
      metadata: JSON.stringify(params.metadata || {}),
    } as any), {
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const d = res.data;
    return { authorizationUrl: d.url, reference: params.reference, gatewayTransactionId: d.id };
  }

  async verify(reference: string, config: GatewayConfig): Promise<PaymentVerifyResult> {
    let sessionId = reference;
    if (reference.startsWith('sub_pay_')) {
      sessionId = reference;
    }
    const res = await axios.get(`${this.baseUrl}/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${config.secretKey}` },
    });
    const d = res.data;
    const success = d.payment_status === 'paid';
    let amountKobo = Math.round((d.amount_total || d.amount_subtotal || 0));
    return {
      success,
      gatewayReference: d.client_reference_id || sessionId,
      gatewayTransactionId: d.id,
      amountKobo,
      feeKobo: 0,
      currency: (d.currency || 'NGN').toUpperCase(),
      status: d.payment_status,
      paymentMethod: d.mode || 'unknown',
      channel: d.mode || '',
      payerEmail: d.customer_details?.email || d.customer_email || '',
      payerName: d.customer_details?.name || '',
      paidAt: d.created ? new Date(d.created * 1000).toISOString() : '',
      rawResponse: d,
    };
  }
}

function createAdapter(gateway: GatewayType): PaymentGatewayAdapter {
  switch (gateway) {
    case 'paystack': return new PaystackAdapter();
    case 'flutterwave': return new FlutterwaveAdapter();
    case 'stripe': return new StripeAdapter();
    default: throw new Error(`Unsupported gateway: ${gateway}`);
  }
}

function generateReference(prefix?: string): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix || 'sub_pay'}_${ts}_${rand}`;
}

function verifyPaystackWebhook(signature: string, secret: string, body: string): boolean {
  const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
  return hash === signature;
}

function verifyFlutterwaveWebhook(signature: string, secret: string, body: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const expected = crypto.createHash('sha256').update(secret).digest('hex');
  return hash === signature;
}

function verifyStripeWebhook(signature: string, secret: string, body: string): boolean {
  try {
    const payload = body;
    const sigHeader = signature;
    const parts = sigHeader.split(',');
    let sigTime = 0;
    let sigHash = '';
    for (const p of parts) {
      const [k, v] = p.split('=');
      if (k === 't') sigTime = parseInt(v, 10);
      if (k === 'v1') sigHash = v;
    }
    const signedPayload = `${sigTime}.${payload}`;
    const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    return expected === sigHash;
  } catch {
    return false;
  }
}

export function createPaymentGateway(gateway: string): PaymentGatewayAdapter {
  return createAdapter(gateway as GatewayType);
}

export { generateReference, verifyPaystackWebhook, verifyFlutterwaveWebhook, verifyStripeWebhook };
