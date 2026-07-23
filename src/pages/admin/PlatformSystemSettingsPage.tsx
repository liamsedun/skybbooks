import { Settings, Sliders, Globe, Bell, Shield, Database, Cloud, Zap, Info, Mail } from 'lucide-react';

export function PlatformSystemSettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">System Settings</h1>
        <p className="text-sm text-ink-500 mt-1">Platform-wide configuration and system preferences</p>
      </div>

      <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">System-level configuration is managed through environment variables and the database. Interactive settings UI will be expanded in a future release.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: Globe, label: 'Platform Name', desc: 'Configurable platform branding name across all portal surfaces.' },
          { icon: Mail, label: 'Email Configuration', desc: 'SMTP/HTTP email provider settings for transactional and notification emails.' },
          { icon: Sliders, label: 'Feature Flags', desc: 'Toggle platform-wide features on/off via the Feature Rollouts page.' },
          { icon: Shield, label: 'Rate Limiting', desc: 'Configure API rate limits per endpoint group. Managed via Rate Limits page.' },
          { icon: Cloud, label: 'Backup Settings', desc: 'Automated database backup schedule and retention policy.' },
          { icon: Database, label: 'Data Retention', desc: 'Configurable data retention periods for audit logs and historical data.' },
          { icon: Bell, label: 'Notification Settings', desc: 'Platform-wide notification defaults for announcements and alerts.' },
          { icon: Zap, label: 'Performance', desc: 'Caching, CDN, and performance optimization settings.' },
          { icon: Settings, label: 'Integration Settings', desc: 'Third-party integration configuration (payment gateways, email providers).' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-surface rounded-xl border p-5 hover:border-gray-300 cursor-pointer transition-colors">
            <div className="p-2 rounded-lg w-fit mb-3 bg-surface-hover text-ink-600"><Icon className="w-5 h-5" /></div>
            <h3 className="text-sm font-semibold text-ink-900 mb-1">{label}</h3>
            <p className="text-xs text-ink-500">{desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-xl border">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-ink-700">Environment</h3>
        </div>
        <div className="p-5 text-sm text-ink-600">
          <p>All system-level configuration is read from environment variables at startup. The following variables are currently in use:</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              ['DATABASE_URL', 'PostgreSQL connection string'],
              ['REDIS_URL', 'Redis cache connection'],
              ['RESEND_API_KEY', 'Email sending API key'],
              ['JWT_SECRET', 'JWT signing secret'],
              ['PAYSTACK_SECRET_KEY', 'Payment gateway key'],
              ['FLW_SECRET_KEY', 'Flutterwave secret key'],
              ['MONIEPOINT_SECRET', 'Moniepoint secret'],
              ['NODE_ENV', 'Environment (production/development)'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <code className="bg-surface-hover px-1.5 py-0.5 rounded font-mono">{key}</code>
                <span className="text-ink-400">— {desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
