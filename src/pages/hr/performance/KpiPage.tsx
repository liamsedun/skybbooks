import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Plus, Download, FileText, Edit3, Trash2, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface Kpi {
  id: string;
  name: string;
  employeeId: string;
  category: string;
  target: number;
  actual: number;
  unit: string;
  frequency: string;
  weight: number;
  isActive: boolean;
}

const FREQUENCY_OPTIONS = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;

const progressColor = (pct: number) => {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-blue-500';
  if (pct >= 30) return 'bg-amber-500';
  return 'bg-rose-500';
};

interface FormState {
  name: string;
  employeeId: string;
  category: string;
  target: string;
  unit: string;
  frequency: string;
  weight: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  employeeId: '',
  category: '',
  target: '',
  unit: '',
  frequency: 'monthly',
  weight: '',
  isActive: true,
};

export function KpiPage() {
  const { toast } = useToast();
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchKpis = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await hrApi.getKpis({ pageSize: 500 });
      setKpis(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to load KPIs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKpis(); }, []);

  const ps = useHrPageState({
    data: kpis,
    initialSortKey: 'name',
    searchKeys: ['name', 'category', 'employeeId'],
    pageSize: 10,
  });

  const statusFiltered = useMemo(() => {
    if (ps.statusFilter === 'all') return kpis;
    return kpis.filter(k => ps.statusFilter === 'active' ? k.isActive : !k.isActive);
  }, [kpis, ps.statusFilter]);

  const filteredData = useMemo(() => {
    let result = statusFiltered;
    if (ps.search) {
      const q = ps.search.toLowerCase();
      result = result.filter(k =>
        k.name.toLowerCase().includes(q) ||
        k.category.toLowerCase().includes(q) ||
        k.employeeId.toLowerCase().includes(q)
      );
    }
    if (ps.sortKey) {
      const key = ps.sortKey as keyof Kpi;
      result.sort((a, b) => {
        const aVal = a[key] ?? '';
        const bVal = b[key] ?? '';
        const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
        return ps.sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [statusFiltered, ps.search, ps.sortKey, ps.sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ps.pageSize));
  const safePage = Math.min(ps.page, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * ps.pageSize;
    return filteredData.slice(start, start + ps.pageSize);
  }, [filteredData, safePage, ps.pageSize]);

  const stats = useMemo(() => {
    const categories = [...new Set(kpis.map(k => k.category).filter(Boolean))];
    return [
      { label: 'Total KPIs', value: kpis.length, icon: <TrendingUp className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
      { label: 'Active', value: kpis.filter(k => k.isActive).length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
      { label: 'Inactive', value: kpis.filter(k => !k.isActive).length, icon: <XCircle className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
      { label: 'Categories', value: categories.length, icon: <TrendingUp className="w-4 h-4" />, color: 'purple' as const, onClick: () => ps.setStatusFilter('all') },
    ];
  }, [kpis, ps.statusFilter]);

  const columns: Column<Kpi>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'category', label: 'Category', sortable: true, render: (i) => <span className="text-ink-600">{i.category}</span> },
    { key: 'target', label: 'Target', sortable: true, render: (i) => <span className="text-ink-600 tabular-nums">{i.target} {i.unit}</span> },
    { key: 'actual', label: 'Actual', sortable: true, render: (i) => <span className="text-ink-600 tabular-nums">{i.actual} {i.unit}</span> },
    {
      key: 'progress', label: 'Progress', sortable: true, render: (i) => {
        const pct = i.target > 0 ? Math.min(100, Math.round((i.actual / i.target) * 100)) : 0;
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="flex-1 h-2 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-ink-600 w-10 text-right">{pct}%</span>
          </div>
        );
      },
    },
    { key: 'frequency', label: 'Frequency', sortable: true, render: (i) => <span className="capitalize text-ink-600">{i.frequency}</span> },
    {
      key: 'status', label: 'Status', render: (i) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${i.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
          {i.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions', label: '', render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => { ps.openEditModal(i.id); setForm({ name: i.name, employeeId: i.employeeId, category: i.category, target: String(i.target), unit: i.unit, frequency: i.frequency, weight: String(i.weight), isActive: i.isActive }); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ), className: 'text-right' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    ps.setFormError(null);
    try {
      const payload: Record<string, any> = {
        name: form.name,
        category: form.category,
        target: Number(form.target),
        unit: form.unit,
        frequency: form.frequency,
        isActive: form.isActive,
      };
      if (form.employeeId) payload.employeeId = form.employeeId;
      if (form.weight) payload.weight = Number(form.weight);
      if (ps.editingId) {
        await hrApi.updateKpi(ps.editingId, payload);
        toast('KPI updated', 'success');
      } else {
        await hrApi.createKpi(payload);
        toast('KPI created', 'success');
      }
      ps.closeModal();
      setForm(EMPTY_FORM);
      await fetchKpis();
    } catch (err: any) {
      ps.setFormError(err?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    setSubmitting(true);
    try {
      await hrApi.deleteKpi(ps.deletingId);
      toast('KPI deleted', 'success');
      ps.closeConfirmDelete();
      await fetchKpis();
    } catch (err: any) {
      toast(err?.message || 'Delete failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const csvHeaders = ['Name', 'Category', 'Target', 'Actual', 'Progress', 'Unit', 'Frequency', 'Weight', 'Status'];
  const csvRows = (data: Kpi[]) => data.map(k => [
    k.name, k.category, String(k.target), String(k.actual),
    `${k.target > 0 ? Math.round((k.actual / k.target) * 100) : 0}%`,
    k.unit, k.frequency, String(k.weight), k.isActive ? 'Active' : 'Inactive',
  ]);

  return (
    <HrPageShell title="KPIs" description="Track employee key performance indicators"
      pageKey="kpis"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(csvHeaders, csvRows(filteredData), 'kpis'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('KPIs', csvHeaders, csvRows(filteredData), 'kpis')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => { ps.openAddModal(); setForm(EMPTY_FORM); }} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by name, category, employee..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={paginatedData} keyExtractor={i => i.id}
        loading={loading} error={fetchError}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={safePage} totalPages={totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filteredData.length}
        from={(safePage - 1) * ps.pageSize + 1} to={Math.min(safePage * ps.pageSize, filteredData.length)}
        emptyMessage="No KPIs found" emptyAction={<button onClick={() => { ps.openAddModal(); setForm(EMPTY_FORM); }} className="text-xs font-medium text-primary">Add KPI</button>} />
      <HrFormModal open={ps.modalOpen} onClose={() => { ps.closeModal(); setForm(EMPTY_FORM); }} title={ps.editingId ? 'Edit KPI' : 'Add KPI'} onSubmit={handleSubmit} error={ps.formError} loading={submitting} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-500 mb-1">Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Customer Satisfaction Score" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Employee ID</label>
            <input value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Optional" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Category</label>
            <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Quality" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Target</label>
            <input type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} required min="0" step="any" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Unit</label>
            <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. %, count, score" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Frequency</label>
            <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              {FREQUENCY_OPTIONS.map(o => <option key={o} value={o} className="capitalize">{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Weight</label>
            <input type="number" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} min="0" max="100" step="any" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Optional" />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="sr-only peer" />
              <div className="w-10 h-5 bg-ink-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              <span className="ml-3 text-xs font-medium text-ink-500">Active</span>
            </label>
          </div>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete} title="Delete KPI" message="Are you sure you want to delete this KPI?" confirmLabel="Delete" variant="danger" loading={submitting} />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="KPI Details">
        {ps.viewingId && (() => {
          const k = kpis.find(i => i.id === ps.viewingId);
          if (!k) return <p className="text-sm text-ink-400">KPI not found</p>;
          const pct = k.target > 0 ? Math.min(100, Math.round((k.actual / k.target) * 100)) : 0;
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center"><TrendingUp className="w-5 h-5" /></div>
                <div><p className="text-sm font-semibold text-ink-900">{k.name}</p><p className="text-xs text-ink-400">{k.category}</p></div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Progress</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-ink-700 w-10 text-right">{pct}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Target</p><p className="text-sm text-ink-700 mt-1 tabular-nums">{k.target} {k.unit}</p></div>
                <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Actual</p><p className="text-sm text-ink-700 mt-1 tabular-nums">{k.actual} {k.unit}</p></div>
                <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Frequency</p><p className="text-sm capitalize text-ink-700 mt-1">{k.frequency}</p></div>
                <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Weight</p><p className="text-sm text-ink-700 mt-1">{k.weight}</p></div>
              </div>
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Employee</p><p className="text-sm text-ink-700 mt-1">{k.employeeId || '\u2014'}</p></div>
              <div>
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${k.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                  {k.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          );
        })()}
      </HrViewDrawer>
    </HrPageShell>
  );
}
