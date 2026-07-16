/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { db, accounts, journalEntries, journalLines, fixedAssets, bankAccounts, contacts, invoices, bills, projects, paymentsReceived } from '../db/schema';
import { eq, and, asc, sql, lte, gte } from 'drizzle-orm';
import { createAuditLog, extractReqMeta } from '../services/audit.service';
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getCashFlowStatement,
  getStatementOfChangesInEquity,
  createJournalEntry,
  TrialBalanceRow
} from '../services/ledger.service';
import { postToGL } from '../services/posting.service';
import { getInvoiceAgingReport } from '../services/invoice.service';
import { getBillAgingReport } from '../services/bill.service';
import {
  exportTrialBalance,
  exportIncomeStatement,
  exportGeneralLedger,
  exportPayrollSchedule,
  exportAgedReceivables,
  exportAgedPayables,
  exportBalanceSheet,
  exportCashFlow
} from '../services/excel.service';
import {
  generateTrialBalancePDF,
  generateIncomeStatementPDF,
  generateBalanceSheetPDF,
  generateCashFlowPDF,
  generateAgedReportPDF,
  generateStatementOfChangesInEquityPDF,
} from '../services/pdf.service';

const router = Router();

// Apply auth middlewares to all reporting endpoints
router.use(authenticate);
router.use(requireOrg);

// Helper for sending file buffers cleanly
function sendFileBuffer(res: Response, buffer: Buffer, contentType: string, filename: string, isInline = false) {
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Content-Disposition',
    `${isInline ? 'inline' : 'attachment'}; filename="${filename}"`
  );
  return res.end(buffer);
}

// Zod query schemas
const dateRangeQuerySchema = z.object({
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  format: z.enum(['pdf', 'excel', 'csv', 'json']).default('json')
});

const incomeStatementQuerySchema = z.object({
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  compareStart: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  compareEnd: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  format: z.enum(['pdf', 'excel', 'csv', 'json']).default('json')
});

const balanceSheetQuerySchema = z.object({
  asOfDate: z.string().optional().transform((val) => val ? new Date(val) : new Date()),
  compareAsOf: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  format: z.enum(['pdf', 'excel', 'json']).default('json')
});

const generalLedgerQuerySchema = z.object({
  accountId: z.string().uuid('Invalid account ID.'),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  format: z.enum(['pdf', 'excel', 'json']).default('excel')
});

const agedReportQuerySchema = z.object({
  format: z.enum(['pdf', 'excel', 'json']).default('json')
});

const payrollScheduleQuerySchema = z.object({
  runId: z.string().uuid('Invalid payroll run ID.'),
  format: z.enum(['pdf', 'excel']).default('excel')
});

// =========================================================================
// 1. TRIAL BALANCE ENDPOINT
// =========================================================================
router.get(
  '/trial-balance',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, format } = dateRangeQuerySchema.parse(req.query);
      const orgId = req.user!.orgId!;

      if (format === 'json') {
        const data = await getTrialBalance(orgId, startDate, endDate);
        return res.status(200).json({ success: true, data });
      }

      if (format === 'excel') {
        const buffer = await exportTrialBalance(orgId, startDate, endDate);
        return sendFileBuffer(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'trial_balance.xlsx');
      }

      if (format === 'csv') {
        const data = await getTrialBalance(orgId, startDate, endDate);
        const csvHeader = 'Account Code,Account Name,Type,Debit (NGN),Credit (NGN)\r\n';
        const csvRows = data.map((r: TrialBalanceRow) =>
          `${r.accountCode},"${r.accountName.replace(/"/g, '""')}",${r.accountType},${(r.closingDebit / 100).toFixed(2)},${(r.closingCredit / 100).toFixed(2)}`
        ).join('\r\n');
        const csv = '\uFEFF' + csvHeader + csvRows;
        res.setHeader('Content-Type', 'text/csv;charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="trial_balance.csv"');
        return res.end(csv);
      }

      if (format === 'pdf') {
        const buffer = await generateTrialBalancePDF(orgId, startDate, endDate);
        return sendFileBuffer(res, buffer, 'application/pdf', 'trial_balance.pdf', true);
      }
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 1b. IMPORT / RECORD TRIAL BALANCE OPENING BALANCES
// =========================================================================
const importTbCsvSchema = z.object({
  csvData: z.string().min(1, 'CSV data is required')
});

