import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import dns from 'dns';
import { eq } from 'drizzle-orm';
import { db, emailSettings, organisations } from '../db/schema';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Override the From display name. For org emails defaults to "${orgName} via SkyBooks". For platform emails like invites, pass "SkyBooks". */
  fromName?: string;
}

/**
 * Sends an email on behalf of an organisation, respecting their configured
 * protocol (http = built-in Resend, smtp = their own SMTP server).
 *
 * HTTP mode uses the platform-wide Resend account (RESEND_API_KEY env var)
 * with the org's name in the From display and their configured email as
 * Reply-To. No per-org credentials required.
 *
 * SMTP mode uses the org's stored SMTP credentials from the email_settings
 * table.
 *
 * If no emailSettings row exists, defaults to HTTP (Resend) so email works
 * out of the box with zero setup.
 *
 * If the org has configured sendCopyTo, a BCC copy is sent to that address.
 */
export async function sendOrgEmail(
  orgId: string,
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, subject, html, text } = options;

  const [org] = await db
    .select({ name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  const orgName = org?.name || 'SkyBooks User';
  const displayName = options.fromName || `${orgName} via SkyBooks`;

  const [settings] = await db
    .select()
    .from(emailSettings)
    .where(eq(emailSettings.orgId, orgId))
    .limit(1);

  const protocol = settings?.protocol || 'http';
  const bcc = settings?.sendCopyTo || undefined;

  if (protocol === 'http') {
    return sendViaResend(displayName, settings, { to, subject, html, text, bcc });
  }

  return sendViaSmtp(settings, { to, subject, html, text, bcc });
}

async function sendViaResend(
  displayName: string,
  settings: any,
  options: SendEmailOptions & { bcc?: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || 'delivered@resend.dev';

  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY is not configured.' };
  }

  const replyTo = settings?.useDifferentReplyTo && settings?.replyTo
    ? settings.replyTo
    : settings?.email || undefined;

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: `${displayName} <${fromEmail}>`,
      to: options.to,
      replyTo,
      bcc: options.bcc,
      subject: options.subject,
      html: options.html,
      ...(options.text && { text: options.text }),
    });
    return { success: true, messageId: result?.id };
  } catch (err: any) {
    console.error('[EmailService] Resend failed:', err?.message || err);
    return { success: false, error: err?.message || 'Resend email failed.' };
  }
}

async function sendViaSmtp(
  settings: any,
  options: SendEmailOptions & { bcc?: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!settings || !settings.hostname || !settings.email) {
    return { success: false, error: 'SMTP settings incomplete (hostname and email required).' };
  }

  let host = settings.hostname;
  try {
    const addresses = await new Promise<string[]>((resolve, reject) =>
      dns.resolve4(settings.hostname, (err, addr) => err ? reject(err) : resolve(addr))
    );
    if (addresses.length > 0) host = addresses[0];
  } catch {
    // fall back to hostname
  }

  const transporter = nodemailer.createTransport({
    host,
    port: settings.port || 587,
    secure: settings.port === 465,
    connectionTimeout: 30000,
    greetingTimeout: 15000,
    socketTimeout: 60000,
    auth: settings.username || settings.email
      ? { user: settings.username || settings.email, pass: settings.password || '' }
      : undefined,
    tls: settings.doNotVerifyTls ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const info = await transporter.sendMail({
      from: settings.email,
      to: options.to,
      bcc: options.bcc,
      subject: options.subject,
      html: options.html,
      ...(options.text && { text: options.text }),
    });
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error('[EmailService] SMTP failed:', err?.message || err);
    return { success: false, error: err?.message || 'SMTP email failed.' };
  }
}
