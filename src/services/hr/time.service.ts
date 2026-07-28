import { sql, eq, and, or, like, desc, count, gte, lte, asc } from 'drizzle-orm';
import { db } from '../../db';
import {
  hrLeaveTypes, hrLeaveRequests, hrLeaveBalances,
  hrAttendanceRecords, hrShifts, hrShiftAssignments, hrShiftRotations, hrShiftRotationAssignees,
  hrAttendanceExceptions, hrOvertimePolicies,
  hrTimesheets, hrTimesheetEntries, hrEmployees,
  hrLeavePolicies, hrHolidays, hrCompensatoryLeaves, hrLeaveAccrualLogs,
  hrLeaveStatusEnum, hrAttendanceStatusEnum, hrApprovalStatusEnum
} from '../../db/schema';
import { createAuditLog } from '../audit.service';
import { createApprovalRequest, registerApprovalHandler } from './approval.service';
import { dispatchEvent } from './workflow.service';

// ── Leave Types ──

export async function getLeaveTypes(orgId: string) {
  return db.select().from(hrLeaveTypes).where(eq(hrLeaveTypes.orgId, orgId)).orderBy(hrLeaveTypes.name);
}

export async function getLeaveType(orgId: string, typeId: string) {
  const [record] = await db.select().from(hrLeaveTypes).where(and(eq(hrLeaveTypes.orgId, orgId), eq(hrLeaveTypes.id, typeId))).limit(1);
  return record;
}

export async function createLeaveType(orgId: string, data: any) {
  const [record] = await db.insert(hrLeaveTypes).values({ ...data, orgId }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'leave_type', entityId: record.id, description: `Created leave type: ${record.name}`, newValues: record });
  try { await dispatchEvent(orgId, 'leave_type.created', record.id, { name: data.name, daysAllowed: data.daysAllowed }, userId); } catch (e) { console.error('[WF] dispatch leave_type.created error:', e); }
  return record;
}

export async function updateLeaveType(orgId: string, typeId: string, data: any) {
  const [old] = await db.select().from(hrLeaveTypes).where(and(eq(hrLeaveTypes.orgId, orgId), eq(hrLeaveTypes.id, typeId))).limit(1);
  const [record] = await db.update(hrLeaveTypes).set({ ...data, updatedAt: sql`now()` }).where(and(eq(hrLeaveTypes.orgId, orgId), eq(hrLeaveTypes.id, typeId))).returning();
  if (record) await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'leave_type', entityId: typeId, description: `Updated leave type: ${record.name}`, oldValues: old, newValues: record });
  return record;
}

export async function deleteLeaveType(orgId: string, typeId: string) {
  const [record] = await db.delete(hrLeaveTypes).where(and(eq(hrLeaveTypes.orgId, orgId), eq(hrLeaveTypes.id, typeId))).returning();
  if (record) await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'leave_type', entityId: typeId, description: `Deleted leave type: ${record.name}`, oldValues: record });
  return record;
}

// ── Leave Policies ──

export async function getLeavePolicies(orgId: string) {
  return db.select().from(hrLeavePolicies).where(eq(hrLeavePolicies.orgId, orgId)).orderBy(hrLeavePolicies.name);
}

export async function getLeavePolicy(orgId: string, policyId: string) {
  const [record] = await db.select().from(hrLeavePolicies).where(and(eq(hrLeavePolicies.orgId, orgId), eq(hrLeavePolicies.id, policyId))).limit(1);
  return record;
}

export async function createLeavePolicy(orgId: string, data: any) {
  const [record] = await db.insert(hrLeavePolicies).values({ ...data, orgId }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'leave_policy', entityId: record.id, description: `Created leave policy: ${record.name}`, newValues: record });
  return record;
}

export async function updateLeavePolicy(orgId: string, policyId: string, data: any) {
  const [old] = await db.select().from(hrLeavePolicies).where(and(eq(hrLeavePolicies.orgId, orgId), eq(hrLeavePolicies.id, policyId))).limit(1);
  const [record] = await db.update(hrLeavePolicies).set({ ...data, updatedAt: sql`now()` }).where(and(eq(hrLeavePolicies.orgId, orgId), eq(hrLeavePolicies.id, policyId))).returning();
  if (record) await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'leave_policy', entityId: policyId, description: `Updated leave policy: ${record.name}`, oldValues: old, newValues: record });
  return record;
}

export async function deleteLeavePolicy(orgId: string, policyId: string) {
  const [record] = await db.delete(hrLeavePolicies).where(and(eq(hrLeavePolicies.orgId, orgId), eq(hrLeavePolicies.id, policyId))).returning();
  if (record) await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'leave_policy', entityId: policyId, description: `Deleted leave policy: ${record.name}`, oldValues: record });
  return record;
}

// ── Holidays ──

export async function getHolidays(orgId: string, year?: number) {
  const conditions: any[] = [eq(hrHolidays.orgId, orgId)];
  if (year) conditions.push(sql`EXTRACT(YEAR FROM ${hrHolidays.date}) = ${year}`);
  return db.select().from(hrHolidays).where(and(...conditions)).orderBy(hrHolidays.date);
}

export async function getHoliday(orgId: string, holidayId: string) {
  const [record] = await db.select().from(hrHolidays).where(and(eq(hrHolidays.orgId, orgId), eq(hrHolidays.id, holidayId))).limit(1);
  return record;
}

export async function createHoliday(orgId: string, data: any) {
  const [record] = await db.insert(hrHolidays).values({ ...data, orgId }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'holiday', entityId: record.id, description: `Created holiday: ${record.name}`, newValues: record });
  try { await dispatchEvent(orgId, 'holiday.created', record.id, { name: data.name, date: data.date, type: data.type }, userId); } catch (e) { console.error('[WF] dispatch holiday.created error:', e); }
  return record;
}

export async function updateHoliday(orgId: string, holidayId: string, data: any) {
  const [old] = await db.select().from(hrHolidays).where(and(eq(hrHolidays.orgId, orgId), eq(hrHolidays.id, holidayId))).limit(1);
  const [record] = await db.update(hrHolidays).set({ ...data, updatedAt: sql`now()` }).where(and(eq(hrHolidays.orgId, orgId), eq(hrHolidays.id, holidayId))).returning();
  if (record) await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'holiday', entityId: holidayId, description: `Updated holiday: ${record.name}`, oldValues: old, newValues: record });
  return record;
}

export async function deleteHoliday(orgId: string, holidayId: string) {
  const [record] = await db.delete(hrHolidays).where(and(eq(hrHolidays.orgId, orgId), eq(hrHolidays.id, holidayId))).returning();
  if (record) await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'holiday', entityId: holidayId, description: `Deleted holiday: ${record.name}`, oldValues: record });
  return record;
}

// ── Holiday Calendar ──

export async function getHolidayCalendar(orgId: string, year: number) {
  return db.select().from(hrHolidays)
    .where(and(eq(hrHolidays.orgId, orgId), eq(hrHolidays.isActive, true), sql`EXTRACT(YEAR FROM ${hrHolidays.date}) = ${year}`))
    .orderBy(hrHolidays.date);
}

// ── Compensatory Leave ──

export async function getCompensatoryLeaves(orgId: string, employeeId?: string) {
  const conditions: any[] = [eq(hrCompensatoryLeaves.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrCompensatoryLeaves.employeeId, employeeId));
  return db.select({
    id: hrCompensatoryLeaves.id,
    orgId: hrCompensatoryLeaves.orgId,
    employeeId: hrCompensatoryLeaves.employeeId,
    dateEarned: hrCompensatoryLeaves.dateEarned,
    daysEarned: hrCompensatoryLeaves.daysEarned,
    reason: hrCompensatoryLeaves.reason,
    status: hrCompensatoryLeaves.status,
    expiryDate: hrCompensatoryLeaves.expiryDate,
    usedAt: hrCompensatoryLeaves.usedAt,
    usedForLeaveId: hrCompensatoryLeaves.usedForLeaveId,
    createdAt: hrCompensatoryLeaves.createdAt,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
  }).from(hrCompensatoryLeaves)
    .leftJoin(hrEmployees, eq(hrCompensatoryLeaves.employeeId, hrEmployees.id))
    .where(and(...conditions))
    .orderBy(desc(hrCompensatoryLeaves.dateEarned));
}

export async function getCompensatoryLeave(orgId: string, compId: string) {
  const [record] = await db.select().from(hrCompensatoryLeaves)
    .where(and(eq(hrCompensatoryLeaves.orgId, orgId), eq(hrCompensatoryLeaves.id, compId)))
    .limit(1);
  return record;
}

export async function createCompensatoryLeave(orgId: string, data: any) {
  const expiryDate = data.expiryDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [record] = await db.insert(hrCompensatoryLeaves).values({
    ...data, orgId, status: 'pending', expiryDate,
  }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'compensatory_leave', entityId: record.id, description: `Compensatory leave earned: ${record.daysEarned} days`, newValues: record });
  return record;
}

export async function approveCompensatoryLeave(orgId: string, compId: string) {
  const [old] = await db.select().from(hrCompensatoryLeaves).where(and(eq(hrCompensatoryLeaves.orgId, orgId), eq(hrCompensatoryLeaves.id, compId))).limit(1);
  if (!old || old.status !== 'pending') throw new Error('Compensatory leave not found or not pending');
  const [record] = await db.update(hrCompensatoryLeaves).set({ status: 'approved' as any, updatedAt: sql`now()` }).where(and(eq(hrCompensatoryLeaves.orgId, orgId), eq(hrCompensatoryLeaves.id, compId))).returning();
  await createAuditLog({ orgId, userId: 'system', action: 'approve', entityType: 'compensatory_leave', entityId: compId, description: 'Compensatory leave approved', oldValues: old, newValues: record });
  return record;
}

