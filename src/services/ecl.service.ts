import { db, eclParameters, eclComputations, accounts, invoices, contacts } from '../db/schema';
import { AppError } from '../lib/errors';
import { postToGL } from './posting.service';
import { eq, and, sql, asc } from 'drizzle-orm';

export async function getEclParameters(orgId: string) {
  return await db
    .select()
    .from(eclParameters)
    .where(and(eq(eclParameters.orgId, orgId), eq(eclParameters.isActive, true)))
    .orderBy(asc(eclParameters.sortOrder));
}

export async function saveEclParameters(orgId: string, params: { id?: string; bucketLabel: string; minDays: number; maxDays: number; lossRate: number; stage: string; sortOrder: number; isActive: boolean }[]) {
  // Delete existing params for org
  await db.delete(eclParameters).where(eq(eclParameters.orgId, orgId));

  // Insert new params
  for (const p of params) {
    await db.insert(eclParameters).values({
      orgId,
      bucketLabel: p.bucketLabel,
      minDays: p.minDays,
      maxDays: p.maxDays,
      lossRate: String(p.lossRate),
      stage: p.stage,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
    } as any);
  }

  return await getEclParameters(orgId);
}

export async function computeEcl(orgId: string, asOfDate: string) {
  const params = await getEclParameters(orgId);
  if (params.length === 0) throw new AppError('No ECL parameters configured. Save provision matrix rates first.', 400);

  // Get outstanding invoices (unpaid balances)
  const unpaidInvoices = await db
    .select({
      id: invoices.id,
      customerId: invoices.customerId,
      invoiceNumber: invoices.invoiceNumber,
      date: invoices.date,
      dueDate: invoices.dueDate,
      balanceDue: invoices.balanceDue,
      total: invoices.total,
      status: invoices.status,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.orgId, orgId),
        sql`${invoices.status} IN ('sent', 'partial', 'overdue')`,
        sql`${invoices.balanceDue} > 0`
      )
    );

  // Get customer names
  const customerIds = [...new Set(unpaidInvoices.map(i => i.customerId))];
  const customerRows = customerIds.length > 0
    ? await db.select({ id: contacts.id, name: contacts.name }).from(contacts).where(sql`${contacts.id} IN (${customerIds.join(',')}::uuid)`)
    : [];
  const customerMap = new Map(customerRows.map(c => [c.id, c.name]));

  const asOf = new Date(asOfDate);
  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + i.balanceDue, 0);

  // Bucket invoices by overdue days
  const buckets: Record<string, { label: string; balance: number; provision: number; rate: number; stage: string; invoices: any[] }> = {};

  for (const p of params) {
    const key = p.bucketLabel;
    buckets[key] = {
      label: key,
      balance: 0,
      provision: 0,
      rate: Number(p.lossRate),
      stage: p.stage,
      invoices: [],
    };
  }

  for (const inv of unpaidInvoices) {
    const dueDate = new Date(inv.dueDate);
    const diffDays = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    let matchedBucket = params[params.length - 1].bucketLabel; // default to last bucket (90+)

    for (const p of params) {
      if (diffDays >= p.minDays && diffDays <= p.maxDays) {
        matchedBucket = p.bucketLabel;
        break;
      }
    }

    if (buckets[matchedBucket]) {
      buckets[matchedBucket].balance += inv.balanceDue;
      buckets[matchedBucket].invoices.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: customerMap.get(inv.customerId) || 'Unknown',
        customerId: inv.customerId,
        balanceDue: inv.balanceDue,
        dueDate: inv.dueDate,
        overdueDays: diffDays,
      });
    }
  }

  // Calculate provision per bucket
  let totalProvision = 0;
  const bucketDetails: any[] = [];

  for (const p of params) {
    const b = buckets[p.bucketLabel];
    if (b && b.balance > 0) {
      b.provision = Math.round(b.balance * Number(p.lossRate));
      totalProvision += b.provision;
    }
    bucketDetails.push({
      bucketLabel: p.bucketLabel,
      lossRate: Number(p.lossRate),
      totalBalance: b?.balance || 0,
      provision: b?.provision || 0,
      stage: p.stage,
      invoiceCount: b?.invoices.length || 0,
    });
  }

  // Per-customer breakdown
  const customerBreakdown: Record<string, { customerName: string; totalBalance: number; provision: number; buckets: any[] }> = {};

  for (const inv of unpaidInvoices) {
    const dueDate = new Date(inv.dueDate);
    const diffDays = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    let matchedBucket = params[params.length - 1].bucketLabel;
    for (const p of params) {
      if (diffDays >= p.minDays && diffDays <= p.maxDays) { matchedBucket = p.bucketLabel; break; }
    }
    const rate = params.find(p => p.bucketLabel === matchedBucket);
    const lossRate = rate ? Number(rate.lossRate) : 0;
    const provision = Math.round(inv.balanceDue * lossRate);
    const cName = customerMap.get(inv.customerId) || 'Unknown';

    if (!customerBreakdown[inv.customerId]) {
      customerBreakdown[inv.customerId] = { customerName: cName, totalBalance: 0, provision: 0, buckets: [] };
    }
    customerBreakdown[inv.customerId].totalBalance += inv.balanceDue;
    customerBreakdown[inv.customerId].provision += provision;
  }

  // Get previous provision balance
  const allowanceAcct = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.code, '101200')))
    .limit(1);

  let previousProvision = 0;
  if (allowanceAcct.length > 0) {
    const balanceResult = await db.execute(sql`
      SELECT COALESCE(SUM(
        CASE WHEN jl.debit_amount > 0 THEN jl.debit_amount ELSE -jl.credit_amount END
      ), 0) AS balance
      FROM journal_lines jl
      INNER JOIN journal_entries je ON jl.entry_id = je.id
      WHERE jl.account_id = ${allowanceAcct[0].id}::uuid
        AND je.org_id = ${orgId}::uuid
        AND je.status NOT IN ('draft', 'pending_review', 'cancelled')
    `);
    const balanceRow = ((balanceResult as any).rows?.[0] || {}) as any;
    previousProvision = Number(balanceRow?.balance || 0);
  }

  const adjustmentAmount = totalProvision - previousProvision;

  return {
    asOfDate,
    totalReceivables: totalOutstanding,
    totalProvision,
    previousProvision,
    adjustmentAmount,
    bucketDetails,
    customerBreakdown: Object.values(customerBreakdown).sort((a: any, b: any) => b.totalBalance - a.totalBalance),
    invoiceCount: unpaidInvoices.length,
  };
}

