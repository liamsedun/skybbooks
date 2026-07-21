/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import {
  db,
  contacts,
  bills,
  billLines,
  paymentsMade,
  paymentMadeAllocations,
  vendorCredits,
  expenses,
  purchaseOrders,
  accounts,
  journalEntries,
  journalLines
} from '../db/schema';
import { eq, and, desc, sql, gte, lte, getTableColumns } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import {
  createBill,
  updateBill,
  approveBill,
  unapproveBill,
  voidBill,
  duplicateBill,
  getBill,
  listBills,
  getBillAgingReport
} from '../services/bill.service';
import { createAuditLog, extractReqMeta } from '../services/audit.service';
import { validateAndExecuteTransition } from '../services/approval.service';
import { createJournalEntry } from '../services/ledger.service';
import { postToGL } from '../services/posting.service';
import {
  createRecurringBill,
  listRecurringBills,
  getRecurringBill,
  updateRecurringBill,
  deleteRecurringBill,
  generateBillFromTemplate,
} from '../services/recurring-bills.service';
import {
  recordPaymentMade,
  updatePaymentMade,
  deletePaymentMade
} from '../services/payment.service';
import {
  createExpense,
  listExpenses,
  updateExpense,
  deleteExpense,
  attachReceipt
} from '../services/expense.service';
import {
  createVendorCredit,
  applyVendorCredit,
  voidVendorCredit,
  listVendorCredits,
  getVendorCredit,
  updateVendorCredit
} from '../services/vendorCredit.service';
import {
  createPO,
  updatePO,
  sendPO,
  confirmPO,
  acceptPO,
  approvePO,
  convertToBill,
  convertToExpense,
  getPO,
  listPOs,
  deletePO
} from '../services/purchaseOrder.service';

const router = Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit max

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

const createBillSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor id.'),
  poId: z.string().uuid().optional().nullable(),
  date: z.string().optional(),
  dueDate: z.string().optional(),
  currency: z.string().optional(),
  fxRate: z.number().optional(),
  projectId: z.string().uuid().optional().nullable(),
  lines: z.array(
    z.object({
      itemId: z.string().uuid().optional().nullable(),
      description: z.string().optional(),
      quantity: z.number().positive('Quantity must be greater than zero.'),
      unitPrice: z.number().int().nonnegative('Price must be non-negative (In Kobo).'),
      taxRate: z.number().nonnegative().optional(),
      accountId: z.string().uuid().optional().nullable()
    })
  ).min(1, 'Bill must contain at least one line.')
});

const updateBillSchema = createBillSchema.partial();

const recordPaymentMadeSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor id.'),
  date: z.string().optional(),
  amount: z.number().int().positive('Payment amount must be greater than zero (In Kobo).'),
  whtAmount: z.number().int().min(0).optional().default(0),
  currency: z.string().optional(),
  fxRate: z.number().optional(),
  projectId: z.string().uuid().optional().nullable(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'cheque', 'pos', 'ussd']),
  reference: z.string().optional().nullable(),
  accountId: z.string().uuid('Invalid bank reference. Asset general ledger account required.'),
  notes: z.string().optional().nullable(),
  allocations: z.array(
    z.object({
      billId: z.string().uuid(),
      amount: z.number().int().positive('Allocation amount must be positive.')
    })
  ).min(1, 'Payment must specify at least one bill allocation.')
});

const createExpenseSchema = z.object({
  accountId: z.string().uuid('Invalid expense general ledger account ID.'),
  vendorId: z.string().uuid().optional().nullable(),
  date: z.string().optional(),
  amount: z.number().int().positive('Amount must be positive (In Kobo).'),
  taxAmount: z.number().int().nonnegative('Tax amount must be non-negative (In Kobo).').optional().default(0),
  currency: z.string().optional().default('NGN'),
  fxRate: z.number().optional(),
  projectId: z.string().uuid().optional().nullable(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'cheque', 'pos', 'ussd']).optional().default('cash'),
  reference: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isBillable: z.boolean().optional().default(false),
  onAccount: z.boolean().optional().default(false),
  paymentAccountId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  receiptUrl: z.string().optional().nullable()
});

const updateExpenseSchema = createExpenseSchema.partial();

const createPOSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor id.'),
  date: z.string().optional(),
  expectedDate: z.string().optional().nullable(),
  currency: z.string().optional(),
  fxRate: z.number().optional(),
  notes: z.string().optional().nullable(),
  lines: z.array(
    z.object({
      itemId: z.string().uuid().optional().nullable(),
      description: z.string().optional(),
      quantity: z.number().positive('Quantity must be greater than zero.'),
      unitPrice: z.number().int().nonnegative('Price must be non-negative (In Kobo).'),
      taxRate: z.number().nonnegative().optional(),
      accountId: z.string().uuid().optional().nullable()
    })
  ).optional().default([])
});

const updatePOSchema = createPOSchema.partial();

const createVendorSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty.'),
  email: z.string().email('Invalid email address.').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().default('Nigeria'),
  taxPin: z.string().optional().nullable(),
  paymentTerms: z.number().optional().nullable(),
  creditLimit: z.number().int().optional().nullable().transform(v => v ?? 0),
  balance: z.number().int().optional().nullable().transform(v => v ?? 0),
  currency: z.string().default('NGN'),
  notes: z.string().optional().nullable()
});

const updateVendorSchema = createVendorSchema.partial().extend({
  isActive: z.boolean().optional()
});

const createVendorCreditSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor id.'),
  billId: z.string().uuid().optional().nullable(),
  date: z.string().optional(),
  currency: z.string().optional(),
  fxRate: z.number().optional(),
  subtotal: z.number().int().nonnegative().default(0),
  tax: z.number().int().nonnegative().default(0),
  notes: z.string().optional().nullable(),
});

const applyVendorCreditSchema = z.object({
  billId: z.string().uuid('Invalid bill id.'),
  amount: z.number().int().positive('Amount must be positive (In Kobo).'),
});

const recurringTemplateLineSchema = z.object({
  itemId: z.string().uuid().nullable().optional(),
  description: z.string(),
  quantity: z.number().positive('Quantity must be positive.'),
  unitPrice: z.number().int().positive('Unit price must be positive (in Kobo).'),
  taxRate: z.number().min(0).optional().default(0),
  taxId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
});

const createRecurringBillSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor.'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually']),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  autoSend: z.boolean().optional().default(false),
  template: z.object({
    notes: z.string().nullable().optional(),
    paymentTerms: z.number().nullable().optional(),
    lines: z.array(recurringTemplateLineSchema).min(1, 'At least one line is required.'),
  }),
});

const updateRecurringBillSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor.').optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually']).optional(),
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).nullable().optional(),
  isActive: z.boolean().optional(),
  autoSend: z.boolean().optional(),
  template: z.object({
    notes: z.string().nullable().optional(),
    paymentTerms: z.number().nullable().optional(),
    lines: z.array(recurringTemplateLineSchema).min(1, 'At least one line is required.'),
  }).optional(),
});

// Configure core security session middleware checks on all purchases routes
router.use(authenticate);
router.use(requireOrg);

// ==========================================
// 1. BILLS ENDPOINTS
// ==========================================

router.get('/bills', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const filters = {
      status: req.query.status as string,
      vendorId: req.query.vendorId as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      search: req.query.search as string,
      accountCode: req.query.accountCode as string,
    };
    const pagination = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10
    };

    const data = await listBills(orgId, filters, pagination);
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
});

// Get aging metrics for outstanding supplier bills
router.get('/bills/aging-report', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const report = await getBillAgingReport(orgId);
    return res.status(200).json(report);
  } catch (err) {
    return next(err);
  }
});

router.post('/bills', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = createBillSchema.parse(req.body);

    const bill = await createBill({ ...body, orgId }, userId);
    createAuditLog({ orgId, userId, action: 'create', entityType: 'bill', entityId: bill.id, newValues: { vendorId: body.vendorId, total: bill.total }, ...extractReqMeta(req) });
    return res.status(201).json(bill);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

router.get('/bills/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const bill = await getBill(id, orgId);
    return res.status(200).json(bill);
  } catch (err) {
    return next(err);
  }
});

router.patch('/bills/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = updateBillSchema.parse(req.body);

    const updated = await updateBill(id, body, userId, orgId);
    createAuditLog({ orgId, userId, action: 'update', entityType: 'bill', entityId: id, newValues: body, ...extractReqMeta(req) });
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Change bill status to open and post General Ledger entries
router.post('/bills/:id/approve', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const approved = await approveBill(id, userId, orgId);
    createAuditLog({ orgId, userId, action: 'approve', entityType: 'bill', entityId: id, newValues: { status: 'open' }, ...extractReqMeta(req) });
    return res.status(200).json(approved);
  } catch (err) {
    return next(err);
  }
});

// Reverse bill approval: reverse journal entries and set back to draft
router.post('/bills/:id/unapprove', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const unapproved = await unapproveBill(id, userId, orgId);
    createAuditLog({ orgId, userId, action: 'unapprove', entityType: 'bill', entityId: id, newValues: { status: 'draft' }, ...extractReqMeta(req) });
    return res.status(200).json(unapproved);
  } catch (err) {
    return next(err);
  }
});

// Void an existing bill (reversing matching GL postings)
router.post('/bills/:id/void', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const voided = await voidBill(id, userId, orgId);
    createAuditLog({ orgId, userId, action: 'void', entityType: 'bill', entityId: id, newValues: { status: 'void' }, ...extractReqMeta(req) });
    return res.status(200).json(voided);
  } catch (err) {
    return next(err);
  }
});

// Duplicate an existing bill as draft
router.post('/bills/:id/duplicate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const duplicated = await duplicateBill(id, userId, orgId);
    createAuditLog({ orgId, userId, action: 'create', entityType: 'bill', entityId: duplicated.id, newValues: { duplicatedFrom: id }, ...extractReqMeta(req) });
    return res.status(201).json(duplicated);
  } catch (err) {
    return next(err);
  }
});

router.post('/bills/:id/submit-review', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const userRole = req.user!.role;
    const { id } = req.params;
    const bill = await getBill(id, orgId);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'bills', id, bill.status, 'submit', userId, userRole);
    await db.update(bills).set({ status: newStatus as any }).where(eq(bills.id, id));
    createAuditLog({ orgId, userId, action: 'submit_review', entityType: 'bill', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...bill, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/bills/:id/reject', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const userRole = req.user!.role;
    const { id } = req.params;
    const bill = await getBill(id, orgId);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'bills', id, bill.status, 'reject', userId, userRole);
    await db.update(bills).set({ status: newStatus as any }).where(eq(bills.id, id));
    createAuditLog({ orgId, userId, action: 'reject', entityType: 'bill', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...bill, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/bills/:id/recall', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const userRole = req.user!.role;
    const { id } = req.params;
    const bill = await getBill(id, orgId);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'bills', id, bill.status, 'recall', userId, userRole);
    await db.update(bills).set({ status: newStatus as any }).where(eq(bills.id, id));
    createAuditLog({ orgId, userId, action: 'recall', entityType: 'bill', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...bill, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/bills/:id/post', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const userRole = req.user!.role;
    const { id } = req.params;
    const bill = await getBill(id, orgId);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'bills', id, bill.status, 'post', userId, userRole);
    const posted = await approveBill(id, userId, orgId);
    await db.update(bills).set({ status: 'posted' as any, postedBy: userId }).where(eq(bills.id, id));
    createAuditLog({ orgId, userId, action: 'post', entityType: 'bill', entityId: id, newValues: { status: 'posted' }, ...extractReqMeta(req) });
    return res.status(200).json(posted);
  } catch (err) { next(err); }
});

