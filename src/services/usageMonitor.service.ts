import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/schema';
import {
  users, organisations, invoices, contacts, items, journalEntries,
  ocrDocuments, projects, fixedAssets, documents, subscriptionUsage,
} from '../db/schema';
import { getOrgSubscription, getOrgEntitlements } from './subscription.service';

export type ResourceType =
  | 'users' | 'companies' | 'invoices' | 'customers' | 'suppliers'
  | 'products' | 'transactions' | 'apiCalls' | 'storage' | 'ocrDocuments'
  | 'aiRequests' | 'projects' | 'assets' | 'warehouses';

export interface UsageMetric {
  resource: ResourceType;
  label: string;
  current: number;
  limit: number;
  percent: number;
  status: 'ok' | 'warning' | 'critical' | 'exceeded' | 'unlimited';
}

interface ResourceCounter {
  label: string;
  limitKey: string;
  count: (orgId: string) => Promise<number>;
}

const counters: Record<ResourceType, ResourceCounter> = {
  users: {
    label: 'Users',
    limitKey: 'maxUsers',
    count: async (orgId) => {
      const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(users).where(and(eq(users.organisationId, orgId), eq(users.isActive, true)));
      return r.c;
    },
  },
  companies: {
    label: 'Companies',
    limitKey: 'maxCompanies',
    count: async (_orgId) => 1,
  },
  invoices: {
    label: 'Invoices',
    limitKey: 'maxInvoices',
    count: async (orgId) => {
      const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(invoices).where(eq(invoices.orgId, orgId));
      return r.c;
    },
  },
  customers: {
    label: 'Customers',
    limitKey: 'maxCustomers',
    count: async (orgId) => {
      const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.type, 'customer')));
      return r.c;
    },
  },
  suppliers: {
    label: 'Suppliers',
    limitKey: 'maxVendors',
    count: async (orgId) => {
      const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.type, 'vendor')));
      return r.c;
    },
  },
  products: {
    label: 'Products',
    limitKey: 'maxProducts',
    count: async (orgId) => {
      const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(items).where(eq(items.orgId, orgId));
      return r.c;
    },
  },
  transactions: {
    label: 'Transactions',
    limitKey: 'maxTransactions',
    count: async (orgId) => {
      const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(journalEntries).where(eq(journalEntries.orgId, orgId));
      return r.c;
    },
  },
  apiCalls: {
    label: 'API Calls',
    limitKey: 'apiRequests',
    count: async (orgId) => {
      const sub = await getOrgSubscription(orgId);
      if (!sub) return 0;
      const [r] = await db.select({ c: sql<number>`coalesce(sum(usage_count),0)::int` }).from(subscriptionUsage)
        .where(and(eq(subscriptionUsage.orgId, orgId), eq(subscriptionUsage.featureKey, 'apiRequests'),
          sql`period_start <= now() and period_end >= now()`));
      return r.c;
    },
  },
  storage: {
    label: 'Storage',
    limitKey: 'storageLimitGb',
    count: async (orgId) => {
      const [r] = await db.select({ c: sql<number>`coalesce(round(sum(file_size)::numeric / 1e9, 2)::numeric, 0)::int` }).from(documents).where(eq(documents.orgId, orgId));
      return r.c;
    },
  },
  ocrDocuments: {
    label: 'OCR Documents',
    limitKey: 'maxOcrDocuments',
    count: async (orgId) => {
      const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(ocrDocuments).where(eq(ocrDocuments.orgId, orgId));
      return r.c;
    },
  },
  aiRequests: {
    label: 'AI Requests',
    limitKey: 'maxAiRequests',
    count: async (orgId) => {
      const sub = await getOrgSubscription(orgId);
      if (!sub) return 0;
      const [r] = await db.select({ c: sql<number>`coalesce(sum(usage_count),0)::int` }).from(subscriptionUsage)
        .where(and(eq(subscriptionUsage.orgId, orgId), eq(subscriptionUsage.featureKey, 'aiRequests'),
          sql`period_start <= now() and period_end >= now()`));
      return r.c;
    },
  },
  projects: {
    label: 'Projects',
    limitKey: 'maxProjects',
    count: async (orgId) => {
      const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(projects).where(eq(projects.orgId, orgId));
      return r.c;
    },
  },
  assets: {
    label: 'Assets',
    limitKey: 'maxAssets',
    count: async (orgId) => {
      const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(fixedAssets).where(eq(fixedAssets.orgId, orgId));
      return r.c;
    },
  },
  warehouses: {
    label: 'Warehouses',
    limitKey: 'maxWarehouses',
    count: async (orgId) => {
      const [r] = await db.select({ c: sql<number>`count(distinct location)::int` }).from(items).where(and(eq(items.orgId, orgId), sql`location is not null and location != ''`));
      return r.c;
    },
  },
};

