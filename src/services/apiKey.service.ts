import crypto from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db, apiKeys } from '../db/schema';
import { AppError } from '../lib/errors';

function generateKey(): { key: string; prefix: string; hash: string } {
  const prefix = 'sk_' + crypto.randomBytes(4).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');
  const key = `${prefix}_${secret}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, prefix, hash };
}

export async function createApiKey(orgId: string, name: string, scopes: string[] = ['read'], expiresAt?: string) {
  const { key, prefix, hash } = generateKey();
  const [row] = await db.insert(apiKeys).values({
    orgId, name, keyHash: hash, prefix, scopes,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    isActive: true,
  } as any).returning();
  return { ...row, key };
}

export async function listApiKeys(orgId: string) {
  return await db.select().from(apiKeys)
    .where(eq(apiKeys.orgId, orgId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(id: string, orgId: string) {
  const [row] = await db.update(apiKeys).set({ isActive: false } as any)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, orgId)))
    .returning();
  if (!row) throw new AppError('API key not found.', 404);
  return row;
}

export async function validateApiKey(key: string): Promise<any> {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1);
  if (!row || !row.isActive) return null;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() } as any).where(eq(apiKeys.id, row.id));
  return row;
}
