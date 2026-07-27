import { useState, FormEvent } from 'react';
import { CheckCircle, XCircle, UserPlus, Archive, RotateCcw, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface ActionModalBase {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
}

interface ApproveModalProps extends ActionModalBase {
  onConfirm: (comment?: string) => void;
  title?: string;
  itemName?: string;
}

export function ApproveModal({ open, onClose, onConfirm, loading, error, title = 'Approve', itemName }: ApproveModalProps) {
  const [comment, setComment] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onConfirm(comment);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-border-custom p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-900">{title}</h3>
            {itemName && <p className="text-xs text-ink-400">{itemName}</p>}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
          <div>
            <label htmlFor="approve-comment" className="block text-xs font-medium text-ink-600 mb-1">Comment (optional)</label>
            <textarea id="approve-comment" value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Add a note..."
              className="w-full px-3 py-2 text-sm border rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={loading} className="px-3 py-2 text-xs font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-1.5">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{loading ? 'Approving...' : 'Approve'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface RejectModalProps extends ActionModalBase {
  onConfirm: (reason: string) => void;
  title?: string;
  itemName?: string;
}

export function RejectModal({ open, onClose, onConfirm, loading, error, title = 'Reject', itemName }: RejectModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason.trim());
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-border-custom p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-500">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-900">{title}</h3>
            {itemName && <p className="text-xs text-ink-400">{itemName}</p>}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
          <div>
            <label htmlFor="reject-reason" className="block text-xs font-medium text-ink-600 mb-1">Reason <span className="text-rose-500">*</span></label>
            <textarea id="reject-reason" value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Explain why this is being rejected..."
              className="w-full px-3 py-2 text-sm border rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-rose/20 focus:border-rose-400 transition-all resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={loading} className="px-3 py-2 text-xs font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !reason.trim()} className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-1.5">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{loading ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AssignModalProps extends ActionModalBase {
  onConfirm: (assigneeId: string) => void;
  users: { id: string; name: string; avatar?: string; role?: string }[];
  title?: string;
  currentAssigneeId?: string;
}

export function AssignModal({ open, onClose, onConfirm, users, loading, error, title = 'Assign', currentAssigneeId }: AssignModalProps) {
  const [selected, setSelected] = useState(currentAssigneeId || '');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    onConfirm(selected);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-border-custom p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-500">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-900">{title}</h3>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
            {users.map(user => (
              <label key={user.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-all ${selected === user.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-ink-50 dark:hover:bg-ink-800/50'}`}>
                <input type="radio" name="assignee" value={user.id} checked={selected === user.id} onChange={e => setSelected(e.target.value)} className="sr-only" />
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {user.avatar ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" /> : user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{user.name}</p>
                  {user.role && <p className="text-[10px] text-ink-400">{user.role}</p>}
                </div>
                {selected === user.id && <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={loading} className="px-3 py-2 text-xs font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !selected} className="px-4 py-2 text-xs font-semibold text-white bg-primary rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-1.5">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{loading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ArchiveModalProps extends ActionModalBase {
  onConfirm: (reason?: string) => void;
  title?: string;
  itemName?: string;
}

export function ArchiveModal({ open, onClose, onConfirm, loading, error, title = 'Archive', itemName }: ArchiveModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onConfirm(reason);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-border-custom p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-500">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-900">{title}</h3>
            {itemName && <p className="text-xs text-ink-400">{itemName}</p>}
            <p className="text-xs text-ink-400 mt-1">This item will be archived and hidden from default views.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
          <div>
            <label htmlFor="archive-reason" className="block text-xs font-medium text-ink-600 mb-1">Reason (optional)</label>
            <textarea id="archive-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Why is this being archived?"
              className="w-full px-3 py-2 text-sm border rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={loading} className="px-3 py-2 text-xs font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-1.5">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{loading ? 'Archiving...' : 'Archive'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface RestoreModalProps extends ActionModalBase {
  onConfirm: (reason?: string) => void;
  title?: string;
  itemName?: string;
}

export function RestoreModal({ open, onClose, onConfirm, loading, error, title = 'Restore', itemName }: RestoreModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onConfirm(reason);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-border-custom p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-500">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-900">{title}</h3>
            {itemName && <p className="text-xs text-ink-400">{itemName}</p>}
            <p className="text-xs text-ink-400 mt-1">This item will be restored to active view.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
          <div>
            <label htmlFor="restore-reason" className="block text-xs font-medium text-ink-600 mb-1">Reason (optional)</label>
            <textarea id="restore-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Why is this being restored?"
              className="w-full px-3 py-2 text-sm border rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={loading} className="px-3 py-2 text-xs font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-1.5">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{loading ? 'Restoring...' : 'Restore'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
