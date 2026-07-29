import { useState, useEffect, useMemo } from 'react';
import { History, Download, FileText, Eye } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface TravelHistoryItem {
  id: string;
  destination: string;
  purpose: string;
  departureDate: string;
  returnDate: string;
  estimatedCost: number;
  status: string;
  employeeName: string;
  createdAt: string;
}

const fmtAmount = (n: number) => `₦${(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export function TravelHistoryPage() {
  const { toast } = useToast();
  const [data, setData] = useState<TravelHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    hrApi.getTravelHistory().then((res: any) => {
      const items: TravelHistoryItem[] = Array.isArray(res) ? res : res?.data ?? [];
      setData(items);
    }).catch(() => toast('Failed to load travel history', 'error'))
    .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const ps = useHrPageState({ data, initialSortKey: 'departureDate', searchKeys: ['destination', 'purpose', 'status', 'employeeName'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total Trips', value: data.length, icon: <History className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Completed', value: data.filter(i => i.status === 'completed').length, icon: <History className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
    { label: 'Approved', value: data.filter(i => i.status === 'approved').length, icon: <History className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Declined', value: data.filter(i => i.status === 'declined').length, icon: <History className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'declined', onClick: () => ps.setStatusFilter('declined') },
  ], [data, ps.statusFilter]);

  const columns: Column<TravelHistoryItem>[] = [
    { key: 'destination', label: 'Destination', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.destination}</span> },
    { key: 'purpose', label: 'Purpose', sortable: true, render: (i) => <span className="text-ink-600 text-xs">{i.purpose}</span> },
    { key: 'departureDate', label: 'Departure', sortable: true, render: (i) => <span className="text-ink-500 text-xs">{formatDate(i.departureDate)}</span> },
    { key: 'returnDate', label: 'Return', sortable: true, render: (i) => <span className="text-ink-500 text-xs">{formatDate(i.returnDate)}</span> },
    { key: 'estimatedCost', label: 'Est. Cost (₦)', sortable: true, render: (i) => <span className="font-semibold text-ink-700">{fmtAmount(i.estimatedCost)}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'createdAt', label: 'Created', sortable: true, render: (i) => <span className="text-ink-500 text-xs">{formatDate(i.createdAt)}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  return (
    <HrPageShell title="Travel History" description="Read-only record of past travel requests"
      pageKey="travel-history"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Destination','Purpose','Departure','Return','Est. Cost','Status','Created'], ps.filtered.map(i => [i.destination,i.purpose,i.departureDate,i.returnDate,String(i.estimatedCost),i.status,i.createdAt]), 'travel-history'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Travel History', ['Destination','Purpose','Departure','Return','Est. Cost','Status','Created'], ps.filtered.map(i => [i.destination,i.purpose,i.departureDate,i.returnDate,String(i.estimatedCost),i.status,i.createdAt]), 'travel-history')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by destination, purpose, or status..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Completed', value: 'completed' }, { label: 'Approved', value: 'approved' }, { label: 'Declined', value: 'declined' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id} loading={loading}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No travel history" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Travel Details">
        {ps.viewingId && (() => { const t = data.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center"><History className="w-5 h-5" /></div>
              <div><p className="text-sm font-semibold text-ink-900">{t.destination}</p><p className="text-xs text-ink-400">{t.purpose}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Employee</p><p className="text-sm text-ink-700 mt-1">{t.employeeName}</p></div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Est. Cost</p><p className="text-sm font-semibold text-ink-900 mt-1">{fmtAmount(t.estimatedCost)}</p></div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Departure</p><p className="text-sm text-ink-700 mt-1">{formatDate(t.departureDate)}</p></div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Return</p><p className="text-sm text-ink-700 mt-1">{formatDate(t.returnDate)}</p></div>
            </div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(t.status)}`}>{t.status}</span></div>
            <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Created</p><p className="text-sm text-ink-700 mt-1">{formatDate(t.createdAt)}</p></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}