import { sql, eq, and, or, like, desc, count, sum, avg, isNotNull } from 'drizzle-orm';
import { db } from '../../db';
import {
  hrHelpTickets, hrTicketResponses,
  hrApprovalConfigs, hrApprovalRequests,
  hrSettings, hrPolicies,
  hrEmployees, hrDepartments,
  hrLeaveRequests, hrAttendanceRecords,
  hrTravelRequests, hrExpenseReports, hrExpenseEntries,
  hrPerformanceReviews, hrCandidateApplications,
  hrJobOpenings, hrRecognition,
  hrEmployeeCompensation, hrBenefits, hrEmployeeBenefits,
  hrCourses, hrEnrollments,
  hrExitInterviews, hrOffboardingTasks,
} from '../../db/schema';
import { createAuditLog } from '../audit.service';
import { createApprovalRequest, registerApprovalHandler } from './approval.service';
import { dispatchEvent } from './workflow.service';

// ── Help Desk ──

export interface TicketFilters { employeeId?: string; status?: string; category?: string; priority?: string; }

export async function getHelpTickets(orgId: string, filters?: TicketFilters) {
  try {
    const conditions: any[] = [eq(hrHelpTickets.orgId, orgId)];
    if (filters?.employeeId) conditions.push(eq(hrHelpTickets.employeeId, filters.employeeId));
    if (filters?.status) conditions.push(eq(hrHelpTickets.status, filters.status as any));
    if (filters?.category) conditions.push(eq(hrHelpTickets.category, filters.category));
    if (filters?.priority) conditions.push(eq(hrHelpTickets.priority, filters.priority as any));
    return await db
      .select({
        id: hrHelpTickets.id,
        orgId: hrHelpTickets.orgId,
        employeeId: hrHelpTickets.employeeId,
        subject: hrHelpTickets.subject,
        description: hrHelpTickets.description,
        category: hrHelpTickets.category,
        priority: hrHelpTickets.priority,
        status: hrHelpTickets.status,
        assignedTo: hrHelpTickets.assignedTo,
        resolvedAt: hrHelpTickets.resolvedAt,
        createdAt: hrHelpTickets.createdAt,
        updatedAt: hrHelpTickets.updatedAt,
        employeeName: sql`concat(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
        assigneeName: sql`concat(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
      })
      .from(hrHelpTickets)
      .leftJoin(hrEmployees, eq(hrHelpTickets.employeeId, hrEmployees.id))
      .leftJoin(sql`${hrEmployees} as assignee`, eq(hrHelpTickets.assignedTo, sql`assignee.id`))
      .where(and(...conditions))
      .orderBy(desc(hrHelpTickets.createdAt));
  } catch (err) {
    console.error('[Support] getHelpTickets error:', err);
    throw err;
  }
}

export async function getHelpTicket(orgId: string, ticketId: string) {
  try {
    const [ticket] = await db
      .select({
        id: hrHelpTickets.id,
        orgId: hrHelpTickets.orgId,
        employeeId: hrHelpTickets.employeeId,
        subject: hrHelpTickets.subject,
        description: hrHelpTickets.description,
        category: hrHelpTickets.category,
        priority: hrHelpTickets.priority,
        status: hrHelpTickets.status,
        assignedTo: hrHelpTickets.assignedTo,
        resolvedAt: hrHelpTickets.resolvedAt,
        createdAt: hrHelpTickets.createdAt,
        updatedAt: hrHelpTickets.updatedAt,
        employeeName: sql`concat(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
        assigneeName: sql`concat(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
      })
      .from(hrHelpTickets)
      .leftJoin(hrEmployees, eq(hrHelpTickets.employeeId, hrEmployees.id))
      .leftJoin(sql`${hrEmployees} as assignee`, eq(hrHelpTickets.assignedTo, sql`assignee.id`))
      .where(and(eq(hrHelpTickets.id, ticketId), eq(hrHelpTickets.orgId, orgId)));
    if (!ticket) return null;
    const responses = await db
      .select({
        id: hrTicketResponses.id,
        ticketId: hrTicketResponses.ticketId,
        employeeId: hrTicketResponses.employeeId,
        message: hrTicketResponses.message,
        isInternal: hrTicketResponses.isInternal,
        createdAt: hrTicketResponses.createdAt,
        employeeName: sql`concat(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
      })
      .from(hrTicketResponses)
      .leftJoin(hrEmployees, eq(hrTicketResponses.employeeId, hrEmployees.id))
      .where(and(eq(hrTicketResponses.ticketId, ticketId), eq(hrTicketResponses.orgId, orgId)))
      .orderBy(hrTicketResponses.createdAt);
    return { ...ticket, responses };
  } catch (err) {
    console.error('[Support] getHelpTicket error:', err);
    throw err;
  }
}

export async function createHelpTicket(orgId: string, data: any) {
  try {
    const [created] = await db
      .insert(hrHelpTickets)
      .values({
        orgId,
        employeeId: data.employeeId,
        subject: data.subject,
        description: data.description,
        category: data.category || null,
        priority: data.priority || 'medium',
        status: 'open',
        assignedTo: data.assignedTo || null,
      })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system',
      action: 'create', entityType: 'hr_help_ticket', entityId: created.id,
      description: `Help ticket created: ${created.subject}`,
      newValues: created,
    });
    try { await createApprovalRequest(orgId, { module: 'help_ticket', sourceId: created.id, requesterId: data.employeeId || data.userId, title: created.subject, description: created.description, userId: data.userId }); } catch (e) { /* engine not configured */ }
    try { await dispatchEvent(orgId, 'ticket.created', created.id, { subject: data.subject, description: data.description, priority: data.priority, category: data.category, status: created.status }, userId); } catch (e) { console.error('[WF] dispatch ticket.created error:', e); }
    return created;
  } catch (err) {
    console.error('[Support] createHelpTicket error:', err);
    throw err;
  }
}

export async function updateHelpTicket(orgId: string, ticketId: string, data: any) {
  try {
    const [old] = await db
      .select()
      .from(hrHelpTickets)
      .where(and(eq(hrHelpTickets.id, ticketId), eq(hrHelpTickets.orgId, orgId)));
    const updateData: any = {};
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    updateData.updatedAt = sql`now()`;
    const [updated] = await db
      .update(hrHelpTickets)
      .set(updateData)
      .where(and(eq(hrHelpTickets.id, ticketId), eq(hrHelpTickets.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system',
      action: 'update', entityType: 'hr_help_ticket', entityId: ticketId,
      description: `Help ticket updated: ${updated.subject}`,
      oldValues: old, newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[Support] updateHelpTicket error:', err);
    throw err;
  }
}

export async function assignHelpTicket(orgId: string, ticketId: string, assigneeId: string) {
  try {
    const [old] = await db
      .select()
      .from(hrHelpTickets)
      .where(and(eq(hrHelpTickets.id, ticketId), eq(hrHelpTickets.orgId, orgId)));
    const [updated] = await db
      .update(hrHelpTickets)
      .set({ assignedTo: assigneeId, updatedAt: sql`now()` })
      .where(and(eq(hrHelpTickets.id, ticketId), eq(hrHelpTickets.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system',
      action: 'assign', entityType: 'hr_help_ticket', entityId: ticketId,
      description: `Help ticket assigned to ${assigneeId}`,
      oldValues: old, newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[Support] assignHelpTicket error:', err);
    throw err;
  }
}

export async function resolveHelpTicket(orgId: string, ticketId: string) {
  try {
    const [old] = await db
      .select()
      .from(hrHelpTickets)
      .where(and(eq(hrHelpTickets.id, ticketId), eq(hrHelpTickets.orgId, orgId)));
    const [updated] = await db
      .update(hrHelpTickets)
      .set({ status: 'resolved', resolvedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(hrHelpTickets.id, ticketId), eq(hrHelpTickets.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system',
      action: 'resolve', entityType: 'hr_help_ticket', entityId: ticketId,
      description: `Help ticket resolved`,
      oldValues: old, newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[Support] resolveHelpTicket error:', err);
    throw err;
  }
}

export async function reopenHelpTicket(orgId: string, ticketId: string) {
  try {
    const [old] = await db
      .select()
      .from(hrHelpTickets)
      .where(and(eq(hrHelpTickets.id, ticketId), eq(hrHelpTickets.orgId, orgId)));
    const [updated] = await db
      .update(hrHelpTickets)
      .set({ status: 'open', resolvedAt: null, updatedAt: sql`now()` })
      .where(and(eq(hrHelpTickets.id, ticketId), eq(hrHelpTickets.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system',
      action: 'reopen', entityType: 'hr_help_ticket', entityId: ticketId,
      description: `Help ticket reopened`,
      oldValues: old, newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[Support] reopenHelpTicket error:', err);
    throw err;
  }
}

export async function closeHelpTicket(orgId: string, ticketId: string) {
  try {
    const [old] = await db
      .select()
      .from(hrHelpTickets)
      .where(and(eq(hrHelpTickets.id, ticketId), eq(hrHelpTickets.orgId, orgId)));
    const [updated] = await db
      .update(hrHelpTickets)
      .set({ status: 'closed', updatedAt: sql`now()` })
      .where(and(eq(hrHelpTickets.id, ticketId), eq(hrHelpTickets.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system',
      action: 'close', entityType: 'hr_help_ticket', entityId: ticketId,
      description: `Help ticket closed`,
      oldValues: old, newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[Support] closeHelpTicket error:', err);
    throw err;
  }
}

export async function getTicketResponses(orgId: string, ticketId: string) {
  try {
    return await db
      .select({
        id: hrTicketResponses.id,
        ticketId: hrTicketResponses.ticketId,
        employeeId: hrTicketResponses.employeeId,
        message: hrTicketResponses.message,
        isInternal: hrTicketResponses.isInternal,
        createdAt: hrTicketResponses.createdAt,
        employeeName: sql`concat(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
      })
      .from(hrTicketResponses)
      .leftJoin(hrEmployees, eq(hrTicketResponses.employeeId, hrEmployees.id))
      .where(and(eq(hrTicketResponses.ticketId, ticketId), eq(hrTicketResponses.orgId, orgId)))
      .orderBy(hrTicketResponses.createdAt);
  } catch (err) {
    console.error('[Support] getTicketResponses error:', err);
    throw err;
  }
}

export async function createTicketResponse(orgId: string, data: any) {
  try {
    const [created] = await db
      .insert(hrTicketResponses)
      .values({
        orgId,
        ticketId: data.ticketId,
        employeeId: data.employeeId,
        message: data.message,
        isInternal: data.isInternal || false,
      })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system',
      action: 'create', entityType: 'hr_ticket_response', entityId: created.id,
      description: `Response added to ticket ${data.ticketId}`,
      newValues: created,
    });
    await db
      .update(hrHelpTickets)
      .set({ updatedAt: sql`now()` })
      .where(eq(hrHelpTickets.id, data.ticketId));
    return created;
  } catch (err) {
    console.error('[Support] createTicketResponse error:', err);
    throw err;
  }
}

// ── Approvals ──

export interface ApprovalFilters { module?: string; requesterId?: string; approverId?: string; status?: string; }

export async function getApprovalRequests(orgId: string, filters?: ApprovalFilters) {
  try {
    const conditions: any[] = [eq(hrApprovalRequests.orgId, orgId)];
    if (filters?.module) conditions.push(eq(hrApprovalRequests.module, filters.module));
    if (filters?.requesterId) conditions.push(eq(hrApprovalRequests.requesterId, filters.requesterId));
    if (filters?.approverId) conditions.push(eq(hrApprovalRequests.approverId, filters.approverId));
    if (filters?.status) conditions.push(eq(hrApprovalRequests.status, filters.status as any));
    return await db
      .select({
        id: hrApprovalRequests.id,
        orgId: hrApprovalRequests.orgId,
        module: hrApprovalRequests.module,
        sourceId: hrApprovalRequests.sourceId,
        requesterId: hrApprovalRequests.requesterId,
        approverId: hrApprovalRequests.approverId,
        status: hrApprovalRequests.status,
        comment: hrApprovalRequests.comment,
        decidedAt: hrApprovalRequests.decidedAt,
        createdAt: hrApprovalRequests.createdAt,
        updatedAt: hrApprovalRequests.updatedAt,
        requesterName: sql`concat(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
        approverName: sql`concat(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
      })
      .from(hrApprovalRequests)
      .leftJoin(hrEmployees, eq(hrApprovalRequests.requesterId, hrEmployees.id))
      .leftJoin(sql`${hrEmployees} as approver`, eq(hrApprovalRequests.approverId, sql`approver.id`))
      .where(and(...conditions))
      .orderBy(desc(hrApprovalRequests.createdAt));
  } catch (err) {
    console.error('[Support] getApprovalRequests error:', err);
    throw err;
  }
}

export async function getApprovalRequest(orgId: string, requestId: string) {
  try {
    const [request] = await db
      .select({
        id: hrApprovalRequests.id,
        orgId: hrApprovalRequests.orgId,
        module: hrApprovalRequests.module,
        sourceId: hrApprovalRequests.sourceId,
        requesterId: hrApprovalRequests.requesterId,
        approverId: hrApprovalRequests.approverId,
        status: hrApprovalRequests.status,
        comment: hrApprovalRequests.comment,
        decidedAt: hrApprovalRequests.decidedAt,
        createdAt: hrApprovalRequests.createdAt,
        updatedAt: hrApprovalRequests.updatedAt,
        requesterName: sql`concat(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
        approverName: sql`concat(${hrEmployees.firstName}, ' ', ${hrEmployees.lastName})`,
      })
      .from(hrApprovalRequests)
      .leftJoin(hrEmployees, eq(hrApprovalRequests.requesterId, hrEmployees.id))
      .leftJoin(sql`${hrEmployees} as approver`, eq(hrApprovalRequests.approverId, sql`approver.id`))
      .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId)));
    return request || null;
  } catch (err) {
    console.error('[Support] getApprovalRequest error:', err);
    throw err;
  }
}

export async function createApprovalRequest(orgId: string, data: any) {
  try {
    const [created] = await db
      .insert(hrApprovalRequests)
      .values({
        orgId,
        module: data.module,
        sourceId: data.sourceId,
        requesterId: data.requesterId,
        approverId: data.approverId,
        status: 'pending',
      })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system',
      action: 'create', entityType: 'hr_approval_request', entityId: created.id,
      description: `Approval request created for ${data.module}`,
      newValues: created,
    });
    return created;
  } catch (err) {
    console.error('[Support] createApprovalRequest error:', err);
    throw err;
  }
}

export async function approveRequest(orgId: string, requestId: string, approverId: string, comment?: string) {
  try {
    const [old] = await db
      .select()
      .from(hrApprovalRequests)
      .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId)));
    const [updated] = await db
      .update(hrApprovalRequests)
      .set({ status: 'approved', approverId, comment: comment || null, decidedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system',
      action: 'approve', entityType: 'hr_approval_request', entityId: requestId,
      description: `Approval request approved`,
      oldValues: old, newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[Support] approveRequest error:', err);
    throw err;
  }
}

export async function rejectRequest(orgId: string, requestId: string, approverId: string, comment?: string) {
  try {
    const [old] = await db
      .select()
      .from(hrApprovalRequests)
      .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId)));
    const [updated] = await db
      .update(hrApprovalRequests)
      .set({ status: 'rejected', approverId, comment: comment || null, decidedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system',
      action: 'reject', entityType: 'hr_approval_request', entityId: requestId,
      description: `Approval request rejected`,
      oldValues: old, newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[Support] rejectRequest error:', err);
    throw err;
  }
}

export async function cancelApprovalRequest(orgId: string, requestId: string) {
  try {
    const [old] = await db
      .select()
      .from(hrApprovalRequests)
      .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId)));
    const [updated] = await db
      .update(hrApprovalRequests)
      .set({ status: 'cancelled', updatedAt: sql`now()` })
      .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system',
      action: 'cancel', entityType: 'hr_approval_request', entityId: requestId,
      description: `Approval request cancelled`,
      oldValues: old, newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[Support] cancelApprovalRequest error:', err);
    throw err;
  }
}

export async function getApprovalConfigs(orgId: string) {
  try {
    return await db
      .select()
      .from(hrApprovalConfigs)
      .where(eq(hrApprovalConfigs.orgId, orgId))
      .orderBy(hrApprovalConfigs.createdAt);
  } catch (err) {
    console.error('[Support] getApprovalConfigs error:', err);
    throw err;
  }
}

export async function createApprovalConfig(orgId: string, data: any) {
  try {
    const [created] = await db
      .insert(hrApprovalConfigs)
      .values({
        orgId,
        name: data.name,
        module: data.module,
        steps: data.steps || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
      })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system',
      action: 'create', entityType: 'hr_approval_config', entityId: created.id,
      description: `Approval config created: ${created.name}`,
      newValues: created,
    });
    return created;
  } catch (err) {
    console.error('[Support] createApprovalConfig error:', err);
    throw err;
  }
}

export async function updateApprovalConfig(orgId: string, configId: string, data: any) {
  try {
    const [old] = await db
      .select()
      .from(hrApprovalConfigs)
      .where(and(eq(hrApprovalConfigs.id, configId), eq(hrApprovalConfigs.orgId, orgId)));
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.module !== undefined) updateData.module = data.module;
    if (data.steps !== undefined) updateData.steps = data.steps;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    updateData.updatedAt = sql`now()`;
    const [updated] = await db
      .update(hrApprovalConfigs)
      .set(updateData)
      .where(and(eq(hrApprovalConfigs.id, configId), eq(hrApprovalConfigs.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system',
      action: 'update', entityType: 'hr_approval_config', entityId: configId,
      description: `Approval config updated: ${updated.name}`,
      oldValues: old, newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[Support] updateApprovalConfig error:', err);
    throw err;
  }
}

export async function deleteApprovalConfig(orgId: string, configId: string) {
  try {
    const [old] = await db
      .select()
      .from(hrApprovalConfigs)
      .where(and(eq(hrApprovalConfigs.id, configId), eq(hrApprovalConfigs.orgId, orgId)));
    await db
      .delete(hrApprovalConfigs)
      .where(and(eq(hrApprovalConfigs.id, configId), eq(hrApprovalConfigs.orgId, orgId)));
    await createAuditLog({
      orgId, userId: 'system',
      action: 'delete', entityType: 'hr_approval_config', entityId: configId,
      description: `Approval config deleted: ${old?.name || configId}`,
      oldValues: old,
    });
    return { deleted: true };
  } catch (err) {
    console.error('[Support] deleteApprovalConfig error:', err);
    throw err;
  }
}

// ── Reports & Analytics ──

export interface ReportFilters { dateFrom?: string; dateTo?: string; departmentId?: string; }

export async function getEmployeeHeadcountReport(orgId: string, filters?: ReportFilters) {
  try {
    const conditions: any[] = [eq(hrEmployees.orgId, orgId)];
    if (filters?.dateFrom) conditions.push(sql`${hrEmployees.joinDate} >= ${filters.dateFrom}::date`);
    if (filters?.dateTo) conditions.push(sql`${hrEmployees.joinDate} <= ${filters.dateTo}::date`);

    const total = await db
      .select({ count: count() })
      .from(hrEmployees)
      .where(and(...conditions))
      .then(r => r[0]?.count || 0);

    const byDepartment = await db
      .select({
        department: hrDepartments.name,
        departmentId: hrEmployees.departmentId,
        count: count(),
      })
      .from(hrEmployees)
      .leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id))
      .where(and(...conditions))
      .groupBy(hrEmployees.departmentId, hrDepartments.name);

    const byStatus = await db
      .select({
        status: hrEmployees.employmentStatus,
        count: count(),
      })
      .from(hrEmployees)
      .where(and(...conditions))
      .groupBy(hrEmployees.employmentStatus);

    const byGender = await db
      .select({
        gender: hrEmployees.gender,
        count: count(),
      })
      .from(hrEmployees)
      .where(and(...conditions, isNotNull(hrEmployees.gender)))
      .groupBy(hrEmployees.gender);

    const joinConditions = [eq(hrEmployees.orgId, orgId)];
    if (filters?.dateFrom) joinConditions.push(sql`${hrEmployees.joinDate} >= ${filters.dateFrom}::date`);
    if (filters?.dateTo) joinConditions.push(sql`${hrEmployees.joinDate} <= ${filters.dateTo}::date`);

    const newHires = await db
      .select({ count: count() })
      .from(hrEmployees)
      .where(and(...joinConditions, isNotNull(hrEmployees.joinDate)))
      .then(r => r[0]?.count || 0);

    return { total, byDepartment, byStatus, byGender, newHires };
  } catch (err) {
    console.error('[Support] getEmployeeHeadcountReport error:', err);
    throw err;
  }
}

export async function getTurnoverReport(orgId: string, filters?: ReportFilters) {
  try {
    const conditions: any[] = [eq(hrEmployees.orgId, orgId)];
    if (filters?.dateFrom) conditions.push(sql`${hrEmployees.exitDate} >= ${filters.dateFrom}::date`);
    if (filters?.dateTo) conditions.push(sql`${hrEmployees.exitDate} <= ${filters.dateTo}::date`);

    const allLeavers = await db
      .select({ count: count() })
      .from(hrEmployees)
      .where(and(...conditions, isNotNull(hrEmployees.exitDate)))
      .then(r => r[0]?.count || 0);

    const voluntary = await db
      .select({ count: count() })
      .from(hrEmployees)
      .where(and(...conditions, isNotNull(hrEmployees.exitDate), eq(hrEmployees.exitReason, 'voluntary')))
      .then(r => r[0]?.count || 0);

    const involuntary = allLeavers - voluntary;

    const activeCount = await db
      .select({ count: count() })
      .from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.employmentStatus, 'active')))
      .then(r => r[0]?.count || 0);

    const avgHeadcount = activeCount + (allLeavers / 2);
    const turnoverRate = avgHeadcount > 0 ? (allLeavers / avgHeadcount) * 100 : 0;

    const leaversByDepartment = await db
      .select({
        department: hrDepartments.name,
        count: count(),
      })
      .from(hrEmployees)
      .leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id))
      .where(and(...conditions, isNotNull(hrEmployees.exitDate)))
      .groupBy(hrEmployees.departmentId, hrDepartments.name);

    return { totalLeavers: allLeavers, voluntary, involuntary, turnoverRate, leaversByDepartment };
  } catch (err) {
    console.error('[Support] getTurnoverReport error:', err);
    throw err;
  }
}

export async function getAttendanceReport(orgId: string, filters?: ReportFilters) {
  try {
    const conditions: any[] = [eq(hrAttendanceRecords.orgId, orgId)];
    if (filters?.dateFrom) conditions.push(sql`${hrAttendanceRecords.date} >= ${filters.dateFrom}::date`);
    if (filters?.dateTo) conditions.push(sql`${hrAttendanceRecords.date} <= ${filters.dateTo}::date`);

    const total = await db
      .select({ count: count() })
      .from(hrAttendanceRecords)
      .where(and(...conditions))
      .then(r => r[0]?.count || 0);

    const byStatus = await db
      .select({
        status: hrAttendanceRecords.status,
        count: count(),
      })
      .from(hrAttendanceRecords)
      .where(and(...conditions))
      .groupBy(hrAttendanceRecords.status);

    const avgHours = await db
      .select({
        avgHours: sql`avg(extract(epoch from (${hrAttendanceRecords.clockOut} - ${hrAttendanceRecords.clockIn})) / 3600)`,
      })
      .from(hrAttendanceRecords)
      .where(and(...conditions, isNotNull(hrAttendanceRecords.clockIn), isNotNull(hrAttendanceRecords.clockOut)))
      .then(r => r[0]?.avgHours ? Number(r[0].avgHours) : 0);

    const departmentBreakdown = await db
      .select({
        department: hrDepartments.name,
        count: count(),
      })
      .from(hrAttendanceRecords)
      .leftJoin(hrEmployees, eq(hrAttendanceRecords.employeeId, hrEmployees.id))
      .leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id))
      .where(and(...conditions))
      .groupBy(hrDepartments.name);

    return { total, byStatus, avgHoursPerDay: avgHours, departmentBreakdown };
  } catch (err) {
    console.error('[Support] getAttendanceReport error:', err);
    throw err;
  }
}

export async function getLeaveReport(orgId: string, filters?: ReportFilters) {
  try {
    const conditions: any[] = [eq(hrLeaveRequests.orgId, orgId)];
    if (filters?.dateFrom) conditions.push(sql`${hrLeaveRequests.startDate} >= ${filters.dateFrom}::date`);
    if (filters?.dateTo) conditions.push(sql`${hrLeaveRequests.endDate} <= ${filters.dateTo}::date`);

    const totalRequests = await db
      .select({ count: count() })
      .from(hrLeaveRequests)
      .where(and(...conditions))
      .then(r => r[0]?.count || 0);

    const byStatus = await db
      .select({
        status: hrLeaveRequests.status,
        count: count(),
      })
      .from(hrLeaveRequests)
      .where(and(...conditions))
      .groupBy(hrLeaveRequests.status);

    const byType = await db
      .select({
        leaveType: hrLeaveRequests.leaveTypeId,
        count: count(),
      })
      .from(hrLeaveRequests)
      .where(and(...conditions))
      .groupBy(hrLeaveRequests.leaveTypeId);

    const totalDays = await db
      .select({ total: sum(hrLeaveRequests.totalDays) })
      .from(hrLeaveRequests)
      .where(and(...conditions))
      .then(r => r[0]?.total || 0);

    const departmentBreakdown = await db
      .select({
        department: hrDepartments.name,
        count: count(),
        totalDays: sum(hrLeaveRequests.totalDays),
      })
      .from(hrLeaveRequests)
      .leftJoin(hrEmployees, eq(hrLeaveRequests.employeeId, hrEmployees.id))
      .leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id))
      .where(and(...conditions))
      .groupBy(hrDepartments.name);

    return { totalRequests, byStatus, byType, totalDays, departmentBreakdown };
  } catch (err) {
    console.error('[Support] getLeaveReport error:', err);
    throw err;
  }
}

export async function getTravelExpenseReport(orgId: string, filters?: ReportFilters) {
  try {
    const travelConditions: any[] = [eq(hrTravelRequests.orgId, orgId)];
    const expenseConditions: any[] = [eq(hrExpenseReports.orgId, orgId)];

    if (filters?.dateFrom) {
      travelConditions.push(sql`${hrTravelRequests.departureDate} >= ${filters.dateFrom}::date`);
      expenseConditions.push(sql`${hrExpenseReports.createdAt} >= ${filters.dateFrom}::timestamp`);
    }
    if (filters?.dateTo) {
      travelConditions.push(sql`${hrTravelRequests.returnDate} <= ${filters.dateTo}::date`);
      expenseConditions.push(sql`${hrExpenseReports.createdAt} <= ${filters.dateTo}::timestamp`);
    }

    const totalTravelRequests = await db
      .select({ count: count() })
      .from(hrTravelRequests)
      .where(and(...travelConditions))
      .then(r => r[0]?.count || 0);

    const totalApprovedTravel = await db
      .select({ count: count() })
      .from(hrTravelRequests)
      .where(and(...travelConditions, eq(hrTravelRequests.status, 'approved')))
      .then(r => r[0]?.count || 0);

    const totalExpenseReports = await db
      .select({ count: count() })
      .from(hrExpenseReports)
      .where(and(...expenseConditions))
      .then(r => r[0]?.count || 0);

    const totalReimbursed = await db
      .select({ total: sum(hrExpenseReports.totalAmount) })
      .from(hrExpenseReports)
      .where(and(...expenseConditions, eq(hrExpenseReports.status, 'reimbursed')))
      .then(r => r[0]?.total || 0);

    const expensesByCategory = await db
      .select({
        category: hrExpenseEntries.category,
        total: sum(hrExpenseEntries.amount),
        count: count(),
      })
      .from(hrExpenseEntries)
      .leftJoin(hrExpenseReports, eq(hrExpenseEntries.reportId, hrExpenseReports.id))
      .where(and(...expenseConditions))
      .groupBy(hrExpenseEntries.category);

    return { totalTravelRequests, totalApprovedTravel, totalExpenseReports, totalReimbursed, expensesByCategory };
  } catch (err) {
    console.error('[Support] getTravelExpenseReport error:', err);
    throw err;
  }
}

export async function getPerformanceSummaryReport(orgId: string, filters?: ReportFilters) {
  try {
    const conditions: any[] = [eq(hrPerformanceReviews.orgId, orgId)];
    if (filters?.dateFrom) conditions.push(sql`${hrPerformanceReviews.createdAt} >= ${filters.dateFrom}::timestamp`);
    if (filters?.dateTo) conditions.push(sql`${hrPerformanceReviews.createdAt} <= ${filters.dateTo}::timestamp`);

    const totalReviews = await db
      .select({ count: count() })
      .from(hrPerformanceReviews)
      .where(and(...conditions))
      .then(r => r[0]?.count || 0);

    const avgRating = await db
      .select({ avg: avg(hrPerformanceReviews.rating) })
      .from(hrPerformanceReviews)
      .where(and(...conditions, isNotNull(hrPerformanceReviews.rating)))
      .then(r => r[0]?.avg ? Number(r[0].avg) : 0);

    const byStatus = await db
      .select({
        status: hrPerformanceReviews.status,
        count: count(),
      })
      .from(hrPerformanceReviews)
      .where(and(...conditions))
      .groupBy(hrPerformanceReviews.status);

    const completed = byStatus.find(s => s.status === 'completed')?.count || 0;
    const pending = totalReviews - completed;

    const byDepartment = await db
      .select({
        department: hrDepartments.name,
        count: count(),
        avgRating: avg(hrPerformanceReviews.rating),
      })
      .from(hrPerformanceReviews)
      .leftJoin(hrEmployees, eq(hrPerformanceReviews.employeeId, hrEmployees.id))
      .leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id))
      .where(and(...conditions))
      .groupBy(hrDepartments.name);

    return { totalReviews, avgRating, completed, pending, byDepartment };
  } catch (err) {
    console.error('[Support] getPerformanceSummaryReport error:', err);
    throw err;
  }
}

export async function getRecruitmentFunnelReport(orgId: string, filters?: ReportFilters) {
  try {
    const conditions: any[] = [eq(hrCandidateApplications.orgId, orgId)];
    if (filters?.dateFrom) conditions.push(sql`${hrCandidateApplications.createdAt} >= ${filters.dateFrom}::timestamp`);
    if (filters?.dateTo) conditions.push(sql`${hrCandidateApplications.createdAt} <= ${filters.dateTo}::timestamp`);

    const stageCounts = await db
      .select({
        status: hrCandidateApplications.status,
        count: count(),
      })
      .from(hrCandidateApplications)
      .where(and(...conditions))
      .groupBy(hrCandidateApplications.status)
      .orderBy(hrCandidateApplications.status);

    const funnel: Record<string, number> = {};
    stageCounts.forEach(s => { funnel[s.status] = s.count; });

    const stages = ['new', 'screened', 'interviewed', 'offered', 'hired'];
    const funnelData = stages.map((stage, i) => {
      const count = funnel[stage] || 0;
      const previousCount = i > 0 ? (funnel[stages[i - 1]] || 0) : 0;
      const conversionRate = previousCount > 0 ? ((count / previousCount) * 100) : (i === 0 ? 100 : 0);
      return { stage, count, conversionRate: Math.round(conversionRate * 100) / 100 };
    });

    return { funnel: funnelData, raw: stageCounts };
  } catch (err) {
    console.error('[Support] getRecruitmentFunnelReport error:', err);
    throw err;
  }
}

export async function getCostReport(orgId: string, filters?: ReportFilters) {
  try {
    const empConditions: any[] = [eq(hrEmployeeCompensation.orgId, orgId)];
    if (filters?.dateFrom) empConditions.push(sql`${hrEmployeeCompensation.effectiveDate} >= ${filters.dateFrom}::date`);
    if (filters?.dateTo) empConditions.push(sql`${hrEmployeeCompensation.effectiveDate} <= ${filters.dateTo}::date`);

    const compensationResult = await db
      .select({
        totalSalary: sum(hrEmployeeCompensation.salary),
        count: count(),
      })
      .from(hrEmployeeCompensation)
      .where(and(...empConditions))
      .then(r => r[0]);

    const totalCompensationCost = compensationResult?.totalSalary || 0;
    const empCount = compensationResult?.count || 0;
    const avgSalary = empCount > 0 ? Number(totalCompensationCost) / empCount : 0;

    const benefitsCost = await db
      .select({ total: sum(hrBenefits.costEmployer) })
      .from(hrBenefits)
      .where(and(eq(hrBenefits.orgId, orgId), isNotNull(hrBenefits.costEmployer)))
      .then(r => r[0]?.total || 0);

    const travelConditions: any[] = [eq(hrTravelRequests.orgId, orgId)];
    if (filters?.dateFrom) travelConditions.push(sql`${hrTravelRequests.departureDate} >= ${filters.dateFrom}::date`);
    if (filters?.dateTo) travelConditions.push(sql`${hrTravelRequests.returnDate} <= ${filters.dateTo}::date`);

    const travelCost = await db
      .select({ total: sum(hrTravelRequests.estimatedCost) })
      .from(hrTravelRequests)
      .where(and(...travelConditions, eq(hrTravelRequests.status, 'approved')))
      .then(r => r[0]?.total || 0);

    const expenseConditions: any[] = [eq(hrExpenseReports.orgId, orgId)];
    if (filters?.dateFrom) expenseConditions.push(sql`${hrExpenseReports.createdAt} >= ${filters.dateFrom}::timestamp`);
    if (filters?.dateTo) expenseConditions.push(sql`${hrExpenseReports.createdAt} <= ${filters.dateTo}::timestamp`);

    const expenseCost = await db
      .select({ total: sum(hrExpenseReports.totalAmount) })
      .from(hrExpenseReports)
      .where(and(...expenseConditions, eq(hrExpenseReports.status, 'reimbursed')))
      .then(r => r[0]?.total || 0);

    return {
      totalCompensationCost: Number(totalCompensationCost),
      avgSalary,
      benefitsCost: Number(benefitsCost),
      travelCost: Number(travelCost),
      expenseCost: Number(expenseCost),
    };
  } catch (err) {
    console.error('[Support] getCostReport error:', err);
    throw err;
  }
}

export async function getComplianceReport(orgId: string, filters?: ReportFilters) {
  try {
    const enrollConditions: any[] = [eq(hrEnrollments.orgId, orgId)];
    if (filters?.dateFrom) enrollConditions.push(sql`${hrEnrollments.enrolledAt} >= ${filters.dateFrom}::timestamp`);
    if (filters?.dateTo) enrollConditions.push(sql`${hrEnrollments.enrolledAt} <= ${filters.dateTo}::timestamp`);

    const totalEnrollments = await db
      .select({ count: count() })
      .from(hrEnrollments)
      .where(and(...enrollConditions))
      .then(r => r[0]?.count || 0);

    const completedEnrollments = await db
      .select({ count: count() })
      .from(hrEnrollments)
      .where(and(...enrollConditions, isNotNull(hrEnrollments.completedAt)))
      .then(r => r[0]?.count || 0);

    const trainingCompletionRate = totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0;

    const coursesCount = await db
      .select({ count: count() })
      .from(hrCourses)
      .where(eq(hrCourses.orgId, orgId))
      .then(r => r[0]?.count || 0);

    return {
      trainingCompletionRate: Math.round(trainingCompletionRate * 100) / 100,
      totalEnrollments,
      completedEnrollments,
      totalCourses: coursesCount,
      policyAcknowledgments: 0,
      certificationsExpiry: [],
    };
  } catch (err) {
    console.error('[Support] getComplianceReport error:', err);
    throw err;
  }
}

export async function getCustomReport(orgId: string, reportConfig: any) {
  try {
    const filters: ReportFilters = reportConfig.filters || {};
    switch (reportConfig.type) {
      case 'headcount': return await getEmployeeHeadcountReport(orgId, filters);
      case 'turnover': return await getTurnoverReport(orgId, filters);
      case 'attendance': return await getAttendanceReport(orgId, filters);
      case 'leave': return await getLeaveReport(orgId, filters);
      case 'travel_expense': return await getTravelExpenseReport(orgId, filters);
      case 'performance': return await getPerformanceSummaryReport(orgId, filters);
      case 'recruitment_funnel': return await getRecruitmentFunnelReport(orgId, filters);
      case 'cost': return await getCostReport(orgId, filters);
      case 'compliance': return await getComplianceReport(orgId, filters);
      default: throw new Error(`Unknown report type: ${reportConfig.type}`);
    }
  } catch (err) {
    console.error('[Support] getCustomReport error:', err);
    throw err;
  }
}

// ── Administration ──

export async function getHrSettings(orgId: string) {
  try {
    return await db
      .select()
      .from(hrSettings)
      .where(eq(hrSettings.orgId, orgId));
  } catch (err) {
    console.error('[Support] getHrSettings error:', err);
    throw err;
  }
}

export async function getHrSetting(orgId: string, key: string) {
  try {
    const [setting] = await db
      .select()
      .from(hrSettings)
      .where(and(eq(hrSettings.orgId, orgId), eq(hrSettings.key, key)));
    return setting || null;
  } catch (err) {
    console.error('[Support] getHrSetting error:', err);
    throw err;
  }
}

export async function upsertHrSetting(orgId: string, key: string, value: any) {
  try {
    const existing = await getHrSetting(orgId, key);
    if (existing) {
      const [updated] = await db
        .update(hrSettings)
        .set({ value, updatedAt: sql`now()` })
        .where(and(eq(hrSettings.orgId, orgId), eq(hrSettings.key, key)))
        .returning();
      await createAuditLog({
        orgId, userId: 'system',
        action: 'update', entityType: 'hr_setting', entityId: existing.id,
        description: `HR setting updated: ${key}`,
        oldValues: existing, newValues: updated,
      });
      return updated;
    } else {
      const [created] = await db
        .insert(hrSettings)
        .values({ orgId, key, value })
        .returning();
      await createAuditLog({
        orgId, userId: 'system',
        action: 'create', entityType: 'hr_setting', entityId: created.id,
        description: `HR setting created: ${key}`,
        newValues: created,
      });
      return created;
    }
  } catch (err) {
    console.error('[Support] upsertHrSetting error:', err);
    throw err;
  }
}

export async function getPolicies(orgId: string) {
  try {
    return await db
      .select()
      .from(hrPolicies)
      .where(eq(hrPolicies.orgId, orgId))
      .orderBy(desc(hrPolicies.createdAt));
  } catch (err) {
    console.error('[Support] getPolicies error:', err);
    throw err;
  }
}

export async function getPolicy(orgId: string, policyId: string) {
  try {
    const [policy] = await db
      .select()
      .from(hrPolicies)
      .where(and(eq(hrPolicies.id, policyId), eq(hrPolicies.orgId, orgId)));
    return policy || null;
  } catch (err) {
    console.error('[Support] getPolicy error:', err);
    throw err;
  }
}

export async function createPolicy(orgId: string, data: any) {
  try {
    const [created] = await db
      .insert(hrPolicies)
      .values({
        orgId,
        title: data.title,
        content: data.content,
        category: data.category || null,
        effectiveDate: data.effectiveDate || null,
        version: data.version || '1.0',
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdBy: data.createdBy || null,
      })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system',
      action: 'create', entityType: 'hr_policy', entityId: created.id,
      description: `Policy created: ${created.title}`,
      newValues: created,
    });
    try { await dispatchEvent(orgId, 'policy.created', created.id, { title: data.title, category: data.category, effectiveDate: data.effectiveDate, version: data.version }, userId); } catch (e) { console.error('[WF] dispatch policy.created error:', e); }
    return created;
  } catch (err) {
    console.error('[Support] createPolicy error:', err);
    throw err;
  }
}

export async function updatePolicy(orgId: string, policyId: string, data: any) {
  try {
    const [old] = await db
      .select()
      .from(hrPolicies)
      .where(and(eq(hrPolicies.id, policyId), eq(hrPolicies.orgId, orgId)));
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.effectiveDate !== undefined) updateData.effectiveDate = data.effectiveDate;
    if (data.version !== undefined) updateData.version = data.version;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    updateData.updatedAt = sql`now()`;
    const [updated] = await db
      .update(hrPolicies)
      .set(updateData)
      .where(and(eq(hrPolicies.id, policyId), eq(hrPolicies.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system',
      action: 'update', entityType: 'hr_policy', entityId: policyId,
      description: `Policy updated: ${updated.title}`,
      oldValues: old, newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[Support] updatePolicy error:', err);
    throw err;
  }
}

export async function deletePolicy(orgId: string, policyId: string) {
  try {
    const [old] = await db
      .select()
      .from(hrPolicies)
      .where(and(eq(hrPolicies.id, policyId), eq(hrPolicies.orgId, orgId)));
    await db
      .delete(hrPolicies)
      .where(and(eq(hrPolicies.id, policyId), eq(hrPolicies.orgId, orgId)));
    await createAuditLog({
      orgId, userId: 'system',
      action: 'delete', entityType: 'hr_policy', entityId: policyId,
      description: `Policy deleted: ${old?.title || policyId}`,
      oldValues: old,
    });
    return { deleted: true };
  } catch (err) {
    console.error('[Support] deletePolicy error:', err);
    throw err;
  }
}

// ── Integration Interfaces (future) ──

export interface HrIntegrationPayload {
  module: string;
  action: string;
  data: any;
}

export async function syncToAccounting(payload: HrIntegrationPayload) {
  return { success: true, message: 'Integration not yet configured' };
}

export async function syncToPayroll(payload: HrIntegrationPayload) {
  return { success: true, message: 'Integration not yet configured' };
}

export async function sendNotification(payload: HrIntegrationPayload) {
  return { success: true, message: 'Integration not yet configured' };
}

export async function sendEmail(payload: HrIntegrationPayload) {
  return { success: true, message: 'Integration not yet configured' };
}

export async function createCalendarEvent(payload: HrIntegrationPayload) {
  return { success: true, message: 'Integration not yet configured' };
}

export async function createDocument(payload: HrIntegrationPayload) {
  return { success: true, message: 'Integration not yet configured' };
}

export async function handleTicketApproval(orgId: string, sourceId: string, _requestId: string) {
  try {
    await db.update(hrHelpTickets).set({ status: 'resolved' }).where(and(eq(hrHelpTickets.id, sourceId), eq(hrHelpTickets.orgId, orgId)));
  } catch (e) { console.error('[Approval] ticket handler error:', e); }
}

try { registerApprovalHandler('help_ticket', handleTicketApproval); } catch (e) { /* ignored */ }