const recordTbSchema = z.object({
  lines: z.array(z.object({
    accountCode: z.string(),
    debit: z.number().default(0),
    credit: z.number().default(0)
  })).min(1, 'At least one account line is required')
});

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  fields.push(current.trim());
  return fields;
}

router.post(
  '/trial-balance/import-opening-balances',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { csvData } = importTbCsvSchema.parse(req.body);
      const orgId = req.user!.orgId!;
      const userId = req.user!.userId;

      // Parse CSV
      const cleaned = csvData.replace(/^\uFEFF/, '').replace(/\r$/, '');
      const lines = cleaned.split(/\n/).filter(Boolean);
      if (lines.length < 2) throw new AppError('CSV must have a header row and at least one data row.', 400);

      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
      const dataRows = lines.slice(1).map(l => parseCsvLine(l));

      const codeIdx = headers.findIndex(h => h === 'account code' || h === 'account_code' || h === 'code');
      const debitIdx = headers.findIndex(h => h === 'debit' || h === 'debit (ngn)' || h === 'debit_ngn');
      const creditIdx = headers.findIndex(h => h === 'credit' || h === 'credit (ngn)' || h === 'credit_ngn');

      if (codeIdx === -1) throw new AppError('CSV must contain an "account code" column.', 400);
      if (debitIdx === -1 && creditIdx === -1) throw new AppError('CSV must contain a "debit" or "credit" column.', 400);

      // Load all accounts for this org
      const orgAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.orgId, orgId))
        .orderBy(accounts.code);

      const accountMap = new Map<string, typeof orgAccounts[0]>();
      for (const a of orgAccounts) accountMap.set(a.code, a);

      // Parse rows into journal lines
      const journalLinesInput: { accountId: string; debit: number; credit: number }[] = [];
      const errors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const code = row[codeIdx]?.trim();
        if (!code) { errors.push(`Row ${i + 2}: missing account code`); continue; }

        const account = accountMap.get(code);
        if (!account) { errors.push(`Row ${i + 2}: account code "${code}" not found`); continue; }

        // Opening balances only valid for balance sheet accounts
        if (account.type === 'expense' || account.type === 'revenue') {
          errors.push(`Row ${i + 2}: "${code}" is a P&L account (${account.type}) — opening balances cannot be set on income/expense accounts`);
          continue;
        }

        const debit = debitIdx >= 0 ? Math.round(parseFloat(row[debitIdx]?.replace(/[₦,]/g, '') || '0') * 100) : 0;
        const credit = creditIdx >= 0 ? Math.round(parseFloat(row[creditIdx]?.replace(/[₦,]/g, '') || '0') * 100) : 0;

        if (isNaN(debit)) { errors.push(`Row ${i + 2}: invalid debit amount`); continue; }
        if (isNaN(credit)) { errors.push(`Row ${i + 2}: invalid credit amount`); continue; }
        if (debit === 0 && credit === 0) continue;

        journalLinesInput.push({ accountId: account.id, debit, credit });
      }

      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: 'CSV parse errors', errors });
      }

      if (journalLinesInput.length === 0) {
        throw new AppError('No valid opening balance lines found in CSV.', 400);
      }

      // Validate balancing
      const totalDebits = journalLinesInput.reduce((s, l) => s + l.debit, 0);
      const totalCredits = journalLinesInput.reduce((s, l) => s + l.credit, 0);
      if (totalDebits !== totalCredits) {
        throw new AppError(
          `Opening balances are out of balance. Total debits (₦${(totalDebits / 100).toFixed(2)}) must equal total credits (₦${(totalCredits / 100).toFixed(2)}).`,
          400
        );
      }

      await postToGL({
        orgId, date: new Date('1970-01-01'),
        description: 'Opening balance import',
        source: 'opening_balance', createdBy: userId,
        lines: journalLinesInput.map(l => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
        })),
      });

      createAuditLog({ orgId, userId, action: 'import', entityType: 'opening-balance', newValues: { count: journalLinesInput.length }, ...extractReqMeta(req) });
      return res.status(200).json({ success: true, message: `Imported ${journalLinesInput.length} opening balance lines successfully.` });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/trial-balance/record-opening-balances',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { lines } = recordTbSchema.parse(req.body);
      const orgId = req.user!.orgId!;
      const userId = req.user!.userId;

      const orgAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.orgId, orgId))
        .orderBy(accounts.code);

      const accountMap = new Map<string, typeof orgAccounts[0]>();
      for (const a of orgAccounts) accountMap.set(a.code, a);

      const journalLinesInput: { accountId: string; debit: number; credit: number }[] = [];
      const errors: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const item = lines[i];
        const account = accountMap.get(item.accountCode);
        if (!account) { errors.push(`Row ${i + 1}: account code "${item.accountCode}" not found`); continue; }

        // Opening balances only valid for balance sheet accounts
        if (account.type === 'expense' || account.type === 'revenue') {
          errors.push(`Row ${i + 1}: "${item.accountCode}" is a P&L account (${account.type}) — opening balances cannot be set on income/expense accounts`);
          continue;
        }

        const debit = Math.round(item.debit * 100);
        const credit = Math.round(item.credit * 100);
        if (debit === 0 && credit === 0) continue;
        journalLinesInput.push({ accountId: account.id, debit, credit });
      }

      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: 'Validation errors', errors });
      }

      const totalDebits = journalLinesInput.reduce((s, l) => s + l.debit, 0);
      const totalCredits = journalLinesInput.reduce((s, l) => s + l.credit, 0);
      if (totalDebits !== totalCredits) {
        throw new AppError(
          `Opening balances are out of balance. Total debits (₦${(totalDebits / 100).toFixed(2)}) must equal total credits (₦${(totalCredits / 100).toFixed(2)}).`,
          400
        );
      }

      await postToGL({
        orgId, date: new Date('1970-01-01'),
        description: 'Opening balance import',
        source: 'opening_balance', createdBy: userId,
        lines: journalLinesInput.map(l => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
        })),
      });

      createAuditLog({ orgId, userId, action: 'create', entityType: 'opening-balance', newValues: { count: journalLinesInput.length }, ...extractReqMeta(req) });
      return res.status(200).json({ success: true, message: `Recorded ${journalLinesInput.length} opening balance lines successfully.` });
    } catch (error) {
      next(error);
    }
  }
);

