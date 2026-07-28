import { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Eye, Edit3, Trash2, Shield, CheckCircle2, XCircle, FileText } from 'lucide-react';
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

export function LeavePolicyPage() {
  const { success, error } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const ps = useHrPageState({ data, initialSortKey: 'name', searchKeys: ['name'], pageSize: 10 });

  useEffect(() => { loadData(); }, []);
  useEffect(() => { ps.setData(data); }, [data]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [policies] = await Promise.all([
        hrApi.getLeavePolicies(),
      ]);
      setData(Array.isArray(policies) ? policies : []);
    } catch (e: any) { error(e?.message || 'Failed to load leave policies'); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => [
    { label: 'Total Policies', value: data.length, icon: <FileText className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: data.filter(i => i.isActive).length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Inactive', value: data.filter(i => !i.isActive).length, icon: <XCircle className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
  ], [data, ps.statusFilter]);

  const openCreate = () => { setEditingId(null); setFormData({ isActive: true }); setFormOpen(true); };
  const openEdit = (id: string) => {
    const item = data.find(i => i.id === id);
    if (item) { setEditingId(id); setFormData({ ...item }); setFormOpen(true); }
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await hrApi.updateLeavePolicy(editingId, formData);
        success('Policy updated');
      } else {
        await hrApi.createLeavePolicy(formData);
        success('Policy created');
      }
      setFormOpen(false);
      loadData();
    } catch (e: any) { error(e?.message || 'Failed to save'); }
  };

  const handleDelete = async (id: string) => {
    try { await hrApi.deleteLeavePolicy(id); success('Policy deleted'); loadData(); ps.closeModals(); }
    catch (e: any) { error(e?.message || 'Failed to delete'); }
  };

  const columns: Column<any>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'maxConsecutiveDays', label: 'Max Consecutive', sortable: true, className: 'text-center', render: (i) => `${i.maxConsecutiveDays || 0} days` },
    { key: 'accrualEnabled', label: 'Accrual', className: 'text-center', render: (i) => i.accrualEnabled ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-ink-300 mx-auto" /> },
    { key: 'allowHalfDay', label: 'Half Day', className: 'text-center', render: (i) => i.allowHalfDay ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-ink-300 mx-auto" /> },
    { key: 'requiresApproval', label: 'Approval Needed', className: 'text-center', render: (i) => i.requiresApproval ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-ink-300 mx-auto" /> },
    {
      key: 'isActive', label: 'Status', sortable: true, render: (i) => {
        const c = i.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400';
        return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${c}`}>{i.isActive ? 'Active' : 'Inactive'}</span>;
      },
    },
    {
      key: 'actions', label: '', render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => openEdit(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ), className: 'text-right',
    },
  ];

  const selectedItem = ps.viewDrawerId ? data.find(i => i.id === ps.viewDrawerId) : null;
  const { filtered, paginated } = ps;

  return (
    <HrPageShell title="Leave Policies" description="Configure organisation-wide leave policies"
      pageKey="leave-policies"
      headerActions={<>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> New Policy</button>
        <button onClick={() => exportToCsv(filtered, columns, 'leave-policies')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search policies..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'active', 'inactive']}
        onExportPdf={() => exportToPdf(filtered, columns, 'Leave Policies')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id} loading={loading}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No policies found" emptyAction={<button onClick={openCreate} className="text-xs font-medium text-primary hover:text-primary-hover">Create a policy</button>} />
      <HrFormModal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Edit Policy' : 'New Policy'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Policy Name *</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Max Consecutive Days</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.maxConsecutiveDays ?? 30} onChange={e => setFormData({...formData, maxConsecutiveDays: parseInt(e.target.value) || 0})} /></div>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Description</label><textarea className="w-full px-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" rows={2} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Min Days Before Request</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.minDaysBeforeRequest ?? 1} onChange={e => setFormData({...formData, minDaysBeforeRequest: parseInt(e.target.value) || 0})} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Max Carry Forward Days</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.maxCarryForwardDays ?? 10} onChange={e => setFormData({...formData, maxCarryForwardDays: parseInt(e.target.value) || 0})} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Approval Levels</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.approvalLevels ?? 1} onChange={e => setFormData({...formData, approvalLevels: parseInt(e.target.value) || 1})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Accrual Frequency</label>
              <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.accrualFrequency || 'monthly'} onChange={e => setFormData({...formData, accrualFrequency: e.target.value})}>
                <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
              </select></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Accrual Amount (days)</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.accrualAmount || 0} onChange={e => setFormData({...formData, accrualAmount: e.target.value})} /></div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" checked={!!formData.allowHalfDay} onChange={e => setFormData({...formData, allowHalfDay: e.target.checked})} /> Allow Half Day</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" checked={!!formData.allowCarryForward} onChange={e => setFormData({...formData, allowCarryForward: e.target.checked})} /> Allow Carry Forward</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" checked={!!formData.accrualEnabled} onChange={e => setFormData({...formData, accrualEnabled: e.target.checked})} /> Enable Accrual</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" checked={!!formData.requiresApproval} onChange={e => setFormData({...formData, requiresApproval: e.target.checked})} /> Requires Approval</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" checked={!!formData.requiresDocumentation} onChange={e => setFormData({...formData, requiresDocumentation: e.target.checked})} /> Requires Documentation</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" checked={!!formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} /> Active</label>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={handleSave}>{editingId ? 'Update' : 'Create'} Policy</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmDeleteId !== null} onClose={ps.closeModals} onConfirm={() => handleDelete(ps.confirmDeleteId!)} title="Delete Policy" message="Are you sure you want to delete this leave policy?" />
      <HrViewDrawer open={ps.viewDrawerId !== null} onClose={ps.closeModals} title="Policy Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Name</label><p className="text-sm font-medium text-ink-900">{selectedItem.name}</p></div>
          {selectedItem.description && <div><label className="text-xs text-ink-500">Description</label><p className="text-sm text-ink-700">{selectedItem.description}</p></div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Max Consecutive Days</label><p className="text-sm font-medium text-ink-900">{selectedItem.maxConsecutiveDays || 0}</p></div>
            <div><label className="text-xs text-ink-500">Min Days Before Request</label><p className="text-sm font-medium text-ink-900">{selectedItem.minDaysBeforeRequest || 0}</p></div>
            <div><label className="text-xs text-ink-500">Max Carry Forward</label><p className="text-sm font-medium text-ink-900">{selectedItem.maxCarryForwardDays || 0} days</p></div>
            <div><label className="text-xs text-ink-500">Approval Levels</label><p className="text-sm font-medium text-ink-900">{selectedItem.approvalLevels || 1}</p></div>
            <div><label className="text-xs text-ink-500">Accrual</label><p className="text-sm font-medium text-ink-900">{selectedItem.accrualEnabled ? `${selectedItem.accrualAmount || 0} days (${selectedItem.accrualFrequency || 'monthly'})` : 'Disabled'}</p></div>
            <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.isActive ? 'Active' : 'Inactive'}</p></div>
          </div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}
