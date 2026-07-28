import { sql, eq, and, like, desc, count } from 'drizzle-orm';
import { db } from '../../db';
import {
  hrLetterTemplates, hrLetters,
  hrTravelRequests, hrExpenseReports, hrExpenseEntries,
  hrCompensationBands, hrEmployeeCompensation,
  hrBenefits, hrEmployeeBenefits,
  hrAllowances, hrEmployeeAllowances,
  hrBonuses, hrDeductions, hrEmployeeDeductions,
  hrSalaryReviews, hrCompensationHistory,
  hrTasks, hrWorkflowTemplates,
  hrEmployees
} from '../../db/schema';
import { createAuditLog } from '../audit.service';
import { createApprovalRequest, registerApprovalHandler } from './approval.service';
import { dispatchEvent } from './workflow.service';

// ── HR Letters ──

export interface LetterFilters { employeeId?: string; type?: string; }

export async function getLetterTemplates(orgId: string) {
  try {
    return await db
      .select()
      .from(hrLetterTemplates)
      .where(eq(hrLetterTemplates.orgId, orgId))
      .orderBy(hrLetterTemplates.name);
  } catch (err) {
    console.error('[operations] getLetterTemplates error:', err);
    throw err;
  }
}

export async function createLetterTemplate(orgId: string, data: any) {
  try {
    const [inserted] = await db
      .insert(hrLetterTemplates)
      .values({ orgId, ...data })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system', action: 'create',
      entityType: 'hr_letter_template', entityId: inserted.id,
      description: `Created letter template: ${inserted.name}`,
      newValues: inserted,
    });
    return inserted;
  } catch (err) {
    console.error('[operations] createLetterTemplate error:', err);
    throw err;
  }
}

export async function updateLetterTemplate(orgId: string, tmplId: string, data: any) {
  try {
    const { userId, ...updates } = data;
    const [updated] = await db
      .update(hrLetterTemplates)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(hrLetterTemplates.id, tmplId), eq(hrLetterTemplates.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: userId || 'system', action: 'update',
      entityType: 'hr_letter_template', entityId: tmplId,
      description: `Updated letter template: ${updated?.name || tmplId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] updateLetterTemplate error:', err);
    throw err;
  }
}

export async function deleteLetterTemplate(orgId: string, tmplId: string) {
  try {
    const [deleted] = await db
      .delete(hrLetterTemplates)
      .where(and(eq(hrLetterTemplates.id, tmplId), eq(hrLetterTemplates.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'delete',
      entityType: 'hr_letter_template', entityId: tmplId,
      description: `Deleted letter template: ${deleted?.name || tmplId}`,
    });
    return deleted;
  } catch (err) {
    console.error('[operations] deleteLetterTemplate error:', err);
    throw err;
  }
}

export async function getLetters(orgId: string, filters?: LetterFilters) {
  try {
    const conditions = [eq(hrLetters.orgId, orgId)];
    if (filters?.employeeId) conditions.push(eq(hrLetters.employeeId, filters.employeeId));
    if (filters?.type) conditions.push(eq(hrLetters.type, filters.type as any));
    return await db
      .select()
      .from(hrLetters)
      .leftJoin(hrEmployees, eq(hrLetters.employeeId, hrEmployees.id))
      .leftJoin(hrLetterTemplates, eq(hrLetters.templateId, hrLetterTemplates.id))
      .where(and(...conditions))
      .orderBy(desc(hrLetters.createdAt));
  } catch (err) {
    console.error('[operations] getLetters error:', err);
    throw err;
  }
}

export async function getLetter(orgId: string, letterId: string) {
  try {
    const [result] = await db
      .select()
      .from(hrLetters)
      .leftJoin(hrEmployees, eq(hrLetters.employeeId, hrEmployees.id))
      .leftJoin(hrLetterTemplates, eq(hrLetters.templateId, hrLetterTemplates.id))
      .where(and(eq(hrLetters.id, letterId), eq(hrLetters.orgId, orgId)))
      .limit(1);
    return result;
  } catch (err) {
    console.error('[operations] getLetter error:', err);
    throw err;
  }
}

export async function generateLetter(orgId: string, data: any) {
  try {
    const template = data.templateId
      ? (await db
          .select()
          .from(hrLetterTemplates)
          .where(and(eq(hrLetterTemplates.id, data.templateId), eq(hrLetterTemplates.orgId, orgId)))
          .limit(1))[0]
      : null;
    const employee = data.employeeId
      ? (await db
          .select()
          .from(hrEmployees)
          .where(and(eq(hrEmployees.id, data.employeeId), eq(hrEmployees.orgId, orgId)))
          .limit(1))[0]
      : null;

    const subject = data.subject || template?.subject || '';
    let content = data.content || template?.body || '';
    if (employee) {
      content = content
        .replace(/\{\{firstName\}\}/g, employee.firstName || '')
        .replace(/\{\{lastName\}\}/g, employee.lastName || '')
        .replace(/\{\{employeeCode\}\}/g, employee.employeeCode || '')
        .replace(/\{\{email\}\}/g, employee.email || '')
        .replace(/\{\{address\}\}/g, employee.address || '')
        .replace(/\{\{city\}\}/g, employee.city || '')
        .replace(/\{\{state\}\}/g, employee.state || '')
        .replace(/\{\{joinDate\}\}/g, employee.joinDate || '')
        .replace(/\{\{designation\}\}/g, '');
    }
    if (template) {
      content = content
        .replace(/\{\{companyName\}\}/g, '')
        .replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0]);
    }

    const countResult = await db
      .select({ val: count() })
      .from(hrLetters)
      .where(eq(hrLetters.orgId, orgId));
    const seq = (countResult[0]?.val || 0) + 1;
    const refNum = `LTR-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(seq).padStart(4, '0')}`;

    const [inserted] = await db
      .insert(hrLetters)
      .values({
        orgId,
        employeeId: data.employeeId,
        templateId: data.templateId || null,
        type: data.type || (template?.type) || 'other',
        subject,
        content,
        generatedBy: data.generatedBy || data.userId || 'system',
        signedBy: data.signedBy || null,
        issuedAt: data.issuedAt || sql`CURRENT_DATE`,
        referenceNumber: refNum,
      })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system', action: 'create',
      entityType: 'hr_letter', entityId: inserted.id,
      description: `Generated letter: ${subject} (${refNum})`,
      newValues: inserted,
    });
    return inserted;
  } catch (err) {
    console.error('[operations] generateLetter error:', err);
    throw err;
  }
}

export async function deleteLetter(orgId: string, letterId: string) {
  try {
    const [deleted] = await db
      .delete(hrLetters)
      .where(and(eq(hrLetters.id, letterId), eq(hrLetters.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'delete',
      entityType: 'hr_letter', entityId: letterId,
      description: `Deleted letter: ${deleted?.subject || letterId}`,
    });
    return deleted;
  } catch (err) {
    console.error('[operations] deleteLetter error:', err);
    throw err;
  }
}

// ── Travel Requests ──

export interface TravelFilters { employeeId?: string; status?: string; }

export async function getTravelRequests(orgId: string, filters?: TravelFilters) {
  try {
    const conditions = [eq(hrTravelRequests.orgId, orgId)];
    if (filters?.employeeId) conditions.push(eq(hrTravelRequests.employeeId, filters.employeeId));
    if (filters?.status) conditions.push(eq(hrTravelRequests.status, filters.status as any));
    return await db
      .select()
      .from(hrTravelRequests)
      .leftJoin(hrEmployees, eq(hrTravelRequests.employeeId, hrEmployees.id))
      .where(and(...conditions))
      .orderBy(desc(hrTravelRequests.createdAt));
  } catch (err) {
    console.error('[operations] getTravelRequests error:', err);
    throw err;
  }
}

export async function getTravelRequest(orgId: string, travelId: string) {
  try {
    const [result] = await db
      .select()
      .from(hrTravelRequests)
      .leftJoin(hrEmployees, eq(hrTravelRequests.employeeId, hrEmployees.id))
      .where(and(eq(hrTravelRequests.id, travelId), eq(hrTravelRequests.orgId, orgId)))
      .limit(1);
    return result;
  } catch (err) {
    console.error('[operations] getTravelRequest error:', err);
    throw err;
  }
}

export async function createTravelRequest(orgId: string, data: any) {
  try {
    const [inserted] = await db
      .insert(hrTravelRequests)
      .values({ orgId, status: 'draft', ...data })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system', action: 'create',
      entityType: 'hr_travel_request', entityId: inserted.id,
      description: `Travel request to ${inserted.destination}`,
      newValues: inserted,
    });
    if (data.status !== 'draft') {
      try { await createApprovalRequest(orgId, { module: 'travel_request', sourceId: inserted.id, requesterId: data.employeeId || data.userId, title: `Travel: ${inserted.destination}`, description: data.purpose, userId: data.userId }); } catch (e) { /* engine not configured */ }
    }
    try { await dispatchEvent(orgId, 'travel.created', inserted.id, { employeeId: data.employeeId, destination: data.destination, purpose: data.purpose, startDate: data.startDate, endDate: data.endDate, status: inserted.status }, userId); } catch (e) { console.error('[WF] dispatch travel.created error:', e); }
    return inserted;
  } catch (err) {
    console.error('[operations] createTravelRequest error:', err);
    throw err;
  }
}

export async function updateTravelRequest(orgId: string, travelId: string, data: any) {
  try {
    const { userId, ...updates } = data;
    const [updated] = await db
      .update(hrTravelRequests)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(hrTravelRequests.id, travelId), eq(hrTravelRequests.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: userId || 'system', action: 'update',
      entityType: 'hr_travel_request', entityId: travelId,
      description: `Updated travel request to ${updated?.destination || travelId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] updateTravelRequest error:', err);
    throw err;
  }
}

