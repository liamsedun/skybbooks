
cat > /home/claude/ChartOfAccounts_clean.tsx << 'ENDOFFILE'
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, Search, Pencil, Trash2, ChevronRight, ChevronDown,
  X, Check, AlertCircle, Loader2, BookOpen
} from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  subType: string | null;
  parentId: string | null;
  isSystem: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  children?: Account[];
}

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;

const TYPE_META: Record<string, { label: string; plural: string; color: string; bg: string }> = {
  asset:     { label: 'Asset',     plural: 'Assets',      color: 'text-emerald-700', bg: 'bg-emerald-50' },
  liability: { label: 'Liability', plural: 'Liabilities', color: 'text-rose-700',    bg: 'bg-rose-50'    },
  equity:    { label: 'Equity',    plural: 'Equity',      color: 'text-violet-700',  bg: 'bg-violet-50'  },
  revenue:   { label: 'Revenue',   plural: 'Revenue',     color: 'text-blue-700',    bg: 'bg-blue-50'    },
  expense:   { label: 'Expense',   plural: 'Expenses',    color: 'text-amber-700',   bg: 'bg-amber-50'   },
};

const coaApi = {
  list: () => api.get('/accountant/accounts').then(r => r.data),
  create: (data: any) => api.post('/accountant/accounts', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/accountant/accounts/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/accountant/accounts/${id}`).then(r => r.data),
};

function buildTree(accounts: Account[]): Account[] {
  const map = new Map<string, Account>();
  accounts.forEach(a => map.set(a.id, { ...a, children: [] }));
  const roots: Account[] = [];
  map.forEach(a => {
    if (a.parentId && map.has(a.parentId)) {
      map.get(a.parentId)!.children!.push(a);
    } else {
      roots.push(a);
    }
  });
  const sort = (arr: Account[]) => {
    arr.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    arr.forEach(a => sort(a.children || []));
  };
  sort(roots);
  return roots;
}

function AccountModal({ account, accounts, onClose, onSave, saving }: {
  account: Partial<Account> | null;
  accounts: Account[];
  onClose: () => void;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const isEdit = !!account?.id;
  const [form, setForm] = useState({
    code: account?.code || '',
    name: account?.name || '',
    type: account?.type || 'asset',
    subType: account?.subType || '',
    parentId: account?.parentId || '',
    description: account?.description || '',
    isActive: account?.isActive ?? true,
  });
  const [error, setError] = useState('');

  const parentOptions = accounts.filter(a =>
    a.id !== account?.id && a.type === form.type && !a.parentId
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim()) return setError('Account code is required.');
    if (!form.name.trim()) return setError('Account name is required.');
    setError('');
    onSave({
      ...form,
      parentId: form.parentId || null,
      subType: form.subType || null,
      description: form.description || null,
    });
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">{isEdit ? 'Edit Account' : 'New Account'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Account Code *</label>
              <input className={inputCls} placeholder="e.g. 1010" value={form.code}
                onChange={e => setForm(p => ({ ...p, code: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Type *</label>
              <select className={inputCls} value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value as any, parentId: '' }))}>
                {ACCOUNT_TYPES.map(t => (
                  <option key={t} value={t}>{TYPE_META[t].plural}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Account Name *</label>
            <input className={inputCls} placeholder="e.g. GTBank Current Account" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Sub-type</label>
              <input className={inputCls} placeholder="e.g. bank, payable" value={form.subType}
                onChange={e => setForm(p => ({ ...p, subType: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Parent Account</label>
              <select className={inputCls} value={form.parentId}
                onChange={e => setForm(p => ({ ...p, parentId: e.target.value }))}>
                <option value="">— None (top level) —</option>
                {parentOptions.map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={inputCls + ' resize-none'} rows={2}
              placeholder="Optional notes about this account"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive}
              onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
              className="rounded border-slate-300" />
            <label htmlFor="isActive" className="text-xs font-medium text-slate-600">Active account</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-60 flex items-center gap-2">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {isEdit ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AccountRow({ account, depth, onEdit, onDelete }: {
  account: Account;
  depth: number;
  onEdit: (a: Account) => void;
  onDelete: (a: Account) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = (account.children?.length || 0) > 0;
  const meta = TYPE_META[account.type];

  return (
    <>
      <tr className={`group border-b border-slate-50 hover:bg-slate-50/60 transition ${!account.isActive ? 'opacity-50' : ''}`}>
        <td className="py-2.5 px-4">
          <div className="flex items-center" style={{ paddingLeft: depth * 20 }}>
            {hasChildren ? (
              <button onClick={() => setExpanded(!expanded)}
                className="mr-1.5 p-0.5 hover:bg-slate-200 rounded text-slate-400">
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="mr-1.5 w-5" />
            )}
            <span className="font-mono text-xs font-bold text-slate-500 w-14 shrink-0">{account.code}</span>
          </div>
        </td>
        <td className="py-2.5 px-3">
          <span className={`text-xs font-semibold ${depth === 0 ? 'text-slate-800' : 'text-slate-700'}`}>
            {account.name}
          </span>
          {account.description && (
            <p className="text-[10px] text-slate-400 mt-0.5">{account.description}</p>
          )}
        </td>
        <td className="py-2.5 px-3 hidden md:table-cell">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${meta.bg} ${meta.color}`}>
            {meta.label}
          </span>
        </td>
        <td className="py-2.5 px-3 hidden lg:table-cell">
          <span className="text-[10px] text-slate-400 font-mono">{account.subType || '—'}</span>
        </td>
        <td className="py-2.5 px-3 hidden sm:table-cell">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${account.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
            {account.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="py-2.5 px-4 text-right">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
            <button onClick={() => onEdit(account)}
              className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {!account.isSystem && (
              <button onClick={() => onDelete(account)}
                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && hasChildren && account.children!.map(child => (
        <AccountRow key={child.id} account={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  );
}

export function ChartOfAccountsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [modal, setModal] = useState<{ open: boolean; account: Partial<Account> | null }>({ open: false, account: null });
  const [deleteConfirm, setDeleteConfirm] = useState<Account | null>(null);

  const { data: rawAccounts = [], isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: coaApi.list,
  });

  const accounts: Account[] = Array.isArray(rawAccounts) ? rawAccounts : (rawAccounts as any).accounts || [];

  const createMut = useMutation({
    mutationFn: coaApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setModal({ open: false, account: null }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => coaApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setModal({ open: false, account: null }); },
  });

  const deleteMut = useMutation({
    mutationFn: coaApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setDeleteConfirm(null); },
  });

  const filtered = useMemo(() => {
    let list = accounts;
    if (filterType !== 'all') list = list.filter(a => a.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        (a.subType || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [accounts, filterType, search]);

  const tree = useMemo(() =>
    search || filterType !== 'all' ? filtered : buildTree(filtered),
    [filtered, search, filterType]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: accounts.length };
    ACCOUNT_TYPES.forEach(t => { c[t] = accounts.filter(a => a.type === t).length; });
    return c;
  }, [accounts]);

  function handleSave(data: any) {
    if (modal.account?.id) {
      updateMut.mutate({ id: modal.account.id, data });
    } else {
      createMut.mutate(data);
    }
  }

  const saving = createMut.isPending || updateMut.isPending;

  const filterPills = [
    { key: 'all', label: 'All Accounts', color: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
    ...ACCOUNT_TYPES.map(t => ({
      key: t,
      label: TYPE_META[t].plural,
      color: filterType === t
        ? `${TYPE_META[t].bg} ${TYPE_META[t].color}`
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" /> Chart of Accounts
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {accounts.length} accounts · Double-entry general ledger structure
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, account: null })}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterPills.map(({ key, label, color }) => (
          <button key={key} onClick={() => setFilterType(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filterType === key && key === 'all' ? 'bg-slate-800 text-white' : color}`}>
            {label}
            <span className="ml-1.5 opacity-60">({counts[key] || 0})</span>
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search by name, code, or sub-type..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading accounts...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 text-sm gap-2">
            <AlertCircle className="w-5 h-5" /> Failed to load accounts. Check the API route.
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <BookOpen className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-semibold">No accounts found</p>
            <p className="text-xs mt-1">Run the COA seed SQL in Neon, or add an account above.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left py-3 px-4 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 w-28">Code</th>
                <th className="text-left py-3 px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Account Name</th>
                <th className="text-left py-3 px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 hidden md:table-cell">Type</th>
                <th className="text-left py-3 px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 hidden lg:table-cell">Sub-type</th>
                <th className="text-left py-3 px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 hidden sm:table-cell">Status</th>
                <th className="py-3 px-4 w-20" />
              </tr>
            </thead>
            <tbody>
              {(search || filterType !== 'all' ? filtered : tree).map(account => (
                <AccountRow
                  key={account.id}
                  account={account}
                  depth={0}
                  onEdit={a => setModal({ open: true, account: a })}
                  onDelete={a => setDeleteConfirm(a)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && (
        <AccountModal
          account={modal.account}
          accounts={accounts}
          onClose={() => setModal({ open: false, account: null })}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-50 rounded-xl">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Delete Account?</h3>
                <p className="text-xs text-slate-500 mt-0.5">{deleteConfirm.code} — {deleteConfirm.name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              This will permanently delete the account. It cannot be undone, and will fail if the account has journal entries.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition">
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteConfirm.id)}
                disabled={deleteMut.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-60 flex items-center gap-2">
                {deleteMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChartOfAccountsPage;
ENDOFFILE
echo "Done"
