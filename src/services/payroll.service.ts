/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import {
  db,
  employees,
  payrollRuns,
  payrollLines,
  accounts
} from '../db/schema';
import { AppError } from '../lib/errors';
import { createJournalEntry } from './ledger.service';

export interface TaxBandBreakdown {
  bandName: string;
  taxableAmountInBand: number; // in kobo
  rate: number;                // decimal e.g. 0.15, 0.18 etc.
  taxAmountInBand: number;     // in kobo
}

export interface PayrollCalculation {
  employeeId: string;
  grossPay: number;               // in kobo (= grossSalary)
  basicSalary: number;            // in kobo (Basic = Gross × PensionablePortionPct)

  // Statutory Deductions
  pensionEE: number;              // in kobo (Pension Rate % × Pensionable Portion % × Gross)
  nhis: number;                   // in kobo (5% of Basic, if applicable)
  nhf: number;                    // in kobo (2.5% of Basic, if applicable)
  monthlyPAYE: number;            // in kobo
  pensionEmployer: number;        // in kobo (10% of pensionable — accounting only)

  // Tax Computation
  annualGross: number;            // in kobo
  annualPension: number;          // in kobo
  annualNHIS: number;             // in kobo
  annualNHF: number;              // in kobo
  rentRelief: number;             // in kobo
  mortgageInterestRelief: number; // in kobo
  lifeAssuranceRelief: number;    // in kobo
  chargeableIncome: number;       // in kobo
  annualPAYE: number;             // in kobo
  effectiveRatePct: number;       // percentage (e.g. 6.35)
  bandBreakdown: TaxBandBreakdown[];

  // Internal Deductions
  internalDeductions: { description: string; amount: number }[];
  internalDeductionsTotal: number; // in kobo

  // Net Pay
  netPay: number;                 // in kobo

  // Legacy fields (for payroll_lines table compatibility)
  basic: number;
  housing: number;
  transport: number;
  otherAllowances: number;
  pensionEmployee: number;
  paye: number;
  otherDeductions: number;
  cra: number;
  pensionableEarnings: number;
  breakdown: TaxBandBreakdown[];
  effectiveTaxRate: number;
}

// =========================================================================
// 1. CORE PAYROLL CALCULATION FOR NIGERIAN PARADIGM
// =========================================================================

/**
 * Calculates Nigerian payroll parameters for a single employee based on monthly gross salary,
 * using the Nigeria Tax Act 2025 (effective 1 January 2026) rates.
 * All inputs and outputs must be computed and returned in kobo integers (100 kobo = NGN 1).
 * 
 * 1. SALARY STRUCTURE (Gross Salary):
 *    - Basic: 40% of Gross
 *    - Housing: 20% of Gross
 *    - Transport: 10% of Gross
 *    - Other Allowances: 30% of Gross (calculated as remainder to avoid rounding leaks)
 * 
 * 2. PENSION (PRA 2004 as amended):
 *    - Pensionable Earnings: Basic + Housing + Transport, capped at NGN 300,000/month (30,000,000 kobo).
 *    - Employee Contribution: 8% of Pensionable Earnings.
 *    - Employer Contribution: 10% of Pensionable Earnings.
 * 
 * 3. NHF (National Housing Fund):
 *    - Employee Contribution: 2.5% of Basic salary.
 * 
 * 4. PAYE (Nigeria Tax Act 2025, effective 2026):
 *    - Annualized Gross = Monthly Gross Pay * 12
 *    - Annualized Employee Pension = Employee Pension * 12
 *    - Annualized NHF = NHF * 12
 *    - The old CRA (Consolidated Relief Allowance) has been REMOVED.
 *    - Rent Relief: 20% of annual rent paid, max ₦500,000 (default ₦0 if not provided)
 *    - Tax-Free Threshold: First ₦800,000 of chargeable income @ 0%
 *    - Chargeable Income = Annualized Gross - Annualized Employee Pension - Annualized NHF - Rent Relief
 *    - Progressive Tax Bands (Annual Chargeable Income):
 *        - First ₦800,000:      0%
 *        - Next ₦2,200,000:    15%
 *        - Next ₦9,000,000:    18%
 *        - Next ₦13,000,000:   21%
 *        - Next ₦25,000,000:   23%
 *        - Above ₦50,000,000:  25%
 *    - Minimum tax rule (1% of gross) no longer applies — replaced by the 0% band.
 *    - Monthly PAYE = Annual PAYE / 12
 * 
 * @param employee Selected active employee record
 * @returns Comprehensive calculated payroll line breakdown
 */
