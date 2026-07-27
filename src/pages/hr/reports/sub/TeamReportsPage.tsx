import { useState, useMemo } from 'react';
import { Users, Plus, Download, FileText, Edit3, Trash2, Eye, Star, Briefcase, CheckCircle2, TrendingUp } from 'lucide-react';
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

interface TeamReport {
  id: string;
  teamName: string;
  lead: string;
  members: number;
  avgRating: number;
  completedProjects: number;
  status: 'active' | 'below_target' | 'under_review';
}

const MOCK: TeamReport[] = [
  { id: 'TM-001', teamName: 'Frontend Engineering', lead: 'Amara Okafor', members: 8, avgRating: 4.5, completedProjects: 12, status: 'active' },
  { id: 'TM-002', teamName: 'Backend Engineering', lead: 'Emeka Eze', members: 6, avgRating: 4.2, completedProjects: 10, status: 'active' },
  { id: 'TM-003', teamName: 'Finance & Accounting', lead: 'Chidi Nwosu', members: 5, avgRating: 4.8, completedProjects: 8, status: 'active' },
  { id: 'TM-004', teamName: 'Marketing & Brand', lead: 'Fatima Usman', members: 4, avgRating: 3.9, completedProjects: 6, status: 'active' },
  { id: 'TM-005', teamName: 'HR & Admin', lead: 'Yetunde Bello', members: 3, avgRating: 4.6, completedProjects: 5, status: 'active' },
  { id: 'TM-006', teamName: 'Operations & Logistics', lead: 'Segun Adeyemi', members: 7, avgRating: 3.2, completedProjects: 4, status: 'below_target' },
  { id: 'TM-007', teamName: 'Legal & Compliance', lead: 'Ngozi Obi', members: 2, avgRating: 4.9, completedProjects: 3, status: 'active' },
  { id: 'TM-008', teamName: 'Customer Success', lead: 'Chioma Adeleke', members: 5, avgRating: 3.5, completedProjects: 7, status: 'under_review' },
];

export function TeamReportsPage() {
  const { success } = useToast();
  const [localData, setLocalData] = useState<TeamReport[]>(MOCK);
  const ps = useHrPageState({ data: localData, initialSortKey: 'teamName', searchKeys: ['teamName', 'lead'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const stats = useMemo(() => [
    { label: 'Total Teams', value: localData.length, icon: <Users className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: localData.filter(i => i.status === 'active').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Below Target', value: localData.filter(i => i.status === 'below_target').length, icon: <TrendingUp className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'below_target', onClick: () => ps.setStatusFilter('below_target') },
    { label: 'Avg Rating', value: (localData.reduce((s, i) => s + i.avgRating, 0) / Math.max(1, localData.length)).toFixed(1), icon: <Star className="w-4 h-4" />, color: 'purple' as const },
  ], [localData, ps.statusFilter]);

  const handleDelete = (id: string) => {
    setLocalData(prev => prev.filter(i => i.id !== id));
    ps.closeConfirmDelete();
    success('Team report deleted');
  };

  const columns: Column<TeamReport>[] = [
    { key: 'teamName', label: 'Team', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.teamName}</span> },
    { key: 'lead', label: 'Team Lead', sortable: true },
    { key: 'members', label: 'Members', sortable: true, className: 'text-center' },
    { key: 'avgRating', label: 'Avg Rating', sortable: true, render: (i) => (
      <div className="flex items-center gap-1">
        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
        <span className="font-medium text-ink-800">{i.avgRating.toFixed(1)}</span>
      </div>
    ) },
    { key: 'completedProjects', label: 'Projects', sortable: true, className: 'text-center' },
    { key: 'status', label: 'Status', sortable: true, render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status.replace('_', ' ')}</span> },
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

  const csvHeaders = ['Team', 'Team Lead', 'Members', 'Avg Rating', 'Completed Projects', 'Status'];
  const csvRows = filtered.map(i => [i.teamName, i.lead, String(i.members), i.avgRating.toFixed(1), String(i.completedProjects), i.status]);
  const pdfHeaders = csvHeaders;
  const pdfRows = csvRows;

  return (
    <HrPageShell title="Team Reports" description="Aggregated team performance, attendance, and engagement metrics"
      pageKey="reports"
      headerActions={<>
        <button onClick={() => { exportToCsv(csvHeaders, csvRows, 'team-reports'); success('CSV exported'); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> CSV</button>
        <button onClick={() => exportToPdf('Team Reports', pdfHeaders, pdfRows, 'team-reports')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><FileText className="w-3.5 h-3.5" /> PDF</button>
        <button onClick={ps.openAddModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> Add Report</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search teams or leads..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'active', 'below_target', 'under_review']}
        onExportPdf={() => exportToPdf('Team Reports', pdfHeaders, pdfRows, 'team-reports')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No team reports found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add report</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Team Report' : 'New Team Report'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Team Name</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.teamName ?? ''} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Team Lead</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.lead ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Members</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.members ?? ''} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Avg Rating</label><input type="number" step="0.1" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.avgRating ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Completed Projects</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.completedProjects ?? ''} /></div>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { success(ps.editingId ? 'Report updated' : 'Report created'); ps.closeModal(); }}>{ps.editingId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => handleDelete(ps.deletingId!)} title="Delete Team Report" message="Are you sure you want to delete this team report? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Team Report Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Team</label><p className="text-sm font-medium text-ink-900">{selectedItem.teamName}</p></div>
          <div><label className="text-xs text-ink-500">Team Lead</label><p className="text-sm text-ink-700">{selectedItem.lead}</p></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-ink-500">Members</label><p className="text-sm font-medium text-ink-900">{selectedItem.members}</p></div>
            <div><label className="text-xs text-ink-500">Avg Rating</label><p className="text-sm font-medium text-ink-900">{selectedItem.avgRating.toFixed(1)}</p></div>
            <div><label className="text-xs text-ink-500">Projects</label><p className="text-sm font-medium text-ink-900">{selectedItem.completedProjects}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status.replace('_', ' ')}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}