export async function deleteCompensatoryLeave(orgId: string, compId: string) {
  const [record] = await db.delete(hrCompensatoryLeaves).where(and(eq(hrCompensatoryLeaves.orgId, orgId), eq(hrCompensatoryLeaves.id, compId))).returning();
  if (record) await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'compensatory_leave', entityId: compId, description: 'Compensatory leave deleted', oldValues: record });
  return record;
}

// ── Leave Requests ──

export interface LeaveFilters { employeeId?: string; leaveTypeId?: string; status?: string; year?: number; }

export async function getLeaveRequests(orgId: string, filters?: LeaveFilters) {
  const conditions: any[] = [eq(hrLeaveRequests.orgId, orgId)];
  if (filters?.employeeId) conditions.push(eq(hrLeaveRequests.employeeId, filters.employeeId));
  if (filters?.leaveTypeId) conditions.push(eq(hrLeaveRequests.leaveTypeId, filters.leaveTypeId));
  if (filters?.status) conditions.push(eq(hrLeaveRequests.status, filters.status as any));
  if (filters?.year) conditions.push(sql`EXTRACT(YEAR FROM ${hrLeaveRequests.startDate}) = ${filters.year}`);
  return db.select({
    id: hrLeaveRequests.id,
    orgId: hrLeaveRequests.orgId,
    employeeId: hrLeaveRequests.employeeId,
    leaveTypeId: hrLeaveRequests.leaveTypeId,
    startDate: hrLeaveRequests.startDate,
    endDate: hrLeaveRequests.endDate,
    totalDays: hrLeaveRequests.totalDays,
    isHalfDay: hrLeaveRequests.isHalfDay,
    reason: hrLeaveRequests.reason,
    remarks: hrLeaveRequests.remarks,
    status: hrLeaveRequests.status,
    approvedBy: hrLeaveRequests.approvedBy,
    approvedAt: hrLeaveRequests.approvedAt,
    rejectionReason: hrLeaveRequests.rejectionReason,
    recalledAt: hrLeaveRequests.recalledAt,
    recalledById: hrLeaveRequests.recalledById,
    createdAt: hrLeaveRequests.createdAt,
    updatedAt: hrLeaveRequests.updatedAt,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
    leaveTypeName: hrLeaveTypes.name,
    leaveTypeColor: hrLeaveTypes.color,
  }).from(hrLeaveRequests)
    .leftJoin(hrEmployees, eq(hrLeaveRequests.employeeId, hrEmployees.id))
    .leftJoin(hrLeaveTypes, eq(hrLeaveRequests.leaveTypeId, hrLeaveTypes.id))
    .where(and(...conditions))
    .orderBy(desc(hrLeaveRequests.createdAt));
}

export async function getLeaveRequest(orgId: string, leaveId: string) {
  const [record] = await db.select({
    id: hrLeaveRequests.id,
    orgId: hrLeaveRequests.orgId,
    employeeId: hrLeaveRequests.employeeId,
    leaveTypeId: hrLeaveRequests.leaveTypeId,
    startDate: hrLeaveRequests.startDate,
    endDate: hrLeaveRequests.endDate,
    totalDays: hrLeaveRequests.totalDays,
    isHalfDay: hrLeaveRequests.isHalfDay,
    reason: hrLeaveRequests.reason,
    remarks: hrLeaveRequests.remarks,
    status: hrLeaveRequests.status,
    approvedBy: hrLeaveRequests.approvedBy,
    approvedAt: hrLeaveRequests.approvedAt,
    rejectionReason: hrLeaveRequests.rejectionReason,
    recalledAt: hrLeaveRequests.recalledAt,
    recalledById: hrLeaveRequests.recalledById,
    createdAt: hrLeaveRequests.createdAt,
    updatedAt: hrLeaveRequests.updatedAt,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
    leaveTypeName: hrLeaveTypes.name,
    leaveTypeColor: hrLeaveTypes.color,
  }).from(hrLeaveRequests)
    .leftJoin(hrEmployees, eq(hrLeaveRequests.employeeId, hrEmployees.id))
    .leftJoin(hrLeaveTypes, eq(hrLeaveRequests.leaveTypeId, hrLeaveTypes.id))
    .where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.id, leaveId)))
    .limit(1);
  return record;
}

export async function createLeaveRequest(orgId: string, data: any) {
  const totalDays = data.isHalfDay ? 0.5 : data.totalDays;
  const [record] = await db.insert(hrLeaveRequests).values({
    orgId,
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    startDate: data.startDate,
    endDate: data.endDate,
    totalDays: data.totalDays,
    isHalfDay: data.isHalfDay || false,
    reason: data.reason,
    remarks: data.remarks,
  }).returning();
  const year = new Date(data.startDate).getFullYear();
  await db.insert(hrLeaveBalances).values({
    orgId,
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    year,
    pendingDays: totalDays,
    usedDays: 0,
    totalDays: 0,
  }).onConflictDoUpdate({
    target: [hrLeaveBalances.orgId, hrLeaveBalances.employeeId, hrLeaveBalances.leaveTypeId, hrLeaveBalances.year],
    set: { pendingDays: sql`${hrLeaveBalances.pendingDays} + ${totalDays}`, updatedAt: sql`now()` },
  });
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'leave_request', entityId: record.id, description: `Leave request created (${totalDays} days)`, newValues: record });
  try { await createApprovalRequest(orgId, { module: 'leave_request', sourceId: record.id, requesterId: data.employeeId, title: `Leave Request (${totalDays} days)`, description: data.reason, userId: data.userId }); } catch (e) { /* approval engine not configured */ }
  try { await dispatchEvent(orgId, 'leave.created', record.id, { employeeId: data.employeeId, leaveTypeId: data.leaveTypeId, startDate: data.startDate, endDate: data.endDate, reason: data.reason, status: record.status, daysRequested: record.daysRequested }, userId); } catch (e) { console.error('[WF] dispatch leave.created error:', e); }
  return record;
}

export async function approveLeaveRequest(orgId: string, leaveId: string, approvedBy: string, remarks?: string) {
  const [old] = await db.select().from(hrLeaveRequests).where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.id, leaveId))).limit(1);
  if (!old || old.status !== 'pending') throw new Error('Leave request not found or not pending');
  const [record] = await db.update(hrLeaveRequests).set({
    status: 'approved' as any,
    approvedBy,
    approvedAt: sql`now()`,
    remarks: remarks || old.remarks,
    updatedAt: sql`now()`,
  }).where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.id, leaveId))).returning();
  const year = new Date(old.startDate).getFullYear();
  const days = old.isHalfDay ? 0.5 : old.totalDays;
  await db.update(hrLeaveBalances).set({
    pendingDays: sql`GREATEST(${hrLeaveBalances.pendingDays} - ${days}, 0)`,
    usedDays: sql`${hrLeaveBalances.usedDays} + ${days}`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(hrLeaveBalances.orgId, orgId),
    eq(hrLeaveBalances.employeeId, old.employeeId),
    eq(hrLeaveBalances.leaveTypeId, old.leaveTypeId),
    eq(hrLeaveBalances.year, year),
  ));
  await createAuditLog({ orgId, userId: approvedBy, action: 'approve', entityType: 'leave_request', entityId: leaveId, description: 'Leave request approved', oldValues: old, newValues: record });
  return record;
}

export async function rejectLeaveRequest(orgId: string, leaveId: string, reason: string) {
  const [old] = await db.select().from(hrLeaveRequests).where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.id, leaveId))).limit(1);
  if (!old || old.status !== 'pending') throw new Error('Leave request not found or not pending');
  const [record] = await db.update(hrLeaveRequests).set({
    status: 'rejected' as any,
    rejectionReason: reason,
    updatedAt: sql`now()`,
  }).where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.id, leaveId))).returning();
  const year = new Date(old.startDate).getFullYear();
  const days = old.isHalfDay ? 0.5 : old.totalDays;
  await db.update(hrLeaveBalances).set({
    pendingDays: sql`GREATEST(${hrLeaveBalances.pendingDays} - ${days}, 0)`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(hrLeaveBalances.orgId, orgId),
    eq(hrLeaveBalances.employeeId, old.employeeId),
    eq(hrLeaveBalances.leaveTypeId, old.leaveTypeId),
    eq(hrLeaveBalances.year, year),
  ));
  await createAuditLog({ orgId, userId: 'system', action: 'reject', entityType: 'leave_request', entityId: leaveId, description: `Leave request rejected: ${reason}`, oldValues: old, newValues: record });
  return record;
}

