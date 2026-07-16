import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db, reportSectionMappings, accounts } from '../db/schema';
import { AppError } from '../lib/errors';

export const mappingSchema = z.object({
  id: z.string().uuid().optional(),
  reportType: z.enum(['balance_sheet', 'income_statement', 'cash_flow']),
  sectionKey: z.string(),
  label: z.string(),
  accountCode: z.string().optional(),
  accountPrefix: z.string().optional(),
  signMultiplier: z.number().int().default(1),
  includeSubAccounts: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type MappingInput = z.infer<typeof mappingSchema>;

export interface SectionMapping {
  id: string;
  orgId: string;
  reportType: string;
  sectionKey: string;
  label: string;
  accountCode: string | null;
  accountPrefix: string | null;
  signMultiplier: number;
  includeSubAccounts: boolean;
  sortOrder: number;
  isActive: boolean;
}

export async function getMappings(orgId: string, reportType?: string): Promise<SectionMapping[]> {
  const conditions = [eq(reportSectionMappings.orgId, orgId)];
  if (reportType) conditions.push(eq(reportSectionMappings.reportType, reportType));

  const rows = await db
    .select()
    .from(reportSectionMappings)
    .where(and(...conditions))
    .orderBy(reportSectionMappings.reportType, reportSectionMappings.sortOrder);

  return rows.map(r => ({
    id: r.id,
    orgId: r.orgId,
    reportType: r.reportType,
    sectionKey: r.sectionKey,
    label: r.label,
    accountCode: r.accountCode,
    accountPrefix: r.accountPrefix,
    signMultiplier: r.signMultiplier,
    includeSubAccounts: r.includeSubAccounts,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  }));
}

export async function saveMappings(
  orgId: string,
  mappings: MappingInput[]
): Promise<SectionMapping[]> {
  // Delete existing mappings for the org and report types in the batch
  const reportTypes = [...new Set(mappings.map(m => m.reportType))];
  for (const rt of reportTypes) {
    await db
      .delete(reportSectionMappings)
      .where(
        and(
          eq(reportSectionMappings.orgId, orgId),
          eq(reportSectionMappings.reportType, rt)
        )
      );
  }

  // Insert new mappings
  for (const m of mappings) {
    await db.insert(reportSectionMappings).values({
      orgId,
      reportType: m.reportType,
      sectionKey: m.sectionKey,
      label: m.label,
      accountCode: m.accountCode || null,
      accountPrefix: m.accountPrefix || null,
      signMultiplier: m.signMultiplier,
      includeSubAccounts: m.includeSubAccounts,
      sortOrder: m.sortOrder,
      isActive: m.isActive,
    });
  }

  return getMappings(orgId);
}

export async function applyMappingsToReport(
  orgId: string,
  reportType: string,
  reportData: any
): Promise<any> {
  const mappings = await getMappings(orgId, reportType);

  if (mappings.length === 0) {
    return reportData; // no custom mappings, return as-is
  }

  // For balance sheet: restructure the items per mapping
  if (reportType === 'balance_sheet') {
    return applyBalanceSheetMappings(reportData, mappings, orgId);
  }

  if (reportType === 'income_statement') {
    return applyIncomeStatementMappings(reportData, mappings, orgId);
  }

  return reportData;
}

async function applyBalanceSheetMappings(reportData: any, mappings: SectionMapping[], orgId: string): Promise<any> {
  // Fetch all org accounts for code matching
  const orgAccounts = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type })
    .from(accounts)
    .where(eq(accounts.orgId, orgId));

  // Build a flat list of all items from all sub-sections
  const sectionGroups = ['currentAssets', 'nonCurrentAssets', 'currentLiabilities', 'nonCurrentLiabilities', 'equity'];

  function flattenItems(section: any): any[] {
    const items: any[] = [];
    if (section.subSections) {
      for (const sub of section.subSections) {
        if (sub.items) items.push(...sub.items);
        if (sub.contraItems) items.push(...sub.contraItems);
      }
    }
    if (section.items) items.push(...section.items);
    return items;
  }

  // Group mappings by sectionKey
  const groupedMappings = new Map<string, SectionMapping[]>();
  for (const m of mappings) {
    if (!groupedMappings.has(m.sectionKey)) groupedMappings.set(m.sectionKey, []);
    groupedMappings.get(m.sectionKey)!.push(m);
  }

  // For each section group, rebuild subSections based on mappings
  for (const groupKey of sectionGroups) {
    const group = reportData[groupKey];
    if (!group || !group.subSections) continue;

    const allItems = flattenItems(group);

    // Build new subSections from mappings
    const newSubSections: any[] = [];
    for (const [sectionKey, mappers] of groupedMappings) {
      if (!sectionKey.startsWith(groupKey + '.')) continue;

      // Collect matching items
      const matchedItems: any[] = [];
      for (const item of allItems) {
        let matched = false;
        for (const m of mappers) {
          if (!m.isActive) continue;
          const code = item.code || '';
          if (m.accountCode && code === m.accountCode) { matched = true; break; }
          if (m.accountPrefix && code.startsWith(m.accountPrefix)) { matched = true; break; }
        }
        if (matched) matchedItems.push(item);
      }

      if (matchedItems.length > 0) {
        const total = matchedItems.reduce((s: number, i: any) => s + (i.balance || 0), 0);
        const label = mappers[0]?.label || sectionKey.split('.').pop() || sectionKey;
        newSubSections.push({
          key: sectionKey,
          label,
          total,
          items: matchedItems,
        });
      }
    }

    // If mappings exist for this group, replace subSections
    if (newSubSections.length > 0) {
      reportData[groupKey].subSections = newSubSections;
      reportData[groupKey].total = newSubSections.reduce((s: number, sub: any) => s + sub.total, 0);
    }
  }

  // Recalculate totals
  reportData.totalAssets = (reportData.currentAssets?.total || 0) + (reportData.nonCurrentAssets?.total || 0);
  reportData.totalLiabilities = (reportData.currentLiabilities?.total || 0) + (reportData.nonCurrentLiabilities?.total || 0);
  reportData.totalEquity = reportData.equity?.total || 0;
  reportData.liabilitiesAndEquity = reportData.totalLiabilities + reportData.totalEquity;

  return reportData;
}

