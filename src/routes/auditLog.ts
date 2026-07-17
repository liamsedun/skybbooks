import { Router, Response, NextFunction } from 'express';
import { db, auditLog, users } from '../db/schema';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, desc, sql, or, like } from 'drizzle-orm';
import { z } from 'zod';
import { verifyAuditChain } from '../services/audit.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);
router.use(requireRole('admin', 'owner'));

const querySchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  search: z.string().optional(),
  startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
  endDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const filters = querySchema.parse(req.query);

    const conditions: any[] = [eq(auditLog.orgId, orgId)];
    if (filters.action) conditions.push(eq(auditLog.action, filters.action));
    if (filters.entityType) conditions.push(eq(auditLog.entityType, filters.entityType));
    if (filters.entityId) conditions.push(eq(auditLog.entityId, filters.entityId));
    if (filters.userId) conditions.push(eq(auditLog.userId, filters.userId));
    if (filters.startDate) conditions.push(sql`${auditLog.createdAt} >= ${filters.startDate}`);
    if (filters.endDate) conditions.push(sql`${auditLog.createdAt} <= ${filters.endDate}`);
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(or(
        like(auditLog.action, term),
        like(auditLog.entityType, term),
        like(auditLog.description, term),
        sql`${auditLog.newValues}::text ILIKE ${term}`,
        sql`${auditLog.oldValues}::text ILIKE ${term}`,
      ));
    }

    const list = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        description: auditLog.description,
        oldValues: auditLog.oldValues,
        newValues: auditLog.newValues,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        correlationId: auditLog.correlationId,
        hash: auditLog.hash,
        previousHash: auditLog.previousHash,
        createdAt: auditLog.createdAt,
        userId: auditLog.userId,
        user: {
          name: users.fullName,
          email: users.email,
        },
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
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

router.get('/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const [totalResult] = await db
      .select({ total: sql<number>`count(*)` })
      .from(auditLog)
      .where(eq(auditLog.orgId, orgId));
    const actionCounts = await db
      .select({ action: auditLog.action, count: sql<number>`count(*)` })
      .from(auditLog)
      .where(eq(auditLog.orgId, orgId))
      .groupBy(auditLog.action)
      .orderBy(sql`count(*) DESC`)
      .limit(20);
    const entityCounts = await db
      .select({ entityType: auditLog.entityType, count: sql<number>`count(*)` })
      .from(auditLog)
      .where(eq(auditLog.orgId, orgId))
      .groupBy(auditLog.entityType)
      .orderBy(sql`count(*) DESC`)
      .limit(20);
    const [dateRange] = await db
      .select({
        earliest: sql<string>`min(${auditLog.createdAt})`,
        latest: sql<string>`max(${auditLog.createdAt})`,
      })
      .from(auditLog)
      .where(eq(auditLog.orgId, orgId));
    return res.status(200).json({
      total: Number(totalResult?.total || 0),
      actionCounts,
      entityCounts,
      dateRange: {
        earliest: dateRange?.earliest || null,
        latest: dateRange?.latest || null,
      },
    });
  } catch (err) { return next(err); }
});

router.get('/verify', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const result = await verifyAuditChain(orgId);
    return res.status(200).json(result);
  } catch (err) { return next(err); }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [entry] = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        description: auditLog.description,
        oldValues: auditLog.oldValues,
        newValues: auditLog.newValues,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        correlationId: auditLog.correlationId,
        hash: auditLog.hash,
        previousHash: auditLog.previousHash,
        createdAt: auditLog.createdAt,
        userId: auditLog.userId,
        user: {
          name: users.fullName,
          email: users.email,
        },
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .where(and(eq(auditLog.id, id), eq(auditLog.orgId, orgId)))
      .limit(1);
    if (!entry) return res.status(404).json({ message: 'Audit log entry not found.' });
    return res.status(200).json(entry);
  } catch (err) { return next(err); }
});

router.get('/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generateAuditLogsPDF } = await import('../services/pdf.service');
    const orgId = req.user!.orgId!;
    const start = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const end = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const buffer = await generateAuditLogsPDF(orgId, start, end);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="audit_logs.pdf"');
    return res.end(buffer);
  } catch (err) { return next(err); }
});

export default router;
