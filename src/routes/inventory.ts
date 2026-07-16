/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { db, items, inventoryLots, inventoryTransactions, inventoryAdjustments, inventoryAdjustmentItems, accounts, documents, users, bills, invoices } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, lte, sql, inArray, desc } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { createJournalEntry } from '../services/ledger.service';
import { postToGL } from '../services/posting.service';
import { createAuditLog, extractReqMeta } from '../services/audit.service';

// Helper: auto-create opening stock lot when item has trackInventory + purchasePrice + numeric unit
async function autoCreateOpeningStock(item: any, orgId: string, userId: string) {
  if (!item.trackInventory || !item.inventoryAccountId) return;
  const purchasePrice = item.purchasePrice || 0;
  if (purchasePrice <= 0) return;
  const qty = parseInt(item.unit, 10);
  if (isNaN(qty) || qty <= 0) return;
  // Only auto-create if no lots already exist for this item
  const [existing] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryLots)
    .where(eq(inventoryLots.itemId, item.id));
  if (Number(existing?.count || 0) > 0) return;

  const totalValue = qty * purchasePrice;

  const [lot] = await db
    .insert(inventoryLots)
    .values({
      itemId: item.id,
      orgId,
      quantity: String(qty),
      costPerUnit: purchasePrice,
      receivedDate: new Date(),
      reference: 'Opening Stock'
    })
    .returning();

  await db.insert(inventoryTransactions).values({
    itemId: item.id,
    orgId,
    lotId: lot.id,
    type: 'purchase',
    quantity: String(qty),
    unitCost: purchasePrice,
    referenceType: 'opening_stock',
    referenceId: lot.id,
    date: new Date()
  });

  // Post journal entry: DR Inventory, CR Retained Earnings
  const [reAcct] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'retained_earnings')))
    .limit(1);
  if (reAcct) {
    await postToGL({
      orgId,
      date: new Date(),
      description: `Opening stock — ${item.name} (${qty} units @ ₦${(purchasePrice / 100).toLocaleString()})`,
      reference: 'Opening Stock',
      source: 'opening_stock',
      sourceId: lot.id,
      createdBy: userId,
      lines: [
        { accountId: item.inventoryAccountId, debit: totalValue, description: `Opening stock — ${item.name}` },
        { accountId: reAcct.id, credit: totalValue, description: `Opening stock offset — ${item.name}` }
      ]
    });
  }
}

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const itemSchema = z.object({
  sku: z.string().optional().nullable(),
  name: z.string().min(1, 'Item name is required.'),
  description: z.string().optional().nullable(),
  type: z.enum(['product', 'service']),
  unit: z.string().optional().nullable(),
  salesPrice: z.number().optional().nullable(),
  purchasePrice: z.number().optional().nullable(),
  salesAccountId: z.string().uuid().optional().nullable(),
  purchaseAccountId: z.string().uuid().optional().nullable(),
  inventoryAccountId: z.string().uuid().optional().nullable(),
  trackInventory: z.boolean().optional(),
  reorderPoint: z.number().int().optional().nullable(),
});

// GET /api/inventory/items
router.get('/items', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(items)
      .where(eq(items.orgId, orgId))
      .orderBy(items.name);

    const stockRows = await db
      .select({
        itemId: inventoryLots.itemId,
        total: sql<number>`coalesce(sum(${inventoryLots.quantity}::numeric), 0)`
      })
      .from(inventoryLots)
      .where(eq(inventoryLots.orgId, orgId))
      .groupBy(inventoryLots.itemId);

    const stockMap = new Map(stockRows.map(r => [r.itemId, r.total]));

    const listWithStock = list.map(item => ({
      ...item,
      stockOnHand: stockMap.get(item.id) || 0
    }));

    return res.status(200).json(listWithStock);
  } catch (err) {
    return next(err);
  }
});

