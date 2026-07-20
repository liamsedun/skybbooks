import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db, addonProducts, subscriptionAddons, subscriptions, organisations } from '../db/schema';
import { AppError } from '../lib/errors';
import { getOrgSubscription, getOrgEntitlements } from './subscription.service';
import { createAuditLog, extractReqMeta } from './audit.service';

// ── Catalog ──

export async function listProducts(includeInactive = false): Promise<any[]> {
  const conditions: any[] = [eq(addonProducts.isPublic, true)];
  if (!includeInactive) conditions.push(eq(addonProducts.isActive, true));
  return await db.select().from(addonProducts).where(and(...conditions)).orderBy(addonProducts.sortOrder);
}

export async function getProduct(id: string): Promise<any> {
  const [row] = await db.select().from(addonProducts).where(eq(addonProducts.id, id)).limit(1);
  if (!row) throw new AppError('Add-on product not found.', 404);
  return row;
}

export async function getProductByCode(code: string): Promise<any> {
  const [row] = await db.select().from(addonProducts).where(eq(addonProducts.code, code)).limit(1);
  if (!row) throw new AppError('Add-on product not found.', 404);
  return row;
}

export async function createProduct(data: {
  code: string; name: string; description?: string; icon?: string; category: string;
  monthlyPriceKobo: number; annualPriceKobo: number; usageLimit?: number; limitKey?: string;
  isActive?: boolean; isPublic?: boolean; sortOrder?: number;
}): Promise<any> {
  const [row] = await db.insert(addonProducts).values(data as any).returning();
  return row;
}

export async function updateProduct(id: string, data: Partial<any>): Promise<any> {
  const [row] = await db.update(addonProducts).set({ ...data, updatedAt: new Date() } as any).where(eq(addonProducts.id, id)).returning();
  if (!row) throw new AppError('Add-on product not found.', 404);
  return row;
}

// ── Org Purchased Add-ons ──

export async function getOrgAddons(orgId: string, includeInactive = false): Promise<any[]> {
  const conditions: any[] = [eq(subscriptionAddons.orgId, orgId)];
  if (!includeInactive) conditions.push(eq(subscriptionAddons.isActive, true));
  return await db.select({
    sa: subscriptionAddons,
    product: addonProducts,
  }).from(subscriptionAddons)
    .leftJoin(addonProducts, eq(subscriptionAddons.productId, addonProducts.id))
    .where(and(...conditions))
    .orderBy(desc(subscriptionAddons.createdAt));
}

export async function getOrgAddon(id: string, orgId: string): Promise<any> {
  const [row] = await db.select({
    sa: subscriptionAddons,
    product: addonProducts,
  }).from(subscriptionAddons)
    .leftJoin(addonProducts, eq(subscriptionAddons.productId, addonProducts.id))
    .where(and(eq(subscriptionAddons.id, id), eq(subscriptionAddons.orgId, orgId)))
    .limit(1);
  if (!row) throw new AppError('Add-on not found.', 404);
  return row;
}

