/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Resend } from 'resend';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
import { eq, and } from 'drizzle-orm';
import { db, organisations, users } from '../db/schema';
import { AppError } from '../lib/errors';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ==========================================
// ZOD SCHEMAS FOR VALIDATING CONFIG PAYLOADS
// ==========================================

const updateOrgSchema = z.object({
  name: z.string().min(1, 'Organisation name cannot be empty.').optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email format.').optional(),
  fiscalYearStart: z.string().optional(),
  vatNumber: z.string().optional(),
  rcNumber: z.string().optional(),
  website: z.string().optional()
});

const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  fullName: z.string().min(1, 'Full name is required.'),
  role: z.enum(['owner', 'accountant', 'staff'])
});

const updateUserSchema = z.object({
  role: z.enum(['owner', 'accountant', 'staff']).optional(),
  isActive: z.boolean().optional()
});

// Apply core authenticated and organisation filters for safety across all routes
router.use(authenticate);
router.use(requireOrg);

// ==========================================
// 1. GET /org — Get current organisation details
// ==========================================
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const orgList = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1);

    const org = orgList[0];
    if (!org) {
      throw new AppError('The active organisation profile could not be found.', 404);
    }

    return res.status(200).json(org);
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 2. PATCH /org — Update organisation settings
// ==========================================
router.patch('/', requireRole('owner', 'accountant'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = updateOrgSchema.parse(req.body);

    const [updatedOrg] = await db
      .update(organisations)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.fiscalYearStart !== undefined && { fiscalYearStart: body.fiscalYearStart }),
        ...(body.vatNumber !== undefined && { vatNumber: body.vatNumber }),
        ...(body.rcNumber !== undefined && { rcNumber: body.rcNumber }),
        ...(body.website !== undefined && { website: body.website })
      })
      .where(eq(organisations.id, orgId))
      .returning();

    if (!updatedOrg) {
      throw new AppError('Organisation could not be updated or was not found.', 404);
    }

    return res.status(200).json(updatedOrg);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    return next(error);
  }
});

// ==========================================
// 3. GET /org/settings — Get org settings JSON
// ==========================================
router.get('/settings', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const [org] = await db
      .select({ settings: organisations.settings })
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1);
    if (!org) throw new AppError('Organisation not found.', 404);
    return res.status(200).json(org.settings || {});
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 4. PATCH /org/settings — Update org settings (merge partial JSON)
// ==========================================
const updateSettingsSchema = z.object({
  settings: z.record(z.any())
});

router.patch('/settings', requireRole('owner', 'accountant'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { settings } = updateSettingsSchema.parse(req.body);

    const [org] = await db
      .select({ existing: organisations.settings })
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1);
    if (!org) throw new AppError('Organisation not found.', 404);

    const merged = { ...(typeof org.existing === 'object' && org.existing !== null ? org.existing : {}), ...settings };

    const [updated] = await db
      .update(organisations)
      .set({ settings: merged })
      .where(eq(organisations.id, orgId))
      .returning({ settings: organisations.settings });

    if (!updated) throw new AppError('Could not update settings.', 500);
    return res.status(200).json(updated.settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    return next(error);
  }
});

// ==========================================
// 5. POST /org/logo — Upload logo (Multer, Max 2MB, JPEG/PNG only)
// ==========================================

const storage = multer.memoryStorage();


const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Only JPEG and PNG formats are allowed.') as any, false);
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB Limit
  fileFilter
}).single('logo');

router.post('/logo', requireRole('owner', 'accountant'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  upload(req, res, async (err) => {
    try {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            throw new AppError('File size limit exceeded. Maximum upload size allowed is 2MB.', 400);
          }
          throw new AppError(`Multer file upload error: ${err.message}`, 400);
        }
        throw new AppError(err.message || 'File upload failed.', 400);
      }

      if (!req.file) {
        throw new AppError('No logo file was provided in the upload request.', 400);
      }

      const orgId = req.user!.orgId!;
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'skybooks/logos', resource_type: 'image' },
          (error, result) => error ? reject(error) : resolve(result)
        );
        stream.end(req.file!.buffer);
      });
      const logoUrl = uploadResult.secure_url;

      const [updatedOrg] = await db
        .update(organisations)
        .set({ logoUrl })
        .where(eq(organisations.id, orgId))
        .returning();

      if (!updatedOrg) {
        throw new AppError('Could not link uploaded logo to the specified organisation.', 404);
      }

      return res.status(200).json({
        message: 'Organisation logo uploaded and updated successfully.',
        logoUrl: updatedOrg.logoUrl,
        organisation: updatedOrg
      });
    } catch (uploadError) {
      return next(uploadError);
    }
  });
});

