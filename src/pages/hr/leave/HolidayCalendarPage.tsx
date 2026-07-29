import { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Eye, Edit3, Trash2, CalendarDays, Sun } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

export function HolidayCalendarPage() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  const ps = useHrPageState({ data, initialSortKey: 'date', searchKeys: ['name'], pageSize: 10 });

  useEffect(() => { loadData(); }, [year]);
  useEffect(() => { ps.setData(data); }, [data]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await hrApi.getHolidays({ year });
      setData(Array.isArray(result) ? result : []);
    } catch (e: any) { toast(e?.message || 'Failed to load holidays', 'error'); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => [
    { label: 'Total Holidays', value: data.length, icon: <Sun className="w-4 h-4" />, color: 'blue' as const, active: true, onClick: () => {} },
    { label: 'Public', value: data.filter(i => i.type === 'public').length, icon: <CalendarDays className="w-4 h-4" />, color: 'purple' as const, active: false, onClick: () => {} },
    { label: 'Company', value: data.filter(i => i.type === 'company').length, icon: <CalendarDays className="w-4 h-4" />, color: 'green' as const, active: false, onClick: () => {} },
  ], [data]);

  const openCreate = () => { setEditingId(null); setFormData({ type: 'public', isActive: true, recurring: false }); setFormOpen(true); };
  const openEdit = (id: string) => {
    const item = data.find(i => i.id === id);
    if (item) { setEditingId(id); setFormData({ ...item }); setFormOpen(true); }
  };

  const handleSave = async () => {
    try {
      if (editingId) { await hrApi.updateHoliday(editingId, formData); toast('Holiday updated', 'success'); }
      else { await hrApi.createHoliday(formData); toast('Holiday created', 'success'); }
      setFormOpen(false); loadData();
    } catch (e: any) { toast(e?.message || 'Failed to save', 'error'); }
  };

  const handleDelete = async (id: string) => {
    try { await hrApi.deleteHoliday(id); toast('Holiday deleted', 'success'); loadData(); ps.closeModals(); }
    catch (e: any) { toast(e?.message || 'Failed to delete', 'error'); }
  };

  const columns: Column<any>[] = [
    { key: 'name', label: 'Holiday', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'date', label: 'Date', sortable: true, render: (i) => formatDate(i.date) },
    {
      key: 'type', label: 'Type', sortable: true, render: (i) => {
        const colors: Record<string, string> = { public: 'bg-purple-100 text-purple-700', company: 'bg-emerald-100 text-emerald-700', observance: 'bg-amber-100 text-amber-700' };
        return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[i.type] || 'bg-ink-100 text-ink-600'}`}>{i.type || 'public'}</span>;
      },
    },
    { key: 'recurring', label: 'Recurring', className: 'text-center', render: (i) => i.recurring ? <span className="text-emerald-600 text-xs font-medium">Yes</span> : <span className="text-ink-400 text-xs">No</span> },
    {
      key: 'isActive', label: 'Active', className: 'text-center', render: (i) => {
        const c = i.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400';
        return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${c}`}>{i.isActive ? 'Active' : 'Inactive'}</span>;
      },
    },
    {
      key: 'actions', label: '', render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => openEdit(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ), className: 'text-right',
    },
  ];

  const selectedItem = ps.viewDrawerId ? data.find(i => i.id === ps.viewDrawerId) : null;
  const { filtered, paginated } = ps;

  return (
    <HrPageShell title="Holiday Calendar" description="Manage company holidays and observances"
      pageKey="holidays"
      headerActions={<>
        <div className="flex items-center gap-2">
          <select className="h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> New Holiday</button>
        <button onClick={() => exportToCsv(filtered, columns, 'holidays')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      <HrStatCards items={stats} columns={3} />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id} loading={loading}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No holidays found for this year" emptyAction={<button onClick={openCreate} className="text-xs font-medium text-primary hover:text-primary-hover">Add a holiday</button>} />
      <HrFormModal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Edit Holiday' : 'New Holiday'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Holiday Name *</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Date *</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Type</label>
              <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.type || 'public'} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="public">Public Holiday</option><option value="company">Company Holiday</option><option value="observance">Observance</option>
              </select></div>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Description</label><textarea className="w-full px-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" rows={2} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" checked={!!formData.recurring} onChange={e => setFormData({...formData, recurring: e.target.checked})} /> Recurring annually</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" checked={!!formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} /> Active</label>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={handleSave}>{editingId ? 'Update' : 'Create'} Holiday</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmDeleteId !== null} onClose={ps.closeModals} onConfirm={() => handleDelete(ps.confirmDeleteId!)} title="Delete Holiday" message="Are you sure you want to delete this holiday?" />
      <HrViewDrawer open={ps.viewDrawerId !== null} onClose={ps.closeModals} title="Holiday Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Holiday Name</label><p className="text-sm font-medium text-ink-900">{selectedItem.name}</p></div>
          <div><label className="text-xs text-ink-500">Date</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.date)}</p></div>
          <div><label className="text-xs text-ink-500">Type</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.type || 'public'}</p></div>
          <div><label className="text-xs text-ink-500">Recurring</label><p className="text-sm font-medium text-ink-900">{selectedItem.recurring ? 'Yes (annually)' : 'No'}</p></div>
          {selectedItem.description && <div><label className="text-xs text-ink-500">Description</label><p className="text-sm text-ink-700">{selectedItem.description}</p></div>}
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900">{selectedItem.isActive ? 'Active' : 'Inactive'}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}