export async function cancelLeaveRequest(orgId: string, leaveId: string) {
  const [old] = await db.select().from(hrLeaveRequests).where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.id, leaveId))).limit(1);
  if (!old) throw new Error('Leave request not found');
  if (old.recalledAt) throw new Error('Leave request has already been recalled');
  const [record] = await db.update(hrLeaveRequests).set({
    status: 'cancelled' as any,
    updatedAt: sql`now()`,
  }).where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.id, leaveId))).returning();
  const year = new Date(old.startDate).getFullYear();
  const days = old.isHalfDay ? 0.5 : old.totalDays;
  if (old.status === 'pending') {
    await db.update(hrLeaveBalances).set({
      pendingDays: sql`GREATEST(${hrLeaveBalances.pendingDays} - ${days}, 0)`,
      updatedAt: sql`now()`,
    }).where(and(
      eq(hrLeaveBalances.orgId, orgId),
      eq(hrLeaveBalances.employeeId, old.employeeId),
      eq(hrLeaveBalances.leaveTypeId, old.leaveTypeId),
      eq(hrLeaveBalances.year, year),
    ));
  } else if (old.status === 'approved') {
    await db.update(hrLeaveBalances).set({
      usedDays: sql`GREATEST(${hrLeaveBalances.usedDays} - ${days}, 0)`,
      updatedAt: sql`now()`,
    }).where(and(
      eq(hrLeaveBalances.orgId, orgId),
      eq(hrLeaveBalances.employeeId, old.employeeId),
      eq(hrLeaveBalances.leaveTypeId, old.leaveTypeId),
      eq(hrLeaveBalances.year, year),
    ));
  }
  await createAuditLog({ orgId, userId: 'system', action: 'cancel', entityType: 'leave_request', entityId: leaveId, description: 'Leave request cancelled', oldValues: old, newValues: record });
  return record;
}

// ── Leave Recall ──

export async function recallLeaveRequest(orgId: string, leaveId: string, recalledById: string) {
  const [old] = await db.select().from(hrLeaveRequests).where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.id, leaveId))).limit(1);
  if (!old) throw new Error('Leave request not found');
  if (old.status !== 'approved') throw new Error('Only approved leave requests can be recalled');
  if (old.recalledAt) throw new Error('Leave request has already been recalled');
  const [record] = await db.update(hrLeaveRequests).set({
    status: 'cancelled' as any,
    recalledAt: sql`now()`,
    recalledById,
    updatedAt: sql`now()`,
  }).where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.id, leaveId))).returning();
  const year = new Date(old.startDate).getFullYear();
  const days = old.isHalfDay ? 0.5 : old.totalDays;
  await db.update(hrLeaveBalances).set({
    usedDays: sql`GREATEST(${hrLeaveBalances.usedDays} - ${days}, 0)`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(hrLeaveBalances.orgId, orgId),
    eq(hrLeaveBalances.employeeId, old.employeeId),
    eq(hrLeaveBalances.leaveTypeId, old.leaveTypeId),
    eq(hrLeaveBalances.year, year),
  ));
  await createAuditLog({ orgId, userId: recalledById, action: 'recall', entityType: 'leave_request', entityId: leaveId, description: 'Leave request recalled', oldValues: old, newValues: record });
  return record;
}

// ── Leave Balances ──

export async function getLeaveBalances(orgId: string, employeeId?: string, year?: number) {
  const conditions: any[] = [eq(hrLeaveBalances.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrLeaveBalances.employeeId, employeeId));
  if (year) conditions.push(eq(hrLeaveBalances.year, year));
  return db.select({
    id: hrLeaveBalances.id,
    orgId: hrLeaveBalances.orgId,
    employeeId: hrLeaveBalances.employeeId,
    leaveTypeId: hrLeaveBalances.leaveTypeId,
    year: hrLeaveBalances.year,
    totalDays: hrLeaveBalances.totalDays,
    usedDays: hrLeaveBalances.usedDays,
    pendingDays: hrLeaveBalances.pendingDays,
    carriedForward: hrLeaveBalances.carriedForward,
    accruedDays: hrLeaveBalances.accruedDays,
    availableDays: hrLeaveBalances.availableDays,
    lastAccrualDate: hrLeaveBalances.lastAccrualDate,
    createdAt: hrLeaveBalances.createdAt,
    updatedAt: hrLeaveBalances.updatedAt,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
    leaveTypeName: hrLeaveTypes.name,
    leaveTypeColor: hrLeaveTypes.color,
  }).from(hrLeaveBalances)
    .leftJoin(hrEmployees, eq(hrLeaveBalances.employeeId, hrEmployees.id))
    .leftJoin(hrLeaveTypes, eq(hrLeaveBalances.leaveTypeId, hrLeaveTypes.id))
    .where(and(...conditions))
    .orderBy(desc(hrLeaveBalances.year));
}

export async function allocateLeaveBalance(orgId: string, data: any) {
  const payload = {
    orgId,
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    year: data.year,
    totalDays: data.totalDays ?? 0,
    usedDays: data.usedDays ?? 0,
    pendingDays: data.pendingDays ?? 0,
    carriedForward: data.carriedForward ?? 0,
    accruedDays: data.accruedDays ?? '0',
    availableDays: data.availableDays ?? '0',
  };
  const [record] = await db.insert(hrLeaveBalances).values(payload).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'leave_balance', entityId: record.id, description: `Leave balance allocated for year ${data.year}`, newValues: record });
  try { await dispatchEvent(orgId, 'leave_balance.allocated', record.id, { employeeId: data.employeeId, leaveTypeId: data.leaveTypeId, daysAllocated: data.daysAllocated }, userId); } catch (e) { console.error('[WF] dispatch leave_balance.allocated error:', e); }
  return record;
}

export async function recalculateLeaveBalance(orgId: string, employeeId: string, leaveTypeId: string, year: number) {
  const requests = await db.select({
    status: hrLeaveRequests.status,
    totalDays: hrLeaveRequests.totalDays,
    isHalfDay: hrLeaveRequests.isHalfDay,
  }).from(hrLeaveRequests)
    .where(and(
      eq(hrLeaveRequests.orgId, orgId),
      eq(hrLeaveRequests.employeeId, employeeId),
      eq(hrLeaveRequests.leaveTypeId, leaveTypeId),
      sql`EXTRACT(YEAR FROM ${hrLeaveRequests.startDate}) = ${year}`,
    ));
  let usedDays = 0;
  let pendingDays = 0;
  for (const r of requests) {
    const days = r.isHalfDay ? 0.5 : r.totalDays;
    if (r.status === 'approved') usedDays += days;
    else if (r.status === 'pending') pendingDays += days;
  }
  const [record] = await db.update(hrLeaveBalances).set({
    usedDays,
    pendingDays,
    updatedAt: sql`now()`,
  }).where(and(
    eq(hrLeaveBalances.orgId, orgId),
    eq(hrLeaveBalances.employeeId, employeeId),
    eq(hrLeaveBalances.leaveTypeId, leaveTypeId),
    eq(hrLeaveBalances.year, year),
  )).returning();
  return record;
}

// ── Leave Accrual Engine ──

export async function runLeaveAccrual(orgId: string, period: string) {
  const employees = await db.select({ id: hrEmployees.id }).from(hrEmployees).where(eq(hrEmployees.orgId, orgId));
  const leaveTypes = await db.select().from(hrLeaveTypes).where(and(eq(hrLeaveTypes.orgId, orgId), eq(hrLeaveTypes.isActive, true)));
  const year = new Date().getFullYear();
  let totalAccrued = 0;
  let processed = 0;

  for (const emp of employees) {
    for (const lt of leaveTypes) {
      if (!lt.accrualRate || Number(lt.accrualRate) <= 0) continue;
      const rate = Number(lt.accrualRate);
      let accrualAmount = 0;
      if (lt.accrualFrequency === 'monthly') {
        accrualAmount = rate;
      } else if (lt.accrualFrequency === 'yearly') {
        accrualAmount = rate / 12;
      }
      if (accrualAmount <= 0) continue;

      const [existing] = await db.select()
        .from(hrLeaveBalances)
        .where(and(
          eq(hrLeaveBalances.orgId, orgId),
          eq(hrLeaveBalances.employeeId, emp.id),
          eq(hrLeaveBalances.leaveTypeId, lt.id),
          eq(hrLeaveBalances.year, year),
        ))
        .limit(1);

      if (existing) {
        const currentAccrued = Number(existing.accruedDays || 0);
        const newAccrued = currentAccrued + accrualAmount;
        const totalAllocation = Number(existing.totalDays || 0) + accrualAmount;
        await db.update(hrLeaveBalances).set({
          accruedDays: String(newAccrued),
          totalDays: sql`${hrLeaveBalances.availableDays}::numeric + ${accrualAmount}`,
          availableDays: sql`${hrLeaveBalances.availableDays}::numeric + ${accrualAmount}`,
          lastAccrualDate: sql`now()`,
          updatedAt: sql`now()`,
        }).where(eq(hrLeaveBalances.id, existing.id));
      } else {
        await db.insert(hrLeaveBalances).values({
          orgId,
          employeeId: emp.id,
          leaveTypeId: lt.id,
          year,
          totalDays: accrualAmount,
          accruedDays: String(accrualAmount),
          availableDays: String(accrualAmount),
          lastAccrualDate: sql`now()`,
        });
      }
      totalAccrued += accrualAmount;
    }
    processed++;
  }

  const [log] = await db.insert(hrLeaveAccrualLogs).values({
    orgId,
    period,
    status: 'completed',
    employeesProcessed: processed,
    totalAccrued: String(totalAccrued),
    notes: `Accrual run for ${period}: ${processed} employees, ${totalAccrued.toFixed(2)} total days accrued`,
  }).returning();

  return log;
}

export async function getAccrualLogs(orgId: string) {
  return db.select().from(hrLeaveAccrualLogs)
    .where(eq(hrLeaveAccrualLogs.orgId, orgId))
    .orderBy(desc(hrLeaveAccrualLogs.runDate));
}

// ── Leave Calendar ──

