import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { vatApi, printWindow } from '../../lib/api';
import { Loader2, AlertCircle, CheckCircle2, Download, FileText } from 'lucide-react';

export function VATReturnPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const { data: vatData, isLoading, error: vatError, refetch } = useQuery({
    queryKey: ['vat-return', startDate, endDate],
    queryFn: () => vatApi.getReturn({ startDate, endDate }),
    enabled: !!startDate && !!endDate,
  });

  const { data: periodsData } = useQuery({
    queryKey: ['vat-periods'],
    queryFn: () => vatApi.getPeriods(),
  });

  const { data: settingsData } = useQuery({
    queryKey: ['vat-settings'],
    queryFn: () => vatApi.getSettings(),
  });

  const settleMutation = useMutation({
    mutationFn: (data: any) => vatApi.settle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vat-periods'] });
      queryClient.invalidateQueries({ queryKey: ['vat-return'] });
    },
  });

  function fmtNaira(v: number): string {
    return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  }

  function handleGenerate() {
    refetch();
  }

  function handleSettle() {
    if (!vatData) return;
    settleMutation.mutate({
      startDate,
      endDate,
      totalOutputVat: vatData.totalOutputVat,
      totalInputVat: vatData.totalInputVat,
    });
  }

  function handlePrint() {
    const periodLabel = new Date(startDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const output = vatData || {};
    const totalOutput = output.totalOutputVat || 0;
    const totalInput = output.totalInputVat || 0;
    const netPayable = output.netVatPayable || 0;
    const netRefundable = output.netVatRefundable || 0;

    printWindow('VAT Return',
      `<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0">
        <h1 style="margin:4px 0;font-size:18px;color:#0f172a">VAT COMPUTATION SCHEDULE</h1>
        <p style="margin:2px 0;font-size:11px;color:#64748b">Tax Period: ${periodLabel}</p>
        <p style="margin:2px 0;font-size:11px;color:#64748b">TIN: ${settingsData?.vatNumber || '—'}</p>
        <p style="margin:2px 0;font-size:11px;color:#64748b">Due Date: 21 ${new Date(endDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
      </div>
      <h3 style="font-size:13px;color:#0f172a;margin:12px 0 8px">PART A — OUTPUT TAX (Sales)</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead><tr style="background:#f1f5f9"><th style="padding:6px 8px;font-size:10px;text-align:left">Category</th><th style="padding:6px 8px;font-size:10px;text-align:right">Gross (₦)</th><th style="padding:6px 8px;font-size:10px;text-align:right">VAT (₦)</th></tr></thead>
        <tbody>
          <tr><td style="padding:4px 8px;font-size:10px">Standard Rated Sales</td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(output.standardRatedSales?.grossAmount || 0)}</td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(totalOutput)}</td></tr>
          <tr style="font-weight:700;border-top:1px solid #94a3b8"><td style="padding:4px 8px;font-size:10px">TOTAL OUTPUT VAT</td><td></td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(totalOutput)}</td></tr>
        </tbody>
      </table>
      <h3 style="font-size:13px;color:#0f172a;margin:12px 0 8px">PART B — INPUT TAX (Purchases)</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead><tr style="background:#f1f5f9"><th style="padding:6px 8px;font-size:10px;text-align:left">Category</th><th style="padding:6px 8px;font-size:10px;text-align:right">Gross (₦)</th><th style="padding:6px 8px;font-size:10px;text-align:right">VAT (₦)</th></tr></thead>
        <tbody>
          <tr><td style="padding:4px 8px;font-size:10px">Standard Rated Purchases</td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(output.inputPurchases?.grossAmount || 0)}</td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(totalInput)}</td></tr>
          <tr style="font-weight:700;border-top:1px solid #94a3b8"><td style="padding:4px 8px;font-size:10px">TOTAL RECOVERABLE INPUT VAT</td><td></td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(totalInput)}</td></tr>
        </tbody>
      </table>
      <h3 style="font-size:13px;color:#0f172a;margin:12px 0 8px">PART C — NET VAT</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tbody>
          <tr><td style="padding:4px 8px;font-size:10px">Total Output VAT</td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(totalOutput)}</td></tr>
          <tr><td style="padding:4px 8px;font-size:10px">Less: Recoverable Input VAT</td><td style="padding:4px 8px;font-size:10px;text-align:right">(${fmtNaira(totalInput)})</td></tr>
          <tr style="font-weight:700;border-top:2px solid #0f172a"><td style="padding:6px 8px;font-size:11px">NET VAT ${netPayable > 0 ? 'PAYABLE' : 'REFUNDABLE'}</td><td style="padding:6px 8px;font-size:11px;text-align:right">${fmtNaira(netPayable > 0 ? netPayable : netRefundable)}</td></tr>
        </tbody>
      </table>`,
      `Period: ${periodLabel}`
    );
  }

  const periods = Array.isArray(periodsData) ? periodsData : [];
  const netPayable = vatData?.netVatPayable || 0;
  const netRefundable = vatData?.netVatRefundable || 0;
  const totalOutput = vatData?.totalOutputVat || 0;
  const totalInput = vatData?.totalInputVat || 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">

        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="px-4 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" /> Print
          </button>
          <button onClick={handleSettle} disabled={settleMutation.isPending || !vatData}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {settleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            File & Post Settlement
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Period From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Period To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm" />
          </div>
          <button onClick={handleGenerate}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 mt-5">
            Generate Return
          </button>
        </div>
      </div>

      {settleMutation.isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">VAT Settlement Posted</p>
            <p className="text-xs text-green-600">Journal entry created. The VAT period has been marked as filed.</p>
          </div>
        </div>
      )}

      {settleMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Settlement Failed</p>
            <p className="text-xs text-red-600">{(settleMutation.error as any)?.message || 'An error occurred.'}</p>
          </div>
        </div>
      )}

      {vatError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">VAT Return Error</p>
            <p className="text-xs text-red-600">{(vatError as any)?.message || 'Failed to load VAT return data.'}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : vatData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="bg-gray-50 rounded-t-lg px-6 py-3 border-b">
                <h3 className="font-semibold text-sm text-gray-700">PART A — Output Tax (Sales)</h3>
              </div>
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium text-gray-500">Category</th>
                      <th className="text-right py-2 font-medium text-gray-500">Gross Sales (₦)</th>
                      <th className="text-right py-2 font-medium text-gray-500">VAT Rate</th>
                      <th className="text-right py-2 font-medium text-gray-500">Output VAT (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-3">Standard Rated Sales</td>
                      <td className="py-3 text-right font-mono">{fmtNaira(vatData.standardRatedSales?.grossAmount || 0)}</td>
                      <td className="py-3 text-right">7.5%</td>
                      <td className="py-3 text-right font-mono font-semibold">{fmtNaira(totalOutput)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3">Zero Rated Sales</td>
                      <td className="py-3 text-right font-mono">₦0.00</td>
                      <td className="py-3 text-right">0%</td>
                      <td className="py-3 text-right font-mono">₦0.00</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3">Exempt Sales</td>
                      <td className="py-3 text-right font-mono">₦0.00</td>
                      <td className="py-3 text-right">N/A</td>
                      <td className="py-3 text-right font-mono">₦0.00</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t-2 border-gray-300 bg-gray-50">
                      <td className="py-3">TOTAL OUTPUT VAT</td>
                      <td></td>
                      <td></td>
                      <td className="py-3 text-right font-mono">{fmtNaira(totalOutput)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="bg-gray-50 rounded-t-lg px-6 py-3 border-b">
                <h3 className="font-semibold text-sm text-gray-700">PART B — Input Tax (Purchases)</h3>
              </div>
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium text-gray-500">Category</th>
                      <th className="text-right py-2 font-medium text-gray-500">Gross Purchases (₦)</th>
                      <th className="text-right py-2 font-medium text-gray-500">VAT Paid (₦)</th>
                      <th className="text-right py-2 font-medium text-gray-500">Recoverable (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-3">Standard Rated Purchases</td>
                      <td className="py-3 text-right font-mono">{fmtNaira(vatData.inputPurchases?.grossAmount || 0)}</td>
                      <td className="py-3 text-right font-mono">{fmtNaira(totalInput)}</td>
                      <td className="py-3 text-right font-mono font-semibold">{fmtNaira(totalInput)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t-2 border-gray-300 bg-gray-50">
                      <td className="py-3">TOTAL RECOVERABLE INPUT VAT</td>
                      <td></td>
                      <td></td>
                      <td className="py-3 text-right font-mono">{fmtNaira(totalInput)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="bg-gray-50 rounded-t-lg px-6 py-3 border-b">
                <h3 className="font-semibold text-sm text-gray-700">PART C — Net VAT Position</h3>
              </div>
              <div className="p-6">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Output VAT</span>
                    <span className="font-mono font-semibold">{fmtNaira(totalOutput)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Less: Recoverable Input VAT</span>
                    <span className="font-mono text-red-600">({fmtNaira(totalInput)})</span>
                  </div>
                  <hr className="border-gray-300" />
                  <div className="flex justify-between text-base font-bold">
                    <span>NET VAT {netPayable > 0 ? 'PAYABLE' : 'REFUNDABLE'}</span>
                    <span className={`font-mono ${netPayable > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmtNaira(netPayable > 0 ? netPayable : netRefundable)}
                    </span>
                  </div>
                  {netPayable > 0 && (
                    <p className="text-xs text-gray-500 mt-2">Due to FIRS by 21st of next month</p>
                  )}
                  {netRefundable > 0 && (
                    <p className="text-xs text-gray-500 mt-2">Excess input VAT — carry forward or claim refund</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="bg-gray-50 rounded-t-lg px-6 py-3 border-b">
                <h3 className="font-semibold text-sm text-gray-700">Filing History</h3>
              </div>
              <div className="p-6">
                {periods.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No returns filed yet</p>
                ) : (
                  <div className="space-y-3">
                    {periods.slice(0, 6).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-gray-700">{p.periodLabel}</p>
                          <p className="text-xs text-gray-400">{new Date(p.filedAt || p.createdAt).toLocaleDateString('en-GB')}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          p.status === 'filed' ? 'bg-blue-100 text-blue-700' :
                          p.status === 'paid' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {(p.status || 'draft').charAt(0).toUpperCase() + (p.status || 'draft').slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a period and click "Generate Return"</p>
        </div>
      )}
    </div>
  );
}
