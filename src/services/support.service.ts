import { eq, and, desc, isNull } from 'drizzle-orm';
import { db, supportTickets, ticketMessages, users, organisations } from '../db/schema';
import { AppError } from '../lib/errors';

export async function getTickets(orgId: string, status?: string, priority?: string) {
  const conditions: any[] = [eq(supportTickets.orgId, orgId)];
  if (status) conditions.push(eq(supportTickets.status as any, status));
  if (priority) conditions.push(eq(supportTickets.priority as any, priority));
  return await db.select({
    id: supportTickets.id, subject: supportTickets.subject,
    category: supportTickets.category, priority: supportTickets.priority,
    status: supportTickets.status, assignedTo: supportTickets.assignedTo,
    userEmail: users.email, userName: users.fullName,
    createdAt: supportTickets.createdAt, updatedAt: supportTickets.updatedAt,
  }).from(supportTickets).leftJoin(users, eq(supportTickets.userId, users.id))
    .where(and(...conditions)).orderBy(desc(supportTickets.createdAt));
}

export async function getTicket(id: string) {
  const [ticket] = await db.select({
    id: supportTickets.id, orgId: supportTickets.orgId, orgName: organisations.name,
    subject: supportTickets.subject, message: supportTickets.message,
    category: supportTickets.category, priority: supportTickets.priority,
    status: supportTickets.status, assignedTo: supportTickets.assignedTo,
    resolution: supportTickets.resolution,
    userEmail: users.email, userName: users.fullName,
    createdAt: supportTickets.createdAt, updatedAt: supportTickets.updatedAt,
  }).from(supportTickets).leftJoin(users, eq(supportTickets.userId, users.id))
    .leftJoin(organisations, eq(supportTickets.orgId, organisations.id))
    .where(eq(supportTickets.id, id)).limit(1);
  if (!ticket) throw new AppError('Ticket not found.', 404);
  const messages = await db.select({
    id: ticketMessages.id, userId: ticketMessages.userId,
    userName: users.fullName, message: ticketMessages.message,
    isInternal: ticketMessages.isInternal, createdAt: ticketMessages.createdAt,
  }).from(ticketMessages).leftJoin(users, eq(ticketMessages.userId, users.id))
    .where(eq(ticketMessages.ticketId, id)).orderBy(ticketMessages.createdAt);
  return { ...ticket, messages };
}

export async function getAllTickets(status?: string, priority?: string) {
  const conditions: any[] = [];
  if (status) conditions.push(eq(supportTickets.status as any, status));
  if (priority) conditions.push(eq(supportTickets.priority as any, priority));
  return await db.select({
    id: supportTickets.id, orgId: supportTickets.orgId, orgName: organisations.name,
    subject: supportTickets.subject, category: supportTickets.category,
    priority: supportTickets.priority, status: supportTickets.status,
    userEmail: users.email, userName: users.fullName,
    createdAt: supportTickets.createdAt, updatedAt: supportTickets.updatedAt,
  }).from(supportTickets).leftJoin(users, eq(supportTickets.userId, users.id))
    .leftJoin(organisations, eq(supportTickets.orgId, organisations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(supportTickets.createdAt));
}

export async function createTicket(orgId: string, userId: string, data: any) {
  const [ticket] = await db.insert(supportTickets).values({
    orgId, userId, subject: data.subject, message: data.message,
    category: data.category || 'general', priority: data.priority || 'normal',
  } as any).returning();
  return ticket;
}

export async function addTicketMessage(ticketId: string, userId: string, message: string, isInternal = false) {
  const [msg] = await db.insert(ticketMessages).values({
    ticketId, userId, message, isInternal,
  } as any).returning();
  await db.update(supportTickets).set({ updatedAt: new Date(), status: 'in_progress' as any } as any)
    .where(eq(supportTickets.id, ticketId));
  return msg;
}

export async function updateTicketStatus(id: string, status: string, resolution?: string, assignedTo?: string) {
  const [ticket] = await db.update(supportTickets).set({
    status: status as any, resolution: resolution || null,
    assignedTo: assignedTo || null,
    closedAt: status === 'closed' || status === 'resolved' ? new Date() : null,
    updatedAt: new Date(),
  } as any).where(eq(supportTickets.id, id)).returning();
  if (!ticket) throw new AppError('Ticket not found.', 404);
  return ticket;
}
