import { db, items, inventoryLots, inventoryTransactions, inventoryAdjustments, inventoryAdjustmentItems, inventoryTransfers, inventoryTransferItems, inventoryStockCounts, inventoryStockCountItems, inventoryWriteoffs, inventoryWriteoffItems, landedCosts, landedCostAllocations, accounts, billLines } from '../db/schema';
import { eq, and, sql, asc, desc, gte, lte } from 'drizzle-orm';
import { postToGL } from './posting.service';
import { createAuditLog } from './audit.service';
import { AppError } from '../lib/errors';

const INV_SOURCE = 'inventory_adjustment' as const;

// ==============================
// COSTING ENGINE
// ==============================

export function computeWeightedAverage(lots: { quantity: number; costPerUnit: number }[]): number {
  const totalQty = lots.reduce((s, l) => s + l.quantity, 0);
  const totalCost = lots.reduce((s, l) => s + l.quantity * l.costPerUnit, 0);
  return totalQty > 0 ? Math.round(totalCost / totalQty) : 0;
}

export function computeFifoCost(lots: { id: string; quantity: number; costPerUnit: number }[], neededQty: number): { lots: { lotId: string; consumed: number; unitCost: number }[]; totalCost: number } {
  let remaining = neededQty;
  const consumed: { lotId: string; consumed: number; unitCost: number }[] = [];
  let totalCost = 0;
  for (const lot of lots.sort((a, b) => a.costPerUnit - b.costPerUnit)) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.quantity);
    consumed.push({ lotId: lot.id, consumed: take, unitCost: lot.costPerUnit });
    totalCost += take * lot.costPerUnit;
    remaining -= take;
  }
  if (remaining > 0) throw new AppError('Insufficient inventory to fulfill request.', 400);
  return { lots: consumed, totalCost };
}

export function computeSpecificIdCost(lotId: string, lots: { id: string; quantity: number; costPerUnit: number }[], neededQty: number): { lotId: string; consumed: number; unitCost: number; totalCost: number } {
  const lot = lots.find(l => l.id === lotId);
  if (!lot) throw new AppError('Specified lot not found.', 400);
  if (lot.quantity < neededQty) throw new AppError('Insufficient quantity in specified lot.', 400);
  const totalCost = neededQty * lot.costPerUnit;
  return { lotId, consumed: neededQty, unitCost: lot.costPerUnit, totalCost };
}

export async function consumeInventory(orgId: string, itemId: string, quantity: number, method?: string, specificLotId?: string): Promise<{ lotConsumptions: { lotId: string; consumed: number; unitCost: number }[]; totalCost: number }> {
  const item = (await db.select().from(items).where(and(eq(items.id, itemId), eq(items.orgId, orgId))).limit(1))[0];
  if (!item) throw new AppError('Item not found.', 404);
  const costingMethod = method || item.costingMethod || 'fifo';
  const lots = await db.select().from(inventoryLots).where(and(eq(inventoryLots.itemId, itemId), sql`CAST(${inventoryLots.quantity} AS numeric) > 0`)).orderBy(asc(inventoryLots.receivedDate));

  if (costingMethod === 'weighted_average') {
    const avgCost = computeWeightedAverage(lots.map(l => ({ quantity: Number(l.quantity), costPerUnit: l.costPerUnit })));
    const totalQty = lots.reduce((s, l) => s + Number(l.quantity), 0);
    if (totalQty < quantity) throw new AppError('Insufficient inventory.', 400);
    // Consume proportionally from all lots
    let remaining = quantity;
    const consumptions: { lotId: string; consumed: number; unitCost: number }[] = [];
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Number(lot.quantity));
      consumptions.push({ lotId: lot.id, consumed: take, unitCost: avgCost });
      remaining -= take;
    }
    return { lotConsumptions: consumptions, totalCost: quantity * avgCost };
  }

  if (costingMethod === 'specific_identification' && specificLotId) {
    const result = computeSpecificIdCost(specificLotId, lots.map(l => ({ id: l.id, quantity: Number(l.quantity), costPerUnit: l.costPerUnit })), quantity);
    return { lotConsumptions: [{ lotId: result.lotId, consumed: result.consumed, unitCost: result.unitCost }], totalCost: result.totalCost };
  }

  // Default: FIFO
  const fifo = computeFifoCost(lots.map(l => ({ id: l.id, quantity: Number(l.quantity), costPerUnit: l.costPerUnit })), quantity);
  return { lotConsumptions: fifo.lots, totalCost: fifo.totalCost };
}

