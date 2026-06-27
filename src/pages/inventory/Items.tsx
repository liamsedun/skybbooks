/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import {
  Plus, Search, Pencil, Trash2, X, Loader2, AlertCircle, Package, Briefcase,
  Upload, Database, CheckCircle2, BarChart3, FileText, Download
} from 'lucide-react';

interface GLAccount {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  isActive: boolean;
}

interface Item {
  id: string;
  orgId: string;
  sku: string | null;
  name: string;
  description: string | null;
  type: 'product' | 'service';
  unit: string | null;
  salesPrice: number | null;
  purchasePrice: number | null;
  salesAccountId: string | null;
  purchaseAccountId: string | null;
  inventoryAccountId: string | null;
  trackInventory: boolean;
  reorderPoint: number | null;
  stockOnHand?: number;
  createdAt: string;
}

type ItemFormState = {
  sku: string;
  name: string;
  description: string;
  type: 'product' | 'service';
  unit: string;
  salesPrice: string;
  purchasePrice: string;
  salesAccountId: string;
  purchaseAccountId: string;
  inventoryAccountId: string;
  trackInventory: boolean;
  reorderPoint: string;
};

const EMPTY_FORM: ItemFormState = {
  sku: '',
  name: '',
  description: '',
  type: 'product',
  unit: '',
  salesPrice: '',
  purchasePrice: '',
  salesAccountId: '',
  purchaseAccountId: '',
  inventoryAccountId: '',
  trackInventory: false,
  reorderPoint: '',
};

