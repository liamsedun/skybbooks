import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { taxApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';

export function TaxComputationPage() {
  const now = new Date();
  const { toast } = useToast();
  const currentYear = now.getFullYear();
  const defaultTaxYear = `${currentYear - 1}-${(currentYear).toString().slice(2)}`;
  const [taxYear, setTaxYear] = useState(defaultTaxYear);
  const todayStr = now.toISOString().split('T')[0];
  const defaultStart = `${currentYear - 1}-01-01`;
  const defaultEnd = `${currentYear - 1}-12-31`;
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [posting, setPosting] = useState(false);
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ['tax-config', taxYear],
    queryFn: () => taxApi.getConfiguration({ taxYear }),
  });

  const { data: computation, isLoading, error, refetch } = useQuery({
    queryKey: ['tax-computation', taxYear, startDate, endDate],
    queryFn: () => taxApi.compute({ taxYear, startDate, endDate }),
    enabled: !!taxYear,
  });

  const { data: schedule } = useQuery({
    queryKey: ['tax-schedule', taxYear],
    queryFn: () => taxApi.getSchedule(),
  });

  const handlePost = async () => {
    setPosting(true);
    try {
      await taxApi.post({ taxYear, startDate, endDate, confirmed: true });
      queryClient.invalidateQueries({ queryKey: ['tax-schedule'] });
      refetch();
      toast('Tax journal entries posted successfully.', 'success');
    } catch (err: any) {
      toast(err?.response?.data?.error || err.message || 'Failed to post tax entries.', 'error');
    } finally {
      setPosting(false);
    }
  };

  function fmt(v: number) { return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">Tax Year:</label>
            <input type="text" value={taxYear} onChange={e => setTaxYear(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl w-28 text-center font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">From:</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">To:</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
          <button onClick={() => refetch()}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">
          <p className="font-semibold">Failed to load tax computation</p>
          <p className="text-red-500 text-xs mt-1">{(error as any)?.message}</p>
        </div>
      ) : computation ? (
        <>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">Company Size Classification</td><td className="px-5 py-3 font-mono text-slate-900 capitalize">{computation.sizeClass}</td></tr>
                <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">Period</td><td className="px-5 py-3 font-mono text-slate-900">{new Date(computation.periodStart).toLocaleDateString('en-GB')} — {new Date(computation.periodEnd).toLocaleDateString('en-GB')}</td></tr>
                <tr className="border-b border-slate-100 bg-slate-50/50"><td className="px-5 py-3 font-semibold text-slate-700">Gross Turnover</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.grossTurnover)}</td></tr>
                <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">Accounting Profit / (Loss) Before Tax</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.accountingPBT)}</td></tr>
                <tr className="border-b border-slate-100 bg-slate-50/50"><td className="px-5 py-3 font-semibold text-slate-700">Disallowable Add-backs</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.addbacks)}</td></tr>
                {computation.addbackDetails?.depreciation > 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 text-slate-500 pl-10 text-xs">· Depreciation / Amortisation</td><td className="px-5 py-3 font-mono text-slate-700 text-xs">{fmt(computation.addbackDetails.depreciation)}</td></tr>}
                <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">Capital Allowances</td><td className="px-5 py-3 font-mono text-slate-900">({fmt(computation.capitalAllowances)})</td></tr>
                <tr className="border-b border-slate-100 bg-slate-50/50"><td className="px-5 py-3 font-semibold text-slate-700">Losses Brought Forward</td><td className="px-5 py-3 font-mono text-slate-900">({fmt(computation.lossesBroughtForward)})</td></tr>
                <tr className="border-b-2 border-slate-200"><td className="px-5 py-3 font-bold text-slate-800 text-base">Assessable Profit</td><td className="px-5 py-3 font-mono font-bold text-slate-900 text-base">{computation.assessableProfit <= 0 ? <span className="text-red-600">{fmt(computation.assessableProfit)}</span> : fmt(computation.assessableProfit)}</td></tr>
                <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">CIT Rate</td><td className="px-5 py-3 font-mono text-slate-900">{(computation.citRate * 100).toFixed(1)}%</td></tr>
                <tr className="border-b border-slate-100 bg-slate-50/50"><td className="px-5 py-3 font-semibold text-slate-700">CIT from Profits</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.citFromProfits)}</td></tr>
                {computation.minimumTax > 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">Minimum Tax</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.minimumTax)}</td></tr>}
                <tr className="border-b border-slate-100 bg-yellow-50/50"><td className="px-5 py-3 font-bold text-slate-800">CIT Payable</td><td className="px-5 py-3 font-mono font-bold text-slate-900">{fmt(computation.citPayable)}</td></tr>
                {computation.edtPayable > 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">EDT Payable (3% of AP)</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.edtPayable)}</td></tr>}
                {computation.cgtPayable > 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">CGT Payable (10% of net gains)</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.cgtPayable)}</td></tr>}
                {computation.nitdaLevy > 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">NITDA Levy (1% of PBT)</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.nitdaLevy)}</td></tr>}
                {computation.deferredTaxCharge !== 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">Deferred Tax {computation.deferredTaxCharge > 0 ? 'Charge' : 'Credit'}</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(Math.abs(computation.deferredTaxCharge))}</td></tr>}
                {computation.whtCreditsApplied > 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">WHT Credits Applied</td><td className="px-5 py-3 font-mono text-slate-900">({fmt(computation.whtCreditsApplied)})</td></tr>}
                <tr className="bg-indigo-50/50"><td className="px-5 py-3 font-bold text-indigo-800 text-base">Total Tax Expense</td><td className="px-5 py-3 font-mono font-bold text-indigo-800 text-base">{fmt(computation.totalTaxExpense)}</td></tr>
                {computation.netCitPayable > 0 && <tr className="bg-slate-50"><td className="px-5 py-3 font-bold text-slate-800">Net CIT Payable (after WHT)</td><td className="px-5 py-3 font-mono font-bold text-slate-900">{fmt(computation.netCitPayable)}</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={handlePost} disabled={posting || !computation}
              className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Post to Ledger
            </button>
          </div>

          {Array.isArray(schedule) && schedule.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-sm font-bold text-slate-700">Posted Computations</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Tax Year</th>
                    <th className="px-4 py-2.5 text-left">Period</th>
                    <th className="px-4 py-2.5 text-right">Assessable Profit</th>
                    <th className="px-4 py-2.5 text-right">CIT Payable</th>
                    <th className="px-4 py-2.5 text-right">Total Tax</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">Posted At</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.slice(0, 10).map((s: any) => (
                    <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-mono text-slate-800">{s.taxYear}</td>
                      <td className="px-4 py-2.5 text-slate-600">{new Date(s.periodStart).toLocaleDateString('en-GB')} - {new Date(s.periodEnd).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-900">{fmt(s.assessableProfit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-900">{fmt(s.citPayable)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">{fmt(s.totalTaxExpense)}</td>
                      <td className="px-4 py-2.5 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.status === 'submitted' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>{s.status}</span></td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500 text-xs">{new Date(s.createdAt).toLocaleDateString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-slate-400">Enter a tax year and click refresh to compute.</div>
      )}
    </div>
  );
}