// Directly set opening balances for accounts (bulk edit)
const setOpeningBalancesSchema = z.object({
  lines: z.array(z.object({
    accountCode: z.string(),
    openingBalance: z.number()
  })).min(1)
});

router.post(
  '/trial-balance/set-opening-balances',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { lines } = setOpeningBalancesSchema.parse(req.body);
      const orgId = req.user!.orgId!;

      const orgAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.orgId, orgId))
        .orderBy(accounts.code);

      const accountMap = new Map<string, typeof orgAccounts[0]>();
      for (const a of orgAccounts) accountMap.set(a.code, a);

      const errors: string[] = [];
      let updated = 0;

      const jeLines: { accountId: string; debit: number; credit: number }[] = [];
      for (const item of lines) {
        const account = accountMap.get(item.accountCode);
        if (!account) { errors.push(`Account code "${item.accountCode}" not found`); continue; }
        const newBalance = Math.round(item.openingBalance * 100);
        if (newBalance !== 0) {
          jeLines.push({
            accountId: account.id,
            debit: newBalance > 0 ? newBalance : 0,
            credit: newBalance < 0 ? Math.abs(newBalance) : 0,
          });
        }
        updated++;
      }

      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: 'Some accounts could not be updated', errors, updated });
      }

      if (jeLines.length > 0) {
        await postToGL({
          orgId, date: new Date('1970-01-01'),
          description: 'Opening balance set',
          source: 'opening_balance', createdBy: req.user!.userId,
          lines: jeLines,
        });
      }

      createAuditLog({ orgId, userId: req.user!.userId, action: 'update', entityType: 'opening-balance', newValues: { count: updated }, ...extractReqMeta(req) });
      return res.status(200).json({ success: true, message: `Updated ${updated} account(s) successfully.` });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 2. INCOME STATEMENT ENDPOINT
