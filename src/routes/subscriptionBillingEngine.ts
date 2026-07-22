import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { requirePlatformPermission } from '../middleware/platformAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { ValidationError } from '../lib/errors';
import { extractReqMeta } from '../services/audit.service';
import { db, subscriptionInvoices, subscriptionInvoiceItems, subscriptionCreditNotes, subscriptionPayments } from '../db/schema';
import * as engine from '../services/subscriptionBillingEngine.service';

const router = Router();

// ── Invoice List ──

router.get('/billing/invoices', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const status = req.query.status as string | undefined;
  const conditions: any[] = [eq(subscriptionInvoices.orgId, orgId)];
  if (status) conditions.push(eq(subscriptionInvoices.status, status as any));
  const invoices = await db.select().from(subscriptionInvoices).where(and(...conditions)).orderBy(desc(subscriptionInvoices.createdAt));
  const withItems = await Promise.all(invoices.map(async (inv) => {
    const items = await db.select().from(subscriptionInvoiceItems).where(eq(subscriptionInvoiceItems.invoiceId, inv.id));
    return { ...inv, items };
  }));
  res.json(ok(withItems));
}));

// ── Single Invoice ──

router.get('/billing/invoices/:id', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const [inv] = await db.select().from(subscriptionInvoices).where(and(eq(subscriptionInvoices.id, req.params.id), eq(subscriptionInvoices.orgId, orgId))).limit(1);
  if (!inv) return res.status(404).json(ok({ error: 'Invoice not found' }));
  const items = await db.select().from(subscriptionInvoiceItems).where(eq(subscriptionInvoiceItems.invoiceId, inv.id));
  res.json(ok({ ...inv, items }));
}));

// ── Generate Invoice ──

router.post('/billing/invoices/generate', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const data = z.object({
    subscriptionId: z.string().uuid(), description: z.string().optional(),
    items: z.array(z.object({
      description: z.string(), type: z.string().optional(), quantity: z.number().int().min(1),
      unitPriceKobo: z.number().int().min(0), amountKobo: z.number().int().min(0), taxKobo: z.number().int().optional(),
    })).min(1),
    periodStart: z.string().optional(), periodEnd: z.string().optional(), dueDate: z.string().optional(),
    taxRateId: z.string().uuid().optional(), discountKobo: z.number().int().optional(),
    couponId: z.string().uuid().optional(), promotionId: z.string().uuid().optional(),
  }).parse(req.body);

  const invoice = await engine.generateInvoice(orgId, data.subscriptionId, {
    ...data,
    periodStart: data.periodStart ? new Date(data.periodStart) : undefined,
    periodEnd: data.periodEnd ? new Date(data.periodEnd) : undefined,
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
  });
  res.status(201).json(ok(invoice));
}));

// ── Download Invoice PDF ──

router.get('/billing/invoices/:id/pdf', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const html = await engine.generateInvoiceHtml(req.params.id, orgId);
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.html"`);
  res.send(html);
}));

// ── Email Invoice ──

router.post('/billing/invoices/:id/email', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const sent = await engine.emailInvoice(orgId, req.params.id);
  res.json(ok({ sent }));
}));

// ── Credit Notes ──

router.get('/billing/credit-notes', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const notes = await db.select().from(subscriptionCreditNotes).where(eq(subscriptionCreditNotes.orgId, orgId)).orderBy(desc(subscriptionCreditNotes.createdAt));
  res.json(ok(notes));
}));

router.post('/billing/credit-notes', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const userId = (req as any).user!.userId!;
  const data = z.object({
    invoiceId: z.string().uuid().optional(), subscriptionId: z.string().uuid().optional(),
    reason: z.string().min(1), amountKobo: z.number().int().min(1), taxKobo: z.number().int().optional(),
  }).parse(req.body);
  const cn = await engine.createCreditNote(orgId, userId, data);
  res.status(201).json(ok(cn));
}));

// ── Refunds ──

router.post('/billing/refund', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const userId = (req as any).user!.userId!;
  const { invoiceId, reason, amountKobo } = z.object({
    invoiceId: z.string().uuid(), reason: z.string().min(1), amountKobo: z.number().int().optional(),
  }).parse(req.body);
  const result = await engine.processRefund(orgId, userId, invoiceId, reason, amountKobo);
  res.json(ok(result));
}));

// ── Tax Rates ──

router.get('/billing/tax-rates', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const rates = await engine.getOrgTaxRates(orgId);
  res.json(ok(rates));
}));

router.post('/billing/tax-rates', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const data = z.object({ name: z.string().min(1), rate: z.number().int().min(0).max(10000), type: z.string().optional(), isDefault: z.boolean().optional(), description: z.string().optional() }).parse(req.body);
  const rate = await engine.saveTaxRate(orgId, data);
  res.status(201).json(ok(rate));
}));

router.delete('/billing/tax-rates/:id', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  await engine.deleteTaxRate(req.params.id, orgId);
  res.json(ok({ deleted: true }));
}));

// ── Outstanding Balances ──

router.get('/billing/outstanding', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const balances = await engine.getOutstandingBalances(orgId);
  res.json(ok(balances));
}));

// ── Billing History ──

router.get('/billing/history', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const history = await engine.getBillingHistory(orgId);
  res.json(ok(history));
}));

// ── Handle Failed Payment (dunning) ──

router.post('/billing/invoices/:id/handle-failure', asyncHandler(async (req: Request, res: Response) => {
  const result = await engine.handleFailedPayment(req.params.id);
  res.json(ok(result));
}));

// ── Generate Accounting Entries ──

router.post('/billing/invoices/:id/accounting-entries', asyncHandler(async (req: Request, res: Response) => {
  const orgId = (req as any).user!.orgId!;
  const entries = await engine.generateAccountingEntries(orgId, req.params.id);
  res.json(ok(entries));
}));

// ── Admin: Generate renewal invoices ──

router.post('/billing/generate-renewals', requirePlatformPermission('billing:manage'), asyncHandler(async (_req: Request, res: Response) => {
  const result = await engine.scheduleInvoiceGeneration();
  res.json(ok(result));
}));

// ── Proration calculator ──

router.post('/billing/calculate-proration', asyncHandler(async (req: Request, res: Response) => {
  const { oldMonthlyKobo, newMonthlyKobo, daysRemaining, daysInPeriod } = z.object({
    oldMonthlyKobo: z.number().int(), newMonthlyKobo: z.number().int(),
    daysRemaining: z.number().int(), daysInPeriod: z.number().int().default(30),
  }).parse(req.body);
  const result = engine.calculateProration(oldMonthlyKobo, newMonthlyKobo, daysRemaining, daysInPeriod);
  res.json(ok(result));
}));

export default router;