export async function getLeaveCalendar(orgId: string, dateFrom?: string, dateTo?: string, employeeId?: string) {
  const conditions: any[] = [
    eq(hrLeaveRequests.orgId, orgId),
    or(eq(hrLeaveRequests.status, 'approved' as any), eq(hrLeaveRequests.status, 'pending' as any)),
  ];
  if (dateFrom) conditions.push(gte(hrLeaveRequests.startDate, dateFrom));
  if (dateTo) conditions.push(lte(hrLeaveRequests.endDate, dateTo));
  if (employeeId) conditions.push(eq(hrLeaveRequests.employeeId, employeeId));

  const leaves = await db.select({
    id: hrLeaveRequests.id,
    employeeId: hrLeaveRequests.employeeId,
    leaveTypeId: hrLeaveRequests.leaveTypeId,
    startDate: hrLeaveRequests.startDate,
    endDate: hrLeaveRequests.endDate,
    totalDays: hrLeaveRequests.totalDays,
    isHalfDay: hrLeaveRequests.isHalfDay,
    status: hrLeaveRequests.status,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
    leaveTypeName: hrLeaveTypes.name,
    leaveTypeColor: hrLeaveTypes.color,
  }).from(hrLeaveRequests)
    .leftJoin(hrEmployees, eq(hrLeaveRequests.employeeId, hrEmployees.id))
    .leftJoin(hrLeaveTypes, eq(hrLeaveRequests.leaveTypeId, hrLeaveTypes.id))
    .where(and(...conditions))
    .orderBy(asc(hrLeaveRequests.startDate));

  const holidays = await db.select().from(hrHolidays)
    .where(and(eq(hrHolidays.orgId, orgId), eq(hrHolidays.isActive, true)))
    .orderBy(hrHolidays.date);

  return { leaves, holidays };
}

// ── Leave Reports ──

export async function getLeaveReport(orgId: string, year?: number) {
  const y = year || new Date().getFullYear();
  const totalEmployees = await db.select({ count: count() }).from(hrEmployees).where(eq(hrEmployees.orgId, orgId)).then(r => Number(r[0]?.count) || 0);
  const leaveTypes = await db.select().from(hrLeaveTypes).where(eq(hrLeaveTypes.orgId, orgId));

  const typeStats: any[] = [];
  for (const lt of leaveTypes) {
    const approved = await db.select({ count: count(), total: sql`COALESCE(SUM(${hrLeaveRequests.totalDays}), 0)` }).from(hrLeaveRequests)
      .where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.leaveTypeId, lt.id), eq(hrLeaveRequests.status, 'approved' as any), sql`EXTRACT(YEAR FROM ${hrLeaveRequests.startDate}) = ${y}`))
      .then(r => ({ count: Number(r[0]?.count) || 0, totalDays: Number(r[0]?.total) || 0 }));
    const pending = await db.select({ count: count(), total: sql`COALESCE(SUM(${hrLeaveRequests.totalDays}), 0)` }).from(hrLeaveRequests)
      .where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.leaveTypeId, lt.id), eq(hrLeaveRequests.status, 'pending' as any), sql`EXTRACT(YEAR FROM ${hrLeaveRequests.startDate}) = ${y}`))
      .then(r => ({ count: Number(r[0]?.count) || 0, totalDays: Number(r[0]?.total) || 0 }));
    typeStats.push({
      leaveTypeId: lt.id,
      leaveTypeName: lt.name,
      color: lt.color,
      approvedCount: approved.count,
      approvedDays: approved.totalDays,
      pendingCount: pending.count,
      pendingDays: pending.totalDays,
    });
  }

  const monthlyBreakdown: any[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthStr = String(m).padStart(2, '0');
    const result = await db.select({
      total: sql`COALESCE(SUM(${hrLeaveRequests.totalDays}), 0)`,
      count: count(),
    }).from(hrLeaveRequests)
      .where(and(
        eq(hrLeaveRequests.orgId, orgId),
        eq(hrLeaveRequests.status, 'approved' as any),
        sql`EXTRACT(YEAR FROM ${hrLeaveRequests.startDate}) = ${y}`,
        sql`EXTRACT(MONTH FROM ${hrLeaveRequests.startDate}) = ${m}`,
      )).then(r => ({ totalDays: Number(r[0]?.total) || 0, count: Number(r[0]?.count) || 0 }));
    monthlyBreakdown.push({ month: m, monthName: new Date(2024, m - 1, 1).toLocaleString('default', { month: 'long' }), count: result.count, totalDays: result.totalDays });
  }

  return {
    year: y,
    totalEmployees,
    totalLeaveTypes: leaveTypes.length,
    typeStats,
    monthlyBreakdown,
  };
}

// ── Attendance ──

export interface AttendanceFilters { employeeId?: string; dateFrom?: string; dateTo?: string; status?: string; shiftId?: string; isLate?: boolean; isRemote?: boolean; }

export async function getAttendanceRecords(orgId: string, filters?: AttendanceFilters) {
  const conditions: any[] = [eq(hrAttendanceRecords.orgId, orgId)];
  if (filters?.employeeId) conditions.push(eq(hrAttendanceRecords.employeeId, filters.employeeId));
  if (filters?.dateFrom) conditions.push(gte(hrAttendanceRecords.date, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(hrAttendanceRecords.date, filters.dateTo));
  if (filters?.status) conditions.push(eq(hrAttendanceRecords.status, filters.status as any));
  if (filters?.shiftId) conditions.push(eq(hrAttendanceRecords.shiftId, filters.shiftId));
  if (filters?.isLate !== undefined) conditions.push(eq(hrAttendanceRecords.isLate, filters.isLate));
  if (filters?.isRemote !== undefined) conditions.push(eq(hrAttendanceRecords.isRemote, filters.isRemote));
  return db.select({
    id: hrAttendanceRecords.id,
    orgId: hrAttendanceRecords.orgId,
    employeeId: hrAttendanceRecords.employeeId,
    date: hrAttendanceRecords.date,
    clockIn: hrAttendanceRecords.clockIn,
    clockOut: hrAttendanceRecords.clockOut,
    breakStart: hrAttendanceRecords.breakStart,
    breakEnd: hrAttendanceRecords.breakEnd,
    totalBreakMinutes: hrAttendanceRecords.totalBreakMinutes,
    isRemote: hrAttendanceRecords.isRemote,
    gpsLatitude: hrAttendanceRecords.gpsLatitude,
    gpsLongitude: hrAttendanceRecords.gpsLongitude,
    biometricVerified: hrAttendanceRecords.biometricVerified,
    overtimeMinutes: hrAttendanceRecords.overtimeMinutes,
    isLate: hrAttendanceRecords.isLate,
    lateMinutes: hrAttendanceRecords.lateMinutes,
    isEarlyDeparture: hrAttendanceRecords.isEarlyDeparture,
    earlyDepartureMinutes: hrAttendanceRecords.earlyDepartureMinutes,
    shiftId: hrAttendanceRecords.shiftId,
    status: hrAttendanceRecords.status,
    notes: hrAttendanceRecords.notes,
    createdAt: hrAttendanceRecords.createdAt,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
    shiftName: hrShifts.name,
  }).from(hrAttendanceRecords)
    .leftJoin(hrEmployees, eq(hrAttendanceRecords.employeeId, hrEmployees.id))
    .leftJoin(hrShifts, eq(hrAttendanceRecords.shiftId, hrShifts.id))
    .where(and(...conditions))
    .orderBy(desc(hrAttendanceRecords.date));
}

export async function getAttendanceRecord(orgId: string, recordId: string) {
  const [record] = await db.select({
    id: hrAttendanceRecords.id,
    orgId: hrAttendanceRecords.orgId,
    employeeId: hrAttendanceRecords.employeeId,
    date: hrAttendanceRecords.date,
    clockIn: hrAttendanceRecords.clockIn,
    clockOut: hrAttendanceRecords.clockOut,
    breakStart: hrAttendanceRecords.breakStart,
    breakEnd: hrAttendanceRecords.breakEnd,
    totalBreakMinutes: hrAttendanceRecords.totalBreakMinutes,
    isRemote: hrAttendanceRecords.isRemote,
    overtimeMinutes: hrAttendanceRecords.overtimeMinutes,
    isLate: hrAttendanceRecords.isLate,
    lateMinutes: hrAttendanceRecords.lateMinutes,
    isEarlyDeparture: hrAttendanceRecords.isEarlyDeparture,
    earlyDepartureMinutes: hrAttendanceRecords.earlyDepartureMinutes,
    shiftId: hrAttendanceRecords.shiftId,
    status: hrAttendanceRecords.status,
    notes: hrAttendanceRecords.notes,
    approvedBy: hrAttendanceRecords.approvedBy,
    approvedAt: hrAttendanceRecords.approvedAt,
    createdAt: hrAttendanceRecords.createdAt,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
    shiftName: hrShifts.name,
  }).from(hrAttendanceRecords)
    .leftJoin(hrEmployees, eq(hrAttendanceRecords.employeeId, hrEmployees.id))
    .leftJoin(hrShifts, eq(hrAttendanceRecords.shiftId, hrShifts.id))
    .where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.id, recordId)))
    .limit(1);
  return record;
}

export async function getTodayAttendance(orgId: string, employeeId: string) {
  const today = new Date().toISOString().split('T')[0];
  const [record] = await db.select().from(hrAttendanceRecords)
    .where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.employeeId, employeeId), eq(hrAttendanceRecords.date, today)))
    .limit(1);
  if (!record) return null;
  const employee = await db.select({ firstName: hrEmployees.firstName, lastName: hrEmployees.lastName }).from(hrEmployees).where(eq(hrEmployees.id, employeeId)).limit(1).then(r => r[0]);
  return { ...record, employeeName: employee ? `${employee.firstName} ${employee.lastName}` : '' };
}

