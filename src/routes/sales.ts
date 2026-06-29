/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, contacts, invoices, invoiceLines, quotes, salesOrders, paymentsReceived, paymentAllocations, creditNotes, accounts, paymentsMade, paymentMadeAllocations, journalEntries } from '../db/schema';
import { eq, and, desc, asc, sql, inArray, getTableColumns } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import {
  createInvoice,
  updateInvoice,
  sendInvoice,
  voidInvoice,
  duplicateInvoice,
  getInvoice,
  listInvoices,
  getInvoiceAgingReport
} from '../services/invoice.service';
import {
  recordPaymentReceived,
  updatePaymentReceived,
  deletePaymentReceived,
  unallocatePayment,
  recordPaymentMade
} from '../services/payment.service';
import {
  createCreditNote,
  applyCreditNote,
  voidCreditNote
} from '../services/creditNote.service';
import {
  createRecurringInvoice,
  listRecurringInvoices,
  getRecurringInvoice,
  updateRecurringInvoice,
  deleteRecurringInvoice,
  generateInvoiceFromTemplate
} from '../services/recurring.service';

const router = Router();

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

const createInvoiceSchema = z.object({
  customerId: z.string().uuid('Invalid customer id.'),
  soId: z.string().uuid().optional().nullable(),
  date: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['draft', 'sent', 'partial', 'paid', 'overdue', 'void']).optional(),
  currency: z.string().optional(),
  fxRate: z.number().optional(),
  paymentTerms: z.number().optional(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  recurringId: z.string().uuid().optional().nullable(),
  lines: z.array(
    z.object({
      itemId: z.string().uuid().optional().nullable(),
      description: z.string().optional(),
      quantity: z.number().positive('Quantity must be greater than zero.'),
      unitPrice: z.number().int().nonnegative('Price must be non-negative (In Kobo).'),
      discountPct: z.number().min(0).max(100).optional(),
      taxRate: z.number().nonnegative().optional(),
      accountId: z.string().uuid().optional().nullable()
    })
  ).min(1, 'Invoice must contain at least one line.')
});

const updateInvoiceSchema = createInvoiceSchema.partial();

const recurringTemplateLineSchema = z.object({
  itemId: z.string().uuid().optional().nullable(),
  description: z.string().optional(),
  quantity: z.number().positive('Quantity must be greater than zero.'),
  unitPrice: z.number().int().nonnegative('Price must be non-negative (In Kobo).'),
  discountPct: z.number().min(0).max(100).optional(),
  taxRate: z.number().nonnegative().optional(),
  accountId: z.string().uuid().optional().nullable()
});

const createRecurringInvoiceSchema = z.object({
  customerId: z.string().uuid('Invalid customer id.'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually']),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  template: z.object({
    lines: z.array(recurringTemplateLineSchema).min(1, 'Billing template must contain at least one line.'),
    paymentTerms: z.number().optional(),
    currency: z.string().optional(),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    autoSend: z.boolean().optional()
  })
});

const updateRecurringInvoiceSchema = createRecurringInvoiceSchema.partial();

const recordPaymentReceivedSchema = z.object({
  category: z.enum(['sales_invoice', 'other_income']).optional().default('sales_invoice'),
  customerId: z.string().uuid('Invalid customer id.').optional().nullable(),
  payerName: z.string().optional().nullable(),
  date: z.string().optional(),
  amount: z.number().int().positive('Payment amount must be greater than zero (In Kobo).'),
  currency: z.string().optional(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'cheque', 'pos', 'ussd']),
  reference: z.string().optional().nullable(),
  accountId: z.string().uuid('Invalid active receipt account.'),
  incomeAccountId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  allocations: z.array(
    z.object({
      invoiceId: z.string().uuid(),
      amount: z.number().int().positive('Allocation amount must be positive.')
    })
  ).optional().default([])
}).superRefine((data, ctx) => {
  if (data.category === 'sales_invoice') {
    if (!data.customerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A customer is required for sales invoice receipts.', path: ['customerId'] });
    }
    if (!data.allocations || data.allocations.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Payment must specify at least one invoice allocation.', path: ['allocations'] });
    }
  } else {
    if (!data.incomeAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'An income account is required for non-invoice receipts.', path: ['incomeAccountId'] });
    }
    if (!data.customerId && !data.payerName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide either a customer or a payer name for this receipt.', path: ['payerName'] });
    }
  }
});

