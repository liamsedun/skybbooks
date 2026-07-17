export type BankFeedProvider = 'mono' | 'paystack' | 'flutterwave' | 'moniepoint';
export type PaymentGateway = 'paystack' | 'flutterwave' | 'moniepoint';

export interface BankFeedTransaction {
  externalId: string;
  date: Date;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  balanceAfter?: number;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface BankConnectionStatus {
  connected: boolean;
  status: 'active' | 'reauth_required' | 'expired' | 'disconnected' | 'pending';
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  errorMessage?: string;
}

export interface PaymentGatewayTransaction {
  gatewayTransactionId: string;
  reference: string;
  amount: number;
  fee: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'settled' | 'partial_refund' | 'full_refund';
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  description?: string;
  paymentMethod?: string;
  channel?: string;
  paidAt?: Date;
  settledAt?: Date;
  rawData: Record<string, any>;
}

export interface ProviderConfig {
  apiKey?: string;
  secretKey?: string;
  publicKey?: string;
  webhookSecret?: string;
  baseUrl?: string;
  environment?: 'test' | 'live';
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  providerAccountId?: string;
  providerAccountName?: string;
  raw: Record<string, any>;
}

export interface AutoMatchResult {
  bankTransactionId: string;
  gatewayTransactionId: string;
  confidence: number;
  matchedBy: string;
}