async function applyIncomeStatementMappings(reportData: any, mappings: SectionMapping[], orgId: string): Promise<any> {
  // Flatten all income statement accounts
  const allAccounts: any[] = [];
  for (const section of ['revenue', 'cogs', 'grossProfit', 'adminExpenses', 'marketingExpenses', 'otherIncome', 'otherExpenses', 'financeIncome', 'financeCost', 'incomeTaxExpense']) {
    if (reportData[section]) {
      if (Array.isArray(reportData[section].accounts)) {
        allAccounts.push(...reportData[section].accounts.map((a: any) => ({ ...a, _section: section })));
      } else if (Array.isArray(reportData[section])) {
        allAccounts.push(...reportData[section].map((a: any) => ({ ...a, _section: section })));
      }
    }
  }

  // Group mappings by sectionKey
  const groupedMappings = new Map<string, SectionMapping[]>();
  for (const m of mappings) {
    if (!groupedMappings.has(m.sectionKey)) groupedMappings.set(m.sectionKey, []);
    groupedMappings.get(m.sectionKey)!.push(m);
  }

  for (const [sectionKey, mappers] of groupedMappings) {
    const matchedItems = allAccounts.filter((item: any) => {
      for (const m of mappers) {
        if (!m.isActive) continue;
        const code = item.code || '';
        if (m.accountCode && code === m.accountCode) return true;
        if (m.accountPrefix && code.startsWith(m.accountPrefix)) return true;
      }
      return false;
    });

    if (matchedItems.length > 0) {
      const total = matchedItems.reduce((s: number, i: any) => s + (i.balance || 0), 0);
      const topSection = sectionKey.split('.')[0];
      if (reportData[topSection]) {
        reportData[topSection].accounts = matchedItems;
        reportData[topSection].total = total;
      }
    }
  }

  // Recalculate net profit
  if (reportData.grossProfit != null && reportData.adminExpenses != null) {
    reportData.netProfit =
      (reportData.grossProfit?.total || reportData.grossProfit || 0) -
      (reportData.adminExpenses?.total || 0) -
      (reportData.marketingExpenses?.total || 0) +
      (reportData.otherIncome?.total || 0) -
      (reportData.otherExpenses?.total || 0) +
      (reportData.financeIncome?.total || 0) -
      (reportData.financeCost?.total || 0) -
      (reportData.incomeTaxExpense?.total || 0);
  }

  return reportData;
}
