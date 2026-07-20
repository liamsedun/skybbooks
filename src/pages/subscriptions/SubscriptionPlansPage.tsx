import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Check, X, DollarSign, Users, HardDrive, ToggleLeft, ToggleRight, Loader2, Crown, Star, Palette, Tag, Zap, Shield, Building2, Globe, Database, Layers, FileText, Repeat, Banknote, Warehouse, Briefcase, PieChart, Brain, FileSearch, Headphones, Package } from 'lucide-react';
import { subscriptionApi } from '../../lib/api';
function fmtNaira(v: number): string {
  const abs = Math.abs(v);
  const naira = Math.floor(abs / 100);
  const kobo = abs % 100;
  const formatted = naira.toLocaleString('en-US') + '.' + String(kobo).padStart(2, '0');
  return (v < 0 ? '-₦' : '₦') + formatted;
}

const defaultForm = {
  name: '', code: '', description: '',
  monthlyPriceKobo: 0, annualPriceKobo: 0, currency: 'NGN',
  billingCycle: 'monthly', trialDays: 0, userLimit: 1, maxCompanies: 1,
  storageLimitGb: 1, apiRequests: 0,
  maxCustomers: 0, maxVendors: 0, maxProducts: 0, maxInvoices: 0,
  maxTransactions: 0, maxBankAccounts: 0, maxWarehouses: 0, maxProjects: 0,
  maxAssets: 0, maxReports: 0, maxAiRequests: 0, maxOcrDocuments: 0,
  supportLevel: 'community', popularBadge: false, recommendedBadge: false,
  ribbonColor: '', buttonText: 'Subscribe',
  isActive: true, isArchived: false, sortOrder: 0, isPublic: true,
};