export async function clockIn(orgId: string, employeeId: string, data?: any) {
  const today = new Date().toISOString().split('T')[0];
  const [existing] = await db.select().from(hrAttendanceRecords)
    .where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.employeeId, employeeId), eq(hrAttendanceRecords.date, today)))
    .limit(1);
  if (existing) throw new Error('Already clocked in today');
  const [assignment] = await db.select().from(hrShiftAssignments)
    .where(and(eq(hrShiftAssignments.orgId, orgId), eq(hrShiftAssignments.employeeId, employeeId), eq(hrShiftAssignments.isActive, true), lte(hrShiftAssignments.effectiveDate, today), sql`(${hrShiftAssignments.endDate} IS NULL OR ${hrShiftAssignments.endDate} >= ${today})`))
    .limit(1);
  const shiftId = data?.shiftId || assignment?.shiftId || null;
  const [record] = await db.insert(hrAttendanceRecords).values({
    orgId,
    employeeId,
    date: today,
    clockIn: sql`now()`,
    shiftId,
    isRemote: data?.isRemote || false,
    gpsLatitude: data?.gpsLatitude || null,
    gpsLongitude: data?.gpsLongitude || null,
    biometricVerified: data?.biometricVerified || false,
    status: 'present',
    notes: data?.notes || null,
  }).returning();
  await createAuditLog({ orgId, userId: 'system', action: 'clock_in', entityType: 'attendance', entityId: record.id, description: 'Employee clocked in', newValues: record });
  return record;
}

export async function clockOut(orgId: string, employeeId: string, data?: any) {
  const today = new Date().toISOString().split('T')[0];
  const [existing] = await db.select().from(hrAttendanceRecords)
    .where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.employeeId, employeeId), eq(hrAttendanceRecords.date, today)))
    .limit(1);
  if (!existing) throw new Error('No clock-in record found for today');
  if (existing.clockOut) throw new Error('Already clocked out today');
  const updateData: any = { clockOut: sql`now()` };
  if (data?.notes) updateData.notes = data.notes;
  const [record] = await db.update(hrAttendanceRecords).set(updateData)
    .where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.employeeId, employeeId), eq(hrAttendanceRecords.date, today)))
    .returning();
  await autoCalculateAttendance(orgId, record.id);
  await createAuditLog({ orgId, userId: 'system', action: 'clock_out', entityType: 'attendance', entityId: existing.id, description: 'Employee clocked out' });
  return record;
}

export async function breakIn(orgId: string, employeeId: string) {
  const today = new Date().toISOString().split('T')[0];
  const [existing] = await db.select().from(hrAttendanceRecords)
    .where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.employeeId, employeeId), eq(hrAttendanceRecords.date, today)))
    .limit(1);
  if (!existing) throw new Error('No clock-in record found for today');
  if (!existing.clockIn) throw new Error('Must clock in first');
  if (existing.breakStart && !existing.breakEnd) throw new Error('Already on break');
  if (existing.clockOut) throw new Error('Already clocked out');
  const [record] = await db.update(hrAttendanceRecords).set({
    breakStart: sql`now()`,
    updatedAt: sql`now()`,
  }).where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.employeeId, employeeId), eq(hrAttendanceRecords.date, today)))
    .returning();
  await createAuditLog({ orgId, userId: 'system', action: 'break_in', entityType: 'attendance', entityId: existing.id, description: 'Break started' });
  return record;
}

export async function breakOut(orgId: string, employeeId: string) {
  const today = new Date().toISOString().split('T')[0];
  const [existing] = await db.select().from(hrAttendanceRecords)
    .where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.employeeId, employeeId), eq(hrAttendanceRecords.date, today)))
    .limit(1);
  if (!existing) throw new Error('No clock-in record found for today');
  if (!existing.breakStart) throw new Error('No break started');
  if (existing.breakEnd) throw new Error('Already returned from break');
  const breakMinutes = Math.round((Date.now() - new Date(existing.breakStart).getTime()) / 60000);
  const totalBreak = (existing.totalBreakMinutes || 0) + breakMinutes;
  const [record] = await db.update(hrAttendanceRecords).set({
    breakEnd: sql`now()`,
    totalBreakMinutes: totalBreak,
    updatedAt: sql`now()`,
  }).where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.employeeId, employeeId), eq(hrAttendanceRecords.date, today)))
    .returning();
  await createAuditLog({ orgId, userId: 'system', action: 'break_out', entityType: 'attendance', entityId: existing.id, description: `Break ended (${breakMinutes} min)` });
  return record;
}

export async function updateAttendance(orgId: string, recordId: string, data: any) {
  const [old] = await db.select().from(hrAttendanceRecords).where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.id, recordId))).limit(1);
  if (!old) throw new Error('Attendance record not found');
  const [record] = await db.update(hrAttendanceRecords).set({ ...data, updatedAt: sql`now()` }).where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.id, recordId))).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'attendance', entityId: recordId, description: 'Attendance updated', oldValues: old, newValues: record });
  return record;
}

export async function approveAttendance(orgId: string, recordId: string, approvedBy: string) {
  const [old] = await db.select().from(hrAttendanceRecords).where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.id, recordId))).limit(1);
  if (!old) throw new Error('Attendance record not found');
  const [record] = await db.update(hrAttendanceRecords).set({ approvedBy, approvedAt: sql`now()`, updatedAt: sql`now()` }).where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.id, recordId))).returning();
  await createAuditLog({ orgId, userId: approvedBy, action: 'approve', entityType: 'attendance', entityId: recordId, description: 'Attendance approved', oldValues: old, newValues: record });
  return record;
}

export async function autoCalculateAttendance(orgId: string, recordId: string) {
  const [record] = await db.select().from(hrAttendanceRecords).where(and(eq(hrAttendanceRecords.orgId, orgId), eq(hrAttendanceRecords.id, recordId))).limit(1);
  if (!record || !record.clockIn || !record.clockOut) return record;
  const clockInDate = new Date(record.clockIn);
  const clockOutDate = new Date(record.clockOut);
  const totalMinutes = Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 60000);
  const breakMinutes = record.totalBreakMinutes || 0;
  const workMinutes = totalMinutes - breakMinutes;
  let isLate = false;
  let lateMinutes = 0;
  let isEarlyDeparture = false;
  let earlyDepartureMinutes = 0;
  let overtimeMinutes = 0;
  if (record.shiftId) {
    const [shift] = await db.select().from(hrShifts).where(eq(hrShifts.id, record.shiftId)).limit(1);
    if (shift) {
      const [sh, sm] = shift.startTime.split(':').map(Number);
      const [eh, em] = shift.endTime.split(':').map(Number);
      const shiftStart = new Date(clockInDate); shiftStart.setHours(sh, sm, 0, 0);
      const shiftEnd = new Date(clockOutDate); shiftEnd.setHours(eh, em, 0, 0);
      if (clockInDate.getTime() > shiftStart.getTime() + (shift.gracePeriod || 0) * 60000) {
        isLate = true;
        lateMinutes = Math.round((clockInDate.getTime() - shiftStart.getTime()) / 60000);
      }
      const requiredMinutes = (shiftEnd.getTime() - shiftStart.getTime()) / 60000 - (shift.breakDuration || 60);
      if (workMinutes < requiredMinutes - 10) {
        isEarlyDeparture = true;
        earlyDepartureMinutes = Math.round((requiredMinutes - workMinutes));
      } else if (workMinutes > requiredMinutes + 10) {
        overtimeMinutes = Math.round(workMinutes - requiredMinutes);
      }
    }
  }
  let status = record.status;
  if (!record.clockOut) {
    status = 'present';
  } else if (isLate && !isEarlyDeparture && workMinutes >= 480) {
    status = 'late';
  }
  const [updated] = await db.update(hrAttendanceRecords).set({
    isLate, lateMinutes, isEarlyDeparture, earlyDepartureMinutes, overtimeMinutes,
    status: status as any, updatedAt: sql`now()`,
  }).where(eq(hrAttendanceRecords.id, recordId)).returning();
  return updated;
}

export async function recalculateAllAttendance(orgId: string, dateFrom?: string, dateTo?: string) {
  const conditions: any[] = [eq(hrAttendanceRecords.orgId, orgId)];
  if (dateFrom) conditions.push(gte(hrAttendanceRecords.date, dateFrom));
  if (dateTo) conditions.push(lte(hrAttendanceRecords.date, dateTo));
  const records = await db.select({ id: hrAttendanceRecords.id }).from(hrAttendanceRecords).where(and(...conditions));
  const results: any[] = [];
  for (const r of records) {
    const updated = await autoCalculateAttendance(orgId, r.id);
    results.push(updated);
  }
  return { processed: results.length };
}