export async function adjustLotQuantities(orgId: string, consumptions: { lotId: string; consumed: number; unitCost: number }[]): Promise<void> {
  for (const c of consumptions) {
    const lot = (await db.select().from(inventoryLots).where(and(eq(inventoryLots.id, c.lotId), eq(inventoryLots.orgId, orgId))).limit(1))[0];
    if (!lot) continue;
    const newQty = Number(lot.quantity) - c.consumed;
    if (newQty <= 0) {
      await db.delete(inventoryLots).where(eq(inventoryLots.id, c.lotId));
    } else {
      await db.update(inventoryLots).set({ quantity: String(newQty) }).where(eq(inventoryLots.id, c.lotId));
    }
  }
}

// ==============================
// INVENTORY TRANSACTIONS
// ==============================

export async function recordTransaction(orgId: string, data: { itemId: string; lotId?: string; type: string; quantity: string; unitCost?: number; referenceType?: string; referenceId?: string; date: Date }): Promise<any> {
  const [txn] = await db.insert(inventoryTransactions).values({
    orgId, itemId: data.itemId, lotId: data.lotId || null, type: data.type as any,
    quantity: data.quantity, unitCost: data.unitCost || null,
    referenceType: data.referenceType || null, referenceId: data.referenceId || null,
    date: data.date,
  }).returning();
  return txn;
}

// ==============================
// WEIGHTED AVERAGE UPDATE
// ==============================

export async function updateAverageCost(orgId: string, itemId: string): Promise<void> {
  const item = (await db.select().from(items).where(and(eq(items.id, itemId), eq(items.orgId, orgId))).limit(1))[0];
  if (!item || item.costingMethod !== 'weighted_average') return;
  const lots = await db.select().from(inventoryLots).where(and(eq(inventoryLots.itemId, itemId), eq(inventoryLots.orgId, orgId)));
  const avgCost = computeWeightedAverage(lots.map(l => ({ quantity: Number(l.quantity), costPerUnit: l.costPerUnit })));
  await db.update(items).set({ averageCost: avgCost }).where(eq(items.id, itemId));
}

// ==============================
// INVENTORY TRANSFERS
// ==============================

export async function createTransfer(orgId: string, userId: string, data: { reference: string; date: string; fromLocation: string; toLocation: string; description?: string; transferCost?: number; items: { itemId: string; quantity: number; lotId?: string }[] }, reqMeta?: any) {
  const [transfer] = await db.insert(inventoryTransfers).values({
    orgId, reference: data.reference, date: new Date(data.date),
    fromLocation: data.fromLocation, toLocation: data.toLocation,
    description: data.description || null, transferCost: data.transferCost || 0,
    status: 'draft', createdBy: userId,
  }).returning();

  for (const line of data.items) {
    const consumption = await consumeInventory(orgId, line.itemId, line.quantity, 'fifo', line.lotId);
    await adjustLotQuantities(orgId, consumption.lotConsumptions);
    for (const c of consumption.lotConsumptions) {
      await recordTransaction(orgId, { itemId: line.itemId, lotId: c.lotId, type: 'transfer', quantity: String(-c.consumed), unitCost: c.unitCost, referenceType: 'inventory_transfer', referenceId: transfer.id, date: new Date(data.date) });
    }
    // Create destination lot
    const item = (await db.select().from(items).where(eq(items.id, line.itemId)).limit(1))[0];
    const totalCost = consumption.totalCost;
    const unitCost = Math.round(totalCost / line.quantity);
    await db.insert(inventoryLots).values({
      orgId, itemId: line.itemId, quantity: String(line.quantity), costPerUnit: unitCost,
      receivedDate: new Date(data.date), reference: `TRF-${transfer.reference}`,
    });
    await recordTransaction(orgId, { itemId: line.itemId, type: 'transfer', quantity: String(line.quantity), unitCost, referenceType: 'inventory_transfer', referenceId: transfer.id, date: new Date(data.date) });
  }

  await db.update(inventoryTransfers).set({ status: 'completed' }).where(eq(inventoryTransfers.id, transfer.id));
  if (reqMeta) createAuditLog({ orgId, userId, action: 'create', entityType: 'inventory-transfer', entityId: transfer.id, newValues: { reference: data.reference, items: data.items.length }, ...reqMeta });
  return transfer;
}