export async function deleteTravelRequest(orgId: string, travelId: string) {
  try {
    const [deleted] = await db
      .delete(hrTravelRequests)
      .where(and(eq(hrTravelRequests.id, travelId), eq(hrTravelRequests.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'delete',
      entityType: 'hr_travel_request', entityId: travelId,
      description: `Deleted travel request to ${deleted?.destination || travelId}`,
    });
    return deleted;
  } catch (err) {
    console.error('[operations] deleteTravelRequest error:', err);
    throw err;
  }
}

export async function approveTravelRequest(orgId: string, travelId: string, approvedBy: string) {
  try {
    const [updated] = await db
      .update(hrTravelRequests)
      .set({ status: 'approved', approvedBy, approvedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(hrTravelRequests.id, travelId), eq(hrTravelRequests.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: approvedBy, action: 'approve',
      entityType: 'hr_travel_request', entityId: travelId,
      description: `Approved travel request to ${updated?.destination || travelId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] approveTravelRequest error:', err);
    throw err;
  }
}

export async function declineTravelRequest(orgId: string, travelId: string, reason: string) {
  try {
    const [updated] = await db
      .update(hrTravelRequests)
      .set({ status: 'declined', notes: reason, updatedAt: sql`now()` })
      .where(and(eq(hrTravelRequests.id, travelId), eq(hrTravelRequests.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'decline',
      entityType: 'hr_travel_request', entityId: travelId,
      description: `Declined travel request to ${updated?.destination || travelId}. Reason: ${reason}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] declineTravelRequest error:', err);
    throw err;
  }
}

// ── Expense Reports ──

export interface ExpenseFilters { employeeId?: string; status?: string; }

export async function getExpenseReports(orgId: string, filters?: ExpenseFilters) {
  try {
    const conditions = [eq(hrExpenseReports.orgId, orgId)];
    if (filters?.employeeId) conditions.push(eq(hrExpenseReports.employeeId, filters.employeeId));
    if (filters?.status) conditions.push(eq(hrExpenseReports.status, filters.status as any));
    return await db
      .select()
      .from(hrExpenseReports)
      .leftJoin(hrEmployees, eq(hrExpenseReports.employeeId, hrEmployees.id))
      .where(and(...conditions))
      .orderBy(desc(hrExpenseReports.createdAt));
  } catch (err) {
    console.error('[operations] getExpenseReports error:', err);
    throw err;
  }
}

export async function getExpenseReport(orgId: string, reportId: string) {
  try {
    const report = await db
      .select()
      .from(hrExpenseReports)
      .leftJoin(hrEmployees, eq(hrExpenseReports.employeeId, hrEmployees.id))
      .where(and(eq(hrExpenseReports.id, reportId), eq(hrExpenseReports.orgId, orgId)))
      .limit(1);
    if (!report.length) return null;
    const entries = await db
      .select()
      .from(hrExpenseEntries)
      .where(and(eq(hrExpenseEntries.reportId, reportId), eq(hrExpenseEntries.orgId, orgId)))
      .orderBy(hrExpenseEntries.createdAt);
    return { ...report[0], entries };
  } catch (err) {
    console.error('[operations] getExpenseReport error:', err);
    throw err;
  }
}

export async function createExpenseReport(orgId: string, data: any) {
  try {
    const [inserted] = await db
      .insert(hrExpenseReports)
      .values({ orgId, status: 'draft', ...data })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system', action: 'create',
      entityType: 'hr_expense_report', entityId: inserted.id,
      description: `Created expense report: ${inserted.title}`,
      newValues: inserted,
    });
    if (data.status !== 'draft') {
      try { await createApprovalRequest(orgId, { module: 'expense_report', sourceId: inserted.id, requesterId: data.employeeId || data.userId, title: inserted.title || 'Expense Report', userId: data.userId }); } catch (e) { /* engine not configured */ }
    }
    try { await dispatchEvent(orgId, 'expense.created', inserted.id, { employeeId: data.employeeId, category: data.category, amount: data.amount, description: data.description, status: inserted.status }, userId); } catch (e) { console.error('[WF] dispatch expense.created error:', e); }
    return inserted;
  } catch (err) {
    console.error('[operations] createExpenseReport error:', err);
    throw err;
  }
}

export async function updateExpenseReport(orgId: string, reportId: string, data: any) {
  try {
    const { userId, ...updates } = data;
    const [updated] = await db
      .update(hrExpenseReports)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(hrExpenseReports.id, reportId), eq(hrExpenseReports.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: userId || 'system', action: 'update',
      entityType: 'hr_expense_report', entityId: reportId,
      description: `Updated expense report: ${updated?.title || reportId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] updateExpenseReport error:', err);
    throw err;
  }
}

export async function deleteExpenseReport(orgId: string, reportId: string) {
  try {
    await db
      .delete(hrExpenseEntries)
      .where(and(eq(hrExpenseEntries.reportId, reportId), eq(hrExpenseEntries.orgId, orgId)));
    const [deleted] = await db
      .delete(hrExpenseReports)
      .where(and(eq(hrExpenseReports.id, reportId), eq(hrExpenseReports.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'delete',
      entityType: 'hr_expense_report', entityId: reportId,
      description: `Deleted expense report: ${deleted?.title || reportId}`,
    });
    return deleted;
  } catch (err) {
    console.error('[operations] deleteExpenseReport error:', err);
    throw err;
  }
}

export async function submitExpenseReport(orgId: string, reportId: string) {
  try {
    const [updated] = await db
      .update(hrExpenseReports)
      .set({ status: 'submitted', updatedAt: sql`now()` })
      .where(and(eq(hrExpenseReports.id, reportId), eq(hrExpenseReports.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'submit',
      entityType: 'hr_expense_report', entityId: reportId,
      description: `Submitted expense report: ${updated?.title || reportId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] submitExpenseReport error:', err);
    throw err;
  }
}

export async function approveExpenseReport(orgId: string, reportId: string, approvedBy: string) {
  try {
    const [updated] = await db
      .update(hrExpenseReports)
      .set({ status: 'approved', approvedBy, approvedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(hrExpenseReports.id, reportId), eq(hrExpenseReports.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: approvedBy, action: 'approve',
      entityType: 'hr_expense_report', entityId: reportId,
      description: `Approved expense report: ${updated?.title || reportId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] approveExpenseReport error:', err);
    throw err;
  }
}

export async function reimburseExpenseReport(orgId: string, reportId: string) {
  try {
    const [updated] = await db
      .update(hrExpenseReports)
      .set({ status: 'reimbursed', reimbursedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(hrExpenseReports.id, reportId), eq(hrExpenseReports.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'reimburse',
      entityType: 'hr_expense_report', entityId: reportId,
      description: `Reimbursed expense report: ${updated?.title || reportId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] reimburseExpenseReport error:', err);
    throw err;
  }
}

// ── Expense Entries ──

async function recalcExpenseTotal(orgId: string, reportId: string) {
  const rows = await db
    .select({ total: sql<number>`COALESCE(SUM(${hrExpenseEntries.amount}), 0)` })
    .from(hrExpenseEntries)
    .where(and(eq(hrExpenseEntries.reportId, reportId), eq(hrExpenseEntries.orgId, orgId)));
  const total = rows[0]?.total || 0;
  await db
    .update(hrExpenseReports)
    .set({ totalAmount: total, updatedAt: sql`now()` })
    .where(and(eq(hrExpenseReports.id, reportId), eq(hrExpenseReports.orgId, orgId)));
  return total;
}

export async function getExpenseEntries(orgId: string, reportId: string) {
  try {
    return await db
      .select()
      .from(hrExpenseEntries)
      .where(and(eq(hrExpenseEntries.reportId, reportId), eq(hrExpenseEntries.orgId, orgId)))
      .orderBy(hrExpenseEntries.createdAt);
  } catch (err) {
    console.error('[operations] getExpenseEntries error:', err);
    throw err;
  }
}

export async function createExpenseEntry(orgId: string, data: any) {
  try {
    const [inserted] = await db
      .insert(hrExpenseEntries)
      .values({ orgId, reportId: data.reportId, ...data })
      .returning();
    await recalcExpenseTotal(orgId, data.reportId);
    await createAuditLog({
      orgId, userId: data.userId || 'system', action: 'create',
      entityType: 'hr_expense_entry', entityId: inserted.id,
      description: `Added expense entry: ${inserted.category} (${inserted.amount})`,
      newValues: inserted,
    });
    try { await dispatchEvent(orgId, 'expense_entry.created', inserted.id, { expenseReportId: data.expenseReportId, category: data.category, amount: data.amount, description: data.description }, userId); } catch (e) { console.error('[WF] dispatch expense_entry.created error:', e); }
    return inserted;
  } catch (err) {
    console.error('[operations] createExpenseEntry error:', err);
    throw err;
  }
}

export async function updateExpenseEntry(orgId: string, entryId: string, data: any) {
  try {
    const { userId, ...updates } = data;
    const [updated] = await db
      .update(hrExpenseEntries)
      .set(updates)
      .where(and(eq(hrExpenseEntries.id, entryId), eq(hrExpenseEntries.orgId, orgId)))
      .returning();
    if (updated) await recalcExpenseTotal(orgId, updated.reportId);
    await createAuditLog({
      orgId, userId: userId || 'system', action: 'update',
      entityType: 'hr_expense_entry', entityId: entryId,
      description: `Updated expense entry: ${updated?.category || entryId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] updateExpenseEntry error:', err);
    throw err;
  }
}

export async function deleteExpenseEntry(orgId: string, entryId: string) {
  try {
    const [entry] = await db
      .select({ reportId: hrExpenseEntries.reportId })
      .from(hrExpenseEntries)
      .where(and(eq(hrExpenseEntries.id, entryId), eq(hrExpenseEntries.orgId, orgId)))
      .limit(1);
    const [deleted] = await db
      .delete(hrExpenseEntries)
      .where(and(eq(hrExpenseEntries.id, entryId), eq(hrExpenseEntries.orgId, orgId)))
      .returning();
    if (deleted) await recalcExpenseTotal(orgId, deleted.reportId);
    await createAuditLog({
      orgId, userId: 'system', action: 'delete',
      entityType: 'hr_expense_entry', entityId: entryId,
      description: `Deleted expense entry: ${deleted?.category || entryId}`,
    });
    return entry?.reportId ? { ...deleted, reportId: entry.reportId } : deleted;
  } catch (err) {
    console.error('[operations] deleteExpenseEntry error:', err);
    throw err;
  }
}

// ── Compensation Bands ──

export async function getCompensationBands(orgId: string) {
  try {
    return await db
      .select()
      .from(hrCompensationBands)
      .where(eq(hrCompensationBands.orgId, orgId))
      .orderBy(hrCompensationBands.name);
  } catch (err) {
    console.error('[operations] getCompensationBands error:', err);
    throw err;
  }
}

export async function createCompensationBand(orgId: string, data: any) {
  try {
    const [inserted] = await db
      .insert(hrCompensationBands)
      .values({ orgId, ...data })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system', action: 'create',
      entityType: 'hr_compensation_band', entityId: inserted.id,
      description: `Created compensation band: ${inserted.name}`,
      newValues: inserted,
    });
    return inserted;
  } catch (err) {
    console.error('[operations] createCompensationBand error:', err);
    throw err;
  }
}

export async function updateCompensationBand(orgId: string, bandId: string, data: any) {
  try {
    const { userId, ...updates } = data;
    const [updated] = await db
      .update(hrCompensationBands)
      .set(updates)
      .where(and(eq(hrCompensationBands.id, bandId), eq(hrCompensationBands.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: userId || 'system', action: 'update',
      entityType: 'hr_compensation_band', entityId: bandId,
      description: `Updated compensation band: ${updated?.name || bandId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] updateCompensationBand error:', err);
    throw err;
  }
}

export async function deleteCompensationBand(orgId: string, bandId: string) {
  try {
    const [deleted] = await db
      .delete(hrCompensationBands)
      .where(and(eq(hrCompensationBands.id, bandId), eq(hrCompensationBands.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'delete',
      entityType: 'hr_compensation_band', entityId: bandId,
      description: `Deleted compensation band: ${deleted?.name || bandId}`,
    });
    return deleted;
  } catch (err) {
    console.error('[operations] deleteCompensationBand error:', err);
    throw err;
  }
}

// ── Employee Compensation ──

export async function getEmployeeCompensation(orgId: string, employeeId: string) {
  try {
    return await db
      .select()
      .from(hrEmployeeCompensation)
      .where(and(eq(hrEmployeeCompensation.orgId, orgId), eq(hrEmployeeCompensation.employeeId, employeeId)))
      .orderBy(desc(hrEmployeeCompensation.effectiveDate));
  } catch (err) {
    console.error('[operations] getEmployeeCompensation error:', err);
    throw err;
  }
}

export async function createEmployeeCompensation(orgId: string, data: any) {
  try {
    const [inserted] = await db
      .insert(hrEmployeeCompensation)
      .values({ orgId, ...data })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system', action: 'create',
      entityType: 'hr_employee_compensation', entityId: inserted.id,
      description: `Set compensation for employee ${inserted.employeeId}`,
      newValues: inserted,
    });
    return inserted;
  } catch (err) {
    console.error('[operations] createEmployeeCompensation error:', err);
    throw err;
  }
}

export async function updateEmployeeCompensation(orgId: string, compId: string, data: any) {
  try {
    const { userId, ...updates } = data;
    const [updated] = await db
      .update(hrEmployeeCompensation)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(hrEmployeeCompensation.id, compId), eq(hrEmployeeCompensation.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: userId || 'system', action: 'update',
      entityType: 'hr_employee_compensation', entityId: compId,
      description: `Updated compensation record ${compId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] updateEmployeeCompensation error:', err);
    throw err;
  }
}

// ── Benefits ──

export async function getBenefits(orgId: string) {
  try {
    return await db
      .select()
      .from(hrBenefits)
      .where(eq(hrBenefits.orgId, orgId))
      .orderBy(hrBenefits.name);
  } catch (err) {
    console.error('[operations] getBenefits error:', err);
    throw err;
  }
}

export async function createBenefit(orgId: string, data: any) {
  try {
    const [inserted] = await db
      .insert(hrBenefits)
      .values({ orgId, ...data })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system', action: 'create',
      entityType: 'hr_benefit', entityId: inserted.id,
      description: `Created benefit: ${inserted.name}`,
      newValues: inserted,
    });
    return inserted;
  } catch (err) {
    console.error('[operations] createBenefit error:', err);
    throw err;
  }
}

export async function updateBenefit(orgId: string, benefitId: string, data: any) {
  try {
    const { userId, ...updates } = data;
    const [updated] = await db
      .update(hrBenefits)
      .set(updates)
      .where(and(eq(hrBenefits.id, benefitId), eq(hrBenefits.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: userId || 'system', action: 'update',
      entityType: 'hr_benefit', entityId: benefitId,
      description: `Updated benefit: ${updated?.name || benefitId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] updateBenefit error:', err);
    throw err;
  }
}

export async function deleteBenefit(orgId: string, benefitId: string) {
  try {
    const [deleted] = await db
      .delete(hrBenefits)
      .where(and(eq(hrBenefits.id, benefitId), eq(hrBenefits.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'delete',
      entityType: 'hr_benefit', entityId: benefitId,
      description: `Deleted benefit: ${deleted?.name || benefitId}`,
    });
    return deleted;
  } catch (err) {
    console.error('[operations] deleteBenefit error:', err);
    throw err;
  }
}

// ── Employee Benefits ──

export async function getEmployeeBenefits(orgId: string, employeeId: string) {
  try {
    return await db
      .select()
      .from(hrEmployeeBenefits)
      .leftJoin(hrBenefits, eq(hrEmployeeBenefits.benefitId, hrBenefits.id))
      .where(and(eq(hrEmployeeBenefits.orgId, orgId), eq(hrEmployeeBenefits.employeeId, employeeId)));
  } catch (err) {
    console.error('[operations] getEmployeeBenefits error:', err);
    throw err;
  }
}

export async function enrollBenefit(orgId: string, data: any) {
  try {
    const [inserted] = await db
      .insert(hrEmployeeBenefits)
      .values({ orgId, status: 'active', ...data })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system', action: 'create',
      entityType: 'hr_employee_benefit', entityId: inserted.id,
      description: `Enrolled employee ${inserted.employeeId} in benefit ${inserted.benefitId}`,
      newValues: inserted,
    });
    return inserted;
  } catch (err) {
    console.error('[operations] enrollBenefit error:', err);
    throw err;
  }
}

export async function disenrollBenefit(orgId: string, empBenefitId: string) {
  try {
    const [updated] = await db
      .update(hrEmployeeBenefits)
      .set({ status: 'disenrolled', coverageEnd: sql`CURRENT_DATE` })
      .where(and(eq(hrEmployeeBenefits.id, empBenefitId), eq(hrEmployeeBenefits.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'update',
      entityType: 'hr_employee_benefit', entityId: empBenefitId,
      description: `Disenrolled benefit enrollment ${empBenefitId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] disenrollBenefit error:', err);
    throw err;
  }
}

// ── Tasks ──

export interface TaskFilters { assignedTo?: string; priority?: string; isCompleted?: boolean; category?: string; }

export async function getHrTasks(orgId: string, filters?: TaskFilters) {
  try {
    const conditions = [eq(hrTasks.orgId, orgId)];
    if (filters?.assignedTo) conditions.push(eq(hrTasks.assignedTo, filters.assignedTo));
    if (filters?.priority) conditions.push(eq(hrTasks.priority, filters.priority as any));
    if (filters?.isCompleted !== undefined) conditions.push(eq(hrTasks.isCompleted, filters.isCompleted));
    if (filters?.category) conditions.push(eq(hrTasks.category, filters.category));
    return await db
      .select()
      .from(hrTasks)
      .leftJoin(hrEmployees, eq(hrTasks.assignedTo, hrEmployees.id))
      .where(and(...conditions))
      .orderBy(desc(hrTasks.createdAt));
  } catch (err) {
    console.error('[operations] getHrTasks error:', err);
    throw err;
  }
}

export async function createHrTask(orgId: string, data: any) {
  try {
    const [inserted] = await db
      .insert(hrTasks)
      .values({ orgId, ...data })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system', action: 'create',
      entityType: 'hr_task', entityId: inserted.id,
      description: `Created task: ${inserted.title}`,
      newValues: inserted,
    });
    return inserted;
  } catch (err) {
    console.error('[operations] createHrTask error:', err);
    throw err;
  }
}

export async function updateHrTask(orgId: string, taskId: string, data: any) {
  try {
    const { userId, ...updates } = data;
    const [updated] = await db
      .update(hrTasks)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(hrTasks.id, taskId), eq(hrTasks.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: userId || 'system', action: 'update',
      entityType: 'hr_task', entityId: taskId,
      description: `Updated task: ${updated?.title || taskId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] updateHrTask error:', err);
    throw err;
  }
}

export async function completeHrTask(orgId: string, taskId: string) {
  try {
    const [updated] = await db
      .update(hrTasks)
      .set({ isCompleted: true, completedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(hrTasks.id, taskId), eq(hrTasks.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'complete',
      entityType: 'hr_task', entityId: taskId,
      description: `Completed task: ${updated?.title || taskId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] completeHrTask error:', err);
    throw err;
  }
}

export async function deleteHrTask(orgId: string, taskId: string) {
  try {
    const [deleted] = await db
      .delete(hrTasks)
      .where(and(eq(hrTasks.id, taskId), eq(hrTasks.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'delete',
      entityType: 'hr_task', entityId: taskId,
      description: `Deleted task: ${deleted?.title || taskId}`,
    });
    return deleted;
  } catch (err) {
    console.error('[operations] deleteHrTask error:', err);
    throw err;
  }
}

// ── Workflow Templates ──

export async function getWorkflowTemplates(orgId: string) {
  try {
    return await db
      .select()
      .from(hrWorkflowTemplates)
      .where(eq(hrWorkflowTemplates.orgId, orgId));
  } catch (err) {
    console.error('[operations] getWorkflowTemplates error:', err);
    throw err;
  }
}

export async function createWorkflowTemplate(orgId: string, data: any) {
  try {
    const [inserted] = await db
      .insert(hrWorkflowTemplates)
      .values({ orgId, ...data })
      .returning();
    await createAuditLog({
      orgId, userId: data.userId || 'system', action: 'create',
      entityType: 'hr_workflow_template', entityId: inserted.id,
      description: `Created workflow template: ${inserted.name}`,
      newValues: inserted,
    });
    return inserted;
  } catch (err) {
    console.error('[operations] createWorkflowTemplate error:', err);
    throw err;
  }
}

export async function updateWorkflowTemplate(orgId: string, wfId: string, data: any) {
  try {
    const { userId, ...updates } = data;
    const [updated] = await db
      .update(hrWorkflowTemplates)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(hrWorkflowTemplates.id, wfId), eq(hrWorkflowTemplates.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: userId || 'system', action: 'update',
      entityType: 'hr_workflow_template', entityId: wfId,
      description: `Updated workflow template: ${updated?.name || wfId}`,
      newValues: updated,
    });
    return updated;
  } catch (err) {
    console.error('[operations] updateWorkflowTemplate error:', err);
    throw err;
  }
}

export async function deleteWorkflowTemplate(orgId: string, wfId: string) {
  try {
    const [deleted] = await db
      .delete(hrWorkflowTemplates)
      .where(and(eq(hrWorkflowTemplates.id, wfId), eq(hrWorkflowTemplates.orgId, orgId)))
      .returning();
    await createAuditLog({
      orgId, userId: 'system', action: 'delete',
      entityType: 'hr_workflow_template', entityId: wfId,
      description: `Deleted workflow template: ${deleted?.name || wfId}`,
    });
    return deleted;
  } catch (err) {
    console.error('[operations] deleteWorkflowTemplate error:', err);
    throw err;
  }
}

// ── Operations Dashboard ──

export async function getOperationsDashboard(orgId: string) {
  try {
    const [pendingTravelCount] = await db
      .select({ val: count() })
      .from(hrTravelRequests)
      .where(and(eq(hrTravelRequests.orgId, orgId), eq(hrTravelRequests.status, 'submitted')));
    const [pendingExpenseCount] = await db
      .select({ val: count() })
      .from(hrExpenseReports)
      .where(and(eq(hrExpenseReports.orgId, orgId), eq(hrExpenseReports.status, 'submitted')));
    const [activeTaskCount] = await db
      .select({ val: count() })
      .from(hrTasks)
      .where(and(eq(hrTasks.orgId, orgId), eq(hrTasks.isCompleted, false)));
    const [templateCount] = await db
      .select({ val: count() })
      .from(hrLetterTemplates)
      .where(eq(hrLetterTemplates.orgId, orgId));

    const travelByStatus = await db
      .select({ status: hrTravelRequests.status, val: count() })
      .from(hrTravelRequests)
      .where(eq(hrTravelRequests.orgId, orgId))
      .groupBy(hrTravelRequests.status);

    const expensesByStatus = await db
      .select({ status: hrExpenseReports.status, val: count() })
      .from(hrExpenseReports)
      .where(eq(hrExpenseReports.orgId, orgId))
      .groupBy(hrExpenseReports.status);

    return {
      pendingTravelRequests: pendingTravelCount?.val || 0,
      pendingExpenses: pendingExpenseCount?.val || 0,
      activeTasks: activeTaskCount?.val || 0,
      totalTemplates: templateCount?.val || 0,
      travelByStatus,
      expensesByStatus,
    };
  } catch (err) {
    console.error('[operations] getOperationsDashboard error:', err);
    throw err;
  }
}

// ── Allowances ──

export async function getAllowances(orgId: string) {
  return await db.select().from(hrAllowances).where(eq(hrAllowances.orgId, orgId)).orderBy(desc(hrAllowances.createdAt));
}

export async function getAllowance(orgId: string, allowanceId: string) {
  const [row] = await db.select().from(hrAllowances).where(and(eq(hrAllowances.id, allowanceId), eq(hrAllowances.orgId, orgId)));
  if (!row) throw new Error('Allowance not found');
  return row;
}

export async function createAllowance(orgId: string, data: any) {
  const [row] = await db.insert(hrAllowances).values({ orgId, ...data }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'allowance', entityId: row.id, newValues: data });
  return row;
}

export async function updateAllowance(orgId: string, allowanceId: string, data: any) {
  const [row] = await db.update(hrAllowances).set(data).where(and(eq(hrAllowances.id, allowanceId), eq(hrAllowances.orgId, orgId))).returning();
  if (!row) throw new Error('Allowance not found');
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'allowance', entityId: row.id, newValues: data });
  return row;
}

export async function deleteAllowance(orgId: string, allowanceId: string) {
  await db.delete(hrAllowances).where(and(eq(hrAllowances.id, allowanceId), eq(hrAllowances.orgId, orgId)));
  await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'allowance', entityId: allowanceId });
}

// ── Employee Allowances ──

export async function getEmployeeAllowances(orgId: string, employeeId: string) {
  return await db.select().from(hrEmployeeAllowances).where(and(eq(hrEmployeeAllowances.orgId, orgId), eq(hrEmployeeAllowances.employeeId, employeeId)));
}

export async function assignEmployeeAllowance(orgId: string, data: any) {
  const [row] = await db.insert(hrEmployeeAllowances).values({ orgId, ...data }).returning();
  return row;
}

export async function removeEmployeeAllowance(orgId: string, eaId: string) {
  await db.delete(hrEmployeeAllowances).where(and(eq(hrEmployeeAllowances.id, eaId), eq(hrEmployeeAllowances.orgId, orgId)));
}

// ── Bonuses ──

export async function getBonuses(orgId: string, employeeId?: string) {
  const conditions: any[] = [eq(hrBonuses.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrBonuses.employeeId, employeeId));
  return await db.select().from(hrBonuses).where(and(...conditions)).orderBy(desc(hrBonuses.createdAt));
}

export async function getBonus(orgId: string, bonusId: string) {
  const [row] = await db.select().from(hrBonuses).where(and(eq(hrBonuses.id, bonusId), eq(hrBonuses.orgId, orgId)));
  if (!row) throw new Error('Bonus not found');
  return row;
}

export async function createBonus(orgId: string, data: any) {
  const [row] = await db.insert(hrBonuses).values({ orgId, ...data }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'bonus', entityId: row.id, newValues: data });
  try { await dispatchEvent(orgId, 'bonus.created', row.id, { employeeId: data.employeeId, amount: data.amount, reason: data.reason, status: row.status }, userId); } catch (e) { console.error('[WF] dispatch bonus.created error:', e); }
  return row;
}

export async function updateBonus(orgId: string, bonusId: string, data: any) {
  const [row] = await db.update(hrBonuses).set(data).where(and(eq(hrBonuses.id, bonusId), eq(hrBonuses.orgId, orgId))).returning();
  if (!row) throw new Error('Bonus not found');
  return row;
}

export async function approveBonus(orgId: string, bonusId: string, approvedBy: string) {
  const [row] = await db.update(hrBonuses).set({ status: 'approved', approvedBy }).where(and(eq(hrBonuses.id, bonusId), eq(hrBonuses.orgId, orgId))).returning();
  if (!row) throw new Error('Bonus not found');
  await createAuditLog({ orgId, userId: approvedBy, action: 'update', entityType: 'bonus', entityId: row.id, newValues: { status: 'approved' } });
  return row;
}

export async function deleteBonus(orgId: string, bonusId: string) {
  await db.delete(hrBonuses).where(and(eq(hrBonuses.id, bonusId), eq(hrBonuses.orgId, orgId)));
  await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'bonus', entityId: bonusId });
}

// ── Deductions ──

export async function getDeductions(orgId: string) {
  return await db.select().from(hrDeductions).where(eq(hrDeductions.orgId, orgId)).orderBy(desc(hrDeductions.createdAt));
}

export async function getDeduction(orgId: string, deductionId: string) {
  const [row] = await db.select().from(hrDeductions).where(and(eq(hrDeductions.id, deductionId), eq(hrDeductions.orgId, orgId)));
  if (!row) throw new Error('Deduction not found');
  return row;
}

export async function createDeduction(orgId: string, data: any) {
  const [row] = await db.insert(hrDeductions).values({ orgId, ...data }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'deduction', entityId: row.id, newValues: data });
  return row;
}

export async function updateDeduction(orgId: string, deductionId: string, data: any) {
  const [row] = await db.update(hrDeductions).set(data).where(and(eq(hrDeductions.id, deductionId), eq(hrDeductions.orgId, orgId))).returning();
  if (!row) throw new Error('Deduction not found');
  return row;
}

export async function deleteDeduction(orgId: string, deductionId: string) {
  await db.delete(hrDeductions).where(and(eq(hrDeductions.id, deductionId), eq(hrDeductions.orgId, orgId)));
  await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'deduction', entityId: deductionId });
}

// ── Employee Deductions ──

export async function getEmployeeDeductions(orgId: string, employeeId: string) {
  return await db.select().from(hrEmployeeDeductions).where(and(eq(hrEmployeeDeductions.orgId, orgId), eq(hrEmployeeDeductions.employeeId, employeeId)));
}

export async function assignEmployeeDeduction(orgId: string, data: any) {
  const [row] = await db.insert(hrEmployeeDeductions).values({ orgId, ...data }).returning();
  return row;
}

export async function removeEmployeeDeduction(orgId: string, edId: string) {
  await db.delete(hrEmployeeDeductions).where(and(eq(hrEmployeeDeductions.id, edId), eq(hrEmployeeDeductions.orgId, orgId)));
}

// ── Salary Reviews ──

export async function getSalaryReviews(orgId: string, employeeId?: string) {
  const conditions: any[] = [eq(hrSalaryReviews.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrSalaryReviews.employeeId, employeeId));
  return await db.select().from(hrSalaryReviews).where(and(...conditions)).orderBy(desc(hrSalaryReviews.createdAt));
}

export async function getSalaryReview(orgId: string, reviewId: string) {
  const [row] = await db.select().from(hrSalaryReviews).where(and(eq(hrSalaryReviews.id, reviewId), eq(hrSalaryReviews.orgId, orgId)));
  if (!row) throw new Error('Salary review not found');
  return row;
}

export async function createSalaryReview(orgId: string, data: any) {
  const [row] = await db.insert(hrSalaryReviews).values({ orgId, ...data }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'salary_review', entityId: row.id, newValues: data });
  try { await dispatchEvent(orgId, 'salary_review.created', row.id, { employeeId: data.employeeId, currentSalary: data.currentSalary, proposedSalary: data.proposedSalary, reason: data.reason, status: row.status }, userId); } catch (e) { console.error('[WF] dispatch salary_review.created error:', e); }
  return row;
}

export async function approveSalaryReview(orgId: string, reviewId: string, approvedBy: string) {
  const [row] = await db.update(hrSalaryReviews).set({ status: 'approved', approvedBy, decidedAt: new Date() }).where(and(eq(hrSalaryReviews.id, reviewId), eq(hrSalaryReviews.orgId, orgId))).returning();
  if (!row) throw new Error('Salary review not found');
  await createAuditLog({ orgId, userId: approvedBy, action: 'update', entityType: 'salary_review', entityId: row.id, newValues: { status: 'approved' } });
  if (row.employeeId) {
    const existing = await db.select().from(hrEmployeeCompensation).where(and(eq(hrEmployeeCompensation.employeeId, row.employeeId), eq(hrEmployeeCompensation.orgId, orgId)));
    if (existing.length > 0) {
      await db.update(hrEmployeeCompensation).set({ salary: row.newSalary, updatedAt: new Date() }).where(eq(hrEmployeeCompensation.id, existing[0].id));
    }
    await db.insert(hrCompensationHistory).values({ orgId, employeeId: row.employeeId, changeType: 'salary_review', previousValue: row.previousSalary, newValue: row.newSalary, reason: row.reason, changedBy: approvedBy });
  }
  return row;
}

export async function rejectSalaryReview(orgId: string, reviewId: string) {
  const [row] = await db.update(hrSalaryReviews).set({ status: 'rejected', decidedAt: new Date() }).where(and(eq(hrSalaryReviews.id, reviewId), eq(hrSalaryReviews.orgId, orgId))).returning();
  if (!row) throw new Error('Salary review not found');
  return row;
}

export async function deleteSalaryReview(orgId: string, reviewId: string) {
  await db.delete(hrSalaryReviews).where(and(eq(hrSalaryReviews.id, reviewId), eq(hrSalaryReviews.orgId, orgId)));
}

// ── Compensation History ──

export async function getCompensationHistory(orgId: string, employeeId?: string) {
  const conditions: any[] = [eq(hrCompensationHistory.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrCompensationHistory.employeeId, employeeId));
  return await db.select().from(hrCompensationHistory).where(and(...conditions)).orderBy(desc(hrCompensationHistory.createdAt));
}

// ── Compensation Reports ──

export async function getCompensationReport(orgId: string) {
  const bands = await db.select({ count: count() }).from(hrCompensationBands).where(eq(hrCompensationBands.orgId, orgId));
  const comps = await db.select({
    totalSalary: sql`COALESCE(SUM(${hrEmployeeCompensation.salary}), 0)`,
    empCount: sql`COUNT(*)`,
  }).from(hrEmployeeCompensation).where(eq(hrEmployeeCompensation.orgId, orgId));

  const activeBands = await db.select({ count: count() }).from(hrCompensationBands).where(and(eq(hrCompensationBands.orgId, orgId), eq(hrCompensationBands.isActive, true)));
  const totalAllowances = await db.select({ count: count() }).from(hrAllowances).where(eq(hrAllowances.orgId, orgId));
  const totalDeductions = await db.select({ count: count() }).from(hrDeductions).where(eq(hrDeductions.orgId, orgId));
  const pendingReviews = await db.select({ count: count() }).from(hrSalaryReviews).where(and(eq(hrSalaryReviews.orgId, orgId), eq(hrSalaryReviews.status as any, 'pending')));
  const approvedBonuses = await db.select({ count: count() }).from(hrBonuses).where(and(eq(hrBonuses.orgId, orgId), eq(hrBonuses.status as any, 'approved')));
  const totalBenefits = await db.select({ count: count() }).from(hrBenefits).where(eq(hrBenefits.orgId, orgId));
  const benefitCost = await db.select({ total: sql`COALESCE(SUM(${hrBenefits.costEmployer}), 0)` }).from(hrBenefits).where(eq(hrBenefits.orgId, orgId));

  return {
    totalPayGrades: bands[0]?.count || 0,
    activePayGrades: activeBands[0]?.count || 0,
    totalEmployees: Number(comps[0]?.empCount || 0),
    totalSalaryCost: Number(comps[0]?.totalSalary || 0),
    totalAllowances: totalAllowances[0]?.count || 0,
    totalDeductions: totalDeductions[0]?.count || 0,
    pendingSalaryReviews: pendingReviews[0]?.count || 0,
    approvedBonuses: approvedBonuses[0]?.count || 0,
    totalBenefits: totalBenefits[0]?.count || 0,
    totalBenefitsCost: Number(benefitCost[0]?.total || 0),
  };
}

export async function handleTravelRequestApproval(orgId: string, sourceId: string, _requestId: string) {
  try {
    const [record] = await db.update(hrTravelRequests).set({ status: 'approved', updatedAt: sql`now()` })
      .where(and(eq(hrTravelRequests.id, sourceId), eq(hrTravelRequests.orgId, orgId))).returning();
    if (record) await createAuditLog({ orgId, userId: 'approval_engine', action: 'approve', entityType: 'hr_travel_request', entityId: sourceId, newValues: record });
  } catch (e) { console.error('[Approval] travel handler error:', e); }
}

export async function handleExpenseApproval(orgId: string, sourceId: string, _requestId: string) {
  try {
    const [record] = await db.update(hrExpenseReports).set({ status: 'approved', updatedAt: sql`now()` })
      .where(and(eq(hrExpenseReports.id, sourceId), eq(hrExpenseReports.orgId, orgId))).returning();
    if (record) await createAuditLog({ orgId, userId: 'approval_engine', action: 'approve', entityType: 'hr_expense_report', entityId: sourceId, newValues: record });
  } catch (e) { console.error('[Approval] expense handler error:', e); }
}

export async function handleBonusApproval(orgId: string, sourceId: string, _requestId: string) {
  try { await approveBonus(orgId, sourceId, 'approval_engine'); } catch (e) { console.error('[Approval] bonus handler error:', e); }
}

export async function handleSalaryReviewApproval(orgId: string, sourceId: string, _requestId: string) {
  try { await approveSalaryReview(orgId, sourceId, 'approval_engine', ''); } catch (e) { console.error('[Approval] salary review handler error:', e); }
}

try {
  registerApprovalHandler('travel_request', handleTravelRequestApproval);
  registerApprovalHandler('expense_report', handleExpenseApproval);
  registerApprovalHandler('bonus', handleBonusApproval);
  registerApprovalHandler('salary_review', handleSalaryReviewApproval);
} catch (e) { /* ignored */ }
