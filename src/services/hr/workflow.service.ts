import { sql, eq, and, or, desc, asc, count, isNull, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  hrWorkflowTemplates, hrWorkflowInstances, hrAutomationRules,
  hrNotifications, hrReminderConfigs, hrEmployees,
  hrPolicyAcknowledgements, hrDocumentRequests, hrRenewalTracking, hrCalendarEvents,
} from '../../db/schema';
import { createAuditLog } from '../audit.service';
import { sendOrgEmail } from '../email.service';
import { createApprovalRequest } from './approval.service';

// ── Workflow Template CRUD ──

export async function getWorkflowTemplates(orgId: string) {
  return await db.select().from(hrWorkflowTemplates).where(eq(hrWorkflowTemplates.orgId, orgId)).orderBy(hrWorkflowTemplates.name);
}

export async function getWorkflowTemplate(orgId: string, id: string) {
  const [row] = await db.select().from(hrWorkflowTemplates).where(and(eq(hrWorkflowTemplates.id, id), eq(hrWorkflowTemplates.orgId, orgId)));
  if (!row) throw new Error('Workflow template not found');
  return row;
}

export async function createWorkflowTemplate(orgId: string, data: any) {
  const [row] = await db.insert(hrWorkflowTemplates).values({ orgId, name: data.name, description: data.description, steps: data.steps || [], isActive: data.isActive !== false }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'workflow_template', entityId: row.id, newValues: data });
  return row;
}

export async function updateWorkflowTemplate(orgId: string, id: string, data: any) {
  const [row] = await db.update(hrWorkflowTemplates).set({ ...data, updatedAt: sql`now()` }).where(and(eq(hrWorkflowTemplates.id, id), eq(hrWorkflowTemplates.orgId, orgId))).returning();
  if (!row) throw new Error('Workflow template not found');
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'workflow_template', entityId: id, newValues: data });
  return row;
}

export async function deleteWorkflowTemplate(orgId: string, id: string, userId?: string) {
  const [row] = await db.delete(hrWorkflowTemplates).where(and(eq(hrWorkflowTemplates.id, id), eq(hrWorkflowTemplates.orgId, orgId))).returning();
  if (!row) throw new Error('Workflow template not found');
  await createAuditLog({ orgId, userId: userId || 'system', action: 'delete', entityType: 'workflow_template', entityId: id });
  return row;
}

// ── Automation Rules ──

export async function getAutomationRules(orgId: string, event?: string) {
  const conditions: any[] = [eq(hrAutomationRules.orgId, orgId)];
  if (event) conditions.push(eq(hrAutomationRules.event, event));
  return await db.select().from(hrAutomationRules).where(and(...conditions)).orderBy(hrAutomationRules.name);
}

export async function createAutomationRule(orgId: string, data: any) {
  const [row] = await db.insert(hrAutomationRules).values({
    orgId, name: data.name, event: data.event, conditions: data.conditions || {},
    actions: data.actions || [], templateId: data.templateId || null,
    schedule: data.schedule || null, isActive: data.isActive !== false,
  }).returning();
  return row;
}

export async function updateAutomationRule(orgId: string, id: string, data: any) {
  const [row] = await db.update(hrAutomationRules).set({ ...data, updatedAt: sql`now()` })
    .where(and(eq(hrAutomationRules.id, id), eq(hrAutomationRules.orgId, orgId))).returning();
  if (!row) throw new Error('Rule not found');
  return row;
}

export async function deleteAutomationRule(orgId: string, id: string) {
  const [row] = await db.delete(hrAutomationRules).where(and(eq(hrAutomationRules.id, id), eq(hrAutomationRules.orgId, orgId))).returning();
  return row;
}

// ── Workflow Execution ──

