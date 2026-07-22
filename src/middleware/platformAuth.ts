/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../lib/tokens';
import { db, platformUsers } from '../db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors';

const { TokenExpiredError, JsonWebTokenError } = jwt;

export interface PlatformAuthenticatedRequest extends Request {
  platformUser?: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
    isActive: boolean;
  };
  tokenPayload?: TokenPayload;
}

import { Request } from 'express';

export function platformAuthenticate(
  req: PlatformAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return next(new AppError('Authentication token is required.', 401));
  }

  try {
    const decoded = verifyAccessToken(token);

    if (decoded.type && decoded.type !== 'platform') {
      return next(new AppError('This endpoint requires platform administrator credentials.', 403));
    }

    req.tokenPayload = decoded;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return next(new AppError('Access token has expired', 401, 'TOKEN_EXPIRED'));
    }
    if (error instanceof JsonWebTokenError) {
      return next(new AppError(`Invalid token: ${error.message}`, 401, 'TOKEN_INVALID'));
    }
    const message = error instanceof Error ? error.message : 'Invalid token';
    return next(new AppError(`Authentication failed: ${message}`, 401));
  }
}

export function platformUserGuard(
  req: PlatformAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const payload = req.tokenPayload;
  if (!payload) {
    return next(new AppError('Authentication context is missing.', 401));
  }

  db.select({
    id: platformUsers.id,
    email: platformUsers.email,
    fullName: platformUsers.fullName,
    role: platformUsers.role,
    isActive: platformUsers.isActive,
  })
    .from(platformUsers)
    .where(eq(platformUsers.id, payload.userId))
    .limit(1)
    .then((rows) => {
      const user = rows[0];
      if (!user) {
        return next(new AppError('Platform user not found.', 401));
      }
      if (!user.isActive) {
        return next(new AppError('Platform account has been deactivated.', 403));
      }
      req.platformUser = user;
      next();
    })
    .catch(next);
}

export function requirePlatformRole(...roles: string[]) {
  return (req: PlatformAuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.platformUser) {
      return next(new AppError('Authentication context is missing.', 401));
    }
    if (!roles.includes(req.platformUser.role)) {
      return next(new AppError('Forbidden: You do not have the required platform role.', 403));
    }
    return next();
  };
}
