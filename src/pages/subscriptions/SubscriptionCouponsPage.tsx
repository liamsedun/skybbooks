import React, { useState, useEffect } from 'react';
import { Plus, Tag, Megaphone, Percent, DollarSign, Check, X, Calendar, Users, Clock, Loader2, Copy, ExternalLink, Gift, Handshake, BarChart3 } from 'lucide-react';
import { subscriptionApi, promotionsEngineApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';

function fmtNaira(v: number): string {
  const n = Math.abs(v) / 100;
  return `₦${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | Date | null): string {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

type TabKey = 'coupons' | 'promotions' | 'campaigns' | 'referrals' | 'partners' | 'redemptions';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'coupons', label: 'Coupons', icon: Tag },
  { key: 'promotions', label: 'Promotions', icon: Megaphone },
  { key: 'campaigns', label: 'Campaigns', icon: BarChart3 },
  { key: 'referrals', label: 'Referral Codes', icon: Gift },
  { key: 'partners', label: 'Partner Discounts', icon: Handshake },
  { key: 'redemptions', label: 'Redemption History', icon: Clock },
];

export function SubscriptionCouponsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const orgId = user?.organisationId;

  const [activeTab, setActiveTab] = useState<TabKey>('coupons');
  const [coupons, setCoupons] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  const tabIcons = { coupons: Tag, promotions: Megaphone, campaigns: BarChart3, referrals: Gift, partners: Handshake, redemptions: Clock };

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, pr, ca, r, pa] = await Promise.all([
        subscriptionApi.listCoupons(),
        subscriptionApi.listPromotions(),
        promotionsEngineApi.listCampaigns(orgId),
        promotionsEngineApi.listReferrals(orgId),
        promotionsEngineApi.listPartners(orgId),
      ]);
      setCoupons(Array.isArray(c) ? c : c?.data || []);
      setPromotions(Array.isArray(pr) ? pr : pr?.data || []);
      setCampaigns(Array.isArray(ca) ? ca : ca?.data || []);
      setReferrals(Array.isArray(r) ? r : r?.data || []);
      setPartners(Array.isArray(pa) ? pa : pa?.data || []);
    } catch {
      toast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRedemptions = async () => {
    if (!orgId) return;
    try {
      const r = await promotionsEngineApi.listRedemptions(orgId);
      setRedemptions(Array.isArray(r) ? r : r?.data || []);
    } catch {
      toast('Failed to load redemption history', 'error');
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab === 'redemptions') loadRedemptions(); }, [activeTab]);

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast('Copied!', 'success'); }
    catch { toast('Failed to copy', 'error'); }
  };

  const openCreate = (tab: TabKey) => {
    setEditingItem(null);
    setFormData(getDefaults(tab));
    setShowModal(true);
  };

  const openEdit = (item: any, tab: TabKey) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowModal(true);
  };

  const getDefaults = (tab: TabKey) => {
    switch (tab) {
      case 'coupons': return { code: '', description: '', discountType: 'percentage', discountPercent: 10, discountAmountKobo: 0, freeMonths: 0, maxRedemptions: 0, minAmountKobo: 0, maxAmountKobo: 0, applicablePlanIds: '', minPlanId: '', maxPlanId: '', regionRestrictions: '', campaignId: '', isStackable: false, priority: 0, budgetKobo: 0, requireMinimumPayment: false, expiresAt: '', isActive: true, isFirstOrderOnly: false };
      case 'promotions': return { name: '', description: '', discountType: 'percentage', discountPercent: 10, discountAmountKobo: 0, freeMonths: 0, applicablePlanIds: '', minPlanId: '', maxPlanId: '', regionRestrictions: '', campaignId: '', isStackable: false, priority: 0, budgetKobo: 0, startDate: '', endDate: '', maxRedemptions: 0, isActive: true };
      case 'campaigns': return { name: '', description: '', type: 'general', status: 'draft', startDate: '', endDate: '', budgetKobo: 0, targetPlanIds: '', targetRegions: '', maxRedemptions: 0 };
      case 'referrals': return { code: '', description: '', rewardType: 'fixed_amount', rewardValue: 0, rewardFreeMonths: 0, maxRedemptions: 0, rewardExpiresInDays: 30, applicablePlanIds: '', expiresAt: '' };
      case 'partners': return { partnerName: '', partnerCode: '', contactEmail: '', contactPhone: '', discountType: 'percentage', discountPercent: 10, discountAmountKobo: 0, freeMonths: 0, commissionPercent: 0, commissionAmountKobo: 0, applicablePlanIds: '', maxRedemptions: 0, regionRestrictions: '', expiresAt: '' };
      default: return {};
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData };
      if (payload.applicablePlanIds && typeof payload.applicablePlanIds === 'string') {
        payload.applicablePlanIds = payload.applicablePlanIds.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (payload.targetPlanIds && typeof payload.targetPlanIds === 'string') {
        payload.targetPlanIds = payload.targetPlanIds.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (payload.targetRegions && typeof payload.targetRegions === 'string') {
        payload.targetRegions = payload.targetRegions.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (payload.regionRestrictions && typeof payload.regionRestrictions === 'string') {
        payload.regionRestrictions = payload.regionRestrictions.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (payload.applicablePlanIds?.length === 0) delete payload.applicablePlanIds;
      if (payload.targetPlanIds?.length === 0) delete payload.targetPlanIds;
      if (payload.targetRegions?.length === 0) delete payload.targetRegions;
      if (payload.regionRestrictions?.length === 0) delete payload.regionRestrictions;

      if (payload.discountType === 'fixed_amount') { payload.discountPercent = null; }
      else { payload.discountAmountKobo = null; }

      if (payload.orgId === '') delete payload.orgId;

      if (editingItem) {
        switch (activeTab) {
          case 'coupons': await promotionsEngineApi.updateCouponExtended(editingItem.id, payload); break;
          case 'promotions': await promotionsEngineApi.updatePromotionExtended(editingItem.id, payload); break;
          case 'campaigns': await promotionsEngineApi.updateCampaign(editingItem.id, payload); break;
          case 'referrals': await promotionsEngineApi.updateReferral(editingItem.id, payload); break;
          case 'partners': await promotionsEngineApi.updatePartner(editingItem.id, payload); break;
        }
        toast('Updated', 'success');
      } else {
        switch (activeTab) {
          case 'coupons': await promotionsEngineApi.createCouponExtended({ ...payload, orgId }); break;
          case 'promotions': await promotionsEngineApi.createPromotionExtended({ ...payload, orgId }); break;
          case 'campaigns': await promotionsEngineApi.createCampaign({ ...payload, orgId, createdBy: user?.id }); break;
          case 'referrals': await promotionsEngineApi.createReferral({ ...payload, orgId, createdBy: user?.id }); break;
          case 'partners': await promotionsEngineApi.createPartner({ ...payload, createdBy: user?.id }); break;
        }
        toast('Created', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      toast(err?.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: any, tab: TabKey) => {
    if (!window.confirm(`Delete this ${tab.slice(0, -1)}?`)) return;
    try {
      switch (tab) {
        case 'campaigns': await promotionsEngineApi.deleteCampaign(item.id); break;
        case 'referrals': await promotionsEngineApi.deleteReferral(item.id); break;
        case 'partners': await promotionsEngineApi.deletePartner(item.id); break;
      }
      toast('Deleted', 'success');
      loadData();
    } catch { toast('Failed to delete', 'error'); }
  };

  const DiscountBadge = ({ row }: { row: any }) => {
    if (row.freeMonths) return <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600"><Clock className="w-3.5 h-3.5" /> {row.freeMonths}mo free</span>;
    if (row.discountType === 'percentage') return <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600"><Percent className="w-3.5 h-3.5" /> {row.discountPercent}%</span>;
    if (row.discountType === 'free_months') return <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600"><Clock className="w-3.5 h-3.5" /> {row.freeMonths || row.discountValue}mo free</span>;
    return <span className="inline-flex items-center gap-1 text-sm font-medium text-purple-600"><DollarSign className="w-3.5 h-3.5" /> {fmtNaira(row.discountAmountKobo || row.discountValue)}</span>;
  };

  const StatusBadge = ({ active, label }: { active: boolean; label?: string }) => (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
      {active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {label || (active ? 'Active' : 'Inactive')}
    </span>
  );

  const CampaignStatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      draft: 'bg-surface-hover text-ink-600',
      active: 'bg-emerald-50 text-emerald-700',
      paused: 'bg-amber-50 text-amber-700',
      completed: 'bg-blue-50 text-blue-700',
      cancelled: 'bg-red-50 text-red-700',
    };
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-surface-hover text-ink-600'}`}>{status}</span>;
  };

  const tabClass = (key: TabKey) =>
    `px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
      activeTab === key ? 'bg-emerald-50 text-emerald-700' : 'bg-surface text-ink-600 hover:bg-surface-hover'
    }`;

  // ── Render Modal Form ──
  const renderFormField = (label: string, field: string, type: string = 'text', opts?: { placeholder?: string; min?: number; max?: number; rows?: number }) => {
    const val = formData[field] ?? '';
    const onChange = (v: any) => setFormData((f: any) => ({ ...f, [field]: v }));
    if (type === 'textarea') {
      return (
        <div key={field}>
          <label className="block text-sm font-medium text-ink-700 mb-1">{label}</label>
          <textarea value={val} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" rows={opts?.rows || 2} placeholder={opts?.placeholder} />
        </div>
      );
    }
    if (type === 'checkbox') {
      return (
        <label key={field} className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={!!val} onChange={e => onChange(e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
          {label}
        </label>
      );
    }
    if (type === 'select') {
      return (
        <div key={field}>
          <label className="block text-sm font-medium text-ink-700 mb-1">{label}</label>
          <select value={val} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            {opts?.placeholder && <option value="">{opts.placeholder}</option>}
            {(opts as any)?.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    }
    return (
      <div key={field}>
        <label className="block text-sm font-medium text-ink-700 mb-1">{label}</label>
        <input type={type} min={opts?.min} max={opts?.max} value={val} onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder={opts?.placeholder} />
      </div>
    );
  };

  const renderModal = () => {
    if (!showModal) return null;
    const isEdit = !!editingItem;
    const title = `${isEdit ? 'Edit' : 'New'} ${activeTab === 'referrals' ? 'Referral Code' : activeTab === 'partners' ? 'Partner Discount' : activeTab === 'campaigns' ? 'Campaign' : activeTab === 'coupons' ? 'Coupon' : 'Promotion'}`;

    const fields = () => {
      switch (activeTab) {
        case 'coupons': return (
          <>
            {renderFormField('Code *', 'code', 'text', { placeholder: 'SUMMER20' })}
            {renderFormField('Description', 'description', 'textarea')}
            {renderFormField('Discount Type', 'discountType', 'select', { placeholder: 'Select type', options: ['percentage', 'fixed_amount', 'free_months'] } as any)}
            {formData.discountType === 'percentage' && renderFormField('Discount Percent', 'discountPercent', 'number', { min: 0, max: 100 })}
            {formData.discountType === 'fixed_amount' && renderFormField('Discount Amount (kobo)', 'discountAmountKobo', 'number', { min: 0 })}
            {formData.discountType === 'free_months' && renderFormField('Free Months', 'freeMonths', 'number', { min: 0 })}
            <div className="grid grid-cols-2 gap-4">
              {renderFormField('Min Amount (kobo)', 'minAmountKobo', 'number', { min: 0 })}
              {renderFormField('Max Amount (kobo)', 'maxAmountKobo', 'number', { min: 0 })}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderFormField('Max Redemptions (0=unlimited)', 'maxRedemptions', 'number', { min: 0 })}
              {renderFormField('Priority', 'priority', 'number', { min: 0 })}
            </div>
            {renderFormField('Applicable Plan IDs (comma-separated)', 'applicablePlanIds', 'textarea', { placeholder: 'Leave empty for all plans', rows: 2 })}
            {renderFormField('Min Plan ID', 'minPlanId', 'text')}
            {renderFormField('Max Plan ID', 'maxPlanId', 'text')}
            {renderFormField('Region Restrictions (comma-separated)', 'regionRestrictions', 'text', { placeholder: 'NG, GH, KE' })}
            {renderFormField('Campaign ID', 'campaignId', 'text')}
            <div className="grid grid-cols-2 gap-4">
              {renderFormField('Budget (kobo)', 'budgetKobo', 'number', { min: 0 })}
              {renderFormField('Expires At', 'expiresAt', 'date')}
            </div>
            <div className="flex gap-6">
              {renderFormField('Active', 'isActive', 'checkbox')}
              {renderFormField('First Order Only', 'isFirstOrderOnly', 'checkbox')}
              {renderFormField('Stackable', 'isStackable', 'checkbox')}
              {renderFormField('Require Minimum Payment', 'requireMinimumPayment', 'checkbox')}
            </div>
          </>
        );
        case 'promotions': return (
          <>
            {renderFormField('Name *', 'name', 'text', { placeholder: 'Summer Sale 2026' })}
            {renderFormField('Description', 'description', 'textarea')}
            {renderFormField('Discount Type', 'discountType', 'select', { placeholder: 'Select type', options: ['percentage', 'fixed_amount', 'free_months'] } as any)}
            {formData.discountType === 'percentage' && renderFormField('Discount Percent', 'discountPercent', 'number', { min: 0, max: 100 })}
            {formData.discountType === 'fixed_amount' && renderFormField('Discount Amount (kobo)', 'discountAmountKobo', 'number', { min: 0 })}
            {formData.discountType === 'free_months' && renderFormField('Free Months', 'freeMonths', 'number', { min: 0 })}
            <div className="grid grid-cols-2 gap-4">
              {renderFormField('Start Date *', 'startDate', 'datetime-local')}
              {renderFormField('End Date *', 'endDate', 'datetime-local')}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderFormField('Max Redemptions (0=unlimited)', 'maxRedemptions', 'number', { min: 0 })}
              {renderFormField('Priority', 'priority', 'number', { min: 0 })}
            </div>
            {renderFormField('Applicable Plan IDs (comma-separated)', 'applicablePlanIds', 'textarea', { placeholder: 'Leave empty for all plans', rows: 2 })}
            {renderFormField('Budget (kobo)', 'budgetKobo', 'number', { min: 0 })}
            {renderFormField('Region Restrictions (comma-separated)', 'regionRestrictions', 'text', { placeholder: 'NG, GH, KE' })}
            {renderFormField('Campaign ID', 'campaignId', 'text')}
            {renderFormField('Active', 'isActive', 'checkbox')}
            {renderFormField('Stackable', 'isStackable', 'checkbox')}
          </>
        );
        case 'campaigns': return (
          <>
            {renderFormField('Name *', 'name', 'text')}
            {renderFormField('Description', 'description', 'textarea')}
            {renderFormField('Type', 'type', 'select', { placeholder: 'Select type', options: ['general', 'seasonal', 'holiday', 'product_launch', 'reactivation'] } as any)}
            {renderFormField('Status', 'status', 'select', { placeholder: 'Select status', options: ['draft', 'active', 'paused', 'completed', 'cancelled'] } as any)}
            <div className="grid grid-cols-2 gap-4">
              {renderFormField('Start Date', 'startDate', 'date')}
              {renderFormField('End Date', 'endDate', 'date')}
            </div>
            {renderFormField('Budget (kobo)', 'budgetKobo', 'number', { min: 0 })}
            {renderFormField('Max Redemptions (0=unlimited)', 'maxRedemptions', 'number', { min: 0 })}
            {renderFormField('Target Plan IDs (comma-separated)', 'targetPlanIds', 'textarea', { placeholder: 'Leave empty for all plans' })}
            {renderFormField('Target Regions (comma-separated)', 'targetRegions', 'text', { placeholder: 'NG, GH, KE' })}
          </>
        );
        case 'referrals': return (
          <>
            {renderFormField('Code *', 'code', 'text', { placeholder: 'FRIEND20' })}
            {renderFormField('Description', 'description', 'textarea')}
            {renderFormField('Reward Type', 'rewardType', 'select', { placeholder: 'Select type', options: ['percentage', 'fixed_amount', 'free_months'] } as any)}
            {formData.rewardType === 'percentage' && renderFormField('Reward Percent', 'rewardValue', 'number', { min: 0, max: 100 })}
            {formData.rewardType === 'fixed_amount' && renderFormField('Reward Amount (kobo)', 'rewardValue', 'number', { min: 0 })}
            {formData.rewardType === 'free_months' && renderFormField('Free Months', 'rewardFreeMonths', 'number', { min: 0 })}
            <div className="grid grid-cols-2 gap-4">
              {renderFormField('Max Redemptions (0=unlimited)', 'maxRedemptions', 'number', { min: 0 })}
              {renderFormField('Reward Expires (days)', 'rewardExpiresInDays', 'number', { min: 0 })}
            </div>
            {renderFormField('Applicable Plan IDs (comma-separated)', 'applicablePlanIds', 'textarea', { placeholder: 'Leave empty for all plans' })}
            {renderFormField('Expires At', 'expiresAt', 'date')}
          </>
        );
        case 'partners': return (
          <>
            {renderFormField('Partner Name *', 'partnerName', 'text')}
            {renderFormField('Partner Code *', 'partnerCode', 'text', { placeholder: 'PARTNER10' })}
            <div className="grid grid-cols-2 gap-4">
              {renderFormField('Contact Email', 'contactEmail', 'email')}
              {renderFormField('Contact Phone', 'contactPhone', 'text')}
            </div>
            {renderFormField('Discount Type', 'discountType', 'select', { placeholder: 'Select type', options: ['percentage', 'fixed_amount', 'free_months'] } as any)}
            {formData.discountType === 'percentage' && renderFormField('Discount Percent', 'discountPercent', 'number', { min: 0, max: 100 })}
            {formData.discountType === 'fixed_amount' && renderFormField('Discount Amount (kobo)', 'discountAmountKobo', 'number', { min: 0 })}
            {formData.discountType === 'free_months' && renderFormField('Free Months', 'freeMonths', 'number', { min: 0 })}
            <div className="grid grid-cols-2 gap-4">
              {renderFormField('Commission Percent', 'commissionPercent', 'number', { min: 0, max: 100 })}
              {renderFormField('Commission Amount (kobo)', 'commissionAmountKobo', 'number', { min: 0 })}
            </div>
            {renderFormField('Max Redemptions (0=unlimited)', 'maxRedemptions', 'number', { min: 0 })}
            {renderFormField('Applicable Plan IDs (comma-separated)', 'applicablePlanIds', 'textarea', { placeholder: 'Leave empty for all plans' })}
            {renderFormField('Region Restrictions (comma-separated)', 'regionRestrictions', 'text', { placeholder: 'NG, GH, KE' })}
            {renderFormField('Expires At', 'expiresAt', 'date')}
          </>
        );
        default: return null;
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
        <div className="bg-surface rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-border-custom">
            <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
            <button onClick={() => setShowModal(false)} className="text-ink-400 hover:text-ink-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSave} className="p-5 space-y-4">
            {fields()}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-ink-700 bg-surface border border-slate-300 rounded-lg hover:bg-surface-hover">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ── Render Tables ──
  const renderTable = () => {
    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-ink-400" /></div>;

    if (activeTab === 'coupons') return renderCouponsTable();
    if (activeTab === 'promotions') return renderPromotionsTable();
    if (activeTab === 'campaigns') return renderCampaignsTable();
    if (activeTab === 'referrals') return renderReferralsTable();
    if (activeTab === 'partners') return renderPartnersTable();
    if (activeTab === 'redemptions') return renderRedemptionsTable();
    return null;
  };

  const renderCouponsTable = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-ink-900">Coupons</h2>
        <button onClick={() => openCreate('coupons')} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> New Coupon
        </button>
      </div>
      {coupons.length === 0 ? (
        <div className="text-center py-16 text-ink-400"><Tag className="w-12 h-12 mx-auto mb-3 opacity-50" /><p className="text-sm">No coupons yet.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-custom">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle border-b border-border-custom">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Discount</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Uses</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Stack</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Expires</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-ink-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coupons.map((c: any) => (
                <tr key={c.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-surface-hover px-2 py-0.5 rounded text-ink-800">{c.code}</code>
                      <button onClick={() => copyCode(c.code)} className="text-ink-400 hover:text-ink-600"><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                  <td className="px-4 py-3"><DiscountBadge row={c} /></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.discountType === 'percentage' ? 'text-blue-600 bg-blue-50' : c.discountType === 'free_months' ? 'text-amber-600 bg-amber-50' : 'text-purple-600 bg-purple-50'}`}>
                      {c.discountType === 'percentage' ? <Percent className="w-3 h-3" /> : c.discountType === 'free_months' ? <Clock className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                      {c.discountType === 'percentage' ? '%' : c.discountType === 'free_months' ? 'Free' : 'Fixed'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{c.currentRedemptions ?? 0} / {c.maxRedemptions === 0 ? '∞' : c.maxRedemptions}</td>
                  <td className="px-4 py-3">{c.isStackable ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-slate-300" />}</td>
                  <td className="px-4 py-3 text-ink-600"><Calendar className="w-3.5 h-3.5 inline mr-1 text-ink-400" />{formatDate(c.expiresAt)}</td>
                  <td className="px-4 py-3"><StatusBadge active={c.isActive} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c, 'coupons')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderPromotionsTable = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-ink-900">Promotions</h2>
        <button onClick={() => openCreate('promotions')} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> New Promotion
        </button>
      </div>
      {promotions.length === 0 ? (
        <div className="text-center py-16 text-ink-400"><Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" /><p className="text-sm">No promotions yet.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-custom">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle border-b border-border-custom">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Discount</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Period</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Uses</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Budget</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Stack</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-ink-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promotions.map((p: any) => (
                <tr key={p.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3 font-medium text-ink-900">{p.name}</td>
                  <td className="px-4 py-3"><DiscountBadge row={p} /></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${p.discountType === 'percentage' ? 'text-blue-600 bg-blue-50' : p.discountType === 'free_months' ? 'text-amber-600 bg-amber-50' : 'text-purple-600 bg-purple-50'}`}>
                      {p.discountType === 'percentage' ? <Percent className="w-3 h-3" /> : p.discountType === 'free_months' ? <Clock className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-600 text-xs"><Calendar className="w-3.5 h-3.5 inline mr-1 text-ink-400" />{formatDate(p.startDate)} → {formatDate(p.endDate)}</td>
                  <td className="px-4 py-3 text-ink-600">{p.currentRedemptions ?? 0} / {p.maxRedemptions === 0 ? '∞' : p.maxRedemptions}</td>
                  <td className="px-4 py-3 text-ink-600">{p.budgetKobo ? fmtNaira(p.budgetKobo) : '∞'}</td>
                  <td className="px-4 py-3">{p.isStackable ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-slate-300" />}</td>
                  <td className="px-4 py-3"><StatusBadge active={p.isActive} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p, 'promotions')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderCampaignsTable = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-ink-900">Campaigns</h2>
        <button onClick={() => openCreate('campaigns')} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>
      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-ink-400"><BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" /><p className="text-sm">No campaigns yet.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-custom">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle border-b border-border-custom">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Period</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Budget</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Spent</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Uses</th>
                <th className="text-right px-4 py-3 font-medium text-ink-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c: any) => (
                <tr key={c.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3 font-medium text-ink-900">{c.name}</td>
                  <td className="px-4 py-3 text-ink-600 text-xs capitalize">{c.type}</td>
                  <td className="px-4 py-3"><CampaignStatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-ink-600 text-xs">
                    {c.startDate || c.endDate ? `${formatDate(c.startDate)} → ${formatDate(c.endDate)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-600">{c.budgetKobo ? fmtNaira(c.budgetKobo) : '∞'}</td>
                  <td className="px-4 py-3 text-ink-600">{c.spentKobo ? fmtNaira(c.spentKobo) : '₦0'}</td>
                  <td className="px-4 py-3 text-ink-600">{c.currentRedemptions ?? 0} / {c.maxRedemptions === 0 ? '∞' : c.maxRedemptions}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(c, 'campaigns')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                    <button onClick={() => handleDelete(c, 'campaigns')} className="text-sm text-red-600 hover:text-red-800 font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderReferralsTable = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-ink-900">Referral Codes</h2>
        <button onClick={() => openCreate('referrals')} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> New Referral Code
        </button>
      </div>
      {referrals.length === 0 ? (
        <div className="text-center py-16 text-ink-400"><Gift className="w-12 h-12 mx-auto mb-3 opacity-50" /><p className="text-sm">No referral codes yet.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-custom">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle border-b border-border-custom">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Reward</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Uses</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Expires</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-ink-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {referrals.map((r: any) => {
                const active = r.isActive !== false;
                return (
                  <tr key={r.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-surface-hover px-2 py-0.5 rounded text-ink-800">{r.code}</code>
                        <button onClick={() => copyCode(r.code)} className="text-ink-400 hover:text-ink-600"><Copy className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.rewardType === 'free_months' ? <span className="text-amber-600 font-medium">{r.rewardFreeMonths}mo free</span>
                        : r.rewardType === 'percentage' ? <span className="text-blue-600 font-medium">{r.rewardValue}%</span>
                        : <span className="text-purple-600 font-medium">{fmtNaira(r.rewardValue)}</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-600">{r.currentRedemptions ?? 0} / {r.maxRedemptions === 0 ? '∞' : r.maxRedemptions}</td>
                    <td className="px-4 py-3 text-ink-600"><Calendar className="w-3.5 h-3.5 inline mr-1 text-ink-400" />{formatDate(r.expiresAt)}</td>
                    <td className="px-4 py-3"><StatusBadge active={active} /></td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => openEdit(r, 'referrals')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                      <button onClick={() => handleDelete(r, 'referrals')} className="text-sm text-red-600 hover:text-red-800 font-medium">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderPartnersTable = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-ink-900">Partner Discounts</h2>
        <button onClick={() => openCreate('partners')} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> New Partner Discount
        </button>
      </div>
      {partners.length === 0 ? (
        <div className="text-center py-16 text-ink-400"><Handshake className="w-12 h-12 mx-auto mb-3 opacity-50" /><p className="text-sm">No partner discounts yet.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-custom">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle border-b border-border-custom">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Partner</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Discount</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Commission</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Uses</th>
                <th className="text-left px-4 py-3 font-medium text-ink-600">Expires</th>
                <th className="text-right px-4 py-3 font-medium text-ink-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partners.map((p: any) => {
                const active = p.isActive !== false;
                return (
                  <tr key={p.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 font-medium text-ink-900">{p.partnerName}</td>
                    <td className="px-4 py-3"><code className="text-sm font-mono bg-surface-hover px-2 py-0.5 rounded text-ink-800">{p.partnerCode}</code></td>
                    <td className="px-4 py-3">
                      {p.discountType === 'free_months' ? <span className="text-amber-600 font-medium">{p.freeMonths}mo free</span>
                        : p.discountType === 'percentage' ? <span className="text-blue-600 font-medium">{p.discountPercent}%</span>
                        : <span className="text-purple-600 font-medium">{fmtNaira(p.discountAmountKobo)}</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-600">{p.commissionPercent ? `${p.commissionPercent}%` : p.commissionAmountKobo ? fmtNaira(p.commissionAmountKobo) : '—'}</td>
                    <td className="px-4 py-3 text-ink-600">{p.currentRedemptions ?? 0} / {p.maxRedemptions === 0 ? '∞' : p.maxRedemptions}</td>
                    <td className="px-4 py-3 text-ink-600"><Calendar className="w-3.5 h-3.5 inline mr-1 text-ink-400" />{formatDate(p.expiresAt)}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => openEdit(p, 'partners')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                      <button onClick={() => handleDelete(p, 'partners')} className="text-sm text-red-600 hover:text-red-800 font-medium">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderRedemptionsTable = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-ink-900">Redemption History</h2>
        <button onClick={loadRedemptions} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-700 bg-surface border border-slate-300 rounded-lg hover:bg-surface-hover">
          <Loader2 className="w-4 h-4" /> Refresh
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border-custom">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle border-b border-border-custom">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-ink-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-ink-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-ink-600">Source</th>
              <th className="text-left px-4 py-3 font-medium text-ink-600">Discount</th>
              <th className="text-left px-4 py-3 font-medium text-ink-600">Original</th>
              <th className="text-left px-4 py-3 font-medium text-ink-600">Final</th>
              <th className="text-left px-4 py-3 font-medium text-ink-600">Free Months</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {redemptions.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-ink-400">No redemption history yet.</td></tr>
            ) : (
              redemptions.map((r: any) => (
                <tr key={r.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3 text-ink-600 text-xs">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.redemptionType === 'coupon' ? 'bg-blue-50 text-blue-700' :
                      r.redemptionType === 'promotion' ? 'bg-purple-50 text-purple-700' :
                      r.redemptionType === 'referral' ? 'bg-amber-50 text-amber-700' :
                      r.redemptionType === 'partner' ? 'bg-green-50 text-green-700' :
                      'bg-surface-subtle text-ink-700'
                    }`}>{r.redemptionType}</span>
                  </td>
                  <td className="px-4 py-3"><code className="text-xs font-mono bg-surface-hover px-1.5 py-0.5 rounded text-ink-700">{r.sourceCode || r.sourceId?.slice(0, 8)}</code></td>
                  <td className="px-4 py-3 font-medium text-emerald-600">{fmtNaira(r.discountKobo)}</td>
                  <td className="px-4 py-3 text-ink-600">{fmtNaira(r.originalAmountKobo)}</td>
                  <td className="px-4 py-3 text-ink-900 font-medium">{fmtNaira(r.finalAmountKobo)}</td>
                  <td className="px-4 py-3 text-ink-600">{r.freeMonths ? `${r.freeMonths}mo` : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  // ── Main Render ──
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Tab Header */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={tabClass(t.key)}>
              <Icon className="w-4 h-4 inline mr-1.5 -mt-0.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {renderTable()}
      {renderModal()}
    </div>
  );
}
