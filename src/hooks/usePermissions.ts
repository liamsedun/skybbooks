import { useAuth } from './useAuth';

export type UserRole = 'owner' | 'admin' | 'accountant' | 'manager' | 'staff' | 'administrator' | 'sales' | 'inventory' | 'cashier' | 'auditor' | 'hr' | 'purchasing' | 'employee';

type ModuleName = 'overview' | 'sales' | 'purchases' | 'payroll' | 'banking' | 'reports' | 'settings' | 'inventory' | 'contacts' | 'accounting' | 'tax' | 'fixed_assets' | 'projects' | 'budgets';

type ActionName = 'all' |
  'create:invoice' | 'update:invoice' | 'void:invoice' |
  'create:bill' | 'update:bill' | 'approve:bill' | 'void:bill' |
  'create:expense' | 'update:expense' | 'ocr:receipt' |
  'run:payroll' | 'approve:payroll' | 'pay:payroll' |
  'connect:bank' | 'sync:bank' | 'reconcile:bank' |
  'create:customer' | 'update:customer' |
  'create:vendor' | 'update:vendor' |
  'create:journal' | 'post:journal' |
  'export:report' |
  'manage:coa' |
  'adjust:inventory';

const ROLE_PERMISSIONS: Record<UserRole, { modules: ModuleName[]; actions: ActionName[] }> = {
  owner: {
    modules: ['overview', 'sales', 'purchases', 'payroll', 'banking', 'reports', 'settings', 'inventory', 'contacts', 'accounting', 'tax', 'fixed_assets', 'projects', 'budgets'],
    actions: ['all'],
  },
  admin: {
    modules: ['overview', 'sales', 'purchases', 'payroll', 'banking', 'reports', 'settings', 'inventory', 'contacts', 'accounting', 'tax', 'fixed_assets', 'projects', 'budgets'],
    actions: ['all'],
  },
  administrator: {
    modules: ['overview', 'sales', 'purchases', 'payroll', 'banking', 'reports', 'settings', 'inventory', 'contacts', 'accounting', 'tax', 'fixed_assets', 'projects', 'budgets'],
    actions: ['all'],
  },
  accountant: {
    modules: ['overview', 'sales', 'purchases', 'payroll', 'banking', 'reports', 'settings', 'inventory', 'contacts', 'accounting', 'tax', 'fixed_assets', 'projects', 'budgets'],
    actions: [
      'create:invoice', 'update:invoice', 'void:invoice',
      'create:bill', 'update:bill', 'approve:bill', 'void:bill',
      'create:expense', 'update:expense', 'ocr:receipt',
      'run:payroll', 'approve:payroll', 'pay:payroll',
      'connect:bank', 'sync:bank', 'reconcile:bank',
      'create:customer', 'update:customer',
      'create:vendor', 'update:vendor',
      'create:journal', 'post:journal',
      'export:report',
      'manage:coa',
      'adjust:inventory',
    ],
  },
  manager: {
    modules: ['overview', 'sales', 'purchases', 'reports', 'contacts', 'inventory', 'tax'],
    actions: [
      'create:invoice', 'update:invoice',
      'create:bill', 'update:bill',
      'create:expense', 'update:expense', 'ocr:receipt',
      'create:customer', 'update:customer',
      'create:vendor', 'update:vendor',
      'export:report',
    ],
  },
  sales: {
    modules: ['overview', 'sales', 'contacts', 'reports'],
    actions: [
      'create:invoice', 'update:invoice',
      'create:customer', 'update:customer',
    ],
  },
  inventory: {
    modules: ['overview', 'inventory', 'purchases'],
    actions: [
      'adjust:inventory',
    ],
  },
  cashier: {
    modules: ['overview', 'banking', 'sales'],
    actions: [
      'sync:bank',
    ],
  },
  auditor: {
    modules: ['overview', 'sales', 'purchases', 'payroll', 'banking', 'reports', 'accounting', 'tax', 'inventory'],
    actions: [
      'export:report',
    ],
  },
  hr: {
    modules: ['overview', 'payroll', 'settings'],
    actions: [
      'run:payroll', 'pay:payroll',
    ],
  },
  purchasing: {
    modules: ['overview', 'purchases', 'contacts', 'inventory', 'reports'],
    actions: [
      'create:bill', 'update:bill', 'approve:bill',
      'create:expense', 'update:expense', 'ocr:receipt',
      'create:vendor', 'update:vendor',
      'export:report',
    ],
  },
  staff: {
    modules: ['overview', 'purchases'],
    actions: [
      'create:expense', 'ocr:receipt',
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
    return perms.modules.includes(module as ModuleName);
  };

  const hasActionPermission = (action: string): boolean => {
    const perms = ROLE_PERMISSIONS[role];
    if (!perms) return false;
    if (perms.actions.includes('all')) return true;
    return perms.actions.includes(action as ActionName);
  };

  return {
    role,
    isOwner: role === 'owner',
    isAdmin: role === 'admin' || role === 'administrator',
    isAccountant: role === 'accountant',
    isManager: role === 'manager',
    isSales: role === 'sales',
    isInventory: role === 'inventory',
    isCashier: role === 'cashier',
    isAuditor: role === 'auditor',
    isHr: role === 'hr',
    isPurchasing: role === 'purchasing',
    isEmployee: role === 'employee' || role === 'staff',
    hasModuleAccess,
    hasActionPermission,
  };
}