// POST /api/inventory/items
router.post('/items', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const body = itemSchema.parse(req.body);
    const sku = body.sku?.trim() || `SKU-${Date.now()}`;

    const [newItem] = await db
      .insert(items)
      .values({
        orgId,
        sku,
        name: body.name,
        description: body.description || null,
        type: body.type,
        unit: body.unit || null,
        salesPrice: body.salesPrice ?? null,
        purchasePrice: body.purchasePrice ?? null,
        salesAccountId: body.salesAccountId || null,
        purchaseAccountId: body.purchaseAccountId || null,
        inventoryAccountId: body.inventoryAccountId || null,
        trackInventory: body.trackInventory ?? false,
        reorderPoint: body.reorderPoint ?? null,
      })
      .returning();

    // Auto-create opening stock if conditions are met
    await autoCreateOpeningStock(newItem, orgId, userId);

    await createAuditLog({ orgId, userId, action: 'create', entityType: 'item', entityId: newItem.id, newValues: { name: body.name, sku: body.sku }, ...extractReqMeta(req) });

    return res.status(201).json(newItem);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// PATCH /api/inventory/items/:id
router.patch('/items/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { id } = req.params;
    const body = itemSchema.partial().parse(req.body);

    const updatePayload: Record<string, unknown> = { ...body };
    if (body.sku !== undefined) {
      updatePayload.sku = body.sku?.trim() || undefined;
    }

    const [updated] = await db
      .update(items)
      .set(updatePayload)
      .where(and(eq(items.id, id), eq(items.orgId, orgId)))
      .returning();

    if (!updated) throw new AppError('Item not found.', 404);

    // Auto-create opening stock if conditions are now met
    await autoCreateOpeningStock(updated, orgId, userId);

    await createAuditLog({ orgId, userId, action: 'update', entityType: 'item', entityId: id, newValues: body, ...extractReqMeta(req) });

    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// DELETE /api/inventory/items/:id
router.delete('/items/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(items)
      .where(and(eq(items.id, id), eq(items.orgId, orgId)))
      .limit(1);

    if (!existing) throw new AppError('Item not found.', 404);

    try {
      await db.delete(items).where(eq(items.id, id));
    } catch (dbErr: any) {
      if (dbErr.code === '23503') {
        throw new AppError('This item is used on existing invoices or bills and cannot be deleted.', 400);
      }
      throw dbErr;
    }

    await createAuditLog({ orgId, userId, action: 'delete', entityType: 'item', entityId: id, ...extractReqMeta(req) });

    return res.status(200).json({ message: 'Item deleted.' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/inventory/items/import-opening-stock — single row from CSV import
router.post('/items/import-opening-stock', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { itemName, quantity, unitCost } = req.body;
    if (!itemName) throw new AppError('itemName is required.', 400);

    const [item] = await db
      .select()
      .from(items)
      .where(and(eq(items.orgId, orgId), eq(items.name, itemName)))
      .limit(1);

    if (!item) throw new AppError(`Item "${itemName}" not found.`, 404);

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) throw new AppError('Invalid quantity.', 400);
    const cost = unitCost ? Math.round(parseFloat(unitCost) * 100) : (item.purchasePrice || 0);
    const totalValue = qty * cost;

    const [lot] = await db
      .insert(inventoryLots)
      .values({
        itemId: item.id,
        orgId,
        quantity: String(qty),
        costPerUnit: cost,
        receivedDate: new Date(),
        reference: 'Opening Stock'
      })
      .returning();

    await db.insert(inventoryTransactions).values({
      itemId: item.id,
      orgId,
      lotId: lot.id,
      type: 'purchase',
      quantity: String(qty),
      unitCost: cost,
      referenceType: 'opening_stock',
      referenceId: lot.id,
      date: new Date()
    });

    // Post journal entry: DR Inventory, CR Retained Earnings
    if (item.inventoryAccountId && totalValue > 0) {
      const [reAcct] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'retained_earnings')))
        .limit(1);
      if (reAcct) {
        await postToGL({
          orgId,
          date: new Date(),
          description: `Opening stock — ${item.name} (${qty} units @ ₦${(cost / 100).toLocaleString()})`,
          reference: 'Opening Stock',
          source: 'opening_stock',
          sourceId: lot.id,
          createdBy: userId,
          lines: [
            { accountId: item.inventoryAccountId, debit: totalValue, description: `Opening stock — ${item.name}` },
            { accountId: reAcct.id, credit: totalValue, description: `Opening stock offset — ${item.name}` }
          ]
        });
      }
    }

    await createAuditLog({ orgId, userId, action: 'import', entityType: 'item', entityId: item.id, newValues: { openingStockImported: true }, ...extractReqMeta(req) });

    return res.status(201).json({ message: 'Opening stock recorded.', item: item.name });
  } catch (err) {
    return next(err);
  }
});

