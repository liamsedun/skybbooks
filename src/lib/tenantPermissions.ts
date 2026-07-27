/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ==========================================
// TENANT PERMISSION DEFINITIONS
// ==========================================
// Each permission follows the pattern <domain>:<action>
// Domains represent accounting feature areas.
// Actions: read, create, update, delete, approve, manage (all)

export const TenantPermission = {
  // Dashboard / Overview
  DashboardRead: 'dashboard:read',

  // Sales
  SalesRead: 'sales:read',
  SalesCreate: 'sales:create',
  SalesUpdate: 'sales:update',
  SalesDelete: 'sales:delete',
  SalesApprove: 'sales:approve',

  // Purchases / Bills
  PurchasesRead: 'purchases:read',
  PurchasesCreate: 'purchases:create',
  PurchasesUpdate: 'purchases:update',
  PurchasesDelete: 'purchases:delete',
  PurchasesApprove: 'purchases:approve',

  // Banking
  BankingRead: 'banking:read',
  BankingCreate: 'banking:create',
  BankingUpdate: 'banking:update',
  BankingDelete: 'banking:delete',
  BankingReconcile: 'banking:reconcile',
  BankingConnect: 'banking:connect',

  // Reports (including financial statements)
  ReportsRead: 'reports:read',
  ReportsExport: 'reports:export',

  // Accounting / Journal Entries
  AccountingRead: 'accounting:read',
  AccountingCreate: 'accounting:create',
  AccountingUpdate: 'accounting:update',
  AccountingApprove: 'accounting:approve',
  AccountingPost: 'accounting:post',
  AccountingLock: 'accounting:lock',
  AccountingReverse: 'accounting:reverse',

  // Chart of Accounts
  CoaRead: 'coa:read',
  CoaManage: 'coa:manage',

  // Contacts (Customers & Vendors)
  ContactsRead: 'contacts:read',
  ContactsCreate: 'contacts:create',
  ContactsUpdate: 'contacts:update',
  ContactsDelete: 'contacts:delete',

  // Inventory
  InventoryRead: 'inventory:read',
  InventoryCreate: 'inventory:create',
  InventoryUpdate: 'inventory:update',
  InventoryDelete: 'inventory:delete',
  InventoryAdjust: 'inventory:adjust',

  // Payroll
  PayrollRead: 'payroll:read',
  PayrollCreate: 'payroll:create',
  PayrollApprove: 'payroll:approve',
  PayrollPay: 'payroll:pay',

  // Settings / Organisation
  SettingsRead: 'settings:read',
  SettingsUpdate: 'settings:update',
  UsersManage: 'users:manage',
  RolesManage: 'roles:manage',

  // Fixed Assets
  FixedAssetsRead: 'fixed_assets:read',
  FixedAssetsManage: 'fixed_assets:manage',

  // Projects
  ProjectsRead: 'projects:read',
  ProjectsManage: 'projects:manage',

  // Budgeting
  BudgetsRead: 'budgets:read',
  BudgetsManage: 'budgets:manage',

  // Tax
  TaxRead: 'tax:read',
  TaxManage: 'tax:manage',

  // Audit Log
  AuditLogRead: 'audit_log:read',

  // CRM
  CrmRead: 'crm:read',
  CrmCreate: 'crm:create',
  CrmUpdate: 'crm:update',
  CrmDelete: 'crm:delete',

  // HRM
  HrRead: 'hr:read',
  HrCreate: 'hr:create',
  HrUpdate: 'hr:update',
  HrDelete: 'hr:delete',
  HrApprove: 'hr:approve',
  HrExport: 'hr:export',
  HrReports: 'hr:reports',
  HrAdmin: 'hr:admin',
  HrManage: 'hr:manage',
} as const;

export type TenantPermission = (typeof TenantPermission)[keyof typeof TenantPermission];

// ==========================================
// DEFAULT ROLE → PERMISSION MAPPING
// ==========================================
// These defaults apply when no custom DB overrides exist.
// An org admin can customise these via the role_permissions table.

const allTenantPermissions = Object.values(TenantPermission) as TenantPermission[];

const readOnlyPermissions: TenantPermission[] = [
  TenantPermission.DashboardRead,
  TenantPermission.SalesRead,
  TenantPermission.PurchasesRead,
  TenantPermission.BankingRead,
  TenantPermission.ReportsRead,
  TenantPermission.AccountingRead,
  TenantPermission.CoaRead,
  TenantPermission.ContactsRead,
  TenantPermission.InventoryRead,
  TenantPermission.PayrollRead,
  TenantPermission.SettingsRead,
  TenantPermission.FixedAssetsRead,
  TenantPermission.ProjectsRead,
  TenantPermission.BudgetsRead,
  TenantPermission.TaxRead,
  TenantPermission.AuditLogRead,
  TenantPermission.CrmRead,
  TenantPermission.CrmCreate,
  TenantPermission.CrmUpdate,
  TenantPermission.CrmDelete,
  TenantPermission.HrRead,
];

