import { Shield, ShieldCheck, Lock, Users, Info } from 'lucide-react';

const PLATFORM_PERMISSIONS: Record<string, { icon: string; perms: string[] }> = {
  'Organizations': { icon: '🏢', perms: ['OrgsRead', 'OrgsManage'] },
  'Plans & Subscriptions': { icon: '📋', perms: ['PlansRead', 'PlansManage', 'SubscriptionsRead', 'SubscriptionsManage', 'CouponsManage'] },
  'Billing': { icon: '💳', perms: ['BillingRead', 'BillingManage'] },
  'Analytics': { icon: '📊', perms: ['AnalyticsRead', 'GrowthRead'] },
  'Support': { icon: '🎫', perms: ['SupportRead', 'SupportManage'] },
  'Announcements': { icon: '📢', perms: ['AnnouncementsRead', 'AnnouncementsManage'] },
  'System': { icon: '⚙️', perms: ['SystemRead', 'SystemManage'] },
  'Audit': { icon: '📝', perms: ['AuditLogsRead'] },
  'Regional Pricing': { icon: '🌍', perms: ['RegionalPricingManage'] },
  'Contracts': { icon: '📄', perms: ['EnterpriseContractsManage', 'ResellerContractsManage'] },
  'Configuration': { icon: '🔧', perms: ['OrgConfigManage', 'WhiteLabelManage'] },
  'Advanced': { icon: '🔐', perms: ['ImpersonationUse'] },
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: Object.values(PLATFORM_PERMISSIONS).flatMap(p => p.perms),
  admin: ['OrgsRead', 'OrgsManage', 'PlansRead', 'PlansManage', 'SubscriptionsRead', 'SubscriptionsManage',
    'BillingRead', 'AnalyticsRead', 'GrowthRead', 'SystemRead', 'AnnouncementsRead', 'AnnouncementsManage',
    'RegionalPricingManage', 'EnterpriseContractsManage', 'ResellerContractsManage'],
  billing_manager: ['BillingRead', 'BillingManage', 'SubscriptionsRead', 'SubscriptionsManage', 'CouponsManage', 'AnalyticsRead'],
  support_manager: ['SupportRead', 'SupportManage', 'AnnouncementsRead', 'AnnouncementsManage', 'OrgsRead'],
  analyst: ['AnalyticsRead', 'GrowthRead', 'BillingRead', 'SubscriptionsRead', 'OrgsRead'],
  developer: ['SystemRead', 'SystemManage', 'AnalyticsRead'],
  security_auditor: ['AuditLogsRead', 'SystemRead', 'OrgsRead'],
  marketing_manager: ['AnnouncementsRead', 'AnnouncementsManage', 'CouponsManage', 'AnalyticsRead'],
  onboarding_specialist: ['OrgsRead', 'SubscriptionsRead'],
  compliance_officer: ['AuditLogsRead', 'OrgsRead', 'BillingRead'],
  viewer: ['AnalyticsRead'],
};

export function PlatformRolesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Platform Roles & Permissions</h1>
        <p className="text-sm text-ink-500 mt-1">Role-based access control for platform administrators</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800">Platform RBAC is configured in code at <code className="text-xs bg-blue-100 px-1 rounded">src/lib/platformPermissions.ts</code>. Role-to-permission mapping changes require a deployment.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs bg-surface rounded-xl border">
          <thead>
            <tr className="border-b bg-surface-subtle">
              <th className="text-left p-2 font-medium text-ink-600 min-w-[120px]">Permission</th>
              {Object.keys(ROLE_PERMISSIONS).map(role => (
                <th key={role} className="text-center p-2 font-medium text-ink-600 min-w-[80px]">
                  <div className="text-[10px] uppercase tracking-wider">{role.replace(/_/g, '\n')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(PLATFORM_PERMISSIONS).map(([domain, { perms }]) => (
              <>
                <tr key={domain} className="border-b bg-surface-subtle/50">
                  <td className="p-2 font-semibold text-ink-700" colSpan={Object.keys(ROLE_PERMISSIONS).length + 1}>
                    {domain}
                  </td>
                </tr>
                {perms.map(perm => (
                  <tr key={perm} className="border-b hover:bg-surface-hover">
                    <td className="p-2 pl-4 font-mono text-ink-700">{perm}</td>
                    {Object.entries(ROLE_PERMISSIONS).map(([role, rolePerms]) => (
                      <td key={role} className="text-center p-2">
                        {rolePerms.includes(perm) ? (
                          <span className="inline-block w-4 h-4 rounded-full bg-emerald-500" />
                        ) : (
                          <span className="inline-block w-4 h-4 rounded-full bg-gray-200" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
