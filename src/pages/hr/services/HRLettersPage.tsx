import { useMemo } from 'react';
import { FileText, ScrollText, Plus, Download, FileText as FilePdf, Upload, Edit3, Trash2, Eye, Building2, Users } from 'lucide-react';
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

interface LetterTemplate {
  id: string;
  name: string;
  type: 'offer' | 'appointment' | 'confirmation' | 'warning' | 'experience';
  department: string;
  lastUsed: string;
  status: 'active' | 'inactive';
}

const MOCK: LetterTemplate[] = [
  { id: '1', name: 'Offer of Employment', type: 'offer', department: 'All Departments', lastUsed: '2026-04-01', status: 'active' },
  { id: '2', name: 'Appointment Letter - Permanent', type: 'appointment', department: 'HR', lastUsed: '2026-03-28', status: 'active' },
  { id: '3', name: 'Confirmation of Employment', type: 'confirmation', department: 'All Departments', lastUsed: '2026-03-15', status: 'active' },
  { id: '4', name: 'Warning Letter - Performance', type: 'warning', department: 'Management', lastUsed: '2026-02-20', status: 'active' },
  { id: '5', name: 'Experience Letter', type: 'experience', department: 'All Departments', lastUsed: '2026-04-05', status: 'active' },
  { id: '6', name: 'Offer Letter - Internship', type: 'offer', department: 'Engineering', lastUsed: '2026-03-10', status: 'active' },
  { id: '7', name: 'Appointment Letter - Contract', type: 'appointment', department: 'Finance', lastUsed: '2026-02-28', status: 'inactive' },
  { id: '8', name: 'Warning Letter - Conduct', type: 'warning', department: 'All Departments', lastUsed: '2026-01-15', status: 'active' },
];

function LetterTypeIcon({ type }: { type: string }) {
  const map: Record<string, string> = {
    offer: 'text-emerald-500', appointment: 'text-blue-500', confirmation: 'text-purple-500',
    warning: 'text-amber-500', experience: 'text-cyan-500',
  };
  return <ScrollText className={`w-4 h-4 ${map[type] || 'text-ink-400'}`} />;
}

export function HRLettersPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'name', searchKeys: ['name', 'type', 'department'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total', value: MOCK.length, icon: <FileText className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Offer', value: MOCK.filter(i => i.type === 'offer').length, icon: <FileText className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'offer', onClick: () => ps.setStatusFilter('offer') },
    { label: 'Appointment', value: MOCK.filter(i => i.type === 'appointment').length, icon: <Building2 className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'appointment', onClick: () => ps.setStatusFilter('appointment') },
    { label: 'Experience', value: MOCK.filter(i => i.type === 'experience').length, icon: <Users className="w-4 h-4" />, color: 'cyan' as const, active: ps.statusFilter === 'experience', onClick: () => ps.setStatusFilter('experience') },
  ], [ps.statusFilter]);

  const columns: Column<LetterTemplate>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => (
      <span className="inline-flex items-center gap-2 font-medium text-ink-900">
        <LetterTypeIcon type={i.type} />
        {i.name}
      </span>
    )},
    { key: 'type', label: 'Type', sortable: true, render: (i) => <span className="inline-flex items-center gap-1.5 text-ink-600 capitalize"><LetterTypeIcon type={i.type} />{i.type}</span> },
    { key: 'department', label: 'Department', render: (i) => <span className="text-ink-600">{i.department}</span> },
    { key: 'lastUsed', label: 'Last Used', sortable: true, render: (i) => <span className="text-ink-600">{formatDate(i.lastUsed)}</span> },
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
    <HrPageShell title="HR Letters" description="Generate and manage bonafide letters, experience letters, offer letters, and other HR documents"
      pageKey="letters"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Name', 'Type', 'Department', 'Last Used', 'Status'], ps.filtered.map(i => [i.name, i.type, i.department, i.lastUsed, i.status]), 'hr-letters'); showSuccess('CSV exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('HR Letters', ['Name', 'Type', 'Department', 'Last Used', 'Status'], ps.filtered.map(i => [i.name, i.type, i.department, i.lastUsed, i.status]), 'hr-letters')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FilePdf className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => ps.setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Upload className="w-3.5 h-3.5" /> Import</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Template</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by name, type, or department..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Offer', value: 'offer' }, { label: 'Appointment', value: 'appointment' }, { label: 'Confirmation', value: 'confirmation' }, { label: 'Warning', value: 'warning' }, { label: 'Experience', value: 'experience' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      {ps.selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl">
          <span className="text-sm text-ink-600">{ps.selectedIds.length} selected</span>
          <button onClick={() => { showSuccess('Selected templates deleted'); ps.setSelectedIds([]); }} className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors">Delete Selected</button>
        </div>
      )}
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No letter templates found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first template</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Template' : 'Add Template'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Template updated' : 'Template created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Template Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Type</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>offer</option><option>appointment</option><option>confirmation</option><option>warning</option><option>experience</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Department</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Content</label><textarea rows={6} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Template deleted'); ps.closeConfirmDelete(); }} title="Delete Template" message="Are you sure you want to delete this letter template? This action cannot be undone." confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Template Details">
        {ps.viewingId && (() => {
          const item = MOCK.find(i => i.id === ps.viewingId);
          if (!item) return null;
          return (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 p-4 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <div className="col-span-2"><span className="text-ink-400 text-xs block">Name</span><span className="font-medium text-ink-900">{item.name}</span></div>
                <div><span className="text-ink-400 text-xs block">Type</span><span className="font-medium text-ink-900 capitalize">{item.type}</span></div>
                <div><span className="text-ink-400 text-xs block">Department</span><span className="font-medium text-ink-900">{item.department}</span></div>
                <div><span className="text-ink-400 text-xs block">Last Used</span><span className="font-medium text-ink-900">{formatDate(item.lastUsed)}</span></div>
                <div><span className="text-ink-400 text-xs block">Status</span><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(item.status)}`}>{item.status}</span></div>
              </div>
            </div>
          );
        })()}
      </HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Templates" onSubmit={(e) => { e.preventDefault(); showSuccess('Templates imported'); ps.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file to import letter templates.</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors" />
      </HrFormModal>
    </HrPageShell>
  );
}


