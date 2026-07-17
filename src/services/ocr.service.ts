import { db, ocrDocuments, accounts, contacts, journalEntries, journalLines, organisations } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { createAuditLog } from './audit.service';
import { postToGL } from './posting.service';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'gemini-2.0-flash';

function getGeminiClient() {
  if (!GEMINI_API_KEY) return null;
  const { GoogleGenAI } = require('@google/genai');
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

type OcrDocType = 'invoice' | 'bill' | 'receipt' | 'purchase_order';

export interface ExtractedDocument {
  docType: OcrDocType;
  vendorName?: string;
  vendorAddress?: string;
  customerName?: string;
  customerAddress?: string;
  documentNumber?: string | null;
  date?: string | null;
  dueDate?: string | null;
  currency?: string;
  subtotal?: number;
  taxAmount?: number;
  taxRate?: number;
  totalAmount?: number;
  withholdingTax?: number;
  lineItems: ExtractedLineItem[];
  notes?: string | null;
}

export interface ExtractedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  accountCode?: string;
}

export interface SuggestedJournal {
  description: string;
  date: string;
  lines: {
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
  }[];
  totalDebits: number;
  totalCredits: number;
}

export async function extractDocumentData(
  fileBuffer: Buffer,
  mimeType: string,
  orgId: string,
  fileName: string
): Promise<{ text: string; error?: string }> {
  let text = '';

  if (mimeType === 'application/pdf') {
    try {
      const pdfjs = require('pdfjs-dist');
      const doc = await pdfjs.getDocument({ data: fileBuffer.buffer ? fileBuffer : new Uint8Array(fileBuffer) }).promise;
      for (let i = 1; i <= Math.min(doc.numPages, 50); i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        text += pageText + '\n';
      }
    } catch (err: any) {
      return { text: '', error: `PDF extraction failed: ${err.message}` };
    }
  } else if (mimeType.startsWith('image/')) {
    try {
      const Tesseract = require('tesseract.js');
      const { data } = await Tesseract.recognize(fileBuffer, 'eng', {
        logger: () => {},
      });
      text = data.text || '';
    } catch (err: any) {
      return { text: '', error: `OCR failed: ${err.message}` };
    }
  } else {
    return { text: '', error: `Unsupported file type: ${mimeType}` };
  }

  if (!text.trim()) return { text: '', error: 'No text could be extracted from the document' };
  return { text };
}

export async function parseWithAI(
  rawText: string,
  orgId: string
): Promise<{ extracted: ExtractedDocument; suggestedJournal: SuggestedJournal }> {
  const client = getGeminiClient();
  if (!client) {
    const fallback = fallbackParse(rawText);
    return { extracted: fallback, suggestedJournal: buildFallbackJournal(fallback) };
  }

  const [orgAccounts, orgContacts] = await Promise.all([
    db.select({ code: accounts.code, name: accounts.name, id: accounts.id, type: accounts.type })
      .from(accounts)
      .where(eq(accounts.orgId, orgId))
      .orderBy(accounts.code),
    db.select({ name: contacts.name, id: contacts.id, type: contacts.type })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.isActive, true)))
      .orderBy(contacts.name),
  ]);

  const accountsList = orgAccounts.map(a => `${a.code} ${a.name} (${a.type})`).join('\n');
  const contactsList = orgContacts.map(c => `${c.name} [${c.type}]`).join('\n');

  const systemPrompt = `You are an expert accounting OCR assistant for Nigerian businesses.
Extract structured data from the provided document text and suggest appropriate journal entries.

Rules:
- All monetary amounts are in Naira (NGN) unless otherwise specified
- Convert all amounts to kobo (multiply Naira by 100)
- VAT in Nigeria is 7.5% (standard rate)
- WHT rates: 5% for goods, 10% for services (if identifiable)
- For invoices: DR Accounts Receivable, CR Revenue/Sales, CR VAT Payable
- For bills: DR Expense/Asset, CR Accounts Payable, DR VAT Receivable
- For receipts: DR Bank/Cash, CR Accounts Receivable
- For purchase orders: no journal entry (it's a commitment, not an accounting event)

Return ONLY valid JSON in this exact format:
{
  "extracted": {
    "docType": "invoice|bill|receipt|purchase_order",
    "vendorName": "string or null",
    "vendorAddress": "string or null",
    "customerName": "string or null",
    "customerAddress": "string or null",
    "documentNumber": "string or null",
    "date": "YYYY-MM-DD or null",
    "dueDate": "YYYY-MM-DD or null",
    "currency": "NGN or other",
    "subtotal": number in kobo or 0,
    "taxAmount": number in kobo or 0,
    "taxRate": number (percentage, e.g. 7.5) or 0,
    "totalAmount": number in kobo or 0,
    "withholdingTax": number in kobo or 0,
    "lineItems": [
      {
        "description": "string",
        "quantity": number,
        "unitPrice": number in kobo,
        "amount": number in kobo,
        "taxRate": number or 0
      }
    ],
    "notes": "string or null"
  },
  "suggestedJournal": {
    "description": "Journal entry description",
    "date": "YYYY-MM-DD",
    "lines": [
      {
        "accountCode": "best matching account code from the provided list",
        "accountName": "account name",
        "debit": number in kobo,
        "credit": number in kobo
      }
    ],
    "totalDebits": number,
    "totalCredits": number
  }
}`;

  const prompt = `Extract accounting data from this document text and suggest journal entries.

Available Accounts:
${accountsList}

Available Contacts (customers and vendors):
${contactsList}

Document Text:
${rawText}

Remember amounts in kobo (×100). Return only the JSON.`;

  try {
    const result = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    });

    const responseText = result.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in AI response');

    const parsed = JSON.parse(jsonMatch[0]);
    const extracted = parsed.extracted || parsed;
    const suggestedJournal = parsed.suggestedJournal || buildFallbackJournal(extracted);

    return {
      extracted: normalizeExtracted(extracted),
      suggestedJournal: normalizeJournal(suggestedJournal),
    };
  } catch (err: any) {
    const fallback = fallbackParse(rawText);
    return { extracted: fallback, suggestedJournal: buildFallbackJournal(fallback) };
  }
}

