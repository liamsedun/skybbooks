import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Building, MapPin, Users, UserCheck, Globe, Mail, Shield, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

interface FormTabState {
  name: string;
  description: string;
  enabled: boolean;
}

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

function defaultFormState(label: string): FormTabState {
  return { name: `Default ${label}`, description: `Configure your ${label.toLowerCase()} settings`, enabled: true };
}

function TabContent({ label, state, onChange }: { label: string; state: FormTabState; onChange: (s: FormTabState) => void }) {
  const { success } = useToast();
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">{label}</h2><button onClick={() => { success(`${label} saved`); }} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4">
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Setting Name</label><input value={state.name} onChange={e => onChange({ ...state, name: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder={`Enter ${label.toLowerCase()}`} /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Description</label><textarea rows={3} value={state.description} onChange={e => onChange({ ...state, description: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder={`Describe your ${label.toLowerCase()} configuration`} /></div>
        <div className="flex items-center gap-3"><input type="checkbox" checked={state.enabled} onChange={e => onChange({ ...state, enabled: e.target.checked })} className="rounded border-ink-300 text-primary focus:ring-primary/30" /><span className="text-sm text-ink-600">Enable this setting</span></div>
      </div>
    </div>
  );
}

function LocationsContent({ locations, setLocations }: { locations: string[]; setLocations: React.Dispatch<React.SetStateAction<string[]>> }) {
  const { success } = useToast();
  const [newLocation, setNewLocation] = useState('');

  const addLocation = useCallback(() => {
    if (!newLocation.trim()) return;
    setLocations(prev => [...prev, newLocation.trim()]);
    setNewLocation('');
    success('Location added');
  }, [newLocation, setLocations, success]);

  const removeLocation = useCallback((name: string) => {
    setLocations(prev => prev.filter(l => l !== name));
    success('Location removed');
  }, [setLocations, success]);

  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Locations</h2></div>
      <div className="flex gap-2"><input value={newLocation} onChange={e => setNewLocation(e.target.value)} className="flex-1 px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Enter location name" /><button onClick={addLocation} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add</button></div>
      <div className="space-y-2">{locations.map(l => (
        <div key={l} className="flex items-center justify-between p-3 border border-border-custom rounded-xl"><span className="text-sm font-medium text-ink-900">{l}</span><button onClick={() => removeLocation(l)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></div>
      ))}</div>
    </div>
  );
}

function DepartmentsContent({ depts, setDepts }: { depts: string[]; setDepts: React.Dispatch<React.SetStateAction<string[]>> }) {
  const { success } = useToast();
  const [newDept, setNewDept] = useState('');

  const addDept = useCallback(() => {
    if (!newDept.trim()) return;
    setDepts(prev => [...prev, newDept.trim()]);
    setNewDept('');
    success('Department added');
  }, [newDept, setDepts, success]);

  const removeDept = useCallback((name: string) => {
    setDepts(prev => prev.filter(d => d !== name));
    success('Department removed');
  }, [setDepts, success]);

  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Departments</h2></div>
      <div className="flex gap-2"><input value={newDept} onChange={e => setNewDept(e.target.value)} className="flex-1 px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Enter department name" /><button onClick={addDept} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Head</th><th className="px-3 py-2 text-left">Employees</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border-custom">{depts.map(d => (
        <tr key={d} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{d}</td><td className="px-3 py-2.5 text-sm text-ink-500">—</td><td className="px-3 py-2.5 text-sm text-ink-500">0</td><td className="px-3 py-2.5 text-right"><button onClick={() => removeDept(d)} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>
      ))}</tbody></table></div>
    </div>
  );
}

function DesignationsContent({ designations, setDesignations }: { designations: string[]; setDesignations: React.Dispatch<React.SetStateAction<string[]>> }) {
  const { success } = useToast();
  const [newDesig, setNewDesig] = useState('');

  const addDesig = useCallback(() => {
    if (!newDesig.trim()) return;
    setDesignations(prev => [...prev, newDesig.trim()]);
    setNewDesig('');
    success('Designation added');
  }, [newDesig, setDesignations, success]);

  const removeDesig = useCallback((name: string) => {
    setDesignations(prev => prev.filter(d => d !== name));
    success('Designation removed');
  }, [setDesignations, success]);

  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Designations</h2></div>
      <div className="flex gap-2"><input value={newDesig} onChange={e => setNewDesig(e.target.value)} className="flex-1 px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Enter designation title" /><button onClick={addDesig} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">Title</th><th className="px-3 py-2 text-left">Department</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border-custom">{designations.map(d => (
        <tr key={d} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{d}</td><td className="px-3 py-2.5 text-sm text-ink-500">—</td><td className="px-3 py-2.5 text-right"><button onClick={() => removeDesig(d)} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>
      ))}</tbody></table></div>
    </div>
  );
}

export function OrganisationSection() {
  const { success } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'policy';

  const [formStates, setFormStates] = useState<Record<string, FormTabState>>(() => {
    const init: Record<string, FormTabState> = {};
    TABS.forEach(t => { init[t.key] = defaultFormState(t.label); });
    return init;
  });
  const [locations, setLocations] = useState(['Lagos HQ', 'Abuja Office', 'Port Harcourt Branch']);
  const [depts, setDepts] = useState(['Engineering', 'Marketing', 'Finance', 'Human Resources', 'Operations', 'Sales']);
  const [designations, setDesignations] = useState(['Senior Developer', 'Marketing Lead', 'Accountant', 'HR Manager', 'Operations Manager', 'Sales Executive']);

  const updateForm = (key: string, state: FormTabState) => {
    setFormStates(prev => ({ ...prev, [key]: state }));
  };

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
        {activeTab === 'locations' && <LocationsContent locations={locations} setLocations={setLocations} />}
        {activeTab === 'departments' && <DepartmentsContent depts={depts} setDepts={setDepts} />}
        {activeTab === 'designations' && <DesignationsContent designations={designations} setDesignations={setDesignations} />}
        {activeTab !== 'locations' && activeTab !== 'departments' && activeTab !== 'designations' && (
          <TabContent label={TABS.find(t => t.key === activeTab)?.label || 'Policy'} state={formStates[activeTab] || defaultFormState('')} onChange={s => updateForm(activeTab, s)} />
        )}
      </div>
    </div>
  );
}
