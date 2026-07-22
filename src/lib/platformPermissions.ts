/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ==========================================
// PERMISSION DEFINITIONS
// ==========================================
// Format: <domain>:<action>
// Actions: read, create, update, delete, manage (create+update+delete)

export const PlatformPermission = {
  // Users
  UsersRead: 'users:read',
  UsersCreate: 'users:create',
  UsersUpdate: 'users:update',
  UsersDelete: 'users:delete',

  // Organisations
  OrgsRead: 'orgs:read',
  OrgsManage: 'orgs:manage',

  // Subscriptions & Plans
  SubscriptionsRead: 'subscriptions:read',
  SubscriptionsManage: 'subscriptions:manage',
  PlansRead: 'plans:read',
  PlansManage: 'plans:manage',

  // Billing
  BillingRead: 'billing:read',
  BillingManage: 'billing:manage',

  // Analytics & Reports
  AnalyticsRead: 'analytics:read',
  GrowthRead: 'growth:read',

  // System
  SystemRead: 'system:read',
  SystemManage: 'system:manage',
  FeatureFlagsManage: 'feature_flags:manage',
  AuditLogsRead: 'audit_logs:read',

  // Support
  SupportRead: 'support:read',
  SupportManage: 'support:manage',

  // Announcements
  AnnouncementsManage: 'announcements:manage',

  // Marketing
  MarketingManage: 'marketing:manage',

  // Enterprise
  RegionalPricingManage: 'regional_pricing:manage',
  EnterpriseContractsManage: 'enterprise_contracts:manage',
  ResellerContractsManage: 'reseller_contracts:manage',
  OrgConfigManage: 'org_config:manage',
  WhiteLabelManage: 'white_label:manage',

  // Platform Infrastructure
  ApiKeysManage: 'api_keys:manage',
  ImpersonationUse: 'impersonation:use',
} as const;

export type PlatformPermission = (typeof PlatformPermission)[keyof typeof PlatformPermission];

// ==========================================
// ROLE → PERMISSION MAPPING
// ==========================================

const allPermissions = Object.values(PlatformPermission) as PlatformPermission[];

const rolePermissions: Record<string, PlatformPermission[]> = {
  super_admin: allPermissions,

  ceo: [
    PlatformPermission.UsersRead,
    PlatformPermission.OrgsRead, PlatformPermission.OrgsManage,
    PlatformPermission.SubscriptionsRead, PlatformPermission.SubscriptionsManage,
    PlatformPermission.PlansRead,
    PlatformPermission.BillingRead, PlatformPermission.BillingManage,
    PlatformPermission.AnalyticsRead, PlatformPermission.GrowthRead,
    PlatformPermission.SystemRead,
    PlatformPermission.AuditLogsRead,
    PlatformPermission.SupportRead,
    PlatformPermission.AnnouncementsManage,
    PlatformPermission.MarketingManage,
    PlatformPermission.ImpersonationUse,
    PlatformPermission.RegionalPricingManage,
    PlatformPermission.EnterpriseContractsManage,
    PlatformPermission.ResellerContractsManage,
    PlatformPermission.OrgConfigManage,
    PlatformPermission.WhiteLabelManage,
  ],

  director: [
    PlatformPermission.UsersRead,
    PlatformPermission.OrgsRead,
    PlatformPermission.SubscriptionsRead,
    PlatformPermission.PlansRead,
    PlatformPermission.BillingRead,
    PlatformPermission.AnalyticsRead, PlatformPermission.GrowthRead,
    PlatformPermission.SystemRead,
    PlatformPermission.AuditLogsRead,
    PlatformPermission.SupportRead,
    PlatformPermission.RegionalPricingManage,
    PlatformPermission.EnterpriseContractsManage,
    PlatformPermission.ResellerContractsManage,
  ],

  finance: [
    PlatformPermission.OrgsRead,
    PlatformPermission.SubscriptionsRead, PlatformPermission.SubscriptionsManage,
    PlatformPermission.PlansRead, PlatformPermission.PlansManage,
    PlatformPermission.BillingRead, PlatformPermission.BillingManage,
    PlatformPermission.AnalyticsRead, PlatformPermission.GrowthRead,
    PlatformPermission.AuditLogsRead,
  ],

  support: [
    PlatformPermission.UsersRead,
    PlatformPermission.OrgsRead,
    PlatformPermission.SubscriptionsRead,
    PlatformPermission.BillingRead,
    PlatformPermission.SupportRead, PlatformPermission.SupportManage,
    PlatformPermission.AuditLogsRead,
    PlatformPermission.ImpersonationUse,
  ],

  marketing: [
    PlatformPermission.OrgsRead,
    PlatformPermission.AnalyticsRead, PlatformPermission.GrowthRead,
    PlatformPermission.AnnouncementsManage,
    PlatformPermission.MarketingManage,
  ],

  developer: [
    PlatformPermission.UsersRead,
    PlatformPermission.OrgsRead,
    PlatformPermission.SystemRead, PlatformPermission.SystemManage,
    PlatformPermission.FeatureFlagsManage,
    PlatformPermission.ApiKeysManage,
    PlatformPermission.AuditLogsRead,
  ],

  sales: [
    PlatformPermission.OrgsRead,
    PlatformPermission.SubscriptionsRead,
    PlatformPermission.PlansRead,
    PlatformPermission.BillingRead,
    PlatformPermission.EnterpriseContractsManage,
    PlatformPermission.ResellerContractsManage,
  ],

  customer_success: [
    PlatformPermission.UsersRead,
    PlatformPermission.OrgsRead,
    PlatformPermission.SubscriptionsRead,
    PlatformPermission.SupportRead,
  ],

  operations: [
    PlatformPermission.UsersRead,
    PlatformPermission.OrgsRead,
    PlatformPermission.SubscriptionsRead,
    PlatformPermission.PlansRead,
    PlatformPermission.BillingRead,
    PlatformPermission.AnalyticsRead,
    PlatformPermission.SystemRead,
    PlatformPermission.AuditLogsRead,
  ],

  infrastructure: [
    PlatformPermission.OrgsRead,
    PlatformPermission.SystemRead, PlatformPermission.SystemManage,
    PlatformPermission.FeatureFlagsManage,
    PlatformPermission.ApiKeysManage,
    PlatformPermission.AuditLogsRead,
  ],
};

/**
 * Check whether a platform role has a given permission.
 */
export function hasPermission(role: string, permission: PlatformPermission): boolean {
  const perms = rolePermissions[role];
  if (!perms) return false;
  return perms.includes(permission);
}

/**
 * Get all permissions granted to a platform role.
 */
export function getPermissionsForRole(role: string): PlatformPermission[] {
  return rolePermissions[role] ?? [];
}

/**
 * Check whether a token payload represents a tenant user (customer)
 * who should NEVER receive platform permissions.
 */
export function isTenantUser(type?: string, role?: string): boolean {
  return type !== 'platform' && role !== 'super_admin';
}
