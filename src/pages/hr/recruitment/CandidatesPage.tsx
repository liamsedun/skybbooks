import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Download, Upload, FileText, Search, Edit3, Trash2, Eye, CheckCircle2, XCircle, Clock, UserPlus } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor, formatDate, handleFileUpload, parseCsv } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';

interface Candidate {
  id: string; name: string; email: string; phone: string; position: string; department: string; source: string; appliedDate: string; status: string;
}

const MOCK: Candidate[] = [
  { id: 'C001', name: 'Chioma Okafor', email: 'chioma@example.com', phone: '+234 801 234 5678', position: 'Senior Accountant', department: 'Finance', source: 'LinkedIn', appliedDate: '2026-07-20', status: 'new' },
  { id: 'C002', name: 'Segun Adebayo', email: 'segun@example.com', phone: '+234 802 345 6789', position: 'Software Engineer', department: 'Engineering', source: 'Referral', appliedDate: '2026-07-19', status: 'screening' },
  { id: 'C003', name: 'Amina Bello', email: 'amina@example.com', phone: '+234 803 456 7890', position: 'HR Manager', department: 'Human Resources', source: 'Indeed', appliedDate: '2026-07-18', status: 'interview' },
  { id: 'C004', name: 'Tunde Bakare', email: 'tunde@example.com', phone: '+234 804 567 8901', position: 'Graphic Designer', department: 'Marketing', source: 'Company Website', appliedDate: '2026-07-17', status: 'interview' },
  { id: 'C005', name: 'Ngozi Eze', email: 'ngozi@example.com', phone: '+234 805 678 9012', position: 'Sales Representative', department: 'Sales', source: 'LinkedIn', appliedDate: '2026-07-16', status: 'offer' },
  { id: 'C006', name: 'Femi Ogunlade', email: 'femi@example.com', phone: '+234 806 789 0123', position: 'Data Analyst', department: 'Engineering', source: 'Referral', appliedDate: '2026-07-15', status: 'screening' },
  { id: 'C007', name: 'Zainab Abdullah', email: 'zainab@example.com', phone: '+234 807 890 1234', position: 'Customer Support Lead', department: 'Support', source: 'Indeed', appliedDate: '2026-07-14', status: 'rejected' },
  { id: 'C008', name: 'Chinedu Okonkwo', email: 'chinedu@example.com', phone: '+234 808 901 2345', position: 'Senior Accountant', department: 'Finance', source: 'JobFair', appliedDate: '2026-07-13', status: 'new' },
  { id: 'C009', name: 'Yemi Lawson', email: 'yemi@example.com', phone: '+234 809 012 3456', position: 'Software Engineer', department: 'Engineering', source: 'Agency', appliedDate: '2026-07-12', status: 'hired' },
  { id: 'C010', name: 'Adaeze Obi', email: 'adaeze@example.com', phone: '+234 810 123 4567', position: 'HR Manager', department: 'Human Resources', source: 'LinkedIn', appliedDate: '2026-07-11', status: 'interview' },
];

