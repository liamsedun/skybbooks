/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { db, accounts, journalEntries, journalLines, contacts, invoices, invoiceLines, bills, billLines, paymentsReceived, paymentAllocations, paymentsMade, paymentMadeAllocations, items, inventoryLots, fixedAssets, depreciationEntries, bankAccounts, expenses, employees, payrollRuns, payrollLines, budgets, budgetLines } from '../db/schema';
import { eq, and, asc, desc, sql, lte, gte, inArray } from 'drizzle-orm';
import { getStatementOfChangesInEquity } from '../services/ledger.service';

const router = Router();

router.use(authenticate);
router.use(requireOrg);

const dateRangeOptionalSchema = z.object({
  startDate: z.string().optional().transform((val) => val ? new Date(val) : new Date(new Date().getFullYear(), 0, 1)),
  endDate: z.string().optional().transform((val) => val ? new Date(val) : new Date()),
});

const dateRangeOptionalNoDefaultSchema = z.object({
  startDate: z.string().optional().transform((val) => val ? new Date(val) : new Date(new Date().getFullYear(), 0, 1)),
  endDate: z.string().optional().transform((val) => val ? new Date(val) : new Date()),
});

const statementQuerySchema = z.object({
  customerId: z.string().uuid('Invalid customer ID').optional(),
  vendorId: z.string().uuid('Invalid vendor ID').optional(),
  startDate: z.string().optional().transform((val) => val ? new Date(val) : new Date(new Date().getFullYear(), 0, 1)),
  endDate: z.string().optional().transform((val) => val ? new Date(val) : new Date()),
});

const asOfDateSchema = z.object({
  asOfDate: z.string().optional().transform((val) => val ? new Date(val) : new Date()),
});

// =========================================================================
// 1. GET /customer-summary
// =========================================================================
router.get('/customer-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const customers = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        phone: contacts.phone,
        totalInvoiced: sql<number>`coalesce(sum(${invoices.total}), 0)`,
        totalPaid: sql<number>`coalesce(sum(${invoices.amountPaid}), 0)`,
        balanceDue: sql<number>`coalesce(sum(${invoices.balanceDue}), 0)`,
        lastInvoiceDate: sql<Date>`max(${invoices.date})`,
        invoiceCount: sql<number>`count(${invoices.id})`,
      })
      .from(contacts)
      .leftJoin(invoices, and(
        eq(invoices.customerId, contacts.id),
        gte(invoices.date, startDate),
        lte(invoices.date, endDate)
      ))
      .where(and(
        eq(contacts.orgId, orgId),
        eq(contacts.type, 'customer')
      ))
      .groupBy(contacts.id)
      .orderBy(asc(contacts.name));

    return res.status(200).json({ success: true, data: customers });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. GET /supplier-summary
// =========================================================================
router.get('/supplier-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const vendors = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        phone: contacts.phone,
        totalBilled: sql<number>`coalesce(sum(${bills.total}), 0)`,
        totalPaid: sql<number>`coalesce(sum(${bills.amountPaid}), 0)`,
        balanceDue: sql<number>`coalesce(sum(${bills.balanceDue}), 0)`,
        lastBillDate: sql<Date>`max(${bills.date})`,
        billCount: sql<number>`count(${bills.id})`,
      })
      .from(contacts)
      .leftJoin(bills, and(
        eq(bills.vendorId, contacts.id),
        gte(bills.date, startDate),
        lte(bills.date, endDate)
      ))
      .where(and(
        eq(contacts.orgId, orgId),
        eq(contacts.type, 'vendor')
      ))
      .groupBy(contacts.id)
      .orderBy(asc(contacts.name));

    return res.status(200).json({ success: true, data: vendors });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. GET /inventory-summary
