import { randomUUID } from 'crypto';
import { db, leases, leasePaymentSchedules, leaseJournalEntries, accounts, journalEntries, journalLines } from '../db/schema';
import { AppError } from '../lib/errors';
import { postToGL } from './posting.service';
import { createAuditLog } from './audit.service';
import { eq, and, asc, sql } from 'drizzle-orm';

export type CreateLeaseInput = {
  orgId: string;
  lessorName: string;
  description?: string;
  assetCategory: string;
  rouAssetAccountId: string;
  accumDepreciationAccountId: string;
  depreciationExpenseAccountId: string;
  leaseLiabilityAccountId?: string;
  currentLiabilityAccountId?: string;
  interestExpenseAccountId?: string;
  bankAccountId?: string;
  commencementDate: string;
  endDate: string;
  leaseTermMonths: number;
  paymentAmount: number;
  paymentFrequency: string;
  totalPayments: number;
  incrementalBorrowingRate: number;
  initialDirectCosts?: number;
  depreciationMethod?: string;
  residualValue?: number;
  notes?: string;
  createdBy: string;
};

export type UpdateLeaseInput = Partial<CreateLeaseInput> & { status?: string };

function calculatePresentValue(paymentAmount: number, ratePerPeriod: number, totalPayments: number): number {
  if (ratePerPeriod === 0) return paymentAmount * totalPayments;
  const r = ratePerPeriod / 100;
  return Math.round(paymentAmount * (1 - Math.pow(1 + r, -totalPayments)) / r);
}

export async function createLease(input: CreateLeaseInput) {
  const monthlyRate = input.incrementalBorrowingRate / 12;
  const pv = calculatePresentValue(input.paymentAmount, monthlyRate, input.totalPayments);
  const rouAssetInitial = pv + (input.initialDirectCosts || 0);
  const leaseNumber = `LSE-${randomUUID().slice(0, 8).toUpperCase()}`;

  const [lease] = await db.insert(leases).values({
    leaseNumber,
    orgId: input.orgId,
    description: input.description || null,
    lessorName: input.lessorName,
    assetCategory: input.assetCategory,
    rouAssetAccountId: input.rouAssetAccountId,
    accumDepreciationAccountId: input.accumDepreciationAccountId,
    depreciationExpenseAccountId: input.depreciationExpenseAccountId,
    leaseLiabilityAccountId: input.leaseLiabilityAccountId || null,
    currentLiabilityAccountId: input.currentLiabilityAccountId || null,
    interestExpenseAccountId: input.interestExpenseAccountId || null,
    bankAccountId: input.bankAccountId || null,
    commencementDate: new Date(input.commencementDate),
    endDate: new Date(input.endDate),
    leaseTermMonths: input.leaseTermMonths,
    paymentAmount: input.paymentAmount,
    paymentFrequency: input.paymentFrequency || 'monthly',
    totalPayments: input.totalPayments,
    incrementalBorrowingRate: String(input.incrementalBorrowingRate),
    presentValue: pv,
    rouAssetInitial,
    initialDirectCosts: input.initialDirectCosts || 0,
    depreciationMethod: input.depreciationMethod || 'straight_line',
    residualValue: input.residualValue || 0,
    status: 'active',
    notes: input.notes || null,
    createdBy: input.createdBy,
  } as any).returning();

  const schedule = generateAmortizationSchedule(lease, monthlyRate);

  const scheduleRows = schedule.map(s => ({
    leaseId: lease.id,
    periodNumber: s.periodNumber,
    dueDate: s.dueDate,
    paymentAmount: s.paymentAmount,
    interestAmount: s.interestAmount,
    principalAmount: s.principalAmount,
    outstandingBalance: s.outstandingBalance,
    isPaid: false,
  }));

  await db.insert(leasePaymentSchedules).values(scheduleRows);

  return { lease, schedule };
}