// ==========================================
// 4. GET /org/users — List all users in org
// ==========================================
router.get('/users', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const userList = await db
      .select()
      .from(users)
      .where(eq(users.organisationId, orgId));

    // Exclude security hashed passwords from the response list
    const safeUserResponse = userList.map(({ passwordHash: _, ...rest }) => rest);

    return res.status(200).json(safeUserResponse);
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 5. POST /org/users/invite — Invite a user
// ==========================================
router.post('/users/invite', requireRole('owner', 'accountant'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = inviteUserSchema.parse(req.body);

    const emailNorm = body.email.toLowerCase();

    // Verify if email is already taken
    const existingUserList = await db
      .select()
      .from(users)
      .where(eq(users.email, emailNorm))
      .limit(1);

    if (existingUserList.length > 0) {
      throw new AppError('A user with this email is already registered or invited.', 400);
    }

    // Insert user with pending state (isActive = false, wait till registration completes)
    const [newUser] = await db
      .insert(users)
      .values({
        email: emailNorm,
        fullName: body.fullName,
        role: body.role,
        organisationId: orgId,
        isActive: false // Invitation is pending, inactive by default until login or onboarding
      })
      .returning();

    if (!newUser) {
      throw new AppError('Failed to create invitation record.', 500);
    }

    // Stub for email dispatch mechanism
    console.log(`[EMAIL STUB] dispatching invitation notification to ${emailNorm} for role of ${body.role}. Open URL: http://localhost:3000/auth/register?email=${encodeURIComponent(emailNorm)}`);

    const { passwordHash: _, ...userResponse } = newUser;

    return res.status(201).json({
      message: `User ${body.fullName} has been successfully invited.`,
      user: userResponse
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    return next(error);
  }
});

// ==========================================
// 6. PATCH /org/users/:userId — Update user configurations (roles or statuses)
// ==========================================
router.patch('/users/:userId', requireRole('owner'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const currentUserId = req.user!.userId;
    const { userId } = req.params;

    const body = updateUserSchema.parse(req.body);

    // Verify the target user belongs in the same organisation context
    const targetUserList = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organisationId, orgId)))
      .limit(1);

    const targetUser = targetUserList[0];
    if (!targetUser) {
      throw new AppError('The requested user is not a member of your organisation profile.', 404);
    }

    // Protection check to prevent lockout of sole owner deactivating or demoting themselves
    if (userId === currentUserId) {
      if (body.isActive === false) {
        throw new AppError('For security constraints, you are not allowed to deactivate your own account.', 400);
      }
      if (body.role && body.role !== 'owner') {
        throw new AppError('For security/lockout constraints, you cannot demote yourself from the owner role.', 400);
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        ...(body.role !== undefined && { role: body.role }),
        ...(body.isActive !== undefined && { isActive: body.isActive })
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new AppError('Failed to apply update settings on the user.', 500);
    }

    const { passwordHash: _, ...safeUser } = updatedUser;

    return res.status(200).json({
      message: 'User profile updated successfully.',
      user: safeUser
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    return next(error);
  }
});

// ==========================================
// 7. POST /org/invite — Invite a user to the org
// ==========================================
const inviteSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  role: z.enum(['admin', 'accountant', 'staff']),
});

router.post('/invite', requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { name, email, role } = inviteSchema.parse(req.body);

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), eq(users.organisationId, orgId)))
      .limit(1);

    if (existing.length > 0) {
      throw new AppError('A user with this email already belongs to your organisation.', 409);
    }

    const token = crypto.randomBytes(24).toString('hex');

    const [org] = await db
      .select({ name: organisations.name, settings: organisations.settings })
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1);

    if (!org) throw new AppError('Organisation not found.', 404);

    const existingSettings = typeof org.settings === 'object' && org.settings !== null ? org.settings : {};
    const invites = Array.isArray((existingSettings as any).invites) ? (existingSettings as any).invites : [];

    invites.push({ name, email, role, token, status: 'pending', createdAt: new Date().toISOString() });

    await db
      .update(organisations)
      .set({ settings: { ...existingSettings, invites } })
      .where(eq(organisations.id, orgId));

    const inviteLink = `${req.protocol}://${req.get('host')}/accept-invite?token=${token}`;

    // Send invite email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || 'delivered@resend.dev';
    let emailSent = false;
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const emailResult = await resend.emails.send({
          from: `SkyBooks <${fromEmail}>`,
          to: email,
          subject: `You've been invited to join ${org.name} on SkyBooks`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #4F46E5;">You're Invited!</h2>
              <p style="color: #374151; font-size: 14px; line-height: 1.6;">
                Hi <strong>${name}</strong>,
              </p>
              <p style="color: #374151; font-size: 14px; line-height: 1.6;">
                <strong>${req.user?.fullName || 'An admin'}</strong> has invited you to join
                <strong>${org.name}</strong> on SkyBooks as a
                <strong>${role.charAt(0).toUpperCase() + role.slice(1)}</strong>.
              </p>
              <p style="color: #374151; font-size: 14px; line-height: 1.6;">
                Click the button below to accept the invitation and set up your account:
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${inviteLink}"
                   style="display: inline-block; padding: 12px 28px; background-color: #4F46E5; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px;">
                  Accept Invitation
                </a>
              </div>
              <p style="color: #9CA3AF; font-size: 12px;">
                Or copy this link into your browser:<br/>
                <span style="font-size: 11px;">${inviteLink}</span>
              </p>
              <p style="color: #9CA3AF; font-size: 12px; margin-top: 16px;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </div>
          `,
        });
        emailSent = true;
        console.log('[Invite] Email sent successfully:', emailResult?.id);
      } catch (emailErr: any) {
        console.error('[Invite] Failed to send email via Resend:', emailErr?.message || emailErr);
      }
    }

    return res.status(201).json({
      message: emailSent
        ? `Invitation sent to ${email}. They'll receive an email with instructions.`
        : `Invite created for ${email}. To deliver the email, verify your sender domain in Resend and set FROM_EMAIL env var. Invite link: ${inviteLink}`,
      inviteLink,
      emailSent,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    return next(error);
  }
});

// ==========================================
// 8. POST /org/users/manual — Manually create a user (bypass invite)
// ==========================================
const manualUserSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  role: z.enum(['admin', 'accountant', 'staff', 'manager']),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

router.post('/users/manual', requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { name, email, role, password } = manualUserSchema.parse(req.body);

    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      throw new AppError('A user with this email already exists.', 400);
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const [created] = await db.insert(users).values({
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      fullName: name,
      role,
      organisationId: orgId,
      isActive: true,
    }).returning();

    if (!created) throw new AppError('Failed to create user.', 500);

    const { passwordHash: _, ...userResponse } = created;
    return res.status(201).json({ message: `User ${name} created successfully.`, user: userResponse });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    return next(error);
  }
});

export default router;




