import { useState, useEffect, useMemo } from 'react';
import { Gift, Plus, Download, FileText, Edit3, Trash2, Eye, ThumbsUp } from 'lucide-react';
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

interface Bonus {
  id: string; employeeId: string; name: string; type: string;
  amount: number; currency: string; status: string;
  payoutDate: string; reason: string; employeeName?: string;
}

const typeOptions = [
  { label: 'Performance', value: 'performance' },
  { label: 'Signing', value: 'signing' },
  { label: 'Retention', value: 'retention' },
  { label: 'Holiday', value: 'holiday' },
];

function mapBonus(raw: any): Bonus {
  const empName = raw.employee
    ? `${raw.employee.firstName || ''} ${raw.employee.lastName || ''}`.trim()
    : raw.employeeId || '';
  return {
    id: raw.id,
    employeeId: raw.employeeId || '',
    name: raw.name || '',
    type: raw.type || 'performance',
    amount: raw.amount ?? 0,
    currency: raw.currency || 'NGN',
    status: raw.status || 'pending',
    payoutDate: raw.payoutDate || '',
    reason: raw.reason || '',
    employeeName: empName,
  };
}

export function BonusesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getBonuses({ pageSize: 500 });
      const items = Array.isArray(res) ? res : (res?.data ?? []);
      setData(items.map(mapBonus));
    } catch {
      toast('Failed to load bonuses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const ps = useHrPageState({ data, initialSortKey: 'name', searchKeys: ['name', 'employeeName', 'type'], pageSize: 10 });

  const statusCounts = useMemo(() => ({
    all: data.length,
    pending: data.filter(i => i.status === 'pending').length,
    approved: data.filter(i => i.status === 'approved').length,
    paid: data.filter(i => i.status === 'paid').length,
  }), [data]);

  const stats = useMemo(() => [
    { label: 'Total', value: statusCounts.all, icon: <Gift className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending', value: statusCounts.pending, icon: <Gift className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Approved', value: statusCounts.approved, icon: <ThumbsUp className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Paid', value: statusCounts.paid, icon: <Gift className="w-4 h-4" />, color: 'cyan' as const, active: ps.statusFilter === 'paid', onClick: () => ps.setStatusFilter('paid') },
  ], [statusCounts, ps.statusFilter]);

  const filteredByStatus = useMemo(() => {
    if (ps.statusFilter === 'all') return data;
    return data.filter(i => i.status === ps.statusFilter);
  }, [data, ps.statusFilter]);

  const columns: Column<Bonus>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName || 'Employee'}</span> },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'type', label: 'Type', sortable: true, render: (i) => (
      <span className="text-sm capitalize text-ink-600">{i.type}</span>
    )},
    { key: 'amount', label: 'Amount', sortable: true, render: (i) => (
      <span className="font-medium text-ink-900 tabular-nums">{i.currency} {i.amount.toLocaleString()}</span>
    )},
    { key: 'currency', label: 'Currency', sortable: true },
    { key: 'status', label: 'Status', render: (i) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span>
    )},
    { key: 'payoutDate', label: 'Pay Date', sortable: true, render: (i) => (
      <span className="text-ink-600">{formatDate(i.payoutDate)}</span>
    )},
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        {i.status === 'pending' && (
          <button onClick={async () => { try { await hrApi.approveBonus(i.id); toast('Bonus approved', 'success'); await fetchData(); } catch { toast('Failed to approve bonus', 'error'); } }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors" title="Approve"><ThumbsUp className="w-3.5 h-3.5" /></button>
        )}
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const employeeId = fd.get('employeeId') as string;
    const name = fd.get('name') as string;
    const type = fd.get('type') as string;
    const amount = Number(fd.get('amount'));
    const currency = fd.get('currency') as string;
    const payoutDate = fd.get('payoutDate') as string;
    const reason = fd.get('reason') as string;
    if (!name?.trim()) { toast('Name is required', 'error'); return; }
    if (!amount || amount <= 0) { toast('Amount must be greater than 0', 'error'); return; }
    const payload = { employeeId: employeeId?.trim() || '', name: name.trim(), type, amount, currency: currency || 'NGN', payoutDate: payoutDate || null, reason: reason?.trim() || '' };
    try {
      if (ps.editingId) {
        await hrApi.updateBonus(ps.editingId, payload);
        toast('Bonus updated', 'success');
      } else {
        await hrApi.createBonus(payload);
        toast('Bonus created', 'success');
      }
      ps.closeModal();
      await fetchData();
    } catch {
      toast(ps.editingId ? 'Failed to update bonus' : 'Failed to create bonus', 'error');
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    try {
      await hrApi.deleteBonus(ps.deletingId);
      toast('Bonus deleted', 'success');
      ps.closeConfirmDelete();
      await fetchData();
    } catch {
      toast('Failed to delete bonus', 'error');
    }
  };

  const editingBonus = ps.editingId ? data.find(i => i.id === ps.editingId) : null;
  const viewingBonus = ps.viewingId ? data.find(i => i.id === ps.viewingId) : null;

  if (loading) {
    return (
      <HrPageShell title="Bonuses" description="Manage employee bonuses" pageKey="bonuses">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </HrPageShell>
    );
  }

  return (
    <HrPageShell title="Bonuses" description="Manage employee bonuses"
      pageKey="bonuses"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee','Name','Type','Amount','Currency','Status','Pay Date','Reason'], ps.filtered.map(i => [i.employeeName || 'Employee',i.name,i.type,String(i.amount),i.currency,i.status,i.payoutDate,i.reason]), 'bonuses'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Bonuses', ['Employee','Name','Type','Amount','Currency','Status','Pay Date','Reason'], ps.filtered.map(i => [i.employeeName || 'Employee',i.name,i.type,String(i.amount),i.currency,i.status,i.payoutDate,i.reason]), 'bonuses')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by name, type..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'approved' }, { label: 'Paid', value: 'paid' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No bonuses" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Bonus' : 'Add Bonus'} onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee ID</label><input name="employeeId" defaultValue={editingBonus?.employeeId || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. emp-001" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Bonus Name</label><input name="name" defaultValue={editingBonus?.name || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Q3 Performance" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Type</label><select name="type" defaultValue={editingBonus?.type || 'performance'} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">{typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Amount</label><input name="amount" type="number" defaultValue={editingBonus?.amount || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. 500000" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Currency</label><input name="currency" defaultValue={editingBonus?.currency || 'NGN'} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="NGN" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Pay Date</label><input name="payoutDate" type="date" defaultValue={editingBonus?.payoutDate || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        </div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Reason</label><textarea name="reason" defaultValue={editingBonus?.reason || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={3} placeholder="Reason for the bonus..." /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete} title="Delete Bonus" message="Are you sure you want to delete this bonus?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Bonus Details">
        {viewingBonus && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center"><Gift className="w-5 h-5" /></div>
              <div><p className="text-sm font-semibold text-ink-900">{viewingBonus.name}</p><p className="text-xs text-ink-400">{viewingBonus.employeeName || 'Employee'} · {viewingBonus.type}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Amount</p><p className="text-sm font-bold text-ink-900 mt-1">{viewingBonus.currency} {viewingBonus.amount.toLocaleString()}</p></div>
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(viewingBonus.status)}`}>{viewingBonus.status}</span></div>
            </div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Employee ID</p><p className="text-sm text-ink-700 mt-1">{viewingBonus.employeeId || '—'}</p></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Pay Date</p><p className="text-sm text-ink-700 mt-1">{formatDate(viewingBonus.payoutDate) || '—'}</p></div>
            {viewingBonus.reason && (
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Reason</p><p className="text-sm text-ink-700">{viewingBonus.reason}</p></div>
            )}
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}