/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, employees, payrollRuns, payrollLines, bankAccounts } from '../db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import {
  calculatePayrollForEmployee,
  runPayroll,
  approvePayroll,
  unapprovePayroll,
  generatePayslip,
  getPayrollSummary
} from '../services/payroll.service';
import { createJournalEntry } from '../services/ledger.service';
import { postToGL } from '../services/posting.service';
import { createAuditLog, extractReqMeta } from '../services/audit.service';

const router = Router();

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

const createEmployeeSchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required.'),
  firstName: z.string().min(1, 'First Name is required.'),
  middleName: z.string().optional().nullable().default(null),
  lastName: z.string().min(1, 'Last Name is required.'),
  email: z.string().optional().nullable().default(null).or(z.literal('')),
  phone: z.string().optional().nullable().default(null),
  department: z.string().optional().nullable().default(null),
  designation: z.string().optional().nullable().default(null),
  dateOfBirth: z.string().optional().nullable().default(null),
  dateHired: z.string().optional().nullable().default(null),
  bankName: z.string().optional().nullable().default(null),
  accountNumber: z.string().optional().nullable().default(null),
  grossSalary: z.number().int().nonnegative('Gross salary must be non-negative (In Kobo).').optional().default(0),
  paymentFrequency: z.enum(['monthly', 'weekly', 'biweekly']).default('monthly'),
  pensionPin: z.string().optional().nullable().default(null),
  nhfNumber: z.string().optional().nullable().default(null),
  taxId: z.string().optional().nullable().default(null),
  isActive: z.boolean().optional().default(true),
  pensionablePortionPct: z.number().int().min(0).max(100).optional().default(80),
  pensionRatePct: z.number().int().min(0).max(30).optional().default(8),
  nhisApplicable: z.boolean().optional().default(false),
  nhfApplicable: z.boolean().optional().default(true),
  annualRent: z.number().int().nonnegative().optional().default(0),
  annualMortgageInterest: z.number().int().nonnegative().optional().default(0),
  annualLifeAssurance: z.number().int().nonnegative().optional().default(0),
  basicSalaryPct: z.number().int().min(0).max(100).optional().default(50),
  housingPct: z.number().int().min(0).max(100).optional().default(20),
  transportPct: z.number().int().min(0).max(100).optional().default(10),
  utilitiesPct: z.number().int().min(0).max(100).optional().default(10),
  mealsPct: z.number().int().min(0).max(100).optional().default(5),
  othersPct: z.number().int().min(0).max(100).optional().default(5),
  internalDeductions: z.array(z.object({ description: z.string(), amount: z.number().int().nonnegative() })).optional().default([])
});

const updateEmployeeSchema = createEmployeeSchema.partial();

const runPayrollSchema = z.object({
  periodStart: z.string().min(1, 'Period start date is required.'),
  periodEnd: z.string().min(1, 'Period end date is required.'),
  payDate: z.string().min(1, 'Disbursement payment date is required.'),
  employeeIds: z.array(z.string().uuid('Invalid employee ID.')).optional(),
  bankAccountId: z.string().uuid('Invalid bank account ID.').optional(),
  accruedSalaryAccountId: z.string().uuid('Invalid accrued salary account ID.').optional()
});

// Configure core security session checks on all payroll routes
router.use(authenticate);
router.use(requireOrg);

// ==========================================
// 1. EMPLOYEES ENDPOINTS
// ==========================================

// Get list of active/inactive employees
router.get('/employees', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const status = req.query.status as string; // 'all', 'active', 'inactive'
    const department = req.query.department as string;
    const search = req.query.search as string;

    const conditions = [eq(employees.orgId, orgId)];

    if (status === 'active') {
      conditions.push(eq(employees.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(employees.isActive, false));
    }

    if (department) {
      conditions.push(eq(employees.department, department));
    }

    if (search) {
      conditions.push(
        sql`(lower(${employees.firstName}) like ${`%${search.toLowerCase()}%`} or lower(${employees.middleName}) like ${`%${search.toLowerCase()}%`} or lower(${employees.lastName}) like ${`%${search.toLowerCase()}%`} or lower(${employees.staffId}) like ${`%${search.toLowerCase()}%`})`
      );
    }

    const list = await db
      .select()
      .from(employees)
      .where(and(...conditions))
      .orderBy(employees.lastName, employees.firstName);

    return res.status(200).json(list);
  } catch (err) {
    return next(err);
  }
});

function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

