import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db, accounts, taxConfigurations, capitalAllowanceSchedule, taxLosses, taxComputations, payeSchedules, payeScheduleLines, itfAssessments, stampDutyRecords, taxExemptions, firsReports, autoTaxJournals } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { createAuditLog, extractReqMeta } from '../services/audit.service';
import {
  classifyCompany,
  computeAssessableProfit,
  computeTax,
  getGrossTurnover,
  getCapitalAllowancesTotal,
  postTaxJournalEntries,
} from '../services/tax.service';
import {
  createPayeSchedule, getPayeSchedules, getPayeScheduleLines, postPayeJournal,
  createItfAssessment, getItfAssessments, postItfJournal,
  recordStampDuty, getStampDutyRecords, getStampDutySummary,
  createTaxExemption, getTaxExemptions, updateTaxExemptionStatus,
  generateFirsReport, getFirsReports, fileFirsReport,
  recordAutoTaxJournal, getAutoTaxJournals,
  getTaxDashboardSummary,
} from '../services/statutory.service';

const router = Router();

router.use(authenticate);
router.use(requireOrg);

// GET /tax/configuration — load tax config for the current year
router.get('/configuration', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const taxYear = (req.query.taxYear as string) || new Date().getFullYear().toString();

    let [config] = await db
      .select()
      .from(taxConfigurations)
      .where(and(eq(taxConfigurations.orgId, orgId), eq(taxConfigurations.taxYear, taxYear)))
      .limit(1);

    if (!config) {
      const turnover = await getGrossTurnover(orgId, new Date(`${taxYear}-01-01`), new Date(`${taxYear}-12-31`));
      const sizeClass = await classifyCompany(orgId, turnover);
      config = {
        id: '',
        orgId,
        taxYear,
        sizeClass,
        incorporationDate: null,
        fiscalYearEnd: 'Dec 31',
        pioneerStatus: false,
        pioneerStartDate: null,
        pioneerEndDate: null,
        minimumTaxExemptReason: null,
        nitdaApplicable: false,
        pptApplicable: false,
        exportExemption: false,
        agriculturalExemption: false,
        foreignEquityExemption: false,
        firstFourYearsExemption: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return res.json(config);
  } catch (err) {
    next(err);
  }
});