export async function getTransfers(orgId: string) {
  return db.select().from(inventoryTransfers).where(eq(inventoryTransfers.orgId, orgId)).orderBy(desc(inventoryTransfers.date));
}

export async function getTransferItems(orgId: string, transferId: string) {
  const transferItems = await db.select().from(inventoryTransferItems).where(eq(inventoryTransferItems.transferId, transferId));
  const itemIds = [...new Set(transferItems.map(t => t.itemId))];
  const itemMap = itemIds.length > 0 ? new Map((await db.select().from(items).where(sql`${items.id} = ANY(${itemIds}::uuid[])`)).map(i => [i.id, i])) : new Map();
  return transferItems.map(t => ({ ...t, item: itemMap.get(t.itemId) || null }));
}

// ==============================
// STOCK COUNTS
// ==============================

export async function createStockCount(orgId: string, userId: string, data: { reference: string; date: string; location?: string; description?: string; items: { itemId: string; expectedQuantity: number; actualQuantity: number; lotId?: string }[] }, reqMeta?: any) {
  const [count] = await db.insert(inventoryStockCounts).values({
    orgId, reference: data.reference, date: new Date(data.date),
    location: data.location || null, description: data.description || null,
    status: 'draft', createdBy: userId,
  }).returning();

  for (const line of data.items) {
    const variance = line.actualQuantity - line.expectedQuantity;
    const itemLots = await db.select().from(inventoryLots).where(and(eq(inventoryLots.itemId, line.itemId), eq(inventoryLots.orgId, orgId))).orderBy(asc(inventoryLots.receivedDate));
    const unitCost = itemLots.length > 0 ? itemLots[0].costPerUnit : 0;
    const varianceValue = Math.abs(variance) * unitCost;
    await db.insert(inventoryStockCountItems).values({
      countId: count.id, itemId: line.itemId, lotId: line.lotId || null,
      expectedQuantity: String(line.expectedQuantity), actualQuantity: String(line.actualQuantity),
      variance: String(variance), unitCost, varianceValue: variance ? varianceValue : 0,
    });
  }

  if (reqMeta) createAuditLog({ orgId, userId, action: 'create', entityType: 'inventory-stock-count', entityId: count.id, newValues: { reference: data.reference }, ...reqMeta });
  return count;
}

