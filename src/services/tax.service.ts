import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { db, accounts, journalEntries, journalLines, taxConfigurations, capitalAllowanceSchedule, taxLosses, taxComputations, organisations } from '../db/schema';
import { postToGL } from './posting.service';

const SMALL_THRESHOLD_KOBO = 2_500_000_000;     // ₦25,000,000
const MEDIUM_THRESHOLD_KOBO = 10_000_000_000;   // ₦100,000,000

const DEFAULT_CAPITAL_ALLOWANCE_RATES: Record<string, { initial: number; annual: number }> = {
  industrial_building:      { initial: 0.15, annual: 0.10 },
  non_industrial_building:  { initial: 0,    annual: 0 },
  plant_machinery_general:  { initial: 0.50, annual: 0.25 },
  plant_machinery_agric:    { initial: 0.95, annual: 0 },
  motor_vehicle:            { initial: 0.50, annual: 0.25 },
  furniture_fittings:       { initial: 0.25, annual: 0.20 },
  computer_it_equipment:    { initial: 0.50, annual: 0.25 },
  intangible_asset:         { initial: 0,    annual: 0 },
};

export async function classifyCompany(orgId: string, turnoverKobo: number): Promise<'small' | 'medium' | 'large'> {
  if (turnoverKobo < SMALL_THRESHOLD_KOBO) return 'small';
  if (turnoverKobo <= MEDIUM_THRESHOLD_KOBO) return 'medium';
  return 'large';
}

export function getCITRate(sizeClass: 'small' | 'medium' | 'large'): number {
  if (sizeClass === 'small') return 0;
  if (sizeClass === 'medium') return 0.20;
  return 0.30;
}

