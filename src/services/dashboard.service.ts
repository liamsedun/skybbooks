import { eq, and, sql, lte, gte, desc, sum, asc } from 'drizzle-orm';
import { db, accounts, journalEntries, journalLines, bankAccounts, contacts, invoices, bills, paymentsReceived, paymentsMade, budgets, budgetLines } from '../db/schema';
import { getTrialBalance, getBalanceSheet, getProfitAndLoss, getCashFlowStatement, getInventoryValueAsOf } from './ledger.service';

// ==========================================
// DASHBOARD METRICS SERVICE
// Provides 20+ financial KPIs for the new accounting dashboard
// ==========================================

function kobo(n: any): number {
  const v = Number(n);
  return isNaN(v) ? 0 : v;
}

function monthName(m: number): string {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m];
}

function startOfMonth(y: number, m: number): Date {
  return new Date(y, m, 1);
}

function endOfMonth(y: number, m: number): Date {
  return new Date(y, m + 1, 0);
}

export type DashboardMetrics = {
  period: { startDate: string; endDate: string };
  cashPosition: number;
  workingCapital: number;
  cashFlow: number;
  currentRatio: number;
  quickRatio: number;
  grossMargin: number;
  netMargin: number;
  operatingMargin: number;
  arDays: number;
  apDays: number;
  inventoryDays: number;
  cashConversionCycle: number;
  taxPayable: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  revenueTrend: { month: string; value: number }[];
  expenseTrend: { month: string; value: number }[];
  profitTrend: { month: string; value: number }[];
  overdueCustomers: { id: string; name: string; amount: number; daysOverdue: number }[];
  upcomingBills: { id: string; vendorName: string; amount: number; dueDate: string; status: string }[];
  topCustomers: { id: string; name: string; amount: number; count: number }[];
  topVendors: { id: string; name: string; amount: number; count: number }[];
  cashForecast: { month: string; inflows: number; outflows: number; net: number; balance: number }[];
  budgetVariance: { accountName: string; budgeted: number; actual: number; variance: number; variancePct: number }[];
  totalReceivables: number;
  totalPayables: number;
  outstandingInvoices: { count: number; total: number };
  outstandingBills: { count: number; total: number };
};

