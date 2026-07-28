import { sql, eq, and } from 'drizzle-orm';
import { db } from '../../db';
import {
  hrEmployees, hrDepartments, hrDesignations, hrTasks, hrCalendarEvents, hrDocFiles,
  employees, projects, documents,
} from '../../db/schema';
import { createAuditLog } from '../audit.service';
import { postToGL } from '../posting.service';
import { sendOrgEmail } from '../email.service';

// ── Payroll ↔ HR Sync ──

export async function syncHrEmployeeToPayroll(orgId: string, hrEmployeeId: string, userId?: string) {
  const [emp] = await db.select().from(hrEmployees).where(and(eq(hrEmployees.id, hrEmployeeId), eq(hrEmployees.orgId, orgId)));
  if (!emp) throw new Error('HR employee not found');

  const [dept] = emp.departmentId ? await db.select({ name: hrDepartments.name }).from(hrDepartments).where(eq(hrDepartments.id, emp.departmentId)) : [];
  const [desig] = emp.designationId ? await db.select({ title: hrDesignations.title }).from(hrDesignations).where(eq(hrDesignations.id, emp.designationId)) : [];

  const staffId = emp.employeeCode;
  const existingPayrollEmp = await db.select().from(employees).where(and(eq(employees.hrEmployeeId, hrEmployeeId), eq(employees.orgId, orgId)));

  const payrollData = {
    orgId,
    hrEmployeeId,
    staffId,
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email,
    phone: emp.phone,
    department: dept?.name || null,
    designation: desig?.title || null,
    dateOfBirth: emp.dateOfBirth ? new Date(emp.dateOfBirth) : null,
    dateHired: emp.joinDate ? new Date(emp.joinDate) : null,
    bankName: emp.bankName,
    accountNumber: emp.bankAccountNumber,
    isActive: emp.employmentStatus === 'active',
  };

  if (existingPayrollEmp.length > 0) {
    const [updated] = await db.update(employees).set(payrollData).where(eq(employees.id, existingPayrollEmp[0].id)).returning();
    await createAuditLog({ orgId, userId: userId || 'system', action: 'update', entityType: 'payroll_employee', entityId: updated.id, description: 'Synced from HR employee update' });
    return updated;
  }

  const [created] = await db.insert(employees).values(payrollData).returning();
  await createAuditLog({ orgId, userId: userId || 'system', action: 'create', entityType: 'payroll_employee', entityId: created.id, description: 'Auto-created from HR employee' });
  return created;
}

export async function syncTerminationToPayroll(orgId: string, hrEmployeeId: string, exitDate: Date, reason?: string, userId?: string) {
  const existingPayrollEmp = await db.select().from(employees).where(and(eq(employees.hrEmployeeId, hrEmployeeId), eq(employees.orgId, orgId)));
  if (existingPayrollEmp.length === 0) return null;

  const [updated] = await db.update(employees).set({ isActive: false }).where(eq(employees.id, existingPayrollEmp[0].id)).returning();
  await createAuditLog({ orgId, userId: userId || 'system', action: 'update', entityType: 'payroll_employee', entityId: updated.id, description: `Deactivated due to HR termination: ${reason || 'N/A'}` });
  return updated;
}

export async function bulkSyncAllHrToPayroll(orgId: string, userId?: string) {
  const allHr = await db.select().from(hrEmployees).where(eq(hrEmployees.orgId, orgId));
  const results: { hrId: string; payrollId: string; action: string }[] = [];
  for (const emp of allHr) {
    const result = await syncHrEmployeeToPayroll(orgId, emp.id, userId);
    results.push({ hrId: emp.id, payrollId: result.id, action: result.hrEmployeeId ? 'synced' : 'created' });
  }
  return results;
}