// =========================================================================
router.get(
  '/income-statement',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, compareStart, compareEnd, format } = incomeStatementQuerySchema.parse(req.query);
      const orgId = req.user!.orgId!;

      if (format === 'json') {
        const data = await getProfitAndLoss(orgId, startDate, endDate, compareStart, compareEnd);
        return res.status(200).json({ success: true, data });
      }

      if (format === 'excel') {
        const buffer = await exportIncomeStatement(orgId, startDate, endDate);
        return sendFileBuffer(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'income_statement.xlsx');
      }

      if (format === 'pdf') {
        const buffer = await generateIncomeStatementPDF(orgId, startDate, endDate);
        return sendFileBuffer(res, buffer, 'application/pdf', 'income_statement.pdf', true);
      }
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 3. BALANCE SHEET ENDPOINT
// =========================================================================
router.get(
  '/balance-sheet',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { asOfDate, compareAsOf, format } = balanceSheetQuerySchema.parse(req.query);
      const orgId = req.user!.orgId!;

      if (format === 'json') {
        const data = await getBalanceSheet(orgId, asOfDate, compareAsOf);
        return res.status(200).json({ success: true, data });
      }

      if (format === 'excel') {
        const buffer = await exportBalanceSheet(orgId, asOfDate);
        return sendFileBuffer(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'balance_sheet.xlsx');
      }

      if (format === 'pdf') {
        const buffer = await generateBalanceSheetPDF(orgId, asOfDate);
        return sendFileBuffer(res, buffer, 'application/pdf', 'balance_sheet.pdf', true);
      }
    } catch (error) {
      next(error);
    }
  }
);

const cashFlowQuerySchema = z.object({
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  compareStart: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  compareEnd: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  format: z.enum(['pdf', 'excel', 'json']).default('json')
});

// =========================================================================
// 4. CASH FLOW ENDPOINT
// =========================================================================
router.get(
  '/cash-flow',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, compareStart, compareEnd, format } = cashFlowQuerySchema.parse(req.query);
      const orgId = req.user!.orgId!;

      if (format === 'json') {
        const data = await getCashFlowStatement(orgId, startDate, endDate, compareStart, compareEnd);
        return res.status(200).json({ success: true, data });
      }

      if (format === 'excel') {
        const buffer = await exportCashFlow(orgId, startDate, endDate);
        return sendFileBuffer(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'cash_flow.xlsx');
      }

      if (format === 'pdf') {
        const buffer = await generateCashFlowPDF(orgId, startDate, endDate);
        return sendFileBuffer(res, buffer, 'application/pdf', 'cash_flow.pdf', true);
      }
    } catch (error) {
      next(error);
    }
  }
);

const socieQuerySchema = z.object({
  asOfDate: z.string().transform((val) => new Date(val)),
  compareAsOf: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  format: z.enum(['pdf', 'excel', 'json']).default('json')
});

// =========================================================================
// 5. STATEMENT OF CHANGES IN EQUITY (SOCIE) ENDPOINT
// =========================================================================
router.get(
  '/statement-of-changes-in-equity',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { asOfDate, compareAsOf, format } = socieQuerySchema.parse(req.query);
      const orgId = req.user!.orgId!;

      if (format === 'json') {
        const data = await getStatementOfChangesInEquity(orgId, asOfDate, compareAsOf);
        return res.status(200).json({ success: true, data });
      }

      if (format === 'excel') {
        return res.status(501).json({ success: false, error: 'Excel export not yet implemented for SOCIE.' });
      }

      if (format === 'pdf') {
        const buffer = await generateStatementOfChangesInEquityPDF(orgId, asOfDate, compareAsOf);
        return sendFileBuffer(res, buffer, 'application/pdf', 'statement_of_changes_in_equity.pdf', true);
      }
    } catch (error: any) {
      console.error('[SOCIE] Error:', error?.message, error?.stack, error?.cause);
      next(error);
    }
  }
);

