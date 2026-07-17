import { eq, and, sql, gte, lte, desc, sum } from 'drizzle-orm';
import { db, accounts, journalEntries, journalLines, payeSchedules, payeScheduleLines, employees, itfAssessments, stampDutyRecords, taxExemptions, firsReports, autoTaxJournals, organisations, taxComputations } from '../db/schema';
import { postToGL } from './posting.service';
import { createAuditLog } from './audit.service';
import { AppError } from '../lib/errors';

// ==============================
// NIGERIAN PAYE COMPUTATION
// ==============================

// Nigerian PAYE tax bands (annual) per FIRS 2024+
const PAYE_BANDS: { from: number; to: number; rate: number }[] = [
  { from: 0,           to: 300_000,     rate: 0.07 },
  { from: 300_001,     to: 600_000,     rate: 0.11 },
  { from: 600_001,     to: 1_100_000,   rate: 0.15 },
  { from: 1_100_001,   to: 1_600_000,   rate: 0.19 },
  { from: 1_600_001,   to: 3_200_000,   rate: 0.21 },
  { from: 3_200_001,   to: Infinity,    rate: 0.24 },
];

const CONSOLIDATED_RELIEF_RATE = 0.20; // 20% of gross
const CONSOLIDATED_RELIEF_FLAT = 200_000; // ₦200k annual (≈₦16,667/mo)
const CONSOLIDATED_RELIEF_ONE_PERCENT = 0.01; // 1% of gross

export function computePaye(annualGrossInKobo: number): number {
  const annualGross = annualGrossInKobo;
  if (annualGross <= 0) return 0;

  // Consolidated relief: higher of 1% of gross or ₦200k + 20% of gross
  const pctOfGross = Math.round(annualGross * CONSOLIDATED_RELIEF_ONE_PERCENT);
  const flatPlusPct = Math.round(annualGross * CONSOLIDATED_RELIEF_RATE) + CONSOLIDATED_RELIEF_FLAT;
  const consolidatedRelief = Math.max(pctOfGross, flatPlusPct);

  const taxableIncome = Math.max(0, annualGross - consolidatedRelief);
  if (taxableIncome <= 0) return 0;

  let tax = 0;
  let remaining = taxableIncome;
  for (const band of PAYE_BANDS) {
    if (remaining <= 0) break;
    const bandWidth = band.to === Infinity ? remaining : band.to - band.from + 1;
    const taxableInBand = Math.min(remaining, bandWidth);
    tax += Math.round(taxableInBand * band.rate);
    remaining -= taxableInBand;
  }
  return tax;
}

export function computePayeMonthly(grossMonthlyKobo: number): { grossPay: number; consolidatedRelief: number; taxablePay: number; paye: number } {
  const annualGross = grossMonthlyKobo * 12;
  const annualPaye = computePaye(annualGross);
  const annualRelief = Math.max(
    Math.round(annualGross * CONSOLIDATED_RELIEF_ONE_PERCENT),
    Math.round(annualGross * CONSOLIDATED_RELIEF_RATE) + CONSOLIDATED_RELIEF_FLAT
  );
  const annualTaxable = Math.max(0, annualGross - annualRelief);
  return {
    grossPay: grossMonthlyKobo,
    consolidatedRelief: Math.round(annualRelief / 12),
    taxablePay: Math.round(annualTaxable / 12),
    paye: Math.round(annualPaye / 12),
  };
}

// ==============================
// NHF / NSITF COMPUTATION
// ==============================

export function computeNhf(basicSalaryKobo: number): number {
  return Math.round(basicSalaryKobo * 0.025); // 2.5% of basic
}

export function computeNsitf(basicSalaryKobo: number): number {
  return Math.round(basicSalaryKobo * 0.01); // 1% of basic (employer)
}

// ==============================
// ITF COMPUTATION
// ==============================

export function computeItf(totalAnnualPayrollKobo: number): number {
  return Math.round(totalAnnualPayrollKobo * 0.01); // 1% of annual payroll
}

// ==============================
// STAMP DUTY
// ==============================

