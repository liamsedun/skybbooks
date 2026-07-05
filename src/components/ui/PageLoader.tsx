import React from 'react';

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = 'Loading...' }: PageLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 select-none">
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-500 to-indigo-400 animate-pulse" />
        <div className="absolute inset-0 rounded-2xl ring-2 ring-indigo-200/50 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-xl font-black tracking-tight">S</span>
        </div>
      </div>
      <div className="h-1.5 w-48 bg-slate-100 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400 rounded-full animate-loading-bar" />
      </div>
      <p className="text-sm font-medium text-slate-400 animate-pulse">{message}</p>
    </div>
  );
}

export default PageLoader;
