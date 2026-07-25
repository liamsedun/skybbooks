import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, CheckCircle } from 'lucide-react';

export function ForgotPasswordPage() {
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-start pt-8 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <span className="w-12 h-12 rounded-2xl bg-purple-600 text-white font-extrabold flex items-center justify-center text-xl shadow-lg shadow-purple-200 mx-auto mb-4 select-none">F</span>
        <h2 className="text-xl font-black text-slate-900 uppercase">Vault Credentials Recovery</h2>
        <p className="mt-1.5 text-xs text-slate-400 font-mono uppercase tracking-widest font-medium">Verify credentials authority</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 border border-slate-150 shadow-md rounded-2xl sm:px-10">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Ledger Authority Reset Transmitted</h3>
              <p className="text-xs text-slate-400 leading-normal">
                An authorization token has been sent to <strong>{email}</strong>. Open the link to verify credentials override.
              </p>
              <div className="pt-2">
                <Link to="/login" className="text-xs font-bold text-purple-600 hover:text-purple-700">Return to sign-in terminal</Link>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Registered Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input type="email" required placeholder="controller@company.ng" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 text-sm border border-slate-250 rounded-xl outline-none focus:border-purple-600" />
                </div>
              </div>

              <button type="submit" className="w-full py-3 px-4 text-sm font-bold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition cursor-pointer">Send Recovery Key</button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs font-bold text-slate-500 hover:text-slate-700">Cancel and return</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
