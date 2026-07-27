import { useMemo } from 'react';
import { Plane, MapPin, Calendar, DollarSign, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface TravelRequest {
  id: string; employeeName: string; destination: string;
  fromDate: string; toDate: string; amount: number; status: string;
}

const MOCK: TravelRequest[] = [
  { id: 'trv-1', employeeName: 'Alice Johnson', destination: 'Lagos to Abuja', fromDate: '2026-08-10', toDate: '2026-08-12', amount: 350000, status: 'approved' },
  { id: 'trv-2', employeeName: 'Bob Smith', destination: 'Lagos to London', fromDate: '2026-09-01', toDate: '2026-09-07', amount: 2500000, status: 'pending' },
  { id: 'trv-3', employeeName: 'Carol White', destination: 'Abuja to Port Harcourt', fromDate: '2026-08-15', toDate: '2026-08-16', amount: 180000, status: 'approved' },
  { id: 'trv-4', employeeName: 'David Lee', destination: 'Lagos to Enugu', fromDate: '2026-08-20', toDate: '2026-08-22', amount: 220000, status: 'pending' },
  { id: 'trv-5', employeeName: 'Eve Brown', destination: 'Lagos to Dubai', fromDate: '2026-10-01', toDate: '2026-10-05', amount: 1800000, status: 'draft' },
  { id: 'trv-6', employeeName: 'Frank Wilson', destination: 'Abuja to Lagos', fromDate: '2026-08-05', toDate: '2026-08-06', amount: 150000, status: 'rejected' },
  { id: 'trv-7', employeeName: 'Grace Kim', destination: 'Lagos to Kano', fromDate: '2026-08-18', toDate: '2026-08-20', amount: 280000, status: 'approved' },
  { id: 'trv-8', employeeName: 'Henry Davis', destination: 'Port Harcourt to Abuja', fromDate: '2026-09-10', toDate: '2026-09-12', amount: 200000, status: 'pending' },
  { id: 'trv-9', employeeName: 'Ivy Chen', destination: 'Lagos to Accra', fromDate: '2026-08-25', toDate: '2026-08-27', amount: 650000, status: 'approved' },
  { id: 'trv-10', employeeName: 'Jack Taylor', destination: 'Lagos to New York', fromDate: '2026-11-01', toDate: '2026-11-10', amount: 3500000, status: 'draft' },
];

const fmtAmount = (n: number) => `â‚¦${(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export function TravelRequestsPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'destination'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total', value: MOCK.length, icon: <Plane className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Approved', value: MOCK.filter(i => i.status === 'approved').length, icon: <MapPin className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Pending', value: MOCK.filter(i => i.status === 'pending').length, icon: <Calendar className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Draft', value: MOCK.filter(i => i.status === 'draft').length, icon: <DollarSign className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [ps.statusFilter]);
  const columns: Column<TravelRequest>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'destination', label: 'Destination', sortable: true },
    { key: 'fromDate', label: 'Travel Dates', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.fromDate)} - {formatDate(i.toDate)}</span> },
    { key: 'amount', label: 'Amount', sortable: true, render: (i) => <span className="font-semibold text-ink-700">{fmtAmount(i.amount)}</span> },
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
    <HrPageShell title="Travel Requests" description="Manage employee travel requests"
      pageKey="travel"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee','Destination','From','To','Amount','Status'], ps.filtered.map(i => [i.employeeName,i.destination,i.fromDate,i.toDate,`â‚¦${i.amount}`,i.status]), 'travel'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Travel Requests', ['Employee','Destination','From','To','Amount','Status'], ps.filtered.map(i => [i.employeeName,i.destination,i.fromDate,i.toDate,`â‚¦${i.amount}`,i.status]), 'travel')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search travel requests..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Approved', value: 'approved' }, { label: 'Pending', value: 'pending' }, { label: 'Draft', value: 'draft' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No travel requests" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Travel Request' : 'Add Travel Request'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Updated' : 'Created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Alice Johnson" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Destination</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Lagos to Abuja" /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-ink-500 mb-1">From</label><input type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div><div><label className="block text-xs font-medium text-ink-500 mb-1">To</label><input type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Estimated Cost (NGN)</label><input type="number" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. 350000" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="draft">Draft</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Deleted'); ps.closeConfirmDelete(); }} title="Delete Travel Request" message="Are you sure you want to delete this travel request?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Travel Request Details">
        {ps.viewingId && (() => { const t = MOCK.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center"><Plane className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{t.employeeName}</p><p className="text-xs text-ink-400">{t.destination}</p></div></div>
            <div className="grid grid-cols-3 gap-3"><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">From</p><p className="text-sm text-ink-700 mt-1">{formatDate(t.fromDate)}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">To</p><p className="text-sm text-ink-700 mt-1">{formatDate(t.toDate)}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Amount</p><p className="text-sm font-semibold text-ink-900 mt-1">{fmtAmount(t.amount)}</p></div></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(t.status)}`}>{t.status}</span></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}