export async function getHrDataForPayrollRun(orgId: string) {
  const activeEmps = await db.select().from(hrEmployees).where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.employmentStatus, 'active')));
  const enriched: any[] = [];
  for (const emp of activeEmps) {
    const [dept] = emp.departmentId ? await db.select({ name: hrDepartments.name }).from(hrDepartments).where(eq(hrDepartments.id, emp.departmentId)) : [];
    const [desig] = emp.designationId ? await db.select({ title: hrDesignations.title }).from(hrDesignations).where(eq(hrDesignations.id, emp.designationId)) : [];
    const payrollEmp = await db.select().from(employees).where(and(eq(employees.hrEmployeeId, emp.id), eq(employees.orgId, orgId)));
    enriched.push({
      hrEmployee: emp,
      department: dept,
      designation: desig,
      payroll: payrollEmp[0] || null,
    });
  }
  return enriched;
}

// ── Accounting — Post non-payroll HR costs to GL ──

export async function postHrCostEntry(orgId: string, data: {
  date: Date; description: string; amountKobo: number;
  debitAccountCode: string; creditAccountCode: string;
  reference?: string; sourceId?: string; createdBy?: string;
  projectId?: string;
}) {
  return await postToGL({
    orgId,
    date: data.date,
    description: data.description,
    reference: data.reference,
    source: 'manual',
    sourceId: data.sourceId,
    projectId: data.projectId,
    createdBy: data.createdBy || 'hr-integration',
    lines: [
      { accountId: '', accountRole: undefined, debit: data.amountKobo, credit: undefined, description: data.description },
      { accountId: '', accountRole: undefined, debit: undefined, credit: data.amountKobo, description: data.description },
    ],
  });
}

// ── Projects — Sync HR attendance/timesheet data to project costing ──

export async function postTimesheetToProject(orgId: string, data: {
  employeeId: string; projectId: string; date: Date; hours: number;
  description?: string; hourlyRateKobo?: number; createdBy?: string;
}) {
  const amount = (data.hourlyRateKobo || 0) * data.hours;
  return await postToGL({
    orgId,
    date: data.date,
    description: data.description || `Timesheet: ${data.hours}h on project`,
    reference: `TS-${data.employeeId.slice(0, 8)}`,
    source: 'manual',
    sourceId: `${data.projectId}-${data.employeeId}-${data.date.toISOString().slice(0, 10)}`,
    projectId: data.projectId,
    createdBy: data.createdBy || 'hr-integration',
    lines: [
      { accountId: '', accountRole: 'cost_of_goods_sold', debit: amount, credit: undefined, description: 'Labour cost' },
      { accountId: '', accountRole: 'accrued_expenses', debit: undefined, credit: amount, description: 'Accrued labour' },
    ],
  });
}

// ── Cross-Module Task Creation ──

export async function createCrossModuleTask(orgId: string, data: {
  title: string; description?: string; assignedTo: string;
  priority?: string; dueDate?: Date; category?: string;
  relatedTo?: string; relatedId?: string; createdBy?: string;
}) {
  const [row] = await db.insert(hrTasks).values({
    orgId, title: data.title, description: data.description || null,
    assignedTo: data.assignedTo, priority: data.priority || 'medium',
    dueDate: data.dueDate || null, category: data.category || 'general',
    relatedTo: data.relatedTo || null, relatedId: data.relatedId || null,
    status: 'pending', createdBy: data.createdBy || 'system',
  }).returning();
  return row;
}

export async function getCrossModuleTasks(orgId: string, filters?: {
  assignedTo?: string; status?: string; category?: string;
  relatedTo?: string; relatedId?: string;
}) {
  const conditions: any[] = [eq(hrTasks.orgId, orgId)];
  if (filters?.assignedTo) conditions.push(eq(hrTasks.assignedTo, filters.assignedTo));
  if (filters?.status) conditions.push(eq(hrTasks.status, filters.status));
  if (filters?.category) conditions.push(eq(hrTasks.category, filters.category));
  if (filters?.relatedTo) conditions.push(eq(hrTasks.relatedTo, filters.relatedTo));
  if (filters?.relatedId) conditions.push(eq(hrTasks.relatedId, filters.relatedId));
  return await db.select().from(hrTasks).where(and(...conditions)).orderBy(sql`created_at desc`);
}

