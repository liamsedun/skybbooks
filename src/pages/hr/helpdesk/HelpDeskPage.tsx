import { useMemo } from 'react';
import { Headphones, AlertCircle, Play, CheckCircle, XCircle, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface TicketItem {
  id: string;
  employeeName: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
}

const MOCK: TicketItem[] = [
  { id: 'TKT-001', employeeName: 'Alice Johnson', subject: 'Login issue', category: 'Technical', priority: 'high', status: 'open', createdAt: '2026-07-25' },
  { id: 'TKT-002', employeeName: 'Bob Smith', subject: 'Payroll discrepancy', category: 'Payroll', priority: 'urgent', status: 'in-progress', createdAt: '2026-07-24' },
  { id: 'TKT-003', employeeName: 'Carol White', subject: 'Leave balance query', category: 'Leave', priority: 'low', status: 'resolved', createdAt: '2026-07-23' },
  { id: 'TKT-004', employeeName: 'David Brown', subject: 'Update personal info', category: 'HR', priority: 'medium', status: 'closed', createdAt: '2026-07-22' },
  { id: 'TKT-005', employeeName: 'Eve Davis', subject: 'Benefits enrollment', category: 'Benefits', priority: 'medium', status: 'open', createdAt: '2026-07-21' },
  { id: 'TKT-006', employeeName: 'Frank Miller', subject: 'Hardware request', category: 'IT', priority: 'low', status: 'in-progress', createdAt: '2026-07-20' },
  { id: 'TKT-007', employeeName: 'Grace Wilson', subject: 'Travel reimbursement', category: 'Finance', priority: 'high', status: 'open', createdAt: '2026-07-19' },
  { id: 'TKT-008', employeeName: 'Hank Moore', subject: 'Time tracker issue', category: 'Technical', priority: 'medium', status: 'resolved', createdAt: '2026-07-18' },
  { id: 'TKT-009', employeeName: 'Ivy Taylor', subject: 'Onboarding documents', category: 'HR', priority: 'high', status: 'in-progress', createdAt: '2026-07-17' },
  { id: 'TKT-010', employeeName: 'Jack Anderson', subject: 'Performance review access', category: 'Performance', priority: 'low', status: 'closed', createdAt: '2026-07-16' },
];

const priorityColors: Record<string, string> = {
  urgent: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400',
  high: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400',
  medium: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400',
  low: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
};

export function HelpDeskPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'createdAt', searchKeys: ['employeeName', 'subject', 'category'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total Tickets', value: MOCK.length, icon: <Headphones className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Open', value: MOCK.filter(i => i.status === 'open').length, icon: <AlertCircle className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'open', onClick: () => ps.setStatusFilter('open') },
    { label: 'In Progress', value: MOCK.filter(i => i.status === 'in-progress').length, icon: <Play className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'in-progress', onClick: () => ps.setStatusFilter('in-progress') },
    { label: 'Resolved', value: MOCK.filter(i => i.status === 'resolved').length, icon: <CheckCircle className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'resolved', onClick: () => ps.setStatusFilter('resolved') },
  ], [ps.statusFilter]);

  const columns: Column<TicketItem>[] = [
    { key: 'id', label: 'Ticket', sortable: true, render: (i) => <span className="font-mono text-xs font-medium text-ink-900">{i.id}</span> },
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'subject', label: 'Subject', render: (i) => <span className="text-ink-600 max-w-[200px] truncate block">{i.subject}</span> },
    { key: 'category', label: 'Category', render: (i) => <span className="text-ink-500">{i.category}</span> },
    { key: 'priority', label: 'Priority', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${priorityColors[i.priority] || ''}`}>{i.priority}</span> },
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
    <HrPageShell title="HR Help Desk" description="Employee support and inquiries"
      pageKey="helpdesk"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Ticket', 'Employee', 'Subject', 'Category', 'Priority', 'Status', 'Created'], MOCK.map(t => [t.id, t.employeeName, t.subject, t.category, t.priority, t.status, t.createdAt]), 'help-desk'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Help Desk Tickets', ['Ticket', 'Employee', 'Subject', 'Category', 'Priority', 'Status'], MOCK.map(t => [t.id, t.employeeName, t.subject, t.category, t.priority, t.status]), 'help-desk')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> New Ticket</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by employee, subject..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Open', value: 'open' }, { label: 'In Progress', value: 'in-progress' }, { label: 'Resolved', value: 'resolved' }, { label: 'Closed', value: 'closed' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No tickets found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Create your first ticket</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Ticket' : 'New Ticket'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Updated' : 'Created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Subject</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Category</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>Technical</option><option>Payroll</option><option>Leave</option><option>HR</option><option>Benefits</option><option>IT</option><option>Finance</option><option>Performance</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Priority</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>low</option><option>medium</option><option>high</option><option>urgent</option></select></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Deleted'); ps.closeConfirmDelete(); }} title="Delete Ticket" message="Are you sure?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Ticket Details">
        {ps.viewingId && (() => { const t = MOCK.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="grid grid-cols-2 gap-4"><div><p className="text-ink-400 text-xs">Ticket</p><p className="font-mono font-medium text-ink-900">{t.id}</p></div><div><p className="text-ink-400 text-xs">Employee</p><p className="font-medium text-ink-900">{t.employeeName}</p></div><div className="col-span-2"><p className="text-ink-400 text-xs">Subject</p><p className="font-medium text-ink-900">{t.subject}</p></div><div><p className="text-ink-400 text-xs">Category</p><p className="font-medium text-ink-900">{t.category}</p></div><div><p className="text-ink-400 text-xs">Priority</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${priorityColors[t.priority] || ''}`}>{t.priority}</span></div><div><p className="text-ink-400 text-xs">Status</p><p className="font-medium text-ink-900 capitalize">{t.status}</p></div><div><p className="text-ink-400 text-xs">Created</p><p className="font-medium text-ink-900">{formatDate(t.createdAt)}</p></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}