// Create new employee resource
router.post('/employees', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = createEmployeeSchema.parse(req.body);

    const [existing] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.orgId, orgId), eq(employees.staffId, body.staffId)))
      .limit(1);

    if (existing) {
      throw new AppError(`An employee with Staff ID ${body.staffId} already exists under this organization.`, 400);
    }

    const [employee] = await db
      .insert(employees)
      .values({
        staffId: body.staffId,
        firstName: body.firstName,
        middleName: body.middleName,
        lastName: body.lastName,
        email: body.email || null,
        phone: body.phone || null,
        department: body.department || null,
        designation: body.designation || null,
        dateOfBirth: safeDate(body.dateOfBirth),
        dateHired: safeDate(body.dateHired),
        bankName: body.bankName || null,
        accountNumber: body.accountNumber || null,
        grossSalary: body.grossSalary ?? 0,
        paymentFrequency: body.paymentFrequency ?? 'monthly',
        pensionPin: body.pensionPin || null,
        nhfNumber: body.nhfNumber || null,
        taxId: body.taxId || null,
        isActive: body.isActive ?? true,
        pensionablePortionPct: body.pensionablePortionPct ?? 80,
        pensionRatePct: body.pensionRatePct ?? 8,
        nhisApplicable: body.nhisApplicable ?? false,
        nhfApplicable: body.nhfApplicable ?? true,
        annualRent: body.annualRent ?? 0,
        annualMortgageInterest: body.annualMortgageInterest ?? 0,
        annualLifeAssurance: body.annualLifeAssurance ?? 0,
        basicSalaryPct: body.basicSalaryPct ?? 50,
        housingPct: body.housingPct ?? 20,
        transportPct: body.transportPct ?? 10,
        utilitiesPct: body.utilitiesPct ?? 10,
        mealsPct: body.mealsPct ?? 5,
        othersPct: body.othersPct ?? 5,
        orgId,
      })
      .returning();

    createAuditLog({ orgId, userId: req.user!.userId!, action: 'create', entityType: 'employee', entityId: employee.id, newValues: { staffId: body.staffId, fullName: `${body.firstName} ${body.lastName}` }, ...extractReqMeta(req) });
    return res.status(201).json(employee);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Retrieve single employee
router.get('/employees/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [employee] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.orgId, orgId)))
      .limit(1);

    if (!employee) {
      throw new AppError('The requested employee could not be found.', 404);
    }

    return res.status(200).json(employee);
  } catch (err) {
    return next(err);
  }
});

// Update standard employee details
router.patch('/employees/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = updateEmployeeSchema.parse(req.body);

    const [existingEmp] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.orgId, orgId)))
      .limit(1);

    if (!existingEmp) {
      throw new AppError('Employee record not found.', 404);
    }

    if (body.staffId && body.staffId !== existingEmp.staffId) {
      const [dupedStaff] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.orgId, orgId), eq(employees.staffId, body.staffId)));
      if (dupedStaff) {
        throw new AppError(`The Staff ID ${body.staffId} is already allocated to another employee.`, 400);
      }
    }

    const updatePayload: any = { ...body };
    if (body.dateOfBirth) updatePayload.dateOfBirth = new Date(body.dateOfBirth);
    if (body.dateHired) updatePayload.dateHired = new Date(body.dateHired);

    const [updated] = await db
      .update(employees)
      .set(updatePayload)
      .where(eq(employees.id, id))
      .returning();

    createAuditLog({ orgId, userId: req.user!.userId!, action: 'update', entityType: 'employee', entityId: id, newValues: body, ...extractReqMeta(req) });
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// ==========================================
// 2. PAYROLL RUNS ENDPOINTS
// ==========================================

// List previous runs history
router.get('/runs', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(payrollRuns)
      .where(eq(payrollRuns.orgId, orgId))
      .orderBy(desc(payrollRuns.payDate));

    return res.status(200).json(list);
  } catch (err) {
    return next(err);
  }
});

// Create draft payroll run and lines
router.post('/runs', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = runPayrollSchema.parse(req.body);

    const data = await runPayroll(orgId, body, userId);
    createAuditLog({ orgId, userId, action: 'create', entityType: 'payroll-run', entityId: data.id, newValues: { runNumber: data.runNumber }, ...extractReqMeta(req) });
    return res.status(201).json(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Retrieve single payroll run and lines
router.get('/runs/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [run] = await db
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.id, id), eq(payrollRuns.orgId, orgId)))
      .limit(1);

    if (!run) throw new AppError('The payroll run could not be found.', 404);

    const lines = await db
      .select()
      .from(payrollLines)
      .innerJoin(employees, eq(payrollLines.employeeId, employees.id))
      .where(eq(payrollLines.runId, id))
      .orderBy(employees.lastName);

    // Map rows beautifully
    const formattedLines = lines.map((row) => ({
      ...row.payroll_lines,
      employee: {
        id: row.employees.id,
        staffId: row.employees.staffId,
        firstName: row.employees.firstName,
        lastName: row.employees.lastName,
        department: row.employees.department,
        designation: row.employees.designation,
        bankName: row.employees.bankName,
        accountNumber: row.employees.accountNumber
      }
    }));

    return res.status(200).json({ run, lines: formattedLines });
  } catch (err) {
    return next(err);
  }
});