export async function applyStockCount(orgId: string, userId: string, countId: string, reqMeta?: any) {
  const count = (await db.select().from(inventoryStockCounts).where(and(eq(inventoryStockCounts.id, countId), eq(inventoryStockCounts.orgId, orgId))).limit(1))[0];
  if (!count) throw new AppError('Stock count not found.', 404);
  if (count.status === 'completed') throw new AppError('Stock count already completed.', 400);

  const countItems = await db.select().from(inventoryStockCountItems).where(eq(inventoryStockCountItems.countId, countId));
  let totalAdjustmentValue = 0;

  for (const ci of countItems) {
    const variance = Number(ci.variance);
    if (variance === 0) continue;
    const unitCost = ci.unitCost || 0;
    const adjValue = Math.abs(variance) * unitCost;
    totalAdjustmentValue += adjValue;

    // Find the lot and adjust quantity
    if (variance > 0) {
      // Surplus: create new lot
      await db.insert(inventoryLots).values({
        orgId, itemId: ci.itemId, quantity: String(variance), costPerUnit: unitCost,
        receivedDate: new Date(), reference: `SC-${count.reference}`,
      });
    } else {
      // Shortage: consume from existing lots
      const consumption = await consumeInventory(orgId, ci.itemId, Math.abs(variance), 'fifo');
      await adjustLotQuantities(orgId, consumption.lotConsumptions);
    }

    await recordTransaction(orgId, { itemId: ci.itemId, type: 'adjustment', quantity: String(variance), unitCost, referenceType: 'inventory_stock_count', referenceId: countId, date: new Date() });
  }

  if (totalAdjustmentValue > 0) {
    // Find the inventory write-off/down account (102600 or similar)
    const invWriteDownAcc = (await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, '102600'))).limit(1))[0];
    const inventoryAcc = (await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'inventory'))).limit(1))[0];
    if (invWriteDownAcc && inventoryAcc) {
      await postToGL({
        orgId, date: new Date(),
        description: `Stock count adjustment - ${count.reference}`,
        source: INV_SOURCE, createdBy: userId,
        lines: [
          { accountId: invWriteDownAcc.id, debit: totalAdjustmentValue, credit: 0, description: 'Stock count variance' },
          { accountId: inventoryAcc.id, debit: 0, credit: totalAdjustmentValue, description: 'Inventory adjustment' },
        ],
      });
    }
  }

  await db.update(inventoryStockCounts).set({ status: 'completed' }).where(eq(inventoryStockCounts.id, countId));
  if (reqMeta) createAuditLog({ orgId, userId, action: 'update', entityType: 'inventory-stock-count', entityId: countId, newValues: { status: 'completed' }, ...reqMeta });
  return count;
}

export async function getStockCounts(orgId: string) {
  return db.select().from(inventoryStockCounts).where(eq(inventoryStockCounts.orgId, orgId)).orderBy(desc(inventoryStockCounts.date));
}

export async function getStockCountItems(orgId: string, countId: string) {
  const countItems = await db.select().from(inventoryStockCountItems).where(eq(inventoryStockCountItems.countId, countId));
  const itemIds = [...new Set(countItems.map(c => c.itemId))];
  const itemMap = itemIds.length > 0 ? new Map((await db.select().from(items).where(sql`${items.id} = ANY(${itemIds}::uuid[])`)).map(i => [i.id, i])) : new Map();
  return countItems.map(c => ({ ...c, item: itemMap.get(c.itemId) || null }));
}

// ==============================
// WRITE-OFFS
// ==============================

export async function createWriteoff(orgId: string, userId: string, data: { reference: string; date: string; reason: string; description?: string; location?: string; accountId?: string; items: { itemId: string; quantity: number; lotId?: string }[] }, reqMeta?: any) {
  const [wo] = await db.insert(inventoryWriteoffs).values({
    orgId, reference: data.reference, date: new Date(data.date),
    reason: data.reason, description: data.description || null,
    location: data.location || null, accountId: data.accountId || null,
    status: 'draft', createdBy: userId,
  }).returning();

  for (const line of data.items) {
    const consumption = await consumeInventory(orgId, line.itemId, line.quantity, 'fifo', line.lotId);
    const totalCost = consumption.totalCost;
    await db.insert(inventoryWriteoffItems).values({
      writeoffId: wo.id, itemId: line.itemId, lotId: line.lotId || null,
      quantity: String(line.quantity), unitCost: Math.round(totalCost / line.quantity), totalCost,
    });
  }

  if (reqMeta) createAuditLog({ orgId, userId, action: 'create', entityType: 'inventory-writeoff', entityId: wo.id, newValues: { reference: data.reference }, ...reqMeta });
  return wo;
}

