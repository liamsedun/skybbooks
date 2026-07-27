import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus, Download, Upload, FileText, Search, Edit3, Trash2, Eye, CheckCircle2, XCircle, Clock } from 'lucide-react';
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

interface JobOpening {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'Full-time' | 'Part-time' | 'Contract';
  applicants: number;
  status: 'open' | 'closed' | 'draft';
}

const MOCK: JobOpening[] = [
  { id: 'J001', title: 'Senior Accountant', department: 'Finance', location: 'Lagos', type: 'Full-time', applicants: 12, status: 'open' },
  { id: 'J002', title: 'Software Engineer', department: 'Engineering', location: 'Abuja', type: 'Full-time', applicants: 24, status: 'open' },
  { id: 'J003', title: 'HR Manager', department: 'Human Resources', location: 'Lagos', type: 'Full-time', applicants: 8, status: 'open' },
  { id: 'J004', title: 'Graphic Designer', department: 'Marketing', location: 'Remote', type: 'Contract', applicants: 15, status: 'open' },
  { id: 'J005', title: 'Administrative Assistant', department: 'Admin', location: 'Port Harcourt', type: 'Part-time', applicants: 5, status: 'draft' },
  { id: 'J006', title: 'Sales Representative', department: 'Sales', location: 'Lagos', type: 'Full-time', applicants: 0, status: 'draft' },
  { id: 'J007', title: 'Data Analyst', department: 'Engineering', location: 'Abuja', type: 'Contract', applicants: 7, status: 'closed' },
  { id: 'J008', title: 'Customer Support Lead', department: 'Support', location: 'Remote', type: 'Full-time', applicants: 3, status: 'closed' },
];

export function JobOpeningsPage() {
  const { success } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'title', searchKeys: ['title', 'department', 'location'], pageSize: 10 });
  const { filtered, paginated } = ps;
  const [localData, setLocalData] = useState<JobOpening[]>(MOCK);

  const stats = useMemo(() => [
    { label: 'Total Jobs', value: localData.length, icon: <Briefcase className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Open', value: localData.filter(i => i.status === 'open').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'open', onClick: () => ps.setStatusFilter('open') },
    { label: 'Closed', value: localData.filter(i => i.status === 'closed').length, icon: <XCircle className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'closed', onClick: () => ps.setStatusFilter('closed') },
    { label: 'Draft', value: localData.filter(i => i.status === 'draft').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [localData, ps.statusFilter]);

  const columns: Column<JobOpening>[] = [
    {
      key: 'title', label: 'Job Title', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.title}</span>,
    },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'location', label: 'Location', sortable: true },
    { key: 'type', label: 'Type', sortable: true, className: 'text-center' },
    { key: 'applicants', label: 'Applicants', sortable: true, className: 'text-center' },
    {
      key: 'status', label: 'Status', sortable: true, render: (i) => {
        const colors: Record<string, string> = { open: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', closed: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400', draft: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' };
        return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[i.status]}`}>{i.status}</span>;
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
    <HrPageShell title="Job Openings" description="Manage job openings and track applicants"
      pageKey="jobs"
      headerActions={<>
        <button onClick={() => ps.openAddModal()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> New Job</button>
        <button onClick={() => exportToCsv(filtered, columns, 'job-openings')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by title, department or location..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'open', 'closed', 'draft']}
        onExportPdf={() => exportToPdf(filtered, columns, 'Job Openings')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No job openings found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Create a job opening</button>} />
      <HrFormModal open={ps.addModalOpen || ps.editModalOpen} onClose={ps.closeModals} title={ps.editModalOpen ? 'Edit Job Opening' : 'New Job Opening'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Job Title</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.title ?? ''} placeholder="e.g. Senior Accountant" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Department</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.department ?? ''} placeholder="e.g. Finance" /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Location</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.location ?? ''} placeholder="e.g. Lagos" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Type</label>
              <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.type ?? 'Full-time'}>
                <option>Full-time</option><option>Part-time</option><option>Contract</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Status</label>
              <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.status ?? 'draft'}>
                <option value="open">Open</option><option value="closed">Closed</option><option value="draft">Draft</option>
              </select>
            </div>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { success(ps.editModalId ? 'Job opening updated' : 'Job opening created'); ps.closeModals(); }}>{ps.editModalId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmDeleteId !== null} onClose={ps.closeModals} onConfirm={() => { ps.confirmDelete(); success('Job opening deleted'); }} title="Delete Job Opening" message="Are you sure you want to delete this job opening? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerId !== null} onClose={ps.closeModals} title="Job Opening Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Job Title</label><p className="text-sm font-medium text-ink-900">{selectedItem.title}</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Department</label><p className="text-sm font-medium text-ink-900">{selectedItem.department}</p></div>
            <div><label className="text-xs text-ink-500">Location</label><p className="text-sm font-medium text-ink-900">{selectedItem.location}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Type</label><p className="text-sm font-medium text-ink-900">{selectedItem.type}</p></div>
            <div><label className="text-xs text-ink-500">Applicants</label><p className="text-sm font-medium text-ink-900">{selectedItem.applicants}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}