// Approve a payroll run and generate Double-Entry logs
router.post('/runs/:id/approve', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const approvedRunInfo = await approvePayroll(id, userId);
    createAuditLog({ orgId: req.user!.orgId!, userId, action: 'approve', entityType: 'payroll-run', entityId: id, newValues: { status: 'approved' }, ...extractReqMeta(req) });
    return res.status(200).json(approvedRunInfo);
  } catch (err) {
    return next(err);
  }
});

// Unapprove a payroll run and reverse all posted journals
router.post('/runs/:id/unapprove', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const result = await unapprovePayroll(id, userId);
    createAuditLog({ orgId: req.user!.orgId!, userId, action: 'unapprove', entityType: 'payroll-run', entityId: id, newValues: { status: 'draft' }, ...extractReqMeta(req) });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// Mark payroll run as paid
router.post('/runs/:id/pay', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { id } = req.params;

    const [run] = await db
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.id, id), eq(payrollRuns.orgId, orgId)))
      .limit(1);

    if (!run) throw new AppError('Payroll run not found.', 404);
    if (run.status !== 'approved') {
      throw new AppError('Payroll run must be approved before being closed as paid.', 400);
    }

    // If the run used an accrued salary account, transfer from accrual to bank on payment
    if (run.accruedSalaryAccountId) {
      // Resolve bank ledger account from the selected bank account
      let bankAccId: string;
      if (run.bankAccountId) {
        const [ba] = await db
          .select()
          .from(bankAccounts)
          .where(eq(bankAccounts.id, run.bankAccountId))
          .limit(1);
        if (!ba) throw new AppError('Selected bank account not found.', 404);
        bankAccId = ba.accountId;
      } else {
        throw new AppError('A bank account must be selected when using salary accrual.', 400);
      }

      // Fetch lines to get exact totalNet
      const lines = await db
        .select()
        .from(payrollLines)
        .where(eq(payrollLines.runId, id));

      const totalNet = lines.reduce((sum, l) => sum + l.netPay, 0);

      await postToGL({
        orgId,
        date: new Date(),
        description: `Salary accrual settlement — Payroll Run ${run.runNumber}`,
        reference: run.runNumber,
        source: 'payroll',
        sourceId: run.id,
        createdBy: userId,
        lines: [
          { accountId: run.accruedSalaryAccountId, debit: totalNet, description: `Accrued salary drawn down for Run ${run.runNumber}` },
          { accountId: bankAccId, credit: totalNet, description: `Bank disbursement settlement for Run ${run.runNumber}` }
        ]
      });
    }

    // Update status to paid
    const [updatedPay] = await db
      .update(payrollRuns)
      .set({ status: 'paid' })
      .where(eq(payrollRuns.id, id))
      .returning();

    // Mock bank transfers stub for response
    const lineRecords = await db
      .select()
      .from(payrollLines)
      .innerJoin(employees, eq(payrollLines.employeeId, employees.id))
      .where(eq(payrollLines.runId, id));

    const transferStubLogs = lineRecords.map((line) => ({
      employeeName: `${line.employees.firstName} ${line.employees.lastName}`,
      bankName: line.employees.bankName || 'Unknown Bank',
      accountNumber: line.employees.accountNumber || '0000000000',
      disbursementAmountKobo: line.payroll_lines.netPay,
      narrative: `WAGES ${updatedPay.runNumber} ${new Date(updatedPay.periodEnd).toLocaleString('en-US', { month: 'short', year: 'numeric' })}`,
      status: 'success_disbursed_api_stub'
    }));

    console.log(`[FinanceOS Payroll API Stub] Initiated automatic direct bank settlement:`, transferStubLogs);

    createAuditLog({ orgId, userId, action: 'pay', entityType: 'payroll-run', entityId: id, newValues: { status: 'paid' }, ...extractReqMeta(req) });
    return res.status(200).json({
      message: `Payroll run ${updatedPay.runNumber} has been successfully closed as PAID.`,
      payrollRun: updatedPay,
      directBankTransferStub: transferStubLogs
    });
  } catch (err) {
    return next(err);
  }
});