export async function postWriteoff(orgId: string, userId: string, writeoffId: string, reqMeta?: any) {
  const wo = (await db.select().from(inventoryWriteoffs).where(and(eq(inventoryWriteoffs.id, writeoffId), eq(inventoryWriteoffs.orgId, orgId))).limit(1))[0];
  if (!wo) throw new AppError('Write-off not found.', 404);
  if (wo.status === 'posted') throw new AppError('Write-off already posted.', 400);

  const woItems = await db.select().from(inventoryWriteoffItems).where(eq(inventoryWriteoffItems.writeoffId, writeoffId));
  let totalCost = 0;

  for (const woi of woItems) {
    const consumption = await consumeInventory(orgId, woi.itemId, Number(woi.quantity), 'fifo', woi.lotId || undefined);
    await adjustLotQuantities(orgId, consumption.lotConsumptions);
    for (const c of consumption.lotConsumptions) {
      await recordTransaction(orgId, { itemId: woi.itemId, lotId: c.lotId, type: 'adjustment', quantity: String(-c.consumed), unitCost: c.unitCost, referenceType: 'inventory_writeoff', referenceId: writeoffId, date: new Date() });
    }
    totalCost += consumption.totalCost;
  }

  if (totalCost > 0) {
    const expenseAccountId = wo.accountId || ((await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, '830000'))).limit(1))[0]?.id);
    const inventoryAcc = (await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'inventory'))).limit(1))[0];
    if (expenseAccountId && inventoryAcc) {
      await postToGL({
        orgId, date: new Date(),
        description: `Inventory write-off - ${wo.reference}: ${wo.reason}`,
        source: INV_SOURCE, createdBy: userId,
        lines: [
          { accountId: expenseAccountId, debit: totalCost, credit: 0, description: `Write-off: ${wo.reason}` },
          { accountId: inventoryAcc.id, debit: 0, credit: totalCost, description: 'Inventory write-off' },
        ],
      });
    }
  }

  await db.update(inventoryWriteoffs).set({ status: 'posted' }).where(eq(inventoryWriteoffs.id, writeoffId));
  if (reqMeta) createAuditLog({ orgId, userId, action: 'update', entityType: 'inventory-writeoff', entityId: writeoffId, newValues: { status: 'posted' }, ...reqMeta });
  return wo;
}

export async function getWriteoffs(orgId: string) {
  return db.select().from(inventoryWriteoffs).where(eq(inventoryWriteoffs.orgId, orgId)).orderBy(desc(inventoryWriteoffs.date));
}

export async function getWriteoffItems(orgId: string, writeoffId: string) {
  const woItems = await db.select().from(inventoryWriteoffItems).where(eq(inventoryWriteoffItems.writeoffId, writeoffId));
  const itemIds = [...new Set(woItems.map(w => w.itemId))];
  const itemMap = itemIds.length > 0 ? new Map((await db.select().from(items).where(sql`${items.id} = ANY(${itemIds}::uuid[])`)).map(i => [i.id, i])) : new Map();
  return woItems.map(w => ({ ...w, item: itemMap.get(w.itemId) || null }));
}

// ==============================
// LANDED COSTS
// ==============================

export async function createLandedCost(orgId: string, userId: string, data: { reference: string; date: string; vendor?: string; description?: string; totalAmount: number; allocationMethod?: string; billId?: string }, reqMeta?: any) {
  const [lc] = await db.insert(landedCosts).values({
    orgId, reference: data.reference, date: new Date(data.date),
    vendor: data.vendor || null, description: data.description || null,
    totalAmount: data.totalAmount, allocationMethod: (data.allocationMethod || 'by_value') as any,
    billId: data.billId || null, status: 'draft', createdBy: userId,
  }).returning();
  if (reqMeta) createAuditLog({ orgId, userId, action: 'create', entityType: 'landed-cost', entityId: lc.id, newValues: { reference: data.reference }, ...reqMeta });
  return lc;
}

