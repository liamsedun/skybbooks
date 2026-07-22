import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, revenueContracts, performanceObligations, revenueSchedules, revenueRecognitionEntries, accounts, contacts, journalEntries } from '../db/schema';
import { postToGL } from './posting.service';
import { AppError } from '../lib/errors';
import { createAuditLog, extractReqMeta } from './audit.service';

export const contractSchema = z.object({
  contractNumber: z.string().min(1),
  customerId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  totalContractValue: z.number().int().min(0).default(0),
  startDate: z.string().transform(v => new Date(v)),
  endDate: z.string().transform(v => new Date(v)).optional().nullable(),
  billingFrequency: z.string().optional().nullable(),
  paymentTerms: z.number().int().optional().nullable(),
  currency: z.string().default('NGN'),
  notes: z.string().optional().nullable(),
});

export const obligationSchema = z.object({
  contractId: z.string().uuid(),
  description: z.string().min(1),
  timing: z.enum(['point_in_time', 'over_time']),
  amount: z.number().int().min(0),
  recognitionMethod: z.enum(['straight_line', 'milestone', 'percentage_of_completion', 'custom']).default('straight_line'),
  revenueAccountId: z.string().uuid(),
  deferredRevenueAccountId: z.string().uuid().optional().nullable(),
  contractAssetAccountId: z.string().uuid().optional().nullable(),
  startDate: z.string().transform(v => new Date(v)).optional().nullable(),
  endDate: z.string().transform(v => new Date(v)).optional().nullable(),
  milestoneCriteria: z.string().optional().nullable(),
  completionPercentage: z.number().min(0).max(100).optional().nullable(),
  sortOrder: z.number().int().default(0),
  status: z.enum(['draft', 'active', 'completed', 'cancelled', 'modified']).default('draft'),
});

export const scheduleSchema = z.object({
  scheduledDate: z.string().transform(v => new Date(v)),
  amount: z.number().int().min(0),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
});

// ── Contracts ──

export async function getContracts(orgId: string): Promise<any[]> {
  const rows = await db
    .select({
      contract: revenueContracts,
      customerName: contacts.name,
      customerCode: contacts.customerCode,
    })
    .from(revenueContracts)
    .leftJoin(contacts, eq(revenueContracts.customerId, contacts.id))
    .where(eq(revenueContracts.orgId, orgId))
    .orderBy(desc(revenueContracts.createdAt));

  return rows.map(r => ({
    ...r.contract,
    customerName: r.customerName,
    customerCode: r.customerCode,
  }));
}

export async function getContract(orgId: string, contractId: string): Promise<any> {
  const [row] = await db
    .select({
      contract: revenueContracts,
      customerName: contacts.name,
      customerCode: contacts.customerCode,
    })
    .from(revenueContracts)
    .leftJoin(contacts, eq(revenueContracts.customerId, contacts.id))
    .where(and(eq(revenueContracts.id, contractId), eq(revenueContracts.orgId, orgId)))
    .limit(1);

  if (!row) throw new AppError('Contract not found.', 404);

  const obligations = await getObligations(orgId, contractId);

  return { ...row.contract, customerName: row.customerName, customerCode: row.customerCode, performanceObligations: obligations };
}

export async function createContract(orgId: string, userId: string, data: any): Promise<any> {
  const parsed = contractSchema.parse(data);

  const [contract] = await db.insert(revenueContracts).values({
    ...parsed,
    orgId,
    endDate: parsed.endDate || null,
    projectId: parsed.projectId || null,
    createdBy: userId,
  }).returning();

  await createAuditLog({ orgId, userId, action: 'create', entityType: 'revenue_contract',       entityId: contract.id,
      oldValues: {},
      newValues: contract, ...extractReqMeta({} as any) });
  return contract;
}

export async function updateContract(orgId: string, userId: string, contractId: string, data: any): Promise<any> {
  const existing = await getContract(orgId, contractId);
  if (!existing) throw new AppError('Contract not found.', 404);

  const parsed = contractSchema.partial().parse(data);

  const [updated] = await db.update(revenueContracts)
    .set({ ...parsed, updatedAt: new Date() })
    .where(and(eq(revenueContracts.id, contractId), eq(revenueContracts.orgId, orgId)))
    .returning();

  await createAuditLog({ orgId, userId, action: 'update', entityType: 'revenue_contract', entityId: contractId, oldValues: existing, newValues: updated, ...extractReqMeta({} as any) });
  return updated;
}