// ==========================================
// 2. PAYMENTS MADE ENDPOINTS (VENDOR SUPPLIER ACTIONS)
// ==========================================

router.get('/payments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const conditions = [eq(paymentsMade.orgId, orgId)];
    if (req.query.startDate) conditions.push(gte(paymentsMade.date, new Date(req.query.startDate as string)));
    if (req.query.endDate) conditions.push(lte(paymentsMade.date, new Date(req.query.endDate as string)));
    const pmtCols = getTableColumns(paymentsMade);
    const list = await db
      .select({ ...pmtCols, journalEntryNumber: journalEntries.entryNumber })
      .from(paymentsMade)
      .leftJoin(journalEntries, eq(paymentsMade.journalEntryId, journalEntries.id))
      .where(and(...conditions))
      .orderBy(desc(paymentsMade.date));

    return res.status(200).json(list);
  } catch (err) {
    return next(err);
  }
});

router.post('/payments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = recordPaymentMadeSchema.parse(req.body);

    const paymentMade = await recordPaymentMade({ ...body, orgId }, userId);
    createAuditLog({ orgId, userId, action: 'create', entityType: 'payment-made', entityId: paymentMade.id, newValues: { vendorId: body.vendorId, amount: paymentMade.amount }, ...extractReqMeta(req) });
    return res.status(201).json(paymentMade);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

router.get('/payments/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const pmtCols = getTableColumns(paymentsMade);
    const [pmt] = await db
      .select({ ...pmtCols, journalEntryNumber: journalEntries.entryNumber })
      .from(paymentsMade)
      .leftJoin(journalEntries, eq(paymentsMade.journalEntryId, journalEntries.id))
      .where(and(eq(paymentsMade.id, id), eq(paymentsMade.orgId, orgId)))
      .limit(1);

    if (!pmt) throw new AppError('Outbound supplier payment could not be found.', 404);

    const allocations = await db
      .select()
      .from(paymentMadeAllocations)
      .where(eq(paymentMadeAllocations.paymentId, id));

    const totalAllocated = allocations.reduce((s, a) => s + Number(a.amount), 0);
    const whtAmount = Math.max(0, totalAllocated - Number(pmt.amount));

    return res.status(200).json({ ...pmt, allocations, whtAmount, totalAllocated });
  } catch (err) {
    return next(err);
  }
});

router.patch('/payments/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const updated = await updatePaymentMade(id, req.body, userId, orgId);
    createAuditLog({ orgId, userId, action: 'update', entityType: 'payment-made', entityId: id, newValues: req.body, ...extractReqMeta(req) });
    return res.status(200).json(updated);
  } catch (err) {
    return next(err);
  }
});

router.delete('/payments/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const result = await deletePaymentMade(id, userId, orgId);
    createAuditLog({ orgId, userId, action: 'delete', entityType: 'payment-made', entityId: id, ...extractReqMeta(req) });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/payments/:id/submit-review', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const [pmt] = await db.select().from(paymentsMade).where(and(eq(paymentsMade.id, id), eq(paymentsMade.orgId, orgId))).limit(1);
    if (!pmt) throw new AppError('Payment not found.', 404);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'payments_made', id, pmt.status, 'submit', userId, userRole);
    await db.update(paymentsMade).set({ status: newStatus as any }).where(eq(paymentsMade.id, id));
    createAuditLog({ orgId, userId, action: 'submit_review', entityType: 'payment-made', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...pmt, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/payments/:id/approve', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const [pmt] = await db.select().from(paymentsMade).where(and(eq(paymentsMade.id, id), eq(paymentsMade.orgId, orgId))).limit(1);
    if (!pmt) throw new AppError('Payment not found.', 404);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'payments_made', id, pmt.status, 'approve', userId, userRole);
    await db.update(paymentsMade).set({ status: newStatus as any, approvedBy: userId }).where(eq(paymentsMade.id, id));
    createAuditLog({ orgId, userId, action: 'approve', entityType: 'payment-made', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...pmt, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/payments/:id/reject', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const [pmt] = await db.select().from(paymentsMade).where(and(eq(paymentsMade.id, id), eq(paymentsMade.orgId, orgId))).limit(1);
    if (!pmt) throw new AppError('Payment not found.', 404);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'payments_made', id, pmt.status, 'reject', userId, userRole);
    await db.update(paymentsMade).set({ status: newStatus as any }).where(eq(paymentsMade.id, id));
    createAuditLog({ orgId, userId, action: 'reject', entityType: 'payment-made', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...pmt, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/payments/:id/recall', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const [pmt] = await db.select().from(paymentsMade).where(and(eq(paymentsMade.id, id), eq(paymentsMade.orgId, orgId))).limit(1);
    if (!pmt) throw new AppError('Payment not found.', 404);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'payments_made', id, pmt.status, 'recall', userId, userRole);
    await db.update(paymentsMade).set({ status: newStatus as any }).where(eq(paymentsMade.id, id));
    createAuditLog({ orgId, userId, action: 'recall', entityType: 'payment-made', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...pmt, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/payments/:id/post', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const [pmt] = await db.select().from(paymentsMade).where(and(eq(paymentsMade.id, id), eq(paymentsMade.orgId, orgId))).limit(1);
    if (!pmt) throw new AppError('Payment not found.', 404);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'payments_made', id, pmt.status, 'post', userId, userRole);
    const posted = await recordPaymentMade({
      vendorId: pmt.vendorId, date: pmt.date?.toISOString(), amount: pmt.amount,
      currency: pmt.currency, fxRate: pmt.fxRate, paymentMethod: pmt.paymentMethod,
      reference: pmt.reference, accountId: pmt.accountId, notes: pmt.notes,
      allocations: [],
    } as any, userId);
    await db.update(paymentsMade).set({ status: 'posted' as any, postedBy: userId, journalEntryId: posted?.journalEntryId }).where(eq(paymentsMade.id, id));
    createAuditLog({ orgId, userId, action: 'post', entityType: 'payment-made', entityId: id, newValues: { status: 'posted' }, ...extractReqMeta(req) });
    return res.status(200).json(posted);
  } catch (err) { next(err); }
});

// ==========================================
// 3. EXPENSES ENDPOINTS (DIRECT DISBURSED OUTLAYS)
// ==========================================

router.get('/expenses', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const filters: any = {};
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
    const list = await listExpenses(orgId, filters);
    return res.status(200).json(list);
  } catch (err) {
    return next(err);
  }
});

