import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import {
  Loader2, ShoppingCart, Package, Users, HardDrive, Building2, Warehouse,
  Zap, ScanLine, Briefcase, Users2, Smartphone, Factory, BarChart3,
  TrendingUp, Globe, MessageSquare, Mail, Check, X, Plus, Minus,
  RefreshCw, Clock, Calendar, DollarSign, ToggleLeft, AlertCircle,
  Info, ExternalLink, CreditCard, Layers
} from 'lucide-react';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  users: Users, storage: HardDrive, companies: Building2, warehouses: Warehouse,
  credits: Zap, modules: Package, packages: Layers,
};

const CATEGORY_LABELS: Record<string, string> = {
  users: 'Users & Seats', storage: 'Storage', companies: 'Companies',
  warehouses: 'Warehouses', credits: 'Credits', modules: 'Modules',
  packages: 'Packages',
};

const CATEGORY_COLORS: Record<string, string> = {
  users: 'bg-blue-50 text-blue-700 border-blue-200',
  storage: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  companies: 'bg-purple-50 text-purple-700 border-purple-200',
  warehouses: 'bg-teal-50 text-teal-700 border-teal-200',
  credits: 'bg-amber-50 text-amber-700 border-amber-200',
  modules: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  packages: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

interface Product {
  id: string; code: string; name: string; description: string; icon: string;
  category: string; monthlyPriceKobo: number; annualPriceKobo: number;
  usageLimit: number; limitKey: string; isActive: boolean; isPublic: boolean;
}

interface OrgAddon {
  sa: {
    id: string; productId: string; name: string; description: string;
    priceKobo: number; priceWhenPurchasedKobo: number; quantity: number;
    billingCycle: string; autoRenew: boolean;
    isActive: boolean; activatedAt: string; expiresAt: string; nextBillingDate: string;
    addedAt: string; removedAt: string;
  };
  product: Product | null;
}

function PurchaseModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [quantity, setQuantity] = useState(1);
  const [autoRenew, setAutoRenew] = useState(true);

  const price = billingCycle === 'annual' ? Number(product.annualPriceKobo) : Number(product.monthlyPriceKobo);
  const total = price * quantity;

  const purchaseMut = useMutation({
    mutationFn: () => subscriptionApi.purchaseAddon({ productId: product.id, quantity, billingCycle, autoRenew }),
    onSuccess: () => {
      toast(`"${product.name}" add-on purchased!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['org-addons'] });
      onClose();
    },
    onError: (err: any) => toast(err?.response?.data?.error || 'Purchase failed', 'error'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" /> Purchase {product.name}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-sm text-slate-600 mb-4">{product.description}</p>

        {product.usageLimit > 0 && product.limitKey && (
          <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm text-slate-700">
            <Info className="w-4 h-4 inline mr-1 text-indigo-500" />
            Includes <strong>{product.usageLimit}</strong> additional {product.limitKey.replace(/([A-Z])/g, ' $1').toLowerCase()} per unit
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Billing Cycle</label>
            <div className="grid grid-cols-2 gap-2">
              {(['monthly', 'annual'] as const).map(cycle => (
                <button key={cycle} onClick={() => setBillingCycle(cycle)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    billingCycle === cycle
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  <span className="block text-lg font-bold">{fmtNaira(cycle === 'annual' ? product.annualPriceKobo : product.monthlyPriceKobo)}</span>
                  <span className="text-xs capitalize">{cycle}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantity</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50"><Minus className="w-4 h-4" /></button>
              <span className="text-xl font-bold w-12 text-center">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50"><Plus className="w-4 h-4" /></button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-slate-700">Auto-renew each period</span>
          </label>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200">
          <div className="flex justify-between text-lg font-bold text-slate-900 mb-4">
            <span>Total</span>
            <span>{fmtNaira(total)}/{billingCycle === 'annual' ? 'yr' : 'mo'}</span>
          </div>
          <button onClick={() => purchaseMut.mutate()} disabled={purchaseMut.isPending}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {purchaseMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {purchaseMut.isPending ? 'Processing...' : `Purchase for ${fmtNaira(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddonCard({ addon, onRefresh }: { addon: OrgAddon; onRefresh: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sa = addon.sa;
  const product = addon.product;

  const cancelMut = useMutation({
    mutationFn: () => subscriptionApi.cancelAddon(sa.id),
    onSuccess: () => { toast('Add-on cancelled', 'success'); queryClient.invalidateQueries({ queryKey: ['org-addons'] }); onRefresh(); },
    onError: (err: any) => toast(err?.response?.data?.error || 'Failed to cancel', 'error'),
  });

  const toggleRenewMut = useMutation({
    mutationFn: () => subscriptionApi.toggleAddonAutoRenew(sa.id, !sa.autoRenew),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['org-addons'] }); onRefresh(); },
    onError: (err: any) => toast(err?.response?.data?.error || 'Failed to update', 'error'),
  });

  const CatIcon = CATEGORY_ICONS[product?.category || ''] || Package;

  return (
    <div className={`bg-white rounded-xl border p-5 ${sa.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
            <CatIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{sa.name}</h3>
            <p className="text-xs text-slate-500">
              {sa.quantity} x {fmtNaira(Number(sa.priceWhenPurchasedKobo || sa.priceKobo / sa.quantity))}
              <span className="capitalize">/{sa.billingCycle}</span>
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
          sa.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {sa.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {sa.isActive && (
        <div className="space-y-2 mt-3 text-sm text-slate-600">
          {sa.activatedAt && <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Activated {fmtDate(sa.activatedAt)}</p>}
          {sa.expiresAt && <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Expires {fmtDate(sa.expiresAt)}</p>}
          {sa.nextBillingDate && <p className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Next billing {fmtDate(sa.nextBillingDate)}</p>}
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input type="checkbox" checked={sa.autoRenew} onChange={() => toggleRenewMut.mutate()}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-xs text-slate-600">Auto-renew</span>
          </label>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        {sa.isActive && (
          <button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export function AddonMarketplacePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const orgId = user?.organisationId;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<Product | null>(null);
  const [tab, setTab] = useState<'marketplace' | 'my-addons'>('marketplace');

  const { data: productsData, isLoading: productsLoading } = useQuery<{ data: Product[] }>({
    queryKey: ['addon-products'],
    queryFn: () => subscriptionApi.listMarketplaceAddons(),
    enabled: !!orgId,
  });

  const { data: addonsData, isLoading: addonsLoading, refetch: refetchAddons } = useQuery<{ data: OrgAddon[] }>({
    queryKey: ['org-addons'],
    queryFn: () => subscriptionApi.listMyAddons(),
    enabled: !!orgId,
  });

  const products = productsData?.data || [];
  const orgAddons = addonsData?.data || [];

  const categories = [...new Set(products.map(p => p.category))].sort();
  const filtered = selectedCategory ? products.filter(p => p.category === selectedCategory) : products;

  if (productsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" /> Add-on Marketplace
          </h1>
          <p className="text-sm text-slate-500 mt-1">Browse and purchase optional add-ons to extend your plan</p>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('marketplace')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'marketplace' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ShoppingCart className="w-4 h-4 inline mr-1.5" />Browse Add-ons
        </button>
        <button onClick={() => setTab('my-addons')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'my-addons' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Package className="w-4 h-4 inline mr-1.5" />My Add-ons ({orgAddons.filter(a => a.sa.isActive).length})
        </button>
      </div>

      {tab === 'marketplace' && (
        <>
          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${!selectedCategory ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedCategory === cat ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(product => {
              const CatIcon = CATEGORY_ICONS[product.category] || Package;
              const colorClass = CATEGORY_COLORS[product.category] || 'bg-slate-50 text-slate-700 border-slate-200';
              return (
                <div key={product.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2.5 rounded-lg ${colorClass.split(' ')[0]} ${colorClass.split(' ')[1]}`}>
                      <CatIcon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorClass}`}>
                      {CATEGORY_LABELS[product.category] || product.category}
                    </span>
                  </div>

                  <h3 className="font-semibold text-slate-900 mb-1">{product.name}</h3>
                  <p className="text-sm text-slate-500 mb-3 flex-1">{product.description}</p>

                  {product.usageLimit > 0 && (
                    <p className="text-xs text-indigo-600 mb-3">
                      +{product.usageLimit} {product.limitKey?.replace(/([A-Z])/g, ' $1').toLowerCase() || ''} per unit
                    </p>
                  )}

                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 text-center p-2 rounded-lg bg-slate-50">
                      <p className="text-sm font-bold text-slate-900">{fmtNaira(product.monthlyPriceKobo)}</p>
                      <p className="text-[10px] text-slate-500">/month</p>
                    </div>
                    <div className="flex-1 text-center p-2 rounded-lg bg-slate-50">
                      <p className="text-sm font-bold text-slate-900">{fmtNaira(product.annualPriceKobo)}</p>
                      <p className="text-[10px] text-slate-500">/year</p>
                    </div>
                  </div>

                  <button onClick={() => setPurchasing(product)}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5">
                    <ShoppingCart className="w-4 h-4" /> Purchase
                  </button>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-2" />
              <p>No add-ons available in this category.</p>
            </div>
          )}
        </>
      )}

      {tab === 'my-addons' && (
        <>
          {addonsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : orgAddons.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-2" />
              <p>You haven't purchased any add-ons yet.</p>
              <button onClick={() => setTab('marketplace')} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                Browse Marketplace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orgAddons.map(addon => (
                <AddonCard key={addon.sa.id} addon={addon} onRefresh={() => refetchAddons()} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Purchase Modal */}
      {purchasing && <PurchaseModal product={purchasing} onClose={() => setPurchasing(null)} />}
    </div>
  );
}
