import React, { useState, useEffect } from 'react';
import { FileBarChart, DollarSign, Calendar, CheckCircle, Clock } from 'lucide-react';
import { revenueApi } from '../../lib/api';

function fmtNaira(v: number): string {
  const abs = Math.abs(v);
  const naira = Math.floor(abs / 100);
  const kobo = abs % 100;
  const formatted = naira.toLocaleString('en-US') + '.' + String(kobo).padStart(2, '0');
  return (v < 0 ? '-₦' : '₦') + formatted;
}

export function RevenueRecognitionReport() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    loadReport();
    loadSummary();
  }, []);

  async function loadReport() {
    setLoading(true);
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const data = await revenueApi.getRecognitionReport(params);
      setEntries(data);
    } catch (err) {
      console.error('Failed to load recognition report:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const data = await revenueApi.getDeferredSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load deferred summary:', err);
    }
  }

  const totalRecognized = entries.reduce((s: number, e: any) => s + Number(e.amount), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Revenue Recognition Report</h1>
          <p className="text-sm text-ink-500 mt-1">IFRS 15 — Track recognized revenue, deferred balances, and recognition history</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-border-custom rounded-2xl p-4">
            <div className="text-xs text-ink-400 mb-1">Total Recognized</div>
            <div className="text-lg font-semibold font-mono text-emerald-700">{fmtNaira(totalRecognized)}</div>
          </div>
          <div className="bg-white border border-border-custom rounded-2xl p-4">
            <div className="text-xs text-ink-400 mb-1">Pending Recognition</div>
            <div className="text-lg font-semibold font-mono text-amber-700">{fmtNaira(Number(summary.pendingRecognition))}</div>
            <div className="text-xs text-ink-400 mt-1">{summary.pendingCount} schedule(s) overdue</div>
          </div>
          <div className="bg-white border border-border-custom rounded-2xl p-4">
            <div className="text-xs text-ink-400 mb-1">Entries Recorded</div>
            <div className="text-lg font-semibold text-ink-900">{entries.length}</div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">From</label>
          <input type="date" className="px-3 py-1.5 border border-border-custom rounded-lg text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">To</label>
          <input type="date" className="px-3 py-1.5 border border-border-custom rounded-lg text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <button onClick={loadReport} className="mt-5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700">Filter</button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-ink-400 text-sm">Loading report...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 bg-white border border-border-custom rounded-2xl">
          <FileBarChart className="w-12 h-12 text-ink-300 mx-auto mb-3" />
          <p className="text-ink-500 text-sm">No recognition entries yet. Recognize revenue from a contract schedule to see data here.</p>
        </div>
      ) : (
        <div className="bg-white border border-border-custom rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-custom bg-surface-subtle">
                <th className="text-left px-4 py-3 text-ink-500 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-ink-500 font-medium">Contract</th>
                <th className="text-left px-4 py-3 text-ink-500 font-medium">Obligation</th>
                <th className="text-left px-4 py-3 text-ink-500 font-medium">Method</th>
                <th className="text-right px-4 py-3 text-ink-500 font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-ink-500 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-b border-border-custom hover:bg-surface-subtle/50">
                  <td className="px-4 py-3">{new Date(e.recognizedDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium">{e.contractNumber}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{e.obligationDescription}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{e.method.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">{fmtNaira(e.amount)}</td>
                  <td className="px-4 py-3 text-ink-400 max-w-sm truncate">{e.description || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-subtle font-semibold">
                <td className="px-4 py-3" colSpan={4}>Total</td>
                <td className="px-4 py-3 text-right font-mono">{fmtNaira(totalRecognized)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