router.post('/expenses', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = createExpenseSchema.parse(req.body);

    const expense = await createExpense({ ...body, orgId }, userId);
    createAuditLog({ orgId, userId, action: 'create', entityType: 'expense', entityId: expense.id, newValues: { vendorId: body.vendorId, total: expense.total }, ...extractReqMeta(req) });
    return res.status(201).json(expense);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Capture receipt file + OCR process
router.post('/expenses/:id/receipt', upload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const { id } = req.params;

    if (!req.file) {
      throw new AppError('No receipt image file was detected in upload payload.', 400);
    }

    // Attach receipt scanning process
    const ocrData = await attachReceipt(id, req.file.buffer);
    createAuditLog({ orgId, userId, action: 'upload', entityType: 'expense', entityId: id, newValues: { receiptUploaded: true }, ...extractReqMeta(req) });
    return res.status(200).json(ocrData);
  } catch (err) {
    return next(err);
  }
});

router.get('/expenses/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const expenseCols = getTableColumns(expenses);
    const [expense] = await db
      .select({ ...expenseCols, journalEntryNumber: journalEntries.entryNumber })
      .from(expenses)
      .leftJoin(journalEntries, eq(expenses.journalEntryId, journalEntries.id))
      .where(and(eq(expenses.id, id), eq(expenses.orgId, orgId)))
      .limit(1);

    if (!expense) throw new AppError('Expense record not found.', 404);
    return res.status(200).json(expense);
  } catch (err) {
    return next(err);
  }
});

router.patch('/expenses/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = updateExpenseSchema.parse(req.body);

    const updated = await updateExpense(id, body, userId, orgId);
    createAuditLog({ orgId, userId, action: 'update', entityType: 'expense', entityId: id, newValues: body, ...extractReqMeta(req) });
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

router.delete('/expenses/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const result = await deleteExpense(id, userId, orgId);
    createAuditLog({ orgId, userId, action: 'delete', entityType: 'expense', entityId: id, ...extractReqMeta(req) });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/expenses/:id/submit-review', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const [expense] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.orgId, orgId))).limit(1);
    if (!expense) throw new AppError('Expense not found.', 404);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'expenses', id, expense.status, 'submit', userId, userRole);
    await db.update(expenses).set({ status: newStatus as any }).where(eq(expenses.id, id));
    createAuditLog({ orgId, userId, action: 'submit_review', entityType: 'expense', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...expense, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/expenses/:id/approve', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const [expense] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.orgId, orgId))).limit(1);
    if (!expense) throw new AppError('Expense not found.', 404);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'expenses', id, expense.status, 'approve', userId, userRole);
    await db.update(expenses).set({ status: newStatus as any, approvedBy: userId }).where(eq(expenses.id, id));
    createAuditLog({ orgId, userId, action: 'approve', entityType: 'expense', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...expense, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/expenses/:id/reject', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const [expense] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.orgId, orgId))).limit(1);
    if (!expense) throw new AppError('Expense not found.', 404);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'expenses', id, expense.status, 'reject', userId, userRole);
    await db.update(expenses).set({ status: newStatus as any }).where(eq(expenses.id, id));
    createAuditLog({ orgId, userId, action: 'reject', entityType: 'expense', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...expense, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/expenses/:id/recall', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const [expense] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.orgId, orgId))).limit(1);
    if (!expense) throw new AppError('Expense not found.', 404);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'expenses', id, expense.status, 'recall', userId, userRole);
    await db.update(expenses).set({ status: newStatus as any }).where(eq(expenses.id, id));
    createAuditLog({ orgId, userId, action: 'recall', entityType: 'expense', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...expense, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/expenses/:id/post', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const [expense] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.orgId, orgId))).limit(1);
    if (!expense) throw new AppError('Expense not found.', 404);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'expenses', id, expense.status, 'post', userId, userRole);
    const posted = await createExpense({
      accountId: expense.accountId, vendorId: expense.vendorId, date: expense.date?.toISOString(),
      amount: expense.amount, taxAmount: expense.taxAmount, currency: expense.currency,
      fxRate: expense.fxRate, paymentMethod: expense.paymentMethod, reference: expense.reference,
      description: expense.description, isBillable: expense.isBillable,
      paymentAccountId: null, customerId: expense.customerId, projectId: expense.projectId,
    } as any, userId);
    await db.update(expenses).set({ status: 'posted' as any, postedBy: userId, journalEntryId: posted.journalEntryId }).where(eq(expenses.id, id));
    createAuditLog({ orgId, userId, action: 'post', entityType: 'expense', entityId: id, newValues: { status: 'posted' }, ...extractReqMeta(req) });
    return res.status(200).json(posted);
  } catch (err) { next(err); }
});

// ==========================================
// 4. PURCHASE ORDERS ENDPOINTS
// ==========================================

router.get('/orders', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const filters = {
      status: req.query.status as string,
      vendorId: req.query.vendorId as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string
    };
    const pagination = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10
    };

    const data = await listPOs(orgId, filters, pagination);
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
});

