import { eq, and, desc, sql, lte, gte } from 'drizzle-orm';
import { db, organisations, subscriptions, subscriptionPlans, addonProducts, subscriptionAddons,
  subscriptionInvoices, subscriptionInvoiceItems, subscriptionCreditNotes, subscriptionTaxRates,
  subscriptionPayments, paymentReceipts, users, journalEntries, journalLines, accounts } from '../db/schema';
import { AppError } from '../lib/errors';
import { sendOrgEmail } from './email.service';
import { createAuditLog, extractReqMeta } from './audit.service';
import { getOrgSubscription } from './subscription.service';

// ── Invoice Number Generation ──

export async function generateNextInvoiceNumber(orgId: string): Promise<string> {
  const [org] = await db.select({ prefix: organisations.invoicePrefix, next: organisations.nextInvoiceNumber })
    .from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const prefix = org?.prefix || 'INV';
  const num = org?.next || 1;
  await db.update(organisations).set({ nextInvoiceNumber: num + 1 } as any).where(eq(organisations.id, orgId));
  return `${prefix}-${String(num).padStart(5, '0')}`;
}

export async function generateNextCreditNoteNumber(orgId: string): Promise<string> {
  const [org] = await db.select({ prefix: organisations.creditNotePrefix, next: organisations.nextCreditNoteNumber })
    .from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const prefix = org?.prefix || 'CN';
  const num = org?.next || 1;
  await db.update(organisations).set({ nextCreditNoteNumber: num + 1 } as any).where(eq(organisations.id, orgId));
  return `${prefix}-${String(num).padStart(5, '0')}`;
}

// ── Tax Calculation ──

export async function getOrgTaxRates(orgId: string, includeInactive = false): Promise<any[]> {
  const conditions: any[] = [eq(subscriptionTaxRates.orgId, orgId)];
  if (!includeInactive) conditions.push(eq(subscriptionTaxRates.isActive, true));
  return await db.select().from(subscriptionTaxRates).where(and(...conditions)).orderBy(desc(subscriptionTaxRates.isDefault));
}

export async function getDefaultTaxRate(orgId: string): Promise<any | null> {
  const [org] = await db.select({ defaultTaxRateId: organisations.defaultTaxRateId }).from(organisations).where(eq(organisations.id, orgId)).limit(1);
  if (org?.defaultTaxRateId) {
    const [rate] = await db.select().from(subscriptionTaxRates).where(and(eq(subscriptionTaxRates.id, org.defaultTaxRateId), eq(subscriptionTaxRates.isActive, true))).limit(1);
    if (rate) return rate;
  }
  const [rate] = await db.select().from(subscriptionTaxRates).where(and(eq(subscriptionTaxRates.orgId, orgId), eq(subscriptionTaxRates.isActive, true), eq(subscriptionTaxRates.isDefault, true))).limit(1);
  return rate || null;
}

export async function saveTaxRate(orgId: string, data: { name: string; rate: number; type?: string; isDefault?: boolean; description?: string }): Promise<any> {
  if (data.isDefault) {
    await db.update(subscriptionTaxRates).set({ isDefault: false } as any).where(and(eq(subscriptionTaxRates.orgId, orgId), eq(subscriptionTaxRates.isDefault, true)));
  }
  const [row] = await db.insert(subscriptionTaxRates).values({ orgId, ...data } as any).returning();
  return row;
}

export async function deleteTaxRate(id: string, orgId: string): Promise<void> {
  await db.delete(subscriptionTaxRates).where(and(eq(subscriptionTaxRates.id, id), eq(subscriptionTaxRates.orgId, orgId)));
}

export function calculateTax(amountKobo: number, rateBasisPoints: number): number {
  return Math.round(amountKobo * rateBasisPoints / 10000);
}

// ── Proration Calculation ──