// PUT /tax/configuration — save tax config
router.put('/configuration', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const body = z.object({
      taxYear: z.string(),
      sizeClass: z.enum(['small', 'medium', 'large']).optional(),
      incorporationDate: z.string().nullable().optional(),
      fiscalYearEnd: z.string().optional(),
      pioneerStatus: z.boolean().optional(),
      pioneerStartDate: z.string().nullable().optional(),
      pioneerEndDate: z.string().nullable().optional(),
      minimumTaxExemptReason: z.string().nullable().optional(),
      nitdaApplicable: z.boolean().optional(),
      pptApplicable: z.boolean().optional(),
      exportExemption: z.boolean().optional(),
      agriculturalExemption: z.boolean().optional(),
      foreignEquityExemption: z.boolean().optional(),
      firstFourYearsExemption: z.boolean().optional(),
    }).parse(req.body);

    const existing = await db
      .select()
      .from(taxConfigurations)
      .where(and(eq(taxConfigurations.orgId, orgId), eq(taxConfigurations.taxYear, body.taxYear)))
      .limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(taxConfigurations)
        .set({ ...body, incorporationDate: body.incorporationDate ? new Date(body.incorporationDate) : null, pioneerStartDate: body.pioneerStartDate ? new Date(body.pioneerStartDate) : null, updatedAt: new Date() } as any)
        .where(and(eq(taxConfigurations.orgId, orgId), eq(taxConfigurations.taxYear, body.taxYear)))
        .returning();
    } else {
      [result] = await db
        .insert(taxConfigurations)
        .values({ orgId, ...body } as any)
        .returning();
    }

    await createAuditLog({
      orgId,
      userId,
      action: existing.length > 0 ? 'update' : 'create',
      entityType: 'tax-configuration',
      entityId: result.id,
      newValues: body,
      ...extractReqMeta(req),
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /tax/compute — run tax computation (idempotent read)
router.get('/compute', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { taxYear, startDate, endDate } = z.object({
      taxYear: z.string().optional().default(new Date().getFullYear().toString()),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).parse(req.query);

    const defaultStart = `${taxYear}-01-01`;
    const defaultEnd = `${taxYear}-12-31`;
    const sDate = new Date(startDate || defaultStart);
    const eDate = new Date(endDate || defaultEnd);

    const [config] = await db
      .select()
      .from(taxConfigurations)
      .where(and(eq(taxConfigurations.orgId, orgId), eq(taxConfigurations.taxYear, taxYear)))
      .limit(1);

    const turnover = await getGrossTurnover(orgId, sDate, eDate);
    const sizeClass = config?.sizeClass || await classifyCompany(orgId, turnover);

    const result = await computeTax(orgId, sDate, eDate, taxYear, {
      sizeClass,
      nitdaApplicable: config?.nitdaApplicable || false,
      minimumTaxExemptReason: config?.minimumTaxExemptReason,
      firstFourYearsExemption: config?.firstFourYearsExemption || false,
      agriculturalExemption: config?.agriculturalExemption || false,
      foreignEquityExemption: config?.foreignEquityExemption || false,
      exportExemption: config?.exportExemption || false,
    });

    const apResult = await computeAssessableProfit(orgId, sDate, eDate, taxYear);

    return res.json({
      ...result,
      sizeClass,
      periodStart: sDate.toISOString(),
      periodEnd: eDate.toISOString(),
      addbackDetails: {
        depreciation: apResult.addbacks,
        penalties: 0,
        donations: 0,
        provisions: 0,
        total: apResult.addbacks,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /tax/post — post computed tax JEs to ledger
router.post('/post', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const body = z.object({
      taxYear: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      confirmed: z.boolean().default(true),
    }).parse(req.body);

    const sDate = new Date(body.startDate);
    const eDate = new Date(body.endDate);

    const [config] = await db
      .select()
      .from(taxConfigurations)
      .where(and(eq(taxConfigurations.orgId, orgId), eq(taxConfigurations.taxYear, body.taxYear)))
      .limit(1);

    const turnover = await getGrossTurnover(orgId, sDate, eDate);
    const sizeClass = config?.sizeClass || await classifyCompany(orgId, turnover);

    const computation = await computeTax(orgId, sDate, eDate, body.taxYear, {
      sizeClass,
      nitdaApplicable: config?.nitdaApplicable || false,
      minimumTaxExemptReason: config?.minimumTaxExemptReason,
      firstFourYearsExemption: config?.firstFourYearsExemption || false,
      agriculturalExemption: config?.agriculturalExemption || false,
      foreignEquityExemption: config?.foreignEquityExemption || false,
      exportExemption: config?.exportExemption || false,
    });

    const [taxComp] = await db
      .insert(taxComputations)
      .values({
        orgId,
        taxYear: body.taxYear,
        periodStart: sDate,
        periodEnd: eDate,
        grossTurnover: computation.grossTurnover,
        accountingPBT: computation.accountingPBT,
        totalAddbacks: computation.addbacks,
        totalDeductions: computation.capitalAllowances + computation.lossesBroughtForward,
        assessableProfit: computation.assessableProfit,
        citRate: computation.citRate.toString(),
        citFromProfits: computation.citFromProfits,
        minimumTax: computation.minimumTax,
        citPayable: computation.citPayable,
        edtPayable: computation.edtPayable,
        cgtPayable: computation.cgtPayable,
        nitdaLevy: computation.nitdaLevy,
        deferredTaxCharge: computation.deferredTaxCharge,
        totalTaxExpense: computation.totalTaxExpense,
        whtCreditsApplied: computation.whtCreditsApplied,
        netCitPayable: computation.netCitPayable,
        status: 'draft',
      })
      .returning();

    const je = await postTaxJournalEntries(orgId, userId, eDate, body.taxYear, computation, taxComp.id);

    await createAuditLog({
      orgId,
      userId,
      action: 'create',
      entityType: 'tax-computation',
      entityId: taxComp.id,
      newValues: { ...computation, journalEntryId: je.id },
      ...extractReqMeta(req),
    });

    return res.status(201).json({
      taxComputation: taxComp,
      journalEntry: je,
      computation,
    });
  } catch (err) {
    next(err);
  }
});

// GET /tax/capital-allowances — list schedule
router.get('/capital-allowances', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const taxYear = (req.query.taxYear as string) || new Date().getFullYear().toString();

    const items = await db
      .select()
      .from(capitalAllowanceSchedule)
      .where(and(eq(capitalAllowanceSchedule.orgId, orgId), eq(capitalAllowanceSchedule.taxYear, taxYear)))
      .orderBy(desc(capitalAllowanceSchedule.createdAt));

    return res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /tax/capital-allowances — add/edit
router.post('/capital-allowances', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const body = z.object({
      id: z.string().uuid().optional(),
      taxYear: z.string(),
      assetName: z.string().min(1),
      assetClass: z.enum(['industrial_building', 'non_industrial_building', 'plant_machinery_general', 'plant_machinery_agric', 'motor_vehicle', 'furniture_fittings', 'computer_it_equipment', 'intangible_asset']),
      costPrice: z.number(),
      purchaseDate: z.string(),
      initialAllowanceRate: z.number().optional(),
      annualAllowanceRate: z.number().optional(),
    }).parse(req.body);

    const rates: Record<string, { initial: number; annual: number }> = {
      industrial_building:      { initial: 0.15, annual: 0.10 },
      non_industrial_building:  { initial: 0,    annual: 0 },
      plant_machinery_general:  { initial: 0.50, annual: 0.25 },
      plant_machinery_agric:    { initial: 0.95, annual: 0 },
      motor_vehicle:            { initial: 0.50, annual: 0.25 },
      furniture_fittings:       { initial: 0.25, annual: 0.20 },
      computer_it_equipment:    { initial: 0.50, annual: 0.25 },
      intangible_asset:         { initial: 0,    annual: 0 },
    };

    const initialRate = body.initialAllowanceRate ?? rates[body.assetClass]?.initial ?? 0;
    const annualRate = body.annualAllowanceRate ?? rates[body.assetClass]?.annual ?? 0;
    const initialAmount = Math.round(body.costPrice * initialRate);
    const openingWDV = body.costPrice - initialAmount;
    const annualAmount = Math.round(openingWDV * annualRate);
    const closingWDV = openingWDV - annualAmount;

    let result;
    if (body.id) {
      [result] = await db
        .update(capitalAllowanceSchedule)
        .set({
          assetName: body.assetName,
          assetClass: body.assetClass as any,
          costPrice: body.costPrice,
          purchaseDate: new Date(body.purchaseDate),
          initialAllowanceRate: initialRate.toString(),
          initialAllowanceAmount: initialAmount,
          openingWDV,
          annualAllowanceRate: annualRate.toString(),
          annualAllowanceAmount: annualAmount,
          closingWDV,
          updatedAt: new Date(),
        })
        .where(and(eq(capitalAllowanceSchedule.id, body.id), eq(capitalAllowanceSchedule.orgId, orgId)))
        .returning();
    } else {
      [result] = await db
        .insert(capitalAllowanceSchedule)
        .values({
          orgId,
          taxYear: body.taxYear,
          assetName: body.assetName,
          assetClass: body.assetClass as any,
          costPrice: body.costPrice,
          purchaseDate: new Date(body.purchaseDate),
          initialAllowanceRate: initialRate.toString(),
          initialAllowanceAmount: initialAmount,
          openingWDV,
          annualAllowanceRate: annualRate.toString(),
          annualAllowanceAmount: annualAmount,
          closingWDV,
        })
        .returning();
    }

    return res.status(body.id ? 200 : 201).json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /tax/capital-allowances/:id
router.delete('/capital-allowances/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params; // no id validation needed

    await db
      .delete(capitalAllowanceSchedule)
      .where(and(eq(capitalAllowanceSchedule.id, id), eq(capitalAllowanceSchedule.orgId, orgId)));

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /tax/losses — list tax losses
router.get('/losses', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const items = await db
      .select()
      .from(taxLosses)
      .where(eq(taxLosses.orgId, orgId))
      .orderBy(desc(taxLosses.createdAt));

    return res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /tax/schedule — full computation schedule data
router.get('/schedule', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const items = await db
      .select()
      .from(taxComputations)
      .where(eq(taxComputations.orgId, orgId))
      .orderBy(desc(taxComputations.createdAt));

    return res.json(items);
  } catch (err) {
    next(err);
  }
});

// ==============================
// TAX ENGINE — NEW ENDPOINTS
// ==============================

// GET /tax/dashboard — consolidated tax dashboard summary
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await getTaxDashboardSummary(req.user!.orgId!);
    return res.json(summary);
  } catch (err) { return next(err); }
});

// --- PAYE Schedules ---

router.get('/paye-schedules', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { return res.json(await getPayeSchedules(req.user!.orgId!)); } catch (err) { return next(err); }
});

router.get('/paye-schedules/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { return res.json(await getPayeScheduleLines(req.params.id)); } catch (err) { return next(err); }
});

router.post('/paye-schedules', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      periodStart: z.string(), periodEnd: z.string(),
      payrollRunId: z.string().uuid().optional(),
      entries: z.array(z.object({ employeeId: z.string().uuid(), grossPay: z.number(), basicSalary: z.number().optional() })),
    }).parse(req.body);
    const result = await createPayeSchedule(req.user!.orgId!, req.user!.userId!, body, extractReqMeta(req));
    return res.status(201).json(result);
  } catch (err) { return next(err); }
});

