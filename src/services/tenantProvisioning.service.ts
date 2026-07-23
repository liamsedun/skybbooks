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
  // If no plan selected, auto-assign the Free plan so a subscription record is always created
  if (!selectedPlan) {
    const freePlans = await db.select().from(subscriptionPlans)
      .where(and(eq(subscriptionPlans.monthlyPriceKobo, 0), eq(subscriptionPlans.isActive, true)))
      .limit(1);
    selectedPlan = freePlans[0] || null;
  }

  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(input.password, saltRounds);

  const billingCycle = input.billingCycle || (selectedPlan?.billingCycle as string) || 'monthly';
  const now = new Date();
  const hasTrial = (selectedPlan?.trialDays || 0) > 0;

  const result = await db.transaction(async (tx) => {
    // Use raw SQL to avoid Drizzle generating ALL columns (some may not yet exist if migration is still running)
    const result = await tx.execute(sql`
      INSERT INTO organisations (id, name, email, phone)
      VALUES (gen_random_uuid(), ${input.orgName}, ${emailLower}, ${input.phone || null})
      RETURNING id, name, email, phone, address, logo_url, base_currency, fiscal_year_start, live_gl_start_fiscal_year, legacy_system_name, vat_number, rc_number, website, settings, created_at
    `);
    const newOrg = (result as any).rows?.[0] || (result as any)[0];

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
        : hasTrial ? 'free_trial' : 'pending_payment';

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
    type: 'tenant' as const,
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
    const trialText = hasTrial ? `Trial ends: ${addDays(now, selectedPlan!.trialDays).toLocaleDateString()}` : '';

    const loginUrl = 'https://skyaccounting.com.ng/app/login';
    const trialNote = hasTrial ? `<p style="margin:16px 0 0;font-size:14px;color:#475569">Your free trial runs until <strong>${addDays(now, selectedPlan!.trialDays).toLocaleDateString()}</strong>.</p>` : '';

    await sendOrgEmail(result.newOrg.id, {
      to: emailLower,
      subject: `Welcome to SkyBooks — ${input.orgName} is ready`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#082F49 0%,#0e4b75 100%);padding:36px 40px 28px;text-align:center">
    <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.3px">Welcome to SkyBooks</h1>
    <p style="margin:8px 0 0;font-size:15px;color:#94b8d9;font-weight:400">Your financial command centre is ready</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px 40px 24px">
    <p style="margin:0 0 6px;font-size:16px;color:#1e293b">Hi ${input.fullName},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6">
      Your account for <strong style="color:#082F49">${input.orgName}</strong> has been provisioned on the <strong style="color:#082F49">${planName}</strong> plan.
    </p>
    ${trialNote}
    <!-- Next Steps -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;margin:20px 0;padding:20px 24px">
      <tr><td>
        <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#082F49;text-transform:uppercase;letter-spacing:0.5px">Quick start guide</p>
        <table cellpadding="0" cellspacing="0">
          <tr><td width="28" valign="top" style="font-size:14px;color:#082F49;font-weight:700;line-height:1.8">1.</td><td style="font-size:14px;color:#334155;line-height:1.8">Set up your organisation profile</td></tr>
          <tr><td width="28" valign="top" style="font-size:14px;color:#082F49;font-weight:700;line-height:1.8">2.</td><td style="font-size:14px;color:#334155;line-height:1.8">Invite your team members</td></tr>
          <tr><td width="28" valign="top" style="font-size:14px;color:#082F49;font-weight:700;line-height:1.8">3.</td><td style="font-size:14px;color:#334155;line-height:1.8">Import your chart of accounts or use the default</td></tr>
          <tr><td width="28" valign="top" style="font-size:14px;color:#082F49;font-weight:700;line-height:1.8">4.</td><td style="font-size:14px;color:#334155;line-height:1.8">Connect your bank accounts</td></tr>
        </table>
      </td></tr>
    </table>
    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:8px 0 20px">
        <table cellpadding="0" cellspacing="0">
          <tr><td align="center" style="background:linear-gradient(135deg,#082F49 0%,#0e4b75 100%);border-radius:10px;padding:0">
            <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:14px 48px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px">Sign in to SkyBooks</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px">
    <!-- Contact & Signature -->
    <p style="margin:0 0 6px;font-size:13px;color:#94a3b8">Need help? Reach out to our team:</p>
    <p style="margin:0 0 2px;font-size:13px;color:#475569">Email: <a href="mailto:hello@skyaccounting.com.ng" style="color:#082F49;text-decoration:none;font-weight:500">hello@skyaccounting.com.ng</a></p>
    <p style="margin:0 0 2px;font-size:13px;color:#475569">Phone: +234 803 123 4567</p>
    <p style="margin:0 0 16px;font-size:13px;color:#475569">Website: <a href="https://skyaccounting.com.ng" style="color:#082F49;text-decoration:none;font-weight:500">skyaccounting.com.ng</a></p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px">
    <p style="margin:0;font-size:14px;color:#334155;line-height:1.6">
      Best regards,<br>
      <strong style="color:#082F49;font-size:15px">Olalekan Williams EDUN</strong><br>
      <span style="color:#475569;font-size:13px">Chief Executive Officer</span><br>
      <span style="color:#0e4b75;font-size:13px;font-weight:600">Skyhouse Accountants &amp; Fintech</span>
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:16px 40px;text-align:center">
    <p style="margin:0;font-size:12px;color:#94a3b8">SkyBooks — All-in-one accounting platform for African SMEs</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
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
