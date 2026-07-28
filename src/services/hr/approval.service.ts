import { sql, eq, and, or, desc, asc, count, inArray, isNull, gte, lt, ne } from 'drizzle-orm';
import { db } from '../../db';
import {
  hrApprovalConfigs, hrApprovalRequests, hrApprovalStepInstances,
  hrApprovalDelegations, hrApprovalEscalationRules, hrApprovalComments,
  hrEmployees
} from '../../db/schema';
import { createAuditLog } from '../audit.service';

// ── Module Handler Registry ──
type ApprovalHandler = (orgId: string, sourceId: string, requestId: string) => Promise<void>;
const moduleHandlers: Record<string, ApprovalHandler> = {};

export function registerApprovalHandler(module: string, handler: ApprovalHandler) {
  moduleHandlers[module] = handler;
}

export function getApprovalHandler(module: string): ApprovalHandler | undefined {
  return moduleHandlers[module];
}

// ── Helpers ──

function getStepLabel(step: string): string {
  const labels: Record<string, string> = {
    maker: 'Maker', reviewer: 'Reviewer', approver: 'Approver', final_approval: 'Final Approval',
  };
  return labels[step] || step.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Approval Configs ──

export async function getApprovalConfigs(orgId: string) {
  return await db.select().from(hrApprovalConfigs).where(eq(hrApprovalConfigs.orgId, orgId)).orderBy(hrApprovalConfigs.name);
}

export async function getApprovalConfig(orgId: string, configId: string) {
  const [row] = await db.select().from(hrApprovalConfigs).where(and(eq(hrApprovalConfigs.id, configId), eq(hrApprovalConfigs.orgId, orgId)));
  if (!row) throw new Error('Approval config not found');
  return row;
}

export async function createApprovalConfig(orgId: string, data: any) {
  const [row] = await db.insert(hrApprovalConfigs).values({
    orgId, name: data.name, module: data.module,
    steps: data.steps || [], isActive: data.isActive !== false,
  }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'approval_config', entityId: row.id, newValues: data });
  return row;
}

export async function updateApprovalConfig(orgId: string, configId: string, data: any) {
  const [row] = await db.update(hrApprovalConfigs).set({
    ...data, updatedAt: sql`now()`,
  }).where(and(eq(hrApprovalConfigs.id, configId), eq(hrApprovalConfigs.orgId, orgId))).returning();
  if (!row) throw new Error('Approval config not found');
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'approval_config', entityId: configId, newValues: data, oldValues: row });
  return row;
}

export async function deleteApprovalConfig(orgId: string, configId: string, userId?: string) {
  const [row] = await db.delete(hrApprovalConfigs).where(and(eq(hrApprovalConfigs.id, configId), eq(hrApprovalConfigs.orgId, orgId))).returning();
  if (!row) throw new Error('Approval config not found');
  await createAuditLog({ orgId, userId: userId || 'system', action: 'delete', entityType: 'approval_config', entityId: configId, oldValues: row });
  return row;
}

// ── Approval Requests ──

export async function getApprovalRequests(orgId: string, filters?: { module?: string; status?: string; requesterId?: string; approverId?: string; sourceId?: string }) {
  const conditions = [eq(hrApprovalRequests.orgId, orgId)];
  if (filters?.module) conditions.push(eq(hrApprovalRequests.module, filters.module));
  if (filters?.status) conditions.push(eq(hrApprovalRequests.status, filters.status));
  if (filters?.requesterId) conditions.push(eq(hrApprovalRequests.requesterId, filters.requesterId));
  if (filters?.approverId) conditions.push(eq(hrApprovalRequests.approverId, filters.approverId));
  if (filters?.sourceId) conditions.push(eq(hrApprovalRequests.sourceId, filters.sourceId));
  return await db.select().from(hrApprovalRequests)
    .leftJoin(hrEmployees, eq(hrApprovalRequests.requesterId, hrEmployees.id))
    .leftJoin(hrEmployees, eq(hrApprovalRequests.approverId, hrEmployees.id))
    .where(and(...conditions)).orderBy(desc(hrApprovalRequests.createdAt));
}

