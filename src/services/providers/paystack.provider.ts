import { PaymentGateway, PaymentGatewayTransaction, ProviderConfig } from './types';
import { AppError } from '../../lib/errors';

const PAYSTACK_BASE = 'https://api.paystack.co';

export class PaystackProvider {
  private config: ProviderConfig;

  constructor(overrideConfig?: Partial<ProviderConfig>) {
    this.config = {
      secretKey: process.env.PAYSTACK_SECRET_KEY || '',
      publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
      baseUrl: PAYSTACK_BASE,
      environment: process.env.NODE_ENV === 'production' ? 'live' : 'test',
      ...overrideConfig,
    };
  }

  getPublicKey(): string {
    return this.config.publicKey || '';
  }

  async initializeTransaction(data: {
    email: string;
    amount: number;
    reference?: string;
    currency?: string;
    callbackUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
    const payload: Record<string, any> = {
      email: data.email,
      amount: data.amount,
      currency: data.currency || 'NGN',
      reference: data.reference || `SKY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    if (data.callbackUrl) payload.callback_url = data.callbackUrl;
    if (data.metadata) payload.metadata = data.metadata;

    const result = await this.apiPost('/transaction/initialize', payload);
    return {
      authorizationUrl: result.data.authorization_url,
      accessCode: result.data.access_code,
      reference: result.data.reference,
    };
  }

  async verifyTransaction(reference: string): Promise<PaymentGatewayTransaction> {
    const result = await this.apiGet(`/transaction/verify/${reference}`);
    const d = result.data;
    return this.mapTransaction(d);
  }

  async listTransactions(params?: {
    perPage?: number;
    page?: number;
    from?: string;
    to?: string;
  }): Promise<PaymentGatewayTransaction[]> {
    const query = new URLSearchParams();
    if (params?.perPage) query.set('perPage', String(params.perPage));
    if (params?.page) query.set('page', String(params.page));
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const result = await this.apiGet(`/transaction${query.toString() ? '?' + query.toString() : ''}`);
    return (result.data || []).map((d: any) => this.mapTransaction(d));
  }

  async verifyWebhookSignature(signature: string, rawBody: string): Promise<boolean> {
    const hash = require('crypto')
      .createHmac('sha512', this.config.secretKey || '')
      .update(rawBody)
      .digest('hex');
    return hash === signature;
  }

  async refundTransaction(reference: string, amount?: number): Promise<any> {
    const payload: Record<string, any> = { transaction: reference };
    if (amount) payload.amount = amount;
    return this.apiPost('/refund', payload);
  }

  async getBalance(): Promise<{ currency: string; balance: number }[]> {
    const result = await this.apiGet('/balance');
    return (result.data || []).map((b: any) => ({
      currency: b.currency,
      balance: b.balance / 100,
    }));
  }

  async getBanks(): Promise<{ name: string; code: string; slug: string; longcode: string }[]> {
    const result = await this.apiGet('/bank?country=nigeria');
    return (result.data || []).map((b: any) => ({
      name: b.name,
      code: b.code,
      slug: b.slug,
      longcode: b.longcode,
    }));
  }

  async resolveAccountNumber(accountNumber: string, bankCode: string): Promise<{ accountName: string }> {
    const result = await this.apiGet(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
    return { accountName: result.data.account_name };
  }

  private mapTransaction(d: any): PaymentGatewayTransaction {
    return {
      gatewayTransactionId: String(d.id || ''),
      reference: d.reference || '',
      amount: Math.round((d.amount || 0) / 100),
      fee: Math.round((d.fees || d.fee || 0) / 100),
      currency: d.currency || 'NGN',
      status: this.mapStatus(d.status),
      customerEmail: d.customer?.email || d.email || '',
      customerName: d.customer?.first_name ? `${d.customer.first_name} ${d.customer.last_name || ''}`.trim() : '',
      customerPhone: d.customer?.phone || '',
      description: d.metadata?.description || d.metadata?.custom_fields?.[0]?.value || '',
      paymentMethod: d.channel || d.authorization?.card_type || '',
      channel: d.channel || '',
      paidAt: d.paid_at ? new Date(d.paid_at) : undefined,
      settledAt: (d as any).settled_at ? new Date((d as any).settled_at) : undefined,
      rawData: d,
    };
  }

  private mapStatus(status: string): PaymentGatewayTransaction['status'] {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'failed';
      case 'reversed': return 'full_refund';
      case 'partial_refund': return 'partial_refund';
      case 'pending': return 'pending';
      default: return 'pending';
    }
  }

  private async apiGet(path: string): Promise<any> {
    const res = await fetch(`${PAYSTACK_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
    const json = await res.json();
    if (!res.ok || !json.status) {
      throw new AppError(`Paystack API error: ${json.message || 'Unknown error'}`, 502);
    }
    return json;
  }

  private async apiPost(path: string, body: any): Promise<any> {
    const res = await fetch(`${PAYSTACK_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.status) {
      throw new AppError(`Paystack API error: ${json.message || 'Unknown error'}`, 502);
    }
    return json;
  }
}

export const paystackProvider = new PaystackProvider();
