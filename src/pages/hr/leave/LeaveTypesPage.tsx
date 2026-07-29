import { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Eye, Edit3, Trash2, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  daysPerYear: number;
  isPaid: boolean;
  requiresApproval?: boolean | null;
  carryForward?: boolean | null;
  maxCarryForward?: number | null;
  accrualRate?: string | null;
  accrualFrequency?: string | null;
  maxConsecutiveDays?: number | null;
  requiresDocumentation?: boolean | null;
  minDaysBeforeRequest?: number | null;
  color?: string | null;
  genderRestriction?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface LeaveTypeForm {
  name: string; code: string; description: string; daysPerYear: number; isPaid: boolean;
  requiresApproval: boolean; carryForward: boolean; maxCarryForward: number;
  accrualRate: string; accrualFrequency: string; maxConsecutiveDays: number;
  requiresDocumentation: boolean; minDaysBeforeRequest: number; color: string;
  genderRestriction: string; isActive: boolean;
}

const defaultForm: LeaveTypeForm = {
  name: '', code: '', description: '', daysPerYear: 0, isPaid: true,
  requiresApproval: true, carryForward: false, maxCarryForward: 0,
  accrualRate: '0', accrualFrequency: 'yearly', maxConsecutiveDays: 0,
  requiresDocumentation: false, minDaysBeforeRequest: 0, color: '#6366f1',
  genderRestriction: '', isActive: true,
};

const numberFields = new Set<keyof LeaveTypeForm>(['daysPerYear', 'maxCarryForward', 'maxConsecutiveDays', 'minDaysBeforeRequest']);

const statusClass = (active: boolean) => active
  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
  : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';

const labelClass = 'block text-xs font-medium text-ink-500 mb-1';
const inputClass = 'w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';
const selectClass = 'w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';
const checkboxClass = 'w-4 h-4 rounded border-border-custom text-primary focus:ring-primary/20';

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-ink-700 mt-1">{value}</p>
    </div>
  );
}