router.post('/orders', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = createPOSchema.parse(req.body);

    const po = await createPO({ ...body, orgId }, userId);
    createAuditLog({ orgId, userId, action: 'create', entityType: 'purchase-order', entityId: po.id, newValues: { vendorId: body.vendorId, total: po.total }, ...extractReqMeta(req) });
    return res.status(201).json(po);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

router.get('/orders/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const po = await getPO(id, orgId);
    return res.status(200).json(po);
  } catch (err) {
    return next(err);
  }
});

router.patch('/orders/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = updatePOSchema.parse(req.body);

    const updated = await updatePO(id, body, userId, orgId);
    createAuditLog({ orgId, userId, action: 'update', entityType: 'purchase-order', entityId: id, newValues: body, ...extractReqMeta(req) });
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

router.delete('/orders/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await deletePO(id, orgId);
    createAuditLog({ orgId, userId, action: 'delete', entityType: 'purchase-order', entityId: id, ...extractReqMeta(req) });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// Status transitions for PO approval flow
router.post('/orders/:id/confirm', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const result = await confirmPO(id, userId, orgId);
    createAuditLog({ orgId, userId, action: 'confirm', entityType: 'purchase-order', entityId: id, newValues: { status: 'confirmed' }, ...extractReqMeta(req) });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/orders/:id/accept', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const result = await acceptPO(id, userId, orgId);
    createAuditLog({ orgId, userId, action: 'accept', entityType: 'purchase-order', entityId: id, newValues: { status: 'accepted' }, ...extractReqMeta(req) });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/orders/:id/approve', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const result = await approvePO(id, userId, orgId);
    createAuditLog({ orgId, userId, action: 'approve', entityType: 'purchase-order', entityId: id, newValues: { status: 'approved' }, ...extractReqMeta(req) });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/orders/:id/submit-review', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const po = await getPO(id, orgId);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'purchase_orders', id, po.status, 'submit', userId, userRole);
    await db.update(purchaseOrders).set({ status: newStatus as any }).where(eq(purchaseOrders.id, id));
    createAuditLog({ orgId, userId, action: 'submit_review', entityType: 'purchase-order', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...po, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/orders/:id/reject', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const po = await getPO(id, orgId);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'purchase_orders', id, po.status, 'reject', userId, userRole);
    await db.update(purchaseOrders).set({ status: newStatus as any }).where(eq(purchaseOrders.id, id));
    createAuditLog({ orgId, userId, action: 'reject', entityType: 'purchase-order', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...po, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/orders/:id/recall', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const po = await getPO(id, orgId);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'purchase_orders', id, po.status, 'recall', userId, userRole);
    await db.update(purchaseOrders).set({ status: newStatus as any }).where(eq(purchaseOrders.id, id));
    createAuditLog({ orgId, userId, action: 'recall', entityType: 'purchase-order', entityId: id, newValues: { status: newStatus }, ...extractReqMeta(req) });
    return res.status(200).json({ ...po, status: newStatus });
  } catch (err) { next(err); }
});

router.post('/orders/:id/post', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId; const orgId = req.user!.orgId!; const userRole = req.user!.role; const { id } = req.params;
    const po = await getPO(id, orgId);
    const { newStatus } = await validateAndExecuteTransition(orgId, 'purchase_orders', id, po.status, 'post', userId, userRole);
    await db.update(purchaseOrders).set({ status: 'approved' as any, postedBy: userId }).where(eq(purchaseOrders.id, id));
    createAuditLog({ orgId, userId, action: 'post', entityType: 'purchase-order', entityId: id, newValues: { status: 'approved' }, ...extractReqMeta(req) });
    return res.status(200).json({ ...po, status: 'approved' });
  } catch (err) { next(err); }
});

// Conversion of a PO into an expense
router.post('/orders/:id/convert-to-expense', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const result = await convertToExpense(id, userId, orgId);
    createAuditLog({ orgId, userId, action: 'convert', entityType: 'purchase-order', entityId: id, newValues: { status: 'converted', expenseId: result.expense.id }, ...extractReqMeta(req) });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// Conversion of a sent PO into a supplier bill
router.post('/orders/:id/convert-to-bill', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const result = await convertToBill(id, userId, orgId);
    createAuditLog({ orgId, userId, action: 'convert', entityType: 'purchase-order', entityId: id, newValues: { status: 'converted', billId: result.bill.id }, ...extractReqMeta(req) });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});


// ==========================================
// 5. VENDORS (CONTACTS TYPE VENDOR)
// ==========================================

router.get('/vendors', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.orgId, orgId),
          sql`${contacts.type} in ('vendor', 'both')`
        )
      )
      .orderBy(contacts.name);

    const balances = await db
      .select({
        vendorId: bills.vendorId,
        totalBalance: sql`coalesce(sum(${bills.total}), 0)`
      })
      .from(bills)
      .where(
        and(
          eq(bills.orgId, orgId),
          sql`${bills.status} in ('open', 'partial')`
        )
      )
      .groupBy(bills.vendorId);
    const balanceMap = new Map(balances.map((b: any) => [b.vendorId, Number(b.totalBalance)]));
    const listWithBalance = list.map((v: any) => ({ ...v, outstanding: balanceMap.get(v.id) || 0 }));
    return res.status(200).json(listWithBalance);
  } catch (err) {
    return next(err);
  }
});

