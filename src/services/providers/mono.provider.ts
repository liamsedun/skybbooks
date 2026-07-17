import { BaseBankFeedProvider } from './base.provider';
import { BankFeedTransaction } from './types';
import { AppError } from '../../lib/errors';

const MONO_SECRET_KEY = process.env.MONO_SECRET_KEY || '';
const MONO_BASE = 'https://api.withmono.com/v2';

/**
 * Mono Connect provider — Nigerian open banking aggregator.
 * Supports: GTBank, Access Bank, Zenith Bank, UBA, First Bank,
 * Providus, Sterling, and 30+ other Nigerian banks.
 */
export class MonoProvider extends BaseBankFeedProvider {
  protected providerType = 'mono';

  protected loadConfig(): void {
    this.config = {
      secretKey: MONO_SECRET_KEY,
      baseUrl: MONO_BASE,
    };
  }

  async exchangeCode(code: string): Promise<{ accountId: string }> {
    const data = await this.apiFetch(`${MONO_BASE}/accounts/auth`, {
      method: 'POST',
      body: JSON.stringify({ code }),
      headers: { 'mono-sec-key': MONO_SECRET_KEY },
    });
    const monoAccountId = data._id;
    if (!monoAccountId) throw new AppError('No account ID in Mono response', 502);
    return { accountId: monoAccountId };
  }

  async getAccountInfo(monoAccountId: string): Promise<{ accountName: string; bankName: string; accountNumber: string }> {
    const data = await this.apiFetch(`${MONO_BASE}/accounts/${monoAccountId}`, {
      headers: { 'mono-sec-key': MONO_SECRET_KEY },
    });
    const account = data.account || data || {};
    return {
      accountName: account.name || account.account_name || '',
      bankName: account.bank || account.institution?.name || '',
      accountNumber: account.accountNumber || account.account_number || '',
    };
  }

  async checkDataStatus(monoAccountId: string): Promise<{ dataStatus: string; syncStatus: string }> {
    const data = await this.apiFetch(`${MONO_BASE}/accounts/${monoAccountId}`, {
      headers: { 'mono-sec-key': MONO_SECRET_KEY },
    });
    const meta = data?.meta || {};
    return {
      dataStatus: (meta.data_status || 'UNAVAILABLE') as string,
      syncStatus: (meta.sync_status || '') as string,
    };
  }

  async fetchTransactions(connectionId: string, fromDate: Date): Promise<{ transactions: BankFeedTransaction[]; accountName?: string; balance?: number }> {
    const conn = await this.getConnection(connectionId);
    const monoAccountId = conn.providerAccountId;
    if (!monoAccountId) throw new AppError('No Mono account ID linked', 400);

    const { dataStatus, syncStatus } = await this.checkDataStatus(monoAccountId);

    if (syncStatus === 'REAUTHORISATION_REQUIRED') {
      await this.updateConnectionStatus(connectionId, 'reauth_required', 'Bank account reauthorisation required');
      throw new AppError('Bank account reauthorisation is required. Please reconnect.', 400);
    }

    if (dataStatus !== 'AVAILABLE' && dataStatus !== 'PARTIAL') {
      await this.updateConnectionStatus(connectionId, 'pending');
      return { transactions: [] };
    }

    let rawTxns: any[] = [];
    try {
      const startDate = fromDate.toISOString().split('T')[0];
      const data = await this.apiFetch(
        `${MONO_BASE}/accounts/${monoAccountId}/transactions?paginate=false&start=${startDate}`,
        { headers: { 'mono-sec-key': MONO_SECRET_KEY } }
      );
      rawTxns = data?.data || data?.results || data || [];
      if (!Array.isArray(rawTxns)) rawTxns = [];
    } catch (err: any) {
      throw new AppError(`Failed to sync transactions from Mono: ${err.message}`, 502);
    }

    const transactions: BankFeedTransaction[] = rawTxns.map((raw: any) => {
      const amountValue = Number(raw.amount) || 0;
      return {
        externalId: raw._id || raw.id || '',
        date: raw.date ? new Date(raw.date) : new Date(),
        description: raw.narration || raw.description || raw.counterparty || 'Mono Bank Feed Transaction',
        amount: Math.abs(amountValue),
        type: raw.type?.toLowerCase() === 'debit' ? 'debit' : raw.type?.toLowerCase() === 'credit' ? 'credit' : amountValue < 0 ? 'debit' : 'credit',
        balanceAfter: raw.balance != null ? Number(raw.balance) : undefined,
        reference: raw.reference || undefined,
        metadata: raw,
      };
    });

    await this.updateConnectionStatus(connectionId, 'active');

    return { transactions, balance: undefined };
  }

  async refreshConnection(connectionId: string): Promise<boolean> {
    const conn = await this.getConnection(connectionId);
    if (!conn.providerAccountId) return false;
    try {
      const { dataStatus } = await this.checkDataStatus(conn.providerAccountId);
      if (dataStatus === 'AVAILABLE' || dataStatus === 'PARTIAL') {
        await this.updateConnectionStatus(connectionId, 'active');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    await this.updateConnectionStatus(connectionId, 'disconnected');
  }
}

export const monoProvider = new MonoProvider();
