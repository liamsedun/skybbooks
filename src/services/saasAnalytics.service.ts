import { eq, and, or, sql, desc, asc, gte, lte, count, sum, avg, inArray } from 'drizzle-orm';
import { db, organisations, users, subscriptions, subscriptionPlans, subscriptionInvoices, subscriptionPayments, subscriptionStatusHistory } from '../db/schema';

export interface AnalyticsFilter {
  startDate?: Date;
  endDate?: Date;
  planId?: string;
  region?: string;
  billingCycle?: string;
}

function buildFilterConditions(filters: AnalyticsFilter, table: any) {
  const conds: any[] = [];
  if (filters.startDate) conds.push(gte(table.createdAt, filters.startDate));
  if (filters.endDate) conds.push(lte(table.createdAt, filters.endDate));
  if (filters.planId) conds.push(eq(table.planId, filters.planId));
  if (filters.billingCycle) conds.push(eq(table.billingCycle, filters.billingCycle));
  return conds;
}

export async function getMarr(filters: AnalyticsFilter) {
  const conditions = buildFilterConditions(filters, subscriptions);
  conditions.push(eq(subscriptions.status, 'active'));

  const active = await db.select({
    planId: subscriptions.planId,
    billingCycle: subscriptions.billingCycle,
    planName: subscriptionPlans.name,
    monthlyPrice: subscriptionPlans.monthlyPriceKobo,
    annualPrice: subscriptionPlans.annualPriceKobo,
    count: count(),
  })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(and(...conditions))
    .groupBy(subscriptions.planId, subscriptions.billingCycle, subscriptionPlans.name, subscriptionPlans.monthlyPriceKobo, subscriptionPlans.annualPriceKobo);

  let mrrKobo = 0;
  let arrKobo = 0;
  const planBreakdown: Array<{ planName: string; subs: number; mrrKobo: number; arrKobo: number }> = [];

  for (const row of active) {
    const monthly = row.billingCycle === 'yearly' ? Number(row.annualPrice) / 12
      : row.billingCycle === 'quarterly' ? Number(row.monthlyPrice) * 3 / 3
        : Number(row.monthlyPrice);
    const annual = monthly * 12;
    const planMrr = monthly * Number(row.count);
    const planArr = annual * Number(row.count);
    mrrKobo += planMrr;
    arrKobo += planArr;
    planBreakdown.push({ planName: row.planName || '', subs: Number(row.count), mrrKobo: planMrr, arrKobo: planArr });
  }

  const totalPaidRevenue = await db.select({ total: sum(subscriptionInvoices.totalKobo) })
    .from(subscriptionInvoices)
    .where(and(eq(subscriptionInvoices.status, 'paid'), ...buildFilterConditions(filters, subscriptionInvoices)));

  const uniquePayingOrgs = await db.select({ id: subscriptionInvoices.orgId })
    .from(subscriptionInvoices)
    .where(and(eq(subscriptionInvoices.status, 'paid'), ...buildFilterConditions(filters, subscriptionInvoices)))
    .groupBy(subscriptionInvoices.orgId);
  const payingOrgCount = uniquePayingOrgs.length || 1;

  const totalRevenueKobo = Number(totalPaidRevenue[0]?.total || 0);
  const ltvKobo = Math.round(totalRevenueKobo / payingOrgCount);

  return { mrrKobo, arrKobo, ltvKobo, planBreakdown, totalRevenueKobo, payingOrgCount };
}

export async function getChurnMetrics(filters: AnalyticsFilter) {
  const start = filters.startDate || new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const end = filters.endDate || new Date();
  const periodDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  const subsAtStart = await db.select({ count: count() })
    .from(subscriptions)
    .where(and(lte(subscriptions.createdAt, start), ...(filters.planId ? [eq(subscriptions.planId, filters.planId)] : [])));

  const cancelledInPeriod = await db.select({ count: count() })
    .from(subscriptions)
    .where(and(
      gte(subscriptions.canceledAt, start), lte(subscriptions.canceledAt, end),
      eq(subscriptions.status, 'cancelled'),
      ...(filters.planId ? [eq(subscriptions.planId, filters.planId)] : []),
    ));

  const totalAtStart = Number(subsAtStart[0]?.count || 1);
  const cancelled = Number(cancelledInPeriod[0]?.count || 0);
  const churnRate = (cancelled / totalAtStart) * 100;

  const statusChanges = await db.select({
    fromStatus: subscriptionStatusHistory.fromStatus,
    toStatus: subscriptionStatusHistory.toStatus,
    count: count(),
  })
    .from(subscriptionStatusHistory)
    .where(and(gte(subscriptionStatusHistory.createdAt, start), lte(subscriptionStatusHistory.createdAt, end)))
    .groupBy(subscriptionStatusHistory.fromStatus, subscriptionStatusHistory.toStatus);

  let upgrades = 0;
  let downgrades = 0;
  let renewals = 0;
  for (const sc of statusChanges) {
    const from = sc.fromStatus || '';
    const to = sc.toStatus || '';
    if (from === 'active' && to === 'active') renewals += Number(sc.count);
  }

  const renewalRate = totalAtStart > 0 ? (renewals / totalAtStart) * 100 : 0;
  const upgradeRate = totalAtStart > 0 ? (upgrades / totalAtStart) * 100 : 0;
  const downgradeRate = totalAtStart > 0 ? (downgrades / totalAtStart) * 100 : 0;

  return { churnRate: Math.round(churnRate * 100) / 100, cancelled, totalAtStart, renewalRate: Math.round(renewalRate * 100) / 100, upgradeRate: Math.round(upgradeRate * 100) / 100, downgradeRate: Math.round(downgradeRate * 100) / 100 };
}

