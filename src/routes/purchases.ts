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
  accounts
} from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import {
  createBill,
  updateBill,
  approveBill,
  voidBill,
  duplicateBill,
  getBill,
  listBills,
  getBillAgingReport
} from '../services/bill.service';
import {
  recordPaymentMade,
  updatePaymentMade
} from '../services/payment.service';
import {
  createExpense,
  listExpenses,
  updateExpense,
  deleteExpense,
  attachReceipt
} from '../services/expense.service';
import {
  createPO,
  updatePO,
  sendPO,
  convertToBill,
  getPO,
  listPOs
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
  currency: z.string().optional(),
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
  currency: z.string().default('NGN'),
  notes: z.string().optional().nullable()
});

const updateVendorSchema = createVendorSchema.partial().extend({
  isActive: z.boolean().optional()
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
      search: req.query.search as string
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
    const { id } = req.params;
    const body = updateBillSchema.parse(req.body);

    const updated = await updateBill(id, body, userId);
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
    const { id } = req.params;

    const approved = await approveBill(id, userId);
    return res.status(200).json(approved);
  } catch (err) {
    return next(err);
  }
});

// Void an existing bill (reversing matching GL postings)
router.post('/bills/:id/void', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const voided = await voidBill(id, userId);
    return res.status(200).json(voided);
  } catch (err) {
    return next(err);
  }
});

// Duplicate an existing bill as draft
router.post('/bills/:id/duplicate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const duplicated = await duplicateBill(id, userId);
    return res.status(201).json(duplicated);
  } catch (err) {
    return next(err);
  }
});


// ==========================================
// 2. PAYMENTS MADE ENDPOINTS (VENDOR SUPPLIER ACTIONS)
// ==========================================

router.get('/payments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(paymentsMade)
      .where(eq(paymentsMade.orgId, orgId))
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

    const [pmt] = await db
      .select()
      .from(paymentsMade)
      .where(and(eq(paymentsMade.id, id), eq(paymentsMade.orgId, orgId)))
      .limit(1);

    if (!pmt) throw new AppError('Outbound supplier payment could not be found.', 404);

    const allocations = await db
      .select()
      .from(paymentMadeAllocations)
      .where(eq(paymentMadeAllocations.paymentId, id));

    return res.status(200).json({ ...pmt, allocations });
  } catch (err) {
    return next(err);
  }
});

router.patch('/payments/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const updated = await updatePaymentMade(id, req.body, userId);
    return res.status(200).json(updated);
  } catch (err) {
    return next(err);
  }
});

// ==========================================
// 3. EXPENSES ENDPOINTS (DIRECT DISBURSED OUTLAYS)
// ==========================================

router.get('/expenses', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await listExpenses(orgId);
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
    const { id } = req.params;

    if (!req.file) {
      throw new AppError('No receipt image file was detected in upload payload.', 400);
    }

    // Attach receipt scanning process
    const ocrData = await attachReceipt(id, req.file.buffer);
    return res.status(200).json(ocrData);
  } catch (err) {
    return next(err);
  }
});

router.get('/expenses/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [expense] = await db
      .select()
      .from(expenses)
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
    const { id } = req.params;
    const body = updateExpenseSchema.parse(req.body);

    const updated = await updateExpense(id, body, userId);
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
    const { id } = req.params;

    const result = await deleteExpense(id, userId);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
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

// Conversion of a sent PO into a supplier bill
router.post('/orders/:id/convert-to-bill', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await convertToBill(id, userId);
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

    return res.status(200).json(list);
  } catch (err) {
    return next(err);
  }
});

router.post('/vendors', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = createVendorSchema.parse(req.body);

    const [vendor] = await db
      .insert(contacts)
      .values({
        ...body,
        orgId,
        type: 'vendor',
        isActive: true
      })
      .returning();

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
    return res.status(200).json(vendor);
  } catch (err) {
    return next(err);
  }
});

router.patch('/vendors/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = updateVendorSchema.parse(req.body);

    const [vendor] = await db
      .update(contacts)
      .set(body)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .returning();

    if (!vendor) throw new AppError('Vendor not found or belongs to another org.', 404);
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

    const vendorBills = await db
      .select()
      .from(bills)
      .where(and(eq(bills.vendorId, id), eq(bills.orgId, orgId)));

    const paymentsOut = await db
      .select()
      .from(paymentsMade)
      .where(and(eq(paymentsMade.vendorId, id), eq(paymentsMade.orgId, orgId)));

    const credits = await db
      .select()
      .from(vendorCredits)
      .where(and(eq(vendorCredits.vendorId, id), eq(vendorCredits.orgId, orgId)));

    const transactionsList: any[] = [];

    // Map bills: bills are liabilities (CR Accounts Payable)
    for (const bl of vendorBills) {
      if (bl.status === 'draft') continue;
      transactionsList.push({
        id: bl.id,
        date: new Date(bl.date),
        type: 'bill',
        number: bl.billNumber,
        reference: 'Supplier Purchase Invoice',
        debit: 0,
        credit: bl.total
      });
    }

    // Map payments: payments paid reduce liability (DR Accounts Payable)
    for (const pmt of paymentsOut) {
      transactionsList.push({
        id: pmt.id,
        date: new Date(pmt.date),
        type: 'payment',
        number: pmt.paymentNumber,
        reference: pmt.reference || 'Vendor Disbursement',
        debit: pmt.amount,
        credit: 0
      });
    }

    // Map vendor credits: credit notes reduce liability (DR Accounts Payable)
    for (const cr of credits) {
      transactionsList.push({
        id: cr.id,
        date: new Date(cr.date),
        type: 'vendor_credit',
        number: cr.vcNumber,
        reference: 'Supplier Return Credit Note',
        debit: cr.total,
        credit: 0
      });
    }

    // Sort chronologically
    transactionsList.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Rolling outstanding creditor balance: increases on CR (bill), decreases on DR (payment/credit)
    let rollingBalance = 0;
    const ledgerStatement = transactionsList.map((item) => {
      rollingBalance += item.credit - item.debit;
      return {
        ...item,
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
    return next(err);
  }
});

export default router;
