import { BarChart3, Cake, UserPlus, Star, Link, Bell, FileText, Sun, CheckSquare, FolderOpen, Users, Heart, GlassWater, CalendarClock, Activity, Smile } from 'lucide-react';

const WIDGETS = [
  { icon: BarChart3, label: 'Charts', desc: 'HR metrics visualizations.', color: 'bg-blue-50 text-blue-600', wide: true },
  { icon: Cake, label: 'Birthdays', desc: 'Upcoming employee birthdays.', color: 'bg-pink-50 text-pink-600' },
  { icon: UserPlus, label: 'New Hires', desc: 'Recently joined employees.', color: 'bg-emerald-50 text-emerald-600' },
  { icon: Star, label: 'Favorites', desc: 'Your most-used HR tools.', color: 'bg-amber-50 text-amber-600' },
  { icon: Link, label: 'Quick Links', desc: 'Shortcuts to common tasks.', color: 'bg-indigo-50 text-indigo-600' },
  { icon: Bell, label: 'Announcements', desc: 'Latest company announcements.', color: 'bg-rose-50 text-rose-600' },
  { icon: FileText, label: 'Leave Report', desc: 'Leave utilization summary.', color: 'bg-purple-50 text-purple-600' },
  { icon: Sun, label: 'Upcoming Holidays', desc: 'Next public holidays.', color: 'bg-yellow-50 text-yellow-600' },
  { icon: CheckSquare, label: 'Pending Tasks', desc: 'Tasks awaiting action.', color: 'bg-cyan-50 text-cyan-600' },
  { icon: FolderOpen, label: 'Organization Files', desc: 'Company-wide documents.', color: 'bg-slate-50 text-slate-600' },
  { icon: FileText, label: 'Employee Files', desc: 'Individual employee records.', color: 'bg-orange-50 text-orange-600' },
  { icon: Heart, label: 'Work Anniversary', desc: 'Upcoming work anniversaries.', color: 'bg-red-50 text-red-600' },
  { icon: GlassWater, label: 'Wedding Anniversary', desc: 'Upcoming wedding anniversaries.', color: 'bg-violet-50 text-violet-600' },
  { icon: CalendarClock, label: 'On Leave Today', desc: 'Employees currently on leave.', color: 'bg-teal-50 text-teal-600' },
  { icon: Activity, label: 'Employee Engagement', desc: 'Engagement score and trends.', color: 'bg-lime-50 text-lime-600' },
  { icon: Smile, label: 'Employee Engagement', desc: 'Pulse survey results.', color: 'bg-green-50 text-green-600' },
];

export function HomeDashboardPage() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {WIDGETS.map(s => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className={`bg-surface rounded-2xl border border-border-custom shadow-sm p-5 hover:shadow-md transition-all ${
              s.wide ? 'sm:col-span-2' : ''
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-ink-900 text-sm">{s.label}</h3>
                <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