// =========================================================================
// 6. GENERAL LEDGER ACCOUNT BOOK ENDPOINT
// =========================================================================
router.get(
  '/general-ledger',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { accountId, startDate, endDate, format } = generalLedgerQuerySchema.parse(req.query);
      const orgId = req.user!.orgId!;

      // Validate account existence and auth
      const [acc] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.orgId, orgId)))
        .limit(1);

      if (!acc) {
        throw new AppError('Ledger account structure was not found.', 404);
      }

      if (format === 'json') {
        const lines = await db
          .select({
            date: journalEntries.date,
            entryNumber: journalEntries.entryNumber,
            description: journalEntries.description,
            debit: journalLines.debitAmount,
            credit: journalLines.creditAmount,
            currency: journalLines.currency,
            fxRate: journalLines.fxRate,
            source: journalEntries.source,
          })
          .from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .where(and(
            eq(journalLines.accountId, accountId),
            eq(journalEntries.orgId, orgId),
            gte(journalEntries.date, startDate),
            lte(journalEntries.date, endDate)
          ))
          .orderBy(journalEntries.date, journalEntries.entryNumber);

        return res.status(200).json({
          success: true,
          account: acc,
          lines,
        });
      }

      if (format === 'excel') {
        const buffer = await exportGeneralLedger(orgId, accountId, startDate, endDate);
        return sendFileBuffer(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `general_ledger_${acc.code}.xlsx`);
      }

      if (format === 'pdf') {
        // Fallback to Excel due to rich column structure unless PDF required.
        // We will pipe Excel stream which is fully compatible with GL.
        const buffer = await exportGeneralLedger(orgId, accountId, startDate, endDate);
        return sendFileBuffer(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `general_ledger_${acc.code}.xlsx`);
      }
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 6. AGED RECEIVABLES STATEMENT ENDPOINT
// =========================================================================
router.get(
  '/aged-receivables',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { format } = agedReportQuerySchema.parse(req.query);
      const orgId = req.user!.orgId!;

      if (format === 'json') {
        const data = await getInvoiceAgingReport(orgId);
        return res.status(200).json({ success: true, report: data });
      }

      if (format === 'excel') {
        const buffer = await exportAgedReceivables(orgId);
        return sendFileBuffer(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'aged_receivables.xlsx');
      }

      if (format === 'pdf') {
        const buffer = await generateAgedReportPDF(orgId, true);
        return sendFileBuffer(res, buffer, 'application/pdf', 'aged_receivables.pdf', true);
      }
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 7. AGED PAYABLES STATEMENT ENDPOINT
// =========================================================================
router.get(
  '/aged-payables',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { format } = agedReportQuerySchema.parse(req.query);
      const orgId = req.user!.orgId!;

      if (format === 'json') {
        const data = await getBillAgingReport(orgId);
        return res.status(200).json({ success: true, report: data });
      }

      if (format === 'excel') {
        const buffer = await exportAgedPayables(orgId);
        return sendFileBuffer(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'aged_payables.xlsx');
      }

      if (format === 'pdf') {
        const buffer = await generateAgedReportPDF(orgId, false);
        return sendFileBuffer(res, buffer, 'application/pdf', 'aged_payables.pdf', true);
      }
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 8. PAYROLL SETTLEMENT SCHEDULE ENDPOINT
// =========================================================================
router.get(
  '/payroll-schedule',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.orgId!;
      const { runId, format } = payrollScheduleQuerySchema.parse(req.query);

      if (format === 'excel') {
        const buffer = await exportPayrollSchedule(runId, orgId);
        return sendFileBuffer(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'payroll_bank_schedule.xlsx');
      }

      if (format === 'pdf') {
        // Fallback to beautiful Bank schedule sheet
        const buffer = await exportPayrollSchedule(runId, orgId);
        return sendFileBuffer(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'payroll_bank_schedule.xlsx');
      }
    } catch (error) {
      next(error);
    }
  }
);

router.post('/custom/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generateCustomReportPDF } = await import('../services/pdf.service');
    const orgId = req.user!.orgId!;
    const { title, headers, rows } = z.object({
      title: z.string(),
      headers: z.array(z.string()),
      rows: z.array(z.array(z.any()))
    }).parse(req.body);
    const buffer = await generateCustomReportPDF(orgId, title, headers, rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="custom_report.pdf"');
    return res.end(buffer);
  } catch (err) { return next(err); }
});