export function calculateProration(
  oldMonthlyKobo: number, newMonthlyKobo: number,
  daysRemaining: number, daysInPeriod: number,
): { creditKobo: number; chargeKobo: number; netKobo: number } {
  const dailyOld = oldMonthlyKobo / daysInPeriod;
  const dailyNew = newMonthlyKobo / daysInPeriod;
  const creditKobo = Math.round(dailyOld * daysRemaining);
  const chargeKobo = Math.round(dailyNew * daysRemaining);
  const netKobo = chargeKobo - creditKobo;
  return { creditKobo, chargeKobo, netKobo };
}

// ── Invoice Generation ──

export async function generateInvoice(
  orgId: string, subscriptionId: string, data: {
    items: { description: string; type?: string; quantity: number; unitPriceKobo: number; amountKobo: number; taxKobo?: number; }[];
    description?: string; periodStart?: Date; periodEnd?: Date; dueDate?: Date;
    taxRateId?: string; discountKobo?: number;
    couponId?: string; promotionId?: string;
  },
): Promise<any> {
  const sub = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1).then(r => r[0]);
  if (!sub) throw new AppError('Subscription not found.', 404);

  const invoiceNumber = await generateNextInvoiceNumber(orgId);

  // Calculate totals
  let subtotalKobo = 0;
  let totalTaxKobo = 0;

  const resolvedItems = await Promise.all(data.items.map(async (item) => {
    let taxKobo = item.taxKobo || 0;
    if (!taxKobo && data.taxRateId) {
      const [taxRate] = await db.select().from(subscriptionTaxRates).where(eq(subscriptionTaxRates.id, data.taxRateId)).limit(1);
      if (taxRate) taxKobo = calculateTax(item.amountKobo, taxRate.rate);
    } else if (!taxKobo) {
      const defaultRate = await getDefaultTaxRate(orgId);
      if (defaultRate) taxKobo = calculateTax(item.amountKobo, defaultRate.rate);
    }
    subtotalKobo += item.amountKobo;
    totalTaxKobo += taxKobo;
    return { ...item, taxKobo, totalKobo: item.amountKobo + taxKobo };
  }));

  const discountKobo = data.discountKobo || 0;
  const totalKobo = subtotalKobo + totalTaxKobo - discountKobo;

  const [invoice] = await db.insert(subscriptionInvoices).values({
    orgId, subscriptionId, invoiceNumber,
    description: data.description || 'Subscription invoice',
    amountKobo: subtotalKobo, taxKobo: totalTaxKobo, totalKobo,
    discountKobo, periodStart: data.periodStart, periodEnd: data.periodEnd,
    dueDate: data.dueDate || new Date(Date.now() + 7 * 86400000),
    status: 'pending', couponId: data.couponId, promotionId: data.promotionId,
  } as any).returning();

  // Insert line items
  if (resolvedItems.length > 0) {
    await db.insert(subscriptionInvoiceItems).values(
      resolvedItems.map(item => ({
        orgId, invoiceId: invoice.id,
        description: item.description, type: item.type || 'subscription',
        quantity: item.quantity, unitPriceKobo: item.unitPriceKobo,
        amountKobo: item.amountKobo, taxKobo: item.taxKobo, totalKobo: item.totalKobo,
      }))
    );
  }

  return { ...invoice, items: resolvedItems };
}

// ── Schedule Invoice Generation (called by lifecycle during renewal) ──