export async function allocateLandedCost(orgId: string, userId: string, landedCostId: string, reqMeta?: any) {
  const lc = (await db.select().from(landedCosts).where(and(eq(landedCosts.id, landedCostId), eq(landedCosts.orgId, orgId))).limit(1))[0];
  if (!lc) throw new AppError('Landed cost not found.', 404);
  if (lc.status === 'allocated') throw new AppError('Already allocated.', 400);

  const totalAmount = lc.totalAmount;

  // Find bill lines for this bill
  let billLinesToAllocate: any[] = [];
  if (lc.billId) {
    billLinesToAllocate = await db.select({
      id: billLines.id, itemId: billLines.itemId, quantity: billLines.quantity,
      unitPrice: billLines.unitPrice, lineTotal: billLines.lineTotal,
    }).from(billLines).where(eq(billLines.billId, lc.billId));
  }

  if (billLinesToAllocate.length === 0) {
    throw new AppError('No bill line items found to allocate landed costs against.', 400);
  }

  const method = lc.allocationMethod || 'by_value';
  let totalBasis = 0;
  if (method === 'by_value') totalBasis = billLinesToAllocate.reduce((s: number, bl: any) => s + bl.lineTotal, 0);
  else if (method === 'by_quantity') totalBasis = billLinesToAllocate.reduce((s: number, bl: any) => s + Number(bl.quantity), 0);

  if (totalBasis <= 0) throw new AppError('Cannot allocate: total basis is zero.', 400);

  for (const bl of billLinesToAllocate) {
    const basis = method === 'by_value' ? bl.lineTotal : Number(bl.quantity);
    const allocAmount = Math.round((basis / totalBasis) * totalAmount);

    // Find existing lots for this item from this bill
    const lots = await db.select().from(inventoryLots).where(and(
      eq(inventoryLots.itemId, bl.itemId), eq(inventoryLots.orgId, orgId),
      sql`${inventoryLots.reference} LIKE '%' || ${lc.billId ? lc.billId : ''}`
    )).orderBy(asc(inventoryLots.receivedDate));

    const lotId = lots[0]?.id || null;

    await db.insert(landedCostAllocations).values({
      landedCostId, itemId: bl.itemId, billLineId: bl.id,
      lotId, allocatedAmount: allocAmount,
    });

    // Update lot cost per unit
    if (lotId && Number(lots[0]?.quantity) > 0) {
      const lot = lots[0];
      const newCpu = lot.costPerUnit + Math.round(allocAmount / Number(lot.quantity));
      await db.update(inventoryLots).set({ costPerUnit: newCpu }).where(eq(inventoryLots.id, lotId));
    }
  }

  await db.update(landedCosts).set({ status: 'allocated' }).where(eq(landedCosts.id, landedCostId));

  // Post GL: DR Inventory, CR the expense account
  const inventoryAcc = (await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'inventory'))).limit(1))[0];
  const purchAcc = (await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, '700300'))).limit(1))[0]; // Import Duties
  if (inventoryAcc && purchAcc) {
    await postToGL({
      orgId, date: new Date(), description: `Landed cost allocation - ${lc.reference}`,
      source: INV_SOURCE, createdBy: userId,
      lines: [
        { accountId: inventoryAcc.id, debit: totalAmount, credit: 0, description: 'Landed costs capitalized' },
        { accountId: purchAcc.id, debit: 0, credit: totalAmount, description: 'Landed costs allocation' },
      ],
    });
  }

  if (reqMeta) createAuditLog({ orgId, userId, action: 'update', entityType: 'landed-cost', entityId: landedCostId, newValues: { status: 'allocated' }, ...reqMeta });
  return lc;
}

