import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyAccessToken } from '../lib/tokens';
import { AppError } from '../lib/errors';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { platformAuthenticate, platformUserGuard, PlatformAuthenticatedRequest } from '../middleware/platformAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { getTickets, getTicket, getAllTickets, createTicket, addTicketMessage, updateTicketStatus } from '../services/support.service';

const router = Router();

function supportAuth(req: AuthenticatedRequest & PlatformAuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next(new AppError('Authentication token is required.', 401));
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(new AppError('Invalid authorization header format.', 401));
  }
  const token = parts[1];
  try {
    const decoded = verifyAccessToken(token);
    if (decoded.type === 'platform') {
      req.tokenPayload = decoded;
    } else {
      req.user = decoded;
    }
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') return next(new AppError('Access token has expired', 401, 'TOKEN_EXPIRED'));
    if (error.name === 'JsonWebTokenError') return next(new AppError(`Invalid token: ${error.message}`, 401, 'TOKEN_INVALID'));
    return next(new AppError('Authentication failed', 401));
  }
}

router.get('/', authenticate, requireOrg, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await getTickets(req.user!.orgId!, req.query.status as string, req.query.priority as string);
  res.json(ok(data));
}));

router.get('/all', platformAuthenticate, platformUserGuard, asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
  const data = await getAllTickets(req.query.status as string, req.query.priority as string);
  res.json(ok(data));
}));

router.get('/:id', supportAuth, asyncHandler(async (req: AuthenticatedRequest & PlatformAuthenticatedRequest, res: Response) => {
  const data = await getTicket(req.params.id);
  res.json(ok(data));
}));

router.post('/', supportAuth, asyncHandler(async (req: AuthenticatedRequest & PlatformAuthenticatedRequest, res: Response) => {
  const { subject, message, category, priority } = z.object({
    subject: z.string().min(1), message: z.string().min(1),
    category: z.string().optional(), priority: z.string().optional(),
  }).parse(req.body);
  const userId = req.user?.userId || req.tokenPayload?.userId;
  const orgId = req.user?.orgId || null;
  const data = await createTicket(orgId, userId!, { subject, message, category, priority });
  res.status(201).json(ok(data));
}));

router.post('/:id/messages', supportAuth, asyncHandler(async (req: AuthenticatedRequest & PlatformAuthenticatedRequest, res: Response) => {
  const { message, isInternal } = z.object({
    message: z.string().min(1), isInternal: z.boolean().default(false),
  }).parse(req.body);
  const userId = req.user?.userId || req.tokenPayload?.userId;
  const data = await addTicketMessage(req.params.id, userId!, message, isInternal);
  res.status(201).json(ok(data));
}));

router.put('/:id/status', supportAuth, asyncHandler(async (req: AuthenticatedRequest & PlatformAuthenticatedRequest, res: Response) => {
  const { status, resolution, assignedTo } = z.object({
    status: z.string().min(1), resolution: z.string().optional(), assignedTo: z.string().optional(),
  }).parse(req.body);
  const data = await updateTicketStatus(req.params.id, status, resolution, assignedTo);
  res.json(ok(data));
}));

export default router;
