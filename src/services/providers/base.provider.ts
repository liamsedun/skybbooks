import { db, bankConnections } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../../lib/errors';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) return text;
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY) return encryptedText;
  if (!encryptedText.includes(':')) return encryptedText;
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export abstract class BaseBankFeedProvider {
  protected abstract providerType: string;
  protected config: Record<string, string> = {};

  constructor() {
    this.loadConfig();
  }

  protected abstract loadConfig(): void;

  async storeConnection(orgId: string, bankAccountId: string, token: { accessToken: string; refreshToken?: string; expiresAt?: Date; providerAccountId?: string; providerAccountName?: string; raw?: Record<string, any> }): Promise<string> {
    const [existing] = await db
      .select({ id: bankConnections.id })
      .from(bankConnections)
      .where(and(
        eq(bankConnections.orgId, orgId),
        eq(bankConnections.bankAccountId, bankAccountId),
        eq(bankConnections.provider, this.providerType as any)
      ))
      .limit(1);

    const data = {
      orgId,
      bankAccountId,
      provider: this.providerType as any,
      providerAccountId: token.providerAccountId,
      providerAccountName: token.providerAccountName,
      status: 'active' as const,
      authToken: token.accessToken ? encrypt(token.accessToken) : null,
      refreshToken: token.refreshToken ? encrypt(token.refreshToken) : null,
      tokenExpiresAt: token.expiresAt || null,
      lastSyncedAt: new Date(),
      meta: (token.raw || {}) as any,
    };

    if (existing) {
      await db.update(bankConnections).set(data).where(eq(bankConnections.id, existing.id));
      return existing.id;
    }
    const [created] = await db.insert(bankConnections).values(data).returning({ id: bankConnections.id });
    return created.id;
  }

  async getConnection(connectionId: string) {
    const [conn] = await db
      .select()
      .from(bankConnections)
      .where(eq(bankConnections.id, connectionId))
      .limit(1);
    if (!conn) throw new AppError('Bank connection not found', 404);
    if (conn.authToken) conn.authToken = decrypt(conn.authToken);
    if (conn.refreshToken) conn.refreshToken = decrypt(conn.refreshToken);
    return conn;
  }

  async getConnectionByAccount(bankAccountId: string, orgId: string) {
    const [conn] = await db
      .select()
      .from(bankConnections)
      .where(and(
        eq(bankConnections.bankAccountId, bankAccountId),
        eq(bankConnections.orgId, orgId),
        eq(bankConnections.provider, this.providerType as any)
      ))
      .limit(1);
    return conn || null;
  }

  async updateConnectionStatus(connectionId: string, status: string, errorMessage?: string) {
    await db.update(bankConnections)
      .set({ status: status as any, errorMessage: errorMessage || null, lastSyncedAt: new Date() })
      .where(eq(bankConnections.id, connectionId));
  }

  abstract fetchTransactions(connectionId: string, fromDate: Date): Promise<{ transactions: any[]; accountName?: string; balance?: number }>;
  abstract refreshConnection(connectionId: string): Promise<boolean>;
  abstract disconnect(connectionId: string): Promise<void>;

  protected async apiFetch(url: string, options: RequestInit = {}): Promise<any> {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new AppError(`Provider API error ${res.status}: ${body}`, 502);
    }
    return res.json();
  }
}
