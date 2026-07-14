import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, emailSettings } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { createAuditLog, extractReqMeta } from '../services/audit.service';
import { sendOrgEmail } from '../services/email.service';

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
  protocol: z.enum(['smtp', 'http']).default('http'),
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

// POST /test — send a test email via the org's configured protocol
router.post('/test', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = testSchema.parse(req.body);

    // For SMTP test, validate fields before calling the shared helper
    if (body.protocol === 'smtp') {
      if (!body.hostname) {
        return res.status(400).json({ success: false, message: 'SMTP hostname is required.' });
      }
      if (!body.port) {
        return res.status(400).json({ success: false, message: 'SMTP port is required.' });
      }
    }

    // Save submitted test fields temporarily so sendOrgEmail can use them
    // We upsert a transient settings row that sendOrgEmail will read
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
          doNotVerifyTls: body.doNotVerifyTls ?? false,
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
        doNotVerifyTls: body.doNotVerifyTls ?? false,
      });
    }

    const result = await sendOrgEmail(orgId, {
      to: body.email,
      subject: body.protocol === 'http'
        ? 'SkyBooks — Email Test (HTTP/Resend)'
        : 'SkyBooks — SMTP Test Email',
      html: body.protocol === 'http'
        ? '<p>This is a test email from SkyBooks sent via Resend. Your HTTP email configuration is working correctly.</p>'
        : '<p>This is a test email from SkyBooks. Your SMTP configuration is working correctly.</p>',
      text: body.protocol !== 'http' ? 'This is a test email from SkyBooks. Your SMTP configuration is working correctly.' : undefined,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error || 'Test email failed.' });
    }

    return res.json({
      success: true,
      message: body.protocol === 'http'
        ? 'Test email sent via Resend!'
        : 'Test email sent successfully!',
      messageId: result.messageId,
    });
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