export function LeaveTypesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<LeaveTypeForm>(defaultForm);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getLeaveTypes();
      setData(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err: any) {
      toast(err?.message || 'Failed to load leave types', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const ps = useHrPageState({ data, initialSortKey: 'name', searchKeys: ['name', 'code'], pageSize: 10 });
  const { filtered } = ps;

  const statusFiltered = useMemo(() => {
    if (ps.statusFilter === 'all') return filtered;
    return filtered.filter(d => d.isActive === (ps.statusFilter === 'active'));
  }, [filtered, ps.statusFilter]);

  const paginatedFiltered = useMemo(() => {
    const start = (ps.page - 1) * ps.pageSize;
    return statusFiltered.slice(start, start + ps.pageSize);
  }, [statusFiltered, ps.page, ps.pageSize]);

  const stats = useMemo(() => [
    { label: 'Total Types', value: data.length, icon: <FileText className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: data.filter(i => i.isActive).length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Inactive', value: data.filter(i => !i.isActive).length, icon: <XCircle className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
  ], [data, ps.statusFilter]);

  const columns: Column<LeaveType>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'code', label: 'Code', sortable: true, render: (i) => <span className="text-ink-500 font-mono text-xs">{i.code}</span> },
    { key: 'daysPerYear', label: 'Days Per Year', sortable: true, className: 'text-center' },
    { key: 'isPaid', label: 'Is Paid', sortable: true, render: (i) => i.isPaid ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" /> : <XCircle className="w-4 h-4 text-ink-300 inline" />, className: 'text-center' },
    { key: 'carryForward', label: 'Carry Forward', sortable: true, render: (i) => i.carryForward ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" /> : <XCircle className="w-4 h-4 text-ink-300 inline" />, className: 'text-center' },
    { key: 'isActive', label: 'Status', sortable: true, render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusClass(i.isActive)}`}>{i.isActive ? 'Active' : 'Inactive'}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const viewingItem = ps.viewingId ? data.find(d => d.id === ps.viewingId) : null;

  useEffect(() => {
    if (ps.modalOpen && ps.editingId) {
      const item = data.find(d => d.id === ps.editingId);
      if (item) {
        setForm({
          name: item.name,
          code: item.code,
          description: item.description ?? '',
          daysPerYear: item.daysPerYear,
          isPaid: item.isPaid,
          requiresApproval: item.requiresApproval ?? true,
          carryForward: item.carryForward ?? false,
          maxCarryForward: item.maxCarryForward ?? 0,
          accrualRate: item.accrualRate ?? '0',
          accrualFrequency: item.accrualFrequency ?? 'yearly',
          maxConsecutiveDays: item.maxConsecutiveDays ?? 0,
          requiresDocumentation: item.requiresDocumentation ?? false,
          minDaysBeforeRequest: item.minDaysBeforeRequest ?? 0,
          color: item.color ?? '#6366f1',
          genderRestriction: item.genderRestriction ?? '',
          isActive: item.isActive,
        });
      }
    } else if (!ps.modalOpen) {
      setForm({ ...defaultForm });
    }
  }, [ps.modalOpen, ps.editingId]);

  const setField = (field: keyof LeaveTypeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const raw = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    const value = numberFields.has(field) ? Number(raw) : raw;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    ps.setFormError(null);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        description: form.description || null,
        daysPerYear: form.daysPerYear,
        isPaid: form.isPaid,
        requiresApproval: form.requiresApproval,
        carryForward: form.carryForward,
        maxCarryForward: form.maxCarryForward || 0,
        accrualRate: form.accrualRate || '0',
        accrualFrequency: form.accrualFrequency,
        maxConsecutiveDays: form.maxConsecutiveDays || 0,
        requiresDocumentation: form.requiresDocumentation,
        minDaysBeforeRequest: form.minDaysBeforeRequest || 0,
        color: form.color || '#6366f1',
        genderRestriction: form.genderRestriction || null,
        isActive: form.isActive,
      };
      if (ps.editingId) {
        await hrApi.updateLeaveType(ps.editingId, payload);
        toast('Leave type updated', 'success');
      } else {
        await hrApi.createLeaveType(payload);
        toast('Leave type created', 'success');
      }
      ps.closeModal();
      fetchData();
    } catch (err: any) {
      ps.setFormError(err?.response?.data?.error || err?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    setSubmitting(true);
    try {
      await hrApi.deleteLeaveType(ps.deletingId);
      toast('Leave type deleted', 'success');
      ps.closeConfirmDelete();
      fetchData();
    } catch (err: any) {
      toast(err?.response?.data?.error || err?.message || 'Failed to delete', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      ['Name', 'Code', 'Days Per Year', 'Is Paid', 'Carry Forward', 'Status'],
      statusFiltered.map(d => [d.name, d.code, String(d.daysPerYear), d.isPaid ? 'Yes' : 'No', d.carryForward ? 'Yes' : 'No', d.isActive ? 'Active' : 'Inactive']),
      'leave-types'
    );
    toast('Exported successfully', 'success');
  };

  const handleExportPdf = () => {
    exportToPdf(
      'Leave Types',
      ['Name', 'Code', 'Days Per Year', 'Is Paid', 'Carry Forward', 'Status'],
      statusFiltered.map(d => [d.name, d.code, String(d.daysPerYear), d.isPaid ? 'Yes' : 'No', d.carryForward ? 'Yes' : 'No', d.isActive ? 'Active' : 'Inactive']),
      'leave-types'
    );
  };

  return (
    <HrPageShell title="Leave Types" description="Configure leave types and policies"
      pageKey="leave-requests"
      headerActions={
        <>
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={handleExportPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> New Type</button>
        </>
      }>
      <HrStatCards items={stats} columns={3} />

      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by name or code..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />

      <HrDataTable columns={columns} data={paginatedFiltered} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as keyof LeaveType)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={statusFiltered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, statusFiltered.length)}
        emptyMessage="No leave types found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add a leave type</button>} />

      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Leave Type' : 'New Leave Type'}
        onSubmit={handleSubmit} error={ps.formError} loading={submitting} submitLabel={ps.editingId ? 'Update' : 'Create'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Name</label>
            <input value={form.name} onChange={setField('name')} className={inputClass} placeholder="e.g. Annual Leave" required />
          </div>
          <div>
            <label className={labelClass}>Code</label>
            <input value={form.code} onChange={setField('code')} className={inputClass} placeholder="e.g. ANN" required />
          </div>
          <div>
            <label className={labelClass}>Days Per Year</label>
            <input type="number" value={form.daysPerYear} onChange={setField('daysPerYear')} className={inputClass} min={0} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Description</label>
            <textarea value={form.description} onChange={setField('description')} className={inputClass} rows={2} placeholder="Optional description" />
          </div>
        </div>

        <div className="border-t border-border-custom pt-4">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">Policy Settings</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isPaid} onChange={setField('isPaid')} className={checkboxClass} />
              <span className="text-sm text-ink-700">Is Paid</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.requiresApproval} onChange={setField('requiresApproval')} className={checkboxClass} />
              <span className="text-sm text-ink-700">Requires Approval</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.carryForward} onChange={setField('carryForward')} className={checkboxClass} />
              <span className="text-sm text-ink-700">Carry Forward</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.requiresDocumentation} onChange={setField('requiresDocumentation')} className={checkboxClass} />
              <span className="text-sm text-ink-700">Requires Documentation</span>
            </label>
            <div>
              <label className={labelClass}>Max Carry Forward (days)</label>
              <input type="number" value={form.maxCarryForward} onChange={setField('maxCarryForward')} className={inputClass} min={0} />
            </div>
            <div>
              <label className={labelClass}>Max Consecutive Days</label>
              <input type="number" value={form.maxConsecutiveDays} onChange={setField('maxConsecutiveDays')} className={inputClass} min={0} />
            </div>
            <div>
              <label className={labelClass}>Min Days Before Request</label>
              <input type="number" value={form.minDaysBeforeRequest} onChange={setField('minDaysBeforeRequest')} className={inputClass} min={0} />
            </div>
          </div>
        </div>

        <div className="border-t border-border-custom pt-4">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">Accrual</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Accrual Rate</label>
              <input type="text" value={form.accrualRate} onChange={setField('accrualRate')} className={inputClass} placeholder="0" />
            </div>
            <div>
              <label className={labelClass}>Accrual Frequency</label>
              <select value={form.accrualFrequency} onChange={setField('accrualFrequency')} className={selectClass}>
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-border-custom pt-4">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">Restrictions &amp; Appearance</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Gender Restriction</label>
              <select value={form.genderRestriction} onChange={setField('genderRestriction')} className={selectClass}>
                <option value="">None</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={setField('color')} className="w-9 h-9 rounded-lg border border-border-custom cursor-pointer" />
                <input value={form.color} onChange={setField('color')} className={inputClass} placeholder="#6366f1" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-6">
              <input type="checkbox" checked={form.isActive} onChange={setField('isActive')} className={checkboxClass} />
              <span className="text-sm text-ink-700">Active</span>
            </label>
          </div>
        </div>
      </HrFormModal>

      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete}
        title="Delete Leave Type" message="Are you sure you want to delete this leave type? This action cannot be undone."
        confirmLabel="Delete" variant="danger" loading={submitting} />

      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title={viewingItem?.name || 'Leave Type Details'}>
        {viewingItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-ink-50 dark:bg-ink-800/50 rounded-2xl">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: viewingItem.color || '#6366f1' }}>
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-ink-900">{viewingItem.name}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusClass(viewingItem.isActive)}`}>
                  {viewingItem.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DetailBox label="Code" value={viewingItem.code} />
              <DetailBox label="Days Per Year" value={String(viewingItem.daysPerYear)} />
              <DetailBox label="Is Paid" value={viewingItem.isPaid ? 'Yes' : 'No'} />
              <DetailBox label="Carry Forward" value={viewingItem.carryForward ? 'Yes' : 'No'} />
              <DetailBox label="Requires Approval" value={viewingItem.requiresApproval ? 'Yes' : 'No'} />
              <DetailBox label="Requires Documentation" value={viewingItem.requiresDocumentation ? 'Yes' : 'No'} />
              <DetailBox label="Max Carry Forward" value={viewingItem.maxCarryForward != null ? `${viewingItem.maxCarryForward} days` : 'None'} />
              <DetailBox label="Max Consecutive Days" value={viewingItem.maxConsecutiveDays != null ? String(viewingItem.maxConsecutiveDays) : 'Unlimited'} />
              <DetailBox label="Min Days Before Request" value={viewingItem.minDaysBeforeRequest != null ? String(viewingItem.minDaysBeforeRequest) : 'None'} />
              <DetailBox label="Accrual Rate" value={viewingItem.accrualRate ?? '0'} />
              <DetailBox label="Accrual Frequency" value={viewingItem.accrualFrequency === 'yearly' ? 'Yearly' : 'Monthly'} />
              <DetailBox label="Gender Restriction" value={viewingItem.genderRestriction ? viewingItem.genderRestriction.charAt(0).toUpperCase() + viewingItem.genderRestriction.slice(1) : 'None'} />
            </div>
            {viewingItem.description && (
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-ink-700">{viewingItem.description}</p>
              </div>
            )}
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}
