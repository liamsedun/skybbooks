import { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Monitor, Compass, ClipboardCheck, FileText, Plus, RotateCcw, CheckCircle2, Undo2, ShieldCheck } from 'lucide-react';
import { hrApi } from '../../../lib/api';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { useToast } from '../../../contexts/ToastContext';
import { formatDate } from '../../../lib/hrExport';

const TABS = [
  { key: 'checklist', label: 'Checklist', icon: CheckSquare },
  { key: 'equipment', label: 'Equipment', icon: Monitor },
  { key: 'orientation', label: 'Orientation', icon: Compass },
  { key: 'probation', label: 'Probation', icon: ClipboardCheck },
  { key: 'documents', label: 'Documents', icon: FileText },
];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    'in-progress': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    returned: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    scheduled: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800',
    verified: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    failed: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
    passed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  };
  return map[status.toLowerCase()] || 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
};

const inputCls = 'w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';
const labelCls = 'block text-xs font-medium text-ink-500 mb-1';
const modalOverlayCls = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40';
const modalPanelCls = 'bg-surface rounded-2xl border border-border-custom shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto';
const modalTitleCls = 'text-lg font-bold text-ink-900 mb-4';
const btnPrimaryCls = 'h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5';
const btnSecondaryCls = 'h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5';
const tableCls = 'w-full text-sm';
const thCls = 'text-left text-xs font-semibold text-ink-400 uppercase tracking-wider px-3 py-3';
const tdCls = 'px-3 py-3 text-ink-600 border-t border-border-custom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
}

