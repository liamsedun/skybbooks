import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Download, Upload, FileText, Search, Edit3, Trash2, Eye, CheckCircle2, XCircle, Clock, UserPlus, Calendar, Award, Mail, DollarSign } from 'lucide-react';
import { hrApi } from '../../../lib/api';
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

interface Application {
  id: string;
  jobOpeningId: string;
  status: string;
  score: number | null;
  feedback: string | null;
  interviewDate: string | null;
  interviewers: string[] | null;
  offerAmount: number | null;
  offerSentAt: string | null;
  offerAcceptedAt: string | null;
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
  jobTitle: string;
}

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: string;
  currentEmployer: string | null;
  currentPosition: string | null;
  expectedSalary: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  latestApplication: {
    id: string;
    job_opening_id: string;
    status: string;
    score: number | null;
    interview_date: string | null;
    interviewers: string[] | null;
    offer_amount: number | null;
    offer_sent_at: string | null;
    created_at: string;
  } | null;
  applications?: Application[];
}

interface JobOpening {
  id: string;
  title: string;
}

type StatusFilter = 'all' | 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Screening', value: 'screening' },
  { label: 'Interview', value: 'interview' },
  { label: 'Offer', value: 'offer' },
  { label: 'Hired', value: 'hired' },
  { label: 'Rejected', value: 'rejected' },
];

