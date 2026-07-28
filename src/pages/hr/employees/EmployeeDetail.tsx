import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit3, Users, UserCheck, UserX, Mail, Phone, Calendar, Building, BadgeInfo, Briefcase, MapPin,
  Heart, BookOpen, Briefcase as BriefcaseIcon, Award, Activity, Clock, ArrowUpRight, CheckCheck, Ban, LogOut,
  RefreshCw, RotateCcw, GraduationCap, Stethoscope, FileText, Shield, X, Loader2
} from 'lucide-react';
import { hrApi } from '../../../lib/api';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { statusColor, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number | null | undefined }) {
  const display = value != null && value !== '' ? String(value) : '-';
  return (
    <div className="flex items-start gap-3 p-4 bg-ink-50 dark:bg-ink-800/50 rounded-2xl border border-border-custom">
      <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-ink-900 mt-0.5 break-words">{display}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Grid({ cols = 2, children }: { cols?: 1 | 2 | 3; children: React.ReactNode }) {
  const map = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' };
  return <div className={`grid ${map[cols]} gap-4`}>{children}</div>;
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${className || statusColor(label)}`}>
      {label}
    </span>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: (string | number | null | undefined)[][] }) {
  if (!rows.length) return <p className="text-sm text-ink-400 italic py-4 text-center">No records found</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-ink-50 dark:bg-ink-800/50">
            {headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-medium text-ink-500 whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t border-border-custom hover:bg-ink-50/50 dark:hover:bg-ink-800/30">
              {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-ink-700">{cell ?? '-'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tabs ──
const TABS = [
  { key: 'personal', label: 'Personal' },
  { key: 'employment', label: 'Employment' },
  { key: 'contact-bank', label: 'Contact & Bank' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'dependants', label: 'Dependants' },
  { key: 'education', label: 'Education' },
  { key: 'history', label: 'History' },
  { key: 'skills', label: 'Skills & Certs' },
  { key: 'medical', label: 'Medical' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'disciplinary', label: 'Disciplinary' },
];

// ── Action Modal ──
function ActionModal({ open, onClose, title, loading, children, onConfirm, confirmLabel = 'Submit' }: {
  open: boolean; onClose: () => void; title: string; loading?: boolean; children: React.ReactNode;
  onConfirm: () => void; confirmLabel?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-border-custom p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {children}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}{loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Dialog ──
function ConfirmDialog({ open, onClose, title, message, onConfirm, confirmLabel = 'Confirm', loading, variant }: {
  open: boolean; onClose: () => void; title: string; message: string; onConfirm: () => void;
  confirmLabel?: string; loading?: boolean; variant?: 'danger' | 'primary';
}) {
  if (!open) return null;
  const btnClass = variant === 'danger'
    ? 'bg-rose-600 hover:bg-rose-700'
    : 'bg-primary hover:bg-primary-hover';
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm border border-border-custom p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        <p className="text-sm text-ink-600">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-3 py-2 text-xs font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className={`px-5 py-2.5 text-sm font-semibold text-white ${btnClass} rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-2`}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}{loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<any>(null);
  const [fullProfile, setFullProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('personal');

  // Action modal state
  const [actionLoading, setActionLoading] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [showTerminate, setShowTerminate] = useState(false);
  const [showReinstate, setShowReinstate] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);

  // Form data for action modals
  const [actionForm, setActionForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      hrApi.getEmployee(id),
      hrApi.getEmployeeFullProfile(id),
    ]).then(([emp, profile]) => {
      setEmployee(emp?.data ?? emp);
      setFullProfile(profile?.data ?? profile);
    }).catch(() => {
      setEmployee(null);
      setFullProfile(null);
    }).finally(() => setLoading(false));
  }, [id]);

  const stats = useMemo(() => {
    if (!employee) return [];
    const joinDate = employee.joinDate || employee.join_date;
    const tenure = joinDate ? Math.floor((Date.now() - new Date(joinDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
    const status = employee.status || 'active';
    return [
      { label: 'Status', value: status.charAt(0).toUpperCase() + status.slice(1), icon: status === 'active' ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />, color: status === 'active' ? 'emerald' as const : 'rose' as const },
      { label: 'Department', value: employee.departmentName || employee.department || '-', icon: <Building className="w-4 h-4" />, color: 'blue' as const },
      { label: 'Designation', value: employee.designationName || employee.designation || '-', icon: <BadgeInfo className="w-4 h-4" />, color: 'purple' as const },
      { label: 'Tenure', value: joinDate ? `${tenure} yrs` : '-', icon: <Calendar className="w-4 h-4" />, color: 'cyan' as const },
    ];
  }, [employee]);

  // Helper to get nested data from fullProfile
  const getSection = (key: string) => fullProfile?.[key] || [];

  // Action handlers
  const handleAction = async (apiMethod: (id: string, data: any) => Promise<any>, formData: Record<string, string>, successMsg: string, close: () => void) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await apiMethod(id, formData);
      toast(successMsg, 'success');
      close();
      // Refresh data
      const [emp, profile] = await Promise.all([
        hrApi.getEmployee(id),
        hrApi.getEmployeeFullProfile(id),
      ]);
      setEmployee(emp?.data ?? emp);
      setFullProfile(profile?.data ?? profile);
    } catch (err: any) {
      toast(err?.response?.data?.error || err?.message || 'Action failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const closeAllModals = () => {
    setShowTransfer(false); setShowPromote(false); setShowConfirm(false);
    setShowSuspend(false); setShowTerminate(false); setShowReinstate(false);
    setShowReactivate(false); setActionForm({});
  };

  if (loading) {
    return (
      <HrPageShell title="Employee Details" description="Loading employee information..." pageKey="employees">
        <div className="flex items-center justify-center py-16 text-ink-400 gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p className="text-sm">Loading employee data...</p>
        </div>
      </HrPageShell>
    );
  }

  if (!employee) {
    return (
      <HrPageShell title="Employee Not Found" description="The employee you are looking for does not exist." pageKey="employees">
        <div className="flex flex-col items-center justify-center py-16 text-ink-400 gap-3">
          <p className="text-sm font-medium text-ink-600">Employee not found</p>
          <button onClick={() => navigate('/app/hr/employees')} className="text-xs font-medium text-primary hover:text-primary-hover">Back to Employees</button>
        </div>
      </HrPageShell>
    );
  }

  const emp = employee;
  const empStatus = emp.status || 'active';
  const profile = fullProfile || {};
  const emergencyContacts = profile.emergencyContacts || [];
  const dependants = profile.dependants || [];
  const education = profile.education || [];
  const employmentHistory = profile.employmentHistory || [];
  const skills = profile.skills || [];
  const certifications = profile.certifications || [];
  const medical = profile.medical;
  const timeline = profile.timeline || [];
  const transfers = profile.transfers || [];
  const promotions = profile.promotions || [];
  const disciplinary = profile.disciplinary || [];
  const compensation = profile.compensation;

  return (
    <HrPageShell
      title={`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Employee'}
      description={`Employee Code: ${emp.employeeCode || emp.employee_code || '-'} \u00B7 ${emp.departmentName || emp.department || '-'}`}
      pageKey="employees"
      headerActions={
        <>
          <button onClick={() => navigate('/app/hr/employees')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button onClick={() => navigate(`/app/hr/employees/${id}/edit`)}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm">
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setShowTransfer(true); setActionForm({}); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all">
          <ArrowUpRight className="w-3.5 h-3.5" /> Transfer
        </button>
        <button onClick={() => { setShowPromote(true); setActionForm({}); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all">
          <Award className="w-3.5 h-3.5" /> Promote
        </button>
        <button onClick={() => { setShowConfirm(true); setActionForm({}); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all">
          <CheckCheck className="w-3.5 h-3.5" /> Confirm
        </button>
        <button onClick={() => { setShowSuspend(true); setActionForm({}); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all">
          <Ban className="w-3.5 h-3.5" /> Suspend
        </button>
        <button onClick={() => { setShowTerminate(true); setActionForm({}); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-rose-600 text-xs font-medium rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all">
          <LogOut className="w-3.5 h-3.5" /> Terminate
        </button>
        <button onClick={() => { setShowReinstate(true); setActionForm({}); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Reinstate
        </button>
        <button onClick={() => { setShowReactivate(true); setActionForm({}); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all">
          <RotateCcw className="w-3.5 h-3.5" /> Reactivate
        </button>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border-custom overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-400 hover:text-ink-600 hover:border-ink-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* ── Personal Information ── */}
        {activeTab === 'personal' && (
          <SectionCard title="Personal Information">
            <Grid cols={2}>
              <InfoCard icon={<Users className="w-4 h-4" />} label="Full Name" value={`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name} />
              <InfoCard icon={<BadgeInfo className="w-4 h-4" />} label="Employee Code" value={emp.employeeCode || emp.employee_code} />
              <InfoCard icon={<Mail className="w-4 h-4" />} label="Email" value={emp.email} />
              <InfoCard icon={<Phone className="w-4 h-4" />} label="Phone" value={emp.phone} />
              <InfoCard icon={<Users className="w-4 h-4" />} label="Gender" value={emp.gender} />
              <InfoCard icon={<Calendar className="w-4 h-4" />} label="Date of Birth" value={emp.dateOfBirth || emp.date_of_birth ? formatDate(emp.dateOfBirth || emp.date_of_birth) : null} />
              <InfoCard icon={<Heart className="w-4 h-4" />} label="Marital Status" value={emp.maritalStatus || emp.marital_status} />
              <InfoCard icon={<MapPin className="w-4 h-4" />} label="Nationality" value={emp.nationality} />
            </Grid>
          </SectionCard>
        )}

        {/* ── Employment Information ── */}
        {activeTab === 'employment' && (
          <SectionCard title="Employment Information">
            <Grid cols={2}>
              <InfoCard icon={<Building className="w-4 h-4" />} label="Department" value={emp.departmentName || emp.department} />
              <InfoCard icon={<Briefcase className="w-4 h-4" />} label="Designation" value={emp.designationName || emp.designation} />
              <InfoCard icon={<UserCheck className="w-4 h-4" />} label="Employment Status" value={empStatus.charAt(0).toUpperCase() + empStatus.slice(1)} />
              <InfoCard icon={<FileText className="w-4 h-4" />} label="Contract Type" value={emp.contractType || emp.contract_type} />
              <InfoCard icon={<Calendar className="w-4 h-4" />} label="Join Date" value={emp.joinDate || emp.join_date ? formatDate(emp.joinDate || emp.join_date) : null} />
              <InfoCard icon={<Calendar className="w-4 h-4" />} label="Confirm Date" value={emp.confirmDate || emp.confirm_date ? formatDate(emp.confirmDate || emp.confirm_date) : null} />
              <InfoCard icon={<Calendar className="w-4 h-4" />} label="Contract End Date" value={emp.contractEndDate || emp.contract_end_date ? formatDate(emp.contractEndDate || emp.contract_end_date) : null} />
              <InfoCard icon={<Users className="w-4 h-4" />} label="Supervisor" value={emp.supervisorName || emp.supervisor} />
            </Grid>
          </SectionCard>
        )}

        {/* ── Contact & Bank ── */}
        {activeTab === 'contact-bank' && (
          <SectionCard title="Contact & Bank Details">
            <Grid cols={2}>
              <InfoCard icon={<MapPin className="w-4 h-4" />} label="Address" value={emp.address} />
              <InfoCard icon={<MapPin className="w-4 h-4" />} label="City" value={emp.city} />
              <InfoCard icon={<MapPin className="w-4 h-4" />} label="State" value={emp.state} />
              <InfoCard icon={<Building className="w-4 h-4" />} label="Bank Name" value={emp.bankName || emp.bank_name} />
              <InfoCard icon={<Users className="w-4 h-4" />} label="Bank Account Name" value={emp.bankAccountName || emp.bank_account_name} />
              <InfoCard icon={<FileText className="w-4 h-4" />} label="Bank Account Number" value={emp.bankAccountNumber || emp.bank_account_number} />
              <InfoCard icon={<FileText className="w-4 h-4" />} label="TIN" value={emp.tin} />
              <InfoCard icon={<FileText className="w-4 h-4" />} label="NSSF" value={emp.nssf} />
              <InfoCard icon={<FileText className="w-4 h-4" />} label="NHIF" value={emp.nhif} />
            </Grid>
          </SectionCard>
        )}

        {/* ── Emergency Contacts ── */}
        {activeTab === 'emergency' && (
          <SectionCard title="Emergency Contacts">
            {emergencyContacts.length === 0 ? (
              <p className="text-sm text-ink-400 italic py-4 text-center">No emergency contacts recorded</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {emergencyContacts.map((ec: any, i: number) => (
                  <div key={ec.id || i} className="border border-border-custom rounded-2xl p-4 space-y-2">
                    <p className="text-sm font-semibold text-ink-900">{ec.name}</p>
                    <div className="space-y-1 text-xs text-ink-600">
                      <p><span className="font-medium">Phone:</span> {ec.phone}</p>
                      <p><span className="font-medium">Relationship:</span> {ec.relationship}</p>
                      {ec.email && <p><span className="font-medium">Email:</span> {ec.email}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* ── Dependants ── */}
        {activeTab === 'dependants' && (
          <SectionCard title="Dependants">
            <SimpleTable
              headers={['Name', 'Relationship', 'Date of Birth']}
              rows={dependants.map((d: any) => [d.name, d.relationship, d.dateOfBirth || d.date_of_birth ? formatDate(d.dateOfBirth || d.date_of_birth) : null])}
            />
          </SectionCard>
        )}

        {/* ── Education ── */}
        {activeTab === 'education' && (
          <SectionCard title="Education">
            <SimpleTable
              headers={['Institution', 'Degree', 'Field', 'Start Date', 'End Date', 'Grade']}
              rows={education.map((e: any) => [
                e.institution, e.degree, e.fieldOfStudy || e.field,
                e.startDate || e.start_date ? formatDate(e.startDate || e.start_date) : null,
                e.endDate || e.end_date ? formatDate(e.endDate || e.end_date) : null,
                e.grade,
              ])}
            />
          </SectionCard>
        )}

        {/* ── Employment History ── */}
        {activeTab === 'history' && (
          <SectionCard title="Employment History">
            <SimpleTable
              headers={['Company', 'Position', 'Start Date', 'End Date', 'Reason Leaving']}
              rows={employmentHistory.map((h: any) => [
                h.company, h.position,
                h.startDate || h.start_date ? formatDate(h.startDate || h.start_date) : null,
                h.endDate || h.end_date ? formatDate(h.endDate || h.end_date) : null,
                h.reasonForLeaving || h.reason_leaving,
              ])}
            />
          </SectionCard>
        )}

        {/* ── Skills & Certifications ── */}
        {activeTab === 'skills' && (
          <div className="space-y-6">
            <SectionCard title="Skills">
              <SimpleTable
                headers={['Skill', 'Proficiency']}
                rows={skills.map((s: any) => [s.name || s.skill, s.proficiency])}
              />
            </SectionCard>
            <SectionCard title="Certifications">
              <SimpleTable
                headers={['Certification Name', 'Issuer', 'Expiry Date']}
                rows={certifications.map((c: any) => [
                  c.name, c.issuer,
                  c.expiryDate || c.expiry_date ? formatDate(c.expiryDate || c.expiry_date) : null,
                ])}
              />
            </SectionCard>
          </div>
        )}

        {/* ── Medical ── */}
        {activeTab === 'medical' && (
          <SectionCard title="Medical Information">
            {medical ? (
              <Grid cols={2}>
                <InfoCard icon={<Activity className="w-4 h-4" />} label="Blood Group" value={medical.bloodGroup || medical.blood_group} />
                <InfoCard icon={<Activity className="w-4 h-4" />} label="Genotype" value={medical.genotype} />
                <InfoCard icon={<Shield className="w-4 h-4" />} label="Allergies" value={medical.allergies} />
                <InfoCard icon={<Shield className="w-4 h-4" />} label="Disabilities" value={medical.disabilities} />
              </Grid>
            ) : (
              <p className="text-sm text-ink-400 italic py-4 text-center">No medical information recorded</p>
            )}
          </SectionCard>
        )}

        {/* ── Timeline ── */}
        {activeTab === 'timeline' && (
          <SectionCard title="Timeline">
            {timeline.length === 0 ? (
              <p className="text-sm text-ink-400 italic py-4 text-center">No timeline entries</p>
            ) : (
              <div className="space-y-0">
                {timeline.map((entry: any, i: number) => (
                  <div key={entry.id || i} className="flex gap-4 pb-4 border-l-2 border-border-custom pl-4 ml-2 relative">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink-900">{entry.eventType || entry.event_type || entry.type}</span>
                        <span className="text-[10px] text-ink-400">{entry.date ? formatDate(entry.date) : entry.createdAt ? formatDate(entry.createdAt) : ''}</span>
                      </div>
                      <p className="text-xs text-ink-600 mt-0.5">{entry.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* ── Transfers ── */}
        {activeTab === 'transfers' && (
          <SectionCard title="Transfer History">
            <SimpleTable
              headers={['From Department', 'To Department', 'From Designation', 'To Designation', 'Effective Date', 'Reason']}
              rows={transfers.map((t: any) => [
                t.fromDepartment || t.from_department, t.toDepartment || t.to_department,
                t.fromDesignation || t.from_designation, t.toDesignation || t.to_designation,
                t.effectiveDate || t.effective_date ? formatDate(t.effectiveDate || t.effective_date) : null,
                t.reason,
              ])}
            />
          </SectionCard>
        )}

        {/* ── Promotions ── */}
        {activeTab === 'promotions' && (
          <SectionCard title="Promotion History">
            <SimpleTable
              headers={['Previous Designation', 'New Designation', 'Effective Date', 'Reason']}
              rows={promotions.map((p: any) => [
                p.previousDesignation || p.previous_designation, p.newDesignation || p.new_designation,
                p.effectiveDate || p.effective_date ? formatDate(p.effectiveDate || p.effective_date) : null,
                p.reason,
              ])}
            />
          </SectionCard>
        )}

        {/* ── Disciplinary ── */}
        {activeTab === 'disciplinary' && (
          <SectionCard title="Disciplinary Records">
            <SimpleTable
              headers={['Type', 'Description', 'Date', 'Action Taken', 'Status']}
              rows={disciplinary.map((d: any) => [
                d.type, d.description,
                d.date ? formatDate(d.date) : null,
                d.actionTaken || d.action_taken,
                d.status,
              ])}
            />
          </SectionCard>
        )}
      </div>

      {/* ── Action Modals ── */}

      {/* Transfer */}
      <ActionModal open={showTransfer} onClose={closeAllModals} title="Transfer Employee" loading={actionLoading}
        onConfirm={() => handleAction(hrApi.transferEmployee, actionForm, 'Employee transferred successfully', closeAllModals)}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Department ID *</label>
            <input value={actionForm.departmentId || ''} onChange={e => setActionForm(f => ({ ...f, departmentId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Enter department ID" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Designation ID</label>
            <input value={actionForm.designationId || ''} onChange={e => setActionForm(f => ({ ...f, designationId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Enter designation ID (optional)" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Effective Date *</label>
            <input type="date" value={actionForm.effectiveDate || ''} onChange={e => setActionForm(f => ({ ...f, effectiveDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Reason *</label>
            <textarea value={actionForm.reason || ''} onChange={e => setActionForm(f => ({ ...f, reason: e.target.value }))} rows={2}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Reason for transfer" />
          </div>
        </div>
      </ActionModal>

      {/* Promote */}
      <ActionModal open={showPromote} onClose={closeAllModals} title="Promote Employee" loading={actionLoading}
        onConfirm={() => handleAction(hrApi.promoteEmployee, actionForm, 'Employee promoted successfully', closeAllModals)}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">New Designation *</label>
            <input value={actionForm.newDesignation || ''} onChange={e => setActionForm(f => ({ ...f, newDesignation: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="e.g. Senior Developer" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Effective Date *</label>
            <input type="date" value={actionForm.effectiveDate || ''} onChange={e => setActionForm(f => ({ ...f, effectiveDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Reason *</label>
            <textarea value={actionForm.reason || ''} onChange={e => setActionForm(f => ({ ...f, reason: e.target.value }))} rows={2}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Reason for promotion" />
          </div>
        </div>
      </ActionModal>

      {/* Confirm */}
      <ActionModal open={showConfirm} onClose={closeAllModals} title="Confirm Employee" loading={actionLoading}
        onConfirm={() => handleAction(hrApi.confirmEmployee, actionForm, 'Employee confirmed successfully', closeAllModals)}>
        <div className="space-y-3">
          <p className="text-sm text-ink-600">Set the confirmation date for this employee.</p>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Confirm Date</label>
            <input type="date" value={actionForm.confirmDate || actionForm.date || ''} onChange={e => setActionForm(f => ({ ...f, confirmDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
      </ActionModal>

      {/* Suspend */}
      <ActionModal open={showSuspend} onClose={closeAllModals} title="Suspend Employee" loading={actionLoading}
        onConfirm={() => handleAction(hrApi.suspendEmployee, actionForm, 'Employee suspended successfully', closeAllModals)}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Reason *</label>
            <textarea value={actionForm.reason || ''} onChange={e => setActionForm(f => ({ ...f, reason: e.target.value }))} rows={2}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Reason for suspension" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Effective Date</label>
            <input type="date" value={actionForm.effectiveDate || ''} onChange={e => setActionForm(f => ({ ...f, effectiveDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Expected End Date</label>
            <input type="date" value={actionForm.expectedEndDate || ''} onChange={e => setActionForm(f => ({ ...f, expectedEndDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
      </ActionModal>

      {/* Terminate */}
      <ActionModal open={showTerminate} onClose={closeAllModals} title="Terminate Employee" loading={actionLoading}
        onConfirm={() => handleAction(hrApi.terminateEmployee, actionForm, 'Employee terminated', closeAllModals)}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Reason *</label>
            <textarea value={actionForm.reason || ''} onChange={e => setActionForm(f => ({ ...f, reason: e.target.value }))} rows={2}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Reason for termination" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Effective Date *</label>
            <input type="date" value={actionForm.effectiveDate || ''} onChange={e => setActionForm(f => ({ ...f, effectiveDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Termination Type</label>
            <select value={actionForm.terminationType || ''} onChange={e => setActionForm(f => ({ ...f, terminationType: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Select type</option>
              <option value="voluntary">Voluntary</option>
              <option value="involuntary">Involuntary</option>
              <option value="retirement">Retirement</option>
              <option value="redundancy">Redundancy</option>
            </select>
          </div>
        </div>
      </ActionModal>

      {/* Reinstate */}
      <ConfirmDialog open={showReinstate} onClose={closeAllModals} title="Reinstate Employee"
        message="Are you sure you want to reinstate this employee?"
        onConfirm={() => handleAction(hrApi.reinstateEmployee, {}, 'Employee reinstated successfully', closeAllModals)}
        loading={actionLoading} confirmLabel="Reinstate" />

      {/* Reactivate */}
      <ConfirmDialog open={showReactivate} onClose={closeAllModals} title="Reactivate Employee"
        message="Are you sure you want to reactivate this employee?"
        onConfirm={() => handleAction(hrApi.reactivateEmployee, {}, 'Employee reactivated successfully', closeAllModals)}
        loading={actionLoading} confirmLabel="Reactivate" />

    </HrPageShell>
  );
}
