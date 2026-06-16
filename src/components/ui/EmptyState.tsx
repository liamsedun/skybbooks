/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LucideIcon, PlusCircle } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  id?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  id,
}: EmptyStateProps) {
  return (
    <div 
      id={id || 'empty-state-view'}
      className="flex flex-col items-center justify-center text-center p-8 py-16 bg-white border border-dashed border-slate-200 rounded-xl max-w-lg mx-auto shadow-sm"
    >
      <div className="flex items-center justify-center w-14 h-14 bg-purple-50 rounded-full text-purple-600 mb-4 animate-pulse">
        {Icon ? <Icon className="w-7 h-7" /> : <PlusCircle className="w-7 h-7" />}
      </div>

      <h3 className="text-base font-semibold text-slate-800 mb-1.5">
        {title}
      </h3>
      
      <p className="text-sm text-slate-500 mb-6 max-w-sm">
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 outline-none rounded-xl shadow-sm transition-all hover:shadow focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
export default EmptyState;