export async function getAttendanceSummary(orgId: string, employeeId?: string, dateFrom?: string, dateTo?: string) {
  const conditions: any[] = [eq(hrAttendanceRecords.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrAttendanceRecords.employeeId, employeeId));
  if (dateFrom) conditions.push(gte(hrAttendanceRecords.date, dateFrom));
  if (dateTo) conditions.push(lte(hrAttendanceRecords.date, dateTo));
  const records = await db.select().from(hrAttendanceRecords).where(and(...conditions));
  let totalPresent = 0, totalAbsent = 0, totalLate = 0, totalHalfDays = 0, totalRemote = 0;
  let totalWorkMinutes = 0, totalOvertimeMinutes = 0, totalLateMinutes = 0;
  for (const r of records) {
    if (r.status === 'present') totalPresent++;
    else if (r.status === 'absent') totalAbsent++;
    else if (r.status === 'late') totalLate++;
    else if (r.status === 'half_day') totalHalfDays++;
    if (r.isRemote) totalRemote++;
    if (r.clockIn && r.clockOut) {
      const mins = (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 60000;
      totalWorkMinutes += mins - (r.totalBreakMinutes || 0);
    }
    totalOvertimeMinutes += r.overtimeMinutes || 0;
    totalLateMinutes += r.lateMinutes || 0;
  }
  return {
    totalPresent, totalAbsent, totalLate, totalHalfDays, totalRemote,
    totalWorkHours: Math.round(totalWorkMinutes / 60 * 100) / 100,
    totalOvertimeHours: Math.round(totalOvertimeMinutes / 60 * 100) / 100,
    totalLateHours: Math.round(totalLateMinutes / 60 * 100) / 100,
    totalRecords: records.length,
  };
}

export async function getAttendanceReport(orgId: string, dateFrom: string, dateTo: string) {
  const employees = await db.select({ id: hrEmployees.id, firstName: hrEmployees.firstName, lastName: hrEmployees.lastName }).from(hrEmployees).where(eq(hrEmployees.orgId, orgId));
  const reportRows: any[] = [];
  for (const emp of employees) {
    const summary = await getAttendanceSummary(orgId, emp.id, dateFrom, dateTo);
    reportRows.push({
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      ...summary,
    });
  }
  const totals = reportRows.reduce((acc, r) => ({
    totalPresent: acc.totalPresent + r.totalPresent,
    totalAbsent: acc.totalAbsent + r.totalAbsent,
    totalLate: acc.totalLate + r.totalLate,
    totalHalfDays: acc.totalHalfDays + r.totalHalfDays,
    totalOvertimeHours: acc.totalOvertimeHours + r.totalOvertimeHours,
    totalWorkHours: acc.totalWorkHours + r.totalWorkHours,
  }), { totalPresent: 0, totalAbsent: 0, totalLate: 0, totalHalfDays: 0, totalOvertimeHours: 0, totalWorkHours: 0 });
  return { rows: reportRows, totals, dateFrom, dateTo };
}

export async function generateTimesheetsFromAttendance(orgId: string, weekStart: string, weekEnd: string, employeeId?: string) {
  const conditions: any[] = [
    eq(hrAttendanceRecords.orgId, orgId),
    gte(hrAttendanceRecords.date, weekStart),
    lte(hrAttendanceRecords.date, weekEnd),
  ];
  if (employeeId) conditions.push(eq(hrAttendanceRecords.employeeId, employeeId));
  const records = await db.select().from(hrAttendanceRecords).where(and(...conditions));
  const grouped: Record<string, any[]> = {};
  for (const r of records) {
    if (!grouped[r.employeeId]) grouped[r.employeeId] = [];
    grouped[r.employeeId].push(r);
  }
  const results: any[] = [];
  for (const [empId, recs] of Object.entries(grouped)) {
    const totalHours = recs.reduce((sum, r) => {
      if (r.clockIn && r.clockOut) {
        const mins = (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 60000;
        return sum + (mins - (r.totalBreakMinutes || 0)) / 60;
      }
      return sum;
    }, 0);
    const [existing] = await db.select().from(hrTimesheets)
      .where(and(eq(hrTimesheets.orgId, orgId), eq(hrTimesheets.employeeId, empId), eq(hrTimesheets.weekStart, weekStart)))
      .limit(1);
    if (existing) {
      const [updated] = await db.update(hrTimesheets).set({ totalHours: String(Math.round(totalHours * 100) / 100), updatedAt: sql`now()` }).where(eq(hrTimesheets.id, existing.id)).returning();
      results.push(updated);
    } else {
      const [created] = await db.insert(hrTimesheets).values({
        orgId, employeeId: empId, weekStart, weekEnd,
        totalHours: String(Math.round(totalHours * 100) / 100),
      }).returning();
      for (const r of recs) {
        if (r.clockIn && r.clockOut) {
          const mins = (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 60000;
          const hours = (mins - (r.totalBreakMinutes || 0)) / 60;
          await db.insert(hrTimesheetEntries).values({
            orgId, timesheetId: created.id, date: r.date,
            startTime: r.clockIn ? new Date(r.clockIn).toTimeString().slice(0, 5) : null,
            endTime: r.clockOut ? new Date(r.clockOut).toTimeString().slice(0, 5) : null,
            breakDuration: r.totalBreakMinutes || 0,
            hours: String(Math.round(hours * 100) / 100),
            description: `Auto-generated from attendance`,
          });
        }
      }
      results.push(created);
    }
  }
  return { weekStart, weekEnd, generated: results.length };
}

// ── Shift Assignments ──

export async function getShiftAssignments(orgId: string, employeeId?: string, shiftId?: string) {
  const conditions: any[] = [eq(hrShiftAssignments.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrShiftAssignments.employeeId, employeeId));
  if (shiftId) conditions.push(eq(hrShiftAssignments.shiftId, shiftId));
  return db.select({
    id: hrShiftAssignments.id,
    orgId: hrShiftAssignments.orgId,
    employeeId: hrShiftAssignments.employeeId,
    shiftId: hrShiftAssignments.shiftId,
    effectiveDate: hrShiftAssignments.effectiveDate,
    endDate: hrShiftAssignments.endDate,
    isPrimary: hrShiftAssignments.isPrimary,
    assignedBy: hrShiftAssignments.assignedBy,
    reason: hrShiftAssignments.reason,
    isActive: hrShiftAssignments.isActive,
    createdAt: hrShiftAssignments.createdAt,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
    shiftName: hrShifts.name,
  }).from(hrShiftAssignments)
    .leftJoin(hrEmployees, eq(hrShiftAssignments.employeeId, hrEmployees.id))
    .leftJoin(hrShifts, eq(hrShiftAssignments.shiftId, hrShifts.id))
    .where(and(...conditions))
    .orderBy(desc(hrShiftAssignments.effectiveDate));
}

export async function assignShift(orgId: string, data: any) {
  const [record] = await db.insert(hrShiftAssignments).values({
    orgId, employeeId: data.employeeId, shiftId: data.shiftId,
    effectiveDate: data.effectiveDate, endDate: data.endDate || null,
    isPrimary: data.isPrimary ?? true, assignedBy: data.assignedBy || 'system',
    reason: data.reason || null,
  }).returning();
  await createAuditLog({ orgId, userId: data.assignedBy || 'system', action: 'create', entityType: 'shift_assignment', entityId: record.id, description: `Shift assigned`, newValues: record });
  return record;
}

export async function updateShiftAssignment(orgId: string, assignmentId: string, data: any) {
  const [old] = await db.select().from(hrShiftAssignments).where(and(eq(hrShiftAssignments.orgId, orgId), eq(hrShiftAssignments.id, assignmentId))).limit(1);
  const [record] = await db.update(hrShiftAssignments).set({ ...data, updatedAt: sql`now()` }).where(and(eq(hrShiftAssignments.orgId, orgId), eq(hrShiftAssignments.id, assignmentId))).returning();
  if (record) await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'shift_assignment', entityId: assignmentId, description: 'Shift assignment updated', oldValues: old, newValues: record });
  return record;
}

export async function deleteShiftAssignment(orgId: string, assignmentId: string) {
  const [record] = await db.delete(hrShiftAssignments).where(and(eq(hrShiftAssignments.orgId, orgId), eq(hrShiftAssignments.id, assignmentId))).returning();
  if (record) await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'shift_assignment', entityId: assignmentId, description: 'Shift assignment deleted', oldValues: record });
  return record;
}

// ── Shift Rotations ──

export async function getShiftRotations(orgId: string) {
  return db.select().from(hrShiftRotations).where(eq(hrShiftRotations.orgId, orgId)).orderBy(hrShiftRotations.name);
}

export async function getShiftRotation(orgId: string, rotationId: string) {
  const [rotation] = await db.select().from(hrShiftRotations).where(and(eq(hrShiftRotations.orgId, orgId), eq(hrShiftRotations.id, rotationId))).limit(1);
  if (!rotation) return undefined;
  const assignees = await db.select({
    id: hrShiftRotationAssignees.id,
    employeeId: hrShiftRotationAssignees.employeeId,
    shiftId: hrShiftRotationAssignees.shiftId,
    weekOffset: hrShiftRotationAssignees.weekOffset,
    dayOfWeek: hrShiftRotationAssignees.dayOfWeek,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
    shiftName: hrShifts.name,
  }).from(hrShiftRotationAssignees)
    .leftJoin(hrEmployees, eq(hrShiftRotationAssignees.employeeId, hrEmployees.id))
    .leftJoin(hrShifts, eq(hrShiftRotationAssignees.shiftId, hrShifts.id))
    .where(eq(hrShiftRotationAssignees.rotationId, rotationId))
    .orderBy(hrShiftRotationAssignees.weekOffset);
  return { ...rotation, assignees };
}

export async function createShiftRotation(orgId: string, data: any) {
  const [record] = await db.insert(hrShiftRotations).values({ ...data, orgId }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'shift_rotation', entityId: record.id, description: `Created shift rotation: ${record.name}`, newValues: record });
  return record;
}