export function computeStampDuty(grossAmountKobo: number): number {
  // ₦50 fixed for receipts ≥ ₦10,000 (500000 kobo)
  const THRESHOLD_KOBO = 500_000; // ₦5,000
  if (grossAmountKobo < THRESHOLD_KOBO) return 0;
  return 5_000; // ₦50 in kobo
}

// ==============================
// PAYE SCHEDULE SERVICE
// ==============================

export async function createPayeSchedule(
  orgId: string,
  userId: string,
  data: {
    periodStart: string;
    periodEnd: string;
    payrollRunId?: string;
    entries: { employeeId: string; grossPay: number; basicSalary?: number }[];
  },
  reqMeta?: any
): Promise<any> {
  const periodLabel = `${new Date(data.periodStart).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;

  const scheduleLines = data.entries.map(e => {
    const monthly = computePayeMonthly(e.grossPay);
    const basic = e.basicSalary || e.grossPay;
    return {
      employeeId: e.employeeId,
      grossPay: e.grossPay,
      consolidatedRelief: monthly.consolidatedRelief,
      taxablePay: monthly.taxablePay,
      paye: monthly.paye,
      nhf: computeNhf(basic),
      nsitf: computeNsitf(basic),
    };
  });

  const totals = scheduleLines.reduce(
    (acc, l) => ({
      totalGrossPay: acc.totalGrossPay + l.grossPay,
      totalTaxablePay: acc.totalTaxablePay + l.taxablePay,
      totalPaye: acc.totalPaye + l.paye,
      totalNhf: acc.totalNhf + l.nhf,
      totalNsitf: acc.totalNsitf + l.nsitf,
    }),
    { totalGrossPay: 0, totalTaxablePay: 0, totalPaye: 0, totalNhf: 0, totalNsitf: 0 }
  );

  const [schedule] = await db.insert(payeSchedules).values({
    orgId,
    payrollRunId: data.payrollRunId || null,
    periodStart: new Date(data.periodStart),
    periodEnd: new Date(data.periodEnd),
    periodLabel,
    totalGrossPay: totals.totalGrossPay,
    totalTaxablePay: totals.totalTaxablePay,
    totalPaye: totals.totalPaye,
    totalNhf: totals.totalNhf,
    totalNsitf: totals.totalNsitf,
    status: 'computed',
  }).returning();

  if (scheduleLines.length > 0) {
    await db.insert(payeScheduleLines).values(
      scheduleLines.map(l => ({ ...l, payeScheduleId: schedule.id }))
    );
  }

  return schedule;
}

export async function getPayeSchedules(orgId: string): Promise<any[]> {
  return db.select().from(payeSchedules).where(eq(payeSchedules.orgId, orgId)).orderBy(desc(payeSchedules.createdAt));
}

export async function getPayeScheduleLines(scheduleId: string): Promise<any[]> {
  return db.select().from(payeScheduleLines).where(eq(payeScheduleLines.payeScheduleId, scheduleId));
}

export async function postPayeJournal(
  orgId: string,
  userId: string,
  scheduleId: string,
  data: { date: string; bankAccountId?: string },
  reqMeta?: any
): Promise<any> {
  const [schedule] = await db.select().from(payeSchedules).where(and(eq(payeSchedules.id, scheduleId), eq(payeSchedules.orgId, orgId))).limit(1);
  if (!schedule) throw new AppError('Schedule not found.', 404);
  if (schedule.status !== 'computed') throw new AppError('Schedule must be in computed status.', 400);

  const getAcct = async (code: string) => {
    const [a] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, code))).limit(1);
    return a;
  };

  const acctPayePayable = await getAcct('301501');
  const acctNhfPayable = await getAcct('306000');
  const acctNsitfPayable = await getAcct('306100');
  const acctSalariesExpense = await getAcct('810100');

  const lines: any[] = [];

  // Reverse salary expense entry for PAYE/NHF/NSITF portions and credit payables
  if (schedule.totalPaye > 0 && acctPayePayable) {
    lines.push({ accountId: acctSalariesExpense!.id, debit: schedule.totalPaye, description: 'PAYE deduction' });
    lines.push({ accountId: acctPayePayable!.id, credit: schedule.totalPaye, description: 'PAYE payable' });
  }
  if (schedule.totalNhf > 0 && acctNhfPayable) {
    lines.push({ accountId: acctSalariesExpense!.id, debit: schedule.totalNhf, description: 'NHF deduction' });
    lines.push({ accountId: acctNhfPayable!.id, credit: schedule.totalNhf, description: 'NHF payable' });
  }
  if (schedule.totalNsitf > 0 && acctNsitfPayable) {
    lines.push({ accountId: acctSalariesExpense!.id, debit: schedule.totalNsitf, description: 'NSITF employer contribution' });
    lines.push({ accountId: acctNsitfPayable!.id, credit: schedule.totalNsitf, description: 'NSITF payable' });
  }

  const totalDr = lines.reduce((s: number, l: any) => s + (l.debit || 0), 0);
  const totalCr = lines.reduce((s: number, l: any) => s + (l.credit || 0), 0);
  if (totalDr !== totalCr) throw new AppError('Journal lines unbalanced.', 400);
  if (totalDr === 0) throw new AppError('No tax obligations to post.', 400);

  const je = await postToGL({
    orgId,
    date: new Date(data.date),
    description: `PAYE/NHF/NSITF — ${schedule.periodLabel}`,
    reference: `PAYE-${schedule.periodLabel.replace(/[^a-zA-Z0-9]/g, '')}-${scheduleId.slice(0, 8)}`,
    source: 'tax_provision' as any,
    sourceId: scheduleId,
    createdBy: userId,
    lines,
  });

  await db.update(payeSchedules).set({ status: 'posted', journalEntryId: je.id, updatedAt: new Date() }).where(eq(payeSchedules.id, scheduleId));

  await createAuditLog({ orgId, userId, action: 'post', entityType: 'paye-schedule', entityId: scheduleId, newValues: { journalEntryId: je.id }, ...(reqMeta || {}) });

  return { schedule: { ...schedule, status: 'posted', journalEntryId: je.id }, journalEntry: je };
}

// ==============================
// ITF ASSESSMENT SERVICE
// ==============================

export async function createItfAssessment(
  orgId: string,
  userId: string,
  data: { assessmentYear: string; totalPayroll: number },
  reqMeta?: any
): Promise<any> {
  const amount = computeItf(data.totalPayroll);
  const [existing] = await db.select().from(itfAssessments).where(and(eq(itfAssessments.orgId, orgId), eq(itfAssessments.assessmentYear, data.assessmentYear))).limit(1);
  if (existing) throw new AppError('ITF assessment already exists for this year.', 400);

  const [assessment] = await db.insert(itfAssessments).values({
    orgId,
    assessmentYear: data.assessmentYear,
    totalPayroll: data.totalPayroll,
    contributionRate: '0.01',
    contributionAmount: amount,
    paidAmount: 0,
    status: 'pending',
  }).returning();

  return assessment;
}

export async function getItfAssessments(orgId: string): Promise<any[]> {
  return db.select().from(itfAssessments).where(eq(itfAssessments.orgId, orgId)).orderBy(desc(itfAssessments.createdAt));
}

export async function postItfJournal(
  orgId: string,
  userId: string,
  assessmentId: string,
  data: { date: string },
  reqMeta?: any
): Promise<any> {
  const [assessment] = await db.select().from(itfAssessments).where(and(eq(itfAssessments.id, assessmentId), eq(itfAssessments.orgId, orgId))).limit(1);
  if (!assessment) throw new AppError('Assessment not found.', 404);
  if (assessment.status !== 'pending') throw new AppError('Assessment already processed.', 400);

  const getAcct = async (code: string) => {
    const [a] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, code))).limit(1);
    return a;
  };

  const acctItfExpense = await getAcct('950700');
  const acctItfPayable = await getAcct('306200');

  if (!acctItfExpense || !acctItfPayable) throw new AppError('ITF accounts not configured. Ensure 950700 and 306200 exist.', 500);

  const je = await postToGL({
    orgId,
    date: new Date(data.date),
    description: `ITF Contribution — ${assessment.assessmentYear}`,
    reference: `ITF-${assessment.assessmentYear}`,
    source: 'tax_provision' as any,
    sourceId: assessmentId,
    createdBy: userId,
    lines: [
      { accountId: acctItfExpense.id, debit: assessment.contributionAmount, description: 'ITF contribution expense' },
      { accountId: acctItfPayable.id, credit: assessment.contributionAmount, description: 'ITF contribution payable' },
    ],
  });

  await db.update(itfAssessments).set({ status: 'paid', paidAt: new Date(), journalEntryId: je.id, updatedAt: new Date() }).where(eq(itfAssessments.id, assessmentId));

  return { assessment: { ...assessment, status: 'paid', journalEntryId: je.id }, journalEntry: je };
}

// ==============================
// STAMP DUTY SERVICE
// ==============================

export async function recordStampDuty(
  orgId: string,
  userId: string,
  data: {
    transactionType: string;
    referenceType?: string;
    referenceId?: string;
    grossAmount: number;
    date: string;
  },
  reqMeta?: any
): Promise<any> {
  const amount = computeStampDuty(data.grossAmount);
  if (amount <= 0) return null;

  const getAcct = async (code: string) => {
    const [a] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, code))).limit(1);
    return a;
  };

  const acctStampDutyExpense = await getAcct('950800');
  const acctStampDutyPayable = await getAcct('306300');

  if (!acctStampDutyExpense || !acctStampDutyPayable) throw new AppError('Stamp duty accounts not configured. Ensure 950800 and 306300 exist.', 500);

  const je = await postToGL({
    orgId,
    date: new Date(data.date),
    description: `Stamp Duty — ${data.transactionType}`,
    source: 'tax_provision' as any,
    createdBy: userId,
    lines: [
      { accountId: acctStampDutyExpense.id, debit: amount, description: 'Stamp duty charge' },
      { accountId: acctStampDutyPayable.id, credit: amount, description: 'Stamp duty payable' },
    ],
  });

  const [record] = await db.insert(stampDutyRecords).values({
    orgId,
    transactionType: data.transactionType,
    referenceType: data.referenceType || null,
    referenceId: data.referenceId || null,
    grossAmount: data.grossAmount,
    stampDutyAmount: amount,
    journalEntryId: je.id,
  }).returning();

  return record;
}

export async function getStampDutyRecords(orgId: string, params?: { fromDate?: string; toDate?: string }): Promise<any[]> {
  const conditions = [eq(stampDutyRecords.orgId, orgId)];
  if (params?.fromDate) conditions.push(gte(stampDutyRecords.createdAt, new Date(params.fromDate)));
  if (params?.toDate) conditions.push(lte(stampDutyRecords.createdAt, new Date(params.toDate)));
  return db.select().from(stampDutyRecords).where(and(...conditions)).orderBy(desc(stampDutyRecords.createdAt));
}

export async function getStampDutySummary(orgId: string, fromDate?: string, toDate?: string): Promise<{ totalRecords: number; totalStampDuty: number }> {
  const conditions = [eq(stampDutyRecords.orgId, orgId)];
  if (fromDate) conditions.push(gte(stampDutyRecords.createdAt, new Date(fromDate)));
  if (toDate) conditions.push(lte(stampDutyRecords.createdAt, new Date(toDate)));
  const [result] = await db.select({
    totalRecords: sql<number>`count(*)`,
    totalStampDuty: sql<number>`coalesce(sum(${stampDutyRecords.stampDutyAmount}), 0)`,
  }).from(stampDutyRecords).where(and(...conditions));
  return { totalRecords: Number(result?.totalRecords || 0), totalStampDuty: Number(result?.totalStampDuty || 0) };
}

// ==============================
// TAX EXEMPTION SERVICE
// ==============================

export async function createTaxExemption(
  orgId: string,
  userId: string,
  data: {
    taxType: string;
    exemptionType: string;
    referenceNumber?: string;
    startDate: string;
    endDate?: string;
    certificateUrl?: string;
    description?: string;
  },
  reqMeta?: any
): Promise<any> {
  const [exemption] = await db.insert(taxExemptions).values({
    orgId,
    taxType: data.taxType as any,
    exemptionType: data.exemptionType,
    referenceNumber: data.referenceNumber || null,
    startDate: new Date(data.startDate),
    endDate: data.endDate ? new Date(data.endDate) : null,
    certificateUrl: data.certificateUrl || null,
    description: data.description || null,
    createdBy: userId,
    status: 'active',
  }).returning();

  return exemption;
}

export async function getTaxExemptions(orgId: string, params?: { taxType?: string; status?: string }): Promise<any[]> {
  const conditions = [eq(taxExemptions.orgId, orgId)];
  if (params?.taxType) conditions.push(eq(taxExemptions.taxType, params.taxType as any));
  if (params?.status) conditions.push(eq(taxExemptions.status, params.status as any));
  return db.select().from(taxExemptions).where(and(...conditions)).orderBy(desc(taxExemptions.createdAt));
}

export async function updateTaxExemptionStatus(id: string, orgId: string, status: 'active' | 'expired' | 'revoked', reqMeta?: any): Promise<any> {
  const [result] = await db.update(taxExemptions).set({ status, updatedAt: new Date() }).where(and(eq(taxExemptions.id, id), eq(taxExemptions.orgId, orgId))).returning();
  return result;
}

// ==============================
// FIRS REPORTS SERVICE
// ==============================

export async function generateFirsReport(
  orgId: string,
  userId: string,
  data: {
    reportType: string;
    periodStart: string;
    periodEnd: string;
    taxYear?: string;
  },
  reqMeta?: any
): Promise<any> {
  const periodStart = new Date(data.periodStart);
  const periodEnd = new Date(data.periodEnd);
  const periodLabel = `${periodStart.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} – ${periodEnd.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;

  let totalLiability = 0;
  const metadata: any = { reportType: data.reportType };

  if (data.reportType === 'vat') {
    const [outputVatAcct] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'vat_payable'))).limit(1);
    const [inputVatAcct] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'vat_receivable'))).limit(1);
    if (outputVatAcct && inputVatAcct) {
      const [output] = await db.select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}) - sum(${journalLines.debitAmount}), 0)` }).from(journalLines).innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id)).where(and(eq(journalLines.accountId, outputVatAcct.id), eq(journalEntries.orgId, orgId), gte(journalEntries.date, periodStart), lte(journalEntries.date, periodEnd), sql`${journalEntries.status} NOT IN ('draft','pending_review','cancelled','reversed')`));
      const [input] = await db.select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}) - sum(${journalLines.creditAmount}), 0)` }).from(journalLines).innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id)).where(and(eq(journalLines.accountId, inputVatAcct.id), eq(journalEntries.orgId, orgId), gte(journalEntries.date, periodStart), lte(journalEntries.date, periodEnd), sql`${journalEntries.status} NOT IN ('draft','pending_review','cancelled','reversed')`));
      const outputVat = Number(output?.total || 0);
      const inputVat = Number(input?.total || 0);
      totalLiability = Math.max(0, outputVat - inputVat);
      metadata.outputVat = outputVat;
      metadata.inputVat = inputVat;
    }
  } else if (data.reportType === 'wht') {
    const [whtPayable] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'wht_payable'))).limit(1);
    const [whtReceivable] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'wht_receivable'))).limit(1);
    if (whtPayable) {
      const [collected] = await db.select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}) - sum(${journalLines.debitAmount}), 0)` }).from(journalLines).innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id)).where(and(eq(journalLines.accountId, whtPayable.id), eq(journalEntries.orgId, orgId), gte(journalEntries.date, periodStart), lte(journalEntries.date, periodEnd), sql`${journalEntries.status} NOT IN ('draft','pending_review','cancelled','reversed')`));
      totalLiability = Number(collected?.total || 0);
    }
    if (whtReceivable) {
      const [deducted] = await db.select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}) - sum(${journalLines.creditAmount}), 0)` }).from(journalLines).innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id)).where(and(eq(journalLines.accountId, whtReceivable.id), eq(journalEntries.orgId, orgId), gte(journalEntries.date, periodStart), lte(journalEntries.date, periodEnd), sql`${journalEntries.status} NOT IN ('draft','pending_review','cancelled','reversed')`));
      metadata.whtDeducted = Number(deducted?.total || 0);
    }
  } else if (data.reportType === 'paye') {
    const schedules = await db.select().from(payeSchedules).where(and(eq(payeSchedules.orgId, orgId), gte(payeSchedules.periodStart, periodStart), lte(payeSchedules.periodEnd, periodEnd)));
    totalLiability = schedules.reduce((s, sch) => s + sch.totalPaye, 0);
    metadata.totalNhf = schedules.reduce((s, sch) => s + sch.totalNhf, 0);
    metadata.totalNsitf = schedules.reduce((s, sch) => s + sch.totalNsitf, 0);
    metadata.scheduleCount = schedules.length;
  } else if (data.reportType === 'cit') {
    const [taxComp] = await db.select().from(taxComputations).where(and(
      eq(taxComputations.orgId, orgId), eq(taxComputations.taxYear, data.taxYear || new Date().getFullYear().toString())
    )).orderBy(desc(taxComputations.createdAt)).limit(1);
    if (taxComp) {
      totalLiability = taxComp.netCitPayable + taxComp.edtPayable;
      metadata.citPayable = taxComp.citPayable;
      metadata.edtPayable = taxComp.edtPayable;
      metadata.netCitPayable = taxComp.netCitPayable;
      metadata.cgtPayable = taxComp.cgtPayable;
      metadata.nitdaLevy = taxComp.nitdaLevy;
    }
  } else if (data.reportType === 'itf') {
    const assessments = await db.select().from(itfAssessments).where(and(eq(itfAssessments.orgId, orgId), eq(itfAssessments.assessmentYear, data.taxYear || new Date().getFullYear().toString())));
    totalLiability = assessments.reduce((s, a) => s + (a.contributionAmount - a.paidAmount), 0);
    metadata.assessments = assessments;
  } else if (data.reportType === 'consolidated') {
    // Generate all sub-reports and aggregate
    const vatReport = await generateFirsReport(orgId, userId, { ...data, reportType: 'vat' });
    const whtReport = await generateFirsReport(orgId, userId, { ...data, reportType: 'wht' });
    const payeReport = await generateFirsReport(orgId, userId, { ...data, reportType: 'paye' });
    const citReport = data.taxYear ? await generateFirsReport(orgId, userId, { ...data, reportType: 'cit' }) : null;
    totalLiability = (vatReport.totalLiability || 0) + (whtReport.totalLiability || 0) + (payeReport.totalLiability || 0) + (citReport?.totalLiability || 0);
    metadata.subReports = { vat: vatReport, wht: whtReport, paye: payeReport, cit: citReport };
  }

  const [report] = await db.insert(firsReports).values({
    orgId,
    reportType: data.reportType as any,
    periodStart,
    periodEnd,
    periodLabel,
    taxYear: data.taxYear || null,
    totalLiability,
    totalPaid: 0,
    balanceDue: totalLiability,
    metadata,
    status: 'draft',
    filedBy: userId,
  }).returning();

  return report;
}