// POST /api/purchases/vendors/import-csv — Bulk import vendors from CSV
router.post('/vendors/import-csv', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const { csvData } = req.body;
    if (!csvData || typeof csvData !== 'string' || !csvData.trim()) {
      throw new AppError('CSV data is required.', 400);
    }
    const cleaned = csvData.replace(/^\uFEFF/, '').replace(/\r$/, '');
    const lines = cleaned.split(/\n/).filter(Boolean);
    if (lines.length < 2) throw new AppError('CSV must have a header row and at least one data row.', 400);

    function parseCsvLine(line: string): string[] {
      const fields: string[] = []; let current = ''; let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) { if (ch === '"') { if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; } } else { current += ch; } }
        else { if (ch === '"') { inQuotes = true; } else if (ch === ',') { fields.push(current.trim()); current = ''; } else { current += ch; } }
      }
      fields.push(current.trim()); return fields;
    }

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
    const nameIdx = headers.findIndex(h => h === 'name' || h === 'vendor name' || h === 'vendor_name');
    const emailIdx = headers.findIndex(h => h === 'email');
    const phoneIdx = headers.findIndex(h => h === 'phone');
    const addressIdx = headers.findIndex(h => h === 'address');
    const cityIdx = headers.findIndex(h => h === 'city');
    const stateIdx = headers.findIndex(h => h === 'state');
    const countryIdx = headers.findIndex(h => h === 'country');
    const taxPinIdx = headers.findIndex(h => h === 'tax pin' || h === 'tax_pin' || h === 'taxPin');
    const termsIdx = headers.findIndex(h => h === 'payment terms' || h === 'payment_terms' || h === 'terms');
    const currencyIdx = headers.findIndex(h => h === 'currency');
    const notesIdx = headers.findIndex(h => h === 'notes');
    const balanceIdx = headers.findIndex(h => h === 'opening balance' || h === 'opening_balance' || h === 'balance');

    if (nameIdx === -1) throw new AppError('CSV must contain a "name" column.', 400);

    const errors: string[] = [];
    const created: any[] = [];
    const dataRows = lines.slice(1);

    for (let i = 0; i < dataRows.length; i++) {
      const row = parseCsvLine(dataRows[i]);
      const name = row[nameIdx]?.trim();
      if (!name) { errors.push(`Row ${i + 2}: missing name`); continue; }
      const email = emailIdx >= 0 ? (row[emailIdx]?.trim() || null) : null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Row ${i + 2}: invalid email "${email}"`); continue;
      }
      const phone = phoneIdx >= 0 ? (row[phoneIdx]?.trim() || null) : null;
      const address = addressIdx >= 0 ? (row[addressIdx]?.trim() || null) : null;
      const city = cityIdx >= 0 ? (row[cityIdx]?.trim() || null) : null;
      const state = stateIdx >= 0 ? (row[stateIdx]?.trim() || null) : null;
      const country = countryIdx >= 0 ? (row[countryIdx]?.trim() || 'Nigeria') : 'Nigeria';
      const taxPin = taxPinIdx >= 0 ? (row[taxPinIdx]?.trim() || null) : null;
      const paymentTerms = termsIdx >= 0 ? (parseInt(row[termsIdx]?.trim()) || null) : null;
      const currency = currencyIdx >= 0 ? (row[currencyIdx]?.trim() || 'NGN') : 'NGN';
      const notes = notesIdx >= 0 ? (row[notesIdx]?.trim() || null) : null;
      const balance = balanceIdx >= 0 ? (Math.round(parseFloat(row[balanceIdx]?.replace(/[₦,]/g, '') || '0') * 100)) : 0;

      try {
        const [vendor] = await db.insert(contacts).values({
          orgId, name, email, phone, address, city, state, country,
          taxPin, paymentTerms, currency, notes,
          type: 'vendor', isActive: true
        }).returning();
        // Create JE for opening balance instead of storing in contacts.balance
        if (balance > 0) {
          const [apAcct] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'accounts_payable'))).limit(1);
          const [reAcct] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'retained_earnings'))).limit(1);
          if (apAcct && reAcct) {
            await postToGL({
              orgId, date: new Date(), description: `Opening balance — ${vendor.name}`,
              source: 'opening_balance', sourceId: vendor.id, createdBy: userId,
              lines: [
                { accountId: apAcct.id, debit: 0, credit: balance, description: `Vendor opening balance — ${vendor.name}` },
                { accountId: reAcct.id, debit: balance, credit: 0, description: 'Contra — opening balance' },
              ],
            });
          }
        }
        created.push(vendor);
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err?.message || 'Database error'}`);
      }
    }

    createAuditLog({ orgId, userId, action: 'import', entityType: 'vendor', newValues: { count: created.length }, ...extractReqMeta(req) });
    return res.status(201).json({
      success: true,
      message: `Imported ${created.length} vendor(s) successfully.`,
      created,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    next(err);
  }
});

