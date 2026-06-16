/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export type StatusType = 
  | 'Paid' | 'Unpaid' | 'Overdue' 
  | 'Pending' | 'Paid' | 'Draft' | 'Void' | 'Approved'
  | 'active' | 'inactive'
  | 'Checking' | 'Savings' | 'Credit Card'
  | string;

interface StatusBadgeProps {
  status: StatusType;
  id?: string;
}

export function StatusBadge({ status, id }: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  let colorSchema = 'bg-slate-100 text-slate-600';
  let dotColor = 'bg-slate-450 bg-slate-400';
  let animClass = '';

  if (['paid', 'approved', 'active'].includes(normalized)) {
    // Paid or Active state
    colorSchema = 'bg-success-bg text-success-custom';
    dotColor = 'bg-success-custom';
  } else if (['unpaid', 'pending', 'checking', 'partial'].includes(normalized)) {
    // Pending / Unpaid
    colorSchema = 'bg-warning-bg text-warning-custom';
    dotColor = 'bg-warning-custom';
  } else if (['overdue'].includes(normalized)) {
    // Overdue
    colorSchema = 'bg-danger-bg text-danger-custom';
    dotColor = 'bg-danger-custom';
    animClass = 'animate-pulse';
  } else if (['inactive', 'void'].includes(normalized)) {
    // Void or inactive
    colorSchema = 'bg-slate-100 text-slate-400 line-through';
    dotColor = 'bg-slate-400';
  } else if (['draft', 'savings'].includes(normalized)) {
    // draft
    colorSchema = 'bg-slate-105 bg-slate-100 text-slate-600';
    dotColor = 'bg-slate-400';
  } else {
    colorSchema = 'bg-info-bg text-info-custom';
    dotColor = 'bg-info-custom';
  }

  return (
    <span 
      id={id || `badge-${normalized}`}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase select-none ${colorSchema}`}
    >
      <span className={`w-1.5 h-1.5 mr-1.5 rounded-full ${dotColor} ${animClass}`}></span>
      {status}
    </span>
  );
}
export default StatusBadge;
