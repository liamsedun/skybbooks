import { eq, and, or, sql, desc, asc, lt, lte, gte, count, sum, avg, inArray, isNull } from 'drizzle-orm';
import { db, organisations, users, subscriptions, subscriptionPlans, subscriptionInvoices, subscriptionPayments, subscriptionUsage, coupons, promotions, auditLog, chatMessages, documents, regionalPricing, enterpriseContracts, resellerContracts, subscriptionConfig, whiteLabelConfig } from '../db/schema';

export interface DashboardData {
  kpis: {
    totalOrganizations: number;
    activeSubscriptions: number;
    trialAccounts: number;
    expiredAccounts: number;
    suspendedAccounts: number;
    mrrKobo: number;
    arrKobo: number;
    totalRevenueKobo: number;
    totalUsers: number;
    failedPayments: number;
    storageUsed: number;
    apiCalls: number;
  };
  revenueOverTime: Array<{ month: string; revenueKobo: number; subscriptions: number }>;
  planDistribution: Array<{ planName: string; count: number; revenueKobo: number }>;
  orgGrowth: Array<{ month: string; newOrgs: number; newUsers: number }>;
  recentOrganizations: Array<{ id: string; name: string; email: string; createdAt: string; status: string }>;
  failedPayments: Array<{ id: string; orgName: string; amountKobo: number; date: string; reason: string }>;
}

export async function getDashboard(): Promise<DashboardData> {
  const now = new Date();

  const [orgCount] = await db.select({ count: count() }).from(organisations);
  const [activeSubs] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, 'active'));
  const [trialSubs] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, 'free_trial'));
  const [expiredSubs] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, 'expired'));
  const [suspendedSubs] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, 'suspended'));
  const [userCount] = await db.select({ count: count() }).from(users);
  const [failedPmts] = await db.select({ count: count() }).from(subscriptionPayments).where(eq(subscriptionPayments.status, 'failed'));

  const storageRows = await db.select({ usage: documents.fileSize }).from(documents);
  const totalStorage = storageRows.reduce((acc, r) => acc + Number(r.usage || 0), 0);

  const paidInvoices = await db.select({ totalKobo: subscriptionInvoices.totalKobo }).from(subscriptionInvoices).where(eq(subscriptionInvoices.status, 'paid'));
  const totalRevenueKobo = paidInvoices.reduce((acc, inv) => acc + Number(inv.totalKobo || 0), 0);

  const last6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const monthlyRevenue = await db
    .select({
      month: sql<string>`to_char(${subscriptionInvoices.createdAt}, 'YYYY-MM')`,
      revenueKobo: sql<number>`sum(${subscriptionInvoices.totalKobo})`,
      subs: sql<number>`count(*)`,
    })
    .from(subscriptionInvoices)
    .where(and(eq(subscriptionInvoices.status, 'paid'), gte(subscriptionInvoices.createdAt, last6Months)))
    .groupBy(sql`to_char(${subscriptionInvoices.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${subscriptionInvoices.createdAt}, 'YYYY-MM')`);

  const planDist = await db
    .select({
      planName: subscriptionPlans.name,
      count: sql<number>`count(*)`,
      revenueKobo: sql<number>`coalesce(sum(${subscriptionInvoices.totalKobo}), 0)`,
    })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .leftJoin(subscriptionInvoices, and(eq(subscriptionInvoices.subscriptionId, subscriptions.id), eq(subscriptionInvoices.status, 'paid')))
    .groupBy(subscriptionPlans.name)
    .orderBy(desc(sql`count(*)`));

  const last12Months = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const orgGrowth = await db
    .select({
      month: sql<string>`to_char(${organisations.createdAt}, 'YYYY-MM')`,
      newOrgs: sql<number>`count(*)`,
    })
    .from(organisations)
    .where(gte(organisations.createdAt, last12Months))
    .groupBy(sql`to_char(${organisations.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${organisations.createdAt}, 'YYYY-MM')`);

  const recentOrgs = await db
    .select({ id: organisations.id, name: organisations.name, email: organisations.email, createdAt: organisations.createdAt })
    .from(organisations)
    .orderBy(desc(organisations.createdAt))
    .limit(10);

  const failedPaymentRows = await db
    .select({
      id: subscriptionPayments.id,
      orgName: organisations.name,
      amountKobo: subscriptionPayments.amountKobo,
      date: subscriptionPayments.createdAt,
      reason: sql<string>`''`,
    })
    .from(subscriptionPayments)
    .innerJoin(organisations, eq(subscriptionPayments.orgId, organisations.id))
    .where(eq(subscriptionPayments.status, 'failed'))
    .orderBy(desc(subscriptionPayments.createdAt))
    .limit(10);

  const latestPaidInvoices = await db
    .select({ totalKobo: subscriptionInvoices.totalKobo })
    .from(subscriptionInvoices)
    .where(and(eq(subscriptionInvoices.status, 'paid'), gte(subscriptionInvoices.createdAt, last6Months)));

  const latest6Revenue = latestPaidInvoices.reduce((s, i) => s + Number(i.totalKobo || 0), 0);
  const mrrKobo = Math.round(latest6Revenue / 6);
  const arrKobo = mrrKobo * 12;

  return {
    kpis: {
      totalOrganizations: Number(orgCount?.count || 0),
      activeSubscriptions: Number(activeSubs?.count || 0),
      trialAccounts: Number(trialSubs?.count || 0),
      expiredAccounts: Number(expiredSubs?.count || 0),
      suspendedAccounts: Number(suspendedSubs?.count || 0),
      mrrKobo,
      arrKobo,
      totalRevenueKobo,
      totalUsers: Number(userCount?.count || 0),
      failedPayments: Number(failedPmts?.count || 0),
      storageUsed: totalStorage,
      apiCalls: 0,
    },
    revenueOverTime: monthlyRevenue.map(r => ({ month: r.month, revenueKobo: Number(r.revenueKobo || 0), subscriptions: Number(r.subs || 0) })),
    planDistribution: planDist.map(p => ({ planName: p.planName, count: Number(p.count), revenueKobo: Number(p.revenueKobo || 0) })),
    orgGrowth: orgGrowth.map(o => ({ month: o.month, newOrgs: Number(o.newOrgs), newUsers: 0 })),
    recentOrganizations: recentOrgs.map(o => ({ id: o.id, name: o.name || '', email: o.email || '', createdAt: o.createdAt?.toISOString() || '', status: '' })),
    failedPayments: failedPaymentRows.map(p => ({ id: p.id, orgName: p.orgName || '', amountKobo: Number(p.amountKobo || 0), date: p.date?.toISOString() || '', reason: p.reason || '' })),
  };
}