export async function getApprovalRequest(orgId: string, requestId: string) {
  const [row] = await db.select().from(hrApprovalRequests)
    .leftJoin(hrEmployees, eq(hrApprovalRequests.requesterId, hrEmployees.id))
    .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId)));
  if (!row) throw new Error('Approval request not found');
  return row;
}

export async function createApprovalRequest(orgId: string, data: {
  module: string; sourceId: string; requesterId: string; title?: string; description?: string;
  priority?: string; userId?: string; configId?: string; steps?: any[];
}) {
  let stepsConfig = data.steps || [];
  if (data.configId) {
    const [cfg] = await db.select().from(hrApprovalConfigs).where(and(eq(hrApprovalConfigs.id, data.configId), eq(hrApprovalConfigs.orgId, orgId)));
    if (cfg) stepsConfig = cfg.steps as any[];
  }
  if (!stepsConfig.length) {
    stepsConfig = [
      { stepName: 'maker', order: 1 },
      { stepName: 'reviewer', order: 2 },
      { stepName: 'approver', order: 3 },
      { stepName: 'final_approval', order: 4 },
    ];
  }

  const [request] = await db.insert(hrApprovalRequests).values({
    orgId, module: data.module, sourceId: data.sourceId, requesterId: data.requesterId,
    title: data.title || `${data.module} Approval`,
    description: data.description, priority: data.priority || 'normal',
    currentStepOrder: 0, status: 'pending',
  }).returning();

  const stepRecords = [];
  for (const step of stepsConfig) {
    const initialStatus = step.stepName === 'maker' ? 'in_progress' : 'pending';
    stepRecords.push({
      requestId: request.id, stepOrder: step.order || step.stepOrder || 1,
      stepName: step.stepName, label: getStepLabel(step.stepName),
      assigneeId: step.assigneeId || data.requesterId,
      status: initialStatus,
    });
  }
  if (stepRecords.length) {
    stepRecords[0].status = 'in_progress';
    await db.insert(hrApprovalStepInstances).values(stepRecords.map(r => ({ ...r, notifiedAt: r.status === 'in_progress' ? new Date() : null })));
  }
  const firstStepAssignee = stepRecords[0]?.assigneeId || data.requesterId;

  const [updated] = await db.update(hrApprovalRequests).set({
    currentStepOrder: 1, approverId: firstStepAssignee,
    submittedAt: sql`now()`,
  }).where(eq(hrApprovalRequests.id, request.id)).returning();

  await createAuditLog({
    orgId, userId: data.userId || 'system', action: 'create', entityType: 'approval_request',
    entityId: request.id, description: `Approval request created for ${data.module}`,
    newValues: updated,
  });
  return updated;
}

// ── Approve Step ──