function computeExpiry(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

function computeNextBilling(billingCycle: string): Date {
  const d = new Date();
  if (billingCycle === 'annual') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

// ── Purchase ──

export async function purchaseAddon(orgId: string, userId: string, data: {
  productId: string; quantity?: number; billingCycle?: string; autoRenew?: boolean;
}, reqMeta?: any): Promise<any> {
  const product = await getProduct(data.productId);
  if (!product.isActive) throw new AppError('This add-on is no longer available for purchase.', 400);

  const sub = await getOrgSubscription(orgId);
  if (!sub) throw new AppError('No active subscription. Please subscribe to a plan first.', 400);

  const billingCycle = data.billingCycle || 'monthly';
  const priceKobo = billingCycle === 'annual' ? Number(product.annualPriceKobo) : Number(product.monthlyPriceKobo);
  const quantity = data.quantity || 1;
  const totalPrice = priceKobo * quantity;

  // Check for existing active add-on of same product
  const existing = await db.select().from(subscriptionAddons)
    .where(and(eq(subscriptionAddons.orgId, orgId), eq(subscriptionAddons.productId, product.id), eq(subscriptionAddons.isActive, true)))
    .limit(1);
  if (existing.length > 0) {
    throw new AppError(`You already have an active "${product.name}" add-on. Please adjust quantity or cancel the existing one.`, 400);
  }

  const [addon] = await db.insert(subscriptionAddons).values({
    orgId,
    subscriptionId: sub.id,
    productId: product.id,
    name: product.name,
    description: product.description,
    priceKobo: totalPrice,
    priceWhenPurchasedKobo: priceKobo,
    quantity,
    billingCycle,
    autoRenew: data.autoRenew !== false,
    isActive: true,
    activatedAt: new Date(),
    expiresAt: computeExpiry(billingCycle === 'annual' ? 12 : 1),
    nextBillingDate: computeNextBilling(billingCycle),
    addedAt: new Date(),
    limitsJson: product.limitKey ? { [product.limitKey]: product.usageLimit * quantity } : {},
  } as any).returning();

  await createAuditLog({ orgId, userId, action: 'ADDON_PURCHASE', entityType: 'subscription_addon', entityId: addon.id, newValues: { productId: product.id, name: product.name, priceKobo: totalPrice, billingCycle, quantity }, ...(reqMeta || extractReqMeta({})) });

  return { ...addon, product };
}

// ── Cancel / Deactivate ──

export async function cancelAddon(id: string, orgId: string, userId: string, reqMeta?: any): Promise<any> {
  const { sa, product } = await getOrgAddon(id, orgId);
  if (!sa.isActive) throw new AppError('Add-on is already inactive.', 400);

  const [updated] = await db.update(subscriptionAddons).set({
    isActive: false,
    autoRenew: false,
    removedAt: new Date(),
    nextBillingDate: null,
    updatedAt: new Date(),
  } as any).where(and(eq(subscriptionAddons.id, id), eq(subscriptionAddons.orgId, orgId))).returning();

  await createAuditLog({ orgId, userId, action: 'ADDON_CANCEL', entityType: 'subscription_addon', entityId: id, newValues: { reason: 'user_cancelled' }, ...(reqMeta || extractReqMeta({})) });

  return { ...updated, product };
}

// ── Reactivate ──

export async function reactivateAddon(id: string, orgId: string): Promise<any> {
  const { sa, product } = await getOrgAddon(id, orgId);
  if (sa.isActive) throw new AppError('Add-on is already active.', 400);

  const billingCycle = sa.billingCycle;
  const [updated] = await db.update(subscriptionAddons).set({
    isActive: true,
    autoRenew: true,
    removedAt: null,
    activatedAt: new Date(),
    expiresAt: computeExpiry(billingCycle === 'annual' ? 12 : 1),
    nextBillingDate: computeNextBilling(billingCycle),
    updatedAt: new Date(),
  } as any).where(and(eq(subscriptionAddons.id, id), eq(subscriptionAddons.orgId, orgId))).returning();

  return { ...updated, product };
}

// ── Update Quantity ──

export async function updateAddonQuantity(id: string, orgId: string, quantity: number): Promise<any> {
  if (quantity < 1) throw new AppError('Quantity must be at least 1.', 400);
  const { sa, product } = await getOrgAddon(id, orgId);
  if (!sa.isActive) throw new AppError('Cannot update quantity on an inactive add-on.', 400);

  const pricePerUnit = Number(sa.priceWhenPurchasedKobo || sa.priceKobo / sa.quantity);
  const newPrice = pricePerUnit * quantity;

  const [updated] = await db.update(subscriptionAddons).set({
    quantity,
    priceKobo: newPrice,
    updatedAt: new Date(),
    limitsJson: product?.limitKey ? { [product.limitKey]: (product.usageLimit || 0) * quantity } : sa.limitsJson,
  } as any).where(and(eq(subscriptionAddons.id, id), eq(subscriptionAddons.orgId, orgId))).returning();

  return { ...updated, product };
}

// ── Toggle Auto-Renew ──

export async function toggleAutoRenew(id: string, orgId: string, autoRenew: boolean): Promise<any> {
  const { sa } = await getOrgAddon(id, orgId);
  const [updated] = await db.update(subscriptionAddons).set({ autoRenew, updatedAt: new Date() } as any)
    .where(and(eq(subscriptionAddons.id, id), eq(subscriptionAddons.orgId, orgId))).returning();
  return updated;
}

// ── Auto-Renewal Processor ──

export async function processAddonRenewals(): Promise<{ renewed: number; failed: number; totalRevenueKobo: number }> {
  const due = await db.select({
    sa: subscriptionAddons,
  }).from(subscriptionAddons)
    .where(and(
      eq(subscriptionAddons.isActive, true),
      eq(subscriptionAddons.autoRenew, true),
      sql`next_billing_date IS NOT NULL AND next_billing_date <= now()`,
    ));

  let renewed = 0;
  let failed = 0;
  let totalRevenueKobo = 0;

  for (const row of due) {
    const sa = row.sa;
    try {
      const sub = await db.select().from(subscriptions).where(eq(subscriptions.id, sa.subscriptionId)).limit(1).then(r => r[0]);
      if (!sub || !['active', 'grace_period'].includes(sub.status)) {
        await db.update(subscriptionAddons).set({ isActive: false, autoRenew: false, updatedAt: new Date() } as any).where(eq(subscriptionAddons.id, sa.id));
        failed++;
        continue;
      }

      const newExpiry = computeExpiry(sa.billingCycle === 'annual' ? 12 : 1);
      const newBilling = computeNextBilling(sa.billingCycle);

      await db.update(subscriptionAddons).set({
        expiresAt: newExpiry,
        nextBillingDate: newBilling,
        activatedAt: new Date(),
        updatedAt: new Date(),
      } as any).where(eq(subscriptionAddons.id, sa.id));

      totalRevenueKobo += Number(sa.priceKobo);
      renewed++;
    } catch {
      failed++;
    }
  }

  return { renewed, failed, totalRevenueKobo };
}

// ── Expiry Checker ──

export async function deactivateExpiredAddons(): Promise<number> {
  const expired = await db.update(subscriptionAddons).set({
    isActive: false,
    autoRenew: false,
    removedAt: new Date(),
    nextBillingDate: null,
    updatedAt: new Date(),
  } as any).where(and(
    eq(subscriptionAddons.isActive, true),
    sql`expires_at IS NOT NULL AND expires_at <= now()`,
    sql`auto_renew = false`,
  )).returning();

  return expired.length;
}

// ── Compute effective limits including add-ons ──

export async function getEffectiveLimits(orgId: string): Promise<Record<string, number>> {
  const entitlements = await getOrgEntitlements(orgId);
  const baseLimits: Record<string, number> = entitlements?.limits || {};

  const addons = await db.select().from(subscriptionAddons).where(and(
    eq(subscriptionAddons.orgId, orgId),
    eq(subscriptionAddons.isActive, true),
  ));

  const effective = { ...baseLimits };
  for (const a of addons) {
    if (a.limitsJson && typeof a.limitsJson === 'object') {
      for (const [key, val] of Object.entries(a.limitsJson)) {
        effective[key] = (effective[key] || 0) + (val as number) * Number(a.quantity);
      }
    }
  }

  return effective;
}
