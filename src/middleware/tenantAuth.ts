/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { AppError } from '../lib/errors';
import { TenantPermission, getDefaultPermissionsForRole, hasDefaultPermission } from '../lib/tenantPermissions';
import { db, rolePermissions } from '../db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Middleware factory: require a specific tenant permission.
 *
 * Checks the DB-based role_permissions table for custom overrides first.
 * Falls back to the default role→permission mapping if no overrides exist.
 *
 * Usage: router.get('/route', requireTenantPermission('sales:read'), handler)
 *        router.post('/route', requireTenantPermission(['sales:create', 'sales:update']), handler)
 */
export function requireTenantPermission(...permissions: TenantPermission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication context is missing.', 401));
    }

    const { role, orgId } = req.user;

    if (!orgId) {
      return next(new AppError('Organisation context is required.', 400));
    }

    // Owner bypasses all permission checks
    if (role === 'owner') {
      return next();
    }

    // Check each required permission
    const checkPermission = async () => {
      for (const perm of permissions) {
        const hasPermission = await checkTenantPermission(orgId, role, perm);
        if (!hasPermission) {
          return next(
            new AppError(
              `Forbidden: Missing required permission '${perm}'.`,
              403
            )
          );
        }
      }
      return next();
    };

    checkPermission().catch(next);
  };
}

/**
 * Check whether a user has a specific permission, considering DB overrides.
 */
async function checkTenantPermission(
  orgId: string,
  role: string,
  permission: TenantPermission
): Promise<boolean> {
  // Check for DB overrides for this org+role
  const overrides = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.orgId, orgId),
        eq(rolePermissions.role, role as any)
      )
    );

  if (overrides.length > 0) {
    // Org has custom permission entries for this role — use those
    const grantedPermissions = overrides.map(r => r.permission) as TenantPermission[];
    return grantedPermissions.includes(permission);
  }

  // Fall back to default role mapping
  return hasDefaultPermission(role, permission);
}

/**
 * Get effective permissions for a tenant user (DB overrides + defaults).
 */
export async function getEffectivePermissions(
  orgId: string,
  role: string
): Promise<TenantPermission[]> {
  const overrides = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.orgId, orgId),
        eq(rolePermissions.role, role as any)
      )
    );

  if (overrides.length > 0) {
    return overrides.map(r => r.permission as TenantPermission);
  }

  return getDefaultPermissionsForRole(role);
}