// POST /api/inventory/items/record-opening-stock — single item
router.post('/items/record-opening-stock', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { itemId, quantity, unitCost } = req.body;
    if (!itemId) throw new AppError('itemId is required.', 400);
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) throw new AppError('Quantity must be a positive number.', 400);

    const [item] = await db
      .select()
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.orgId, orgId)))
      .limit(1);
    if (!item) throw new AppError('Item not found.', 404);

    // Use provided unitCost or fall back to item's purchasePrice (both in kobo)
    const cost = unitCost ? Math.round(parseFloat(String(unitCost)) * 100) : (item.purchasePrice || 0);
    const totalValue = qty * cost;

    const [lot] = await db
      .insert(inventoryLots)
      .values({
        itemId,
        orgId,
        quantity: String(qty),
        costPerUnit: cost,
        receivedDate: new Date(),
        reference: 'Opening Stock'
      })
      .returning();

    await db.insert(inventoryTransactions).values({
      itemId,
      orgId,
      lotId: lot.id,
      type: 'purchase',
      quantity: String(qty),
      unitCost: cost,
      referenceType: 'opening_stock',
      referenceId: lot.id,
      date: new Date()
    });

    // Post journal entry: DR inventory asset account, CR retained earnings
    if (item.inventoryAccountId && totalValue > 0) {
      const [reAcct] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'retained_earnings')))
        .limit(1);
      if (reAcct) {
        await postToGL({
          orgId,
          date: new Date(),
          description: `Opening stock — ${item.name} (${qty} units @ ₦${(cost / 100).toLocaleString()})`,
          reference: 'Opening Stock',
          source: 'opening_stock',
          sourceId: lot.id,
          createdBy: userId,
          lines: [
            { accountId: item.inventoryAccountId, debit: totalValue, description: `Opening stock — ${item.name}` },
            { accountId: reAcct.id, credit: totalValue, description: `Opening stock offset — ${item.name}` }
          ]
        });
      }
    }

    await createAuditLog({ orgId, userId, action: 'create', entityType: 'inventory-lot', entityId: lot.id, newValues: { itemId: body.itemId, quantity: body.quantity }, ...extractReqMeta(req) });

    return res.status(201).json({ message: 'Opening stock recorded.', lot });
  } catch (err) {
    return next(err);
  }
});

