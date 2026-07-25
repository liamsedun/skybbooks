import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings, Save, Loader2, RefreshCw, Globe, Mail, Shield,
  Cloud, Database, Bell, Zap, CheckCircle2, XCircle, ChevronDown, ChevronRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

interface ConfigDefaults {
  [key: string]: { default: any; description: string; type: string };
}

interface ConfigValue {
  key: string;
  value: any;
  default: any;
  description: string;
  type: string;
}

const CATEGORIES: { name: string; icon: any; keys: string[] }[] = [
  { name: 'Branding', icon: Globe, keys: ['platform_name'] },
  { name: 'Email', icon: Mail, keys: ['email_from_name', 'email_from_address'] },
  { name: 'Backups', icon: Cloud, keys: ['backup_enabled', 'backup_retention_days'] },
  { name: 'Data & Security', icon: Shield, keys: ['data_retention_days', 'maintenance_mode'] },
  { name: 'Notifications', icon: Bell, keys: ['notification_defaults'] },
  { name: 'Performance', icon: Zap, keys: [] },
];

function fmtLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function PlatformSystemSettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['platform-config'],
    queryFn: async () => {
      const res = await api.get('/platform/platform-config');
      return { values: res.data.data as Record<string, any>, defaults: res.data.defaults as ConfigDefaults };
    },
  });

  const saveMut = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      await api.put(`/platform/platform-config/${encodeURIComponent(key)}`, { value });
    },
    onSuccess: (_data, vars) => {
      const next = { ...edits };
      delete next[vars.key];
      setEdits(next);
      qc.invalidateQueries({ queryKey: ['platform-config'] });
      toast.toast(`${fmtLabel(vars.key)} saved`, 'success');
    },
    onError: (err: any) => toast.toast(err.response?.data?.error || 'Failed to save', 'error'),
  });

  const allConfigs: ConfigValue[] = data
    ? Object.entries(data.defaults).map(([key, def]) => ({
        key,
        value: data.values[key] !== undefined ? data.values[key] : def.default,
        default: def.default,
        description: def.description,
        type: def.type,
      }))
    : [];

  function getValue(key: string) {
    if (edits[key] !== undefined) return edits[key];
    const cfg = allConfigs.find(c => c.key === key);
    return cfg?.value;
  }

  function setEdit(key: string, value: any) {
    setEdits(prev => ({ ...prev, [key]: value }));
  }

  function hasEdit(key: string) {
    const cfg = allConfigs.find(c => c.key === key);
    if (!cfg) return false;
    return edits[key] !== undefined && JSON.stringify(edits[key]) !== JSON.stringify(cfg.value);
  }

  function discard(key: string) {
    const next = { ...edits };
    delete next[key];
    setEdits(next);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">System Settings</h1>
          <p className="text-sm text-ink-500 mt-1">Platform-wide configuration and system preferences</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { qc.invalidateQueries({ queryKey: ['platform-config'] }); setEdits({}); }}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-subtle">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.map(cat => {
            const catConfigs = allConfigs.filter(c => cat.keys.includes(c.key));
            if (cat.keys.length > 0 && catConfigs.length === 0) return null;
            return (
              <div key={cat.name} className="bg-surface rounded-xl border">
                <button onClick={() => setExpanded(e => ({ ...e, [cat.name]: !e[cat.name] }))}
                  className="w-full flex items-center justify-between px-5 py-4 border-b hover:bg-surface-subtle">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-surface-hover text-ink-600"><cat.icon className="w-4 h-4" /></div>
                    <h3 className="text-sm font-semibold text-ink-900">{cat.name}</h3>
                  </div>
                  {expanded[cat.name] !== false ? <ChevronDown className="w-4 h-4 text-ink-400" /> : <ChevronRight className="w-4 h-4 text-ink-400" />}
                </button>
                {expanded[cat.name] !== false && (
                  <div className="p-5 space-y-5">
                    {catConfigs.map(cfg => (
                      <div key={cfg.key}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <label className="text-sm font-medium text-ink-700">{fmtLabel(cfg.key)}</label>
                            <p className="text-xs text-ink-400 mt-0.5">{cfg.description}</p>
                          </div>
                          {hasEdit(cfg.key) && (
                            <div className="flex items-center gap-1 ml-3 shrink-0">
                              <button onClick={() => saveMut.mutate({ key: cfg.key, value: edits[cfg.key] })}
                                disabled={saveMut.isPending}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50">
                                <Save className="w-3 h-3" /> Save
                              </button>
                              <button onClick={() => discard(cfg.key)}
                                className="px-2 py-1 text-xs bg-gray-200 text-ink-600 rounded hover:bg-gray-300">
                                Discard
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="mt-2">
                          {cfg.type === 'boolean' ? (
                            <div className="flex items-center gap-3">
                              <button onClick={() => setEdit(cfg.key, !getValue(cfg.key))}
                                className={`relative w-11 h-6 rounded-full transition-colors ${getValue(cfg.key) ? 'bg-blue-600' : 'bg-gray-300'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${getValue(cfg.key) ? 'translate-x-5' : ''}`} />
                              </button>
                              <span className={`text-xs font-medium ${getValue(cfg.key) ? 'text-emerald-600' : 'text-ink-400'}`}>
                                {getValue(cfg.key) ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                          ) : cfg.type === 'number' ? (
                            <input type="number" value={getValue(cfg.key)}
                              onChange={e => setEdit(cfg.key, parseInt(e.target.value) || 0)}
                              className="w-full max-w-xs px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                          ) : cfg.type === 'json' ? (
                            <textarea value={JSON.stringify(getValue(cfg.key), null, 2)}
                              onChange={e => { try { setEdit(cfg.key, JSON.parse(e.target.value)); } catch {} }}
                              className="w-full max-w-lg px-3 py-2 text-sm font-mono border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24" />
                          ) : (
                            <input type="text" value={getValue(cfg.key) || ''}
                              onChange={e => setEdit(cfg.key, e.target.value)}
                              className="w-full max-w-md px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                          )}
                        </div>
                      </div>
                    ))}
                    {cat.keys.length === 0 && (
                      <p className="text-sm text-ink-400 text-center py-4">Configuration options coming soon</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="bg-surface rounded-xl border">
            <div className="px-5 py-4 border-b">
              <h3 className="text-sm font-semibold text-ink-700">System Status</h3>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-ink-700">Configuration Store</p>
                  <p className="text-xs text-ink-400">{allConfigs.length} settings configured</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-ink-700">Changes</p>
                  <p className="text-xs text-ink-400">Take effect immediately after save</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                {Object.keys(edits).length > 0 ? (
                  <Save className="w-5 h-5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-ink-700">Unsaved Changes</p>
                  <p className="text-xs text-ink-400">{Object.keys(edits).filter(k => hasEdit(k)).length || 'None'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
