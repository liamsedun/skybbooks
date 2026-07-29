import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, X, Save, Loader2 } from 'lucide-react';
import { hrApi } from '../../../lib/api';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { useToast } from '../../../contexts/ToastContext';

interface JobOpening {
  id: string;
  title: string;
  department: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobOpeningId: string;
  source: string;
  currentEmployer: string;
  currentPosition: string;
  expectedSalary: string;
  resumeUrl: string;
  coverLetter: string;
  notes: string;
}

const emptyForm: FormData = {
  firstName: '', lastName: '', email: '', phone: '',
  jobOpeningId: '', source: '',
  currentEmployer: '', currentPosition: '',
  expectedSalary: '', resumeUrl: '', coverLetter: '', notes: '',
};

const SOURCES = ['LinkedIn', 'Indeed', 'Referral', 'Company Website', 'Job Fair', 'Agency', 'Other'];

export function AddCandidatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    hrApi.getJobOpenings({ status: 'open' })
      .then((res: any) => {
        const data = res?.data ?? res ?? [];
        setJobOpenings(Array.isArray(data) ? data : []);
      })
      .catch(() => toast('Failed to load job openings', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.firstName.trim()) errs.firstName = 'Required';
    if (!form.lastName.trim()) errs.lastName = 'Required';
    if (!form.email.trim()) errs.email = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        source: form.source || undefined,
        currentEmployer: form.currentEmployer.trim() || undefined,
        currentPosition: form.currentPosition.trim() || undefined,
        expectedSalary: form.expectedSalary ? Math.round(parseFloat(form.expectedSalary) * 100) : undefined,
        resumeUrl: form.resumeUrl.trim() || undefined,
        coverLetter: form.coverLetter.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (form.jobOpeningId) payload.jobOpeningId = form.jobOpeningId;
      await hrApi.createCandidate(payload);
      toast('Candidate added successfully', 'success');
      navigate('/app/hr/recruitment/candidates');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to create candidate';
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    if (errors[key]) setErrors(prev => { const { [key]: _, ...rest } = prev; return rest; });
  };

  return (
    <HrPageShell title="Add Candidate" description="Register a new candidate in the recruitment pipeline"
      pageKey="add-candidate"
      headerActions={<>
        <button onClick={() => navigate('/app/hr/recruitment/candidates')} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><X className="w-3.5 h-3.5" />Cancel</button>
        <button onClick={handleSubmit} disabled={submitting} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Save Candidate</button>
      </>}>
      <form onSubmit={handleSubmit} className="max-w-3xl">
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><UserPlus className="w-5 h-5" /></div>
            <div><h2 className="text-sm font-semibold text-ink-900">Personal Information</h2><p className="text-xs text-ink-400">Candidate's basic details</p></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-ink-500 mb-1">First Name <span className="text-rose-400">*</span></label>
              <input value={form.firstName} onChange={set('firstName')} className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${errors.firstName ? 'border-rose-300' : 'border-border-custom'}`} placeholder="e.g. Chioma" />
              {errors.firstName && <p className="text-xs text-rose-500 mt-1">{errors.firstName}</p>}
            </div>
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Last Name <span className="text-rose-400">*</span></label>
              <input value={form.lastName} onChange={set('lastName')} className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${errors.lastName ? 'border-rose-300' : 'border-border-custom'}`} placeholder="e.g. Okafor" />
              {errors.lastName && <p className="text-xs text-rose-500 mt-1">{errors.lastName}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Email <span className="text-rose-400">*</span></label>
              <input type="email" value={form.email} onChange={set('email')} className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${errors.email ? 'border-rose-300' : 'border-border-custom'}`} placeholder="e.g. chioma@example.com" />
              {errors.email && <p className="text-xs text-rose-500 mt-1">{errors.email}</p>}
            </div>
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Phone</label>
              <input value={form.phone} onChange={set('phone')} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. +234 801 234 5678" />
            </div>
          </div>
          <div className="flex items-center gap-3 pb-4 pt-2 border-b border-border-custom">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600"><UserPlus className="w-5 h-5" /></div>
            <div><h2 className="text-sm font-semibold text-ink-900">Job Details</h2><p className="text-xs text-ink-400">Position and referral source</p></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Job Opening</label>
              <select value={form.jobOpeningId} onChange={set('jobOpeningId')} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                <option value="">Select job opening</option>
                {jobOpenings.map(j => <option key={j.id} value={j.id}>{j.title}{j.department ? ` (${j.department})` : ''}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Source</label>
              <select value={form.source} onChange={set('source')} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                <option value="">Select source</option>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Current Employer</label>
              <input value={form.currentEmployer} onChange={set('currentEmployer')} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Acme Corp" />
            </div>
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Current Position</label>
              <input value={form.currentPosition} onChange={set('currentPosition')} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Senior Accountant" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Expected Salary (?)</label>
              <input type="number" value={form.expectedSalary} onChange={set('expectedSalary')} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. 5000000" />
            </div>
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Resume URL</label>
              <input value={form.resumeUrl} onChange={set('resumeUrl')} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Link to resume / CV" />
            </div>
          </div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Cover Letter</label>
            <textarea value={form.coverLetter} onChange={set('coverLetter')} rows={4} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder="Cover letter or personal statement..." />
          </div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder="Interview notes, skills, remarks..." />
          </div>
        </div>
      </form>
    </HrPageShell>
  );
}
