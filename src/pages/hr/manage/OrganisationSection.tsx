import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Building, MapPin, Users, UserCheck, Globe, Mail, Shield, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { orgApi, hrApi } from '../../../lib/api';

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

function TabContent({ label, state, onChange, onSave }: { label: string; state: FormTabState; onChange: (s: FormTabState) => void; onSave: () => void }) {
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">{label}</h2><button onClick={onSave} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4">
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Setting Name</label><input value={state.name} onChange={e => onChange({ ...state, name: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder={`Enter ${label.toLowerCase()}`} /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Description</label><textarea rows={3} value={state.description} onChange={e => onChange({ ...state, description: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder={`Describe your ${label.toLowerCase()} configuration`} /></div>
        <div className="flex items-center gap-3"><input type="checkbox" checked={state.enabled} onChange={e => onChange({ ...state, enabled: e.target.checked })} className="rounded border-ink-300 text-primary focus:ring-primary/30" /><span className="text-sm text-ink-600">Enable this setting</span></div>
      </div>
    </div>
  );
}

function LocationsContent({ locations, setLocations, onSave }: { locations: string[]; setLocations: React.Dispatch<React.SetStateAction<string[]>>; onSave: () => void }) {
  const { success } = useToast();
  const [newLocation, setNewLocation] = useState('');

  const addLocation = useCallback(() => {
    if (!newLocation.trim()) return;
    setLocations(prev => [...prev, newLocation.trim()]);
    setNewLocation('');
  }, [newLocation, setLocations]);

  const removeLocation = useCallback((name: string) => {
    setLocations(prev => prev.filter(l => l !== name));
  }, [setLocations]);

  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Locations</h2><button onClick={onSave} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="flex gap-2"><input value={newLocation} onChange={e => setNewLocation(e.target.value)} className="flex-1 px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Enter location name" /><button onClick={addLocation} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add</button></div>
      <div className="space-y-2">{locations.map(l => (
        <div key={l} className="flex items-center justify-between p-3 border border-border-custom rounded-xl"><span className="text-sm font-medium text-ink-900">{l}</span><button onClick={() => removeLocation(l)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></div>
      ))}</div>
    </div>
  );
}

function DepartmentsContent() {
  const { success, error: showError } = useToast();
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [newDept, setNewDept] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchDepts = async () => {
    try {
      setLoading(true);
      const data = await hrApi.getDepartments();
      const list = (data?.data || data || []).map((d: any) => ({ id: d.id, name: d.name || d.title || '' }));
      setDepts(list);
    } catch { showError('Failed to load departments'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchDepts(); }, []);

  const addDept = async () => {
    if (!newDept.trim()) return;
    try {
      await hrApi.createDepartment({ name: newDept.trim() });
      setNewDept('');
      success('Department added');
      await fetchDepts();
    } catch { showError('Failed to add department'); }
  };

  const removeDept = async (id: string) => {
    try {
      await hrApi.deleteDepartment(id);
      success('Department removed');
      await fetchDepts();
    } catch { showError('Failed to remove department'); }
  };

  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Departments</h2></div>
      <div className="flex gap-2"><input value={newDept} onChange={e => setNewDept(e.target.value)} className="flex-1 px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Enter department name" /><button onClick={addDept} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add</button></div>
      <div className="overflow-x-auto">{loading ? <p className="text-sm text-ink-400 p-3">Loading...</p> : <table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border-custom">{depts.map(d => (
        <tr key={d.id} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{d.name}</td><td className="px-3 py-2.5 text-right"><button onClick={() => removeDept(d.id)} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>
      ))}</tbody></table>}</div>
    </div>
  );
}

function DesignationsContent() {
  const { success, error: showError } = useToast();
  const [designations, setDesignations] = useState<{ id: string; title: string }[]>([]);
  const [newDesig, setNewDesig] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchDesigs = async () => {
    try {
      setLoading(true);
      const data = await hrApi.getDesignations();
      const list = (data?.data || data || []).map((d: any) => ({ id: d.id, title: d.title || d.name || '' }));
      setDesignations(list);
    } catch { showError('Failed to load designations'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchDesigs(); }, []);

  const addDesig = async () => {
    if (!newDesig.trim()) return;
    try {
      await hrApi.createDesignation({ title: newDesig.trim() });
      setNewDesig('');
      success('Designation added');
      await fetchDesigs();
    } catch { showError('Failed to add designation'); }
  };

  const removeDesig = async (id: string) => {
    try {
      await hrApi.deleteDesignation(id);
      success('Designation removed');
      await fetchDesigs();
    } catch { showError('Failed to remove designation'); }
  };

  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Designations</h2></div>
      <div className="flex gap-2"><input value={newDesig} onChange={e => setNewDesig(e.target.value)} className="flex-1 px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Enter designation title" /><button onClick={addDesig} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add</button></div>
      <div className="overflow-x-auto">{loading ? <p className="text-sm text-ink-400 p-3">Loading...</p> : <table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">Title</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border-custom">{designations.map(d => (
        <tr key={d.id} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{d.title}</td><td className="px-3 py-2.5 text-right"><button onClick={() => removeDesig(d.id)} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>
      ))}</tbody></table>}</div>
    </div>
  );
}

export function OrganisationSection() {
  const { success, error: showError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'policy';

  const [formStates, setFormStates] = useState<Record<string, FormTabState>>({});
  const [locations, setLocations] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    orgApi.getSettings().then(settings => {
      const hr = (settings as any)?.hr || {};
      const init: Record<string, FormTabState> = {};
      TABS.forEach(t => {
        if (['locations', 'departments', 'designations'].includes(t.key)) return;
        const saved = hr[t.key];
        init[t.key] = saved ? { name: saved.name || '', description: saved.description || '', enabled: saved.enabled !== false } : defaultFormState(t.label);
      });
      setFormStates(init);
      if (hr.locations) setLocations(hr.locations);
      setLoaded(true);
    }).catch(() => {
      const init: Record<string, FormTabState> = {};
      TABS.forEach(t => {
        if (['locations', 'departments', 'designations'].includes(t.key)) return;
        init[t.key] = defaultFormState(t.label);
      });
      setFormStates(init);
      setLocations(['Lagos HQ', 'Abuja Office', 'Port Harcourt Branch']);
      setLoaded(true);
    });
  }, []);

  const saveSettings = async () => {
    try {
      const hrSettings: any = {};
      for (const key of Object.keys(formStates)) hrSettings[key] = formStates[key];
      hrSettings.locations = locations;
      await orgApi.updateSettings({ hr: hrSettings });
      success('Settings saved');
    } catch { showError('Failed to save settings'); }
  };

  const saveTabSetting = async (key: string) => {
    try {
      const hrSettings: any = {};
      hrSettings[key] = formStates[key];
      hrSettings.locations = locations;
      await orgApi.updateSettings({ hr: hrSettings });
      success(`${TABS.find(t => t.key === key)?.label || key} saved`);
    } catch { showError('Failed to save'); }
  };

  const updateForm = (key: string, state: FormTabState) => {
    setFormStates(prev => ({ ...prev, [key]: state }));
  };

  if (!loaded) return <div className="p-6 text-sm text-ink-400">Loading...</div>;

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
        {activeTab === 'locations' && <LocationsContent locations={locations} setLocations={setLocations} onSave={saveSettings} />}
        {activeTab === 'departments' && <DepartmentsContent />}
        {activeTab === 'designations' && <DesignationsContent />}
        {activeTab !== 'locations' && activeTab !== 'departments' && activeTab !== 'designations' && (
          <TabContent label={TABS.find(t => t.key === activeTab)?.label || 'Policy'} state={formStates[activeTab] || defaultFormState('')} onChange={s => updateForm(activeTab, s)} onSave={() => saveTabSetting(activeTab)} />
        )}
      </div>
    </div>
  );
}