const updatePaymentReceivedSchema = z.object({
  category: z.enum(['sales_invoice', 'other_income']).optional(),
  customerId: z.string().uuid().optional().nullable(),
  payerName: z.string().optional().nullable(),
  date: z.string().optional(),
  amount: z.number().int().positive('Payment amount must be greater than zero (In Kobo).').optional(),
  currency: z.string().optional(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'cheque', 'pos', 'ussd']).optional(),
  reference: z.string().optional().nullable(),
  accountId: z.string().uuid().optional(),
  incomeAccountId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  allocations: z.array(
    z.object({
      invoiceId: z.string().uuid(),
      amount: z.number().int().positive('Allocation amount must be positive.')
    })
  ).optional()
});

const recordPaymentMadeSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor id.'),
  date: z.string().optional(),
  amount: z.number().int().positive('Outbound payment amount must be greater than zero (In Kobo).'),
  currency: z.string().optional(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'cheque', 'pos', 'ussd']),
  reference: z.string().optional().nullable(),
  accountId: z.string().uuid('Invalid outbound bank account.'),
  notes: z.string().optional().nullable(),
  allocations: z.array(
    z.object({
      billId: z.string().uuid(),
      amount: z.number().int().positive('Allocation amount must be positive.')
    })
  ).min(1, 'Payment must specify at least one vendor bill allocation.')
});

const createCreditNoteSchema = z.object({
  customerId: z.string().uuid('Invalid customer id.'),
  invoiceId: z.string().uuid().optional().nullable(),
  date: z.string().optional(),
  subtotal: z.number().int().nonnegative('Subtotal must be non-negative (In Kobo).'),
  tax: z.number().int().nonnegative('Tax must be non-negative (In Kobo).'),
  notes: z.string().optional().nullable()
});

const applyCreditNoteSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice id.'),
  amount: z.number().int().positive('Allocation amount must be positive (In Kobo).')
});

const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty.'),
  email: z.string().email('Invalid email address.').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().default('Nigeria'),
  taxPin: z.string().optional().nullable(),
  paymentTerms: z.number().optional().nullable(),
  creditLimit: z.number().optional().nullable(),
  balance: z.number().int().optional().nullable().transform(v => v ?? 0),
  currency: z.string().default('NGN'),
  notes: z.string().optional().nullable()
});

const updateCustomerSchema = createCustomerSchema.partial().extend({
  isActive: z.boolean().optional()
});

// Configure standard security constraints on all router endpoints
router.use(authenticate);
router.use(requireOrg);

// ==========================================
// INVOICES ENDPOINTS
// ==========================================

// Get list of invoices (filtered and paginated)
router.get('/invoices', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const filters = {
      status: req.query.status as string,
      customerId: req.query.customerId as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      search: req.query.search as string
    };
    const pagination = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10
    };

    const data = await listInvoices(orgId, filters, pagination);
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
});

// Create a new invoice
router.post('/invoices', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = createInvoiceSchema.parse(req.body);

    const invoice = await createInvoice({ ...body, orgId }, userId);
    return res.status(201).json(invoice);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Get aging report metrics
router.get('/invoices/aging-report', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const report = await getInvoiceAgingReport(orgId);
    return res.status(200).json(report);
  } catch (err) {
    return next(err);
  }
});

// Get a single invoice with rich details
router.get('/invoices/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const invoice = await getInvoice(id, orgId);
    return res.status(200).json(invoice);
  } catch (err) {
    return next(err);
  }
});

// Update a draft invoice
router.patch('/invoices/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const body = updateInvoiceSchema.parse(req.body);

    const updated = await updateInvoice(id, body, userId);
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Put status to sent (posts journal entries)
router.post('/invoices/:id/send', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const sent = await sendInvoice(id, userId);
    return res.status(200).json(sent);
  } catch (err) {
    return next(err);
  }
});

// Void an invoice (and reverse journal entry)
router.post('/invoices/:id/void', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const voided = await voidInvoice(id, userId);
    return res.status(200).json(voided);
  } catch (err) {
    return next(err);
  }
});