router.post('/paye-schedules/:id/post', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ date: z.string(), bankAccountId: z.string().uuid().optional() }).parse(req.body);
    const result = await postPayeJournal(req.user!.orgId!, req.user!.userId!, req.params.id, body, extractReqMeta(req));
    return res.json(result);
  } catch (err) { return next(err); }
});

// --- ITF Assessments ---

router.get('/itf-assessments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { return res.json(await getItfAssessments(req.user!.orgId!)); } catch (err) { return next(err); }
});

router.post('/itf-assessments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ assessmentYear: z.string(), totalPayroll: z.number() }).parse(req.body);
    const result = await createItfAssessment(req.user!.orgId!, req.user!.userId!, body, extractReqMeta(req));
    return res.status(201).json(result);
  } catch (err) { return next(err); }
});

router.post('/itf-assessments/:id/post', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ date: z.string() }).parse(req.body);
    const result = await postItfJournal(req.user!.orgId!, req.user!.userId!, req.params.id, body, extractReqMeta(req));
    return res.json(result);
  } catch (err) { return next(err); }
});

// --- Stamp Duty ---

router.get('/stamp-duty', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toDate } = req.query as any;
    return res.json(await getStampDutyRecords(req.user!.orgId!, { fromDate, toDate }));
  } catch (err) { return next(err); }
});

