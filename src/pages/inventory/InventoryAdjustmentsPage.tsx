import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, Search, X, Loader2, AlertCircle, CheckCircle2, Clock, DraftingCompass,
  FileText, Calendar, Hash, Tag, MapPin, Upload, Download, Trash2, Eye
} from 'lucide-react';

const fmtNaira = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0);
  return '₦' + Math.abs(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusBadge = (status: string) => {
  if (status === 'adjusted') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200"><CheckCircle2 size={12} /> Adjusted</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200"><Clock size={12} /> Draft</span>;
};

interface ItemEntry {
  itemId: string;
  itemName: string;
  sku: string | null;
  unit: string | null;
  quantityAvailable: number;
  newQuantity: number;
  currentUnitCost: number;
  newUnitCost: number;
}

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtDateDisplay = (d: string) => {
  const dt = new Date(d);
  return `${dt.getDate()} ${monthNames[dt.getMonth()]} ${dt.getFullYear()}`;
};

export default function InventoryAdjustmentsPage() {
  const queryClient = useQueryClient();
  const [filterMode, setFilterMode] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // New adjustment form state
  const [mode, setMode] = useState<'quantity' | 'value'>('quantity');
  const [adjDate, setAdjDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [accountId, setAccountId] = useState('');
  const [reason, setReason] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [selectedItems, setSelectedItems] = useState<ItemEntry[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch adjustments
  const { data: adjustments, isLoading } = useQuery<any[]>({
    queryKey: ['inventory', 'adjustments', filterMode, filterStatus],
    queryFn: async () => {
      const params: any = {};
      if (filterMode !== 'all') params.mode = filterMode;
      if (filterStatus !== 'all') params.status = filterStatus;
      const res = await api.get('/inventory/adjustments', { params });
      return res.data;
    },
  });

  // Fetch items for the form dropdown
  const { data: inventoryItems } = useQuery<any[]>({
    queryKey: ['inventory', 'items'],
    queryFn: async () => {
      const res = await api.get('/inventory/items');
      return res.data;
    },
  });

  // Fetch GL accounts for the account dropdown
  const { data: glAccounts } = useQuery<any[]>({
    queryKey: ['accountant', 'accounts'],
    queryFn: async () => {
      const res = await api.get('/accountant/accounts');
      return res.data;
    },
  });

  // Fetch org settings for default adjustment account
  const { data: orgSettings } = useQuery<any>({
    queryKey: ['orgSettings'],
    queryFn: async () => {
      const res = await api.get('/org/settings');
      return res.data;
    },
  });

  // Pre-fill account with default from settings
  useEffect(() => {
    if (orgSettings?.accountant?.defaultAdjustmentAccountId && !accountId) {
      setAccountId(orgSettings.accountant.defaultAdjustmentAccountId);
    }
  }, [orgSettings]);

  const [defaultAccount, setDefaultAccount] = useState('');
  useEffect(() => {
    if (orgSettings?.accountant?.defaultAdjustmentAccountId) {
      setDefaultAccount(orgSettings.accountant.defaultAdjustmentAccountId);
    }
  }, [orgSettings]);

  const [savingDefaultAccount, setSavingDefaultAccount] = useState(false);
  const [defaultAccountSaved, setDefaultAccountSaved] = useState(false);
  const handleSaveDefaultAccount = async () => {
    if (!defaultAccount) return;
    setSavingDefaultAccount(true);
    try {
      await api.patch('/org/settings', { settings: { accountant: { defaultAdjustmentAccountId: defaultAccount } } });
      setDefaultAccountSaved(true);
      setTimeout(() => setDefaultAccountSaved(false), 3000);
    } catch { /* ignore */ }
    setSavingDefaultAccount(false);
  };

  const filtered = useMemo(() => {
    if (!adjustments) return [];
    let list = adjustments;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a: any) =>
        a.reference?.toLowerCase().includes(q) ||
        a.reason?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [adjustments, searchQuery]);

  // Create adjustment mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/inventory/adjustments', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'adjustments'] });
      resetForm();
      setShowNewModal(false);
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || 'Failed to create adjustment.'),
  });

  // Adjust (apply) mutation
  const adjustMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/inventory/adjustments/${id}/adjust`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'adjustments'] });
      setViewingId(null);
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || 'Failed to apply adjustment.'),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/inventory/adjustments/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory', 'adjustments'] }),
  });

  const resetForm = () => {
    setMode('quantity');
    setAdjDate(new Date().toISOString().split('T')[0]);
    setReference('');
    setAccountId(orgSettings?.accountant?.defaultAdjustmentAccountId || '');
    setReason('');
    setLocation('');
    setDescription('');
    setSelectedItems([]);
    setFiles([]);
    setFormError('');
  };

  const handleAddItem = (itemId: string) => {
    const item = inventoryItems?.find((i: any) => i.id === itemId);
    if (!item) return;
    if (selectedItems.some(s => s.itemId === itemId)) return;
    setSelectedItems([...selectedItems, {
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      unit: item.unit,
      quantityAvailable: Number(item.stockOnHand ?? 0),
      newQuantity: Number(item.stockOnHand ?? 0),
      currentUnitCost: item.purchasePrice || 0,
      newUnitCost: item.purchasePrice || 0,
    }]);
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(s => s.itemId !== itemId));
  };

  const handleSubmit = async (status: 'draft' | 'adjusted') => {
    setFormError('');
    if (selectedItems.length === 0) { setFormError('Add at least one item.'); return; }
    if (!accountId) { setFormError('Select an adjustment account.'); return; }
    if (mode === 'value' && selectedItems.some(s => s.newUnitCost < 0)) { setFormError('New unit cost cannot be negative.'); return; }
    setSaving(true);
    try {
      const payload: any = {
        mode,
        date: adjDate,
        reference: reference.trim() || undefined,
        accountId,
        reason: reason || null,
        location: location || null,
        description: description || null,
        items: selectedItems.map(s => ({
          itemId: s.itemId,
          quantityAvailable: s.quantityAvailable,
          newQuantity: mode === 'quantity' ? s.newQuantity : s.quantityAvailable,
          currentUnitCost: s.currentUnitCost,
          newUnitCost: mode === 'value' ? s.newUnitCost : s.currentUnitCost,
        })),
      };
      const created = await createMutation.mutateAsync(payload);
      if (status === 'adjusted') {
        await adjustMutation.mutateAsync(created.id);
      }
      // Upload files if any
      if (files.length > 0 && created.id) {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        await api.post(`/inventory/adjustments/${created.id}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
    } catch (e: any) {
      setFormError(e?.response?.data?.error || 'Failed to save adjustment.');
    } finally {
      setSaving(false);
    }
  };

  // Detail view
  const viewingAdj = useMemo(() => {
    if (!viewingId || !adjustments) return null;
    return adjustments.find((a: any) => a.id === viewingId);
  }, [viewingId, adjustments]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <button onClick={() => { resetForm(); setShowNewModal(true); }} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-semibold shadow-md hover:shadow-lg">
          <Plus size={18} /> +New
        </button>
      </div>

      {/* Default Adjustment Account */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Default Adjustments Account</label>
            <select value={defaultAccount} onChange={e => setDefaultAccount(e.target.value)} className="w-full sm:w-80 text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Select default adjustment account...</option>
              {glAccounts?.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
              ))}
            </select>
          </div>
          <button onClick={handleSaveDefaultAccount} disabled={savingDefaultAccount || !defaultAccount} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 shrink-0">
            {savingDefaultAccount ? 'Saving...' : defaultAccountSaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{adjustments?.length || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Draft</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{adjustments?.filter((a: any) => a.status === 'draft').length || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Adjusted</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{adjustments?.filter((a: any) => a.status === 'adjusted').length || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Quantity</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{adjustments?.filter((a: any) => a.mode === 'quantity').length || 0}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm flex-1 min-w-[200px]">
          <Search size={16} className="text-slate-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search adjustments..." className="flex-1 text-sm bg-transparent outline-none border-none text-slate-700 placeholder:text-slate-400" />
          {searchQuery && <X size={14} className="text-slate-400 cursor-pointer" onClick={() => setSearchQuery('')} />}
        </div>
        <select value={filterMode} onChange={e => setFilterMode(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="all">All Types</option>
          <option value="quantity">Quantity</option>
          <option value="value">Value</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="adjusted">Adjusted</option>
        </select>
      </div>

      {/* Adjustment list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-slate-300" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center"><DraftingCompass size={32} className="text-slate-400" /></div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No adjustments yet</h3>
          <p className="text-sm text-slate-400 mb-4">Create your first inventory adjustment to keep stock accurate.</p>
          <button onClick={() => { resetForm(); setShowNewModal(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-medium">
            <Plus size={16} /> New Adjustment
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100/80 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Reference</th>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Mode</th>
                  <th className="text-left px-4 py-3 font-semibold">Reason</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Items</th>
                  <th className="text-right px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((adj: any) => (
                  <tr key={adj.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{adj.reference}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtDate(adj.date)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium capitalize ${adj.mode === 'quantity' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>{adj.mode}</span></td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{adj.reason || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(adj.status)}</td>
                    <td className="px-4 py-3 text-slate-500">{(adj.lineItems || []).length} item(s)</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewingId(adj.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title="View"><Eye size={15} /></button>
                        {adj.status === 'draft' && (
                          <>
                            <button onClick={() => adjustMutation.mutate(adj.id)} className="p-1.5 rounded-lg hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors" title="Apply Adjustment"><CheckCircle2 size={15} /></button>
                            <button onClick={() => { if (confirm('Delete this draft?')) deleteMutation.mutate(adj.id); }} className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors" title="Delete"><Trash2 size={15} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Adjustment Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">New Adjustment</h2>
              <button onClick={() => setShowNewModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[calc(100vh-140px)] overflow-y-auto">
              {/* Mode of adjustment-button */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Mode of Adjustment</label>
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                  <button onClick={() => setMode('quantity')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'quantity' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Quantity Adjustment</button>
                  <button onClick={() => setMode('value')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'value' ? 'bg-white text-purple-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Value Adjustment</button>
                </div>
              </div>

              {/* Reference + Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference Number</label>
                  <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-white">
                    <Hash size={14} className="text-slate-400 shrink-0" />
                    <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Auto-generated if left empty" className="flex-1 text-sm bg-transparent outline-none border-none text-slate-700 placeholder:text-slate-400" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
                  <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-white">
                    <Calendar size={14} className="text-slate-400 shrink-0" />
                    <input type="date" value={adjDate} onChange={e => setAdjDate(e.target.value)} className="flex-1 text-sm bg-transparent outline-none border-none text-slate-700" />
                    <span className="text-xs text-slate-400 font-medium ml-auto whitespace-nowrap">{fmtDateDisplay(adjDate)}</span>
                  </div>
                </div>
              </div>

              {/* Account + Reason + Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Account <span className="text-red-400">*</span></label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Select account...</option>
                  {glAccounts?.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason</label>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this adjustment needed?" className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Warehouse A" className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description: Max. 500 characters</label>
                <textarea value={description} onChange={e => { if (e.target.value.length <= 500) setDescription(e.target.value); }} rows={3} placeholder="Optional notes about this adjustment..." className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
                <p className="text-[11px] text-slate-400 text-right">{description.length}/500</p>
              </div>

              {/* Item Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-700">Items</h4>
                  <select onChange={e => { if (e.target.value) { handleAddItem(e.target.value); e.target.value = ''; } }} className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white outline-none">
                    <option value="">+ Add Item</option>
                    {inventoryItems?.filter((i: any) => i.trackInventory).map((i: any) => (
                      <option key={i.id} value={i.id}>{i.name} {i.sku ? `(${i.sku})` : ''}</option>
                    ))}
                  </select>
                </div>
                {selectedItems.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">No items added yet. Select an item above.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100/80 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="text-left px-3 py-2.5 font-semibold">Item Details</th>
                          <th className="text-right px-3 py-2.5 font-semibold">{mode === 'quantity' ? 'Quantity Available' : 'Current Unit Cost'}</th>
                          <th className="text-right px-3 py-2.5 font-semibold">{mode === 'quantity' ? 'New Quantity on hand' : 'New Unit Cost'}</th>
                          <th className="text-right px-3 py-2.5 font-semibold">{mode === 'quantity' ? 'Quantity Adjusted' : 'Cost Change'}</th>
                          <th className="text-center px-3 py-2.5 font-semibold" />
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItems.map((si) => {
                          const qtyAdj = si.newQuantity - si.quantityAvailable;
                          const costChg = mode === 'value' ? (si.newUnitCost - si.currentUnitCost) : 0;
                          return (
                            <tr key={si.itemId} className="border-t border-slate-100">
                              <td className="px-3 py-2.5">
                                <p className="font-medium text-slate-900">{si.itemName}</p>
                                <p className="text-[11px] text-slate-400">{si.sku || '—'} · {si.unit || 'unit'}</p>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {mode === 'quantity' ? (
                                  <span className="text-slate-600">{si.quantityAvailable}</span>
                                ) : (
                                  <span className="text-slate-600">{fmtNaira(si.currentUnitCost)}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {mode === 'quantity' ? (
                                  <input type="number" value={si.newQuantity} onChange={e => setSelectedItems(prev => prev.map(s => s.itemId === si.itemId ? { ...s, newQuantity: Math.max(0, Number(e.target.value)) } : s))} className="w-24 text-right text-sm border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
                                ) : (
                                  <input type="number" value={Math.round(si.newUnitCost / 100)} onChange={e => setSelectedItems(prev => prev.map(s => s.itemId === si.itemId ? { ...s, newUnitCost: Math.max(0, Number(e.target.value)) * 100 } : s))} className="w-28 text-right text-sm border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
                                )}
                              </td>
                              <td className={`px-3 py-2.5 text-right font-medium ${mode === 'quantity' ? (qtyAdj > 0 ? 'text-emerald-600' : qtyAdj < 0 ? 'text-red-600' : 'text-slate-400') : (costChg > 0 ? 'text-emerald-600' : costChg < 0 ? 'text-red-600' : 'text-slate-400')}`}>
                                {mode === 'quantity' ? (qtyAdj > 0 ? `+${qtyAdj}` : qtyAdj) : (costChg !== 0 ? fmtNaira(costChg) : '—')}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button onClick={() => handleRemoveItem(si.itemId)} className="p-1 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600"><X size={14} /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* More Actions placeholder */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">More Actions</h4>
                <p className="text-xs text-slate-400">Additional options will appear here in future updates.</p>
              </div>

              {/* Attach File(s) */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Attach File(s) to inventory adjustment</h4>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
                  <input type="file" multiple accept="*" id="file-upload" className="hidden" onChange={e => { if (e.target.files) setFiles(Array.from(e.target.files).slice(0, 5)); }} />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload size={24} className="mx-auto text-slate-400 mb-1" />
                    <p className="text-sm text-slate-500">Click to upload or drag & drop</p>
                    <p className="text-[11px] text-slate-400">You can upload a maximum of 5 files, 5MB each</p>
                  </label>
                </div>
                {files.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-1.5">
                        <span className="truncate">{f.name}</span>
                        <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 ml-2"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formError && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-200"><AlertCircle size={14} />{formError}</div>}
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowNewModal(false)} className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={() => handleSubmit('draft')} disabled={saving} className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 inline-flex items-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save as Draft
              </button>
              <button onClick={() => handleSubmit('adjusted')} disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 inline-flex items-center gap-2 shadow-sm">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null} Convert to Adjusted
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {viewingAdj && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={() => setViewingId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-slate-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{viewingAdj.reference}</h2>
              <button onClick={() => setViewingId(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-400">Date:</span> <span className="text-slate-700 font-medium">{fmtDate(viewingAdj.date)}</span></div>
                <div><span className="text-slate-400">Mode:</span> <span className={`capitalize font-medium ${viewingAdj.mode === 'quantity' ? 'text-blue-600' : 'text-purple-600'}`}>{viewingAdj.mode}</span></div>
                <div><span className="text-slate-400">Status:</span> {statusBadge(viewingAdj.status)}</div>
                <div><span className="text-slate-400">Reason:</span> <span className="text-slate-700">{viewingAdj.reason || '—'}</span></div>
                <div><span className="text-slate-400">Location:</span> <span className="text-slate-700">{viewingAdj.location || '—'}</span></div>
                <div className="col-span-2"><span className="text-slate-400">Description:</span> <span className="text-slate-700">{viewingAdj.description || '—'}</span></div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="text-left px-3 py-2 font-semibold">Item</th>
                      <th className="text-right px-3 py-2 font-semibold">Avail</th>
                      <th className="text-right px-3 py-2 font-semibold">New</th>
                      <th className="text-right px-3 py-2 font-semibold">Adj</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingAdj.lineItems || []).map((li: any) => (
                      <tr key={li.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">{li.itemId}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{li.quantityAvailable}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{li.newQuantity}</td>
                        <td className={`px-3 py-2 text-right font-medium ${Number(li.quantityAdjusted) > 0 ? 'text-emerald-600' : Number(li.quantityAdjusted) < 0 ? 'text-red-600' : ''}`}>{li.quantityAdjusted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
