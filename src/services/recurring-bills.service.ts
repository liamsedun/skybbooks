import { eq, and, desc, lte } from 'drizzle-orm';
import {
  db,
  recurringBills,
  contacts,
  bills
} from '../db/schema';
import { AppError } from '../lib/errors';
import { createBill } from './bill.service';

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

export async function createRecurringBill(input: any, orgId: string, createdBy: string): Promise<any> {
  if (!input.template || !input.template.lines || input.template.lines.length === 0) {
    throw new AppError('A recurring bill template must contain at least one line item.', 400);
  }

  const startDate = new Date(input.startDate || new Date());

  const [created] = await db
    .insert(recurringBills)
    .values({
      orgId,
      vendorId: input.vendorId,
      frequency: input.frequency,
      startDate,
      endDate: input.endDate ? new Date(input.endDate) : null,
      nextRunDate: startDate,
      isActive: input.isActive !== undefined ? input.isActive : true,
      template: input.template,
      createdBy
    })
    .returning();

  if (!created) throw new AppError('Failed to create recurring bill template.', 500);
  return created;
}

export async function listRecurringBills(orgId: string): Promise<any[]> {
  const rows = await db
    .select()
    .from(recurringBills)
    .where(eq(recurringBills.orgId, orgId))
    .orderBy(desc(recurringBills.createdAt));

  const results = [];
  for (const row of rows) {
    const [vendor] = await db
      .select({ id: contacts.id, name: contacts.name, email: contacts.email })
      .from(contacts)
      .where(and(eq(contacts.id, row.vendorId), eq(contacts.type, 'vendor')))
      .limit(1);

    const generatedBills = await db
      .select({ id: bills.id, billNumber: bills.billNumber, total: bills.total, date: bills.date })
      .from(bills)
      .where(eq(bills.recurringId, row.id))
      .orderBy(desc(bills.date));

    results.push({ ...row, vendor, generatedBills, generatedCount: generatedBills.length });
  }

  return results;
}

export async function getRecurringBill(id: string, orgId: string): Promise<any> {
  const [row] = await db
    .select()
    .from(recurringBills)
    .where(and(eq(recurringBills.id, id), eq(recurringBills.orgId, orgId)))
    .limit(1);

  if (!row) throw new AppError('Recurring bill template not found.', 404);

  const [vendor] = await db
    .select({ id: contacts.id, name: contacts.name, email: contacts.email })
    .from(contacts)
    .where(and(eq(contacts.id, row.vendorId), eq(contacts.type, 'vendor')))
    .limit(1);

  const generatedBills = await db
    .select()
    .from(bills)
    .where(eq(bills.recurringId, row.id))
    .orderBy(desc(bills.date));

  return { ...row, vendor, generatedBills };
}

export async function updateRecurringBill(id: string, orgId: string, input: any): Promise<any> {
  const [existing] = await db
    .select()
    .from(recurringBills)
    .where(and(eq(recurringBills.id, id), eq(recurringBills.orgId, orgId)))
    .limit(1);

  if (!existing) throw new AppError('Recurring bill template not found.', 404);

  const updateValues: any = {};
  if (input.frequency !== undefined) updateValues.frequency = input.frequency;
  if (input.startDate !== undefined) updateValues.startDate = new Date(input.startDate);
  if (input.endDate !== undefined) updateValues.endDate = input.endDate ? new Date(input.endDate) : null;
  if (input.isActive !== undefined) updateValues.isActive = input.isActive;
  if (input.template !== undefined) updateValues.template = input.template;
  if (input.vendorId !== undefined) updateValues.vendorId = input.vendorId;
  if (input.nextRunDate !== undefined) updateValues.nextRunDate = input.nextRunDate ? new Date(input.nextRunDate) : null;

  const [updated] = await db
    .update(recurringBills)
    .set(updateValues)
    .where(eq(recurringBills.id, id))
    .returning();

  return updated;
}

export async function deleteRecurringBill(id: string, orgId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(recurringBills)
    .where(and(eq(recurringBills.id, id), eq(recurringBills.orgId, orgId)))
    .limit(1);

  if (!existing) throw new AppError('Recurring bill template not found.', 404);

  await db.delete(recurringBills).where(eq(recurringBills.id, id));
}

export async function generateBillFromTemplate(id: string, orgId: string, userId: string): Promise<any> {
  const [template] = await db
    .select()
    .from(recurringBills)
    .where(and(eq(recurringBills.id, id), eq(recurringBills.orgId, orgId)))
    .limit(1);

  if (!template) throw new AppError('Recurring bill template not found.', 404);
  if (!template.isActive) throw new AppError('Cannot generate a bill from a paused recurring template.', 400);

  const tpl: any = template.template || {};
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + (tpl.paymentTerms || 30));

  const bill = await createBill(
    {
      orgId,
      vendorId: template.vendorId,
      date: today.toISOString(),
      dueDate: dueDate.toISOString(),
      status: tpl.autoSend ? 'approved' : 'draft',
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
    .update(recurringBills)
    .set({ nextRunDate: newNextRunDate })
    .where(eq(recurringBills.id, id));

  return bill;
}

export async function runDueRecurringBills(orgId?: string): Promise<any[]> {
  const conditions = [eq(recurringBills.isActive, true), lte(recurringBills.nextRunDate, new Date())];
  if (orgId) conditions.push(eq(recurringBills.orgId, orgId));

  const due = await db
    .select()
    .from(recurringBills)
    .where(and(...conditions));

  const generated = [];
  for (const template of due) {
    if (template.endDate && new Date(template.endDate) < new Date()) {
      await db.update(recurringBills).set({ isActive: false }).where(eq(recurringBills.id, template.id));
      continue;
    }
    try {
      const bill = await generateBillFromTemplate(template.id, template.orgId, template.createdBy);
      generated.push(bill);
    } catch (err) {
      continue;
    }
  }

  return generated;
}
