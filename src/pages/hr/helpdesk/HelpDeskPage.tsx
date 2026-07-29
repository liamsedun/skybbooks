import { useState, useEffect, useMemo } from 'react';
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
import { hrApi } from '../../../lib/api';

interface TicketItem {
  id: string;
  employeeName: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400',
  high: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400',
  medium: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400',
  low: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
};

export function HelpDeskPage() {
  const { toast } = useToast();
  const [data, setData] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await hrApi.getHelpTickets({});
        if (res?.data) setData(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ps = useHrPageState({ data, initialSortKey: 'createdAt', searchKeys: ['employeeName', 'subject', 'category'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total Tickets', value: data.length, icon: <Headphones className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Open', value: data.filter(i => i.status === 'open').length, icon: <AlertCircle className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'open', onClick: () => ps.setStatusFilter('open') },
    { label: 'In Progress', value: data.filter(i => i.status === 'in-progress').length, icon: <Play className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'in-progress', onClick: () => ps.setStatusFilter('in-progress') },
    { label: 'Resolved', value: data.filter(i => i.status === 'resolved').length, icon: <CheckCircle className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'resolved', onClick: () => ps.setStatusFilter('resolved') },
  ], [data, ps.statusFilter]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      employeeName: (form.elements.nativeItem('employeeName') as HTMLInputElement).value,
      subject: (form.elements.nativeItem('subject') as HTMLInputElement).value,
      category: (form.elements.nativeItem('category') as HTMLSelectElement).value,
      priority: (form.elements.nativeItem('priority') as HTMLSelectElement).value,
    };
    try {
      if (ps.editingId) {
        await hrApi.updateHelpTicket(ps.editingId, payload);
        const res = await hrApi.getHelpTickets({});
        if (res?.data) setData(res.data);
        toast('Updated', 'success');
      } else {
        await hrApi.createHelpTicket(payload);
        const res = await hrApi.getHelpTickets({});
        if (res?.data) setData(res.data);
        toast('Created', 'success');
      }
      ps.closeModal();
    } catch { toast('Failed to save', 'error'); }
  };

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
      </div>
    ), className: 'text-right' },
  ];

  return (
    <HrPageShell title="HR Help Desk" description="Employee support and inquiries"
      pageKey="helpdesk"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Ticket', 'Employee', 'Subject', 'Category', 'Priority', 'Status', 'Created'], ps.filtered.map(t => [t.id, t.employeeName, t.subject, t.category, t.priority, t.status, t.createdAt]), 'help-desk'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Help Desk Tickets', ['Ticket', 'Employee', 'Subject', 'Category', 'Priority', 'Status'], ps.filtered.map(t => [t.id, t.employeeName, t.subject, t.category, t.priority, t.status]), 'help-desk')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
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
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Ticket' : 'New Ticket'} onSubmit={handleSubmit}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee</label><input name="employeeName" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Subject</label><input name="subject" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Category</label><select name="category" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>Technical</option><option>Payroll</option><option>Leave</option><option>HR</option><option>Benefits</option><option>IT</option><option>Finance</option><option>Performance</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Priority</label><select name="priority" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>low</option><option>medium</option><option>high</option><option>urgent</option></select></div>
      </HrFormModal>
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Ticket Details">
        {ps.viewingId && (() => { const t = data.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="grid grid-cols-2 gap-4"><div><p className="text-ink-400 text-xs">Ticket</p><p className="font-mono font-medium text-ink-900">{t.id}</p></div><div><p className="text-ink-400 text-xs">Employee</p><p className="font-medium text-ink-900">{t.employeeName}</p></div><div className="col-span-2"><p className="text-ink-400 text-xs">Subject</p><p className="font-medium text-ink-900">{t.subject}</p></div><div><p className="text-ink-400 text-xs">Category</p><p className="font-medium text-ink-900">{t.category}</p></div><div><p className="text-ink-400 text-xs">Priority</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${priorityColors[t.priority] || ''}`}>{t.priority}</span></div><div><p className="text-ink-400 text-xs">Status</p><p className="font-medium text-ink-900 capitalize">{t.status}</p></div><div><p className="text-ink-400 text-xs">Created</p><p className="font-medium text-ink-900">{formatDate(t.createdAt)}</p></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}

