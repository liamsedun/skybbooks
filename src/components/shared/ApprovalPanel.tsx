import { ReactNode } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface ApprovalPanelProps {
  status: 'pending' | 'approved' | 'rejected' | 'draft';
  children?: ReactNode;
  className?: string;
}

const statusConfig = {
  pending: { icon: Clock, bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', label: 'Pending Approval' },
  approved: { icon: CheckCircle, bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400', label: 'Approved' },
  rejected: { icon: XCircle, bg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-400', label: 'Rejected' },
  draft: { icon: AlertTriangle, bg: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-400', label: 'Draft' },
};

export function ApprovalPanel({ status, children, className }: ApprovalPanelProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`border rounded-xl ${config.bg} ${className || ''}`}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-inherit">
        <Icon className={`w-5 h-5 ${config.text}`} />
        <span className={`text-sm font-semibold ${config.text}`}>{config.label}</span>
      </div>
      {children && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

interface ApprovalActionProps {
  onApprove?: () => void;
  onReject?: () => void;
  approveLabel?: string;
  rejectLabel?: string;
  loading?: boolean;
  disabled?: boolean;
}

export function ApprovalActions({ onApprove, onReject, approveLabel = 'Approve', rejectLabel = 'Reject', loading, disabled }: ApprovalActionProps) {
  return (
    <div className="flex items-center gap-2 pt-2">
      {onReject && (
        <button type="button" onClick={onReject} disabled={disabled || loading}
          className="px-4 py-2 text-xs font-semibold text-rose-600 bg-white dark:bg-ink-800 border border-rose-200 dark:border-rose-800 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {rejectLabel}
        </button>
      )}
      {onApprove && (
        <button type="button" onClick={onApprove} disabled={disabled || loading}
          className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-1.5">
          {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {approveLabel}
        </button>
      )}
    </div>
  );
}

interface ApproverAvatarProps {
  name: string;
  action: 'approved' | 'rejected' | 'pending';
  timestamp?: string;
  comment?: string;
}

export function ApproverAvatar({ name, action, timestamp, comment }: ApproverAvatarProps) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const colors = action === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' :
    action === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400' :
    'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400';

  return (
    <div className="flex items-start gap-2.5">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${colors}`}>
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-900">{name}</p>
        {timestamp && <p className="text-[10px] text-ink-400">{timestamp}</p>}
        {comment && <p className="text-xs text-ink-500 mt-0.5 italic">"{comment}"</p>}
      </div>
    </div>
  );
}
