/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { eq, and, sql, gte, lte, desc, sum as drizzleSum } from 'drizzle-orm';
import { db, accounts, journalEntries, journalLines, bankAccounts, contacts, invoices, bills, paymentsReceived, paymentsMade, auditLog } from '../db/schema';
import { getTrialBalance, getProfitAndLoss, getBalanceSheet, getCashFlowStatement } from './ledger.service';
import { getDashboardMetrics } from './dashboard.service';
import { createAuditLog, extractReqMeta } from './audit.service';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'gemini-2.0-flash';

function kobo(n: any): number {
  const v = Number(n);
  return isNaN(v) ? 0 : v;
}

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
  private genAI: GoogleGenAI | null = null;

  constructor() {
    if (GEMINI_API_KEY) {
      this.genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    }
  }

  private async callLLM(prompt: string, systemInstruction?: string): Promise<string> {
    if (!this.genAI) {
      return 'AI Assistant is not configured. Please set the GEMINI_API_KEY environment variable.';
    }
    try {
      const result = await this.genAI.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: systemInstruction
            ? { role: 'user', parts: [{ text: systemInstruction }] }
            : undefined,
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      });
      return result.text || 'No response generated.';
    } catch (err: any) {
      console.error('Gemini API error:', err.message);
      return `I encountered an error processing your request: ${err.message}. Please try again.`;
    }
  }

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
          { const r = await this.explainFinancials(orgId, userId, query); response = r.response; data = r.data; }
          break;
        case 'explain-trial-balance':
          { const r = await this.explainTrialBalance(orgId, userId, query); response = r.response; data = r.data; }
          break;
        case 'predict-cash-flow':
          { const r = await this.predictCashFlow(orgId, userId, query); response = r.response; data = r.data; }
          break;
        case 'detect-fraud':
          { const r = await this.detectFraud(orgId, userId, query); response = r.response; data = r.data; }
          break;
        case 'detect-duplicates':
          { const r = await this.detectDuplicates(orgId, userId, query); response = r.response; data = r.data; }
          break;
        case 'generate-report':
          { const r = await this.generateManagementReport(orgId, userId, query); response = r.response; data = r.data; }
          break;
        case 'suggest-journal':
          { const r = await this.suggestJournalEntry(orgId, userId, query); response = r.response; data = r.data; }
          break;
        case 'explain-ifrs':
          { const r = await this.explainIFRS(orgId, userId, query); response = r.response; data = r.data; }
          break;
        case 'summarize-month':
          { const r = await this.summarizeMonthly(orgId, userId, query); response = r.response; data = r.data; }
          break;
        case 'executive-insights':
          { const r = await this.executiveInsights(orgId, userId, query); response = r.response; data = r.data; }
          break;
        default:
          { const r = await this.queryData(orgId, userId, query); response = r.response; data = r.data; }
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

  // ─── Capability Handlers ───

  private async explainFinancials(orgId: string, userId: string, query: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    const endDate = now;

    const pnl = await getProfitAndLoss(orgId, startDate, endDate);
    const current = pnl?.current || {};
    const bs = await getBalanceSheet(orgId, endDate);
    const cf = await getCashFlowStatement(orgId, startDate, endDate);

    const financialContext = `
INCOME STATEMENT (${fmtDate(startDate)} – ${fmtDate(endDate)}):
- Total Revenue: ${fmtNaira(kobo(current.totalRevenue))}
- Cost of Sales: ${fmtNaira(kobo(current.costOfSales?.total))}
- Gross Profit: ${fmtNaira(kobo(current.grossProfit))}
- Operating Expenses: ${fmtNaira(kobo(current.totalOperatingExpenses))}
- Operating Profit: ${fmtNaira(kobo(current.operatingProfit))}
- Net Profit: ${fmtNaira(kobo(current.netProfit))}
- Gross Margin: ${current.totalRevenue > 0 ? ((kobo(current.grossProfit) / kobo(current.totalRevenue)) * 100).toFixed(1) : '0'}%
- Net Margin: ${current.totalRevenue > 0 ? ((kobo(current.netProfit) / kobo(current.totalRevenue)) * 100).toFixed(1) : '0'}%

BALANCE SHEET (as at ${fmtDate(endDate)}):
${this.formatBalanceSheetSections(bs)}

CASH FLOW (${fmtDate(startDate)} – ${fmtDate(endDate)}):
${this.formatCashFlow(cf)}
`;

    const systemPrompt = 'You are a professional accountant and financial analyst. Explain the financial statements clearly in simple terms. Focus on key takeaways, trends, and areas needing attention. Use Nigerian Naira (₦) amounts.';
    const llmPrompt = `The user asks: "${query}"\n\nHere is the financial data:\n${financialContext}\n\nProvide a clear, insightful explanation of these financial statements addressing the user's question.`;
    const response = await this.callLLM(llmPrompt, systemPrompt);
    return { response, data: { pnl: current, balanceSheet: bs, cashFlow: cf } };
  }

  private async explainTrialBalance(orgId: string, userId: string, query: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date('2000-01-01');
    const tbRows = await getTrialBalance(orgId, startDate, now);

    const totalDr = tbRows.reduce((s: number, r: any) => s + kobo(r.closingDebit), 0);
    const totalCr = tbRows.reduce((s: number, r: any) => s + kobo(r.closingCredit), 0);
    const difference = totalDr - totalCr;

    const topRows = tbRows
      .filter((r: any) => Math.abs(kobo(r.closingDebit) - kobo(r.closingCredit)) > 0)
      .slice(0, 30)
      .map((r: any) => `${r.accountCode} ${r.accountName}: Dr ${fmtNaira(kobo(r.closingDebit))} | Cr ${fmtNaira(kobo(r.closingCredit))} | Balance ${fmtNaira(kobo(r.closingDebit) - kobo(r.closingCredit))}`)
      .join('\n');

    const tbContext = `
TRIAL BALANCE SUMMARY:
Total Debits: ${fmtNaira(totalDr)}
Total Credits: ${fmtNaira(totalCr)}
Difference: ${fmtNaira(Math.abs(difference))} (${difference >= 0 ? 'Debit' : 'Credit'} side larger)

TOP ACCOUNTS (by balance):
${topRows}
`;

    const systemPrompt = 'You are a professional accountant. Analyze the trial balance and explain any differences, unusual balances, or notable items. Provide actionable insights.';
    const llmPrompt = `The user asks: "${query}"\n\nHere is the Trial Balance data:\n${tbContext}\n\nAnalyze the trial balance and explain what the user is asking about.`;
    const response = await this.callLLM(llmPrompt, systemPrompt);
    return { response, data: { totalDr, totalCr, difference, accountCount: tbRows.length } };
  }

  private async predictCashFlow(orgId: string, userId: string, query: string): Promise<{ response: string; data: any }> {
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
    const cashRunway = avgOutflow > 0 && metrics.cashPosition > 0
      ? Math.round(metrics.cashPosition / (avgOutflow / 30))
      : 0;

    const cashContext = `
CURRENT CASH POSITION: ${fmtNaira(metrics.cashPosition)}
WORKING CAPITAL: ${fmtNaira(metrics.workingCapital)}
CASH FLOW (operating): ${fmtNaira(metrics.cashFlow)}
AVERAGE MONTHLY INFLOW: ${fmtNaira(Math.round(avgInflow))}
AVERAGE MONTHLY OUTFLOW: ${fmtNaira(Math.round(avgOutflow))}
NET MONTHLY BURN: ${fmtNaira(Math.round(avgInflow - avgOutflow))}
ESTIMATED CASH RUNWAY: ${cashRunway} days
AR DAYS: ${metrics.arDays}
AP DAYS: ${metrics.apDays}
INVENTORY DAYS: ${metrics.inventoryDays}
CASH CONVERSION CYCLE: ${metrics.cashConversionCycle} days

CASH FORECAST (next 6 months):
${(metrics.cashForecast || []).map((m: any) => `  ${m.month}: In ${fmtNaira(m.inflows)} | Out ${fmtNaira(m.outflows)} | Net ${fmtNaira(m.net)} | Balance ${fmtNaira(m.balance)}`).join('\n')}
`;

    const systemPrompt = 'You are a financial analyst specializing in cash flow forecasting. Provide clear analysis of the cash position and future projections. Highlight risks and opportunities.';
    const llmPrompt = `The user asks: "${query}"\n\nHere is the cash flow data:\n${cashContext}\n\nProvide a cash flow analysis and forecast addressing the user's question.`;
    const response = await this.callLLM(llmPrompt, systemPrompt);
    return { response, data: { cashPosition: metrics.cashPosition, cashFlow: metrics.cashFlow, forecast: metrics.cashForecast, cashRunway } };
  }

  private async detectFraud(orgId: string, userId: string, query: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const findings: string[] = [];
    let totalFlags = 0;

    // 1. Round amount transactions
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
      findings.push(`Found ${roundTxns[0]?.count} round-amount transactions totaling ${fmtNaira(kobo(roundTxns[0]?.total))} (amounts in round hundreds of thousands) in the last 3 months.`);
      totalFlags += kobo(roundTxns[0]?.count);
    }

    // 2. Duplicate journal entries (same amount on same day)
    const dupJEs = await db
      .select({
        count: sql<number>`count(*)`,
        date: journalEntries.date,
        amount: journalLines.debitAmount,
      })
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
      findings.push(`Found ${dupJEs.length} instances of multiple entries with identical amounts on the same date — potential duplicate posting.`);
      totalFlags += dupJEs.length;
    }

    // 3. Weekend/holiday transactions
    const weekendTxns = await db
      .select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, now),
          sql`EXTRACT(DOW FROM ${journalEntries.date}) IN (0, 6)`, // Sunday=0, Saturday=6
          sql`${journalLines.debitAmount} > 0`,
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        )
      );
    if (kobo(weekendTxns[0]?.count) > 5) {
      findings.push(`Found ${weekendTxns[0]?.count} transactions (${fmtNaira(kobo(weekendTxns[0]?.total))}) posted on weekends.`);
      totalFlags += kobo(weekendTxns[0]?.count);
    }

    // 4. Unusual large transactions (> 2x average)
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
        findings.push(`Found ${largeResult?.count} transactions exceeding ${fmtNaira(Math.round(largeThreshold))} (2x average transaction size).`);
        totalFlags += kobo(largeResult?.count);
      }
    }

    const fraudContext = `FRAUD DETECTION ANALYSIS (last 3 months):
Total flags raised: ${totalFlags}
${findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}
${findings.length === 0 ? 'No suspicious patterns detected.' : ''}`;

    const systemPrompt = 'You are a forensic accountant specializing in fraud detection. Analyze potential red flags and provide risk assessment. Be professional and precise.';
    const llmPrompt = `The user asks: "${query}"\n\n${fraudContext}\n\nProvide a fraud risk assessment addressing the user's question.`;
    const response = await this.callLLM(llmPrompt, systemPrompt);
    return { response, data: { findings, totalFlags } };
  }

  private async detectDuplicates(orgId: string, userId: string, query: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const duplicates: any[] = [];

    // Check expenses for same amount + similar description in close timeframe
    const recentExpenses = await db
      .select({
        id: paymentsMade.id,
        amount: paymentsMade.amount,
        date: paymentsMade.date,
        reference: paymentsMade.reference,
      })
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
          duplicates.push({
            id1: a.id, id2: b.id,
            amount1: kobo(a.amount), amount2: kobo(b.amount),
            date1: fmtDate(a.date), date2: fmtDate(b.date),
            ref1: a.reference || '', ref2: b.reference || '',
            similarity: 'high',
          });
          if (duplicates.length >= 15) break;
        }
      }
      if (duplicates.length >= 15) break;
    }

    const dupContext = `DUPLICATE EXPENSE ANALYSIS (last 6 months):
Found ${duplicates.length} potential duplicate payment(s).
${duplicates.slice(0, 10).map((d, i) =>
  `  ${i + 1}. ${fmtNaira(d.amount1)} on ${d.date1} vs ${fmtNaira(d.amount2)} on ${d.date2} — ${d.daysDiff.toFixed(0)} days apart`).join('\n')}
${duplicates.length === 0 ? 'No potential duplicate expenses detected.' : ''}`;

    const systemPrompt = 'You are an accounting analyst. Identify and explain potential duplicate expenses, providing recommendations for investigation and prevention.';
    const llmPrompt = `The user asks: "${query}"\n\n${dupContext}\n\nAnalyze the duplicate expense findings and address the user's question.`;
    const response = await this.callLLM(llmPrompt, systemPrompt);
    return { response, data: { duplicatesFound: duplicates.length, duplicates: duplicates.slice(0, 10) } };
  }

  private async generateManagementReport(orgId: string, userId: string, query: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = now;
    const fyStart = new Date(now.getFullYear(), 0, 1);

    const pnl = await getProfitAndLoss(orgId, fyStart, endDate);
    const current = pnl?.current || {};
    const metrics = await getDashboardMetrics(orgId, startDate, endDate);

    const reportContext = `
MANAGEMENT REPORT — ${fmtDate(fyStart)} to ${fmtDate(endDate)}

FINANCIAL HIGHLIGHTS:
- Revenue: ${fmtNaira(kobo(current.totalRevenue))}
- Cost of Sales: ${fmtNaira(kobo(current.costOfSales?.total))}
- Gross Profit: ${fmtNaira(kobo(current.grossProfit))} (${current.totalRevenue > 0 ? ((kobo(current.grossProfit) / kobo(current.totalRevenue)) * 100).toFixed(1) : 0}%)
- Operating Expenses: ${fmtNaira(kobo(current.totalOperatingExpenses))}
- Net Profit: ${fmtNaira(kobo(current.netProfit))} (${current.totalRevenue > 0 ? ((kobo(current.netProfit) / kobo(current.totalRevenue)) * 100).toFixed(1) : 0}%)

KEY RATIOS:
- Current Ratio: ${metrics.currentRatio?.toFixed(2) || 'N/A'}
- Quick Ratio: ${metrics.quickRatio?.toFixed(2) || 'N/A'}
- AR Days: ${metrics.arDays || 'N/A'}
- AP Days: ${metrics.apDays || 'N/A'}
- Cash Conversion Cycle: ${metrics.cashConversionCycle || 'N/A'} days

CASH POSITION: ${fmtNaira(metrics.cashPosition)}
WORKING CAPITAL: ${fmtNaira(metrics.workingCapital)}
TAX PAYABLE: ${fmtNaira(metrics.taxPayable)}
OUTSTANDING INVOICES: ${metrics.outstandingInvoices?.count || 0} (${fmtNaira(metrics.outstandingInvoices?.total || 0)})
OUTSTANDING BILLS: ${metrics.outstandingBills?.count || 0} (${fmtNaira(metrics.outstandingBills?.total || 0)})
`;

    const systemPrompt = 'You are a management accountant preparing an executive report. Generate a professional, concise management report with clear sections: Executive Summary, Financial Performance, Key Ratios, Cash Position, and Recommendations. Use Nigerian context.';
    const llmPrompt = `The user asks: "${query}"\n\nHere is the financial data:\n${reportContext}\n\nGenerate a comprehensive management report addressing the user's request.`;
    const response = await this.callLLM(llmPrompt, systemPrompt);
    return { response, data: { pnl: current, metrics } };
  }

  private async suggestJournalEntry(orgId: string, userId: string, query: string): Promise<{ response: string; data: any }> {
    const orgAccounts = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type, subType: accounts.subType })
      .from(accounts)
      .where(eq(accounts.orgId, orgId));

    const accountsList = orgAccounts
      .filter(a => a.code && a.name)
      .slice(0, 100)
      .map(a => `${a.code} ${a.name} (${a.type}${a.subType ? ' — ' + a.subType : ''})`)
      .join('\n');

    const journalContext = `
AVAILABLE ACCOUNTS (${orgAccounts.length} total, showing first 100):
${accountsList}

The user wants a journal entry for: "${query}"
`;

    const systemPrompt = 'You are a professional accountant. Suggest appropriate journal entries based on the user\'s description. Include: Date, Accounts to Debit and Credit (with codes), Amounts in Naira (₦), and a clear narrative explanation. Ensure entries follow double-entry bookkeeping and IFRS standards.';
    const llmPrompt = `${journalContext}\n\nSuggest appropriate journal entries for the user's request.`;
    const response = await this.callLLM(llmPrompt, systemPrompt);
    return { response, data: { accountsCount: orgAccounts.length } };
  }

  private async explainIFRS(orgId: string, userId: string, query: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date('2000-01-01');
    const tbRows = await getTrialBalance(orgId, startDate, now);
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

    const ifrsContext = `
ORGANISATION ACCOUNT STRUCTURE:
Total accounts: ${orgAccounts.length}
${Object.entries(accountTypes).map(([t, c]) => `  ${t}: ${c}`).join('\n')}

IFRS-RELEVANT FEATURES DETECTED:
${hasLease ? '- IFRS 16 Leases: ROU asset and lease liability accounts present' : '- No IFRS 16 lease accounts detected'}
${hasRevenueRecognition ? '- IFRS 15 Revenue Recognition: Contract asset account present' : '- No IFRS 15 revenue recognition accounts detected'}
${hasEcl ? '- IFRS 9 ECL: Impairment/allowance accounts present' : '- No IFRS 9 ECL accounts detected'}

The user asks: "${query}"
`;

    const systemPrompt = 'You are an IFRS expert accountant. Explain International Financial Reporting Standards impacts clearly, relating them to the organisation\'s specific account structure. Provide practical guidance on compliance and implementation.';
    const llmPrompt = `${ifrsContext}\n\nExplain the IFRS impacts relevant to this organisation addressing the user's question.`;
    const response = await this.callLLM(llmPrompt, systemPrompt);
    return { response, data: { accountTypes, hasLease, hasRevenueRecognition } };
  }

  private async summarizeMonthly(orgId: string, userId: string, query: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fyStart = new Date(now.getFullYear(), 0, 1);

    const currentPnl = await getProfitAndLoss(orgId, currentMonthStart, now);
    const priorPnl = await getProfitAndLoss(orgId, priorMonthStart, currentMonthStart);
    const current = currentPnl?.current || {};
    const prior = priorPnl?.current || {};
    const metrics = await getDashboardMetrics(orgId, currentMonthStart, now);

    const monthContext = `
MONTHLY PERFORMANCE SUMMARY
Period: ${fmtDate(currentMonthStart)} – ${fmtDate(now)}

CURRENT MONTH:
- Revenue: ${fmtNaira(kobo(current.totalRevenue))}
- Expenses: ${fmtNaira(kobo(current.totalOperatingExpenses))}
- Net Profit: ${fmtNaira(kobo(current.netProfit))}

PRIOR MONTH:
- Revenue: ${fmtNaira(kobo(prior.totalRevenue))}
- Expenses: ${fmtNaira(kobo(prior.totalOperatingExpenses))}
- Net Profit: ${fmtNaira(kobo(prior.netProfit))}

MONTH-OVER-MONTH CHANGE:
- Revenue: ${prior.totalRevenue > 0 ? (((kobo(current.totalRevenue) - kobo(prior.totalRevenue)) / kobo(prior.totalRevenue)) * 100).toFixed(1) : 'N/A'}%
- Net Profit: ${prior.netProfit > 0 ? (((kobo(current.netProfit) - kobo(prior.netProfit)) / kobo(prior.netProfit)) * 100).toFixed(1) : 'N/A'}%

YEAR TO DATE:
- Revenue: ${fmtNaira(kobo(current.totalRevenue))}
- Net Profit: ${fmtNaira(kobo(current.netProfit))}

CASH POSITION: ${fmtNaira(metrics.cashPosition)}
WORKING CAPITAL: ${fmtNaira(metrics.workingCapital)}
`;

    const systemPrompt = 'You are a management accountant. Provide a concise monthly performance summary comparing current vs prior month, with key highlights, trends, and actionable recommendations.';
    const llmPrompt = `The user asks: "${query}"\n\n${monthContext}\n\nProvide a monthly performance summary addressing the user's question.`;
    const response = await this.callLLM(llmPrompt, systemPrompt);
    return { response, data: { current, prior, metrics } };
  }

  private async executiveInsights(orgId: string, userId: string, query: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const fyStart = new Date(now.getFullYear(), 0, 1);

    const metrics = await getDashboardMetrics(orgId, fyStart, now);
    const pnl = await getProfitAndLoss(orgId, fyStart, now);
    const current = pnl?.current || {};

    const trends = metrics.profitTrend?.slice(-6) || [];
    const profitGrowth = trends.length >= 2
      ? ((kobo(trends[trends.length - 1]?.value) - kobo(trends[0]?.value)) / (Math.abs(kobo(trends[0]?.value)) || 1)) * 100
      : 0;

    const insightContext = `
EXECUTIVE INSIGHTS — ${fmtDate(fyStart)} to ${fmtDate(now)}

FINANCIAL HEALTH:
- Revenue: ${fmtNaira(kobo(current.totalRevenue))}
- Net Profit: ${fmtNaira(kobo(current.netProfit))}
- Net Margin: ${current.totalRevenue > 0 ? ((kobo(current.netProfit) / kobo(current.totalRevenue)) * 100).toFixed(1) : '0'}%
- Profit Trend (6mo): ${profitGrowth >= 0 ? '+' : ''}${profitGrowth.toFixed(1)}%

LIQUIDITY:
- Cash Position: ${fmtNaira(metrics.cashPosition)}
- Working Capital: ${fmtNaira(metrics.workingCapital)}
- Current Ratio: ${metrics.currentRatio?.toFixed(2) || 'N/A'}
- Quick Ratio: ${metrics.quickRatio?.toFixed(2) || 'N/A'}

EFFICIENCY:
- AR Days: ${metrics.arDays || 'N/A'}
- AP Days: ${metrics.apDays || 'N/A'}
- Inventory Days: ${metrics.inventoryDays || 'N/A'}
- Cash Conversion Cycle: ${metrics.cashConversionCycle || 'N/A'} days

RISK:
- Tax Payable: ${fmtNaira(metrics.taxPayable)}
- Overdue Customers: ${metrics.overdueCustomers?.length || 0}
- Upcoming Bills: ${metrics.upcomingBills?.length || 0}
- Outstanding Receivables: ${fmtNaira(metrics.totalReceivables)}
- Outstanding Payables: ${fmtNaira(metrics.totalPayables)}
`;

    const systemPrompt = 'You are a CFO-level strategic advisor. Generate high-level executive insights with a focus on strategic direction, risk assessment, and growth opportunities. Be concise and impactful.';
    const llmPrompt = `The user asks: "${query}"\n\n${insightContext}\n\nProvide executive-level strategic insights addressing the user's question.`;
    const response = await this.callLLM(llmPrompt, systemPrompt);
    return { response, data: { metrics, profitGrowth } };
  }

  private async queryData(orgId: string, userId: string, query: string): Promise<{ response: string; data: any }> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    const endDate = now;

    // Fetch context data for general Q&A
    const metrics = await getDashboardMetrics(orgId, startDate, endDate);
    const pnl = await getProfitAndLoss(orgId, startDate, endDate);
    const current = pnl?.current || {};
    const tbRows = await getTrialBalance(orgId, startDate, endDate);

    const totalDr = tbRows.reduce((s: number, r: any) => s + kobo(r.closingDebit), 0);
    const totalCr = tbRows.reduce((s: number, r: any) => s + kobo(r.closingCredit), 0);

    const context = `
COMPREHENSIVE FINANCIAL DATA:

INCOME STATEMENT (${fmtDate(startDate)} – ${fmtDate(endDate)}):
- Revenue: ${fmtNaira(kobo(current.totalRevenue))}
- Gross Profit: ${fmtNaira(kobo(current.grossProfit))}
- Net Profit: ${fmtNaira(kobo(current.netProfit))}

BALANCE SHEET HIGHLIGHTS:
- Cash: ${fmtNaira(metrics.cashPosition)}
- Receivables: ${fmtNaira(metrics.totalReceivables)}
- Payables: ${fmtNaira(metrics.totalPayables)}
- Working Capital: ${fmtNaira(metrics.workingCapital)}

KEY METRICS:
- Current Ratio: ${metrics.currentRatio?.toFixed(2) || 'N/A'}
- Gross Margin: ${metrics.grossMargin?.toFixed(1) || 'N/A'}%
- Net Margin: ${metrics.netMargin?.toFixed(1) || 'N/A'}%
- AR Days: ${metrics.arDays || 'N/A'}
- AP Days: ${metrics.apDays || 'N/A'}
- Cash Conversion Cycle: ${metrics.cashConversionCycle || 'N/A'} days

TRIAL BALANCE: Total Debits ${fmtNaira(totalDr)} = Total Credits ${fmtNaira(totalCr)}
OUTSTANDING INVOICES: ${metrics.outstandingInvoices?.count || 0} worth ${fmtNaira(metrics.outstandingInvoices?.total || 0)}
OUTSTANDING BILLS: ${metrics.outstandingBills?.count || 0} worth ${fmtNaira(metrics.outstandingBills?.total || 0)}
TAX PAYABLE: ${fmtNaira(metrics.taxPayable)}
`;

    const systemPrompt = 'You are an AI accounting assistant integrated into a SaaS accounting system. Answer the user\'s question based on the provided financial data. If you don\'t know something, say so. Use Nigerian Naira (₦) for amounts. Provide clear, professional responses.';
    const llmPrompt = `The user asks: "${query}"\n\nHere is the current financial data for context:\n${context}\n\nAnswer the user's question based on this data.`;
    const response = await this.callLLM(llmPrompt, systemPrompt);
    return { response, data: { metrics } };
  }

  // ─── Helpers ───

  private formatBalanceSheetSections(bs: any): string {
    if (!bs?.sections) return 'No balance sheet data available.';
    return bs.sections.map((s: any) => {
      const subs = (s.subSections || [])
        .map((ss: any) => `    ${ss.label}: ${fmtNaira(kobo(ss.total))}`)
        .join('\n');
      return `  ${s.label}: ${fmtNaira(kobo(s.total))}\n${subs}`;
    }).join('\n');
  }

  private formatCashFlow(cf: any): string {
    if (!cf?.current) return 'No cash flow data available.';
    const c = cf.current;
    return [
      `  Operating Activities: ${fmtNaira(kobo(c.netCashFromOperatingActivities))}`,
      `  Investing Activities: ${fmtNaira(kobo(c.netCashFromInvestingActivities))}`,
      `  Financing Activities: ${fmtNaira(kobo(c.netCashFromFinancingActivities))}`,
      `  Net Cash Change: ${fmtNaira(kobo(c.netCashChange))}`,
    ].join('\n');
  }
}

export const accountingAssistant = new AccountingAssistant();
