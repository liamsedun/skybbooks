import { db } from '../../db';
import { organisations } from '../../db/schema';
import { runScheduledAlerts, checkUpcomingRenewals } from './workflow.service';
import { checkEscalations } from './approval.service';

export async function runAllOrgAlerts(): Promise<{ orgId: string; alerts: string[] }[]> {
  const orgs = await db.select({ id: organisations.id }).from(organisations);
  const results: { orgId: string; alerts: string[] }[] = [];

  for (const org of orgs) {
    try {
      const alerts = await runScheduledAlerts(org.id);
      results.push({ orgId: org.id, alerts });
    } catch (e) {
      console.error(`[Scheduler] runScheduledAlerts error for org ${org.id}:`, e);
    }
  }
  return results;
}

export async function runAllOrgEscalations(): Promise<{ orgId: string; escalated: number }[]> {
  const orgs = await db.select({ id: organisations.id }).from(organisations);
  const results: { orgId: string; escalated: number }[] = [];

  for (const org of orgs) {
    try {
      const count = await checkEscalations(org.id);
      results.push({ orgId: org.id, escalated: count });
    } catch (e) {
      console.error(`[Scheduler] checkEscalations error for org ${org.id}:`, e);
    }
  }
  return results;
}

export async function runAllOrgRenewalChecks(): Promise<{ orgId: string; renewals: string[] }[]> {
  const orgs = await db.select({ id: organisations.id }).from(organisations);
  const results: { orgId: string; renewals: string[] }[] = [];

  for (const org of orgs) {
    try {
      const renewals = await checkUpcomingRenewals(org.id);
      results.push({ orgId: org.id, renewals });
    } catch (e) {
      console.error(`[Scheduler] checkUpcomingRenewals error for org ${org.id}:`, e);
    }
  }
  return results;
}