const defaultRolePermissions: Record<string, TenantPermission[]> = {
  owner: allTenantPermissions,

  admin: allTenantPermissions,

  administrator: allTenantPermissions,

  accountant: [
    TenantPermission.DashboardRead,
    TenantPermission.SalesRead, TenantPermission.SalesCreate, TenantPermission.SalesUpdate, TenantPermission.SalesApprove,
    TenantPermission.PurchasesRead, TenantPermission.PurchasesCreate, TenantPermission.PurchasesUpdate, TenantPermission.PurchasesApprove,
    TenantPermission.BankingRead, TenantPermission.BankingCreate, TenantPermission.BankingReconcile, TenantPermission.BankingConnect,
    TenantPermission.ReportsRead, TenantPermission.ReportsExport,
    TenantPermission.AccountingRead, TenantPermission.AccountingCreate, TenantPermission.AccountingUpdate,
    TenantPermission.AccountingApprove, TenantPermission.AccountingPost, TenantPermission.AccountingReverse,
    TenantPermission.CoaRead, TenantPermission.CoaManage,
    TenantPermission.ContactsRead, TenantPermission.ContactsCreate, TenantPermission.ContactsUpdate,
    TenantPermission.InventoryRead,
    TenantPermission.PayrollRead, TenantPermission.PayrollCreate, TenantPermission.PayrollApprove, TenantPermission.PayrollPay,
    TenantPermission.SettingsRead,
    TenantPermission.FixedAssetsRead, TenantPermission.FixedAssetsManage,
    TenantPermission.TaxRead, TenantPermission.TaxManage,
    TenantPermission.AuditLogRead,
    TenantPermission.BudgetsRead, TenantPermission.BudgetsManage,
    TenantPermission.ProjectsRead, TenantPermission.ProjectsManage,
    TenantPermission.CrmRead, TenantPermission.CrmCreate, TenantPermission.CrmUpdate,
  ],

  manager: [
    TenantPermission.DashboardRead,
    TenantPermission.SalesRead, TenantPermission.SalesCreate, TenantPermission.SalesUpdate,
    TenantPermission.PurchasesRead, TenantPermission.PurchasesCreate, TenantPermission.PurchasesUpdate,
    TenantPermission.BankingRead,
    TenantPermission.ReportsRead, TenantPermission.ReportsExport,
    TenantPermission.AccountingRead,
    TenantPermission.CoaRead,
    TenantPermission.ContactsRead, TenantPermission.ContactsCreate, TenantPermission.ContactsUpdate,
    TenantPermission.InventoryRead,
    TenantPermission.SettingsRead,
    TenantPermission.FixedAssetsRead,
    TenantPermission.ProjectsRead, TenantPermission.ProjectsManage,
    TenantPermission.BudgetsRead,
    TenantPermission.TaxRead,
    TenantPermission.CrmRead,
  ],

  sales: [
    TenantPermission.DashboardRead,
    TenantPermission.SalesRead, TenantPermission.SalesCreate, TenantPermission.SalesUpdate,
    TenantPermission.ReportsRead,
    TenantPermission.ContactsRead, TenantPermission.ContactsCreate, TenantPermission.ContactsUpdate,
    TenantPermission.CrmRead, TenantPermission.CrmCreate, TenantPermission.CrmUpdate,
  ],

  inventory: [
    TenantPermission.DashboardRead,
    TenantPermission.PurchasesRead,
    TenantPermission.InventoryRead, TenantPermission.InventoryCreate, TenantPermission.InventoryUpdate,
    TenantPermission.InventoryAdjust,
    TenantPermission.ReportsRead,
  ],

  cashier: [
    TenantPermission.DashboardRead,
    TenantPermission.BankingRead, TenantPermission.BankingCreate,
    TenantPermission.SalesRead,
    TenantPermission.PurchasesRead,
    TenantPermission.ReportsRead,
  ],

  auditor: readOnlyPermissions,

  hr: [
    TenantPermission.DashboardRead,
    TenantPermission.PayrollRead, TenantPermission.PayrollCreate,
    TenantPermission.ReportsRead, TenantPermission.ReportsExport,
    TenantPermission.SettingsRead,
    TenantPermission.HrRead, TenantPermission.HrCreate, TenantPermission.HrUpdate, TenantPermission.HrDelete,
    TenantPermission.HrApprove, TenantPermission.HrExport, TenantPermission.HrReports, TenantPermission.HrAdmin,
  ],

  purchasing: [
    TenantPermission.DashboardRead,
    TenantPermission.PurchasesRead, TenantPermission.PurchasesCreate, TenantPermission.PurchasesUpdate, TenantPermission.PurchasesApprove,
    TenantPermission.ReportsRead,
    TenantPermission.ContactsRead, TenantPermission.ContactsCreate, TenantPermission.ContactsUpdate,
    TenantPermission.InventoryRead,
  ],

  // Legacy role — kept for backward compatibility
  staff: [
    TenantPermission.DashboardRead,
    TenantPermission.PurchasesRead,
  ],
};

/**
 * Get default permissions for a tenant role.
 */
export function getDefaultPermissionsForRole(role: string): TenantPermission[] {
  return defaultRolePermissions[role] ?? [];
}

/**
 * Check whether a tenant role has a given permission by default.
 */
export function hasDefaultPermission(role: string, permission: TenantPermission): boolean {
  const perms = defaultRolePermissions[role];
  if (!perms) return false;
  return perms.includes(permission);
}

/**
 * Check if a user role should NEVER receive Platform-level access.
 * Tenant (customer) roles are platform-isolated.
 */
export function isTenantRole(role: string): boolean {
  return Object.keys(defaultRolePermissions).includes(role);
}
