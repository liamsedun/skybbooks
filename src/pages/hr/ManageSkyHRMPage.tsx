import { Settings, Shield, FileText, Bell, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { HrPageShell } from '../../components/hr/HrPageShell';

const SECTIONS = [
  { path: '/app/hr/settings', icon: Settings, title: 'General Settings', desc: 'Configure work week, daily hours, probation and notice periods, and overtime rules.', color: 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' },
  { path: '/app/hr/leave-types', icon: FileText, title: 'Leave Policy', desc: 'Define leave categories, default days, carry-forward rules, and attachment requirements.', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' },
  { path: '/app/hr/policies', icon: Shield, title: 'HR Policies', desc: 'Manage company policies, handbooks, and compliance documents.', color: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' },
  { path: '/app/hr/approvals', icon: Bell, title: 'Approval Workflows', desc: 'Configure approval chains for leave, travel, expenses, and other HR requests.', color: 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' },
];

export function ManageSkyHRMPage() {
  return (
    <HrPageShell title="Manage SkyHRM" description="Configure HR settings, policies, and approval workflows" pageKey="manage">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SECTIONS.map(s => {
          const Icon = s.icon;
          return (
            <Link key={s.path} to={s.path} className={`group rounded-2xl border p-5 transition-all ${s.color}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/80 border shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{s.title}</h3>
                    <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors shrink-0 mt-2" />
              </div>
            </Link>
          );
        })}
      </div>
    </HrPageShell>
  );
}
