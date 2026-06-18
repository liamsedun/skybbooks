/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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
  rcNumber: z.string().optional()
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
        ...(body.rcNumber !== undefined && { rcNumber: body.rcNumber })
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
// 3. POST /org/logo — Upload logo (Multer, Max 2MB, JPEG/PNG only)
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

export default router;



