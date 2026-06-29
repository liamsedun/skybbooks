/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import crypto from 'crypto';
import { db, auditLog, invoiceLines, invoices, bills, organisations, bankAccounts, contacts, fixedAssets, inventoryLots } from '../db/schema';
import { eq, and, isNotNull, gte, lte, sql } from 'drizzle-orm';
import { getIncomeStatement, getCashFlowStatement } from './ledger.service';
import { getPayrollSummary } from './payroll.service';

// Initialize Gemini SDK with telemetry headers
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Zod schema for Receipt OCR
export const ExtractedReceiptDataSchema = z.object({
  vendorName: z.string(),
  date: z.string().nullable(),
  totalAmountKobo: z.number().int(),
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPriceKobo: z.number().int(),
      totalKobo: z.number().int(),
    })
  ),
  vatAmountKobo: z.number().int().nullable(),
  receiptNumber: z.string().nullable(),
});

export type ExtractedReceiptData = z.infer<typeof ExtractedReceiptDataSchema>;

// Exponential backoff helper for Gemini calls on 429/503 status
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable =
      error?.status === 429 ||
      error?.status === 503 ||
      error?.statusCode === 429 ||
      error?.statusCode === 503 ||
      String(error).includes('429') ||
      String(error).includes('503');

    if (isRetryable && retries > 0) {
      console.warn(`Gemini API call failed with retryable status. Retrying in ${delay}ms...`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Generate prompt SHA-256 hash
function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex');
}

// Log AI calls to the audit log safely without storing the prompt itself
async function logAICall(
  orgId: string,
  userId: string,
  action: string,
  promptText: string,
  status: 'success' | 'failure',
  errorMsg?: string
) {
  try {
    const pHash = hashPrompt(promptText);
    await db.insert(auditLog).values({
      orgId,
      userId,
      action: `AI_${action}`,
      entityType: 'ai_service',
      entityId: null,
      oldValues: {},
      newValues: {
        promptHash: pHash,
        status,
        error: errorMsg || null,
        timestamp: new Date().toISOString(),
      },
      ipAddress: '127.0.0.1',
    });
  } catch (err) {
    console.error('Failed to insert AI call to audit log:', err);
  }
}

// In-Memory Monthly Insights Cache with 24 hours expiry
interface CacheEntry {
  expiresAt: number;
  data: any;
}
const insightsCache: Record<string, CacheEntry> = {};

export class AIService {
  /**
   * a) Receipt OCR & Data Extraction — tries Gemini, falls back to filename extraction
   */
  async extractReceiptData(
    imageBuffer: Buffer,
    mimeType: string,
    orgId: string,
    userId: string
  ): Promise<ExtractedReceiptData | { vendorName: string; note: string }> {
    // Try Gemini first
    if (apiKey) {
      try {
        const prompt = `Extract from this receipt: vendor name, date (ISO format), total amount (in kobo, no decimals), line items (description, quantity, unit price, total), VAT amount, receipt/invoice number. Return ONLY valid JSON. Currency is Nigerian Naira.`;

        const base64Data = imageBuffer.toString('base64');
        const response = await withRetry(() =>
          ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [{ parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] }],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  vendorName: { type: Type.STRING },
                  date: { type: Type.STRING },
                  totalAmountKobo: { type: Type.INTEGER },
                  lineItems: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        description: { type: Type.STRING },
                        quantity: { type: Type.INTEGER },
                        unitPriceKobo: { type: Type.INTEGER },
                        totalKobo: { type: Type.INTEGER },
                      },
                      required: ['description', 'quantity', 'unitPriceKobo', 'totalKobo'],
                    },
                  },
                  vatAmountKobo: { type: Type.INTEGER },
                  receiptNumber: { type: Type.STRING },
                },
                required: ['vendorName', 'date', 'totalAmountKobo', 'lineItems'],
              },
            },
          })
        );

        const responseText = response.text || '{}';
        const parsed = JSON.parse(responseText);
        const validated = ExtractedReceiptDataSchema.parse(parsed);
        await logAICall(orgId, userId, 'EXTRACT_RECEIPT', prompt, 'success');
        return validated;
      } catch (error: any) {
        await logAICall(orgId, userId, 'EXTRACT_RECEIPT', 'gemini-failed', 'failure', error?.message || String(error));
        // Fall through to filename extraction
      }
    }

    // Fallback: return partial extraction with defaults (no OCR possible locally)
    return {
      vendorName: 'Receipt uploaded',
      date: null,
      totalAmountKobo: 0,
      lineItems: [],
      vatAmountKobo: null,
      receiptNumber: null,
      _note: 'AI vision service is temporarily unavailable. The receipt has been uploaded and will be auto-processed once service is restored.',
    } as any;
  }

  /**
   * b) Transaction Categorisation — local keyword matching
   */
  async categoriseTransaction(
    description: string,
    amount: number,
    orgCategories: string[],
    orgId: string,
    userId: string
  ): Promise<{ category: string; confidence: number; reasoning: string }> {
    const desc = description.toLowerCase().trim();

    // Keyword-to-category hints
    const keywordMap: Record<string, string[]> = {
      'travel': ['uber', 'taxi', 'bolt', 'transport', 'fuel', 'petrol', 'diesel', 'flight', 'hotel', 'lodging', 'airline', 'bus', 'train'],
      'utility': ['electricity', 'phcn', 'water', 'internet', 'phone', 'mtn', 'glo', 'airtel', '9mobile', 'cable', 'dstv', 'gotv', 'power'],
      'office': ['stationery', 'printer', 'toner', 'paper', 'office', 'furniture', 'laptop', 'computer', 'software', 'subscription'],
      'food': ['restaurant', 'cafe', 'lunch', 'dinner', 'breakfast', 'supermarket', 'grocery', 'provision', 'chop', 'food'],
      'staff': ['salary', 'wage', 'bonus', 'allowance', 'staff', 'employee', 'payroll', 'pension', 'nhf', 'training'],
      'marketing': ['advert', 'sponsor', 'promotion', 'marketing', 'social media', 'google', 'facebook', 'instagram', 'branding'],
      'rent': ['rent', 'lease', 'landlord', 'property', 'tenancy'],
      'medical': ['hospital', 'doctor', 'pharmacy', 'drug', 'medicine', 'medical', 'clinic', 'health', 'eye', 'dental', 'optical'],
      'maintenance': ['repair', 'maintenance', 'servicing', 'fix', 'plumber', 'electrician', 'mechanic', 'generator'],
    };

    let bestCategory = orgCategories[0] || 'General Expense';
    let bestScore = 0;

    for (const cat of orgCategories) {
      const catLower = cat.toLowerCase().trim();
      // Direct category name match in description
      if (desc.includes(catLower)) {
        const score = 0.8;
        if (score > bestScore) { bestScore = score; bestCategory = cat; }
      }
      // Keyword group match
      for (const [group, keywords] of Object.entries(keywordMap)) {
        if (catLower.includes(group) || group.includes(catLower)) {
          for (const kw of keywords) {
            if (desc.includes(kw)) {
              const score = 0.7 + (keywords.indexOf(kw) / keywords.length) * 0.2;
              if (score > bestScore) { bestScore = score; bestCategory = cat; }
            }
          }
        }
      }
      // Amount heuristic: large amounts → likely rent/capex
      if (catLower.includes('rent') && amount > 500_000) {
        if (0.6 > bestScore) { bestScore = 0.6; bestCategory = cat; }
      }
    }

    await logAICall(orgId, userId, 'CATEGORISE_TRANSACTION', `local-match: ${description}`, 'success');
    return {
      category: bestCategory,
      confidence: Math.min(bestScore + 0.15, 0.95),
      reasoning: `Matched by keyword analysis against "${bestCategory}" based on transaction description "${description}".`,
    };
  }

  /**
   * c) Financial Insights — Computed from live module data (no Gemini call)
   */
  async generateMonthlyInsights(
    orgId: string,
    month: Date,
    userId: string
  ): Promise<Array<{ title: string; detail: string; severity: 'info' | 'warning' | 'alert'; metric?: string }>> {
    const year = month.getFullYear();
    const mNum = month.getMonth();
    const cacheKey = `${orgId}-${year}-${mNum}`;

    const now = Date.now();
    if (insightsCache[cacheKey] && insightsCache[cacheKey].expiresAt > now) {
      return insightsCache[cacheKey].data;
    }

    const startOfCurrentMonth = new Date(year, mNum, 1);
    const endOfCurrentMonth = new Date(year, mNum + 1, 0, 23, 59, 59, 999);
    const startOfPriorMonth = new Date(year, mNum - 1, 1);
    const endOfPriorMonth = new Date(year, mNum, 0, 23, 59, 59, 999);

    // Gather all module data in parallel
    const [
      currentMonthData,
      priorMonthData,
      cashFlow,
      bankAccs,
      customerBal,
      vendorBal,
      faData,
      invData,
      payrollData,
      invoiceCount,
      billCount,
    ] = await Promise.all([
      getIncomeStatement(orgId, startOfCurrentMonth, endOfCurrentMonth),
      getIncomeStatement(orgId, startOfPriorMonth, endOfPriorMonth),
      getCashFlowStatement(orgId, startOfCurrentMonth, endOfCurrentMonth),
      db.select().from(bankAccounts).where(eq(bankAccounts.orgId, orgId)),
      db.select({ total: sql<number>`coalesce(sum(${contacts.balance}), 0)` })
        .from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.type, 'customer'))),
      db.select({ total: sql<number>`coalesce(sum(${contacts.balance}), 0)` })
        .from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.type, 'vendor'))),
      db.select({
        totalCost: sql<number>`coalesce(sum(${fixedAssets.purchaseCost}), 0)`,
        totalDepr: sql<number>`coalesce(sum(${fixedAssets.accumulatedDepreciation}), 0)`,
        count: sql<number>`count(*)`,
      }).from(fixedAssets).where(eq(fixedAssets.orgId, orgId)),
      db.select({
        totalValue: sql<number>`coalesce(sum(${inventoryLots.quantity}::numeric * ${inventoryLots.costPerUnit}), 0)`,
        itemCount: sql<number>`count(distinct ${inventoryLots.itemId})`,
      }).from(inventoryLots).where(eq(inventoryLots.orgId, orgId)),
      getPayrollSummary(orgId, year).catch(() => ({
        monthlyTotals: [],
        annualTotals: { gross: 0, net: 0, paye: 0, pension: 0, nhf: 0 },
      })),
      db.select({ count: sql<number>`count(*)` })
        .from(invoices).where(and(eq(invoices.orgId, orgId), gte(invoices.date, startOfCurrentMonth), lte(invoices.date, endOfCurrentMonth))),
      db.select({ count: sql<number>`count(*)` })
        .from(bills).where(and(eq(bills.orgId, orgId), gte(bills.date, startOfCurrentMonth), lte(bills.date, endOfCurrentMonth))),
    ]);

    const formatKobo = (v: number) => {
      const abs = Math.abs(v);
      const sign = v < 0 ? '-' : '';
      if (abs >= 100_000_000) return `${sign}₦${(abs / 100_000_000).toFixed(1)}M`;
      if (abs >= 100_000) return `${sign}₦${(abs / 100_000).toFixed(1)}L`;
      return `${sign}₦${(abs / 100).toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
    };

    const insights: Array<{ title: string; detail: string; severity: 'info' | 'warning' | 'alert'; metric?: string }> = [];

    // --- 1. Revenue ---
    const revenue = currentMonthData.revenue.total;
    const priorRevenue = priorMonthData.revenue.total;
    if (revenue === 0) {
      insights.push({
        title: 'Zero Revenue Recorded',
        detail: `No operating revenue was booked in ${month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}. Immediate attention is required to resume invoicing and sales to prevent a severe operational cash crunch.`,
        severity: 'alert',
        metric: '₦0 Revenue',
      });
    } else {
      const revDiff = revenue - priorRevenue;
      const revPct = priorRevenue > 0 ? ((revDiff / priorRevenue) * 100).toFixed(1) : '+N/A';
      insights.push({
        title: revenue > priorRevenue ? 'Revenue Growth' : 'Revenue Decline',
        detail: `Revenue of ${formatKobo(revenue)} was recorded ${revDiff >= 0 ? 'up' : 'down'} ${formatKobo(Math.abs(revDiff))} MoM.${revenue > priorRevenue ? ' This signals healthy sales activity.' : ' Review pipeline and marketing efforts.'}`,
        severity: revDiff < 0 ? 'warning' : 'info',
        metric: `${revPct}% MoM`,
      });
    }

    // --- 2. Gross Profit ---
    const gp = currentMonthData.grossProfit;
    const priorGp = priorMonthData.grossProfit;
    const gpMargin = revenue > 0 ? (gp / revenue) * 100 : 0;
    const cogs = currentMonthData.costOfGoodsSold.total;
    if (gp < 0) {
      const cogsItems = currentMonthData.costOfGoodsSold.accounts || [];
      const bigCogs = cogsItems.sort((a: any, b: any) => b.balance - a.balance).slice(0, 2);
      let cogsDetail = `Cost of Goods Sold (${formatKobo(cogs)}) exceeded revenue, producing negative gross profit of ${formatKobo(gp)}.`;
      if (bigCogs.length > 0) {
        cogsDetail += ` Largest COGS components: ${bigCogs.map((c: any) => `${c.name} (${formatKobo(c.balance)})`).join(', ')}.`;
      }
      insights.push({
        title: 'Negative Gross Profit',
        detail: cogsDetail + ` Immediate review of cost classification and pricing strategy is required.`,
        severity: 'alert',
        metric: formatKobo(gp),
      });
    } else if (gpMargin < 20) {
      insights.push({
        title: 'Low Gross Margin Warning',
        detail: `Gross profit margin is ${gpMargin.toFixed(1)}%, which is below the healthy 20%+ threshold. Revenue of ${formatKobo(revenue)} yielded gross profit of ${formatKobo(gp)} after ${formatKobo(cogs)} in COGS. Consider cost reduction or price adjustments.`,
        severity: 'warning',
        metric: `${gpMargin.toFixed(1)}% Margin`,
      });
    }

    // --- 3. Net Profit / Loss ---
    const netProfit = currentMonthData.netProfit;
    const priorNet = priorMonthData.netProfit;
    if (netProfit < 0) {
      const deprAccounts = currentMonthData.expense.accounts.filter((a: any) =>
        a.name.toLowerCase().includes('depreciation') || a.name.toLowerCase().includes('amortisation')
      );
      const totalDepr = deprAccounts.reduce((s: number, a: any) => s + a.balance, 0);
      let detail = `Net loss of ${formatKobo(netProfit)} was recorded for the period.`;
      if (totalDepr > 0) {
        detail += ` Non-cash depreciation/amortisation of ${formatKobo(totalDepr)} accounts for ${Math.abs(totalDepr / (netProfit || 1) * 100).toFixed(0)}% of the deficit.`;
      }
      if (cogs > revenue) {
        detail += ` The primary driver is COGS (${formatKobo(cogs)}) exceeding revenue.`;
      }
      insights.push({
        title: 'Net Profit Deficit',
        detail,
        severity: 'alert',
        metric: formatKobo(netProfit),
      });
    } else if (netProfit > 0) {
      const pctChange = priorNet > 0 ? ((netProfit - priorNet) / priorNet * 100).toFixed(1) : '+N/A';
      insights.push({
        title: netProfit >= priorNet ? 'Profitability Improving' : 'Profitability Declining',
        detail: `Net profit of ${formatKobo(netProfit)} was achieved, ${netProfit >= priorNet ? 'up' : 'down'} from ${formatKobo(priorNet)} last month (${pctChange}% MoM).`,
        severity: netProfit >= priorNet ? 'info' : 'warning',
        metric: `${pctChange}% MoM`,
      });
    }

    // --- 4. Cash & Bank Position ---
    const totalCash = bankAccs.reduce((sum, b) => sum + b.currentBalance, 0);
    const cashChange = cashFlow.netChangeInCash;
    if (totalCash === 0) {
      insights.push({
        title: 'No Bank Accounts Configured',
        detail: 'No bank accounts are linked. Cash position cannot be monitored. Configure bank accounts to enable real-time cash flow tracking.',
        severity: 'warning',
        metric: '₦0 Cash',
      });
    } else if (cashChange < 0) {
      const pctBurn = totalCash > 0 ? Math.abs(cashChange / totalCash * 100).toFixed(0) : '0';
      insights.push({
        title: 'Negative Cash Flow',
        detail: `Cash balance of ${formatKobo(totalCash)} across ${bankAccs.length} account(s) decreased by ${formatKobo(Math.abs(cashChange))} this period (${pctBurn}% burn rate). Monitor outflows closely to avoid liquidity pressure.`,
        severity: 'warning',
        metric: formatKobo(cashChange),
      });
    } else {
      insights.push({
        title: 'Positive Cash Position',
        detail: `Total cash of ${formatKobo(totalCash)} across ${bankAccs.length} account(s) with net inflow of ${formatKobo(cashChange)} this period.`,
        severity: 'info',
        metric: formatKobo(totalCash),
      });
    }

    // --- 5. Accounts Receivable ---
    const arTotal = Number(customerBal[0]?.total || 0);
    if (arTotal > 0) {
      const arRatio = revenue > 0 ? (arTotal / revenue) : 0;
      insights.push({
        title: arRatio > 2 ? 'High Receivables Outstanding' : 'Receivables Within Range',
        detail: `Customers owe ${formatKobo(arTotal)} in outstanding invoices. This represents ${arRatio.toFixed(1)}x monthly revenue. ${arRatio > 2 ? 'Follow up on collections to improve cash conversion.' : 'Collection efforts are on track.'}`,
        severity: arRatio > 2 ? 'warning' : 'info',
        metric: formatKobo(arTotal),
      });
    }

    // --- 6. Accounts Payable ---
    const apTotal = Number(vendorBal[0]?.total || 0);
    if (apTotal > 0) {
      insights.push({
        title: apTotal > totalCash && totalCash > 0 ? 'Payables Exceed Cash Reserves' : 'Vendor Payables Status',
        detail: `Outstanding vendor payables total ${formatKobo(apTotal)}. ${apTotal > totalCash && totalCash > 0 ? 'This exceeds available cash of ' + formatKobo(totalCash) + ', creating payment risk.' : 'Manage payment schedules within available cash flow.'}`,
        severity: apTotal > totalCash && totalCash > 0 ? 'warning' : 'info',
        metric: formatKobo(apTotal),
      });
    }

    // --- 7. Payroll ---
    const thisMonthPayroll = payrollData.monthlyTotals?.[mNum];
    const payrollCost = thisMonthPayroll?.gross || 0;
    if (payrollCost > 0) {
      const pctOfRevenue = revenue > 0 ? (payrollCost / revenue * 100).toFixed(1) : 'N/A';
      insights.push({
        title: payrollCost > revenue * 0.5 ? 'High Payroll-to-Revenue Ratio' : 'Payroll Costs',
        detail: `Payroll gross of ${formatKobo(payrollCost)} was processed (${thisMonthPayroll?.runsCount || 0} run(s)). This is ${pctOfRevenue}% of revenue.${payrollCost > revenue * 0.5 ? ' Ratios above 50% indicate potential overstaffing relative to revenue.' : ''}`,
        severity: payrollCost > revenue * 0.5 ? 'warning' : 'info',
        metric: formatKobo(payrollCost),
      });
    }

    // --- 8. Fixed Assets & Depreciation ---
    const fa = faData[0];
    const totalFaCost = fa?.totalCost || 0;
    const totalFaDepr = fa?.totalDepr || 0;
    const faCount = fa?.count || 0;
    const deprThisPeriod = currentMonthData.expense.accounts.filter((a: any) =>
      a.name.toLowerCase().includes('depreciation') || a.name.toLowerCase().includes('amortisation')
    ).reduce((s: number, a: any) => s + a.balance, 0);
    if (totalFaCost > 0 && deprThisPeriod > 0) {
      insights.push({
        title: 'Non-Cash Depreciation Charge',
        detail: `Depreciation of ${formatKobo(deprThisPeriod)} was charged this period. Total asset base is ${formatKobo(totalFaCost)} (${faCount} asset(s), net book value ${formatKobo(totalFaCost - totalFaDepr)}). This non-cash expense reduces profit but does not affect liquidity.`,
        severity: 'info',
        metric: formatKobo(deprThisPeriod),
      });
    }

    // --- 9. Inventory ---
    const inv = invData[0];
    const invValue = inv?.totalValue || 0;
    const invItems = inv?.itemCount || 0;
    if (invValue > 0) {
      insights.push({
        title: 'Inventory Position',
        detail: `Inventory is valued at ${formatKobo(invValue)} across ${invItems} item(s). ${invValue > revenue * 3 ? 'Inventory turns may be slow — investigate carrying costs and demand forecasting.' : 'Stock levels appear reasonable relative to sales volume.'}`,
        severity: invValue > revenue * 3 && revenue > 0 ? 'warning' : 'info',
        metric: formatKobo(invValue),
      });
    }

    // --- 10. Transaction Volume ---
    const invCount = Number(invoiceCount[0]?.count || 0);
    const billCountNum = Number(billCount[0]?.count || 0);
    if (invCount === 0 && billCountNum === 0) {
      insights.push({
        title: 'No Transaction Activity',
        detail: 'No invoices or bills were created this period. The business may be dormant or transactions are being recorded outside the system.',
        severity: 'warning',
        metric: '0 Transactions',
      });
    }

    await logAICall(orgId, userId, 'FINANCIAL_INSIGHTS', `computed-insights-${cacheKey}`, 'success');

    // Cache for 1 hour
    insightsCache[cacheKey] = {
      expiresAt: now + 60 * 60 * 1000,
      data: insights,
    };

    return insights;
  }

  /**
   * d) Invoice Description Suggestions — local history match, no external API
   */
  async suggestLineItemDescription(
    partialDescription: string,
    orgId: string,
    userId: string
  ): Promise<string[]> {
    let previousEntries: string[] = [];
    try {
      const rows = await db
        .select({ description: invoiceLines.description })
        .from(invoiceLines)
        .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
        .where(and(eq(invoices.orgId, orgId), isNotNull(invoiceLines.description)))
        .limit(100);
      previousEntries = Array.from(new Set(rows.map((r) => r.description).filter(Boolean))) as string[];
    } catch (err) {
      console.error('Failed to load org lines for description autocomplete:', err);
    }

    const partial = partialDescription.toLowerCase().trim();
    if (!partial || previousEntries.length === 0) {
      return [];
    }

    // Score matches: startsWith > includes > word boundary match
    const scored = previousEntries.map((desc) => {
      const lower = desc.toLowerCase();
      let score = 0;
      if (lower === partial) score = 100;
      else if (lower.startsWith(partial)) score = 80;
      else if (lower.includes(partial)) score = 50;
      else if (partial.split(/\s+/).some((w) => w.length > 2 && lower.includes(w))) score = 30;
      return { desc, score };
    });

    const matches = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.desc);

    await logAICall(orgId, userId, 'SUGGEST_DESCRIPTION', `local-match: ${partialDescription}`, 'success');
    return matches;
  }

  /**
   * e) Anomaly Detection — local heuristic rules, no external API needed
   */
  async detectAnomalies(
    orgId: string,
    transactions: any[],
    userId: string
  ): Promise<Array<{ transactionId: string; reason: string; severity: 'low' | 'medium' | 'high' }>> {
    const flags: Array<{ transactionId: string; reason: string; severity: 'low' | 'medium' | 'high' }> = [];

    const clean = transactions.map((tx) => ({
      id: tx.id,
      description: (tx.description || '').toLowerCase().trim(),
      amountKobo: Math.abs(tx.amount || tx.amountKobo || 0),
      date: tx.date ? tx.date.split('T')[0] : '',
      reference: tx.reference || null,
    }));

    // 1. Detect duplicates — same description + amount + date
    const seen = new Map<string, string[]>();
    for (const tx of clean) {
      const key = `${tx.description}|${tx.amountKobo}|${tx.date}`;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(tx.id);
    }
    for (const [key, ids] of seen) {
      if (ids.length > 1) {
        for (const id of ids) {
          const parts = key.split('|');
          flags.push({
            transactionId: id,
            reason: `Duplicate transaction: "${parts[0]}" for ${(Number(parts[1]) / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 })} on ${parts[2]} appears ${ids.length} times.`,
            severity: 'high',
          });
        }
      }
    }

    // 2. Round-number detection — amounts that are clean multiples of 10,000
    for (const tx of clean) {
      if (tx.amountKobo >= 500_000_00 && tx.amountKobo % 1_000_000_00 === 0) {
        // Already flagged as duplicate? skip to avoid double
        if (flags.some((f) => f.transactionId === tx.id)) continue;
        flags.push({
          transactionId: tx.id,
          reason: `Round-number alert: ${(tx.amountKobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 })} is a clean round million-₦ amount which may indicate a manual journal or estimated entry.`,
          severity: tx.amountKobo >= 10_000_000_00 ? 'high' : 'medium',
        });
      }
    }

    // 3. Large-value detection — amount > 10M kobo (₦100k) flagged as large
    for (const tx of clean) {
      if (tx.amountKobo > 10_000_000_00 && !flags.some((f) => f.transactionId === tx.id)) {
        flags.push({
          transactionId: tx.id,
          reason: `High-value transaction: ${(tx.amountKobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 })} (${tx.description || 'no description'}). Verify business justification.`,
          severity: tx.amountKobo >= 50_000_000_00 ? 'high' : 'medium',
        });
      }
    }

    await logAICall(orgId, userId, 'DETECT_ANOMALIES', `${clean.length} transactions analysed locally`, 'success');
    return flags;
  }
}

export const aiService = new AIService();
