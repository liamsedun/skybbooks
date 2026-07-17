import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eclApi, printWindow } from '../../lib/api';
import { PageLoader } from '../../components/ui/PageLoader';
import { Loader2, Calculator, FileText, CheckCircle, History, Settings, AlertTriangle } from 'lucide-react';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

type Tab = 'compute' | 'parameters' | 'history';

export function EclPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('compute');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [showParams, setShowParams] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">

        <div className="flex gap-2">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm flex overflow-hidden">
            <button onClick={() => setTab('compute')} className={`px-4 py-2 text-xs font-semibold transition-all duration-200 ${tab === 'compute' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Calculator className="w-3.5 h-3.5 inline mr-1" /> Compute</button>
            <button onClick={() => setTab('parameters')} className={`px-4 py-2 text-xs font-semibold border-x border-slate-200/80 transition-all duration-200 ${tab === 'parameters' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Settings className="w-3.5 h-3.5 inline mr-1" /> Matrix</button>
            <button onClick={() => setTab('history')} className={`px-4 py-2 text-xs font-semibold transition-all duration-200 ${tab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><History className="w-3.5 h-3.5 inline mr-1" /> History</button>
          </div>
        </div>
      </div>

      {tab === 'compute' && <EclComputeTab asOfDate={asOfDate} setAsOfDate={setAsOfDate} />}
      {tab === 'parameters' && <EclParametersTab />}
      {tab === 'history' && <EclHistoryTab />}
    </div>
  );
}

function EclComputeTab({ asOfDate, setAsOfDate }: { asOfDate: string; setAsOfDate: (d: string) => void }) {
  const queryClient = useQueryClient();
  const [showPostConfirm, setShowPostConfirm] = useState(false);

  const { data: computation, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ecl-compute', asOfDate],
    queryFn: () => eclApi.compute(asOfDate),
    enabled: true,
  });

  const postMutation = useMutation({
    mutationFn: (date: string) => eclApi.postProvision(date),
    onSuccess: () => {
      setShowPostConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['ecl-compute'] });
      queryClient.invalidateQueries({ queryKey: ['ecl-history'] });
    },
  });

  const handlePrint = () => {
    if (!computation) return;
    const bucketRows = (computation.bucketDetails || []).map((b: any) =>
      `<tr><td>${b.bucketLabel}</td><td>${b.stage}</td><td class="r">${(b.lossRate * 100).toFixed(2)}%</td><td class="r">${b.invoiceCount}</td><td class="r">${fmtNaira(b.totalBalance)}</td><td class="r">${fmtNaira(b.provision)}</td></tr>`
    ).join('');
    const customerRows = (computation.customerBreakdown || []).map((c: any) =>
      `<tr><td>${c.customerName}</td><td class="r">${fmtNaira(c.totalBalance)}</td><td class="r">${fmtNaira(c.provision)}</td><td class="r">${computation.totalReceivables ? ((c.totalBalance / computation.totalReceivables) * 100).toFixed(1) : 0}%</td></tr>`
    ).join('');

    const html = `<h2>IFRS 9 ECL Computation — ${asOfDate}</h2>
      <h3>Summary</h3>
      <table><tr><th>Total Receivables</th><th>Total Provision</th><th>Previous Provision</th><th>Adjustment</th></tr>
      <tr><td class="r">${fmtNaira(computation.totalReceivables)}</td><td class="r">${fmtNaira(computation.totalProvision)}</td><td class="r">${fmtNaira(computation.previousProvision)}</td><td class="r">${fmtNaira(computation.adjustmentAmount)}</td></tr></table>
      <h3>Provision Matrix</h3>
      <table><thead><tr><th>Bucket</th><th>Stage</th><th>Rate</th><th>Invoices</th><th>Balance</th><th>Provision</th></tr></thead><tbody>${bucketRows}</tbody></table>
      <h3>By Customer</h3>
      <table><thead><tr><th>Customer</th><th>Balance</th><th>Provision</th><th>% of Total</th></tr></thead><tbody>${customerRows}</tbody></table>`;
    printWindow('IFRS 9 ECL Report', html, computation.invoiceCount + ' invoices');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-4">
        <label className="text-xs font-semibold text-slate-500 uppercase">As of Date</label>
        <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
        <button onClick={() => refetch()} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"><Calculator className="w-3.5 h-3.5" /> Compute ECL</button>
        {computation && (
          <>
            <button onClick={handlePrint} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700"><FileText className="w-3.5 h-3.5" /> PDF</button>
            <button onClick={() => setShowPostConfirm(true)} disabled={computation.adjustmentAmount === 0 || postMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
              {postMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Post Provision JE
            </button>
          </>
        )}
      </div>

      {isLoading && <PageLoader message="Computing ECL..." />}
      {isError && <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm border border-red-100/80">{(error as any)?.response?.data?.error || (error as any)?.message || 'Failed to compute ECL'}</div>}

      {computation && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase">Total Receivables</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{fmtNaira(computation.totalReceivables)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase">ECL Provision</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{fmtNaira(computation.totalProvision)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase">Current Allowance</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{fmtNaira(computation.previousProvision)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase">Adjustment</p>
              <p className={`text-2xl font-bold mt-1 ${computation.adjustmentAmount >= 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {computation.adjustmentAmount >= 0 ? '+' : ''}{fmtNaira(computation.adjustmentAmount)}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase">Coverage Ratio</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {computation.totalReceivables > 0 ? ((computation.totalProvision / computation.totalReceivables) * 100).toFixed(2) : '0.00'}%
              </p>
            </div>
          </div>

          {/* Provision Matrix Buckets */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Provision Matrix</h3>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Bucket</th>
                  <th className="px-3 py-2 text-center">Stage</th>
                  <th className="px-3 py-2 text-right">Loss Rate</th>
                  <th className="px-3 py-2 text-right">Invoices</th>
                  <th className="px-3 py-2 text-right">Total Balance</th>
                  <th className="px-3 py-2 text-right">Provision</th>
                </tr>
              </thead>
              <tbody>
                {(computation.bucketDetails || []).map((b: any) => (
                  <tr key={b.bucketLabel} className="hover:bg-slate-50/50 border-b border-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800 capitalize">{b.bucketLabel}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${b.stage === '1' ? 'bg-emerald-100 text-emerald-700 border-emerald-100/50' : b.stage === '2' ? 'bg-amber-100 text-amber-700 border-amber-100/50' : 'bg-red-100 text-red-700 border-red-100/50'}`}>
                        Stage {b.stage}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{(b.lossRate * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right text-slate-600">{b.invoiceCount}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">{fmtNaira(b.totalBalance)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-700">{fmtNaira(b.provision)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 text-[11px] font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-xs font-bold text-slate-800">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtNaira(computation.totalReceivables)}</td>
                  <td className="px-3 py-2 text-right font-bold text-amber-700">{fmtNaira(computation.totalProvision)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* By Customer */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">By Customer</h3>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-right">ECL Provision</th>
                  <th className="px-3 py-2 text-right">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {(computation.customerBreakdown || []).length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No outstanding receivables.</td></tr>
                ) : (computation.customerBreakdown || []).map((c: any) => (
                  <tr key={c.customerName} className="hover:bg-slate-50/50 border-b border-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{c.customerName}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(c.totalBalance)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-700">{fmtNaira(c.provision)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {c.totalBalance > 0 ? ((c.provision / c.totalBalance) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showPostConfirm && computation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPostConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200/80" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
              <h2 className="text-lg font-bold text-slate-900">Post ECL Provision</h2>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p>This will create a journal entry adjusting the allowance for impairment.</p>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                <div className="flex justify-between"><span>Provision amount:</span><span className="font-semibold">{fmtNaira(computation.totalProvision)}</span></div>
                <div className="flex justify-between"><span>Current allowance:</span><span className="font-semibold">{fmtNaira(computation.previousProvision)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1"><span>Adjustment:</span><span className={`font-bold ${computation.adjustmentAmount >= 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {computation.adjustmentAmount >= 0 ? '+' : ''}{fmtNaira(computation.adjustmentAmount)}
                </span></div>
              </div>
              {computation.adjustmentAmount > 0 ? (
                <p className="text-xs text-slate-400">DR 830000 Impairment Loss, CR 101200 Allowance for Impairment</p>
              ) : (
                <p className="text-xs text-slate-400">DR 101200 Allowance for Impairment, CR 830000 Impairment Loss (reversal)</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPostConfirm(false)} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => postMutation.mutate(asOfDate)} disabled={postMutation.isPending}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                {postMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Post Provision
              </button>
            </div>
          </div>
        </div>
      )}

      {postMutation.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => postMutation.reset()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200/80" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Provision Posted</h2>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p>ECL provision journal entry has been created.</p>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                <div className="flex justify-between"><span>Adjustment:</span><span className="font-bold">{fmtNaira(postMutation.data.computation.adjustmentAmount)}</span></div>
                <div className="flex justify-between"><span>Journal Entry:</span><span className="font-mono text-xs">{postMutation.data.journalEntry?.entryNumber || 'Posted'}</span></div>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => { postMutation.reset(); queryClient.invalidateQueries({ queryKey: ['ecl-compute'] }); }}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EclParametersTab() {
  const queryClient = useQueryClient();
  const { data: params, isLoading } = useQuery({
    queryKey: ['ecl-parameters'],
    queryFn: () => eclApi.getParameters(),
  });

  const [localParams, setLocalParams] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const displayParams = localParams ?? params;

  const handleRateChange = (index: number, value: string) => {
    const updated = [...(displayParams || [])];
    updated[index] = { ...updated[index], lossRate: String(Number(value) / 100) };
    setLocalParams(updated);
  };

  const handleSave = async () => {
    if (!displayParams) return;
    setSaving(true);
    setError('');
    try {
      const payload = displayParams.map((p: any) => ({
        bucketLabel: p.bucketLabel,
        minDays: p.minDays,
        maxDays: p.maxDays,
        lossRate: Number(p.lossRate),
        stage: p.stage,
        sortOrder: p.sortOrder,
        isActive: p.isActive,
      }));
      await eclApi.saveParameters(payload);
      setLocalParams(null);
      queryClient.invalidateQueries({ queryKey: ['ecl-parameters'] });
      queryClient.invalidateQueries({ queryKey: ['ecl-compute'] });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  if (isLoading) return <PageLoader message="Loading parameters..." />;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Provision Matrix Rates</h3>
        <button onClick={handleSave} disabled={saving || !localParams}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Save Rates
        </button>
      </div>
      {error && <div className="mx-4 mt-3 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100/80">{error}</div>}
      <div className="p-4">
        <p className="text-xs text-slate-500 mb-4">
          IFRS 9 simplified approach: loss rates are applied to the outstanding balance in each ageing bucket to compute expected credit loss.
        </p>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">Bucket</th>
              <th className="px-3 py-2 text-center">Stage</th>
              <th className="px-3 py-2 text-right">Day Range</th>
              <th className="px-3 py-2 text-right">Loss Rate (%)</th>
              <th className="px-3 py-2 text-center">Active</th>
            </tr>
          </thead>
          <tbody>
            {(displayParams || []).map((p: any, idx: number) => (
              <tr key={p.id || idx} className="hover:bg-slate-50/50 border-b border-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800 capitalize">{p.bucketLabel}</td>
                <td className="px-3 py-2 text-center">
                  <select value={p.stage} onChange={e => { const u = [...(displayParams || [])]; u[idx] = { ...u[idx], stage: e.target.value }; setLocalParams(u); }}
                    className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                    <option value="1">Stage 1</option>
                    <option value="2">Stage 2</option>
                    <option value="3">Stage 3</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {p.minDays <= -9999 ? 'Not yet due' : `${p.minDays}–${p.maxDays >= 999999 ? '+' : p.maxDays} days`}
                </td>
                <td className="px-3 py-2 text-right">
                  <input type="number" step="0.01" min="0" max="100" value={(Number(p.lossRate) * 100).toFixed(2)}
                    onChange={e => handleRateChange(idx, e.target.value)}
                    className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={p.isActive} onChange={e => { const u = [...(displayParams || [])]; u[idx] = { ...u[idx], isActive: e.target.checked }; setLocalParams(u); }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EclHistoryTab() {
  const { data: history, isLoading } = useQuery({
    queryKey: ['ecl-history'],
    queryFn: () => eclApi.getHistory(),
  });

  if (isLoading) return <PageLoader message="Loading ECL history..." />;

  const list = Array.isArray(history) ? history : [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden overflow-x-auto">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800">ECL Computation History</h3>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">As of</th>
            <th className="px-3 py-2 text-right">Receivables</th>
            <th className="px-3 py-2 text-right">Provision</th>
            <th className="px-3 py-2 text-right">Adjustment</th>
            <th className="px-3 py-2 text-center">Status</th>
            <th className="px-3 py-2 text-left">JE #</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No ECL computations recorded.</td></tr>
          ) : list.map((r: any) => (
            <tr key={r.id} className="hover:bg-slate-50/50 border-b border-slate-50">
              <td className="px-3 py-2 text-slate-600">{fmtDate(r.computationDate)}</td>
              <td className="px-3 py-2 text-slate-600">{fmtDate(r.asOfDate)}</td>
              <td className="px-3 py-2 text-right font-medium text-slate-800">{fmtNaira(r.totalReceivables)}</td>
              <td className="px-3 py-2 text-right font-semibold text-amber-700">{fmtNaira(r.totalProvision)}</td>
              <td className={`px-3 py-2 text-right font-semibold ${r.adjustmentAmount >= 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {r.adjustmentAmount >= 0 ? '+' : ''}{fmtNaira(r.adjustmentAmount)}
              </td>
              <td className="px-3 py-2 text-center">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${r.status === 'posted' ? 'bg-emerald-100 text-emerald-700 border-emerald-100/50' : 'bg-slate-100 text-slate-600 border-slate-200/50'}`}>
                  {r.status === 'posted' ? 'Posted' : 'Computed'}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.journalEntryId ? r.journalEntryId.slice(0, 8) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
