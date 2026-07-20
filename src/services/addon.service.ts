import { eq, and, desc } from 'drizzle-orm';
import { db, subscriptionAddons, subscriptions, organisations } from '../db/schema';
import { AppError } from '../lib/errors';

export async function getAddons(orgId: string, subscriptionId?: string): Promise<any[]> {
  const conditions: any[] = [eq(subscriptionAddons.orgId, orgId)];
  if (subscriptionId) conditions.push(eq(subscriptionAddons.subscriptionId, subscriptionId));
  return await db.select().from(subscriptionAddons).where(and(...conditions)).orderBy(desc(subscriptionAddons.createdAt));
}

export async function getAddon(id: string, orgId: string): Promise<any> {
  const [row] = await db.select().from(subscriptionAddons).where(and(eq(subscriptionAddons.id, id), eq(subscriptionAddons.orgId, orgId))).limit(1);
  if (!row) throw new AppError('Add-on not found.', 404);
  return row;
}

export async function createAddon(orgId: string, data: { subscriptionId: string; name: string; description?: string; priceKobo: number; quantity?: number; billingCycle?: string }): Promise<any> {
  const [sub] = await db.select({ id: subscriptions.id, status: subscriptions.status }).from(subscriptions).where(and(eq(subscriptions.orgId, orgId), eq(subscriptions.id, data.subscriptionId))).limit(1);
  if (!sub) throw new AppError('Subscription not found.', 404);

  const [addon] = await db.insert(subscriptionAddons).values({
    orgId,
    subscriptionId: data.subscriptionId,
    name: data.name,
    description: data.description || null,
    priceKobo: data.priceKobo,
    quantity: data.quantity || 1,
    billingCycle: data.billingCycle || 'monthly',
  } as any).returning();
  return addon;
}

export async function deactivateAddon(id: string, orgId: string): Promise<any> {
  const existing = await getAddon(id, orgId);
  if (!existing.isActive) throw new AppError('Add-on is already inactive.', 400);
  const [updated] = await db.update(subscriptionAddons).set({ isActive: false, removedAt: new Date(), updatedAt: new Date() } as any).where(and(eq(subscriptionAddons.id, id), eq(subscriptionAddons.orgId, orgId))).returning();
  return updated;
}

export async function updateAddonQuantity(id: string, orgId: string, quantity: number): Promise<any> {
  const existing = await getAddon(id, orgId);
  const [updated] = await db.update(subscriptionAddons).set({ quantity, updatedAt: new Date() } as any).where(and(eq(subscriptionAddons.id, id), eq(subscriptionAddons.orgId, orgId))).returning();
  return updated;
}

export async function getAddonsTotal(orgId: string, subscriptionId: string): Promise<number> {
  const rows = await db.select().from(subscriptionAddons).where(and(eq(subscriptionAddons.orgId, orgId), eq(subscriptionAddons.subscriptionId, subscriptionId), eq(subscriptionAddons.isActive, true)));
  return rows.reduce((sum, a) => sum + (Number(a.priceKobo) * Number(a.quantity)), 0);
}
