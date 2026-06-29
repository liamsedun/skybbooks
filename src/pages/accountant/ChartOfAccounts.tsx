import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, accountantApi } from '../../lib/api';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Upload,
  FileText,
  Printer,
} from 'lucide-react';
import { downloadCsv } from '../../lib/csvTemplates';

interface Account {
  id: string;
  orgId: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  subType?: string | null;
  parentId?: string | null;
  description?: string | null;
  isActive: boolean;
  isSystem: boolean;
  openingBalance?: number;
}

type AccountFormState = {
  code: string;
  name: string;
  type: Account['type'];
  subType: string;
  parentId: string;
  description: string;
  isActive: boolean;
  openingBalance: string;
};

const ACCOUNT_TYPES: Account['type'][] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

const TYPE_META: Record<
  Account['type'],
  { label: string; plural: string; color: string; bg: string; dot: string; range: string }
> = {
  asset: { label: 'Asset', plural: 'Assets', color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500', range: '1000–1999' },
  liability: { label: 'Liability', plural: 'Liabilities', color: 'text-rose-700', bg: 'bg-rose-50', dot: 'bg-rose-500', range: '2000–2999' },
  equity: { label: 'Equity', plural: 'Equity', color: 'text-violet-700', bg: 'bg-violet-50', dot: 'bg-violet-500', range: '3000–3999' },
  revenue: { label: 'Revenue', plural: 'Revenue', color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500', range: '4000–4999' },
  expense: { label: 'Expense', plural: 'Expenses', color: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500', range: '5000–5999' },
};

const EMPTY_FORM: AccountFormState = {
  code: '',
  name: '',
  type: 'asset',
  subType: '',
  parentId: '',
  description: '',
  isActive: true,
  openingBalance: '',
};

interface TreeNode extends Account {
  children: TreeNode[];
}

function buildTree(accounts: Account[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  accounts.forEach((a) => nodeMap.set(a.id, { ...a, children: [] }));
  const roots: TreeNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortFn = (a: TreeNode, b: TreeNode) => a.code.localeCompare(b.code, undefined, { numeric: true });
  const sortRecursive = (nodes: TreeNode[]) => { nodes.sort(sortFn); nodes.forEach((n) => sortRecursive(n.children)); };
  sortRecursive(roots);
  return roots;
}

function visibleNodeIds(nodes: TreeNode[], term: string, typeFilter: string): Set<string> {
  const matches = new Set<string>();
  const lower = term.toLowerCase();
  const matchesNode = (n: TreeNode) =>
    (typeFilter === 'all' || n.type === typeFilter) &&
    (!term || n.name.toLowerCase().includes(lower) || n.code.toLowerCase().includes(lower) || (n.subType || '').toLowerCase().includes(lower));
  const visit = (n: TreeNode): boolean => {
    const childMatches = n.children.map(visit);
    const selfMatch = matchesNode(n);
    if (selfMatch || childMatches.some(Boolean)) { matches.add(n.id); return true; }
    return false;
  };
  nodes.forEach(visit);
  return matches;
}

export function ChartOfAccountsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | Account['type']>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: accounts, isLoading, isError } = useQuery<Account[]>({
    queryKey: ['accountant', 'accounts'],
    queryFn: async () => {
      const res = await api.get('/accountant/accounts');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Account>) => api.post('/accountant/accounts', payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accountant', 'accounts'] }); closeModal(); },
    onError: (err: any) => setFormError(err?.response?.data?.error || 'Failed to create account.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Account> }) => api.patch(`/accountant/accounts/${id}`, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accountant', 'accounts'] }); closeModal(); },
    onError: (err: any) => setFormError(err?.response?.data?.error || 'Failed to update account.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accountant/accounts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accountant', 'accounts'] }); setDeleteTarget(null); },
  });

  const seedMutation = useMutation({
    mutationFn: () => api.post('/accountant/accounts/seed'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accountant', 'accounts'] }); },
  });

  const tree = useMemo(() => buildTree(accounts || []), [accounts]);
  const visibleIds = useMemo(() => visibleNodeIds(tree, searchTerm, activeFilter), [tree, searchTerm, activeFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: accounts?.length || 0 };
    ACCOUNT_TYPES.forEach((t) => { c[t] = (accounts || []).filter((a) => a.type === t).length; });
    return c;
  }, [accounts]);

  function toggleExpand(id: string) {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function openAddModal() { setForm(EMPTY_FORM); setModalMode('add'); setEditingId(null); setFormError(null); setModalOpen(true); }
  function openEditModal(account: Account) {
    setForm({ code: account.code, name: account.name, type: account.type, subType: account.subType || '', parentId: account.parentId || '', description: account.description || '', isActive: account.isActive, openingBalance: account.openingBalance ? (account.openingBalance / 100).toFixed(2) : '' });
    setModalMode('edit'); setEditingId(account.id); setFormError(null); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditingId(null); setFormError(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { setFormError('Account code and name are required.'); return; }
    const payload: any = { code: form.code.trim(), name: form.name.trim(), type: form.type, subType: form.subType.trim() || null, parentId: form.parentId || null, description: form.description.trim() || null, isActive: form.isActive };
    const ob = parseFloat(form.openingBalance);
    if (!isNaN(ob) && ob >= 0) payload.openingBalance = Math.round(ob * 100);
    if (modalMode === 'add') createMutation.mutate(payload);
    else if (editingId) updateMutation.mutate({ id: editingId, payload });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleExportCsv = async () => {
    try {
      const blob = await accountantApi.exportAccountsCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'chart_of_accounts.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const handlePrintPdf = async () => {
    try {
      const blob = await accountantApi.getAccountsPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'chart_of_accounts.pdf'; a.click();
    } catch { /* ignore */ }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string || '');
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await accountantApi.importAccountsCsv({ csvData: csvText });
      setImportMsg({ type: 'success', text: res.message || 'Accounts imported successfully.' });
      setCsvText('');
      queryClient.invalidateQueries({ queryKey: ['accountant', 'accounts'] });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Import failed.';
      const errors = err?.response?.data?.errors;
      setImportMsg({ type: 'error', text: errors ? `${msg}: ${errors.join(', ')}` : msg });
    } finally { setImporting(false); }
  };

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    if (!visibleIds.has(node.id)) return null;
    const meta = TYPE_META[node.type];
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);

    return (
      <React.Fragment key={node.id}>
        <tr className="group hover:bg-slate-50 transition-colors">
          <td className="py-2.5 pr-3">
            <div className="flex items-center" style={{ paddingLeft: `${depth * 20}px` }}>
              {hasChildren ? (
                <button onClick={() => toggleExpand(node.id)} className="mr-1.5 text-slate-400 hover:text-slate-600" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : <span className="mr-1.5 w-4 inline-block" />}
              <span className="font-mono text-sm text-slate-500">{node.code}</span>
            </div>
          </td>
          <td className="py-2.5 pr-3 max-w-0 w-full">
            <span className={`text-sm truncate block ${depth === 0 ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{node.name}</span>
          </td>
          <td className="py-2.5 pr-3">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </td>
          <td className="py-2.5 pr-3"><span className="text-sm text-slate-500">{node.subType || '—'}</span></td>
          <td className="py-2.5 pr-3">
            <span className={`text-xs font-medium ${node.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>{node.isActive ? 'Active' : 'Inactive'}</span>
          </td>
          <td className="py-2.5 pr-2 text-right">
            <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity">
              <button onClick={() => openEditModal(node)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Edit account"><Pencil size={14} /></button>
              {!node.isSystem && (
                <button onClick={() => setDeleteTarget(node)} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Delete account"><Trash2 size={14} /></button>
              )}
            </div>
          </td>
        </tr>
        {isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chart of Accounts</h1>
          <p className="text-sm text-slate-500 mt-1">{counts.all} accounts · Double-entry general ledger structure</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadCsv('chart-of-accounts-template.csv', ['code', 'name', 'type', 'sub-type', 'parent code', 'description', 'active', 'opening balance (NGN)'], ['100000', 'Cash and Cash Equivalents', 'asset', 'Current Assets', '', '', 'Yes', '5000000'])} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-500 rounded-lg hover:bg-slate-600"><FileText className="w-3.5 h-3.5" /> Sample CSV</button>
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"><Upload className="w-3.5 h-3.5" /> Import CSV</button>
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"><Printer className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={openAddModal} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"><Plus size={14} /> Add Account</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setActiveFilter('all')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>All Accounts ({counts.all})</button>
        {ACCOUNT_TYPES.map((t) => (
          <button key={t} onClick={() => setActiveFilter(t)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeFilter === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{TYPE_META[t].plural} ({counts[t]})</button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name, code, or sub-type..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" />Loading accounts...</div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm"><AlertCircle size={16} />Failed to load accounts. Check the API route.</div>
        ) : !accounts || accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Download size={28} className="text-slate-400" /></div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">No Chart of Accounts</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-md">Load the Nigerian-compliant Chart of Accounts template (150+ accounts) compliant with IFRS, CAMA 2020, CITA, and FIRS regulations, or add accounts manually.</p>
            <div className="flex gap-3">
              <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors">
                {seedMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {seedMutation.isPending ? 'Loading Template...' : 'Load Nigerian COA Template'}
              </button>
              <button onClick={openAddModal} className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"><Plus size={16} /> Add Manually</button>
            </div>
            {seedMutation.isSuccess && <div className="flex items-center gap-2 mt-4 text-sm text-emerald-600"><CheckCircle2 size={16} />Template loaded successfully!</div>}
            {seedMutation.isError && <div className="flex items-center gap-2 mt-4 text-sm text-rose-500"><AlertCircle size={16} />Failed to load template. You may already have accounts.</div>}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                <th className="py-2.5 pl-4 pr-3">Code</th>
                <th className="py-2.5 pr-3">Account Name</th>
                <th className="py-2.5 pr-3">Type</th>
                <th className="py-2.5 pr-3">Sub-type</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">{tree.map((node) => renderNode(node, 0))}</tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{modalMode === 'add' ? 'Add Account' : 'Edit Account'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
              {formError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{formError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Code</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Account['type'] })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                    {ACCOUNT_TYPES.map((t) => (<option key={t} value={t}>{TYPE_META[t].plural}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Account Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Sub-type</label>
                  <input value={form.subType} onChange={(e) => setForm({ ...form, subType: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Parent Account</label>
                  <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                    <option value="">None (top-level)</option>
                    {(accounts || []).filter((a) => a.id !== editingId).map((a) => (<option key={a.id} value={a.id}>{a.code} — {a.name}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
              {modalMode === 'edit' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Opening Balance (NGN)</label>
                  <input type="number" step="0.01" min="0" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-slate-300" />
                Active
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50">{isSaving ? 'Saving...' : modalMode === 'add' ? 'Add Account' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Delete Account</h2>
            <p className="text-sm text-slate-500 mb-4">Are you sure you want to delete <span className="font-medium text-slate-700">{deleteTarget.code} — {deleteTarget.name}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50">{deleteMutation.isPending ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Import Chart of Accounts</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-500">Upload a CSV file exported from your previous accounting system. Required columns: <code className="text-xs bg-slate-100 px-1 rounded">code</code>, <code className="text-xs bg-slate-100 px-1 rounded">name</code>, <code className="text-xs bg-slate-100 px-1 rounded">type</code> (asset/liability/equity/revenue/expense). Optional: <code className="text-xs bg-slate-100 px-1 rounded">sub-type</code>, <code className="text-xs bg-slate-100 px-1 rounded">parent code</code>, <code className="text-xs bg-slate-100 px-1 rounded">description</code>, <code className="text-xs bg-slate-100 px-1 rounded">active</code>, <code className="text-xs bg-slate-100 px-1 rounded">opening balance (NGN)</code>.</p>
            <p className="text-xs text-slate-400">Click "Sample CSV" above to download a template.</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
            {csvText && <div className="text-xs text-slate-500 bg-slate-50 rounded p-2 max-h-24 overflow-auto">{csvText.slice(0, 500)}{csvText.length > 500 ? '...' : ''}</div>}
            {importMsg && <div className={`text-sm p-2 rounded ${importMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{importMsg.text}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleImport} disabled={!csvText.trim() || importing} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{importing ? 'Importing...' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}