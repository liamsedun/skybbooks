import { useState, useEffect, useMemo, FormEvent } from 'react';
import { Plus, Download, FileText, Edit3, Trash2, Eye, Percent, Coins, CheckCircle, XCircle, DollarSign, SlidersHorizontal } from 'lucide-react';
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

interface DeductionItem {
  id: string;
  name: string;
  type: string;
  amount: number | null;
  percentage: string | null;
  isMandatory: boolean;
  isActive: boolean;
  createdAt: string;
}

function fmtNaira(kobo: number | null) {
  if (kobo === null || kobo === undefined) return '—';
  return '₦' + (kobo / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPercent(val: string | null) {
  if (!val) return '—';
  const n = parseFloat(val);
  return isNaN(n) ? val : n + '%';
}

export function DeductionsPage() {
  const { toast } = useToast();
  const [deductions, setDeductions] = useState<DeductionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('statutory');
  const [formAmount, setFormAmount] = useState('');
  const [formPercentage, setFormPercentage] = useState('');
  const [formIsMandatory, setFormIsMandatory] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hrApi.getDeductions();
      setDeductions(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load deductions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const ps = useHrPageState({
    data: deductions,
    initialSortKey: 'name',
    searchKeys: ['name', 'type'],
    pageSize: 10,
  });

  const filteredByType = useMemo(() => {
    if (ps.statusFilter === 'all') return ps.paginated;
    return ps.paginated.filter(i => i.type === ps.statusFilter);
  }, [ps.paginated, ps.statusFilter]);

  const stats = useMemo(() => [
    { label: 'Total Deductions', value: deductions.length, icon: <Coins className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: deductions.filter(i => i.isActive).length, icon: <CheckCircle className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Mandatory', value: deductions.filter(i => i.isMandatory).length, icon: <SlidersHorizontal className="w-4 h-4" />, color: 'purple' as const, active: ps.statusFilter === 'mandatory', onClick: () => ps.setStatusFilter('mandatory') },
    { label: 'Optional', value: deductions.filter(i => !i.isMandatory).length, icon: <SlidersHorizontal className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'optional', onClick: () => ps.setStatusFilter('optional') },
  ], [deductions, ps.statusFilter]);

  const statusOptions = [
    { label: 'All', value: 'all' },
    { label: 'Statutory', value: 'statutory' },
    { label: 'Voluntary', value: 'voluntary' },
    { label: 'Other', value: 'other' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'Mandatory', value: 'mandatory' },
    { label: 'Optional', value: 'optional' },
  ];

  const resetForm = () => {
    setFormName('');
    setFormType('statutory');
    setFormAmount('');
    setFormPercentage('');
    setFormIsMandatory(false);
    setFormIsActive(true);
    ps.setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    ps.openAddModal();
  };

  const openEdit = (id: string) => {
    const item = deductions.find(i => i.id === id);
    if (!item) return;
    setFormName(item.name);
    setFormType(item.type);
    setFormAmount(item.amount !== null ? String(item.amount / 100) : '');
    setFormPercentage(item.percentage || '');
    setFormIsMandatory(item.isMandatory);
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
        type: formType,
        isMandatory: formIsMandatory,
        isActive: formIsActive,
      };
      if (formAmount) payload.amount = Math.round(parseFloat(formAmount) * 100);
      if (formPercentage) payload.percentage = formPercentage;

      if (ps.editingId) {
        await hrApi.updateDeduction(ps.editingId, payload);
        toast('Deduction updated', 'success');
      } else {
        await hrApi.createDeduction(payload);
        toast('Deduction created', 'success');
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
      await hrApi.deleteDeduction(ps.deletingId);
      toast('Deduction deleted', 'success');
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
    const headers = ['Name', 'Type', 'Amount', 'Percentage', 'Mandatory', 'Status'];
    const rows = deductions.map(d => [
      d.name,
      d.type,
      fmtNaira(d.amount),
      fmtPercent(d.percentage),
      d.isMandatory ? 'Yes' : 'No',
      d.isActive ? 'Active' : 'Inactive',
    ]);
    exportToCsv(headers, rows, 'deductions');
    toast('CSV exported', 'success');
  };

  const handleExportPdf = () => {
    const headers = ['Name', 'Type', 'Amount', 'Percentage', 'Mandatory', 'Status'];
    const rows = deductions.map(d => [
      d.name,
      d.type,
      fmtNaira(d.amount),
      fmtPercent(d.percentage),
      d.isMandatory ? 'Yes' : 'No',
      d.isActive ? 'Active' : 'Inactive',
    ]);
    exportToPdf('Deductions', headers, rows, 'deductions');
  };

  const columns: Column<DeductionItem>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    {
      key: 'type', label: 'Type', sortable: true, render: (i) => {
        const colors: Record<string, string> = {
          statutory: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
          voluntary: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
          other: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
        };
        return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${colors[i.type] || colors.other}`}>{i.type}</span>;
      },
    },
    { key: 'amount', label: 'Amount', render: (i) => <span className="text-ink-600">{fmtNaira(i.amount)}</span> },
    { key: 'percentage', label: 'Percentage', render: (i) => <span className="text-ink-600">{fmtPercent(i.percentage)}</span> },
    {
      key: 'isMandatory', label: 'Mandatory', render: (i) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${i.isMandatory ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
          {i.isMandatory ? 'Yes' : 'No'}
        </span>
      ),
    },
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
    <HrPageShell title="Deductions" description="Manage payroll deductions — statutory, voluntary, and other deductions"
      pageKey="compensation"
      headerActions={
        <>
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={handleExportPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={openCreateModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Deduction</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by name or type..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={statusOptions}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={filteredByType} keyExtractor={i => i.id} loading={loading} error={error}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={deductions.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, deductions.length)}
        emptyMessage="No deductions found" emptyAction={<button onClick={openCreateModal} className="text-xs font-medium text-primary">Add your first deduction</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Deduction' : 'Add Deduction'}
        onSubmit={handleSubmit} error={ps.formError} loading={ps.submitting}>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Name</label>
          <input value={formName} onChange={e => setFormName(e.target.value)} required
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Type</label>
          <select value={formType} onChange={e => setFormType(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
            <option value="statutory">Statutory</option>
            <option value="voluntary">Voluntary</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Amount (₦)</label>
            <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} min="0" step="0.01"
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Percentage (%)</label>
            <input type="number" value={formPercentage} onChange={e => setFormPercentage(e.target.value)} min="0" step="0.01"
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formIsMandatory} onChange={e => setFormIsMandatory(e.target.checked)}
              className="rounded border-ink-300 text-primary focus:ring-primary/30" />
            <span className="text-sm text-ink-600">Mandatory</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formIsActive} onChange={e => setFormIsActive(e.target.checked)}
              className="rounded border-ink-300 text-primary focus:ring-primary/30" />
            <span className="text-sm text-ink-600">Active</span>
          </label>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete}
        title="Delete Deduction" message="Are you sure you want to delete this deduction? This action cannot be undone."
        confirmLabel="Delete" variant="danger" loading={ps.submitting} />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Deduction Details">
        {ps.viewingId && (() => {
          const d = deductions.find(i => i.id === ps.viewingId)!;
          return (
            <div className="space-y-4 text-sm text-ink-600">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-ink-400 text-xs">Name</p><p className="font-medium text-ink-900">{d.name}</p></div>
                <div><p className="text-ink-400 text-xs">Type</p><p className="font-medium text-ink-900 capitalize">{d.type}</p></div>
                <div><p className="text-ink-400 text-xs">Amount</p><p className="font-semibold text-ink-900">{fmtNaira(d.amount)}</p></div>
                <div><p className="text-ink-400 text-xs">Percentage</p><p className="font-medium text-ink-900">{fmtPercent(d.percentage)}</p></div>
                <div><p className="text-ink-400 text-xs">Mandatory</p><p className="font-medium text-ink-900">{d.isMandatory ? 'Yes' : 'No'}</p></div>
                <div><p className="text-ink-400 text-xs">Status</p><p className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(d.isActive ? 'active' : 'inactive')}`}>{d.isActive ? 'Active' : 'Inactive'}</p></div>
              </div>
              <div><p className="text-ink-400 text-xs">Created</p><p className="font-medium text-ink-900">{new Date(d.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
            </div>
          );
        })()}
      </HrViewDrawer>
    </HrPageShell>
  );
}