router.post('/vendors', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = createVendorSchema.parse(req.body);

    // Strip balance from body — opening balance goes through JE, not stored in contacts.balance
    const openingBalance = body.balance || 0;
    const vendorBody = { ...body } as any;
    vendorBody.balance = undefined;

    const [vendor] = await db
      .insert(contacts)
      .values({
        ...vendorBody,
        orgId,
        type: 'vendor',
        isActive: true
      })
      .returning();

    if (openingBalance > 0) {
      const [apAccount] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'accounts_payable'))).limit(1);
      const [reAccount] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'retained_earnings'))).limit(1);
      if (apAccount && reAccount) {
        await postToGL({
          orgId, date: new Date(), description: `Opening balance — ${vendor.name}`,
          source: 'opening_balance', sourceId: vendor.id, createdBy: userId,
          lines: [
            { accountId: apAccount.id, debit: 0, credit: openingBalance, description: `Vendor opening balance — ${vendor.name}` },
            { accountId: reAccount.id, debit: openingBalance, credit: 0, description: 'Contra — opening balance' },
          ],
        });
      }
    }

    createAuditLog({ orgId, userId, action: 'create', entityType: 'vendor', entityId: vendor.id, newValues: { name: vendor.name, email: vendor.email }, ...extractReqMeta(req) });
    return res.status(201).json(vendor);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

router.get('/vendors/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [vendor] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .limit(1);

    if (!vendor) throw new AppError('Vendor profile could not be found.', 404);
    const [balResult] = await db
      .select({ total: sql`COALESCE(SUM(total), 0)` })
      .from(bills)
      .where(and(eq(bills.vendorId, id), eq(bills.orgId, orgId), sql`status NOT IN ('paid', 'draft', 'void')`));
    return res.status(200).json({ ...vendor, outstanding: Number(balResult?.total || 0) });
  } catch (err) {
    return next(err);
  }
});

router.patch('/vendors/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    const body = updateVendorSchema.parse(req.body);

    const [vendor] = await db
      .update(contacts)
      .set(body)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .returning();

    if (!vendor) throw new AppError('Vendor not found or belongs to another org.', 404);
    createAuditLog({ orgId, userId, action: 'update', entityType: 'vendor', entityId: id, newValues: body, ...extractReqMeta(req) });
    return res.status(200).json(vendor);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Chronological supplier billing account statement (mirror of customer statements)
router.get('/vendors/:id/statement', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    // Validate vendor exists
    const [vendor] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .limit(1);

    if (!vendor) throw new AppError('Vendor profile could not be found.', 404);

    const [vendorBills, paymentsOut, credits] = await Promise.all([
      db.select().from(bills).where(and(eq(bills.vendorId, id), eq(bills.orgId, orgId))),
      db.select().from(paymentsMade).where(and(eq(paymentsMade.vendorId, id), eq(paymentsMade.orgId, orgId))),
      db.select().from(vendorCredits).where(and(eq(vendorCredits.vendorId, id), eq(vendorCredits.orgId, orgId)))
    ]);

    const transactionsList: any[] = [];

    // Map bills: bills are liabilities (CR Accounts Payable)
    for (const bl of vendorBills) {
      if (bl.status === 'void') continue;
      const isDraft = bl.status === 'draft';
      const billDate = bl.date ? new Date(bl.date) : new Date(0);
      transactionsList.push({
        id: bl.id,
        date: billDate,
        type: 'bill',
        number: bl.billNumber || '',
        reference: isDraft ? 'Draft Bill (not yet posted)' : 'Supplier Purchase Invoice',
        debit: 0,
        credit: isDraft ? 0 : (Number(bl.total) || 0),
        status: bl.status
      });
    }

    // Map payments: payments paid reduce liability (DR Accounts Payable)
    for (const pmt of paymentsOut) {
      const pmtDate = pmt.date ? new Date(pmt.date) : new Date(0);
      transactionsList.push({
        id: pmt.id,
        date: pmtDate,
        type: 'payment',
        number: pmt.paymentNumber || '',
        reference: pmt.reference || 'Vendor Disbursement',
        debit: Number(pmt.amount) || 0,
        credit: 0,
        status: 'posted'
      });
    }

    // Map vendor credits: credit notes reduce liability (DR Accounts Payable)
    for (const cr of credits) {
      if (cr.status === 'void') continue;
      const crDate = cr.date ? new Date(cr.date) : new Date(0);
      transactionsList.push({
        id: cr.id,
        date: crDate,
        type: 'vendor_credit',
        number: cr.vcNumber || '',
        reference: 'Supplier Return Credit Note',
        debit: Number(cr.total) || 0,
        credit: 0,
        status: cr.status
      });
    }

    // Sort chronologically
    transactionsList.sort((a, b) => {
      const aTime = a.date instanceof Date && !isNaN(a.date.getTime()) ? a.date.getTime() : 0;
      const bTime = b.date instanceof Date && !isNaN(b.date.getTime()) ? b.date.getTime() : 0;
      return aTime - bTime;
    });

    // Compute opening balance: prefer JE-based OB, fall back to legacy contacts.balance
    const [obJE] = await db
      .select({ lines: sql<string>`json_agg(json_build_object('debit', jl.debit_amount, 'credit', jl.credit_amount))` })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.source, 'opening_balance'), eq(journalEntries.sourceId, id)))
      .groupBy(journalEntries.id)
      .limit(1);
    let openingBalance = 0;
    if (obJE) {
      const lines = JSON.parse(obJE.lines);
      openingBalance = lines.reduce((s: number, l: any) => s + (l.credit || 0) - (l.debit || 0), 0);
    }
    if (!openingBalance) openingBalance = Number(vendor.balance) || 0;
    transactionsList.unshift({
      id: 'opening',
      date: new Date(0),
      type: 'opening_balance',
      number: '',
      reference: 'Opening Balance',
      debit: 0,
      credit: openingBalance
    });

    // Rolling outstanding creditor balance: increases on CR (bill), decreases on DR (payment/credit)
    let rollingBalance = 0;
    const ledgerStatement = transactionsList.map((item) => {
      rollingBalance += (Number(item.credit) || 0) - (Number(item.debit) || 0);
      return {
        id: item.id,
        date: item.date,
        type: item.type,
        number: item.number,
        reference: item.reference,
        debit: Number(item.debit) || 0,
        credit: Number(item.credit) || 0,
        status: item.status || undefined,
        balance: rollingBalance
      };
    });

    return res.status(200).json({
      vendor: {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        notes: vendor.notes
      },
      ledgerStatement,
      closingCreditorBalance: rollingBalance
    });
  } catch (err) {
    console.error('[Statement] Error:', err);
    return next(err);
  }
});