export function calculatePayrollForEmployee(employee: any, payPeriod?: { start?: Date | string; end?: Date | string }): PayrollCalculation {
  const grossPay = Number(employee.grossSalary || 0); // in kobo

  // Read employee payroll parameters with sensible defaults
  const pensionablePortionPct = Math.max(1, Math.min(100, Number(employee.pensionablePortionPct || 80))) / 100;
  const pensionRatePct = Math.max(0, Math.min(30, Number(employee.pensionRatePct || 8))) / 100;
  const nhisApplicable = employee.nhisApplicable === true;
  const nhfApplicable = employee.nhfApplicable !== false;
  const annualRentKobo = Number(employee.annualRent || 0);
  const annualMortgageInterestKobo = Number(employee.annualMortgageInterest || 0);
  const annualLifeAssuranceKobo = Number(employee.annualLifeAssurance || 0);
  const internalDeductionsList: { description: string; amount: number }[] =
    Array.isArray(employee.internalDeductions) ? employee.internalDeductions : [];

  // Step 1: Basic Salary = Gross × Pensionable Portion %
  const basicSalary = Math.round(grossPay * pensionablePortionPct);

  // Step 2: Monthly Statutory Deductions
  // Pension (EE) = Pension Rate % × Pensionable Portion % × Gross
  const pensionEE = Math.round(grossPay * pensionablePortionPct * pensionRatePct);
  // Employer pension = 10% of pensionable (standard Nigerian practice)
  const pensionEmployer = Math.round(grossPay * pensionablePortionPct * 0.10);
  // NHIS = 5% × Basic (if applicable)
  const nhis = nhisApplicable ? Math.round(basicSalary * 0.05) : 0;
  // NHF = 2.5% × Basic (if applicable)
  const nhf = nhfApplicable ? Math.round(basicSalary * 0.025) : 0;

  // Step 3: Annualise
  const annualGross = grossPay * 12;
  const annualPension = pensionEE * 12;
  const annualNHIS = nhis * 12;
  const annualNHF = nhf * 12;

  // Step 4: Rent Relief
  // 20% of annual rent paid, max ₦500,000
  // If no rent figure provided, assume 20% of (20% of Annual Gross), capped at ₦500k
  let rentRelief: number;
  if (annualRentKobo > 0) {
    rentRelief = Math.min(Math.round(annualRentKobo * 0.20), 500000 * 100);
  } else {
    rentRelief = Math.min(Math.round(annualGross * 0.20 * 0.20), 500000 * 100);
  }

  // Mortgage Interest Relief (capped at annual gross per validation rule)
  const mortgageInterestRelief = Math.min(annualMortgageInterestKobo, annualGross);
  // Life Assurance Relief (capped at annual gross per validation rule)
  const lifeAssuranceRelief = Math.min(annualLifeAssuranceKobo, annualGross);

  // Step 4 cont: Chargeable Income
  const chargeableIncome = Math.max(0, annualGross - annualPension - annualNHIS - annualNHF - rentRelief - mortgageInterestRelief - lifeAssuranceRelief);

  // Step 5: Progressive Tax Bands
  const bands = [
    { name: 'First ₦800,000 @ 0%', limit: 800000 * 100, rate: 0.00 },
    { name: 'Next ₦2,200,000 @ 15%', limit: 2200000 * 100, rate: 0.15 },
    { name: 'Next ₦9,000,000 @ 18%', limit: 9000000 * 100, rate: 0.18 },
    { name: 'Next ₦13,000,000 @ 21%', limit: 13000000 * 100, rate: 0.21 },
    { name: 'Next ₦25,000,000 @ 23%', limit: 25000000 * 100, rate: 0.23 },
    { name: 'Above ₦50,000,000 @ 25%', limit: Infinity, rate: 0.25 }
  ];

  let remainingChargeable = chargeableIncome;
  let annualPAYE = 0;
  const breakdown: TaxBandBreakdown[] = [];

  for (const band of bands) {
    if (remainingChargeable <= 0) break;
    const taxableInBand = Math.min(remainingChargeable, band.limit);
    const taxInBand = Math.round(taxableInBand * band.rate);
    annualPAYE += taxInBand;
    remainingChargeable -= taxableInBand;
    breakdown.push({
      bandName: band.name,
      taxableAmountInBand: taxableInBand,
      rate: band.rate,
      taxAmountInBand: taxInBand
    });
  }

  const monthlyPAYE = Math.round(annualPAYE / 12);
  const internalDeductionsTotal = internalDeductionsList.reduce((sum, d) => sum + Math.round(d.amount), 0);

  // Net Pay = Gross - Pension (EE) - NHIS - NHF - Monthly PAYE - Internal Deductions
  const netPay = Math.max(0, grossPay - pensionEE - nhis - nhf - monthlyPAYE - internalDeductionsTotal);

  const effectiveRatePct = annualGross > 0 ? Number((annualPAYE / annualGross * 100).toFixed(2)) : 0;

  // Legacy backward-compat fields
  const basic = basicSalary;
  const housing = 0;
  const transport = 0;
  const otherAllowances = Math.max(0, grossPay - basicSalary);
  const pensionEmployee = pensionEE;
  const paye = monthlyPAYE;
  const otherDeductions = nhis + internalDeductionsTotal;
  const cra = rentRelief;
  const pensionableEarnings = Math.round(grossPay * pensionablePortionPct);
  const effectiveTaxRate = grossPay > 0 ? Number((monthlyPAYE / grossPay).toFixed(4)) : 0;

  return {
    employeeId: employee.id,
    grossPay,
    basicSalary,

    // Statutory
    pensionEE,
    nhis,
    nhf,
    monthlyPAYE,
    pensionEmployer,

    // Tax
    annualGross,
    annualPension,
    annualNHIS,
    annualNHF,
    rentRelief,
    mortgageInterestRelief,
    lifeAssuranceRelief,
    chargeableIncome,
    annualPAYE,
    effectiveRatePct,
    bandBreakdown: breakdown,

    // Internal
    internalDeductions: internalDeductionsList,
    internalDeductionsTotal,

    // Net
    netPay,

    // Legacy compat
    basic,
    housing,
    transport,
    otherAllowances,
    pensionEmployee,
    paye,
    otherDeductions,
    cra,
    pensionableEarnings,
    breakdown,
    effectiveTaxRate,
  };
}

