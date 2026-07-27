import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ArrowLeft, Save, X } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { useToast } from '../../../contexts/ToastContext';

interface CandidateForm {
  firstName: string; lastName: string; email: string; phone: string; position: string; department: string; source: string; resume: string; notes: string;
}

const emptyForm: CandidateForm = { firstName: '', lastName: '', email: '', phone: '', position: '', department: '', source: '', resume: '', notes: '' };

export function AddCandidatePage() {
  const navigate = useNavigate();
  const { success } = useToast();
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof CandidateForm, string>>>({});

  const depts = ['Engineering', 'Finance', 'Human Resources', 'Marketing', 'Operations', 'Sales', 'Support'];
  const positions = ['Senior Accountant', 'Software Engineer', 'HR Manager', 'Graphic Designer', 'Sales Representative', 'Data Analyst', 'Customer Support Lead'];
  const sources = ['LinkedIn', 'Indeed', 'Referral', 'Company Website', 'JobFair', 'Agency', 'Other'];

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.firstName.trim()) errs.firstName = 'Required';
    if (!form.lastName.trim()) errs.lastName = 'Required';
    if (!form.email.trim()) errs.email = 'Required';
    if (!form.position.trim()) errs.position = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    success('Candidate added successfully');
    navigate('/app/hr/recruitment/candidates');
  };

  const set = (key: keyof CandidateForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    if (errors[key]) setErrors(prev => { const { [key]: _, ...rest } = prev; return rest; });
  };

  return (
    <HrPageShell title="Add Candidate" description="Register a new candidate in the recruitment pipeline"
      pageKey="add-candidate"
      headerActions={<>
        <button onClick={() => navigate(-1)} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><X className="w-3.5 h-3.5" />Cancel</button>
        <button onClick={handleSubmit} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"><Save className="w-3.5 h-3.5" />Save Candidate</button>
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
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Position <span className="text-rose-400">*</span></label>
              <select value={form.position} onChange={set('position')} className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${errors.position ? 'border-rose-300' : 'border-border-custom'}`}>
                <option value="">Select position</option>
                {positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.position && <p className="text-xs text-rose-500 mt-1">{errors.position}</p>}
            </div>
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Department</label>
              <select value={form.department} onChange={set('department')} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                <option value="">Select department</option>
                {depts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Source</label>
              <select value={form.source} onChange={set('source')} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                <option value="">Select source</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Resume / CV</label>
              <input value={form.resume} onChange={set('resume')} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Link or file name" />
            </div>
          </div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder="Interview notes, skills, remarks..." />
          </div>
        </div>
      </form>
    </HrPageShell>
  );
}