// Duplicate an existing invoice as new draft
router.post('/invoices/:id/duplicate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const duplicated = await duplicateInvoice(id, userId);
    return res.status(201).json(duplicated);
  } catch (err) {
    return next(err);
  }
});

// Generate dynamic PDF rendering structure
router.get('/invoices/:id/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const invoice = await getInvoice(id, orgId);

    // Prompt 7 handles full rich PDF template engines. For now, let's output metadata 
    // or set headers for simple attachment streaming.
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoiceNumber}.json"`);
    return res.status(200).json({
      message: 'FinanceOS Invoice PDF Payload Stream Structure',
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customer: invoice.customer?.name,
      currency: invoice.currency,
      total: invoice.total,
      lines: invoice.lines
    });
  } catch (err) {
    return next(err);
  }
});

// ==========================================
// PAYMENTS RECEIVED ENDPOINTS
// ==========================================

// Get list of payments received
router.get('/payments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const pmtCols = getTableColumns(paymentsReceived);
    const list = await db
      .select({ ...pmtCols, journalEntryNumber: journalEntries.entryNumber, journalEntryId: journalEntries.id })
      .from(paymentsReceived)
      .leftJoin(journalEntries, and(eq(journalEntries.source, 'payment'), eq(journalEntries.sourceId, paymentsReceived.id)))
      .where(eq(paymentsReceived.orgId, orgId))
      .orderBy(desc(paymentsReceived.date));

    return res.status(200).json(list);
  } catch (err) {
    return next(err);
  }
});

// Record a collection/receipt payment from customer
router.post('/payments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;

    // Check if the input is vendor style outbound vs incoming customer styles
    if (req.body.vendorId) {
      const body = recordPaymentMadeSchema.parse(req.body);
      const paymentMade = await recordPaymentMade({ ...body, orgId }, userId);
      return res.status(201).json(paymentMade);
    } else {
      const body = recordPaymentReceivedSchema.parse(req.body);
      const paymentRecv = await recordPaymentReceived({ ...body, orgId }, userId);
      return res.status(201).json(paymentRecv);
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Get a single payments detailed allocation mapping
router.get('/payments/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const pmtCols = getTableColumns(paymentsReceived);
    const [pmt] = await db
      .select({ ...pmtCols, journalEntryNumber: journalEntries.entryNumber, journalEntryId: journalEntries.id })
      .from(paymentsReceived)
      .leftJoin(journalEntries, and(eq(journalEntries.source, 'payment'), eq(journalEntries.sourceId, paymentsReceived.id)))
      .where(and(eq(paymentsReceived.id, id), eq(paymentsReceived.orgId, orgId)))
      .limit(1);

    if (!pmt) {
      // Try searching payments made instead
      const pmtMadeCols = getTableColumns(paymentsMade);
      const [pmtMade] = await db
        .select({ ...pmtMadeCols, journalEntryNumber: journalEntries.entryNumber })
        .from(paymentsMade)
        .leftJoin(journalEntries, eq(paymentsMade.journalEntryId, journalEntries.id))
        .where(and(eq(paymentsMade.id, id), eq(paymentsMade.orgId, orgId)))
        .limit(1);

      if (!pmtMade) throw new AppError('Payment could not be found.', 404);

      const allocations = await db
        .select()
        .from(paymentMadeAllocations)
        .where(eq(paymentMadeAllocations.paymentId, id));

      return res.status(200).json({ ...pmtMade, allocations, type: 'payment_made' });
    }

    const allocations = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, id));

    return res.status(200).json({ ...pmt, allocations, type: 'payment_received' });
  } catch (err) {
    return next(err);
  }
});

