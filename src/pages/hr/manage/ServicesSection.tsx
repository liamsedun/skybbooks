import { useSearchParams } from 'react-router-dom';
import {
  UserPlus, UserCheck, FileText, Users, Building, User,
  Calendar, Sun, Clock, Briefcase, FolderOpen, Target,
  Star, BarChart3, TrendingUp, Heart, Bell, Mail,
  Plane, DollarSign, CheckSquare, Settings, LogOut,
  DoorOpen, GraduationCap, Headphones, Award,
  ClipboardList, Save
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

interface ServiceTab { label: string; key: string; icon: React.ComponentType<{ className?: string }> }

const SERVICE_GROUPS: { label: string; items: ServiceTab[] }[] = [
  { label: 'People', items: [
    { label: 'Onboarding', key: 'onboarding', icon: UserPlus },
    { label: 'Candidate', key: 'candidate', icon: UserCheck },
    { label: 'Employee Information', key: 'employee-information', icon: FileText },
    { label: 'Employee', key: 'employee', icon: Users },
    { label: 'Department', key: 'department', icon: Building },
    { label: 'Designation', key: 'designation', icon: User },
  ]},
  { label: 'Time & Attendance', items: [
    { label: 'Holidays', key: 'holidays', icon: Sun },
    { label: 'Leave', key: 'leave', icon: Calendar },
    { label: 'Compensatory Request', key: 'compensatory-request', icon: Clock },
    { label: 'Attendance', key: 'attendance', icon: Clock },
    { label: 'Time Tracker', key: 'time-tracker', icon: Clock },
  ]},
  { label: 'Operations', items: [
    { label: 'Clients', key: 'clients', icon: Briefcase },
    { label: 'Projects', key: 'projects', icon: FolderOpen },
    { label: 'Jobs', key: 'jobs', icon: Target },
  ]},
  { label: 'Performance', items: [
    { label: 'Self Appraisal', key: 'self-appraisal', icon: Star },
    { label: 'Performance Appraisal', key: 'performance-appraisal', icon: BarChart3 },
    { label: 'Goals', key: 'goals', icon: TrendingUp },
    { label: 'Multi-Rater Review', key: 'multi-rater-review', icon: Users },
  ]},
  { label: 'Files & Documents', items: [
    { label: 'Organization Files', key: 'organization-files', icon: FolderOpen },
    { label: 'Employee Files', key: 'employee-files', icon: FileText },
  ]},
  { label: 'Engagement', items: [
    { label: 'Employee Engagement', key: 'employee-engagement', icon: Heart },
    { label: 'Announcements', key: 'announcements', icon: Bell },
  ]},
  { label: 'HR Letters', items: [
    { label: 'Address Proof', key: 'address-proof', icon: Mail },
    { label: 'Bonafide Letter', key: 'bonafide-letter', icon: FileText },
    { label: 'Experience Letter', key: 'experience-letter', icon: Award },
  ]},
  { label: 'Travel', items: [
    { label: 'Travel Request', key: 'travel-request', icon: Plane },
    { label: 'Travel Expense', key: 'travel-expense', icon: DollarSign },
  ]},
  { label: 'Tasks & Compensation', items: [
    { label: 'Tasks', key: 'tasks', icon: CheckSquare },
    { label: 'Task', key: 'task', icon: ClipboardList },
    { label: 'Compensation', key: 'compensation', icon: Settings },
    { label: 'Exit Details', key: 'exit-details', icon: LogOut },
    { label: 'Offboarding', key: 'offboarding', icon: DoorOpen },
  ]},
  { label: 'Learning & Support', items: [
    { label: 'OKR', key: 'okr', icon: Target },
    { label: 'Courses', key: 'courses', icon: GraduationCap },
    { label: 'HR Help Desk', key: 'hr-help-desk', icon: Headphones },
  ]},
];

const ALL_TABS = SERVICE_GROUPS.flatMap(g => g.items);

function ServiceForm({ label }: { label: string }) {
  const { success } = useToast();
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">{label} Settings</h2><button onClick={() => success(`${label} settings saved`)} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4">
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Enable {label}</label><label className="relative inline-flex items-center cursor-pointer mt-1"><input type="checkbox" defaultChecked className="sr-only peer" /><div className="w-9 h-5 bg-ink-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div></label></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Configuration</label><textarea rows={4} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder={`Configure ${label.toLowerCase()} settings here...`} /></div>
      </div>
    </div>
  );
}

export function ServicesSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'onboarding';
  const activeItem = ALL_TABS.find(t => t.key === activeTab);
  const ActiveIcon = activeItem?.icon || ClipboardList;

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
        {activeItem ? <ServiceForm label={activeItem.label} /> : (
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
