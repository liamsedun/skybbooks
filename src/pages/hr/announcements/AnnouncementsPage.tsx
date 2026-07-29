import { useState, useEffect, useMemo } from 'react';
import { Megaphone, ArrowUpCircle, MinusCircle, ArrowDownCircle, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface Announcement {
  id: string; title: string; author: string; department: string;
  date: string; priority: string; status: string;
}

const priorityIcon = (p: string) => {
  switch (p) {
    case 'high': return <ArrowUpCircle className="w-3.5 h-3.5 text-rose-500" />;
    case 'medium': return <MinusCircle className="w-3.5 h-3.5 text-amber-500" />;
    case 'low': return <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500" />;
    default: return null;
  }
};

export function AnnouncementsPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await hrApi.getAnnouncements();
        if (res?.data) setData(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ps = useHrPageState({ data, initialSortKey: 'title', searchKeys: ['title', 'author', 'department'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <Megaphone className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Published', value: data.filter(i => i.status === 'published').length, icon: <ArrowUpCircle className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'published', onClick: () => ps.setStatusFilter('published') },
    { label: 'Draft', value: data.filter(i => i.status === 'draft').length, icon: <MinusCircle className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [data, ps.statusFilter]);

  const handleDelete = async (id: string) => {
    try {
      await hrApi.deleteAnnouncement(id);
      setData(prev => prev.filter(i => i.id !== id));
      showSuccess('Deleted');
    } catch { showError('Failed to delete'); }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      title: (form.elements.nativeItem('title') as HTMLInputElement).value,
      content: (form.elements.nativeItem('content') as HTMLTextAreaElement).value,
      department: (form.elements.nativeItem('department') as HTMLInputElement).value,
      priority: (form.elements.nativeItem('priority') as HTMLSelectElement).value,
      status: (form.elements.nativeItem('status') as HTMLSelectElement).value,
    };
    try {
      if (ps.editingId) {
        await hrApi.updateAnnouncement(ps.editingId, payload);
        const res = await hrApi.getAnnouncements();
        if (res?.data) setData(res.data);
        showSuccess('Updated');
      } else {
        await hrApi.createAnnouncement(payload);
        const res = await hrApi.getAnnouncements();
        if (res?.data) setData(res.data);
        showSuccess('Created');
      }
      ps.closeModal();
    } catch { showError('Failed to save'); }
  };

  const columns: Column<Announcement>[] = [
    { key: 'title', label: 'Title', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.title}</span> },
    { key: 'author', label: 'Author', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'priority', label: 'Priority', sortable: true, render: (i) => (
      <span className="inline-flex items-center gap-1.5">
        {priorityIcon(i.priority)}
        <span className="text-xs font-medium text-ink-600 capitalize">{i.priority}</span>
      </span>
    )},
    { key: 'date', label: 'Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.date)}</span> },
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
    <HrPageShell title="Announcements" description="Manage company announcements and communications"
      pageKey="announcements"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Title','Author','Department','Priority','Date','Status'], ps.filtered.map(i => [i.title,i.author,i.department,i.priority,i.date,i.status]), 'announcements'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Announcements', ['Title','Author','Department','Priority','Date','Status'], ps.filtered.map(i => [i.title,i.author,i.department,i.priority,i.date,i.status]), 'announcements')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search announcements..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Published', value: 'published' }, { label: 'Draft', value: 'draft' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No announcements" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Announcement' : 'Add Announcement'} onSubmit={handleSubmit}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Title</label><input name="title" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Company Town Hall Q3" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Content</label><textarea name="content" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={4} placeholder="Write the announcement content here..." /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-ink-500 mb-1">Department</label><input name="department" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="All Departments" /></div><div><label className="block text-xs font-medium text-ink-500 mb-1">Priority</label><select name="priority" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label><select name="status" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="draft">Draft</option><option value="published">Published</option></select></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { if (ps.confirmingId) { handleDelete(ps.confirmingId); } ps.closeConfirmDelete(); }} title="Delete Announcement" message="Are you sure you want to delete this announcement?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Announcement Details">
        {ps.viewingId && (() => { const a = data.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Megaphone className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{a.title}</p><p className="text-xs text-ink-400">by {a.author} · {formatDate(a.date)}</p></div></div>
            <div className="grid grid-cols-3 gap-3"><div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Department</p><p className="text-sm text-ink-700 mt-1">{a.department}</p></div><div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Priority</p><p className="text-sm text-ink-700 mt-1 capitalize flex items-center gap-1">{priorityIcon(a.priority)}{a.priority}</p></div><div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(a.status)}`}>{a.status}</span></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}


