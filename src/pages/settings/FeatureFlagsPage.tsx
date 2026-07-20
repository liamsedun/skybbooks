import React, { useState, useEffect } from 'react';
import { featureFlagApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import {
  ToggleLeft, SlidersHorizontal, Loader2, Search, Plus, Edit3, Trash2,
  Users, Shield, DollarSign, HardDrive, Zap, FileText, Repeat, Banknote,
  Warehouse, Briefcase, PieChart, Brain, FileSearch, Package, Building2,
  Globe, Database, Layers, Headphones, Crown, Star,
} from 'lucide-react';

interface FeatureFlag {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  defaultState: string;
  planOverridesCount?: number;
  orgOverride?: { state: string; usageLimit: number } | null;
}

interface OrgOverride {
  id: string;
  flagCode: string;
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

const CATEGORY_COLORS: Record<string, string> = {
  core: 'bg-blue-50 text-blue-700',
  billing: 'bg-emerald-50 text-emerald-700',
  advanced: 'bg-purple-50 text-purple-700',
  addon: 'bg-amber-50 text-amber-700',
  compliance: 'bg-red-50 text-red-700',
  integration: 'bg-cyan-50 text-cyan-700',
};

const STATE_COLORS: Record<string, string> = {
  enabled: 'bg-emerald-50 text-emerald-700',
  disabled: 'bg-neutral-100 text-neutral-500',
  limited: 'bg-amber-50 text-amber-700',
  unlimited: 'bg-blue-50 text-blue-700',
};

export function FeatureFlagsPage() {
  const { user, organisation } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'overrides'>('overview');
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [overrides, setOverrides] = useState<OrgOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);

  // Override form state
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ flagCode: '', state: 'enabled', usageLimit: 0 });
  const [editingOverride, setEditingOverride] = useState<string | null>(null);

  useEffect(() => {
    loadFlags();
    loadOverrides();
  }, []);

  async function loadFlags() {
    setLoading(true);
    try {
      const data = await featureFlagApi.list();
      setFlags(data);
    } catch (err) {
      console.error('Failed to load feature flags:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadOverrides() {
    try {
      const data = await featureFlagApi.getOrgOverrides();
      setOverrides(data);
    } catch (err) {
      console.error('Failed to load overrides:', err);
    }
  }

  async function handleSaveOverride() {
    try {
      if (editingOverride) {
        await featureFlagApi.setOrgOverride(overrideForm.flagCode, { state: overrideForm.state, usageLimit: overrideForm.usageLimit });
      } else {
        await featureFlagApi.setOrgOverride(overrideForm.flagCode, { state: overrideForm.state, usageLimit: overrideForm.usageLimit });
      }
      setShowOverrideForm(false);
      setEditingOverride(null);
      setOverrideForm({ flagCode: '', state: 'enabled', usageLimit: 0 });
      loadOverrides();
      loadFlags();
    } catch (err) {
      console.error('Failed to save override:', err);
    }
  }

  async function handleResetOverride(code: string) {
    try {
      await featureFlagApi.resetOrgOverride(code);
      loadOverrides();
      loadFlags();
    } catch (err) {
      console.error('Failed to reset override:', err);
    }
  }

  function openEditOverride(ov: OrgOverride) {
    setEditingOverride(ov.id);
    setOverrideForm({ flagCode: ov.flagCode, state: ov.state, usageLimit: ov.usageLimit });
    setShowOverrideForm(true);
  }

  function openAddOverride() {
    setEditingOverride(null);
    setOverrideForm({ flagCode: flags[0]?.code || '', state: 'enabled', usageLimit: 0 });
    setShowOverrideForm(true);
  }

  const filteredFlags = flags.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold text-ink-900">Feature Flags</h1>
          <p className="text-sm text-ink-500 mt-1">Manage feature availability across plans and organisations.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-neutral-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${activeTab === 'overview' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
        >
          Feature Overview
        </button>
        <button
          onClick={() => setActiveTab('overrides')}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${activeTab === 'overrides' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
        >
          Org Overrides
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Search */}
          <div className="relative mb-4 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Table */}
          <div className="rounded-xl bg-white border border-border-custom shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-custom bg-surface-subtle/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Feature</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Default State</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Plan Overrides</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Org Override</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlags.map(flag => {
                  const Icon = FEATURE_ICONS[flag.code] || ToggleLeft;
                  const isExpanded = expandedFlag === flag.id;
                  return (
                    <React.Fragment key={flag.id}>
                      <tr
                        className={`border-b border-border-custom/50 hover:bg-surface-subtle/20 cursor-pointer transition-colors ${isExpanded ? 'bg-surface-subtle/30' : ''}`}
                        onClick={() => setExpandedFlag(isExpanded ? null : flag.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-ink-50 flex items-center justify-center">
                              <Icon className="w-4 h-4 text-ink-500" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-ink-900">{flag.name}</div>
                              <div className="text-xs text-ink-400 font-mono">{flag.code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[flag.category] || 'bg-neutral-100 text-neutral-600'}`}>
                            {flag.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATE_COLORS[flag.defaultState] || 'bg-neutral-100 text-neutral-600'}`}>
                            {flag.defaultState}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-ink-600">
                          {flag.planOverridesCount ?? 0}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {flag.orgOverride ? (
                            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATE_COLORS[flag.orgOverride.state] || 'bg-neutral-100 text-neutral-600'}`}>
                              {flag.orgOverride.state}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={e => { e.stopPropagation(); openAddOverride(); }}
                            className="p-1.5 text-ink-400 hover:text-emerald-600 transition-colors"
                            title="Set org override"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-surface-subtle/20">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="text-sm text-ink-600 mb-3 max-w-2xl">{flag.description}</div>
                            <div className="flex items-center gap-3">
                              <div className="text-xs text-ink-400">
                                <span className="font-medium text-ink-600">Code:</span> {flag.code}
                              </div>
                              {flag.orgOverride && (
                                <button
                                  onClick={() => handleResetOverride(flag.code)}
                                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                                >
                                  Reset override
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filteredFlags.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-400">
                      No feature flags found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'overrides' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-ink-500">Org-level overrides for <strong className="text-ink-700">{organisation?.name || 'this organisation'}</strong></p>
            <button onClick={openAddOverride} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
              <Plus className="w-4 h-4" /> Add Override
            </button>
          </div>

          {overrides.length === 0 ? (
            <div className="text-center py-16 bg-white border border-border-custom rounded-2xl">
              <SlidersHorizontal className="w-12 h-12 text-ink-300 mx-auto mb-3" />
              <p className="text-ink-500 text-sm">No org overrides yet. Add one to override a feature's default or plan-level state.</p>
            </div>
          ) : (
            <div className="rounded-xl bg-white border border-border-custom shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-custom bg-surface-subtle/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Feature</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">State</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Usage Limit</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map(ov => (
                    <tr key={ov.id} className="border-b border-border-custom/50 hover:bg-surface-subtle/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink-900">{ov.flagCode}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATE_COLORS[ov.state] || 'bg-neutral-100 text-neutral-600'}`}>
                          {ov.state}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-600">
                        {ov.usageLimit > 0 ? ov.usageLimit.toLocaleString() : 'Unlimited'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditOverride(ov)} className="p-1.5 text-ink-400 hover:text-ink-600 transition-colors" title="Edit">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleResetOverride(ov.flagCode)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors" title="Reset to default">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Override Form Modal */}
      {showOverrideForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowOverrideForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-border-custom w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-ink-900 mb-4">{editingOverride ? 'Edit Override' : 'Add Org Override'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Feature</label>
                  {editingOverride ? (
                    <input className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm bg-neutral-50 text-ink-400" value={overrideForm.flagCode} disabled />
                  ) : (
                    <select
                      className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={overrideForm.flagCode}
                      onChange={e => setOverrideForm({ ...overrideForm, flagCode: e.target.value })}
                    >
                      {flags.map(f => (
                        <option key={f.code} value={f.code}>{f.name} ({f.code})</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">State</label>
                  <select
                    className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={overrideForm.state}
                    onChange={e => setOverrideForm({ ...overrideForm, state: e.target.value })}
                  >
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                    <option value="limited">Limited</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Usage Limit (0 = unlimited)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={overrideForm.usageLimit}
                    onChange={e => setOverrideForm({ ...overrideForm, usageLimit: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-custom">
                <button onClick={() => { setShowOverrideForm(false); setEditingOverride(null); }} className="px-4 py-2 text-sm text-ink-600 hover:text-ink-900">Cancel</button>
                <button onClick={handleSaveOverride} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700">
                  {editingOverride ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
