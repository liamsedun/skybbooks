import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { db, accounts, journalEntries, journalLines, paymentsMade } from '../db/schema';
import { getTrialBalance, getProfitAndLoss, getBalanceSheet, getCashFlowStatement } from './ledger.service';
import { getDashboardMetrics } from './dashboard.service';
import { createAuditLog } from './audit.service';

function kobo(n: any): number {
  const v = Number(n);
  return isNaN(v) ? 0 : v;
}

function fmtNaira(v: number): string {
  return `\u20A6${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pct(a: number, b: number): string {
  return b > 0 ? ((a / b) * 100).toFixed(1) : '0';
}

function direction(v: number): string {
  return v >= 0 ? '+' : '';
}

type Capability =
  | 'explain-financials'
  | 'explain-trial-balance'
  | 'predict-cash-flow'
  | 'detect-fraud'
  | 'detect-duplicates'
  | 'generate-report'
  | 'suggest-journal'
  | 'explain-ifrs'
  | 'summarize-month'
  | 'executive-insights'
  | 'query-data';

function detectCapability(query: string): Capability {
  const q = query.toLowerCase();
  if (q.includes('trial balance') || q.includes('tb difference') || q.includes('tb variance') || q.includes('trial diff')) return 'explain-trial-balance';
  if (q.includes('cash flow') || q.includes('cash forecast') || q.includes('predict cash') || q.includes('future cash') || q.includes('cash projection')) return 'predict-cash-flow';
  if (q.includes('fraud') || q.includes('suspicious') || q.includes('unusual') || q.includes('anomaly') || q.includes('irregular')) return 'detect-fraud';
  if (q.includes('duplicate') || q.includes('double') || q.includes('same expense') || q.includes('repeat payment')) return 'detect-duplicates';
  if (q.includes('management report') || q.includes('generate report') || q.includes('executive report')) return 'generate-report';
  if (q.includes('journal entry') || q.includes('suggest journal') || q.includes('propose journal') || q.includes('je for')) return 'suggest-journal';
  if (q.includes('ifrs') || q.includes('ifrs impact') || q.includes('accounting standard') || q.includes('reporting standard')) return 'explain-ifrs';
  if (q.includes('monthly') || q.includes('month summary') || q.includes('performance summary') || q.includes('this month')) return 'summarize-month';
  if (q.includes('insight') || q.includes('overview') || q.includes('executive') || q.includes('health') || q.includes('state of')) return 'executive-insights';
  if (q.includes('balance sheet') || q.includes('profit') || q.includes('loss') || q.includes('p&l') || q.includes('income statement') || q.includes('financial statement')) return 'explain-financials';
  return 'query-data';
}

export class AccountingAssistant {

  async processQuery(
    orgId: string,
    userId: string,
    query: string,
    reqMeta?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ response: string; capability: Capability; data?: any }> {
    const capability = detectCapability(query);

    try {
      let response = '';
      let data: any = null;

      switch (capability) {
        case 'explain-financials':
          { const r = await this.explainFinancials(orgId); response = r.response; data = r.data; }
          break;
        case 'explain-trial-balance':
          { const r = await this.explainTrialBalance(orgId); response = r.response; data = r.data; }
          break;
        case 'predict-cash-flow':
          { const r = await this.predictCashFlow(orgId); response = r.response; data = r.data; }
          break;
        case 'detect-fraud':
          { const r = await this.detectFraud(orgId); response = r.response; data = r.data; }
          break;
        case 'detect-duplicates':
          { const r = await this.detectDuplicates(orgId); response = r.response; data = r.data; }
          break;
        case 'generate-report':
          { const r = await this.generateManagementReport(orgId); response = r.response; data = r.data; }
          break;
        case 'suggest-journal':
          { const r = await this.suggestJournalEntry(orgId, query); response = r.response; data = r.data; }
          break;
        case 'explain-ifrs':
          { const r = await this.explainIFRS(orgId); response = r.response; data = r.data; }
          break;
        case 'summarize-month':
          { const r = await this.summarizeMonthly(orgId); response = r.response; data = r.data; }
          break;
        case 'executive-insights':
          { const r = await this.executiveInsights(orgId); response = r.response; data = r.data; }
          break;
        default:
          { const r = await this.queryData(orgId); response = r.response; data = r.data; }
      }

      await createAuditLog({
        orgId, userId,
        action: 'AI_ASSISTANT_QUERY',
        entityType: 'ai_assistant',
        entityId: null,
        newValues: { capability, queryLength: query.length },
        ...(reqMeta || { ipAddress: '127.0.0.1', userAgent: '' }),
      });

      return { response, capability, data };
    } catch (err: any) {
      const errorMsg = `I encountered an error: ${err.message}. Please try rephrasing your question.`;
      await createAuditLog({
        orgId, userId,
        action: 'AI_ASSISTANT_ERROR',
        entityType: 'ai_assistant',
        entityId: null,
        newValues: { capability, error: err.message, queryLength: query.length },
        ...(reqMeta || { ipAddress: '127.0.0.1', userAgent: '' }),
      });
      return { response: errorMsg, capability };
    }
  }

  private async explainFinancials(orgId: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    const endDate = now;

    const pnl = await getProfitAndLoss(orgId, startDate, endDate);
    const current = pnl?.current || {};
    const bs = await getBalanceSheet(orgId, endDate);
    const cf = await getCashFlowStatement(orgId, startDate, endDate);

    const rev = kobo(current.totalRevenue);
    const cos = kobo(current.costOfSales?.total);
    const gp = kobo(current.grossProfit);
    const opex = kobo(current.totalOperatingExpenses);
    const np = kobo(current.netProfit);

    const response = `Your financial position for the period ${fmtDate(startDate)} through ${fmtDate(endDate)}:

INCOME STATEMENT
Revenue: ${fmtNaira(rev)}
Cost of Sales: ${fmtNaira(cos)}
Gross Profit: ${fmtNaira(gp)} (${pct(gp, rev)}% margin)
Operating Expenses: ${fmtNaira(opex)}
Net Profit: ${fmtNaira(np)} (${pct(np, rev)}% net margin)

BALANCE SHEET HIGHLIGHTS
${bs?.sections ? bs.sections.map((s: any) => `${s.label}: ${fmtNaira(kobo(s.total))}`).join('\n') : 'No balance sheet data available.'}

CASH FLOW SUMMARY
${cf?.current ? `Operating: ${fmtNaira(kobo(cf.current.netCashFromOperatingActivities))}
Investing: ${fmtNaira(kobo(cf.current.netCashFromInvestingActivities))}
Financing: ${fmtNaira(kobo(cf.current.netCashFromFinancingActivities))}
Net Change: ${fmtNaira(kobo(cf.current.netCashChange))}` : 'No cash flow data available.'}`;

    return { response, data: { pnl: current, balanceSheet: bs, cashFlow: cf } };
  }

  private async explainTrialBalance(orgId: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date('2000-01-01');
    const tbRows = await getTrialBalance(orgId, startDate, now);

    const totalDr = tbRows.reduce((s: number, r: any) => s + kobo(r.closingDebit), 0);
    const totalCr = tbRows.reduce((s: number, r: any) => s + kobo(r.closingCredit), 0);
    const diff = totalDr - totalCr;

    const topRows = tbRows
      .filter((r: any) => Math.abs(kobo(r.closingDebit) - kobo(r.closingCredit)) > 0)
      .slice(0, 15)
      .map((r: any) => `${r.accountCode} ${r.accountName}: ${fmtNaira(kobo(r.closingDebit) - kobo(r.closingCredit))}`);

    const balanceNote = Math.abs(diff) < 1
      ? 'Your trial balance is in balance — total debits equal total credits.'
      : `Your trial balance has a difference of ${fmtNaira(Math.abs(diff))} (${diff >= 0 ? 'debit' : 'credit'} side larger). This may indicate a posting error or missing entry.`;

    const response = `${balanceNote}

TRIAL BALANCE SUMMARY
Total Debits: ${fmtNaira(totalDr)}
Total Credits: ${fmtNaira(totalCr)}
Account Count: ${tbRows.length}

TOP ACCOUNTS BY BALANCE
${topRows.join('\n') || 'No accounts with balances found.'}`;

    return { response, data: { totalDr, totalCr, difference: diff, accountCount: tbRows.length } };
  }

  private async predictCashFlow(orgId: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const endDate = now;
    const metrics = await getDashboardMetrics(orgId, startDate, endDate);

    const avgInflow = metrics.revenueTrend.length > 0
      ? metrics.revenueTrend.reduce((s: any, t: any) => s + kobo(t.value), 0) / metrics.revenueTrend.length
      : 0;
    const avgOutflow = metrics.expenseTrend.length > 0
      ? metrics.expenseTrend.reduce((s: any, t: any) => s + kobo(t.value), 0) / metrics.expenseTrend.length
      : 0;
    const netMonthly = avgInflow - avgOutflow;
    const cashRunway = avgOutflow > 0 && metrics.cashPosition > 0
      ? Math.round(metrics.cashPosition / (avgOutflow / 30))
      : 0;

    const response = `CASH FLOW ANALYSIS

Current Position: You have ${fmtNaira(metrics.cashPosition)} in cash with working capital of ${fmtNaira(metrics.workingCapital)}.

Monthly Trends: Average monthly inflow is ${fmtNaira(Math.round(avgInflow))}, average outflow is ${fmtNaira(Math.round(avgOutflow))}, resulting in a net ${netMonthly >= 0 ? 'surplus' : 'burn'} of ${fmtNaira(Math.round(Math.abs(netMonthly)))} per month.

Runway: At your current burn rate, you have approximately ${cashRunway} days of cash runway remaining.

Efficiency Metrics:
- AR Days: ${metrics.arDays} days to collect receivables
- AP Days: ${metrics.apDays} days to pay suppliers
- Cash Conversion Cycle: ${metrics.cashConversionCycle} days

CASH FORECAST
${(metrics.cashForecast || []).map((m: any) => `${m.month}: In ${fmtNaira(m.inflows)} / Out ${fmtNaira(m.outflows)} / Balance ${fmtNaira(m.balance)}`).join('\n') || 'No forecast data available.'}`;

    return { response, data: { cashPosition: metrics.cashPosition, cashFlow: metrics.cashFlow, forecast: metrics.cashForecast, cashRunway } };
  }

  private async detectFraud(orgId: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const findings: string[] = [];
    let totalFlags = 0;

    const roundTxns = await db
      .select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, now),
          sql`${journalLines.debitAmount} > 0 AND ${journalLines.debitAmount} % 100000 = 0 AND ${journalLines.debitAmount} >= 500000`,
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        )
      );
    if (kobo(roundTxns[0]?.count) > 10) {
      findings.push(`Round-amount transactions: ${roundTxns[0]?.count} transactions totaling ${fmtNaira(kobo(roundTxns[0]?.total))} in round hundreds of thousands.`);
      totalFlags += kobo(roundTxns[0]?.count);
    }

    const dupJEs = await db
      .select({ count: sql<number>`count(*)`, date: journalEntries.date, amount: journalLines.debitAmount })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, now),
          sql`${journalLines.debitAmount} > 0`,
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        )
      )
      .groupBy(journalEntries.date, journalLines.debitAmount)
      .having(sql`count(*) > 3`);
    if (dupJEs.length > 0) {
      findings.push(`Duplicate journal entries: ${dupJEs.length} instances of identical amounts posted on the same date.`);
      totalFlags += dupJEs.length;
    }

    const weekendTxns = await db
      .select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, now),
          sql`EXTRACT(DOW FROM ${journalEntries.date}) IN (0, 6)`,
          sql`${journalLines.debitAmount} > 0`,
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        )
      );
    if (kobo(weekendTxns[0]?.count) > 5) {
      findings.push(`Weekend transactions: ${weekendTxns[0]?.count} transactions (${fmtNaira(kobo(weekendTxns[0]?.total))}) posted on weekends.`);
      totalFlags += kobo(weekendTxns[0]?.count);
    }

    const avgResult = await db
      .select({ avg: sql<number>`coalesce(avg(${journalLines.debitAmount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, now),
          sql`${journalLines.debitAmount} > 0`,
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        )
      );
    const avgAmount = kobo(avgResult[0]?.avg);
    if (avgAmount > 0) {
      const largeThreshold = avgAmount * 2;
      const [largeResult] = await db
        .select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)` })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(
          and(
            eq(journalEntries.orgId, orgId),
            gte(journalEntries.date, startDate),
            lte(journalEntries.date, now),
            sql`${journalLines.debitAmount} > ${largeThreshold}`,
            sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
          )
        );
      if (kobo(largeResult?.count) > 0) {
        findings.push(`Large transactions: ${largeResult?.count} transactions exceeding ${fmtNaira(Math.round(largeThreshold))} (2x average).`);
        totalFlags += kobo(largeResult?.count);
      }
    }

    const summary = findings.length === 0
      ? 'No suspicious patterns were detected in your transactions over the last 3 months. Your accounts appear clean.'
      : `I detected ${totalFlags} potential red flags that may warrant review:

${findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Recommendation: Review each flagged item and investigate further if needed.`;

    return { response: `FRAUD DETECTION ANALYSIS (last 3 months)

${summary}`, data: { findings, totalFlags } };
  }

  private async detectDuplicates(orgId: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const duplicates: any[] = [];

    const recentExpenses = await db
      .select({ id: paymentsMade.id, amount: paymentsMade.amount, date: paymentsMade.date, reference: paymentsMade.reference })
      .from(paymentsMade)
      .where(
        and(
          eq(paymentsMade.orgId, orgId),
          gte(paymentsMade.date, startDate),
          lte(paymentsMade.date, now),
          sql`${paymentsMade.status} NOT IN ('draft', 'cancelled')`
        )
      )
      .orderBy(desc(paymentsMade.date));

    for (let i = 0; i < recentExpenses.length; i++) {
      for (let j = i + 1; j < recentExpenses.length; j++) {
        const a = recentExpenses[i];
        const b = recentExpenses[j];
        const amountDiff = Math.abs(kobo(a.amount) - kobo(b.amount));
        const daysDiff = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) / (1000 * 60 * 60 * 24);
        if (amountDiff <= 100000 && daysDiff <= 7) {
          duplicates.push({ amount1: kobo(a.amount), amount2: kobo(b.amount), date1: fmtDate(a.date), date2: fmtDate(b.date), ref1: a.reference || '', ref2: b.reference || '' });
          if (duplicates.length >= 15) break;
        }
      }
      if (duplicates.length >= 15) break;
    }

    const response = duplicates.length === 0
      ? `DUPLICATE EXPENSE ANALYSIS (last 6 months)

No potential duplicate expenses were found in your payment records. Your expense data looks clean.`
      : `DUPLICATE EXPENSE ANALYSIS (last 6 months)

Found ${duplicates.length} potential duplicate payment(s):

${duplicates.slice(0, 10).map((d, i) => `${i + 1}. ${fmtNaira(d.amount1)} on ${d.date1} and ${fmtNaira(d.amount2)} on ${d.date2}`).join('\n')}

Recommendation: Review these pairs and reverse any that are confirmed duplicates.`;

    return { response, data: { duplicatesFound: duplicates.length, duplicates: duplicates.slice(0, 10) } };
  }

  private async generateManagementReport(orgId: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const endDate = now;
    const fyStart = new Date(now.getFullYear(), 0, 1);

    const pnl = await getProfitAndLoss(orgId, fyStart, endDate);
    const current = pnl?.current || {};
    const metrics = await getDashboardMetrics(orgId, fyStart, endDate);

    const rev = kobo(current.totalRevenue);
    const gp = kobo(current.grossProfit);
    const np = kobo(current.netProfit);

    const response = `MANAGEMENT REPORT — ${fmtDate(fyStart)} to ${fmtDate(endDate)}

EXECUTIVE SUMMARY
Revenue: ${fmtNaira(rev)}
Gross Profit: ${fmtNaira(gp)} (${pct(gp, rev)}% margin)
Net Profit: ${fmtNaira(np)} (${pct(np, rev)}% net margin)

KEY FINANCIAL RATIOS
Current Ratio: ${metrics.currentRatio?.toFixed(2) || 'N/A'}
Quick Ratio: ${metrics.quickRatio?.toFixed(2) || 'N/A'}
AR Days: ${metrics.arDays || 'N/A'} days
AP Days: ${metrics.apDays || 'N/A'} days
Cash Conversion Cycle: ${metrics.cashConversionCycle || 'N/A'} days

CASH & WORKING CAPITAL
Cash Position: ${fmtNaira(metrics.cashPosition)}
Working Capital: ${fmtNaira(metrics.workingCapital)}
Tax Payable: ${fmtNaira(metrics.taxPayable)}

OUTSTANDING ITEMS
Invoices: ${metrics.outstandingInvoices?.count || 0} (${fmtNaira(metrics.outstandingInvoices?.total || 0)})
Bills: ${metrics.outstandingBills?.count || 0} (${fmtNaira(metrics.outstandingBills?.total || 0)})`;

    return { response, data: { pnl: current, metrics } };
  }

  private async suggestJournalEntry(orgId: string, query: string): Promise<{ response: string; data: any }> {
    const orgAccounts = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type, subType: accounts.subType })
      .from(accounts)
      .where(eq(accounts.orgId, orgId));

    const accountsList = orgAccounts
      .filter(a => a.code && a.name)
      .slice(0, 60)
      .map(a => `  ${a.code} ${a.name} (${a.type}${a.subType ? ' — ' + a.subType : ''})`)
      .join('\n');

    const response = `JOURNAL ENTRY SUGGESTION

Based on your request: "${query}"

Your chart of accounts has ${orgAccounts.length} accounts. Here are the available accounts to construct your journal entry:

${accountsList || 'No accounts available.'}

To create a journal entry, you need:
1. A date for the transaction
2. At least one account to debit and one to credit
3. The amount(s) in Naira
4. A clear narrative description

You can create this journal entry manually from the Journals page, or provide more details about the transaction type (e.g., purchase, sale, depreciation, expense accrual) and I can give a more specific suggestion.`;

    return { response, data: { accountsCount: orgAccounts.length } };
  }

  private async explainIFRS(orgId: string): Promise<{ response: string; data: any }> {
    const orgAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.orgId, orgId));

    const accountTypes = orgAccounts.reduce((acc: any, a: any) => {
      if (!acc[a.type]) acc[a.type] = 0;
      acc[a.type]++;
      return acc;
    }, {});

    const hasLease = orgAccounts.some((a: any) => a.code?.startsWith('2011') || a.code?.startsWith('2012') || a.code === '304000');
    const hasRevenueRecognition = orgAccounts.some((a: any) => a.code === '101050' || a.systemAccountRole === 'contract_asset');
    const hasEcl = orgAccounts.some((a: any) => a.code?.startsWith('206'));

    const features = [
      hasLease ? '- IFRS 16 Leases: Your organisation has lease accounts set up (ROU assets and lease liabilities). Ensure lease contracts are recognised on the balance sheet with corresponding depreciation and interest expense.' : '- IFRS 16 Leases: No lease accounts detected. If you have leases, consider setting up the lease accounting module.',
      hasRevenueRecognition ? '- IFRS 15 Revenue Recognition: Contract asset accounts are present. Ensure revenue from contracts with customers is recognised when performance obligations are satisfied.' : '- IFRS 15 Revenue Recognition: No contract asset accounts detected. Review if you have long-term contracts requiring revenue recognition over time.',
      hasEcl ? '- IFRS 9 ECL: Impairment accounts are present. Ensure expected credit losses are measured on your financial assets.' : '- IFRS 9 ECL: No impairment accounts detected. Review if you need to provide for expected credit losses.',
    ];

    const response = `IFRS REPORTING IMPACT ANALYSIS

Your organisation has ${orgAccounts.length} accounts configured across these categories:
${Object.entries(accountTypes).map(([t, c]) => `  ${t}: ${c}`).join('\n')}

RELEVANT IFRS STANDARDS
${features.join('\n')}

For specific guidance on any IFRS standard, please consult a professional accountant. This analysis is based on your account structure and not a full compliance review.`;

    return { response, data: { accountTypes, hasLease, hasRevenueRecognition } };
  }

  private async summarizeMonthly(orgId: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const currentPnl = await getProfitAndLoss(orgId, currentMonthStart, now);
    const priorPnl = await getProfitAndLoss(orgId, priorMonthStart, currentMonthStart);
    const current = currentPnl?.current || {};
    const prior = priorPnl?.current || {};
    const metrics = await getDashboardMetrics(orgId, currentMonthStart, now);

    const cRev = kobo(current.totalRevenue);
    const cExp = kobo(current.totalOperatingExpenses);
    const cNp = kobo(current.netProfit);
    const pRev = kobo(prior.totalRevenue);
    const pNp = kobo(prior.netProfit);

    const revChange = pRev > 0 ? ((cRev - pRev) / pRev * 100).toFixed(1) : 'N/A';
    const npChange = pNp > 0 ? ((cNp - pNp) / pNp * 100).toFixed(1) : 'N/A';

    const response = `MONTHLY PERFORMANCE SUMMARY
Period: ${fmtDate(currentMonthStart)} — ${fmtDate(now)}

CURRENT MONTH
Revenue: ${fmtNaira(cRev)}
Expenses: ${fmtNaira(cExp)}
Net Profit: ${fmtNaira(cNp)}

VS PRIOR MONTH
Revenue Change: ${revChange === 'N/A' ? 'N/A' : `${direction(cRev - pRev)}${revChange}%`}
Profit Change: ${npChange === 'N/A' ? 'N/A' : `${direction(cNp - pNp)}${npChange}%`}

CASH POSITION
Cash: ${fmtNaira(metrics.cashPosition)}
Working Capital: ${fmtNaira(metrics.workingCapital)}`;

    return { response, data: { current, prior, metrics } };
  }

  private async executiveInsights(orgId: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const fyStart = new Date(now.getFullYear(), 0, 1);

    const metrics = await getDashboardMetrics(orgId, fyStart, now);
    const pnl = await getProfitAndLoss(orgId, fyStart, now);
    const current = pnl?.current || {};

    const rev = kobo(current.totalRevenue);
    const np = kobo(current.netProfit);
    const margin = rev > 0 ? (np / rev * 100).toFixed(1) : '0';

    const trends = metrics.profitTrend?.slice(-6) || [];
    const profitGrowth = trends.length >= 2
      ? ((kobo(trends[trends.length - 1]?.value) - kobo(trends[0]?.value)) / (Math.abs(kobo(trends[0]?.value)) || 1)) * 100
      : 0;

    const response = `EXECUTIVE INSIGHTS — ${fmtDate(fyStart)} to ${fmtDate(now)}

FINANCIAL HEALTH
Revenue: ${fmtNaira(rev)}
Net Profit: ${fmtNaira(np)}
Net Margin: ${margin}%
Profit Trend (6mo): ${profitGrowth >= 0 ? '+' : ''}${profitGrowth.toFixed(1)}%

LIQUIDITY
Cash Position: ${fmtNaira(metrics.cashPosition)}
Working Capital: ${fmtNaira(metrics.workingCapital)}
Current Ratio: ${metrics.currentRatio?.toFixed(2) || 'N/A'}

EFFICIENCY
AR Days: ${metrics.arDays || 'N/A'} days to collect
AP Days: ${metrics.apDays || 'N/A'} days to pay
Cash Conversion Cycle: ${metrics.cashConversionCycle || 'N/A'} days

RISK INDICATORS
Tax Payable: ${fmtNaira(metrics.taxPayable)}
Overdue Customers: ${metrics.overdueCustomers?.length || 0}
Upcoming Bills: ${metrics.upcomingBills?.length || 0}
Outstanding Receivables: ${fmtNaira(metrics.totalReceivables)}
Outstanding Payables: ${fmtNaira(metrics.totalPayables)}`;

    return { response, data: { metrics, profitGrowth } };
  }

  private async queryData(orgId: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    const endDate = now;

    const metrics = await getDashboardMetrics(orgId, startDate, endDate);
    const pnl = await getProfitAndLoss(orgId, startDate, endDate);
    const current = pnl?.current || {};
    const tbRows = await getTrialBalance(orgId, startDate, endDate);

    const totalDr = tbRows.reduce((s: number, r: any) => s + kobo(r.closingDebit), 0);
    const totalCr = tbRows.reduce((s: number, r: any) => s + kobo(r.closingCredit), 0);

    const response = `Here is a snapshot of your accounting data for ${fmtDate(startDate)} to ${fmtDate(endDate)}:

INCOME STATEMENT
Revenue: ${fmtNaira(kobo(current.totalRevenue))}
Gross Profit: ${fmtNaira(kobo(current.grossProfit))}
Net Profit: ${fmtNaira(kobo(current.netProfit))}

BALANCE SHEET HIGHLIGHTS
Cash: ${fmtNaira(metrics.cashPosition)}
Receivables: ${fmtNaira(metrics.totalReceivables)}
Payables: ${fmtNaira(metrics.totalPayables)}
Working Capital: ${fmtNaira(metrics.workingCapital)}

KEY METRICS
Current Ratio: ${metrics.currentRatio?.toFixed(2) || 'N/A'}
Gross Margin: ${metrics.grossMargin?.toFixed(1) || 'N/A'}%
AR Days: ${metrics.arDays || 'N/A'} days
AP Days: ${metrics.apDays || 'N/A'} days

TRIAL BALANCE: ${fmtNaira(totalDr)} Debits = ${fmtNaira(totalCr)} Credits
Outstanding Invoices: ${metrics.outstandingInvoices?.count || 0} worth ${fmtNaira(metrics.outstandingInvoices?.total || 0)}
Outstanding Bills: ${metrics.outstandingBills?.count || 0} worth ${fmtNaira(metrics.outstandingBills?.total || 0)}`;
    return { response, data: { metrics } };
  }
}

export const accountingAssistant = new AccountingAssistant();
