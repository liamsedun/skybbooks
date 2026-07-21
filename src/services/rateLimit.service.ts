import { eq, and, desc } from 'drizzle-orm';
import { db, rateLimitConfigs } from '../db/schema';
import { AppError } from '../lib/errors';

export async function getRateLimitConfigs() {
  return await db.select().from(rateLimitConfigs).orderBy(desc(rateLimitConfigs.createdAt));
}

export async function createRateLimitConfig(data: any) {
  const [row] = await db.insert(rateLimitConfigs).values(data as any).returning();
  return row;
}

export async function updateRateLimitConfig(id: string, data: any) {
  const [row] = await db.update(rateLimitConfigs).set({ ...data, updatedAt: new Date() } as any)
    .where(eq(rateLimitConfigs.id, id)).returning();
  if (!row) throw new AppError('Rate limit config not found.', 404);
  return row;
}

export async function deleteRateLimitConfig(id: string) {
  await db.delete(rateLimitConfigs).where(eq(rateLimitConfigs.id, id));
}
