import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db, accounts, journalEntries, journalLines, vatPeriods, vatReturnLines, bankAccounts, organisations } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { createJournalEntry } from '../services/ledger.service';
import { createAuditLog, extractReqMeta } from '../services/audit.service';

const router = Router();

router.use(authenticate);
router.use(requireOrg);

// GET /vat/return — compute VAT return for a period
router.get('/return', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { startDate, endDate } = z.object({
      startDate: z.string().min(1),
      endDate: z.string().min(1),
    }).parse(req.query);

    // Resolve VAT accounts
    const [outputVatAcct] = await db
      .select().from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'vat_payable')))
      .limit(1);
    const [inputVatAcct] = await db
      .select().from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'vat_receivable')))
      .limit(1);

    if (!outputVatAcct || !inputVatAcct) {
      throw new AppError('VAT accounts (301300/101600) not configured.', 500);
    }

    // Output VAT = sum(credit) - sum(debit) on 301300 for period
    const [outputResult] = await db
      .select({
        totalVat: sql<number>`coalesce(sum(${journalLines.creditAmount}) - sum(${journalLines.debitAmount}), 0)`
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(
        eq(journalLines.accountId, outputVatAcct.id),
        eq(journalEntries.orgId, orgId),
        sql`${journalEntries.date} >= ${startDate}::date`,
        sql`${journalEntries.date} <= ${endDate}::date`
      ));

    // Input VAT = sum(debit) - sum(credit) on 101600 for period
    const [inputResult] = await db
      .select({
        totalVat: sql<number>`coalesce(sum(${journalLines.debitAmount}) - sum(${journalLines.creditAmount}), 0)`
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(
        eq(journalLines.accountId, inputVatAcct.id),
        eq(journalEntries.orgId, orgId),
        sql`${journalEntries.date} >= ${startDate}::date`,
        sql`${journalEntries.date} <= ${endDate}::date`
      ));

    // Also get standard-rated sales revenue lines (output VAT related)
    const [outputLines] = await db
      .select({
        count: sql<number>`count(*)`,
        totalGross: sql<number>`coalesce(sum(${journalLines.creditAmount}), 0)`
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(
        eq(journalLines.accountId, outputVatAcct.id),
        sql`${journalLines.creditAmount} > 0`,
        eq(journalEntries.orgId, orgId),
        sql`${journalEntries.date} >= ${startDate}::date`,
        sql`${journalEntries.date} <= ${endDate}::date`
      ));

    // Get input VAT lines (debits on 101600)
    const [inputLines] = await db
      .select({
        count: sql<number>`count(*)`,
        totalVat: sql<number>`coalesce(sum(${journalLines.debitAmount}), 0)`
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(
        eq(journalLines.accountId, inputVatAcct.id),
        sql`${journalLines.debitAmount} > 0`,
        eq(journalEntries.orgId, orgId),
        sql`${journalEntries.date} >= ${startDate}::date`,
        sql`${journalEntries.date} <= ${endDate}::date`
      ));

    const totalOutputVat = Number(outputResult?.totalVat || 0);
    const totalInputVat = Number(inputResult?.totalVat || 0);
    const netVat = totalOutputVat - totalInputVat;

    // Get org VAT number
    const [org] = await db
      .select({ vatNumber: organisations.vatNumber })
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1);

    return res.json({
      periodStart: startDate,
      periodEnd: endDate,
      outputVatAccount: outputVatAcct,
      inputVatAccount: inputVatAcct,
      standardRatedSales: { grossAmount: Number(outputLines?.totalGross || 0), vatAmount: totalOutputVat },
      inputPurchases: { grossAmount: Number(inputLines?.totalVat || 0) * 100 / 75, vatAmount: totalInputVat },
      totalOutputVat,
      totalInputVat,
      netVatPayable: netVat > 0 ? netVat : 0,
      netVatRefundable: netVat < 0 ? Math.abs(netVat) : 0,
      orgVatNumber: (org as any)?.vatNumber || '',
    });
  } catch (err) {
    next(err);
  }
});

