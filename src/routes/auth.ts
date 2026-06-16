/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/schema';
import { users, organisations, sessions } from '../db/schema';
import { AppError } from '../lib/errors';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken
} from '../lib/tokens';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ==========================================
// ZOD SCHEMAS FOR CONSTRAINTS VALIDATION
// ==========================================

const registerSchema = z.object({
  orgName: z.string().min(1, 'Organisation name is required.'),
  email: z.string().email('Invalid email address format.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
  fullName: z.string().min(1, 'Full name is required.'),
  phone: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  password: z.string().min(1, 'Password is required.')
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required.')
});

// ==========================================
// 1. POST /auth/register
// ==========================================
router.post('/register', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);

    // Check if the user already exists
    const existingUserList = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1);

    if (existingUserList.length > 0) {
      throw new AppError('A user with this email address already exists.', 400);
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(body.password, saltRounds);

    // Perform database operations inside a transaction
    const result = await db.transaction(async (tx) => {
      // 1. Create Organisation
      const [newOrg] = await tx
        .insert(organisations)
        .values({
          name: body.orgName,
          email: body.email.toLowerCase(),
          phone: body.phone || null
        })
        .returning();

      if (!newOrg) {
        throw new AppError('Failed to create organisation.', 500);
      }

      // 2. Create Owner User
      const [newUser] = await tx
        .insert(users)
        .values({
          email: body.email.toLowerCase(),
          passwordHash: hashedPassword,
          fullName: body.fullName,
          role: 'owner',
          organisationId: newOrg.id,
          isActive: true
        })
        .returning();

      if (!newUser) {
        throw new AppError('Failed to create user account.', 500);
      }

      return { newUser, newOrg };
    });

    // Generate tokens
    const payload = {
      userId: result.newUser.id,
      orgId: result.newOrg.id,
      role: result.newUser.role,
      email: result.newUser.email
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store hashed refresh token in database (sessions)
    const rTokenHash = hashToken(refreshToken);
    await db.insert(sessions).values({
      userId: result.newUser.id,
      refreshTokenHash: rTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null
    });

    const { passwordHash: _, ...userResponse } = result.newUser;

    return res.status(201).json({
      accessToken,
      refreshToken,
      user: userResponse,
      organisation: result.newOrg
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    return next(error);
  }
});

// ==========================================
// 2. POST /auth/login
// ==========================================
router.post('/login', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);

    const userList = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1);

    const user = userList[0];
    if (!user || !user.passwordHash) {
      throw new AppError('Invalid email or password.', 401);
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Please contact your administrator.', 403);
    }

    const isMatch = await bcrypt.compare(body.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Update lastLogin timestamp
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    // Retrieve corresponding Organisation
    let organisation = null;
    if (user.organisationId) {
      const orgList = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, user.organisationId))
        .limit(1);
      organisation = orgList[0] || null;
    }

    const payload = {
      userId: user.id,
      orgId: user.organisationId,
      role: user.role,
      email: user.email
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token
    const rTokenHash = hashToken(refreshToken);
    await db.insert(sessions).values({
      userId: user.id,
      refreshTokenHash: rTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null
    });

    const { passwordHash: _, ...userResponse } = user;

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: userResponse,
      organisation
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    return next(error);
  }
});

// ==========================================
// 3. POST /auth/refresh
// ==========================================
router.post('/refresh', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = refreshSchema.parse(req.body);

    // 1. Verify token signature
    const payload = verifyRefreshToken(body.refreshToken);

    // 2. Confirm token hash matches a session in our database
    const incomingHash = hashToken(body.refreshToken);
    const sessionList = await db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, incomingHash))
      .limit(1);

    const session = sessionList[0];
    if (!session) {
      throw new AppError('Refresh token is invalid or session has expired.', 401);
    }

    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await db.delete(sessions).where(eq(sessions.id, session.id));
      throw new AppError('Refresh token session has expired.', 401);
    }

    // 3. Retrieve fresh user info to get latest role and active status
    const freshUserList = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    const user = freshUserList[0];
    if (!user || !user.isActive) {
      throw new AppError('User account is invalid or inactive.', 401);
    }

    // 4. Rotate/Invalidate the current token session
    await db.delete(sessions).where(eq(sessions.id, session.id));

    // 5. Generate new pair
    const freshPayload = {
      userId: user.id,
      orgId: user.organisationId,
      role: user.role,
      email: user.email
    };

    const newAccessToken = generateAccessToken(freshPayload);
    const newRefreshToken = generateRefreshToken(freshPayload);

    // 6. Save new session
    const newHash = hashToken(newRefreshToken);
    await db.insert(sessions).values({
      userId: user.id,
      refreshTokenHash: newHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    // Token verification errors
    if (error instanceof Error && (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError')) {
      return next(new AppError('Invalid or expired refresh token.', 401));
    }
    return next(error);
  }
});

// ==========================================
// 4. POST /auth/logout (Authenticated)
// ==========================================
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Invalidate the specific token session
      const hash = hashToken(refreshToken);
      await db.delete(sessions).where(eq(sessions.refreshTokenHash, hash));
    } else if (req.user) {
      // Fallback: Clear all sessions of the authenticated user
      await db.delete(sessions).where(eq(sessions.userId, req.user.userId));
    }

    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 5. GET /auth/me (Authenticated)
// ==========================================
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication context is missing.', 401);
    }

    const { userId } = req.user;

    const userList = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = userList[0];
    if (!user) {
      throw new AppError('User profile could not be found.', 404);
    }

    let organisation = null;
    if (user.organisationId) {
      const orgList = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, user.organisationId))
        .limit(1);
      organisation = orgList[0] || null;
    }

    const { passwordHash: _, ...userResponse } = user;

    return res.status(200).json({
      user: userResponse,
      organisation
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