export async function postEclProvision(orgId: string, userId: string, asOfDate: string) {
  const computation = await computeEcl(orgId, asOfDate);

  if (computation.adjustmentAmount === 0) {
    throw new AppError('No adjustment needed — current provision already matches computed ECL.', 400);
  }

  // Resolve accounts
  const orgAccounts = await db.select().from(accounts).where(eq(accounts.orgId, orgId));
  const impairmentExpenseAcct = orgAccounts.find(a => a.code === '830000');
  const allowanceAcct = orgAccounts.find(a => a.code === '101200');

  if (!impairmentExpenseAcct || !allowanceAcct) {
    throw new AppError('Impairment Loss account (830000) or Allowance for Impairment account (101200) not found. Please seed accounts.', 400);
  }

  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];

  if (computation.adjustmentAmount > 0) {
    // Additional provision: DR Impairment Loss, CR Allowance for Impairment
    lines.push({
      accountId: impairmentExpenseAcct.id,
      debit: computation.adjustmentAmount,
      credit: 0,
      description: `IFRS 9 ECL provision increase (${computation.totalProvision} - ${computation.previousProvision})`,
    });
    lines.push({
      accountId: allowanceAcct.id,
      debit: 0,
      credit: computation.adjustmentAmount,
      description: `IFRS 9 ECL provision increase`,
    });
  } else {
    // Reversal of excess provision: DR Allowance for Impairment, CR Impairment Loss
    const reversalAmount = Math.abs(computation.adjustmentAmount);
    lines.push({
      accountId: allowanceAcct.id,
      debit: reversalAmount,
      credit: 0,
      description: `IFRS 9 ECL provision decrease (reversal of excess provision)`,
    });
    lines.push({
      accountId: impairmentExpenseAcct.id,
      debit: 0,
      credit: reversalAmount,
      description: `IFRS 9 ECL provision reversal (${computation.previousProvision} - ${computation.totalProvision})`,
    });
  }

  const je = await postToGL({
    orgId,
    date: new Date(asOfDate),
    description: `IFRS 9 ECL provision — ${asOfDate}`,
    reference: `ECL-${asOfDate.replace(/-/g, '')}`,
    source: 'ecl_provision',
    sourceId: `ecl-${asOfDate}`,
    createdBy: userId,
    lines,
  });

  // Record the computation
  const [eclRecord] = await db.insert(eclComputations).values({
    orgId,
    computationDate: new Date(),
    asOfDate: new Date(asOfDate),
    totalReceivables: computation.totalReceivables,
    totalProvision: computation.totalProvision,
    previousProvision: computation.previousProvision,
    adjustmentAmount: computation.adjustmentAmount,
    journalEntryId: je.id,
    details: computation as any,
    status: 'posted',
    createdBy: userId,
  } as any).returning();

  return { computation, journalEntry: je, eclRecord };
}

export async function getEclHistory(orgId: string, limit = 20) {
  return await db
    .select()
    .from(eclComputations)
    .where(eq(eclComputations.orgId, orgId))
    .orderBy(desc(eclComputations.createdAt))
    .limit(limit);
}

export async function getEclDetail(computationId: string, orgId?: string) {
  const conditions: any[] = [eq(eclComputations.id, computationId)];
  if (orgId) conditions.push(eq(eclComputations.orgId, orgId));
  const [record] = await db
    .select()
    .from(eclComputations)
    .where(and(...conditions));

  if (!record) throw new AppError('ECL computation not found', 404);
  return record;
}

function desc(col: any) {
  return sql`${col} DESC`;
}
