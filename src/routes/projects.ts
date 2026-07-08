import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, projects } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, desc } from 'drizzle-orm';
import { AppError } from '../lib/errors';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const createProjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
  customFields: z.record(z.any()).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  budget: z.number().optional(),
  customFields: z.record(z.any()).optional(),
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(projects)
      .where(eq(projects.orgId, orgId))
      .orderBy(desc(projects.createdAt));
    return res.status(200).json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.orgId, orgId)))
      .limit(1);
    if (!project) throw new AppError('Project not found.', 404);
    return res.status(200).json(project);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const body = createProjectSchema.parse(req.body);
    const [project] = await db
      .insert(projects)
      .values({
        orgId,
        name: body.name,
        code: body.code || null,
        description: body.description || null,
        status: body.status || 'active',
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        budget: body.budget ? Math.round(body.budget * 100) : 0,
        customFields: body.customFields || {},
        createdBy: userId,
      })
      .returning();
    return res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = updateProjectSchema.parse(req.body);
    const [existing] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.orgId, orgId)))
      .limit(1);
    if (!existing) throw new AppError('Project not found.', 404);
    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.code !== undefined) updateData.code = body.code;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.budget !== undefined) updateData.budget = Math.round(body.budget * 100);
    if (body.customFields !== undefined) updateData.customFields = body.customFields;
    const [updated] = await db
      .update(projects)
      .set(updateData)
      .where(and(eq(projects.id, id), eq(projects.orgId, orgId)))
      .returning();
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [existing] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.orgId, orgId)))
      .limit(1);
    if (!existing) throw new AppError('Project not found.', 404);
    await db.delete(projects).where(and(eq(projects.id, id), eq(projects.orgId, orgId)));
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;