// GET /api/inventory/valuation-statement — inventory valuation statement per item
router.get('/valuation-statement', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const itemId = req.query.itemId as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const itemConditions = [eq(items.orgId, orgId), eq(items.trackInventory, true)];
    if (itemId) itemConditions.push(eq(items.id, itemId));

    const itemList = await db
      .select()
      .from(items)
      .where(and(...itemConditions))
      .orderBy(items.name);

    const result = [];

    for (const item of itemList) {
      // Fetch ALL inventory transactions for this item (immutable records)
      const txnConditions: any[] = [
        eq(inventoryTransactions.itemId, item.id),
        eq(inventoryTransactions.orgId, orgId)
      ];
      if (endDate) {
        txnConditions.push(lte(inventoryTransactions.date, new Date(endDate + 'T23:59:59.999Z')));
      }

      const txns = await db
        .select({
          id: inventoryTransactions.id,
          itemId: inventoryTransactions.itemId,
          orgId: inventoryTransactions.orgId,
          lotId: inventoryTransactions.lotId,
          type: inventoryTransactions.type,
          quantity: inventoryTransactions.quantity,
          unitCost: inventoryTransactions.unitCost,
          referenceType: inventoryTransactions.referenceType,
          referenceId: inventoryTransactions.referenceId,
          date: inventoryTransactions.date,
          createdAt: inventoryTransactions.createdAt,
          lotReference: inventoryLots.reference,
          billNumber: bills.billNumber,
          invoiceNumber: invoices.invoiceNumber,
        })
        .from(inventoryTransactions)
        .leftJoin(inventoryLots, eq(inventoryTransactions.lotId, inventoryLots.id))
        .leftJoin(bills, and(
          eq(inventoryTransactions.referenceType, 'bill'),
          eq(inventoryTransactions.referenceId, bills.id)
        ))
        .leftJoin(invoices, and(
          eq(inventoryTransactions.referenceType, 'invoice'),
          eq(inventoryTransactions.referenceId, invoices.id)
        ))
        .where(and(...txnConditions))
        .orderBy(inventoryTransactions.date, inventoryTransactions.createdAt);

      // Separate opening stock transactions (original quantities are immutable)
      const openingTxns = txns.filter(t => t.referenceType === 'opening_stock' && t.type === 'purchase');
      const otherTxns = txns.filter(t => !(t.referenceType === 'opening_stock' && t.type === 'purchase'));

      // Opening balance = sum of ALL opening stock transactions (original qty, not reduced)
      let openingQty = 0;
      let openingValue = 0;
      for (const ot of openingTxns) {
        const qty = Number(ot.quantity);
        const cost = ot.unitCost || 0;
        openingQty += qty;
        openingValue += qty * cost;
      }

      const lines: any[] = [];

      // Opening balance row (first line in ledger)
      lines.push({
        date: null,
        type: 'opening_balance',
        reference: 'Opening Balance',
        referenceId: null,
        inQty: 0,
        outQty: 0,
        unitCost: 0,
        value: 0,
        balanceQty: openingQty,
        balanceValue: openingValue
      });

      let runningQty = openingQty;
      let runningValue = openingValue;

      // Build human-readable reference for each transaction
      function txnReference(t: any): string {
        if (t.referenceType === 'opening_stock') return 'Opening Stock';
        if (t.referenceType === 'bill') return t.billNumber || t.lotReference || 'Bill Purchase';
        if (t.referenceType === 'invoice') return t.invoiceNumber || 'Invoice Sale';
        if (t.referenceType === 'inventory_adjustment') return 'Adjustment';
        return t.referenceType || t.type;
      }

      // Process all non-opening transactions chronologically
      for (const txn of otherTxns) {
        const qty = Number(txn.quantity);
        const cost = txn.unitCost || 0;
        const val = qty * cost;
        let inQty = 0;
        let outQty = 0;
        let valueChange = 0;

        if (txn.type === 'purchase' || (txn.type === 'adjustment' && qty > 0)) {
          // Inflow: increase stock at cost
          inQty = qty;
          valueChange = val;
          runningQty += qty;
          runningValue += val;
        } else if (txn.type === 'sale' || (txn.type === 'adjustment' && qty < 0)) {
          // Outflow: decrease stock at lot cost (FIFO, unitCost already reflects consumed lot's cost)
          const absQty = Math.abs(qty);
          outQty = absQty;
          valueChange = -val; // val is positive, make it negative
          runningQty -= absQty;
          runningValue -= val;
        } else {
          // Unknown type — skip
          continue;
        }

        lines.push({
          date: txn.date,
          type: txn.type,
          reference: txnReference(txn),
          referenceId: txn.referenceId,
          inQty,
          outQty,
          unitCost: cost,
          value: valueChange,
          balanceQty: runningQty,
          balanceValue: runningValue
        });
      }

      result.push({
        item: {
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          type: item.type
        },
        lines,
        openingQty,
        openingValue,
        closingQty: runningQty,
        closingValue: runningValue
      });
    }

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// =========================================================================
// INVENTORY ADJUSTMENTS
// =========================================================================

const adjustSchema = z.object({
  date: z.string().optional(),
  mode: z.enum(['quantity', 'value']),
  reference: z.string().optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  reason: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantityAvailable: z.number(),
    newQuantity: z.number(),
    currentUnitCost: z.number().optional().nullable(),
    newUnitCost: z.number().optional().nullable(),
  })),
});

