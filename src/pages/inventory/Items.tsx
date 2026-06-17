/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Plus, Search, Pencil, Trash2, X, Loader2, AlertCircle, Package, Briefcase } from 'lucide-react';

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
                        Tracked{item.reorderPoint != null ? ` · reorder @ ${item.reorderPoint}` : ''}
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
                  <select
                    value={form.salesAccountId}
                    onChange={(e) => setForm({ ...form, salesAccountId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  >
                    <option value="">None</option>
                    {revenueAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Purchase Account (Expense)</label>
                  <select
                    value={form.purchaseAccountId}
                    onChange={(e) => setForm({ ...form, purchaseAccountId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  >
                    <option value="">None</option>
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
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
                        <select
                          value={form.inventoryAccountId}
                          onChange={(e) => setForm({ ...form, inventoryAccountId: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        >
                          <option value="">None</option>
                          {assetAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                        </select>
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
    </div>
  );
}