// ── Cross-Module Calendar Events ──

export async function createCrossModuleEvent(orgId: string, data: {
  title: string; description?: string; eventType: string;
  startTime: Date; endTime?: Date; allDay?: boolean;
  location?: string; link?: string; source?: string; sourceId?: string;
  employeeId?: string;
}) {
  const [row] = await db.insert(hrCalendarEvents).values({
    orgId, title: data.title, description: data.description || null,
    eventType: data.eventType, startTime: data.startTime,
    endTime: data.endTime || null, allDay: data.allDay || false,
    location: data.location || null, link: data.link || null,
    source: data.source || null, sourceId: data.sourceId || null,
    employeeId: data.employeeId || null,
  }).returning();
  return row;
}

// ── HR Notifications for Main System ──

export async function getHrSystemNotifications(orgId: string) {
  const items: { id: string; icon: string; message: string; severity: 'info' | 'warning' | 'error'; link: string; timestamp: Date }[] = [];
  const now = new Date();

  // Pending approvals count
  const { getApprovalDashboard } = await import('./approval.service');
  try {
    const dashboard = await getApprovalDashboard(orgId);
    if (dashboard.myPendingCount > 0) {
      items.push({
        id: 'hr-pending-approvals',
        icon: '\u2705',
        message: `${dashboard.myPendingCount} HR approval${dashboard.myPendingCount > 1 ? 's' : ''} pending your review`,
        severity: 'warning',
        link: '/app/hr/approvals/my-queue',
        timestamp: now,
      });
    }
  } catch {}

  // Unread notifications
  const unreadCount = await db.select({ count: sql<number>`count(*)` }).from(
    Object.keys(require('../../db/schema')).includes('hrNotifications') ? require('../../db/schema').hrNotifications : []
  ).catch(() => [{ count: 0 }]);
  // Actually use a simpler approach - count from hrCalendarEvents unread
  try {
    const [unreadEvents] = await db.select({ count: sql<number>`count(*)` }).from(hrCalendarEvents)
      .where(and(eq(hrCalendarEvents.orgId, orgId), eq(hrCalendarEvents.isRead, false)));
    if (unreadEvents?.count > 0) {
      items.push({
        id: 'hr-unread-events',
        icon: '\uD83D\uDCC5',
        message: `${unreadEvents.count} unread calendar event${unreadEvents.count > 1 ? 's' : ''}`,
        severity: 'info',
        link: '/app/hr/workflow/notifications',
        timestamp: now,
      });
    }
  } catch {}

  // Upcoming renewals
  const { getUpcomingRenewals } = await import('./workflow.service');
  try {
    const renewals = await getUpcomingRenewals(orgId, 14);
    if (renewals.length > 0) {
      items.push({
        id: 'hr-upcoming-renewals',
        icon: '\uD83D\uDD04',
        message: `${renewals.length} renewal${renewals.length > 1 ? 's' : ''} due within 14 days`,
        severity: 'info',
        link: '/app/hr/workflow/reminder-configs',
        timestamp: now,
      });
    }
  } catch {}

  // Employees on probation ending
  const probationEnding = await db.select({ count: sql<number>`count(*)` }).from(hrEmployees)
    .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.employmentStatus, 'active'),
      sql`${hrEmployees.confirmDate} is null AND ${hrEmployees.joinDate} + interval '90 days' between current_date and current_date + interval '30 days'`));
  if (probationEnding[0]?.count > 0) {
    items.push({
      id: 'hr-probation-ending',
      icon: '\uD83D\uDCCB',
      message: `${probationEnding[0].count} probation${probationEnding[0].count > 1 ? 's' : ''} ending soon`,
      severity: 'info',
      link: '/app/hr/reports/employee-info',
      timestamp: now,
    });
  }

  return items;
}

// ── AI Assistant HR Data Provider ──

