import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  UserPlus, UserCheck, FileText, Users, Building, User,
  Calendar, Sun, Clock, Briefcase, FolderOpen, Target,
  Star, BarChart3, TrendingUp, Heart, Bell, Mail,
  Plane, DollarSign, CheckSquare, Settings, LogOut,
  DoorOpen, GraduationCap, Headphones, Award,
  ClipboardList, Save, ExternalLink
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { orgApi } from '../../../lib/api';

interface ServiceTab { label: string; key: string; icon: React.ComponentType<{ className?: string }>; route?: string }

const SERVICE_GROUPS: { label: string; items: ServiceTab[] }[] = [
  { label: 'People', items: [
    { label: 'Onboarding', key: 'onboarding', icon: UserPlus, route: '/app/hr/onboarding' },
    { label: 'Candidate', key: 'candidate', icon: UserCheck, route: '/app/hr/candidates' },
    { label: 'Employee Information', key: 'employee-information', icon: FileText, route: '/app/hr/manage/employees' },
    { label: 'Employee', key: 'employee', icon: Users, route: '/app/hr/employees' },
    { label: 'Department', key: 'department', icon: Building, route: '/app/hr/manage/organisation/departments' },
    { label: 'Designation', key: 'designation', icon: User, route: '/app/hr/manage/organisation/designations' },
  ]},
  { label: 'Time & Attendance', items: [
    { label: 'Holidays', key: 'holidays', icon: Sun, route: '/app/hr/holidays' },
    { label: 'Leave', key: 'leave', icon: Calendar, route: '/app/hr/leave-requests' },
    { label: 'Compensatory Request', key: 'compensatory-request', icon: Clock, route: '/app/hr/compensatory-requests' },
    { label: 'Attendance', key: 'attendance', icon: Clock, route: '/app/hr/attendance' },
    { label: 'Time Tracker', key: 'time-tracker', icon: Clock, route: '/app/hr/time-tracker' },
  ]},
  { label: 'Operations', items: [
    { label: 'Clients', key: 'clients', icon: Briefcase, route: '/app/hr/clients' },
    { label: 'Projects', key: 'projects', icon: FolderOpen, route: '/app/hr/projects' },
    { label: 'Jobs', key: 'jobs', icon: Target, route: '/app/hr/jobs' },
  ]},
  { label: 'Performance', items: [
    { label: 'Self Appraisal', key: 'self-appraisal', icon: Star, route: '/app/hr/performance' },
    { label: 'Performance Appraisal', key: 'performance-appraisal', icon: BarChart3, route: '/app/hr/performance-reviews' },
    { label: 'Goals', key: 'goals', icon: TrendingUp, route: '/app/hr/goals' },
    { label: 'Multi-Rater Review', key: 'multi-rater-review', icon: Users, route: '/app/hr/performance-reviews' },
  ]},
  { label: 'Files & Documents', items: [
    { label: 'Organization Files', key: 'organization-files', icon: FolderOpen, route: '/app/hr/documents' },
    { label: 'Employee Files', key: 'employee-files', icon: FileText, route: '/app/hr/employee-documents' },
  ]},
  { label: 'Engagement', items: [
    { label: 'Employee Engagement', key: 'employee-engagement', icon: Heart, route: '/app/hr/engagement' },
    { label: 'Announcements', key: 'announcements', icon: Bell, route: '/app/hr/announcements' },
  ]},
  { label: 'HR Letters', items: [
    { label: 'Address Proof', key: 'address-proof', icon: Mail },
    { label: 'Bonafide Letter', key: 'bonafide-letter', icon: FileText },
    { label: 'Experience Letter', key: 'experience-letter', icon: Award },
  ]},
  { label: 'Travel', items: [
    { label: 'Travel Request', key: 'travel-request', icon: Plane, route: '/app/hr/travel-requests' },
    { label: 'Travel Expense', key: 'travel-expense', icon: DollarSign, route: '/app/hr/travel-expenses' },
  ]},
  { label: 'Tasks & Compensation', items: [
    { label: 'Tasks', key: 'tasks', icon: CheckSquare, route: '/app/hr/tasks' },
    { label: 'Task', key: 'task', icon: ClipboardList, route: '/app/hr/tasks' },
    { label: 'Compensation', key: 'compensation', icon: Settings, route: '/app/hr/compensation' },
    { label: 'Exit Details', key: 'exit-details', icon: LogOut, route: '/app/hr/offboarding' },
    { label: 'Offboarding', key: 'offboarding', icon: DoorOpen, route: '/app/hr/offboarding' },
  ]},
  { label: 'Learning & Support', items: [
    { label: 'OKR', key: 'okr', icon: Target, route: '/app/hr/okrs' },
    { label: 'Courses', key: 'courses', icon: GraduationCap, route: '/app/hr/courses' },
    { label: 'HR Help Desk', key: 'hr-help-desk', icon: Headphones, route: '/app/hr/help-desk' },
  ]},
];