// Update a payment received (edits, then reverses & re-posts journal/allocations)
router.patch('/payments/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    const body = updatePaymentReceivedSchema.parse(req.body);
    const updated = await updatePaymentReceived(id, orgId, body, userId);
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Delete payment (Unallocate invoices and rollback allocations/journal entries)
router.delete('/payments/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await deletePaymentReceived(id, userId);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// ==========================================
// CREDIT NOTES ENDPOINTS
// ==========================================

// List credit notes
router.get('/credit-notes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const notes = await db
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.orgId, orgId))
      .orderBy(desc(creditNotes.date));

    const allContacts = await db.select({ id: contacts.id, name: contacts.name, email: contacts.email }).from(contacts).where(eq(contacts.orgId, orgId));
    const custMap = new Map(allContacts.map((c: any) => [c.id, c]));

    const invoiceIds = notes.map(n => n.invoiceId).filter(Boolean) as string[];
    const linkedInvoices = invoiceIds.length > 0
      ? await db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber }).from(invoices).where(inArray(invoices.id, invoiceIds))
      : [];
    const invMap = new Map(linkedInvoices.map((i: any) => [i.id, i.invoiceNumber]));

    const enriched = notes.map(n => ({
      ...n,
      customer: custMap.get(n.customerId) || null,
      invoiceNumber: n.invoiceId ? (invMap.get(n.invoiceId) || null) : null
    }));

    return res.status(200).json(enriched);
  } catch (err) {
    return next(err);
  }
});

// Create credit note
router.post('/credit-notes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = createCreditNoteSchema.parse(req.body);

    const creditNote = await createCreditNote({ ...body, orgId }, userId);
    return res.status(201).json(creditNote);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Get a single credit note details
router.get('/credit-notes/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [note] = await db
      .select()
      .from(creditNotes)
      .where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, orgId)))
      .limit(1);

    if (!note) throw new AppError('Credit note not found.', 404);

    const [customer] = await db.select().from(contacts).where(eq(contacts.id, note.customerId)).limit(1);
    let invoice = null;
    if (note.invoiceId) {
      const [inv] = await db.select().from(invoices).where(eq(invoices.id, note.invoiceId)).limit(1);
      invoice = inv || null;
    }

    return res.status(200).json({ ...note, customer, invoice });
  } catch (err) {
    return next(err);
  }
});

// Apply credit note to reduce active invoices balance as dynamic credit allocation
router.post('/credit-notes/:id/apply', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const body = applyCreditNoteSchema.parse(req.body);

    const result = await applyCreditNote(id, body.invoiceId, body.amount, userId);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Void a credit note that has not yet been applied to any invoice
router.post('/credit-notes/:id/void', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    const voided = await voidCreditNote(id, orgId, userId);
    return res.status(200).json(voided);
  } catch (err) { return next(err); }
});

// ==========================================
// CUSTOMERS (CONTACTS TYPE CUSTOMER)
// ==========================================

// List clear customer contacts
router.get('/customers', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.orgId, orgId),
          sql`${contacts.type} in ('customer', 'both')`
        )
      )
      .orderBy(contacts.name);

    // Calculate live balance from unpaid invoices
    const balances = await db
      .select({
        customerId: invoices.customerId,
        totalBalance: sql`coalesce(sum(${invoices.balanceDue}), 0)`
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.orgId, orgId),
          sql`${invoices.status} in ('sent', 'partial', 'overdue')`
        )
      )
      .groupBy(invoices.customerId);
    const balanceMap = new Map(balances.map((b: any) => [b.customerId, Number(b.totalBalance)]));
    const listWithBalance = list.map((c: any) => ({ ...c, outstanding: balanceMap.get(c.id) || 0 }));
    return res.status(200).json(listWithBalance);
  } catch (err) {
    return next(err);
  }
});

// Create customer contact
router.post('/customers', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = createCustomerSchema.parse(req.body);

    const [customer] = await db
      .insert(contacts)
      .values({
        ...body,
        orgId,
        type: 'customer',
        isActive: true
      })
      .returning();

    return res.status(201).json(customer);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Get customer detailed outline
router.get('/customers/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    const [customer] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .limit(1);

    if (!customer) throw new AppError('Customer profile not found.', 404);
    const [balResult] = await db
      .select({ total: sql`COALESCE(SUM(balance_due), 0)` })
      .from(invoices)
      .where(and(eq(invoices.customerId, id), eq(invoices.orgId, orgId), sql`status NOT IN ('paid', 'void')`));
    return res.status(200).json({ ...customer, outstanding: Number(balResult?.total || 0) });
  } catch (err) {
    return next(err);
  }
});