export async function executeWorkflow(orgId: string, templateId: string, trigger: string, sourceId?: string, data?: any, userId?: string) {
  const [template] = await db.select().from(hrWorkflowTemplates).where(and(eq(hrWorkflowTemplates.id, templateId), eq(hrWorkflowTemplates.orgId, orgId)));
  if (!template) throw new Error('Template not found');

  const steps = (template.steps as any[]) || [];
  const name = data?.name || template.name;

  const [instance] = await db.insert(hrWorkflowInstances).values({
    orgId, templateId, name, trigger, sourceId: sourceId || null,
    totalSteps: steps.length, data: data || {},
  }).returning();

  await createAuditLog({
    orgId, userId: userId || 'system', action: 'create', entityType: 'workflow_instance',
    entityId: instance.id, description: `Workflow "${name}" started via ${trigger}`,
  });

  // Execute steps asynchronously
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    await executeWorkflowStep(orgId, instance.id, step, i + 1, data, userId);
  }

  await db.update(hrWorkflowInstances).set({ status: 'completed', currentStep: steps.length, completedAt: sql`now()` })
    .where(eq(hrWorkflowInstances.id, instance.id));

  return instance;
}

async function executeWorkflowStep(orgId: string, instanceId: string, step: any, stepNum: number, data?: any, userId?: string) {
  // Update current step
  await db.update(hrWorkflowInstances).set({ status: 'running', currentStep: stepNum }).where(eq(hrWorkflowInstances.id, instanceId));

  try {
    const stepData = { ...(data || {}), ...(step.config || {}) };

    switch (step.action) {
      case 'email': {
        const recipients = step.recipients || [];
        const subject = renderTemplate(step.subject, stepData);
        const body = renderTemplate(step.body, stepData);
        for (const to of recipients) {
          try { await sendOrgEmail(orgId, { to, subject, html: body }); } catch (e) { console.error('[WF] email error:', e); }
        }
        break;
      }
      case 'notification': {
        const empIds = step.employeeIds || [];
        for (const empId of empIds) {
          await createNotification(orgId, empId, step.notificationType || 'workflow', renderTemplate(step.title, stepData), renderTemplate(step.body, stepData), step.link);
        }
        break;
      }
      case 'approval': {
        const approverId = step.approverId || stepData.approverId;
        if (approverId) {
          try {
            await createApprovalRequest(orgId, {
              module: step.module || 'workflow', sourceId: instanceId, requesterId: userId || stepData.requesterId || approverId,
              title: renderTemplate(step.title, stepData), description: renderTemplate(step.description, stepData),
              configId: step.configId, userId,
            });
          } catch (e) { console.error('[WF] approval error:', e); }
        }
        break;
      }
      case 'task': {
        const assigneeId = step.assigneeId || stepData.assigneeId;
        if (assigneeId) {
          await createTaskRecord(orgId, assigneeId, renderTemplate(step.title, stepData), renderTemplate(step.description, stepData), step.priority || 'medium');
        }
        break;
      }
      case 'status_change': {
        await updateSourceStatus(orgId, step.module, step.sourceField || 'id', instanceId, step.targetStatus);
        break;
      }
      case 'webhook': {
        const url = step.url;
        if (url) {
          try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stepData) }); } catch (e) { console.error('[WF] webhook error:', e); }
        }
        break;
      }
      case 'delay': {
        const ms = (step.delayMs || 5000);
        await new Promise(resolve => setTimeout(resolve, ms));
        break;
      }
      case 'calendar_event': {
        const empId = step.employeeId || stepData.employeeId;
        if (empId) {
          await createCalendarEvent(orgId, {
            employeeId: empId,
            title: renderTemplate(step.title, stepData),
            description: renderTemplate(step.description, stepData),
            eventType: step.eventType || 'workflow',
            startTime: step.startTime ? new Date(renderTemplate(step.startTime, stepData)) : new Date(),
            endTime: step.endTime ? new Date(renderTemplate(step.endTime, stepData)) : undefined,
            allDay: step.allDay || false,
            location: renderTemplate(step.location, stepData),
            link: renderTemplate(step.link, stepData),
            source: 'workflow',
            sourceId: instanceId,
          });
        }
        break;
      }
      case 'document_request': {
        const empId = step.employeeId || stepData.employeeId;
        if (empId) {
          await createDocumentRequest(orgId, {
            employeeId: empId,
            documentType: step.documentType || renderTemplate(step.title, stepData),
            description: renderTemplate(step.description, stepData),
            reason: step.reason,
            dueDate: step.dueDate ? new Date(renderTemplate(step.dueDate, stepData)) : undefined,
            requestedBy: userId,
          });
        }
        break;
      }
      case 'renewal': {
        const empId = step.employeeId || stepData.employeeId;
        if (empId) {
          await createRenewalRecord(orgId, {
            employeeId: empId,
            type: step.renewalType || 'contract',
            title: renderTemplate(step.title, stepData),
            description: renderTemplate(step.description, stepData),
            currentExpiryDate: step.currentExpiryDate ? new Date(renderTemplate(step.currentExpiryDate, stepData)) : undefined,
            reminderDays: step.reminderDays || 30,
            autoRenew: step.autoRenew || false,
          });
        }
        break;
      }
      case 'policy_acknowledgement': {
        const empId = step.employeeId || stepData.employeeId;
        const policyId = step.policyId || stepData.policyId;
        if (empId && policyId) {
          await requestPolicyAcknowledgement(orgId, {
            policyId,
            employeeId: empId,
            dueDate: step.dueDate ? new Date(renderTemplate(step.dueDate, stepData)) : undefined,
          });
        }
        break;
      }
    }

    await createAuditLog({
      orgId, userId: userId || 'system', action: 'step_complete', entityType: 'workflow_step',
      entityId: instanceId, description: `Step ${stepNum}: ${step.action} completed`,
    });
  } catch (err) {
    console.error(`[WF] Step ${stepNum} error:`, err);
    await db.update(hrWorkflowInstances).set({ status: 'failed' }).where(eq(hrWorkflowInstances.id, instanceId));
  }
}

