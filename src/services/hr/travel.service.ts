import { sql, eq, and, desc, count, sum } from 'drizzle-orm';
import { db } from '../../db';
import {
  hrTravelRequests, hrExpenseReports, hrExpenseEntries,
  hrTravelAdvances, hrTravelSettlements, hrEmployees
} from '../../db/schema';
import { createAuditLog } from '../audit.service';
import { createApprovalRequest, registerApprovalHandler } from './approval.service';
import { dispatchEvent } from './workflow.service';

// ── Travel Advances ──

export async function getTravelAdvances(orgId: string, employeeId?: string) {
  const conditions: any[] = [eq(hrTravelAdvances.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrTravelAdvances.employeeId, employeeId));
  return await db.select().from(hrTravelAdvances).where(and(...conditions)).orderBy(desc(hrTravelAdvances.createdAt));
}

export async function getTravelAdvance(orgId: string, advanceId: string) {
  const [row] = await db.select().from(hrTravelAdvances).where(and(eq(hrTravelAdvances.id, advanceId), eq(hrTravelAdvances.orgId, orgId)));
  if (!row) throw new Error('Travel advance not found');
  return row;
}

export async function createTravelAdvance(orgId: string, data: any) {
  const [row] = await db.insert(hrTravelAdvances).values({ orgId, ...data }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'travel_advance', entityId: row.id, newValues: data });
  try { await createApprovalRequest(orgId, { module: 'travel_advance', sourceId: row.id, requesterId: data.employeeId || data.userId, title: 'Travel Advance', userId: data.userId }); } catch (e) { /* engine not configured */ }
  try { await dispatchEvent(orgId, 'travel_advance.created', row.id, { employeeId: data.employeeId, amount: data.amount, purpose: data.purpose, status: row.status }, userId); } catch (e) { console.error('[WF] dispatch travel_advance.created error:', e); }
  return row;
}

export async function updateTravelAdvance(orgId: string, advanceId: string, data: any) {
  const [row] = await db.update(hrTravelAdvances).set(data).where(and(eq(hrTravelAdvances.id, advanceId), eq(hrTravelAdvances.orgId, orgId))).returning();
  if (!row) throw new Error('Travel advance not found');
  return row;
}

export async function approveTravelAdvance(orgId: string, advanceId: string, approvedBy: string) {
  const [row] = await db.update(hrTravelAdvances).set({ status: 'approved', approvedBy, approvedAt: new Date() }).where(and(eq(hrTravelAdvances.id, advanceId), eq(hrTravelAdvances.orgId, orgId))).returning();
  if (!row) throw new Error('Travel advance not found');
  await createAuditLog({ orgId, userId: approvedBy, action: 'update', entityType: 'travel_advance', entityId: row.id, newValues: { status: 'approved' } });
  return row;
}

export async function disburseTravelAdvance(orgId: string, advanceId: string) {
  const [row] = await db.update(hrTravelAdvances).set({ status: 'disbursed', disbursedAt: new Date() }).where(and(eq(hrTravelAdvances.id, advanceId), eq(hrTravelAdvances.orgId, orgId))).returning();
  if (!row) throw new Error('Travel advance not found');
  return row;
}

export async function deleteTravelAdvance(orgId: string, advanceId: string) {
  await db.delete(hrTravelAdvances).where(and(eq(hrTravelAdvances.id, advanceId), eq(hrTravelAdvances.orgId, orgId)));
  await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'travel_advance', entityId: advanceId });
}

// ── Expense Reports (extended) ──

export async function getExpenseReports(orgId: string, filters?: { employeeId?: string; status?: string; travelRequestId?: string }) {
  const conditions: any[] = [eq(hrExpenseReports.orgId, orgId)];
  if (filters?.employeeId) conditions.push(eq(hrExpenseReports.employeeId, filters.employeeId));
  if (filters?.status) conditions.push(eq(hrExpenseReports.status as any, filters.status));
  if (filters?.travelRequestId) conditions.push(eq(hrExpenseReports.travelRequestId, filters.travelRequestId));
  return await db.select().from(hrExpenseReports).where(and(...conditions)).orderBy(desc(hrExpenseReports.createdAt));
}

export async function linkExpenseToTravel(orgId: string, expenseId: string, travelRequestId: string) {
  const [row] = await db.update(hrExpenseReports).set({ travelRequestId }).where(and(eq(hrExpenseReports.id, expenseId), eq(hrExpenseReports.orgId, orgId))).returning();
  if (!row) throw new Error('Expense report not found');
  return row;
}

