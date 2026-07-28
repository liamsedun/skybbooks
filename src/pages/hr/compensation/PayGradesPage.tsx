import { useState, useEffect, useMemo, FormEvent } from 'react';
import { BarChart3, Plus, Download, FileText, Edit3, Trash2, Eye, CheckCircle, XCircle } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface PayGrade {
  id: string;
  name: string;
  designationId: string | null;
  minAmount: number;
  maxAmount: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

function fmtAmount(n: number) {
  return '₦' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PayGradesPage() {
  const { toast } = useToast();
  const [payGrades, setPayGrades] = useState<PayGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formMinAmount, setFormMinAmount] = useState('');
  const [formMaxAmount, setFormMaxAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('NGN');
  const [formIsActive, setFormIsActive] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hrApi.getCompensationBands();
      setPayGrades(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pay grades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const ps = useHrPageState({
    data: payGrades,
    initialSortKey: 'name',
    searchKeys: ['name'],
    pageSize: 10,
  });

  const filteredByStatus = useMemo(() => {
    if (ps.statusFilter === 'all') return ps.paginated;
    return ps.paginated.filter(i => String(i.isActive) === ps.statusFilter);
  }, [ps.paginated, ps.statusFilter]);

  const stats = useMemo(() => [
    { label: 'Total Pay Grades', value: payGrades.length, icon: <BarChart3 className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: payGrades.filter(i => i.isActive).length, icon: <CheckCircle className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'true', onClick: () => ps.setStatusFilter('true') },
    { label: 'Inactive', value: payGrades.filter(i => !i.isActive).length, icon: <XCircle className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'false', onClick: () => ps.setStatusFilter('false') },
  ], [payGrades, ps.statusFilter]);

  const statusOptions = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'true' },
    { label: 'Inactive', value: 'false' },
  ];

  const resetForm = () => {
    setFormName('');
    setFormMinAmount('');
    setFormMaxAmount('');
    setFormCurrency('NGN');
    setFormIsActive(true);
    ps.setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    ps.openAddModal();
  };

  const openEdit = (id: string) => {
    const item = payGrades.find(i => i.id === id);
    if (!item) return;
    setFormName(item.name);
    setFormMinAmount(String(item.minAmount));
    setFormMaxAmount(String(item.maxAmount));
    setFormCurrency(item.currency);
    setFormIsActive(item.isActive);
    ps.openEditModal(id);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    ps.setSubmitting(true);
    ps.setFormError(null);
    try {
      const payload: any = {
        name: formName,
        minAmount: formMinAmount ? Math.round(parseFloat(formMinAmount)) : 0,
        maxAmount: formMaxAmount ? Math.round(parseFloat(formMaxAmount)) : 0,
        currency: formCurrency,
        isActive: formIsActive,
      };

      if (ps.editingId) {
        await hrApi.updateCompensationBand(ps.editingId, payload);
        toast('Pay grade updated', 'success');
      } else {
        await hrApi.createCompensationBand(payload);
        toast('Pay grade created', 'success');
      }
      ps.closeModal();
      await loadData();
    } catch (err: any) {
      ps.setFormError(err?.message || 'Operation failed');
    } finally {
      ps.setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    ps.setSubmitting(true);
    try {
      await hrApi.deleteCompensationBand(ps.deletingId);
      toast('Pay grade deleted', 'success');
      ps.closeConfirmDelete();
      await loadData();
    } catch (err: any) {
      toast(err?.message || 'Failed to delete', 'error');
      ps.closeConfirmDelete();
    } finally {
      ps.setSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Name', 'Min Amount', 'Max Amount', 'Currency', 'Status'];
    const rows = payGrades.map(g => [
      g.name,
      fmtAmount(g.minAmount),
      fmtAmount(g.maxAmount),
      g.currency,
      g.isActive ? 'Active' : 'Inactive',
    ]);
    exportToCsv(headers, rows, 'pay-grades');
    toast('CSV exported', 'success');
  };

  const handleExportPdf = () => {
    const headers = ['Name', 'Min Amount', 'Max Amount', 'Currency', 'Status'];
    const rows = payGrades.map(g => [
      g.name,
      fmtAmount(g.minAmount),
      fmtAmount(g.maxAmount),
      g.currency,
      g.isActive ? 'Active' : 'Inactive',
    ]);
    exportToPdf('Pay Grades', headers, rows, 'pay-grades');
  };

  const columns: Column<PayGrade>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'minAmount', label: 'Min Amount', sortable: true, render: (i) => <span className="text-ink-600">{fmtAmount(i.minAmount)}</span> },
    { key: 'maxAmount', label: 'Max Amount', sortable: true, render: (i) => <span className="text-ink-600">{fmtAmount(i.maxAmount)}</span> },
    { key: 'currency', label: 'Currency', sortable: true, render: (i) => <span className="text-ink-600">{i.currency}</span> },
    {
      key: 'isActive', label: 'Status', render: (i) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.isActive ? 'active' : 'inactive')}`}>
          {i.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions', label: '', render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => openEdit(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ), className: 'text-right',
    },
  ];

  return (
    <HrPageShell title="Pay Grades" description="Manage compensation bands and pay grades"
      pageKey="compensation"
      headerActions={
        <>
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={handleExportPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={openCreateModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Pay Grade</button>
        </>
      }>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by name..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={statusOptions}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={filteredByStatus} keyExtractor={i => i.id} loading={loading} error={error}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={payGrades.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, payGrades.length)}
        emptyMessage="No pay grades found" emptyAction={<button onClick={openCreateModal} className="text-xs font-medium text-primary">Add your first pay grade</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Pay Grade' : 'Add Pay Grade'}
        onSubmit={handleSubmit} error={ps.formError} loading={ps.submitting}>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Name</label>
          <input value={formName} onChange={e => setFormName(e.target.value)} required
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Min Amount (₦)</label>
            <input type="number" value={formMinAmount} onChange={e => setFormMinAmount(e.target.value)} min="0"
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Max Amount (₦)</label>
            <input type="number" value={formMaxAmount} onChange={e => setFormMaxAmount(e.target.value)} min="0"
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Currency</label>
          <input value={formCurrency} onChange={e => setFormCurrency(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formIsActive} onChange={e => setFormIsActive(e.target.checked)}
              className="rounded border-ink-300 text-primary focus:ring-primary/30" />
            <span className="text-sm text-ink-600">Active</span>
          </label>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete}
        title="Delete Pay Grade" message="Are you sure you want to delete this pay grade? This action cannot be undone."
        confirmLabel="Delete" variant="danger" loading={ps.submitting} />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Pay Grade Details">
        {ps.viewingId && (() => {
          const g = payGrades.find(i => i.id === ps.viewingId)!;
          return (
            <div className="space-y-4 text-sm text-ink-600">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-ink-400 text-xs">Name</p><p className="font-medium text-ink-900">{g.name}</p></div>
                <div><p className="text-ink-400 text-xs">Currency</p><p className="font-medium text-ink-900">{g.currency}</p></div>
                <div><p className="text-ink-400 text-xs">Min Amount</p><p className="font-semibold text-ink-900">{fmtAmount(g.minAmount)}</p></div>
                <div><p className="text-ink-400 text-xs">Max Amount</p><p className="font-semibold text-ink-900">{fmtAmount(g.maxAmount)}</p></div>
                <div><p className="text-ink-400 text-xs">Status</p><p className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(g.isActive ? 'active' : 'inactive')}`}>{g.isActive ? 'Active' : 'Inactive'}</p></div>
              </div>
              <div><p className="text-ink-400 text-xs">Created</p><p className="font-medium text-ink-900">{new Date(g.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
            </div>
          );
        })()}
      </HrViewDrawer>
    </HrPageShell>
  );
}