export function CandidatesPage() {
  const navigate = useNavigate();
  const { success } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'name', searchKeys: ['name', 'email', 'position', 'department'], pageSize: 10 });
  const { filtered, paginated } = ps;
  const [localData, setLocalData] = useState<Candidate[]>(MOCK);

  const stats = useMemo(() => [
    { label: 'Total Candidates', value: localData.length, icon: <Users className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'New', value: localData.filter(i => i.status === 'new').length, icon: <UserPlus className="w-4 h-4" />, color: 'cyan' as const, active: ps.statusFilter === 'new', onClick: () => ps.setStatusFilter('new') },
    { label: 'Interview', value: localData.filter(i => i.status === 'interview').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'interview', onClick: () => ps.setStatusFilter('interview') },
    { label: 'Hired', value: localData.filter(i => i.status === 'hired').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'hired', onClick: () => ps.setStatusFilter('hired') },
  ], [localData, ps.statusFilter]);

  const columns: Column<Candidate>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'email', label: 'Email', sortable: true, render: (i) => <span className="text-ink-500">{i.email}</span> },
    { key: 'position', label: 'Position', sortable: true },
    { key: 'department', label: 'Department', sortable: true, hideOnMobile: true },
    { key: 'source', label: 'Source', sortable: true, hideOnMobile: true },
    { key: 'appliedDate', label: 'Applied', sortable: true, render: (i) => <span className="text-ink-400 text-xs">{formatDate(i.appliedDate)}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (i) => (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span>
    )},
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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const text = await handleFileUpload(e);
      const rows = parseCsv(text);
      success(`Imported ${rows.length - 1} candidates`);
      ps.setImportOpen(false);
    } catch { /* ignore */ }
  };

  return (
    <HrPageShell title="Candidates" description="Track and manage job applicants through the recruitment pipeline"
      pageKey="candidates"
      headerActions={<>
        <button onClick={() => navigate('/app/hr/recruitment/candidates/add')} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Add Candidate</button>
        <button onClick={() => ps.setImportOpen(true)} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Import</button>
        <button onClick={() => exportToCsv(['Name', 'Email', 'Phone', 'Position', 'Department', 'Source', 'Applied Date', 'Status'], filtered.map(i => [i.name, i.email, i.phone, i.position, i.department, i.source, i.appliedDate, i.status]), 'candidates')} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by name, email, position..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'New', value: 'new' }, { label: 'Screening', value: 'screening' }, { label: 'Interview', value: 'interview' }, { label: 'Offer', value: 'offer' }, { label: 'Hired', value: 'hired' }, { label: 'Rejected', value: 'rejected' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No candidates found" emptyAction={<button onClick={() => navigate('/app/hr/recruitment/candidates/add')} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first candidate</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Candidate' : 'Add Candidate'} onSubmit={(e) => { e.preventDefault(); success(ps.editingId ? 'Candidate updated' : 'Candidate created'); ps.closeModal(); }}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Full Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.name ?? ''} placeholder="e.g. Chioma Okafor" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Email</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.email ?? ''} placeholder="e.g. chioma@example.com" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Phone</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.phone ?? ''} placeholder="e.g. +234 801 234 5678" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Position</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.position ?? ''} placeholder="e.g. Senior Accountant" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Department</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.department ?? ''} /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label>
            <select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.status ?? 'new'}>
              <option value="new">New</option><option value="screening">Screening</option><option value="interview">Interview</option><option value="offer">Offer</option><option value="hired">Hired</option><option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { success('Candidate deleted'); ps.closeConfirmDelete(); }} title="Delete Candidate" message="Are you sure you want to delete this candidate record?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Candidate Details">
        {selectedItem && <div className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-border-custom">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">{selectedItem.name.charAt(0)}</div>
            <div><p className="text-sm font-semibold text-ink-900">{selectedItem.name}</p><p className="text-xs text-ink-400">{selectedItem.email}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Phone</label><p className="text-sm font-medium text-ink-900">{selectedItem.phone}</p></div>
            <div><label className="text-xs text-ink-500">Position</label><p className="text-sm font-medium text-ink-900">{selectedItem.position}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Department</label><p className="text-sm font-medium text-ink-900">{selectedItem.department}</p></div>
            <div><label className="text-xs text-ink-500">Source</label><p className="text-sm font-medium text-ink-900">{selectedItem.source}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Applied Date</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.appliedDate)}</p></div>
            <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
          </div>
        </div>}
      </HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Candidates" onSubmit={(e) => { e.preventDefault(); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file with candidate records (Name, Email, Phone, Position, Department, Source, Status).</p>
        <input type="file" accept=".csv" onChange={handleImport} className="block w-full text-sm text-ink-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
      </HrFormModal>
    </HrPageShell>
  );
}