function renderTemplate(template: string, data: any): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => data[key] !== undefined ? String(data[key]) : `{{${key}}}`);
}

async function createTaskRecord(orgId: string, assigneeId: string, title: string, description?: string, priority?: string) {
  const { hrTasks } = await import('../../db/schema');
  await db.insert(hrTasks).values({ orgId, title, description: description || null, assignedTo: assigneeId, priority: priority || 'medium', status: 'pending', createdBy: 'workflow' }).returning();
}

async function updateSourceStatus(orgId: string, module: string, sourceField: string, sourceId: string, targetStatus: string) {
  try {
    const tableMap: Record<string, any> = {};
    if (module === 'leave') tableMap.module = 'leave';
    // Generic fallback
    console.log(`[WF] Status change for ${module}#${sourceId} -> ${targetStatus}`);
  } catch (e) { console.error('[WF] status change error:', e); }
}

// ── Event Dispatch ──

export async function dispatchEvent(orgId: string, event: string, sourceId?: string, data?: any, userId?: string) {
  const rules = await db.select().from(hrAutomationRules).where(and(
    eq(hrAutomationRules.orgId, orgId), eq(hrAutomationRules.event, event), eq(hrAutomationRules.isActive, true),
  ));

  const results: any[] = [];
  for (const rule of rules) {
    // Check conditions
    if (rule.conditions && Object.keys(rule.conditions as any).length > 0) {
      const matches = checkConditions(rule.conditions as any, data || {});
      if (!matches) continue;
    }

    // Direct actions
    if ((rule.actions as any[])?.length > 0) {
      for (const action of rule.actions as any[]) {
        await executeDirectAction(orgId, action, data, userId);
      }
    }

    // Execute workflow template
    if (rule.templateId) {
      try {
        const result = await executeWorkflow(orgId, rule.templateId, event, sourceId, data, userId);
        results.push({ ruleId: rule.id, workflowId: result.id });
      } catch (e) { console.error('[WF] template execution error:', e); }
    }

    await db.update(hrAutomationRules).set({ lastTriggeredAt: sql`now()` }).where(eq(hrAutomationRules.id, rule.id));
  }
  return results;
}

function checkConditions(conditions: any, data: any): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = data[key];
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
    } else if (actual !== expected) return false;
  }
  return true;
}