// =========================================================================
// 2. ACCOUNT RESOLVERS FOR PAYROLL ACCOUNTING SYSTEM
// =========================================================================

async function resolveSalaryExpenseAccount(orgId: string, tx: any): Promise<string> {
  const [existing] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'expense'),
        sql`lower(${accounts.name}) like '%salary%' or lower(${accounts.name}) like '%wages%' or lower(${accounts.name}) like '%payroll%'`
      )
    )
    .limit(1);

  if (existing) return existing.id;

  const [fallback] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'expense')))
    .limit(1);

  if (fallback) return fallback.id;

  throw new AppError('Salary expense account not configured under this organization.', 400);
}

async function resolveEmployerPensionExpenseAccount(orgId: string, tx: any): Promise<string> {
  const [existing] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'expense'),
        sql`lower(${accounts.name}) like '%employer pension%' or lower(${accounts.name}) like '%pension expense%'`
      )
    )
    .limit(1);

  if (existing) return existing.id;

  // Fallback to salary expense
  return await resolveSalaryExpenseAccount(orgId, tx);
}

async function resolvePayePayableAccount(orgId: string, tx: any): Promise<string> {
  const [existing] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'liability'),
        sql`lower(${accounts.name}) like '%paye%' or lower(${accounts.name}) like '%tax payable%' or lower(${accounts.name}) like '%payroll liability%'`
      )
    )
    .limit(1);

  if (existing) return existing.id;

  const [fallback] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'liability')))
    .limit(1);

  if (fallback) return fallback.id;

  throw new AppError('PAYE elements liability account not configured.', 400);
}

