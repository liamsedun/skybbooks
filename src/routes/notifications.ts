import { Router, Response, NextFunction } from 'express';
import { and, eq, lt, gt, sql, desc } from 'drizzle-orm';
import { db, invoices, bills, payrollRuns, bankTransactions, items, inventoryLots, auditLog, contacts, bankAccounts } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

interface NotificationItem {
  id: string;
  icon: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  link: string;
  timestamp: string;
}

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const notifications: NotificationItem[] = [];
    const now = new Date();

    // 1. Overdue invoices
    const overdueInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        balanceDue: invoices.balanceDue,
        dueDate: invoices.dueDate,
        customerName: contacts.name,
      })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.customerId, contacts.id))
      .where(and(eq(invoices.orgId, orgId), eq(invoices.status, 'overdue')))
      .limit(10);
    for (const inv of overdueInvoices) {
      notifications.push({
        id: `inv-${inv.id}`,
        icon: '\uD83D\uDCB0',
        message: `Invoice ${inv.invoiceNumber} (${inv.customerName || 'Unknown'}) overdue — ₦${(inv.balanceDue / 100).toLocaleString()}`,
        severity: 'error',
        link: `/sales/invoices`,
        timestamp: inv.dueDate.toISOString(),
      });
    }

    // 2. Overdue bills
    const overdueBills = await db
      .select({
        id: bills.id,
        billNumber: bills.billNumber,
        balanceDue: bills.balanceDue,
        dueDate: bills.dueDate,
        vendorName: contacts.name,
      })
      .from(bills)
      .leftJoin(contacts, eq(bills.vendorId, contacts.id))
      .where(and(eq(bills.orgId, orgId), eq(bills.status, 'overdue')))
      .limit(10);
    for (const bill of overdueBills) {
      notifications.push({
        id: `bill-${bill.id}`,
        icon: '\uD83D\uDCCB',
        message: `Bill ${bill.billNumber} (${bill.vendorName || 'Unknown'}) overdue — ₦${(bill.balanceDue / 100).toLocaleString()}`,
        severity: 'warning',
        link: `/purchases/bills`,
        timestamp: bill.dueDate.toISOString(),
      });
    }

    // 3. Draft payroll runs
    const draftRuns = await db
      .select({ id: payrollRuns.id, runNumber: payrollRuns.runNumber, createdAt: payrollRuns.createdAt })
      .from(payrollRuns)
      .where(and(eq(payrollRuns.orgId, orgId), eq(payrollRuns.status, 'draft')))
      .limit(5);
    for (const run of draftRuns) {
      notifications.push({
        id: `payroll-${run.id}`,
        icon: '\uD83D\uDCB5',
        message: `Payroll run ${run.runNumber} is still in draft — pending approval`,
        severity: 'warning',
        link: `/payroll/runs`,
        timestamp: run.createdAt.toISOString(),
      });
    }

    // 4. Unreconciled bank transactions (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const unreconciledTxns = await db
      .select({ count: sql<number>`count(*)` })
      .from(bankTransactions)
      .where(and(eq(bankTransactions.orgId, orgId), eq(bankTransactions.status, 'unreconciled'), gt(bankTransactions.date, sevenDaysAgo)));
    const unreconciledCount = Number(unreconciledTxns[0]?.count || 0);
    if (unreconciledCount > 0) {
      notifications.push({
        id: 'bank-unreconciled',
        icon: '\uD83C\uDFE6',
        message: `${unreconciledCount} bank transaction(s) from the last 7 days need reconciliation`,
        severity: 'info',
        link: `/banking/reconciliation`,
        timestamp: now.toISOString(),
      });
    }

    // 5. Low stock items (where trackInventory and reorderPoint set, and total lots quantity <= reorderPoint)
    const lowStockItems = await db
      .select({
        id: items.id,
        name: items.name,
        reorderPoint: items.reorderPoint,
        totalQty: sql<string>`COALESCE(SUM(CAST(${inventoryLots.quantity} AS numeric)), '0')`,
      })
      .from(items)
      .leftJoin(inventoryLots, eq(items.id, inventoryLots.itemId))
      .where(and(eq(items.orgId, orgId), eq(items.trackInventory, true), sql`${items.reorderPoint} IS NOT NULL`))
      .groupBy(items.id, items.name, items.reorderPoint)
      .having(sql`COALESCE(SUM(CAST(${inventoryLots.quantity} AS numeric)), 0) <= ${items.reorderPoint}`)
      .limit(10);
    for (const item of lowStockItems) {
      notifications.push({
        id: `inv-${item.id}`,
        icon: '\uD83D\uDCE6',
        message: `Low stock: ${item.name} (${item.totalQty} units remaining, reorder at ${item.reorderPoint})`,
        severity: 'warning',
        link: `/inventory/items`,
        timestamp: now.toISOString(),
      });
    }

    // 6. Recent audit log activity (last 24h count)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentActivity = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLog)
      .where(and(eq(auditLog.orgId, orgId), gt(auditLog.createdAt, oneDayAgo)))
      .limit(1);
    const activityCount = Number(recentActivity[0]?.count || 0);
    if (activityCount > 0) {
      notifications.push({
        id: 'recent-activity',
        icon: '\uD83D\uDD0D',
        message: `${activityCount} accounting event(s) recorded in the last 24 hours`,
        severity: 'info',
        link: `/audit-log`,
        timestamp: now.toISOString(),
      });
    }

    // Sort by timestamp descending (most recent first)
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json(notifications);
  } catch (err) {
    return next(err);
  }
});

export default router;
