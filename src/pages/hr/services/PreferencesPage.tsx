import { useState } from 'react';
import { Bell, MessageSquare, Moon, Globe2, CalendarDays, CheckCircle2 } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { useToast } from '../../../contexts/ToastContext';

const defaultSettings = {
  emailNotifications: true,
  smsAlerts: false,
  darkModeDefault: false,
  language: 'en',
  timezone: 'Africa/Lagos',
  dateFormat: 'DD/MM/YYYY',
};

export function PreferencesPage() {
  const { success: showSuccess } = useToast();
  const [settings, setSettings] = useState({ ...defaultSettings });
  const [dirty, setDirty] = useState(false);

  const toggle = (key: 'emailNotifications' | 'smsAlerts' | 'darkModeDefault') => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const handleSelect = (key: 'language' | 'timezone' | 'dateFormat', value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    showSuccess('Preferences saved successfully');
    setDirty(false);
  };

  const toggleCards = [
    { key: 'emailNotifications' as const, label: 'Email Notifications', description: 'Receive email alerts for HR updates and approvals', icon: <Bell className="w-5 h-5" />, color: 'blue' as const },
    { key: 'smsAlerts' as const, label: 'SMS Alerts', description: 'Get SMS notifications for urgent HR matters', icon: <MessageSquare className="w-5 h-5" />, color: 'purple' as const },
    { key: 'darkModeDefault' as const, label: 'Dark Mode Default', description: 'Use dark theme as the default display mode', icon: <Moon className="w-5 h-5" />, color: 'slate' as const },
  ];

  const selectCards = [
    { key: 'language' as const, label: 'Language', value: settings.language, options: [{ v: 'en', l: 'English' }, { v: 'fr', l: 'French' }, { v: 'es', l: 'Spanish' }, { v: 'pt', l: 'Portuguese' }], icon: <Globe2 className="w-5 h-5" />, color: 'cyan' as const },
    { key: 'timezone' as const, label: 'Timezone', value: settings.timezone, options: [{ v: 'Africa/Lagos', l: 'Africa/Lagos (WAT)' }, { v: 'Africa/Accra', l: 'Africa/Accra (GMT)' }, { v: 'Africa/Nairobi', l: 'Africa/Nairobi (EAT)' }, { v: 'Europe/London', l: 'Europe/London (GMT/BST)' }, { v: 'America/New_York', l: 'America/New_York (EST/EDT)' }], icon: <Globe2 className="w-5 h-5" />, color: 'emerald' as const },
    { key: 'dateFormat' as const, label: 'Date Format', value: settings.dateFormat, options: [{ v: 'DD/MM/YYYY', l: 'DD/MM/YYYY' }, { v: 'MM/DD/YYYY', l: 'MM/DD/YYYY' }, { v: 'YYYY-MM-DD', l: 'YYYY-MM-DD' }], icon: <CalendarDays className="w-5 h-5" />, color: 'amber' as const },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
    slate: 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
  };

  return (
    <HrPageShell title="Preferences" description="Manage your HR system preferences, notifications, and default settings"
      pageKey="administration"
      headerActions={
        <button onClick={handleSave} disabled={!dirty}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5" /> Save Preferences
        </button>
      }>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {toggleCards.map(card => (
          <div key={card.key} className={`rounded-2xl border p-5 ${colorMap[card.color]} bg-opacity-50`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${colorMap[card.color]}`}>{card.icon}</div>
              <button
                onClick={() => toggle(card.key)}
                className={`relative w-10 h-5.5 rounded-full transition-all duration-300 ${settings[card.key] ? 'bg-primary' : 'bg-ink-200 dark:bg-ink-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-transform duration-300 ${settings[card.key] ? 'translate-x-[18px]' : 'translate-x-0'}`} />
              </button>
            </div>
            <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">{card.label}</h3>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">{card.description}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {selectCards.map(card => (
          <div key={card.key} className="rounded-2xl border border-border-custom p-5 bg-surface">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2.5 rounded-xl ${colorMap[card.color]}`}>{card.icon}</div>
              <div>
                <h3 className="text-sm font-semibold text-ink-900">{card.label}</h3>
                <p className="text-xs text-ink-400 mt-0.5">Current: {card.value}</p>
              </div>
            </div>
            <select value={card.value} onChange={e => handleSelect(card.key, e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              {card.options.map(o => (
                <option key={o.v} value={o.v}>{o.l}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </HrPageShell>
  );
}


