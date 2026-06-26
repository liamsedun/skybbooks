import { Router, Response, NextFunction } from 'express';
import { db, auditLog, users } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, desc, like, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const querySchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
  endDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const filters = querySchema.parse(req.query);

    const conditions = [eq(auditLog.orgId, orgId)];
    if (filters.action) conditions.push(eq(auditLog.action, filters.action));
    if (filters.entityType) conditions.push(eq(auditLog.entityType, filters.entityType));
    if (filters.startDate) conditions.push(sql`${auditLog.createdAt} >= ${filters.startDate}`);
    if (filters.endDate) conditions.push(sql`${auditLog.createdAt} <= ${filters.endDate}`);

    const list = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        oldValues: auditLog.oldValues,
        newValues: auditLog.newValues,
        ipAddress: auditLog.ipAddress,
        createdAt: auditLog.createdAt,
        userId: auditLog.userId,
      })
      .from(auditLog)
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(filters.limit)
      .offset(filters.offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLog)
      .where(and(...conditions));

    return res.status(200).json({ data: list, total: Number(count) });
  } catch (err) { return next(err); }
});

export default router;
