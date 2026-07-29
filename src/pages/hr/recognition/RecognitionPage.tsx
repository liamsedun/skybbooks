import { useState, useEffect, useMemo } from 'react';
import { Award, Heart, Sparkles, MessageSquare, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface Recognition {
  id: string; fromEmployee: string; toEmployee: string;
  type: string; message: string; date: string; status: string;
}

const typeIcon = (t: string) => {
  switch (t) {
    case 'award': return <Award className="w-3.5 h-3.5 text-amber-500" />;
    case 'shoutout': return <MessageSquare className="w-3.5 h-3.5 text-blue-500" />;
    case 'anniversary': return <Sparkles className="w-3.5 h-3.5 text-purple-500" />;
    default: return <Heart className="w-3.5 h-3.5 text-rose-500" />;
  }
};

export function RecognitionPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Recognition[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await hrApi.getRecognition({});
        if (res?.data) setData(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ps = useHrPageState({ data, initialSortKey: 'fromEmployee', searchKeys: ['fromEmployee', 'toEmployee', 'message'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <Award className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Published', value: data.filter(i => i.status === 'published').length, icon: <Sparkles className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'published', onClick: () => ps.setStatusFilter('published') },
    { label: 'Draft', value: data.filter(i => i.status === 'draft').length, icon: <Heart className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [data, ps.statusFilter]);

  const handleDelete = async (id: string) => {
    try {
      await hrApi.deleteRecognition(id);
      setData(prev => prev.filter(i => i.id !== id));
      toast('Deleted', 'success');
    } catch { toast('Failed to delete', 'error'); }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      fromEmployee: (form.elements.nativeItem('fromEmployee') as HTMLInputElement).value,
      toEmployee: (form.elements.nativeItem('toEmployee') as HTMLInputElement).value,
      type: (form.elements.nativeItem('type') as HTMLSelectElement).value,
      message: (form.elements.nativeItem('message') as HTMLTextAreaElement).value,
      status: (form.elements.nativeItem('status') as HTMLSelectElement).value,
    };
    try {
      await hrApi.createRecognition(payload);
      const res = await hrApi.getRecognition({});
      if (res?.data) setData(res.data);
      toast('Created', 'success');
      ps.closeModal();
    } catch { toast('Failed to save', 'error'); }
  };

  const columns: Column<Recognition>[] = [
    { key: 'fromEmployee', label: 'From', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.fromEmployee}</span> },
    { key: 'toEmployee', label: 'To', sortable: true },
    { key: 'type', label: 'Type', sortable: true, render: (i) => (
      <span className="inline-flex items-center gap-1.5">
        {typeIcon(i.type)}
        <span className="text-xs font-medium text-ink-600 capitalize">{i.type}</span>
      </span>
    )},
    { key: 'message', label: 'Message', render: (i) => <span className="text-ink-500 truncate max-w-[200px] block">{i.message}</span> },
    { key: 'date', label: 'Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.date)}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];
  return (
    <HrPageShell title="Recognition" description="Recognize and celebrate employee achievements"
      pageKey="recognition"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['From','To','Type','Message','Date','Status'], ps.filtered.map(i => [i.fromEmployee,i.toEmployee,i.type,i.message,i.date,i.status]), 'recognition'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Recognition', ['From','To','Type','Message','Date','Status'], ps.filtered.map(i => [i.fromEmployee,i.toEmployee,i.type,i.message,i.date,i.status]), 'recognition')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search recognition..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Published', value: 'published' }, { label: 'Draft', value: 'draft' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No recognition entries" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title="Add Recognition" onSubmit={handleSubmit}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">From Employee</label><input name="fromEmployee" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Alice Johnson" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">To Employee</label><input name="toEmployee" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Bob Smith" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Type</label><select name="type" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="award">Award</option><option value="shoutout">Shoutout</option><option value="anniversary">Anniversary</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Message</label><textarea name="message" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={3} placeholder="Write a recognition message..." /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label><select name="status" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="draft">Draft</option><option value="published">Published</option></select></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { if (ps.confirmingId) { handleDelete(ps.confirmingId); } ps.closeConfirmDelete(); }} title="Delete Recognition" message="Are you sure you want to delete this recognition?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Recognition Details">
        {ps.viewingId && (() => { const r = data.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center"><Award className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{r.toEmployee}</p><p className="text-xs text-ink-400">by {r.fromEmployee} · {formatDate(r.date)}</p></div></div>
            <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Type</p><p className="text-sm text-ink-700 mt-1 flex items-center gap-1">{typeIcon(r.type)}{r.type}</p></div>
            <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Message</p><p className="text-sm text-ink-700 mt-1 italic">"{r.message}"</p></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(r.status)}`}>{r.status}</span></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}


