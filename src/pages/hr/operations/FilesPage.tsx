import { useMemo } from 'react';
import { FolderOpen, Plus, Download, Upload, FileText, Edit3, Trash2, Eye, CheckCircle2 } from 'lucide-react';
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

interface FileItem { id: string; name: string; type: string; size: string; uploadedBy: string; date: string; status: string; }
const MOCK: FileItem[] = [
  { id: 'FL1', name: 'Employee_Handbook_2026.pdf', type: 'PDF', size: '2.4 MB', uploadedBy: 'Amara Nwachukwu', date: '2026-07-15', status: 'active' },
  { id: 'FL2', name: 'Payroll_Jul_2026.xlsx', type: 'Excel', size: '1.1 MB', uploadedBy: 'Funmi Lawal', date: '2026-07-28', status: 'active' },
  { id: 'FL3', name: 'Training_Calendar_Q3.docx', type: 'Word', size: '856 KB', uploadedBy: 'Kelechi Nwosu', date: '2026-07-20', status: 'active' },
  { id: 'FL4', name: 'Benefits_Summary_2026.pdf', type: 'PDF', size: '3.2 MB', uploadedBy: 'Amara Nwachukwu', date: '2026-07-10', status: 'active' },
  { id: 'FL5', name: 'Org_Chart_2026.png', type: 'Image', size: '412 KB', uploadedBy: 'Emeka Obi', date: '2026-06-30', status: 'active' },
  { id: 'FL6', name: 'Policy_Updates_Draft.docx', type: 'Word', size: '624 KB', uploadedBy: 'Zainab Abdullah', date: '2026-07-25', status: 'draft' },
  { id: 'FL7', name: 'Exit_Interview_Template.pdf', type: 'PDF', size: '1.8 MB', uploadedBy: 'Amara Nwachukwu', date: '2026-07-05', status: 'active' },
  { id: 'FL8', name: 'Onboarding_Checklist.xlsx', type: 'Excel', size: '512 KB', uploadedBy: 'Emeka Obi', date: '2026-07-01', status: 'active' },
  { id: 'FL9', name: 'Annual_Report_2025.pdf', type: 'PDF', size: '5.6 MB', uploadedBy: 'Funmi Lawal', date: '2026-06-15', status: 'archived' },
  { id: 'FL10', name: 'Team_Photo_2026.jpg', type: 'Image', size: '3.8 MB', uploadedBy: 'Segun Adebayo', date: '2026-07-22', status: 'active' },
];
export function OpsFilesPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'name', searchKeys: ['name', 'type', 'uploadedBy'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total Files', value: ps.filtered.length.toString(), icon: <FolderOpen className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: ps.filtered.filter(i => i.status === 'active').length.toString(), icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Drafts', value: ps.filtered.filter(i => i.status === 'draft').length.toString(), icon: <FileText className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [ps.filtered]);
  const columns: Column<FileItem>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-ink-400 shrink-0" /><span className="font-medium text-ink-900 truncate max-w-[250px]">{i.name}</span></div> },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'size', label: 'Size', sortable: true },
    { key: 'uploadedBy', label: 'Uploaded By', sortable: true },
    { key: 'date', label: 'Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.date)}</span> },
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
    <HrPageShell title="Files" description="Organisation and employee document repository with permissions and versioning."
      pageKey="letters"
      headerActions={<><button onClick={ps.openAddModal} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Upload File</button><button onClick={() => ps.setImportOpen(true)} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button></>}>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search files..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Draft', value: 'draft' }, { label: 'Archived', value: 'archived' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No files found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Upload your first file</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit File' : 'Upload File'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'File updated' : 'File uploaded'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">File Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">File</label><input type="file" className="block w-full text-sm text-ink-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('File deleted'); ps.closeConfirmDelete(); }} title="Delete File" message="Are you sure you want to delete this file? This action cannot be undone." confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="File Details"><div className="space-y-3 text-sm text-ink-600"><p>Details content</p></div></HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Files" onSubmit={(e) => { e.preventDefault(); showSuccess('Files imported'); ps.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file listing files to register.</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
      </HrFormModal>
    </HrPageShell>
  );
}