function generateAmortizationSchedule(lease: any, monthlyRate: number) {
  const schedule: { periodNumber: number; dueDate: Date; paymentAmount: number; interestAmount: number; principalAmount: number; outstandingBalance: number }[] = [];
  let outstanding = lease.presentValue;
  const paymentAmount = lease.paymentAmount;
  const commencement = new Date(lease.commencementDate);
  const r = monthlyRate / 100;

  for (let i = 1; i <= lease.totalPayments; i++) {
    const dueDate = new Date(commencement);
    dueDate.setMonth(dueDate.getMonth() + i);

    let interest = 0;
    let principal = paymentAmount;

    if (r > 0) {
      interest = Math.round(outstanding * r);
      principal = paymentAmount - interest;
    }

    if (principal > outstanding) principal = outstanding;
    outstanding = outstanding - principal;
    if (outstanding < 0) outstanding = 0;

    schedule.push({
      periodNumber: i,
      dueDate,
      paymentAmount,
      interestAmount: interest,
      principalAmount: principal,
      outstandingBalance: outstanding,
    });
  }

  return schedule;
}

export async function getLeases(orgId: string) {
  return await db
    .select()
    .from(leases)
    .where(eq(leases.orgId, orgId))
    .orderBy(desc(leases.createdAt));
}

export async function getLease(leaseId: string, orgId?: string) {
  const whereClause = orgId
    ? and(eq(leases.id, leaseId), eq(leases.orgId, orgId))
    : eq(leases.id, leaseId);

  const [lease] = await db
    .select()
    .from(leases)
    .where(whereClause);

  if (!lease) throw new AppError('Lease not found', 404);

  const schedule = await db
    .select()
    .from(leasePaymentSchedules)
    .where(eq(leasePaymentSchedules.leaseId, leaseId))
    .orderBy(asc(leasePaymentSchedules.periodNumber));

  return { ...lease, schedule };
}

export async function updateLease(leaseId: string, input: UpdateLeaseInput, orgId?: string) {
  const updateData: any = {};
  if (input.lessorName !== undefined) updateData.lessorName = input.lessorName;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.bankAccountId !== undefined) updateData.bankAccountId = input.bankAccountId;
  updateData.updatedAt = new Date();

  const whereClause = orgId
    ? and(eq(leases.id, leaseId), eq(leases.orgId, orgId))
    : eq(leases.id, leaseId);

  const [updated] = await db
    .update(leases)
    .set(updateData)
    .where(whereClause)
    .returning();

  if (!updated) throw new AppError('Lease not found', 404);

  if (updated.status === 'terminated' || updated.status === 'expired') {
    await db
      .update(leasePaymentSchedules)
      .set({ isPaid: true })
      .where(and(
        eq(leasePaymentSchedules.leaseId, leaseId),
        eq(leasePaymentSchedules.isPaid, false)
      ));
  }

  return updated;
}

export async function processLeasePayment(leaseId: string, periodNumber: number, userId: string, paymentDate?: string, orgId?: string) {
  const lease = await getLease(leaseId, orgId);

  const scheduleRow = lease.schedule.find((s: any) => s.periodNumber === periodNumber);
  if (!scheduleRow) throw new AppError(`Period ${periodNumber} not found in lease schedule`, 404);
  if (scheduleRow.isPaid) throw new AppError(`Period ${periodNumber} payment already processed`, 400);

  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];

  // DR Interest Expense (if interest > 0)
  if (lease.interestExpenseAccountId && scheduleRow.interestAmount > 0) {
    lines.push({
      accountId: lease.interestExpenseAccountId,
      debit: scheduleRow.interestAmount,
      credit: 0,
      description: `Lease interest – Period ${periodNumber} (${lease.leaseNumber})`,
    });
  }

  // DR Lease Liability (principal portion)
  if (lease.leaseLiabilityAccountId && scheduleRow.principalAmount > 0) {
    lines.push({
      accountId: lease.leaseLiabilityAccountId,
      debit: scheduleRow.principalAmount,
      credit: 0,
      description: `Lease liability repayment – Period ${periodNumber} (${lease.leaseNumber})`,
    });
  }

  // CR Bank/Cash (total payment)
  if (lease.bankAccountId) {
    lines.push({
      accountId: lease.bankAccountId,
      debit: 0,
      credit: scheduleRow.paymentAmount,
      description: `Lease payment – Period ${periodNumber} (${lease.leaseNumber})`,
    });
  }

  if (lines.length === 0) throw new AppError('No accounts configured for lease payment posting', 400);

  const je = await postToGL({
    orgId: lease.orgId,
    date: paymentDate ? new Date(paymentDate) : scheduleRow.dueDate,
    description: `Lease payment – ${lease.leaseNumber} – Period ${periodNumber}`,
    reference: `${lease.leaseNumber}-P${periodNumber}`,
    source: 'lease',
    sourceId: leaseId,
    createdBy: userId,
    lines,
  });

  // Freeze schedule row
  await db
    .update(leasePaymentSchedules)
    .set({ isPaid: true, journalEntryId: je.id, updatedAt: new Date() })
    .where(eq(leasePaymentSchedules.id, scheduleRow.id));

  // Record lease JE link
  await db.insert(leaseJournalEntries).values({
    leaseId,
    periodNumber,
    journalEntryId: je.id,
    entryType: 'payment',
    description: `Lease payment JE – Period ${periodNumber}`,
  });

  return je;
}