export async function getOrganizations(page = 1, pageSize = 20, search?: string, statusFilter?: string) {
  const conditions: any[] = [];
  if (search) conditions.push(or(sql`${organisations.name} ilike ${'%' + search + '%'}`, sql`${organisations.email} ilike ${'%' + search + '%'}`));
  if (statusFilter) conditions.push(eq(subscriptions.status, statusFilter as any));

  const where = conditions.length ? and(...conditions) : undefined;
  const offset = (page - 1) * pageSize;

  const totalRows = await db.select({ count: count() })
    .from(organisations)
    .leftJoin(subscriptions, eq(subscriptions.orgId, organisations.id))
    .where(where);
  const rows = await db.select({
    id: organisations.id,
    name: organisations.name,
    email: organisations.email,
    createdAt: organisations.createdAt,
    subscriptionStatus: subscriptions.status,
    planName: subscriptionPlans.name,
  })
    .from(organisations)
    .leftJoin(subscriptions, eq(subscriptions.orgId, organisations.id))
    .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(where)
    .orderBy(desc(organisations.createdAt))
    .limit(pageSize)
    .offset(offset);

  const data = rows.map(r => ({ ...r, status: r.subscriptionStatus || '' }));
  return { data, total: Number(totalRows[0]?.count || 0), page, pageSize };
}

export async function getOrganizationDetail(orgId: string) {
  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  if (!org) throw new Error('Organization not found');

  const userList = await db.select({ id: users.id, name: users.fullName, email: users.email, role: users.role, isActive: users.isActive, createdAt: users.createdAt })
    .from(users).where(eq(users.organisationId, orgId)).orderBy(desc(users.createdAt));

  const [sub] = await db.select({
    id: subscriptions.id, planId: subscriptions.planId, status: subscriptions.status,
    currentPeriodEnd: subscriptions.currentPeriodEnd, autoRenew: subscriptions.autoRenew,
    planName: subscriptionPlans.name, planCode: subscriptionPlans.code,
  })
    .from(subscriptions).innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(eq(subscriptions.orgId, orgId)).limit(1);

  return { org, users: userList, subscription: sub || null };
}

