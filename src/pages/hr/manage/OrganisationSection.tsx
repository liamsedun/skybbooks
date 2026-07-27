import { useSearchParams } from 'react-router-dom';
import { FileText, Building, MapPin, Users, UserCheck, Globe, Mail, Shield, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

const TABS = [
  { label: 'Organisation Policy', key: 'policy', icon: FileText },
  { label: 'Organisation Structure', key: 'structure', icon: Building },
  { label: 'Locations', key: 'locations', icon: MapPin },
  { label: 'Departments', key: 'departments', icon: Users },
  { label: 'Designations', key: 'designations', icon: UserCheck },
  { label: 'Domains & Rebranding', key: 'domains', icon: Globe },
  { label: 'From Address', key: 'from-address', icon: Mail },
  { label: 'Email Authentication', key: 'email-auth', icon: Shield },
];

function TabContent({ label }: { label: string }) {
  const { success } = useToast();
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">{label}</h2><button onClick={() => success('Saved')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4">
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Setting Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder={`Enter ${label.toLowerCase()} setting`} /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Description</label><textarea rows={3} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder={`Describe your ${label.toLowerCase()} configuration`} /></div>
        <div className="flex items-center gap-3"><input type="checkbox" className="rounded border-ink-300 text-primary focus:ring-primary/30" /><span className="text-sm text-ink-600">Enable this setting</span></div>
      </div>
    </div>
  );
}

function LocationsContent() {
  const { success } = useToast();
  const locations = ['Lagos HQ', 'Abuja Office', 'Port Harcourt Branch'];
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Locations</h2><button onClick={() => success('Location added')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Location</button></div>
      <div className="space-y-2">{locations.map(l => (
        <div key={l} className="flex items-center justify-between p-3 border border-border-custom rounded-xl"><span className="text-sm font-medium text-ink-900">{l}</span><button onClick={() => success('Location removed')} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></div>
      ))}</div>
    </div>
  );
}

function DepartmentsContent() {
  const { success } = useToast();
  const depts = ['Engineering', 'Marketing', 'Finance', 'Human Resources', 'Operations', 'Sales'];
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Departments</h2><button onClick={() => success('Department added')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Department</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Head</th><th className="px-3 py-2 text-left">Employees</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border-custom">{depts.map(d => (
        <tr key={d} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{d}</td><td className="px-3 py-2.5 text-sm text-ink-500">â€”</td><td className="px-3 py-2.5 text-sm text-ink-500">0</td><td className="px-3 py-2.5 text-right"><button onClick={() => success('Department removed')} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>
      ))}</tbody></table></div>
    </div>
  );
}

function DesignationsContent() {
  const { success } = useToast();
  const designations = ['Senior Developer', 'Marketing Lead', 'Accountant', 'HR Manager', 'Operations Manager', 'Sales Executive'];
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Designations</h2><button onClick={() => success('Designation added')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Designation</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">Title</th><th className="px-3 py-2 text-left">Department</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border-custom">{designations.map(d => (
        <tr key={d} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{d}</td><td className="px-3 py-2.5 text-sm text-ink-500">â€”</td><td className="px-3 py-2.5 text-right"><button onClick={() => success('Designation removed')} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>
      ))}</tbody></table></div>
    </div>
  );
}

export function OrganisationSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'policy';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setSearchParams({ tab: tab.key })}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                isActive ? 'bg-primary/10 text-primary' : 'text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div className="lg:col-span-3 space-y-6">
        {activeTab === 'locations' && <LocationsContent />}
        {activeTab === 'departments' && <DepartmentsContent />}
        {activeTab === 'designations' && <DesignationsContent />}
        {activeTab !== 'locations' && activeTab !== 'departments' && activeTab !== 'designations' && <TabContent label={TABS.find(t => t.key === activeTab)?.label || 'Policy'} />}
      </div>
    </div>
  );
}
