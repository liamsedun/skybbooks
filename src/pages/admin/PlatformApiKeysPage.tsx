import { Key, Info, Shield, ExternalLink } from 'lucide-react';

export function PlatformApiKeysPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">API Keys</h1>
        <p className="text-sm text-ink-500 mt-1">Platform API key management and documentation</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">Platform-level API key management coming soon</p>
          <p className="text-xs text-amber-700 mt-1">
            Currently, API keys are managed at the tenant (organization) level. Platform-level API keys
            for programmatic platform management will be available in a future release.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Key, label: 'Tenant API Keys', desc: 'Organizations can create API keys for their own accounting data access. Managed per-org in the customer dashboard.', color: 'blue' },
          { icon: Shield, label: 'Authentication', desc: 'API keys use Bearer token authentication. Include in the Authorization header as "Bearer &lt;key&gt;".', color: 'purple' },
          { icon: ExternalLink, label: 'Documentation', desc: 'Full API documentation with endpoints, request/response examples, and webhook guides.', color: 'green' },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className="bg-surface rounded-xl border p-5">
            <div className={`p-2 rounded-lg w-fit mb-3 bg-${color}-50 text-${color}-600`}><Icon className="w-5 h-5" /></div>
            <h3 className="text-sm font-semibold text-ink-900 mb-1">{label}</h3>
            <p className="text-xs text-ink-500">{desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-xl border">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-ink-700">API Key Usage Guidelines</h3>
        </div>
        <div className="p-5 space-y-4 text-sm text-ink-600">
          <p><span className="font-medium">Rate Limiting:</span> API requests are rate-limited per key. Default limits are configurable per plan tier.</p>
          <p><span className="font-medium">Key Rotation:</span> Rotate keys periodically for security. Each org can have up to 5 active keys.</p>
          <p><span className="font-medium">Scoping:</span> Tenant API keys can be scoped to specific modules (e.g., read-only, sales, purchases).</p>
          <p><span className="font-medium">Revocation:</span> Keys can be revoked at any time by the org admin or platform admin.</p>
        </div>
      </div>
    </div>
  );
}