export async function getGrossTurnover(orgId: string, startDate: Date, endDate: Date): Promise<number> {
  const [result] = await db
    .select({
      total: sql<number>`coalesce(sum(${journalLines.creditAmount}) - sum(${journalLines.debitAmount}), 0)`
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(and(
      eq(journalEntries.orgId, orgId),
      eq(accounts.type, 'revenue'),
      gte(journalEntries.date, startDate),
      lte(journalEntries.date, endDate),
      sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
    ));
  return result?.total || 0;
}

export async function getAccountingPBT(orgId: string, startDate: Date, endDate: Date): Promise<number> {
  const rev = await getGrossTurnover(orgId, startDate, endDate);
  const [expResult] = await db
    .select({
      total: sql<number>`coalesce(sum(${journalLines.debitAmount}) - sum(${journalLines.creditAmount}), 0)`
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(and(
      eq(journalEntries.orgId, orgId),
      eq(accounts.type, 'expense'),
      gte(journalEntries.date, startDate),
      lte(journalEntries.date, endDate),
      sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
    ));
  return rev - (expResult?.total || 0);
}

export async function getAccountBalanceForPeriod(orgId: string, accountCode: string, startDate: Date, endDate: Date): Promise<number> {
  const [result] = await db
    .select({
      balance: sql<number>`coalesce(sum(${journalLines.debitAmount}) - sum(${journalLines.creditAmount}), 0)`
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(and(
      eq(journalEntries.orgId, orgId),
      eq(accounts.code, accountCode),
      gte(journalEntries.date, startDate),
      lte(journalEntries.date, endDate),
      sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
    ));
  return result?.balance || 0;
}

export async function getDisallowableAddbacks(orgId: string, startDate: Date, endDate: Date): Promise<{
  depreciation: number;
  penalties: number;
  donations: number;
  provisions: number;
  total: number;
}> {
  const depreciationCodes = ['810700', '810800', '810900'];
  const penaltyCode = '830500';
  const donationCode = '830400';
  const provisionCode = '830200';
  const entertainmentCode = '830100';

  let total = 0;
  let depreciation = 0;
  let penalties = 0;
  let donations = 0;
  let provisions = 0;

  for (const code of depreciationCodes) {
    const bal = await getAccountBalanceForPeriod(orgId, code, startDate, endDate);
    depreciation += bal;
  }
  total += depreciation;

  penalties = await getAccountBalanceForPeriod(orgId, penaltyCode, startDate, endDate);
  total += penalties;

  donations = await getAccountBalanceForPeriod(orgId, donationCode, startDate, endDate);
  total += donations;

  provisions = await getAccountBalanceForPeriod(orgId, provisionCode, startDate, endDate);
  total += provisions;

  const entertainmentExpense = await getAccountBalanceForPeriod(orgId, entertainmentCode, startDate, endDate);
  const turnover = await getGrossTurnover(orgId, startDate, endDate);
  const allowableEnt = Math.round(turnover * 0.02);
  if (entertainmentExpense > allowableEnt) {
    total += entertainmentExpense - allowableEnt;
  }

  return { depreciation, penalties, donations, provisions, total };
}

export async function getCapitalAllowancesTotal(orgId: string, taxYear: string): Promise<{
  initial: number;
  annual: number;
  total: number;
}> {
  const assets = await db
    .select()
    .from(capitalAllowanceSchedule)
    .where(and(
      eq(capitalAllowanceSchedule.orgId, orgId),
      eq(capitalAllowanceSchedule.taxYear, taxYear),
      eq(capitalAllowanceSchedule.isDisposed, false)
    ));

  let initial = 0;
  let annual = 0;
  for (const asset of assets) {
    initial += asset.initialAllowanceAmount;
    annual += asset.annualAllowanceAmount;
  }
  return { initial, annual, total: initial + annual };
}

export async function getAvailableTaxLosses(orgId: string): Promise<number> {
  const losses = await db
    .select()
    .from(taxLosses)
    .where(and(
      eq(taxLosses.orgId, orgId),
      eq(taxLosses.status, 'available')
    ));
  return losses.reduce((sum, l) => sum + l.availableAmount, 0);
}

export async function computeAssessableProfit(
  orgId: string,
  startDate: Date,
  endDate: Date,
  taxYear: string
): Promise<{
  accountingPBT: number;
  addbacks: number;
  capitalAllowances: number;
  lossesBroughtForward: number;
  assessableProfit: number;
}> {
  const accountingPBT = await getAccountingPBT(orgId, startDate, endDate);
  const addbackResult = await getDisallowableAddbacks(orgId, startDate, endDate);
  const capAllowResult = await getCapitalAllowancesTotal(orgId, taxYear);
  const lossesBroughtForward = await getAvailableTaxLosses(orgId);

  const totalAddbacks = addbackResult.total;
  const totalDeductions = capAllowResult.total + lossesBroughtForward;
  const assessableProfit = Math.max(0, accountingPBT + totalAddbacks - totalDeductions);

  return {
    accountingPBT,
    addbacks: totalAddbacks,
    capitalAllowances: capAllowResult.total,
    lossesBroughtForward,
    assessableProfit,
  };
}

export async function computeTax(
  orgId: string,
  startDate: Date,
  endDate: Date,
  taxYear: string,
  config?: {
    sizeClass?: 'small' | 'medium' | 'large';
    nitdaApplicable?: boolean;
    minimumTaxExemptReason?: string | null;
    firstFourYearsExemption?: boolean;
    agriculturalExemption?: boolean;
    foreignEquityExemption?: boolean;
    exportExemption?: boolean;
  }
): Promise<{
  grossTurnover: number;
  accountingPBT: number;
  addbacks: number;
  capitalAllowances: number;
  lossesBroughtForward: number;
  assessableProfit: number;
  citRate: number;
  citFromProfits: number;
  minimumTax: number;
  citPayable: number;
  edtPayable: number;
  cgtPayable: number;
  nitdaLevy: number;
  deferredTaxCharge: number;
  totalTaxExpense: number;
  whtCreditsApplied: number;
  netCitPayable: number;
  addbackDetails: any;
}> {
  const grossTurnover = await getGrossTurnover(orgId, startDate, endDate);
  const sizeClass = config?.sizeClass || await classifyCompany(orgId, grossTurnover);

  const apResult = await computeAssessableProfit(orgId, startDate, endDate, taxYear);
  const citRate = getCITRate(sizeClass);

  const citFromProfits = Math.round(apResult.assessableProfit * citRate);

  const minimumTaxExempt = (
    sizeClass === 'small' ||
    config?.firstFourYearsExemption ||
    config?.agriculturalExemption ||
    config?.foreignEquityExemption ||
    apResult.assessableProfit > 0 && citFromProfits > Math.round(grossTurnover * 0.01)
  );
  const minTaxRate = 0.01;
  const minimumTax = minimumTaxExempt ? 0 : Math.round(grossTurnover * minTaxRate);
  const citPayable = Math.max(citFromProfits, minimumTax);

  const edtPayable = sizeClass !== 'small' && apResult.assessableProfit > 0
    ? Math.round(apResult.assessableProfit * 0.03)
    : 0;

  const cgtFromDisposals = await getAccountBalanceForPeriod(orgId, '601400', startDate, endDate);
  const cgtLosses = Math.abs(await getAccountBalanceForPeriod(orgId, '830600', startDate, endDate));
  const netCGTGain = Math.max(0, cgtFromDisposals - cgtLosses);
  const cgtPayable = Math.round(netCGTGain * 0.10);

  const nitdaExempt = !config?.nitdaApplicable || grossTurnover <= MEDIUM_THRESHOLD_KOBO;
  const nitdaLevy = nitdaExempt ? 0 : Math.round(apResult.accountingPBT * 0.01);

  const dta = await getAvailableTaxLosses(orgId);
  const dttDiff = apResult.capitalAllowances - apResult.addbacks;
  const deferredTaxCharge = Math.round((dttDiff - dta) * citRate);
  const whtBalance = await getAccountBalanceForPeriod(orgId, '101500', startDate, endDate);
  const whtCreditsApplied = Math.min(citPayable, Math.max(0, whtBalance));

  const netCitPayable = citPayable - whtCreditsApplied;

  const totalTaxExpense = citPayable + edtPayable + cgtPayable + nitdaLevy + Math.max(0, deferredTaxCharge);

  return {
    grossTurnover,
    accountingPBT: apResult.accountingPBT,
    addbacks: apResult.addbacks,
    capitalAllowances: apResult.capitalAllowances,
    lossesBroughtForward: apResult.lossesBroughtForward,
    assessableProfit: apResult.assessableProfit,
    citRate,
    citFromProfits,
    minimumTax,
    citPayable,
    edtPayable,
    cgtPayable,
    nitdaLevy,
    deferredTaxCharge,
    totalTaxExpense,
    whtCreditsApplied: Math.max(0, whtCreditsApplied),
    netCitPayable,
    addbackDetails: apResult,
  };
}

export async function postTaxJournalEntries(
  orgId: string,
  userId: string,
  date: Date,
  taxYear: string,
  computation: Awaited<ReturnType<typeof computeTax>>,
  taxComputationId: string
): Promise<any> {
  const lines: Array<{ accountId: string; debit?: number; credit?: number; description?: string }> = [];

  const getAccountByCode = async (code: string) => {
    const [acct] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.code, code)))
      .limit(1);
    return acct;
  };

  const acctCITPayable = await getAccountByCode('301100');
  const acctCITExpense = await getAccountByCode('950100');
  const acctEDTPayable = await getAccountByCode('301200');
  const acctEDTExpense = await getAccountByCode('950200');
  const acctCGTPayable = await getAccountByCode('301450');
  const acctCGTExpense = await getAccountByCode('950400');
  const acctNITDAPayable = await getAccountByCode('301900');
  const acctNITDAExpense = await getAccountByCode('950600');
  const acctDTL = await getAccountByCode('402000');
  const acctDTA = await getAccountByCode('205000');
  const acctDTExpense = await getAccountByCode('950300');
  const acctWHTReceivable = await getAccountByCode('101500');

  if (computation.citPayable > 0 && acctCITPayable && acctCITExpense) {
    lines.push({ accountId: acctCITExpense.id, debit: computation.citPayable, description: 'CIT charge' });
    lines.push({ accountId: acctCITPayable.id, credit: computation.citPayable, description: 'CIT payable' });
  }

  if (computation.edtPayable > 0 && acctEDTPayable && acctEDTExpense) {
    lines.push({ accountId: acctEDTExpense.id, debit: computation.edtPayable, description: 'EDT charge' });
    lines.push({ accountId: acctEDTPayable.id, credit: computation.edtPayable, description: 'EDT payable' });
  }

  if (computation.cgtPayable > 0 && acctCGTPayable && acctCGTExpense) {
    lines.push({ accountId: acctCGTExpense.id, debit: computation.cgtPayable, description: 'CGT charge' });
    lines.push({ accountId: acctCGTPayable.id, credit: computation.cgtPayable, description: 'CGT payable' });
  }

  if (computation.nitdaLevy > 0 && acctNITDAPayable && acctNITDAExpense) {
    lines.push({ accountId: acctNITDAExpense.id, debit: computation.nitdaLevy, description: 'NITDA levy charge' });
    lines.push({ accountId: acctNITDAPayable.id, credit: computation.nitdaLevy, description: 'NITDA levy payable' });
  }

  if (computation.deferredTaxCharge !== 0) {
    if (computation.deferredTaxCharge > 0 && acctDTL && acctDTExpense) {
      lines.push({ accountId: acctDTExpense.id, debit: computation.deferredTaxCharge, description: 'Deferred tax charge' });
      lines.push({ accountId: acctDTL.id, credit: computation.deferredTaxCharge, description: 'Deferred tax liability' });
    } else if (computation.deferredTaxCharge < 0 && acctDTA && acctDTExpense) {
      lines.push({ accountId: acctDTA.id, debit: Math.abs(computation.deferredTaxCharge), description: 'Deferred tax asset' });
      lines.push({ accountId: acctDTExpense.id, credit: Math.abs(computation.deferredTaxCharge), description: 'Deferred tax credit' });
    }
  }

  if (computation.whtCreditsApplied > 0 && acctWHTReceivable) {
    lines.push({ accountId: acctCITPayable!.id, debit: computation.whtCreditsApplied, description: 'WHT credits applied' });
    lines.push({ accountId: acctWHTReceivable.id, credit: computation.whtCreditsApplied, description: 'WHT credits utilised' });
  }

  const totalDr = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (l.credit || 0), 0);

  if (totalDr !== totalCr) {
    if (totalDr > totalCr) {
      lines.push({ accountId: acctCITPayable!.id, credit: totalDr - totalCr, description: 'Balancing figure' });
    } else {
      lines.push({ accountId: acctCITExpense!.id, debit: totalCr - totalDr, description: 'Balancing figure' });
    }
  }

  const je = await postToGL({
    orgId,
    date,
    description: `Tax Computation — ${taxYear} — Auto-posted`,
    reference: `TAX-${taxYear.replace(/[^0-9]/g, '').slice(0, 4)}-${taxComputationId.slice(0, 8)}`,
    source: 'tax_provision' as any,
    sourceId: taxComputationId,
    createdBy: userId,
    lines,
  });

  await db
    .update(taxComputations)
    .set({
      journalEntryId: je.id,
      status: 'submitted',
      updatedAt: new Date(),
    })
    .where(eq(taxComputations.id, taxComputationId));

  if (computation.assessableProfit <= 0) {
    const lossAmount = Math.abs(computation.assessableProfit);
    await db.insert(taxLosses).values({
      orgId,
      taxYear,
      lossAmount,
      utilisedAmount: 0,
      availableAmount: lossAmount,
      status: 'available',
    });
  }

  return je;
}