// =========================================================================
router.get('/inventory-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const inventoryItems = await db
      .select({
        id: items.id,
        name: items.name,
        sku: items.sku,
        type: items.type,
        unit: items.unit,
        salesPrice: items.salesPrice,
        purchasePrice: items.purchasePrice,
        trackInventory: items.trackInventory,
      })
      .from(items)
      .where(and(
        eq(items.orgId, orgId),
        eq(items.trackInventory, true)
      ))
      .orderBy(asc(items.name));

    const result = [];
    for (const item of inventoryItems) {
      const [lotResult] = await db
        .select({
          quantity: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
          avgCost: sql<number>`coalesce(avg(${inventoryLots.costPerUnit}), 0)`,
        })
        .from(inventoryLots)
        .where(eq(inventoryLots.itemId, item.id));

      const quantity = Number(lotResult?.quantity || 0);
      const avgCost = Number(lotResult?.avgCost || 0);
      const totalValue = Math.round(quantity * avgCost);

      result.push({
        id: item.id,
        name: item.name,
        sku: item.sku,
        type: item.type,
        unit: item.unit,
        quantity,
        unitPrice: item.purchasePrice || avgCost,
        totalValue,
        category: item.type,
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 4. GET /customer-statements
// =========================================================================
router.get('/customer-statements', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { customerId, startDate, endDate } = statementQuerySchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const whereCustomer = customerId
      ? eq(contacts.id, customerId)
      : undefined;

    const customers = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        phone: contacts.phone,
        balance: contacts.balance,
      })
      .from(contacts)
      .where(and(
        eq(contacts.orgId, orgId),
        eq(contacts.type, 'customer'),
        ...(whereCustomer ? [whereCustomer] : [])
      ))
      .orderBy(asc(contacts.name));

    const result = [];
    for (const c of customers) {
      const invList = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          date: invoices.date,
          dueDate: invoices.dueDate,
          status: invoices.status,
          total: invoices.total,
          amountPaid: invoices.amountPaid,
          balanceDue: invoices.balanceDue,
        })
        .from(invoices)
        .where(and(
          eq(invoices.customerId, c.id),
          eq(invoices.orgId, orgId),
          gte(invoices.date, startDate),
          lte(invoices.date, endDate)
        ))
        .orderBy(desc(invoices.date));

      result.push({ ...c, invoices: invList });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 5. GET /supplier-statements
// =========================================================================
router.get('/supplier-statements', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { vendorId, startDate, endDate } = statementQuerySchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const whereVendor = vendorId
      ? eq(contacts.id, vendorId)
      : undefined;

    const vendors = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        phone: contacts.phone,
        balance: contacts.balance,
      })
      .from(contacts)
      .where(and(
        eq(contacts.orgId, orgId),
        eq(contacts.type, 'vendor'),
        ...(whereVendor ? [whereVendor] : [])
      ))
      .orderBy(asc(contacts.name));

    const result = [];
    for (const v of vendors) {
      const billList = await db
        .select({
          id: bills.id,
          billNumber: bills.billNumber,
          date: bills.date,
          dueDate: bills.dueDate,
          status: bills.status,
          total: bills.total,
          amountPaid: bills.amountPaid,
          balanceDue: bills.balanceDue,
        })
        .from(bills)
        .where(and(
          eq(bills.vendorId, v.id),
          eq(bills.orgId, orgId),
          gte(bills.date, startDate),
          lte(bills.date, endDate)
        ))
        .orderBy(desc(bills.date));

      result.push({ ...v, bills: billList });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 6. GET /sales-by-customer
// =========================================================================
router.get('/sales-by-customer', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const data = await db
      .select({
        customerId: invoices.customerId,
        customerName: contacts.name,
        customerEmail: contacts.email,
        totalAmount: sql<number>`coalesce(sum(${invoices.total}), 0)`,
        invoiceCount: sql<number>`count(${invoices.id})`,
      })
      .from(invoices)
      .innerJoin(contacts, eq(invoices.customerId, contacts.id))
      .where(and(
        eq(invoices.orgId, orgId),
        gte(invoices.date, startDate),
        lte(invoices.date, endDate)
      ))
      .groupBy(invoices.customerId, contacts.name, contacts.email)
      .orderBy(desc(sql`coalesce(sum(${invoices.total}), 0)`));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 7. GET /sales-by-item
// =========================================================================
router.get('/sales-by-item', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const data = await db
      .select({
        itemId: invoiceLines.itemId,
        itemName: items.name,
        itemSku: items.sku,
        totalQuantity: sql<string>`coalesce(sum(${invoiceLines.quantity}), '0')`,
        totalAmount: sql<number>`coalesce(sum(${invoiceLines.lineTotal}), 0)`,
        lineCount: sql<number>`count(${invoiceLines.id})`,
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
      .leftJoin(items, eq(invoiceLines.itemId, items.id))
      .where(and(
        eq(invoices.orgId, orgId),
        gte(invoices.date, startDate),
        lte(invoices.date, endDate),
        sql`${invoiceLines.itemId} is not null`
      ))
      .groupBy(invoiceLines.itemId, items.name, items.sku)
      .orderBy(desc(sql`coalesce(sum(${invoiceLines.lineTotal}), 0)`));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 8. GET /fixed-asset-summary
// =========================================================================
router.get('/fixed-asset-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const data = await db
      .select({
        id: fixedAssets.id,
        name: fixedAssets.name,
        category: fixedAssets.category,
        assetNumber: fixedAssets.assetNumber,
        purchaseDate: fixedAssets.purchaseDate,
        purchaseCost: fixedAssets.purchaseCost,
        accumulatedDepreciation: fixedAssets.accumulatedDepreciation,
        bookValue: fixedAssets.bookValue,
        depreciationMethod: fixedAssets.depreciationMethod,
        usefulLifeMonths: fixedAssets.usefulLifeMonths,
        residualValue: fixedAssets.residualValue,
        status: fixedAssets.status,
      })
      .from(fixedAssets)
      .where(eq(fixedAssets.orgId, orgId))
      .orderBy(asc(fixedAssets.name));

    const result = data.map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      assetNumber: a.assetNumber,
      purchaseDate: a.purchaseDate,
      purchasePrice: a.purchaseCost,
      accumulatedDepreciation: a.accumulatedDepreciation,
      netBookValue: a.bookValue,
      depreciationMethod: a.depreciationMethod,
      usefulLifeMonths: a.usefulLifeMonths,
      residualValue: a.residualValue,
      status: a.status,
    }));

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 9. GET /expense-claims-summary
// =========================================================================
router.get('/expense-claims-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const data = await db
      .select({
        id: expenses.id,
        expenseNumber: expenses.expenseNumber,
        date: expenses.date,
        description: expenses.description,
        accountId: expenses.accountId,
        accountCode: accounts.code,
        accountName: accounts.name,
        amount: expenses.amount,
        taxAmount: expenses.taxAmount,
        status: sql<string>`'paid'`,
        vendorId: expenses.vendorId,
        vendorName: contacts.name,
        paymentMethod: expenses.paymentMethod,
        reference: expenses.reference,
      })
      .from(expenses)
      .leftJoin(accounts, eq(expenses.accountId, accounts.id))
      .leftJoin(contacts, eq(expenses.vendorId, contacts.id))
      .where(and(
        eq(expenses.orgId, orgId),
        gte(expenses.date, startDate),
        lte(expenses.date, endDate)
      ))
      .orderBy(desc(expenses.date));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 10. GET /employee-summary
// =========================================================================
router.get('/employee-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const data = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        middleName: employees.middleName,
        lastName: employees.lastName,
        fullName: sql<string>`concat(${employees.firstName}, ' ', coalesce(${employees.middleName} || ' ', ''), ${employees.lastName})`,
        department: employees.department,
        staffId: employees.staffId,
        email: employees.email,
        phone: employees.phone,
        designation: employees.designation,
        dateHired: employees.dateHired,
        grossSalary: employees.grossSalary,
        isActive: employees.isActive,
      })
      .from(employees)
      .where(eq(employees.orgId, orgId))
      .orderBy(asc(employees.firstName));

    const result = [];
    for (const e of data) {
      const [payResult] = await db
        .select({
          count: sql<number>`count(*)`,
          lastPayDate: sql<Date>`max(${payrollRuns.payDate})`,
        })
        .from(payrollLines)
        .innerJoin(payrollRuns, eq(payrollLines.runId, payrollRuns.id))
        .where(and(
          eq(payrollLines.employeeId, e.id),
          eq(payrollRuns.orgId, orgId)
        ));

      result.push({
        id: e.id,
        name: e.fullName,
        department: e.department,
        staffId: e.staffId,
        email: e.email,
        phone: e.phone,
        designation: e.designation,
        dateHired: e.dateHired,
        grossSalary: e.grossSalary,
        isActive: e.isActive,
        totalPayslips: Number(payResult?.count || 0),
        lastPayDate: payResult?.lastPayDate || null,
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 11. GET /tax-summary
// =========================================================================
router.get('/tax-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const [vatPayableAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'vat_payable')))
      .limit(1);

    const [vatReceivableAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'vat_receivable')))
      .limit(1);

    const [whtReceivableAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'wht_receivable')))
      .limit(1);

    const [whtPayableAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'wht_payable')))
      .limit(1);

    const [payePayableAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'paye_payable')))
      .limit(1);

    let totalOutputVat = 0;
    if (vatPayableAccount) {
      const [row] = await db
        .select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)` })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(
          eq(journalLines.accountId, vatPayableAccount.id),
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, endDate),
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        ));
      totalOutputVat = Number(row?.total || 0);
    }

    let totalInputVat = 0;
    if (vatReceivableAccount) {
      const [row] = await db
        .select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)` })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(
          eq(journalLines.accountId, vatReceivableAccount.id),
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, endDate),
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        ));
      totalInputVat = Number(row?.total || 0);
    }

    let totalWhtDeducted = 0;
    if (whtReceivableAccount) {
      const [row] = await db
        .select({ total: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)` })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(
          eq(journalLines.accountId, whtReceivableAccount.id),
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, endDate),
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        ));
      totalWhtDeducted = Number(row?.total || 0);
    }

    let totalWhtPayable = 0;
    if (whtPayableAccount) {
      const [row] = await db
        .select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)` })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(
          eq(journalLines.accountId, whtPayableAccount.id),
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, endDate),
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        ));
      totalWhtPayable = Number(row?.total || 0);
    }

    let totalPayeCollected = 0;
    if (payePayableAccount) {
      const [row] = await db
        .select({ total: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)` })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(
          eq(journalLines.accountId, payePayableAccount.id),
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, endDate),
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        ));
      totalPayeCollected = Number(row?.total || 0);
    }

    return res.status(200).json({
      success: true,
      data: {
        totalOutputVat,
        totalInputVat,
        netVat: totalOutputVat - totalInputVat,
        totalWhtDeducted,
        totalWhtPayable,
        totalPayeCollected,
      }
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 12. GET /receipts-payments-summary
// =========================================================================
router.get('/receipts-payments-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const [recvResult] = await db
      .select({
        total: sql<number>`coalesce(sum(${paymentsReceived.amount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(paymentsReceived)
      .where(and(
        eq(paymentsReceived.orgId, orgId),
        gte(paymentsReceived.date, startDate),
        lte(paymentsReceived.date, endDate)
      ));

    const [madeResult] = await db
      .select({
        total: sql<number>`coalesce(sum(${paymentsMade.amount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(paymentsMade)
      .where(and(
        eq(paymentsMade.orgId, orgId),
        gte(paymentsMade.date, startDate),
        lte(paymentsMade.date, endDate)
      ));

    const totalReceipts = Number(recvResult?.total || 0);
    const totalPayments = Number(madeResult?.total || 0);

    return res.status(200).json({
      success: true,
      data: {
        totalReceipts,
        totalPayments,
        netCashFlow: totalReceipts - totalPayments,
        receiptCount: Number(recvResult?.count || 0),
        paymentCount: Number(madeResult?.count || 0),
      }
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 13. GET /bank-account-summary
// =========================================================================
router.get('/bank-account-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const data = await db
      .select({
        id: bankAccounts.id,
        name: bankAccounts.name,
        bankName: bankAccounts.bankName,
        accountNumber: bankAccounts.accountNumber,
        currency: bankAccounts.currency,
        currentBalance: bankAccounts.currentBalance,
        openingBalance: bankAccounts.openingBalance,
        isActive: bankAccounts.isActive,
      })
      .from(bankAccounts)
      .where(and(
        eq(bankAccounts.orgId, orgId),
        eq(bankAccounts.isActive, true)
      ))
      .orderBy(asc(bankAccounts.name));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 14. GET /cash-equivalents
// =========================================================================
router.get('/cash-equivalents', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { asOfDate } = asOfDateSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const [bankResult] = await db
      .select({ total: sql<number>`coalesce(sum(${bankAccounts.currentBalance}), 0)` })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.isActive, true)));

    const bankTotal = Number(bankResult?.total || 0);

    const depositAccounts = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'asset'),
        sql`lower(${accounts.subType}) like '%deposit%'`
      ));

    let depositTotal = 0;
    for (const da of depositAccounts) {
      const [row] = await db
        .select({
          debits: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)`,
          credits: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)`,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(
          eq(journalLines.accountId, da.id),
          eq(journalEntries.orgId, orgId),
          lte(journalEntries.date, asOfDate),
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        ));
      depositTotal += Number(row?.debits || 0) - Number(row?.credits || 0);
    }

    return res.status(200).json({
      success: true,
      data: {
        asOfDate: asOfDate.toISOString(),
        bankAccountBalances: bankTotal,
        depositAccountBalances: depositTotal,
        totalCashEquivalents: bankTotal + depositTotal,
      }
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 15. GET /capital-accounts-summary
// =========================================================================
router.get('/capital-accounts-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const equityAccounts = await db
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        type: accounts.type,
        subType: accounts.subType,
        openingBalance: accounts.openingBalance,
      })
      .from(accounts)
      .where(and(
        eq(accounts.orgId, orgId),
        eq(accounts.type, 'equity')
      ))
      .orderBy(asc(accounts.code));

    const result = [];
    for (const acc of equityAccounts) {
      const [row] = await db
        .select({
          debits: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)`,
          credits: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)`,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(
          eq(journalLines.accountId, acc.id),
          eq(journalEntries.orgId, orgId),
          sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
        ));

      const totalCredits = Number(row?.credits || 0) + Number(acc.openingBalance > 0 ? acc.openingBalance : 0);
      const totalDebits = Number(row?.debits || 0) + Number(acc.openingBalance < 0 ? Math.abs(acc.openingBalance) : 0);
      const balance = totalCredits - totalDebits;

      result.push({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        subType: acc.subType,
        balance,
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 16. GET /payslip-summary
// =========================================================================
router.get('/payslip-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const runs = await db
      .select({ id: payrollRuns.id })
      .from(payrollRuns)
      .where(and(
        eq(payrollRuns.orgId, orgId),
        gte(payrollRuns.payDate, startDate),
        lte(payrollRuns.payDate, endDate)
      ));

    const runIds = runs.map(r => r.id);

    if (runIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalGrossPay: 0,
          totalDeductions: 0,
          totalNetPay: 0,
          payslipCount: 0,
          runCount: 0,
        }
      });
    }

    const [sumResult] = await db
      .select({
        totalGross: sql<number>`coalesce(sum(${payrollLines.grossPay}), 0)`,
        totalPaye: sql<number>`coalesce(sum(${payrollLines.paye}), 0)`,
        totalPension: sql<number>`coalesce(sum(${payrollLines.pensionEmployee}), 0)`,
        totalNhis: sql<number>`coalesce(sum(${payrollLines.nhis}), 0)`,
        totalNhf: sql<number>`coalesce(sum(${payrollLines.nhf}), 0)`,
        totalNet: sql<number>`coalesce(sum(${payrollLines.netPay}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(payrollLines)
      .where(inArray(payrollLines.runId, runIds));

    const totalDeductions = Number(sumResult?.totalPaye || 0)
      + Number(sumResult?.totalPension || 0)
      + Number(sumResult?.totalNhis || 0)
      + Number(sumResult?.totalNhf || 0);

    return res.status(200).json({
      success: true,
      data: {
        totalGrossPay: Number(sumResult?.totalGross || 0),
        totalDeductions,
        totalNetPay: Number(sumResult?.totalNet || 0),
        payslipCount: Number(sumResult?.count || 0),
        runCount: runIds.length,
      }
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 17. GET /payslip-by-item
// =========================================================================
router.get('/payslip-by-item', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const runs = await db
      .select({ id: payrollRuns.id })
      .from(payrollRuns)
      .where(and(
        eq(payrollRuns.orgId, orgId),
        gte(payrollRuns.payDate, startDate),
        lte(payrollRuns.payDate, endDate)
      ));

    const runIds = runs.map(r => r.id);

    if (runIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const [sumResult] = await db
      .select({
        basic: sql<number>`coalesce(sum(${payrollLines.basic}), 0)`,
        housing: sql<number>`coalesce(sum(${payrollLines.housing}), 0)`,
        transport: sql<number>`coalesce(sum(${payrollLines.transport}), 0)`,
        otherAllowances: sql<number>`coalesce(sum(${payrollLines.otherAllowances}), 0)`,
        grossPay: sql<number>`coalesce(sum(${payrollLines.grossPay}), 0)`,
        paye: sql<number>`coalesce(sum(${payrollLines.paye}), 0)`,
        pensionEmployee: sql<number>`coalesce(sum(${payrollLines.pensionEmployee}), 0)`,
        pensionEmployer: sql<number>`coalesce(sum(${payrollLines.pensionEmployer}), 0)`,
        nhf: sql<number>`coalesce(sum(${payrollLines.nhf}), 0)`,
        nhis: sql<number>`coalesce(sum(${payrollLines.nhis}), 0)`,
        otherDeductions: sql<number>`coalesce(sum(${payrollLines.otherDeductions}), 0)`,
        netPay: sql<number>`coalesce(sum(${payrollLines.netPay}), 0)`,
      })
      .from(payrollLines)
      .where(inArray(payrollLines.runId, runIds));

    return res.status(200).json({
      success: true,
      data: {
        earnings: {
          basic: Number(sumResult?.basic || 0),
          housing: Number(sumResult?.housing || 0),
          transport: Number(sumResult?.transport || 0),
          otherAllowances: Number(sumResult?.otherAllowances || 0),
          totalGross: Number(sumResult?.grossPay || 0),
        },
        deductions: {
          paye: Number(sumResult?.paye || 0),
          pensionEmployee: Number(sumResult?.pensionEmployee || 0),
          pensionEmployer: Number(sumResult?.pensionEmployer || 0),
          nhf: Number(sumResult?.nhf || 0),
          nhis: Number(sumResult?.nhis || 0),
          otherDeductions: Number(sumResult?.otherDeductions || 0),
        },
        netPay: Number(sumResult?.netPay || 0),
      }
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 18. GET /actual-vs-budget
// =========================================================================
router.get('/actual-vs-budget', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const orgBudgets = await db
      .select({
        id: budgets.id,
        name: budgets.name,
        fiscalYear: budgets.fiscalYear,
        period: budgets.period,
        status: budgets.status,
      })
      .from(budgets)
      .where(and(eq(budgets.orgId, orgId), eq(budgets.status, 'active')));

    if (orgBudgets.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const result = [];
    for (const b of orgBudgets) {
      const budgetLinesData = await db
        .select({
          id: budgetLines.id,
          accountId: budgetLines.accountId,
          accountCode: accounts.code,
          accountName: accounts.name,
          period: budgetLines.period,
          budgetAmount: budgetLines.amount,
        })
        .from(budgetLines)
        .leftJoin(accounts, eq(budgetLines.accountId, accounts.id))
        .where(eq(budgetLines.budgetId, b.id))
        .orderBy(asc(budgetLines.period));

      for (const bl of budgetLinesData) {
        const [actualRow] = await db
          .select({
            debits: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)`,
            credits: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)`,
          })
          .from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .where(and(
            eq(journalLines.accountId, bl.accountId),
            eq(journalEntries.orgId, orgId),
            gte(journalEntries.date, startDate),
            lte(journalEntries.date, endDate),
            sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
          ));

        const actualNet = Number(actualRow?.credits || 0) - Number(actualRow?.debits || 0);
        const variance = actualNet - Number(bl.budgetAmount || 0);
        const variancePct = Number(bl.budgetAmount) !== 0 ? (variance / Number(bl.budgetAmount)) * 100 : 0;

        result.push({
          budgetId: b.id,
          budgetName: b.name,
          fiscalYear: b.fiscalYear,
          accountId: bl.accountId,
          accountCode: bl.accountCode,
          accountName: bl.accountName,
          period: bl.period,
          budgetAmount: Number(bl.budgetAmount),
          actualAmount: actualNet,
          variance,
          variancePct: Math.round(variancePct * 100) / 100,
        });
      }
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 19. GET /gl-summary
// =========================================================================
router.get('/gl-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const allAccounts = await db
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        type: accounts.type,
        subType: accounts.subType,
        openingBalance: accounts.openingBalance,
      })
      .from(accounts)
      .where(eq(accounts.orgId, orgId))
      .orderBy(asc(accounts.code));

    const result = [];
    for (const acc of allAccounts) {
      const [row] = await db
        .select({
          debits: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)`,
          credits: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)`,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
         .where(and(
           eq(journalLines.accountId, acc.id),
           eq(journalEntries.orgId, orgId),
           gte(journalEntries.date, startDate),
           lte(journalEntries.date, endDate),
           sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
         ));

      const totalDebits = Number(row?.debits || 0);
      const totalCredits = Number(row?.credits || 0);
      const isDebitNormal = ['asset', 'expense'].includes(acc.type);
      const netBalance = isDebitNormal
        ? (acc.openingBalance || 0) + totalDebits - totalCredits
        : (acc.openingBalance || 0) + totalCredits - totalDebits;

      result.push({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        subType: acc.subType,
        openingBalance: acc.openingBalance,
        totalDebits,
        totalCredits,
        netBalance,
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 20. GET /gl-transactions
// =========================================================================
router.get('/gl-transactions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const querySchema = z.object({
      startDate: z.string().optional().transform((val) => val ? new Date(val) : new Date(new Date().getFullYear(), 0, 1)),
      endDate: z.string().optional().transform((val) => val ? new Date(val) : new Date()),
      accountId: z.string().uuid('Invalid account ID').optional(),
    });

    const { startDate, endDate, accountId } = querySchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const whereClauses: any[] = [
      eq(journalEntries.orgId, orgId),
      gte(journalEntries.date, startDate),
      lte(journalEntries.date, endDate),
      sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`,
    ];
    if (accountId) {
      whereClauses.push(eq(journalLines.accountId, accountId));
    }

    const lines = await db
      .select({
        date: journalEntries.date,
        entryNumber: journalEntries.entryNumber,
        description: journalEntries.description,
        accountCode: accounts.code,
        accountName: accounts.name,
        debitAmount: journalLines.debitAmount,
        creditAmount: journalLines.creditAmount,
        source: journalEntries.source,
        currency: journalLines.currency,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(...whereClauses))
      .orderBy(desc(journalEntries.date), asc(journalEntries.entryNumber))
      .limit(5000);

    return res.status(200).json({ success: true, data: lines });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 21. GET /tax-transactions
// =========================================================================
router.get('/tax-transactions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const taxRoles = ['wht_receivable', 'wht_payable', 'vat_receivable', 'vat_payable', 'paye_payable'];

    const taxAccounts = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name, role: accounts.systemAccountRole })
      .from(accounts)
      .where(and(
        eq(accounts.orgId, orgId),
        inArray(accounts.systemAccountRole, taxRoles as any)
      ));

    const taxAccountIds = taxAccounts.map(a => a.id);

    if (taxAccountIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const lines = await db
      .select({
        date: journalEntries.date,
        entryNumber: journalEntries.entryNumber,
        description: journalEntries.description,
        accountName: accounts.name,
        accountCode: accounts.code,
        accountRole: accounts.systemAccountRole,
        debitAmount: journalLines.debitAmount,
        creditAmount: journalLines.creditAmount,
        source: journalEntries.source,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(
        eq(journalEntries.orgId, orgId),
        inArray(journalLines.accountId, taxAccountIds),
        gte(journalEntries.date, startDate),
        lte(journalEntries.date, endDate),
        sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`
      ))
      .orderBy(desc(journalEntries.date), asc(journalEntries.entryNumber))
      .limit(5000);

    return res.status(200).json({ success: true, data: lines });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 22. GET /taxable-sales-per-customer
// =========================================================================
router.get('/taxable-sales-per-customer', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const data = await db
      .select({
        customerId: invoices.customerId,
        customerName: contacts.name,
        customerEmail: contacts.email,
        totalTaxableAmount: sql<number>`coalesce(sum(${invoices.subtotal}), 0)`,
        totalInvoiceAmount: sql<number>`coalesce(sum(${invoices.total}), 0)`,
        invoiceCount: sql<number>`count(*)`,
      })
      .from(invoices)
      .innerJoin(contacts, eq(invoices.customerId, contacts.id))
      .where(and(
        eq(invoices.orgId, orgId),
        sql`${invoices.taxAmount} > 0`,
        gte(invoices.date, startDate),
        lte(invoices.date, endDate)
      ))
      .groupBy(invoices.customerId, contacts.name, contacts.email)
      .orderBy(desc(sql`coalesce(sum(${invoices.subtotal}), 0)`));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 23. GET /taxable-purchases-per-supplier
// =========================================================================
router.get('/taxable-purchases-per-supplier', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;

    const data = await db
      .select({
        vendorId: bills.vendorId,
        vendorName: contacts.name,
        vendorEmail: contacts.email,
        totalTaxableAmount: sql<number>`coalesce(sum(${bills.subtotal}), 0)`,
        totalBillAmount: sql<number>`coalesce(sum(${bills.total}), 0)`,
        billCount: sql<number>`count(*)`,
      })
      .from(bills)
      .innerJoin(contacts, eq(bills.vendorId, contacts.id))
      .where(and(
        eq(bills.orgId, orgId),
        sql`${bills.taxAmount} > 0`,
        gte(bills.date, startDate),
        lte(bills.date, endDate)
      ))
      .groupBy(bills.vendorId, contacts.name, contacts.email)
      .orderBy(desc(sql`coalesce(sum(${bills.subtotal}), 0)`));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 24. GET /fixed-asset-depreciation
// =========================================================================
router.get('/fixed-asset-depreciation', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const assets = await db
      .select({
        id: fixedAssets.id,
        name: fixedAssets.name,
        category: fixedAssets.category,
        assetNumber: fixedAssets.assetNumber,
        purchaseDate: fixedAssets.purchaseDate,
        purchaseCost: fixedAssets.purchaseCost,
        accumulatedDepreciation: fixedAssets.accumulatedDepreciation,
        bookValue: fixedAssets.bookValue,
        depreciationMethod: fixedAssets.depreciationMethod,
        usefulLifeMonths: fixedAssets.usefulLifeMonths,
        residualValue: fixedAssets.residualValue,
        status: fixedAssets.status,
      })
      .from(fixedAssets)
      .where(eq(fixedAssets.orgId, orgId))
      .orderBy(asc(fixedAssets.name));

    const result = assets.map(a => {
      const depreciableAmount = a.purchaseCost - a.residualValue;
      const depreciationPerPeriod = a.usefulLifeMonths > 0
        ? Math.round(depreciableAmount / a.usefulLifeMonths)
        : 0;
      const remainingLifeMonths = a.usefulLifeMonths > 0 && depreciationPerPeriod > 0
        ? Math.round((a.depreciationMethod === 'straight_line'
          ? (a.purchaseCost - a.residualValue - a.accumulatedDepreciation)
          : a.bookValue) / depreciationPerPeriod)
        : 0;

      return {
        id: a.id,
        name: a.name,
        category: a.category,
        assetNumber: a.assetNumber,
        purchaseDate: a.purchaseDate,
        purchaseCost: a.purchaseCost,
        residualValue: a.residualValue,
        accumulatedDepreciation: a.accumulatedDepreciation,
        netBookValue: a.bookValue,
        depreciationMethod: a.depreciationMethod,
        usefulLifeMonths: a.usefulLifeMonths,
        depreciationPerPeriod,
        remainingLifeMonths: Math.max(0, remainingLifeMonths),
        status: a.status,
      };
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 25. GET /intangible-assets-summary
// =========================================================================
router.get('/intangible-assets-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    return res.status(200).json({
      success: true,
      data: [],
      note: 'Intangible assets module is not yet implemented. No intangible_assets table exists in the schema.'
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 26. GET /intangible-asset-amortization
// =========================================================================
router.get('/intangible-asset-amortization', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    return res.status(200).json({
      success: true,
      data: [],
      note: 'Intangible assets module is not yet implemented. No intangible_assets table exists in the schema.'
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 27. GET /changes-in-equity — Statement of Changes in Equity (SOCIE)
// =========================================================================
router.get('/changes-in-equity', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeOptionalSchema.parse(req.query);
    const orgId = req.user!.orgId!;
    const data = await getStatementOfChangesInEquity(orgId, endDate);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
