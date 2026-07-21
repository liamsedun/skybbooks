import { eq, and, desc, lte, gte, sql } from 'drizzle-orm';
import { db, featureRollouts, featureRolloutEvents } from '../db/schema';
import { AppError } from '../lib/errors';

export async function getFeatureRollouts() {
  return await db.select().from(featureRollouts).orderBy(desc(featureRollouts.createdAt));
}

export async function createFeatureRollout(data: any) {
  const [row] = await db.insert(featureRollouts).values(data as any).returning();
  return row;
}

export async function updateFeatureRollout(id: string, data: any) {
  const [row] = await db.update(featureRollouts).set({ ...data, updatedAt: new Date() } as any)
    .where(eq(featureRollouts.id, id)).returning();
  if (!row) throw new AppError('Feature rollout not found.', 404);
  return row;
}

export async function getRolloutEvents(rolloutId: string) {
  return await db.select({
    id: featureRolloutEvents.id, orgId: featureRolloutEvents.orgId,
    event: featureRolloutEvents.event, metadata: featureRolloutEvents.metadata,
    createdAt: featureRolloutEvents.createdAt,
  }).from(featureRolloutEvents).where(eq(featureRolloutEvents.rolloutId, rolloutId))
    .orderBy(desc(featureRolloutEvents.createdAt));
}

export async function logRolloutEvent(rolloutId: string, orgId: string, userId: string | null, event: string, metadata?: any) {
  const [row] = await db.insert(featureRolloutEvents).values({
    rolloutId, orgId, userId, event, metadata: metadata || {},
  } as any).returning();
  return row;
}

export async function isFeatureEnabled(featureKey: string, orgId: string): Promise<boolean> {
  const [rollout] = await db.select().from(featureRollouts)
    .where(and(eq(featureRollouts.featureKey, featureKey), eq(featureRollouts.isActive, true)))
    .limit(1);
  if (!rollout) return false;
  if ((rollout.allowlistOrgIds || []).includes(orgId)) return true;
  if (rollout.rolloutPercent >= 100) return true;
  if (rollout.rolloutPercent <= 0) return false;
  const hash = simpleHash(orgId + featureKey) % 100;
  return hash < rollout.rolloutPercent;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