export async function getLandedCosts(orgId: string) {
  return db.select().from(landedCosts).where(eq(landedCosts.orgId, orgId)).orderBy(desc(landedCosts.date));
}

export async function getLandedCostAllocations(orgId: string, landedCostId: string) {
  const allocs = await db.select().from(landedCostAllocations).where(eq(landedCostAllocations.landedCostId, landedCostId));
  const itemIds = [...new Set(allocs.map(a => a.itemId))];
  const itemMap = itemIds.length > 0 ? new Map((await db.select().from(items).where(sql`${items.id} = ANY(${itemIds}::uuid[])`)).map(i => [i.id, i])) : new Map();
  return allocs.map(a => ({ ...a, item: itemMap.get(a.itemId) || null }));
}

// ==============================
// VALUATION REPORTS
// ==============================

export async function getInventoryValuation(orgId: string, asOfDate?: string): Promise<any[]> {
  const allItems = await db.select().from(items).where(and(eq(items.orgId, orgId), eq(items.trackInventory, true))).orderBy(asc(items.name));

  const result: any[] = [];
  for (const item of allItems) {
    const lots = await db.select().from(inventoryLots)
      .where(and(eq(inventoryLots.itemId, item.id), eq(inventoryLots.orgId, orgId), sql`CAST(${inventoryLots.quantity} AS numeric) > 0`))
      .orderBy(asc(inventoryLots.receivedDate));

    const totalQty = lots.reduce((s, l) => s + Number(l.quantity), 0);
    const totalValue = lots.reduce((s, l) => s + Number(l.quantity) * l.costPerUnit, 0);
    const avgCost = totalQty > 0 ? Math.round(totalValue / totalQty) : 0;

    // Get transactions in period
    let txnFilter = and(eq(inventoryTransactions.itemId, item.id), eq(inventoryTransactions.orgId, orgId));
    if (asOfDate) txnFilter = and(txnFilter, lte(inventoryTransactions.date, new Date(asOfDate)));
    const txns = await db.select().from(inventoryTransactions).where(txnFilter).orderBy(asc(inventoryTransactions.date));

    result.push({
      itemId: item.id, itemName: item.name, sku: item.sku,
      costingMethod: item.costingMethod, unit: item.unit,
      totalQuantity: totalQty, totalValue, averageCost: avgCost,
      lots: lots.map(l => ({ id: l.id, quantity: Number(l.quantity), costPerUnit: l.costPerUnit, receivedDate: l.receivedDate, reference: l.reference })),
      transactions: txns.map(t => ({ id: t.id, date: t.date, type: t.type, quantity: Number(t.quantity), unitCost: t.unitCost, referenceType: t.referenceType })),
    });
  }
  return result;
}

export async function getInventoryAging(orgId: string): Promise<any[]> {
  const allItems = await db.select().from(items).where(and(eq(items.orgId, orgId), eq(items.trackInventory, true))).orderBy(asc(items.name));
  const now = new Date();

  const result: any[] = [];
  for (const item of allItems) {
    const lots = await db.select().from(inventoryLots)
      .where(and(eq(inventoryLots.itemId, item.id), eq(inventoryLots.orgId, orgId), sql`CAST(${inventoryLots.quantity} AS numeric) > 0`))
      .orderBy(asc(inventoryLots.receivedDate));

    const buckets = { '0-30': { qty: 0, value: 0 }, '31-60': { qty: 0, value: 0 }, '61-90': { qty: 0, value: 0 }, '90+': { qty: 0, value: 0 } };
    for (const lot of lots) {
      const daysOld = Math.floor((now.getTime() - lot.receivedDate.getTime()) / 86400000);
      const qty = Number(lot.quantity);
      const val = qty * lot.costPerUnit;
      if (daysOld <= 30) { buckets['0-30'].qty += qty; buckets['0-30'].value += val; }
      else if (daysOld <= 60) { buckets['31-60'].qty += qty; buckets['31-60'].value += val; }
      else if (daysOld <= 90) { buckets['61-90'].qty += qty; buckets['61-90'].value += val; }
      else { buckets['90+'].qty += qty; buckets['90+'].value += val; }
    }

    result.push({
      itemId: item.id, itemName: item.name, sku: item.sku,
      buckets, totalQty: Object.values(buckets).reduce((s, b) => s + b.qty, 0),
      totalValue: Object.values(buckets).reduce((s, b) => s + b.value, 0),
    });
  }
  return result;
}

