import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi, accountantApi } from '../../lib/api';
import { Loader2, Save, Plus, Trash2, Globe } from 'lucide-react';

interface Mapping {
  id?: string;
  reportType: string;
  sectionKey: string;
  label: string;
  accountCode?: string;
  accountPrefix?: string;
  signMultiplier: number;
  includeSubAccounts: boolean;
  sortOrder: number;
  isActive: boolean;
}

const defaultMapping: Mapping = {
  reportType: 'balance_sheet',
  sectionKey: '',
  label: '',
  accountCode: '',
  accountPrefix: '',
  signMultiplier: 1,
  includeSubAccounts: true,
  sortOrder: 0,
  isActive: true,
};

const SECTION_KEYS: Record<string, string[]> = {
  balance_sheet: [
    'currentAssets.cashAndBank',
    'currentAssets.tradeReceivables',
    'currentAssets.inventory',
    'currentAssets.otherCurrentAssets',
    'nonCurrentAssets.ppe',
    'nonCurrentAssets.intangibles',
    'nonCurrentAssets.investments',
    'currentLiabilities.tradePayables',
    'currentLiabilities.accruals',
    'currentLiabilities.shortTermBorrowings',
    'nonCurrentLiabilities.longTermBorrowings',
    'nonCurrentLiabilities.deferredTax',
    'equity.shareCapital',
    'equity.retainedEarnings',
    'equity.reserves',
  ],
  income_statement: [
    'revenue.operatingRevenue',
    'revenue.otherIncome',
    'cogs.costOfSales',
    'expenses.adminExpenses',
    'expenses.marketingExpenses',
    'expenses.staffCosts',
    'finance.financeIncome',
    'finance.financeCosts',
    'tax.incomeTax',
  ],
  cash_flow: [
    'operating.netIncome',
    'operating.depreciation',
    'operating.workingCapital',
    'investing.fixedAssets',
    'investing.investments',
    'financing.borrowings',
    'financing.equity',
  ],
};

export function MappingsPage() {
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState<string>('balance_sheet');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['report-mappings', reportType],
    queryFn: async () => {
      const res = await reportsApi.getMappings({ reportType });
      return res.data || [];
    },
    onSuccess: (data: Mapping[]) => {
      if (!editing) setMappings(data);
    },
  } as any);

  const saveMutation = useMutation({
    mutationFn: async (mappingsToSave: Mapping[]) => {
      const res = await reportsApi.saveMappings({ mappings: mappingsToSave });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-mappings'] });
      setEditing(false);
    },
  });

  const reportTypes = [
    { value: 'balance_sheet', label: 'Balance Sheet' },
    { value: 'income_statement', label: 'Income Statement' },
    { value: 'cash_flow', label: 'Cash Flow' },
  ];

  const addMapping = () => {
    setMappings([...mappings, { ...defaultMapping, reportType, sortOrder: mappings.length }]);
    setEditing(true);
  };

  const updateMapping = (index: number, field: keyof Mapping, value: any) => {
    const updated = [...mappings];
    (updated[index] as any)[field] = value;
    setMappings(updated);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
    setEditing(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Report Section Mappings</h1>
        <div className="flex gap-2">
          <select
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value);
              setEditing(false);
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            {reportTypes.map(rt => (
              <option key={rt.value} value={rt.value}>{rt.label}</option>
            ))}
          </select>
          <button
            onClick={addMapping}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Mapping
          </button>
          {editing && (
            <button
              onClick={() => saveMutation.mutate(mappings)}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm"
            >
              <Save className="w-4 h-4" />
              Save All
            </button>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <Globe className="w-4 h-4 inline mr-1" />
        Configure which accounts (by code or prefix) map to each IFRS line item in the report.
        Leave blank to use the default system grouping.
      </div>

      {mappings.length === 0 && !editing ? (
        <div className="text-center py-12 text-slate-500">
          <p className="text-lg font-medium">No custom mappings configured</p>
          <p className="text-sm mt-1">The report will use the default IFRS grouping based on account codes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mappings
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((mapping, index) => (
              <div key={index} className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-3">
                    <label className="text-xs text-slate-500 font-medium">Section Key</label>
                    <select
                      value={mapping.sectionKey}
                      onChange={(e) => updateMapping(index, 'sectionKey', e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
                    >
                      <option value="">Select section...</option>
                      {(SECTION_KEYS[mapping.reportType] || []).map(sk => (
                        <option key={sk} value={sk}>{sk}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-slate-500 font-medium">Label</label>
                    <input
                      type="text"
                      value={mapping.label}
                      onChange={(e) => updateMapping(index, 'label', e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
                      placeholder="Display label"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 font-medium">Account Code</label>
                    <input
                      type="text"
                      value={mapping.accountCode || ''}
                      onChange={(e) => updateMapping(index, 'accountCode', e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
                      placeholder="e.g. 101100"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 font-medium">Code Prefix</label>
                    <input
                      type="text"
                      value={mapping.accountPrefix || ''}
                      onChange={(e) => updateMapping(index, 'accountPrefix', e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
                      placeholder="e.g. 100"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs text-slate-500 font-medium">Sort</label>
                    <input
                      type="number"
                      value={mapping.sortOrder}
                      onChange={(e) => updateMapping(index, 'sortOrder', parseInt(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
                    />
                  </div>
                  <div className="col-span-1 pt-6">
                    <button
                      onClick={() => removeMapping(index)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={mapping.includeSubAccounts}
                      onChange={(e) => updateMapping(index, 'includeSubAccounts', e.target.checked)}
                    />
                    Include sub-accounts
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={mapping.isActive}
                      onChange={(e) => updateMapping(index, 'isActive', e.target.checked)}
                    />
                    Active
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    Sign:
                    <select
                      value={mapping.signMultiplier}
                      onChange={(e) => updateMapping(index, 'signMultiplier', parseInt(e.target.value))}
                      className="border border-slate-300 rounded px-1 py-0.5 text-xs"
                    >
                      <option value={1}>+1 Normal</option>
                      <option value={-1}>-1 Invert</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
        </div>
      )}

      {saveMutation.isPending && (
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-lg p-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          Saving mappings...
        </div>
      )}
    </div>
  );
}
