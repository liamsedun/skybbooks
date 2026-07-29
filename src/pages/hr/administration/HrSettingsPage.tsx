import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Settings, ToggleLeft, ToggleRight, Bell, Shield, Mail, Clock, Users, CalendarCheck, FileText } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { useToast } from '../../../contexts/ToastContext';

interface ToggleSetting {
  key: string; label: string; description: string; icon: React.ReactNode; enabled: boolean;
}

function ToggleCard({ setting, onToggle }: { setting: ToggleSetting; onToggle: (key: string) => void }) {
  return (
    <div className="flex items-start justify-between p-4 bg-ink-50 dark:bg-ink-800/50 rounded-2xl border border-border-custom hover:border-primary/20 transition-colors">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">{setting.icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900">{setting.label}</p>
          <p className="text-xs text-ink-400 mt-0.5">{setting.description}</p>
        </div>
      </div>
      <button
        onClick={() => onToggle(setting.key)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          setting.enabled ? 'bg-primary' : 'bg-ink-200 dark:bg-ink-700'
        }`}
        role="switch" aria-checked={setting.enabled}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${setting.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

export function HrSettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [settings, setSettings] = useState<ToggleSetting[]>([
    { key: 'autoApproveLeave', label: 'Auto-approve Leave Requests', description: 'Leave requests are automatically approved without manager review', icon: <CalendarCheck className="w-4 h-4" />, enabled: false },
    { key: 'selfService', label: 'Employee Self-Service Portal', description: 'Allow employees to update their personal information and request time off', icon: <Users className="w-4 h-4" />, enabled: true },
    { key: 'emailNotifications', label: 'Email Notifications', description: 'Send email alerts for leave requests, approvals, and policy changes', icon: <Mail className="w-4 h-4" />, enabled: true },
    { key: 'clockInRequired', label: 'Require Clock-In/Out', description: 'Employees must clock in and out each day for attendance tracking', icon: <Clock className="w-4 h-4" />, enabled: false },
    { key: 'autoGeneratePayroll', label: 'Auto-generate Payroll', description: 'Payroll is automatically generated at the end of each pay period', icon: <FileText className="w-4 h-4" />, enabled: false },
    { key: 'birthdayAnnouncements', label: 'Birthday Announcements', description: 'Automatically post birthday greetings on the team dashboard', icon: <Bell className="w-4 h-4" />, enabled: true },
    { key: 'probationTracking', label: 'Probation Period Tracking', description: 'Track probation end dates and send reminders before they expire', icon: <Shield className="w-4 h-4" />, enabled: true },
    { key: 'otApproval', label: 'Overtime Approval Required', description: 'Overtime hours must be approved by a manager before being applied', icon: <Clock className="w-4 h-4" />, enabled: true },
  ]);

  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  const handleToggle = (key: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, enabled: !s.enabled } : s));
    setChanged(true);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setChanged(false);
      toast('Settings saved successfully', 'success');
    }, 500);
  };

  const enabledCount = useMemo(() => settings.filter(s => s.enabled).length, [settings]);

  return (
    <HrPageShell title="HR Settings" description="Configure your human resource module preferences"
      pageKey="administration"
      headerActions={
        <>
          <button onClick={() => navigate('/app/hr/home')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
          <button onClick={handleSave} disabled={!changed || saving}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </>
      }>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
        <div className="bg-ink-50 dark:bg-ink-800/50 rounded-2xl border border-border-custom p-4">
          <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Total Settings</p>
          <p className="text-xl font-bold text-ink-900 mt-1">{settings.length}</p>
        </div>
        <div className="bg-ink-50 dark:bg-ink-800/50 rounded-2xl border border-border-custom p-4">
          <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Enabled</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{enabledCount}</p>
        </div>
        <div className="bg-ink-50 dark:bg-ink-800/50 rounded-2xl border border-border-custom p-4">
          <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Disabled</p>
          <p className="text-xl font-bold text-ink-400 mt-1">{settings.length - enabledCount}</p>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-ink-400" />
            <h3 className="text-sm font-semibold text-ink-900">Module Preferences</h3>
          </div>
          <p className="text-xs text-ink-400 mt-0.5">Toggle HR features on or off according to your organisation's needs</p>
        </div>
        <div className="p-5 space-y-3">
          {settings.map(setting => (
            <ToggleCard key={setting.key} setting={setting} onToggle={handleToggle} />
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
          <h3 className="text-sm font-semibold text-ink-900">Danger Zone</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800">
            <div>
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Reset All HR Settings</p>
              <p className="text-xs text-rose-500 dark:text-rose-400 mt-0.5">This will revert all settings to their default values</p>
            </div>
            <button onClick={() => { setSettings(prev => prev.map(s => ({ ...s, enabled: false }))); setChanged(true); toast('Settings reset to defaults', 'success'); }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-all shadow-sm">
              Reset All
            </button>
          </div>
        </div>
      </div>
    </HrPageShell>
  );
}