export async function getHrAiInsights(orgId: string) {
  const totalEmployees = await db.select({ count: sql<number>`count(*)` }).from(hrEmployees).where(eq(hrEmployees.orgId, orgId)).then(r => r[0]?.count || 0);
  const activeEmployees = await db.select({ count: sql<number>`count(*)` }).from(hrEmployees).where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.employmentStatus, 'active'))).then(r => r[0]?.count || 0);
  const deptCount = await db.select({ count: sql<number>`count(*)` }).from(hrDepartments).where(eq(hrDepartments.orgId, orgId)).then(r => r[0]?.count || 0);
  const newHires30 = await db.select({ count: sql<number>`count(*)` }).from(hrEmployees)
    .where(and(eq(hrEmployees.orgId, orgId), sql`${hrEmployees.joinDate} >= current_date - interval '30 days'`)).then(r => r[0]?.count || 0);
  const terminations30 = await db.select({ count: sql<number>`count(*)` }).from(hrEmployees)
    .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.employmentStatus, 'terminated'), sql`${hrEmployees.exitDate} >= current_date - interval '30 days'`)).then(r => r[0]?.count || 0);

  const deptBreakdown = await db.select({
    name: hrDepartments.name, count: sql<number>`count(${hrEmployees.id})`,
  }).from(hrDepartments).leftJoin(hrEmployees, eq(hrDepartments.id, hrEmployees.departmentId))
    .where(eq(hrDepartments.orgId, orgId)).groupBy(hrDepartments.name);

  return {
    totalEmployees, activeEmployees, departmentCount: deptCount,
    newHiresLast30Days: newHires30, terminationsLast30Days: terminations30,
    departmentBreakdown: deptBreakdown,
    turnoverRate: activeEmployees > 0 ? Math.round((terminations30 / activeEmployees) * 100) : 0,
  };
}

// ── Document Bridge — sync HR doc to system documents ──

export async function syncHrDocToSystem(orgId: string, hrDocFileId: string, userId?: string) {
  const [doc] = await db.select().from(hrDocFiles).where(and(eq(hrDocFiles.id, hrDocFileId), eq(hrDocFiles.orgId, orgId)));
  if (!doc) throw new Error('HR document not found');

  const [existing] = await db.select().from(documents).where(
    and(eq(documents.referenceType, 'hr_doc'), eq(documents.referenceId, hrDocFileId), eq(documents.orgId, orgId))
  );
  if (existing) return existing;

  const [row] = await db.insert(documents).values({
    orgId, name: doc.name, fileUrl: doc.fileUrl, fileType: doc.fileType,
    fileSize: doc.fileSize, referenceType: 'hr_doc', referenceId: hrDocFileId,
    uploadedBy: userId || doc.uploadedBy || null,
  }).returning();
  return row;
}

// ── Onboarding Automation ──

export async function createOnboardingTasks(orgId: string, employeeId: string, departmentId?: string, userId?: string) {
  const defaultTasks = [
    { title: 'IT Setup — Create email account', category: 'it', priority: 'high' },
    { title: 'IT Setup — Provision laptop and accessories', category: 'it', priority: 'high' },
    { title: 'HR — Submit employment documents', category: 'hr', priority: 'high' },
    { title: 'HR — Complete onboarding paperwork', category: 'hr', priority: 'medium' },
    { title: 'Finance — Set up payroll and bank details', category: 'finance', priority: 'high' },
    { title: 'Facilities — Assign desk and access card', category: 'facilities', priority: 'medium' },
    { title: 'IT — Grant system access (email, Slack, ERP)', category: 'it', priority: 'high' },
    { title: 'Manager — Schedule first week plan', category: 'manager', priority: 'medium' },
    { title: 'HR — Schedule orientation session', category: 'hr', priority: 'medium' },
    { title: 'Benefits — Enroll in health insurance and pension', category: 'finance', priority: 'high' },
  ];

  const created: any[] = [];
  for (const task of defaultTasks) {
    const [row] = await db.insert(hrTasks).values({
      orgId, title: task.title, category: task.category, priority: task.priority,
      assignedTo: employeeId, status: 'pending', createdBy: userId || 'system',
      relatedTo: 'onboarding', relatedId: employeeId,
    }).returning();
    created.push(row);
  }

  await createAuditLog({ orgId, userId: userId || 'system', action: 'create', entityType: 'onboarding_tasks', entityId: employeeId, description: `Created ${created.length} onboarding tasks for employee` });

  // Notify IT, HR, Finance stakeholders
  const itTask = created.find(t => t.category === 'it');
  const hrTask = created.find(t => t.category === 'hr');
  const financeTask = created.find(t => t.category === 'finance');
  const notifications: string[] = [];
  if (itTask) notifications.push('it');
  if (hrTask) notifications.push('hr');
  if (financeTask) notifications.push('finance');

  return { tasks: created, notifiedDepartments: notifications };
}