export async function postLeaseDepreciation(leaseId: string, periodNumber: number, userId: string, orgId?: string) {
  const lease = await getLease(leaseId, orgId);

  const periodExists = lease.schedule.find((s: any) => s.periodNumber === periodNumber);
  if (!periodExists) throw new AppError(`Period ${periodNumber} not found`, 404);

  const deprAmount = calculateMonthlyDepreciation(lease);

  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];

  // DR Depreciation Expense
  lines.push({
    accountId: lease.depreciationExpenseAccountId,
    debit: deprAmount,
    credit: 0,
    description: `ROU depreciation – Period ${periodNumber} (${lease.leaseNumber})`,
  });

  // CR Accumulated Depreciation
  lines.push({
    accountId: lease.accumDepreciationAccountId,
    debit: 0,
    credit: deprAmount,
    description: `Accum. ROU depreciation – Period ${periodNumber} (${lease.leaseNumber})`,
  });

  const je = await postToGL({
    orgId: lease.orgId,
    date: periodExists.dueDate,
    description: `ROU depreciation – ${lease.leaseNumber} – Period ${periodNumber}`,
    reference: `${lease.leaseNumber}-D${periodNumber}`,
    source: 'lease',
    sourceId: leaseId,
    createdBy: userId,
    lines,
  });

  await db.insert(leaseJournalEntries).values({
    leaseId,
    periodNumber,
    journalEntryId: je.id,
    entryType: 'depreciation',
    description: `ROU depreciation JE – Period ${periodNumber}`,
  });

  return je;
}

function calculateMonthlyDepreciation(lease: any): number {
  const deprMonths = lease.leaseTermMonths;
  const deprBase = lease.rouAssetInitial - (lease.residualValue || 0);
  if (deprMonths <= 0 || deprBase <= 0) return 0;
  return Math.round(deprBase / deprMonths);
}

export async function postCommencementEntry(leaseId: string, userId: string, orgId?: string) {
  const lease = await getLease(leaseId, orgId);

  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];

  // Check if commencement JE already exists via lease_journal_entries
  const existingCommencement = await db
    .select()
    .from(leaseJournalEntries)
    .where(and(
      eq(leaseJournalEntries.leaseId, leaseId),
      eq(leaseJournalEntries.entryType, 'commencement')
    ));

  if (existingCommencement.length > 0) {
    throw new AppError('Commencement journal entry already posted for this lease', 400);
  }

  // DR ROU Asset (initial recognition amount)
  if (lease.rouAssetAccountId) {
    lines.push({
      accountId: lease.rouAssetAccountId,
      debit: lease.rouAssetInitial,
      credit: 0,
      description: `Initial recognition of ROU asset (${lease.leaseNumber})`,
    });
  }

  // CR Lease Liability (PV of lease payments)
  if (lease.leaseLiabilityAccountId && lease.presentValue > 0) {
    lines.push({
      accountId: lease.leaseLiabilityAccountId,
      debit: 0,
      credit: lease.presentValue,
      description: `Initial recognition of lease liability (${lease.leaseNumber})`,
    });
  }

  // CR Bank/Cash (initial direct costs, if any)
  if (lease.initialDirectCosts > 0 && lease.bankAccountId) {
    lines.push({
      accountId: lease.bankAccountId,
      debit: 0,
      credit: lease.initialDirectCosts,
      description: `Initial direct costs (${lease.leaseNumber})`,
    });
  }

  if (lines.length === 0) throw new AppError('No accounts configured for commencement entry', 400);

  const je = await postToGL({
    orgId: lease.orgId,
    date: new Date(lease.commencementDate),
    description: `Lease commencement – ${lease.leaseNumber}`,
    reference: `${lease.leaseNumber}-COMMENCE`,
    source: 'lease',
    sourceId: leaseId,
    createdBy: userId,
    lines,
  });

  await db.insert(leaseJournalEntries).values({
    leaseId,
    periodNumber: 0,
    journalEntryId: je.id,
    entryType: 'commencement',
    description: 'Lease commencement JE',
  });

  return je;
}