export function CandidatesPage() {
  const navigate = useNavigate();const { toast } = useToast();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [candidateDetail, setCandidateDetail] = useState<Candidate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', source: '',
    currentEmployer: '', currentPosition: '', expectedSalary: '', notes: '', jobOpeningId: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<string, string>>>({});

  const [interviewModalOpen, setInterviewModalOpen] = useState(false);
  const [interviewAppId, setInterviewAppId] = useState<string | null>(null);
  const [interviewData, setInterviewData] = useState({ interviewDate: '', interviewers: '' });

  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerAppId, setOfferAppId] = useState<string | null>(null);
  const [offerAmount, setOfferAmount] = useState('');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const nameSearch = useMemo(() => candidates.map(c => ({
    ...c,
    name: `${c.firstName} ${c.lastName}`,
    position: c.latestApplication ? (c as any).latestApplication?.jobTitle || c.currentPosition || '' : c.currentPosition || '',
    status: c.latestApplication?.status || 'new',
    source: c.source || '',
  })), [candidates]);

  const statusFiltered = useMemo(() => {
    if (statusFilter === 'all') return nameSearch;
    return nameSearch.filter(c => {
      const s = c.latestApplication?.status || 'new';
      return s === statusFilter;
    });
  }, [nameSearch, statusFilter]);

  const ps = useHrPageState({
    data: statusFiltered as any[],
    initialSortKey: 'name' as any,
    searchKeys: ['name', 'email'],
    pageSize: 10,
  });

  const { filtered, paginated } = ps;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setFetchError(null);
    try {
      const [candRes, jobsRes] = await Promise.all([
        hrApi.getCandidates(),
        hrApi.getJobOpenings(),
      ]);
      setCandidates(candRes.data || []);
      setJobOpenings((jobsRes.data || []).map((j: any) => ({ id: j.id, title: j.title })));
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to load candidates');
    } finally {
      setLoading(false);
    }
  }

  async function loadCandidateDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await hrApi.getCandidate(id);
      setCandidateDetail(res.data || null);
    } catch {
      setCandidateDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const handleView = useCallback(async (id: string) => {
    ps.openViewDrawer(id);
    await loadCandidateDetail(id);
  }, [ps.openViewDrawer]);

  const handleEdit = useCallback((id: string) => {
    const c = candidates.find(c => c.id === id);
    if (c) {
      setFormData({
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone || '',
        source: c.source || '',
        currentEmployer: c.currentEmployer || '',
        currentPosition: c.currentPosition || '',
        expectedSalary: c.expectedSalary ? String(c.expectedSalary) : '',
        notes: c.notes || '',
        jobOpeningId: c.latestApplication?.job_opening_id || '',
      });
    }
    ps.openEditModal(id);
  }, [candidates, ps.openEditModal]);

  const handleOpenAdd = useCallback(() => {
    setFormData({ firstName: '', lastName: '', email: '', phone: '', source: '', currentEmployer: '', currentPosition: '', expectedSalary: '', notes: '', jobOpeningId: '' });
    setFormErrors({});
    ps.openAddModal();
  }, [ps.openAddModal]);

  const validateForm = () => {
    const errs: typeof formErrors = {};
    if (!formData.firstName.trim()) errs.firstName = 'Required';
    if (!formData.lastName.trim()) errs.lastName = 'Required';
    if (!formData.email.trim()) errs.email = 'Required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload: any = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim() || undefined,
      source: formData.source || undefined,
      currentEmployer: formData.currentEmployer || undefined,
      currentPosition: formData.currentPosition || undefined,
      expectedSalary: formData.expectedSalary ? Number(formData.expectedSalary) : undefined,
      notes: formData.notes || undefined,
    };

    if (formData.jobOpeningId) {
      payload.jobOpeningId = formData.jobOpeningId;
    }

    try {
      if (ps.editingId) {
        await hrApi.updateCandidate(ps.editingId, payload);
        toast('Candidate updated', 'success');
      } else {
        await hrApi.createCandidate(payload);
        toast('Candidate created', 'success');
      }
      ps.closeModal();
      await loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Operation failed';
      toast(msg, 'error');
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    try {
      await hrApi.deleteCandidate(ps.deletingId);
      toast('Candidate deleted', 'success');
      ps.closeConfirmDelete();
      await loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Delete failed';
      toast(msg, 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const text = await handleFileUpload(e);
      const rows = parseCsv(text);
      if (rows.length < 2) { toastError('CSV is empty'); return; }
      const headers = rows[0].map(h => h.toLowerCase());
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const entry: any = {};
        headers.forEach((h, idx) => {
          if (h === 'first name' || h === 'firstname') entry.firstName = row[idx];
          else if (h === 'last name' || h === 'lastname') entry.lastName = row[idx];
          else if (h === 'email') entry.email = row[idx];
          else if (h === 'phone') entry.phone = row[idx];
          else if (h === 'source') entry.source = row[idx];
        });
        if (entry.firstName && entry.email) {
          await hrApi.createCandidate(entry);
        }
      }
      toast(`Imported ${rows.length - 1} candidates`, 'success');
      ps.setImportOpen(false);
      await loadData();
    } catch {
      toastError('Import failed. Check the file format.');
    }
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewAppId || !interviewData.interviewDate) return;
    try {
      await hrApi.scheduleInterview(interviewAppId, {
        interviewDate: interviewData.interviewDate,
        interviewers: interviewData.interviewers.split(',').map(s => s.trim()).filter(Boolean),
      });
      toast('Interview scheduled', 'success');
      setInterviewModalOpen(false);
      setInterviewAppId(null);
      if (ps.viewingId) await loadCandidateDetail(ps.viewingId);
    } catch (err: any) {
      toastError(err?.response?.data?.error || 'Failed to schedule interview');
    }
  };

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerAppId || !offerAmount) return;
    try {
      await hrApi.sendOffer(offerAppId, { offerAmount: Number(offerAmount) });
      toast('Offer sent', 'success');
      setOfferModalOpen(false);
      setOfferAppId(null);
      if (ps.viewingId) await loadCandidateDetail(ps.viewingId);
    } catch (err: any) {
      toastError(err?.response?.data?.error || 'Failed to send offer');
    }
  };

  const handleUpdateStatus = async (appId: string, status: string) => {
    try {
      await hrApi.updateApplicationStatus(appId, { status });
      toast(`Status updated to ${status}`, 'success');
      if (ps.viewingId) await loadCandidateDetail(ps.viewingId);
    } catch (err: any) {
      toastError(err?.response?.data?.error || 'Failed to update status');
    }
  };

  const stats = useMemo(() => {
    const total = candidates.length;
    const newC = candidates.filter(c => (c.latestApplication?.status || 'new') === 'new').length;
    const interviewed = candidates.filter(c => c.latestApplication?.status === 'interviewed' || c.latestApplication?.status === 'interview').length;
    const hired = candidates.filter(c => c.latestApplication?.status === 'hired').length;
    return [
      { label: 'Total Candidates', value: total, icon: <Users className="w-4 h-4" />, color: 'blue' as const, active: statusFilter === 'all', onClick: () => setStatusFilter('all') },
      { label: 'New', value: newC, icon: <UserPlus className="w-4 h-4" />, color: 'cyan' as const, active: statusFilter === 'new', onClick: () => setStatusFilter('new') },
      { label: 'Interviewed', value: interviewed, icon: <Calendar className="w-4 h-4" />, color: 'amber' as const, active: statusFilter === 'interview', onClick: () => setStatusFilter('interview') },
      { label: 'Hired', value: hired, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: statusFilter === 'hired', onClick: () => setStatusFilter('hired') },
    ];
  }, [candidates, statusFilter]);

  const columns: Column<any>[] = [
    {
      key: 'name', label: 'Name', sortable: true, render: (i) => (
        <span className="font-medium text-ink-900">{i.firstName} {i.lastName}</span>
      ),
    },
    { key: 'email', label: 'Email', sortable: true, render: (i) => <span className="text-ink-500">{i.email}</span> },
    { key: 'phone', label: 'Phone', sortable: false, render: (i) => <span className="text-ink-500 text-xs">{i.phone || '�'}</span>, hideOnMobile: true },
    {
      key: 'position', label: 'Position', sortable: true, render: (i) => {
        const pos = i.latestApplication?.jobTitle || i.currentPosition || '';
        return <span className="text-ink-700 text-xs">{pos || '�'}</span>;
      },
    },
    { key: 'source', label: 'Source', sortable: true, hideOnMobile: true },
    {
      key: 'status', label: 'Status', sortable: true, render: (i) => {
        const s = i.latestApplication?.status || 'new';
        return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(s)}`}>{s}</span>;
      },
    },
    {
      key: 'actions', label: '', render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => handleView(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => handleEdit(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ), className: 'text-right',
    },
  ];

  const editItem = ps.editingId ? candidates.find(c => c.id === ps.editingId) : null;

  return (
    <HrPageShell title="Candidates" description="Track and manage job applicants through the recruitment pipeline"
      pageKey="candidates"
      headerActions={<>
        <button onClick={() => navigate('/app/hr/recruitment/candidates/add')} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Add Candidate</button>
        <button onClick={() => ps.setImportOpen(true)} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Import</button>
        <button onClick={() => exportToCsv(['First Name', 'Last Name', 'Email', 'Phone', 'Position', 'Source', 'Status'], filtered.map((i: any) => [i.firstName, i.lastName, i.email, i.phone || '', i.latestApplication?.jobTitle || i.currentPosition || '', i.source || '', i.latestApplication?.status || 'new']), 'candidates')} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by name, email..."
        statusFilter={statusFilter} onStatusChange={(v) => setStatusFilter(v as StatusFilter)}
        statusOptions={STATUS_OPTIONS}
        onClear={() => { ps.clearFilters(); setStatusFilter('all'); }} hasActiveFilters={ps.hasActiveFilters || statusFilter !== 'all'} />
      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-400 text-sm">Loading candidates...</div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-rose-500">{fetchError}</p>
          <button onClick={loadData} className="text-xs font-medium text-primary hover:text-primary-hover">Retry</button>
        </div>
      ) : (
        <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
          sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
          selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
          page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
          from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
          emptyMessage="No candidates found" emptyAction={<button onClick={() => navigate('/app/hr/recruitment/candidates/add')} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first candidate</button>} />
      )}

      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Candidate' : 'Add Candidate'} onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">First Name <span className="text-rose-400">*</span></label>
              <input value={formData.firstName} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))} className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-surface text-ink-900 ${formErrors.firstName ? 'border-rose-300' : 'border-border-custom'}`} placeholder="Chioma" />
              {formErrors.firstName && <p className="text-xs text-rose-500 mt-1">{formErrors.firstName}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">Last Name <span className="text-rose-400">*</span></label>
              <input value={formData.lastName} onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))} className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-surface text-ink-900 ${formErrors.lastName ? 'border-rose-300' : 'border-border-custom'}`} placeholder="Okafor" />
              {formErrors.lastName && <p className="text-xs text-rose-500 mt-1">{formErrors.lastName}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">Email <span className="text-rose-400">*</span></label>
              <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-surface text-ink-900 ${formErrors.email ? 'border-rose-300' : 'border-border-custom'}`} placeholder="chioma@example.com" />
              {formErrors.email && <p className="text-xs text-rose-500 mt-1">{formErrors.email}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">Phone</label>
              <input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" placeholder="+234 801 234 5678" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Source</label>
            <select value={formData.source} onChange={e => setFormData(p => ({ ...p, source: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900">
              <option value="">Select source</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Indeed">Indeed</option>
              <option value="Referral">Referral</option>
              <option value="Company Website">Company Website</option>
              <option value="JobFair">JobFair</option>
              <option value="Agency">Agency</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">Current Employer</label>
              <input value={formData.currentEmployer} onChange={e => setFormData(p => ({ ...p, currentEmployer: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" placeholder="Current company" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">Current Position</label>
              <input value={formData.currentPosition} onChange={e => setFormData(p => ({ ...p, currentPosition: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" placeholder="e.g. Senior Accountant" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Expected Salary (?)</label>
            <input type="number" value={formData.expectedSalary} onChange={e => setFormData(p => ({ ...p, expectedSalary: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" placeholder="e.g. 5000000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Job Opening (creates application)</label>
            <select value={formData.jobOpeningId} onChange={e => setFormData(p => ({ ...p, jobOpeningId: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900">
              <option value="">No application</option>
              {jobOpenings.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Notes</label>
            <textarea rows={3} value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 resize-none" placeholder="Interview notes, skills, remarks..." />
          </div>
        </div>
      </HrFormModal>

      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete} title="Delete Candidate" message="Are you sure you want to delete this candidate and all their applications?" confirmLabel="Delete" variant="danger" />

      <HrViewDrawer open={ps.viewDrawerOpen} onClose={() => { ps.closeViewDrawer(); setCandidateDetail(null); }} title="Candidate Details">
        {detailLoading ? (
          <div className="flex items-center justify-center py-12 text-ink-400 text-sm">Loading...</div>
        ) : candidateDetail ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-border-custom">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                {candidateDetail.firstName?.charAt(0)}{candidateDetail.lastName?.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{candidateDetail.firstName} {candidateDetail.lastName}</p>
                <p className="text-xs text-ink-400">{candidateDetail.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-ink-500">Phone</label><p className="text-sm font-medium text-ink-900">{candidateDetail.phone || '�'}</p></div>
              <div><label className="text-xs text-ink-500">Source</label><p className="text-sm font-medium text-ink-900">{candidateDetail.source || '�'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-ink-500">Current Employer</label><p className="text-sm font-medium text-ink-900">{candidateDetail.currentEmployer || '�'}</p></div>
              <div><label className="text-xs text-ink-500">Current Position</label><p className="text-sm font-medium text-ink-900">{candidateDetail.currentPosition || '�'}</p></div>
            </div>
            {candidateDetail.expectedSalary && (
              <div><label className="text-xs text-ink-500">Expected Salary</label><p className="text-sm font-medium text-ink-900">?{Number(candidateDetail.expectedSalary).toLocaleString()}</p></div>
            )}
            {candidateDetail.notes && (
              <div><label className="text-xs text-ink-500">Notes</label><p className="text-sm text-ink-700 whitespace-pre-wrap">{candidateDetail.notes}</p></div>
            )}
            <div><label className="text-xs text-ink-500">Created</label><p className="text-sm font-medium text-ink-900">{formatDate(candidateDetail.createdAt)}</p></div>

            {candidateDetail.applications && candidateDetail.applications.length > 0 && (
              <div className="pt-3 border-t border-border-custom">
                <h4 className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-3">Applications ({candidateDetail.applications.length})</h4>
                <div className="space-y-3">
                  {candidateDetail.applications.map(app => (
                    <div key={app.id} className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 border border-border-custom space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-ink-900">{app.jobTitle || 'Unknown Position'}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(app.status)}`}>{app.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-ink-500">
                        {app.interviewDate && <div><span className="font-medium">Interview:</span> {formatDate(app.interviewDate)}</div>}
                        {app.score !== null && <div><span className="font-medium">Score:</span> {app.score}</div>}
                        {app.offerAmount && <div><span className="font-medium">Offer:</span> ?{Number(app.offerAmount).toLocaleString()}</div>}
                        {app.offerSentAt && <div><span className="font-medium">Offer Sent:</span> {formatDate(app.offerSentAt)}</div>}
                      </div>
                      {app.feedback && <p className="text-xs text-ink-600 italic">"{app.feedback}"</p>}
                      <div className="flex items-center flex-wrap gap-1.5 pt-1">
                        <button onClick={() => { setInterviewAppId(app.id); setInterviewData({ interviewDate: '', interviewers: '' }); setInterviewModalOpen(true); }} className="px-2 py-1 text-[11px] font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors inline-flex items-center gap-1"><Calendar className="w-3 h-3" />Schedule Interview</button>
                        <button onClick={() => navigate(`/app/hr/recruitment/evaluations?applicationId=${app.id}`)} className="px-2 py-1 text-[11px] font-medium rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors inline-flex items-center gap-1"><Award className="w-3 h-3" />Add Evaluation</button>
                        <button onClick={() => { setOfferAppId(app.id); setOfferAmount(''); setOfferModalOpen(true); }} className="px-2 py-1 text-[11px] font-medium rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1"><DollarSign className="w-3 h-3" />Send Offer</button>
                        <select value="" onChange={e => { if (e.target.value) handleUpdateStatus(app.id, e.target.value); }} className="px-2 py-1 text-[11px] border border-border-custom rounded-lg bg-surface text-ink-600">
                          <option value="">Update Status</option>
                          <option value="screening">Screening</option>
                          <option value="interviewed">Interviewed</option>
                          <option value="offered">Offered</option>
                          <option value="hired">Hired</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-ink-400 text-sm">Candidate not found</div>
        )}
      </HrViewDrawer>

      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Candidates" onSubmit={(e) => { e.preventDefault(); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file with candidate records (First Name, Last Name, Email, Phone, Source).</p>
        <input type="file" accept=".csv" onChange={handleImport} className="block w-full text-sm text-ink-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
      </HrFormModal>

      <HrFormModal open={interviewModalOpen} onClose={() => { setInterviewModalOpen(false); setInterviewAppId(null); }} title="Schedule Interview" onSubmit={handleScheduleInterview}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Interview Date & Time</label>
            <input type="datetime-local" value={interviewData.interviewDate} onChange={e => setInterviewData(p => ({ ...p, interviewDate: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Interviewers (comma-separated)</label>
            <input value={interviewData.interviewers} onChange={e => setInterviewData(p => ({ ...p, interviewers: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" placeholder="e.g. John Doe, Jane Smith" />
          </div>
        </div>
      </HrFormModal>

      <HrFormModal open={offerModalOpen} onClose={() => { setOfferModalOpen(false); setOfferAppId(null); }} title="Send Offer" onSubmit={handleSendOffer}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Offer Amount (?)</label>
            <input type="number" value={offerAmount} onChange={e => setOfferAmount(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" placeholder="e.g. 6000000" />
          </div>
        </div>
      </HrFormModal>
    </HrPageShell>
  );
}
