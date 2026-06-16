/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { db, accounts } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import {
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement
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
  format: z.enum(['pdf', 'excel', 'json']).default('json')
});

const balanceSheetQuerySchema = z.object({
  asOfDate: z.string().optional().transform((val) => val ? new Date(val) : new Date()),
  format: z.enum(['pdf', 'excel', 'json']).default('json')
});

const generalLedgerQuerySchema = z.object({
  accountId: z.string().uuid('Invalid account ID.'),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  format: z.enum(['pdf', 'excel']).default('excel')
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
