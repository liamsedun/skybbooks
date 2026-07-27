import { Activity, Rss, User, CheckCircle, Calendar, Clock, Timer, FileText } from 'lucide-react';

const SECTIONS = [
  { icon: Activity, label: 'Activities', desc: 'Recent HR activities and updates across the organisation.', color: 'bg-blue-50 text-blue-600' },
  { icon: Rss, label: 'Feeds', desc: 'Live feeds from employee updates, announcements, and system events.', color: 'bg-emerald-50 text-emerald-600' },
  { icon: User, label: 'Profile', desc: 'Quick view of your HR profile, contact info, and reporting structure.', color: 'bg-indigo-50 text-indigo-600' },
  { icon: CheckCircle, label: 'Approval', desc: 'Pending approvals requiring your review and action.', color: 'bg-amber-50 text-amber-600' },
  { icon: Calendar, label: 'Leave', desc: 'Your leave balance, upcoming leave, and leave request history.', color: 'bg-rose-50 text-rose-600' },
  { icon: Clock, label: 'Attendance', desc: 'Today\'s attendance status, clock-in/out times, and monthly summary.', color: 'bg-purple-50 text-purple-600' },
  { icon: Timer, label: 'Time Logs', desc: 'Logged hours per project, task breakdown, and timesheet status.', color: 'bg-cyan-50 text-cyan-600' },
  { icon: FileText, label: 'Timesheets', desc: 'Pending and approved timesheets for the current period.', color: 'bg-orange-50 text-orange-600' },
];

export function HomeOverviewPage() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {SECTIONS.map(s => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${s.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-ink-900 text-sm mb-1">{s.label}</h3>
            <p className="text-xs text-ink-400 leading-relaxed">{s.desc}</p>
          </div>
        );
      })}
    </div>
  );
}
