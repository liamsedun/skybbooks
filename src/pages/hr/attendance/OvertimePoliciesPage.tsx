import { useState, useMemo, useEffect } from 'react';
import { Plus, Edit3, Trash2, Eye, Timer, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

export function OvertimePoliciesPage() {
  const { success, error: showError } = useToast();
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await hrApi.getOvertimePolicies({ pageSize: 500 });
      setPolicies(res?.data ?? []);
    } catch (e) {
      showError('Failed to load overtime policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const ps = useHrPageState({ data: policies, initialSortKey: 'name', searchKeys: ['name'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const stats = useMemo(() => [
    { label: 'Total Policies', value: policies.length, icon: <Timer className="w-4 h-4" />, color: 'blue' as const, active: true, onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: policies.filter(i => i.isActive !== false).length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Inactive', value: policies.filter(i => i.isActive === false).length, icon: <XCircle className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
  ], [policies, ps.statusFilter]);

  const columns: Column<any>[] = [
    {
      key: 'name', label: 'Policy Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span>,
    },
    { key: 'multiplier', label: 'Rate (x)', sortable: true, className: 'text-center', render: (i) => `${i.multiplier || 1.5}x` },
    { key: 'maxOvertimeHours', label: 'Max Hours', sortable: true, className: 'text-center', render: (i) => i.maxOvertimeHours ?? 'Unlimited' },
    { key: 'applicableDays', label: 'Applicable Days', render: (i) => i.applicableDays?.join(', ') || 'All' },
    {
      key: 'isActive', label: 'Status', sortable: true, render: (i) => {
        const active = i.isActive !== false;
        return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-600'}`}>{active ? 'Active' : 'Inactive'}</span>;
      },
    },
    {
      key: 'actions', label: '', render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ), className: 'text-right',
    },
  ];

  const selectedItem = ps.viewDrawerId ? filtered.find(i => i.id === ps.viewDrawerId) : null;
  const editItem = ps.editModalId ? filtered.find(i => i.id === ps.editModalId) : null;

  return (
    <HrPageShell title="Overtime Policies" description="Configure overtime rules and rates"
      pageKey="overtime-policies"
      headerActions={<>
        <button onClick={() => ps.openAddModal()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> New Policy</button>
        <button onClick={() => exportToCsv(filtered, columns, 'overtime-policies')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search policies..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'active', 'inactive']}
        onExportPdf={() => exportToPdf(filtered, columns, 'Overtime Policies')}
      />
      <HrDataTable columns={columns} data={loading ? [] : paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage={loading ? 'Loading...' : 'No overtime policies found'} emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add a policy</button>} />
      <HrFormModal open={ps.addModalOpen || ps.editModalOpen} onClose={ps.closeModals} title={ps.editModalOpen ? 'Edit Overtime Policy' : 'New Overtime Policy'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Policy Name</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.name ?? ''} placeholder="e.g. Weekday OT" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Rate Multiplier</label><input type="number" step="0.1" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.multiplier ?? '1.5'} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Max Hours</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.maxOvertimeHours ?? ''} placeholder="Unlimited" /></div>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={async () => {
            try { await (editItem ? hrApi.updateOvertimePolicy(editItem.id, {}) : hrApi.createOvertimePolicy({})); success(editItem ? 'Policy updated' : 'Policy created'); ps.closeModals(); await fetchData(); } catch { showError('Failed to save'); }
          }}>{ps.editModalId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmDeleteId !== null} onClose={ps.closeModals} onConfirm={async () => {
        try { await hrApi.deleteOvertimePolicy(ps.confirmDeleteId!); ps.confirmDelete(); success('Policy deleted'); await fetchData(); } catch { showError('Failed to delete'); }
      }} title="Delete Policy" message="Are you sure you want to delete this overtime policy?" />
      <HrViewDrawer open={ps.viewDrawerId !== null} onClose={ps.closeModals} title="Policy Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Policy Name</label><p className="text-sm font-medium text-ink-900">{selectedItem.name}</p></div>
          <div><label className="text-xs text-ink-500">Rate</label><p className="text-sm font-medium text-ink-900">{selectedItem.multiplier || 1.5}x</p></div>
          <div><label className="text-xs text-ink-500">Max Overtime Hours</label><p className="text-sm font-medium text-ink-900">{selectedItem.maxOvertimeHours ?? 'Unlimited'}</p></div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900">{(selectedItem.isActive !== false) ? 'Active' : 'Inactive'}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}
