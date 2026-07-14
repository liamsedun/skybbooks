import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, chatMessages, users } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { desc, eq, and, lt } from 'drizzle-orm';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  before: z.string().optional(),
});

router.get('/messages', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { limit, before } = paginationSchema.parse(req.query);

    const conds: any[] = [eq(chatMessages.orgId, orgId)];
    if (before) conds.push(lt(chatMessages.createdAt, new Date(before)));

    const messages = await db
      .select({
        id: chatMessages.id,
        message: chatMessages.message,
        userId: chatMessages.userId,
        createdAt: chatMessages.createdAt,
        userName: users.fullName,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.userId, users.id))
      .where(and(...conds))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    return res.status(200).json({ success: true, data: messages.reverse() });
  } catch (err) {
    return next(err);
  }
});

export default router;