export async function updateShiftRotation(orgId: string, rotationId: string, data: any) {
  const [old] = await db.select().from(hrShiftRotations).where(and(eq(hrShiftRotations.orgId, orgId), eq(hrShiftRotations.id, rotationId))).limit(1);
  const [record] = await db.update(hrShiftRotations).set({ ...data, updatedAt: sql`now()` }).where(and(eq(hrShiftRotations.orgId, orgId), eq(hrShiftRotations.id, rotationId))).returning();
  if (record) await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'shift_rotation', entityId: rotationId, description: `Updated shift rotation: ${record.name}`, oldValues: old, newValues: record });
  return record;
}

export async function deleteShiftRotation(orgId: string, rotationId: string) {
  const [record] = await db.delete(hrShiftRotations).where(and(eq(hrShiftRotations.orgId, orgId), eq(hrShiftRotations.id, rotationId))).returning();
  if (record) await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'shift_rotation', entityId: rotationId, description: 'Shift rotation deleted', oldValues: record });
  return record;
}

export async function addRotationAssignee(orgId: string, data: any) {
  const [record] = await db.insert(hrShiftRotationAssignees).values({ ...data, orgId }).returning();
  return record;
}

export async function removeRotationAssignee(orgId: string, assigneeId: string) {
  await db.delete(hrShiftRotationAssignees).where(and(eq(hrShiftRotationAssignees.orgId, orgId), eq(hrShiftRotationAssignees.id, assigneeId)));
  return { success: true };
}

// ── Attendance Exceptions ──

export async function getAttendanceExceptions(orgId: string, employeeId?: string) {
  const conditions: any[] = [eq(hrAttendanceExceptions.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrAttendanceExceptions.employeeId, employeeId));
  return db.select({
    id: hrAttendanceExceptions.id,
    orgId: hrAttendanceExceptions.orgId,
    employeeId: hrAttendanceExceptions.employeeId,
    date: hrAttendanceExceptions.date,
    type: hrAttendanceExceptions.type,
    reason: hrAttendanceExceptions.reason,
    status: hrAttendanceExceptions.status,
    approvedBy: hrAttendanceExceptions.approvedBy,
    approvedAt: hrAttendanceExceptions.approvedAt,
    createdAt: hrAttendanceExceptions.createdAt,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
  }).from(hrAttendanceExceptions)
    .leftJoin(hrEmployees, eq(hrAttendanceExceptions.employeeId, hrEmployees.id))
    .where(and(...conditions))
    .orderBy(desc(hrAttendanceExceptions.date));
}

export async function createAttendanceException(orgId: string, data: any) {
  const [record] = await db.insert(hrAttendanceExceptions).values({ ...data, orgId }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'attendance_exception', entityId: record.id, description: `Exception: ${data.type}`, newValues: record });
  return record;
}

export async function approveAttendanceException(orgId: string, exceptionId: string, approvedBy: string) {
  const [old] = await db.select().from(hrAttendanceExceptions).where(and(eq(hrAttendanceExceptions.orgId, orgId), eq(hrAttendanceExceptions.id, exceptionId))).limit(1);
  const [record] = await db.update(hrAttendanceExceptions).set({ status: 'approved', approvedBy, approvedAt: sql`now()`, updatedAt: sql`now()` }).where(and(eq(hrAttendanceExceptions.orgId, orgId), eq(hrAttendanceExceptions.id, exceptionId))).returning();
  await createAuditLog({ orgId, userId: approvedBy, action: 'approve', entityType: 'attendance_exception', entityId: exceptionId, description: 'Exception approved', oldValues: old, newValues: record });
  return record;
}

export async function rejectAttendanceException(orgId: string, exceptionId: string) {
  const [old] = await db.select().from(hrAttendanceExceptions).where(and(eq(hrAttendanceExceptions.orgId, orgId), eq(hrAttendanceExceptions.id, exceptionId))).limit(1);
  const [record] = await db.update(hrAttendanceExceptions).set({ status: 'rejected', updatedAt: sql`now()` }).where(and(eq(hrAttendanceExceptions.orgId, orgId), eq(hrAttendanceExceptions.id, exceptionId))).returning();
  await createAuditLog({ orgId, userId: 'system', action: 'reject', entityType: 'attendance_exception', entityId: exceptionId, description: 'Exception rejected', oldValues: old, newValues: record });
  return record;
}

export async function deleteAttendanceException(orgId: string, exceptionId: string) {
  const [record] = await db.delete(hrAttendanceExceptions).where(and(eq(hrAttendanceExceptions.orgId, orgId), eq(hrAttendanceExceptions.id, exceptionId))).returning();
  if (record) await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'attendance_exception', entityId: exceptionId, description: 'Exception deleted', oldValues: record });
  return record;
}

// ── Overtime Policies ──

export async function getOvertimePolicies(orgId: string) {
  return db.select().from(hrOvertimePolicies).where(eq(hrOvertimePolicies.orgId, orgId));
}

export async function createOvertimePolicy(orgId: string, data: any) {
  const [record] = await db.insert(hrOvertimePolicies).values({ ...data, orgId }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'overtime_policy', entityId: record.id, description: `Created overtime policy: ${record.name}`, newValues: record });
  return record;
}

export async function updateOvertimePolicy(orgId: string, policyId: string, data: any) {
  const [old] = await db.select().from(hrOvertimePolicies).where(and(eq(hrOvertimePolicies.orgId, orgId), eq(hrOvertimePolicies.id, policyId))).limit(1);
  const [record] = await db.update(hrOvertimePolicies).set({ ...data, updatedAt: sql`now()` }).where(and(eq(hrOvertimePolicies.orgId, orgId), eq(hrOvertimePolicies.id, policyId))).returning();
  if (record) await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'overtime_policy', entityId: policyId, description: `Updated overtime policy: ${record.name}`, oldValues: old, newValues: record });
  return record;
}

export async function deleteOvertimePolicy(orgId: string, policyId: string) {
  const [record] = await db.delete(hrOvertimePolicies).where(and(eq(hrOvertimePolicies.orgId, orgId), eq(hrOvertimePolicies.id, policyId))).returning();
  if (record) await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'overtime_policy', entityId: policyId, description: 'Deleted overtime policy', oldValues: record });
  return record;
}

// ── Shifts ──

export async function getShifts(orgId: string) {
  return db.select().from(hrShifts).where(eq(hrShifts.orgId, orgId));
}

export async function getShift(orgId: string, shiftId: string) {
  const [record] = await db.select().from(hrShifts).where(and(eq(hrShifts.orgId, orgId), eq(hrShifts.id, shiftId))).limit(1);
  return record;
}

export async function createShift(orgId: string, data: any) {
  const [record] = await db.insert(hrShifts).values({ ...data, orgId }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'shift', entityId: record.id, description: `Created shift: ${record.name}`, newValues: record });
  return record;
}

export async function updateShift(orgId: string, shiftId: string, data: any) {
  const [old] = await db.select().from(hrShifts).where(and(eq(hrShifts.orgId, orgId), eq(hrShifts.id, shiftId))).limit(1);
  const [record] = await db.update(hrShifts).set(data).where(and(eq(hrShifts.orgId, orgId), eq(hrShifts.id, shiftId))).returning();
  if (record) await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'shift', entityId: shiftId, description: `Updated shift: ${record.name}`, oldValues: old, newValues: record });
  return record;
}

export async function deleteShift(orgId: string, shiftId: string) {
  const [record] = await db.delete(hrShifts).where(and(eq(hrShifts.orgId, orgId), eq(hrShifts.id, shiftId))).returning();
  if (record) await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'shift', entityId: shiftId, description: `Deleted shift: ${record.name}`, oldValues: record });
  return record;
}

// ── Timesheets ──

export interface TimesheetFilters { employeeId?: string; weekStart?: string; status?: string; }

export async function getTimesheets(orgId: string, filters?: TimesheetFilters) {
  const conditions: any[] = [eq(hrTimesheets.orgId, orgId)];
  if (filters?.employeeId) conditions.push(eq(hrTimesheets.employeeId, filters.employeeId));
  if (filters?.weekStart) conditions.push(eq(hrTimesheets.weekStart, filters.weekStart));
  if (filters?.status) conditions.push(eq(hrTimesheets.status, filters.status as any));
  return db.select({
    id: hrTimesheets.id,
    orgId: hrTimesheets.orgId,
    employeeId: hrTimesheets.employeeId,
    weekStart: hrTimesheets.weekStart,
    weekEnd: hrTimesheets.weekEnd,
    totalHours: hrTimesheets.totalHours,
    status: hrTimesheets.status,
    approvedBy: hrTimesheets.approvedBy,
    approvedAt: hrTimesheets.approvedAt,
    notes: hrTimesheets.notes,
    createdAt: hrTimesheets.createdAt,
    updatedAt: hrTimesheets.updatedAt,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
  }).from(hrTimesheets)
    .leftJoin(hrEmployees, eq(hrTimesheets.employeeId, hrEmployees.id))
    .where(and(...conditions))
    .orderBy(desc(hrTimesheets.weekStart));
}