function normalizeExtracted(data: any): ExtractedDocument {
  return {
    docType: data.docType || 'receipt',
    vendorName: data.vendorName || data.vendor_name || null,
    vendorAddress: data.vendorAddress || data.vendor_address || null,
    customerName: data.customerName || data.customer_name || null,
    customerAddress: data.customerAddress || data.customer_address || null,
    documentNumber: data.documentNumber || data.document_number || data.invoiceNumber || data.invoice_number || null,
    date: data.date || null,
    dueDate: data.dueDate || data.due_date || null,
    currency: data.currency || 'NGN',
    subtotal: Math.round(Number(data.subtotal) || 0),
    taxAmount: Math.round(Number(data.taxAmount || data.tax_amount) || 0),
    taxRate: Number(data.taxRate || data.tax_rate) || 0,
    totalAmount: Math.round(Number(data.totalAmount || data.total_amount) || 0),
    withholdingTax: Math.round(Number(data.withholdingTax || data.withholding_tax) || 0),
    lineItems: (data.lineItems || data.line_items || []).map((item: any) => ({
      description: item.description || item.name || '',
      quantity: Number(item.quantity) || 1,
      unitPrice: Math.round(Number(item.unitPrice || item.unit_price || item.unitprice) || 0),
      amount: Math.round(Number(item.amount) || 0),
      taxRate: Number(item.taxRate || item.tax_rate) || 0,
    })),
    notes: data.notes || null,
  };
}

function normalizeJournal(data: any): SuggestedJournal {
  return {
    description: data.description || 'OCR Generated Journal Entry',
    date: data.date || new Date().toISOString().split('T')[0],
    lines: (data.lines || []).map((l: any) => ({
      accountCode: l.accountCode || l.account_code || l.account || '',
      accountName: l.accountName || l.account_name || '',
      debit: Math.round(Number(l.debit) || 0),
      credit: Math.round(Number(l.credit) || 0),
    })),
    totalDebits: Math.round(Number(data.totalDebits || data.total_debits || 0)),
    totalCredits: Math.round(Number(data.totalCredits || data.total_credits || 0)),
  };
}

