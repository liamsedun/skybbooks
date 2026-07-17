/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { and, eq, sql, gte, lte, inArray, desc } from 'drizzle-orm';
import { db, groups, groupMembers, intercompanyTransactions, intercompanyEliminations, groupConsolidationRuns, organisations } from '../db/schema';
import { AppError } from '../lib/errors';
import { getTrialBalance, getBalanceSheet, getProfitAndLoss, getCashFlowStatement } from './ledger.service';

export function calculateNci(totalEquity: number, ownershipPercentage: number): number {
  const parentShare = ownershipPercentage / 100;
  const nciShare = 1 - parentShare;
  return Math.round(totalEquity * nciShare);
}

export async function performCurrencyTranslation(
  orgId: string,
  reportData: any,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  method: 'closing_rate' | 'average_rate' | 'historical_rate'
): Promise<any> {
  if (!reportData || rate <= 0 || fromCurrency === toCurrency) {
    return reportData;
  }

  const translateValue = (val: number | undefined | null): number => {
    if (val == null) return 0;
    return Math.round(val * rate);
  };

  const deepTranslate = (obj: any): any => {
    if (obj == null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(deepTranslate);
    }
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'number') {
        result[key] = translateValue(value);
      } else if (typeof value === 'object') {
        result[key] = deepTranslate(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  // Determine the translation method based on section type
  // BS items -> closing rate, P&L items -> average rate, equity -> historical rate
  if (method === 'closing_rate') {
    // Balance Sheet translation: all items at closing rate
    return deepTranslate(reportData);
  }

  if (method === 'average_rate') {
    // P&L translation: all items at average rate
    return deepTranslate(reportData);
  }

  // historical_rate: for equity items
  return deepTranslate(reportData);
}

export async function runConsolidation(
  params: {
    groupId: string;
    reportType: 'balance_sheet' | 'profit_and_loss' | 'cash_flow' | 'trial_balance';
    periodStart: Date;
    periodEnd: Date;
    asOfDate?: Date;
    includesEliminations?: boolean;
    includesNci?: boolean;
    currencyTranslationMethod?: 'closing_rate' | 'average_rate' | 'historical_rate';
  },
  userId: string
) {
  const { groupId, reportType, periodStart, periodEnd, asOfDate, includesEliminations, includesNci, currencyTranslationMethod } = params;

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  // 1. Get all active group members
  const activeMembers = await db
    .select()
    .from(groupMembers)
    .where(and(
      eq(groupMembers.groupId, groupId),
      sql`(${groupMembers.endDate} IS NULL OR ${groupMembers.endDate} >= ${periodEnd})`
    ));

  if (activeMembers.length === 0) {
    throw new AppError('No active members found in this group', 400);
  }

  // 2. Separate parent from subsidiaries
  const parentMember = activeMembers.find(m => m.isParent === true);

  // 3. Get the group's base currency
  const groupCurrency = group.baseCurrency || 'NGN';

  // 4. Collect all org IDs
  const memberOrgIds = activeMembers.map(m => m.orgId);

  // 5. Fetch org details (base currency, etc.)
  const orgs = await db
    .select()
    .from(organisations)
    .where(inArray(organisations.id, memberOrgIds));

  const orgMap = new Map(orgs.map(o => [o.id, o]));

  const consolidated: any = {
    groupId,
    groupName: group.name,
    reportType,
    periodStart,
    periodEnd,
    asOfDate: asOfDate || periodEnd,
    groupCurrency,
    parentOrgId: parentMember?.orgId || null,
    totalOrgs: activeMembers.length,
    includesEliminations: includesEliminations ?? true,
    includesNci: includesNci ?? true,
    currencyTranslationMethod: currencyTranslationMethod || 'closing_rate',
    orgContributions: [] as any[],
    consolidatedData: null as any,
  };

  try {
    // 6. Fetch report data for each org
    const orgDataMap = new Map<string, any>();

    for (const member of activeMembers) {
      const org = orgMap.get(member.orgId);
      if (!org) continue;

      let reportData: any;

      switch (reportType) {
        case 'balance_sheet': {
          const bsDate = asOfDate || periodEnd;
          reportData = await getBalanceSheet(member.orgId, bsDate);
          break;
        }
        case 'profit_and_loss': {
          reportData = await getProfitAndLoss(member.orgId, periodStart, periodEnd);
          break;
        }
        case 'cash_flow': {
          reportData = await getCashFlowStatement(member.orgId, periodStart, periodEnd);
          break;
        }
        case 'trial_balance': {
          reportData = await getTrialBalance(member.orgId, periodStart, periodEnd);
          break;
        }
      }

      // 7. Currency translation if needed
      if (org.baseCurrency && org.baseCurrency !== groupCurrency && currencyTranslationMethod && reportData) {
        const rate = 1; // In production, fetch from fx rates table
        reportData = await performCurrencyTranslation(
          member.orgId,
          reportData,
          org.baseCurrency,
          groupCurrency,
          rate,
          currencyTranslationMethod
        );
      }

      orgDataMap.set(member.orgId, {
        member,
        org,
        reportData,
        ownershipPercentage: parseFloat(member.ownershipPercentage || '100'),
        consolidationMethod: member.consolidationMethod || 'full',
      });
    }

    // 8. Apply eliminations if requested
    let eliminationsData: any[] = [];
    if (includesEliminations) {
      const eliminations = await db
        .select()
        .from(intercompanyEliminations)
        .where(and(
          eq(intercompanyEliminations.groupId, groupId),
          gte(intercompanyEliminations.periodStart, periodStart),
          lte(intercompanyEliminations.periodEnd, periodEnd)
        ));

      // Also find matched IC transactions to eliminate
      const matchedTxns = await db
        .select()
        .from(intercompanyTransactions)
        .where(and(
          eq(intercompanyTransactions.groupId, groupId),
          eq(intercompanyTransactions.status, 'matched' as any),
          gte(intercompanyTransactions.date, periodStart),
          lte(intercompanyTransactions.date, periodEnd)
        ));

      eliminationsData = [...eliminations, ...matchedTxns.map(t => ({
        id: t.id,
        groupId: t.groupId,
        fromOrgId: t.fromOrgId,
        toOrgId: t.toOrgId,
        amount: t.amount,
        currency: t.currency,
        description: `Elimination: ${t.description}`,
      }))];
    }

    // 9. Aggregate report data
    let aggregatedData: any;

    if (reportType === 'trial_balance') {
      aggregatedData = aggregateTrialBalances(orgDataMap, eliminationsData, parentMember);
    } else if (reportType === 'balance_sheet') {
      aggregatedData = aggregateBalanceSheets(orgDataMap, eliminationsData, parentMember);
    } else if (reportType === 'profit_and_loss') {
      aggregatedData = aggregatePnLs(orgDataMap, eliminationsData, parentMember);
    } else if (reportType === 'cash_flow') {
      aggregatedData = aggregateCashFlows(orgDataMap, eliminationsData, parentMember);
    }

    // 10. Calculate NCI
    let nciValue = 0;
    if (includesNci && parentMember) {
      for (const [orgId, data] of orgDataMap.entries()) {
        if (orgId === parentMember.orgId) continue;

        // Calculate NCI based on subsidiary equity
        const ownership = data.ownershipPercentage;
        if (ownership > 0 && ownership < 100) {
          let subsidiaryEquity = 0;

          if (reportType === 'balance_sheet' && data.reportData?.equity?.total) {
            subsidiaryEquity = data.reportData.equity.total;
          } else if (data.reportData?.totalEquity) {
            subsidiaryEquity = data.reportData.totalEquity;
          }

          const nciForOrg = calculateNci(subsidiaryEquity, ownership);
          nciValue += nciForOrg;

          data.nciAmount = nciForOrg;
        }
      }
    }

    // 11. Store contribution details for each org
    for (const [orgId, data] of orgDataMap.entries()) {
      consolidated.orgContributions.push({
        orgId,
        orgName: data.org?.name || orgId,
        baseCurrency: data.org?.baseCurrency || 'NGN',
        isParent: data.member?.isParent || false,
        consolidationMethod: data.consolidationMethod,
        ownershipPercentage: data.ownershipPercentage,
        nciAmount: data.nciAmount || 0,
      });
    }

    consolidated.consolidatedData = aggregatedData;
    consolidated.nciTotal = nciValue;
    consolidated.eliminationCount = eliminationsData.length;

    // 12. Store in groupConsolidationRuns table
    const [runRecord] = await db
      .insert(groupConsolidationRuns)
      .values({
        groupId,
        reportType,
        periodStart,
        periodEnd,
        asOfDate: asOfDate || periodEnd,
        status: 'completed',
        includesEliminations: includesEliminations ?? true,
        includesNci: includesNci ?? true,
        currencyTranslationMethod: currencyTranslationMethod || 'closing_rate',
        totalOrgs: activeMembers.length,
        resultData: aggregatedData,
        createdBy: userId,
      })
      .returning();

    return {
      ...consolidated,
      id: runRecord.id,
      createdAt: runRecord.createdAt,
    };
  } catch (err: any) {
    // Store failed run attempt
    await db
      .insert(groupConsolidationRuns)
      .values({
        groupId,
        reportType,
        periodStart,
        periodEnd,
        asOfDate: asOfDate || periodEnd,
        status: 'failed',
        includesEliminations: includesEliminations ?? true,
        includesNci: includesNci ?? true,
        currencyTranslationMethod: currencyTranslationMethod || 'closing_rate',
        totalOrgs: activeMembers.length,
        errorMessage: err.message || 'Unknown error during consolidation',
        createdBy: userId,
      })
      .returning();

    throw new AppError(`Consolidation failed: ${err.message}`, 500);
  }
}

function aggregateTrialBalances(
  orgDataMap: Map<string, any>,
  eliminations: any[],
  parentMember: any
): any {
  const accountMap = new Map<string, {
    accountCode: string;
    accountName: string;
    accountType: string;
    totalOpeningDebit: number;
    totalOpeningCredit: number;
    totalPeriodDebit: number;
    totalPeriodCredit: number;
    totalClosingDebit: number;
    totalClosingCredit: number;
    orgContributions: string[];
  }>();

  // Build elimination amount map by org pair
  const elimMap = new Map<string, number>();
  for (const elim of eliminations) {
    const key = `${elim.fromOrgId}-${elim.toOrgId}`;
    const existing = elimMap.get(key) || 0;
    elimMap.set(key, existing + (elim.amount || 0));
  }

  for (const [orgId, data] of orgDataMap.entries()) {
    const rows = data.reportData;
    if (!Array.isArray(rows)) continue;

    const ownership = data.ownershipPercentage / 100;
    const isParent = data.member?.isParent || false;
    const method = data.consolidationMethod;

    // For equity method, only include ownership share
    const inclusionFactor = method === 'equity' ? ownership : 1;

    for (const row of rows) {
      const key = row.accountCode || row.accountId;
      const existing = accountMap.get(key) || {
        accountCode: row.accountCode,
        accountName: row.accountName,
        accountType: row.accountType,
        totalOpeningDebit: 0,
        totalOpeningCredit: 0,
        totalPeriodDebit: 0,
        totalPeriodCredit: 0,
        totalClosingDebit: 0,
        totalClosingCredit: 0,
        orgContributions: [] as string[],
      };

      const od = Math.round((row.openingDebit || 0) * inclusionFactor);
      const oc = Math.round((row.openingCredit || 0) * inclusionFactor);
      const pd = Math.round((row.periodDebit || 0) * inclusionFactor);
      const pc = Math.round((row.periodCredit || 0) * inclusionFactor);
      const cd = Math.round((row.closingDebit || 0) * inclusionFactor);
      const cc = Math.round((row.closingCredit || 0) * inclusionFactor);

      existing.totalOpeningDebit += od;
      existing.totalOpeningCredit += oc;
      existing.totalPeriodDebit += pd;
      existing.totalPeriodCredit += pc;
      existing.totalClosingDebit += cd;
      existing.totalClosingCredit += cc;
      existing.orgContributions.push(orgId);

      accountMap.set(key, existing);
    }
  }

  // Apply eliminations: find IC accounts and reduce their balances
  const result = Array.from(accountMap.values()).map(a => {
    let adjDr = a.totalClosingDebit;
    let adjCr = a.totalClosingCredit;

    // If this is an IC receivable/payable account, apply eliminations
    const acctCode = a.accountCode || '';
    if (acctCode.startsWith('104') || acctCode.startsWith('304') || acctCode.startsWith('104000') || acctCode.startsWith('304000')) {
      const totalElim = Array.from(elimMap.values()).reduce((sum, v) => sum + v, 0);
      if (acctCode.startsWith('104')) {
        adjDr = Math.max(0, adjDr - totalElim);
      }
      if (acctCode.startsWith('304')) {
        adjCr = Math.max(0, adjCr - totalElim);
      }
    }

    return {
      ...a,
      closingDebit: adjDr,
      closingCredit: adjCr,
      periodDebit: Math.max(0, adjDr - (a.totalOpeningDebit - a.totalOpeningCredit > 0 ? a.totalOpeningDebit - a.totalOpeningCredit : 0)),
      periodCredit: Math.max(0, adjCr - (a.totalOpeningCredit - a.totalOpeningDebit > 0 ? a.totalOpeningCredit - a.totalOpeningDebit : 0)),
    };
  });

  // Calculate totals
  let totalDr = 0;
  let totalCr = 0;
  for (const r of result) {
    totalDr += r.closingDebit;
    totalCr += r.closingCredit;
  }

  return {
    type: 'trial_balance',
    rows: result,
    totalDr,
    totalCr,
    rowCount: result.length,
  };
}

function aggregateBalanceSheets(
  orgDataMap: Map<string, any>,
  eliminations: any[],
  parentMember: any
): any {
  // Deep-merge balance sheet structures
  const merged: any = {
    assets: { total: 0, currentAssets: { total: 0, items: [] }, fixedAssets: { total: 0, items: [] }, otherAssets: { total: 0, items: [] } },
    liabilities: { total: 0, currentLiabilities: { total: 0, items: [] }, nonCurrentLiabilities: { total: 0, items: [] } },
    equity: { total: 0, items: [] },
  };

  // Build elimination map
  const elimMap = new Map<string, number>();
  for (const elim of eliminations) {
    const key = `${elim.fromOrgId}-${elim.toOrgId}`;
    elimMap.set(key, (elimMap.get(key) || 0) + (elim.amount || 0));
  }
  const totalElim = Array.from(elimMap.values()).reduce((s, v) => s + v, 0);

  for (const [orgId, data] of orgDataMap.entries()) {
    const bs = data.reportData;
    if (!bs) continue;

    const isParent = data.member?.isParent || false;
    const method = data.consolidationMethod;
    const ownership = data.ownershipPercentage / 100;
    const inclusionFactor = method === 'equity' ? ownership : 1;

    // Helper to merge deep structure
    const mergeSection = (target: any, source: any, factor: number) => {
      if (!source) return;
      if (typeof source.total === 'number') {
        target.total = (target.total || 0) + Math.round(source.total * factor);
      }
      if (source.items && Array.isArray(source.items)) {
        for (const item of source.items) {
          const existing = target.items?.find((i: any) => i.label === item.label);
          if (existing) {
            existing.value = (existing.value || 0) + Math.round((item.value || 0) * factor);
          } else {
            target.items?.push({ ...item, value: Math.round((item.value || 0) * factor) });
          }
        }
      }
      // Merge sub-sections recursively
      for (const [key, value] of Object.entries(source)) {
        if (key === 'total' || key === 'items') continue;
        if (typeof value === 'object' && value !== null) {
          if (!target[key]) target[key] = { total: 0, items: [] };
          mergeSection(target[key], value, factor);
        }
      }
    };

    if (bs.assets) mergeSection(merged.assets, bs.assets, inclusionFactor);
    if (bs.liabilities) mergeSection(merged.liabilities, bs.liabilities, inclusionFactor);
    if (bs.equity) mergeSection(merged.equity, bs.equity, inclusionFactor);
  }

  // Apply eliminations to IC accounts
  merged.assets.total = Math.max(0, merged.assets.total - totalElim);
  if (merged.assets.currentAssets?.total) {
    merged.assets.currentAssets.total = Math.max(0, merged.assets.currentAssets.total - totalElim);
  }
  merged.liabilities.total = Math.max(0, merged.liabilities.total - totalElim);
  if (merged.liabilities.currentLiabilities?.total) {
    merged.liabilities.currentLiabilities.total = Math.max(0, merged.liabilities.currentLiabilities.total - totalElim);
  }

  return merged;
}

function aggregatePnLs(
  orgDataMap: Map<string, any>,
  eliminations: any[],
  parentMember: any
): any {
  const merged: any = {
    revenue: { total: 0, items: [] },
    costOfSales: { total: 0, items: [] },
    grossProfit: 0,
    expenses: { total: 0, items: [] },
    otherIncome: { total: 0, items: [] },
    otherExpenses: { total: 0, items: [] },
    financeIncome: { total: 0, items: [] },
    financeCost: { total: 0, items: [] },
    netProfit: 0,
  };

  for (const [orgId, data] of orgDataMap.entries()) {
    const pnl = data.reportData;
    if (!pnl) continue;

    const method = data.consolidationMethod;
    const ownership = data.ownershipPercentage / 100;
    const inclusionFactor = method === 'equity' ? ownership : 1;

    const mergeSection = (target: any, source: any, factor: number) => {
      if (!source) return;
      if (typeof source.total === 'number') {
        target.total = (target.total || 0) + Math.round(source.total * factor);
      }
      if (source.items && Array.isArray(source.items)) {
        for (const item of source.items) {
          const existing = target.items.find((i: any) => i.label === item.label);
          if (existing) {
            existing.value = (existing.value || 0) + Math.round((item.value || 0) * factor);
          } else {
            target.items.push({ ...item, value: Math.round((item.value || 0) * factor) });
          }
        }
      }
      for (const [key, value] of Object.entries(source)) {
        if (key === 'total' || key === 'items') continue;
        if (typeof value === 'object' && value !== null) {
          if (!target[key]) target[key] = { total: 0, items: [] };
          mergeSection(target[key], value, factor);
        }
      }
    };

    if (pnl.revenue) mergeSection(merged.revenue, pnl.revenue, inclusionFactor);
    if (pnl.costOfSales) mergeSection(merged.costOfSales, pnl.costOfSales, inclusionFactor);
    if (pnl.expenses) mergeSection(merged.expenses, pnl.expenses, inclusionFactor);
    if (pnl.otherIncome) mergeSection(merged.otherIncome, pnl.otherIncome, inclusionFactor);
    if (pnl.otherExpenses) mergeSection(merged.otherExpenses, pnl.otherExpenses, inclusionFactor);
    if (pnl.financeIncome) mergeSection(merged.financeIncome, pnl.financeIncome, inclusionFactor);
    if (pnl.financeCost) mergeSection(merged.financeCost, pnl.financeCost, inclusionFactor);
  }

  merged.grossProfit = merged.revenue.total - merged.costOfSales.total;
  merged.netProfit = merged.grossProfit - merged.expenses.total + merged.otherIncome.total - merged.otherExpenses.total + merged.financeIncome.total - merged.financeCost.total;

  return merged;
}

function aggregateCashFlows(
  orgDataMap: Map<string, any>,
  eliminations: any[],
  parentMember: any
): any {
  const merged: any = {
    operatingActivities: { total: 0, items: [] },
    investingActivities: { total: 0, items: [] },
    financingActivities: { total: 0, items: [] },
    netCashChange: 0,
    openingCash: 0,
    closingCash: 0,
  };

  for (const [orgId, data] of orgDataMap.entries()) {
    const cf = data.reportData;
    if (!cf) continue;

    const method = data.consolidationMethod;
    const ownership = data.ownershipPercentage / 100;
    const inclusionFactor = method === 'equity' ? ownership : 1;

    const mergeSection = (target: any, source: any, factor: number) => {
      if (!source) return;
      if (typeof source.total === 'number') {
        target.total = (target.total || 0) + Math.round(source.total * factor);
      }
      if (source.items && Array.isArray(source.items)) {
        for (const item of source.items) {
          const existing = target.items.find((i: any) => i.label === item.label);
          if (existing) {
            existing.value = (existing.value || 0) + Math.round((item.value || 0) * factor);
          } else {
            target.items.push({ ...item, value: Math.round((item.value || 0) * factor) });
          }
        }
      }
    };

    if (cf.operatingActivities) mergeSection(merged.operatingActivities, cf.operatingActivities, inclusionFactor);
    if (cf.investingActivities) mergeSection(merged.investingActivities, cf.investingActivities, inclusionFactor);
    if (cf.financingActivities) mergeSection(merged.financingActivities, cf.financingActivities, inclusionFactor);

    if (typeof cf.openingCash === 'number') {
      merged.openingCash += Math.round(cf.openingCash * inclusionFactor);
    }
    if (typeof cf.closingCash === 'number') {
      merged.closingCash += Math.round(cf.closingCash * inclusionFactor);
    }
  }

  merged.netCashChange = merged.operatingActivities.total + merged.investingActivities.total + merged.financingActivities.total;

  return merged;
}

export async function getConsolidationHistory(groupId: string, limit = 10) {
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  const runs = await db
    .select()
    .from(groupConsolidationRuns)
    .where(eq(groupConsolidationRuns.groupId, groupId))
    .orderBy(desc(groupConsolidationRuns.createdAt))
    .limit(limit);

  return runs;
}

export async function getConsolidationRun(runId: string) {
  const [run] = await db
    .select()
    .from(groupConsolidationRuns)
    .where(eq(groupConsolidationRuns.id, runId))
    .limit(1);

  if (!run) {
    throw new AppError('Consolidation run not found', 404);
  }

  return run;
}

export async function generateAutoEliminations(
  groupId: string,
  periodStart: Date,
  periodEnd: Date,
  userId: string
) {
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  // Find all matched IC transactions in the period
  const matchedTxns = await db
    .select()
    .from(intercompanyTransactions)
    .where(and(
      eq(intercompanyTransactions.groupId, groupId),
      eq(intercompanyTransactions.status, 'matched' as any),
      gte(intercompanyTransactions.date, periodStart),
      lte(intercompanyTransactions.date, periodEnd)
    ));

  if (matchedTxns.length === 0) {
    return { eliminatedCount: 0, eliminations: [] };
  }

  const createdEliminations: any[] = [];

  // Group by org pair for elimination
  const pairGroups = new Map<string, typeof matchedTxns>();
  for (const txn of matchedTxns) {
    const key = `${txn.fromOrgId}-${txn.toOrgId}`;
    const existing = pairGroups.get(key) || [];
    existing.push(txn);
    pairGroups.set(key, existing);
  }

  for (const [, txns] of pairGroups) {
    const totalAmount = txns.reduce((sum, t) => sum + t.amount, 0);

    const first = txns[0];
    const [elim] = await db
      .insert(intercompanyEliminations)
      .values({
        groupId,
        transactionId: first.id,
        eliminationMethod: 'auto',
        description: `Auto-elimination of ${txns.length} matched IC transaction(s) between ${first.fromOrgId} and ${first.toOrgId}`,
        fromOrgId: first.fromOrgId,
        toOrgId: first.toOrgId,
        amount: totalAmount,
        currency: first.currency || 'NGN',
        fxRate: first.fxRate || null,
        createdBy: userId,
        periodStart,
        periodEnd,
      })
      .returning();

    createdEliminations.push(elim);

    // Update matched transactions to eliminated status
    await db
      .update(intercompanyTransactions)
      .set({ status: 'eliminated' as any })
      .where(inArray(intercompanyTransactions.id, txns.map(t => t.id)));
  }

  return {
    eliminatedCount: createdEliminations.length,
    eliminations: createdEliminations,
    totalAmount: createdEliminations.reduce((s, e) => s + e.amount, 0),
  };
}
