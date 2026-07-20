import { z } from 'zod';
import crypto from 'crypto';
import { db, auditLog } from '../db/schema';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';

function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex');
}

async function logCall(orgId: string, userId: string, action: string, promptLength: number, status: 'success' | 'failure', errorMsg?: string) {
  try {
    await db.insert(auditLog).values({
      orgId, userId,
      action: `NVIDIA_${action}`,
      entityType: 'ai_service',
      entityId: null,
      oldValues: {},
      newValues: { promptLength, status, error: errorMsg || null, model: MODEL },
      ipAddress: '127.0.0.1',
    });
  } catch { /* audit log failure is non-critical */ }
}

async function callNemotron(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { temperature?: number; maxTokens?: number; responseFormat?: 'text' | 'json_object' }
): Promise<string> {
  const body: any = {
    model: MODEL,
    messages,
    temperature: options?.temperature ?? 0.3,
    top_p: 0.95,
    max_tokens: options?.maxTokens ?? 4096,
    stream: false,
  };
  if (options?.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }
  const res = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NVIDIA API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function extractJson<T>(prompt: string, systemPrompt: string): Promise<T> {
  const text = await callNemotron([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ], { temperature: 0.1, responseFormat: 'json_object', maxTokens: 8192 });
  try {
    return JSON.parse(text) as T;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]) as T;
    throw new Error('Failed to parse JSON from NVIDIA response');
  }
}

// ── Accounting Assistant ──

const ACCOUNTING_SYSTEM_PROMPT = `You are a professional accountant and financial analyst for SkyBooks, a Nigerian accounting platform. You answer questions about the user's financial data clearly and concisely.

Rules:
- All monetary values are in kobo. Divide by 100 for naira display.
- Use ₦ prefix for naira amounts and format with commas.
- Nigerian accounting standards apply (CIT, VAT, WHT, PAYE).
- Be concise — 2-4 paragraphs max unless the user asks for detail.
- If you don't know something, say so — don't make up numbers.
- Reference specific accounts and amounts from the data provided.`;

export async function queryFinancialData(orgId: string, userId: string, query: string, dataContext: string): Promise<string> {
  try {
    const response = await callNemotron([
      { role: 'system', content: ACCOUNTING_SYSTEM_PROMPT },
      { role: 'user', content: `Here is the user's financial data:\n\n${dataContext}\n\nUser question: ${query}\n\nProvide a clear, professional response.` },
    ], { temperature: 0.3, maxTokens: 4096 });
    await logCall(orgId, userId, 'ASSISTANT_QUERY', query.length, 'success');
    return response;
  } catch (err: any) {
    await logCall(orgId, userId, 'ASSISTANT_QUERY', query.length, 'failure', err.message);
    return `I encountered an error: ${err.message}. Please try again.`;
  }
}

// ── Smart Invoice/Bill Categorization ──

const CATEGORIZATION_SYSTEM_PROMPT = `You are an AI that categorises accounting transactions. Given a transaction description, amount, and a list of available categories (account names + codes), return the best matching category in JSON format.

Rules:
- Match the description semantically (e.g., "fuel for generator" → Utilities, "office chairs" → Office Supplies)
- Consider the amount for context (large amounts may indicate different categories)
- Return ONLY valid JSON with no markdown or explanation
- If uncertain, pick the closest match rather than "uncategorised"
- Nigerian expense categories are common: Travel, Utilities, Office Supplies, Staff Costs, Marketing, Rent, Professional Fees, Maintenance, Medical, Insurance, etc.

Response format:
{
  "accountCode": "string",
  "accountName": "string",
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;

export interface CategorisationResult {
  accountCode: string;
  accountName: string;
  confidence: number;
  reasoning: string;
}

export async function categoriseTransaction(
  orgId: string,
  userId: string,
  description: string,
  amountKobo: number,
  categories: Array<{ code: string; name: string }>
): Promise<CategorisationResult> {
  const prompt = `Description: "${description}"
Amount: ₦${(amountKobo / 100).toLocaleString()}
Available categories:
${categories.map(c => `  ${c.code} — ${c.name}`).join('\n')}

Return the best matching category as JSON.`;

  try {
    const result = await extractJson<CategorisationResult>(prompt, CATEGORIZATION_SYSTEM_PROMPT);
    await logCall(orgId, userId, 'CATEGORISE', description.length, 'success');
    return result;
  } catch (err: any) {
    await logCall(orgId, userId, 'CATEGORISE', description.length, 'failure', err.message);
    return { accountCode: '', accountName: 'Uncategorised', confidence: 0, reasoning: err.message };
  }
}

// ── Receipt OCR / Document Parsing ──

const OCR_SYSTEM_PROMPT = `You are an AI that extracts structured receipt and invoice data from raw OCR text. Return ONLY valid JSON.

Rules:
- Extract vendor name, date, total amount, line items, VAT, and document number
- Convert all monetary values to kobo (multiply naira by 100)
- If the total is not explicitly stated, sum the line items
- VAT is typically 7.5% in Nigeria — calculate if not shown
- Date format: YYYY-MM-DD
- If a field is not found, use null

Response format:
{
  "vendorName": "string",
  "date": "YYYY-MM-DD or null",
  "totalAmountKobo": number,
  "lineItems": [{"description": "string", "quantity": number, "unitPriceKobo": number, "totalKobo": number}],
  "vatAmountKobo": number or null,
  "documentNumber": "string or null",
  "currency": "NGN",
  "isBill": boolean,
  "confidence": 0-100
}`;

export interface OcrResult {
  vendorName: string;
  date: string | null;
  totalAmountKobo: number;
  lineItems: Array<{ description: string; quantity: number; unitPriceKobo: number; totalKobo: number }>;
  vatAmountKobo: number | null;
  documentNumber: string | null;
  currency: string;
  isBill: boolean;
  confidence: number;
}

export async function extractDocumentData(orgId: string, userId: string, rawText: string, mimeType: string): Promise<OcrResult> {
  const prompt = `Extract structured data from this ${mimeType} document OCR text:\n\n${rawText.slice(0, 15000)}`;
  try {
    const result = await extractJson<OcrResult>(prompt, OCR_SYSTEM_PROMPT);
    await logCall(orgId, userId, 'OCR_EXTRACT', rawText.length, 'success');
    return result;
  } catch (err: any) {
    await logCall(orgId, userId, 'OCR_EXTRACT', rawText.length, 'failure', err.message);
    return {
      vendorName: 'Extraction Failed',
      date: null,
      totalAmountKobo: 0,
      lineItems: [],
      vatAmountKobo: null,
      documentNumber: null,
      currency: 'NGN',
      isBill: false,
      confidence: 0,
    };
  }
}
