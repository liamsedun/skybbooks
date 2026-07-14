import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import dns from 'dns';
import { Resend } from 'resend';
import { db, emailSettings } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { createAuditLog, extractReqMeta } from '../services/audit.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const updateSchema = z.object({
  protocol: z.enum(['smtp', 'http']).default('smtp'),
  hostname: z.string().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().optional().transform(v => v?.replace(/\s+/g, '')),
  sendCopyTo: z.string().email().optional().or(z.literal('')),
  replyTo: z.string().email().optional().or(z.literal('')),
  useDifferentReplyTo: z.boolean().optional(),
  doNotVerifyTls: z.boolean().optional(),
});

const testSchema = z.object({
  protocol: z.enum(['smtp', 'http']).default('smtp'),
  hostname: z.string().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  password: z.string().optional().transform(v => v?.replace(/\s+/g, '')),
  email: z.string().email('Sender email is required'),
  doNotVerifyTls: z.boolean().optional(),
});

// GET — retrieve org's email settings
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const [settings] = await db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.orgId, orgId))
      .limit(1);

    return res.json({ success: true, data: settings || null });
  } catch (err) {
    next(err);
  }
});

// POST — create or update email settings
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const body = updateSchema.parse(req.body);

    const existing = await db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.orgId, orgId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(emailSettings)
        .set({
          protocol: body.protocol,
          hostname: body.hostname ?? null,
          port: body.port ?? null,
          username: body.username ?? null,
          email: body.email ?? null,
          password: body.password ?? null,
          sendCopyTo: body.sendCopyTo ?? null,
          replyTo: body.replyTo ?? null,
          useDifferentReplyTo: body.useDifferentReplyTo ?? false,
          doNotVerifyTls: body.doNotVerifyTls ?? false,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(emailSettings.id, existing[0].id));
    } else {
      await db.insert(emailSettings).values({
        orgId,
        protocol: body.protocol,
        hostname: body.hostname ?? null,
        port: body.port ?? null,
        username: body.username ?? null,
        email: body.email ?? null,
        password: body.password ?? null,
        sendCopyTo: body.sendCopyTo ?? null,
        replyTo: body.replyTo ?? null,
        useDifferentReplyTo: body.useDifferentReplyTo ?? false,
        doNotVerifyTls: body.doNotVerifyTls ?? false,
        updatedBy: userId,
      });
    }

    await createAuditLog({
      orgId, userId, action: 'update', entityType: 'email-settings', entityId: orgId,
      newValues: { protocol: body.protocol, hostname: body.hostname, email: body.email },
      ...extractReqMeta(req),
    });

    return res.json({ success: true, message: 'Email settings saved.' });
  } catch (err) {
    next(err);
  }
});

// POST /test — send a test email using provided or saved settings
router.post('/test', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = testSchema.parse(req.body);

    if (body.protocol === 'http') {
      // HTTP mode: send via platform Resend account
      const fromEmail = process.env.FROM_EMAIL || 'delivered@resend.dev';
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ success: false, message: 'RESEND_API_KEY is not configured on the server.' });
      }

      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: `SkyBooks Test <${fromEmail}>`,
        to: body.email,
        subject: 'SkyBooks — Email Test (HTTP/Resend)',
        html: '<p>This is a test email from SkyBooks sent via Resend. Your HTTP email configuration is working correctly.</p>',
      });

      return res.json({ success: true, message: 'Test email sent via Resend!', messageId: result?.id });
    }

    // SMTP mode
    if (!body.hostname) {
      return res.status(400).json({ success: false, message: 'SMTP hostname is required.' });
    }
    if (!body.port) {
      return res.status(400).json({ success: false, message: 'SMTP port is required.' });
    }

    // Resolve hostname to IPv4 to avoid ENETUNREACH on IPv6-only hosts
    let host = body.hostname;
    try {
      const addresses = await new Promise<string[]>((resolve, reject) =>
        dns.resolve4(body.hostname, (err, addr) => err ? reject(err) : resolve(addr))
      );
      if (addresses.length > 0) host = addresses[0];
    } catch {
      // fall back to hostname if DNS resolution fails
    }

    const transporter = nodemailer.createTransport({
      host,
      port: body.port,
      secure: body.port === 465,
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 60000,
      auth: body.username || body.email
        ? { user: body.username || body.email!, pass: body.password || '' }
        : undefined,
      tls: body.doNotVerifyTls ? { rejectUnauthorized: false } : undefined,
    });

    await transporter.verify();

    const info = await transporter.sendMail({
      from: body.email,
      to: body.email,
      subject: 'SkyBooks — SMTP Test Email',
      text: 'This is a test email from SkyBooks. Your SMTP configuration is working correctly.',
    });

    return res.json({ success: true, message: 'Test email sent successfully!', messageId: info.messageId });
  } catch (err: any) {
    console.error('[EmailSettings] Test failed:', err?.message || err, err?.issues ? JSON.stringify(err.issues) : '');

    if (err?.issues) {
      const details = err.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return res.status(400).json({ success: false, message: `Validation error: ${details}` });
    }

    const message = err?.response?.includes('Application-specific password required')
      ? 'Gmail requires an app-specific password. Enable 2-step verification and generate an app password.'
      : err?.message || 'Failed to send test email. Check your settings.';
    return res.status(400).json({ success: false, message });
  }
});

// DELETE — reset email settings
router.delete('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    await db.delete(emailSettings).where(eq(emailSettings.orgId, orgId));
    return res.json({ success: true, message: 'Email settings reset.' });
  } catch (err) {
    next(err);
  }
});

export default router;