export async function modifyLease(
  leaseId: string,
  input: {
    newPaymentAmount: number;
    newTermMonths?: number;
    newTotalPayments?: number;
    newBorrowingRate?: number;
    modificationDate: string;
    description: string;
  },
  userId: string,
  orgId?: string
) {
  const lease = await getLease(leaseId, orgId);
  if (lease.status !== 'active') throw new AppError('Only active leases can be modified', 400);

  const modDate = new Date(input.modificationDate);

  // Find remaining unpaid schedules
  const remainingSchedules = lease.schedule.filter((s: any) => !s.isPaid);
  if (remainingSchedules.length === 0) throw new AppError('No remaining payments to modify', 400);

  const newRate = input.newBorrowingRate ?? Number(lease.incrementalBorrowingRate);
  const newTotalPayments = input.newTotalPayments ?? remainingSchedules.length;
  const newPaymentAmount = input.newPaymentAmount;
  const monthlyRate = newRate / 12;
  const newPvRemaining = calculatePresentValue(newPaymentAmount, monthlyRate, newTotalPayments);

  // Current outstanding balance at modification date
  // = last schedule's outstandingBalance before modification
  // We use the first remaining schedule's outstanding
  const currentOutstanding = remainingSchedules[0].outstandingBalance || 0;

  // Gain/Loss on modification: old PV - new PV
  const gainLoss = currentOutstanding - newPvRemaining;

  // DR or CR lease liability to re-measure
  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];

  // DR/CR Lease Liability
  if (lease.leaseLiabilityAccountId && gainLoss !== 0) {
    if (gainLoss > 0) {
      lines.push({
        accountId: lease.leaseLiabilityAccountId,
        debit: gainLoss,
        credit: 0,
        description: `Lease modification – reduction in liability (${lease.leaseNumber})`,
      });
    } else {
      lines.push({
        accountId: lease.leaseLiabilityAccountId,
        debit: 0,
        credit: Math.abs(gainLoss),
        description: `Lease modification – increase in liability (${lease.leaseNumber})`,
      });
    }
  }

  // DR/CR ROU Asset (adjust for gain/loss)
  if (lease.rouAssetAccountId && gainLoss !== 0) {
    if (gainLoss > 0) {
      lines.push({
        accountId: lease.rouAssetAccountId,
        debit: 0,
        credit: gainLoss,
        description: `Lease modification – ROU asset adjustment (${lease.leaseNumber})`,
      });
    } else {
      lines.push({
        accountId: lease.rouAssetAccountId,
        debit: Math.abs(gainLoss),
        credit: 0,
        description: `Lease modification – ROU asset adjustment (${lease.leaseNumber})`,
      });
    }
  }

  const je = await postToGL({
    orgId: lease.orgId,
    date: modDate,
    description: `Lease modification – ${lease.leaseNumber}: ${input.description}`,
    reference: `${lease.leaseNumber}-MOD`,
    source: 'lease',
    sourceId: leaseId,
    createdBy: userId,
    lines,
  });

  // Update lease record
  const endDate = input.newTermMonths
    ? new Date(modDate.getFullYear(), modDate.getMonth() + input.newTermMonths, modDate.getDate())
    : lease.endDate;

  await db.update(leases)
    .set({
      paymentAmount: newPaymentAmount,
      totalPayments: newTotalPayments,
      leaseTermMonths: input.newTermMonths ?? lease.leaseTermMonths,
      incrementalBorrowingRate: String(newRate),
      presentValue: newPvRemaining,
      rouAssetInitial: lease.rouAssetInitial + (gainLoss < 0 ? Math.abs(gainLoss) : -gainLoss),
      status: 'modified',
      endDate,
      updatedAt: new Date(),
    })
    .where(eq(leases.id, leaseId));

  // Remove old remaining schedules and regenerate
  for (const s of remainingSchedules) {
    await db.delete(leasePaymentSchedules).where(eq(leasePaymentSchedules.id, s.id));
  }

  // Generate new schedule from modification date
  const modifiedLease = { ...lease, paymentAmount: newPaymentAmount, presentValue: newPvRemaining, totalPayments: newTotalPayments, commencementDate: modDate.toISOString() };
  const newSchedule = generateAmortizationSchedule(modifiedLease, monthlyRate);

  const scheduleRows = newSchedule.map(s => ({
    leaseId,
    periodNumber: s.periodNumber,
    dueDate: s.dueDate,
    paymentAmount: s.paymentAmount,
    interestAmount: s.interestAmount,
    principalAmount: s.principalAmount,
    outstandingBalance: s.outstandingBalance,
    isPaid: false,
  }));

  await db.insert(leasePaymentSchedules).values(scheduleRows);

  await db.insert(leaseJournalEntries).values({
    leaseId,
    periodNumber: 0,
    journalEntryId: je.id,
    entryType: 'modification',
    description: `Lease modification JE: ${input.description}`,
  });

  return je;
}

