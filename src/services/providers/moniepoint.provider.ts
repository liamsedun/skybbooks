import { PaymentGatewayTransaction, ProviderConfig } from './types';
import { AppError } from '../../lib/errors';

const MONIEPOINT_API_KEY = process.env.MONIEPOINT_API_KEY || '';
const MONIEPOINT_SECRET = process.env.MONIEPOINT_SECRET || '';
const MONIEPOINT_BASE = process.env.MONIEPOINT_BASE_URL || 'https://api.moniepoint.com/v1';

/**
 * Moniepoint provider — Nigerian business banking with
 * payment collections, transfers, and statement feeds.
 */
export class MoniepointProvider {
  private config: ProviderConfig;

  constructor() {
    this.config = {
      apiKey: MONIEPOINT_API_KEY,
      secretKey: MONIEPOINT_SECRET,
      baseUrl: MONIEPOINT_BASE,
      environment: process.env.NODE_ENV === 'production' ? 'live' : 'test',
    };
  }

  async getAccessToken(): Promise<string> {
    if (!this.config.secretKey) return '';
    const result = await this.apiPost('/auth/token', {
      apiKey: this.config.apiKey,
      secret: this.config.secretKey,
    });
    return result.accessToken || result.data?.accessToken || '';
  }

  async getBalance(): Promise<{ availableBalance: number; ledgerBalance: number; currency: string }> {
    const token = await this.getAccessToken();
    const result = await this.apiGet('/account/balance', token);
    const d = result.data || result;
    return {
      availableBalance: Math.round((d.availableBalance || d.available_balance || 0) * 100),
      ledgerBalance: Math.round((d.ledgerBalance || d.ledger_balance || 0) * 100),
      currency: d.currency || 'NGN',
    };
  }

  async getTransactions(params?: {
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<PaymentGatewayTransaction[]> {
    const token = await this.getAccessToken();
    const query = new URLSearchParams();
    if (params?.from) query.set('startDate', params.from);
    if (params?.to) query.set('endDate', params.to);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const result = await this.apiGet(`/transactions${query.toString() ? '?' + query.toString() : ''}`, token);
    return (result.data || result || []).map((d: any) => this.mapTransaction(d));
  }

  async initiateTransfer(data: {
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    narration?: string;
    reference?: string;
  }): Promise<{ reference: string; status: string; fee: number }> {
    const token = await this.getAccessToken();
    const payload: Record<string, any> = {
      amount: data.amount / 100,
      bankCode: data.bankCode,
      accountNumber: data.accountNumber,
      accountName: data.accountName,
      narration: data.narration || 'Transfer from SkyBooks',
      reference: data.reference || `SKY-MP-${Date.now()}`,
    };
    const result = await this.apiPost('/transfers/initiate', payload, token);
    const d = result.data || result;
    return {
      reference: payload.reference,
      status: d.status || 'pending',
      fee: Math.round((d.fee || 0) * 100),
    };
  }

  async verifyTransfer(reference: string): Promise<{ status: string; amount: number }> {
    const token = await this.getAccessToken();
    const result = await this.apiGet(`/transfers/${reference}/status`, token);
    const d = result.data || result;
    return {
      status: d.status,
      amount: Math.round((d.amount || 0) * 100),
    };
  }

  async getStatement(bankAccountNumber: string, fromDate: string, toDate: string): Promise<any[]> {
    const token = await this.getAccessToken();
    const result = await this.apiGet(
      `/account/statement?accountNumber=${bankAccountNumber}&startDate=${fromDate}&endDate=${toDate}`,
      token
    );
    return result.data || result || [];
  }

  async verifyWebhookSignature(signature: string, rawBody: string, webhookSecret: string): Promise<boolean> {
    const hash = require('crypto')
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    return hash === signature;
  }

  private mapTransaction(d: any): PaymentGatewayTransaction {
    return {
      gatewayTransactionId: String(d.id || d.transactionId || ''),
      reference: d.reference || d.txRef || '',
      amount: Math.round((d.amount || 0) * 100),
      fee: Math.round((d.fee || 0) * 100),
      currency: d.currency || 'NGN',
      status: this.mapStatus(d.status),
      customerEmail: d.customerEmail || d.email || '',
      customerName: d.customerName || d.senderName || d.beneficiaryName || '',
      customerPhone: d.customerPhone || d.phone || '',
      description: d.narration || d.description || '',
      paymentMethod: d.paymentMethod || d.channel || 'bank_transfer',
      channel: d.channel || 'bank_transfer',
      paidAt: d.transactionDate ? new Date(d.transactionDate) : undefined,
      settledAt: d.settlementDate ? new Date(d.settlementDate) : undefined,
      rawData: d,
    };
  }

  private mapStatus(status: string): PaymentGatewayTransaction['status'] {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'successful':
      case 'completed': return 'success';
      case 'failed': return 'failed';
      case 'refunded': return 'full_refund';
      case 'pending': return 'pending';
      default: return 'pending';
    }
  }

  private async apiGet(path: string, token?: string): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (this.config.apiKey) headers['x-api-key'] = this.config.apiKey;
    const res = await fetch(`${this.config.baseUrl}${path}`, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new AppError(`Moniepoint API error ${res.status}: ${body}`, 502);
    }
    return res.json();
  }

  private async apiPost(path: string, body: any, token?: string): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (this.config.apiKey) headers['x-api-key'] = this.config.apiKey;
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new AppError(`Moniepoint API error ${res.status}: ${text}`, 502);
    }
    return res.json();
  }
}

export const moniepointProvider = new MoniepointProvider();
