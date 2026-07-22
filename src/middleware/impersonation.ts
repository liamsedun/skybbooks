import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { generateImpersonationToken } from '../lib/tokens';
import { AppError } from '../lib/errors';
import { createAuditLog, extractReqMeta } from '../services/audit.service';

export async function startImpersonation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.user?.role !== 'super_admin') {
      return next(new AppError('Only super administrators can impersonate.', 403));
    }

    const { orgId } = req.body;
    if (!orgId) {
      return next(new AppError('orgId is required.', 400));
    }

    const token = generateImpersonationToken({
      userId: req.user.userId,
      orgId,
      role: 'admin',
      email: req.user.email || 'impersonated@skybooks.app',
      type: 'tenant',
      impersonating: true,
      impersonatedBy: req.user.userId,
    });

    await createAuditLog({
      orgId,
      userId: req.user.userId,
      action: 'impersonate_start',
      entityType: 'organisation',
      entityId: orgId,
      newValues: { impersonatedByEmail: req.user.email },
      ...extractReqMeta(req),
    });

    res.json({ success: true, data: { token, orgId, expiresIn: '5m' } });
  } catch (err) {
    next(err);
  }
}

export async function stopImpersonation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.user?.role !== 'super_admin') {
      return next(new AppError('Only super administrators can stop impersonation.', 403));
    }

    const { orgId } = req.body;
    if (orgId) {
      await createAuditLog({
        orgId,
        userId: req.user.userId,
        action: 'impersonate_stop',
        entityType: 'organisation',
        entityId: orgId,
        newValues: {},
        ...extractReqMeta(req),
      });
    }

    res.json({ success: true, data: { message: 'Impersonation stopped.' } });
  } catch (err) {
    next(err);
  }
}
