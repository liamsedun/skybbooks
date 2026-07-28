import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus, Download, Upload, FileText, Edit3, Trash2, Eye, CheckCircle2, XCircle, Clock, Send, Ban } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor, formatDate, handleFileUpload, parseCsv } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

export function JobOpeningsPage() {
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobOpenings, setJobOpenings] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const departmentRef = useRef<HTMLSelectElement>(null);
  const designationRef = useRef<HTMLSelectElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const requirementsRef = useRef<HTMLTextAreaElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const employmentTypeRef = useRef<HTMLSelectElement>(null);
  const salaryRangeRef = useRef<HTMLInputElement>(null);
  const openingsRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const closesAtRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [jobsRes, deptsRes, desigsRes] = await Promise.all([
          hrApi.getJobOpenings(),
          hrApi.getDepartments(),
          hrApi.getDesignations(),
        ]);
        setJobOpenings(jobsRes.data || []);
        setDepartments(deptsRes.data || []);
        setDesignations(desigsRes.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const pageState = useHrPageState({
    data: jobOpenings,
    initialSortKey: 'title',
    searchKeys: ['title', 'department', 'location'],
    pageSize: 10,
  });

  const { filtered } = pageState;

  const statusFiltered = useMemo(() => {
    if (pageState.statusFilter === 'all') return filtered;
    return filtered.filter((d: any) => d.status === pageState.statusFilter);
  }, [filtered, pageState.statusFilter]);

  const paginated = useMemo(() => {
    const start = (pageState.page - 1) * pageState.pageSize;
    return statusFiltered.slice(start, start + pageState.pageSize);
  }, [statusFiltered, pageState.page, pageState.pageSize]);

  const stats = useMemo(() => [
    { label: 'Total Jobs', value: jobOpenings.length, icon: <Briefcase className="w-4 h-4" />, color: 'blue' as const, active: pageState.statusFilter === 'all', onClick: () => pageState.setStatusFilter('all') },
    { label: 'Open', value: jobOpenings.filter((i: any) => i.status === 'open').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: pageState.statusFilter === 'open', onClick: () => pageState.setStatusFilter('open') },
    { label: 'Closed', value: jobOpenings.filter((i: any) => i.status === 'closed').length, icon: <XCircle className="w-4 h-4" />, color: 'rose' as const, active: pageState.statusFilter === 'closed', onClick: () => pageState.setStatusFilter('closed') },
    { label: 'Draft', value: jobOpenings.filter((i: any) => i.status === 'draft').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: pageState.statusFilter === 'draft', onClick: () => pageState.setStatusFilter('draft') },
  ], [jobOpenings, pageState.statusFilter]);

  const columns: Column<any>[] = [
    {
      key: 'title',
      label: 'Job Title',
      sortable: true,
      render: (i: any) => <span className="font-medium text-ink-900">{i.title}</span>,
    },
    {
      key: 'department',
      label: 'Department',
      sortable: true,
      render: (i: any) => <span className="text-ink-600">{i.department || i.departmentName || '-'}</span>,
    },
    {
      key: 'location',
      label: 'Location',
      sortable: true,
      render: (i: any) => <span className="text-ink-600">{i.location || '-'}</span>,
    },
    {
      key: 'employmentType',
      label: 'Employment Type',
      sortable: true,
      render: (i: any) => <span className="text-ink-600">{i.employmentType}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (i: any) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>
          {i.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (i: any) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => pageState.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => pageState.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => pageState.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {i.status === 'draft' && (
            <button onClick={() => handlePublish(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors" title="Publish">
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
          {i.status === 'open' && (
            <button onClick={() => handleClose(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Close">
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
      className: 'text-right',
    },
  ];

  const viewingItem = pageState.viewingId ? jobOpenings.find((i: any) => i.id === pageState.viewingId) : null;
  const editItem = pageState.editingId ? jobOpenings.find((i: any) => i.id === pageState.editingId) : null;

  const totalPages = Math.max(1, Math.ceil(statusFiltered.length / pageState.pageSize));

  const handlePublish = async (id: string) => {
    try {
      await hrApi.publishJobOpening(id);
      showSuccess('Job opening published');
      refresh();
    } catch (err: any) {
      showError(err.message || 'Failed to publish');
    }
  };

  const handleClose = async (id: string) => {
    try {
      await hrApi.closeJobOpening(id);
      showSuccess('Job opening closed');
      refresh();
    } catch (err: any) {
      showError(err.message || 'Failed to close');
    }
  };

  const handleDelete = async () => {
    const id = pageState.deletingId;
    if (!id) return;
    setDeleting(true);
    try {
      await hrApi.deleteJobOpening(id);
      showSuccess('Job opening deleted');
      pageState.closeConfirmDelete();
      refresh();
    } catch (err: any) {
      showError(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        title: titleRef.current?.value,
        departmentId: departmentRef.current?.value,
        designationId: designationRef.current?.value,
        description: descriptionRef.current?.value,
        requirements: requirementsRef.current?.value,
        location: locationRef.current?.value,
        employmentType: employmentTypeRef.current?.value,
        salaryRange: salaryRangeRef.current?.value,
        openings: parseInt(openingsRef.current?.value || '1', 10),
        status: statusRef.current?.value,
        closesAt: closesAtRef.current?.value || null,
      };
      if (pageState.editingId) {
        await hrApi.updateJobOpening(pageState.editingId, payload);
        showSuccess('Job opening updated');
      } else {
        await hrApi.createJobOpening(payload);
        showSuccess('Job opening created');
      }
      pageState.closeModal();
      refresh();
    } catch (err: any) {
      showError(err.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const refresh = async () => {
    try {
      const res = await hrApi.getJobOpenings();
      setJobOpenings(res.data || []);
    } catch {
      // silent
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      ['Title', 'Department', 'Location', 'Employment Type', 'Salary Range', 'Openings', 'Status', 'Closes At'],
      statusFiltered.map((i: any) => [
        i.title,
        i.department || i.departmentName || '',
        i.location || '',
        i.employmentType || '',
        i.salaryRange || '',
        String(i.openings ?? ''),
        i.status,
        i.closesAt ? formatDate(i.closesAt) : '',
      ]),
      'job-openings'
    );
    showSuccess('CSV exported');
  };

  const handleExportPdf = () => {
    exportToPdf(
      'Job Openings',
      ['Title', 'Department', 'Location', 'Type', 'Status'],
      statusFiltered.map((i: any) => [
        i.title,
        i.department || i.departmentName || '',
        i.location || '',
        i.employmentType || '',
        i.status,
      ]),
      'job-openings'
    );
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const text = await handleFileUpload(e);
      const rows = parseCsv(text);
      if (rows.length < 2) {
        showError('CSV must have a header row and at least one data row');
        return;
      }
      const headers = rows[0];
      const dataRows = rows.slice(1);
      let imported = 0;
      for (const row of dataRows) {
        const entry: Record<string, any> = {};
        headers.forEach((h, idx) => {
          const val = row[idx]?.trim() || '';
          if (val) entry[h.trim()] = val;
        });
        await hrApi.createJobOpening(entry);
        imported++;
      }
      showSuccess(`${imported} job openings imported`);
      refresh();
    } catch (err: any) {
      showError(err.message || 'Import failed');
    }
  };

  return (
    <HrPageShell title="Job Openings" description="Manage job openings and track applicants"
      pageKey="jobs"
      headerActions={
        <>
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={handleExportPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Upload className="w-3.5 h-3.5" /> Import</button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
          <button onClick={() => { pageState.openAddModal(); }} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> New Job</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />

      <HrFilterBar search={pageState.search} onSearchChange={pageState.setSearch} searchPlaceholder="Search by title, department or location..."
        statusFilter={pageState.statusFilter} onStatusChange={pageState.setStatusFilter}
        statusOptions={[
          { label: 'All', value: 'all' },
          { label: 'Open', value: 'open' },
          { label: 'Closed', value: 'closed' },
          { label: 'Draft', value: 'draft' },
        ]}
        onClear={pageState.clearFilters} hasActiveFilters={pageState.hasActiveFilters} />

      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        loading={loading} error={error}
        sortKey={pageState.sortKey as string} sortDir={pageState.sortDir} onSort={(k) => pageState.handleSort(k as any)}
        selectedIds={pageState.selectedIds} onSelectOne={pageState.handleSelectOne} onSelectAll={pageState.handleSelectAll}
        page={pageState.page} totalPages={totalPages} onPageChange={pageState.setPage} pageSize={pageState.pageSize} totalItems={statusFiltered.length}
        from={(pageState.page - 1) * pageState.pageSize + 1} to={Math.min(pageState.page * pageState.pageSize, statusFiltered.length)}
        onRowClick={(i) => pageState.openViewDrawer(i.id)}
        emptyMessage="No job openings found"
        emptyAction={<button onClick={() => { pageState.openAddModal(); }} className="text-xs font-medium text-primary hover:text-primary-hover">Create a job opening</button>} />

      <HrFormModal open={pageState.modalOpen} onClose={pageState.closeModal}
        title={pageState.editingId ? 'Edit Job Opening' : 'New Job Opening'}
        onSubmit={handleSubmit} loading={submitting} submitLabel={pageState.editingId ? 'Update' : 'Create'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-500 mb-1">Job Title *</label>
            <input ref={titleRef} defaultValue={editItem?.title || ''} required
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="e.g. Senior Accountant" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Department *</label>
            <select ref={departmentRef} defaultValue={editItem?.departmentId || ''} required
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">Select department</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Designation</label>
            <select ref={designationRef} defaultValue={editItem?.designationId || ''}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">Select designation</option>
              {designations.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name || d.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Location *</label>
            <input ref={locationRef} defaultValue={editItem?.location || ''} required
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="e.g. Lagos" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Employment Type *</label>
            <select ref={employmentTypeRef} defaultValue={editItem?.employmentType || 'Full-time'} required
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
              <option value="Remote">Remote</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Salary Range</label>
            <input ref={salaryRangeRef} defaultValue={editItem?.salaryRange || ''}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="e.g. ₦5M - ₦8M" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Number of Openings *</label>
            <input ref={openingsRef} type="number" min="1" defaultValue={editItem?.openings ?? 1} required
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Status</label>
            <select ref={statusRef} defaultValue={editItem?.status || 'draft'}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Closing Date</label>
            <input ref={closesAtRef} type="date" defaultValue={editItem?.closesAt ? editItem.closesAt.split('T')[0] : ''}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-500 mb-1">Description</label>
            <textarea ref={descriptionRef} defaultValue={editItem?.description || ''} rows={3}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="Job description..." />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-500 mb-1">Requirements</label>
            <textarea ref={requirementsRef} defaultValue={editItem?.requirements || ''} rows={3}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="Job requirements..." />
          </div>
        </div>
      </HrFormModal>

      <HrConfirmDialog open={pageState.confirmOpen} onClose={pageState.closeConfirmDelete}
        onConfirm={handleDelete} loading={deleting}
        title="Delete Job Opening"
        message="Are you sure you want to delete this job opening? This action cannot be undone."
        confirmLabel="Delete" variant="danger" />

      <HrViewDrawer open={pageState.viewDrawerOpen} onClose={pageState.closeViewDrawer}
        title={viewingItem?.title || 'Job Opening Details'}>
        {viewingItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-ink-50 dark:bg-ink-800/50 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink-900 truncate">{viewingItem.title}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(viewingItem.status)}`}>
                  {viewingItem.status}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Department</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.department || viewingItem.departmentName || '-'}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Location</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.location || '-'}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Employment Type</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.employmentType || '-'}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Salary Range</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.salaryRange || '-'}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Openings</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.openings ?? '-'}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Closing Date</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.closesAt ? formatDate(viewingItem.closesAt) : '-'}</p>
              </div>
            </div>
            {viewingItem.description && (
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-ink-700 whitespace-pre-wrap">{viewingItem.description}</p>
              </div>
            )}
            {viewingItem.requirements && (
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Requirements</p>
                <p className="text-sm text-ink-700 whitespace-pre-wrap">{viewingItem.requirements}</p>
              </div>
            )}
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}