// GET /api/inventory/adjustments
router.get('/adjustments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const mode = req.query.mode as string | undefined;
    const status = req.query.status as string | undefined;

    const conditions = [eq(inventoryAdjustments.orgId, orgId)];
    if (mode) conditions.push(eq(inventoryAdjustments.mode, mode as any));
    if (status) conditions.push(eq(inventoryAdjustments.status, status as any));

    const list = await db
      .select()
      .from(inventoryAdjustments)
      .where(and(...conditions))
      .orderBy(desc(inventoryAdjustments.createdAt));

    // Fetch items for each adjustment
    const ids = list.map(a => a.id);
    const allItems = ids.length > 0
      ? await db
          .select()
          .from(inventoryAdjustmentItems)
          .where(inArray(inventoryAdjustmentItems.adjustmentId, ids))
      : [];

    const itemsMap = new Map<string, typeof allItems>();
    for (const it of allItems) {
      if (!itemsMap.has(it.adjustmentId)) itemsMap.set(it.adjustmentId, []);
      itemsMap.get(it.adjustmentId)!.push(it);
    }

    const result = list.map(a => ({
      ...a,
      lineItems: itemsMap.get(a.id) || [],
    }));

    return res.status(200).json(result);
  } catch (err) { return next(err); }
});

// GET /api/inventory/adjustments/:id
router.get('/adjustments/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [adj] = await db
      .select()
      .from(inventoryAdjustments)
      .where(and(eq(inventoryAdjustments.id, id), eq(inventoryAdjustments.orgId, orgId)))
      .limit(1);
    if (!adj) throw new AppError('Adjustment not found.', 404);

    const lineItems = await db
      .select()
      .from(inventoryAdjustmentItems)
      .where(eq(inventoryAdjustmentItems.adjustmentId, id));

    const files = await db
      .select()
      .from(documents)
      .where(and(eq(documents.referenceType, 'inventory_adjustment'), eq(documents.referenceId, id)));

    return res.status(200).json({ ...adj, lineItems, files });
  } catch (err) { return next(err); }
});

