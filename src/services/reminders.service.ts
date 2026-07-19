import { and, eq, sql, lte, isNull } from 'drizzle-orm';
import { db } from '../db/schema';
import { organisations } from '../db/schema';
import { invoices, contacts } from '../db/schema';
import { bills } from '../db/schema';
import { sendOrgEmail } from './email.service';

export async function processPaymentReminders(): Promise<number> {
  const orgs = await db.select({ id: organisations.id, settings: organisations.settings }).from(organisations);
  let totalSent = 0;

  for (const org of orgs) {
    const settings = org.settings as any;
    const reminders = settings?.reminders;
    if (!reminders?.enabled) continue;

    const daysOverdue = reminders.daysOverdue ?? 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

    // Invoice reminders (customer → org)
    if (reminders.invoices !== false) {
      const overdueInvoices = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          total: invoices.total,
          dueDate: invoices.dueDate,
          customerName: contacts.name,
          customerEmail: contacts.email,
        })
        .from(invoices)
        .innerJoin(contacts, eq(invoices.customerId, contacts.id))
        .where(
          and(
            eq(invoices.orgId, org.id),
            eq(invoices.status, 'sent'),
            lte(invoices.dueDate, cutoffDate),
            isNull(invoices.lastReminderSentAt),
          )
        );

      for (const inv of overdueInvoices) {
        if (!inv.customerEmail) continue;
        try {
          await sendOrgEmail(org.id, {
            to: inv.customerEmail,
            subject: `Payment Reminder: Invoice ${inv.invoiceNumber} is overdue`,
            html: `
              <h2>Dear ${inv.customerName},</h2>
              <p>This is a reminder that Invoice <strong>${inv.invoiceNumber}</strong> 
              for ₦${(Number(inv.total) / 100).toLocaleString()} was due on 
              ${inv.dueDate.toLocaleDateString()} and is now overdue.</p>
              <p>Please arrange payment at your earliest convenience.</p>
            `,
          });
          await db.update(invoices)
            .set({ lastReminderSentAt: new Date() })
            .where(eq(invoices.id, inv.id));
          totalSent++;
        } catch (err) {
          console.error(`[Reminders] Failed to send invoice reminder ${inv.id}:`, err);
        }
      }
    }

    // Bill reminders (org → vendor) - per org settings, optional
    if (reminders.bills !== false) {
      const overdueBills = await db
        .select({
          id: bills.id,
          billNumber: bills.billNumber,
          total: bills.total,
          dueDate: bills.dueDate,
          vendorName: contacts.name,
          vendorEmail: contacts.email,
        })
        .from(bills)
        .innerJoin(contacts, eq(bills.vendorId, contacts.id))
        .where(
          and(
            eq(bills.orgId, org.id),
            eq(bills.status, 'open'),
            lte(bills.dueDate, cutoffDate),
            isNull(bills.lastReminderSentAt),
          )
        );

      for (const bill of overdueBills) {
        if (!bill.vendorEmail) continue;
        try {
          await sendOrgEmail(org.id, {
            to: bill.vendorEmail,
            subject: `Payment Reminder: Bill ${bill.billNumber} is due`,
            html: `
              <h2>Dear ${bill.vendorName},</h2>
              <p>This is a reminder that Bill <strong>${bill.billNumber}</strong> 
              for ₦${(Number(bill.total) / 100).toLocaleString()} is due on 
              ${bill.dueDate.toLocaleDateString()}.</p>
              <p>Please ensure payment is made on time.</p>
            `,
          });
          await db.update(bills)
            .set({ lastReminderSentAt: new Date() })
            .where(eq(bills.id, bill.id));
          totalSent++;
        } catch (err) {
          console.error(`[Reminders] Failed to send bill reminder ${bill.id}:`, err);
        }
      }
    }
  }

  return totalSent;
}
