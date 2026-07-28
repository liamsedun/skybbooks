import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Download, FileText, Eye, RotateCcw } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface TravelSettlement {
  id: string;
  travelRequestId: string;
  employeeName: string;
  totalExpenses: number;
  advanceAmount: number;
  balanceDue: number;
  currency: string;
  status: string;
  settledAt: string | null;
  notes: string;
  createdAt: string;
}

const fmtAmount = (n: number) => `₦${(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export function TravelSettlementsPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<TravelSettlement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    hrApi.getTravelSettlements().then((res: any) => {
      const items: TravelSettlement[] = Array.isArray(res) ? res : res?.data ?? [];
      setData(items);
    }).catch(() => showError('Failed to load settlements'))
    .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const ps = useHrPageState({ data, initialSortKey: 'createdAt', searchKeys: ['travelRequestId', 'employeeName'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending', value: data.filter(i => i.status === 'pending').length, icon: <RotateCcw className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Partial', value: data.filter(i => i.status === 'partial').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'purple' as const, active: ps.statusFilter === 'partial', onClick: () => ps.setStatusFilter('partial') },
    { label: 'Settled', value: data.filter(i => i.status === 'settled').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'settled', onClick: () => ps.setStatusFilter('settled') },
  ], [data, ps.statusFilter]);

  const columns: Column<TravelSettlement>[] = [
    { key: 'travelRequestId', label: 'Travel Request ID', sortable: true, render: (i) => <span className="font-medium text-ink-900 text-xs">{i.travelRequestId}</span> },
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="text-ink-700">{i.employeeName}</span> },
    { key: 'totalExpenses', label: 'Total Expenses (₦)', sortable: true, render: (i) => <span className="font-semibold text-ink-700">{fmtAmount(i.totalExpenses)}</span> },
    { key: 'advanceAmount', label: 'Advance (₦)', sortable: true, render: (i) => <span className="text-ink-600">{fmtAmount(i.advanceAmount)}</span> },
    { key: 'balanceDue', label: 'Balance Due', sortable: true, render: (i) => {
      const isOwed = i.balanceDue >= 0;
      return <span className={`font-semibold ${isOwed ? 'text-amber-600' : 'text-emerald-600'}`}>{isOwed ? '+' : ''}{fmtAmount(Math.abs(i.balanceDue))}</span>;
    }},
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'createdAt', label: 'Date', sortable: true, render: (i) => <span className="text-ink-500 text-xs">{formatDate(i.createdAt)}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const handleAutoSettle = () => {
    const travelRequestId = window.prompt('Enter Travel Request ID to auto-settle:');
    if (!travelRequestId) return;
    hrApi.autoSettleTravel(travelRequestId).then(() => {
      showSuccess('Settlement auto-completed');
      load();
    }).catch(() => showError('Auto-settle failed'));
  };

  return (
    <HrPageShell title="Travel Settlements" description="Manage travel expense settlements with auto-settle"
      pageKey="travel-settlements"
      headerActions={
        <>
          <button onClick={handleAutoSettle} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><CheckCircle2 className="w-3.5 h-3.5" /> Auto-Settle</button>
          <button onClick={() => { exportToCsv(['Travel Request ID','Employee','Total Expenses','Advance Amount','Balance Due','Status','Date'], ps.filtered.map(i => [i.travelRequestId,i.employeeName,String(i.totalExpenses),String(i.advanceAmount),String(i.balanceDue),i.status,i.createdAt]), 'travel-settlements'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Travel Settlements', ['Travel Request ID','Employee','Total Expenses','Advance Amount','Balance Due','Status','Date'], ps.filtered.map(i => [i.travelRequestId,i.employeeName,String(i.totalExpenses),String(i.advanceAmount),String(i.balanceDue),i.status,i.createdAt]), 'travel-settlements')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by ID or employee..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Partial', value: 'partial' }, { label: 'Settled', value: 'settled' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id} loading={loading}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No travel settlements" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Settlement Details">
        {ps.viewingId && (() => { const s = data.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-5 h-5" /></div>
              <div><p className="text-sm font-semibold text-ink-900">{s.employeeName}</p><p className="text-xs text-ink-400">{s.travelRequestId}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Total Expenses</p><p className="text-sm font-semibold text-ink-900 mt-1">{fmtAmount(s.totalExpenses)}</p></div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Advance Amount</p><p className="text-sm font-semibold text-ink-900 mt-1">{fmtAmount(s.advanceAmount)}</p></div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Balance Due</p><p className={`text-sm font-semibold mt-1 ${s.balanceDue >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{s.balanceDue >= 0 ? '+' : ''}{fmtAmount(Math.abs(s.balanceDue))}</p></div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Currency</p><p className="text-sm text-ink-700 mt-1">{s.currency}</p></div>
            </div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(s.status)}`}>{s.status}</span></div>
            {s.settledAt && <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Settled At</p><p className="text-sm text-ink-700 mt-1">{formatDate(s.settledAt)}</p></div>}
            {s.notes && <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Notes</p><p className="text-sm text-ink-700 mt-1">{s.notes}</p></div>}
            <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Created</p><p className="text-sm text-ink-700 mt-1">{formatDate(s.createdAt)}</p></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}