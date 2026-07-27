import { useMemo } from 'react';
import { Heart, CalendarCheck, Clock, CheckCircle2, Plus, Download, FileText, Upload, Edit3, Trash2, Eye, Users } from 'lucide-react';
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

interface Activity {
  id: string;
  title: string;
  type: 'survey' | 'event' | 'workshop';
  department: string;
  date: string;
  participants: number;
  status: 'planned' | 'ongoing' | 'completed';
}

const MOCK: Activity[] = [
  { id: '1', title: 'Employee Satisfaction Survey', type: 'survey', department: 'All Departments', date: '2026-02-15', participants: 45, status: 'completed' },
  { id: '2', title: 'Team Building Retreat', type: 'event', department: 'Engineering', date: '2026-03-10', participants: 30, status: 'completed' },
  { id: '3', title: 'Leadership Workshop', type: 'workshop', department: 'Management', date: '2026-04-01', participants: 12, status: 'ongoing' },
  { id: '4', title: 'Quarterly Town Hall', type: 'event', department: 'All Departments', date: '2026-04-15', participants: 120, status: 'planned' },
  { id: '5', title: 'Diversity & Inclusion Survey', type: 'survey', department: 'All Departments', date: '2026-05-01', participants: 0, status: 'planned' },
  { id: '6', title: 'Mental Health Awareness Session', type: 'workshop', department: 'HR', date: '2026-05-10', participants: 25, status: 'ongoing' },
  { id: '7', title: 'Innovation Hackathon', type: 'event', department: 'Product', date: '2026-06-01', participants: 40, status: 'planned' },
  { id: '8', title: 'Performance Feedback Training', type: 'workshop', department: 'All Departments', date: '2026-03-20', participants: 55, status: 'completed' },
];

export function EmployeeEngagementPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'title', searchKeys: ['title', 'type', 'department'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total', value: MOCK.length, icon: <Heart className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Planned', value: MOCK.filter(i => i.status === 'planned').length, icon: <CalendarCheck className="w-4 h-4" />, color: 'purple' as const, active: ps.statusFilter === 'planned', onClick: () => ps.setStatusFilter('planned') },
    { label: 'Ongoing', value: MOCK.filter(i => i.status === 'ongoing').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'ongoing', onClick: () => ps.setStatusFilter('ongoing') },
    { label: 'Completed', value: MOCK.filter(i => i.status === 'completed').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
  ], [ps.statusFilter]);

  const columns: Column<Activity>[] = [
    { key: 'title', label: 'Activity', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.title}</span> },
    { key: 'type', label: 'Type', sortable: true, render: (i) => <span className="text-ink-600 capitalize">{i.type}</span> },
    { key: 'department', label: 'Department', render: (i) => <span className="text-ink-600">{i.department}</span> },
    { key: 'date', label: 'Date', sortable: true, render: (i) => <span className="text-ink-600">{formatDate(i.date)}</span> },
    { key: 'participants', label: 'Participants', sortable: true, render: (i) => <span className="text-ink-600">{i.participants}</span> },
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
    <HrPageShell title="Employee Engagement" description="Pulse surveys, employee recognition, engagement scores, and feedback analytics"
      pageKey="surveys"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Activity', 'Type', 'Department', 'Date', 'Participants', 'Status'], ps.filtered.map(i => [i.title, i.type, i.department, i.date, String(i.participants), i.status]), 'engagement-activities'); showSuccess('CSV exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Engagement Activities', ['Activity', 'Type', 'Department', 'Date', 'Participants', 'Status'], ps.filtered.map(i => [i.title, i.type, i.department, i.date, String(i.participants), i.status]), 'engagement-activities')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => ps.setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Upload className="w-3.5 h-3.5" /> Import</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Activity</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by title, type, or department..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Planned', value: 'planned' }, { label: 'Ongoing', value: 'ongoing' }, { label: 'Completed', value: 'completed' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      {ps.selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl">
          <span className="text-sm text-ink-600">{ps.selectedIds.length} selected</span>
          <button onClick={() => { showSuccess('Selected activities deleted'); ps.setSelectedIds([]); }} className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors">Delete Selected</button>
        </div>
      )}
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No activities found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first activity</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Activity' : 'Add Activity'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Activity updated' : 'Activity created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Title</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Type</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>survey</option><option>event</option><option>workshop</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Department</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Date</label><input type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Activity deleted'); ps.closeConfirmDelete(); }} title="Delete Activity" message="Are you sure you want to delete this engagement activity? This action cannot be undone." confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Activity Details">
        {ps.viewingId && (() => {
          const item = MOCK.find(i => i.id === ps.viewingId);
          if (!item) return null;
          return (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 p-4 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <div className="col-span-2"><span className="text-ink-400 text-xs block">Title</span><span className="font-medium text-ink-900">{item.title}</span></div>
                <div><span className="text-ink-400 text-xs block">Type</span><span className="font-medium text-ink-900 capitalize">{item.type}</span></div>
                <div><span className="text-ink-400 text-xs block">Department</span><span className="font-medium text-ink-900">{item.department}</span></div>
                <div><span className="text-ink-400 text-xs block">Date</span><span className="font-medium text-ink-900">{formatDate(item.date)}</span></div>
                <div><span className="text-ink-400 text-xs block">Participants</span><span className="font-medium text-ink-900">{item.participants}</span></div>
                <div className="col-span-2"><span className="text-ink-400 text-xs block">Status</span><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(item.status)}`}>{item.status}</span></div>
              </div>
            </div>
          );
        })()}
      </HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Activities" onSubmit={(e) => { e.preventDefault(); showSuccess('Activities imported'); ps.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file to import engagement activities.</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors" />
      </HrFormModal>
    </HrPageShell>
  );
}


