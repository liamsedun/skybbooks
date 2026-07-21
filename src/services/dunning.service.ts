import { eq, and, lt, desc } from 'drizzle-orm';
import { db, dunningRuns, subscriptions, organisations } from '../db/schema';
import { sendOrgEmail } from './email.service';

export async function getDunningRuns(orgId: string) {
  return await db.select().from(dunningRuns)
    .where(eq(dunningRuns.orgId, orgId))
    .orderBy(desc(dunningRuns.executedAt));
}

export async function getAllActiveDunningRuns() {
  return await db.select().from(dunningRuns)
    .where(eq(dunningRuns.stage, 'warning'));
}

export async function executeDunningPipeline(): Promise<{ warned: number; suspended: number; archived: number }> {
  let warned = 0, suspended = 0, archived = 0;

  const overdueSubs = await db.select({
    id: subscriptions.id, orgId: subscriptions.orgId, status: subscriptions.status,
    orgName: organisations.name, orgEmail: organisations.email,
  }).from(subscriptions)
    .innerJoin(organisations, eq(subscriptions.orgId, organisations.id))
    .where(and(eq(subscriptions.status, 'past_due' as any), lt(subscriptions.nextBillingDate, new Date())));

  for (const sub of overdueSubs) {
    const [lastRun] = await db.select().from(dunningRuns)
      .where(eq(dunningRuns.subscriptionId, sub.id))
      .orderBy(desc(dunningRuns.executedAt)).limit(1);

    if (!lastRun || lastRun.stage === 'warning') {
      const stage = !lastRun ? 'warning' : 'suspended';
      await db.insert(dunningRuns).values({
        subscriptionId: sub.id, orgId: sub.orgId, stage, executedAt: new Date(), notifiedAt: new Date(),
      } as any);

      await sendOrgEmail(sub.orgId, {
        to: sub.orgEmail || '',
        subject: stage === 'warning' ? 'Payment Reminder: Your subscription is overdue' : 'URGENT: Your subscription has been suspended',
        html: `<div><h2>${stage === 'warning' ? 'Payment Reminder' : 'Subscription Suspended'}</h2><p>Your subscription is overdue. Please update your payment method to avoid service interruption.</p></div>`,
      });

      if (stage === 'warning') warned++;
      else { suspended++; await db.update(subscriptions).set({ status: 'suspended' as any }).where(eq(subscriptions.id, sub.id)); }
    } else if (lastRun.stage === 'suspended') {
      await db.insert(dunningRuns).values({
        subscriptionId: sub.id, orgId: sub.orgId, stage: 'archived', executedAt: new Date(), notifiedAt: new Date(),
      } as any);
      await db.update(subscriptions).set({ status: 'canceled' as any }).where(eq(subscriptions.id, sub.id));
      archived++;
    }
  }
  return { warned, suspended, archived };
}
