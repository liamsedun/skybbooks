import { useMemo } from 'react';
import { FileText, User, Calendar, FileSignature, Plus, Download, FileText as FileTextIcon, Edit3, Trash2, Eye } from 'lucide-react';
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

interface Letter {
  id: string; employeeName: string; type: string;
  issueDate: string; status: string;
}

const MOCK: Letter[] = [
  { id: 'ltr-1', employeeName: 'John Doe', type: 'Offer Letter', issueDate: '2026-07-15', status: 'issued' },
  { id: 'ltr-2', employeeName: 'Jane Smith', type: 'Promotion Letter', issueDate: '2026-07-20', status: 'issued' },
  { id: 'ltr-3', employeeName: 'Mike Wilson', type: 'Confirmation Letter', issueDate: '2026-08-01', status: 'draft' },
  { id: 'ltr-4', employeeName: 'Sarah Davis', type: 'Warning Letter', issueDate: '2026-07-10', status: 'issued' },
  { id: 'ltr-5', employeeName: 'Emily Taylor', type: 'Resignation Acceptance', issueDate: '2026-07-25', status: 'issued' },
  { id: 'ltr-6', employeeName: 'Chris Martin', type: 'Transfer Letter', issueDate: '2026-08-05', status: 'draft' },
  { id: 'ltr-7', employeeName: 'Lisa Anderson', type: 'Salary Revision Letter', issueDate: '2026-07-30', status: 'issued' },
  { id: 'ltr-8', employeeName: 'Tom Harris', type: 'Offer Letter', issueDate: '2026-08-10', status: 'draft' },
  { id: 'ltr-9', employeeName: 'Nancy Moore', type: 'Experience Letter', issueDate: '2026-07-05', status: 'issued' },
  { id: 'ltr-10', employeeName: 'Oscar White', type: 'Internship Certificate', issueDate: '2026-08-12', status: 'draft' },
];

export function LettersPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'type'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total', value: MOCK.length, icon: <FileText className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Issued', value: MOCK.filter(i => i.status === 'issued').length, icon: <FileSignature className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'issued', onClick: () => ps.setStatusFilter('issued') },
    { label: 'Draft', value: MOCK.filter(i => i.status === 'draft').length, icon: <Calendar className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [ps.statusFilter]);
  const columns: Column<Letter>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'issueDate', label: 'Issue Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.issueDate)}</span> },
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
    <HrPageShell title="HR Letters" description="Manage employee letters and documents"
      pageKey="letters"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee','Type','Issue Date','Status'], ps.filtered.map(i => [i.employeeName,i.type,i.issueDate,i.status]), 'letters'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('HR Letters', ['Employee','Type','Issue Date','Status'], ps.filtered.map(i => [i.employeeName,i.type,i.issueDate,i.status]), 'letters')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileTextIcon className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search letters..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Issued', value: 'issued' }, { label: 'Draft', value: 'draft' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No letters" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Letter' : 'Add Letter'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Updated' : 'Created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. John Doe" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Letter Type</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>Offer Letter</option><option>Promotion Letter</option><option>Confirmation Letter</option><option>Warning Letter</option><option>Resignation Acceptance</option><option>Transfer Letter</option><option>Salary Revision Letter</option><option>Experience Letter</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Issue Date</label><input type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="draft">Draft</option><option value="issued">Issued</option></select></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Deleted'); ps.closeConfirmDelete(); }} title="Delete Letter" message="Are you sure you want to delete this letter?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Letter Details">
        {ps.viewingId && (() => { const l = MOCK.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center"><FileText className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{l.employeeName}</p><p className="text-xs text-ink-400">{l.type}</p></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Issue Date</p><p className="text-sm text-ink-700 mt-1">{formatDate(l.issueDate)}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(l.status)}`}>{l.status}</span></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}


