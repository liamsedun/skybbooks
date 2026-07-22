import { Shield, Users, UserCog, Search, Info } from 'lucide-react';

export function PlatformUsersPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Users</h1>
        <p className="text-sm text-gray-500 mt-1">Manage platform-level administrator accounts</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">Platform User Management</p>
          <p className="text-xs text-amber-700 mt-1">
            Platform administrator accounts are created and managed through the database or registration flow.
            CRUD operations for platform users will be available in a future release.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><UserCog className="w-4 h-4" /> Platform Roles</h3>
        <p className="text-sm text-gray-600 mb-4">Platform administrators are assigned one of the following roles with corresponding permissions:</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-2 font-medium text-gray-600">Role</th>
              <th className="text-left p-2 font-medium text-gray-600">Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['super_admin', 'Full system access — all permissions across all domains'],
              ['admin', 'Administrative access — manage plans, subscriptions, organizations'],
              ['billing_manager', 'Billing and subscription management, payment processing'],
              ['support_manager', 'Support tickets, announcements, and customer communications'],
              ['analyst', 'Read-only access to analytics, reports, and dashboards'],
              ['developer', 'API key management, webhook configuration, integration settings'],
              ['security_auditor', 'Audit log access, security monitoring, compliance checks'],
              ['marketing_manager', 'Marketing content, announcements, promotional campaigns'],
              ['onboarding_specialist', 'Tenant onboarding, organization setup assistance'],
              ['compliance_officer', 'Compliance monitoring, data retention, regulatory reporting'],
              ['viewer', 'Read-only access to platform overview'],
            ].map(([role, desc]) => (
              <tr key={role} className="border-b hover:bg-gray-50">
                <td className="p-2"><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{role}</span></td>
                <td className="p-2 text-gray-600">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
