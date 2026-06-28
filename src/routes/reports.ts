/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { db, accounts, journalEntries, journalLines, fixedAssets, bankAccounts, contacts } from '../db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import {
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement,
  TrialBalanceRow
} from '../services/ledger.service';
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
  generateAgedReportPDF
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

const balanceSheetQuerySchema = z.object({
  asOfDate: z.string().optional().transform((val) => val ? new Date(val) : new Date()),
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
        const csvHeader = 'Account Code,Account Name,Type,Debit (NGN),Credit (NGN)\n';
        const csvRows = data.map((r: TrialBalanceRow) =>
          `${r.accountCode},"${r.accountName.replace(/"/g, '""')}",${r.accountType},${(r.closingDebit / 100).toFixed(2)},${(r.closingCredit / 100).toFixed(2)}`
        ).join('\n');
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
      const userId = req.user!.id;

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

      // Update accounts.opening_balance
      for (const line of journalLinesInput) {
        const net = line.debit - line.credit;
        const acct = orgAccounts.find(a => a.id === line.accountId);
        if (acct) {
          await db
            .update(accounts)
            .set({ openingBalance: sql`${accounts.openingBalance} + ${net}` })
            .where(eq(accounts.id, line.accountId));
        }
      }

      // Create journal entry
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(journalEntries)
        .where(eq(journalEntries.orgId, orgId));
      const count = Number(countResult?.count || 0) + 1;
      const entryNumber = `OB-${String(count).padStart(6, '0')}`;

      await db.insert(journalEntries).values({
        orgId,
        entryNumber,
        date: new Date('1970-01-01'),
        description: 'Opening balance import',
        source: 'opening_balance',
        createdBy: userId
      });

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
      const userId = req.user!.id;

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

      for (const line of journalLinesInput) {
        const net = line.debit - line.credit;
        await db
          .update(accounts)
          .set({ openingBalance: sql`${accounts.openingBalance} + ${net}` })
          .where(eq(accounts.id, line.accountId));
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(journalEntries)
        .where(eq(journalEntries.orgId, orgId));
      const count = Number(countResult?.count || 0) + 1;
      const entryNumber = `OB-${String(count).padStart(6, '0')}`;

      await db.insert(journalEntries).values({
        orgId,
        entryNumber,
        date: new Date('1970-01-01'),
        description: 'Opening balance import',
        source: 'opening_balance',
        createdBy: userId
      });

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

      for (const item of lines) {
        const account = accountMap.get(item.accountCode);
        if (!account) { errors.push(`Account code "${item.accountCode}" not found`); continue; }

        // Opening balances only valid for balance sheet accounts
        if (account.type === 'expense' || account.type === 'revenue') {
          errors.push(`"${item.accountCode}" is a P&L account — opening balances cannot be set on income/expense accounts`);
          continue;
        }

        const newBalance = Math.round(item.openingBalance * 100);
        await db
          .update(accounts)
          .set({ openingBalance: newBalance })
          .where(eq(accounts.id, account.id));
        updated++;
      }

      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: 'Some accounts could not be updated', errors, updated });
      }

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
      const { startDate, endDate, format } = dateRangeQuerySchema.parse(req.query);
      const orgId = req.user!.orgId!;

      if (format === 'json') {
        const data = await getIncomeStatement(orgId, startDate, endDate);
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
      const { asOfDate, format } = balanceSheetQuerySchema.parse(req.query);
      const orgId = req.user!.orgId!;

      if (format === 'json') {
        const data = await getBalanceSheet(orgId, asOfDate);
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

// =========================================================================
// 4. CASH FLOW ENDPOINT
// =========================================================================
router.get(
  '/cash-flow',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, format } = dateRangeQuerySchema.parse(req.query);
      const orgId = req.user!.orgId!;

      if (format === 'json') {
        const data = await getCashFlowStatement(orgId, startDate, endDate);
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

// =========================================================================
// 5. GENERAL LEDGER ACCOUNT BOOK ENDPOINT
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
      const { runId, format } = payrollScheduleQuerySchema.parse(req.query);

      if (format === 'excel') {
        const buffer = await exportPayrollSchedule(runId);
        return sendFileBuffer(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'payroll_bank_schedule.xlsx');
      }

      if (format === 'pdf') {
        // Fallback to beautiful Bank schedule sheet
        const buffer = await exportPayrollSchedule(runId);
        return sendFileBuffer(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'payroll_bank_schedule.xlsx');
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;