async function executeDirectAction(orgId: string, action: any, data?: any, userId?: string) {
  switch (action.type) {
    case 'email': {
      if (action.recipients) {
        for (const to of action.recipients) {
          try { await sendOrgEmail(orgId, { to, subject: renderTemplate(action.subject, data || {}), html: renderTemplate(action.body, data || {}) }); } catch (e) { console.error('[WF] action email error:', e); }
        }
      }
      break;
    }
    case 'notification': {
      if (action.employeeIds) {
        for (const empId of action.employeeIds) {
          await createNotification(orgId, empId, action.notificationType || 'event', renderTemplate(action.title, data || {}), renderTemplate(action.body, data || {}), action.link);
        }
      }
      break;
    }
    case 'calendar_event': {
      if (action.employeeId) {
        await createCalendarEvent(orgId, {
          employeeId: action.employeeId,
          title: renderTemplate(action.title, data || {}),
          description: renderTemplate(action.description, data || {}),
          eventType: action.eventType || 'workflow',
          startTime: action.startTime ? new Date(renderTemplate(action.startTime, data || {})) : new Date(),
          endTime: action.endTime ? new Date(renderTemplate(action.endTime, data || {})) : undefined,
          allDay: action.allDay || false,
          location: renderTemplate(action.location, data || {}),
          source: 'workflow',
        });
      }
      break;
    }
    case 'document_request': {
      if (action.employeeId) {
        await createDocumentRequest(orgId, {
          employeeId: action.employeeId,
          documentType: action.documentType || renderTemplate(action.title, data || {}),
          description: renderTemplate(action.description, data || {}),
          reason: action.reason,
          dueDate: action.dueDate ? new Date(renderTemplate(action.dueDate, data || {})) : undefined,
        });
      }
      break;
    }
    case 'renewal': {
      if (action.employeeId) {
        await createRenewalRecord(orgId, {
          employeeId: action.employeeId,
          type: action.renewalType || 'contract',
          title: renderTemplate(action.title, data || {}),
          description: renderTemplate(action.description, data || {}),
          currentExpiryDate: action.currentExpiryDate ? new Date(renderTemplate(action.currentExpiryDate, data || {})) : undefined,
          reminderDays: action.reminderDays || 30,
          autoRenew: action.autoRenew || false,
        });
      }
      break;
    }
    case 'policy_acknowledgement': {
      if (action.employeeId && action.policyId) {
        await requestPolicyAcknowledgement(orgId, {
          policyId: action.policyId,
          employeeId: action.employeeId,
          dueDate: action.dueDate ? new Date(renderTemplate(action.dueDate, data || {})) : undefined,
        });
      }
      break;
    }
  }
}

// ── Notifications ──

export async function createNotification(orgId: string, employeeId: string, type: string, title: string, body?: string, link?: string) {
  const [row] = await db.insert(hrNotifications).values({ orgId, employeeId, type, title, body: body || null, link: link || null }).returning();
  return row;
}

export async function getNotifications(orgId: string, employeeId: string, unreadOnly?: boolean) {
  const conditions: any[] = [eq(hrNotifications.orgId, orgId), eq(hrNotifications.employeeId, employeeId)];
  if (unreadOnly) conditions.push(eq(hrNotifications.isRead, false));
  return await db.select().from(hrNotifications).where(and(...conditions)).orderBy(desc(hrNotifications.createdAt)).limit(50);
}

export async function markNotificationRead(orgId: string, notificationId: string) {
  await db.update(hrNotifications).set({ isRead: true, readAt: sql`now()` }).where(and(eq(hrNotifications.id, notificationId), eq(hrNotifications.orgId, orgId)));
}

export async function markAllNotificationsRead(orgId: string, employeeId: string) {
  await db.update(hrNotifications).set({ isRead: true, readAt: sql`now()` })
    .where(and(eq(hrNotifications.orgId, orgId), eq(hrNotifications.employeeId, employeeId), eq(hrNotifications.isRead, false)));
}

export async function getUnreadCount(orgId: string, employeeId: string) {
  const [r] = await db.select({ count: count() }).from(hrNotifications)
    .where(and(eq(hrNotifications.orgId, orgId), eq(hrNotifications.employeeId, employeeId), eq(hrNotifications.isRead, false)));
  return r?.count || 0;
}

// ── Reminder Configs ──

export async function getReminderConfigs(orgId: string, type?: string) {
  const conditions: any[] = [eq(hrReminderConfigs.orgId, orgId)];
  if (type) conditions.push(eq(hrReminderConfigs.type, type));
  return await db.select().from(hrReminderConfigs).where(and(...conditions)).orderBy(hrReminderConfigs.name);
}