export async function deleteContract(orgId: string, userId: string, contractId: string): Promise<void> {
  const existing = await getContract(orgId, contractId);
  if (!existing) throw new AppError('Contract not found.', 404);

  // Delete related records
  const obligations = await db
    .select({ id: performanceObligations.id })
    .from(performanceObligations)
    .where(eq(performanceObligations.contractId, contractId));

  for (const ob of obligations) {
    await db.delete(revenueSchedules).where(eq(revenueSchedules.obligationId, ob.id));
    await db.delete(revenueRecognitionEntries).where(eq(revenueRecognitionEntries.obligationId, ob.id));
  }
  await db.delete(performanceObligations).where(eq(performanceObligations.contractId, contractId));
  await db.delete(revenueContracts).where(and(eq(revenueContracts.id, contractId), eq(revenueContracts.orgId, orgId)));

  await createAuditLog({ orgId, userId, action: 'delete', entityType: 'revenue_contract', entityId: contractId, oldValues: existing, newValues: {}, ...extractReqMeta({} as any) });
}

// ── Performance Obligations ──

export async function getObligations(orgId: string, contractId: string): Promise<any[]> {
  return await db
    .select()
    .from(performanceObligations)
    .where(eq(performanceObligations.contractId, contractId))
    .orderBy(performanceObligations.sortOrder);
}

export async function getObligation(orgId: string, obligationId: string): Promise<any> {
  const [row] = await db
    .select({ obligation: performanceObligations })
    .from(performanceObligations)
    .innerJoin(revenueContracts, eq(performanceObligations.contractId, revenueContracts.id))
    .where(and(
      eq(performanceObligations.id, obligationId),
      eq(revenueContracts.orgId, orgId)
    ))
    .limit(1);

  if (!row) throw new AppError('Performance obligation not found.', 404);
  return row.obligation;
}

export async function createObligation(orgId: string, userId: string, data: any): Promise<any> {
  const parsed = obligationSchema.parse(data);

  // Verify contract exists and belongs to org
  const [contract] = await db
    .select()
    .from(revenueContracts)
    .where(and(eq(revenueContracts.id, parsed.contractId), eq(revenueContracts.orgId, orgId)))
    .limit(1);

  if (!contract) throw new AppError('Contract not found.', 404);

  const [obligation] = await db.insert(performanceObligations).values({
    ...parsed,
    remainingAmount: parsed.amount,
    startDate: parsed.startDate || contract.startDate,
    endDate: parsed.endDate || contract.endDate,
    deferredRevenueAccountId: parsed.deferredRevenueAccountId || null,
    contractAssetAccountId: parsed.contractAssetAccountId || null,
  } as any).returning();

  // Auto-generate schedule if straight-line or milestone
  if (parsed.recognitionMethod !== 'custom') {
    await generateSchedule(orgId, userId, obligation.id, parsed);
  }

  await createAuditLog({ orgId, userId, action: 'create', entityType: 'performance_obligation', entityId: obligation.id, oldValues: {}, newValues: obligation, ...extractReqMeta({} as any) });
  return obligation;
}

export async function updateObligation(orgId: string, userId: string, obligationId: string, data: any): Promise<any> {
  const existing = await getObligation(orgId, obligationId);
  if (!existing) throw new AppError('Performance obligation not found.', 404);

  const parsed = obligationSchema.partial().parse(data);

  const [updated] = await db.update(performanceObligations)
    .set({ ...parsed, updatedAt: new Date() } as any)
    .where(eq(performanceObligations.id, obligationId))
    .returning();

  await createAuditLog({ orgId, userId, action: 'update', entityType: 'performance_obligation', entityId: obligationId, oldValues: existing, newValues: updated, ...extractReqMeta({} as any) });
  return updated;
}

export async function deleteObligation(orgId: string, userId: string, obligationId: string): Promise<void> {
  const existing = await getObligation(orgId, obligationId);
  if (!existing) throw new AppError('Performance obligation not found.', 404);

  await db.delete(revenueSchedules).where(eq(revenueSchedules.obligationId, obligationId));
  await db.delete(revenueRecognitionEntries).where(eq(revenueRecognitionEntries.obligationId, obligationId));
  await db.delete(performanceObligations).where(eq(performanceObligations.id, obligationId));

  await createAuditLog({ orgId, userId, action: 'delete', entityType: 'performance_obligation', entityId: obligationId, oldValues: existing, newValues: {}, ...extractReqMeta({} as any) });
}

// ── Schedules ──