export async function terminateLease(leaseId: string, terminationDate: string, userId: string, orgId?: string) {
  const lease = await getLease(leaseId, orgId);
  if (lease.status !== 'active' && lease.status !== 'modified') {
    throw new AppError('Only active or modified leases can be terminated', 400);
  }

  const termDate = new Date(terminationDate);

  // Calculate remaining net book value of ROU asset after depreciation up to termination date
  const deprMonthsElapsed = Math.max(0, Math.floor(
    (termDate.getTime() - new Date(lease.commencementDate).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
  ));
  const totalDeprMonths = lease.leaseTermMonths || 1;
  const accumulatedDepr = Math.round((lease.rouAssetInitial - (lease.residualValue || 0)) * Math.min(deprMonthsElapsed, totalDeprMonths) / totalDeprMonths);
  const netBookValue = lease.rouAssetInitial - accumulatedDepr;

  // Calculate remaining lease liability
  const remainingSchedules = lease.schedule.filter((s: any) => !s.isPaid);
  const remainingLiability = remainingSchedules.reduce((sum: number, s: any) => sum + s.outstandingBalance, 0);

  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];

  // DR Accumulated Depreciation (remove accumulated depreciation)
  if (lease.accumDepreciationAccountId && accumulatedDepr > 0) {
    lines.push({
      accountId: lease.accumDepreciationAccountId,
      debit: accumulatedDepr,
      credit: 0,
      description: `Derecognition of accumulated depreciation on termination (${lease.leaseNumber})`,
    });
  }

  // CR ROU Asset (remove ROU asset at initial cost)
  if (lease.rouAssetAccountId && lease.rouAssetInitial > 0) {
    lines.push({
      accountId: lease.rouAssetAccountId,
      debit: 0,
      credit: lease.rouAssetInitial,
      description: `Derecognition of ROU asset on termination (${lease.leaseNumber})`,
    });
  }

  // DR Lease Liability (remove remaining liability)
  if (lease.leaseLiabilityAccountId && remainingLiability > 0) {
    lines.push({
      accountId: lease.leaseLiabilityAccountId,
      debit: remainingLiability,
      credit: 0,
      description: `Derecognition of lease liability on termination (${lease.leaseNumber})`,
    });
  }

  // Gain/Loss balancing entry
  const balancing = lease.rouAssetInitial - accumulatedDepr - remainingLiability;
  if (balancing !== 0) {
    if (balancing > 0) {
      // Loss on termination
      lines.push({
        accountId: lease.depreciationExpenseAccountId,
        debit: balancing,
        credit: 0,
        description: `Loss on lease termination (${lease.leaseNumber})`,
      });
    } else {
      // Gain on termination
      lines.push({
        accountId: lease.depreciationExpenseAccountId,
        debit: 0,
        credit: Math.abs(balancing),
        description: `Gain on lease termination (${lease.leaseNumber})`,
      });
    }
  }

  const je = await postToGL({
    orgId: lease.orgId,
    date: termDate,
    description: `Lease termination – ${lease.leaseNumber}`,
    reference: `${lease.leaseNumber}-TERM`,
    source: 'lease',
    sourceId: leaseId,
    createdBy: userId,
    lines,
  });

  // Update lease status
  await db.update(leases)
    .set({
      status: 'terminated',
      updatedAt: new Date(),
    })
    .where(eq(leases.id, leaseId));

  // Mark all remaining schedules as paid
  for (const s of remainingSchedules) {
    await db.update(leasePaymentSchedules)
      .set({ isPaid: true, journalEntryId: je.id, updatedAt: new Date() })
      .where(eq(leasePaymentSchedules.id, s.id));
  }

  await db.insert(leaseJournalEntries).values({
    leaseId,
    periodNumber: 0,
    journalEntryId: je.id,
    entryType: 'termination',
    description: 'Lease termination JE',
  });

  return je;
}

