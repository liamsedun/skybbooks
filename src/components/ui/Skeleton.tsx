import React from 'react';

type SkeletonVariant = 'text' | 'rect' | 'circle';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: SkeletonVariant;
  count?: number;
  className?: string;
}

const baseStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
  borderRadius: '4px',
  display: 'inline-block',
};

const keyframes = `
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

let injected = false;
function injectKeyframes() {
  if (injected) return;
  const style = document.createElement('style');
  style.textContent = keyframes;
  document.head.appendChild(style);
  injected = true;
}

export function Skeleton({ width, height, variant = 'text', count = 1, className }: SkeletonProps) {
  injectKeyframes();
  const style: React.CSSProperties = {
    ...baseStyle,
    width: width ?? (variant === 'circle' ? height ?? '40px' : '100%'),
    height: height ?? (variant === 'text' ? '16px' : variant === 'circle' ? '40px' : '100%'),
    borderRadius: variant === 'circle' ? '50%' : '4px',
    marginBottom: variant === 'text' ? '8px' : 0,
  };
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={className} style={style}>&zwnj;</span>
      ))}
    </>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ width: '100%' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid #eee' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={`${100 / cols}%`} height="20px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div style={{ padding: '1.5rem', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
      <Skeleton width="60%" height="18px" />
      <div style={{ height: '0.75rem' }} />
      <Skeleton width="40%" height="32px" />
      <div style={{ height: '0.5rem' }} />
      <Skeleton width="80%" height="14px" />
    </div>
  );
}