export async function getSchedules(orgId: string, obligationId: string): Promise<any[]> {
  // Verify the obligation belongs to the org via contract join
  const [obligation] = await db
    .select({ id: performanceObligations.id })
    .from(performanceObligations)
    .innerJoin(revenueContracts, eq(performanceObligations.contractId, revenueContracts.id))
    .where(and(
      eq(performanceObligations.id, obligationId),
      eq(revenueContracts.orgId, orgId)
    ))
    .limit(1);

  if (!obligation) throw new AppError('Obligation not found in this organization.', 404);

  return await db
    .select()
    .from(revenueSchedules)
    .where(eq(revenueSchedules.obligationId, obligationId))
    .orderBy(revenueSchedules.scheduledDate);
}

export async function generateSchedule(orgId: string, userId: string, obligationId: string, obligationData: any): Promise<any[]> {
  const method = obligationData.recognitionMethod || 'straight_line';
  let schedules: any[] = [];

  if (method === 'straight_line') {
    schedules = generateStraightLineSchedule(obligationData);
  } else if (method === 'milestone') {
    schedules = generateMilestoneSchedule(obligationData);
  } else if (method === 'percentage_of_completion') {
    schedules = generatePocSchedule(obligationData);
  }

  // Delete existing schedules and regenerate
  await db.delete(revenueSchedules).where(eq(revenueSchedules.obligationId, obligationId));

  const created: any[] = [];
  for (const s of schedules) {
    const [row] = await db.insert(revenueSchedules).values({
      ...s,
      obligationId,
    }).returning();
    created.push(row);
  }

  return created;
}

function generateStraightLineSchedule(data: any): any[] {
  const amount = data.amount || 0;
  const startDate = data.startDate ? new Date(data.startDate) : new Date();
  const endDate = data.endDate ? new Date(data.endDate) : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Calculate months between dates
  const months = Math.max(1, (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()));
  const monthlyAmount = Math.round(amount / months);

  const schedules: any[] = [];
  let remaining = amount;

  for (let i = 0; i < months; i++) {
    const scheduledDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const isLast = i === months - 1;
    const scheduleAmount = isLast ? remaining : monthlyAmount;
    remaining -= scheduleAmount;

    schedules.push({
      scheduledDate,
      amount: scheduleAmount,
      description: `Month ${i + 1} / ${months}`,
      sortOrder: i,
    });
  }

  return schedules;
}

function generateMilestoneSchedule(data: any): any[] {
  const amount = data.amount || 0;
  if (data.milestoneCriteria) {
    // Parse milestone criteria as JSON array of {date, percentage, description}
    try {
      const milestones = JSON.parse(data.milestoneCriteria);
      return milestones.map((m: any, i: number) => ({
        scheduledDate: new Date(m.date),
        amount: Math.round(amount * (m.percentage || 0) / 100),
        description: m.description || `Milestone ${i + 1}`,
        sortOrder: i,
      }));
    } catch {
      // Fallback: single milestone at end
      return [{
        scheduledDate: data.endDate ? new Date(data.endDate) : new Date(),
        amount,
        description: 'Milestone completion',
        sortOrder: 0,
      }];
    }
  }

  return [{
    scheduledDate: data.endDate ? new Date(data.endDate) : new Date(),
    amount,
    description: 'Single milestone',
    sortOrder: 0,
  }];
}

function generatePocSchedule(data: any): any[] {
  // PoC: recognize based on completion percentage updates
  const amount = data.amount || 0;
  const pct = data.completionPercentage ? Number(data.completionPercentage) : 0;
  return [{
    scheduledDate: new Date(),
    amount: Math.round(amount * pct / 100),
    description: `Percentage of completion: ${pct}%`,
    sortOrder: 0,
  }];
}

export async function addManualSchedule(orgId: string, obligationId: string, data: any): Promise<any> {
  // Verify the obligation belongs to the org via contract join
  const [obligation] = await db
    .select({ id: performanceObligations.id })
    .from(performanceObligations)
    .innerJoin(revenueContracts, eq(performanceObligations.contractId, revenueContracts.id))
    .where(and(
      eq(performanceObligations.id, obligationId),
      eq(revenueContracts.orgId, orgId)
    ))
    .limit(1);

  if (!obligation) throw new AppError('Obligation not found in this organization.', 404);

  const parsed = scheduleSchema.parse(data);
  const [schedule] = await db.insert(revenueSchedules).values({
    ...parsed,
    obligationId,
  }).returning();
  return schedule;
}

// ── Revenue Recognition ──