export async function getLeaseReport(orgId: string) {
  const allLeases = await getLeases(orgId);

  const report = {
    totalLeases: allLeases.length,
    activeLeases: allLeases.filter(l => l.status === 'active' || l.status === 'modified').length,
    totalOutstandingLiability: 0,
    totalRouAssetValue: 0,
    monthlyPaymentTotal: 0,
    leases: [] as any[],
  };

  for (const lease of allLeases) {
    const detail = await getLease(lease.id);
    const unpaidSchedules = (detail.schedule || []).filter((s: any) => !s.isPaid);
    const outstandingLiability = unpaidSchedules.length > 0
      ? unpaidSchedules[0].outstandingBalance || 0
      : 0;

    report.totalOutstandingLiability += outstandingLiability;
    report.totalRouAssetValue += lease.rouAssetInitial;
    report.monthlyPaymentTotal += lease.paymentAmount;

    // Calculate remaining depreciation
    const deprPerMonth = calculateMonthlyDepreciation(lease);
    const monthsElapsed = Math.floor(
      (new Date().getTime() - new Date(lease.commencementDate).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
    );
    const accumulatedDepr = Math.min(monthsElapsed * deprPerMonth, lease.rouAssetInitial - (lease.residualValue || 0));
    const netBookValue = lease.rouAssetInitial - accumulatedDepr;

    report.leases.push({
      id: lease.id,
      leaseNumber: lease.leaseNumber,
      lessorName: lease.lessorName,
      assetCategory: lease.assetCategory,
      status: lease.status,
      commencementDate: lease.commencementDate,
      endDate: lease.endDate,
      paymentAmount: lease.paymentAmount,
      totalPayments: lease.totalPayments,
      presentValue: lease.presentValue,
      rouAssetInitial: lease.rouAssetInitial,
      netBookValue: Math.max(0, netBookValue),
      outstandingLiability,
      totalPaid: (detail.schedule || []).filter((s: any) => s.isPaid).reduce((sum: number, s: any) => sum + s.paymentAmount, 0),
      totalInterest: (detail.schedule || []).reduce((sum: number, s: any) => sum + s.interestAmount, 0),
      remainingSchedules: unpaidSchedules.length,
    });
  }

  return report;
}

export async function batchProcessPayments(leaseId: string, userId: string, upToPeriod?: number, orgId?: string) {
  const lease = await getLease(leaseId, orgId);
  const unpaid = (lease.schedule || []).filter((s: any) => !s.isPaid).sort((a: any, b: any) => a.periodNumber - b.periodNumber);
  const results: any[] = [];

  for (const s of unpaid) {
    if (upToPeriod && s.periodNumber > upToPeriod) break;
    const je = await processLeasePayment(leaseId, s.periodNumber, userId, undefined, orgId);
    results.push({ periodNumber: s.periodNumber, journalEntryId: je.id });
  }

  return results;
}

export async function batchPostDepreciation(leaseId: string, userId: string, upToPeriod?: number, orgId?: string) {
  const lease = await getLease(leaseId, orgId);
  const existingDepr = await db
    .select()
    .from(leaseJournalEntries)
    .where(and(
      eq(leaseJournalEntries.leaseId, leaseId),
      eq(leaseJournalEntries.entryType, 'depreciation')
    ));

  const postedPeriods = new Set(existingDepr.map(e => e.periodNumber));
  const schedule = (lease.schedule || []).sort((a: any, b: any) => a.periodNumber - b.periodNumber);
  const results: any[] = [];

  for (const s of schedule) {
    if (upToPeriod && s.periodNumber > upToPeriod) break;
    if (postedPeriods.has(s.periodNumber)) continue;
    const je = await postLeaseDepreciation(leaseId, s.periodNumber, userId);
    results.push({ periodNumber: s.periodNumber, journalEntryId: je.id });
  }

  return results;
}

function desc(col: any) {
  return sql`${col} DESC`;
}