export async function getTimesheet(orgId: string, tsId: string) {
  const [ts] = await db.select({
    id: hrTimesheets.id,
    orgId: hrTimesheets.orgId,
    employeeId: hrTimesheets.employeeId,
    weekStart: hrTimesheets.weekStart,
    weekEnd: hrTimesheets.weekEnd,
    totalHours: hrTimesheets.totalHours,
    status: hrTimesheets.status,
    approvedBy: hrTimesheets.approvedBy,
    approvedAt: hrTimesheets.approvedAt,
    notes: hrTimesheets.notes,
    createdAt: hrTimesheets.createdAt,
    updatedAt: hrTimesheets.updatedAt,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
  }).from(hrTimesheets)
    .leftJoin(hrEmployees, eq(hrTimesheets.employeeId, hrEmployees.id))
    .where(and(eq(hrTimesheets.orgId, orgId), eq(hrTimesheets.id, tsId)))
    .limit(1);
  if (!ts) return undefined;
  const entries = await db.select().from(hrTimesheetEntries)
    .where(eq(hrTimesheetEntries.timesheetId, tsId))
    .orderBy(hrTimesheetEntries.date);
  return { ...ts, entries };
}

export async function createTimesheet(orgId: string, data: any) {
  const entries = data.entries || [];
  const totalHours = entries.reduce((sum: number, e: any) => sum + (parseFloat(e.hours) || 0), 0);
  const [record] = await db.insert(hrTimesheets).values({
    orgId,
    employeeId: data.employeeId,
    weekStart: data.weekStart,
    weekEnd: data.weekEnd,
    totalHours: String(totalHours),
    notes: data.notes,
  }).returning();
  if (entries.length > 0) {
    await db.insert(hrTimesheetEntries).values(
      entries.map((e: any) => ({ ...e, orgId, timesheetId: record.id }))
    );
  }
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'timesheet', entityId: record.id, description: `Timesheet created (week ${data.weekStart})`, newValues: record });
  return record;
}

export async function updateTimesheet(orgId: string, tsId: string, data: any) {
  const [old] = await db.select().from(hrTimesheets).where(and(eq(hrTimesheets.orgId, orgId), eq(hrTimesheets.id, tsId))).limit(1);
  if (!old) throw new Error('Timesheet not found');
  if (data.entries) {
    const totalHours = data.entries.reduce((sum: number, e: any) => sum + (parseFloat(e.hours) || 0), 0);
    data.totalHours = String(totalHours);
  }
  const [record] = await db.update(hrTimesheets).set({ ...data, updatedAt: sql`now()` }).where(and(eq(hrTimesheets.orgId, orgId), eq(hrTimesheets.id, tsId))).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'timesheet', entityId: tsId, description: 'Timesheet updated', oldValues: old, newValues: record });
  return record;
}

async function recalcTimesheetHours(timesheetId: string) {
  const entries = await db.select({ hours: hrTimesheetEntries.hours }).from(hrTimesheetEntries).where(eq(hrTimesheetEntries.timesheetId, timesheetId));
  const totalHours = entries.reduce((sum, e) => sum + (parseFloat(e.hours as string) || 0), 0);
  await db.update(hrTimesheets).set({ totalHours: String(totalHours), updatedAt: sql`now()` }).where(eq(hrTimesheets.id, timesheetId));
}

export async function submitTimesheet(orgId: string, tsId: string) {
  const [old] = await db.select().from(hrTimesheets).where(and(eq(hrTimesheets.orgId, orgId), eq(hrTimesheets.id, tsId))).limit(1);
  if (!old) throw new Error('Timesheet not found');
  const [record] = await db.update(hrTimesheets).set({ status: 'pending' as any, updatedAt: sql`now()` }).where(and(eq(hrTimesheets.orgId, orgId), eq(hrTimesheets.id, tsId))).returning();
  await createAuditLog({ orgId, userId: 'system', action: 'submit', entityType: 'timesheet', entityId: tsId, description: 'Timesheet submitted for approval', oldValues: old, newValues: record });
  return record;
}

export async function approveTimesheet(orgId: string, tsId: string, approvedBy: string) {
  const [old] = await db.select().from(hrTimesheets).where(and(eq(hrTimesheets.orgId, orgId), eq(hrTimesheets.id, tsId))).limit(1);
  if (!old) throw new Error('Timesheet not found');
  const [record] = await db.update(hrTimesheets).set({ status: 'approved' as any, approvedBy, approvedAt: sql`now()`, updatedAt: sql`now()` }).where(and(eq(hrTimesheets.orgId, orgId), eq(hrTimesheets.id, tsId))).returning();
  await createAuditLog({ orgId, userId: approvedBy, action: 'approve', entityType: 'timesheet', entityId: tsId, description: 'Timesheet approved', oldValues: old, newValues: record });
  return record;
}

// ── Timesheet Entries ──

export async function getTimesheetEntries(orgId: string, tsId: string) {
  return db.select().from(hrTimesheetEntries)
    .where(and(eq(hrTimesheetEntries.orgId, orgId), eq(hrTimesheetEntries.timesheetId, tsId)))
    .orderBy(hrTimesheetEntries.date);
}

export async function createTimesheetEntry(orgId: string, data: any) {
  const [record] = await db.insert(hrTimesheetEntries).values({ ...data, orgId }).returning();
  await recalcTimesheetHours(data.timesheetId);
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'timesheet_entry', entityId: record.id, description: 'Timesheet entry created', newValues: record });
  return record;
}

export async function updateTimesheetEntry(orgId: string, entryId: string, data: any) {
  const [old] = await db.select().from(hrTimesheetEntries).where(and(eq(hrTimesheetEntries.orgId, orgId), eq(hrTimesheetEntries.id, entryId))).limit(1);
  if (!old) throw new Error('Timesheet entry not found');
  const [record] = await db.update(hrTimesheetEntries).set(data).where(and(eq(hrTimesheetEntries.orgId, orgId), eq(hrTimesheetEntries.id, entryId))).returning();
  await recalcTimesheetHours(old.timesheetId);
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'timesheet_entry', entityId: entryId, description: 'Timesheet entry updated', oldValues: old, newValues: record });
  return record;
}

export async function deleteTimesheetEntry(orgId: string, entryId: string) {
  const [old] = await db.select().from(hrTimesheetEntries).where(and(eq(hrTimesheetEntries.orgId, orgId), eq(hrTimesheetEntries.id, entryId))).limit(1);
  if (!old) throw new Error('Timesheet entry not found');
  await db.delete(hrTimesheetEntries).where(and(eq(hrTimesheetEntries.orgId, orgId), eq(hrTimesheetEntries.id, entryId)));
  await recalcTimesheetHours(old.timesheetId);
  await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'timesheet_entry', entityId: entryId, description: 'Timesheet entry deleted', oldValues: old });
  return old;
}

// ── Time Dashboard ──

export async function getTimeDashboard(orgId: string) {
  const totalLeaveTypes = await db.select({ count: count() }).from(hrLeaveTypes).where(eq(hrLeaveTypes.orgId, orgId)).then(r => Number(r[0]?.count) || 0);
  const pendingRequests = await db.select({ count: count() }).from(hrLeaveRequests).where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.status, 'pending' as any))).then(r => Number(r[0]?.count) || 0);
  const today = new Date().toISOString().split('T')[0];
  const approvedToday = await db.select({ count: count() }).from(hrLeaveRequests).where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.status, 'approved' as any), gte(hrLeaveRequests.updatedAt, sql`${today}::date`))).then(r => Number(r[0]?.count) || 0);
  const activeShifts = await db.select({ count: count() }).from(hrShifts).where(and(eq(hrShifts.orgId, orgId), eq(hrShifts.isActive, true))).then(r => Number(r[0]?.count) || 0);
  const pendingTimesheets = await db.select({ count: count() }).from(hrTimesheets).where(and(eq(hrTimesheets.orgId, orgId), eq(hrTimesheets.status, 'pending' as any))).then(r => Number(r[0]?.count) || 0);
  const recentRequests = await db.select({
    id: hrLeaveRequests.id,
    employeeId: hrLeaveRequests.employeeId,
    leaveTypeId: hrLeaveRequests.leaveTypeId,
    startDate: hrLeaveRequests.startDate,
    endDate: hrLeaveRequests.endDate,
    totalDays: hrLeaveRequests.totalDays,
    isHalfDay: hrLeaveRequests.isHalfDay,
    status: hrLeaveRequests.status,
    createdAt: hrLeaveRequests.createdAt,
    employeeName: sql`CONCAT(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
    leaveTypeName: hrLeaveTypes.name,
  }).from(hrLeaveRequests)
    .leftJoin(hrEmployees, eq(hrLeaveRequests.employeeId, hrEmployees.id))
    .leftJoin(hrLeaveTypes, eq(hrLeaveRequests.leaveTypeId, hrLeaveTypes.id))
    .where(eq(hrLeaveRequests.orgId, orgId))
    .orderBy(desc(hrLeaveRequests.createdAt))
    .limit(5);
  const upcomingHolidays = await db.select().from(hrHolidays)
    .where(and(eq(hrHolidays.orgId, orgId), eq(hrHolidays.isActive, true), gte(hrHolidays.date, today)))
    .orderBy(hrHolidays.date)
    .limit(3);
  return { totalLeaveTypes, pendingRequests, approvedToday, activeShifts, pendingTimesheets, recentRequests, upcomingHolidays };
}

// ── Approval Engine Handler ──

export async function handleLeaveApproval(orgId: string, sourceId: string, _requestId: string) {
  try { await approveLeaveRequest(orgId, sourceId, 'approval_engine', 'Approved via approval engine'); } catch (e) { console.error('[Approval] leave handler error:', e); }
}

// Register handler at module load
try { registerApprovalHandler('leave_request', handleLeaveApproval); } catch (e) { /* ignored */ }