async function resolvePensionPayableAccount(orgId: string, tx: any): Promise<string> {
  const [existing] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'liability'),
        sql`lower(${accounts.name}) like '%pension%'`
      )
    )
    .limit(1);

  if (existing) return existing.id;

  return await resolvePayePayableAccount(orgId, tx);
}

async function resolveNhfPayableAccount(orgId: string, tx: any): Promise<string> {
  const [existing] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'liability'),
        sql`lower(${accounts.name}) like '%nhf%' or lower(${accounts.name}) like '%housing payable%'`
      )
    )
    .limit(1);

  if (existing) return existing.id;

  return await resolvePensionPayableAccount(orgId, tx);
}

async function resolveOtherDeductionsAccount(orgId: string, tx: any): Promise<string> {
  const [existing] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'liability'),
        sql`lower(${accounts.name}) like '%deductions%' or lower(${accounts.name}) like '%clearing%'`
      )
    )
    .limit(1);

  if (existing) return existing.id;

  return await resolvePayePayableAccount(orgId, tx);
}

async function resolveBankAccount(orgId: string, tx: any): Promise<string> {
  const [cashAccount] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'asset'),
        sql`lower(${accounts.name}) like '%bank%' or lower(${accounts.name}) like '%cash%' or lower(${accounts.name}) like '%clearing%'`
      )
    )
    .limit(1);

  if (cashAccount) return cashAccount.id;

  const [fallbackAsset] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'asset')))
    .limit(1);

  if (fallbackAsset) return fallbackAsset.id;

  throw new AppError('Asset Bank Account for gross payroll clearing not configured.', 404);
}

// =========================================================================
// 3. CORE SERVICE ACTIONS
// =========================================================================

/**
 * Iterates across active employees, runs the Nigerian payroll calculations,
 * and creates a Draft Payroll Run accompanied by itemized Payroll Lines.
 */