export async function approveStep(orgId: string, requestId: string, userId: string, comment?: string) {
  const request = await db.select().from(hrApprovalRequests)
    .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId))).limit(1);
  const [req] = request;
  if (!req) throw new Error('Approval request not found');
  if (req.status !== 'pending') throw new Error('Request is not pending');

  const currentStep = await db.select().from(hrApprovalStepInstances)
    .where(and(eq(hrApprovalStepInstances.requestId, requestId), eq(hrApprovalStepInstances.stepOrder, req.currentStepOrder))).limit(1);

  const [step] = currentStep;
  if (!step) throw new Error('Current step not found');
  if (step.status !== 'in_progress') throw new Error('Current step is not in progress');

  const effectiveUserId = userId;
  if (step.assigneeId && step.assigneeId !== effectiveUserId) {
    const delegations = await db.select().from(hrApprovalDelegations)
      .where(and(eq(hrApprovalDelegations.delegatorId, step.assigneeId), eq(hrApprovalDelegations.delegateId, effectiveUserId), eq(hrApprovalDelegations.isActive, true))).limit(1);
    if (!delegations.length) throw new Error('You are not the assignee for this step');
    const [del] = delegations;
    const now = new Date();
    if ((del.startDate && del.startDate > now) || (del.endDate && del.endDate < now)) throw new Error('Delegation is not active for this period');
  }

  await db.update(hrApprovalStepInstances).set({
    status: 'approved', comment: comment || null, decidedAt: sql`now()`, updatedAt: sql`now()`,
  }).where(eq(hrApprovalStepInstances.id, step.id));

  const maxStep = await db.select({ max: sql<number>`max(step_order)` }).from(hrApprovalStepInstances)
    .where(eq(hrApprovalStepInstances.requestId, requestId));
  const maxOrder = maxStep[0]?.max || 1;

  if (req.currentStepOrder >= maxOrder) {
    await db.update(hrApprovalRequests).set({
      status: 'approved', currentStepOrder: req.currentStepOrder, comment: comment || null, decidedAt: sql`now()`, updatedAt: sql`now()`,
    }).where(eq(hrApprovalRequests.id, requestId));

    await createAuditLog({
      orgId, userId: effectiveUserId, action: 'approve', entityType: 'approval_request',
      entityId: requestId, description: `Approval request fully approved`, oldValues: req, newValues: { status: 'approved' },
    });

    const handler = moduleHandlers[req.module];
    if (handler) await handler(orgId, req.sourceId, requestId);
    return { ...req, status: 'approved' };
  }

  const nextStep = await db.select().from(hrApprovalStepInstances)
    .where(and(eq(hrApprovalStepInstances.requestId, requestId), eq(hrApprovalStepInstances.stepOrder, req.currentStepOrder + 1))).limit(1);
  const [next] = nextStep;

  const newOrder = req.currentStepOrder + 1;
  const newApproverId = next?.assigneeId || req.approverId;

  await db.update(hrApprovalStepInstances).set({
    status: 'in_progress', notifiedAt: sql`now()`, updatedAt: sql`now()`,
  }).where(eq(hrApprovalStepInstances.id, next.id));

  await db.update(hrApprovalRequests).set({
    currentStepOrder: newOrder, approverId: newApproverId, updatedAt: sql`now()`,
  }).where(eq(hrApprovalRequests.id, requestId));

  await createAuditLog({
    orgId, userId: effectiveUserId, action: 'approve', entityType: 'approval_request',
    entityId: requestId, description: `Step "${step.label}" approved, moving to next step`,
    oldValues: { ...req, currentStep: step.stepName }, newValues: { currentStepOrder: newOrder },
  });

  return { ...req, currentStepOrder: newOrder, approverId: newApproverId };
}

// ── Reject Step ──

export async function rejectStep(orgId: string, requestId: string, userId: string, comment?: string) {
  const request = await db.select().from(hrApprovalRequests)
    .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId))).limit(1);
  const [req] = request;
  if (!req) throw new Error('Approval request not found');
  if (req.status !== 'pending') throw new Error('Request is not pending');

  const currentStep = await db.select().from(hrApprovalStepInstances)
    .where(and(eq(hrApprovalStepInstances.requestId, requestId), eq(hrApprovalStepInstances.stepOrder, req.currentStepOrder))).limit(1);
  const [step] = currentStep;
  if (!step) throw new Error('Current step not found');
  if (step.status !== 'in_progress') throw new Error('Current step is not in progress');

  const effectiveUserId = userId;
  if (step.assigneeId && step.assigneeId !== effectiveUserId) throw new Error('You are not the assignee for this step');

  await db.update(hrApprovalStepInstances).set({
    status: 'rejected', comment: comment || null, decidedAt: sql`now()`, updatedAt: sql`now()`,
  }).where(eq(hrApprovalStepInstances.id, step.id));

  await db.update(hrApprovalRequests).set({
    status: 'rejected', comment: comment || null, decidedAt: sql`now()`, updatedAt: sql`now()`,
  }).where(eq(hrApprovalRequests.id, requestId));

  await createAuditLog({
    orgId, userId: effectiveUserId, action: 'reject', entityType: 'approval_request',
    entityId: requestId, description: `Approval request rejected at step "${step.label}"`,
    oldValues: req, newValues: { status: 'rejected' },
  });

  return { ...req, status: 'rejected' };
}