export async function getDashboardMetrics(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<DashboardMetrics> {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), 0, 1);
  const sDate = startDate || defaultStart;
  const eDate = endDate || now;

  // ── 1-4. Run all independent queries in parallel ──
  const [
    [revResult],
    [expResult],
    [bankResult],
    [cashGlResult],
    [taxResult],
    arAccounts,
    apAccounts,
    monthlyTrendRows,
    overdueInvoices,
    upcomingBillsRaw,
    topCustomersRaw,
    topVendorsRaw,
    [invResult],
    [billResult],
    varianceRows,
    bs,
    pnl,
    cf,
  ] = await Promise.all([
    // Revenue
    db.select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'revenue'), gte(journalEntries.date, sDate), lte(journalEntries.date, eDate), sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`)),

    // Expenses
    db.select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(eq(accounts.orgId, orgId), eq(accounts.type, 'expense'), gte(journalEntries.date, sDate), lte(journalEntries.date, eDate), sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`)),

    // Bank balance
    db.select({ total: sql<number>`coalesce(sum(${bankAccounts.currentBalance}), 0)` })
      .from(bankAccounts)
      .where(eq(bankAccounts.orgId, orgId)),

    // Cash GL accounts (100xxx codes)
    db.select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}) - sum(${journalLines.creditAmount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(eq(accounts.orgId, orgId), sql`${accounts.code} >= '100000' AND ${accounts.code} <= '100999'`, lte(journalEntries.date, eDate), sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`)),

    // Tax Payable
    db.select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}) - sum(${journalLines.debitAmount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(eq(accounts.orgId, orgId), sql`${accounts.code} >= '301000' AND ${accounts.code} <= '301999'`, lte(journalEntries.date, eDate), sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`)),

    // AR account lookup
    db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'accounts_receivable'))).limit(1),

    // AP account lookup
    db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'accounts_payable'))).limit(1),

    // Monthly trends (single GROUP BY)
    db.select({
      yearMonth: sql<string>`to_char(${journalEntries.date}, 'YYYY-MM')`,
      revenue: sql<number>`coalesce(sum(CASE WHEN ${accounts.type} = 'revenue' THEN ${journalLines.creditAmount} ELSE 0 END), 0)`,
      expenses: sql<number>`coalesce(sum(CASE WHEN ${accounts.type} = 'expense' THEN ${journalLines.debitAmount} ELSE 0 END), 0)`,
    }).from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(eq(accounts.orgId, orgId), gte(journalEntries.date, new Date(now.getFullYear(), now.getMonth() - 11, 1)), sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`))
      .groupBy(sql`to_char(${journalEntries.date}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${journalEntries.date}, 'YYYY-MM')`),

    // Overdue Customers
    db.select({ id: contacts.id, name: contacts.name, amount: invoices.balanceDue, dueDate: invoices.dueDate })
      .from(invoices)
      .innerJoin(contacts, eq(invoices.customerId, contacts.id))
      .where(and(eq(invoices.orgId, orgId), sql`${invoices.status} IN ('sent', 'partial', 'overdue')`, sql`${invoices.dueDate} < NOW()`, sql`${invoices.balanceDue} > 0`))
      .orderBy(desc(invoices.balanceDue)).limit(5),

    // Upcoming Bills
    db.select({ id: bills.id, vendorName: contacts.name, amount: bills.total, dueDate: bills.dueDate, status: bills.status })
      .from(bills).innerJoin(contacts, eq(bills.vendorId, contacts.id))
      .where(and(eq(bills.orgId, orgId), sql`${bills.status} IN ('open', 'partial')`, sql`${bills.dueDate} >= NOW()`, sql`${bills.balanceDue} > 0`))
      .orderBy(asc(bills.dueDate)).limit(5),

    // Top Customers
    db.select({ id: contacts.id, name: contacts.name, amount: sql<number>`coalesce(sum(${paymentsReceived.amount}), 0)`, count: sql<number>`count(*)` })
      .from(paymentsReceived).innerJoin(contacts, eq(paymentsReceived.customerId, contacts.id))
      .where(and(eq(paymentsReceived.orgId, orgId), gte(paymentsReceived.date, sDate), lte(paymentsReceived.date, eDate)))
      .groupBy(contacts.id, contacts.name).orderBy(desc(sql`coalesce(sum(${paymentsReceived.amount}), 0)`)).limit(5),

    // Top Vendors
    db.select({ id: contacts.id, name: contacts.name, amount: sql<number>`coalesce(sum(${paymentsMade.amount}), 0)`, count: sql<number>`count(*)` })
      .from(paymentsMade).innerJoin(contacts, eq(paymentsMade.vendorId, contacts.id))
      .where(and(eq(paymentsMade.orgId, orgId), gte(paymentsMade.date, sDate), lte(paymentsMade.date, eDate)))
      .groupBy(contacts.id, contacts.name).orderBy(desc(sql`coalesce(sum(${paymentsMade.amount}), 0)`)).limit(5),

    // Outstanding invoices
    db.select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${invoices.balanceDue}), 0)` })
      .from(invoices).where(and(eq(invoices.orgId, orgId), sql`${invoices.status} in ('sent', 'partial', 'overdue')`)),

    // Outstanding bills
    db.select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${bills.balanceDue}), 0)` })
      .from(bills).where(and(eq(bills.orgId, orgId), sql`${bills.status} in ('open', 'partial', 'overdue')`)),

    // Budget Variance (single batch query)
    db.select({
      accountId: budgetLines.accountId, accountName: accounts.name, accountCode: accounts.code,
      budgeted: sql<number>`coalesce(sum(${budgetLines.amount}), 0)`,
      actual: sql<number>`coalesce(sum(CASE WHEN ${journalEntries.id} IS NOT NULL THEN ${journalLines.debitAmount} ELSE 0 END), 0)`,
    }).from(budgetLines)
      .innerJoin(budgets, eq(budgetLines.budgetId, budgets.id))
      .innerJoin(accounts, eq(budgetLines.accountId, accounts.id))
      .leftJoin(journalLines, eq(journalLines.accountId, budgetLines.accountId))
      .leftJoin(journalEntries, and(eq(journalLines.entryId, journalEntries.id), eq(journalEntries.orgId, orgId), gte(journalEntries.date, sDate), lte(journalEntries.date, eDate), sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`))
      .where(and(eq(budgets.orgId, orgId), eq(budgets.status, 'active')))
      .groupBy(budgetLines.accountId, accounts.name, accounts.code),

    // Balance Sheet
    getBalanceSheet(orgId, eDate).catch(() => null),

    // P&L
    getProfitAndLoss(orgId, sDate, eDate).catch(() => null),

    // Cash Flow
    getCashFlowStatement(orgId, sDate, eDate).catch(() => null),
  ]);

  const totalRevenue = kobo(revResult?.total);
  const totalExpenses = kobo(expResult?.total);
  const netProfit = totalRevenue - totalExpenses;
  const cashFromBank = kobo(bankResult?.total);
  const cashFromGl = kobo(cashGlResult?.total);
  const cashPosition = cashFromBank + cashFromGl;

  // ── 3. AR / AP balances (using already-fetched account lookups, then query in parallel) ──
  const arAccount = arAccounts?.[0];
  const apAccount = apAccounts?.[0];
  let totalReceivables = 0;
  let totalPayables = 0;
  const [[arResult], [apResult]] = await Promise.all([
    arAccount ? db.select({ debits: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)`, credits: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)` })
      .from(journalLines).innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(eq(journalLines.accountId, arAccount.id), eq(journalEntries.orgId, orgId), lte(journalEntries.date, eDate), sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`))
      : Promise.resolve([{ debits: 0, credits: 0 }]),
    apAccount ? db.select({ debits: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)`, credits: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)` })
      .from(journalLines).innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(eq(journalLines.accountId, apAccount.id), eq(journalEntries.orgId, orgId), lte(journalEntries.date, eDate), sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`))
      : Promise.resolve([{ debits: 0, credits: 0 }]),
  ]);
  totalReceivables = kobo(arResult?.debits) - kobo(arResult?.credits);
  totalPayables = kobo(apResult?.credits) - kobo(apResult?.debits);

  // ── 4. Balance Sheet derived metrics (from Promise.all) ──
  let currentAssets = 0;
  let currentLiabilities = 0;
  let inventoryBalance = 0;
  const bsResult = (bs as any);
  if (bsResult) {
    const curAssetsSection = (bsResult.sections || []).find((s: any) => s.key === 'currentAssets');
    if (curAssetsSection) {
      currentAssets = kobo(curAssetsSection.total);
      const invSub = (curAssetsSection.subSections || []).find((s: any) => s.key === 'inventories');
      if (invSub) inventoryBalance = kobo(invSub.total);
    }
    const curLiabSection = (bsResult.sections || []).find((s: any) => s.key === 'currentLiabilities');
    if (curLiabSection) currentLiabilities = kobo(curLiabSection.total);
  }

  const workingCapital = currentAssets - currentLiabilities;
  const currentRatio = currentLiabilities > 0 ? Math.round((currentAssets / currentLiabilities) * 100) / 100 : 0;
  const quickRatio = currentLiabilities > 0 ? Math.round(((currentAssets - inventoryBalance) / currentLiabilities) * 100) / 100 : 0;

  // ── 5. P&L derived margins (from Promise.all) ──
  let grossProfit = 0;
  let operatingProfit = 0;
  let cogsTotal = 0;
  const pnlResult = (pnl as any);
  const current = pnlResult?.current;
  if (current) {
    grossProfit = kobo(current.grossProfit);
    operatingProfit = kobo(current.operatingProfit);
    cogsTotal = kobo(current.costOfSales?.total);
  }

  const grossMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0;
  const netMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0;
  const operatingMargin = totalRevenue > 0 ? Math.round((operatingProfit / totalRevenue) * 1000) / 10 : 0;

  // ── 6. Efficiency metrics (AR Days, AP Days, Inventory Days, CCC) ──
  const daysInPeriod = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)));
  const yearFactor = 365 / daysInPeriod;
  const annualizedRevenue = totalRevenue * yearFactor;
  const annualizedCogs = cogsTotal * yearFactor;
  const arDays = annualizedRevenue > 0 && totalReceivables > 0 ? Math.round((totalReceivables / annualizedRevenue) * 365) : 0;
  const apDays = annualizedCogs > 0 && totalPayables > 0 ? Math.round((totalPayables / annualizedCogs) * 365) : 0;
  const inventoryDays = annualizedCogs > 0 && inventoryBalance > 0 ? Math.round((inventoryBalance / annualizedCogs) * 365) : 0;
  const cashConversionCycle = arDays + inventoryDays - apDays;

  // ── 7. Tax Payable (from Promise.all) ──
  const taxPayable = kobo(taxResult?.total);

  // ── 8. Trends (from Promise.all GROUP BY) ──
  const trendMap = new Map((monthlyTrendRows as any[]).map((r: any) => [r.yearMonth, { revenue: kobo(r.revenue), expenses: kobo(r.expenses) }]));
  const trendData: { month: string; revenue: number; expenses: number; profit: number; year: number; m: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = trendMap.get(key) || { revenue: 0, expenses: 0 };
    trendData.push({ month: monthName(d.getMonth()), revenue: row.revenue, expenses: row.expenses, profit: row.revenue - row.expenses, year: d.getFullYear(), m: d.getMonth() });
  }

  const revenueTrend = trendData.map(t => ({ month: t.month, value: t.revenue }));
  const expenseTrend = trendData.map(t => ({ month: t.month, value: t.expenses }));
  const profitTrend = trendData.map(t => ({ month: t.month, value: t.profit }));

  // ── 9. Overdue Customers (from Promise.all) ──
  const overdueCustomers = (overdueInvoices as any[]).map((inv: any) => ({
    id: inv.id, name: inv.name || 'Unknown', amount: kobo(inv.amount),
    daysOverdue: Math.round((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  // ── 10. Upcoming Bills (from Promise.all) ──
  const upcomingBills = (upcomingBillsRaw as any[]).map((b: any) => ({
    id: b.id, vendorName: b.vendorName || 'Unknown', amount: kobo(b.amount),
    dueDate: b.dueDate ? new Date(b.dueDate).toISOString().split('T')[0] : '', status: b.status || 'open',
  }));

  // ── 11-12. Top Customers & Vendors (from Promise.all) ──
  const topCustomers = (topCustomersRaw as any[]).map((c: any) => ({ id: c.id, name: c.name || 'Unknown', amount: kobo(c.amount), count: Number(c.count) }));
  const topVendors = (topVendorsRaw as any[]).map((v: any) => ({ id: v.id, name: v.name || 'Unknown', amount: kobo(v.amount), count: Number(v.count) }));

  // ── 13. Cash Forecast ──
  const avgMonthlyInflow = trendData.length > 0 ? trendData.reduce((s, t) => s + t.revenue, 0) / trendData.length : 0;
  const avgMonthlyOutflow = trendData.length > 0 ? trendData.reduce((s, t) => s + t.expenses, 0) / trendData.length : 0;
  const forecastMonths = 6;
  const cashForecast: { month: string; inflows: number; outflows: number; net: number; balance: number }[] = [];
  let runningBalance = cashPosition;
  for (let i = 0; i < forecastMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = i === 0 ? 'Current' : monthName(d.getMonth());
    const inflows = i === 0 ? avgMonthlyInflow * 0.5 : avgMonthlyInflow;
    const outflows = i === 0 ? avgMonthlyOutflow * 0.5 : avgMonthlyOutflow;
    const net = inflows - outflows;
    runningBalance += net;
    cashForecast.push({ month: label, inflows: Math.round(inflows), outflows: Math.round(outflows), net: Math.round(net), balance: Math.round(runningBalance) });
  }

  // ── 14. Budget Variance (from Promise.all) ──
  const budgetVariance: { accountName: string; budgeted: number; actual: number; variance: number; variancePct: number }[] = [];
  for (const row of (varianceRows as any[])) {
    const budgeted = kobo(row.budgeted);
    const actual = kobo(row.actual);
    const variance = budgeted - actual;
    const variancePct = budgeted > 0 ? Math.round((variance / budgeted) * 1000) / 10 : 0;
    budgetVariance.push({ accountName: `${row.accountCode} - ${row.accountName}`, budgeted, actual, variance, variancePct });
  }

  // ── 16. Cash Flow (from Promise.all) ──
  const cfResult = (cf as any);
  const cashFlow = cfResult?.current ? kobo(cfResult.current.netCashFromOperatingActivities) : 0;

  return {
    period: { startDate: sDate.toISOString(), endDate: eDate.toISOString() },
    cashPosition,
    workingCapital,
    cashFlow,
    currentRatio,
    quickRatio,
    grossMargin,
    netMargin,
    operatingMargin,
    arDays,
    apDays,
    inventoryDays,
    cashConversionCycle,
    taxPayable,
    totalRevenue,
    totalExpenses,
    netProfit,
    revenueTrend,
    expenseTrend,
    profitTrend,
    overdueCustomers,
    upcomingBills,
    topCustomers,
    topVendors,
    cashForecast,
    budgetVariance,
    totalReceivables,
    totalPayables,
    outstandingInvoices: { count: Number(invResult?.count || 0), total: kobo(invResult?.total) },
    outstandingBills: { count: Number(billResult?.count || 0), total: kobo(billResult?.total) },
  };
}
