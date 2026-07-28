import { useState, useEffect, useMemo } from 'react';
import { History, Download, FileText, Eye } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface CompensationHistory {
  id: string;
  employeeId: string;
  changeType: 'salary_review' | 'bonus' | 'allowance' | 'deduction';
  previousValue: number | null;
  newValue: number | null;
  currency: string;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;
}

const changeTypeLabels: Record<string, string> = {
  salary_review: 'Salary Review',
  bonus: 'Bonus',
  allowance: 'Allowance',
  deduction: 'Deduction',
};

const changeTypeColors: Record<string, string> = {
  salary_review: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  bonus: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  allowance: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800',
  deduction: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
};

const fmt = (n: number | null) => {
  if (n === null || n === undefined) return '—';
  return '₦' + n.toLocaleString();
};

function mapHistory(raw: any): CompensationHistory {
  return {
    id: raw.id,
    employeeId: raw.employeeId || '',
    changeType: raw.changeType || 'salary_review',
    previousValue: raw.previousValue ?? null,
    newValue: raw.newValue ?? null,
    currency: raw.currency || 'NGN',
    reason: raw.reason || null,
    changedBy: raw.changedBy || null,
    createdAt: raw.createdAt || '',
  };
}

export function CompensationHistoryPage() {
  const { toast } = useToast();
  const [data, setData] = useState<CompensationHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getCompensationHistory();
      const items = Array.isArray(res) ? res : (res?.data ?? []);
      setData(items.map(mapHistory));
    } catch {
      toast('Failed to load compensation history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const ps = useHrPageState({
    data,
    initialSortKey: 'createdAt',
    initialSortDirection: 'desc',
    searchKeys: ['employeeId', 'changeType'],
    pageSize: 10,
  });

  const stats = useMemo(() => [
    { label: 'Total Changes', value: data.length, icon: <History className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Salary Reviews', value: data.filter(i => i.changeType === 'salary_review').length, icon: <History className="w-4 h-4" />, color: 'indigo' as const, active: ps.statusFilter === 'salary_review', onClick: () => ps.setStatusFilter('salary_review') },
    { label: 'Bonuses', value: data.filter(i => i.changeType === 'bonus').length, icon: <History className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'bonus', onClick: () => ps.setStatusFilter('bonus') },
    { label: 'Other', value: data.filter(i => i.changeType === 'allowance' || i.changeType === 'deduction').length, icon: <History className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'other', onClick: () => ps.setStatusFilter('other') },
  ], [data, ps.statusFilter]);

  const filteredByType = useMemo(() => {
    if (ps.statusFilter === 'all') return ps.paginated;
    if (ps.statusFilter === 'other') return ps.paginated.filter(i => i.changeType === 'allowance' || i.changeType === 'deduction');
    return ps.paginated.filter(i => i.changeType === ps.statusFilter);
  }, [ps.paginated, ps.statusFilter]);

  const columns: Column<CompensationHistory>[] = [
    { key: 'employeeId', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">Employee</span> },
    {
      key: 'changeType', label: 'Change Type', sortable: true, render: (i) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${changeTypeColors[i.changeType] || changeTypeColors.salary_review}`}>
          {changeTypeLabels[i.changeType] || i.changeType}
        </span>
      ),
    },
    { key: 'previousValue', label: 'Previous Value', sortable: true, render: (i) => <span className="text-ink-600">{fmt(i.previousValue)}</span> },
    { key: 'newValue', label: 'New Value', sortable: true, render: (i) => <span className="font-medium text-ink-900">{fmt(i.newValue)}</span> },
    {
      key: 'newValue', label: 'Difference', render: (i) => {
        const diff = (i.newValue || 0) - (i.previousValue || 0);
        const cls = diff >= 0 ? 'text-emerald-600' : 'text-rose-600';
        return <span className={`font-medium tabular-nums ${cls}`}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span>;
      },
    },
    { key: 'currency', label: 'Currency', sortable: true },
    { key: 'reason', label: 'Reason', render: (i) => <span className="text-ink-600 truncate max-w-[200px] block">{i.reason || '—'}</span> },
    { key: 'changedBy', label: 'Changed By', render: (i) => <span className="text-ink-600">{i.changedBy || '—'}</span> },
    { key: 'createdAt', label: 'Date', sortable: true, render: (i) => <span className="text-ink-600">{formatDate(i.createdAt)}</span> },
    {
      key: 'actions', label: '', render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        </div>
      ), className: 'text-right',
    },
  ];

  const handleExportCsv = () => {
    const headers = ['Employee', 'Change Type', 'Previous Value', 'New Value', 'Difference', 'Currency', 'Reason', 'Changed By', 'Date'];
    const rows = data.map(i => {
      const diff = (i.newValue || 0) - (i.previousValue || 0);
      return [
        'Employee',
        changeTypeLabels[i.changeType] || i.changeType,
        fmt(i.previousValue),
        fmt(i.newValue),
        (diff >= 0 ? '+' : '') + fmt(diff),
        i.currency,
        i.reason || '',
        i.changedBy || '',
        formatDate(i.createdAt),
      ];
    });
    exportToCsv(headers, rows, 'compensation-history');
    toast('CSV exported', 'success');
  };

  const handleExportPdf = () => {
    const headers = ['Employee', 'Change Type', 'Previous Value', 'New Value', 'Difference', 'Currency', 'Reason', 'Changed By', 'Date'];
    const rows = data.map(i => {
      const diff = (i.newValue || 0) - (i.previousValue || 0);
      return [
        'Employee',
        changeTypeLabels[i.changeType] || i.changeType,
        fmt(i.previousValue),
        fmt(i.newValue),
        (diff >= 0 ? '+' : '') + fmt(diff),
        i.currency,
        i.reason || '',
        i.changedBy || '',
        formatDate(i.createdAt),
      ];
    });
    exportToPdf('Compensation History', headers, rows, 'compensation-history');
  };

  const viewingItem = ps.viewingId ? data.find(i => i.id === ps.viewingId) : null;

  if (loading) {
    return (
      <HrPageShell title="Compensation History" description="View compensation change history" pageKey="compensation">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </HrPageShell>
    );
  }

  return (
    <HrPageShell title="Compensation History" description="View compensation change history — salary reviews, bonuses, allowances, and deductions"
      pageKey="compensation"
      headerActions={
        <>
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={handleExportPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by employee, change type..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[
          { label: 'All', value: 'all' },
          { label: 'Salary Reviews', value: 'salary_review' },
          { label: 'Bonuses', value: 'bonus' },
          { label: 'Allowances', value: 'allowance' },
          { label: 'Deductions', value: 'deduction' },
          { label: 'Other', value: 'other' },
        ]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={filteredByType} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={data.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, data.length)}
        emptyMessage="No compensation history found" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Compensation Change Details">
        {viewingItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 flex items-center justify-center"><History className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{changeTypeLabels[viewingItem.changeType] || viewingItem.changeType}</p>
                <p className="text-xs text-ink-400">{viewingItem.createdAt ? formatDate(viewingItem.createdAt) : ''}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Previous Value</p>
                <p className="text-sm text-ink-700 mt-1">{fmt(viewingItem.previousValue)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">New Value</p>
                <p className="text-sm font-bold text-ink-900 mt-1">{fmt(viewingItem.newValue)}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Difference</p>
              <p className="text-sm font-semibold mt-1">
                {(() => {
                  const diff = (viewingItem.newValue || 0) - (viewingItem.previousValue || 0);
                  const cls = diff >= 0 ? 'text-emerald-600' : 'text-rose-600';
                  return <span className={cls}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span>;
                })()}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Change Type</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 capitalize ${changeTypeColors[viewingItem.changeType] || changeTypeColors.salary_review}`}>
                  {changeTypeLabels[viewingItem.changeType] || viewingItem.changeType}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Currency</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.currency}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Employee ID</p>
              <p className="text-sm text-ink-700 mt-1">{viewingItem.employeeId || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Changed By</p>
              <p className="text-sm text-ink-700 mt-1">{viewingItem.changedBy || '—'}</p>
            </div>
            {viewingItem.reason && (
              <div>
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Reason</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.reason}</p>
              </div>
            )}
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}