export async function runPayroll(
  orgId: string,
  input: { periodStart: string; periodEnd: string; payDate: string; employeeIds?: string[] },
  createdBy: string
): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Fetch targeted active employees
    let targetEmployees = await tx
      .select()
      .from(employees)
      .where(and(eq(employees.orgId, orgId), eq(employees.isActive, true)));

    if (input.employeeIds && input.employeeIds.length > 0) {
      targetEmployees = targetEmployees.filter((emp) => input.employeeIds!.includes(emp.id));
    }

    if (targetEmployees.length === 0) {
      throw new AppError('No active employees were matched for this operational pay cycle.', 400);
    }

    // 2. Generate sequential tracking number
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(payrollRuns)
      .where(eq(payrollRuns.orgId, orgId));

    const prefixNum = Number(countResult?.count || 0) + 1;
    const runNumber = `PR-${String(prefixNum).padStart(4, '0')}`;

    // 3. Loop over and run progressive calculations
    const calculations: any[] = [];
    let cumulativeGross = 0;
    let cumulativePaye = 0;
    let cumulativePension = 0;
    let cumulativeNhf = 0;
    let cumulativeNet = 0;

    for (const emp of targetEmployees) {
      const calc = calculatePayrollForEmployee(emp, { start: input.periodStart, end: input.periodEnd });
      
      cumulativeGross += calc.grossPay;
      cumulativePaye += calc.monthlyPAYE;
      cumulativePension += calc.pensionEmployee; // Track employee portion
      cumulativeNhf += calc.nhf;
      cumulativeNet += calc.netPay;

      calculations.push({
        employee: emp,
        calc
      });
    }

    // 4. Create the payroll run header record
    const [run] = await tx
      .insert(payrollRuns)
      .values({
        orgId,
        runNumber,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        payDate: new Date(input.payDate),
        status: 'draft',
        totalGross: cumulativeGross,
        totalPaye: cumulativePaye,
        totalPension: cumulativePension,
        totalNhf: cumulativeNhf,
        totalNet: cumulativeNet,
        processedBy: createdBy
      })
      .returning();

    // 5. Create itemized payroll lines
    const insertedLines: any[] = [];
    for (const item of calculations) {
      const [line] = await tx
        .insert(payrollLines)
        .values({
          runId: run.id,
          employeeId: item.employee.id,
          grossPay: item.calc.grossPay,
          basic: item.calc.basic,
          housing: item.calc.housing,
          transport: item.calc.transport,
          otherAllowances: item.calc.otherAllowances,
          paye: item.calc.monthlyPAYE,
          pensionEmployee: item.calc.pensionEmployee,
          pensionEmployer: item.calc.pensionEmployer,
          nhf: item.calc.nhf,
          nhis: item.calc.nhis,
          otherDeductions: item.calc.otherDeductions,
          internalDeductions: item.calc.internalDeductions,
          netPay: item.calc.netPay,
          taxRelief: item.calc.cra,
          annualGross: item.calc.annualGross
        })
        .returning();

      insertedLines.push({
        ...line,
        employee: {
          id: item.employee.id,
          staffId: item.employee.staffId,
          firstName: item.employee.firstName,
          lastName: item.employee.lastName,
          department: item.employee.department,
          designation: item.employee.designation
        }
      });
    }

    return {
      run,
      lines: insertedLines
    };
  });
}

/**
 * Transitions a Draft Payroll Run to Approved.
 * Spawns matching General Ledger Journal entries using standard bookkeeping conventions.
 */