export async function recognizeRevenue(
  orgId: string,
  userId: string,
  scheduleId: string,
  recognizedDate: Date,
  req?: any
): Promise<any> {
  const [schedule] = await db
    .select()
    .from(revenueSchedules)
    .where(eq(revenueSchedules.id, scheduleId))
    .limit(1);

  if (!schedule) throw new AppError('Revenue schedule not found.', 404);
  if (schedule.status === 'recognized') throw new AppError('Revenue already recognized for this schedule.', 400);

  const [obligation] = await db
    .select()
    .from(performanceObligations)
    .where(eq(performanceObligations.id, schedule.obligationId))
    .limit(1);

  if (!obligation) throw new AppError('Performance obligation not found.', 404);

  const [contract] = await db
    .select()
    .from(revenueContracts)
    .where(eq(revenueContracts.id, obligation.contractId))
    .limit(1);

  if (!contract) throw new AppError('Contract not found.', 404);
  if (contract.orgId !== orgId) throw new AppError('Contract does not belong to this organization.', 403);

  const amount = schedule.amount;
  const timing = obligation.timing;
  const revAccountId = obligation.revenueAccountId;
  const deferredRevAccountId = obligation.deferredRevenueAccountId;
  const contractAssetAccountId = obligation.contractAssetAccountId;

  // Find AR account
  const [arAccount] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'accounts_receivable')))
    .limit(1);

  // Build journal lines per IFRS 15
  const journalLines: any[] = [];

  if (timing === 'point_in_time') {
    // Point-in-time: DR Receivables (or Contract Asset), CR Revenue
    if (contractAssetAccountId) {
      journalLines.push({ accountId: contractAssetAccountId, debit: amount, description: `Contract asset for ${contract.contractNumber}` });
      journalLines.push({ accountId: revAccountId, credit: amount, description: `Revenue recognition for ${contract.contractNumber}` });
    } else if (arAccount) {
      journalLines.push({ accountId: arAccount.id, debit: amount, description: `Accounts Receivable for ${contract.contractNumber}` });
      journalLines.push({ accountId: revAccountId, credit: amount, description: `Revenue recognition for ${contract.contractNumber}` });
    }
  } else {
    // Over-time: DR Contract Asset (or Receivables), CR Revenue
    // If deferred revenue account is set, DR Deferred Revenue, CR Revenue
    if (deferredRevAccountId) {
      journalLines.push({ accountId: deferredRevAccountId, debit: amount, description: `Release from deferred revenue for ${contract.contractNumber}` });
      journalLines.push({ accountId: revAccountId, credit: amount, description: `Revenue recognition (over time) for ${contract.contractNumber}` });
    } else if (contractAssetAccountId) {
      journalLines.push({ accountId: contractAssetAccountId, debit: amount, description: `Contract asset for ${contract.contractNumber}` });
      journalLines.push({ accountId: revAccountId, credit: amount, description: `Revenue recognition (over time) for ${contract.contractNumber}` });
    } else if (arAccount) {
      journalLines.push({ accountId: arAccount.id, debit: amount, description: `Accounts Receivable for ${contract.contractNumber}` });
      journalLines.push({ accountId: revAccountId, credit: amount, description: `Revenue recognition (over time) for ${contract.contractNumber}` });
    }
  }

  if (journalLines.length === 0) {
    throw new AppError('Cannot recognize revenue: no target account configured. Set up AR, deferred revenue, or contract asset account.', 400);
  }

  const description = `Revenue recognition: ${obligation.description} (${contract.contractNumber})`;

  // Create JE via central posting engine
  const journalEntry = await postToGL({
    orgId,
    date: recognizedDate,
    description,
    reference: `${contract.contractNumber}-SCH-${schedule.sortOrder}`,
    source: 'revenue_recognition',
    sourceId: schedule.id,
    projectId: contract.projectId || undefined,
    createdBy: userId,
    lines: journalLines,
    status: 'posted',
  });

  // Create recognition entry record
  const [recognitionEntry] = await db.insert(revenueRecognitionEntries).values({
    scheduleId,
    obligationId: schedule.obligationId,
    journalEntryId: journalEntry.id,
    amount,
    recognizedDate,
    method: obligation.recognitionMethod,
    description,
    createdBy: userId,
  }).returning();

  // Update schedule status
  await db.update(revenueSchedules)
    .set({ status: 'recognized', recognizedAmount: amount, updatedAt: new Date() })
    .where(eq(revenueSchedules.id, scheduleId));

  // Update obligation recognized amount
  const newRecognized = (obligation.recognizedAmount || 0) + amount;
  const newRemaining = Math.max(0, (obligation.remainingAmount || 0) - amount);
  const obStatus = newRemaining <= 0 ? 'completed' : obligation.status;
  await db.update(performanceObligations)
    .set({ recognizedAmount: newRecognized, remainingAmount: newRemaining, status: obStatus, updatedAt: new Date() })
    .where(eq(performanceObligations.id, schedule.obligationId));

  // Update contract total if all obligations complete
  const pendingObligations = await db
    .select({ id: performanceObligations.id })
    .from(performanceObligations)
    .where(and(eq(performanceObligations.contractId, contract.id), eq(performanceObligations.status, 'active')));

  if (pendingObligations.length === 0) {
    await db.update(revenueContracts)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(revenueContracts.id, contract.id));
  }

  const meta = req ? extractReqMeta(req) : { ipAddress: null, userAgent: null };
  await createAuditLog({ orgId, userId, action: 'create', entityType: 'revenue_recognition', entityId: recognitionEntry.id, oldValues: {}, newValues: recognitionEntry, ...meta });

  return { recognitionEntry, journalEntry };
}

