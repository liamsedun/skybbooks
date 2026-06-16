/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAuth } from './useAuth';

export type UserRole = 'owner' | 'accountant' | 'manager' | 'employee';

const ROLE_PERMISSIONS: Record<UserRole, { modules: string[]; actions: string[] }> = {
  owner: {
    modules: ['overview', 'sales', 'purchases', 'payroll', 'banking', 'reports', 'settings'],
    actions: ['all'],
  },
  accountant: {
    modules: ['overview', 'sales', 'purchases', 'payroll', 'banking', 'reports', 'settings'],
    actions: [
      'create:invoice', 'update:invoice', 'void:invoice',
      'create:bill', 'update:bill', 'approve:bill', 'void:bill',
      'create:expense', 'update:expense', 'ocr:receipt',
      'run:payroll', 'approve:payroll', 'pay:payroll',
      'connect:bank', 'sync:bank', 'reconcile:bank',
    ],
  },
  manager: {
    modules: ['overview', 'sales', 'purchases', 'settings'],
    actions: [
      'create:invoice', 'update:invoice',
      'create:bill', 'update:bill',
      'create:expense', 'update:expense', 'ocr:receipt',
    ],
  },
  employee: {
    modules: ['overview', 'purchases'],
    actions: [
      'create:expense', 'ocr:receipt',
    ],
  },
};

export function usePermissions() {
  const { user } = useAuth();
  const role: UserRole = (user?.role as UserRole) || 'employee';

  const hasModuleAccess = (module: string): boolean => {
    const perms = ROLE_PERMISSIONS[role];
    if (!perms) return false;
    return perms.modules.includes(module.toLowerCase());
  };

  const hasActionPermission = (action: string): boolean => {
    const perms = ROLE_PERMISSIONS[role];
    if (!perms) return false;
    if (perms.actions.includes('all')) return true;
    return perms.actions.includes(action);
  };

  return {
    role,
    isOwner: role === 'owner',
    isAccountant: role === 'accountant',
    isManager: role === 'manager',
    isEmployee: role === 'employee',
    hasModuleAccess,
    hasActionPermission,
  };
}