// ── Send Back ──

export async function sendBackStep(orgId: string, requestId: string, userId: string, comment?: string) {
  const request = await db.select().from(hrApprovalRequests)
    .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId))).limit(1);
  const [req] = request;
  if (!req) throw new Error('Approval request not found');
  if (req.status !== 'pending') throw new Error('Request is not pending');
  if (req.currentStepOrder <= 1) throw new Error('Cannot send back: already at the first step');

  const currentStep = await db.select().from(hrApprovalStepInstances)
    .where(and(eq(hrApprovalStepInstances.requestId, requestId), eq(hrApprovalStepInstances.stepOrder, req.currentStepOrder))).limit(1);
  const [step] = currentStep;
  if (!step) throw new Error('Current step not found');
  if (step.status !== 'in_progress') throw new Error('Current step is not in progress');

  const effectiveUserId = userId;
  if (step.assigneeId && step.assigneeId !== effectiveUserId) throw new Error('You are not the assignee for this step');

  await db.update(hrApprovalStepInstances).set({
    status: 'sent_back', comment: comment || null, decidedAt: sql`now()`, updatedAt: sql`now()`,
  }).where(eq(hrApprovalStepInstances.id, step.id));

  const prevStep = await db.select().from(hrApprovalStepInstances)
    .where(and(eq(hrApprovalStepInstances.requestId, requestId), eq(hrApprovalStepInstances.stepOrder, req.currentStepOrder - 1))).limit(1);
  const [prev] = prevStep;

  const prevOrder = req.currentStepOrder - 1;
  if (prev) {
    await db.update(hrApprovalStepInstances).set({
      status: 'in_progress', updatedAt: sql`now()`,
    }).where(eq(hrApprovalStepInstances.id, prev.id));
  }

  await db.update(hrApprovalRequests).set({
    currentStepOrder: prevOrder, approverId: prev?.assigneeId || req.requesterId, updatedAt: sql`now()`,
  }).where(eq(hrApprovalRequests.id, requestId));

  await createAuditLog({
    orgId, userId: effectiveUserId, action: 'send_back', entityType: 'approval_request',
    entityId: requestId, description: `Request sent back from step "${step.label}" to previous step`,
    oldValues: req, newValues: { currentStepOrder: prevOrder },
  });

  return { ...req, currentStepOrder: prevOrder };
}

// ── Escalate ──

export async function escalateRequest(orgId: string, requestId: string, escalateToUserId: string, userId: string, comment?: string) {
  const request = await db.select().from(hrApprovalRequests)
    .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId))).limit(1);
  const [req] = request;
  if (!req) throw new Error('Approval request not found');
  if (req.status !== 'pending') throw new Error('Request is not pending');

  const currentStep = await db.select().from(hrApprovalStepInstances)
    .where(and(eq(hrApprovalStepInstances.requestId, requestId), eq(hrApprovalStepInstances.stepOrder, req.currentStepOrder))).limit(1);
  const [step] = currentStep;

  if (step) {
    await db.update(hrApprovalStepInstances).set({
      status: 'escalated', comment: comment || null, updatedAt: sql`now()`,
    }).where(eq(hrApprovalStepInstances.id, step.id));
  }

  await db.update(hrApprovalRequests).set({
    escalatedTo: escalateToUserId, approverId: escalateToUserId, updatedAt: sql`now()`,
  }).where(eq(hrApprovalRequests.id, requestId));

  await createAuditLog({
    orgId, userId: userId || 'system', action: 'escalate', entityType: 'approval_request',
    entityId: requestId, description: `Request escalated to ${escalateToUserId}`,
    oldValues: req, newValues: { escalatedTo: escalateToUserId },
  });

  return { ...req, escalatedTo: escalateToUserId, approverId: escalateToUserId };
}

