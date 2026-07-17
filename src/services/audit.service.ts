import { db, auditLog } from '../db/schema';
import { desc, sql } from 'drizzle-orm';
import { createHash } from 'crypto';

function computeHash(payload: string, previousHash: string | null): string {
  return createHash('sha256').update(`${previousHash || ''}${payload}`).digest('hex');
}

function buildPayload(params: {
  orgId: string; userId: string; action: string; entityType: string;
  entityId?: string | null; description?: string | null;
  oldValues?: Record<string, any>; newValues?: Record<string, any>;
  ipAddress?: string | null; userAgent?: string | null; correlationId?: string | null;
}): string {
  const stable = {
    o: params.orgId, u: params.userId, a: params.action, et: params.entityType,
    eid: params.entityId || null, d: params.description || null,
    ov: params.oldValues || {}, nv: params.newValues || {},
    ip: params.ipAddress || null, ua: params.userAgent || null, cid: params.correlationId || null,
    t: Date.now().toString(),
  };
  return JSON.stringify(stable, Object.keys(stable).sort());
}

export async function getPreviousAuditHash(orgId: string): Promise<string | null> {
  try {
    const [last] = await db
      .select({ hash: auditLog.hash })
      .from(auditLog)
      .where(sql`${auditLog.orgId} = ${orgId}`)
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    return last?.hash || null;
  } catch {
    return null;
  }
}

export async function createAuditLog(params: {
  orgId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}) {
  try {
    const previousHash = await getPreviousAuditHash(params.orgId);
    const payload = buildPayload(params);
    const hash = computeHash(payload, previousHash);
    await db.insert(auditLog).values({
      orgId: params.orgId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      description: params.description || null,
      oldValues: params.oldValues || {},
      newValues: params.newValues || {},
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      correlationId: params.correlationId || null,
      hash,
      previousHash,
    });
  } catch (err) {
    console.error('[Audit] Failed to insert audit log:', err);
  }
}

export async function verifyAuditChain(orgId: string): Promise<{
  valid: boolean;
  checkedCount: number;
  firstBreakIndex: number | null;
  firstBreakId: string | null;
}> {
  try {
    const logs = await db
      .select({
        id: auditLog.id,
        hash: auditLog.hash,
        previousHash: auditLog.previousHash,
        createdAt: auditLog.createdAt,
        action: auditLog.action,
        entityType: auditLog.entityType,
      })
      .from(auditLog)
      .where(sql`${auditLog.orgId} = ${orgId}`)
      .orderBy(auditLog.createdAt);

    let valid = true;
    let firstBreakIndex: number | null = null;
    let firstBreakId: string | null = null;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (i === 0) {
        if (log.previousHash !== null) {
          valid = false;
          firstBreakIndex = i;
          firstBreakId = log.id;
          break;
        }
      } else {
        if (log.previousHash !== logs[i - 1].hash) {
          valid = false;
          firstBreakIndex = i;
          firstBreakId = log.id;
          break;
        }
      }
    }

    return { valid, checkedCount: logs.length, firstBreakIndex, firstBreakId };
  } catch (err) {
    console.error('[Audit] Chain verification failed:', err);
    return { valid: false, checkedCount: 0, firstBreakIndex: null, firstBreakId: null };
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

export function generateCorrelationId(): string {
  const { randomUUID } = require('crypto');
  return randomUUID();
}
