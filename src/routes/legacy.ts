import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db, legacyIncomeStatements, legacyCashFlowStatements, legacyStatementsOfChangesInEquity } from '../db/schema';
import { AppError } from '../lib/errors';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { createAuditLog, extractReqMeta } from '../services/audit.service';

const router = Router();

router.use(authenticate);
router.use(requireOrg);

// ─── Zod schemas ───

const legacyIncomeStatementSchema = z.object({
  fiscalYear: z.number().int(),
  periodLabel: z.string().min(1),
  currency: z.string().default('NGN'),
  data: z.object({
    revenue: z.number().default(0),
    revenueNote: z.string().optional(),
    costOfSales: z.number().default(0),
    costOfSalesNote: z.string().optional(),
    grossProfit: z.number().default(0),
    otherGainsOrLosses: z.number().default(0),
    otherGainsOrLossesNote: z.string().optional(),
    impairmentOnFinancialAssets: z.number().default(0),
    impairmentOnFinancialAssetsNote: z.string().optional(),
    administrativeExpenses: z.number().default(0),
    administrativeExpensesNote: z.string().optional(),
    operatingProfit: z.number().default(0),
    financeCost: z.number().default(0),
    financeCostNote: z.string().optional(),
    profitBeforeTax: z.number().default(0),
    incomeTax: z.number().default(0),
    incomeTaxNote: z.string().optional(),
    deferredTax: z.number().default(0),
    deferredTaxNote: z.string().optional(),
    profitForTheYear: z.number().default(0),
    ociValuationGainLoss: z.number().default(0),
    ociValuationNote: z.string().optional(),
    ociGrantIncome: z.number().default(0),
    ociGrantNote: z.string().optional(),
    ociNetOfTaxes: z.number().default(0),
    totalComprehensiveIncome: z.number().default(0),
    earningsPerShareKobo: z.number().default(0),
    earningsPerShareNote: z.string().optional(),
    dilutedEarningsPerShare: z.number().default(0),
    dilutedEpsNote: z.string().optional(),
  }),
});

const legacyCashFlowSchema = z.object({
  fiscalYear: z.number().int(),
  periodLabel: z.string().min(1),
  currency: z.string().default('NGN'),
  data: z.object({
    profitBeforeInterestAndTax: z.number().default(0),
    depreciationPPE: z.number().default(0),
    amortization: z.number().default(0),
    decreaseIncreasePrepayments: z.number().default(0),
    decreaseIncreaseReceivables: z.number().default(0),
    increaseDecreasePayables: z.number().default(0),
    increaseDecreaseDeferredIncome: z.number().default(0),
    grantOtherIncome: z.number().default(0),
    provisionForTax: z.number().default(0),
    cashGeneratedFromOperations: z.number().default(0),
    incomeTaxPaid: z.number().default(0),
    netCashFromOperating: z.number().default(0),
    purchaseIntangibleAssets: z.number().default(0),
    purchasePPE: z.number().default(0),
    interestReceived: z.number().default(0),
    proceedsFromSalePPE: z.number().default(0),
    netCashFromInvesting: z.number().default(0),
    shareCapital: z.number().default(0),
    depositForShares: z.number().default(0),
    retainedEarnings: z.number().default(0),
    sharePremium: z.number().default(0),
    revaluation: z.number().default(0),
    dividendsPaid: z.number().default(0),
    netCashFromFinancing: z.number().default(0),
    netIncreaseInCash: z.number().default(0),
    cashAtBeginningOfYear: z.number().default(0),
    cashAtEndOfYear: z.number().default(0),
    cashAtEndOfYearOverride: z.boolean().default(false),
    cashAndBankBalance: z.number().default(0),
    termDeposit: z.number().default(0),
    termLoan: z.number().default(0),
  }),
});

