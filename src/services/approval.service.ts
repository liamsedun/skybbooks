/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db, approvalWorkflows, approvalHistory, users } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { createAuditLog, generateCorrelationId } from './audit.service';

export type ApprovalModule = 'bills' | 'expenses' | 'journals' | 'payments_received' | 'payments_made' | 'purchase_orders' | 'fixed_assets' | 'inventory_adjustments';

export type ApprovalLevel = 1 | 2 | 3;

export interface WorkflowConfig {
  id: string;
  orgId: string;
  module: ApprovalModule;
  level: ApprovalLevel;
}

export interface ApprovalHistoryEntry {
  id: string;
  orgId: string;
  module: ApprovalModule;
  entityId: string;
  action: string;
  performedBy: string;
  performerName?: string;
  comment?: string;
  oldStatus?: string;
  newStatus?: string;
  createdAt: Date;
}

function toApprovalLevel(level: number): ApprovalLevel {
  if (level === 1 || level === 2 || level === 3) return level;
  return 1;
}

export async function getWorkflowConfig(orgId: string, module: ApprovalModule): Promise<WorkflowConfig | null> {
  const configs = await db
    .select()
    .from(approvalWorkflows)
    .where(and(eq(approvalWorkflows.orgId, orgId), eq(approvalWorkflows.module, module)))
    .limit(1);
  if (configs.length === 0) return null;
  const c = configs[0];
  return { ...c, level: toApprovalLevel(c.level) };
}

export async function setWorkflowConfig(
  orgId: string,
  module: ApprovalModule,
  level: ApprovalLevel
): Promise<WorkflowConfig> {
  const existing = await getWorkflowConfig(orgId, module);
  if (existing) {
    await db
      .update(approvalWorkflows)
      .set({ level, updatedAt: new Date() })
      .where(eq(approvalWorkflows.id, existing.id));
    return { ...existing, level };
  }
  const [config] = await db
    .insert(approvalWorkflows)
    .values({ orgId, module, level })
    .returning();
  return { ...config, level: toApprovalLevel(config.level) };
}

export async function deleteWorkflowConfig(orgId: string, module: ApprovalModule): Promise<void> {
  await db
    .delete(approvalWorkflows)
    .where(and(eq(approvalWorkflows.orgId, orgId), eq(approvalWorkflows.module, module)));
}

export async function getAllWorkflowConfigs(orgId: string): Promise<WorkflowConfig[]> {
  const configs = await db
    .select()
    .from(approvalWorkflows)
    .where(eq(approvalWorkflows.orgId, orgId));
  return configs.map(c => ({ ...c, level: toApprovalLevel(c.level) }));
}

export async function recordApprovalHistory(
  orgId: string,
  module: ApprovalModule,
  entityId: string,
  action: string,
  performedBy: string,
  oldStatus: string | undefined,
  newStatus: string | undefined,
  comment?: string
): Promise<void> {
  await db.insert(approvalHistory).values({
    orgId,
    module,
    entityId,
    action,
    performedBy,
    comment,
    oldStatus,
    newStatus,
  }).execute();
}

export async function getApprovalHistory(
  orgId: string,
  module: ApprovalModule,
  entityId: string
): Promise<ApprovalHistoryEntry[]> {
  const rows = await db
    .select({
      id: approvalHistory.id,
      orgId: approvalHistory.orgId,
      module: approvalHistory.module,
      entityId: approvalHistory.entityId,
      action: approvalHistory.action,
      performedBy: approvalHistory.performedBy,
      performerName: users.fullName,
      comment: approvalHistory.comment,
      oldStatus: approvalHistory.oldStatus,
      newStatus: approvalHistory.newStatus,
      createdAt: approvalHistory.createdAt,
    })
    .from(approvalHistory)
    .leftJoin(users, eq(approvalHistory.performedBy, users.id))
    .where(and(eq(approvalHistory.orgId, orgId), eq(approvalHistory.module, module), eq(approvalHistory.entityId, entityId)))
    .orderBy(desc(approvalHistory.createdAt));
  return rows.map(r => ({
    ...r,
    performerName: r.performerName ?? undefined,
    comment: r.comment ?? undefined,
    oldStatus: r.oldStatus ?? undefined,
    newStatus: r.newStatus ?? undefined,
  }));
}

export function getModuleStatusTransitions(module: ApprovalModule, level: number): string[] {
  switch (level) {
    case 1:
      return ['draft', 'posted'];
    case 2:
      return ['draft', 'approved', 'posted'];
    case 3:
      return ['draft', 'pending_review', 'approved', 'posted'];
    default:
      return ['draft', 'posted'];
  }
}

export function isRoleAllowedForAction(action: string, userRole: string): boolean {
  switch (action) {
    case 'submit':
      return true;
    case 'review':
      return ['admin', 'accountant', 'owner'].includes(userRole);
    case 'approve':
      return ['admin', 'accountant', 'owner'].includes(userRole);
    case 'post':
      return ['admin', 'accountant', 'owner'].includes(userRole);
    case 'reject':
      return ['admin', 'accountant', 'owner'].includes(userRole);
    case 'recall':
      return true;
    default:
      return false;
  }
}

export function computeNextStatus(
  currentStatus: string,
  action: string,
  level: number
): string | null {
  const transitions = getModuleStatusTransitions('bills', level);
  const statusIndex = transitions.indexOf(currentStatus);

  if (statusIndex === -1) return null;

  switch (action) {
    case 'submit':
      if (currentStatus === 'draft') {
        return level === 1 ? 'posted' : level === 2 ? 'approved' : 'pending_review';
      }
      return null;
    case 'review':
      if (currentStatus === 'pending_review') return 'approved';
      return null;
    case 'approve':
      if (currentStatus === 'approved') return 'posted';
      if (currentStatus === 'draft' && level === 2) return 'approved';
      if (currentStatus === 'pending_review') return 'approved';
      return null;
    case 'post':
      if (currentStatus === 'approved') return 'posted';
      if (currentStatus === 'draft' && level === 1) return 'posted';
      return null;
    case 'reject':
      if (currentStatus === 'pending_review') return 'draft';
      return null;
    case 'recall':
      if (currentStatus === 'pending_review') return 'draft';
      return null;
    case 'void':
      return 'void';
    case 'cancel':
      return 'cancelled';
    default:
      return null;
  }
}

export async function validateAndExecuteTransition(
  orgId: string,
  module: ApprovalModule,
  entityId: string,
  currentStatus: string,
  action: string,
  userId: string,
  userRole: string,
  comment?: string
): Promise<{ newStatus: string; config: WorkflowConfig | null }> {
  const config = await getWorkflowConfig(orgId, module);
  const level: ApprovalLevel = (config?.level ?? 1) as ApprovalLevel;

  if (!isRoleAllowedForAction(action, userRole)) {
    throw new AppError(`You do not have permission to ${action} this ${module} record.`, 403);
  }

  const newStatus = computeNextStatus(currentStatus, action, level);
  if (!newStatus) {
    throw new AppError(`Cannot ${action} a ${module} in status '${currentStatus}'.`, 400);
  }

  await recordApprovalHistory(orgId, module, entityId, action, userId, currentStatus, newStatus, comment);

  return { newStatus, config };
}
