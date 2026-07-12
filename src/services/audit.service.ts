/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db, auditLog } from '../db/schema';

export async function createAuditLog(params: {
  orgId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    await db.insert(auditLog).values({
      orgId: params.orgId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      oldValues: params.oldValues || {},
      newValues: params.newValues || {},
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    });
  } catch (err) {
    console.error('[Audit] Failed to insert audit log:', err);
  }
}

export function extractReqMeta(req: any) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
    : req.ip || req.socket?.remoteAddress || null;
  return {
    ipAddress: ip,
    userAgent: (req.headers?.['user-agent'] as string) || null,
  };
}
