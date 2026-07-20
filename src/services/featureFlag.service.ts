import { db, featureFlags, planFeatureFlags, orgFeatureFlags, userFeatureFlags, subscriptionPlans } from '../db/schema';
import { eq, and, like, sql } from 'drizzle-orm';

export async function getFeatureDefinitions(category?: string) {
  const conditions = [eq(featureFlags.isActive, true)];
  if (category) conditions.push(eq(featureFlags.category, category));
  return db.select().from(featureFlags).where(and(...conditions)).orderBy(featureFlags.sortOrder);
}

export async function getFeatureDefinition(code: string) {
  const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.code, code)).limit(1);
  return flag || null;
}

export async function evaluateFeatureFlag(orgId: string, featureCode: string, userId?: string) {
  const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.code, featureCode)).limit(1);
  if (!flag || !flag.isActive) return { featureCode, state: 'disabled', enabled: false };

  const [orgOverride] = await db.select().from(orgFeatureFlags).where(and(eq(orgFeatureFlags.orgId, orgId), eq(orgFeatureFlags.featureCode, featureCode))).limit(1);
  if (orgOverride?.state) return { featureCode, state: orgOverride.state, enabled: orgOverride.state === 'enabled', usageLimit: orgOverride.usageLimit };

  if (userId) {
    const [userOverride] = await db.select().from(userFeatureFlags).where(and(eq(userFeatureFlags.userId, userId), eq(userFeatureFlags.featureCode, featureCode))).limit(1);
    if (userOverride?.state) return { featureCode, state: userOverride.state, enabled: userOverride.state === 'enabled', usageLimit: userOverride.usageLimit };
  }

  const sub = await db.select().from(subscriptionPlans).innerJoin(planFeatureFlags, eq(subscriptionPlans.id, planFeatureFlags.planId)).where(and(eq(planFeatureFlags.featureCode, featureCode))).limit(1);

  if (sub.length > 0) {
    const pff = sub[0].plan_feature_flags;
    return { featureCode, state: pff.state, enabled: pff.state === 'enabled', usageLimit: pff.usageLimit };
  }

  return { featureCode, state: flag.defaultState, enabled: flag.defaultState === 'enabled' };
}

export async function evaluateOrgFeatures(orgId: string, userId?: string) {
  const flags = await db.select().from(featureFlags).where(eq(featureFlags.isActive, true));
  const results = [];
  for (const flag of flags) {
    results.push(await evaluateFeatureFlag(orgId, flag.code, userId));
  }
  return results;
}

export async function setOrgFeatureFlag(orgId: string, featureCode: string, data: { state?: string; usageLimit?: number }) {
  const existing = await db.select().from(orgFeatureFlags).where(and(eq(orgFeatureFlags.orgId, orgId), eq(orgFeatureFlags.featureCode, featureCode))).limit(1);
  if (existing.length > 0) {
    const [updated] = await db.update(orgFeatureFlags).set({
      ...(data.state !== undefined ? { state: data.state as any } : {}),
      ...(data.usageLimit !== undefined ? { usageLimit: data.usageLimit } : {}),
      updatedAt: sql`now()`,
    }).where(eq(orgFeatureFlags.id, existing[0].id)).returning();
    return updated;
  }
  const [created] = await db.insert(orgFeatureFlags).values({
    orgId,
    featureCode,
    state: data.state as any || 'enabled',
    usageLimit: data.usageLimit,
  }).returning();
  return created;
}

export async function resetOrgFeatureFlag(orgId: string, featureCode: string) {
  await db.delete(orgFeatureFlags).where(and(eq(orgFeatureFlags.orgId, orgId), eq(orgFeatureFlags.featureCode, featureCode)));
  return { success: true };
}

export async function getOrgFeatureFlags(orgId: string) {
  return db.select().from(orgFeatureFlags).where(eq(orgFeatureFlags.orgId, orgId));
}

export async function getPlanFeatureFlags(planId: string) {
  return db.select().from(planFeatureFlags).where(eq(planFeatureFlags.planId, planId));
}

export async function setPlanFeatureFlag(planId: string, featureCode: string, data: { state: string; usageLimit?: number }) {
  const existing = await db.select().from(planFeatureFlags).where(and(eq(planFeatureFlags.planId, planId), eq(planFeatureFlags.featureCode, featureCode))).limit(1);
  if (existing.length > 0) {
    const [updated] = await db.update(planFeatureFlags).set({
      state: data.state as any,
      ...(data.usageLimit !== undefined ? { usageLimit: data.usageLimit } : {}),
      updatedAt: sql`now()`,
    }).where(eq(planFeatureFlags.id, existing[0].id)).returning();
    return updated;
  }
  const [created] = await db.insert(planFeatureFlags).values({
    planId,
    featureCode,
    state: data.state as any,
    usageLimit: data.usageLimit,
  }).returning();
  return created;
}

export async function bulkSetPlanFeatureFlags(planId: string, flags: Array<{ featureCode: string; state: string; usageLimit?: number }>) {
  const results = [];
  for (const flag of flags) {
    results.push(await setPlanFeatureFlag(planId, flag.featureCode, { state: flag.state, usageLimit: flag.usageLimit }));
  }
  return results;
}