export async function approvePayroll(runId: string, approverId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Fetch Draft Run
    const [run] = await tx
      .select()
      .from(payrollRuns)
      .where(eq(payrollRuns.id, runId))
      .limit(1);

    if (!run) throw new AppError('Payroll run not found.', 404);
    if (run.status !== 'draft') {
      throw new AppError('Only draft payroll runs can be approved.', 400);
    }

    // 2. Fetch Run Lines to perform exact calculations
    const lines = await tx
      .select()
      .from(payrollLines)
      .where(eq(payrollLines.runId, runId));

    if (lines.length === 0) {
      throw new AppError('No lines located under the target payroll run.', 400);
    }

    // Accumulate exact fields
    let totalGross = 0;
    let totalPaye = 0;
    let totalPensionEmployee = 0;
    let totalPensionEmployer = 0;
    let totalNhf = 0;
    let totalOtherDeductions = 0;
    let totalNet = 0;

    for (const l of lines) {
      totalGross += l.grossPay;
      totalPaye += l.paye;
      totalPensionEmployee += l.pensionEmployee;
      totalPensionEmployer += l.pensionEmployer;
      totalNhf += l.nhf;
      totalOtherDeductions += l.otherDeductions;
      totalNet += l.netPay;
    }

    // 3. Resolve Bookkeeping Ledger Accounts
    const salaryExpenseAccId = await resolveSalaryExpenseAccount(run.orgId, tx);
    const employerPensionExpenseAccId = await resolveEmployerPensionExpenseAccount(run.orgId, tx);
    const payePayableAccId = await resolvePayePayableAccount(run.orgId, tx);
    const pensionPayableAccId = await resolvePensionPayableAccount(run.orgId, tx);
    const nhfPayableAccId = await resolveNhfPayableAccount(run.orgId, tx);
    const otherDeductionsAccId = await resolveOtherDeductionsAccount(run.orgId, tx);
    const bankAccId = await resolveBankAccount(run.orgId, tx);

    // 4. Construct double-entry journal lines
    const journalLinesPayload: any[] = [];

    // DR Salary Expense (Gross salary of all active employees)
    if (totalGross > 0) {
      journalLinesPayload.push({
        accountId: salaryExpenseAccId,
        debit: totalGross,
        description: `Gross Wages & Salaries for Payroll Run ${run.runNumber}`
      });
    }

    // DR Employer Pension Expense (Employer 10% pension match obligations)
    if (totalPensionEmployer > 0) {
      journalLinesPayload.push({
        accountId: employerPensionExpenseAccId,
        debit: totalPensionEmployer,
        description: `Employer Pension Contribution Expense for Run ${run.runNumber}`
      });
    }

    // CR PAYE Taxes liability
    if (totalPaye > 0) {
      journalLinesPayload.push({
        accountId: payePayableAccId,
        credit: totalPaye,
        description: `PAYE Employee Tax Liabilities for Run ${run.runNumber}`
      });
    }

    // CR Pension liability (Employee 8% + Employer 10%)
    const totalPensionObligation = totalPensionEmployee + totalPensionEmployer;
    if (totalPensionObligation > 0) {
      journalLinesPayload.push({
        accountId: pensionPayableAccId,
        credit: totalPensionObligation,
        description: `Pensions Contributions Fund Liabilities (EE+ER) for Run ${run.runNumber}`
      });
    }

    // CR NHF Housing liability
    if (totalNhf > 0) {
      journalLinesPayload.push({
        accountId: nhfPayableAccId,
        credit: totalNhf,
        description: `NHF Employee Housing Fund Liabilities for Run ${run.runNumber}`
      });
    }

    // CR Other deductions liability
    if (totalOtherDeductions > 0) {
      journalLinesPayload.push({
        accountId: otherDeductionsAccId,
        credit: totalOtherDeductions,
        description: `Other Miscellaneous Deductions for Run ${run.runNumber}`
      });
    }

    // CR Clearing Bank Account (Net salary disbursed)
    if (totalNet > 0) {
      journalLinesPayload.push({
        accountId: bankAccId,
        credit: totalNet,
        description: `Net Wage Salaries Bank Disbursement Transfer for Run ${run.runNumber}`
      });
    }

    // 5. Submit balanced Bookkeeping Entry
    const journal = await createJournalEntry({
      orgId: run.orgId,
      date: new Date(run.payDate),
      description: `Double-entry distribution clearing for Payroll Run ${run.runNumber}`,
      reference: run.runNumber,
      source: 'payroll',
      sourceId: run.id,
      createdBy: approverId,
      lines: journalLinesPayload
    }, tx);

    // 6. Update status
    const [updatedRun] = await tx
      .update(payrollRuns)
      .set({
        status: 'approved',
        journalEntryId: journal.id
      })
      .where(eq(payrollRuns.id, runId))
      .returning();

    return {
      run: updatedRun,
      journalEntryId: journal.id
    };
  });
}

/**
 * Gathers complete payslip parameters for visual reports and rendering frameworks.
 */
