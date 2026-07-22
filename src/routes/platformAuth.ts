import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, platformUsers, platformSessions } from '../db/schema';
import { AppError } from '../lib/errors';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken
} from '../lib/tokens';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  password: z.string().min(1, 'Password is required.')
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required.')
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/platform',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setPlatformCookie(res: Response, token: string) {
  res.cookie('platform_token', token, COOKIE_OPTIONS);
}

// ── POST /platform/auth/login ──

router.post('/login', async (req: any, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);

    const userList = await db
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.email, body.email.toLowerCase()))
      .limit(1);

    const platformUser = userList[0];
    if (!platformUser || !platformUser.passwordHash) {
      throw new AppError('Invalid email or password.', 401);
    }

    if (!platformUser.isActive) {
      throw new AppError('Your platform account has been deactivated.', 403);
    }

    const isMatch = await bcrypt.compare(body.password, platformUser.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401);
    }

    await db
      .update(platformUsers)
      .set({ lastLogin: new Date() })
      .where(eq(platformUsers.id, platformUser.id));

    const payload = {
      userId: platformUser.id,
      orgId: null,
      role: platformUser.role,
      email: platformUser.email,
      type: 'platform' as const,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const rTokenHash = hashToken(refreshToken);
    await db.insert(platformSessions).values({
      platformUserId: platformUser.id,
      refreshTokenHash: rTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null,
    });

    const { passwordHash: _, ...userResponse } = platformUser;

    setPlatformCookie(res, accessToken);

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: userResponse,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    return next(error);
  }
});

// ── POST /platform/auth/refresh ──

router.post('/refresh', async (req: any, res: Response, next: NextFunction) => {
  try {
    const body = refreshSchema.parse(req.body);

    const payload = verifyRefreshToken(body.refreshToken);

    if (payload.type !== 'platform') {
      throw new AppError('Tenant tokens must use /auth/refresh.', 401);
    }

    const incomingHash = hashToken(body.refreshToken);
    const sessionList = await db
      .select()
      .from(platformSessions)
      .where(eq(platformSessions.refreshTokenHash, incomingHash))
      .limit(1);

    const session = sessionList[0];
    if (!session) {
      console.warn(`[Auth] Platform refresh failed: session not found for platformUserId=${payload.userId}`);
      throw new AppError('Refresh token is invalid or session has expired.', 401);
    }

    if (session.expiresAt < new Date()) {
      await db.delete(platformSessions).where(eq(platformSessions.id, session.id));
      console.info(`[Auth] Platform refresh: session expired for platformUserId=${payload.userId}`);
      throw new AppError('Refresh token session has expired.', 401);
    }

    const freshUserList = await db
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.id, payload.userId))
      .limit(1);

    const platformUser = freshUserList[0];
    if (!platformUser || !platformUser.isActive) {
      console.warn(`[Auth] Platform refresh failed: account inactive or not found for platformUserId=${payload.userId}`);
      throw new AppError('Platform account is invalid or inactive.', 401);
    }

    await db.delete(platformSessions).where(eq(platformSessions.id, session.id));

    const freshPayload = {
      userId: platformUser.id,
      orgId: null,
      role: platformUser.role,
      email: platformUser.email,
      type: 'platform' as const,
    };

    const newAccessToken = generateAccessToken(freshPayload);
    const newRefreshToken = generateRefreshToken(freshPayload);

    const newHash = hashToken(newRefreshToken);
    await db.insert(platformSessions).values({
      platformUserId: platformUser.id,
      refreshTokenHash: newHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null,
    });

    console.info(`[Auth] Platform token refreshed successfully for platformUserId=${platformUser.id}`);

    setPlatformCookie(res, newAccessToken);

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    if (error instanceof Error && (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError')) {
      console.warn(`[Auth] Platform refresh failed: verifyRefreshToken threw ${error.name}`);
      return next(new AppError('Invalid or expired refresh token.', 401));
    }
    return next(error);
  }
});

// ── POST /platform/auth/logout ──

router.post('/logout', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const hash = hashToken(refreshToken);
      await db.delete(platformSessions).where(eq(platformSessions.refreshTokenHash, hash));
    }

    res.clearCookie('platform_token', { path: '/platform' });

    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    res.clearCookie('platform_token', { path: '/platform' });
    return next(error);
  }
});

export default router;
