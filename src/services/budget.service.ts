import { eq, and, desc, sql } from 'drizzle-orm';
import { db, budgets, budgetLines, budgetForecasts, accounts } from '../db/schema';
import { AppError } from '../lib/errors';

export async function getBudgets(orgId: string, fiscalYear?: number) {
  const conditions: any[] = [eq(budgets.orgId, orgId)];
  if (fiscalYear) conditions.push(eq(budgets.fiscalYear, fiscalYear));
  return await db.select({
    id: budgets.id, name: budgets.name,
    fiscalYear: budgets.fiscalYear, period: budgets.period,
    status: budgets.status, createdAt: budgets.createdAt,
  }).from(budgets).where(and(...conditions)).orderBy(desc(budgets.createdAt));
}

export async function getBudget(id: string, orgId: string) {
  const [budget] = await db.select().from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.orgId, orgId))).limit(1);
  if (!budget) throw new AppError('Budget not found.', 404);
  const lines = await db.select({
    id: budgetLines.id, accountId: budgetLines.accountId,
    accountName: accounts.name, accountCode: accounts.code,
    amount: budgetLines.amount,
  }).from(budgetLines).leftJoin(accounts, eq(budgetLines.accountId, accounts.id))
    .where(eq(budgetLines.budgetId, id));
  return { ...budget, lines };
}

export async function createBudget(orgId: string, data: any) {
  const { lines, ...budgetData } = data;
  return await db.transaction(async (tx) => {
    const [budget] = await tx.insert(budgets).values({ ...budgetData, orgId } as any).returning();
    if (lines?.length) {
      await tx.insert(budgetLines).values(lines.map((l: any) => ({ ...l, budgetId: budget.id })));
    }
    return budget;
  });
}

export async function getForecasts(orgId: string, fiscalYear: number) {
  return await db.select({
    id: budgetForecasts.id, accountId: budgetForecasts.accountId,
    accountName: accounts.name, accountCode: accounts.code,
    month: budgetForecasts.month,
    forecastAmountKobo: budgetForecasts.forecastAmountKobo,
    actualAmountKobo: budgetForecasts.actualAmountKobo,
    method: budgetForecasts.method, confidence: budgetForecasts.confidence,
  }).from(budgetForecasts).leftJoin(accounts, eq(budgetForecasts.accountId, accounts.id))
    .where(and(eq(budgetForecasts.orgId, orgId), eq(budgetForecasts.fiscalYear, fiscalYear)))
    .orderBy(budgetForecasts.month);
}

export async function generateForecast(orgId: string, fiscalYear: number) {
  await db.delete(budgetForecasts).where(and(
    eq(budgetForecasts.orgId, orgId), eq(budgetForecasts.fiscalYear, fiscalYear)
  ));
  const accountBalances = await db.execute(sql`
    SELECT account_id, ABS(SUM(COALESCE(debit,0) - COALESCE(credit,0))) as balance
    FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id
    WHERE je.org_id = ${orgId} AND EXTRACT(YEAR FROM je.date) = ${fiscalYear - 1} AND je.status = 'posted'
    GROUP BY account_id
  `) as any;
  for (const row of accountBalances.rows || []) {
    const monthlyAmount = Math.round(Number(row.balance || 0) / 12);
    for (let m = 1; m <= 12; m++) {
      await db.insert(budgetForecasts).values({
        orgId, accountId: row.account_id, fiscalYear, month: m,
        forecastAmountKobo: monthlyAmount, actualAmountKobo: 0, method: 'linear', confidence: 50,
      } as any);
    }
  }
  return { generated: true };
}
