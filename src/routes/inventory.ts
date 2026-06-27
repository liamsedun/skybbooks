/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, items, inventoryLots, inventoryTransactions } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';

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

    return res.status(200).json({ message: 'Item deleted.' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/inventory/items/import-opening-stock — single row from CSV import
router.post('/items/import-opening-stock', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
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
    const cost = unitCost ? Math.round(parseFloat(unitCost) * 100) : 0;

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

    return res.status(201).json({ message: 'Opening stock recorded.', item: item.name });
  } catch (err) {
    return next(err);
  }
});

// POST /api/inventory/items/record-opening-stock — single item
router.post('/items/record-opening-stock', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { itemId, quantity, unitCost } = req.body;
    if (!itemId) throw new AppError('itemId is required.', 400);
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) throw new AppError('Quantity must be a positive number.', 400);
    const cost = Math.round(parseFloat(unitCost || '0') * 100);

    const [item] = await db
      .select()
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.orgId, orgId)))
      .limit(1);
    if (!item) throw new AppError('Item not found.', 404);

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

    const itemConditions = [eq(items.orgId, orgId), eq(items.trackInventory, true)];
    if (itemId) itemConditions.push(eq(items.id, itemId));

    const itemList = await db
      .select()
      .from(items)
      .where(and(...itemConditions))
      .orderBy(items.name);

    const result = [];

    for (const item of itemList) {
      // Fetch all lots for this item
      const lots = await db
        .select()
        .from(inventoryLots)
        .where(and(eq(inventoryLots.itemId, item.id), eq(inventoryLots.orgId, orgId)))
        .orderBy(inventoryLots.receivedDate);

      // Build ledger: opening stock lots → bill purchase lots
      const lines: any[] = [];
      let openingQty = 0;
      let openingValue = 0;

      // Separate lots into opening stock vs bill purchases
      const openingLots = lots.filter(l => (l.reference || '').toLowerCase() === 'opening stock');
      const purchaseLots = lots.filter(l => (l.reference || '').toLowerCase() !== 'opening stock');

      // Opening balance from opening stock lots only
      for (const lot of openingLots) {
        openingQty += Number(lot.quantity);
        openingValue += Number(lot.quantity) * (lot.costPerUnit || 0);
      }

      // Opening balance row
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

      // Purchase lots (from bill approvals) as individual purchase lines
      for (const lot of purchaseLots) {
        const qty = Number(lot.quantity);
        const cost = lot.costPerUnit || 0;
        const val = qty * cost;
        runningQty += qty;
        runningValue += val;
        lines.push({
          date: lot.receivedDate,
          type: 'purchase',
          reference: lot.reference || 'Bill Purchase',
          referenceId: lot.id,
          inQty: qty,
          outQty: 0,
          unitCost: cost,
          value: val,
          balanceQty: runningQty,
          balanceValue: runningValue
        });
      }

      // Sort purchase lines chronologically (opening_balance stays first)
      const sortedLines = [
        lines[0],
        ...lines.slice(1).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      ];

      // Recompute running balances after sort
      runningQty = openingQty;
      runningValue = openingValue;
      for (let i = 1; i < sortedLines.length; i++) {
        const l = sortedLines[i];
        const qtyChange = l.inQty - l.outQty;
        runningQty += qtyChange;
        runningValue += qtyChange * l.unitCost;
        sortedLines[i] = { ...l, balanceQty: runningQty, balanceValue: runningValue };
      }

      result.push({
        item: {
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          type: item.type
        },
        lines: sortedLines,
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

export default router;
