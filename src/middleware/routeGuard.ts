/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/tokens';
import jwt from 'jsonwebtoken';
import winston from 'winston';

const { TokenExpiredError, JsonWebTokenError } = jwt;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

const violationCounts = new Map<string, { count: number; timestamp: number }>();
const VIOLATION_WINDOW_MS = 60_000;
const MAX_VIOLATIONS = 10;

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }
  const cookies = (req as any).cookies || {};
  if (req.baseUrl === '/platform') {
    return cookies.platform_token;
  }
  return cookies.app_token;
}

function checkRateLimited(ip: string, path: string): boolean {
  const key = `${ip}:${path}`;
  const now = Date.now();
  const entry = violationCounts.get(key);
  if (entry && now - entry.timestamp < VIOLATION_WINDOW_MS) {
    entry.count++;
    return entry.count > MAX_VIOLATIONS;
  }
  violationCounts.set(key, { count: 1, timestamp: now });
  return false;
}

export function routeGuard(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req as any).requestId || 'unknown';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (req.path === '/login') {
    return next();
  }

  // SPA page loads (GET, no file extension) — let through; React handles auth client-side
  // Note: req.path is relative to the mount point (Express strips /app or /platform prefix)
  if (req.method === 'GET' && !req.path.includes('.')) {
    return next();
  }

  const token = extractToken(req);

  if (!token) {
    if (!checkRateLimited(ip, req.path)) {
      logger.warn(`[${requestId}] UNAUTHORIZED ${req.method} ${req.url} — IP: ${ip} — no token`);
    }
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in.',
      status: 401,
      requestId,
      errorCode: 'TOKEN_MISSING',
    });
    return;
  }

  try {
    const decoded = verifyAccessToken(token);

    if (req.baseUrl === '/platform' && decoded.type !== 'platform') {
      if (!checkRateLimited(ip, req.path)) {
        logger.warn(`[${requestId}] FORBIDDEN ${req.method} ${req.url} — IP: ${ip} — type ${decoded.type || 'tenant'} cannot access platform`);
      }
      res.status(403).json({
        success: false,
        error: 'Forbidden: Platform administrator access required.',
        status: 403,
        requestId,
        errorCode: 'FORBIDDEN_PLATFORM',
      });
      return;
    }

    if (req.baseUrl === '/app' && decoded.type === 'platform') {
      if (!checkRateLimited(ip, req.path)) {
        logger.warn(`[${requestId}] FORBIDDEN ${req.method} ${req.url} — IP: ${ip} — platform token on tenant route`);
      }
      res.status(403).json({
        success: false,
        error: 'Forbidden: Platform tokens cannot access tenant application.',
        status: 403,
        requestId,
        errorCode: 'FORBIDDEN_TENANT',
      });
      return;
    }

    (req as any).user = decoded;
    return next();
  } catch (error) {
    if (!checkRateLimited(ip, req.path)) {
      logger.warn(`[${requestId}] UNAUTHORIZED ${req.method} ${req.url} — IP: ${ip} — ${error instanceof Error ? error.message : 'token validation failed'}`);
    }
    if (error instanceof TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Session expired. Please sign in again.',
        status: 401,
        requestId,
        errorCode: 'TOKEN_EXPIRED',
      });
      return;
    }
    if (error instanceof JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid authentication token.',
        status: 401,
        requestId,
        errorCode: 'TOKEN_INVALID',
      });
      return;
    }
    res.status(401).json({
      success: false,
      error: 'Authentication failed.',
      status: 401,
      requestId,
      errorCode: 'AUTH_FAILED',
    });
  }
}