// POST /api/inventory/adjustments
router.post('/adjustments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const body = adjustSchema.parse(req.body);

    // Generate reference number (use custom if provided)
    let ref = body.reference?.trim();
    if (!ref) {
      const count = await db
        .select({ c: sql<number>`count(*)` })
        .from(inventoryAdjustments)
        .where(eq(inventoryAdjustments.orgId, orgId));
      ref = `ADJ-${String(Number(count[0]?.c || 0) + 1).padStart(4, '0')}`;
    }

    // Calculate adjusted quantities
    const itemsWithAdj = body.items.map(it => ({
      ...it,
      quantityAdjusted: it.newQuantity - it.quantityAvailable,
    }));

    const [adj] = await db
      .insert(inventoryAdjustments)
      .values({
        orgId,
        reference: ref,
        date: body.date ? new Date(body.date) : new Date(),
        mode: body.mode,
        accountId: body.accountId || null,
        reason: body.reason || null,
        location: body.location || null,
        description: body.description || null,
        status: 'draft',
        createdBy: userId,
      })
      .returning();

    for (const it of itemsWithAdj) {
      await db.insert(inventoryAdjustmentItems).values({
        adjustmentId: adj.id,
        itemId: it.itemId,
        quantityAvailable: String(it.quantityAvailable),
        newQuantity: String(it.newQuantity),
        quantityAdjusted: String(it.quantityAdjusted),
        currentUnitCost: it.currentUnitCost ?? null,
        newUnitCost: it.newUnitCost ?? null,
      });
    }

    const lineItems = await db
      .select()
      .from(inventoryAdjustmentItems)
      .where(eq(inventoryAdjustmentItems.adjustmentId, adj.id));

    await createAuditLog({ orgId, userId, action: 'create', entityType: 'inventory-adjustment', entityId: adj.id, newValues: { reference: adj.reference }, ...extractReqMeta(req) });

    return res.status(201).json({ ...adj, lineItems });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

// Helper: apply quantity adjustment to inventory
async function applyQuantityAdjustment(adj: any, items: any[], orgId: string, userId: string) {
  for (const it of items) {
    const qtyAdj = Number(it.quantityAdjusted);
    if (qtyAdj === 0) continue;

    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.id, it.itemId))
      .limit(1);
    if (!item || !item.trackInventory || !item.inventoryAccountId) continue;

    if (qtyAdj > 0) {
      // Increase: add to most recent lot or create new
      const [recentLot] = await db
        .select()
        .from(inventoryLots)
        .where(and(eq(inventoryLots.itemId, it.itemId), eq(inventoryLots.orgId, orgId)))
        .orderBy(desc(inventoryLots.receivedDate))
        .limit(1);

      if (recentLot) {
        await db
          .update(inventoryLots)
          .set({ quantity: sql`${inventoryLots.quantity}::numeric + ${qtyAdj}` })
          .where(eq(inventoryLots.id, recentLot.id));
      } else {
        await db.insert(inventoryLots).values({
          itemId: it.itemId,
          orgId,
          quantity: String(qtyAdj),
          costPerUnit: it.currentUnitCost || 0,
          receivedDate: adj.date,
          reference: `Adjustment ${adj.reference}`,
        });
      }
    } else {
      // Decrease: consume from lots FIFO
      const lots = await db
        .select()
        .from(inventoryLots)
        .where(and(eq(inventoryLots.itemId, it.itemId), eq(inventoryLots.orgId, orgId)))
        .orderBy(inventoryLots.receivedDate);

      let remaining = Math.abs(qtyAdj);
      for (const lot of lots) {
        if (remaining <= 0) break;
        const lotQty = Number(lot.quantity);
        if (lotQty <= 0) continue;
        const toRemove = Math.min(lotQty, remaining);
        remaining -= toRemove;
        const newQty = lotQty - toRemove;
        if (newQty <= 0) {
          await db.delete(inventoryLots).where(eq(inventoryLots.id, lot.id));
        } else {
          await db
            .update(inventoryLots)
            .set({ quantity: String(newQty) })
            .where(eq(inventoryLots.id, lot.id));
        }
      }
    }

    // Record transaction
    const cost = it.currentUnitCost || 0;
    await db.insert(inventoryTransactions).values({
      itemId: it.itemId,
      orgId,
      type: 'adjustment',
      quantity: String(qtyAdj),
      unitCost: cost,
      referenceType: 'inventory_adjustment',
      referenceId: adj.id,
      date: adj.date,
    });

    // Journal entry
    const valueChange = Math.round(qtyAdj * cost);
    if (valueChange !== 0 && adj.accountId) {
      if (valueChange > 0) {
        await postToGL({
          orgId,
          date: adj.date,
          description: `Inventory adjustment (qty) — ${item.name} (${qtyAdj > 0 ? '+' : ''}${qtyAdj})`,
          reference: adj.reference,
          source: 'inventory_adjustment',
          sourceId: adj.id,
          createdBy: userId,
          lines: [
            { accountId: item.inventoryAccountId, debit: valueChange, description: `Inventory adj — ${item.name}` },
            { accountId: adj.accountId, credit: valueChange, description: `Inventory adj offset — ${item.name}` },
          ],
        });
      } else {
        const absVal = Math.abs(valueChange);
        await postToGL({
          orgId,
          date: adj.date,
          description: `Inventory adjustment (qty) — ${item.name} (${qtyAdj})`,
          reference: adj.reference,
          source: 'inventory_adjustment',
          sourceId: adj.id,
          createdBy: userId,
          lines: [
            { accountId: adj.accountId, debit: absVal, description: `Inventory adj loss — ${item.name}` },
            { accountId: item.inventoryAccountId, credit: absVal, description: `Inventory adj — ${item.name}` },
          ],
        });
      }
    }
  }
}

