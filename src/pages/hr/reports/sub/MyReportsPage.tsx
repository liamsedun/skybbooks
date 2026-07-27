import { useState, useMemo } from 'react';
import { FileBarChart, Plus, Download, FileText, Edit3, Trash2, Eye, Clock, Calendar, Archive } from 'lucide-react';
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

interface Report {
  id: string;
  name: string;
  type: string;
  lastRun: string;
  createdBy: string;
  status: 'active' | 'scheduled' | 'draft' | 'archived';
}

const MOCK: Report[] = [
  { id: 'RPT-001', name: 'Monthly Headcount Summary', type: 'Headcount', lastRun: '2026-07-01', createdBy: 'Amara Okafor', status: 'active' },
  { id: 'RPT-002', name: 'Q2 Turnover Analysis', type: 'Turnover', lastRun: '2026-06-30', createdBy: 'Chidi Nwosu', status: 'active' },
  { id: 'RPT-003', name: 'Department Salary Budget', type: 'Compensation', lastRun: '2026-06-15', createdBy: 'Fatima Usman', status: 'scheduled' },
  { id: 'RPT-004', name: 'Leave Utilization Report', type: 'Leave', lastRun: '2026-07-10', createdBy: 'Yetunde Bello', status: 'scheduled' },
  { id: 'RPT-005', name: 'Training Completion Rates', type: 'Training', lastRun: '2026-05-20', createdBy: 'Emeka Eze', status: 'draft' },
  { id: 'RPT-006', name: 'Performance Review Summary', type: 'Performance', lastRun: '2026-04-01', createdBy: 'Ngozi Obi', status: 'draft' },
  { id: 'RPT-007', name: '2025 Annual HR Report', type: 'Annual', lastRun: '2026-01-15', createdBy: 'Ibrahim Danjuma', status: 'archived' },
  { id: 'RPT-008', name: 'Benefits Enrollment Stats', type: 'Benefits', lastRun: '2025-12-01', createdBy: 'Segun Adeyemi', status: 'archived' },
];

export function MyReportsPage() {
  const { success } = useToast();
  const [localData, setLocalData] = useState<Report[]>(MOCK);
  const ps = useHrPageState({ data: localData, initialSortKey: 'name', searchKeys: ['name', 'type', 'createdBy'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const stats = useMemo(() => [
    { label: 'Total Reports', value: localData.length, icon: <FileBarChart className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: localData.filter(i => i.status === 'active' || i.status === 'scheduled').length, icon: <Calendar className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'scheduled', onClick: () => ps.setStatusFilter('scheduled') },
    { label: 'Draft', value: localData.filter(i => i.status === 'draft').length, icon: <FileText className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
    { label: 'Archived', value: localData.filter(i => i.status === 'archived').length, icon: <Archive className="w-4 h-4" />, color: 'slate' as const, active: ps.statusFilter === 'archived', onClick: () => ps.setStatusFilter('archived') },
  ], [localData, ps.statusFilter]);

  const handleDelete = (id: string) => {
    setLocalData(prev => prev.filter(i => i.id !== id));
    ps.closeConfirmDelete();
    success('Report deleted');
  };

  const columns: Column<Report>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'type', label: 'Type', sortable: true, render: (i) => <span className="text-xs font-medium text-ink-500 bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded-full">{i.type}</span> },
    { key: 'lastRun', label: 'Last Run', sortable: true, render: (i) => formatDate(i.lastRun) },
    { key: 'createdBy', label: 'Created By', sortable: true },
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

  const csvHeaders = ['Name', 'Type', 'Last Run', 'Created By', 'Status'];
  const csvRows = filtered.map(i => [i.name, i.type, formatDate(i.lastRun), i.createdBy, i.status]);
  const pdfHeaders = csvHeaders;
  const pdfRows = csvRows;

  return (
    <HrPageShell title="My Reports" description="Personalised HR reports tailored to your role and access permissions"
      pageKey="reports"
      headerActions={<>
        <button onClick={() => { exportToCsv(csvHeaders, csvRows, 'my-reports'); success('CSV exported'); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> CSV</button>
        <button onClick={() => exportToPdf('My Reports', pdfHeaders, pdfRows, 'my-reports')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><FileText className="w-3.5 h-3.5" /> PDF</button>
        <button onClick={ps.openAddModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> Add New</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search reports..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'active', 'scheduled', 'draft', 'archived']}
        onExportPdf={() => exportToPdf('My Reports', pdfHeaders, pdfRows, 'my-reports')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No reports found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Create a report</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Report' : 'New Report'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Report Name</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.name ?? ''} /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Type</label>
            <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.type ?? ''}>
              <option>Headcount</option><option>Turnover</option><option>Compensation</option><option>Leave</option><option>Training</option><option>Performance</option><option>Benefits</option>
            </select>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Status</label>
            <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.status ?? 'draft'}>
              <option value="active">Active</option><option value="scheduled">Scheduled</option><option value="draft">Draft</option><option value="archived">Archived</option>
            </select>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { success(ps.editingId ? 'Report updated' : 'Report created'); ps.closeModal(); }}>{ps.editingId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => handleDelete(ps.deletingId!)} title="Delete Report" message="Are you sure you want to delete this report? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Report Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Name</label><p className="text-sm font-medium text-ink-900">{selectedItem.name}</p></div>
          <div><label className="text-xs text-ink-500">Type</label><p className="text-sm font-medium text-ink-900">{selectedItem.type}</p></div>
          <div><label className="text-xs text-ink-500">Last Run</label><p className="text-sm text-ink-700">{formatDate(selectedItem.lastRun)}</p></div>
          <div><label className="text-xs text-ink-500">Created By</label><p className="text-sm text-ink-700">{selectedItem.createdBy}</p></div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}


