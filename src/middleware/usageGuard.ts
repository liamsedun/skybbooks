import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { checkResourceLimit, ResourceType } from '../services/usageMonitor.service';
import { ForbiddenError } from '../lib/errors';

export function usageGuard(...resources: ResourceType[]) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return next();

      for (const resource of resources) {
        const { allowed, metric } = await checkResourceLimit(orgId, resource);
        if (!allowed) {
          throw new ForbiddenError(
            `Your plan limit for ${metric.label} has been reached (${metric.current}/${metric.limit}). Please upgrade your plan to add more.`
          );
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
