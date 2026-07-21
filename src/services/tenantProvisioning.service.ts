import bcrypt from 'bcryptjs';
import { eq, and, sql } from 'drizzle-orm';
import { db, organisations, users, subscriptions, subscriptionPlans, sessions } from '../db/schema';
import { seedAccounts } from '../db/seedAccounts';
import { generateAccessToken, generateRefreshToken, hashToken } from '../lib/tokens';
import { sendOrgEmail } from './email.service';
import { addDays, addBillingDuration } from './subscriptionHelpers';

export interface SignupInput {
  email: string;
  password: string;
  fullName: string;
  orgName: string;
  phone?: string;
  planId?: string;
  billingCycle?: string;
  paymentReference?: string;
  metadata?: Record<string, any>;
}

export interface ProvisioningResult {
  user: any;
  org: any;
  subscription: any | null;
  accessToken: string;
  refreshToken: string;
  isNew: boolean;
}

export async function provisionTenant(input: SignupInput): Promise<ProvisioningResult> {
  const emailLower = input.email.toLowerCase();

  const existingUser = await db.select().from(users).where(eq(users.email, emailLower)).limit(1);
  if (existingUser.length > 0) {
    throw new Error('A user with this email address already exists.');
  }

  let selectedPlan: any = null;
  if (input.planId) {
    const plans = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, input.planId)).limit(1);
    selectedPlan = plans[0] || null;
  }

  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(input.password, saltRounds);

  const billingCycle = input.billingCycle || (selectedPlan?.billingCycle as string) || 'monthly';
  const now = new Date();
  const hasTrial = (selectedPlan?.trialDays || 0) > 0;

  const result = await db.transaction(async (tx) => {
    const [newOrg] = await tx.insert(organisations).values({
      name: input.orgName,
      email: emailLower,
      phone: input.phone || null,
    }).returning();

    if (!newOrg) throw new Error('Failed to create organisation.');

    const [newUser] = await tx.insert(users).values({
      email: emailLower,
      passwordHash: hashedPassword,
      fullName: input.fullName,
      role: 'owner',
      organisationId: newOrg.id,
      isActive: true,
    }).returning();

    if (!newUser) throw new Error('Failed to create user account.');

    let subscription: any = null;
    if (selectedPlan) {
      const status = selectedPlan.monthlyPriceKobo === 0 ? 'active'
        : input.paymentReference ? 'active'
        : hasTrial ? 'trialing' : 'incomplete';

      const periodEnd = addBillingDuration(now, billingCycle);

      [subscription] = await tx.insert(subscriptions).values({
        orgId: newOrg.id,
        planId: selectedPlan.id,
        status,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: hasTrial ? now : null,
        trialEnd: hasTrial ? addDays(now, selectedPlan.trialDays) : null,
        billingCycleAnchor: now,
        billingCycle: billingCycle as any,
        autoRenew: true,
        nextBillingDate: hasTrial ? addDays(now, selectedPlan.trialDays) : now,
        metadata: { paymentReference: input.paymentReference || null, ...(input.metadata || {}) },
      } as any).returning();
    }

    return { newOrg, newUser, subscription };
  });

  try {
    await seedAccounts(result.newOrg.id);
  } catch (seedErr) {
    console.error('[Provisioning] Failed to seed COA:', seedErr);
  }

  const payload = {
    userId: result.newUser.id,
    orgId: result.newOrg.id,
    role: result.newUser.role,
    email: result.newUser.email,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  const rTokenHash = hashToken(refreshToken);

  await db.insert(sessions).values({
    userId: result.newUser.id,
    refreshTokenHash: rTokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ipAddress: null,
    userAgent: null,
  });

  try {
    const planName = selectedPlan?.name || 'Free';
    const introLines = [
      `Welcome to SkyBooks, ${input.fullName}!`,
      '',
      `Organisation: ${input.orgName}`,
      `Plan: ${planName}`,
      ...(hasTrial ? [`Trial ends: ${addDays(now, selectedPlan!.trialDays).toLocaleDateString()}`] : []),
      '',
      'Get started:',
      '- Set up your organisation profile',
      '- Invite your team members',
      '- Import your chart of accounts or use the default',
      '- Connect your bank accounts',
      '',
      'Need help? Reply to this email or visit our help centre.',
    ];

    await sendOrgEmail(result.newOrg.id, {
      to: emailLower,
      subject: `Welcome to SkyBooks — ${input.orgName} is ready`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h1 style="color:#1e40af">Welcome to SkyBooks!</h1>
        <p>Hi ${input.fullName},</p>
        <p>Your account for <strong>${input.orgName}</strong> is ready on the <strong>${planName}</strong> plan.</p>
        ${hasTrial ? `<p>Your free trial runs until <strong>${addDays(now, selectedPlan!.trialDays).toLocaleDateString()}</strong>.</p>` : ''}
        <p>Next steps:</p>
        <ul>
          <li>Set up your organisation profile</li>
          <li>Invite your team members</li>
          <li>Connect your bank accounts</li>
        </ul>
        <p style="color:#6b7280;font-size:12px">SkyBooks — Accounting for African Businesses</p>
      </div>`,
    });
  } catch (emailErr) {
    console.error('[Provisioning] Welcome email failed:', emailErr);
  }

  const { passwordHash: _, ...userResponse } = result.newUser;
  return {
    user: userResponse,
    org: result.newOrg,
    subscription: result.subscription,
    accessToken,
    refreshToken,
    isNew: true,
  };
}
