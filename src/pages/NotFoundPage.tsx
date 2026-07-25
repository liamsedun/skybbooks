import React from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col justify-center items-center text-center p-6 font-sans">
      <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200 shadow-sm max-w-sm space-y-4">
        <h2 className="font-mono font-black text-rose-500 text-3xl tracking-widest">404</h2>
        <h3 className="font-sans font-extrabold text-sm uppercase tracking-wider text-slate-800">Route Unresolved</h3>
        <p className="text-xs text-slate-500 leading-relaxed">The requested system route is either protected, offline or unmapped. Return to the home cockpit index.</p>
        <Link to="/app/dashboard" className="block w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition">Return to Dashboard</Link>
      </div>
    </div>
  );
}