// Edit/update customer details
router.patch('/customers/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = updateCustomerSchema.parse(req.body);

    const [customer] = await db
      .update(contacts)
      .set(body)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .returning();

    if (!customer) throw new AppError('Customer was not found or belongs to another org.', 404);
    return res.status(200).json(customer);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// Get chronological Account Statement details
router.get('/customers/:id/statement', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    // Validate customer first
    const [customer] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .limit(1);

    if (!customer) throw new AppError('Customer was not found.', 404);

    // Fetch customer transactions
    const customerInvoices = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.customerId, id), eq(invoices.orgId, orgId)));

    const customerPayments = await db
      .select()
      .from(paymentsReceived)
      .where(and(eq(paymentsReceived.customerId, id), eq(paymentsReceived.orgId, orgId)));

    const customerCreditNotes = await db
      .select()
      .from(creditNotes)
      .where(and(eq(creditNotes.customerId, id), eq(creditNotes.orgId, orgId)));

    // Union-like consolidation in memory for historical alignment
    const transactionsList: any[] = [];

    for (const inv of customerInvoices) {
      // Drafts and voided should not show inside posted accounting statements
      if (inv.status === 'draft' || inv.status === 'void') continue;
      transactionsList.push({
        id: inv.id,
        date: new Date(inv.date),
        type: 'invoice',
        number: inv.invoiceNumber,
        reference: inv.notes || 'Sales Invoice',
        debit: inv.total,
        credit: 0
      });
    }

    for (const pmt of customerPayments) {
      transactionsList.push({
        id: pmt.id,
        date: new Date(pmt.date),
        type: 'payment',
        number: pmt.paymentNumber,
        reference: pmt.reference || 'Customer Payment',
        debit: 0,
        credit: pmt.amount
      });
    }

    for (const cn of customerCreditNotes) {
      if (cn.status === 'draft' || cn.status === 'void') continue;
      transactionsList.push({
        id: cn.id,
        date: new Date(cn.date),
        type: 'credit_note',
        number: cn.cnNumber,
        reference: 'Sales Return / Credit Note',
        debit: 0,
        credit: cn.total
      });
    }

    // Sort chronologically ascending
    transactionsList.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Prepend opening balance from contacts.balance
    const openingBalance = customer.balance || 0;
    transactionsList.unshift({
      id: 'opening',
      date: new Date(0),
      type: 'opening_balance',
      number: '',
      reference: 'Opening Balance',
      debit: openingBalance,
      credit: 0
    });

    // Compute rolling ledger balance
    let currentBalance = 0;
    const ledgerStatement = transactionsList.map((item) => {
      currentBalance += item.debit - item.credit;
      return {
        ...item,
        balance: currentBalance
      };
    });

    return res.status(200).json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        notes: customer.notes
      },
      ledgerStatement,
      closingOutstandingBalance: currentBalance
    });
  } catch (err) {
    return next(err);
  }
});


// =========================================================================
// QUOTES ENDPOINTS
// =========================================================================

const createQuoteSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID.'),
  date: z.string().optional(),
  expiryDate: z.string().optional().nullable(),
  status: z.enum(['draft', 'sent', 'accepted', 'declined', 'expired', 'converted']).default('draft'),
  currency: z.string().default('NGN'),
  subtotal: z.number().int().nonnegative().default(0),
  discount: z.number().int().nonnegative().default(0),
  tax: z.number().int().nonnegative().default(0),
  total: z.number().int().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  lines: z.array(z.object({ itemId: z.string().uuid().optional().nullable(), description: z.string().min(1), quantity: z.number().positive(), unitPrice: z.number().nonnegative(), discountPct: z.number().min(0).max(100).optional(), taxRate: z.number().nonnegative().optional() })).optional(),
});

const updateQuoteSchema = createQuoteSchema.partial();

// GET /api/sales/quotes
router.get('/quotes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(quotes)
      .where(eq(quotes.orgId, orgId))
      .orderBy(desc(quotes.createdAt));
    return res.status(200).json(list);
  } catch (err) { return next(err); }
});

// GET /api/sales/quotes/:id
router.get('/quotes/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [quote] = await db.select().from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.orgId, orgId))).limit(1);
    if (!quote) throw new AppError('Quote not found.', 404);
    return res.status(200).json(quote);
  } catch (err) { return next(err); }
});

