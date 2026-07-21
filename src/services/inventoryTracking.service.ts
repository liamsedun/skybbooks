import { eq, and, desc } from 'drizzle-orm';
import { db, inventorySerials, inventoryBatches, items } from '../db/schema';
import { AppError } from '../lib/errors';

export async function getSerials(orgId: string, itemId?: string) {
  const conditions: any[] = [eq(inventorySerials.orgId, orgId)];
  if (itemId) conditions.push(eq(inventorySerials.itemId, itemId));
  return await db.select({
    id: inventorySerials.id, serialNumber: inventorySerials.serialNumber,
    itemId: inventorySerials.itemId, itemName: items.name,
    status: inventorySerials.status,
    costPriceKobo: inventorySerials.costPriceKobo,
    sellingPriceKobo: inventorySerials.sellingPriceKobo,
    soldAt: inventorySerials.soldAt, createdAt: inventorySerials.createdAt,
  }).from(inventorySerials).leftJoin(items, eq(inventorySerials.itemId, items.id))
    .where(and(...conditions)).orderBy(desc(inventorySerials.createdAt));
}

export async function registerSerial(orgId: string, data: any) {
  const [row] = await db.insert(inventorySerials).values({ ...data, orgId } as any).returning();
  return row;
}

export async function transferSerial(id: string, orgId: string, newStatus: string, soldTo?: string) {
  const [row] = await db.update(inventorySerials).set({
    status: newStatus, soldTo: soldTo || null, soldAt: newStatus === 'sold' ? new Date() : null,
  } as any).where(and(eq(inventorySerials.id, id), eq(inventorySerials.orgId, orgId))).returning();
  if (!row) throw new AppError('Serial not found.', 404);
  return row;
}

export async function getBatches(orgId: string, itemId?: string) {
  const conditions: any[] = [eq(inventoryBatches.orgId, orgId)];
  if (itemId) conditions.push(eq(inventoryBatches.itemId, itemId));
  return await db.select({
    id: inventoryBatches.id, batchNumber: inventoryBatches.batchNumber,
    itemId: inventoryBatches.itemId, itemName: items.name,
    quantityReceived: inventoryBatches.quantityReceived,
    quantityRemaining: inventoryBatches.quantityRemaining,
    unitCostKobo: inventoryBatches.unitCostKobo,
    expiryDate: inventoryBatches.expiryDate, status: inventoryBatches.status,
    createdAt: inventoryBatches.createdAt,
  }).from(inventoryBatches).leftJoin(items, eq(inventoryBatches.itemId, items.id))
    .where(and(...conditions)).orderBy(desc(inventoryBatches.createdAt));
}

export async function createBatch(orgId: string, data: any) {
  const [row] = await db.insert(inventoryBatches).values({
    ...data, orgId, quantityRemaining: data.quantityReceived || 0,
  } as any).returning();
  return row;
}

export async function consumeBatch(id: string, orgId: string, quantity: number) {
  const [batch] = await db.select().from(inventoryBatches)
    .where(and(eq(inventoryBatches.id, id), eq(inventoryBatches.orgId, orgId))).limit(1);
  if (!batch) throw new AppError('Batch not found.', 404);
  if (batch.quantityRemaining < quantity) throw new AppError('Insufficient batch quantity.', 400);
  const newQty = batch.quantityRemaining - quantity;
  const [row] = await db.update(inventoryBatches).set({
    quantityRemaining: newQty, status: newQty === 0 ? ('depleted' as any) : batch.status,
  } as any).where(eq(inventoryBatches.id, id)).returning();
  return row;
}