export async function createReminderConfig(orgId: string, data: any) {
  const [row] = await db.insert(hrReminderConfigs).values({
    orgId, name: data.name, type: data.type, schedule: data.schedule,
    templateId: data.templateId || null, conditions: data.conditions || {},
    recipients: data.recipients || [], isActive: data.isActive !== false,
  }).returning();
  return row;
}

export async function deleteReminderConfig(orgId: string, id: string) {
  const [row] = await db.delete(hrReminderConfigs).where(and(eq(hrReminderConfigs.id, id), eq(hrReminderConfigs.orgId, orgId))).returning();
  return row;
}

// ── Cron / Scheduled Alerts ──

export async function runScheduledAlerts(orgId: string) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const results: string[] = [];

  // Birthday alerts
  const birthdayEmployees = await db.select().from(hrEmployees)
    .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.employmentStatus, 'active'),
      sql`to_char(${hrEmployees.dateOfBirth}, 'MM-DD') = to_char(current_date, 'MM-DD')`));

  for (const emp of birthdayEmployees) {
    const name = `${emp.firstName} ${emp.lastName}`;
    await notifyAllActive(orgId, 'birthday', `🎉 Birthday: ${name}`, `${name} is celebrating a birthday today!`);
    await sendOrgEmail(orgId, { to: emp.email || '', subject: `Happy Birthday ${name}!`, html: `<h2>Happy Birthday ${name}!</h2><p>Wishing you a wonderful day from all of us.</p>` }).catch(() => {});
    results.push(`birthday:${emp.id}`);
  }

  // Work anniversary alerts
  const anniversaryEmployees = await db.select().from(hrEmployees)
    .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.employmentStatus, 'active'),
      sql`to_char(${hrEmployees.joinDate}, 'MM-DD') = to_char(current_date, 'MM-DD')`));

  for (const emp of anniversaryEmployees) {
    const years = today.getFullYear() - (emp.joinDate ? new Date(emp.joinDate).getFullYear() : today.getFullYear());
    const name = `${emp.firstName} ${emp.lastName}`;
    await notifyAllActive(orgId, 'anniversary', `🎊 ${years} Year Anniversary: ${name}`, `${name} is celebrating ${years} year(s) at the company!`);
    results.push(`anniversary:${emp.id}`);
  }

  // Probation ending alerts (30 days before end)
  const probationEnding = await db.select().from(hrEmployees)
    .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.employmentStatus, 'active'),
      isNull(hrEmployees.confirmationDate),
      sql`${hrEmployees.joinDate} + interval '90 days' between current_date and current_date + interval '30 days'`));

  for (const emp of probationEnding) {
    const name = `${emp.firstName} ${emp.lastName}`;
    await notifyAllActive(orgId, 'probation', `📋 Probation Ending: ${name}`, `${name}'s probation period is ending soon. Please schedule a confirmation review.`);
    results.push(`probation:${emp.id}`);
  }

  // Contract expiry alerts (30 days before)
  const contractEnding = await db.select().from(hrEmployees)
    .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.employmentStatus, 'active'),
      sql`${hrEmployees.contractEndDate} between current_date and current_date + interval '30 days'`));

  for (const emp of contractEnding) {
    const name = `${emp.firstName} ${emp.lastName}`;
    await notifyAllActive(orgId, 'contract_expiry', `📄 Contract Expiring: ${name}`, `${name}'s contract expires on ${emp.contractEndDate?.toLocaleDateString()}. Please review for renewal.`);
    results.push(`contract_expiry:${emp.id}`);
  }

  return results;
}

async function notifyAllActive(orgId: string, type: string, title: string, body: string) {
  const activeEmps = await db.select({ id: hrEmployees.id }).from(hrEmployees).where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.employmentStatus, 'active')));
  for (const emp of activeEmps) {
    await createNotification(orgId, emp.id, type, title, body);
  }
}

// ── Dashboard ──

