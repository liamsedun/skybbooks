import { useState } from 'react';
import { Database, Download, Upload, Archive, Trash2, FileSpreadsheet, AlertTriangle, CheckCircle } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { useToast } from '../../../contexts/ToastContext';

interface ActionCard { icon: typeof Download; label: string; description: string; action: string; variant: 'primary' | 'danger' | 'warning'; }

export function OpsDataAdministrationPage() {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const openConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmAction({ title, message, onConfirm });
    setConfirmOpen(true);
  };

  const actionCards: ActionCard[] = [
    { icon: Download, label: 'Export All HR Data', description: 'Download a complete CSV archive of all HR modules including employees, documents, and settings.', action: 'export', variant: 'primary' },
    { icon: Upload, label: 'Bulk Import Employees', description: 'Upload a CSV file to bulk create or update employee records in the system.', action: 'import', variant: 'primary' },
    { icon: FileSpreadsheet, label: 'Generate HR Reports', description: 'Generate comprehensive HR reports including headcount, turnover, and demographics.', action: 'reports', variant: 'primary' },
    { icon: Archive, label: 'Archive Inactive Records', description: 'Move records of inactive/terminated employees to the archive for long-term storage.', action: 'archive', variant: 'warning' },
    { icon: Trash2, label: 'Purge Old Records', description: 'Permanently delete records older than the retention period. This action cannot be undone.', action: 'purge', variant: 'danger' },
    { icon: Database, label: 'Database Optimization', description: 'Run database maintenance tasks like indexing, vacuuming, and statistics updates for HR tables.', action: 'optimize', variant: 'primary' },
  ];

  const handleAction = (action: string) => {
    switch (action) {
      case 'export':
        toast('HR data export started. You will be notified when ready.', 'success');
        break;
      case 'import':
        toast('Bulk import initiated. Processing employee records.', 'success');
        break;
      case 'reports':
        toast('HR report generation started. Check the Reports section.', 'success');
        break;
      case 'archive':
        openConfirm('Archive Records', 'This will move all inactive employee records to the archive. Active records will not be affected. Continue?', () => {
          toast('Inactive records archived successfully.', 'success');
          setConfirmOpen(false);
        });
        break;
      case 'purge':
        openConfirm('Purge Old Records', 'This will permanently delete all records older than the retention period (7 years). This action CANNOT be undone. Are you absolutely sure?', () => {
          toast('Old records purged successfully.', 'success');
          setConfirmOpen(false);
        });
        break;
      case 'optimize':
        toast('Database optimization completed successfully.', 'success');
        break;
      default:
        toast('Unknown action.', 'error');
    }
  };

  return (
    <HrPageShell title="Data Administration" description="HR data exports, imports, bulk updates, and system configuration management."
      pageKey="administration">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actionCards.map((card, i) => {
          const Icon = card.icon;
          const variantStyles = {
            primary: 'border-primary/20 hover:border-primary/40 hover:shadow-primary/5',
            danger: 'border-rose-200 hover:border-rose-400 hover:shadow-rose-100',
            warning: 'border-amber-200 hover:border-amber-400 hover:shadow-amber-100',
          };
          const iconStyles = {
            primary: 'bg-primary/10 text-primary',
            danger: 'bg-rose-50 text-rose-600',
            warning: 'bg-amber-50 text-amber-600',
          };
          const buttonStyles = {
            primary: 'bg-primary/10 text-primary hover:bg-primary/20',
            danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
            warning: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
          };
          return (
            <div key={card.action} className={`bg-surface rounded-2xl border ${variantStyles[card.variant]} shadow-sm p-5 transition-all hover:shadow-md group`}>
              <div className={`w-10 h-10 rounded-xl ${iconStyles[card.variant]} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-ink-900 mb-1">{card.label}</h3>
              <p className="text-xs text-ink-400 mb-4 leading-relaxed">{card.description}</p>
              <button onClick={() => handleAction(card.action)} className={`text-xs font-medium px-3 py-1.5 rounded-lg ${buttonStyles[card.variant]} transition-colors`}>
                {card.action === 'export' ? 'Start Export' :
                 card.action === 'import' ? 'Choose File' :
                 card.action === 'reports' ? 'Generate' :
                 card.action === 'archive' ? 'Archive Now' :
                 card.action === 'purge' ? 'Purge Data' :
                 'Run Optimization'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-surface rounded-2xl border border-border-custom shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <div><h3 className="text-sm font-semibold text-ink-900">Data Retention Policy</h3><p className="text-xs text-ink-400">HR records are retained for 7 years per regulatory requirements.</p></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-3 bg-ink-50 rounded-xl"><p className="text-xs text-ink-400">Employee Records</p><p className="font-semibold text-ink-900 mt-0.5">7 Years</p></div>
          <div className="p-3 bg-ink-50 rounded-xl"><p className="text-xs text-ink-400">Payroll Data</p><p className="font-semibold text-ink-900 mt-0.5">7 Years</p></div>
          <div className="p-3 bg-ink-50 rounded-xl"><p className="text-xs text-ink-400">Leave Records</p><p className="font-semibold text-ink-900 mt-0.5">5 Years</p></div>
          <div className="p-3 bg-ink-50 rounded-xl"><p className="text-xs text-ink-400">Performance Reviews</p><p className="font-semibold text-ink-900 mt-0.5">3 Years</p></div>
        </div>
      </div>

      <HrConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={confirmAction?.onConfirm || (() => {})}
        title={confirmAction?.title || 'Confirm'} message={confirmAction?.message || 'Are you sure?'} confirmLabel="Proceed" variant="danger" />
    </HrPageShell>
  );
}