export async function getInventoryTurnover(orgId: string, fromDate: string, toDate: string): Promise<any> {
  const allItems = await db.select().from(items).where(and(eq(items.orgId, orgId), eq(items.trackInventory, true))).orderBy(asc(items.name));

  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);

  // Opening inventory value
  const openingTxns = await db.select().from(inventoryTransactions)
    .where(and(eq(inventoryTransactions.orgId, orgId), lte(inventoryTransactions.date, startDate)));
  const openingValue = openingTxns.reduce((s, t) => {
    const qty = Number(t.quantity);
    const cost = t.unitCost || 0;
    return s + (qty > 0 ? qty * cost : 0);
  }, 0);

  // Closing inventory value
  const closingTxns = await db.select().from(inventoryTransactions)
    .where(and(eq(inventoryTransactions.orgId, orgId), lte(inventoryTransactions.date, endDate)));
  const closingValue = closingTxns.reduce((s, t) => {
    const qty = Number(t.quantity);
    const cost = t.unitCost || 0;
    return s + (qty > 0 ? qty * cost : 0);
  }, 0);

  // COGS in period (sales transactions)
  const salesTxns = await db.select().from(inventoryTransactions)
    .where(and(eq(inventoryTransactions.orgId, orgId), eq(inventoryTransactions.type, 'sale'),
      gte(inventoryTransactions.date, startDate), lte(inventoryTransactions.date, endDate)));
  const cogs = salesTxns.reduce((s, t) => s + (Number(t.quantity) * (t.unitCost || 0)), 0);

  const avgInventory = (openingValue + closingValue) / 2;
  const turnover = avgInventory > 0 ? cogs / avgInventory : 0;

  return { openingValue, closingValue, cogs, averageInventory: avgInventory, turnoverRatio: turnover, daysInInventory: turnover > 0 ? 365 / turnover : 0 };
}

export async function getStockStatusSummary(orgId: string): Promise<any> {
  const allItems = await db.select().from(items).where(and(eq(items.orgId, orgId), eq(items.trackInventory, true))).orderBy(asc(items.name));

  const result: any[] = [];
  for (const item of allItems) {
    const lots = await db.select().from(inventoryLots)
      .where(and(eq(inventoryLots.itemId, item.id), eq(inventoryLots.orgId, orgId), sql`CAST(${inventoryLots.quantity} AS numeric) > 0`));
    const totalQty = lots.reduce((s, l) => s + Number(l.quantity), 0);
    const totalValue = lots.reduce((s, l) => s + Number(l.quantity) * l.costPerUnit, 0);
    const reorderPoint = item.reorderPoint || 0;
    const minStock = item.minStockLevel || 0;
    const maxStock = item.maxStockLevel || 0;
    const reorderQty = item.reorderQuantity || 0;

    result.push({
      itemId: item.id, itemName: item.name, sku: item.sku, unit: item.unit,
      location: item.location, costingMethod: item.costingMethod,
      onHand: totalQty, onHandValue: totalValue,
      reorderPoint, minStockLevel: minStock, maxStockLevel: maxStock, reorderQuantity: reorderQty,
      status: totalQty <= 0 ? 'out_of_stock' : totalQty <= reorderPoint ? 'low_stock' : totalQty >= maxStock ? 'overstocked' : 'in_stock',
      averageCost: totalQty > 0 ? Math.round(totalValue / totalQty) : 0,
    });
  }
  return result;
}
