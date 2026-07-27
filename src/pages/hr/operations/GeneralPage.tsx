import { useState } from 'react';
import { Sliders, Save, RotateCcw } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { useToast } from '../../../contexts/ToastContext';

interface ToggleSetting { key: string; label: string; description: string; enabled: boolean; }

export function OpsGeneralPage() {
  const { success: showSuccess } = useToast();
  const [settings, setSettings] = useState<ToggleSetting[]>([
    { key: 'auto-approve-leave', label: 'Auto-Approve Leave Requests', description: 'Leave requests under 3 days are automatically approved.', enabled: false },
    { key: 'notify-onboarding', label: 'Notify Onboarding Tasks', description: 'Send email reminders for pending onboarding tasks.', enabled: true },
    { key: 'overtime-tracking', label: 'Enable Overtime Tracking', description: 'Track and calculate overtime hours for employees.', enabled: true },
    { key: 'self-service-portal', label: 'Employee Self-Service Portal', description: 'Allow employees to update their own information.', enabled: true },
    { key: 'require-timesheets', label: 'Require Weekly Timesheets', description: 'All employees must submit weekly timesheets.', enabled: false },
    { key: 'performance-reminders', label: 'Performance Review Reminders', description: 'Auto-send reminders for upcoming performance reviews.', enabled: true },
    { key: 'travel-approval-flow', label: 'Travel Approval Workflow', description: 'All travel requests require manager approval.', enabled: true },
    { key: 'document-expiry-alerts', label: 'Document Expiry Alerts', description: 'Auto-alert when employee documents are expiring.', enabled: true },
    { key: 'bulk-email-notifications', label: 'Bulk Email Notifications', description: 'Send batch email notifications for HR announcements.', enabled: false },
    { key: 'audit-logging', label: 'HR Audit Logging', description: 'Log all HR operations for compliance and audit.', enabled: true },
  ]);

  const toggleSetting = (key: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, enabled: !s.enabled } : s));
  };

  const handleSave = () => {
    showSuccess('Settings saved');
  };

  const handleReset = () => {
    setSettings(prev => prev.map(s => ({ ...s, enabled: false })));
    showSuccess('Settings reset to defaults');
  };

  return (
    <HrPageShell title="General Settings" description="Miscellaneous HR settings, announcements, and system-wide configurations."
      pageKey="administration"
      headerActions={<><button onClick={handleSave} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"><Save className="w-3.5 h-3.5" />Save</button><button onClick={handleReset} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Reset</button></>}>
      <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Sliders className="w-5 h-5 text-primary" /></div>
          <div><h2 className="text-sm font-semibold text-ink-900">HR Operations Settings</h2><p className="text-xs text-ink-400">Configure how HR operations modules behave across the organisation.</p></div>
        </div>
        <div className="divide-y divide-border-custom">
          {settings.map(s => (
            <div key={s.key} className="flex items-center justify-between py-4">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-ink-900">{s.label}</p>
                <p className="text-xs text-ink-400 mt-0.5">{s.description}</p>
              </div>
              <button
                onClick={() => toggleSetting(s.key)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${s.enabled ? 'bg-primary' : 'bg-ink-200'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${s.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </HrPageShell>
  );
}