const ALL_TABS = SERVICE_GROUPS.flatMap(g => g.items);

interface ServiceConfig {
  enabled: boolean;
  config: string;
}

function ServiceForm({ label, config, onChange, route }: { label: string; config: ServiceConfig; onChange: (c: ServiceConfig) => void; route?: string }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink-900">{label} Settings</h2>
        <div className="flex items-center gap-2">
          {route && <button onClick={() => navigate(route)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><ExternalLink className="w-3.5 h-3.5" /> Open</button>}
          <button onClick={() => { toast(`${label} settings saved`, 'success'); }} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Enable {label}</label>
          <label className="relative inline-flex items-center cursor-pointer mt-1">
            <input type="checkbox" checked={config.enabled} onChange={e => onChange({ ...config, enabled: e.target.checked })} className="sr-only peer" />
            <div className="w-9 h-5 bg-ink-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Configuration</label>
          <textarea rows={4} value={config.config} onChange={e => onChange({ ...config, config: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder={`Configure ${label.toLowerCase()} settings here...`} />
        </div>
      </div>
    </div>
  );
}

export function ServicesSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'onboarding';
  const activeItem = ALL_TABS.find(t => t.key === activeTab);
  const ActiveIcon = activeItem?.icon || ClipboardList;
  const { toast } = useToast();

  const [configs, setConfigs] = useState<Record<string, ServiceConfig>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    orgApi.getSettings().then(settings => {
      const svc = (settings as any)?.services || {};
      const init: Record<string, ServiceConfig> = {};
      ALL_TABS.forEach(t => {
        const saved = svc[t.key];
        init[t.key] = saved ? { enabled: saved.enabled !== false, config: saved.config || '' } : { enabled: true, config: '' };
      });
      setConfigs(init);
      setLoaded(true);
    }).catch(() => {
      const init: Record<string, ServiceConfig> = {};
      ALL_TABS.forEach(t => { init[t.key] = { enabled: true, config: '' }; });
      setConfigs(init);
      setLoaded(true);
    });
  }, []);

  const updateConfig = async (key: string, c: ServiceConfig) => {
    setConfigs(prev => ({ ...prev, [key]: c }));
    try {
      const settings = (await orgApi.getSettings()) as any;
      await orgApi.updateSettings({ services: { ...(settings?.services || {}), [key]: c } });
      toast(`${ALL_TABS.find(t => t.key === key)?.label || key} settings saved`, 'success');
    } catch { toast('Failed to save', 'error'); }
  };

  if (!loaded) return <div className="p-6 text-sm text-ink-400">Loading...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-4 overflow-y-auto max-h-[70vh] pr-1">
        {SERVICE_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400 px-3 mb-1">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button key={item.key} onClick={() => setSearchParams({ tab: item.key })}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                      isActive ? 'bg-primary/10 text-primary' : 'text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="lg:col-span-3 space-y-6">
        {activeItem ? (
          <ServiceForm label={activeItem.label} config={configs[activeTab] || { enabled: true, config: '' }} onChange={c => updateConfig(activeTab, c)} route={activeItem.route} />
        ) : (
          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-8 text-center text-ink-400">
            <ActiveIcon className="w-12 h-12 mx-auto mb-3 text-ink-300" />
            <p className="font-medium text-ink-600">Services</p>
            <p className="text-sm mt-1">Select a service from the sidebar to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
