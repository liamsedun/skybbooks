import { useEffect, useMemo, useState } from 'react';
import { Target, Plus, Download, Upload, FileText, Edit3, Trash2, Eye, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface OKRItem { id: string; title: string; owner: string; quarter: string; progress: number; status: string; }
const progressColor = (p: number) => {
  if (p >= 80) return 'bg-emerald-500';
  if (p >= 50) return 'bg-blue-500';
  if (p >= 25) return 'bg-amber-500';
  return 'bg-rose-500';
};
export function OpsOKRPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<OKRItem[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data, initialSortKey: 'title', searchKeys: ['title', 'owner', 'quarter'], pageSize: 10 });
  useEffect(() => { loadData(); }, []);
  useEffect(() => { ps.setData(data); }, [data]);
  const loadData = async () => {
    setLoading(true);
    try { const result = await hrApi.getOkrs({}); setData(Array.isArray(result) ? result : []); }
    catch (e: any) { showError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  const stats = useMemo(() => [
    { label: 'Total OKRs', value: ps.filtered.length.toString(), icon: <Target className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'On Track', value: ps.filtered.filter(i => i.status === 'on-track').length.toString(), icon: <CheckCircle2 className="w-4 h-4" />, color: 'cyan' as const, active: ps.statusFilter === 'on-track', onClick: () => ps.setStatusFilter('on-track') },
    { label: 'Ahead', value: ps.filtered.filter(i => i.status === 'ahead').length.toString(), icon: <TrendingUp className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'ahead', onClick: () => ps.setStatusFilter('ahead') },
    { label: 'At Risk', value: ps.filtered.filter(i => i.status === 'at-risk').length.toString(), icon: <AlertTriangle className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'at-risk', onClick: () => ps.setStatusFilter('at-risk') },
  ], [ps.filtered]);
  const columns: Column<OKRItem>[] = [
    { key: 'title', label: 'Objective', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.title}</span> },
    { key: 'owner', label: 'Owner', sortable: true },
    { key: 'quarter', label: 'Quarter', sortable: true },
    { key: 'progress', label: 'Progress', sortable: true, render: (i) => (
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 bg-ink-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${progressColor(i.progress)} transition-all`} style={{ width: `${i.progress}%` }} />
        </div>
        <span className="text-xs font-semibold text-ink-600">{i.progress}%</span>
      </div>
    ) },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];
  return (
    <HrPageShell title="OKR" description="Objectives and Key Results (OKRs) â€” set goals, track progress, and align teams."
      pageKey="goals"
      headerActions={<><button onClick={ps.openAddModal} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Add OKR</button><button onClick={() => ps.setImportOpen(true)} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Import</button><button onClick={() => exportToCsv(ps.filtered, 'okrs.csv')} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button></>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search OKRs..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'On Track', value: 'on-track' }, { label: 'Ahead', value: 'ahead' }, { label: 'At Risk', value: 'at-risk' }, { label: 'Completed', value: 'completed' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No OKRs found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first OKR</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit OKR' : 'Add OKR'} onSubmit={(e) => { e.preventDefault(); showError('Read-only view'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Objective</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Owner</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Quarter</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Q3 2026" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Progress (%)</label><input type="number" min="0" max="100" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showError('Read-only view'); ps.closeConfirmDelete(); }} title="Delete OKR" message="Are you sure you want to delete this OKR?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="OKR Details"><div className="space-y-3 text-sm text-ink-600"><p>Details content</p></div></HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import OKRs" onSubmit={(e) => { e.preventDefault(); showSuccess('OKRs imported'); ps.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file with OKRs.</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
      </HrFormModal>
    </HrPageShell>
  );
}


