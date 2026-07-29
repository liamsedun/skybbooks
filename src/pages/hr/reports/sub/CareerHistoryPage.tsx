import { useState, useMemo, useEffect } from 'react';
import { History, Plus, Download, FileText, Edit3, Trash2, Eye, TrendingUp, ArrowLeftRight, ArrowDown } from 'lucide-react';
import { useHrPageState } from '../../../../hooks/useHrPageState';
import { HrPageShell } from '../../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor, formatDate } from '../../../../lib/hrExport';
import { useToast } from '../../../../contexts/ToastContext';
import { hrApi } from '../../../../lib/api';

interface CareerRecord {
  id: string;
  employeeName: string;
  previousRole: string;
  newRole: string;
  effectiveDate: string;
  type: 'promotion' | 'transfer' | 'demotion';
  status: 'completed' | 'pending';
}

const typeIcon: Record<string, React.ReactNode> = {
  promotion: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />,
  transfer: <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />,
  demotion: <ArrowDown className="w-3.5 h-3.5 text-rose-500" />,
};

const typeColors: Record<string, string> = {
  promotion: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  transfer: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  demotion: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
};

export function CareerHistoryPage() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data: [], initialSortKey: 'employeeName', searchKeys: ['employeeName', 'previousRole', 'newRole', 'type'], pageSize: 10 });
  const { filtered, paginated } = ps;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await hrApi.getReportEmployees({});
      setData(Array.isArray(result) ? result : []);
    } catch (e: any) { toast(e?.message || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => [
    { label: 'Total Records', value: data.length, icon: <History className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Promotions', value: data.filter((i: any) => i.type === 'promotion').length, icon: <TrendingUp className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'promotion', onClick: () => ps.setStatusFilter('promotion') },
    { label: 'Transfers', value: data.filter((i: any) => i.type === 'transfer').length, icon: <ArrowLeftRight className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'transfer', onClick: () => ps.setStatusFilter('transfer') },
    { label: 'Demotions', value: data.filter((i: any) => i.type === 'demotion').length, icon: <ArrowDown className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'demotion', onClick: () => ps.setStatusFilter('demotion') },
  ], [data, ps.statusFilter]);

  const handleDelete = (id: string) => {
    toast('This is a read-only report view', 'error');
    ps.closeConfirmDelete();
  };

  const columns: Column<CareerRecord>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'previousRole', label: 'Previous Role', sortable: true, render: (i) => <span className="text-ink-500">{i.previousRole}</span> },
    { key: 'newRole', label: 'New Role', sortable: true, render: (i) => <span className="font-medium text-ink-800">{i.newRole}</span> },
    { key: 'effectiveDate', label: 'Effective Date', sortable: true, render: (i) => formatDate(i.effectiveDate) },
    { key: 'type', label: 'Type', sortable: true, render: (i) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${typeColors[i.type]}`}>
        {typeIcon[i.type]} {i.type}
      </span>
    ) },
    { key: 'status', label: 'Status', sortable: true, render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const selectedItem = ps.viewingId ? filtered.find(i => i.id === ps.viewingId) : null;
  const editItem = ps.editingId ? filtered.find(i => i.id === ps.editingId) : null;

  const csvHeaders = ['Employee', 'Previous Role', 'New Role', 'Effective Date', 'Type', 'Status'];
  const csvRows = filtered.map(i => [i.employeeName, i.previousRole, i.newRole, formatDate(i.effectiveDate), i.type, i.status]);
  const pdfHeaders = csvHeaders;
  const pdfRows = csvRows;

  return (
    <HrPageShell title="Career History" description="Employee career progression, promotions, transfers, and role change timeline"
      pageKey="reports"
      headerActions={<>
        <button onClick={() => { exportToCsv(csvHeaders, csvRows, 'career-history'); toast('CSV exported', 'success'); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> CSV</button>
        <button onClick={() => exportToPdf('Career History', pdfHeaders, pdfRows, 'career-history')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><FileText className="w-3.5 h-3.5" /> PDF</button>
        <button onClick={ps.openAddModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> Add Record</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees or roles..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'promotion', 'transfer', 'demotion']}
        onExportPdf={() => exportToPdf('Career History', pdfHeaders, pdfRows, 'career-history')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No career history found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add career record</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Career Record' : 'New Career Record'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee Name</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.employeeName ?? ''} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Previous Role</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.previousRole ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">New Role</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.newRole ?? ''} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Effective Date</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.effectiveDate ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Type</label>
              <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.type ?? 'promotion'}>
                <option value="promotion">Promotion</option><option value="transfer">Transfer</option><option value="demotion">Demotion</option>
              </select>
            </div>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { toast('This is a read-only report view', 'error'); ps.closeModal(); }}>{ps.editingId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => handleDelete(ps.deletingId!)} title="Delete Career Record" message="Are you sure you want to delete this career record? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Career Record Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Employee</label><p className="text-sm font-medium text-ink-900">{selectedItem.employeeName}</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Previous Role</label><p className="text-sm text-ink-700">{selectedItem.previousRole}</p></div>
            <div><label className="text-xs text-ink-500">New Role</label><p className="text-sm font-medium text-ink-900">{selectedItem.newRole}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Effective Date</label><p className="text-sm text-ink-700">{formatDate(selectedItem.effectiveDate)}</p></div>
          <div><label className="text-xs text-ink-500">Type</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.type}</p></div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}