// Generate or fetch payslip data
router.get('/runs/:id/payslips/:employeeId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id, employeeId } = req.params;

    const [line] = await db
      .select()
      .from(payrollLines)
      .where(and(eq(payrollLines.runId, id), eq(payrollLines.employeeId, employeeId)))
      .limit(1);

    if (!line) {
      throw new AppError('Selected employees does not have an active payroll line record inside this cycle.', 404);
    }

    const payslip = await generatePayslip(line.id);
    return res.status(200).json(payslip);
  } catch (err) {
    return next(err);
  }
});

// ==========================================
// 3. REPORT SUMMARIES
// ==========================================

// Get annual summary of payroll payments & tax declarations
router.get('/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    const summaryReport = await getPayrollSummary(orgId, year);
    return res.status(200).json(summaryReport);
  } catch (err) {
    return next(err);
  }
});

// =========================================================================
// PDF EXPORT ROUTES
// =========================================================================
function sendPdf(res: Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  return res.end(buffer);
}

router.get('/employees/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generateEmployeesListPDF } = await import('../services/pdf.service');
    const buffer = await generateEmployeesListPDF(req.user!.orgId!);
    return sendPdf(res, buffer, 'employees_list.pdf');
  } catch (err) { return next(err); }
});

router.get('/runs/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generatePayrollRunsListPDF } = await import('../services/pdf.service');
    const orgId = req.user!.orgId!;
    const start = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const end = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const buffer = await generatePayrollRunsListPDF(orgId, start, end);
    return sendPdf(res, buffer, 'payroll_runs.pdf');
  } catch (err) { return next(err); }
});

router.get('/runs/:id/paye-schedule/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generatePAYESchedulePDF } = await import('../services/pdf.service');
    const buffer = await generatePAYESchedulePDF(req.params.id, req.user!.orgId!);
    return sendPdf(res, buffer, `paye_schedule_${req.params.id}.pdf`);
  } catch (err) { return next(err); }
});

router.get('/runs/:id/pension-schedule/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generatePensionSchedulePDF } = await import('../services/pdf.service');
    const buffer = await generatePensionSchedulePDF(req.params.id, req.user!.orgId!);
    return sendPdf(res, buffer, `pension_schedule_${req.params.id}.pdf`);
  } catch (err) { return next(err); }
});

router.get('/runs/:id/payslips/:employeeId/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generatePayslipPDF } = await import('../services/pdf.service');
    const line = await db.select().from(payrollLines)
      .where(and(eq(payrollLines.runId, req.params.id), eq(payrollLines.employeeId, req.params.employeeId)))
      .limit(1);
    if (!line[0]) throw new AppError('Payslip line not found.', 404);
    const buffer = await generatePayslipPDF(line[0].id);
    return sendPdf(res, buffer, `payslip_${req.params.employeeId}.pdf`);
  } catch (err) { return next(err); }
});

// Bulk delete employees (for clearing last CSV import)
router.post('/employees/bulk-delete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ids = req.body.ids as string[];
    if (!ids || !Array.isArray(ids) || ids.length === 0) throw new AppError('No employee IDs provided.', 400);
    await db.delete(employees).where(and(eq(employees.orgId, req.user!.orgId!), inArray(employees.id, ids)));
    createAuditLog({ orgId: req.user!.orgId!, userId: req.user!.userId!, action: 'delete', entityType: 'employee', newValues: { count: ids.length }, ...extractReqMeta(req) });
    res.json({ success: true, deleted: ids.length });
  } catch (err) { return next(err); }
});

// Delete single employee
router.delete('/employees/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [emp] = await db.select().from(employees).where(and(eq(employees.id, id), eq(employees.orgId, orgId))).limit(1);
    if (!emp) throw new AppError('Employee not found.', 404);
    await db.delete(employees).where(eq(employees.id, id));
    createAuditLog({ orgId, userId: req.user!.userId!, action: 'delete', entityType: 'employee', entityId: id, ...extractReqMeta(req) });
    res.json({ success: true });
  } catch (err) { return next(err); }
});

// Delete single payroll run (draft only)
router.delete('/runs/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, id), eq(payrollRuns.orgId, orgId))).limit(1);
    if (!run) throw new AppError('Payroll run not found.', 404);
    if (run.status !== 'draft') throw new AppError('Only draft runs can be deleted.', 400);
    await db.delete(payrollLines).where(eq(payrollLines.runId, id));
    await db.delete(payrollRuns).where(eq(payrollRuns.id, id));
    createAuditLog({ orgId, userId: req.user!.userId!, action: 'delete', entityType: 'payroll-run', entityId: id, ...extractReqMeta(req) });
    res.json({ success: true });
  } catch (err) { return next(err); }
});

