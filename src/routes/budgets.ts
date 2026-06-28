import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, budgets, budgetLines, accounts } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, desc } from 'drizzle-orm';
import { AppError } from '../lib/errors';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const budgetLineSchema = z.object({
  accountId: z.string().uuid(),
  period: z.number().int().min(1).max(12),
  amount: z.number().int(),
});

const budgetSchema = z.object({
  name: z.string().min(1),
  fiscalYear: z.number().int(),
  period: z.enum(['monthly', 'quarterly', 'annual']),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  lines: z.array(budgetLineSchema).optional(),
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(budgets)
      .where(eq(budgets.orgId, orgId))
      .orderBy(desc(budgets.createdAt));
    return res.status(200).json(list);
  } catch (err) { return next(err); }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [budget] = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.orgId, orgId)))
      .limit(1);
    if (!budget) throw new AppError('Budget not found.', 404);
    const lines = await db
      .select()
      .from(budgetLines)
      .where(eq(budgetLines.budgetId, id));
    return res.status(200).json({ ...budget, lines });
  } catch (err) { return next(err); }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.id!;
    const body = budgetSchema.parse(req.body);

    const [budget] = await db
      .insert(budgets)
      .values({
        orgId,
        name: body.name,
        fiscalYear: body.fiscalYear,
        period: body.period,
        status: body.status || 'draft',
        createdBy: userId,
      })
      .returning();

    if (body.lines && body.lines.length > 0) {
      await db.insert(budgetLines).values(
        body.lines.map(l => ({
          budgetId: budget.id,
          accountId: l.accountId,
          period: l.period,
          amount: l.amount,
        }))
      );
    }

    const lines = body.lines || [];
    return res.status(201).json({ ...budget, lines });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = budgetSchema.partial().parse(req.body);

    const [budget] = await db
      .update(budgets)
      .set(body)
      .where(and(eq(budgets.id, id), eq(budgets.orgId, orgId)))
      .returning();
    if (!budget) throw new AppError('Budget not found.', 404);

    if (body.lines) {
      await db.delete(budgetLines).where(eq(budgetLines.budgetId, id));
      if (body.lines.length > 0) {
        await db.insert(budgetLines).values(
          body.lines.map(l => ({
            budgetId: id,
            accountId: l.accountId,
            period: l.period,
            amount: l.amount,
          }))
        );
      }
    }

    const lines = body.lines || [];
    return res.status(200).json({ ...budget, lines });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    await db.delete(budgetLines).where(eq(budgetLines.budgetId, id));
    const [budget] = await db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.orgId, orgId)))
      .returning();
    if (!budget) throw new AppError('Budget not found.', 404);
    return res.status(200).json({ message: 'Budget deleted.' });
  } catch (err) { return next(err); }
});

// CSV import for budgets
router.post('/import-csv', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.id!;
    const { csvData } = req.body;
    if (!csvData || typeof csvData !== 'string' || !csvData.trim()) {
      throw new AppError('CSV data is required.', 400);
    }

    const cleaned = csvData.replace(/^\uFEFF/, '').replace(/\r$/, '');
    const lines = cleaned.split(/\n/).filter(Boolean);
    if (lines.length < 2) throw new AppError('CSV must have a header row and at least one data row.', 400);

    function parseCsvLine(line: string): string[] {
      const fields: string[] = []; let current = ''; let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) { if (ch === '"') { if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; } } else { current += ch; } }
        else { if (ch === '"') { inQuotes = true; } else if (ch === ',') { fields.push(current.trim()); current = ''; } else { current += ch; } }
      }
      fields.push(current.trim()); return fields;
    }

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
    const dataRows = lines.slice(1).map(l => parseCsvLine(l));

    const nameIdx = headers.findIndex(h => h === 'name');
    const yearIdx = headers.findIndex(h => h === 'fiscalyear' || h === 'fiscal_year' || h === 'year');
    const periodIdx = headers.findIndex(h => h === 'period');
    const lineAccIdx = headers.findIndex(h => h === 'line_accountcode' || h === 'line_account_code' || h === 'accountcode');
    const linePeriodIdx = headers.findIndex(h => h === 'line_period (1-12)' || h === 'line_period' || h === 'period (1-12)');
    const lineAmountIdx = headers.findIndex(h => h === 'line_amount (ngn)' || h === 'line_amount' || h === 'amount (ngn)');

    if (nameIdx === -1 || yearIdx === -1 || periodIdx === -1 || lineAccIdx === -1 || lineAmountIdx === -1) {
      throw new AppError('CSV must contain "name", "fiscalYear", "period", "line_accountCode", and "line_amount (NGN)" columns.', 400);
    }

    const allAccounts = await db.select().from(accounts).where(eq(accounts.orgId, orgId));
    const codeToId = new Map(allAccounts.map(a => [a.code, a.id]));

    // Group by budget name
    const groups = new Map<string, { name: string; fiscalYear: number; period: 'monthly' | 'quarterly' | 'annual'; lines: { accountId: string; period: number; amount: number }[] }>();
    const errors: string[] = [];
    let totalCreated = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const name = row[nameIdx]?.trim();
      if (!name) { errors.push(`Row ${i + 2}: missing name`); continue; }

      const fiscalYear = parseInt(row[yearIdx]?.trim() || '0');
      if (!fiscalYear) { errors.push(`Row ${i + 2}: invalid fiscalYear`); continue; }

      const periodVal = row[periodIdx]?.trim().toLowerCase();
      if (!['monthly', 'quarterly', 'annual'].includes(periodVal)) { errors.push(`Row ${i + 2}: period must be monthly/quarterly/annual`); continue; }

      const accountCode = row[lineAccIdx]?.trim();
      if (!accountCode) { errors.push(`Row ${i + 2}: missing line_accountCode`); continue; }

      const accountId = codeToId.get(accountCode);
      if (!accountId) { errors.push(`Row ${i + 2}: account code "${accountCode}" not found`); continue; }

      const linePeriod = linePeriodIdx >= 0 ? parseInt(row[linePeriodIdx]?.trim() || '1') : 1;
      const amount = Math.round(parseFloat(row[lineAmountIdx]?.replace(/[₦,]/g, '') || '0') * 100);

      const key = `${name}::${fiscalYear}::${periodVal}`;
      if (!groups.has(key)) {
        groups.set(key, { name, fiscalYear, period: periodVal as 'monthly' | 'quarterly' | 'annual', lines: [] });
      }
      groups.get(key)!.lines.push({ accountId, period: linePeriod, amount });
    }

    for (const [, group] of groups) {
      const [budget] = await db
        .insert(budgets)
        .values({ orgId, name: group.name, fiscalYear: group.fiscalYear, period: group.period, status: 'draft', createdBy: userId })
        .returning();

      if (group.lines.length > 0) {
        await db.insert(budgetLines).values(
          group.lines.map(l => ({ budgetId: budget.id, accountId: l.accountId, period: l.period, amount: l.amount }))
        );
      }
      totalCreated++;
    }

    return res.status(201).json({
      success: true,
      message: `Imported ${totalCreated} budget(s) successfully.`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

export default router;