// POST /api/sales/quotes
router.post('/quotes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const body = createQuoteSchema.parse(req.body);
    const count = await db.select({ c: sql`count(*)` }).from(quotes).where(eq(quotes.orgId, orgId));
    const seq = (Number((count[0] as any).c) + 1).toString().padStart(4, '0');
    const quoteNumber = `Q-${seq}`;
    const [quote] = await db.insert(quotes).values({
      orgId, quoteNumber,
      customerId: body.customerId,
      date: body.date ? new Date(body.date) : new Date(),
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      status: body.status,
      currency: body.currency,
      subtotal: body.subtotal,
      discount: body.discount,
      tax: body.tax,
      total: body.total,
      notes: body.notes || null,
      terms: body.terms || null,
      lines: body.lines || [],
      createdBy: userId,
    }).returning();
    return res.status(201).json(quote);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

// PATCH /api/sales/quotes/:id
router.patch('/quotes/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = updateQuoteSchema.parse(req.body);
    const updateData: any = { ...body };
    if (body.date) updateData.date = new Date(body.date);
    if (body.expiryDate) updateData.expiryDate = new Date(body.expiryDate);
    const [quote] = await db.update(quotes).set(updateData)
      .where(and(eq(quotes.id, id), eq(quotes.orgId, orgId))).returning();
    if (!quote) throw new AppError('Quote not found.', 404);
    return res.status(200).json(quote);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

// DELETE /api/sales/quotes/:id
router.delete('/quotes/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [existing] = await db.select().from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.orgId, orgId))).limit(1);
    if (!existing) throw new AppError('Quote not found.', 404);
    if (existing.status === 'converted') throw new AppError('Converted quotes cannot be deleted.', 400);
    await db.delete(quotes).where(eq(quotes.id, id));
    return res.status(200).json({ message: 'Quote deleted.' });
  } catch (err) { return next(err); }
});

// POST /api/sales/quotes/:id/convert
router.post('/quotes/:id/convert', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { id } = req.params;
    const [quote] = await db.select().from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.orgId, orgId))).limit(1);
    if (!quote) throw new AppError('Quote not found.', 404);
    if (quote.status === 'converted') throw new AppError('Quote already converted.', 400);
    const count = await db.select({ c: sql`count(*)` }).from(invoices).where(eq(invoices.orgId, orgId));
    const seq = (Number((count[0] as any).c) + 1).toString().padStart(4, '0');
    const invoiceNumber = `INV-${seq}`;
    const [invoice] = await db.insert(invoices).values({
      orgId, invoiceNumber,
      customerId: quote.customerId,
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'draft',
      currency: quote.currency,
      subtotal: quote.subtotal,
      discountAmount: quote.discount,
      taxAmount: quote.tax,
      total: quote.total,
      amountPaid: 0,
      balanceDue: quote.total,
      notes: quote.notes || null,
      terms: quote.terms || null,
      createdBy: userId,
    }).returning();
    // Insert invoice lines from quote lines
    const quoteLines = (quote as any).lines || [];
    if (quoteLines.length > 0) {
      for (const ql of quoteLines) {
        const qty = Number(ql.quantity || 1);
        const price = Math.round(Number(ql.unitPrice || 0)); // already stored in kobo
        const discPct = Number(ql.discountPct || 0);
        const taxRate = Number(ql.taxRate ?? 7.5);
        const base = qty * price;
        const disc = Math.round(base * discPct / 100);
        const afterDisc = base - disc;
        const taxAmt = Math.round(afterDisc * taxRate / 100);
        const lineTotal = afterDisc + taxAmt;
        await db.insert(invoiceLines).values({
          invoiceId: invoice.id,
          itemId: ql.itemId || null,
          description: ql.description || '',
          quantity: qty.toString(),
          unitPrice: price,
          discountPct: discPct.toString(),
          taxRate: taxRate.toString(),
          taxAmount: taxAmt,
          lineTotal,
          accountId: null,
        });
      }
    }
    await db.update(quotes).set({ status: 'converted', convertedToId: invoice.id }).where(eq(quotes.id, id));
    return res.status(201).json({ invoice, message: 'Quote converted to invoice successfully.' });
  } catch (err) { return next(err); }
});

