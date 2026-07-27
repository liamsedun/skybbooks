import { AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorDisplayProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  variant?: 'inline' | 'card' | 'fullscreen';
  className?: string;
}

export function ErrorDisplay({ title = 'Something went wrong', message = 'An unexpected error occurred. Please try again.', onRetry, variant = 'card', className }: ErrorDisplayProps) {
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-sm text-rose-600 dark:text-rose-400 ${className || ''}`}>
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="flex-1">{message}</span>
        {onRetry && (
          <button onClick={onRetry} className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors" aria-label="Retry">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (variant === 'fullscreen') {
    return (
      <div className={`flex flex-col items-center justify-center py-16 px-4 ${className || ''}`}>
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-500 mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        <p className="text-sm text-ink-500 mt-1 text-center max-w-md">{message}</p>
        {onRetry && (
          <button onClick={onRetry}
            className="mt-4 px-4 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary-hover transition-all shadow-sm inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`border border-rose-200 dark:border-rose-800 rounded-xl p-6 text-center ${className || ''}`}>
      <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-500 inline-flex mb-3">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-ink-900">{title}</h4>
      <p className="text-xs text-ink-500 mt-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="mt-3 px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-xl hover:bg-primary-hover transition-all">
          Retry
        </button>
      )}
    </div>
  );
}

interface SuccessMessageProps {
  message: string;
  title?: string;
  onDismiss?: () => void;
  className?: string;
}

export function SuccessMessage({ message, title, onDismiss, className }: SuccessMessageProps) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl ${className || ''}`}>
      <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      </div>
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{title}</p>}
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="p-0.5 rounded text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors" aria-label="Dismiss">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}