// POST /vat/settle — post VAT settlement journal for a period
router.post('/settle', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { startDate, endDate, totalOutputVat, totalInputVat, excessInputBroughtForward } = z.object({
      startDate: z.string().min(1),
      endDate: z.string().min(1),
      totalOutputVat: z.number(),
      totalInputVat: z.number(),
      excessInputBroughtForward: z.number().optional().default(0),
    }).parse(req.body);

    const [outputVatAcct] = await db
      .select().from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'vat_payable')))
      .limit(1);
    const [inputVatAcct] = await db
      .select().from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.systemAccountRole, 'vat_receivable')))
      .limit(1);

    if (!outputVatAcct || !inputVatAcct) {
      throw new AppError('VAT accounts not configured.', 500);
    }

    const netVat = totalOutputVat - totalInputVat - excessInputBroughtForward;
    const periodLabel = `${new Date(startDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;

    // Build settlement journal lines
    const lines: any[] = [
      { accountId: outputVatAcct.id, debit: totalOutputVat, credit: 0, description: 'Output VAT cleared on settlement' },
      { accountId: inputVatAcct.id, debit: 0, credit: totalInputVat, description: 'Input VAT cleared on settlement' },
    ];

    if (excessInputBroughtForward > 0) {
      lines.push(
        { accountId: inputVatAcct.id, debit: excessInputBroughtForward, credit: 0, description: 'Excess input brought forward' }
      );
    }

    const [bankAcct] = await db
      .select({ id: bankAccounts.id, accountId: bankAccounts.accountId })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.accountId, sql`${bankAccounts.accountId} IS NOT NULL`)))
      .limit(1);

    if (netVat > 0) {
      // Payable to FIRS — DR 301300, CR 101600, CR Bank
      if (bankAcct?.accountId) {
        lines.push({ accountId: bankAcct.accountId, debit: 0, credit: netVat, description: 'VAT remittance to FIRS' });
      }
    } else if (netVat < 0) {
      // Refundable — carry forward or post to refund receivable
      const excess = Math.abs(netVat);
      lines.push(
        { accountId: inputVatAcct.id, debit: 0, credit: excess, description: 'Excess input VAT carried forward' }
      );
    }

    const je = await createJournalEntry({
      orgId,
      date: new Date(),
      description: `VAT Settlement — ${periodLabel}`,
      source: 'vat_settlement',
      lines,
      createdBy: userId,
      currency: 'NGN',
    });

    // Create/update VAT period record
    const existingPeriod = await db
      .select()
      .from(vatPeriods)
      .where(and(
        eq(vatPeriods.orgId, orgId),
        eq(vatPeriods.periodStart, new Date(startDate)),
      ))
      .limit(1);

    const excessCarriedForward = netVat < 0 ? Math.abs(netVat) - excessInputBroughtForward : 0;

    if (existingPeriod.length > 0) {
      await db.update(vatPeriods)
        .set({
          totalOutputVat,
          totalInputVat,
          netVatPayable: netVat > 0 ? netVat : 0,
          excessInputBroughtForward,
          excessInputCarriedForward: excessCarriedForward > 0 ? excessCarriedForward : 0,
          status: 'filed',
          settlementJournalEntryId: je.id,
          filedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(vatPeriods.id, existingPeriod[0].id));
    } else {
      await db.insert(vatPeriods).values({
        orgId,
        periodStart: new Date(startDate),
        periodEnd: new Date(endDate),
        periodLabel,
        totalOutputVat,
        totalInputVat,
        netVatPayable: netVat > 0 ? netVat : 0,
        excessInputBroughtForward,
        excessInputCarriedForward: excessCarriedForward > 0 ? excessCarriedForward : 0,
        status: 'filed',
        settlementJournalEntryId: je.id,
        filedAt: new Date(),
      });
    }

    createAuditLog({ orgId, userId, action: 'settle', entityType: 'vat-period', newValues: { netVat, periodStart: startDate, periodEnd: endDate }, ...extractReqMeta(req) });
    res.json({ success: true, journalEntry: je, netVat, excessCarriedForward });
  } catch (err) {
    next(err);
  }
});

// GET /vat/periods — list VAT periods
router.get('/periods', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rows = await db
      .select()
      .from(vatPeriods)
      .where(eq(vatPeriods.orgId, orgId))
      .orderBy(sql`${vatPeriods.periodStart} DESC`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /vat/settings — get VAT configuration from org settings
router.get('/settings', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const [org] = await db
      .select({ settings: organisations.settings, vatNumber: organisations.vatNumber })
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1);
    const settings = org ? (typeof (org as any).settings === 'string' ? JSON.parse((org as any).settings) : (org as any).settings || {}) : {};
    const vatSettings = settings.vat || {};
    res.json({
      vatNumber: (org as any)?.vatNumber || vatSettings.vatNumber || '',
      vatRegistered: vatSettings.vatRegistered || false,
      vatRegistrationDate: vatSettings.vatRegistrationDate || null,
      filingFrequency: vatSettings.filingFrequency || 'monthly',
      hasStandardRated: vatSettings.hasStandardRated !== false,
      hasZeroRated: vatSettings.hasZeroRated || false,
      hasExempt: vatSettings.hasExempt || false,
      hasReverseCharge: vatSettings.hasReverseCharge || false,
      taxableTurnover: vatSettings.taxableTurnover || 0,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /vat/settings — update VAT configuration
router.put('/settings', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = z.object({
      vatNumber: z.string().optional(),
      vatRegistered: z.boolean().optional(),
      vatRegistrationDate: z.string().optional(),
      filingFrequency: z.enum(['monthly', 'quarterly']).optional(),
      hasStandardRated: z.boolean().optional(),
      hasZeroRated: z.boolean().optional(),
      hasExempt: z.boolean().optional(),
      hasReverseCharge: z.boolean().optional(),
    }).parse(req.body);

    const [org] = await db
      .select({ settings: organisations.settings })
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1);

    const currentSettings = org?.settings && typeof org.settings === 'object' ? org.settings as any : {};
    const newSettings = {
      ...currentSettings,
      vat: { ...(currentSettings.vat || {}), ...body },
    };

    await db
      .update(organisations)
      .set({ settings: newSettings as any })
      .where(eq(organisations.id, orgId));

    if (body.vatNumber) {
      await db
        .update(organisations)
        .set({ vatNumber: body.vatNumber })
        .where(eq(organisations.id, orgId));
    }

    createAuditLog({ orgId, userId: req.user!.userId!, action: 'update', entityType: 'organisation', entityId: orgId, newValues: { vatSettingsUpdated: true }, ...extractReqMeta(req) });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
