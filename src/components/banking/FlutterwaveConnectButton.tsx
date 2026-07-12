/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { bankingApi } from '../../lib/api';
import { Loader2, ShieldCheck, X, ExternalLink } from 'lucide-react';

interface MonoConnectInstance {
  setup: () => void;
  open: () => void;
}

interface MonoConnectConfig {
  key: string;
  scope: string;
  onSuccess: (code: string) => void;
  onClose: () => void;
  onError: (err: any) => void;
}

interface FlutterwaveConnectButtonProps {
  bankAccountId: string;
  onSuccess: () => void;
  onClose?: () => void;
  className?: string;
}

declare global {
  interface Window {
    MonoConnect?: (config: MonoConnectConfig) => MonoConnectInstance;
  }
}



export function FlutterwaveConnectButton({
  bankAccountId,
  onSuccess,
  onClose,
  className = ''
}: FlutterwaveConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const connectRef = useRef<MonoConnectInstance | null>(null);

  // Wait for the Mono SDK to load
  useEffect(() => {
    const checkSdk = () => {
      if (window.MonoConnect) {
        setSdkReady(true);
        return;
      }
      const interval = setInterval(() => {
        if (window.MonoConnect) {
          setSdkReady(true);
          clearInterval(interval);
        }
      }, 500);
      setTimeout(() => clearInterval(interval), 15000);
    };
    checkSdk();
  }, []);

  const handleConnect = async () => {
    setError(null);

    if (!window.MonoConnect) {
      setError('Mono Connect SDK is still loading. Please try again in a moment.');
      return;
    }

    try {
      // Validate the bank account exists before opening the widget
      await bankingApi.connectFlutterwave(bankAccountId);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to validate bank account.');
      return;
    }

    connectRef.current = window.MonoConnect({
      key: import.meta.env.VITE_MONO_PUBLIC_KEY || '',
      scope: 'financial_data',
      onSuccess: async (code: string) => {
        setLoading(true);
        try {
          await bankingApi.flutterwaveCallback(bankAccountId, code);
          onSuccess();
        } catch (err: any) {
          setError(err?.response?.data?.message || err.message || 'Failed to complete bank account linking.');
        } finally {
          setLoading(false);
        }
      },
      onClose: () => {
        if (!loading) {
          setError('Linking was cancelled. Try again when you are ready.');
          onClose?.();
        }
      },
      onError: (err: any) => {
        setError(err?.message || 'An unexpected error occurred during linking.');
      },
    });

    connectRef.current.setup();
    connectRef.current.open();
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <button
          id={`btn-connect-flutterwave-${bankAccountId}`}
          type="button"
          disabled={loading || !sdkReady}
          onClick={handleConnect}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded bg-indigo-600 text-white hover:bg-slate-900 disabled:bg-indigo-300 transition-colors uppercase tracking-tight duration-150 cursor-pointer ${className}`}
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Linking...
            </>
          ) : (
            <>
              <ShieldCheck className="w-3 h-3" />
              Link Bank Account
            </>
          )}
        </button>
        {!sdkReady && !error && (
          <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Loading Mono Connect...
          </p>
        )}
        {error && (
          <p className="text-[10px] text-rose-500 font-sans mt-1 font-bold" id={`err-connect-flw-${bankAccountId}`}>
            {error}
          </p>
        )}
        <a href="https://mono.co" target="_blank" rel="noopener noreferrer" className="text-[9px] text-slate-400 font-medium flex items-center gap-1 hover:text-purple-600 transition-colors">
          <ExternalLink className="w-2.5 h-2.5" />
          Powered by Mono
        </a>
      </div>
    </>
  );
}
