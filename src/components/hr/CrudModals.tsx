import { ReactNode, FormEvent, useCallback } from 'react';
import { HrFormModal } from './HrFormModal';
import { HrConfirmDialog } from './HrConfirmDialog';
import { HrViewDrawer } from './HrViewDrawer';
import { useToast } from '../../contexts/ToastContext';

interface CrudModalBase {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  error?: string | null;
  loading?: boolean;
}

interface CreateFormModalProps extends CrudModalBase {
  onSubmit: (e: FormEvent) => void;
  submitLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function CreateFormModal({ open, onClose, title = 'Create', children, onSubmit, error, loading, submitLabel = 'Create', size }: CreateFormModalProps) {
  return (
    <HrFormModal open={open} onClose={onClose} title={title} onSubmit={onSubmit} error={error} loading={loading} submitLabel={submitLabel} size={size}>
      {children}
    </HrFormModal>
  );
}

interface EditFormModalProps extends CrudModalBase {
  onSubmit: (e: FormEvent) => void;
  submitLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function EditFormModal({ open, onClose, title = 'Edit', children, onSubmit, error, loading, submitLabel = 'Save Changes', size }: EditFormModalProps) {
  return (
    <HrFormModal open={open} onClose={onClose} title={title} onSubmit={onSubmit} error={error} loading={loading} submitLabel={submitLabel} size={size}>
      {children}
    </HrFormModal>
  );
}

interface ViewDetailModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export function ViewDetailModal({ open, onClose, title, children, width }: ViewDetailModalProps) {
  return (
    <HrViewDrawer open={open} onClose={onClose} title={title} width={width}>
      {children}
    </HrViewDrawer>
  );
}

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  loading?: boolean;
}

export function DeleteConfirmModal({ open, onClose, onConfirm, title = 'Delete', message = 'Are you sure you want to delete this item? This action cannot be undone.', loading }: DeleteConfirmModalProps) {
  return (
    <HrConfirmDialog open={open} onClose={onClose} onConfirm={onConfirm} title={title} message={message} variant="danger" confirmLabel="Delete" loading={loading} />
  );
}

interface DetailFieldProps {
  label: string;
  value: string | ReactNode;
  colSpan?: boolean;
}

export function DetailField({ label, value, colSpan }: DetailFieldProps) {
  return (
    <div className={colSpan ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium text-ink-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm text-ink-900">
        {typeof value === 'string' ? (value || <span className="text-ink-300 italic">Not set</span>) : value}
      </dd>
    </div>
  );
}

interface DetailSectionProps {
  title: string;
  children: ReactNode;
}

export function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-ink-500 uppercase tracking-wider border-b border-border-custom pb-1.5">{title}</h4>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">{children}</dl>
    </div>
  );
}

export function DetailDivider() {
  return <hr className="border-border-custom -mx-1" />;
}

export function useCrudActions<T extends { id: string | number }>() {
  const { toast } = useToast();

  const handleCreate = useCallback(async (
    apiCall: () => Promise<any>,
    onSuccess?: (result: any) => void,
    onCreateSuccess?: () => void,
  ) => {
    try {
      const result = await apiCall();
      toast('Created successfully', 'success');
      onSuccess?.(result);
      onCreateSuccess?.();
    } catch (err: any) {
      toast(err?.message || 'Failed to create', 'error');
      throw err;
    }
  }, [toast]);

  const handleUpdate = useCallback(async (
    apiCall: () => Promise<any>,
    onSuccess?: (result: any) => void,
    onUpdateSuccess?: () => void,
  ) => {
    try {
      const result = await apiCall();
      toast('Updated successfully', 'success');
      onSuccess?.(result);
      onUpdateSuccess?.();
    } catch (err: any) {
      toast(err?.message || 'Failed to update', 'error');
      throw err;
    }
  }, [toast]);

  const handleDelete = useCallback(async (
    apiCall: () => Promise<any>,
    onSuccess?: () => void,
    onDeleteSuccess?: () => void,
  ) => {
    try {
      await apiCall();
      toast('Deleted successfully', 'success');
      onSuccess?.();
      onDeleteSuccess?.();
    } catch (err: any) {
      toast(err?.message || 'Failed to delete', 'error');
      throw err;
    }
  }, [toast]);

  return { handleCreate, handleUpdate, handleDelete };
}
