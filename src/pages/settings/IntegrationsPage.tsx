import React from 'react';
import { useOrgSettings } from '../../hooks/useOrgSettings';
import { Loader2, AlertCircle, CheckCircle2, Globe, Banknote, CreditCard, FileText, Mail, MessageSquare } from 'lucide-react';

const INTEGRATIONS = [
  { key: 'flutterwave', label: 'Flutterwave', description: 'Payment gateway for online transactions.', icon: CreditCard },
  { key: 'paystack', label: 'Paystack', description: 'Payment processing for African businesses.', icon: Banknote },
  { key: 'resend', label: 'Resend', description: 'Transactional email delivery service.', icon: Mail },
  { key: 'slack', label: 'Slack', description: 'Receive notifications in your Slack workspace.', icon: MessageSquare },
  { key: 'exchangeRateApi', label: 'Exchange Rate API', description: 'Automatic currency rate updates.', icon: Globe },
];

export function IntegrationsSettingsPage() {
  const { settings, save, isPending } = useOrgSettings();
  const integrations: Record<string, boolean> = settings?.integrations || {};

  const toggleIntegration = (key: string) => {
    const updated = { ...integrations, [key]: !integrations[key] };
    save({ integrations: updated });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        {isPending && <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>}
      </div>

      <p className="text-sm text-slate-500">Connect third-party services to extend your accounting platform.</p>

      <div className="grid gap-4">
        {INTEGRATIONS.map(({ key, label, description, icon: Icon }) => {
          const enabled = !!integrations[key];
          return (
            <div key={key} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                </div>
              </div>
              <button
                onClick={() => toggleIntegration(key)}
                className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
