/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, contacts, invoices, paymentsReceived, paymentAllocations, creditNotes, accounts, paymentsMade, paymentMadeAllocations } from '../db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
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
  deletePaymentReceived,
  unallocatePayment,
  recordPaymentMade
} from '../services/payment.service';
import {
  createCreditNote,
  applyCreditNote
} from '../services/creditNote.service';

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

const recordPaymentReceivedSchema = z.object({
  customerId: z.string().uuid('Invalid customer id.'),
  date: z.string().optional(),
  amount: z.number().int().positive('Payment amount must be greater than zero (In Kobo).'),
  currency: z.string().optional(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'cheque', 'pos', 'ussd']),
  reference: z.string().optional().nullable(),
  accountId: z.string().uuid('Invalid active receipt account.'),
  notes: z.string().optional().nullable(),
  allocations: z.array(
    z.object({
      invoiceId: z.string().uuid(),
      amount: z.number().int().positive('Allocation amount must be positive.')
    })
  ).min(1, 'Payment must specify at least one invoice allocation.')
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
  tax: z.number().int().nonnegative('Tax must be non-negative (In Kobo).')
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
    const list = await db
      .select()
      .from(paymentsReceived)
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

    const [pmt] = await db
      .select()
      .from(paymentsReceived)
      .where(and(eq(paymentsReceived.id, id), eq(paymentsReceived.orgId, orgId)))
      .limit(1);

    if (!pmt) {
      // Try searching payments made instead
      const [pmtMade] = await db
        .select()
        .from(paymentsMade)
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

    return res.status(200).json(notes);
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
    return res.status(200).json(note);
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

    return res.status(200).json(list);
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
    return res.status(200).json(customer);
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
      // Drafts shouldn't usually show inside posted accounting statements
      if (inv.status === 'draft') continue;
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
      if (cn.status === 'draft') continue;
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

export default router;
