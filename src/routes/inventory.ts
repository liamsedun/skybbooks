/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response } from 'express';
import { db, items } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq } from 'drizzle-orm';

const router = Router();

// Get inventory items
router.get('/items', authenticate, requireOrg, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db.select().from(items).where(eq(items.orgId, orgId));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create inventory item
router.post('/items', authenticate, requireOrg, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.orgId!;
    const { name, sku, type, description, salesPrice, purchasePrice, trackInventory } = req.body;
    
    const newItem = await db.insert(items).values({
      orgId,
      name,
      sku: sku || `SKU-${Date.now()}`,
      type: (type === 'service' ? 'service' : 'product'),
      description: description || '',
      salesPrice: salesPrice || 0,
      purchasePrice: purchasePrice || 0,
      trackInventory: trackInventory || false
    }).returning();
    
    res.status(201).json(newItem[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
