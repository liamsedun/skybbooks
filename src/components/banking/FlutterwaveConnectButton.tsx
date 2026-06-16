/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { bankingApi } from '../../lib/api';
import { Loader2, ShieldCheck, HelpCircle, X, Check } from 'lucide-react';

interface FlutterwaveConnectButtonProps {
  bankAccountId: string;
  onSuccess: () => void;
  onClose?: () => void;
  className?: string;
}

export function FlutterwaveConnectButton({
  bankAccountId,
  onSuccess,
  onClose,
  className = ''
}: FlutterwaveConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSimulatedModal, setShowSimulatedModal] = useState(false);
  const [simulatedStep, setSimulatedStep] = useState<'bank_select' | 'auth_mfa' | 'success'>('bank_select');
  const [selectedSimulatedBank, setSelectedSimulatedBank] = useState<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get connection details from backend
      const res = await bankingApi.connectFlutterwave(bankAccountId);
      if (!res || (!res.token && !res.connectUrl)) {
        throw new Error('Failed to obtain connection session from Flutterwave backend.');
      }

      // If simulated / test keys are in place, spin up our awesome built-in Nigerian Bank connection widget
      if (res.token.startsWith('flw_connect_session_') || !window.location.protocol.startsWith('https')) {
        setShowSimulatedModal(true);
        setSimulatedStep('bank_select');
        setLoading(false);
        return;
      }

      // If in live mode, open the Flutterwave Authorization URL
      window.open(res.connectUrl, '_blank', 'noopener,noreferrer');
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed connecting to Flutterwave. Try again.');
      setLoading(false);
    }
  };

  const handleSimulatedSuccess = async () => {
    setLoading(true);
    try {
      const mockAuthCode = `mock_flw_code_${Math.random().toString(36).substring(2, 11)}`;
      await bankingApi.flutterwaveCallback(bankAccountId, mockAuthCode);
      setSimulatedStep('success');
      setTimeout(() => {
        setShowSimulatedModal(false);
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Verification callback failure.');
    } finally {
      setLoading(false);
    }
  };

  const simulatedBanks = [
    { name: 'Guaranty Trust Bank (GTBank)', code: 'gtbank', logo: '🍊' },
    { name: 'Zenith Bank', code: 'zenith', logo: '🔴' },
    { name: 'Access Bank PLC', code: 'access', logo: '🔶' },
    { name: 'Kuda Microfinance Bank', code: 'kuda', logo: '🟢' },
    { name: 'United Bank for Africa (UBA)', code: 'uba', logo: '🔺' },
    { name: 'Stanbic IBTC Bank', code: 'stanbic', logo: '🔷' },
  ];

  return (
    <>
      <button
        id={`btn-connect-flutterwave-${bankAccountId}`}
        type="button"
        disabled={loading}
        onClick={handleConnect}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded bg-indigo-600 text-white hover:bg-slate-900 disabled:bg-indigo-300 transition-colors uppercase tracking-tight duration-150 cursor-pointer ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Connecting...
          </>
        ) : (
          'Link with Flutterwave'
        )}
      </button>

      {error && (
        <p className="text-[10px] text-rose-500 font-sans mt-1.5 font-bold" id={`err-connect-flw-${bankAccountId}`}>
          {error}
        </p>
      )}

      {/* Simulated Flutterwave Secure Authorization Widget */}
      {showSimulatedModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-150 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-600 text-white text-xs font-black rounded-lg flex items-center justify-center">F</span>
                <span className="font-extrabold text-xs tracking-wider text-slate-800 font-sans uppercase">FLUTTERWAVE LINK <span className="text-[9px] bg-indigo-50 text-indigo-650 px-1.5 py-0.5 rounded">SECURE</span></span>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer outline-none"
                onClick={() => setShowSimulatedModal(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content states */}
            {simulatedStep === 'bank_select' && (
              <div className="p-5 overflow-y-auto flex-1">
                <h3 className="font-sans font-extrabold text-slate-900 text-sm mb-1 text-center">Connect Your Bank Account</h3>
                <p className="font-sans text-xs text-slate-500 text-center mb-4 leading-relaxed">Choose your commercial bank to authorize live transaction syncs with SkyBooks.</p>

                <div className="grid grid-cols-1 gap-2">
                  {simulatedBanks.map((bank) => (
                    <button
                      key={bank.code}
                      onClick={() => {
                        setSelectedSimulatedBank(bank.name);
                        setSimulatedStep('auth_mfa');
                      }}
                      className="p-3 border border-slate-100 hover:border-slate-300 rounded-xl bg-slate-50/30 hover:bg-slate-50 flex items-center gap-3 text-left transition-all cursor-pointer"
                    >
                      <span className="text-xl shrink-0 select-none">{bank.logo}</span>
                      <span className="font-sans font-bold text-xs text-slate-700">{bank.name}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex items-center gap-2 justify-center text-[10px] text-slate-400 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Licensed and secured by Flutterwave Nigeria</span>
                </div>
              </div>
            )}

            {simulatedStep === 'auth_mfa' && (
              <div className="p-5 flex-1">
                <h3 className="font-sans font-extrabold text-slate-900 text-sm mb-1 text-center font-bold">Secure Bank Verification</h3>
                <p className="font-sans text-xs text-slate-500 text-center mb-5">Authorizing secure access token for <span className="font-bold text-indigo-600">{selectedSimulatedBank}</span>.</p>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 mb-5">
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] uppercase font-extrabold text-slate-400 font-sans block mb-1">Business Account Number</label>
                      <input
                        type="text"
                        readOnly
                        value="1022904832"
                        className="w-full text-xs bg-white border border-slate-200 rounded px-3 py-1.5 font-mono text-slate-650 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-extrabold text-slate-400 font-sans block mb-1">Corporate Client ID/Username</label>
                      <input
                        type="text"
                        readOnly
                        value="skybooks_ledger"
                        className="w-full text-xs bg-white border border-slate-200 rounded px-3 py-1.5 font-mono text-slate-650 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSimulatedStep('bank_select')}
                    className="flex-1 py-2 font-sans font-bold text-xs border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSimulatedSuccess}
                    className="flex-1 py-2 font-sans font-bold text-xs bg-indigo-600 rounded-xl text-white hover:bg-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      'Simulate Link'
                    )}
                  </button>
                </div>
              </div>
            )}

            {simulatedStep === 'success' && (
              <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="font-sans font-extrabold text-slate-900 text-sm mb-1">Link Successful!</h3>
                <p className="font-sans text-xs text-slate-500 max-w-[240px] mx-auto leading-relaxed">Your account has been connected securely. Reconciling live cash transactions now.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
