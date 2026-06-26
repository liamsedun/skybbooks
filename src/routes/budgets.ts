import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, budgets, budgetLines, accounts } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, desc } from 'drizzle-orm';
import { AppError } from '../lib/errors';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const budgetLineSchema = z.object({
  accountId: z.string().uuid(),
  period: z.number().int().min(1).max(12),
  amount: z.number().int(),
});

const budgetSchema = z.object({
  name: z.string().min(1),
  fiscalYear: z.number().int(),
  period: z.enum(['monthly', 'quarterly', 'annual']),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  lines: z.array(budgetLineSchema).optional(),
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(budgets)
      .where(eq(budgets.orgId, orgId))
      .orderBy(desc(budgets.createdAt));
    return res.status(200).json(list);
  } catch (err) { return next(err); }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [budget] = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.orgId, orgId)))
      .limit(1);
    if (!budget) throw new AppError('Budget not found.', 404);
    const lines = await db
      .select()
      .from(budgetLines)
      .where(eq(budgetLines.budgetId, id));
    return res.status(200).json({ ...budget, lines });
  } catch (err) { return next(err); }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.id!;
    const body = budgetSchema.parse(req.body);

    const [budget] = await db
      .insert(budgets)
      .values({
        orgId,
        name: body.name,
        fiscalYear: body.fiscalYear,
        period: body.period,
        status: body.status || 'draft',
        createdBy: userId,
      })
      .returning();

    if (body.lines && body.lines.length > 0) {
      await db.insert(budgetLines).values(
        body.lines.map(l => ({
          budgetId: budget.id,
          accountId: l.accountId,
          period: l.period,
          amount: l.amount,
        }))
      );
    }

    const lines = body.lines || [];
    return res.status(201).json({ ...budget, lines });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = budgetSchema.partial().parse(req.body);

    const [budget] = await db
      .update(budgets)
      .set(body)
      .where(and(eq(budgets.id, id), eq(budgets.orgId, orgId)))
      .returning();
    if (!budget) throw new AppError('Budget not found.', 404);

    if (body.lines) {
      await db.delete(budgetLines).where(eq(budgetLines.budgetId, id));
      if (body.lines.length > 0) {
        await db.insert(budgetLines).values(
          body.lines.map(l => ({
            budgetId: id,
            accountId: l.accountId,
            period: l.period,
            amount: l.amount,
          }))
        );
      }
    }

    const lines = body.lines || [];
    return res.status(200).json({ ...budget, lines });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    await db.delete(budgetLines).where(eq(budgetLines.budgetId, id));
    const [budget] = await db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.orgId, orgId)))
      .returning();
    if (!budget) throw new AppError('Budget not found.', 404);
    return res.status(200).json({ message: 'Budget deleted.' });
  } catch (err) { return next(err); }
});

export default router;