// POST /api/sales/quotes/:id/unconvert — revert a converted quote back to accepted
router.post('/quotes/:id/unconvert', authenticate, requireOrg, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [quote] = await db.select().from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.orgId, orgId))).limit(1);
    if (!quote) throw new AppError('Quote not found.', 404);
    if (quote.status !== 'converted') throw new AppError('Only converted quotes can be unconverted.', 400);
    const convertedToId = (quote as any).convertedToId;
    if (convertedToId) {
      const [linkedInvoice] = await db.select().from(invoices)
        .where(and(eq(invoices.id, convertedToId), eq(invoices.orgId, orgId))).limit(1);
      if (linkedInvoice) {
        if (linkedInvoice.status === 'draft') {
          await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, linkedInvoice.id));
          await db.delete(invoices).where(eq(invoices.id, linkedInvoice.id));
        } else if (['open', 'partial'].includes(linkedInvoice.status)) {
          throw new AppError(
            `Cannot unconvert: the linked invoice (${linkedInvoice.invoiceNumber}) has status "${linkedInvoice.status}". Void the invoice first.`,
            400
          );
        }
      }
    }
    await db.update(quotes)
      .set({ status: 'accepted', convertedToId: null } as any)
      .where(eq(quotes.id, id));
    return res.status(200).json({ message: 'Quote successfully reverted to accepted status.' });
  } catch (err) { return next(err); }
});


// =========================================================================
// SALES ORDERS ENDPOINTS
// =========================================================================

const createSalesOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID.'),
  quoteId: z.string().uuid().optional().nullable(),
  date: z.string().optional(),
  expectedDelivery: z.string().optional().nullable(),
  status: z.enum(['draft', 'confirmed', 'partial', 'fulfilled', 'cancelled']).default('draft'),
  currency: z.string().default('NGN'),
  subtotal: z.number().int().nonnegative().default(0),
  discount: z.number().int().nonnegative().default(0),
  tax: z.number().int().nonnegative().default(0),
  total: z.number().int().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  lines: z.array(z.object({
    itemId: z.string().uuid().optional().nullable(),
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    discountPct: z.number().min(0).max(100).optional(),
    taxRate: z.number().nonnegative().optional(),
  })).optional(),
});

const updateSalesOrderSchema = createSalesOrderSchema.partial();

// GET /api/sales/sales-orders
router.get('/sales-orders', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(salesOrders)
      .where(eq(salesOrders.orgId, orgId))
      .orderBy(desc(salesOrders.createdAt));
    return res.status(200).json(list);
  } catch (err) { return next(err); }
});

// GET /api/sales/sales-orders/:id
router.get('/sales-orders/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [so] = await db.select().from(salesOrders)
      .where(and(eq(salesOrders.id, id), eq(salesOrders.orgId, orgId))).limit(1);
    if (!so) throw new AppError('Sales order not found.', 404);
    return res.status(200).json(so);
  } catch (err) { return next(err); }
});

// POST /api/sales/sales-orders
router.post('/sales-orders', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const body = createSalesOrderSchema.parse(req.body);
    const count = await db.select({ c: sql`count(*)` }).from(salesOrders).where(eq(salesOrders.orgId, orgId));
    const seq = (Number((count[0] as any).c) + 1).toString().padStart(4, '0');
    const soNumber = `SO-${seq}`;
    const [so] = await db.insert(salesOrders).values({
      orgId, soNumber,
      customerId: body.customerId,
      quoteId: body.quoteId || null,
      date: body.date ? new Date(body.date) : new Date(),
      expectedDelivery: body.expectedDelivery ? new Date(body.expectedDelivery) : null,
      status: body.status,
      currency: body.currency,
      subtotal: body.subtotal,
      discount: body.discount,
      tax: body.tax,
      total: body.total,
      notes: body.notes || null,
      lines: body.lines || [],
      createdBy: userId,
    } as any).returning();
    return res.status(201).json(so);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

// PATCH /api/sales/sales-orders/:id
router.patch('/sales-orders/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = updateSalesOrderSchema.parse(req.body);
    const updateData: any = { ...body };
    if (body.date) updateData.date = new Date(body.date);
    if (body.expectedDelivery) updateData.expectedDelivery = new Date(body.expectedDelivery);
    const [so] = await db.update(salesOrders).set(updateData)
      .where(and(eq(salesOrders.id, id), eq(salesOrders.orgId, orgId))).returning();
    if (!so) throw new AppError('Sales order not found.', 404);
    return res.status(200).json(so);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

// DELETE /api/sales/sales-orders/:id
router.delete('/sales-orders/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [existing] = await db.select().from(salesOrders)
      .where(and(eq(salesOrders.id, id), eq(salesOrders.orgId, orgId))).limit(1);
    if (!existing) throw new AppError('Sales order not found.', 404);
    if (existing.status === 'fulfilled') throw new AppError('Fulfilled sales orders cannot be deleted.', 400);
    await db.delete(salesOrders).where(eq(salesOrders.id, id));
    return res.status(200).json({ message: 'Sales order deleted.' });
  } catch (err) { return next(err); }
});