router.get('/stamp-duty/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toDate } = req.query as any;
    return res.json(await getStampDutySummary(req.user!.orgId!, fromDate, toDate));
  } catch (err) { return next(err); }
});

router.post('/stamp-duty', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      transactionType: z.string(), grossAmount: z.number(), date: z.string(),
      referenceType: z.string().optional(), referenceId: z.string().uuid().optional(),
    }).parse(req.body);
    const result = await recordStampDuty(req.user!.orgId!, req.user!.userId!, body, extractReqMeta(req));
    return res.status(201).json(result);
  } catch (err) { return next(err); }
});

// --- Tax Exemptions ---

router.get('/exemptions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { taxType, status } = req.query as any;
    return res.json(await getTaxExemptions(req.user!.orgId!, { taxType, status }));
  } catch (err) { return next(err); }
});

router.post('/exemptions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      taxType: z.enum(['vat','wht','cit','paye','itf','cgt','edt','stamp_duty','nhf','nsitf','all']),
      exemptionType: z.string(), referenceNumber: z.string().optional(),
      startDate: z.string(), endDate: z.string().optional(),
      certificateUrl: z.string().optional(), description: z.string().optional(),
    }).parse(req.body);
    const result = await createTaxExemption(req.user!.orgId!, req.user!.userId!, body, extractReqMeta(req));
    return res.status(201).json(result);
  } catch (err) { return next(err); }
});

router.patch('/exemptions/:id/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = z.object({ status: z.enum(['active','expired','revoked']) }).parse(req.body);
    const result = await updateTaxExemptionStatus(req.params.id, req.user!.orgId!, status, extractReqMeta(req));
    return res.json(result);
  } catch (err) { return next(err); }
});

// --- FIRS Reports ---

router.get('/firs-reports', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { reportType } = req.query as any;
    return res.json(await getFirsReports(req.user!.orgId!, { reportType }));
  } catch (err) { return next(err); }
});

router.post('/firs-reports/generate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      reportType: z.enum(['vat','wht','cit','paye','itf','nsitf','nhf','cgt','edt','stamp_duty','consolidated']),
      periodStart: z.string(), periodEnd: z.string(), taxYear: z.string().optional(),
    }).parse(req.body);
    const result = await generateFirsReport(req.user!.orgId!, req.user!.userId!, body, extractReqMeta(req));
    return res.status(201).json(result);
  } catch (err) { return next(err); }
});

router.post('/firs-reports/:id/file', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await fileFirsReport(req.params.id, req.user!.orgId!, req.user!.userId!, extractReqMeta(req));
    return res.json(result);
  } catch (err) { return next(err); }
});

// --- Auto Tax Journals ---

router.get('/auto-journals', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { taxType, fromDate, toDate } = req.query as any;
    return res.json(await getAutoTaxJournals(req.user!.orgId!, { taxType, fromDate, toDate }));
  } catch (err) { return next(err); }
});

export default router;
