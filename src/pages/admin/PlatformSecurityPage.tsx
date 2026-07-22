import { Shield, Key, Users, Lock, Globe, AlertTriangle, Info } from 'lucide-react';

export function PlatformSecurityPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security</h1>
        <p className="text-sm text-gray-500 mt-1">Platform security settings and configuration</p>
      </div>

      <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800">Security settings for the platform are configured via environment variables and database configuration. Interactive management will be available in a future release.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { icon: Lock, label: 'Password Policy', desc: 'Minimum password length, complexity requirements, and expiry periods configured via auth settings.', color: 'blue' },
          { icon: Shield, label: 'Session Management', desc: 'JWT-based sessions with configurable expiry. Access and refresh token rotation enforced.', color: 'purple' },
          { icon: Key, label: 'Two-Factor Authentication', desc: '2FA support for platform admin accounts. TOTP-based with backup codes.', color: 'green' },
          { icon: Globe, label: 'IP Whitelisting', desc: 'Restrict platform admin access to trusted IP ranges. Configurable per admin role.', color: 'indigo' },
          { icon: Users, label: 'Admin RBAC', desc: '11 platform roles with granular 27+ permission definitions for least-privilege access.', color: 'amber' },
          { icon: AlertTriangle, label: 'Audit Trail', desc: 'Comprehensive audit logging with tamper-evident chain verification. All admin actions tracked.', color: 'red' },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className="bg-white rounded-xl border p-5">
            <div className={`p-2 rounded-lg w-fit mb-3 bg-${color}-50 text-${color}-600`}><Icon className="w-5 h-5" /></div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{label}</h3>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-gray-700">Security Best Practices</h3>
        </div>
        <div className="p-5 space-y-3 text-sm text-gray-600">
          <li>Use strong, unique passwords for all platform administrator accounts</li>
          <li>Enable two-factor authentication for sensitive role assignments (super_admin, admin, billing_manager)</li>
          <li>Regularly review audit logs for suspicious activity across all organizations</li>
          <li>Rotate API keys and credentials on a 90-day schedule</li>
          <li>Configure IP whitelisting to restrict platform admin access to trusted networks</li>
          <li>Ensure compliance with data protection regulations (NDPR, GDPR) for tenant data</li>
        </div>
      </div>
    </div>
  );
}
