import { eq, and, or, sql, desc, asc, gte, lte, isNull, count } from 'drizzle-orm';
import { db, organisations, subscriptions, subscriptionPlans, subscriptionInvoices, subscriptionPayments, users, subNotificationTemplates, subNotificationLog, subNotificationPreferences, subNotificationSchedule } from '../db/schema';
import { sendOrgEmail } from './email.service';

type NotificationEvent =
  | 'trial_started' | 'trial_ending' | 'subscription_activated'
  | 'payment_successful' | 'payment_failed'
  | 'renewal_reminder' | 'subscription_expired'
  | 'plan_upgraded' | 'plan_downgraded'
  | 'coupon_applied' | 'storage_limit_reached'
  | 'user_limit_reached' | 'feature_limit_reached';

type NotificationChannel = 'email' | 'in_app' | 'sms' | 'whatsapp';

const DEFAULT_TEMPLATES: Record<NotificationEvent, { email: { subject: string; body: string }; in_app: { body: string } }> = {
  trial_started: {
    email: { subject: 'Your Trial Has Started', body: '<p>Hi {{orgName}},</p><p>Your {{planName}} trial has started and will end on {{trialEnd}}.</p><p>Enjoy exploring SkyBooks!</p>' },
    in_app: { body: 'Your {{planName}} trial has started. Ends {{trialEnd}}.' },
  },
  trial_ending: {
    email: { subject: 'Your Trial Is Ending Soon', body: '<p>Hi {{orgName}},</p><p>Your trial will end on {{trialEnd}}. Subscribe to continue using SkyBooks.</p><p><a href="{{billingUrl}}">Subscribe Now</a></p>' },
    in_app: { body: 'Your trial ends {{trialEnd}}. Subscribe to keep using SkyBooks.' },
  },
  subscription_activated: {
    email: { subject: 'Subscription Activated', body: '<p>Hi {{orgName}},</p><p>Your {{planName}} subscription is now active. Welcome aboard!</p>' },
    in_app: { body: 'Your {{planName}} subscription is now active!' },
  },
  payment_successful: {
    email: { subject: 'Payment Received', body: '<p>Hi {{orgName}},</p><p>Payment of {{amount}} for {{planName}} was successful.</p><p>Thank you for your payment!</p>' },
    in_app: { body: 'Payment of {{amount}} for {{planName}} received successfully.' },
  },
  payment_failed: {
    email: { subject: 'Payment Failed', body: '<p>Hi {{orgName}},</p><p>Your payment of {{amount}} for {{planName}} failed. Reason: {{reason}}</p><p>Please update your payment method to avoid service interruption.</p>' },
    in_app: { body: 'Payment of {{amount}} failed. Please update your payment method.' },
  },
  renewal_reminder: {
    email: { subject: 'Renewal Reminder', body: '<p>Hi {{orgName}},</p><p>Your {{planName}} subscription will renew on {{renewalDate}} for {{amount}}.</p><p>No action needed if you wish to continue.</p>' },
    in_app: { body: 'Your {{planName}} subscription renews on {{renewalDate}}.' },
  },
  subscription_expired: {
    email: { subject: 'Subscription Expired', body: '<p>Hi {{orgName}},</p><p>Your {{planName}} subscription has expired. Renew to restore access.</p><p><a href="{{billingUrl}}">Renew Now</a></p>' },
    in_app: { body: 'Your {{planName}} subscription has expired. Renew now.' },
  },
  plan_upgraded: {
    email: { subject: 'Plan Upgraded', body: '<p>Hi {{orgName}},</p><p>You have been upgraded from {{oldPlan}} to {{newPlan}}.</p><p>Enjoy the new features!</p>' },
    in_app: { body: 'Upgraded from {{oldPlan}} to {{newPlan}}.' },
  },
  plan_downgraded: {
    email: { subject: 'Plan Downgraded', body: '<p>Hi {{orgName}},</p><p>Your plan has been downgraded from {{oldPlan}} to {{newPlan}}.</p><p>Some features may no longer be available.</p>' },
    in_app: { body: 'Downgraded from {{oldPlan}} to {{newPlan}}.' },
  },
  coupon_applied: {
    email: { subject: 'Coupon Applied', body: '<p>Hi {{orgName}},</p><p>Coupon <strong>{{couponCode}}</strong> has been applied to your account.</p><p>{{discountDescription}}</p>' },
    in_app: { body: 'Coupon {{couponCode}} applied. {{discountDescription}}' },
  },
  storage_limit_reached: {
    email: { subject: 'Storage Limit Reached', body: '<p>Hi {{orgName}},</p><p>You have used {{usage}} of your {{limit}} storage.</p><p>Upgrade your plan for more storage.</p>' },
    in_app: { body: 'Storage at {{usage}} / {{limit}}. Upgrade for more.' },
  },
  user_limit_reached: {
    email: { subject: 'User Limit Reached', body: '<p>Hi {{orgName}},</p><p>You have {{userCount}} of {{userLimit}} users active.</p><p>Upgrade your plan to add more users.</p>' },
    in_app: { body: 'Users: {{userCount}} / {{userLimit}}. Upgrade for more.' },
  },
  feature_limit_reached: {
    email: { subject: 'Feature Limit Reached', body: '<p>Hi {{orgName}},</p><p>You have reached the limit for {{featureName}} ({{usage}}/{{limit}}).</p><p>Upgrade your plan to increase limits.</p>' },
    in_app: { body: '{{featureName}} limit reached: {{usage}}/{{limit}}.' },
  },
};