export async function getFirsReports(orgId: string, params?: { reportType?: string }): Promise<any[]> {
  const conditions = [eq(firsReports.orgId, orgId)];
  if (params?.reportType) conditions.push(eq(firsReports.reportType, params.reportType as any));
  return db.select().from(firsReports).where(and(...conditions)).orderBy(desc(firsReports.createdAt));
}

export async function fileFirsReport(reportId: string, orgId: string, userId: string, reqMeta?: any): Promise<any> {
  const [result] = await db.update(firsReports).set({ status: 'filed', filedAt: new Date(), filedBy: userId, updatedAt: new Date() }).where(and(eq(firsReports.id, reportId), eq(firsReports.orgId, orgId))).returning();
  return result;
}

// ==============================
// AUTO TAX JOURNAL SERVICE
// ==============================

export async function recordAutoTaxJournal(
  orgId: string,
  data: {
    taxType: string;
    periodStart: string;
    periodEnd: string;
    referenceType?: string;
    referenceId?: string;
    journalEntryId: string;
    amount: number;
    description?: string;
  }
): Promise<any> {
  const [record] = await db.insert(autoTaxJournals).values({
    orgId,
    taxType: data.taxType as any,
    periodStart: new Date(data.periodStart),
    periodEnd: new Date(data.periodEnd),
    referenceType: data.referenceType || null,
    referenceId: data.referenceId || null,
    journalEntryId: data.journalEntryId,
    amount: data.amount,
    description: data.description || null,
  }).returning();
  return record;
}

