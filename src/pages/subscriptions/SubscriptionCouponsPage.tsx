import React, { useState, useEffect } from 'react';
import { Plus, Tag, Megaphone, Percent, DollarSign, Check, X, Calendar, Users, Clock, Loader2, Copy, ExternalLink } from 'lucide-react';
import { subscriptionApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';

function fmtNaira(v: number): string {
  const n = Math.abs(v) / 100;
  return `₦${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | Date | null): string {
  if (!d) return 'Never';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const initialCouponForm = {
  code: '',
  description: '',
  discountType: 'percentage' as 'percentage' | 'fixed_amount',
  discountPercent: 0,
  discountAmountKobo: 0,
  maxRedemptions: 0,
  minAmountKobo: 0,
  maxAmountKobo: 0,
  applicablePlanIds: '',
  expiresAt: '',
  isActive: true,
  isFirstOrderOnly: false,
};

const initialPromotionForm = {
  name: '',
  description: '',
  discountType: 'percentage' as 'percentage' | 'fixed_amount',
  discountPercent: 0,
  discountAmountKobo: 0,
  applicablePlanIds: '',
  startDate: '',
  endDate: '',
  maxRedemptions: 0,
  isActive: true,
};

export function SubscriptionCouponsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'coupons' | 'promotions'>('coupons');
  const [coupons, setCoupons] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [showPromotionForm, setShowPromotionForm] = useState(false);
  const [couponForm, setCouponForm] = useState(initialCouponForm);
  const [promotionForm, setPromotionForm] = useState(initialPromotionForm);

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        subscriptionApi.listCoupons(),
        subscriptionApi.listPromotions(),
      ]);
      setCoupons(c);
      setPromotions(p);
    } catch {
      toast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Copied!', 'success');
    } catch {
      toast('Failed to copy', 'error');
    }
  };

  // Coupon CRUD
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        code: couponForm.code,
        description: couponForm.description || null,
        discountType: couponForm.discountType,
        maxRedemptions: couponForm.maxRedemptions || 0,
        minAmountKobo: couponForm.minAmountKobo > 0 ? Number(couponForm.minAmountKobo) : null,
        maxAmountKobo: couponForm.maxAmountKobo > 0 ? Number(couponForm.maxAmountKobo) : null,
        applicablePlanIds: couponForm.applicablePlanIds
          ? couponForm.applicablePlanIds.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
        isActive: couponForm.isActive,
        isFirstOrderOnly: couponForm.isFirstOrderOnly,
        orgId: user?.organisationId || null,
      };
      if (couponForm.discountType === 'percentage') {
        payload.discountPercent = couponForm.discountPercent;
        payload.discountAmountKobo = null;
      } else {
        payload.discountAmountKobo = Number(couponForm.discountAmountKobo);
        payload.discountPercent = null;
      }
      if (couponForm.expiresAt) {
        payload.expiresAt = new Date(couponForm.expiresAt).toISOString();
      } else {
        payload.expiresAt = null;
      }
      await subscriptionApi.createCoupon(payload);
      toast('Coupon created', 'success');
      setShowCouponForm(false);
      setCouponForm(initialCouponForm);
      loadData();
    } catch (err: any) {
      toast(err?.response?.data?.error || 'Failed to create coupon', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Promotion CRUD
  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        name: promotionForm.name,
        description: promotionForm.description || null,
        discountType: promotionForm.discountType,
        maxRedemptions: promotionForm.maxRedemptions || 0,
        applicablePlanIds: promotionForm.applicablePlanIds
          ? promotionForm.applicablePlanIds.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
        startDate: new Date(promotionForm.startDate).toISOString(),
        endDate: new Date(promotionForm.endDate).toISOString(),
        isActive: promotionForm.isActive,
        orgId: user?.organisationId || null,
      };
      if (promotionForm.discountType === 'percentage') {
        payload.discountPercent = promotionForm.discountPercent;
        payload.discountAmountKobo = null;
      } else {
        payload.discountAmountKobo = Number(promotionForm.discountAmountKobo);
        payload.discountPercent = null;
      }
      await subscriptionApi.createPromotion(payload);
      toast('Promotion created', 'success');
      setShowPromotionForm(false);
      setPromotionForm(initialPromotionForm);
      loadData();
    } catch (err: any) {
      toast(err?.response?.data?.error || 'Failed to create promotion', 'error');
    } finally {
      setSaving(false);
    }
  };

  const tabClass = (tab: 'coupons' | 'promotions') =>
    `px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-white text-slate-600 hover:bg-slate-50'
    }`;

  const DiscountBadge = ({ row }: { row: any }) => {
    if (row.discountType === 'percentage') {
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600">
          <Percent className="w-3.5 h-3.5" /> {row.discountPercent}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-purple-600">
        <DollarSign className="w-3.5 h-3.5" /> {fmtNaira(row.discountAmountKobo)}
      </span>
    );
  };

  const StatusBadge = ({ active }: { active: boolean }) => (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
      active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
    }`}>
      {active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {active ? 'Active' : 'Inactive'}
    </span>
  );

  const renderCouponForm = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCouponForm(false)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">New Coupon</h3>
          <button onClick={() => setShowCouponForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleCreateCoupon} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
            <input type="text" required value={couponForm.code} onChange={e => setCouponForm(f => ({ ...f, code: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="SUMMER20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={couponForm.description} onChange={e => setCouponForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount Type *</label>
            <select value={couponForm.discountType} onChange={e => setCouponForm(f => ({ ...f, discountType: e.target.value as any }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
              <option value="percentage">Percentage</option>
              <option value="fixed_amount">Fixed Amount</option>
            </select>
          </div>
          {couponForm.discountType === 'percentage' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Discount Percent *</label>
              <input type="number" min={0} max={100} required value={couponForm.discountPercent} onChange={e => setCouponForm(f => ({ ...f, discountPercent: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Discount Amount (kobo) *</label>
              <input type="number" min={0} required value={couponForm.discountAmountKobo} onChange={e => setCouponForm(f => ({ ...f, discountAmountKobo: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Min Amount (kobo)</label>
              <input type="number" min={0} value={couponForm.minAmountKobo} onChange={e => setCouponForm(f => ({ ...f, minAmountKobo: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Amount (kobo)</label>
              <input type="number" min={0} value={couponForm.maxAmountKobo} onChange={e => setCouponForm(f => ({ ...f, maxAmountKobo: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Redemptions (0 = unlimited)</label>
            <input type="number" min={0} value={couponForm.maxRedemptions} onChange={e => setCouponForm(f => ({ ...f, maxRedemptions: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Applicable Plan IDs (comma-separated UUIDs)</label>
            <textarea value={couponForm.applicablePlanIds} onChange={e => setCouponForm(f => ({ ...f, applicablePlanIds: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" rows={2} placeholder="Leave empty for all plans" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expires At</label>
            <input type="date" value={couponForm.expiresAt} onChange={e => setCouponForm(f => ({ ...f, expiresAt: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={couponForm.isActive} onChange={e => setCouponForm(f => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={couponForm.isFirstOrderOnly} onChange={e => setCouponForm(f => ({ ...f, isFirstOrderOnly: e.target.checked }))}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              First Order Only
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCouponForm(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Create Coupon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderPromotionForm = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPromotionForm(false)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">New Promotion</h3>
          <button onClick={() => setShowPromotionForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleCreatePromotion} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input type="text" required value={promotionForm.name} onChange={e => setPromotionForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Summer Sale 2026" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={promotionForm.description} onChange={e => setPromotionForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount Type *</label>
            <select value={promotionForm.discountType} onChange={e => setPromotionForm(f => ({ ...f, discountType: e.target.value as any }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
              <option value="percentage">Percentage</option>
              <option value="fixed_amount">Fixed Amount</option>
            </select>
          </div>
          {promotionForm.discountType === 'percentage' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Discount Percent *</label>
              <input type="number" min={0} max={100} required value={promotionForm.discountPercent} onChange={e => setPromotionForm(f => ({ ...f, discountPercent: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Discount Amount (kobo) *</label>
              <input type="number" min={0} required value={promotionForm.discountAmountKobo} onChange={e => setPromotionForm(f => ({ ...f, discountAmountKobo: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Applicable Plan IDs (comma-separated UUIDs)</label>
            <textarea value={promotionForm.applicablePlanIds} onChange={e => setPromotionForm(f => ({ ...f, applicablePlanIds: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" rows={2} placeholder="Leave empty for all plans" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
              <input type="datetime-local" required value={promotionForm.startDate} onChange={e => setPromotionForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
              <input type="datetime-local" required value={promotionForm.endDate} onChange={e => setPromotionForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Redemptions (0 = unlimited)</label>
            <input type="number" min={0} value={promotionForm.maxRedemptions} onChange={e => setPromotionForm(f => ({ ...f, maxRedemptions: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={promotionForm.isActive} onChange={e => setPromotionForm(f => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              Active
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowPromotionForm(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Create Promotion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Tab Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setActiveTab('coupons')} className={tabClass('coupons')}>
          <Tag className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Coupons
        </button>
        <button onClick={() => setActiveTab('promotions')} className={tabClass('promotions')}>
          <Megaphone className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Promotions
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : activeTab === 'coupons' ? (
        <>
          {/* Coupons Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Coupons</h2>
            <button onClick={() => setShowCouponForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> New Coupon
            </button>
          </div>

          {/* Coupons Table */}
          {coupons.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No coupons yet. Create your first coupon to start offering discounts.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Discount</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Min Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Max Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Uses</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Expires</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coupons.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800">{c.code}</code>
                          <button onClick={() => copyCode(c.code)} className="text-slate-400 hover:text-slate-600" title="Copy code">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.discountType === 'percentage' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            <Percent className="w-3 h-3" /> Percentage
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            <DollarSign className="w-3 h-3" /> Fixed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><DiscountBadge row={c} /></td>
                      <td className="px-4 py-3 text-slate-600">{c.minAmountKobo ? fmtNaira(c.minAmountKobo) : '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{c.maxAmountKobo ? fmtNaira(c.maxAmountKobo) : '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.currentRedemptions ?? 0} / {c.maxRedemptions === 0 ? '∞' : c.maxRedemptions}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(c.expiresAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge active={c.isActive} /></td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showCouponForm && renderCouponForm()}
        </>
      ) : (
        <>
          {/* Promotions Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Promotions</h2>
            <button onClick={() => setShowPromotionForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> New Promotion
            </button>
          </div>

          {/* Promotions Table */}
          {promotions.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No promotions yet. Create your first promotion.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Discount</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Period</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Uses</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {promotions.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                      <td className="px-4 py-3">
                        {p.discountType === 'percentage' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            <Percent className="w-3 h-3" /> Percentage
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            <DollarSign className="w-3 h-3" /> Fixed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><DiscountBadge row={p} /></td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(p.startDate)} → {formatDate(p.endDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.currentRedemptions ?? 0} / {p.maxRedemptions === 0 ? '∞' : p.maxRedemptions}
                      </td>
                      <td className="px-4 py-3"><StatusBadge active={p.isActive} /></td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showPromotionForm && renderPromotionForm()}
        </>
      )}
    </div>
  );
}