// =========================================================================
// 9. DASHBOARD SUMMARY ENDPOINT
// =========================================================================
const dashboardQuerySchema = z.object({
  startDate: z.string().optional().transform((val) => val ? new Date(val) : new Date(new Date().getFullYear(), 0, 1)),
  endDate: z.string().optional().transform((val) => val ? new Date(val) : new Date()),
});

router.get('/dashboard-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { startDate, endDate } = dashboardQuerySchema.parse(req.query);

    // 1. Total Revenue: credit balances on revenue-type accounts
    const [revResult] = await db
      .select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(
        and(
          eq(accounts.orgId, orgId),
          eq(accounts.type, 'revenue'),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, endDate)
        )
      );
    const totalRevenue = Number(revResult?.total || 0);

    // 2. Total Expenses: debit balances on expense-type accounts
    const [expResult] = await db
      .select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(
        and(
          eq(accounts.orgId, orgId),
          eq(accounts.type, 'expense'),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, endDate)
        )
      );
    const totalExpenses = Number(expResult?.total || 0);
    const netProfit = totalRevenue - totalExpenses;

    // 3. Receivables: find account with systemAccountRole = 'accounts_receivable'
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
            lte(journalEntries.date, endDate)
          )
        );
      totalReceivables = Number(arResult?.debits || 0) - Number(arResult?.credits || 0);
    }

    // 4. Payables: account with systemAccountRole = 'accounts_payable'
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
            lte(journalEntries.date, endDate)
          )
        );
      totalPayables = Number(apResult?.credits || 0) - Number(apResult?.debits || 0);
    }

    // 5. Cash & Bank: sum of bank accounts linked to GL accounts
    const [bankResult] = await db
      .select({ total: sql<number>`coalesce(sum(${bankAccounts.currentBalance}), 0)` })
      .from(bankAccounts)
      .where(eq(bankAccounts.orgId, orgId));
    const totalCashBank = Number(bankResult?.total || 0);

    // 6. Outstanding invoices count & total
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

    // 7. Outstanding bills count & total
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

    // 8. Customer & vendor counts
    const [customerResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.type, 'customer')));

    const [vendorResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.type, 'vendor')));

    return res.status(200).json({
      success: true,
      data: {
        period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        totalRevenue,
        totalExpenses,
        netProfit,
        totalReceivables,
        totalPayables,
        totalCashBank,
        outstandingInvoices: { count: Number(invResult?.count || 0), total: Number(invResult?.total || 0) },
        outstandingBills: { count: Number(billResult?.count || 0), total: Number(billResult?.total || 0) },
        customerCount: Number(customerResult?.count || 0),
        vendorCount: Number(vendorResult?.count || 0),
      }
    });
  } catch (err) {
    return next(err);
  }
});

