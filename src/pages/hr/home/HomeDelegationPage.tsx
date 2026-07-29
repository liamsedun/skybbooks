import { useMemo, useEffect, useState, useRef } from 'react';
import { UserCheck, Clock, Ban, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface Delegation {
  id: string; delegator: string; delegate: string; module: string;
  startDate: string; endDate: string; status: string;
}

export function HomeDelegationPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const delegatorRef = useRef<HTMLInputElement>(null);
  const delegateRef = useRef<HTMLInputElement>(null);
  const moduleRef = useRef<HTMLSelectElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const ps = useHrPageState({ data, initialSortKey: 'delegator', searchKeys: ['delegator', 'delegate', 'module'], pageSize: 10 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await hrApi.getDelegations();
      setData(Array.isArray(result) ? result : []);
    } catch (e: any) { showError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <UserCheck className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: data.filter(i => i.status === 'active').length, icon: <Clock className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Expired', value: data.filter(i => i.status === 'expired').length, icon: <Ban className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'expired', onClick: () => ps.setStatusFilter('expired') },
  ], [data, ps.statusFilter]);
  const columns: Column<Delegation>[] = [
    { key: 'delegator', label: 'Delegator', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.delegator}</span> },
    { key: 'delegate', label: 'Delegate', sortable: true },
    { key: 'module', label: 'Module', sortable: true },
    { key: 'startDate', label: 'Period', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.startDate)} - {formatDate(i.endDate)}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];
  return (
    <HrPageShell title="Delegation Rules" description="Manage task and approval delegation"
      pageKey="home"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Delegator','Delegate','Module','Status'], ps.filtered.map(i => [i.delegator,i.delegate,i.module,i.status]), 'delegations'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Delegation Rules', ['Delegator','Delegate','Module','Status'], ps.filtered.map(i => [i.delegator,i.delegate,i.module,i.status]), 'delegations')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search delegator, delegate or module..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Expired', value: 'expired' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No delegation rules" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Delegation' : 'Add Delegation'} onSubmit={async (e) => { e.preventDefault(); try { await hrApi.createDelegation({ delegator: delegatorRef.current?.value, delegate: delegateRef.current?.value, module: moduleRef.current?.value, startDate: startDateRef.current?.value, endDate: endDateRef.current?.value }); showSuccess(ps.editingId ? 'Updated' : 'Created'); ps.closeModal(); loadData(); } catch (err: any) { showError(err?.message || 'Failed to save'); } }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Delegator</label><input ref={delegatorRef} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Alice Johnson" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Delegate</label><input ref={delegateRef} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Bob Smith" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Module</label><select ref={moduleRef} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>Leave</option><option>Payroll</option><option>Recruitment</option><option>Attendance</option><option>Training</option></select></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-ink-500 mb-1">Start Date</label><input ref={startDateRef} type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div><div><label className="block text-xs font-medium text-ink-500 mb-1">End Date</label><input ref={endDateRef} type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={async () => { try { if (ps.deletingId) await hrApi.deleteDelegation(ps.deletingId); showSuccess('Deleted'); ps.closeConfirmDelete(); loadData(); } catch (err: any) { showError(err?.message || 'Failed to delete'); } }} title="Delete Delegation" message="Are you sure you want to delete this delegation rule?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Delegation Details">
        {ps.viewingId && (() => { const d = data.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center"><UserCheck className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{d.delegator} → {d.delegate}</p><p className="text-xs text-ink-400">{d.module}</p></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Start Date</p><p className="text-sm text-ink-700 mt-1">{formatDate(d.startDate)}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">End Date</p><p className="text-sm text-ink-700 mt-1">{formatDate(d.endDate)}</p></div></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(d.status)}`}>{d.status}</span></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}


