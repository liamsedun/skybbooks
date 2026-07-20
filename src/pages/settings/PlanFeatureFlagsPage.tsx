import React, { useState, useEffect } from 'react';
import { featureFlagApi } from '../../lib/api';
import { subscriptionApi } from '../../lib/api';
import {
  ToggleLeft, SlidersHorizontal, Loader2, Save, Globe, Package, Users,
  Briefcase, Building2, FileText, Repeat, PieChart, FileSearch, Banknote,
  DollarSign, Zap, HardDrive, Shield, Brain, Warehouse, Layers,
} from 'lucide-react';

interface FeatureFlag {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  defaultState: string;
}

interface PlanFlagConfig {
  featureCode: string;
  state: string;
  usageLimit: number;
}

const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  multi_currency: Globe,
  inventory: Package,
  payroll: Users,
  fixed_assets: Briefcase,
  leases: Building2,
  revenue_recognition: FileText,
  intercompany: Repeat,
  budgeting: PieChart,
  advanced_reports: FileSearch,
  bank_reconciliation: Banknote,
  payment_gateway: DollarSign,
  api_access: Zap,
  storage: HardDrive,
  custom_domain: Globe,
  audit_log: Shield,
  roles_permissions: Shield,
  ai_assistant: Brain,
  ocr_processing: FileSearch,
  warehouse: Warehouse,
  projects: Briefcase,
  branding: Layers,
};

const STATE_COLORS: Record<string, string> = {
  enabled: 'bg-emerald-50 text-emerald-700',
  disabled: 'bg-neutral-100 text-neutral-500',
  limited: 'bg-amber-50 text-amber-700',
  unlimited: 'bg-blue-50 text-blue-700',
};

export function PlanFeatureFlagsPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [planFlags, setPlanFlags] = useState<Record<string, PlanFlagConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedPlanId) {
      loadPlanFlags(selectedPlanId);
    }
  }, [selectedPlanId]);

  async function loadInitial() {
    setLoading(true);
    try {
      const [plansData, flagsData] = await Promise.all([
        subscriptionApi.listPlans(),
        featureFlagApi.list(),
      ]);
      setPlans(plansData);
      setFlags(flagsData);
      if (plansData.length > 0) {
        setSelectedPlanId(plansData[0].id);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlanFlags(planId: string) {
    try {
      const data = await featureFlagApi.getPlanFlags(planId);
      const map: Record<string, PlanFlagConfig> = {};
      for (const f of data) {
        const fc = f.featureCode || f.code;
        map[fc] = { featureCode: fc, state: f.state, usageLimit: f.usageLimit || 0 };
      }
      setPlanFlags(map);
    } catch (err) {
      console.error('Failed to load plan flags:', err);
    }
  }

  function updateFlag(code: string, field: 'state' | 'usageLimit', value: string | number) {
    setPlanFlags(prev => ({
      ...prev,
      [code]: {
        featureCode: code,
        state: prev[code]?.state || 'disabled',
        usageLimit: prev[code]?.usageLimit || 0,
        [field]: value,
      },
    }));
  }

  async function handleSaveAll() {
    setSaving(true);
    setSaved(false);
    try {
      const payload = Object.values(planFlags);
      await featureFlagApi.bulkSetPlanFlags(selectedPlanId, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save plan flags:', err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-ink-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Plan Feature Flags</h1>
          <p className="text-sm text-ink-500 mt-1">Configure which features each subscription plan gets.</p>
        </div>
      </div>

      {/* Plan selector */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-ink-600 mb-1.5">Select Plan</label>
        <select
          className="w-full max-w-md px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          value={selectedPlanId}
          onChange={e => setSelectedPlanId(e.target.value)}
        >
          {plans.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
          ))}
        </select>
      </div>

      {/* Features grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {flags.map(flag => {
          const Icon = FEATURE_ICONS[flag.code] || ToggleLeft;
          const config = planFlags[flag.code];
          const state = config?.state || flag.defaultState;
          const usageLimit = config?.usageLimit ?? 0;
          return (
            <div key={flag.id} className="rounded-xl bg-white border border-border-custom shadow-sm p-4 flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-ink-50 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-ink-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink-900 truncate">{flag.name}</div>
                  <div className="text-xs text-ink-400 font-mono truncate">{flag.code}</div>
                </div>
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATE_COLORS[state] || 'bg-neutral-100 text-neutral-600'}`}>
                  {state}
                </span>
              </div>

              <p className="text-xs text-ink-500 mb-3 line-clamp-2">{flag.description}</p>

              <div className="mt-auto space-y-2">
                <div>
                  <label className="block text-xs text-ink-500 mb-1">State</label>
                  <select
                    className="w-full px-2.5 py-1.5 border border-border-custom rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={state}
                    onChange={e => updateFlag(flag.code, 'state', e.target.value)}
                  >
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                    <option value="limited">Limited</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>

                {state === 'limited' && (
                  <div>
                    <label className="block text-xs text-ink-500 mb-1">Usage Limit</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 border border-border-custom rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={usageLimit}
                      onChange={e => updateFlag(flag.code, 'usageLimit', Number(e.target.value))}
                      min={0}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save All'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 font-medium">All flags saved successfully!</span>
        )}
      </div>
    </div>
  );
}
