/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { eq, and, desc, lte } from 'drizzle-orm';
import {
  db,
  recurringInvoices,
  contacts,
  invoices
} from '../db/schema';
import { AppError } from '../lib/errors';
import { createInvoice } from './invoice.service';

/**
 * Advance a date by one billing cycle based on frequency.
 */
function advanceDate(date: Date, frequency: string): Date {
  const d = new Date(date);
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'annually':
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d;
}

export async function createRecurringInvoice(input: any, orgId: string, createdBy: string): Promise<any> {
  if (!input.template || !input.template.lines || input.template.lines.length === 0) {
    throw new AppError('A billing template must contain at least one line item.', 400);
  }

  const startDate = new Date(input.startDate || new Date());

  const [created] = await db
    .insert(recurringInvoices)
    .values({
      orgId,
      customerId: input.customerId,
      frequency: input.frequency,
      startDate,
      endDate: input.endDate ? new Date(input.endDate) : null,
      nextRunDate: startDate,
      isActive: input.isActive !== undefined ? input.isActive : true,
      template: input.template,
      createdBy
    })
    .returning();

  if (!created) throw new AppError('Failed to create billing template.', 500);
  return created;
}

export async function listRecurringInvoices(orgId: string): Promise<any[]> {
  const rows = await db
    .select()
    .from(recurringInvoices)
    .where(eq(recurringInvoices.orgId, orgId))
    .orderBy(desc(recurringInvoices.createdAt));

  // Attach customer name + count of invoices already generated from each template
  const results = [];
  for (const row of rows) {
    const [customer] = await db
      .select({ id: contacts.id, name: contacts.name, email: contacts.email })
      .from(contacts)
      .where(eq(contacts.id, row.customerId))
      .limit(1);

    const generatedInvoices = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, total: invoices.total, date: invoices.date })
      .from(invoices)
      .where(eq(invoices.recurringId, row.id))
      .orderBy(desc(invoices.date));

    results.push({ ...row, customer, generatedInvoices, generatedCount: generatedInvoices.length });
  }

  return results;
}

export async function getRecurringInvoice(id: string, orgId: string): Promise<any> {
  const [row] = await db
    .select()
    .from(recurringInvoices)
    .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.orgId, orgId)))
    .limit(1);

  if (!row) throw new AppError('Billing template not found.', 404);

  const [customer] = await db
    .select({ id: contacts.id, name: contacts.name, email: contacts.email })
    .from(contacts)
    .where(eq(contacts.id, row.customerId))
    .limit(1);

  const generatedInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.recurringId, row.id))
    .orderBy(desc(invoices.date));

  return { ...row, customer, generatedInvoices };
}

export async function updateRecurringInvoice(id: string, orgId: string, input: any): Promise<any> {
  const [existing] = await db
    .select()
    .from(recurringInvoices)
    .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.orgId, orgId)))
    .limit(1);

  if (!existing) throw new AppError('Billing template not found.', 404);

  const updateValues: any = {};
  if (input.frequency !== undefined) updateValues.frequency = input.frequency;
  if (input.startDate !== undefined) updateValues.startDate = new Date(input.startDate);
  if (input.endDate !== undefined) updateValues.endDate = input.endDate ? new Date(input.endDate) : null;
  if (input.isActive !== undefined) updateValues.isActive = input.isActive;
  if (input.template !== undefined) updateValues.template = input.template;
  if (input.customerId !== undefined) updateValues.customerId = input.customerId;
  if (input.nextRunDate !== undefined) updateValues.nextRunDate = input.nextRunDate ? new Date(input.nextRunDate) : null;

  const [updated] = await db
    .update(recurringInvoices)
    .set(updateValues)
    .where(eq(recurringInvoices.id, id))
    .returning();

  return updated;
}

export async function deleteRecurringInvoice(id: string, orgId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(recurringInvoices)
    .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.orgId, orgId)))
    .limit(1);

  if (!existing) throw new AppError('Billing template not found.', 404);

  await db.delete(recurringInvoices).where(eq(recurringInvoices.id, id));
}

/**
 * Generate an invoice immediately from a recurring template, regardless of nextRunDate.
 * Advances nextRunDate by one cycle after generation.
 */
export async function generateInvoiceFromTemplate(id: string, orgId: string, userId: string): Promise<any> {
  const [template] = await db
    .select()
    .from(recurringInvoices)
    .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.orgId, orgId)))
    .limit(1);

  if (!template) throw new AppError('Billing template not found.', 404);
  if (!template.isActive) throw new AppError('Cannot generate an invoice from a paused billing template.', 400);

  const tpl: any = template.template || {};
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + (tpl.paymentTerms || 30));

  const invoice = await createInvoice(
    {
      orgId,
      customerId: template.customerId,
      date: today.toISOString(),
      dueDate: dueDate.toISOString(),
      status: tpl.autoSend ? 'sent' : 'draft',
      currency: tpl.currency || 'NGN',
      paymentTerms: tpl.paymentTerms || 30,
      notes: tpl.notes || null,
      terms: tpl.terms || null,
      recurringId: template.id,
      lines: tpl.lines
    },
    userId
  );

  const newNextRunDate = advanceDate(template.nextRunDate || today, template.frequency);

  await db
    .update(recurringInvoices)
    .set({ nextRunDate: newNextRunDate })
    .where(eq(recurringInvoices.id, id));

  return invoice;
}

/**
 * Run all due recurring templates for an org (or all orgs if none specified).
 * Intended to be called by a scheduled job.
 */
export async function runDueRecurringInvoices(orgId?: string): Promise<any[]> {
  const conditions = [eq(recurringInvoices.isActive, true), lte(recurringInvoices.nextRunDate, new Date())];
  if (orgId) conditions.push(eq(recurringInvoices.orgId, orgId));

  const due = await db
    .select()
    .from(recurringInvoices)
    .where(and(...conditions));

  const generated = [];
  for (const template of due) {
    if (template.endDate && new Date(template.endDate) < new Date()) {
      await db.update(recurringInvoices).set({ isActive: false }).where(eq(recurringInvoices.id, template.id));
      continue;
    }
    try {
      const invoice = await generateInvoiceFromTemplate(template.id, template.orgId, template.createdBy);
      generated.push(invoice);
    } catch (err) {
      // Skip this template on failure; continue processing the rest.
      continue;
    }
  }

  return generated;
}