// Bulk delete payroll runs (draft only)
router.post('/runs/bulk-delete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const ids = req.body.ids as string[];
    if (!ids || !Array.isArray(ids) || ids.length === 0) throw new AppError('No run IDs provided.', 400);
    const runs = await db.select().from(payrollRuns).where(and(eq(payrollRuns.orgId, orgId), inArray(payrollRuns.id, ids)));
    const draftIds = runs.filter(r => r.status === 'draft').map(r => r.id);
    if (draftIds.length > 0) {
      await db.delete(payrollLines).where(inArray(payrollLines.runId, draftIds));
      await db.delete(payrollRuns).where(inArray(payrollRuns.id, draftIds));
    }
    createAuditLog({ orgId, userId: req.user!.userId!, action: 'delete', entityType: 'payroll-run', newValues: { count: draftIds.length }, ...extractReqMeta(req) });
    res.json({ success: true, deleted: draftIds.length, skipped: ids.length - draftIds.length });
  } catch (err) { return next(err); }
});

// Delete single payslip line from a run
router.delete('/runs/:runId/payslips/:employeeId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { runId, employeeId } = req.params;
    const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, runId), eq(payrollRuns.orgId, orgId))).limit(1);
    if (!run) throw new AppError('Payroll run not found.', 404);
    if (run.status !== 'draft') throw new AppError('Can only delete payslips from draft runs.', 400);
    const [line] = await db.select().from(payrollLines).where(and(eq(payrollLines.runId, runId), eq(payrollLines.employeeId, employeeId))).limit(1);
    if (!line) throw new AppError('Payslip line not found.', 404);
    await db.delete(payrollLines).where(eq(payrollLines.id, line.id));
    createAuditLog({ orgId, userId: req.user!.userId!, action: 'delete', entityType: 'payslip', newValues: { runId, employeeId }, ...extractReqMeta(req) });
    res.json({ success: true });
  } catch (err) { return next(err); }
});

// Bulk delete payslip lines from a run
router.post('/runs/:runId/payslips/bulk-delete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { runId } = req.params;
    const employeeIds = req.body.employeeIds as string[];
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) throw new AppError('No employee IDs provided.', 400);
    const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, runId), eq(payrollRuns.orgId, orgId))).limit(1);
    if (!run) throw new AppError('Payroll run not found.', 404);
    if (run.status !== 'draft') throw new AppError('Can only delete payslips from draft runs.', 400);
    await db.delete(payrollLines).where(and(eq(payrollLines.runId, runId), inArray(payrollLines.employeeId, employeeIds)));
    createAuditLog({ orgId, userId: req.user!.userId!, action: 'delete', entityType: 'payslip', newValues: { count: employeeIds.length }, ...extractReqMeta(req) });
    res.json({ success: true, deleted: employeeIds.length });
  } catch (err) { return next(err); }
});

// One-time cleanup: delete old payroll reversal JE pairs that accumulated before the
// unapprove change (original + reversal entries for previously unapproved runs).
router.post('/cleanup-reversal-pairs', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const pairs = await db.execute(sql`
      SELECT rev.id AS rev_id, orig.id AS orig_id
      FROM journal_entries rev
      JOIN journal_entries orig
        ON orig.entry_number = COALESCE(rev.reference, substring(rev.description FROM 'Reversal of ([^ ]+)'))
        AND rev.org_id = orig.org_id
      WHERE rev.org_id = ${orgId}
        AND rev.source = 'payroll'
        AND rev.description LIKE 'Reversal of%'
        AND orig.source = 'payroll'
    `);
    if (pairs.rows.length === 0) {
      return res.json({ success: true, cleaned: 0, message: 'No reversal pairs found for this org.' });
    }
    const allIds: string[] = pairs.rows.flatMap((r: any) => [r.rev_id, r.orig_id]);
    const idsParam = sql.join(allIds.map(id => sql`${id}::uuid`), sql`, `);
    const lineDel = await db.execute(sql`DELETE FROM journal_lines WHERE entry_id IN (${idsParam})`);
    const entryDel = await db.execute(sql`DELETE FROM journal_entries WHERE id IN (${idsParam})`);
    res.json({ success: true, cleaned: pairs.rows.length, linesDeleted: lineDel.rowCount, entriesDeleted: entryDel.rowCount });
  } catch (err) { return next(err); }
});

export default router;