export function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ ...defaultForm });

  useEffect(() => { loadPlans(); }, []);

  async function loadPlans() {
    setLoading(true);
    try {
      const data = await subscriptionApi.listPlans();
      setPlans(data);
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      const payload = { ...formData };
      if (payload.ribbonColor === '') payload.ribbonColor = null;
      if (editingPlan) {
        await subscriptionApi.updatePlan(editingPlan.id, payload);
      } else {
        await subscriptionApi.createPlan(payload);
      }
      setShowForm(false);
      setEditingPlan(null);
      setFormData({ ...defaultForm });
      loadPlans();
    } catch (err) {
      console.error('Failed to save plan:', err);
    }
  }

  function openEdit(plan: any) {
    setEditingPlan(plan);
    setFormData({
      name: plan.name || '',
      code: plan.code || '',
      description: plan.description || '',
      monthlyPriceKobo: plan.monthlyPriceKobo ?? 0,
      annualPriceKobo: plan.annualPriceKobo ?? 0,
      currency: plan.currency || 'NGN',
      billingCycle: plan.billingCycle || 'monthly',
      trialDays: plan.trialDays ?? 0,
      userLimit: plan.userLimit ?? 1,
      maxCompanies: plan.maxCompanies ?? 1,
      storageLimitGb: plan.storageLimitGb ?? 1,
      apiRequests: plan.apiRequests ?? 0,
      maxCustomers: plan.maxCustomers ?? 0,
      maxVendors: plan.maxVendors ?? 0,
      maxProducts: plan.maxProducts ?? 0,
      maxInvoices: plan.maxInvoices ?? 0,
      maxTransactions: plan.maxTransactions ?? 0,
      maxBankAccounts: plan.maxBankAccounts ?? 0,
      maxWarehouses: plan.maxWarehouses ?? 0,
      maxProjects: plan.maxProjects ?? 0,
      maxAssets: plan.maxAssets ?? 0,
      maxReports: plan.maxReports ?? 0,
      maxAiRequests: plan.maxAiRequests ?? 0,
      maxOcrDocuments: plan.maxOcrDocuments ?? 0,
      supportLevel: plan.supportLevel || 'community',
      popularBadge: plan.popularBadge ?? false,
      recommendedBadge: plan.recommendedBadge ?? false,
      ribbonColor: plan.ribbonColor || '',
      buttonText: plan.buttonText || 'Subscribe',
      isActive: plan.isActive ?? true,
      isArchived: plan.isArchived ?? false,
      sortOrder: plan.sortOrder ?? 0,
      isPublic: plan.isPublic ?? true,
    });
    setShowForm(true);
  }

  function openCreate() {
    setEditingPlan(null);
    setFormData({ ...defaultForm });
    setShowForm(true);
  }

  async function toggleActive(plan: any) {
    try {
      await subscriptionApi.updatePlan(plan.id, { isActive: !plan.isActive });
      loadPlans();
    } catch (err) {
      console.error('Failed to toggle plan:', err);
    }
  }

  async function handleDelete(plan: any) {
    if (!confirm(`Deactivate plan "${plan.name}"?`)) return;
    try {
      await subscriptionApi.deletePlan(plan.id);
      loadPlans();
    } catch (err) {
      console.error('Failed to delete plan:', err);
    }
  }

  const limitFields = [
    { key: 'userLimit', label: 'Max Users', icon: Users },
    { key: 'maxCompanies', label: 'Max Companies', icon: Building2 },
    { key: 'storageLimitGb', label: 'Storage (GB)', icon: HardDrive },
    { key: 'apiRequests', label: 'API Requests', icon: Zap },
    { key: 'maxCustomers', label: 'Max Customers', icon: Users },
    { key: 'maxVendors', label: 'Max Vendors', icon: Users },
    { key: 'maxProducts', label: 'Max Products', icon: Package },
    { key: 'maxInvoices', label: 'Max Invoices', icon: FileText },
    { key: 'maxTransactions', label: 'Max Transactions', icon: Repeat },
    { key: 'maxBankAccounts', label: 'Max Bank Accounts', icon: Banknote },
    { key: 'maxWarehouses', label: 'Max Warehouses', icon: Warehouse },
    { key: 'maxProjects', label: 'Max Projects', icon: Briefcase },
    { key: 'maxAssets', label: 'Max Assets', icon: PieChart },
    { key: 'maxReports', label: 'Max Reports', icon: FileText },
    { key: 'maxAiRequests', label: 'Max AI Requests', icon: Brain },
    { key: 'maxOcrDocuments', label: 'Max OCR Documents', icon: FileSearch },
  ];

  function renderLimit(plan: any, key: string) {
    const v = plan[key];
    if (v === 0) return 'Unlimited';
    return v?.toLocaleString();
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

  const badgeColors: Record<string, string> = {
    community: 'bg-neutral-100 text-neutral-600',
    email: 'bg-blue-50 text-blue-700',
    priority: 'bg-purple-50 text-purple-700',
    dedicated: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Subscription Plans</h1>
          <p className="text-sm text-ink-500 mt-1">Create and manage subscription plans. No hardcoded pricing.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
          <Plus className="w-4 h-4" /> New Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-16 bg-white border border-border-custom rounded-2xl">
          <DollarSign className="w-12 h-12 text-ink-300 mx-auto mb-3" />
          <p className="text-ink-500 text-sm">No subscription plans yet. Create your first plan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div key={plan.id} className={`rounded-xl bg-white border shadow-sm overflow-hidden flex flex-col relative ${plan.isArchived ? 'opacity-60' : ''} ${plan.ribbonColor ? 'border-t-4' : 'border-border-custom'}`} style={plan.ribbonColor ? { borderTopColor: plan.ribbonColor } : {}}>
              {plan.popularBadge && (
                <div className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Crown className="w-3 h-3" /> Popular
                </div>
              )}
              {plan.recommendedBadge && !plan.popularBadge && (
                <div className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <Star className="w-3 h-3" /> Recommended
                </div>
              )}
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-ink-900">{plan.name}</h3>
                  <span className="text-xs font-mono text-ink-400 bg-ink-50 px-2 py-0.5 rounded-full">{plan.code}</span>
                </div>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-bold text-ink-900">{fmtNaira(plan.monthlyPriceKobo)}</span>
                  <span className="text-sm text-ink-400">/mo</span>
                </div>
                {plan.annualPriceKobo > 0 && (
                  <p className="text-xs text-ink-500 mb-2">{fmtNaira(plan.annualPriceKobo)} /yr ({plan.currency})</p>
                )}

                {plan.description && (
                  <p className="text-sm text-ink-500 mb-4 line-clamp-2">{plan.description}</p>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-ink-600 mb-3">
                  {limitFields.slice(0, 8).map(f => (
                    <div key={f.key} className="flex items-center gap-1">
                      <f.icon className="w-3 h-3 text-ink-400 shrink-0" />
                      <span>{f.label}: <strong>{renderLimit(plan, f.key)}</strong></span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {plan.trialDays > 0 && (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{plan.trialDays}-day trial</span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColors[plan.supportLevel] || 'bg-neutral-100 text-neutral-600'}`}>
                    <Headphones className="w-3 h-3 inline mr-0.5" />
                    {plan.supportLevel}
                  </span>
                  {plan.buttonText && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{plan.buttonText}</span>
                  )}
                </div>

                {plan.isArchived && (
                  <span className="inline-block mt-2 text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">Archived</span>
                )}

                {plan.sortOrder > 0 && (
                  <div className="text-xs text-ink-300 mt-2">Order: {plan.sortOrder}</div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-border-custom flex items-center justify-between bg-surface-subtle/30">
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(plan)} className="p-1.5 text-ink-400 hover:text-ink-600 transition-colors" title="Edit plan">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(plan)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors" title="Deactivate plan">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={() => toggleActive(plan)} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${plan.isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>
                  {plan.isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                  {plan.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-border-custom w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-ink-900 mb-4">{editingPlan ? 'Edit Plan' : 'Create Plan'}</h2>
              <div className="space-y-5">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Plan Name</label>
                    <input className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Code</label>
                    <input className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-neutral-50 disabled:text-ink-400" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} disabled={!!editingPlan} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Description</label>
                  <textarea className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" rows={2} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>

                {/* Pricing */}
                <div className="border-t border-border-custom pt-4">
                  <h3 className="text-sm font-semibold text-ink-900 mb-3">Pricing</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Monthly Price (kobo)</label>
                      <input type="number" className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={formData.monthlyPriceKobo ?? ''} onChange={e => setFormData({...formData, monthlyPriceKobo: Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Annual Price (kobo)</label>
                      <input type="number" className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={formData.annualPriceKobo ?? ''} onChange={e => setFormData({...formData, annualPriceKobo: Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Currency</label>
                      <select className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={formData.currency || 'NGN'} onChange={e => setFormData({...formData, currency: e.target.value})}>
                        <option value="NGN">NGN (₦)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Billing Frequency</label>
                      <select className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={formData.billingCycle || 'monthly'} onChange={e => setFormData({...formData, billingCycle: e.target.value})}>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Free Trial Days</label>
                      <input type="number" className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={formData.trialDays ?? ''} onChange={e => setFormData({...formData, trialDays: Number(e.target.value)})} />
                    </div>
                  </div>
                </div>

                {/* Limits */}
                <div className="border-t border-border-custom pt-4">
                  <h3 className="text-sm font-semibold text-ink-900 mb-3">Limits</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {limitFields.map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-ink-600 mb-1">{f.label}</label>
                        <input type="number" className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={(formData as any)[f.key] ?? ''} onChange={e => setFormData({...formData, [f.key]: Number(e.target.value)})} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Support Level</label>
                      <select className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={formData.supportLevel || 'community'} onChange={e => setFormData({...formData, supportLevel: e.target.value})}>
                        <option value="community">Community</option>
                        <option value="email">Email</option>
                        <option value="priority">Priority</option>
                        <option value="dedicated">Dedicated</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Display */}
                <div className="border-t border-border-custom pt-4">
                  <h3 className="text-sm font-semibold text-ink-900 mb-3">Display & Branding</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Button Text</label>
                      <input className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={formData.buttonText || 'Subscribe'} onChange={e => setFormData({...formData, buttonText: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Ribbon Color (CSS color)</label>
                      <input className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={formData.ribbonColor || ''} onChange={e => setFormData({...formData, ribbonColor: e.target.value})} placeholder="#10b981 or emerald-500" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-border-custom text-amber-600 focus:ring-amber-500" checked={formData.popularBadge ?? false} onChange={e => setFormData({...formData, popularBadge: e.target.checked})} />
                      <span className="text-xs font-medium text-ink-600">Popular Badge</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-border-custom text-emerald-600 focus:ring-emerald-500" checked={formData.recommendedBadge ?? false} onChange={e => setFormData({...formData, recommendedBadge: e.target.checked})} />
                      <span className="text-xs font-medium text-ink-600">Recommended Badge</span>
                    </label>
                  </div>
                </div>

                {/* Status */}
                <div className="border-t border-border-custom pt-4">
                  <h3 className="text-sm font-semibold text-ink-900 mb-3">Status</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Sort Order</label>
                      <input type="number" className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={formData.sortOrder ?? ''} onChange={e => setFormData({...formData, sortOrder: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-border-custom text-emerald-600 focus:ring-emerald-500" checked={formData.isActive ?? true} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
                      <span className="text-xs font-medium text-ink-600">Active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-border-custom text-neutral-600 focus:ring-neutral-500" checked={formData.isArchived ?? false} onChange={e => setFormData({...formData, isArchived: e.target.checked})} />
                      <span className="text-xs font-medium text-ink-600">Archived</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-border-custom text-emerald-600 focus:ring-emerald-500" checked={formData.isPublic ?? true} onChange={e => setFormData({...formData, isPublic: e.target.checked})} />
                      <span className="text-xs font-medium text-ink-600">Public</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-custom">
                <button onClick={() => { setShowForm(false); setEditingPlan(null); }} className="px-4 py-2 text-sm text-ink-600 hover:text-ink-900">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700">{editingPlan ? 'Update Plan' : 'Create Plan'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