export async function getTrialConversion(filters: AnalyticsFilter) {
  const conditions = buildFilterConditions(filters, subscriptions);

  const trialSubs = await db.select({ count: count() })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, 'free_trial'), ...conditions));

  const converted = await db.select({ count: count() })
    .from(subscriptionStatusHistory)
    .where(and(
      eq(subscriptionStatusHistory.fromStatus, 'free_trial'),
      eq(subscriptionStatusHistory.toStatus, 'active'),
      ...(filters.startDate ? [gte(subscriptionStatusHistory.createdAt, filters.startDate)] : []),
      ...(filters.endDate ? [lte(subscriptionStatusHistory.createdAt, filters.endDate)] : []),
    ));

  const totalTrials = Number(trialSubs[0]?.count || 1);
  const convertedCount = Number(converted[0]?.count || 0);
  const conversionRate = (convertedCount / Math.max(totalTrials + convertedCount, 1)) * 100;

  return { trialConversionRate: Math.round(conversionRate * 100) / 100, totalTrials, convertedCount };
}

export async function getRevenueByPlan(filters: AnalyticsFilter) {
  const conditions = and(
    eq(subscriptionInvoices.status, 'paid'),
    ...buildFilterConditions(filters, subscriptionInvoices),
  );

  const data = await db.select({
    planName: subscriptionPlans.name,
    revenueKobo: sql<number>`coalesce(sum(${subscriptionInvoices.totalKobo}), 0)`,
    count: count(),
  })
    .from(subscriptionInvoices)
    .innerJoin(subscriptions, eq(subscriptionInvoices.subscriptionId, subscriptions.id))
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(conditions)
    .groupBy(subscriptionPlans.name)
    .orderBy(desc(sql`coalesce(sum(${subscriptionInvoices.totalKobo}), 0)`));

  return data;
}

export async function getRevenueByCountry(filters: AnalyticsFilter) {
  const conditions = and(
    eq(subscriptionInvoices.status, 'paid'),
    ...buildFilterConditions(filters, subscriptionInvoices),
  );

  const data = await db.select({
    country: sql<string>`coalesce(${organisations.settings}->>'country', 'Unknown')`,
    revenueKobo: sql<number>`coalesce(sum(${subscriptionInvoices.totalKobo}), 0)`,
    count: count(),
  })
    .from(subscriptionInvoices)
    .innerJoin(organisations, eq(subscriptionInvoices.orgId, organisations.id))
    .where(conditions)
    .groupBy(sql`${organisations.settings}->>'country'`)
    .orderBy(desc(sql`coalesce(sum(${subscriptionInvoices.totalKobo}), 0)`));

  return data;
}

export async function getSubscriptionCounts(filters: AnalyticsFilter) {
  const conditions = buildFilterConditions(filters, subscriptions);

  const active = await db.select({ count: count() })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, 'active'), ...conditions));

  const cancelled = await db.select({ count: count() })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, 'cancelled'), ...conditions));

  const freeTrial = await db.select({ count: count() })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, 'free_trial'), ...conditions));

  const gracePeriod = await db.select({ count: count() })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, 'grace_period'), ...conditions));

  const suspended = await db.select({ count: count() })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, 'suspended'), ...conditions));

  return {
    activeSubscriptions: Number(active[0]?.count || 0),
    cancelledSubscriptions: Number(cancelled[0]?.count || 0),
    freeTrial: Number(freeTrial[0]?.count || 0),
    gracePeriod: Number(gracePeriod[0]?.count || 0),
    suspended: Number(suspended[0]?.count || 0),
    total: Number(active[0]?.count || 0) + Number(cancelled[0]?.count || 0) + Number(freeTrial[0]?.count || 0) + Number(gracePeriod[0]?.count || 0) + Number(suspended[0]?.count || 0),
  };
}

export async function getPaymentMetrics(filters: AnalyticsFilter) {
  const conditions = buildFilterConditions(filters, subscriptionPayments);

  const totalPayments = await db.select({ count: count(), totalKobo: sum(subscriptionPayments.amountKobo) })
    .from(subscriptionPayments)
    .where(and(...conditions));

  const successfulPayments = await db.select({ count: count() })
    .from(subscriptionPayments)
    .where(and(eq(subscriptionPayments.status, 'success'), ...conditions));

  const failedPayments = await db.select({ count: count() })
    .from(subscriptionPayments)
    .where(and(eq(subscriptionPayments.status, 'failed'), ...conditions));

  const total = Number(totalPayments[0]?.count || 1);
  const successCount = Number(successfulPayments[0]?.count || 0);
  const failedCount = Number(failedPayments[0]?.count || 0);
  const successRate = (successCount / Math.max(total, 1)) * 100;
  const totalKobo = Number(totalPayments[0]?.totalKobo || 0);

  return { paymentSuccessRate: Math.round(successRate * 100) / 100, successfulPayments: successCount, failedPayments: failedCount, totalPayments: total, totalRevenueKobo: totalKobo };
}