// GET /reports/project-income-expense — project P&L
router.get('/project-income-expense', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { projectId, startDate, endDate } = req.query;

    const whereClauses: any[] = [eq(journalEntries.orgId, orgId)];
    if (projectId && typeof projectId === 'string') {
      whereClauses.push(sql`
        (${journalEntries.projectId} = ${projectId}::uuid
         OR (${journalEntries.source} = 'manual' AND ${journalEntries.sourceId} IN (SELECT id FROM expenses WHERE project_id = ${projectId}::uuid))
         OR (${journalEntries.source} = 'bill' AND ${journalEntries.sourceId} IN (SELECT id FROM bills WHERE project_id = ${projectId}::uuid))
         OR (${journalEntries.source} = 'payment' AND ${journalEntries.sourceId} IN (SELECT id FROM payments_received WHERE project_id = ${projectId}::uuid))
         OR (${journalEntries.source} = 'payment' AND ${journalEntries.sourceId} IN (SELECT id FROM payments_made WHERE project_id = ${projectId}::uuid))
         OR (${journalEntries.source} = 'invoice' AND ${journalEntries.sourceId} IN (SELECT id FROM invoices WHERE project_id = ${projectId}::uuid))
        )
      `);
    }
    if (startDate && typeof startDate === 'string') whereClauses.push(gte(journalEntries.date, new Date(startDate)));
    if (endDate && typeof endDate === 'string') whereClauses.push(lte(journalEntries.date, new Date(endDate)));

    const rows = await db
      .select({
        accountId: journalLines.accountId,
        accountCode: accounts.code,
        accountName: accounts.name,
        accountType: accounts.type,
        debitAmount: journalLines.debitAmount,
        creditAmount: journalLines.creditAmount,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(...whereClauses));

    const incomeMap: Record<string, { code: string; name: string; amount: number }> = {};
    const expenseMap: Record<string, { code: string; name: string; amount: number }> = {};
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const r of rows) {
      const net = Number(r.creditAmount || 0) - Number(r.debitAmount || 0);
      // Income: revenue account credits (actual revenue)
      if (r.accountType === 'revenue') {
        if (!incomeMap[r.accountId]) incomeMap[r.accountId] = { code: r.accountCode, name: r.accountName, amount: 0 };
        incomeMap[r.accountId].amount += net;
        totalIncome += net;
      }
      // Also count liability credits as income (VAT payable on invoices)
      if (r.accountType === 'liability' && net > 0) {
        if (!incomeMap[r.accountId]) incomeMap[r.accountId] = { code: r.accountCode, name: r.accountName, amount: 0 };
        incomeMap[r.accountId].amount += net;
        totalIncome += net;
      }
      // Expenses: expense account debits
      if (r.accountType === 'expense' && net < 0) {
        if (!expenseMap[r.accountId]) expenseMap[r.accountId] = { code: r.accountCode, name: r.accountName, amount: 0 };
        expenseMap[r.accountId].amount += Math.abs(net);
        totalExpenses += Math.abs(net);
      }
    }

    // Query cash received for the project
    let cashReceived = 0;
    let whtDeducted = 0;
    if (projectId && typeof projectId === 'string') {
      const pmtWhere = [eq(paymentsReceived.orgId, orgId), eq(paymentsReceived.projectId, projectId)];
      if (startDate && typeof startDate === 'string') pmtWhere.push(gte(paymentsReceived.date, new Date(startDate)));
      if (endDate && typeof endDate === 'string') pmtWhere.push(lte(paymentsReceived.date, new Date(endDate)));
      const [pmtTotals] = await db
        .select({
          totalCash: sql<number>`COALESCE(SUM(${paymentsReceived.amount}), 0)`,
        })
        .from(paymentsReceived)
        .where(and(...pmtWhere));
      cashReceived = Number(pmtTotals?.totalCash || 0);

      // Find WHT Receivable account for this org
      const [whtAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'wht_receivable')))
        .limit(1);
      if (whtAccount) {
        const [whtResult] = await db
          .select({
            totalWht: sql<number>`COALESCE(SUM(${journalLines.debitAmount}), 0)`,
          })
          .from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .where(and(
            eq(journalLines.accountId, whtAccount.id),
            eq(journalEntries.orgId, orgId),
            sql`(${journalEntries.projectId} = ${projectId}::uuid
              OR (${journalEntries.source} = 'manual' AND ${journalEntries.sourceId} IN (SELECT id FROM expenses WHERE project_id = ${projectId}::uuid))
              OR (${journalEntries.source} = 'bill' AND ${journalEntries.sourceId} IN (SELECT id FROM bills WHERE project_id = ${projectId}::uuid))
              OR (${journalEntries.source} = 'payment' AND ${journalEntries.sourceId} IN (SELECT id FROM payments_received WHERE project_id = ${projectId}::uuid))
              OR (${journalEntries.source} = 'payment' AND ${journalEntries.sourceId} IN (SELECT id FROM payments_made WHERE project_id = ${projectId}::uuid))
              OR (${journalEntries.source} = 'invoice' AND ${journalEntries.sourceId} IN (SELECT id FROM invoices WHERE project_id = ${projectId}::uuid))
            )`,
          ));
        whtDeducted = Number(whtResult?.totalWht || 0);
      }
    }

    return res.status(200).json({
      income: Object.values(incomeMap).filter(a => a.amount !== 0),
      expenses: Object.values(expenseMap).filter(a => a.amount !== 0),
      totalIncome,
      totalExpenses,
      profit: totalIncome - totalExpenses,
      cashReceived,
      whtDeducted,
    });
  } catch (err) {
    next(err);
  }
});