// ── Delegate ──

export async function delegateStep(orgId: string, requestId: string, delegateToUserId: string, userId: string) {
  const request = await db.select().from(hrApprovalRequests)
    .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId))).limit(1);
  const [req] = request;
  if (!req) throw new Error('Approval request not found');

  const currentStep = await db.select().from(hrApprovalStepInstances)
    .where(and(eq(hrApprovalStepInstances.requestId, requestId), eq(hrApprovalStepInstances.stepOrder, req.currentStepOrder))).limit(1);
  const [step] = currentStep;
  if (!step) throw new Error('Current step not found');

  await db.update(hrApprovalStepInstances).set({
    assigneeId: delegateToUserId, updatedAt: sql`now()`,
  }).where(eq(hrApprovalStepInstances.id, step.id));

  await db.update(hrApprovalRequests).set({
    delegatedTo: delegateToUserId, approverId: delegateToUserId, updatedAt: sql`now()`,
  }).where(eq(hrApprovalRequests.id, requestId));

  await createAuditLog({
    orgId, userId: userId || 'system', action: 'delegate', entityType: 'approval_request',
    entityId: requestId, description: `Step delegated from ${step.assigneeId} to ${delegateToUserId}`,
    oldValues: { ...req, currentAssignee: step.assigneeId }, newValues: { delegatedTo: delegateToUserId },
  });

  return { ...req, delegatedTo: delegateToUserId, approverId: delegateToUserId };
}

// ── Cancel ──

export async function cancelApprovalRequest(orgId: string, requestId: string, userId?: string) {
  const [old] = await db.select().from(hrApprovalRequests).where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId)));
  if (!old) throw new Error('Approval request not found');
  if (old.status === 'approved' || old.status === 'rejected') throw new Error('Cannot cancel a finalized request');

  await db.update(hrApprovalRequests).set({ status: 'cancelled', updatedAt: sql`now()` })
    .where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId)));

  await createAuditLog({
    orgId, userId: userId || 'system', action: 'cancel', entityType: 'approval_request',
    entityId: requestId, description: 'Approval request cancelled',
    oldValues: old, newValues: { status: 'cancelled' },
  });

  return { ...old, status: 'cancelled' };
}

// ── My Queue ──

export async function getMyApprovalQueue(orgId: string, employeeId: string, filters?: { module?: string; status?: string }) {
  const conditions = [
    eq(hrApprovalRequests.orgId, orgId),
    eq(hrApprovalRequests.status, 'pending'),
    or(eq(hrApprovalRequests.approverId, employeeId), eq(hrApprovalRequests.delegatedTo, employeeId)),
  ];
  if (filters?.module) conditions.push(eq(hrApprovalRequests.module, filters.module));

  const rows = await db.select().from(hrApprovalRequests)
    .leftJoin(hrEmployees, eq(hrApprovalRequests.requesterId, hrEmployees.id))
    .leftJoin(hrApprovalStepInstances, and(
      eq(hrApprovalStepInstances.requestId, hrApprovalRequests.id),
      eq(hrApprovalStepInstances.stepOrder, hrApprovalRequests.currentStepOrder),
    ))
    .where(and(...conditions)).orderBy(desc(hrApprovalRequests.priority), asc(hrApprovalRequests.createdAt));

  return rows;
}

// ── Steps ──

export async function getApprovalSteps(orgId: string, requestId: string) {
  const request = await db.select().from(hrApprovalRequests).where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId))).limit(1);
  if (!request.length) throw new Error('Approval request not found');
  return await db.select().from(hrApprovalStepInstances)
    .where(eq(hrApprovalStepInstances.requestId, requestId))
    .orderBy(hrApprovalStepInstances.stepOrder);
}

// ── Comments ──