export async function generateSubscriptionInvoice(orgId: string, subscriptionId: string): Promise<any> {
  const sub = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1).then(r => r[0]);
  if (!sub) return null;

  const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId)).limit(1).then(r => r[0]);
  if (!plan) return null;

  const priceKobo = sub.billingCycle === 'annual' ? Number(plan.annualPriceKobo) : Number(plan.monthlyPriceKobo);
  const now = new Date();
  const periodEnd = new Date(now);
  if (sub.billingCycle === 'annual') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  // Get active add-ons
  const addons = await db.select().from(subscriptionAddons)
    .where(and(eq(subscriptionAddons.orgId, orgId), eq(subscriptionAddons.subscriptionId, subscriptionId), eq(subscriptionAddons.isActive, true)));

  const items: any[] = [
    { description: `${plan.name} (${sub.billingCycle})`, type: 'subscription', quantity: 1, unitPriceKobo: priceKobo, amountKobo: priceKobo },
  ];

  let addonTotal = 0;
  for (const a of addons) {
    const aPrice = Number(a.priceKobo);
    addonTotal += aPrice;
    items.push({
      description: `${a.name} x${a.quantity}`, type: 'addon',
      quantity: a.quantity, unitPriceKobo: Math.round(aPrice / a.quantity), amountKobo: aPrice,
    });
  }

  return await generateInvoice(orgId, subscriptionId, {
    items, description: `${plan.name} subscription - ${sub.billingCycle}`,
    periodStart: sub.currentPeriodStart || now, periodEnd: sub.currentPeriodEnd || periodEnd,
    dueDate: new Date(Date.now() + 7 * 86400000),
    discountKobo: 0, couponId: sub.couponId || undefined, promotionId: sub.promotionId || undefined,
  } as any);
}

// ── Credit Notes ──

export async function createCreditNote(orgId: string, userId: string, data: {
  invoiceId?: string; subscriptionId?: string; reason: string;
  amountKobo: number; taxKobo?: number;
}): Promise<any> {
  const cnNumber = await generateNextCreditNoteNumber(orgId);
  const totalKobo = data.amountKobo + (data.taxKobo || 0);

  const [cn] = await db.insert(subscriptionCreditNotes).values({
    orgId, invoiceId: data.invoiceId, subscriptionId: data.subscriptionId,
    creditNoteNumber: cnNumber, reason: data.reason,
    amountKobo: data.amountKobo, taxKobo: data.taxKobo || 0, totalKobo,
    status: 'issued', createdBy: userId,
  } as any).returning();

  return cn;
}

// ── Refunds ──

export async function processRefund(orgId: string, userId: string, invoiceId: string, reason: string, amountKobo?: number): Promise<any> {
  const [inv] = await db.select().from(subscriptionInvoices).where(and(eq(subscriptionInvoices.id, invoiceId), eq(subscriptionInvoices.orgId, orgId))).limit(1);
  if (!inv) throw new AppError('Invoice not found.', 404);
  if (inv.status !== 'paid') throw new AppError('Only paid invoices can be refunded.', 400);
  if (inv.refundedAt) throw new AppError('Invoice already refunded.', 400);

  const refundAmount = amountKobo || inv.totalKobo;
  if (refundAmount > inv.totalKobo) throw new AppError('Refund amount exceeds invoice total.', 400);

  const cn = await createCreditNote(orgId, userId, {
    invoiceId, subscriptionId: inv.subscriptionId || undefined, reason,
    amountKobo: refundAmount,
    taxKobo: inv.taxKobo > 0 ? Math.round((refundAmount / inv.totalKobo) * inv.taxKobo) : 0,
  });

  const now = new Date();
  await db.update(subscriptionInvoices).set({
    status: refundAmount >= inv.totalKobo ? 'refunded' : inv.status,
    refundedAt: now, refundedAmountKobo: (inv.refundedAmountKobo || 0) + refundAmount,
    refundReason: reason, updatedAt: now,
  } as any).where(eq(subscriptionInvoices.id, invoiceId));

  // Update credit note as applied + refunded
  await db.update(subscriptionCreditNotes).set({ status: 'applied', appliedAt: now, refundedAt: now } as any).where(eq(subscriptionCreditNotes.id, cn.id));

  return { creditNote: cn, invoice: { ...inv, refundedAt: now, refundedAmountKobo: (inv.refundedAmountKobo || 0) + refundAmount } };
}

// ── Outstanding Balances ──