export async function getArpu(filters: AnalyticsFilter) {
  const conditions = and(
    eq(subscriptionInvoices.status, 'paid'),
    ...buildFilterConditions(filters, subscriptionInvoices),
  );

  const revenue = await db.select({ total: sum(subscriptionInvoices.totalKobo), orgCount: count(sql`distinct ${subscriptionInvoices.orgId}`) })
    .from(subscriptionInvoices)
    .where(conditions);

  const totalRevenueKobo = Number(revenue[0]?.total || 0);
  const orgCount = Number(revenue[0]?.orgCount || 1);
  const arpuKobo = Math.round(totalRevenueKobo / orgCount);

  const totalUsers = await db.select({ count: count() }).from(users);
  const userCount = Number(totalUsers[0]?.count || 1);
  const arpuPerUserKobo = Math.round(totalRevenueKobo / userCount);

  return { arpuKobo, arpuPerUserKobo, totalRevenueKobo, orgCount, userCount };
}

export async function getTopCustomers(filters: AnalyticsFilter, limit = 20) {
  const conditions = and(
    eq(subscriptionInvoices.status, 'paid'),
    ...buildFilterConditions(filters, subscriptionInvoices),
  );

  const data = await db.select({
    orgId: subscriptionInvoices.orgId,
    orgName: organisations.name,
    orgEmail: organisations.email,
    totalRevenueKobo: sql<number>`coalesce(sum(${subscriptionInvoices.totalKobo}), 0)`,
    invoiceCount: count(),
    lastPayment: sql<string>`max(${subscriptionInvoices.paidAt})`,
  })
    .from(subscriptionInvoices)
    .innerJoin(organisations, eq(subscriptionInvoices.orgId, organisations.id))
    .where(conditions)
    .groupBy(subscriptionInvoices.orgId, organisations.name, organisations.email)
    .orderBy(desc(sql`coalesce(sum(${subscriptionInvoices.totalKobo}), 0)`))
    .limit(limit);

  return data;
}

export async function getGrowthTrends(filters: AnalyticsFilter) {
  const months = 12;
  const monthlyData: Array<{ month: string; newOrgs: number; revenueKobo: number; newSubs: number; churnedSubs: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
    const monthStart = d;
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const monthLabel = d.toISOString().slice(0, 7);

    const newOrgs = await db.select({ count: count() })
      .from(organisations)
      .where(and(gte(organisations.createdAt, monthStart), lte(organisations.createdAt, monthEnd)));

    const revenue = await db.select({ total: sum(subscriptionInvoices.totalKobo) })
      .from(subscriptionInvoices)
      .where(and(eq(subscriptionInvoices.status, 'paid'), gte(subscriptionInvoices.createdAt, monthStart), lte(subscriptionInvoices.createdAt, monthEnd)));

    const newSubs = await db.select({ count: count() })
      .from(subscriptions)
      .where(and(gte(subscriptions.createdAt, monthStart), lte(subscriptions.createdAt, monthEnd)));

    const churned = await db.select({ count: count() })
      .from(subscriptions)
      .where(and(gte(subscriptions.canceledAt, monthStart), lte(subscriptions.canceledAt, monthEnd), eq(subscriptions.status, 'cancelled')));

    monthlyData.push({
      month: monthLabel,
      newOrgs: Number(newOrgs[0]?.count || 0),
      revenueKobo: Number(revenue[0]?.total || 0),
      newSubs: Number(newSubs[0]?.count || 0),
      churnedSubs: Number(churned[0]?.count || 0),
    });
  }

  return monthlyData;
}

export async function getSaaSAnalytics(filters: AnalyticsFilter) {
  const [marr, churn, trialConversion, revenueByPlan, revenueByCountry, subCounts, payments, arpu, topCustomers, growth] = await Promise.all([
    getMarr(filters),
    getChurnMetrics(filters),
    getTrialConversion(filters),
    getRevenueByPlan(filters),
    getRevenueByCountry(filters),
    getSubscriptionCounts(filters),
    getPaymentMetrics(filters),
    getArpu(filters),
    getTopCustomers(filters),
    getGrowthTrends(filters),
  ]);

  return {
    mrrKobo: marr.mrrKobo,
    arrKobo: marr.arrKobo,
    ltvKobo: marr.ltvKobo,
    arpuKobo: arpu.arpuKobo,
    ...churn,
    ...trialConversion,
    ...subCounts,
    ...payments,
    planBreakdown: marr.planBreakdown,
    revenueByPlan,
    revenueByCountry,
    growthTrends: growth,
    topCustomers,
  };
}
