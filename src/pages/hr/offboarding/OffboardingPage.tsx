import { useEffect, useMemo, useState } from 'react';
import { DoorOpen, Play, CheckCircle, Clock, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface OffboardingItem {
  id: string;
  employeeName: string;
  department: string;
  exitDate: string;
  reason: string;
  status: string;
}

export function OffboardingPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<OffboardingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'department', 'reason'], pageSize: 10 });
  useEffect(() => { loadData(); }, []);
  useEffect(() => { ps.setData(data); }, [data]);
  const loadData = async () => {
    setLoading(true);
    try { const result = await hrApi.getOffboardingTasks(''); setData(Array.isArray(result) ? result : []); }
    catch (e: any) { showError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <DoorOpen className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'In Progress', value: data.filter(i => i.status === 'in-progress').length + data.filter(i => i.status === 'initiated').length, icon: <Play className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'in-progress', onClick: () => ps.setStatusFilter('in-progress') },
    { label: 'Completed', value: data.filter(i => i.status === 'completed').length, icon: <CheckCircle className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
  ], [data, ps.statusFilter]);

  const columns: Column<OffboardingItem>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'department', label: 'Department', sortable: true, render: (i) => <span className="text-ink-600">{i.department}</span> },
    { key: 'exitDate', label: 'Exit Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.exitDate)}</span> },
    { key: 'reason', label: 'Reason', render: (i) => <span className="text-ink-600">{i.reason}</span> },
    { key: 'status', label: 'Status', render: (i) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
        i.status === 'initiated' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400' :
        i.status === 'in-progress' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400' :
        statusColor(i.status)
      }`}>{i.status}</span>
    )},
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  return (
    <HrPageShell title="Offboarding" description="Manage employee offboarding"
      pageKey="offboarding"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee', 'Department', 'Exit Date', 'Reason', 'Status'], data.map(o => [o.employeeName, o.department, o.exitDate, o.reason, o.status]), 'offboarding'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Offboarding', ['Employee', 'Department', 'Exit Date', 'Reason', 'Status'], data.map(o => [o.employeeName, o.department, o.exitDate, o.reason, o.status]), 'offboarding')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Start Offboarding</button>
        </>
      }>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employee, department..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Initiated', value: 'initiated' }, { label: 'In Progress', value: 'in-progress' }, { label: 'Completed', value: 'completed' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No offboarding records" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Start offboarding</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Offboarding' : 'Start Offboarding'} onSubmit={(e) => { e.preventDefault(); showError('Read-only view'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Exit Date</label><input type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Reason</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>Resignation</option><option>Retirement</option><option>End of Contract</option><option>Relocation</option><option>Mutual Agreement</option></select></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showError('Read-only view'); ps.closeConfirmDelete(); }} title="Delete" message="Are you sure?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Offboarding Details">
        {ps.viewingId && (() => { const o = data.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="grid grid-cols-2 gap-4"><div><p className="text-ink-400 text-xs">Employee</p><p className="font-medium text-ink-900">{o.employeeName}</p></div><div><p className="text-ink-400 text-xs">Department</p><p className="font-medium text-ink-900">{o.department}</p></div><div><p className="text-ink-400 text-xs">Exit Date</p><p className="font-medium text-ink-900">{formatDate(o.exitDate)}</p></div><div><p className="text-ink-400 text-xs">Reason</p><p className="font-medium text-ink-900">{o.reason}</p></div><div><p className="text-ink-400 text-xs">Status</p><p className="font-medium text-ink-900 capitalize">{o.status}</p></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}