export async function getAutoTaxJournals(orgId: string, params?: { taxType?: string; fromDate?: string; toDate?: string }): Promise<any[]> {
  const conditions = [eq(autoTaxJournals.orgId, orgId)];
  if (params?.taxType) conditions.push(eq(autoTaxJournals.taxType, params.taxType as any));
  if (params?.fromDate) conditions.push(gte(autoTaxJournals.createdAt, new Date(params.fromDate)));
  if (params?.toDate) conditions.push(lte(autoTaxJournals.createdAt, new Date(params.toDate)));
  return db.select().from(autoTaxJournals).where(and(...conditions)).orderBy(desc(autoTaxJournals.createdAt));
}

// ==============================
// TAX DASHBOARD SUMMARY
// ==============================

export async function getTaxDashboardSummary(orgId: string): Promise<any> {
  // VAT position
  const [outputVatAcct] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'vat_payable'))).limit(1);
  const [inputVatAcct] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'vat_receivable'))).limit(1);
  let totalOutputVat = 0;
  let totalInputVat = 0;
  if (outputVatAcct) {
    const [r] = await db.select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}) - sum(${journalLines.debitAmount}), 0)` }).from(journalLines).innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id)).where(and(eq(journalLines.accountId, outputVatAcct.id), eq(journalEntries.orgId, orgId), sql`${journalEntries.status} NOT IN ('draft','pending_review','cancelled','reversed')`));
    totalOutputVat = Number(r?.total || 0);
  }
  if (inputVatAcct) {
    const [r] = await db.select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}) - sum(${journalLines.creditAmount}), 0)` }).from(journalLines).innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id)).where(and(eq(journalLines.accountId, inputVatAcct.id), eq(journalEntries.orgId, orgId), sql`${journalEntries.status} NOT IN ('draft','pending_review','cancelled','reversed')`));
    totalInputVat = Number(r?.total || 0);
  }

  // WHT position
  const [whtPayableAcct] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'wht_payable'))).limit(1);
  const [whtReceivableAcct] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'wht_receivable'))).limit(1);
  let totalWhtCollected = 0;
  let totalWhtDeducted = 0;
  if (whtPayableAcct) {
    const [r] = await db.select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}) - sum(${journalLines.debitAmount}), 0)` }).from(journalLines).innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id)).where(and(eq(journalLines.accountId, whtPayableAcct.id), eq(journalEntries.orgId, orgId), sql`${journalEntries.status} NOT IN ('draft','pending_review','cancelled','reversed')`));
    totalWhtCollected = Number(r?.total || 0);
  }
  if (whtReceivableAcct) {
    const [r] = await db.select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}) - sum(${journalLines.creditAmount}), 0)` }).from(journalLines).innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id)).where(and(eq(journalLines.accountId, whtReceivableAcct.id), eq(journalEntries.orgId, orgId), sql`${journalEntries.status} NOT IN ('draft','pending_review','cancelled','reversed')`));
    totalWhtDeducted = Number(r?.total || 0);
  }

  // Unpaid PAYE schedules
  const payeScheds = await db.select().from(payeSchedules).where(and(eq(payeSchedules.orgId, orgId), eq(payeSchedules.status, 'computed')));
  const pendingPaye = payeScheds.reduce((s, p) => s + p.totalPaye, 0);

  // Latest CIT computation
  const [latestCIT] = await db.select().from(taxComputations).where(eq(taxComputations.orgId, orgId)).orderBy(desc(taxComputations.createdAt)).limit(1);

  return {
    vat: { outputVat: totalOutputVat, inputVat: totalInputVat, netVatPayable: Math.max(0, totalOutputVat - totalInputVat) },
    wht: { collected: totalWhtCollected, deducted: totalWhtDeducted, netWhtPayable: Math.max(0, totalWhtCollected - totalWhtDeducted) },
    paye: { pendingPaye, scheduleCount: payeScheds.length },
    cit: latestCIT ? { netCitPayable: latestCIT.netCitPayable, totalTaxExpense: latestCIT.totalTaxExpense, taxYear: latestCIT.taxYear, status: latestCIT.status } : null,
  };
}