// ── Settlements ──

export async function getTravelSettlements(orgId: string, travelRequestId?: string) {
  const conditions: any[] = [eq(hrTravelSettlements.orgId, orgId)];
  if (travelRequestId) conditions.push(eq(hrTravelSettlements.travelRequestId, travelRequestId));
  return await db.select().from(hrTravelSettlements).where(and(...conditions)).orderBy(desc(hrTravelSettlements.createdAt));
}

export async function getTravelSettlement(orgId: string, settlementId: string) {
  const [row] = await db.select().from(hrTravelSettlements).where(and(eq(hrTravelSettlements.id, settlementId), eq(hrTravelSettlements.orgId, orgId)));
  if (!row) throw new Error('Settlement not found');
  return row;
}

export async function createTravelSettlement(orgId: string, data: any) {
  const [row] = await db.insert(hrTravelSettlements).values({ orgId, ...data }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'travel_settlement', entityId: row.id, newValues: data });
  return row;
}

export async function settleTravel(orgId: string, travelRequestId: string, userId: string) {
  const travel = await db.select().from(hrTravelRequests).where(and(eq(hrTravelRequests.id, travelRequestId), eq(hrTravelRequests.orgId, orgId))).then(r => r[0]);
  if (!travel) throw new Error('Travel request not found');

  const expenses = await db.select({ total: sum(hrExpenseReports.totalAmount) }).from(hrExpenseReports)
    .where(and(eq(hrExpenseReports.travelRequestId, travelRequestId), eq(hrExpenseReports.orgId, orgId), eq(hrExpenseReports.status as any, 'approved')));
  const totalExpenses = Number(expenses[0]?.total || 0);

  const advances = await db.select({ total: sum(hrTravelAdvances.amount) }).from(hrTravelAdvances)
    .where(and(eq(hrTravelAdvances.travelRequestId, travelRequestId), eq(hrTravelAdvances.orgId, orgId), eq(hrTravelAdvances.status as any, 'disbursed')));
  const advanceAmount = Number(advances[0]?.total || 0);

  const balanceDue = totalExpenses - advanceAmount;

  const [settlement] = await db.insert(hrTravelSettlements).values({
    orgId, travelRequestId, employeeId: travel.employeeId,
    totalExpenses, advanceAmount, balanceDue, currency: travel.currency,
    status: balanceDue > 0 ? 'partial' : balanceDue < 0 ? 'partial' : 'settled',
    notes: `Auto-settlement for ${travel.destination} trip`,
    settledAt: new Date(),
  }).returning();

  await db.update(hrTravelRequests).set({ status: 'completed' }).where(eq(hrTravelRequests.id, travelRequestId));
  await db.update(hrTravelAdvances).set({ status: 'settled' }).where(and(eq(hrTravelAdvances.travelRequestId, travelRequestId), eq(hrTravelAdvances.orgId, orgId), eq(hrTravelAdvances.status as any, 'disbursed')));

  await createAuditLog({ orgId, userId, action: 'create', entityType: 'travel_settlement', entityId: settlement.id, newValues: settlement });
  return settlement;
}

// ── Travel History ──

export async function getTravelHistory(orgId: string, employeeId?: string) {
  const conditions: any[] = [eq(hrTravelRequests.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrTravelRequests.employeeId, employeeId));
  return await db.select({
    id: hrTravelRequests.id,
    employeeId: hrTravelRequests.employeeId,
    destination: hrTravelRequests.destination,
    purpose: hrTravelRequests.purpose,
    departureDate: hrTravelRequests.departureDate,
    returnDate: hrTravelRequests.returnDate,
    estimatedCost: hrTravelRequests.estimatedCost,
    currency: hrTravelRequests.currency,
    status: hrTravelRequests.status,
    approvedBy: hrTravelRequests.approvedBy,
    approvedAt: hrTravelRequests.approvedAt,
    notes: hrTravelRequests.notes,
    createdAt: hrTravelRequests.createdAt,
    updatedAt: hrTravelRequests.updatedAt,
  }).from(hrTravelRequests).where(and(...conditions)).orderBy(desc(hrTravelRequests.createdAt));
}

// ── Travel Reports ──