function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`);
}

function fmtNaira(v: number): string {
  return `\u20A6${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

async function getOrgAdmins(orgId: string): Promise<string[]> {
  const rows = await db.select({ email: users.email }).from(users).where(and(eq(users.organisationId, orgId), eq(users.role, 'owner'), eq(users.isActive, true)));
  return rows.map(r => r.email).filter(Boolean) as string[];
}

async function getOrgPreferences(orgId: string) {
  const [prefs] = await db.select().from(subNotificationPreferences).where(eq(subNotificationPreferences.orgId, orgId));
  return prefs || null;
}

async function loadCustomTemplate(orgId: string, eventType: NotificationEvent, channel: NotificationChannel) {
  const [tpl] = await db.select().from(subNotificationTemplates).where(and(eq(subNotificationTemplates.orgId, orgId), eq(subNotificationTemplates.eventType, eventType), eq(subNotificationTemplates.channel, channel), eq(subNotificationTemplates.isActive, true)));
  return tpl || null;
}

function isEventEnabled(prefs: any, eventType: NotificationEvent): boolean {
  if (!prefs) return true;
  if (!prefs.enabledEvents || prefs.enabledEvents.length === 0) return true;
  return prefs.enabledEvents.includes(eventType);
}

function isChannelEnabled(prefs: any, channel: NotificationChannel): boolean {
  if (!prefs) return true;
  if (!prefs.channels || prefs.channels.length === 0) return ['email', 'in_app'].includes(channel);
  return prefs.channels.includes(channel);
}

export async function triggerNotification(
  orgId: string,
  eventType: NotificationEvent,
  data: Record<string, string>,
  channels?: NotificationChannel[],
) {
  const prefs = await getOrgPreferences(orgId);
  if (!isEventEnabled(prefs, eventType)) return [];

  const org = await db.select({ name: organisations.name, email: organisations.email }).from(organisations).where(eq(organisations.id, orgId)).limit(1).then(r => r[0]);
  if (!org) return [];
  data.orgName = data.orgName || org.name || '';

  const defaultRecipients = prefs?.emailRecipients?.length ? prefs.emailRecipients : await getOrgAdmins(orgId);
  const targetChannels: NotificationChannel[] = channels || prefs?.channels || ['email', 'in_app'];
  const results: Array<{ channel: NotificationChannel; status: string; error?: string }> = [];

  for (const channel of targetChannels) {
    if (!isChannelEnabled(prefs, channel)) continue;

    if (channel === 'sms' || channel === 'whatsapp') {
      await db.insert(subNotificationLog).values({ orgId, eventType, channel, status: 'pending', metadata: { data, note: `${channel} channel is future-ready, not yet implemented` } });
      results.push({ channel, status: 'pending' });
      continue;
    }

    const custom = await loadCustomTemplate(orgId, eventType, channel);
    const defaults = DEFAULT_TEMPLATES[eventType];

    if (channel === 'email') {
      const subject = custom?.subject || defaults.email.subject;
      const body = custom?.body || defaults.email.body;
      const renderedSubject = renderTemplate(subject, data);
      const renderedBody = renderTemplate(body, data);

      for (const recipient of defaultRecipients) {
        if (!recipient) continue;
        try {
          const result = await sendOrgEmail(orgId, { to: recipient, subject: renderedSubject, html: renderedBody });
          await db.insert(subNotificationLog).values({ orgId, eventType, channel, recipient, subject: renderedSubject, body: renderedBody, status: result.success ? 'sent' : 'failed', error: result.error, sentAt: new Date() });
          results.push({ channel, status: result.success ? 'sent' : 'failed', error: result.error });
        } catch (err: any) {
          await db.insert(subNotificationLog).values({ orgId, eventType, channel, recipient, subject: renderedSubject, body: renderedBody, status: 'failed', error: err.message, sentAt: new Date() });
          results.push({ channel, status: 'failed', error: err.message });
        }
      }
    }

    if (channel === 'in_app') {
      const body = custom?.body || defaults.in_app.body;
      const renderedBody = renderTemplate(body, data);
      await db.insert(subNotificationLog).values({ orgId, eventType, channel, subject: data.subject || eventType, body: renderedBody, status: 'sent', sentAt: new Date() });
      results.push({ channel, status: 'sent' });
    }
  }

  return results;
}

export async function scheduleNotification(
  orgId: string,
  subscriptionId: string | undefined,
  eventType: NotificationEvent,
  scheduledAt: Date,
  metadata: Record<string, any> = {},
) {
  const [sched] = await db.insert(subNotificationSchedule).values({ orgId, subscriptionId, eventType, scheduledAt, status: 'pending', metadata }).returning();
  return sched;
}

export async function processScheduledNotifications() {
  const now = new Date();
  const due = await db.select().from(subNotificationSchedule).where(and(lte(subNotificationSchedule.scheduledAt, now), eq(subNotificationSchedule.status, 'pending'))).limit(50);

  for (const item of due) {
    try {
      const meta = (item.metadata || {}) as Record<string, string>;
      await triggerNotification(item.orgId, item.eventType as NotificationEvent, meta, undefined);
      await db.update(subNotificationSchedule).set({ status: 'sent', processedAt: new Date() }).where(eq(subNotificationSchedule.id, item.id));
    } catch (err: any) {
      await db.update(subNotificationSchedule).set({ status: 'failed', processedAt: new Date() }).where(eq(subNotificationSchedule.id, item.id));
    }
  }

  return due.length;
}

export async function scheduleTrialEndingReminders() {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const trials = await db.select({ id: subscriptions.id, orgId: subscriptions.orgId, trialEnd: subscriptions.trialEnd, planName: subscriptionPlans.name })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(and(eq(subscriptions.status, 'free_trial'), gte(subscriptions.trialEnd, now), lte(subscriptions.trialEnd, in3Days)));

  for (const t of trials) {
    const existing = await db.select({ count: count() }).from(subNotificationSchedule)
      .where(and(eq(subNotificationSchedule.orgId, t.orgId), eq(subNotificationSchedule.eventType, 'trial_ending'), eq(subNotificationSchedule.status, 'pending')));

    if (Number(existing[0]?.count || 0) === 0) {
      await scheduleNotification(t.orgId, t.id, 'trial_ending', t.trialEnd || in3Days, { orgName: '', planName: t.planName || '', trialEnd: t.trialEnd?.toISOString().slice(0, 10) || '' });
    }
  }
}

export async function scheduleRenewalReminders() {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const renewing = await db.select({ id: subscriptions.id, orgId: subscriptions.orgId, currentPeriodEnd: subscriptions.currentPeriodEnd, planName: subscriptionPlans.name })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(and(eq(subscriptions.status, 'active'), eq(subscriptions.autoRenew, true), gte(subscriptions.currentPeriodEnd, now), lte(subscriptions.currentPeriodEnd, in7Days)));

  for (const r of renewing) {
    const existing = await db.select({ count: count() }).from(subNotificationSchedule)
      .where(and(eq(subNotificationSchedule.orgId, r.orgId), eq(subNotificationSchedule.eventType, 'renewal_reminder'), eq(subNotificationSchedule.status, 'pending')));

    if (Number(existing[0]?.count || 0) === 0) {
      await scheduleNotification(r.orgId, r.id, 'renewal_reminder', r.currentPeriodEnd || in7Days, { orgName: '', planName: r.planName || '', renewalDate: r.currentPeriodEnd?.toISOString().slice(0, 10) || '' });
    }
  }
}

export async function getNotificationLog(orgId?: string, limit = 100, offset = 0) {
  const conditions: any[] = [];
  if (orgId) conditions.push(eq(subNotificationLog.orgId, orgId));

  const rows = await db.select().from(subNotificationLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(subNotificationLog.createdAt))
    .limit(limit)
    .offset(offset);

  const total = await db.select({ count: count() }).from(subNotificationLog)
    .where(conditions.length ? and(...conditions) : undefined);

  return { data: rows, total: Number(total[0]?.count || 0) };
}

// Template CRUD
export async function getTemplates(orgId?: string) {
  const conditions: any[] = [];
  if (orgId) conditions.push(eq(subNotificationTemplates.orgId, orgId));
  return await db.select().from(subNotificationTemplates)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(subNotificationTemplates.eventType));
}

export async function createTemplate(data: any) {
  const [tpl] = await db.insert(subNotificationTemplates).values(data).returning();
  return tpl;
}

export async function updateTemplate(id: string, data: any) {
  const [tpl] = await db.update(subNotificationTemplates).set({ ...data, updatedAt: new Date() }).where(eq(subNotificationTemplates.id, id)).returning();
  return tpl;
}

export async function deleteTemplate(id: string) {
  await db.delete(subNotificationTemplates).where(eq(subNotificationTemplates.id, id));
}

// Preferences CRUD
export async function getPreferences(orgId: string) {
  const [prefs] = await db.select().from(subNotificationPreferences).where(eq(subNotificationPreferences.orgId, orgId));
  return prefs || null;
}

export async function upsertPreferences(orgId: string, data: any) {
  const existing = await getPreferences(orgId);
  if (existing) {
    const [updated] = await db.update(subNotificationPreferences).set({ ...data, updatedAt: new Date() }).where(eq(subNotificationPreferences.orgId, orgId)).returning();
    return updated;
  }
  const [created] = await db.insert(subNotificationPreferences).values({ orgId, ...data }).returning();
  return created;
}