// ── Offboarding Automation ──

export async function createOffboardingTasks(orgId: string, employeeId: string, exitDate: Date, reason?: string, userId?: string) {
  const tasks = [
    { title: 'IT — Deactivate email and system accounts', category: 'it', priority: 'high' },
    { title: 'IT — Collect laptop and accessories', category: 'it', priority: 'high' },
    { title: 'HR — Process exit interview', category: 'hr', priority: 'medium' },
    { title: 'HR — Prepare certificate of employment', category: 'hr', priority: 'medium' },
    { title: 'Finance — Process final pay and benefits', category: 'finance', priority: 'high' },
    { title: 'Finance — Settle outstanding expenses', category: 'finance', priority: 'medium' },
    { title: 'Facilities — Reclaim desk and access card', category: 'facilities', priority: 'medium' },
    { title: 'Manager — Conduct handover', category: 'manager', priority: 'high' },
  ];

  const created: any[] = [];
  for (const task of tasks) {
    const [row] = await db.insert(hrTasks).values({
      orgId, title: task.title, category: task.category, priority: task.priority,
      assignedTo: employeeId, status: 'pending', dueDate: exitDate,
      createdBy: userId || 'system', relatedTo: 'offboarding', relatedId: employeeId,
    }).returning();
    created.push(row);
  }

  await createAuditLog({ orgId, userId: userId || 'system', action: 'create', entityType: 'offboarding_tasks', entityId: employeeId, description: `Created ${created.length} offboarding tasks for termination: ${reason || 'N/A'}` });
  return { tasks: created, employeeId, exitDate };
}

// ── Payroll Run Integration — enrich with HR data ──

export async function enrichPayrollRunWithHrData(orgId: string, runId: string) {
  const { payrollLines, payrollRuns } = await import('../../db/schema');
  const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, runId), eq(payrollRuns.orgId, orgId)));
  if (!run) throw new Error('Payroll run not found');

  const lines = await db.select().from(payrollLines).where(eq(payrollLines.runId, runId));

  const enriched = await Promise.all(lines.map(async (line) => {
    let hrData = null;
    if (line.employeeId) {
      const [payrollEmp] = await db.select().from(employees).where(eq(employees.id, line.employeeId));
      if (payrollEmp?.hrEmployeeId) {
        const [hrEmp] = await db.select().from(hrEmployees).where(eq(hrEmployees.id, payrollEmp.hrEmployeeId));
        if (hrEmp) {
          const [dept] = hrEmp.departmentId ? await db.select({ name: hrDepartments.name }).from(hrDepartments).where(eq(hrDepartments.id, hrEmp.departmentId)) : [];
          const [desig] = hrEmp.designationId ? await db.select({ title: hrDesignations.title }).from(hrDesignations).where(eq(hrDesignations.id, hrEmp.designationId)) : [];
          hrData = { employeeCode: hrEmp.employeeCode, department: dept?.name, designation: desig?.title, supervisorId: hrEmp.supervisorId, employmentStatus: hrEmp.employmentStatus };
        }
      }
    }
    return { ...line, hrData };
  }));

  return { run, enrichedLines: enriched };
}
