import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, fixedAssets } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, desc } from 'drizzle-orm';
import { AppError } from '../lib/errors';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const assetSchema = z.object({
  assetNumber: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  purchaseDate: z.string().transform(v => new Date(v)),
  purchaseCost: z.number().int(),
  depreciationMethod: z.enum(['straight_line', 'declining_balance']),
  usefulLifeMonths: z.number().int().min(1),
  residualValue: z.number().int().default(0),
  accountId: z.string().uuid(),
  status: z.enum(['active', 'disposed', 'fully_depreciated']).optional(),
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(fixedAssets)
      .where(eq(fixedAssets.orgId, orgId))
      .orderBy(desc(fixedAssets.createdAt));
    return res.status(200).json(list);
  } catch (err) { return next(err); }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [asset] = await db
      .select()
      .from(fixedAssets)
      .where(and(eq(fixedAssets.id, id), eq(fixedAssets.orgId, orgId)))
      .limit(1);
    if (!asset) throw new AppError('Fixed asset not found.', 404);
    return res.status(200).json(asset);
  } catch (err) { return next(err); }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = assetSchema.parse(req.body);
    const bookValue = body.purchaseCost - body.residualValue;

    const [asset] = await db
      .insert(fixedAssets)
      .values({
        orgId,
        assetNumber: body.assetNumber,
        name: body.name,
        category: body.category,
        purchaseDate: body.purchaseDate,
        purchaseCost: body.purchaseCost,
        accumulatedDepreciation: 0,
        bookValue,
        depreciationMethod: body.depreciationMethod,
        usefulLifeMonths: body.usefulLifeMonths,
        residualValue: body.residualValue,
        accountId: body.accountId,
        status: body.status || 'active',
      })
      .returning();

    return res.status(201).json(asset);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = assetSchema.partial().parse(req.body);

    if (body.purchaseCost !== undefined || body.residualValue !== undefined) {
      const [existing] = await db
        .select()
        .from(fixedAssets)
        .where(and(eq(fixedAssets.id, id), eq(fixedAssets.orgId, orgId)))
        .limit(1);
      if (existing) {
        const cost = body.purchaseCost ?? existing.purchaseCost;
        const residual = body.residualValue ?? existing.residualValue;
        (body as any).bookValue = cost - residual;
      }
    }

    const [asset] = await db
      .update(fixedAssets)
      .set(body)
      .where(and(eq(fixedAssets.id, id), eq(fixedAssets.orgId, orgId)))
      .returning();
    if (!asset) throw new AppError('Fixed asset not found.', 404);
    return res.status(200).json(asset);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [asset] = await db
      .delete(fixedAssets)
      .where(and(eq(fixedAssets.id, id), eq(fixedAssets.orgId, orgId)))
      .returning();
    if (!asset) throw new AppError('Fixed asset not found.', 404);
    return res.status(200).json({ message: 'Fixed asset deleted.' });
  } catch (err) { return next(err); }
});

export default router;
