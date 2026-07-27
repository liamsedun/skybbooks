import { useState } from 'react';
import { Sliders, Shield, Bug, Wifi, Bell, ScrollText, CheckCircle2 } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { useToast } from '../../../contexts/ToastContext';

const defaultConfig = {
  maintenanceMode: false,
  debugLogging: false,
  apiAccess: true,
  webhookNotifications: true,
  auditTrail: true,
};

export function GeneralPage() {
  const { success: showSuccess } = useToast();
  const [config, setConfig] = useState({ ...defaultConfig });
  const [dirty, setDirty] = useState(false);

  const toggle = (key: keyof typeof defaultConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const handleSave = () => {
    showSuccess('System configuration saved');
    setDirty(false);
  };

  const cards = [
    { key: 'maintenanceMode' as const, label: 'Maintenance Mode', description: 'Enable system maintenance mode â€” only admins can access', icon: <Sliders className="w-5 h-5" />, color: 'rose' as const },
    { key: 'debugLogging' as const, label: 'Debug Logging', description: 'Enable verbose debug logging for troubleshooting', icon: <Bug className="w-5 h-5" />, color: 'amber' as const },
    { key: 'apiAccess' as const, label: 'API Access', description: 'Allow external API access to HR services', icon: <Wifi className="w-5 h-5" />, color: 'cyan' as const },
    { key: 'webhookNotifications' as const, label: 'Webhook Notifications', description: 'Send webhook events for HR lifecycle changes', icon: <Bell className="w-5 h-5" />, color: 'purple' as const },
    { key: 'auditTrail' as const, label: 'Audit Trail', description: 'Log all HR data changes for compliance and traceability', icon: <ScrollText className="w-5 h-5" />, color: 'emerald' as const },
  ];

  const colorMap: Record<string, string> = {
    rose: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400',
    amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400',
    purple: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
    slate: 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400',
  };

  return (
    <HrPageShell title="General" description="Miscellaneous HR settings, announcements, help desk, and system-wide configurations"
      pageKey="administration"
      headerActions={
        <button onClick={handleSave} disabled={!dirty}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5" /> Save Configuration
        </button>
      }>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {cards.map(card => (
          <div key={card.key} className={`rounded-2xl border p-5 ${colorMap[card.color]} bg-opacity-50`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${colorMap[card.color]}`}>{card.icon}</div>
                <div>
                  <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">{card.label}</h3>
                  <p className="text-xs text-ink-500 dark:text-ink-400 mt-1 max-w-xs">{card.description}</p>
                </div>
              </div>
              <button
                onClick={() => toggle(card.key)}
                className={`relative w-10 h-5.5 rounded-full transition-all duration-300 shrink-0 ${config[card.key] ? 'bg-primary' : 'bg-ink-200 dark:bg-ink-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-transform duration-300 ${config[card.key] ? 'translate-x-[18px]' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-2xl border border-border-custom p-5 space-y-4">
        <h3 className="text-sm font-semibold text-ink-900">System Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
            <span className="text-xs text-ink-400 block">Version</span>
            <span className="text-sm font-medium text-ink-900">v2.4.1</span>
          </div>
          <div className="p-4 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
            <span className="text-xs text-ink-400 block">Environment</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Production</span>
          </div>
          <div className="p-4 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
            <span className="text-xs text-ink-400 block">Last Updated</span>
            <span className="text-sm font-medium text-ink-900">15 Apr 2026</span>
          </div>
        </div>
      </div>
    </HrPageShell>
  );
}