export async function generatePayslip(payrollLineId: string): Promise<any> {
  const [line] = await db
    .select()
    .from(payrollLines)
    .where(eq(payrollLines.id, payrollLineId))
    .limit(1);

  if (!line) throw new AppError('Selected payroll line was not found.', 404);

  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, line.runId))
    .limit(1);

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, line.employeeId))
    .limit(1);

  const calculation = calculatePayrollForEmployee(employee, { start: run.periodStart, end: run.periodEnd });

  // Build payslip in the standard 2026 PITA output format
  const bandBreakdown = calculation.bandBreakdown.map((b: TaxBandBreakdown) => ({
    band: b.bandName,
    rate: b.rate,
    taxableAmount: b.taxableAmountInBand,
    tax: b.taxAmountInBand,
  }));

  const payslip = {
    staffId: employee.staffId,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    designation: employee.designation || '',
    department: employee.department || '',
    payPeriod: `${run.periodStart.toISOString().split('T')[0]} - ${run.periodEnd.toISOString().split('T')[0]}`,
    bankName: employee.bankName || '',
    accountNumber: employee.accountNumber || '',
    pensionPin: employee.pensionPin || '',
    nhfNumber: employee.nhfNumber || '',
    taxId: employee.taxId || '',
    earnings: {
      grossSalary: calculation.grossPay,
      basicSalary: calculation.basicSalary,
    },
    statutoryDeductions: {
      pensionEE: calculation.pensionEE,
      nhis: calculation.nhis,
      nhf: calculation.nhf,
      monthlyPAYE: calculation.monthlyPAYE,
    },
    taxComputation: {
      annualGross: calculation.annualGross,
      annualPension: calculation.annualPension,
      annualNHIS: calculation.annualNHIS,
      annualNHF: calculation.annualNHF,
      rentRelief: calculation.rentRelief,
      mortgageInterestRelief: calculation.mortgageInterestRelief,
      lifeAssuranceRelief: calculation.lifeAssuranceRelief,
      chargeableIncome: calculation.chargeableIncome,
      annualPAYE: calculation.annualPAYE,
      monthlyPAYE: calculation.monthlyPAYE,
      effectiveRatePct: calculation.effectiveRatePct,
      bandBreakdown,
    },
    internalDeductions: calculation.internalDeductions,
    netPay: calculation.netPay,
  };

  return {
    line,
    run,
    employee: {
      id: employee.id,
      staffId: employee.staffId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      department: employee.department,
      designation: employee.designation,
      bankName: employee.bankName,
      accountNumber: employee.accountNumber,
      pensionPin: employee.pensionPin,
      nhfNumber: employee.nhfNumber,
      taxId: employee.taxId
    },
    calculation,
    payslip,
  };
}

/**
 * Aggregate payroll totals by calendar months of selected fiscal year.
 * Offers excellent reporting analytics for PAYE returns.
 */
export async function getPayrollSummary(orgId: string, year: number): Promise<any> {
  const runs = await db
    .select()
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.orgId, orgId),
        eq(payrollRuns.status, 'approved'), // only closed/approved runs
        sql`extract(year from ${payrollRuns.payDate}) = ${year}`
      )
    )
    .orderBy(desc(payrollRuns.payDate));

  // Initialize all 12 calendar elements
  const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthName: new Date(year, i, 1).toLocaleString('en-US', { month: 'long' }),
    gross: 0,
    paye: 0,
    pension: 0, // Employee pension
    nhf: 0,
    net: 0,
    runsCount: 0
  }));

  for (const r of runs) {
    const payDateObj = new Date(r.payDate);
    const monthIndex = payDateObj.getMonth(); // 0 to 11
    if (monthIndex >= 0 && monthIndex < 12) {
      monthlyTotals[monthIndex].gross += r.totalGross;
      monthlyTotals[monthIndex].paye += r.totalPaye;
      monthlyTotals[monthIndex].pension += r.totalPension;
      monthlyTotals[monthIndex].nhf += r.totalNhf;
      monthlyTotals[monthIndex].net += r.totalNet;
      monthlyTotals[monthIndex].runsCount += 1;
    }
  }

  // Calculate annual aggregate indices
  const annualTotals = {
    gross: monthlyTotals.reduce((sum, m) => sum + m.gross, 0),
    paye: monthlyTotals.reduce((sum, m) => sum + m.paye, 0),
    pension: monthlyTotals.reduce((sum, m) => sum + m.pension, 0),
    nhf: monthlyTotals.reduce((sum, m) => sum + m.nhf, 0),
    net: monthlyTotals.reduce((sum, m) => sum + m.net, 0)
  };

  return {
    year,
    monthlyTotals,
    annualTotals
  };
}
