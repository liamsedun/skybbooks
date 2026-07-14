import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, chatConversations, chatConversationParticipants, chatMessages, users } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { desc, eq, and, inArray, sql } from 'drizzle-orm';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── List conversations for the current user ──
router.get('/conversations', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;

    // Find conversation IDs the user belongs to
    const myParts = await db
      .select({ conversationId: chatConversationParticipants.conversationId })
      .from(chatConversationParticipants)
      .where(eq(chatConversationParticipants.userId, userId));

    if (myParts.length === 0) return res.json({ success: true, data: [] });

    const convIds = myParts.map(p => p.conversationId);

    // Build a map of conversation → participants
    const allParts = await db
      .select({
        conversationId: chatConversationParticipants.conversationId,
        userId: chatConversationParticipants.userId,
        userName: users.fullName,
      })
      .from(chatConversationParticipants)
      .leftJoin(users, eq(chatConversationParticipants.userId, users.id))
      .where(inArray(chatConversationParticipants.conversationId, convIds));

    const partsByConv = new Map<string, { userId: string; userName: string | null }[]>();
    for (const p of allParts) {
      if (!partsByConv.has(p.conversationId)) partsByConv.set(p.conversationId, []);
      partsByConv.get(p.conversationId)!.push({ userId: p.userId, userName: p.userName });
    }

    // Get last message per conversation
    const lastMsgs = await db
      .select({
        conversationId: chatMessages.conversationId,
        message: chatMessages.message,
        createdAt: chatMessages.createdAt,
        userId: chatMessages.userId,
        userName: users.fullName,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.userId, users.id))
      .where(
        inArray(
          chatMessages.conversationId,
          convIds.map(id => id)
        )
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(convIds.length * 10);

    // Pick the latest message per conversation
    const lastMsgByConv = new Map<string, any>();
    for (const m of lastMsgs) {
      if (!lastMsgByConv.has(m.conversationId)) {
        lastMsgByConv.set(m.conversationId, m);
      }
    }

    const convRows = await db
      .select()
      .from(chatConversations)
      .where(inArray(chatConversations.id, convIds))
      .orderBy(desc(chatConversations.createdAt));

    const data = convRows.map(c => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      participants: partsByConv.get(c.id) || [],
      lastMessage: lastMsgByConv.get(c.id) || null,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

// ── Create a conversation ──
const createConvSchema = z.object({
  participantIds: z.array(z.string().uuid()).min(1),
  title: z.string().optional(),
});

router.post('/conversations', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const { participantIds, title } = createConvSchema.parse(req.body);

    // Always include the creator
    const allUserIds = [...new Set([userId, ...participantIds])];

    // For 1-on-1 chats, check if a conversation already exists between these two users
    if (allUserIds.length === 2) {
      const existing = await db
        .select({ convId: chatConversationParticipants.conversationId })
        .from(chatConversationParticipants)
        .where(
          and(
            eq(chatConversationParticipants.userId, allUserIds[0]),
            inArray(chatConversationParticipants.conversationId,
              db.select({ id: chatConversationParticipants.conversationId })
                .from(chatConversationParticipants)
                .where(eq(chatConversationParticipants.userId, allUserIds[1]))
                .as('sub')
            )
          )
        )
        .limit(1);

      // Actually, let me use a simpler approach: find convs where both users are participants
      const subQuery = db
        .select({ conversationId: chatConversationParticipants.conversationId })
        .from(chatConversationParticipants)
        .where(eq(chatConversationParticipants.userId, allUserIds[1]));

      const matches = await db
        .select({ conversationId: chatConversationParticipants.conversationId })
        .from(chatConversationParticipants)
        .where(
          and(
            eq(chatConversationParticipants.userId, allUserIds[0]),
            inArray(chatConversationParticipants.conversationId, subQuery)
          )
        )
        .limit(1);

      if (matches.length > 0) {
        const [conv] = await db
          .select()
          .from(chatConversations)
          .where(eq(chatConversations.id, matches[0].conversationId))
          .limit(1);
        return res.json({ success: true, data: conv });
      }
    }

    const [conv] = await db.insert(chatConversations).values({ orgId, title }).returning();

    for (const pid of allUserIds) {
      await db.insert(chatConversationParticipants).values({ conversationId: conv.id, userId: pid });
    }

    return res.json({ success: true, data: conv });
  } catch (err) {
    return next(err);
  }
});

// ── Get messages for a conversation ──
const messagesSchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  before: z.string().optional(),
});

router.get('/conversations/:id/messages', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const convId = req.params.id;

    // Verify user is a participant
    const [part] = await db
      .select()
      .from(chatConversationParticipants)
      .where(
        and(
          eq(chatConversationParticipants.conversationId, convId),
          eq(chatConversationParticipants.userId, userId)
        )
      )
      .limit(1);
    if (!part) return res.status(403).json({ error: 'Not a participant of this conversation' });

    const { limit, before } = messagesSchema.parse(req.query);
    const conds: any[] = [eq(chatMessages.conversationId, convId)];
    if (before) conds.push(sql`${chatMessages.createdAt} < ${new Date(before)}`);

    const msgs = await db
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

    return res.json({ success: true, data: msgs.reverse() });
  } catch (err) {
    return next(err);
  }
});

export default router;