export async function getApprovalComments(orgId: string, requestId: string) {
  return await db.select().from(hrApprovalComments)
    .leftJoin(hrEmployees, eq(hrApprovalComments.userId, hrEmployees.id))
    .where(eq(hrApprovalComments.requestId, requestId))
    .orderBy(hrApprovalComments.createdAt);
}

export async function addApprovalComment(orgId: string, requestId: string, userId: string, comment: string, stepInstanceId?: string) {
  const [row] = await db.insert(hrApprovalComments).values({
    requestId, userId, comment, stepInstanceId: stepInstanceId || null,
  }).returning();
  return row;
}

// ── Delegations ──

export async function getDelegations(orgId: string, employeeId?: string) {
  const conditions = [eq(hrApprovalDelegations.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrApprovalDelegations.delegatorId, employeeId));
  return await db.select().from(hrApprovalDelegations)
    .leftJoin(hrEmployees, eq(hrApprovalDelegations.delegateId, hrEmployees.id))
    .where(and(...conditions)).orderBy(desc(hrApprovalDelegations.createdAt));
}

export async function createDelegation(orgId: string, data: any) {
  const [row] = await db.insert(hrApprovalDelegations).values({
    orgId, delegatorId: data.delegatorId, delegateId: data.delegateId,
    module: data.module || null, startDate: data.startDate ? new Date(data.startDate) : new Date(),
    endDate: data.endDate ? new Date(data.endDate) : null, isActive: data.isActive !== false,
    reason: data.reason || null,
  }).returning();
  return row;
}

export async function deleteDelegation(orgId: string, delegationId: string) {
  const [row] = await db.delete(hrApprovalDelegations).where(and(eq(hrApprovalDelegations.id, delegationId), eq(hrApprovalDelegations.orgId, orgId))).returning();
  if (!row) throw new Error('Delegation not found');
  return row;
}

// ── Escalation Rules ──

export async function getEscalationRules(orgId: string, module?: string) {
  const conditions = [eq(hrApprovalEscalationRules.orgId, orgId)];
  if (module) conditions.push(eq(hrApprovalEscalationRules.module, module));
  return await db.select().from(hrApprovalEscalationRules).where(and(...conditions)).orderBy(hrApprovalEscalationRules.createdAt);
}

export async function createEscalationRule(orgId: string, data: any) {
  const [row] = await db.insert(hrApprovalEscalationRules).values({
    orgId, module: data.module || null, stepName: data.stepName,
    timeoutHours: data.timeoutHours, escalateToRole: data.escalateToRole || null,
    escalateToUserId: data.escalateToUserId || null, isActive: data.isActive !== false,
  }).returning();
  return row;
}

export async function deleteEscalationRule(orgId: string, ruleId: string) {
  const [row] = await db.delete(hrApprovalEscalationRules).where(and(eq(hrApprovalEscalationRules.id, ruleId), eq(hrApprovalEscalationRules.orgId, orgId))).returning();
  if (!row) throw new Error('Escalation rule not found');
  return row;
}

// ── Check Escalations ──

export async function checkEscalations(orgId: string) {
  const rules = await db.select().from(hrApprovalEscalationRules).where(and(eq(hrApprovalEscalationRules.orgId, orgId), eq(hrApprovalEscalationRules.isActive, true)));
  const escalated: any[] = [];

  for (const rule of rules) {
    const pendingSteps = await db.select().from(hrApprovalStepInstances)
      .leftJoin(hrApprovalRequests, eq(hrApprovalStepInstances.requestId, hrApprovalRequests.id))
      .where(and(
        eq(hrApprovalStepInstances.status, 'in_progress'),
        eq(hrApprovalStepInstances.stepName, rule.stepName),
        eq(hrApprovalRequests.orgId, orgId),
        eq(hrApprovalRequests.status, 'pending'),
        rule.module ? eq(hrApprovalRequests.module, rule.module) : sql`1=1`,
        sql`${hrApprovalStepInstances.notifiedAt} is not null`,
        sql`${hrApprovalStepInstances.notifiedAt} + interval '1 hour' * ${rule.timeoutHours} < now()`,
      ));

    for (const ps of pendingSteps) {
      const targetUserId = rule.escalateToUserId;
      if (targetUserId) {
        await escalateRequest(orgId, ps.hr_approval_requests.id, targetUserId, 'system', `Auto-escalated after ${rule.timeoutHours}h`);
        escalated.push({ requestId: ps.hr_approval_requests.id, escalatedTo: targetUserId, rule: rule.id });
      }
    }
  }
  return escalated;
}