function fallbackParse(text: string): ExtractedDocument {
  const lines = text.split('\n').filter(l => l.trim());
  const totalMatch = text.match(/[Tt]otal\s*[:\s]*₦?\s*([\d,]+(?:\.\d{2})?)/);
  const dateMatch = text.match(/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/);
  const invMatch = text.match(/(?:INV|INVOICE|BILL|PURCHASE\s*ORDER)\s*[#:]?\s*(\S+)/i);
  const vendorMatch = text.match(/(?:Vendor|Supplier|From|Bill\s*From)[:\s]+(.+)/i);
  const customerMatch = text.match(/(?:Customer|Client|Bill\s*To|Sold\s*To)[:\s]+(.+)/i);

  return {
    docType: text.toLowerCase().includes('purchase order') ? 'purchase_order' :
             text.toLowerCase().includes('receipt') ? 'receipt' :
             text.toLowerCase().includes('bill') ? 'bill' : 'invoice',
    vendorName: vendorMatch?.[1]?.trim(),
    customerName: customerMatch?.[1]?.trim(),
    documentNumber: invMatch?.[1],
    date: dateMatch?.[0],
    totalAmount: totalMatch ? Math.round(parseFloat(totalMatch[1].replace(/,/g, '')) * 100) : 0,
    subtotal: 0,
    taxAmount: 0,
    taxRate: 7.5,
    currency: 'NGN',
    withholdingTax: 0,
    lineItems: [],
    notes: undefined,
  };
}

function buildFallbackJournal(extracted: ExtractedDocument): SuggestedJournal {
  const total = extracted.totalAmount || (extracted.subtotal || 0) + (extracted.taxAmount || 0);
  const lines = [];

  if (extracted.docType === 'invoice' || extracted.docType === 'receipt') {
    lines.push({ accountCode: '101100', accountName: 'Trade Debtors/Accounts Receivable', debit: total, credit: 0 });
    lines.push({ accountCode: '400000', accountName: 'Sales/Revenue', debit: 0, credit: extracted.subtotal || total });
    if (extracted.taxAmount) {
      lines.push({ accountCode: '301300', accountName: 'VAT Payable', debit: 0, credit: extracted.taxAmount });
    }
  } else if (extracted.docType === 'bill') {
    lines.push({ accountCode: '500000', accountName: 'Purchases/Expenses', debit: extracted.subtotal || total, credit: 0 });
    if (extracted.taxAmount) {
      lines.push({ accountCode: '101600', accountName: 'VAT Receivable', debit: extracted.taxAmount, credit: 0 });
    }
    lines.push({ accountCode: '300100', accountName: 'Trade Creditors/Accounts Payable', debit: 0, credit: total + (extracted.taxAmount || 0) });
  }

  return {
    description: `${extracted.docType.toUpperCase()} - ${extracted.documentNumber || 'OCR Generated'}`,
    date: extracted.date || new Date().toISOString().split('T')[0],
    lines,
    totalDebits: lines.reduce((s, l) => s + l.debit, 0),
    totalCredits: lines.reduce((s, l) => s + l.credit, 0),
  };
}

export async function postJournalFromOcr(
  ocrDocId: string,
  orgId: string,
  userId: string,
  suggestedJournal: SuggestedJournal,
  reqMeta?: any
): Promise<any> {
  const [doc] = await db
    .select()
    .from(ocrDocuments)
    .where(and(eq(ocrDocuments.id, ocrDocId), eq(ocrDocuments.orgId, orgId)))
    .limit(1);
  if (!doc) throw new AppError('OCR document not found', 404);
  if (doc.status === 'posted') throw new AppError('Document already posted', 400);

  const resolvedLines: { accountId: string; debit: number; credit: number; description?: string }[] = [];
  for (const line of suggestedJournal.lines) {
    if (!line.debit && !line.credit) continue;
    const [acct] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(
        eq(accounts.orgId, orgId),
        eq(accounts.code, String(line.accountCode))
      ))
      .limit(1);
    if (!acct) {
      const [fallback] = await db
        .select({ id: accounts.id, code: accounts.code })
        .from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.isActive, true)))
        .orderBy(accounts.code)
        .limit(1);
      if (!fallback) throw new AppError(`No active account found for code ${line.accountCode}`, 400);
      resolvedLines.push({ accountId: fallback.id, debit: line.debit, credit: line.credit, description: line.accountName });
    } else {
      resolvedLines.push({ accountId: acct.id, debit: line.debit, credit: line.credit, description: line.accountName });
    }
  }

  if (resolvedLines.length < 2) throw new AppError('Journal entry must have at least 2 lines', 400);

  const totalDr = resolvedLines.reduce((s, l) => s + l.debit, 0);
  const totalCr = resolvedLines.reduce((s, l) => s + l.credit, 0);
  if (totalDr !== totalCr) throw new AppError(`Journal not balanced: DR ${totalDr} ≠ CR ${totalCr}`, 400);

  const je = await postToGL({
    orgId,
    date: new Date(suggestedJournal.date),
    description: suggestedJournal.description,
    reference: doc.fileName,
    source: 'manual',
    sourceId: doc.id,
    createdBy: userId,
    lines: resolvedLines,
    status: 'posted',
  });

  await db.update(ocrDocuments)
    .set({
      status: 'posted',
      journalEntryId: je.id,
      confirmedBy: userId,
      confirmedAt: new Date(),
    })
    .where(eq(ocrDocuments.id, ocrDocId));

  if (reqMeta) {
    await createAuditLog({
      orgId, userId, action: 'create', entityType: 'ocr-document',
      entityId: ocrDocId, newValues: { status: 'posted', journalEntryId: je.id },
      ...reqMeta,
    });
  }

  return je;
}

export async function getOcrDocuments(orgId: string, params?: { status?: string; docType?: string; page?: number; limit?: number }) {
  const conditions = [eq(ocrDocuments.orgId, orgId)];
  if (params?.status) conditions.push(eq(ocrDocuments.status, params.status as any));
  if (params?.docType) conditions.push(eq(ocrDocuments.docType, params.docType as any));

  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(ocrDocuments)
      .where(and(...conditions))
      .orderBy(desc(ocrDocuments.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(ocrDocuments)
      .where(and(...conditions))
      .then(r => Number(r[0]?.count || 0)),
  ]);

  return { data, total: totalResult, page, limit };
}