export async function getWorkflowDashboard(orgId: string, employeeId?: string) {
  const totalTemplates = await db.select({ count: count() }).from(hrWorkflowTemplates).where(eq(hrWorkflowTemplates.orgId, orgId)).then(r => r[0]?.count || 0);
  const activeRules = await db.select({ count: count() }).from(hrAutomationRules).where(and(eq(hrAutomationRules.orgId, orgId), eq(hrAutomationRules.isActive, true))).then(r => r[0]?.count || 0);
  const runningInstances = await db.select({ count: count() }).from(hrWorkflowInstances).where(and(eq(hrWorkflowInstances.orgId, orgId), eq(hrWorkflowInstances.status, 'running'))).then(r => r[0]?.count || 0);
  const completedInstances = await db.select({ count: count() }).from(hrWorkflowInstances).where(and(eq(hrWorkflowInstances.orgId, orgId), eq(hrWorkflowInstances.status, 'completed'))).then(r => r[0]?.count || 0);
  const unreadNotifs = employeeId ? await getUnreadCount(orgId, employeeId) : 0;
  const recentInstances = await db.select().from(hrWorkflowInstances).where(eq(hrWorkflowInstances.orgId, orgId)).orderBy(desc(hrWorkflowInstances.startedAt)).limit(10);

  return { totalTemplates, activeRules, runningInstances, completedInstances, unreadNotifs, recentInstances };
}

// ── Calendar Events ──

export async function createCalendarEvent(orgId: string, data: {
  employeeId?: string; title: string; description?: string; eventType: string;
  startTime: Date; endTime?: Date; allDay?: boolean; location?: string;
  link?: string; source?: string; sourceId?: string;
}) {
  const [row] = await db.insert(hrCalendarEvents).values({
    orgId, employeeId: data.employeeId || null, title: data.title,
    description: data.description || null, eventType: data.eventType,
    startTime: data.startTime, endTime: data.endTime || null,
    allDay: data.allDay || false, location: data.location || null,
    link: data.link || null, source: data.source || null, sourceId: data.sourceId || null,
  }).returning();
  return row;
}

export async function getCalendarEvents(orgId: string, employeeId?: string, from?: Date, to?: Date) {
  const conditions: any[] = [eq(hrCalendarEvents.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrCalendarEvents.employeeId, employeeId));
  if (from) conditions.push(gte(hrCalendarEvents.startTime, from));
  if (to) conditions.push(lte(hrCalendarEvents.startTime, to));
  return await db.select().from(hrCalendarEvents).where(and(...conditions)).orderBy(hrCalendarEvents.startTime);
}

export async function markCalendarEventRead(orgId: string, eventId: string) {
  await db.update(hrCalendarEvents).set({ isRead: true }).where(and(eq(hrCalendarEvents.id, eventId), eq(hrCalendarEvents.orgId, orgId)));
}

// ── Document Requests ──

export async function createDocumentRequest(orgId: string, data: {
  employeeId: string; documentType: string; description?: string;
  reason?: string; dueDate?: Date; requestedBy?: string;
}) {
  const [row] = await db.insert(hrDocumentRequests).values({
    orgId, employeeId: data.employeeId, documentType: data.documentType,
    description: data.description || null, reason: data.reason || null,
    dueDate: data.dueDate || null, requestedBy: data.requestedBy || null,
  }).returning();
  return row;
}

export async function getDocumentRequests(orgId: string, employeeId?: string, status?: string) {
  const conditions: any[] = [eq(hrDocumentRequests.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrDocumentRequests.employeeId, employeeId));
  if (status) conditions.push(eq(hrDocumentRequests.status, status));
  return await db.select().from(hrDocumentRequests).where(and(...conditions)).orderBy(desc(hrDocumentRequests.createdAt));
}

export async function completeDocumentRequest(orgId: string, id: string) {
  const [row] = await db.update(hrDocumentRequests).set({ status: 'completed', completedAt: sql`now()` })
    .where(and(eq(hrDocumentRequests.id, id), eq(hrDocumentRequests.orgId, orgId))).returning();
  return row;
}

// ── Renewal Tracking ──