// ── History ──

export async function getApprovalHistory(orgId: string, filters?: { module?: string; status?: string; from?: string; to?: string; limit?: number }) {
  const conditions = [eq(hrApprovalRequests.orgId, orgId)];
  if (filters?.module) conditions.push(eq(hrApprovalRequests.module, filters.module));
  if (filters?.status) conditions.push(eq(hrApprovalRequests.status, filters.status));
  if (filters?.from) conditions.push(gte(hrApprovalRequests.createdAt, new Date(filters.from)));
  if (filters?.to) conditions.push(lt(hrApprovalRequests.createdAt, new Date(filters.to)));
  const rows = await db.select().from(hrApprovalRequests)
    .leftJoin(hrEmployees, eq(hrApprovalRequests.requesterId, hrEmployees.id))
    .where(and(...conditions))
    .orderBy(desc(hrApprovalRequests.createdAt))
    .limit(filters?.limit || 50);
  return rows;
}

// ── Dashboard / Stats ──

export async function getApprovalDashboard(orgId: string, employeeId?: string) {
  const total = await db.select({ count: count() }).from(hrApprovalRequests).where(eq(hrApprovalRequests.orgId, orgId));
  const pending = await db.select({ count: count() }).from(hrApprovalRequests).where(and(eq(hrApprovalRequests.orgId, orgId), eq(hrApprovalRequests.status, 'pending')));
  const approved = await db.select({ count: count() }).from(hrApprovalRequests).where(and(eq(hrApprovalRequests.orgId, orgId), eq(hrApprovalRequests.status, 'approved')));
  const rejected = await db.select({ count: count() }).from(hrApprovalRequests).where(and(eq(hrApprovalRequests.orgId, orgId), eq(hrApprovalRequests.status, 'rejected')));
  const cancelled = await db.select({ count: count() }).from(hrApprovalRequests).where(and(eq(hrApprovalRequests.orgId, orgId), eq(hrApprovalRequests.status, 'cancelled')));

  const byModule = await db.select({
    module: hrApprovalRequests.module,
    count: count(),
  }).from(hrApprovalRequests).where(eq(hrApprovalRequests.orgId, orgId)).groupBy(hrApprovalRequests.module).orderBy(desc(count()));

  let myPendingCount = 0;
  if (employeeId) {
    const myP = await db.select({ count: count() }).from(hrApprovalRequests)
      .where(and(eq(hrApprovalRequests.orgId, orgId), eq(hrApprovalRequests.status, 'pending'),
        or(eq(hrApprovalRequests.approverId, employeeId), eq(hrApprovalRequests.delegatedTo, employeeId))));
    myPendingCount = myP[0]?.count || 0;
  }

  const avgHoursRow = await db.select({
    avg: sql<number>`avg(extract(epoch from (decided_at - created_at)) / 3600)`,
  }).from(hrApprovalRequests).where(and(eq(hrApprovalRequests.orgId, orgId), eq(hrApprovalRequests.status, 'approved'), sql`decided_at is not null`));

  return {
    total: total[0]?.count || 0,
    pending: pending[0]?.count || 0,
    approved: approved[0]?.count || 0,
    rejected: rejected[0]?.count || 0,
    cancelled: cancelled[0]?.count || 0,
    byModule,
    myPendingCount,
    avgApprovalHours: Math.round((avgHoursRow[0]?.avg || 0) * 10) / 10,
  };
}
