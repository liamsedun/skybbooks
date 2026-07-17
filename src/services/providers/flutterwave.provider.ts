import { PaymentGateway, PaymentGatewayTransaction, BankFeedTransaction, ProviderConfig } from './types';
import { BaseBankFeedProvider } from './base.provider';
import { AppError } from '../../lib/errors';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || '';
const FLW_PUBLIC_KEY = process.env.FLW_PUBLIC_KEY || '';
const FLW_BASE = 'https://api.flutterwave.com/v3';

/**
 * Flutterwave provider — Nigerian payment gateway + virtual account feeds.
 * Supports collections via card, bank transfer, USSD, and mobile money.
 */
export class FlutterwavePaymentProvider {
  private config: ProviderConfig;

  constructor() {
    this.config = {
      secretKey: FLW_SECRET_KEY,
      publicKey: FLW_PUBLIC_KEY,
      baseUrl: FLW_BASE,
      environment: process.env.NODE_ENV === 'production' ? 'live' : 'test',
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
    meta?: Record<string, any>;
    customerName?: string;
    phone?: string;
    paymentOptions?: string[];
  }): Promise<{ authorizationUrl: string; reference: string }> {
    const payload: Record<string, any> = {
      tx_ref: data.reference || `SKY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      amount: data.amount / 100,
      currency: data.currency || 'NGN',
      redirect_url: data.callbackUrl,
      customer: {
        email: data.email,
        name: data.customerName || '',
        phonenumber: data.phone || '',
      },
      meta: data.meta || {},
      payment_options: data.paymentOptions?.join(',') || 'card,banktransfer,ussd',
    };

    const result = await this.apiPost('/payments', payload);
    return {
      authorizationUrl: result.data.link,
      reference: payload.tx_ref,
    };
  }

  async createVirtualAccount(data: {
    email: string;
    fullName?: string;
    phone?: string;
    amount?: number;
    txRef?: string;
    isPermanent?: boolean;
    bankWalletOnly?: boolean;
  }): Promise<{
    accountNumber: string;
    bankName: string;
    bankCode?: string;
    reference: string;
  }> {
    const payload: Record<string, any> = {
      email: data.email,
      is_permanent: data.isPermanent !== false,
      tx_ref: data.txRef || `SKY-VA-${Date.now()}`,
    };
    if (data.fullName) payload.fullname = data.fullName;
    if (data.phone) payload.phonenumber = data.phone;
    if (data.amount) payload.amount = data.amount / 100;

    const result = await this.apiPost('/virtual-account-numbers', payload);
    const d = result.data;
    return {
      accountNumber: d.account_number || '',
      bankName: d.bank_name || d.bank?.name || '',
      bankCode: d.bank_code || '',
      reference: payload.tx_ref,
    };
  }

  async verifyTransaction(reference: string): Promise<PaymentGatewayTransaction> {
    const result = await this.apiGet(`/transactions/${reference}/verify`);
    return this.mapTransaction(result.data);
  }

  async listTransactions(params?: {
    from?: string;
    to?: string;
    page?: number;
    status?: string;
  }): Promise<PaymentGatewayTransaction[]> {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.page) query.set('page', String(params.page));
    if (params?.status) query.set('status', params.status);
    const result = await this.apiGet(`/transactions${query.toString() ? '?' + query.toString() : ''}`);
    return (result.data || []).map((d: any) => this.mapTransaction(d));
  }

  async verifyWebhookSignature(signature: string, rawBody: string): Promise<boolean> {
    const hash = require('crypto')
      .createHmac('sha256', this.config.secretKey || '')
      .update(rawBody)
      .digest('hex');
    return hash === signature;
  }

  async initiateRefund(transactionId: string, amount?: number): Promise<any> {
    const payload: Record<string, any> = {};
    if (amount) payload.amount = amount / 100;
    return this.apiPost(`/transactions/${transactionId}/refund`, payload);
  }

  async getBanks(country: string = 'NG'): Promise<{ name: string; code: string; }[]> {
    const result = await this.apiGet(`/banks/${country}`);
    return (result.data || []).map((b: any) => ({
      name: b.name,
      code: b.code,
    }));
  }

  async resolveAccountNumber(accountNumber: string, bankCode: string): Promise<{ accountName: string }> {
    const result = await this.apiPost('/accounts/resolve', {
      account_number: accountNumber,
      account_bank: bankCode,
    });
    return { accountName: result.data.account_name };
  }

  async initiateTransfer(data: {
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    narration?: string;
    reference?: string;
  }): Promise<{ id: number; reference: string; status: string }> {
    const payload: Record<string, any> = {
      amount: data.amount / 100,
      bank_code: data.bankCode,
      account_bank: data.bankCode,
      account_number: data.accountNumber,
      beneficiary_name: data.accountName,
      narration: data.narration || 'Transfer from SkyBooks',
      reference: data.reference || `SKY-TRF-${Date.now()}`,
      currency: 'NGN',
    };
    const result = await this.apiPost('/transfers', payload);
    return {
      id: result.data.id,
      reference: payload.reference,
      status: result.data.status,
    };
  }

  async verifyTransfer(reference: string): Promise<{ status: string; amount: number; message: string }> {
    const result = await this.apiGet(`/transfers/${reference}`);
    const d = result.data;
    return {
      status: d.status,
      amount: (d.amount || 0) * 100,
      message: d.complete_message || '',
    };
  }

  private mapTransaction(d: any): PaymentGatewayTransaction {
    return {
      gatewayTransactionId: String(d.id || ''),
      reference: d.tx_ref || d.flw_ref || '',
      amount: Math.round((d.amount || d.charged_amount || 0) * 100),
      fee: Math.round((d.fee || d.app_fee || 0) * 100),
      currency: d.currency || 'NGN',
      status: this.mapStatus(d.status),
      customerEmail: d.customer?.email || d.email || '',
      customerName: d.customer?.name || d.fullName || '',
      customerPhone: d.customer?.phone_number || '',
      description: d.narration || d.description || '',
      paymentMethod: d.payment_type || d.channel || '',
      channel: d.channel || '',
      paidAt: d.created_at ? new Date(d.created_at) : undefined,
      settledAt: (d as any).settled_at ? new Date((d as any).settled_at) : undefined,
      rawData: d,
    };
  }

  private mapStatus(status: string): PaymentGatewayTransaction['status'] {
    switch (status) {
      case 'successful':
      case 'completed': return 'success';
      case 'failed': return 'failed';
      case 'refunded': return 'full_refund';
      case 'pending':
      case 'pending-approval': return 'pending';
      default: return 'pending';
    }
  }

  private async apiGet(path: string): Promise<any> {
    const res = await fetch(`${FLW_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
    const json = await res.json();
    if (!res.ok || json.status === 'error') {
      throw new AppError(`Flutterwave API error: ${json.message || 'Unknown error'}`, 502);
    }
    return json;
  }

  private async apiPost(path: string, body: any): Promise<any> {
    const res = await fetch(`${FLW_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || json.status === 'error') {
      throw new AppError(`Flutterwave API error: ${json.message || 'Unknown error'}`, 502);
    }
    return json;
  }
}

export const flutterwavePaymentProvider = new FlutterwavePaymentProvider();