export async function recognizeAllPending(orgId: string, userId: string, asOfDate: Date, req?: any): Promise<any[]> {
  const pending = await db
    .select({ schedule: revenueSchedules })
    .from(revenueSchedules)
    .innerJoin(performanceObligations, eq(revenueSchedules.obligationId, performanceObligations.id))
    .innerJoin(revenueContracts, eq(performanceObligations.contractId, revenueContracts.id))
    .where(and(
      eq(revenueContracts.orgId, orgId),
      eq(revenueSchedules.status, 'pending'),
      sql`${revenueSchedules.scheduledDate} <= ${asOfDate}`
    ))
    .orderBy(revenueSchedules.scheduledDate);

  const results: any[] = [];
  for (const s of pending) {
    try {
      const result = await recognizeRevenue(orgId, userId, s.schedule.id, asOfDate, req);
      results.push(result);
    } catch (err: any) {
      results.push({ scheduleId: s.schedule.id, error: err.message });
    }
  }

  return results;
}

// ── Reports ──

export async function getRecognitionReport(orgId: string, startDate?: Date, endDate?: Date): Promise<any> {
  const conditions = [eq(revenueRecognitionEntries.obligationId, performanceObligations.id)];

  let query = db
    .select({
      id: revenueRecognitionEntries.id,
      amount: revenueRecognitionEntries.amount,
      recognizedDate: revenueRecognitionEntries.recognizedDate,
      method: revenueRecognitionEntries.method,
      description: revenueRecognitionEntries.description,
      createdAt: revenueRecognitionEntries.createdAt,
      scheduleDate: revenueSchedules.scheduledDate,
      scheduleStatus: revenueSchedules.status,
      obligationDescription: performanceObligations.description,
      obligationTiming: performanceObligations.timing,
      obligationAmount: performanceObligations.amount,
      obligationRecognized: performanceObligations.recognizedAmount,
      obligationRemaining: performanceObligations.remainingAmount,
      contractNumber: revenueContracts.contractNumber,
      contractStatus: revenueContracts.status,
    })
    .from(revenueRecognitionEntries)
    .innerJoin(revenueSchedules, eq(revenueRecognitionEntries.scheduleId, revenueSchedules.id))
    .innerJoin(performanceObligations, eq(revenueRecognitionEntries.obligationId, performanceObligations.id))
    .innerJoin(revenueContracts, eq(performanceObligations.contractId, revenueContracts.id))
    .where(eq(revenueContracts.orgId, orgId))
    .orderBy(desc(revenueRecognitionEntries.recognizedDate));

  if (startDate && endDate) {
    (query as any).where(and(
      sql`${revenueRecognitionEntries.recognizedDate} >= ${startDate}`,
      sql`${revenueRecognitionEntries.recognizedDate} <= ${endDate}`
    ));
  }

  return await query;
}

export async function getDeferredRevenueSummary(orgId: string, asOfDate?: Date): Promise<any> {
  const dateFilter = asOfDate ? sql`${revenueSchedules.scheduledDate} <= ${asOfDate}` : sql`1=1`;

  const pendingSchedules = await db
    .select({
      total: sql<number>`COALESCE(SUM(${revenueSchedules.amount} - ${revenueSchedules.recognizedAmount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(revenueSchedules)
    .innerJoin(performanceObligations, eq(revenueSchedules.obligationId, performanceObligations.id))
    .innerJoin(revenueContracts, eq(performanceObligations.contractId, revenueContracts.id))
    .where(and(
      eq(revenueContracts.orgId, orgId),
      eq(revenueSchedules.status, 'pending'),
      sql`${revenueSchedules.amount} > ${revenueSchedules.recognizedAmount}`,
      sql`${revenueSchedules.scheduledDate} <= ${asOfDate || new Date()}`
    ));

  return {
    pendingRecognition: Number(pendingSchedules[0]?.total || 0),
    pendingCount: Number(pendingSchedules[0]?.count || 0),
  };
}
