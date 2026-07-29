import { useEffect, useMemo, useState } from 'react';
import { Plane, Clock, CheckCircle2, XCircle, Plus, Download, FileText, Upload, Edit3, Trash2, Eye, MapPin, CalendarDays } from 'lucide-react';
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

interface TravelRequest {
  id: string;
  employeeName: string;
  destination: string;
  fromDate: string;
  toDate: string;
  purpose: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
}

export function TravelPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'destination', 'purpose'], pageSize: 10 });
  useEffect(() => { loadData(); }, []);
  useEffect(() => { ps.setData(data); }, [data]);
  const loadData = async () => {
    setLoading(true);
    try { const result = await hrApi.getTravelRequests({}); setData(Array.isArray(result) ? result : []); }
    catch (e: any) { showError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <Plane className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending', value: data.filter(i => i.status === 'pending').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Approved', value: data.filter(i => i.status === 'approved').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Completed', value: data.filter(i => i.status === 'completed').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
  ], [data, ps.statusFilter]);

  const columns: Column<TravelRequest>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'destination', label: 'Destination', sortable: true, render: (i) => <span className="inline-flex items-center gap-1.5 text-ink-600"><MapPin className="w-3.5 h-3.5 text-ink-400" />{i.destination}</span> },
    { key: 'fromDate', label: 'From', sortable: true, render: (i) => <span className="text-ink-600">{formatDate(i.fromDate)}</span> },
    { key: 'toDate', label: 'To', sortable: true, render: (i) => <span className="text-ink-600">{formatDate(i.toDate)}</span> },
    { key: 'amount', label: 'Amount', sortable: true, render: (i) => <span className="text-ink-600 font-medium">â‚¦{i.amount.toLocaleString()}</span> },
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
    <HrPageShell title="Travel" description="Travel requests, approvals, expense reporting, and itinerary management"
      pageKey="travel"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee', 'Destination', 'From', 'To', 'Amount', 'Purpose', 'Status'], ps.filtered.map(i => [i.employeeName, i.destination, i.fromDate, i.toDate, String(i.amount), i.purpose, i.status]), 'travel-requests'); showSuccess('CSV exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Travel Requests', ['Employee', 'Destination', 'From', 'To', 'Amount', 'Purpose', 'Status'], ps.filtered.map(i => [i.employeeName, i.destination, i.fromDate, i.toDate, String(i.amount), i.purpose, i.status]), 'travel-requests')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => ps.setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Upload className="w-3.5 h-3.5" /> Import</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Request</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by employee, destination, or purpose..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'approved' }, { label: 'Rejected', value: 'rejected' }, { label: 'Completed', value: 'completed' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      {ps.selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl">
          <span className="text-sm text-ink-600">{ps.selectedIds.length} selected</span>
          <button onClick={() => { showError('Read-only view'); ps.setSelectedIds([]); }} className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors">Delete Selected</button>
        </div>
      )}
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No travel requests found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first request</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Travel Request' : 'Add Travel Request'} onSubmit={(e) => { e.preventDefault(); showError('Read-only view'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Destination</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-ink-500 mb-1">From Date</label><input type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">To Date</label><input type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        </div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Purpose</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Estimated Amount (â‚¦)</label><input type="number" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showError('Read-only view'); ps.closeConfirmDelete(); }} title="Delete Request" message="Are you sure you want to delete this travel request? This action cannot be undone." confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Travel Request Details">
        {ps.viewingId && (() => {
          const item = data.find(i => i.id === ps.viewingId);
          if (!item) return null;
          return (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 p-4 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <div className="col-span-2"><span className="text-ink-400 text-xs block">Employee</span><span className="font-medium text-ink-900">{item.employeeName}</span></div>
                <div className="col-span-2"><span className="text-ink-400 text-xs block">Destination</span><span className="inline-flex items-center gap-1.5 font-medium text-ink-900"><MapPin className="w-3.5 h-3.5 text-ink-400" />{item.destination}</span></div>
                <div><span className="text-ink-400 text-xs block">From</span><span className="font-medium text-ink-900"><CalendarDays className="w-3.5 h-3.5 inline mr-1 text-ink-400" />{formatDate(item.fromDate)}</span></div>
                <div><span className="text-ink-400 text-xs block">To</span><span className="font-medium text-ink-900"><CalendarDays className="w-3.5 h-3.5 inline mr-1 text-ink-400" />{formatDate(item.toDate)}</span></div>
                <div className="col-span-2"><span className="text-ink-400 text-xs block">Purpose</span><span className="font-medium text-ink-900">{item.purpose}</span></div>
                <div><span className="text-ink-400 text-xs block">Amount</span><span className="font-medium text-ink-900">â‚¦{item.amount.toLocaleString()}</span></div>
                <div><span className="text-ink-400 text-xs block">Status</span><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(item.status)}`}>{item.status}</span></div>
              </div>
            </div>
          );
        })()}
      </HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Travel Requests" onSubmit={(e) => { e.preventDefault(); showError('Read-only view'); ps.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file to import travel requests.</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors" />
      </HrFormModal>
    </HrPageShell>
  );
}


