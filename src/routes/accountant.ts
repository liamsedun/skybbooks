/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, accounts } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { seedAccounts } from '../db/seedAccounts';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const accountSchema = z.object({
  code: z.string().min(1, 'Account code is required.'),
  name: z.string().min(1, 'Account name is required.'),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  subType: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET /api/accountant/accounts
router.get('/accounts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(accounts)
      .where(eq(accounts.orgId, orgId))
      .orderBy(accounts.code);
    return res.status(200).json(list);
  } catch (err) {
    return next(err);
  }
});

// POST /api/accountant/accounts
router.post('/accounts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = accountSchema.parse(req.body);

    const [account] = await db
      .insert(accounts)
      .values({ ...body, orgId, isSystem: false, isActive: body.isActive ?? true })
      .returning();

    return res.status(201).json(account);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// PATCH /api/accountant/accounts/:id
router.patch('/accounts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = accountSchema.partial().parse(req.body);

    const [account] = await db
      .update(accounts)
      .set(body)
      .where(and(eq(accounts.id, id), eq(accounts.orgId, orgId)))
      .returning();

    if (!account) throw new AppError('Account not found.', 404);
    return res.status(200).json(account);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// POST /api/accountant/accounts/seed — Load Nigerian COA template
router.post('/accounts/seed', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const result = await seedAccounts(orgId);
    return res.status(result.seeded > 0 ? 201 : 200).json(result);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/accountant/accounts/:id
router.delete('/accounts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    // Prevent deletion of system accounts
    const [existing] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.orgId, orgId)))
      .limit(1);

    if (!existing) throw new AppError('Account not found.', 404);
    if (existing.isSystem) throw new AppError('System accounts cannot be deleted.', 403);

    await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.orgId, orgId)));
    return res.status(200).json({ message: 'Account deleted.' });
  } catch (err) {
    return next(err);
  }
});

export default router;