export async function updateOrganizationStatus(orgId: string, status: string) {
  const [updated] = await db.update(subscriptions).set({ status: status as any }).where(eq(subscriptions.orgId, orgId)).returning();
  return updated;
}

export async function getRevenueAnalytics(startDate?: Date, endDate?: Date) {
  const now = new Date();
  const start = startDate || new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const end = endDate || now;

  const monthlyData = await db
    .select({
      month: sql<string>`to_char(${subscriptionInvoices.createdAt}, 'YYYY-MM')`,
      revenueKobo: sql<number>`coalesce(sum(${subscriptionInvoices.totalKobo}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(subscriptionInvoices)
    .where(and(eq(subscriptionInvoices.status, 'paid'), gte(subscriptionInvoices.createdAt, start), lte(subscriptionInvoices.createdAt, end)))
    .groupBy(sql`to_char(${subscriptionInvoices.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${subscriptionInvoices.createdAt}, 'YYYY-MM')`);

  const planBreakdown = await db
    .select({
      planName: subscriptionPlans.name,
      revenueKobo: sql<number>`coalesce(sum(${subscriptionInvoices.totalKobo}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(subscriptionInvoices)
    .innerJoin(subscriptions, eq(subscriptionInvoices.subscriptionId, subscriptions.id))
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(and(eq(subscriptionInvoices.status, 'paid'), gte(subscriptionInvoices.createdAt, start), lte(subscriptionInvoices.createdAt, end)))
    .groupBy(subscriptionPlans.name)
    .orderBy(desc(sql`coalesce(sum(${subscriptionInvoices.totalKobo}), 0)`));

  return { monthlyData, planBreakdown, totalRevenueKobo: monthlyData.reduce((s, r) => s + Number(r.revenueKobo), 0) };
}

export async function getFailedPayments(limit = 20) {
  return await db.select({
    id: subscriptionPayments.id,
    orgId: subscriptionPayments.orgId,
    orgName: organisations.name,
    amountKobo: subscriptionPayments.amountKobo,
    gateway: subscriptionPayments.gateway,
    status: subscriptionPayments.status,
    failureReason: sql<string>`coalesce(${subscriptionPayments.rawResponse}->>'gateway_response', '')`,
    createdAt: subscriptionPayments.createdAt,
  })
    .from(subscriptionPayments)
    .innerJoin(organisations, eq(subscriptionPayments.orgId, organisations.id))
    .where(eq(subscriptionPayments.status, 'failed'))
    .orderBy(desc(subscriptionPayments.createdAt))
    .limit(limit);
}

export async function getSystemHealth() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [activeSessions] = await db.select({ count: count() }).from(users).where(eq(users.isActive, true));
  const todayOrgs = await db.select({ count: count() }).from(organisations).where(gte(organisations.createdAt, today));
  const storageRows = await db.select({ usage: documents.fileSize }).from(documents);
  const totalStorage = storageRows.reduce((acc, r) => acc + Number(r.usage || 0), 0);
  const totalChatMsgs = await db.select({ count: count() }).from(chatMessages);

  return {
    activeUsers: Number(activeSessions?.count || 0),
    newOrgsToday: Number(todayOrgs[0]?.count || 0),
    storageUsedBytes: totalStorage,
    totalChatMessages: Number(totalChatMsgs[0]?.count || 0),
    dbSize: 0,
  };
}

export async function getAuditLogs(page = 1, pageSize = 50, action?: string) {
  const conditions: any[] = [];
  if (action) conditions.push(eq(auditLog.action, action));

  const where = conditions.length ? and(...conditions) : undefined;
  const offset = (page - 1) * pageSize;

  const total = await db.select({ count: count() }).from(auditLog).where(where);
  const rows = await db.select({
    id: auditLog.id,
    orgId: auditLog.orgId,
    userId: auditLog.userId,
    action: auditLog.action,
    entityType: auditLog.entityType,
    entityId: auditLog.entityId,
    oldValues: auditLog.oldValues,
    newValues: auditLog.newValues,
    ipAddress: auditLog.ipAddress,
    userAgent: auditLog.userAgent,
    createdAt: auditLog.createdAt,
    userName: users.fullName,
    orgName: organisations.name,
  })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .leftJoin(organisations, eq(auditLog.orgId, organisations.id))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data: rows, total: Number(total[0]?.count || 0), page, pageSize };
}

export async function getPlans() {
  return await db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.name));
}

export async function createPlan(data: any) {
  const [plan] = await db.insert(subscriptionPlans).values(data as any).returning();
  return plan;
}

export async function updatePlan(planId: string, data: any) {
  const [updated] = await db.update(subscriptionPlans).set({ ...data, updatedAt: new Date() } as any).where(eq(subscriptionPlans.id, planId)).returning();
  return updated;
}

export async function getCoupons() {
  return await db.select().from(coupons).orderBy(desc(coupons.createdAt));
}

export async function getSubscriptions(page = 1, pageSize = 20, status?: string) {
  const conditions: any[] = [];
  if (status) conditions.push(eq(subscriptions.status, status as any));

  const [{ count }] = await db.select({ count: sql<number>`count(*)` })
    .from(subscriptions)
    .innerJoin(organisations, eq(subscriptions.orgId, organisations.id))
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(conditions.length ? and(...conditions) : undefined);

  const rows = await db.select({
    id: subscriptions.id,
    orgId: subscriptions.orgId,
    orgName: organisations.name,
    planId: subscriptions.planId,
    planName: subscriptionPlans.name,
    status: subscriptions.status,
    currentPeriodEnd: subscriptions.currentPeriodEnd,
    autoRenew: subscriptions.autoRenew,
    createdAt: subscriptions.createdAt,
  })
    .from(subscriptions)
    .innerJoin(organisations, eq(subscriptions.orgId, organisations.id))
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(subscriptions.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { data: rows, total: Number(count), page, pageSize, totalPages: Math.ceil(Number(count) / pageSize) };
}

export async function getGrowthMetrics() {
  const now = new Date();
  const last12 = new Date(now.getFullYear() - 1, now.getMonth(), 1);

  const monthlyOrgs = await db
    .select({
      month: sql<string>`to_char(${organisations.createdAt}, 'YYYY-MM')`,
      count: sql<number>`count(*)`,
    })
    .from(organisations)
    .where(gte(organisations.createdAt, last12))
    .groupBy(sql`to_char(${organisations.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${organisations.createdAt}, 'YYYY-MM')`);

  const monthlyRevenue = await db
    .select({
      month: sql<string>`to_char(${subscriptionInvoices.createdAt}, 'YYYY-MM')`,
      revenueKobo: sql<number>`coalesce(sum(${subscriptionInvoices.totalKobo}), 0)`,
    })
    .from(subscriptionInvoices)
    .where(and(eq(subscriptionInvoices.status, 'paid'), gte(subscriptionInvoices.createdAt, last12)))
    .groupBy(sql`to_char(${subscriptionInvoices.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${subscriptionInvoices.createdAt}, 'YYYY-MM')`);

  const statusDist = await db
    .select({ status: subscriptions.status, count: sql<number>`count(*)` })
    .from(subscriptions)
    .groupBy(subscriptions.status);

  return { orgGrowth: monthlyOrgs, revenueGrowth: monthlyRevenue, subscriptionStatusDistribution: statusDist };
}

export async function getUsageStats(orgId?: string) {
  const conditions: any[] = [];
  if (orgId) conditions.push(eq(subscriptionUsage.orgId, orgId));

  return await db.select({
    orgId: subscriptionUsage.orgId,
    orgName: organisations.name,
    featureKey: subscriptionUsage.featureKey,
    usageCount: subscriptionUsage.usageCount,
    usageLimit: subscriptionUsage.usageLimit,
  })
    .from(subscriptionUsage)
    .innerJoin(organisations, eq(subscriptionUsage.orgId, organisations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(subscriptionUsage.usageCount))
    .limit(100);
}

// ══════════════════════════════════════════════════════════════
// ENTERPRISE MANAGEMENT
// ══════════════════════════════════════════════════════════════

// ── Regional Pricing ──

export async function getRegionalPricing() {
  return await db.select({
    id: regionalPricing.id,
    planId: regionalPricing.planId,
    planName: subscriptionPlans.name,
    region: regionalPricing.region,
    currency: regionalPricing.currency,
    monthlyPriceKobo: regionalPricing.monthlyPriceKobo,
    annualPriceKobo: regionalPricing.annualPriceKobo,
    isActive: regionalPricing.isActive,
    createdAt: regionalPricing.createdAt,
  })
    .from(regionalPricing)
    .leftJoin(subscriptionPlans, eq(regionalPricing.planId, subscriptionPlans.id))
    .orderBy(desc(regionalPricing.createdAt));
}

export async function createRegionalPricing(data: any) {
  const [row] = await db.insert(regionalPricing).values(data).returning();
  return row;
}

export async function updateRegionalPricing(id: string, data: any) {
  const [row] = await db.update(regionalPricing).set({ ...data, updatedAt: new Date() } as any)
    .where(eq(regionalPricing.id, id)).returning();
  return row;
}

export async function deleteRegionalPricing(id: string) {
  await db.delete(regionalPricing).where(eq(regionalPricing.id, id));
}

// ── Enterprise Contracts ──

export async function getEnterpriseContracts(search?: string) {
  const conditions: any[] = [];
  if (search) conditions.push(sql`(${enterpriseContracts.name} ILIKE ${'%' + search + '%'} OR ${enterpriseContracts.contractNumber} ILIKE ${'%' + search + '%'})`);
  return await db.select({
    id: enterpriseContracts.id,
    orgId: enterpriseContracts.orgId,
    orgName: organisations.name,
    planId: enterpriseContracts.planId,
    planName: subscriptionPlans.name,
    contractNumber: enterpriseContracts.contractNumber,
    name: enterpriseContracts.name,
    contactName: enterpriseContracts.contactName,
    contactEmail: enterpriseContracts.contactEmail,
    negotiatedPriceKobo: enterpriseContracts.negotiatedPriceKobo,
    currency: enterpriseContracts.currency,
    billingCycle: enterpriseContracts.billingCycle,
    startDate: enterpriseContracts.startDate,
    endDate: enterpriseContracts.endDate,
    autoRenew: enterpriseContracts.autoRenew,
    status: enterpriseContracts.status,
    createdAt: enterpriseContracts.createdAt,
  })
    .from(enterpriseContracts)
    .leftJoin(organisations, eq(enterpriseContracts.orgId, organisations.id))
    .leftJoin(subscriptionPlans, eq(enterpriseContracts.planId, subscriptionPlans.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(enterpriseContracts.createdAt));
}

export async function createEnterpriseContract(data: any) {
  const [row] = await db.insert(enterpriseContracts).values(data).returning();
  return row;
}

export async function updateEnterpriseContract(id: string, data: any) {
  const [row] = await db.update(enterpriseContracts).set({ ...data, updatedAt: new Date() } as any)
    .where(eq(enterpriseContracts.id, id)).returning();
  return row;
}

export async function deleteEnterpriseContract(id: string) {
  await db.delete(enterpriseContracts).where(eq(enterpriseContracts.id, id));
}

// ── Reseller Contracts ──

export async function getResellerContracts(search?: string) {
  const conditions: any[] = [];
  if (search) conditions.push(sql`(${resellerContracts.resellerName} ILIKE ${'%' + search + '%'} OR ${resellerContracts.resellerCode} ILIKE ${'%' + search + '%'})`);
  return await db.select({
    id: resellerContracts.id,
    resellerOrgId: resellerContracts.resellerOrgId,
    resellerOrgName: organisations.name,
    planId: resellerContracts.planId,
    planName: subscriptionPlans.name,
    resellerName: resellerContracts.resellerName,
    resellerCode: resellerContracts.resellerCode,
    contactName: resellerContracts.contactName,
    contactEmail: resellerContracts.contactEmail,
    markupPercent: resellerContracts.markupPercent,
    commissionPercent: resellerContracts.commissionPercent,
    commissionKobo: resellerContracts.commissionKobo,
    currency: resellerContracts.currency,
    regionRestrictions: resellerContracts.regionRestrictions,
    startDate: resellerContracts.startDate,
    endDate: resellerContracts.endDate,
    status: resellerContracts.status,
    createdAt: resellerContracts.createdAt,
  })
    .from(resellerContracts)
    .leftJoin(organisations, eq(resellerContracts.resellerOrgId, organisations.id))
    .leftJoin(subscriptionPlans, eq(resellerContracts.planId, subscriptionPlans.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(resellerContracts.createdAt));
}

export async function createResellerContract(data: any) {
  const [row] = await db.insert(resellerContracts).values(data).returning();
  return row;
}

export async function updateResellerContract(id: string, data: any) {
  const [row] = await db.update(resellerContracts).set({ ...data, updatedAt: new Date() } as any)
    .where(eq(resellerContracts.id, id)).returning();
  return row;
}

export async function deleteResellerContract(id: string) {
  await db.delete(resellerContracts).where(eq(resellerContracts.id, id));
}

// ── Org Config ──

export async function getOrgConfigs(orgId?: string) {
  const conditions: any[] = [];
  if (orgId) conditions.push(eq(subscriptionConfig.orgId, orgId));
  return await db.select({
    id: subscriptionConfig.id,
    orgId: subscriptionConfig.orgId,
    orgName: organisations.name,
    key: subscriptionConfig.key,
    value: subscriptionConfig.value,
    description: subscriptionConfig.description,
    createdAt: subscriptionConfig.createdAt,
    updatedAt: subscriptionConfig.updatedAt,
  })
    .from(subscriptionConfig)
    .leftJoin(organisations, eq(subscriptionConfig.orgId, organisations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(subscriptionConfig.createdAt));
}

export async function setOrgConfigKey(orgId: string, key: string, value: any, description?: string) {
  const [existing] = await db.select().from(subscriptionConfig)
    .where(and(eq(subscriptionConfig.orgId, orgId), eq(subscriptionConfig.key, key)))
    .limit(1);
  if (existing) {
    const [row] = await db.update(subscriptionConfig).set({ value, updatedAt: new Date() } as any)
      .where(eq(subscriptionConfig.id, existing.id)).returning();
    return row;
  }
  const [row] = await db.insert(subscriptionConfig).values({ orgId, key, value, description } as any).returning();
  return row;
}

export async function deleteOrgConfig(id: string) {
  await db.delete(subscriptionConfig).where(eq(subscriptionConfig.id, id));
}

// ── White Label Config ──

export async function getWhiteLabelConfigs(orgId?: string) {
  const conditions: any[] = [];
  if (orgId) conditions.push(eq(whiteLabelConfig.orgId, orgId));
  return await db.select({
    id: whiteLabelConfig.id,
    orgId: whiteLabelConfig.orgId,
    orgName: organisations.name,
    brandName: whiteLabelConfig.brandName,
    logoUrl: whiteLabelConfig.logoUrl,
    faviconUrl: whiteLabelConfig.faviconUrl,
    primaryColor: whiteLabelConfig.primaryColor,
    secondaryColor: whiteLabelConfig.secondaryColor,
    accentColor: whiteLabelConfig.accentColor,
    customDomain: whiteLabelConfig.customDomain,
    supportEmail: whiteLabelConfig.supportEmail,
    supportPhone: whiteLabelConfig.supportPhone,
    footerText: whiteLabelConfig.footerText,
    isActive: whiteLabelConfig.isActive,
    createdAt: whiteLabelConfig.createdAt,
  })
    .from(whiteLabelConfig)
    .leftJoin(organisations, eq(whiteLabelConfig.orgId, organisations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(whiteLabelConfig.createdAt));
}

export async function upsertWhiteLabelConfig(data: any) {
  const existing = await db.select().from(whiteLabelConfig)
    .where(eq(whiteLabelConfig.orgId, data.orgId)).limit(1);
  if (existing.length > 0) {
    const [row] = await db.update(whiteLabelConfig).set({ ...data, updatedAt: new Date() } as any)
      .where(eq(whiteLabelConfig.id, existing[0].id)).returning();
    return row;
  }
  const [row] = await db.insert(whiteLabelConfig).values(data).returning();
  return row;
}

export async function deleteWhiteLabelConfig(id: string) {
  await db.delete(whiteLabelConfig).where(eq(whiteLabelConfig.id, id));
}