function formatNaira(kobo: number | null): string {
  if (kobo === null || kobo === undefined) return '—';
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function exportItemsCSV(items: Item[]) {
  const headers = ['SKU','Name','Description','Type','Unit','Sales Price','Purchase Price','Stock On Hand','Reorder Point'];
  const rows = items.map(i => [
    i.sku||'', i.name, i.description||'', i.type, i.unit||'',
    i.salesPrice ? formatNaira(i.salesPrice) : '',
    i.purchasePrice ? formatNaira(i.purchasePrice) : '',
    i.trackInventory ? String(i.stockOnHand ?? 0) : 'Not tracked',
    i.reorderPoint != null ? String(i.reorderPoint) : ''
  ]);
  const csv = [headers,...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download=`items-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportItemsPDF(items: Item[]) {
  const rows = items.map(i => `
    <tr>
      <td>${i.sku||'\u2014'}</td>
      <td><strong>${i.name}</strong>${i.description ? `<br><small style="color:#64748b">${i.description}</small>` : ''}</td>
      <td>${i.type}</td>
      <td>${i.unit||'\u2014'}</td>
      <td>${i.salesPrice ? formatNaira(i.salesPrice) : '\u2014'}</td>
      <td>${i.purchasePrice ? formatNaira(i.purchasePrice) : '\u2014'}</td>
      <td>${i.trackInventory ? `${i.stockOnHand ?? 0} in stock` : 'Not tracked'}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Items & Inventory</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',sans-serif;color:#1e293b;padding:40px;font-size:13px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #0f172a}
    .company{font-size:22px;font-weight:800;color:#0f172a}
    .subtitle{font-size:11px;color:#64748b;margin-top:4px}
    .title{font-size:18px;font-weight:700;color:#0f172a}
    .date{font-size:11px;color:#64748b;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#0f172a;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em}
    td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;vertical-align:top}
    tr:nth-child(even) td{background:#f8fafc}
    .footer{margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
    @media print{body{padding:20px}}
  </style></head><body>
  <div class="header">
    <div><div class="company">SkyBooks</div><div class="subtitle">By Skyhouse Accountants &amp; Technologies</div></div>
    <div style="text-align:right"><div class="title">Items &amp; Inventory</div><div class="date">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div><div class="date">${items.length} items · ${items.filter(i=>i.type==='product').length} products · ${items.filter(i=>i.type==='service').length} services</div></div>
  </div>
  <table>
    <thead><tr><th>SKU</th><th>Name</th><th>Type</th><th>Unit</th><th>Sales Price</th><th>Purchase Price</th><th>Stock</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div>
  </body></html>`;
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500); }
}

export function ItemsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'service'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [openStockModal, setOpenStockModal] = useState(false);
  const [stockForm, setStockForm] = useState({ itemId: '', quantity: '', unitCost: '' });
  const [stockSuccess, setStockSuccess] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [valuationOpen, setValuationOpen] = useState(false);
  const [valuationItemId, setValuationItemId] = useState('');

  const { data: items, isLoading, isError } = useQuery<Item[]>({
    queryKey: ['inventory', 'items'],
    queryFn: async () => {
      const res = await api.get('/inventory/items');
      return res.data;
    },
  });

  const { data: glAccounts } = useQuery<GLAccount[]>({
    queryKey: ['accountant', 'accounts'],
    queryFn: async () => {
      const res = await api.get('/accountant/accounts');
      return res.data;
    },
  });

  const activeAccounts = (glAccounts || []).filter((a) => a.isActive);
  const revenueAccounts = activeAccounts.filter((a) => a.type === 'revenue');
  const expenseAccounts = activeAccounts.filter((a) => a.type === 'expense');
  const assetAccounts = activeAccounts.filter((a) => a.type === 'asset');

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/inventory/items', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] });
      closeModal();
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || 'Failed to create item.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.patch(`/inventory/items/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] });
      closeModal();
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || 'Failed to update item.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: any) => setDeleteError(err?.response?.data?.error || 'Failed to delete item.'),
  });

  const recordStockMutation = useMutation({
    mutationFn: (payload: any) => api.post('/inventory/items/record-opening-stock', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] });
      setStockForm({ itemId: '', quantity: '', unitCost: '' });
      setStockError(null);
      setStockSuccess('Opening stock recorded.');
      setTimeout(() => { setStockSuccess(null); setOpenStockModal(false); }, 2000);
    },
    onError: (err: any) => setStockError(err?.response?.data?.error || 'Failed to record stock.'),
  });

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (items || []).filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (!term) return true;
      return item.name.toLowerCase().includes(term) || (item.sku || '').toLowerCase().includes(term);
    });
  }, [items, searchTerm, typeFilter]);

  const counts = useMemo(() => {
    const all = items?.length || 0;
    const product = (items || []).filter((i) => i.type === 'product').length;
    const service = (items || []).filter((i) => i.type === 'service').length;
    return { all, product, service };
  }, [items]);

  function openAddModal() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(item: Item) {
    setForm({
      sku: item.sku || '',
      name: item.name,
      description: item.description || '',
      type: item.type,
      unit: item.unit || '',
      salesPrice: item.salesPrice != null ? (item.salesPrice / 100).toString() : '',
      purchasePrice: item.purchasePrice != null ? (item.purchasePrice / 100).toString() : '',
      salesAccountId: item.salesAccountId || '',
      purchaseAccountId: item.purchaseAccountId || '',
      inventoryAccountId: item.inventoryAccountId || '',
      trackInventory: item.trackInventory,
      reorderPoint: item.reorderPoint != null ? item.reorderPoint.toString() : '',
    });
    setEditingId(item.id);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Item name is required.');
      return;
    }
    const payload = {
      sku: form.sku.trim() || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      type: form.type,
      unit: form.unit.trim() || null,
      salesPrice: form.salesPrice ? Math.round(parseFloat(form.salesPrice) * 100) : null,
      purchasePrice: form.purchasePrice ? Math.round(parseFloat(form.purchasePrice) * 100) : null,
      salesAccountId: form.salesAccountId || null,
      purchaseAccountId: form.purchaseAccountId || null,
      inventoryAccountId: form.type === 'product' && form.trackInventory ? form.inventoryAccountId || null : null,
      trackInventory: form.type === 'product' ? form.trackInventory : false,
      reorderPoint:
        form.type === 'product' && form.trackInventory && form.reorderPoint
          ? parseInt(form.reorderPoint, 10)
          : null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Items & Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">
            {counts.all} items · {counts.product} products · {counts.service} services
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus size={16} />
          Add Item
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Upload size={16} />
          Import Opening Stock
        </button>
        <button
          onClick={() => { setStockForm({ itemId: '', quantity: '', unitCost: '' }); setStockError(null); setStockSuccess(null); setOpenStockModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Database size={16} />
          Record Opening Stock
        </button>
        <button
          onClick={() => exportItemsCSV(filteredItems)}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Download size={16} />
          CSV
        </button>
        <button
          onClick={() => exportItemsPDF(filteredItems)}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          <FileText size={16} />
          PDF
        </button>
        <button
          onClick={() => setValuationOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          <BarChart3 size={16} />
          Valuation Statement
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            typeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All Items ({counts.all})
        </button>
        <button
          onClick={() => setTypeFilter('product')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            typeFilter === 'product' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Products ({counts.product})
        </button>
        <button
          onClick={() => setTypeFilter('service')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            typeFilter === 'service' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Services ({counts.service})
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name or SKU..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading items...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
            <AlertCircle size={16} />
            Failed to load items. Check the API route.
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Package size={28} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">No items yet</p>
            <p className="text-xs text-slate-400 mt-1">Add your first product or service to start invoicing.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                <th className="py-2.5 pl-4 pr-3">SKU</th>
                <th className="py-2.5 pr-3">Name</th>
                <th className="py-2.5 pr-3">Type</th>
                <th className="py-2.5 pr-3">Unit</th>
                <th className="py-2.5 pr-3">Sales Price</th>
                <th className="py-2.5 pr-3">Purchase Price</th>
                <th className="py-2.5 pr-3">Stock</th>
                <th className="py-2.5 pr-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 pl-4 pr-3 font-mono text-sm text-slate-500">{item.sku || '—'}</td>
                  <td className="py-2.5 pr-3">
                    <span className="text-sm font-medium text-slate-900">{item.name}</span>
                    {item.description && (
                      <p className="text-xs text-slate-400 truncate max-w-xs">{item.description}</p>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.type === 'product' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
                      }`}
                    >
                      {item.type === 'product' ? <Package size={12} /> : <Briefcase size={12} />}
                      {item.type === 'product' ? 'Product' : 'Service'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-sm text-slate-500">{item.unit || '—'}</td>
                  <td className="py-2.5 pr-3 text-sm text-slate-700">{formatNaira(item.salesPrice)}</td>
                  <td className="py-2.5 pr-3 text-sm text-slate-500">{formatNaira(item.purchasePrice)}</td>
                  <td className="py-2.5 pr-3 text-xs text-slate-500">
                    {item.trackInventory ? (
                      <span className="text-emerald-600 font-medium">
                        {(item.stockOnHand ?? 0)} in stock{item.reorderPoint != null ? ` · reorder @ ${item.reorderPoint}` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400">Not tracked</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-2 text-right">
                    <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        aria-label="Edit item"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteTarget(item);
                          setDeleteError(null);
                        }}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        aria-label="Delete item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Edit Item' : 'Add Item'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Item Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'product' | 'service' })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  >
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">SKU</label>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="Auto-generated if blank"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Unit</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="pcs, hrs, kg..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Sales Price (₦)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.salesPrice}
                    onChange={(e) => setForm({ ...form, salesPrice: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Purchase Price (₦)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.purchasePrice}
                    onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Sales Account (Revenue)</label>
                  <AccountSearchSelect
                    accounts={revenueAccounts}
                    value={form.salesAccountId}
                    onChange={id => setForm({ ...form, salesAccountId: id })}
                    placeholder="None"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Purchase Account (Expense)</label>
                  <AccountSearchSelect
                    accounts={expenseAccounts}
                    value={form.purchaseAccountId}
                    onChange={id => setForm({ ...form, purchaseAccountId: id })}
                    placeholder="None"
                  />
                </div>
              </div>

              {form.type === 'product' && (
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.trackInventory}
                      onChange={(e) => setForm({ ...form, trackInventory: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    Track inventory for this product
                  </label>

                  {form.trackInventory && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Inventory Account (Asset)</label>
                        <AccountSearchSelect
                          accounts={assetAccounts}
                          value={form.inventoryAccountId}
                          onChange={id => setForm({ ...form, inventoryAccountId: id })}
                          placeholder="None"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Reorder Point</label>
                        <input
                          type="number"
                          value={form.reorderPoint}
                          onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Delete Item</h2>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to delete{' '}
              <span className="font-medium text-slate-700">{deleteTarget.name}</span>? This cannot be undone.
            </p>
            {deleteError && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <CsvImportModal
          entity="inventoryOpeningStock"
          endpoint="/inventory/items/import-opening-stock"
          onClose={() => setImportOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] })}
          transformRow={(row, headers) => {
            const map: Record<string, string> = {};
            headers.forEach((h, i) => { map[h.toLowerCase().trim()] = row[i]?.trim() || ''; });
            return {
              itemName: map['itemname (or sku)'] || map['itemname'] || '',
              quantity: map['quantity'] || '0',
              unitCost: map['unitcost (ngn)'] || map['unitcost'] || '0',
              total: map['total (ngn)'] || map['total'] || '0',
            };
          }}
        />
      )}

      {openStockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Record Opening Stock</h2>
              <button onClick={() => setOpenStockModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            {stockSuccess && (
              <div className="flex items-center gap-2 px-3 py-2 mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle2 size={14} /> {stockSuccess}
              </div>
            )}
            {stockError && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">{stockError}</div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); recordStockMutation.mutate(stockForm); }} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Item</label>
                <select
                  value={stockForm.itemId}
                  onChange={(e) => setStockForm({ ...stockForm, itemId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="">Select item...</option>
                  {(items || []).filter(i => i.trackInventory).map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.sku || 'no SKU'})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Quantity</label>
                  <input type="number" min="1" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Unit Cost (₦)</label>
                  <input type="number" step="0.01" min="0" value={stockForm.unitCost} onChange={(e) => setStockForm({ ...stockForm, unitCost: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpenStockModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={recordStockMutation.isPending || !stockForm.itemId || !stockForm.quantity}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                  {recordStockMutation.isPending ? 'Saving...' : 'Record Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {valuationOpen && (
        <ValuationStatementModal
          items={items || []}
          selectedItemId={valuationItemId}
          onSelectItem={setValuationItemId}
          onClose={() => { setValuationOpen(false); setValuationItemId(''); }}
        />
      )}
    </div>
  );
}

interface ValuationLine {
  date: string | null;
  type: string;
  reference: string;
  referenceId: string | null;
  inQty: number;
  outQty: number;
  unitCost: number;
  value: number;
  balanceQty: number;
  balanceValue: number;
}

interface ValuationItem {
  item: { id: string; name: string; sku: string | null; unit: string | null; type: string };
  lines: ValuationLine[];
  openingQty: number;
  openingValue: number;
  closingQty: number;
  closingValue: number;
}

function ValuationStatementModal({
  items,
  selectedItemId,
  onSelectItem,
  onClose,
}: {
  items: Item[];
  selectedItemId: string;
  onSelectItem: (id: string) => void;
  onClose: () => void;
}) {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: raw, isLoading } = useQuery({
    queryKey: ['inventory', 'valuation', selectedItemId, asOfDate],
    queryFn: () =>
      api
        .get('/inventory/valuation-statement', {
          params: { endDate: asOfDate, ...(selectedItemId ? { itemId: selectedItemId } : {}) },
        })
        .then((r) => r.data as ValuationItem[]),
  });

  const itemsWithStock = items.filter((i) => i.trackInventory);
  const filtered = selectedItemId
    ? (raw || []).filter((v) => v.item.id === selectedItemId)
    : raw || [];

  function formatNaira(kobo: number) {
    return `\u20a6${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  }

  function fmtDate(d: string | null) {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function exportValuationCSV() {
    const headers = ['Item','SKU','Unit','Date','Type','Reference','In Qty','Out Qty','Unit Cost','Value','Bal Qty','Bal Value'];
    const rows: string[][] = [];
    for (const vi of filtered) {
      for (const line of vi.lines) {
        rows.push([
          vi.item.name, vi.item.sku||'', vi.item.unit||'',
          fmtDate(line.date), line.type.replace('_',' '), line.reference,
          line.inQty > 0 ? String(line.inQty) : '',
          line.outQty > 0 ? String(line.outQty) : '',
          line.unitCost > 0 ? formatNaira(line.unitCost) : '',
          line.value > 0 ? formatNaira(line.value) : '',
          String(line.balanceQty), formatNaira(line.balanceValue)
        ]);
      }
    }
    const csv = [headers,...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url;
    a.download=`valuation-statement-${asOfDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function exportValuationPDF() {
    const blocks = filtered.map(vi => {
      const rows = vi.lines.map(line => {
        const isOpen = line.type === 'opening_balance';
        return `<tr${isOpen?' style="background:#f8fafc"':''}>
          <td>${fmtDate(line.date)}</td>
          <td>${line.type.replace('_',' ')}</td>
          <td>${line.reference}</td>
          <td style="text-align:right">${line.inQty > 0 ? line.inQty : '\u2014'}</td>
          <td style="text-align:right">${line.outQty > 0 ? line.outQty : '\u2014'}</td>
          <td style="text-align:right">${line.unitCost > 0 ? formatNaira(line.unitCost) : '\u2014'}</td>
          <td style="text-align:right">${line.value > 0 ? formatNaira(line.value) : '\u2014'}</td>
          <td style="text-align:right"><strong>${line.balanceQty}</strong></td>
          <td style="text-align:right"><strong>${formatNaira(line.balanceValue)}</strong></td>
        </tr>`;
      }).join('');
      return `<div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between">
          <div><strong>${vi.item.name}</strong> <span style="color:#94a3b8;font-size:12px">${vi.item.sku||''} | ${vi.item.unit||'\u2014'}</span></div>
          <div style="font-size:12px;color:#64748b">Opening: <strong>${vi.openingQty}</strong> / ${formatNaira(vi.openingValue)} &nbsp; Closing: <strong>${vi.closingQty}</strong> / ${formatNaira(vi.closingValue)}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#f1f5f9;font-size:11px;color:#64748b;text-transform:uppercase">
            <th style="padding:8px 12px;text-align:left">Date</th><th style="padding:8px 12px;text-align:left">Type</th><th style="padding:8px 12px;text-align:left">Reference</th>
            <th style="padding:8px 12px;text-align:right">In Qty</th><th style="padding:8px 12px;text-align:right">Out Qty</th><th style="padding:8px 12px;text-align:right">Unit Cost</th>
            <th style="padding:8px 12px;text-align:right">Value</th><th style="padding:8px 12px;text-align:right">Bal Qty</th><th style="padding:8px 12px;text-align:right">Bal Value</th>
          </tr></thead>
          <tbody style="border-top:1px solid #e2e8f0">${rows}</tbody>
        </table>
      </div>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Valuation Statement</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',sans-serif;color:#1e293b;padding:40px;font-size:13px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #0f172a}
      .company{font-size:22px;font-weight:800;color:#0f172a}
      .subtitle{font-size:11px;color:#64748b;margin-top:4px}
      .title{font-size:18px;font-weight:700;color:#0f172a}
      .date{font-size:11px;color:#64748b;margin-top:4px}
      table{width:100%;border-collapse:collapse;margin-top:0}
      th{background:#f1f5f9;color:#64748b;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase}
      td{padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}
      tr:nth-child(even) td{background:#f8fafc}
      .footer{margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
      @media print{body{padding:20px}}
    </style></head><body>
    <div class="header">
      <div><div class="company">SkyBooks</div><div class="subtitle">By Skyhouse Accountants &amp; Technologies</div></div>
      <div style="text-align:right"><div class="title">Inventory Valuation Statement</div><div class="date">As of: ${new Date(asOfDate).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div><div class="date">${filtered.length} item(s)</div></div>
    </div>
    ${blocks}
    <div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div>
    </body></html>`;
    const w = window.open('','_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Inventory Valuation Statement</h2>
          <div className="flex items-center gap-2">
            <button onClick={exportValuationCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
              <Download size={14} /> CSV
            </button>
            <button onClick={exportValuationPDF} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
              <FileText size={14} /> PDF
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <select
            value={selectedItemId}
            onChange={(e) => onSelectItem(e.target.value)}
            className="max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="">All tracked items</option>
            {itemsWithStock.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} ({it.sku || 'no SKU'})
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">As of:</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>

        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Loading valuation...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">No inventory items with tracked stock found.</div>
          ) : (
            filtered.map((vi) => (
              <div key={vi.item.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900">{vi.item.name}</span>
                    <span className="text-xs text-slate-400 ml-2">
                      {vi.item.sku || ''} | {vi.item.unit || '—'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 space-x-4">
                    <span>
                      Opening: <strong>{vi.openingQty}</strong> units /
                      {formatNaira(vi.openingValue)}
                    </span>
                    <span>
                      Closing: <strong>{vi.closingQty}</strong> units /
                      {formatNaira(vi.closingValue)}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Reference</th>
                        <th className="px-3 py-2 text-right">In Qty</th>
                        <th className="px-3 py-2 text-right">Out Qty</th>
                        <th className="px-3 py-2 text-right">Unit Cost</th>
                        <th className="px-3 py-2 text-right">Value</th>
                        <th className="px-3 py-2 text-right">Bal Qty</th>
                        <th className="px-3 py-2 text-right">Bal Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vi.lines.map((line, i) => {
                        const isOpening = line.type === 'opening_balance';
                        return (
                          <tr key={i} className={`${isOpening ? 'bg-slate-50 font-medium' : 'hover:bg-slate-50/60'}`}>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtDate(line.date)}</td>
                            <td className="px-3 py-2">
                              <span className={`capitalize ${isOpening ? 'text-slate-800' : 'text-slate-600'}`}>
                                {line.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-500">{line.reference}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{line.inQty > 0 ? line.inQty : '—'}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{line.outQty > 0 ? line.outQty : '—'}</td>
                            <td className="px-3 py-2 text-right text-slate-700">
                              {line.unitCost > 0 ? formatNaira(line.unitCost) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-700">
                              {line.value > 0 ? formatNaira(line.value) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">{line.balanceQty}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatNaira(line.balanceValue)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
