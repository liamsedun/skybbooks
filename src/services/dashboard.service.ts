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
  const earlyDate = new Date('2000-01-01');

  // ── 1. Revenue, Expenses, Net Profit (existing summary data) ──
  const [revResult] = await db
    .select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)` })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'revenue'),
        gte(journalEntries.date, sDate),
        lte(journalEntries.date, eDate),
        sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
      )
    );
  const totalRevenue = kobo(revResult?.total);

  const [expResult] = await db
    .select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)` })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'expense'),
        gte(journalEntries.date, sDate),
        lte(journalEntries.date, eDate),
        sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
      )
    );
  const totalExpenses = kobo(expResult?.total);
  const netProfit = totalRevenue - totalExpenses;

  // ── 2. Cash Position (from bank accounts + cash GL accounts) ──
  const [bankResult] = await db
    .select({ total: sql<number>`coalesce(sum(${bankAccounts.currentBalance}), 0)` })
    .from(bankAccounts)
    .where(eq(bankAccounts.orgId, orgId));
  const cashFromBank = kobo(bankResult?.total);

  // Also get cash GL account balances (100xxx accounts) for any cash not linked to bank accounts
  const [cashGlResult] = await db
    .select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}) - sum(${journalLines.creditAmount}), 0)` })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        eq(accounts.orgId, orgId),
        sql`${accounts.code} >= '100000' AND ${accounts.code} <= '100999'`,
        lte(journalEntries.date, eDate),
        sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
      )
    );
  const cashFromGl = kobo(cashGlResult?.total);
  const cashPosition = cashFromBank + cashFromGl;

  // ── 3. AR / AP balances ──
  const [arAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'accounts_receivable')))
    .limit(1);
  let totalReceivables = 0;
  if (arAccount) {
    const [arResult] = await db
      .select({
        debits: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)`,
        credits: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)`
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.accountId, arAccount.id),
          eq(journalEntries.orgId, orgId),
          lte(journalEntries.date, eDate),
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        )
      );
    totalReceivables = kobo(arResult?.debits) - kobo(arResult?.credits);
  }

  const [apAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'accounts_payable')))
    .limit(1);
  let totalPayables = 0;
  if (apAccount) {
    const [apResult] = await db
      .select({
        debits: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)`,
        credits: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)`
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.accountId, apAccount.id),
          eq(journalEntries.orgId, orgId),
          lte(journalEntries.date, eDate),
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        )
      );
    totalPayables = kobo(apResult?.credits) - kobo(apResult?.debits);
  }

  // ── 4. Balance Sheet derived metrics ──
  let currentAssets = 0;
  let currentLiabilities = 0;
  let inventoryBalance = 0;
  try {
    const bs = await getBalanceSheet(orgId, eDate);
    if (bs) {
      const curAssetsSection = (bs.sections || []).find((s: any) => s.key === 'currentAssets');
      if (curAssetsSection) {
        currentAssets = kobo(curAssetsSection.total);
        const invSub = (curAssetsSection.subSections || []).find((s: any) => s.key === 'inventories');
        if (invSub) inventoryBalance = kobo(invSub.total);
      }
      const curLiabSection = (bs.sections || []).find((s: any) => s.key === 'currentLiabilities');
      if (curLiabSection) {
        currentLiabilities = kobo(curLiabSection.total);
      }
    }
  } catch { /* gracefully degrade */ }

  const workingCapital = currentAssets - currentLiabilities;
  const currentRatio = currentLiabilities > 0 ? Math.round((currentAssets / currentLiabilities) * 100) / 100 : 0;
  const quickRatio = currentLiabilities > 0 ? Math.round(((currentAssets - inventoryBalance) / currentLiabilities) * 100) / 100 : 0;

  // ── 5. P&L derived margins ──
  let grossProfit = 0;
  let operatingProfit = 0;
  let cogsTotal = 0;
  try {
    const pnl = await getProfitAndLoss(orgId, sDate, eDate);
    const current = pnl?.current;
    if (current) {
      grossProfit = kobo(current.grossProfit);
      operatingProfit = kobo(current.operatingProfit);
      cogsTotal = kobo(current.costOfSales?.total);
    }
  } catch { /* gracefully degrade */ }

  const grossMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0;
  const netMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0;
  const operatingMargin = totalRevenue > 0 ? Math.round((operatingProfit / totalRevenue) * 1000) / 10 : 0;

  // ── 6. Efficiency metrics (AR Days, AP Days, Inventory Days, CCC) ──
  const avgAr = totalReceivables;
  const avgAp = totalPayables;
  const avgInventory = inventoryBalance;
  const annualRevenue = totalRevenue; // period revenue - will be annualized if less than 12 months
  const annualCogs = cogsTotal;
  const daysInPeriod = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)));
  const yearFactor = 365 / daysInPeriod;
  const annualizedRevenue = totalRevenue * yearFactor;
  const annualizedCogs = cogsTotal * yearFactor;

  const arDays = annualizedRevenue > 0 && avgAr > 0 ? Math.round((avgAr / annualizedRevenue) * 365) : 0;
  const apDays = annualizedCogs > 0 && avgAp > 0 ? Math.round((avgAp / annualizedCogs) * 365) : 0;
  const inventoryDays = annualizedCogs > 0 && avgInventory > 0 ? Math.round((avgInventory / annualizedCogs) * 365) : 0;
  const cashConversionCycle = arDays + inventoryDays - apDays;

  // ── 7. Tax Payable (balance in tax liability accounts 301xxx) ──
  const [taxResult] = await db
    .select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}) - sum(${journalLines.debitAmount}), 0)` })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        eq(accounts.orgId, orgId),
        sql`${accounts.code} >= '301000' AND ${accounts.code} <= '301999'`,
        lte(journalEntries.date, eDate),
        sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
      )
    );
  const taxPayable = kobo(taxResult?.total);

  // ── 8. Trends (monthly for last 12 months) ──
  const trendData: { month: string; revenue: number; expenses: number; profit: number; year: number; m: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ms = startOfMonth(d.getFullYear(), d.getMonth());
    const me = endOfMonth(d.getFullYear(), d.getMonth());
    const [mRev] = await db
      .select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(
        and(
          eq(accounts.orgId, orgId),
          eq(accounts.type, 'revenue'),
          gte(journalEntries.date, ms),
          lte(journalEntries.date, me),
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        )
      );
    const [mExp] = await db
      .select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(
        and(
          eq(accounts.orgId, orgId),
          eq(accounts.type, 'expense'),
          gte(journalEntries.date, ms),
          lte(journalEntries.date, me),
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        )
      );
    const r = kobo(mRev?.total);
    const e = kobo(mExp?.total);
    trendData.push({ month: monthName(d.getMonth()), revenue: r, expenses: e, profit: r - e, year: d.getFullYear(), m: d.getMonth() });
  }

  const revenueTrend = trendData.map(t => ({ month: t.month, value: t.revenue }));
  const expenseTrend = trendData.map(t => ({ month: t.month, value: t.expenses }));
  const profitTrend = trendData.map(t => ({ month: t.month, value: t.profit }));

  // ── 9. Overdue Customers ──
  const overdueInvoices = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      amount: invoices.balanceDue,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .innerJoin(contacts, eq(invoices.customerId, contacts.id))
    .where(
      and(
        eq(invoices.orgId, orgId),
        sql`${invoices.status} IN ('sent', 'partial', 'overdue')`,
        sql`${invoices.dueDate} < NOW()`,
        sql`${invoices.balanceDue} > 0`
      )
    )
    .orderBy(desc(invoices.balanceDue))
    .limit(5);
  const overdueCustomers = overdueInvoices.map(inv => ({
    id: inv.id,
    name: inv.name || 'Unknown',
    amount: kobo(inv.amount),
    daysOverdue: Math.round((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  // ── 10. Upcoming Bills ──
  const upcomingBillsRaw = await db
    .select({
      id: bills.id,
      vendorName: contacts.name,
      amount: bills.total,
      dueDate: bills.dueDate,
      status: bills.status,
    })
    .from(bills)
    .innerJoin(contacts, eq(bills.vendorId, contacts.id))
    .where(
      and(
        eq(bills.orgId, orgId),
        sql`${bills.status} IN ('open', 'partial')`,
        sql`${bills.dueDate} >= NOW()`,
        sql`${bills.balanceDue} > 0`
      )
    )
    .orderBy(asc(bills.dueDate))
    .limit(5);
  const upcomingBills = upcomingBillsRaw.map(b => ({
    id: b.id,
    vendorName: b.vendorName || 'Unknown',
    amount: kobo(b.amount),
    dueDate: b.dueDate ? new Date(b.dueDate).toISOString().split('T')[0] : '',
    status: b.status || 'open',
  }));

  // ── 11. Top Customers (by payment received) ──
  const topCustomersRaw = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      amount: sql<number>`coalesce(sum(${paymentsReceived.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(paymentsReceived)
    .innerJoin(contacts, eq(paymentsReceived.customerId, contacts.id))
    .where(
      and(
        eq(paymentsReceived.orgId, orgId),
        gte(paymentsReceived.date, sDate),
        lte(paymentsReceived.date, eDate)
      )
    )
    .groupBy(contacts.id, contacts.name)
    .orderBy(desc(sql`coalesce(sum(${paymentsReceived.amount}), 0)`))
    .limit(5);
  const topCustomers = topCustomersRaw.map(c => ({
    id: c.id,
    name: c.name || 'Unknown',
    amount: kobo(c.amount),
    count: Number(c.count),
  }));

  // ── 12. Top Vendors (by payments made) ──
  const topVendorsRaw = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      amount: sql<number>`coalesce(sum(${paymentsMade.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(paymentsMade)
    .innerJoin(contacts, eq(paymentsMade.vendorId, contacts.id))
    .where(
      and(
        eq(paymentsMade.orgId, orgId),
        gte(paymentsMade.date, sDate),
        lte(paymentsMade.date, eDate)
      )
    )
    .groupBy(contacts.id, contacts.name)
    .orderBy(desc(sql`coalesce(sum(${paymentsMade.amount}), 0)`))
    .limit(5);
  const topVendors = topVendorsRaw.map(v => ({
    id: v.id,
    name: v.name || 'Unknown',
    amount: kobo(v.amount),
    count: Number(v.count),
  }));

  // ── 13. Cash Forecast (90-day projection based on average monthly net + current balance) ──
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

  // ── 14. Budget Variance ──
  const budgetVariance: { accountName: string; budgeted: number; actual: number; variance: number; variancePct: number }[] = [];
  try {
    const activeBudgets = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.orgId, orgId), eq(budgets.status, 'active')));
    for (const budget of (activeBudgets || [])) {
      const lines = await db
        .select()
        .from(budgetLines)
        .where(eq(budgetLines.budgetId, budget.id));
      for (const line of (lines || [])) {
        const [acct] = await db
          .select({ name: accounts.name, code: accounts.code })
          .from(accounts)
          .where(eq(accounts.id, line.accountId));
        const budgetAmount = kobo(line.amount);
        const [actualResult] = await db
          .select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)` })
          .from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .where(
            and(
              eq(journalLines.accountId, line.accountId),
              eq(journalEntries.orgId, orgId),
              gte(journalEntries.date, sDate),
              lte(journalEntries.date, eDate),
              sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
            )
          );
        const actualAmount = kobo(actualResult?.total);
        const variance = budgetAmount - actualAmount;
        const variancePct = budgetAmount > 0 ? Math.round((variance / budgetAmount) * 1000) / 10 : 0;
        budgetVariance.push({
          accountName: acct ? `${acct.code} - ${acct.name}` : line.accountId,
          budgeted: budgetAmount,
          actual: actualAmount,
          variance,
          variancePct,
        });
      }
    }
  } catch { /* gracefully degrade */ }

  // ── 15. Outstanding invoices & bills ──
  const [invResult] = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${invoices.balanceDue}), 0)`
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.orgId, orgId),
        sql`${invoices.status} in ('sent', 'partial', 'overdue')`
      )
    );

  const [billResult] = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${bills.balanceDue}), 0)`
    })
    .from(bills)
    .where(
      and(
        eq(bills.orgId, orgId),
        sql`${bills.status} in ('open', 'partial', 'overdue')`
      )
    );

  // ── 16. Cash Flow (net from operating activities) ──
  let cashFlow = 0;
  try {
    const cf = await getCashFlowStatement(orgId, sDate, eDate);
    if (cf?.current) {
      cashFlow = kobo(cf.current.netCashFromOperatingActivities);
    }
  } catch { /* gracefully degrade */ }

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