export async function createRenewalRecord(orgId: string, data: {
  employeeId: string; type: string; title: string; description?: string;
  currentExpiryDate?: Date; reminderDays?: number; autoRenew?: boolean;
}) {
  const [row] = await db.insert(hrRenewalTracking).values({
    orgId, employeeId: data.employeeId, type: data.type, title: data.title,
    description: data.description || null, currentExpiryDate: data.currentExpiryDate || null,
    reminderDays: data.reminderDays || 30, autoRenew: data.autoRenew || false,
  }).returning();
  return row;
}

export async function getRenewalRecords(orgId: string, type?: string, status?: string, employeeId?: string) {
  const conditions: any[] = [eq(hrRenewalTracking.orgId, orgId)];
  if (type) conditions.push(eq(hrRenewalTracking.type, type));
  if (status) conditions.push(eq(hrRenewalTracking.status, status));
  if (employeeId) conditions.push(eq(hrRenewalTracking.employeeId, employeeId));
  return await db.select().from(hrRenewalTracking).where(and(...conditions)).orderBy(hrRenewalTracking.currentExpiryDate);
}

export async function processRenewal(orgId: string, id: string, renewedDate: Date, newExpiryDate: Date, notes?: string) {
  const [row] = await db.update(hrRenewalTracking).set({
    status: 'renewed', renewedDate, newExpiryDate, notes: notes || null, updatedAt: sql`now()`,
  }).where(and(eq(hrRenewalTracking.id, id), eq(hrRenewalTracking.orgId, orgId))).returning();
  return row;
}

export async function getUpcomingRenewals(orgId: string, daysAhead?: number) {
  const window = daysAhead ?? 30;
  return await db.select().from(hrRenewalTracking)
    .where(and(eq(hrRenewalTracking.orgId, orgId), eq(hrRenewalTracking.status, 'active'),
      sql`${hrRenewalTracking.currentExpiryDate} between current_date and current_date + interval '${sql.raw(String(window))} days'`))
    .orderBy(hrRenewalTracking.currentExpiryDate);
}

// ── Policy Acknowledgements ──

export async function requestPolicyAcknowledgement(orgId: string, data: {
  policyId: string; employeeId: string; dueDate?: Date;
}) {
  const [row] = await db.insert(hrPolicyAcknowledgements).values({
    orgId, policyId: data.policyId, employeeId: data.employeeId,
    dueDate: data.dueDate || null, status: 'pending',
  }).returning();
  return row;
}

export async function acknowledgePolicy(orgId: string, id: string, ip?: string) {
  const [row] = await db.update(hrPolicyAcknowledgements).set({
    status: 'acknowledged', acknowledgedAt: sql`now()`, acknowledgedIp: ip || null,
  }).where(and(eq(hrPolicyAcknowledgements.id, id), eq(hrPolicyAcknowledgements.orgId, orgId))).returning();
  return row;
}

export async function getPendingAcknowledgements(orgId: string, employeeId?: string) {
  const conditions: any[] = [eq(hrPolicyAcknowledgements.orgId, orgId), eq(hrPolicyAcknowledgements.status, 'pending')];
  if (employeeId) conditions.push(eq(hrPolicyAcknowledgements.employeeId, employeeId));
  return await db.select().from(hrPolicyAcknowledgements).where(and(...conditions)).orderBy(hrPolicyAcknowledgements.requestedAt);
}

export async function getAcknowledgementReport(orgId: string, policyId?: string) {
  const conditions: any[] = [eq(hrPolicyAcknowledgements.orgId, orgId)];
  if (policyId) conditions.push(eq(hrPolicyAcknowledgements.policyId, policyId));
  return await db.select().from(hrPolicyAcknowledgements).where(and(...conditions)).orderBy(desc(hrPolicyAcknowledgements.requestedAt));
}

// ── Renewal Reminder (scheduled check) ──

export async function checkUpcomingRenewals(orgId: string) {
  const upcomings = await getUpcomingRenewals(orgId, 30);
  const results: string[] = [];
  for (const rec of upcomings) {
    if (rec.employeeId) {
      await createNotification(orgId, rec.employeeId, 'renewal_reminder',
        `Renewal Due: ${rec.title}`,
        `${rec.title} is expiring on ${rec.currentExpiryDate?.toLocaleDateString()}. Please take action.`);
      results.push(`renewal:${rec.id}`);
    }
  }
  return results;
}