export async function getOutstandingBalances(orgId: string): Promise<{
  totalOutstanding: number; overdueCount: number; pendingInvoices: any[];
}> {
  const now = new Date();
  const pending = await db.select().from(subscriptionInvoices)
    .where(and(eq(subscriptionInvoices.orgId, orgId), eq(subscriptionInvoices.status, 'pending')))
    .orderBy(desc(subscriptionInvoices.dueDate));

  const totalOutstanding = pending.reduce((s, inv) => s + Number(inv.totalKobo), 0);
  const overdueCount = pending.filter(inv => inv.dueDate && new Date(inv.dueDate) < now).length;

  return { totalOutstanding, overdueCount, pendingInvoices: pending };
}

// ── Billing History ──

export async function getBillingHistory(orgId: string, limit = 50): Promise<any[]> {
  const invoices = await db.select({
    id: subscriptionInvoices.id, type: sql<string>`'invoice'`,
    number: subscriptionInvoices.invoiceNumber, status: subscriptionInvoices.status,
    totalKobo: subscriptionInvoices.totalKobo, date: subscriptionInvoices.createdAt,
    description: subscriptionInvoices.description,
  }).from(subscriptionInvoices).where(eq(subscriptionInvoices.orgId, orgId))
    .orderBy(desc(subscriptionInvoices.createdAt)).limit(limit);

  const payments = await db.select({
    id: subscriptionPayments.id, type: sql<string>`'payment'`,
    number: subscriptionPayments.gatewayReference, status: subscriptionPayments.status,
    totalKobo: subscriptionPayments.amountKobo, date: subscriptionPayments.createdAt,
    description: sql<string>`concat('Payment via ', ${subscriptionPayments.gateway})`,
  }).from(subscriptionPayments).where(eq(subscriptionPayments.orgId, orgId))
    .orderBy(desc(subscriptionPayments.createdAt)).limit(limit);

  const creditNotes = await db.select({
    id: subscriptionCreditNotes.id, type: sql<string>`'credit_note'`,
    number: subscriptionCreditNotes.creditNoteNumber, status: subscriptionCreditNotes.status,
    totalKobo: subscriptionCreditNotes.totalKobo, date: subscriptionCreditNotes.createdAt,
    description: subscriptionCreditNotes.reason,
  }).from(subscriptionCreditNotes).where(eq(subscriptionCreditNotes.orgId, orgId))
    .orderBy(desc(subscriptionCreditNotes.createdAt)).limit(limit);

  return [...invoices, ...payments, ...creditNotes]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

// ── PDF Invoice (HTML) ──

export async function generateInvoiceHtml(invoiceId: string, orgId: string): Promise<string> {
  const [inv] = await db.select().from(subscriptionInvoices).where(and(eq(subscriptionInvoices.id, invoiceId), eq(subscriptionInvoices.orgId, orgId))).limit(1);
  if (!inv) throw new AppError('Invoice not found.', 404);

  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const items = await db.select().from(subscriptionInvoiceItems).where(eq(subscriptionInvoiceItems.invoiceId, invoiceId));

  const fmt = (v: number) => `₦${(Number(v) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const d = (dt: any) => dt ? new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const statusColor = inv.status === 'paid' ? '#059669' : inv.status === 'refunded' ? '#dc2626' : '#d97706';
  const statusBg = inv.status === 'paid' ? '#d1fae5' : inv.status === 'refunded' ? '#fee2e2' : '#fef3c7';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${inv.invoiceNumber}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#333}
h1{color:#1a1a2e;border-bottom:2px solid #1a1a2e;padding-bottom:10px}
table{width:100%;border-collapse:collapse;margin:20px 0}
th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}
th{background:#f5f5f5;font-size:.85em;text-transform:uppercase;letter-spacing:.5px}
.total-row td{font-weight:bold;border-top:2px solid #333}
.status{display:inline-block;padding:4px 12px;border-radius:4px;font-size:.85em;background:${statusBg};color:${statusColor}}
.header-row{display:flex;justify-content:space-between;align-items:start}
.org-details{font-size:.9em;color:#666;margin:20px 0}
.footer{margin-top:40px;font-size:.8em;color:#999;border-top:1px solid #ddd;padding-top:15px;text-align:center}
</style></head><body>
<div class="header-row"><div><h1>INVOICE</h1><p class="status">${inv.status.toUpperCase()}</p></div>
<div style="text-align:right"><h2>${inv.invoiceNumber}</h2><p>Date: ${d(inv.createdAt)}</p><p>Due: ${d(inv.dueDate)}</p></div></div>
<div class="org-details"><strong>${org?.name || ''}</strong><br>${org?.address || ''}<br>${org?.email || ''}<br>VAT: ${org?.vatNumber || 'N/A'}</div>
<p><strong>Period:</strong> ${d(inv.periodStart)} — ${d(inv.periodEnd)}</p>
<p>${inv.description || ''}</p>
<table><tr><th>Item</th><th>Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th><th style="text-align:right">Tax</th><th style="text-align:right">Total</th></tr>
${items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td style="text-align:right">${fmt(i.unitPriceKobo)}</td><td style="text-align:right">${fmt(i.amountKobo)}</td><td style="text-align:right">${fmt(i.taxKobo)}</td><td style="text-align:right">${fmt(i.totalKobo)}</td></tr>`).join('')}
${inv.discountKobo > 0 ? `<tr><td colspan="5" style="text-align:right">Discount</td><td style="text-align:right;color:#dc2626">-${fmt(inv.discountKobo)}</td></tr>` : ''}
<tr class="total-row"><td colspan="5" style="text-align:right">Total Due</td><td style="text-align:right">${fmt(inv.totalKobo)}</td></tr>
</table>
${inv.paidAt ? `<p><strong>Paid:</strong> ${d(inv.paidAt)}</p>` : ''}
${inv.refundedAt ? `<p><strong>Refunded:</strong> ${d(inv.refundedAt)} — ${fmt(inv.refundedAmountKobo || 0)}</p>` : ''}
<div class="footer"><p>SkyBooks — Generated on ${d(new Date())}</p></div>
</body></html>`;
}

// ── Email Invoice ──

export async function emailInvoice(orgId: string, invoiceId: string): Promise<boolean> {
  const [inv] = await db.select().from(subscriptionInvoices).where(and(eq(subscriptionInvoices.id, invoiceId), eq(subscriptionInvoices.orgId, orgId))).limit(1);
  if (!inv) throw new AppError('Invoice not found.', 404);

  const [org] = await db.select({ name: organisations.name, email: organisations.email }).from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const html = await generateInvoiceHtml(invoiceId, orgId);

  const result = await sendOrgEmail(orgId, {
    to: org?.email || '',
    subject: `Invoice ${inv.invoiceNumber} from ${org?.name || 'SkyBooks'}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2>Invoice ${inv.invoiceNumber}</h2>
      <p>Dear customer,</p>
      <p>Please find your invoice attached below.</p>
      <p><strong>Amount Due:</strong> ₦${(Number(inv.totalKobo)/100).toLocaleString('en-NG',{minimumFractionDigits:2})}</p>
      <p><strong>Due Date:</strong> ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-GB') : 'N/A'}</p>
      ${html}
      <hr><p style="color:#666;font-size:.85em">SkyBooks — Automated billing notification</p>
    </div>`,
  });

  return result.success;
}

// ── Handle Failed Payment ──

export async function handleFailedPayment(invoiceId: string): Promise<{ action: string; nextRetry: Date | null }> {
  const [inv] = await db.select().from(subscriptionInvoices).where(eq(subscriptionInvoices.id, invoiceId)).limit(1);
  if (!inv) throw new AppError('Invoice not found.', 404);

  const attemptCount = (inv.attemptCount || 0) + 1;
  await db.update(subscriptionInvoices).set({ attemptCount, lastAttemptAt: new Date(), updatedAt: new Date() } as any).where(eq(subscriptionInvoices.id, invoiceId));

  // Dunning: retry 3 times, then mark overdue, then suspend
  if (attemptCount <= 3) {
    const nextRetry = new Date(Date.now() + attemptCount * 86400000); // 1, 2, 3 days
    return { action: `retry_${attemptCount}`, nextRetry };
  } else if (attemptCount <= 5) {
    await db.update(subscriptionInvoices).set({ status: 'overdue' } as any).where(eq(subscriptionInvoices.id, invoiceId));
    if (inv.subscriptionId) {
      await db.update(subscriptions).set({
        status: 'grace_period' as any,
        paymentFailureCount: attemptCount,
        updatedAt: new Date(),
      } as any).where(eq(subscriptions.id, inv.subscriptionId));
    }
    const nextRetry = new Date(Date.now() + 7 * 86400000);
    return { action: 'marked_overdue', nextRetry };
  } else {
    if (inv.subscriptionId) {
      await db.update(subscriptions).set({
        status: 'suspended' as any,
        paymentFailureCount: attemptCount,
        updatedAt: new Date(),
      } as any).where(eq(subscriptions.id, inv.subscriptionId));
    }
    return { action: 'suspended', nextRetry: null };
  }
}

// ── Accounting Entries ──

export async function generateAccountingEntries(orgId: string, invoiceId: string): Promise<any> {
  const [inv] = await db.select().from(subscriptionInvoices).where(and(eq(subscriptionInvoices.id, invoiceId), eq(subscriptionInvoices.orgId, orgId))).limit(1);
  if (!inv) throw new AppError('Invoice not found.', 404);
  if (inv.status !== 'paid') throw new AppError('Only paid invoices generate accounting entries.', 400);

  // Find revenue and receivable accounts
  const [revenueAcct] = await db.select().from(accounts).where(and(
    eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'revenue' as any), eq(accounts.isActive, true),
  )).limit(1);

  const [receivableAcct] = await db.select().from(accounts).where(and(
    eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'receivable' as any), eq(accounts.isActive, true),
  )).limit(1);

  const [vatAcct] = await db.select().from(accounts).where(and(
    eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'vat_payable' as any), eq(accounts.isActive, true),
  )).limit(1);

  if (!revenueAcct || !receivableAcct) return { skipped: 'No revenue/receivable accounts configured' };

  const amount = Number(inv.amountKobo);
  const tax = Number(inv.taxKobo);
  const total = Number(inv.totalKobo);

  const lines = [
    { accountId: receivableAcct.id, debit: total, credit: 0 },
    { accountId: revenueAcct.id, debit: 0, credit: amount },
  ];
  if (tax > 0 && vatAcct) {
    lines.push({ accountId: vatAcct.id, debit: 0, credit: tax });
  }

  // Check for duplicate entry
  const [existing] = await db.select({ id: journalEntries.id }).from(journalEntries)
    .where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.source, 'subscription' as any), eq(journalEntries.sourceId, invoiceId)))
    .limit(1);
  if (existing) return { skipped: 'JE already exists', entryId: existing.id };

  const [entry] = await db.insert(journalEntries).values({
    orgId, entryNumber: `SUB-${inv.invoiceNumber}`, date: new Date(),
    description: `Subscription invoice ${inv.invoiceNumber}`,
    source: 'subscription' as any, sourceId: invoiceId, status: 'posted' as any,
  } as any).returning();

  await db.insert(journalLines).values(
    lines.map(l => ({ ...l, entryId: entry.id, orgId }))
  );

  return { entryId: entry.id, lines };
}

export async function scheduleInvoiceGeneration() {
  const dueSubs = await db.select().from(subscriptions)
    .where(and(
      eq(subscriptions.status, 'active'),
      lte(subscriptions.currentPeriodEnd, new Date(Date.now() + 86400000)),
    ));

  let count = 0;
  for (const sub of dueSubs) {
    try {
      await generateSubscriptionInvoice(sub.orgId, sub.id);
      count++;
    } catch (err) {
      console.error(`[BillingEngine] Failed to generate invoice for sub ${sub.id}:`, err);
    }
  }
  return { invoicesGenerated: count };
}
