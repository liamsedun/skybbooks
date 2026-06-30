import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, desc, lte, gte } from 'drizzle-orm';
import { db, closedPeriods, users } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';

const router = Router();

router.use(authenticate);
router.use(requireOrg);

const closePeriodSchema = z.object({
  periodStart: z.string().min(1, 'Period start date is required.'),
  periodEnd: z.string().min(1, 'Period end date is required.')
});

// GET /api/periods/closed — list all closed periods for the org
router.get('/closed', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select({
        id: closedPeriods.id,
        periodStart: closedPeriods.periodStart,
        periodEnd: closedPeriods.periodEnd,
        closedAt: closedPeriods.closedAt,
        closedBy: closedPeriods.closedBy,
        closerName: users.fullName
      })
      .from(closedPeriods)
      .leftJoin(users, eq(closedPeriods.closedBy, users.id))
      .where(eq(closedPeriods.orgId, orgId))
      .orderBy(desc(closedPeriods.periodEnd));

    return res.status(200).json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

// POST /api/periods/close — close a new period
router.post('/close', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const role = req.user!.role;

    if (role !== 'owner' && role !== 'admin') {
      throw new AppError('Only owners and administrators can close accounting periods.', 403);
    }

    const { periodStart, periodEnd } = closePeriodSchema.parse(req.body);
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new AppError('Invalid date format provided.', 400);
    }

    if (startDate > endDate) {
      throw new AppError('Period start must be before period end.', 400);
    }

    // Check for overlapping closed periods
    const overlapping = await db
      .select()
      .from(closedPeriods)
      .where(
        and(
          eq(closedPeriods.orgId, orgId),
          lte(closedPeriods.periodStart, endDate),
          gte(closedPeriods.periodEnd, startDate)
        )
      )
      .limit(1);

    if (overlapping.length > 0) {
      throw new AppError('An overlapping period is already closed. Re-open it first if needed.', 400);
    }

    const [record] = await db
      .insert(closedPeriods)
      .values({
        orgId,
        periodStart: startDate,
        periodEnd: endDate,
        closedBy: userId
      })
      .returning();

    return res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/periods/closed/:id — re-open a closed period
router.delete('/closed/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const role = req.user!.role;

    if (role !== 'owner') {
      throw new AppError('Only the organisation owner can re-open closed accounting periods.', 403);
    }

    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(closedPeriods)
      .where(and(eq(closedPeriods.id, id), eq(closedPeriods.orgId, orgId)))
      .limit(1);

    if (!existing) {
      throw new AppError('Closed period record not found.', 404);
    }

    // Require confirmation body
    const { confirmed } = z.object({ confirmed: z.boolean() }).parse(req.body);
    if (!confirmed) {
      throw new AppError('Re-opening a period must be explicitly confirmed.', 400);
    }

    await db
      .delete(closedPeriods)
      .where(eq(closedPeriods.id, id));

    return res.status(200).json({ success: true, message: 'Period re-opened. Backdated entries may now be posted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
