import { eq, and, or, desc, gte, lte, isNull, sql } from 'drizzle-orm';
import { db, announcements } from '../db/schema';

export async function getAnnouncements(orgId?: string) {
  const conditions: any[] = [
    lte(announcements.startsAt, new Date()),
    or(isNull(announcements.endsAt), gte(announcements.endsAt, new Date())),
  ];
  if (orgId) conditions.push(or(eq(announcements.orgId, orgId), eq(announcements.isGlobal, true)));
  return await db.select().from(announcements)
    .where(and(...conditions)).orderBy(desc(announcements.startsAt));
}

export async function createAnnouncement(data: any) {
  const [row] = await db.insert(announcements).values(data as any).returning();
  return row;
}

export async function dismissAnnouncement(id: string, orgId: string) {
  // Mark as dismissed by inserting into a user_dismissed table or just soft-delete
  // Simplified: no-op since we don't have a user_dismissed table yet
  return { dismissed: true };
}

export async function getAllAnnouncements() {
  return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
}