// ==========================================
// 6. VENDOR CREDIT NOTES ENDPOINTS
// ==========================================

router.get('/credit-notes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await listVendorCredits(orgId);
    return res.status(200).json(list);
  } catch (err) {
    return next(err);
  }
});

router.post('/credit-notes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = createVendorCreditSchema.parse(req.body);

    const credit = await createVendorCredit({ ...body, orgId }, userId);
    createAuditLog({ orgId, userId, action: 'create', entityType: 'vendor-credit', entityId: credit.id, newValues: { vendorId: body.vendorId, total: credit.total }, ...extractReqMeta(req) });
    return res.status(201).json(credit);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

router.get('/credit-notes/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const credit = await getVendorCredit(id, orgId);
    return res.status(200).json(credit);
  } catch (err) {
    return next(err);
  }
});

router.post('/credit-notes/:id/apply', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = applyVendorCreditSchema.parse(req.body);

    const result = await applyVendorCredit(id, body.billId, body.amount, userId, orgId);
    createAuditLog({ orgId, userId, action: 'apply', entityType: 'vendor-credit', entityId: id, newValues: { appliedToBill: body.billId, amount: body.amount }, ...extractReqMeta(req) });
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

router.patch('/credit-notes/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const updated = await updateVendorCredit(id, req.body, userId, orgId);
    createAuditLog({ orgId, userId, action: 'update', entityType: 'vendor-credit', entityId: id, newValues: req.body, ...extractReqMeta(req) });
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

router.post('/credit-notes/:id/void', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const voided = await voidVendorCredit(id, orgId, userId);
    createAuditLog({ orgId, userId, action: 'void', entityType: 'vendor-credit', entityId: id, newValues: { status: 'void' }, ...extractReqMeta(req) });
    return res.status(200).json(voided);
  } catch (err) {
    return next(err);
  }
});

// ==========================================
// 6. RECURRING BILLS ENDPOINTS
// ==========================================

router.get('/recurring-bills', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await listRecurringBills(orgId);
    return res.json(list || []);
  } catch { return res.json([]); }
});

router.get('/recurring-bills/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const template = await getRecurringBill(req.params.id, orgId);
    return res.json(template);
  } catch (err) { return next(err); }
});

router.post('/recurring-bills', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const data = createRecurringBillSchema.parse(req.body);
    const template = await createRecurringBill(data, orgId, userId);
    createAuditLog({ orgId, userId, action: 'create', entityType: 'recurring-bill', entityId: template.id, newValues: data, ...extractReqMeta(req) });
    return res.status(201).json(template);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

router.patch('/recurring-bills/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const data = updateRecurringBillSchema.parse(req.body);
    const template = await updateRecurringBill(req.params.id, orgId, data);
    createAuditLog({ orgId, userId, action: 'update', entityType: 'recurring-bill', entityId: req.params.id, newValues: data, ...extractReqMeta(req) });
    return res.json(template);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

router.delete('/recurring-bills/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    await deleteRecurringBill(req.params.id, orgId);
    createAuditLog({ orgId, userId, action: 'delete', entityType: 'recurring-bill', entityId: req.params.id, ...extractReqMeta(req) });
    return res.status(204).send();
  } catch (err) { return next(err); }
});

router.post('/recurring-bills/:id/generate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.user!.orgId!;
    const bill = await generateBillFromTemplate(req.params.id, orgId, userId);
    createAuditLog({ orgId, userId, action: 'generate', entityType: 'recurring-bill', entityId: req.params.id, newValues: { generatedBillId: bill.id }, ...extractReqMeta(req) });
    return res.json(bill);
  } catch (err) { return next(err); }
});

// =========================================================================
// PDF EXPORT ROUTES
// =========================================================================
function sendPdf(res: Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  return res.end(buffer);
}

router.get('/bills/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generateBillsListPDF } = await import('../services/pdf.service');
    const orgId = req.user!.orgId!;
    const start = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const end = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const buffer = await generateBillsListPDF(orgId, start, end);
    return sendPdf(res, buffer, 'bills_list.pdf');
  } catch (err) { return next(err); }
});

router.get('/bills/:id/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generateBillPDF } = await import('../services/pdf.service');
    const orgId = req.user!.orgId!;
    const buffer = await generateBillPDF(req.params.id, orgId);
    return sendPdf(res, buffer, `bill_${req.params.id}.pdf`);
  } catch (err) { return next(err); }
});

export default router;
