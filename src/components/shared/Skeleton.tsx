import { ReactNode } from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
}

const shimmer = 'bg-gradient-to-r from-ink-100 via-ink-200/60 to-ink-100 dark:from-ink-800 dark:via-ink-700/60 dark:to-ink-800 bg-[length:200%_100%] animate-shimmer';

export function Skeleton({ className, variant = 'text', width, height }: SkeletonProps) {
  const base = `${shimmer} ${variant === 'circle' ? 'rounded-full' : variant === 'rect' ? 'rounded-xl' : 'rounded h-4'}`;
  return <div className={`${base} ${className || ''}`} style={{ width, height }} />;
}

export function TableSkeleton({ rows = 5, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={`border border-border-custom rounded-xl overflow-hidden ${className || ''}`}>
      <div className="bg-ink-50 dark:bg-ink-800/50 px-4 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3 flex gap-4 border-t border-border-custom">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={`h-3 ${c === 0 ? 'w-1/3' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(count, 4)} gap-4 ${className || ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-border-custom rounded-xl p-4 space-y-3">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-2 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 3, className }: { fields?: number; className?: string }) {
  return (
    <div className={`space-y-4 ${className || ''}`}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-2">
        <Skeleton className="h-9 w-20 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </div>
  );
}
