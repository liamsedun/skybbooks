/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../lib/tokens';
import jwt from 'jsonwebtoken';
const { TokenExpiredError, JsonWebTokenError } = jwt;
import { AppError } from '../lib/errors';

/**
 * Interface representing an Express Request containing authenticated user context.
 */
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Middleware that verifies a JWT Bearer token and attaches the decoded
 * user payload ({userId, orgId, role, email}) to the request object.
 */
export function authenticate(
  req: AuthenticatedRequest,
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

  // Allow token via query param for direct-download URLs
  if (!token && req.method === 'GET' && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return next(new AppError('Authentication token is required.', 401));
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    return next();
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

/**
 * Middleware factory to restrict route access to specific roles.
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication context is missing.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Forbidden: You do not have permission to access this resource.', 403));
    }

    return next();
  };
}

/**
 * Middleware ensuring that the user is currently tied to a valid organisation.
 */
export function requireOrg(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(new AppError('Authentication context is missing.', 401));
  }

  if (!req.user.orgId) {
    return next(new AppError('Bad Request: User does not have an active organisation context.', 400));
  }

  return next();
}
