/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, items } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and } from 'drizzle-orm';
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
    return res.status(200).json(list);
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

export default router;
