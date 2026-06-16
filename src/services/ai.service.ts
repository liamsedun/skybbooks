/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import crypto from 'crypto';
import { db, auditLog, invoiceLines, invoices, organisations } from '../db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { getIncomeStatement } from './ledger.service';

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
   * a) Receipt OCR & Data Extraction
   */
  async extractReceiptData(
    imageBuffer: Buffer,
    mimeType: string,
    orgId: string,
    userId: string
  ): Promise<ExtractedReceiptData> {
    const prompt = `Extract from this receipt: vendor name, date (ISO format), total amount (in kobo, no decimals), line items (description, quantity, unit price, total), VAT amount, receipt/invoice number. Return ONLY valid JSON matching this schema: {...}. Currency is Nigerian Naira.`;

    const base64Data = imageBuffer.toString('base64');
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [{ parts: [imagePart, { text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                vendorName: { type: Type.STRING, description: 'The vendor/merchant name.' },
                date: { type: Type.STRING, description: 'Date in YYYY-MM-DD ISO format, or null.' },
                totalAmountKobo: {
                  type: Type.INTEGER,
                  description: 'Total receipt amount in Nigerian Naira kobo (Naira * 100). No decimals.',
                },
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
                vatAmountKobo: { type: Type.INTEGER, description: 'VAT amount in kobo, or null.' },
                receiptNumber: { type: Type.STRING, description: 'Receipt or invoice reference, or null.' },
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
      await logAICall(orgId, userId, 'EXTRACT_RECEIPT', prompt, 'failure', error?.message || String(error));
      throw error;
    }
  }

  /**
   * b) Transaction Categorisation
   */
  async categoriseTransaction(
    description: string,
    amount: number,
    orgCategories: string[],
    orgId: string,
    userId: string
  ): Promise<{ category: string; confidence: number; reasoning: string }> {
    const prompt = `Classify this bank transaction into one of these expense categories: ${JSON.stringify(
      orgCategories
    )}. Transaction: description='${description}', amount=₦${amount}. Return JSON: { category: string, confidence: number, reasoning: string }`;

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING, description: 'Select standard category matching the input list.' },
                confidence: { type: Type.NUMBER, description: 'Confidence probability between 0.0 and 1.0.' },
                reasoning: { type: Type.STRING, description: 'Brief context explaining categorisation reasoning.' },
              },
              required: ['category', 'confidence', 'reasoning'],
            },
          },
        })
      );

      const responseText = response.text || '{}';
      const parsed = JSON.parse(responseText);

      await logAICall(orgId, userId, 'CATEGORISE_TRANSACTION', prompt, 'success');
      return parsed;
    } catch (error: any) {
      await logAICall(
        orgId,
        userId,
        'CATEGORISE_TRANSACTION',
        prompt,
        'failure',
        error?.message || String(error)
      );
      throw error;
    }
  }

  /**
   * c) Financial Insights
   */
  async generateMonthlyInsights(
    orgId: string,
    month: Date,
    userId: string
  ): Promise<Array<{ title: string; detail: string; severity: 'info' | 'warning' | 'alert'; metric?: string }>> {
    // Generate cache key
    const year = month.getFullYear();
    const mNum = month.getMonth();
    const cacheKey = `${orgId}-${year}-${mNum}`;

    const now = Date.now();
    if (insightsCache[cacheKey] && insightsCache[cacheKey].expiresAt > now) {
      return insightsCache[cacheKey].data;
    }

    // Pull Current vs Prior Month income statement data
    const startOfCurrentMonth = new Date(year, mNum, 1);
    const endOfCurrentMonth = new Date(year, mNum + 1, 0, 23, 59, 59, 999);

    const startOfPriorMonth = new Date(year, mNum - 1, 1);
    const endOfPriorMonth = new Date(year, mNum, 0, 23, 59, 59, 999);

    const currentMonthData = await getIncomeStatement(orgId, startOfCurrentMonth, endOfCurrentMonth);
    const priorMonthData = await getIncomeStatement(orgId, startOfPriorMonth, endOfPriorMonth);

    const financialData = {
      currentMonth: currentMonthData,
      priorMonth: priorMonthData,
    };

    const prompt = `You are a CFO assistant for a Nigerian SME. Analyse this financial data and provide 3-5 actionable insights in plain English. Focus on: significant changes, cash flow concerns, profitability trends. Data: ${JSON.stringify(
      financialData
    )}. Return JSON array of insight objects: { title, detail, severity: info|warning|alert, metric? }`;

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: 'Visual short, actionable title.' },
                  detail: { type: Type.STRING, description: 'In-depth brief explanation focusing on trends / cash flows.' },
                  severity: {
                    type: Type.STRING,
                    description: "Severity level of transaction. Must be strictly 'info', 'warning', or 'alert'.",
                  },
                  metric: { type: Type.STRING, description: "Highly scannable visual metric label (e.g., '+22% MoM' or '₦450k decrease')." },
                },
                required: ['title', 'detail', 'severity'],
              },
            },
          },
        })
      );

      const responseText = response.text || '[]';
      const parsed = JSON.parse(responseText);

      // Cache for 24 hours (24 * 60 * 60 * 1000)
      insightsCache[cacheKey] = {
        expiresAt: now + 24 * 60 * 60 * 1000,
        data: parsed,
      };

      await logAICall(orgId, userId, 'FINANCIAL_INSIGHTS', prompt, 'success');
      return parsed;
    } catch (error: any) {
      await logAICall(orgId, userId, 'FINANCIAL_INSIGHTS', prompt, 'failure', error?.message || String(error));
      throw error;
    }
  }

  /**
   * d) Invoice Description Suggestions
   */
  async suggestLineItemDescription(
    partialDescription: string,
    orgId: string,
    userId: string
  ): Promise<string[]> {
    // Attempt loading context from previous organization records
    let previousEntries: string[] = [];
    let businessName = '';
    try {
      const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
      if (org) {
        businessName = org.name;
      }

      const rows = await db
        .select({ description: invoiceLines.description })
        .from(invoiceLines)
        .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
        .where(and(eq(invoices.orgId, orgId), isNotNull(invoiceLines.description)))
        .limit(50);
      previousEntries = Array.from(new Set(rows.map((r) => r.description).filter(Boolean))) as string[];
    } catch (err) {
      console.error('Failed to load org lines for description autocomplete:', err);
    }

    const orgContext = `Business: ${businessName || 'SME in Nigeria'}. Previous entries: ${JSON.stringify(
      previousEntries.slice(0, 20)
    )}`;

    const prompt = `Autocomplete invoice line descriptions based on previous entries. Partial: '${partialDescription}'. Context: ${orgContext}. Return top 3 completions as a JSON string array of exactly 3 candidates.`;

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        })
      );

      const responseText = response.text || '[]';
      const parsed = JSON.parse(responseText);

      const finalSuggestions = Array.isArray(parsed) ? parsed.slice(0, 3) : [];
      await logAICall(orgId, userId, 'SUGGEST_DESCRIPTION', prompt, 'success');
      return finalSuggestions;
    } catch (error: any) {
      await logAICall(orgId, userId, 'SUGGEST_DESCRIPTION', prompt, 'failure', error?.message || String(error));
      throw error;
    }
  }

  /**
   * e) Anomaly Detection
   */
  async detectAnomalies(
    orgId: string,
    transactions: any[],
    userId: string
  ): Promise<Array<{ transactionId: string; reason: string; severity: 'low' | 'medium' | 'high' }>> {
    // Format transactions to send minimal context
    const cleanTransactions = transactions.map((tx) => ({
      id: tx.id,
      description: tx.description,
      amountKobo: tx.amount || tx.amountKobo,
      date: tx.date,
      reference: tx.reference || null,
    }));

    const prompt = `Review these transactions for a Nigerian business. Flag any that look unusual: duplicate amounts, round-number suspicion, timing anomalies, unusual vendors. Return JSON array of flagged transactions with reason. Transactions: ${JSON.stringify(
      cleanTransactions
    )}. Return JSON: [{ transactionId: string, reason: string, severity: 'low'|'medium'|'high' }]`;

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  transactionId: { type: Type.STRING, description: 'ID of the flagged transaction.' },
                  reason: {
                    type: Type.STRING,
                    description: 'Direct reason description specifying round numbers, timing, or duplication checks.',
                  },
                  severity: {
                    type: Type.STRING,
                    description: "Severity score. Must be low, medium, or high.",
                  },
                },
                required: ['transactionId', 'reason', 'severity'],
              },
            },
          },
        })
      );

      const responseText = response.text || '[]';
      const parsed = JSON.parse(responseText);

      await logAICall(orgId, userId, 'DETECT_ANOMALIES', prompt, 'success');
      return parsed;
    } catch (error: any) {
      await logAICall(orgId, userId, 'DETECT_ANOMALIES', prompt, 'failure', error?.message || String(error));
      throw error;
    }
  }
}

export const aiService = new AIService();
