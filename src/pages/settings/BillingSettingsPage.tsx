import React, { useState, useEffect } from 'react';
import { CreditCard, Settings, Save, X, Loader2, Check, Eye, EyeOff, Globe, Lock } from 'lucide-react';
import { subscriptionApi } from '../../lib/api';

export function BillingSettingsPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    setLoading(true);
    try {
      const data = await subscriptionApi.getGatewayConfigs();
      setConfigs(data);
      const editState: Record<string, any> = {};
      const secretVis: Record<string, boolean> = {};
      for (const c of data) {
        editState[c.gateway] = { ...c };
        secretVis[c.gateway] = false;
      }
      setEditing(editState);
      setShowSecrets(secretVis);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function initGateway(gateway: string) {
    setEditing(prev => ({
      ...prev,
      [gateway]: {
        gateway,
        isActive: true,
        isDefault: configs.length === 0,
        environment: 'test',
        publicKey: '',
        secretKey: '',
        webhookSecret: '',
      },
    }));
    setShowSecrets(prev => ({ ...prev, [gateway]: false }));
  }

  function updateGateway(gateway: string, field: string, value: any) {
    setEditing(prev => ({
      ...prev,
      [gateway]: { ...prev[gateway], [field]: value },
    }));
  }

  async function handleSave(gateway: string) {
    const data = editing[gateway];
    if (!data) return;
    setSaving(true);
    try {
      await subscriptionApi.saveGatewayConfig(data);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: `${gateway} configuration saved.` } }));
      await loadConfigs();
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'error', message: `Failed to save ${gateway} config.` } }));
    } finally { setSaving(false); }
  }

  const gateways = [
    { key: 'paystack', name: 'Paystack', url: 'https://dashboard.paystack.com/#/settings/developer', docs: 'Paystack Dashboard → Settings → API Keys & Webhooks' },
    { key: 'flutterwave', name: 'Flutterwave', url: 'https://dashboard.flutterwave.com/dashboard/settings/apis', docs: 'Flutterwave Dashboard → Settings → API Keys' },
    { key: 'stripe', name: 'Stripe (Future)', url: 'https://dashboard.stripe.com/apikeys', docs: 'Stripe Dashboard → Developers → API Keys' },
  ];

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="w-6 h-6 text-slate-600" />
        <h1 className="text-2xl font-bold text-slate-900">Payment Gateway Settings</h1>
      </div>

      <p className="text-sm text-slate-600">
        Configure payment gateways for subscription billing. You can set up Paystack, Flutterwave, or Stripe.
        If no gateway is configured per organisation, the global environment keys will be used.
      </p>

      {gateways.map(gw => {
        const config = editing[gw.key];
        const savedConfig = configs.find((c: any) => c.gateway === gw.key);
        const isConfigured = !!savedConfig?.secretKey;

        return (
          <div key={gw.key} className="rounded-xl bg-white shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isConfigured ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{gw.name}</h2>
                  {isConfigured && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> Configured</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {!config && (
                  <button onClick={() => initGateway(gw.key)} className="px-3 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100">
                    Configure
                  </button>
                )}
              </div>
            </div>

            {config && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Public Key</label>
                    <input
                      type="text" value={config.publicKey || ''}
                      onChange={e => updateGateway(gw.key, 'publicKey', e.target.value)}
                      placeholder="pk_..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Secret Key</label>
                    <div className="relative">
                      <input
                        type={showSecrets[gw.key] ? 'text' : 'password'}
                        value={config.secretKey || ''}
                        onChange={e => updateGateway(gw.key, 'secretKey', e.target.value)}
                        placeholder="sk_..."
                        className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        onClick={() => setShowSecrets(prev => ({ ...prev, [gw.key]: !prev[gw.key] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showSecrets[gw.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Webhook Secret</label>
                    <input
                      type={showSecrets[gw.key] ? 'text' : 'password'}
                      value={config.webhookSecret || ''}
                      onChange={e => updateGateway(gw.key, 'webhookSecret', e.target.value)}
                      placeholder="whsec_..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Environment</label>
                    <select
                      value={config.environment || 'test'}
                      onChange={e => updateGateway(gw.key, 'environment', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="test">Test</option>
                      <option value="live">Live</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.isDefault || false}
                      onChange={e => updateGateway(gw.key, 'isDefault', e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">Set as default gateway</span>
                  </label>
                </div>

                {/* Webhook URLs */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><Globe className="w-4 h-4" /> Webhook URLs</h3>
                  <p className="text-xs text-slate-500 mb-2">Configure these URLs in your {gw.name} dashboard for automatic payment processing.</p>
                  <div className="space-y-1.5">
                    <div className="text-xs">
                      <span className="text-slate-500">Paystack:</span>
                      <code className="ml-2 px-2 py-0.5 bg-slate-100 rounded text-emerald-700">{window.location.origin}/api/subscriptions/webhooks/paystack</code>
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-500">Flutterwave:</span>
                      <code className="ml-2 px-2 py-0.5 bg-slate-100 rounded text-emerald-700">{window.location.origin}/api/subscriptions/webhooks/flutterwave</code>
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-500">Stripe:</span>
                      <code className="ml-2 px-2 py-0.5 bg-slate-100 rounded text-emerald-700">{window.location.origin}/api/subscriptions/webhooks/stripe</code>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button onClick={() => {
                    setEditing((prev: any) => { const n = { ...prev }; delete n[gw.key]; return n; });
                    setShowSecrets((prev: any) => { const n = { ...prev }; delete n[gw.key]; return n; });
                  }} disabled={saving} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
                    Cancel
                  </button>
                  <button onClick={() => handleSave(gw.key)} disabled={saving || !config.secretKey}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Configuration</>}
                  </button>
                </div>
              </div>
            )}

            {!config && !isConfigured && (
              <p className="text-sm text-slate-400 text-center py-4">No configuration set. Click "Configure" to add your API keys.</p>
            )}

            {isConfigured && !config && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Environment: <span className="font-medium capitalize">{savedConfig.environment}</span></p>
                  {savedConfig.isDefault && <p className="text-xs text-emerald-600">Default gateway</p>}
                </div>
                <button onClick={() => initGateway(gw.key)} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
                  Edit
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Global environment note */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Global Environment Keys</p>
            <p className="text-xs text-amber-700 mt-1">
              If no per-organisation gateway configuration is found, the system falls back to global environment variables
              (<code className="px-1 bg-amber-100 rounded">PAYSTACK_SECRET_KEY</code>, <code className="px-1 bg-amber-100 rounded">FLW_SECRET_KEY</code>).
              Configure per-org keys above for fine-grained control or multi-tenant setups.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BillingSettingsPage;