const legacySocieSchema = z.object({
  fiscalYear: z.number().int(),
  periodLabel: z.string().min(1),
  currency: z.string().default('NGN'),
  data: z.object({
    yearLabel: z.string(),
    balanceBf: z.object({
      revaluationSurplus: z.number().default(0),
      shareCapital: z.number().default(0),
      depositForShares: z.number().default(0),
      sharePremium: z.number().default(0),
      retainedEarnings: z.number().default(0),
    }).default({} as any),
    profitForYear: z.object({
      revaluationSurplus: z.number().default(0),
      shareCapital: z.number().default(0),
      depositForShares: z.number().default(0),
      sharePremium: z.number().default(0),
      retainedEarnings: z.number().default(0),
    }).default({} as any),
    eclAdjustments: z.object({
      revaluationSurplus: z.number().default(0),
      shareCapital: z.number().default(0),
      depositForShares: z.number().default(0),
      sharePremium: z.number().default(0),
      retainedEarnings: z.number().default(0),
    }).default({} as any),
    otherChanges: z.object({
      revaluationSurplus: z.number().default(0),
      shareCapital: z.number().default(0),
      depositForShares: z.number().default(0),
      sharePremium: z.number().default(0),
      retainedEarnings: z.number().default(0),
    }).default({} as any),
    priorYearAdjustments: z.object({
      revaluationSurplus: z.number().default(0),
      shareCapital: z.number().default(0),
      depositForShares: z.number().default(0),
      sharePremium: z.number().default(0),
      retainedEarnings: z.number().default(0),
    }).default({} as any),
    transactionsWithOwners: z.object({
      revaluationSurplus: z.number().default(0),
      shareCapital: z.number().default(0),
      depositForShares: z.number().default(0),
      sharePremium: z.number().default(0),
      retainedEarnings: z.number().default(0),
    }).default({} as any),
  }),
});

const unlockSchema = z.object({
  isLocked: z.literal(false),
});

// ─── Helper: fetch org's user list for enteredBy ───
// (userId comes from req.user.userId)

// =========================================================================
// 1. LEGACY INCOME STATEMENTS
// =========================================================================

