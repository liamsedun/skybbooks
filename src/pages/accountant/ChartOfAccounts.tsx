import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, accountantApi, printWindow } from '../../lib/api';
import { PageLoader } from '../../components/ui/PageLoader';
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
  Eye,
} from 'lucide-react';
import { downloadCsv, exportToCsv } from '../../lib/csvTemplates';

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
  balance?: number;
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

function computeAggregateBalances(nodes: TreeNode[]): Map<string, number> {
  const map = new Map<string, number>();
  function walk(node: TreeNode): number {
    let sum = node.balance ?? 0;
    for (const child of node.children) sum += walk(child);
    map.set(node.id, sum);
    return sum;
  }
  for (const root of nodes) walk(root);
  return map;
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

function fmtNaira(v: number): string {
  const abs = Math.abs(v) / 100;
  const formatted = `₦${abs.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return v < 0 ? `(${formatted})` : formatted;
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
  const [showBalances, setShowBalances] = useState(true);

  const { data: accounts, isLoading, isError } = useQuery<Account[]>({
    queryKey: ['accountant', 'accounts', 'withBalances'],
    queryFn: async () => {
      const res = await api.get('/accountant/accounts?includeBalances=true');
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

  const effectiveAccounts = accounts || [];
  const tree = useMemo(() => buildTree(effectiveAccounts || []), [effectiveAccounts]);
  const aggBalances = useMemo(() => computeAggregateBalances(tree), [tree]);
  const visibleIds = useMemo(() => visibleNodeIds(tree, searchTerm, activeFilter), [tree, searchTerm, activeFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: effectiveAccounts?.length || 0 };
    ACCOUNT_TYPES.forEach((t) => { c[t] = (effectiveAccounts || []).filter((a) => a.type === t).length; });
    return c;
  }, [effectiveAccounts]);

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

  const handleExportCsv = () => {
    const list = effectiveAccounts || [];
    const parentIds = new Set(list.filter(a => list.some(c => c.parentId === a.id)).map(a => a.id));
    let totDr = 0, totCr = 0;
    const csvRows: string[][] = [];
    for (const a of list) {
      const dc = toDebitCredit(a.balance ?? 0, a.type);
      if (!parentIds.has(a.id)) { totDr += dc.debit; totCr += dc.credit; }
      csvRows.push([
        a.code,
        `"${(a.name || '').replace(/"/g, '""')}"`,
        a.type,
        a.subType || '',
        a.isActive ? 'Active' : 'Inactive',
        (dc.debit / 100).toFixed(2),
        (dc.credit / 100).toFixed(2),
      ]);
    }
    csvRows.push([
      'TOTAL', '', '', '', '',
      (totDr / 100).toFixed(2),
      (totCr / 100).toFixed(2),
    ]);
    exportToCsv('chart_of_accounts.csv',
      ['Code', 'Account Name', 'Type', 'Sub-type', 'Status', 'Debit (NGN)', 'Credit (NGN)'],
      csvRows
    );
  };

  const handlePrintPdf = () => {
    try {
      const list = effectiveAccounts || [];
      const parentIds = new Set(list.filter(a => list.some(c => c.parentId === a.id)).map(a => a.id));
      let totDr = 0, totCr = 0;
      const rows = list.map((a: Account) => {
        const dc = toDebitCredit(a.balance ?? 0, a.type);
        if (!parentIds.has(a.id)) { totDr += dc.debit; totCr += dc.credit; }
        return `<tr><td>${a.code||''}</td><td>${a.name||''}</td><td>${a.type||''}</td><td class="c">${a.isActive ? 'Active' : 'Inactive'}</td><td class="r">${dc.debit > 0 ? '₦'+Number(dc.debit/100).toLocaleString() : ''}</td><td class="r">${dc.credit > 0 ? '₦'+Number(dc.credit/100).toLocaleString() : ''}</td></tr>`;
      }).join('');
      const footer = `<tr style="font-weight:bold;border-top:2px solid #333;background:#f8fafc"><td colspan="4">Total</td><td class="r">₦${Number(totDr/100).toLocaleString()}</td><td class="r">₦${Number(totCr/100).toLocaleString()}</td></tr>`;
      printWindow('Chart of Accounts', `<table><thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th class="c">Status</th><th class="r">Debit</th><th class="r">Credit</th></tr></thead><tbody>${rows||'<tr><td colspan="6" style="text-align:center;color:#94a3b8">No accounts</td></tr>'}</tbody>${list.length ? `<tfoot>${footer}</tfoot>` : ''}</table>`, `${list.length} accounts`);
    } catch (err) {
      alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
      console.error('Print error:', err);
    }
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

  const debitNormalTypes = new Set(['asset', 'expense']);

  function toDebitCredit(balance: number, type: string): { debit: number; credit: number } {
    if (balance === 0) return { debit: 0, credit: 0 };
    const isDebitNormal = debitNormalTypes.has(type);
    const isCreditNormal = !isDebitNormal;
    if (balance > 0) {
      return isDebitNormal ? { debit: balance, credit: 0 } : { debit: 0, credit: balance };
    }
    return isCreditNormal ? { debit: Math.abs(balance), credit: 0 } : { debit: 0, credit: Math.abs(balance) };
  }

  function renderCell(amount: number, className?: string): React.ReactNode {
    if (amount === 0) return <span className={`font-mono text-sm text-slate-400 ${className || ''}`}>₦0.00</span>;
    return <span className={`font-mono text-sm text-slate-800 ${className || ''}`}>{fmtNaira(amount)}</span>;
  }

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    if (!visibleIds.has(node.id)) return null;
    const meta = TYPE_META[node.type];
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);

    return (
      <React.Fragment key={node.id}>
        <tr className="group hover:bg-slate-50/50 transition-colors">
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
          {showBalances && (() => {
            const bal = hasChildren ? (aggBalances.get(node.id) ?? node.balance ?? 0) : (node.balance ?? 0);
            const dc = toDebitCredit(bal, node.type);
            return (
              <>
                <td className="py-2.5 pr-3 text-right whitespace-nowrap">{renderCell(dc.debit)}</td>
                <td className="py-2.5 pr-3 text-right whitespace-nowrap">{renderCell(dc.credit)}</td>
              </>
            );
          })()}
          <td className="py-2.5 pr-2 text-right">
            <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity">
              <button onClick={() => openEditModal(node)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200" aria-label="Edit account"><Pencil size={14} /></button>
              {!node.isSystem && (
                <button onClick={() => setDeleteTarget(node)} className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200" aria-label="Delete account"><Trash2 size={14} /></button>
              )}
            </div>
          </td>
        </tr>
        {isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chart of Accounts</h1>
          <p className="text-sm text-slate-500 mt-1">{counts.all} accounts · Double-entry general ledger structure</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBalances((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all duration-200 ${
              showBalances
                ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          ><Eye className="w-3.5 h-3.5" /> {showBalances ? 'Hide Balances' : 'Show Balances'}</button>
          <button onClick={() => downloadCsv('chart-of-accounts-template.csv', ['code', 'name', 'type', 'sub-type', 'parent code', 'description', 'active', 'opening balance (NGN)'], ['100000', 'Cash and Cash Equivalents', 'asset', 'Current Assets', '', '', 'Yes', '5000000'])} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-500 rounded-xl hover:bg-slate-600 transition-all duration-200"><FileText className="w-3.5 h-3.5" /> Sample CSV</button>
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200"><Upload className="w-3.5 h-3.5" /> Import CSV</button>
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all duration-200"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all duration-200"><Printer className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={openAddModal} className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200"><Plus size={14} /> Add Account</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActiveFilter('all')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${activeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>All Accounts ({counts.all})</button>
        {ACCOUNT_TYPES.map((t) => (
          <button key={t} onClick={() => setActiveFilter(t)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${activeFilter === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{TYPE_META[t].plural} ({counts[t]})</button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name, code, or sub-type..." className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow pl-9 pr-3 text-slate-800 placeholder-slate-400" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        {isLoading ? (
          <PageLoader message="Loading accounts..." />
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm"><AlertCircle size={16} />Failed to load accounts. Check the API route.</div>
        ) : !effectiveAccounts || effectiveAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4"><Download size={28} className="text-slate-400" /></div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">No Chart of Accounts</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-md">Load the Nigerian-compliant Chart of Accounts template (150+ accounts) compliant with IFRS, CAMA 2020, CITA, and FIRS regulations, or add accounts manually.</p>
            <div className="flex gap-3">
              <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200">
                {seedMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {seedMutation.isPending ? 'Loading Template...' : 'Load Nigerian COA Template'}
              </button>
              <button onClick={openAddModal} className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200/80 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all duration-200"><Plus size={16} /> Add Manually</button>
            </div>
            {seedMutation.isSuccess && <div className="flex items-center gap-2 mt-4 text-sm text-emerald-600"><CheckCircle2 size={16} />Template loaded successfully!</div>}
            {seedMutation.isError && <div className="flex items-center gap-2 mt-4 text-sm text-rose-500"><AlertCircle size={16} />Failed to load template. You may already have accounts.</div>}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200/80">
                <th className="px-3 py-3 text-left">Code</th>
                <th className="px-3 py-3 text-left">Account Name</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Sub-type</th>
                <th className="px-3 py-3 text-left">Status</th>
                {showBalances && (
                  <th className="px-3 py-3 text-right">Debit</th>
                )}
                {showBalances && (
                  <th className="px-3 py-3 text-right">Credit</th>
                )}
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">{tree.map((node) => renderNode(node, 0))}</tbody>
            {showBalances && effectiveAccounts.length > 0 && (() => {
              const parentIds = new Set(effectiveAccounts.filter(a => effectiveAccounts.some(c => c.parentId === a.id)).map(a => a.id));
              let totDr = 0, totCr = 0;
              for (const a of effectiveAccounts) {
                if (parentIds.has(a.id)) continue;
                const dc = toDebitCredit(a.balance ?? 0, a.type);
                totDr += dc.debit; totCr += dc.credit;
              }
              return (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
                    <td className="py-3 pl-4 pr-3 text-sm" colSpan={4}>Total</td>
                    <td className="py-3 pr-3" />
                    <td className="py-3 pr-3 text-right font-mono text-sm">{renderCell(totDr)}</td>
                    <td className="py-3 pr-3 text-right font-mono text-sm">{renderCell(totCr)}</td>
                    <td className="py-3 pr-2" />
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-slate-200/80">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80 shrink-0">
              <h2 className="text-base font-semibold text-slate-900">{modalMode === 'add' ? 'Add Account' : 'Edit Account'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-all duration-200"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 overflow-y-auto">
              {formError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100/80 rounded-xl px-3 py-2">{formError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Code</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Account['type'] })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow">
                    {ACCOUNT_TYPES.map((t) => (<option key={t} value={t}>{TYPE_META[t].plural}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Account Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Sub-type</label>
                  <input value={form.subType} onChange={(e) => setForm({ ...form, subType: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Parent Account</label>
                  <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow">
                    <option value="">None (top-level)</option>
                    {(effectiveAccounts || []).filter((a) => a.id !== editingId).map((a) => (<option key={a.id} value={a.id}>{a.code} — {a.name}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
              </div>
              {modalMode === 'edit' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Opening Balance (NGN)</label>
                  <input type="number" step="0.01" min="0" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} placeholder="0.00" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-slate-300" />
                Active
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200 border border-slate-200/80">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200">{isSaving ? 'Saving...' : modalMode === 'add' ? 'Add Account' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 border border-slate-200/80">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Delete Account</h2>
            <p className="text-sm text-slate-500 mb-4">Are you sure you want to delete <span className="font-medium text-slate-700">{deleteTarget.code} — {deleteTarget.name}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200 border border-slate-200/80">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-all duration-200">{deleteMutation.isPending ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200/80 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-slate-900">Import Chart of Accounts</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-all duration-200"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-500">Upload a CSV file exported from your previous accounting system. Required columns: <code className="text-xs bg-slate-100 px-1 rounded">code</code>, <code className="text-xs bg-slate-100 px-1 rounded">name</code>, <code className="text-xs bg-slate-100 px-1 rounded">type</code> (asset/liability/equity/revenue/expense). Optional: <code className="text-xs bg-slate-100 px-1 rounded">sub-type</code>, <code className="text-xs bg-slate-100 px-1 rounded">parent code</code>, <code className="text-xs bg-slate-100 px-1 rounded">description</code>, <code className="text-xs bg-slate-100 px-1 rounded">active</code>, <code className="text-xs bg-slate-100 px-1 rounded">opening balance (NGN)</code>.</p>
            <p className="text-xs text-slate-400">Click "Sample CSV" above to download a template.</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
            {csvText && <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-2 max-h-24 overflow-auto">{csvText.slice(0, 500)}{csvText.length > 500 ? '...' : ''}</div>}
            {importMsg && <div className={`text-sm p-2 rounded-xl ${importMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{importMsg.text}</div>}
            <div className="flex justify-end gap-2 shrink-0">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl text-slate-600 hover:bg-slate-50 transition-all duration-200">Cancel</button>
              <button onClick={handleImport} disabled={!csvText.trim() || importing} className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200">{importing ? 'Importing...' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}