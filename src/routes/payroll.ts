/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, employees, payrollRuns, payrollLines } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import {
  calculatePayrollForEmployee,
  runPayroll,
  approvePayroll,
  generatePayslip,
  getPayrollSummary
} from '../services/payroll.service';

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
  isActive: z.boolean().optional().default(true)
});

const updateEmployeeSchema = createEmployeeSchema.partial();

const runPayrollSchema = z.object({
  periodStart: z.string().min(1, 'Period start date is required.'),
  periodEnd: z.string().min(1, 'Period end date is required.'),
  payDate: z.string().min(1, 'Disbursement payment date is required.'),
  employeeIds: z.array(z.string().uuid('Invalid employee ID.')).optional()
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
        orgId,
      })
      .returning();

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
    return res.status(200).json(approvedRunInfo);
  } catch (err) {
    return next(err);
  }
});

// Mark payroll run as paid
router.post('/runs/:id/pay', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
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

    // Update status to paid
    const [updatedPay] = await db
      .update(payrollRuns)
      .set({ status: 'paid' })
      .where(eq(payrollRuns.id, id))
      .returning();

    // Mock bank transfers stub for response
    const lines = await db
      .select()
      .from(payrollLines)
      .innerJoin(employees, eq(payrollLines.employeeId, employees.id))
      .where(eq(payrollLines.runId, id));

    const transferStubLogs = lines.map((line) => ({
      employeeName: `${line.employees.firstName} ${line.employees.lastName}`,
      bankName: line.employees.bankName || 'Unknown Bank',
      accountNumber: line.employees.accountNumber || '0000000000',
      disbursementAmountKobo: line.payroll_lines.netPay,
      narrative: `WAGES ${updatedPay.runNumber} ${new Date(updatedPay.periodEnd).toLocaleString('en-US', { month: 'short', year: 'numeric' })}`,
      status: 'success_disbursed_api_stub'
    }));

    console.log(`[FinanceOS Payroll API Stub] Initiated automatic direct bank settlement:`, transferStubLogs);

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

export default router;