// List all legacy income statements for the org
router.get('/income-statements', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rows = await db
      .select()
      .from(legacyIncomeStatements)
      .where(eq(legacyIncomeStatements.orgId, orgId))
      .orderBy(legacyIncomeStatements.fiscalYear);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// Get a specific legacy income statement by fiscal year
router.get('/income-statements/:fiscalYear', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const fiscalYear = parseInt(req.params.fiscalYear, 10);
    const [row] = await db
      .select()
      .from(legacyIncomeStatements)
      .where(and(
        eq(legacyIncomeStatements.orgId, orgId),
        eq(legacyIncomeStatements.fiscalYear, fiscalYear)
      ))
      .limit(1);
    if (!row) return res.status(404).json({ success: false, error: 'Legacy income statement not found for this fiscal year.' });
    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

// Create or update a legacy income statement (upsert by orgId + fiscalYear)
router.put('/income-statements/:fiscalYear', requireRole('owner', 'accountant'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const fiscalYear = parseInt(req.params.fiscalYear, 10);
    const body = legacyIncomeStatementSchema.parse({ ...req.body, fiscalYear });

    // Check if a locked record already exists
    const [existing] = await db
      .select()
      .from(legacyIncomeStatements)
      .where(and(
        eq(legacyIncomeStatements.orgId, orgId),
        eq(legacyIncomeStatements.fiscalYear, fiscalYear)
      ))
      .limit(1);

    if (existing && existing.isLocked) {
      throw new AppError('This legacy income statement is locked. Unlock it first to make changes.', 403);
    }

    const data = body.data;

    if (existing) {
      const [updated] = await db
        .update(legacyIncomeStatements)
        .set({
          periodLabel: body.periodLabel,
          currency: body.currency,
          data: data as any,
          enteredBy: userId,
          enteredAt: new Date(),
        })
        .where(eq(legacyIncomeStatements.id, existing.id))
        .returning();
      createAuditLog({ orgId, userId, action: 'update', entityType: 'legacy-income-statement', entityId: existing.id, newValues: { fiscalYear }, ...extractReqMeta(req) });
      return res.status(200).json({ success: true, data: updated });
    }

    const [created] = await db
      .insert(legacyIncomeStatements)
      .values({
        orgId,
        fiscalYear,
        periodLabel: body.periodLabel,
        currency: body.currency,
        data: data as any,
        isLocked: true,
        enteredBy: userId,
      })
      .returning();
    createAuditLog({ orgId, userId, action: 'create', entityType: 'legacy-income-statement', entityId: created.id, newValues: { fiscalYear }, ...extractReqMeta(req) });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    next(error);
  }
});

// Unlock a legacy income statement (only explicit unlock allowed, no silent edits)
router.patch('/income-statements/:fiscalYear/unlock', requireRole('owner', 'accountant'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const fiscalYear = parseInt(req.params.fiscalYear, 10);

    const [existing] = await db
      .select()
      .from(legacyIncomeStatements)
      .where(and(
        eq(legacyIncomeStatements.orgId, orgId),
        eq(legacyIncomeStatements.fiscalYear, fiscalYear)
      ))
      .limit(1);
    if (!existing) throw new AppError('Legacy income statement not found.', 404);
    if (!existing.isLocked) throw new AppError('Already unlocked.', 400);

    const [updated] = await db
      .update(legacyIncomeStatements)
      .set({ isLocked: false, enteredBy: userId, enteredAt: new Date() })
      .where(eq(legacyIncomeStatements.id, existing.id))
      .returning();
    createAuditLog({ orgId, userId, action: 'update', entityType: 'legacy-income-statement', entityId: existing.id, newValues: { isLocked: false }, ...extractReqMeta(req) });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. LEGACY CASH FLOW STATEMENTS
// =========================================================================

router.get('/cash-flow-statements', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rows = await db
      .select()
      .from(legacyCashFlowStatements)
      .where(eq(legacyCashFlowStatements.orgId, orgId))
      .orderBy(legacyCashFlowStatements.fiscalYear);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/cash-flow-statements/:fiscalYear', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const fiscalYear = parseInt(req.params.fiscalYear, 10);
    const [row] = await db
      .select()
      .from(legacyCashFlowStatements)
      .where(and(
        eq(legacyCashFlowStatements.orgId, orgId),
        eq(legacyCashFlowStatements.fiscalYear, fiscalYear)
      ))
      .limit(1);
    if (!row) return res.status(404).json({ success: false, error: 'Legacy cash flow statement not found.' });
    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

router.put('/cash-flow-statements/:fiscalYear', requireRole('owner', 'accountant'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const fiscalYear = parseInt(req.params.fiscalYear, 10);
    const body = legacyCashFlowSchema.parse({ ...req.body, fiscalYear });

    const [existing] = await db
      .select()
      .from(legacyCashFlowStatements)
      .where(and(
        eq(legacyCashFlowStatements.orgId, orgId),
        eq(legacyCashFlowStatements.fiscalYear, fiscalYear)
      ))
      .limit(1);

    if (existing && existing.isLocked) {
      throw new AppError('This legacy cash flow statement is locked. Unlock it first to make changes.', 403);
    }

    if (existing) {
      const [updated] = await db
        .update(legacyCashFlowStatements)
        .set({
          periodLabel: body.periodLabel,
          currency: body.currency,
          data: body.data as any,
          enteredBy: userId,
          enteredAt: new Date(),
        })
        .where(eq(legacyCashFlowStatements.id, existing.id))
        .returning();
      createAuditLog({ orgId, userId, action: 'update', entityType: 'legacy-cash-flow-statement', entityId: existing.id, newValues: { fiscalYear }, ...extractReqMeta(req) });
      return res.status(200).json({ success: true, data: updated });
    }

    const [created] = await db
      .insert(legacyCashFlowStatements)
      .values({
        orgId,
        fiscalYear,
        periodLabel: body.periodLabel,
        currency: body.currency,
        data: body.data as any,
        isLocked: true,
        enteredBy: userId,
      })
      .returning();
    createAuditLog({ orgId, userId, action: 'create', entityType: 'legacy-cash-flow-statement', entityId: created.id, newValues: { fiscalYear }, ...extractReqMeta(req) });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    next(error);
  }
});

router.patch('/cash-flow-statements/:fiscalYear/unlock', requireRole('owner', 'accountant'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const fiscalYear = parseInt(req.params.fiscalYear, 10);

    const [existing] = await db
      .select()
      .from(legacyCashFlowStatements)
      .where(and(
        eq(legacyCashFlowStatements.orgId, orgId),
        eq(legacyCashFlowStatements.fiscalYear, fiscalYear)
      ))
      .limit(1);
    if (!existing) throw new AppError('Legacy cash flow statement not found.', 404);
    if (!existing.isLocked) throw new AppError('Already unlocked.', 400);

    const [updated] = await db
      .update(legacyCashFlowStatements)
      .set({ isLocked: false, enteredBy: userId, enteredAt: new Date() })
      .where(eq(legacyCashFlowStatements.id, existing.id))
      .returning();
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. LEGACY STATEMENTS OF CHANGES IN EQUITY
// =========================================================================

router.get('/statements-of-changes-in-equity', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rows = await db
      .select()
      .from(legacyStatementsOfChangesInEquity)
      .where(eq(legacyStatementsOfChangesInEquity.orgId, orgId))
      .orderBy(legacyStatementsOfChangesInEquity.fiscalYear);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/statements-of-changes-in-equity/:fiscalYear', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const fiscalYear = parseInt(req.params.fiscalYear, 10);
    const [row] = await db
      .select()
      .from(legacyStatementsOfChangesInEquity)
      .where(and(
        eq(legacyStatementsOfChangesInEquity.orgId, orgId),
        eq(legacyStatementsOfChangesInEquity.fiscalYear, fiscalYear)
      ))
      .limit(1);
    if (!row) return res.status(404).json({ success: false, error: 'Legacy SOCIE not found.' });
    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

router.put('/statements-of-changes-in-equity/:fiscalYear', requireRole('owner', 'accountant'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const fiscalYear = parseInt(req.params.fiscalYear, 10);
    const body = legacySocieSchema.parse({ ...req.body, fiscalYear });

    const [existing] = await db
      .select()
      .from(legacyStatementsOfChangesInEquity)
      .where(and(
        eq(legacyStatementsOfChangesInEquity.orgId, orgId),
        eq(legacyStatementsOfChangesInEquity.fiscalYear, fiscalYear)
      ))
      .limit(1);

    if (existing && existing.isLocked) {
      throw new AppError('This legacy SOCIE is locked. Unlock it first to make changes.', 403);
    }

    if (existing) {
      const [updated] = await db
        .update(legacyStatementsOfChangesInEquity)
        .set({
          periodLabel: body.periodLabel,
          currency: body.currency,
          data: body.data as any,
          enteredBy: userId,
          enteredAt: new Date(),
        })
        .where(eq(legacyStatementsOfChangesInEquity.id, existing.id))
        .returning();
      return res.status(200).json({ success: true, data: updated });
    }

    const [created] = await db
      .insert(legacyStatementsOfChangesInEquity)
      .values({
        orgId,
        fiscalYear,
        periodLabel: body.periodLabel,
        currency: body.currency,
        data: body.data as any,
        isLocked: true,
        enteredBy: userId,
      })
      .returning();
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    next(error);
  }
});

router.patch('/statements-of-changes-in-equity/:fiscalYear/unlock', requireRole('owner', 'accountant'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const fiscalYear = parseInt(req.params.fiscalYear, 10);

    const [existing] = await db
      .select()
      .from(legacyStatementsOfChangesInEquity)
      .where(and(
        eq(legacyStatementsOfChangesInEquity.orgId, orgId),
        eq(legacyStatementsOfChangesInEquity.fiscalYear, fiscalYear)
      ))
      .limit(1);
    if (!existing) throw new AppError('Legacy SOCIE not found.', 404);
    if (!existing.isLocked) throw new AppError('Already unlocked.', 400);

    const [updated] = await db
      .update(legacyStatementsOfChangesInEquity)
      .set({ isLocked: false, enteredBy: userId, enteredAt: new Date() })
      .where(eq(legacyStatementsOfChangesInEquity.id, existing.id))
      .returning();
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