function computeStatus(current: number, limit: number): UsageMetric['status'] {
  if (limit <= 0) return 'unlimited';
  const pct = (current / limit) * 100;
  if (pct >= 100) return 'exceeded';
  if (pct >= 90) return 'critical';
  if (pct >= 70) return 'warning';
  return 'ok';
}

export async function getUsageDashboard(orgId: string): Promise<{
  metrics: UsageMetric[];
  overall: { totalResources: number; totalLimit: number; overallPercent: number; status: UsageMetric['status'] };
}> {
  const entitlements = await getOrgEntitlements(orgId);
  const limits: Record<string, number> = entitlements?.limits || {};
  const plan = entitlements?.plan || {};

  const entries = await Promise.all(
    (Object.entries(counters) as [ResourceType, ResourceCounter][]).map(async ([key, cfg]) => {
      const current = await cfg.count(orgId);
      const limit = limits[cfg.limitKey] ?? plan[cfg.limitKey] ?? 0;
      const percent = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
      const status = computeStatus(current, limit);
      return { resource: key, label: cfg.label, current, limit, percent, status } as UsageMetric;
    })
  );

  const countable = entries.filter(m => m.limit > 0);
  const totalResources = countable.reduce((s, m) => s + m.current, 0);
  const totalLimit = countable.reduce((s, m) => s + m.limit, 0);
  const overallPercent = totalLimit > 0 ? Math.min(100, Math.round((totalResources / totalLimit) * 100)) : 0;
  const overallStatus = computeStatus(totalResources, totalLimit);

  return { metrics: entries, overall: { totalResources, totalLimit, overallPercent, status: overallStatus } };
}

export async function checkResourceLimit(orgId: string, resource: ResourceType): Promise<{ allowed: boolean; metric: UsageMetric }> {
  const cfg = counters[resource];
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);

  const entitlements = await getOrgEntitlements(orgId);
  const limits: Record<string, number> = entitlements?.limits || {};
  const plan = entitlements?.plan || {};
  const limit = limits[cfg.limitKey] ?? plan[cfg.limitKey] ?? 0;
  const current = await cfg.count(orgId);
  const percent = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const status = computeStatus(current, limit);

  return {
    allowed: limit <= 0 || current < limit,
    metric: { resource, label: cfg.label, current, limit, percent, status },
  };
}

export async function getUsageHistory(orgId: string, resource?: ResourceType) {
  const sub = await getOrgSubscription(orgId);
  if (!sub) return [];

  const conditions: any[] = [eq(subscriptionUsage.orgId, orgId)];
  if (resource) {
    const cfg = counters[resource];
    if (cfg) conditions.push(eq(subscriptionUsage.featureKey, cfg.limitKey));
  }

  const rows = await db.select({
    featureKey: subscriptionUsage.featureKey,
    usageCount: subscriptionUsage.usageCount,
    periodStart: subscriptionUsage.periodStart,
    periodEnd: subscriptionUsage.periodEnd,
  }).from(subscriptionUsage).where(and(...conditions)).orderBy(subscriptionUsage.periodStart);

  return rows;
}

export const resourceTypes: ResourceType[] = Object.keys(counters) as ResourceType[];