export async function getTravelReport(orgId: string, filters?: { dateFrom?: string; dateTo?: string }) {
  const conditions: any[] = [eq(hrTravelRequests.orgId, orgId)];
  if (filters?.dateFrom) conditions.push(sql`${hrTravelRequests.departureDate} >= ${filters.dateFrom}::date`);
  if (filters?.dateTo) conditions.push(sql`${hrTravelRequests.returnDate} <= ${filters.dateTo}::date`);

  const totalRequests = await db.select({ count: count() }).from(hrTravelRequests).where(and(...conditions)).then(r => r[0]?.count || 0);
  const approvedTravel = await db.select({ count: count() }).from(hrTravelRequests).where(and(...conditions, eq(hrTravelRequests.status, 'approved'))).then(r => r[0]?.count || 0);
  const completedTravel = await db.select({ count: count() }).from(hrTravelRequests).where(and(...conditions, eq(hrTravelRequests.status, 'completed'))).then(r => r[0]?.count || 0);
  const totalCost = await db.select({ total: sum(hrTravelRequests.estimatedCost) }).from(hrTravelRequests).where(and(...conditions, eq(hrTravelRequests.status as any, 'approved'))).then(r => Number(r[0]?.total || 0));

  const totalAdvances = await db.select({ count: count() }).from(hrTravelAdvances).where(and(eq(hrTravelAdvances.orgId, orgId), eq(hrTravelAdvances.status, 'disbursed'))).then(r => r[0]?.count || 0);
  const totalAdvanceAmount = await db.select({ total: sum(hrTravelAdvances.amount) }).from(hrTravelAdvances).where(and(eq(hrTravelAdvances.orgId, orgId), eq(hrTravelAdvances.status, 'disbursed'))).then(r => Number(r[0]?.total || 0));

  const totalExpenses = await db.select({ count: count() }).from(hrExpenseReports).where(eq(hrExpenseReports.orgId, orgId)).then(r => r[0]?.count || 0);
  const reimbursedExpenses = await db.select({ count: count() }).from(hrExpenseReports).where(and(eq(hrExpenseReports.orgId, orgId), eq(hrExpenseReports.status as any, 'reimbursed'))).then(r => r[0]?.count || 0);

  const pendingSettlements = await db.select({ count: count() }).from(hrTravelSettlements).where(and(eq(hrTravelSettlements.orgId, orgId), eq(hrTravelSettlements.status as any, 'pending'))).then(r => r[0]?.count || 0);

  return {
    totalRequests: Number(totalRequests),
    approvedTravel: Number(approvedTravel),
    completedTravel: Number(completedTravel),
    totalCost: Number(totalCost),
    totalAdvances: Number(totalAdvances),
    totalAdvanceAmount: Number(totalAdvanceAmount),
    totalExpenses: Number(totalExpenses),
    reimbursedExpenses: Number(reimbursedExpenses),
    pendingSettlements: Number(pendingSettlements),
  };
}

// ── Travel Dashboard ──

export async function getTravelDashboard(orgId: string) {
  const pendingRequests = await db.select({ count: count() }).from(hrTravelRequests).where(and(eq(hrTravelRequests.orgId, orgId), eq(hrTravelRequests.status, 'submitted'))).then(r => r[0]?.count || 0);
  const pendingAdvances = await db.select({ count: count() }).from(hrTravelAdvances).where(and(eq(hrTravelAdvances.orgId, orgId), eq(hrTravelAdvances.status, 'pending'))).then(r => r[0]?.count || 0);
  const pendingExpenses = await db.select({ count: count() }).from(hrExpenseReports).where(and(eq(hrExpenseReports.orgId, orgId), eq(hrExpenseReports.status as any, 'submitted'))).then(r => r[0]?.count || 0);

  const statusBreakdown = await db.select({ status: hrTravelRequests.status, count: count() }).from(hrTravelRequests).where(eq(hrTravelRequests.orgId, orgId)).groupBy(hrTravelRequests.status);

  return {
    pendingRequests: Number(pendingRequests),
    pendingAdvances: Number(pendingAdvances),
    pendingExpenses: Number(pendingExpenses),
    statusBreakdown,
  };
}

export async function handleTravelAdvanceApproval(orgId: string, sourceId: string, _requestId: string) {
  try { await approveTravelAdvance(orgId, sourceId, 'approval_engine'); } catch (e) { console.error('[Approval] advance handler error:', e); }
}

try { registerApprovalHandler('travel_advance', handleTravelAdvanceApproval); } catch (e) { /* ignored */ }
