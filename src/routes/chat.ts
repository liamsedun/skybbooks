import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, chatConversations, chatConversationParticipants, chatMessages, chatReadMarkers, users } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── List conversations for the current user (with unread count) ──
router.get('/conversations', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;

    const myParts = await db
      .select({ conversationId: chatConversationParticipants.conversationId })
      .from(chatConversationParticipants)
      .where(eq(chatConversationParticipants.userId, userId));

    if (myParts.length === 0) return res.json({ success: true, data: [] });

    const convIds = myParts.map(p => p.conversationId);

    // Participants
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

    // Last message per conversation
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
      .where(inArray(chatMessages.conversationId, convIds))
      .orderBy(desc(chatMessages.createdAt))
      .limit(convIds.length * 10);

    const lastMsgByConv = new Map<string, any>();
    for (const m of lastMsgs) {
      if (!lastMsgByConv.has(m.conversationId)) lastMsgByConv.set(m.conversationId, m);
    }

    // Batch unread count via single query
    const unreadRows = await db.execute(sql`
      SELECT
        m.conversation_id,
        COUNT(*)::int AS cnt
      FROM chat_messages m
      LEFT JOIN chat_read_markers r
        ON r.conversation_id = m.conversation_id AND r.user_id = ${userId}
      WHERE m.conversation_id = ANY(${convIds}::uuid[])
        AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
      GROUP BY m.conversation_id
    `);

    const unreadCounts = new Map<string, number>();
    for (const row of unreadRows.rows || []) {
      unreadCounts.set(row.conversation_id, Number(row.cnt || 0));
    }
    // Ensure every conversation has an entry
    for (const cid of convIds) {
      if (!unreadCounts.has(cid)) unreadCounts.set(cid, 0);
    }

    const convRows = await db
      .select()
      .from(chatConversations)
      .where(inArray(chatConversations.id, convIds));

    // Sort by most recent last message, then by creation date
    const data = convRows
      .map(c => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        participants: partsByConv.get(c.id) || [],
        lastMessage: lastMsgByConv.get(c.id) || null,
        unreadCount: unreadCounts.get(c.id) || 0,
      }))
      .sort((a, b) => {
        const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
        const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

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
    const allUserIds = [...new Set([userId, ...participantIds])];

    if (allUserIds.length === 2) {
      const convsA = await db
        .select({ conversationId: chatConversationParticipants.conversationId })
        .from(chatConversationParticipants)
        .where(eq(chatConversationParticipants.userId, allUserIds[0]));

      if (convsA.length > 0) {
        const idsA = convsA.map(c => c.conversationId);
        const convsB = await db
          .select({ conversationId: chatConversationParticipants.conversationId })
          .from(chatConversationParticipants)
          .where(
            and(
              eq(chatConversationParticipants.userId, allUserIds[1]),
              inArray(chatConversationParticipants.conversationId, idsA)
            )
          )
          .limit(1);

        if (convsB.length > 0) {
          const [conv] = await db
            .select()
            .from(chatConversations)
            .where(eq(chatConversations.id, convsB[0].conversationId))
            .limit(1);
          return res.json({ success: true, data: conv });
        }
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

// ── Mark conversation as read ──
router.post('/conversations/:id/read', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const convId = req.params.id;

    await db.execute(sql`
      INSERT INTO chat_read_markers (conversation_id, user_id, last_read_at)
      VALUES (${convId}, ${userId}, NOW())
      ON CONFLICT (conversation_id, user_id)
      DO UPDATE SET last_read_at = NOW()
    `);

    return res.json({ success: true });
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