function FormModal({ open, onClose, title, children, onSubmit, submitLabel = 'Save' }: ModalProps) {
  if (!open) return null;
  return (
    <div className={modalOverlayCls} onClick={onClose}>
      <div className={modalPanelCls} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalTitleCls}>{title}</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          {children}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={btnSecondaryCls}>Cancel</button>
            <button type="submit" className={btnPrimaryCls}>{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function OnboardingPage() {
  const { success: showSuccess, error: showError } = useToast();

  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('checklist');
  const [loading, setLoading] = useState(false);

  // Checklist state
  const [tasks, setTasks] = useState<any[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ taskName: '', description: '', assignedTo: '', dueDate: '' });

  // Equipment state
  const [equipment, setEquipment] = useState<any[]>([]);
  const [showAssignEquipment, setShowAssignEquipment] = useState(false);
  const [equipForm, setEquipForm] = useState({ equipmentName: '', serialNumber: '', category: '', condition: '', notes: '' });

  // Orientation state
  const [sessions, setSessions] = useState<any[]>([]);
  const [showScheduleSession, setShowScheduleSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({ title: '', description: '', facilitator: '', sessionDate: '', duration: '', location: '' });

  // Probation state
  const [probationReviews, setProbationReviews] = useState<any[]>([]);
  const [showAddReview, setShowAddReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ reviewDate: '', rating: 3, performance: '', areasOfImprovement: '', recommendation: '', isPassed: true });

  // Documents state
  const [documents, setDocuments] = useState<any[]>([]);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [docForm, setDocForm] = useState({ name: '', type: '', fileUrl: '' });

  // ── Load employees ──
  useEffect(() => {
    hrApi.getEmployees().then((res: any) => {
      const list = res?.data ?? res ?? [];
      setEmployees(list);
      if (list.length > 0) setSelectedEmployeeId(list[0].id);
    }).catch(() => {});
  }, []);

  // ── Fetch data based on active tab & selected employee ──
  const fetchChecklist = useCallback(async (empId: string) => {
    try {
      const res = await hrApi.getOnboardingTasks(empId);
      setTasks(res?.data ?? res ?? []);
    } catch { setTasks([]); }
  }, []);

  const fetchEquipment = useCallback(async (empId: string) => {
    try {
      const res = await hrApi.getEquipmentAssignments({ employeeId: empId });
      setEquipment(res?.data ?? res ?? []);
    } catch { setEquipment([]); }
  }, []);

  const fetchOrientation = useCallback(async (empId: string) => {
    try {
      const res = await hrApi.getOrientationSessions({ employeeId: empId });
      setSessions(res?.data ?? res ?? []);
    } catch { setSessions([]); }
  }, []);

  const fetchProbation = useCallback(async (empId: string) => {
    try {
      const res = await hrApi.getProbationReviews({ employeeId: empId });
      setProbationReviews(res?.data ?? res ?? []);
    } catch { setProbationReviews([]); }
  }, []);

  const fetchDocuments = useCallback(async (empId: string) => {
    try {
      const res = await hrApi.getPreEmploymentDocuments({ employeeId: empId });
      setDocuments(res?.data ?? res ?? []);
    } catch { setDocuments([]); }
  }, []);

  useEffect(() => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    const fetch = async () => {
      try {
        switch (activeTab) {
          case 'checklist': await fetchChecklist(selectedEmployeeId); break;
          case 'equipment': await fetchEquipment(selectedEmployeeId); break;
          case 'orientation': await fetchOrientation(selectedEmployeeId); break;
          case 'probation': await fetchProbation(selectedEmployeeId); break;
          case 'documents': await fetchDocuments(selectedEmployeeId); break;
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [selectedEmployeeId, activeTab, fetchChecklist, fetchEquipment, fetchOrientation, fetchProbation, fetchDocuments]);

  const selectedEmployee = employees.find((e: any) => e.id === selectedEmployeeId);

  // ── Checklist handlers ──
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrApi.createOnboardingTask({ ...taskForm, employeeId: selectedEmployeeId });
      showSuccess('Task created');
      setShowAddTask(false);
      setTaskForm({ taskName: '', description: '', assignedTo: '', dueDate: '' });
      fetchChecklist(selectedEmployeeId);
    } catch { showError('Failed to create task'); }
  };

  const handleCompleteTask = async (id: string) => {
    try {
      await hrApi.completeOnboardingTask(id);
      showSuccess('Task completed');
      fetchChecklist(selectedEmployeeId);
    } catch { showError('Failed to complete task'); }
  };

  const handleAutoGenerateChecklist = async () => {
    if (!selectedEmployeeId) return;
    try {
      await hrApi.createOnboardingChecklist(selectedEmployeeId);
      showSuccess('Checklist auto-generated');
      fetchChecklist(selectedEmployeeId);
    } catch { showError('Failed to generate checklist'); }
  };

  // ── Equipment handlers ──
  const handleAssignEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrApi.assignEquipment({ ...equipForm, employeeId: selectedEmployeeId });
      showSuccess('Equipment assigned');
      setShowAssignEquipment(false);
      setEquipForm({ equipmentName: '', serialNumber: '', category: '', condition: '', notes: '' });
      fetchEquipment(selectedEmployeeId);
    } catch { showError('Failed to assign equipment'); }
  };

  const handleReturnEquipment = async (id: string) => {
    try {
      await hrApi.returnEquipment(id);
      showSuccess('Equipment returned');
      fetchEquipment(selectedEmployeeId);
    } catch { showError('Failed to return equipment'); }
  };

  // ── Orientation handlers ──
  const handleScheduleSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrApi.scheduleOrientationSession({ ...sessionForm, employeeId: selectedEmployeeId });
      showSuccess('Session scheduled');
      setShowScheduleSession(false);
      setSessionForm({ title: '', description: '', facilitator: '', sessionDate: '', duration: '', location: '' });
      fetchOrientation(selectedEmployeeId);
    } catch { showError('Failed to schedule session'); }
  };

  const handleCompleteSession = async (id: string) => {
    try {
      await hrApi.completeOrientationSession(id);
      showSuccess('Session completed');
      fetchOrientation(selectedEmployeeId);
    } catch { showError('Failed to complete session'); }
  };

  // ── Probation handlers ──
  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrApi.createProbationReview({ ...reviewForm, employeeId: selectedEmployeeId });
      showSuccess('Review added');
      setShowAddReview(false);
      setReviewForm({ reviewDate: '', rating: 3, performance: '', areasOfImprovement: '', recommendation: '', isPassed: true });
      fetchProbation(selectedEmployeeId);
    } catch { showError('Failed to add review'); }
  };

  const handleFinalizeProbation = async (id: string) => {
    try {
      await hrApi.finalizeProbation(id, { isPassed: true, recommendation: 'Probation completed successfully.' });
      showSuccess('Probation finalized');
      fetchProbation(selectedEmployeeId);
    } catch { showError('Failed to finalize probation'); }
  };

  // ── Document handlers ──
  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrApi.uploadPreEmploymentDocument({ ...docForm, employeeId: selectedEmployeeId });
      showSuccess('Document uploaded');
      setShowUploadDoc(false);
      setDocForm({ name: '', type: '', fileUrl: '' });
      fetchDocuments(selectedEmployeeId);
    } catch { showError('Failed to upload document'); }
  };

  const handleVerifyDoc = async (id: string) => {
    try {
      await hrApi.verifyPreEmploymentDocument(id);
      showSuccess('Document verified');
      fetchDocuments(selectedEmployeeId);
    } catch { showError('Failed to verify document'); }
  };

  return (
    <HrPageShell title="Onboarding Management" description="Manage the full onboarding workflow — tasks, equipment, orientation, probation, and documents." pageKey="onboarding">
      {/* Employee Selector */}
      <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-4">
        <label className={labelCls}>Select Employee</label>
        <select
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
          className={inputCls}
        >
          <option value="">-- Select an employee --</option>
          {employees.map((emp: any) => (
            <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl border border-border-custom shadow-sm p-1 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === t.key ? 'bg-primary text-white shadow-sm' : 'text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6">
        {!selectedEmployeeId ? (
          <div className="text-center py-12 text-ink-400">
            <p>Select an employee to manage onboarding</p>
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-ink-400">
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {/* ─── CHECKLIST TAB ─── */}
            {activeTab === 'checklist' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-ink-900">Onboarding Tasks</h3>
                  <div className="flex gap-2">
                    <button onClick={handleAutoGenerateChecklist} className={btnSecondaryCls}>
                      <RotateCcw className="w-3.5 h-3.5" />Auto-generate
                    </button>
                    <button onClick={() => setShowAddTask(true)} className={btnPrimaryCls}>
                      <Plus className="w-3.5 h-3.5" />Add Task
                    </button>
                  </div>
                </div>
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-ink-400 text-sm">No tasks yet. Add a task or auto-generate a checklist.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className={tableCls}>
                      <thead>
                        <tr className="border-b border-border-custom">
                          <th className={thCls}>Task Name</th>
                          <th className={thCls}>Description</th>
                          <th className={thCls}>Assigned To</th>
                          <th className={thCls}>Due Date</th>
                          <th className={thCls}>Status</th>
                          <th className={`${thCls} text-right`}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((t: any) => (
                          <tr key={t.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition-colors">
                            <td className={tdCls}><span className="font-medium text-ink-900">{t.taskName || t.name}</span></td>
                            <td className={tdCls}>{t.description || '-'}</td>
                            <td className={tdCls}>{t.assignedTo || '-'}</td>
                            <td className={tdCls}>{t.dueDate ? formatDate(t.dueDate) : '-'}</td>
                            <td className={tdCls}>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge(t.status)}`}>
                                {t.status || 'pending'}
                              </span>
                            </td>
                            <td className={`${tdCls} text-right`}>
                              {t.status !== 'completed' && (
                                <button onClick={() => handleCompleteTask(t.id)} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Complete">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─── EQUIPMENT TAB ─── */}
            {activeTab === 'equipment' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-ink-900">Equipment Assignments</h3>
                  <button onClick={() => setShowAssignEquipment(true)} className={btnPrimaryCls}>
                    <Plus className="w-3.5 h-3.5" />Assign Equipment
                  </button>
                </div>
                {equipment.length === 0 ? (
                  <div className="text-center py-8 text-ink-400 text-sm">No equipment assigned yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className={tableCls}>
                      <thead>
                        <tr className="border-b border-border-custom">
                          <th className={thCls}>Equipment Name</th>
                          <th className={thCls}>Serial Number</th>
                          <th className={thCls}>Category</th>
                          <th className={thCls}>Assigned Date</th>
                          <th className={thCls}>Returned Date</th>
                          <th className={thCls}>Status</th>
                          <th className={`${thCls} text-right`}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {equipment.map((eq: any) => (
                          <tr key={eq.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition-colors">
                            <td className={tdCls}><span className="font-medium text-ink-900">{eq.equipmentName}</span></td>
                            <td className={tdCls}>{eq.serialNumber || '-'}</td>
                            <td className={tdCls}>{eq.category || '-'}</td>
                            <td className={tdCls}>{eq.assignedDate ? formatDate(eq.assignedDate) : '-'}</td>
                            <td className={tdCls}>{eq.returnedDate ? formatDate(eq.returnedDate) : '-'}</td>
                            <td className={tdCls}>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge(eq.status)}`}>
                                {eq.status || 'assigned'}
                              </span>
                            </td>
                            <td className={`${tdCls} text-right`}>
                              {eq.status !== 'returned' && (
                                <button onClick={() => handleReturnEquipment(eq.id)} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Return">
                                  <Undo2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─── ORIENTATION TAB ─── */}
            {activeTab === 'orientation' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-ink-900">Orientation Sessions</h3>
                  <button onClick={() => setShowScheduleSession(true)} className={btnPrimaryCls}>
                    <Plus className="w-3.5 h-3.5" />Schedule Session
                  </button>
                </div>
                {sessions.length === 0 ? (
                  <div className="text-center py-8 text-ink-400 text-sm">No orientation sessions scheduled.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className={tableCls}>
                      <thead>
                        <tr className="border-b border-border-custom">
                          <th className={thCls}>Title</th>
                          <th className={thCls}>Facilitator</th>
                          <th className={thCls}>Session Date</th>
                          <th className={thCls}>Duration</th>
                          <th className={thCls}>Location</th>
                          <th className={thCls}>Status</th>
                          <th className={`${thCls} text-right`}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s: any) => (
                          <tr key={s.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition-colors">
                            <td className={tdCls}><span className="font-medium text-ink-900">{s.title}</span></td>
                            <td className={tdCls}>{s.facilitator || '-'}</td>
                            <td className={tdCls}>{s.sessionDate ? formatDate(s.sessionDate) : '-'}</td>
                            <td className={tdCls}>{s.duration || '-'}</td>
                            <td className={tdCls}>{s.location || '-'}</td>
                            <td className={tdCls}>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge(s.status)}`}>
                                {s.status || 'scheduled'}
                              </span>
                            </td>
                            <td className={`${tdCls} text-right`}>
                              {s.status !== 'completed' && (
                                <button onClick={() => handleCompleteSession(s.id)} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Complete">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─── PROBATION TAB ─── */}
            {activeTab === 'probation' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-ink-900">Probation Reviews</h3>
                  <button onClick={() => setShowAddReview(true)} className={btnPrimaryCls}>
                    <Plus className="w-3.5 h-3.5" />Add Review
                  </button>
                </div>
                {probationReviews.length === 0 ? (
                  <div className="text-center py-8 text-ink-400 text-sm">No probation reviews yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className={tableCls}>
                      <thead>
                        <tr className="border-b border-border-custom">
                          <th className={thCls}>Review Date</th>
                          <th className={thCls}>Rating</th>
                          <th className={thCls}>Performance</th>
                          <th className={thCls}>Recommendation</th>
                          <th className={thCls}>Status</th>
                          <th className={`${thCls} text-right`}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {probationReviews.map((r: any) => (
                          <tr key={r.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition-colors">
                            <td className={tdCls}>{r.reviewDate ? formatDate(r.reviewDate) : '-'}</td>
                            <td className={tdCls}>
                              <span className="inline-flex items-center gap-1 text-ink-900 font-medium">{r.rating}/5</span>
                            </td>
                            <td className={tdCls}>{r.performance ? (r.performance.length > 60 ? r.performance.slice(0, 60) + '...' : r.performance) : '-'}</td>
                            <td className={tdCls}>{r.recommendation ? (r.recommendation.length > 40 ? r.recommendation.slice(0, 40) + '...' : r.recommendation) : '-'}</td>
                            <td className={tdCls}>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge(r.status)}`}>
                                {r.status || 'pending'}
                              </span>
                            </td>
                            <td className={`${tdCls} text-right`}>
                              {r.status !== 'passed' && r.status !== 'failed' && (
                                <button onClick={() => handleFinalizeProbation(r.id)} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Finalize">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─── DOCUMENTS TAB ─── */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-ink-900">Pre-Employment Documents</h3>
                  <button onClick={() => setShowUploadDoc(true)} className={btnPrimaryCls}>
                    <Plus className="w-3.5 h-3.5" />Upload Document
                  </button>
                </div>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-ink-400 text-sm">No documents uploaded yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className={tableCls}>
                      <thead>
                        <tr className="border-b border-border-custom">
                          <th className={thCls}>Document Name</th>
                          <th className={thCls}>Type</th>
                          <th className={thCls}>Status</th>
                          <th className={thCls}>Verified Date</th>
                          <th className={`${thCls} text-right`}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((d: any) => (
                          <tr key={d.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition-colors">
                            <td className={tdCls}><span className="font-medium text-ink-900">{d.name}</span></td>
                            <td className={tdCls}>{d.type || '-'}</td>
                            <td className={tdCls}>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge(d.status)}`}>
                                {d.status || 'pending'}
                              </span>
                            </td>
                            <td className={tdCls}>{d.verifiedDate ? formatDate(d.verifiedDate) : '-'}</td>
                            <td className={`${tdCls} text-right`}>
                              {d.status !== 'verified' && (
                                <button onClick={() => handleVerifyDoc(d.id)} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Verify">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── MODALS ─── */}

      {/* Add Task Modal */}
      <FormModal open={showAddTask} onClose={() => setShowAddTask(false)} title="Add Onboarding Task" onSubmit={handleAddTask}>
        <div>
          <label className={labelCls}>Task Name *</label>
          <input className={inputCls} value={taskForm.taskName} onChange={(e) => setTaskForm({ ...taskForm, taskName: e.target.value })} required />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea className={inputCls} rows={3} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Assigned To</label>
          <input className={inputCls} value={taskForm.assignedTo} onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Due Date</label>
          <input type="date" className={inputCls} value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
        </div>
      </FormModal>

      {/* Assign Equipment Modal */}
      <FormModal open={showAssignEquipment} onClose={() => setShowAssignEquipment(false)} title="Assign Equipment" onSubmit={handleAssignEquipment}>
        <div>
          <label className={labelCls}>Equipment Name *</label>
          <input className={inputCls} value={equipForm.equipmentName} onChange={(e) => setEquipForm({ ...equipForm, equipmentName: e.target.value })} required />
        </div>
        <div>
          <label className={labelCls}>Serial Number</label>
          <input className={inputCls} value={equipForm.serialNumber} onChange={(e) => setEquipForm({ ...equipForm, serialNumber: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <input className={inputCls} value={equipForm.category} onChange={(e) => setEquipForm({ ...equipForm, category: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Condition</label>
          <input className={inputCls} value={equipForm.condition} onChange={(e) => setEquipForm({ ...equipForm, condition: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea className={inputCls} rows={2} value={equipForm.notes} onChange={(e) => setEquipForm({ ...equipForm, notes: e.target.value })} />
        </div>
      </FormModal>

      {/* Schedule Session Modal */}
      <FormModal open={showScheduleSession} onClose={() => setShowScheduleSession(false)} title="Schedule Orientation Session" onSubmit={handleScheduleSession}>
        <div>
          <label className={labelCls}>Title *</label>
          <input className={inputCls} value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} required />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea className={inputCls} rows={2} value={sessionForm.description} onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Facilitator *</label>
          <input className={inputCls} value={sessionForm.facilitator} onChange={(e) => setSessionForm({ ...sessionForm, facilitator: e.target.value })} required />
        </div>
        <div>
          <label className={labelCls}>Session Date *</label>
          <input type="date" className={inputCls} value={sessionForm.sessionDate} onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })} required />
        </div>
        <div>
          <label className={labelCls}>Duration (e.g. 2 hours)</label>
          <input className={inputCls} value={sessionForm.duration} onChange={(e) => setSessionForm({ ...sessionForm, duration: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Location</label>
          <input className={inputCls} value={sessionForm.location} onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })} />
        </div>
      </FormModal>

      {/* Add Review Modal */}
      <FormModal open={showAddReview} onClose={() => setShowAddReview(false)} title="Add Probation Review" onSubmit={handleAddReview}>
        <div>
          <label className={labelCls}>Review Date *</label>
          <input type="date" className={inputCls} value={reviewForm.reviewDate} onChange={(e) => setReviewForm({ ...reviewForm, reviewDate: e.target.value })} required />
        </div>
        <div>
          <label className={labelCls}>Rating (1-5)</label>
          <input type="number" min={1} max={5} className={inputCls} value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: parseInt(e.target.value) || 3 })} />
        </div>
        <div>
          <label className={labelCls}>Performance</label>
          <textarea className={inputCls} rows={3} value={reviewForm.performance} onChange={(e) => setReviewForm({ ...reviewForm, performance: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Areas of Improvement</label>
          <textarea className={inputCls} rows={2} value={reviewForm.areasOfImprovement} onChange={(e) => setReviewForm({ ...reviewForm, areasOfImprovement: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Recommendation</label>
          <textarea className={inputCls} rows={2} value={reviewForm.recommendation} onChange={(e) => setReviewForm({ ...reviewForm, recommendation: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isPassed" checked={reviewForm.isPassed} onChange={(e) => setReviewForm({ ...reviewForm, isPassed: e.target.checked })} className="rounded border-border-custom" />
          <label htmlFor="isPassed" className="text-sm text-ink-700">Passed</label>
        </div>
      </FormModal>

      {/* Upload Document Modal */}
      <FormModal open={showUploadDoc} onClose={() => setShowUploadDoc(false)} title="Upload Pre-Employment Document" onSubmit={handleUploadDoc}>
        <div>
          <label className={labelCls}>Document Name *</label>
          <input className={inputCls} value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} required />
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select className={inputCls} value={docForm.type} onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}>
            <option value="">Select type</option>
            <option value="resume">Resume / CV</option>
            <option value="certificate">Certificate</option>
            <option value="identification">Identification</option>
            <option value="contract">Contract</option>
            <option value="academic">Academic Transcript</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>File URL</label>
          <input className={inputCls} value={docForm.fileUrl} onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })} placeholder="https://..." />
        </div>
      </FormModal>
    </HrPageShell>
  );
}