// POST /api/sales/sales-orders/:id/convert — convert SO to invoice
router.post('/sales-orders/:id/convert', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { id } = req.params;
    const [so] = await db.select().from(salesOrders)
      .where(and(eq(salesOrders.id, id), eq(salesOrders.orgId, orgId))).limit(1);
    if (!so) throw new AppError('Sales order not found.', 404);
    if (so.status === 'fulfilled') throw new AppError('Sales order already fulfilled.', 400);
    const count = await db.select({ c: sql`count(*)` }).from(invoices).where(eq(invoices.orgId, orgId));
    const seq = (Number((count[0] as any).c) + 1).toString().padStart(4, '0');
    const invoiceNumber = `INV-${seq}`;
    const [invoice] = await db.insert(invoices).values({
      orgId, invoiceNumber,
      customerId: so.customerId,
      soId: so.id,
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'draft',
      currency: so.currency,
      subtotal: so.subtotal,
      discountAmount: so.discount,
      taxAmount: so.tax,
      total: so.total,
      amountPaid: 0,
      balanceDue: so.total,
      notes: so.notes || null,
      createdBy: userId,
    }).returning();
    // Copy line items
    const soLines = (so as any).lines || [];
    for (const ql of soLines) {
      const qty = Number(ql.quantity || 1);
        const price = Math.round(Number(ql.unitPrice || 0)); // already stored in kobo
      const discPct = Number(ql.discountPct || 0);
      const taxRate = Number(ql.taxRate ?? 7.5);
      const base = qty * price;
      const disc = Math.round(base * discPct / 100);
      const afterDisc = base - disc;
      const taxAmt = Math.round(afterDisc * taxRate / 100);
      await db.insert(invoiceLines).values({
        invoiceId: invoice.id,
        itemId: ql.itemId || null,
        description: ql.description || '',
        quantity: qty.toString(),
        unitPrice: price,
        discountPct: discPct.toString(),
        taxRate: taxRate.toString(),
        taxAmount: taxAmt,
        lineTotal: afterDisc + taxAmt,
        accountId: null,
      });
    }
    await db.update(salesOrders).set({ status: 'fulfilled' }).where(eq(salesOrders.id, id));
    return res.status(201).json({ invoice, message: 'Sales order converted to invoice successfully.' });
  } catch (err) { return next(err); }
});

// ==========================================
// RECURRING INVOICES (Billing Templates)
// ==========================================

router.get('/recurring-invoices', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rows = await listRecurringInvoices(orgId);
    return res.status(200).json(rows);
  } catch (err) { return next(err); }
});

router.post('/recurring-invoices', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = createRecurringInvoiceSchema.parse(req.body);
    const created = await createRecurringInvoice(body, orgId, userId);
    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

router.get('/recurring-invoices/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const row = await getRecurringInvoice(id, orgId);
    return res.status(200).json(row);
  } catch (err) { return next(err); }
});

router.patch('/recurring-invoices/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = updateRecurringInvoiceSchema.parse(req.body);
    const updated = await updateRecurringInvoice(id, orgId, body);
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

router.delete('/recurring-invoices/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    await deleteRecurringInvoice(id, orgId);
    return res.status(200).json({ message: 'Billing template deleted.' });
  } catch (err) { return next(err); }
});

router.post('/recurring-invoices/:id/generate-now', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    const invoice = await generateInvoiceFromTemplate(id, orgId, userId);
    return res.status(201).json(invoice);
  } catch (err) { return next(err); }
});

// Alias: some frontend builds call this without the "-now" suffix
router.post('/recurring-invoices/:id/generate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    const invoice = await generateInvoiceFromTemplate(id, orgId, userId);
    return res.status(201).json(invoice);
  } catch (err) { return next(err); }
});

export default router;