// Helper: apply value adjustment to inventory
async function applyValueAdjustment(adj: any, items: any[], orgId: string, userId: string) {
  for (const it of items) {
    const oldCost = it.currentUnitCost || 0;
    const newCost = it.newUnitCost ?? oldCost;
    if (newCost === oldCost) continue;

    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.id, it.itemId))
      .limit(1);
    if (!item || !item.trackInventory || !item.inventoryAccountId) continue;

    // Update cost per unit on all active lots for this item
    await db
      .update(inventoryLots)
      .set({ costPerUnit: newCost })
      .where(and(eq(inventoryLots.itemId, it.itemId), eq(inventoryLots.orgId, orgId)));

    const qty = Number(it.newQuantity || it.quantityAvailable || 0);
    const valueDiff = qty * (newCost - oldCost);

    // Record transaction with value change
    await db.insert(inventoryTransactions).values({
      itemId: it.itemId,
      orgId,
      type: 'adjustment',
      quantity: '0',
      unitCost: valueDiff,
      referenceType: 'inventory_adjustment',
      referenceId: adj.id,
      date: adj.date,
    });

    // Journal entry for value change
    if (valueDiff !== 0 && adj.accountId) {
      if (valueDiff > 0) {
        await postToGL({
          orgId,
          date: adj.date,
          description: `Inventory value adjustment — ${item.name} (${(oldCost / 100).toLocaleString()} → ${(newCost / 100).toLocaleString()})`,
          reference: adj.reference,
          source: 'inventory_adjustment',
          sourceId: adj.id,
          createdBy: userId,
          lines: [
            { accountId: item.inventoryAccountId, debit: valueDiff, description: `Value adj — ${item.name}` },
            { accountId: adj.accountId, credit: valueDiff, description: `Value adj offset — ${item.name}` },
          ],
        });
      } else {
        const absVal = Math.abs(valueDiff);
        await postToGL({
          orgId,
          date: adj.date,
          description: `Inventory value adjustment — ${item.name} (${(oldCost / 100).toLocaleString()} → ${(newCost / 100).toLocaleString()})`,
          reference: adj.reference,
          source: 'inventory_adjustment',
          sourceId: adj.id,
          createdBy: userId,
          lines: [
            { accountId: adj.accountId, debit: absVal, description: `Value adj loss — ${item.name}` },
            { accountId: item.inventoryAccountId, credit: absVal, description: `Value adj — ${item.name}` },
          ],
        });
      }
    }
  }
}

// PATCH /api/inventory/adjustments/:id — update draft
router.patch('/adjustments/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { id } = req.params;
    const body = req.body;

    const [existing] = await db
      .select()
      .from(inventoryAdjustments)
      .where(and(eq(inventoryAdjustments.id, id), eq(inventoryAdjustments.orgId, orgId)))
      .limit(1);
    if (!existing) throw new AppError('Adjustment not found.', 404);
    if (existing.status !== 'draft') throw new AppError('Only draft adjustments can be edited.', 400);

    await db
      .update(inventoryAdjustments)
      .set({
        date: body.date ? new Date(body.date) : undefined,
        mode: body.mode,
        accountId: body.accountId ?? undefined,
        reason: body.reason ?? undefined,
        location: body.location ?? undefined,
        description: body.description ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(inventoryAdjustments.id, id));

    // Replace line items
    if (body.items) {
      await db.delete(inventoryAdjustmentItems).where(eq(inventoryAdjustmentItems.adjustmentId, id));
      for (const it of body.items) {
        await db.insert(inventoryAdjustmentItems).values({
          adjustmentId: id,
          itemId: it.itemId,
          quantityAvailable: String(it.quantityAvailable),
          newQuantity: String(it.newQuantity),
          quantityAdjusted: String(it.newQuantity - it.quantityAvailable),
          currentUnitCost: it.currentUnitCost ?? null,
          newUnitCost: it.newUnitCost ?? null,
        });
      }
    }

    const [updated] = await db
      .select()
      .from(inventoryAdjustments)
      .where(eq(inventoryAdjustments.id, id))
      .limit(1);

    const lineItems = await db
      .select()
      .from(inventoryAdjustmentItems)
      .where(eq(inventoryAdjustmentItems.adjustmentId, id));

    await createAuditLog({ orgId, userId, action: 'update', entityType: 'inventory-adjustment', entityId: id, newValues: body, ...extractReqMeta(req) });

    return res.status(200).json({ ...updated, lineItems });
  } catch (err) { return next(err); }
});