// GET /reports/project-summary — summary of all projects with income/expense/profit
router.get('/project-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { startDate, endDate } = req.query;

    const allProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.orgId, orgId));

    const dateWhere: any[] = [eq(journalEntries.orgId, orgId)];
    if (startDate && typeof startDate === 'string') dateWhere.push(gte(journalEntries.date, new Date(startDate)));
    if (endDate && typeof endDate === 'string') dateWhere.push(lte(journalEntries.date, new Date(endDate)));

    const summary: any[] = [];
    for (const p of allProjects) {
      const lines = await db
        .select({
          accountType: accounts.type,
          debitAmount: journalLines.debitAmount,
          creditAmount: journalLines.creditAmount,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
        .where(and(...dateWhere, sql`
          (${journalEntries.projectId} = ${p.id}::uuid
           OR (${journalEntries.source} = 'manual' AND ${journalEntries.sourceId} IN (SELECT id FROM expenses WHERE project_id = ${p.id}::uuid))
           OR (${journalEntries.source} = 'bill' AND ${journalEntries.sourceId} IN (SELECT id FROM bills WHERE project_id = ${p.id}::uuid))
           OR (${journalEntries.source} = 'payment' AND ${journalEntries.sourceId} IN (SELECT id FROM payments_received WHERE project_id = ${p.id}::uuid))
           OR (${journalEntries.source} = 'payment' AND ${journalEntries.sourceId} IN (SELECT id FROM payments_made WHERE project_id = ${p.id}::uuid))
           OR (${journalEntries.source} = 'invoice' AND ${journalEntries.sourceId} IN (SELECT id FROM invoices WHERE project_id = ${p.id}::uuid))
          )
        `));

      let totalIncome = 0;
      let totalExpenses = 0;
      for (const l of lines) {
        const net = Number(l.creditAmount || 0) - Number(l.debitAmount || 0);
        if (l.accountType === 'revenue') totalIncome += net;
        else if (l.accountType === 'liability' && net > 0) totalIncome += net;
        else if (l.accountType === 'expense' && net < 0) totalExpenses += Math.abs(net);
      }
      // Cash received for this project
      const [cashRow] = await db
        .select({ total: sql<number>`COALESCE(SUM(${paymentsReceived.amount}), 0)` })
        .from(paymentsReceived)
        .where(and(eq(paymentsReceived.orgId, orgId), eq(paymentsReceived.projectId, p.id)));
      const cashReceived = Number(cashRow?.total || 0);

      // WHT deducted for this project
      let whtDeducted = 0;
      const [whtAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'wht_receivable')))
        .limit(1);
      if (whtAccount) {
        const [whtRow] = await db
          .select({ total: sql<number>`COALESCE(SUM(${journalLines.debitAmount}), 0)` })
          .from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .where(and(
            eq(journalLines.accountId, whtAccount.id),
            eq(journalEntries.orgId, orgId),
            sql`(${journalEntries.projectId} = ${p.id}::uuid
              OR (${journalEntries.source} = 'manual' AND ${journalEntries.sourceId} IN (SELECT id FROM expenses WHERE project_id = ${p.id}::uuid))
              OR (${journalEntries.source} = 'bill' AND ${journalEntries.sourceId} IN (SELECT id FROM bills WHERE project_id = ${p.id}::uuid))
              OR (${journalEntries.source} = 'payment' AND ${journalEntries.sourceId} IN (SELECT id FROM payments_received WHERE project_id = ${p.id}::uuid))
              OR (${journalEntries.source} = 'payment' AND ${journalEntries.sourceId} IN (SELECT id FROM payments_made WHERE project_id = ${p.id}::uuid))
              OR (${journalEntries.source} = 'invoice' AND ${journalEntries.sourceId} IN (SELECT id FROM invoices WHERE project_id = ${p.id}::uuid))
            )`,
          ));
        whtDeducted = Number(whtRow?.total || 0);
      }

      summary.push({
        id: p.id,
        name: p.name,
        code: p.code,
        status: p.status,
        totalIncome,
        totalExpenses,
        profit: totalIncome - totalExpenses,
        cashReceived,
        whtDeducted,
      });
    }

    return res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;
