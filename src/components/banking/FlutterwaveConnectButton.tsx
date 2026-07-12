/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';

interface FlutterwaveConnectButtonProps {
  bankAccountId: string;
  onSuccess: () => void;
  onClose?: () => void;
  className?: string;
}

export function FlutterwaveConnectButton({
  className = ''
}: FlutterwaveConnectButtonProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <a
        href="https://mono.co"
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded bg-indigo-600 text-white hover:bg-slate-900 transition-colors uppercase tracking-tight duration-150 cursor-pointer ${className}`}
      >
        <ExternalLink className="w-3 h-3" />
        Link Bank Account
      </a>
    </div>
  );
}