// POST /api/inventory/adjustments/:id/adjust — convert draft to adjusted
router.post('/adjustments/:id/adjust', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { id } = req.params;

    const [adj] = await db
      .select()
      .from(inventoryAdjustments)
      .where(and(eq(inventoryAdjustments.id, id), eq(inventoryAdjustments.orgId, orgId)))
      .limit(1);
    if (!adj) throw new AppError('Adjustment not found.', 404);
    if (adj.status !== 'draft') throw new AppError('Adjustment has already been applied.', 400);

    const lineItems = await db
      .select()
      .from(inventoryAdjustmentItems)
      .where(eq(inventoryAdjustmentItems.adjustmentId, id));

    if (adj.mode === 'quantity') {
      await applyQuantityAdjustment(adj, lineItems, orgId, userId);
    } else {
      await applyValueAdjustment(adj, lineItems, orgId, userId);
    }

    await db
      .update(inventoryAdjustments)
      .set({ status: 'adjusted', updatedAt: new Date() })
      .where(eq(inventoryAdjustments.id, id));

    const [updated] = await db
      .select()
      .from(inventoryAdjustments)
      .where(eq(inventoryAdjustments.id, id))
      .limit(1);

    await createAuditLog({ orgId, userId, action: 'adjust', entityType: 'inventory-adjustment', entityId: id, newValues: { status: 'adjusted' }, ...extractReqMeta(req) });

    return res.status(200).json({ ...updated, lineItems });
  } catch (err) { return next(err); }
});

// DELETE /api/inventory/adjustments/:id
router.delete('/adjustments/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(inventoryAdjustments)
      .where(and(eq(inventoryAdjustments.id, id), eq(inventoryAdjustments.orgId, orgId)))
      .limit(1);
    if (!existing) throw new AppError('Adjustment not found.', 404);
    if (existing.status !== 'draft') throw new AppError('Only draft adjustments can be deleted.', 400);

    await db.delete(inventoryAdjustmentItems).where(eq(inventoryAdjustmentItems.adjustmentId, id));
    await db.delete(inventoryAdjustments).where(eq(inventoryAdjustments.id, id));

    await createAuditLog({ orgId, userId, action: 'delete', entityType: 'inventory-adjustment', entityId: id, ...extractReqMeta(req) });

    return res.status(200).json({ message: 'Adjustment deleted.' });
  } catch (err) { return next(err); }
});

// POST /api/inventory/adjustments/:id/upload — file upload for adjustment
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 5 } });
router.post('/adjustments/:id/upload', upload.array('files', 5), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { id } = req.params;

    const [adj] = await db
      .select()
      .from(inventoryAdjustments)
      .where(and(eq(inventoryAdjustments.id, id), eq(inventoryAdjustments.orgId, orgId)))
      .limit(1);
    if (!adj) throw new AppError('Adjustment not found.', 404);

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) throw new AppError('No files uploaded.', 400);

    const results: any[] = [];
    for (const file of files) {
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'auto', folder: `inventory_adjustments/${orgId}` },
          (err, result) => { if (err) reject(err); else resolve(result); }
        );
        stream.end(file.buffer);
      });

      const [doc] = await db
        .insert(documents)
        .values({
          orgId,
          name: file.originalname,
          fileUrl: uploadResult.secure_url,
          fileType: file.mimetype,
          fileSize: file.size,
          referenceType: 'inventory_adjustment',
          referenceId: id,
          uploadedBy: userId,
        })
        .returning();

      results.push(doc);
    }

    await createAuditLog({ orgId, userId, action: 'upload', entityType: 'inventory-adjustment', entityId: id, newValues: { filesUploaded: true }, ...extractReqMeta(req) });

    return res.status(201).json({ files: results });
  } catch (err) { return next(err); }
});

export default router;
