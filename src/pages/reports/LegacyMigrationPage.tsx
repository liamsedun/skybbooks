import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { legacyApi, printWindow, downloadBlob } from '../../lib/api';
import { Loader2, Lock, Unlock, AlertTriangle, Save, Plus, Eye, Pencil, ChevronDown, ChevronUp, History, Database } from 'lucide-react';

type TabType = 'income' | 'cashflow' | 'socie' | 'settings';

const fiscalYears = [2025, 2024, 2023, 2022, 2021, 2020];

const IS_LINES = [
  { key: 'revenue', label: 'Revenue', note: true },
  { key: 'costOfSales', label: 'Cost of sales', note: true },
  { key: 'grossProfit', label: 'Gross profit', computed: true, bold: true },
  { key: 'otherGainsOrLosses', label: 'Other gains or losses', note: true },
  { key: 'impairmentOnFinancialAssets', label: 'Impairment (loss)/gain on financial assets', note: true },
  { key: 'administrativeExpenses', label: 'Administrative expenses', note: true },
  { key: 'operatingProfit', label: 'Operating profit', computed: true, bold: true },
  { key: 'financeCost', label: 'Finance cost', note: true },
  { key: 'profitBeforeTax', label: 'Profit before tax', computed: true, bold: true },
  { key: 'incomeTax', label: 'Income tax', note: true },
  { key: 'deferredTax', label: 'Deferred Tax', note: true },
  { key: 'profitForTheYear', label: 'Profit for the year', computed: true, bold: true },
  { key: 'ociHeader', label: 'Other Comprehensive Income', section: true },
  { key: 'ociValuationGainLoss', label: 'Gain/Loss on valuation of investments in equity instruments', note: true, indent: true },
  { key: 'ociGrantIncome', label: 'Grant/other income', note: true, indent: true },
  { key: 'ociNetOfTaxes', label: 'Other comprehensive income net of taxes', computed: true, indent: true },
  { key: 'totalComprehensiveIncome', label: 'Total comprehensive income for the year', computed: true, bold: true },
  { key: 'epsHeader', label: 'Earnings Per Share', section: true },
  { key: 'earningsPerShareKobo', label: 'Earnings per share (kobo)', note: true },
  { key: 'dilutedEarningsPerShare', label: 'Diluted earnings per share', note: true },
];

const CF_OPERATING = [
  { key: 'profitBeforeInterestAndTax', label: 'Profit before interest and income taxes' },
  { key: 'depreciationPPE', label: 'Depreciation of property, plant and equipment' },
  { key: 'amortization', label: 'Amortization' },
  { key: 'decreaseIncreasePrepayments', label: 'Decrease/(increase) in prepayments' },
  { key: 'decreaseIncreaseReceivables', label: 'Decrease/(increase) in trade and other receivables' },
  { key: 'increaseDecreasePayables', label: 'Increase/(decrease) in trade and other payables' },
  { key: 'increaseDecreaseDeferredIncome', label: 'Increase/(decrease) in deferred income' },
  { key: 'grantOtherIncome', label: 'Grant/Other income' },
  { key: 'provisionForTax', label: 'Provision for tax' },
];

const CF_INVESTING = [
  { key: 'purchaseIntangibleAssets', label: 'Purchase of intangible assets' },
  { key: 'purchasePPE', label: 'Purchase of property, plant and equipment/Compensation receivables' },
  { key: 'interestReceived', label: 'Interest received' },
  { key: 'proceedsFromSalePPE', label: 'Proceeds from sales of property, plant and equipment' },
];

const CF_FINANCING = [
  { key: 'shareCapital', label: 'Share capital' },
  { key: 'depositForShares', label: 'Deposit for shares' },
  { key: 'retainedEarnings', label: 'Retained earnings' },
  { key: 'sharePremium', label: 'Share Premium' },
  { key: 'revaluation', label: 'Revaluation' },
  { key: 'dividendsPaid', label: 'Dividends paid' },
];

const SOCIE_COLUMNS = ['revaluationSurplus', 'shareCapital', 'depositForShares', 'sharePremium', 'retainedEarnings'] as const;
const SOCIE_COLUMN_LABELS: Record<string, string> = {
  revaluationSurplus: 'Revaluation Surplus/(Deficit)',
  shareCapital: 'Share Capital',
  depositForShares: 'Deposit for Shares',
  sharePremium: 'Share Premium',
  retainedEarnings: 'Retained Earnings',
};
const SOCIE_ROWS = ['balanceBf', 'profitForYear', 'eclAdjustments', 'otherChanges', 'priorYearAdjustments', 'transactionsWithOwners'] as const;
const SOCIE_ROW_LABELS: Record<string, string> = {
  balanceBf: 'Balance b/f',
  profitForYear: 'Profit for the Year',
  eclAdjustments: 'Expected Credit Loss Adjustments',
  otherChanges: 'Other Changes in the year',
  priorYearAdjustments: 'Prior Year Adjustments',
  transactionsWithOwners: 'Transactions with owners recorded directly in equity',
};

const initialSocieRow = { revaluationSurplus: 0, shareCapital: 0, depositForShares: 0, sharePremium: 0, retainedEarnings: 0 };

function fmtKobo(v: number) {
  return (v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toKobo(v: string) {
  const clean = v.replace(/[^0-9.-]/g, '');
  return Math.round(parseFloat(clean || '0') * 100);
}

function addSocieRows(...rows: typeof initialSocieRow[]): typeof initialSocieRow {
  const result = { ...initialSocieRow };
  for (const r of rows) {
    result.revaluationSurplus += r.revaluationSurplus;
    result.shareCapital += r.shareCapital;
    result.depositForShares += r.depositForShares;
    result.sharePremium += r.sharePremium;
    result.retainedEarnings += r.retainedEarnings;
  }
  return result;
}

function socieColumnTotal(row: typeof initialSocieRow): number {
  return row.revaluationSurplus + row.shareCapital + row.depositForShares + row.sharePremium + row.retainedEarnings;
}

export function LegacyMigrationPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabType>('income');
  const [selectedFy, setSelectedFy] = useState<number>(fiscalYears[0]);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [liveGl, setLiveGl] = useState('');
  const [legacyName, setLegacyName] = useState('');

  // Org settings for migration config
  const { data: orgData, isLoading: orgLoading } = useQuery({
    queryKey: ['org'],
    queryFn: () => legacyApi.getOrg(),
  });
  const org = orgData?.data || orgData || {};

  useEffect(() => {
    if (org) {
      setLiveGl(org?.liveGlStartFiscalYear != null ? String(org.liveGlStartFiscalYear) : '');
      setLegacyName(org?.legacySystemName || '');
    }
  }, [org]);

  // Legacy statement data
  const { data: isData, isLoading: isLoad, refetch: refetchIS } = useQuery({
    queryKey: ['legacy', 'income', selectedFy],
    queryFn: () => legacyApi.getIncomeStatement(selectedFy),
    enabled: tab === 'income',
    retry: false,
  });

  const { data: cfData, isLoading: cfLoad, refetch: refetchCF } = useQuery({
    queryKey: ['legacy', 'cashflow', selectedFy],
    queryFn: () => legacyApi.getCashFlowStatement(selectedFy),
    enabled: tab === 'cashflow',
    retry: false,
  });

  const { data: socieData, isLoading: socieLoad, refetch: refetchSocie } = useQuery({
    queryKey: ['legacy', 'socie', selectedFy],
    queryFn: () => legacyApi.getSocieStatement(selectedFy),
    enabled: tab === 'socie',
    retry: false,
  });

  const existingRecord = (() => {
    if (tab === 'income') return (isData as any)?.data || null;
    if (tab === 'cashflow') return (cfData as any)?.data || null;
    if (tab === 'socie') return (socieData as any)?.data || null;
    return null;
  })();

  const locked = existingRecord?.isLocked !== false;

  // ── Income Statement form state ──
  const initialIsForm = {
    revenue: 0, revenueNote: '',
    costOfSales: 0, costOfSalesNote: '',
    otherGainsOrLosses: 0, otherGainsOrLossesNote: '',
    impairmentOnFinancialAssets: 0, impairmentOnFinancialAssetsNote: '',
    administrativeExpenses: 0, administrativeExpensesNote: '',
    financeCost: 0, financeCostNote: '',
    incomeTax: 0, incomeTaxNote: '',
    deferredTax: 0, deferredTaxNote: '',
    ociValuationGainLoss: 0, ociValuationNote: '',
    ociGrantIncome: 0, ociGrantNote: '',
    earningsPerShareKobo: 0, earningsPerShareNote: '',
    dilutedEarningsPerShare: 0, dilutedEpsNote: '',
  };
  const [isForm, setIsForm] = useState(initialIsForm);

  useEffect(() => {
    if (existingRecord && tab === 'income') {
      const d = existingRecord.data || {};
      setIsForm({
        revenue: d.revenue || 0, revenueNote: d.revenueNote || '',
        costOfSales: d.costOfSales || 0, costOfSalesNote: d.costOfSalesNote || '',
        otherGainsOrLosses: d.otherGainsOrLosses || 0, otherGainsOrLossesNote: d.otherGainsOrLossesNote || '',
        impairmentOnFinancialAssets: d.impairmentOnFinancialAssets || 0, impairmentOnFinancialAssetsNote: d.impairmentOnFinancialAssetsNote || '',
        administrativeExpenses: d.administrativeExpenses || 0, administrativeExpensesNote: d.administrativeExpensesNote || '',
        financeCost: d.financeCost || 0, financeCostNote: d.financeCostNote || '',
        incomeTax: d.incomeTax || 0, incomeTaxNote: d.incomeTaxNote || '',
        deferredTax: d.deferredTax || 0, deferredTaxNote: d.deferredTaxNote || '',
        ociValuationGainLoss: d.ociValuationGainLoss || 0, ociValuationNote: d.ociValuationNote || '',
        ociGrantIncome: d.ociGrantIncome || 0, ociGrantNote: d.ociGrantNote || '',
        earningsPerShareKobo: d.earningsPerShareKobo || 0, earningsPerShareNote: d.earningsPerShareNote || '',
        dilutedEarningsPerShare: d.dilutedEarningsPerShare || 0, dilutedEpsNote: d.dilutedEpsNote || '',
      });
    } else if (!existingRecord && tab === 'income') {
      setIsForm(initialIsForm);
    }
  }, [existingRecord, tab, selectedFy]);

  const computedGrossProfit = isForm.revenue - isForm.costOfSales;
  const computedOperatingProfit = computedGrossProfit + isForm.otherGainsOrLosses + isForm.impairmentOnFinancialAssets - isForm.administrativeExpenses;
  const computedProfitBeforeTax = computedOperatingProfit - isForm.financeCost;
  const computedProfitForTheYear = computedProfitBeforeTax - isForm.incomeTax - isForm.deferredTax;
  const computedOciNetOfTaxes = isForm.ociValuationGainLoss + isForm.ociGrantIncome;
  const computedTotalComprehensiveIncome = computedProfitForTheYear + computedOciNetOfTaxes;

  // ── Cash Flow form state ──
  const initialCfForm = {
    profitBeforeInterestAndTax: 0, depreciationPPE: 0, amortization: 0,
    decreaseIncreasePrepayments: 0, decreaseIncreaseReceivables: 0, increaseDecreasePayables: 0,
    increaseDecreaseDeferredIncome: 0, grantOtherIncome: 0, provisionForTax: 0,
    incomeTaxPaid: 0, purchaseIntangibleAssets: 0, purchasePPE: 0,
    interestReceived: 0, proceedsFromSalePPE: 0, shareCapital: 0,
    depositForShares: 0, retainedEarnings: 0, sharePremium: 0, revaluation: 0, dividendsPaid: 0,
    cashAtBeginningOfYear: 0, cashAtEndOfYear: 0, cashAtEndOfYearOverride: false,
    cashAndBankBalance: 0, termDeposit: 0, termLoan: 0,
  };
  const [cfForm, setCfForm] = useState(initialCfForm);

  useEffect(() => {
    if (existingRecord && tab === 'cashflow') {
      const d = existingRecord.data || {};
      setCfForm({
        profitBeforeInterestAndTax: d.profitBeforeInterestAndTax || 0,
        depreciationPPE: d.depreciationPPE || 0,
        amortization: d.amortization || 0,
        decreaseIncreasePrepayments: d.decreaseIncreasePrepayments || 0,
        decreaseIncreaseReceivables: d.decreaseIncreaseReceivables || 0,
        increaseDecreasePayables: d.increaseDecreasePayables || 0,
        increaseDecreaseDeferredIncome: d.increaseDecreaseDeferredIncome || 0,
        grantOtherIncome: d.grantOtherIncome || 0,
        provisionForTax: d.provisionForTax || 0,
        incomeTaxPaid: d.incomeTaxPaid || 0,
        purchaseIntangibleAssets: d.purchaseIntangibleAssets || 0,
        purchasePPE: d.purchasePPE || 0,
        interestReceived: d.interestReceived || 0,
        proceedsFromSalePPE: d.proceedsFromSalePPE || 0,
        shareCapital: d.shareCapital || 0,
        depositForShares: d.depositForShares || 0,
        retainedEarnings: d.retainedEarnings || 0,
        sharePremium: d.sharePremium || 0,
        revaluation: d.revaluation || 0,
        dividendsPaid: d.dividendsPaid || 0,
        cashAtBeginningOfYear: d.cashAtBeginningOfYear || 0,
        cashAtEndOfYear: d.cashAtEndOfYear || 0,
        cashAtEndOfYearOverride: d.cashAtEndOfYearOverride || false,
        cashAndBankBalance: d.cashAndBankBalance || 0,
        termDeposit: d.termDeposit || 0,
        termLoan: d.termLoan || 0,
      });
    } else if (!existingRecord && tab === 'cashflow') {
      setCfForm(initialCfForm);
    }
  }, [existingRecord, tab, selectedFy]);

  const cfComputedCashGenerated = cfForm.profitBeforeInterestAndTax + cfForm.depreciationPPE + cfForm.amortization
    + cfForm.decreaseIncreasePrepayments + cfForm.decreaseIncreaseReceivables + cfForm.increaseDecreasePayables
    + cfForm.increaseDecreaseDeferredIncome + cfForm.grantOtherIncome + cfForm.provisionForTax;
  const cfComputedNetOperating = cfComputedCashGenerated - cfForm.incomeTaxPaid;
  const cfComputedNetInvesting = -cfForm.purchaseIntangibleAssets - cfForm.purchasePPE + cfForm.interestReceived + cfForm.proceedsFromSalePPE;
  const cfComputedNetFinancing = cfForm.shareCapital + cfForm.depositForShares + cfForm.retainedEarnings + cfForm.sharePremium + cfForm.revaluation - cfForm.dividendsPaid;
  const cfComputedNetIncrease = cfComputedNetOperating + cfComputedNetInvesting + cfComputedNetFinancing;
  const cfComputedEndOfYear = cfForm.cashAtEndOfYearOverride ? cfForm.cashAtEndOfYear : cfComputedNetIncrease + cfForm.cashAtBeginningOfYear;
  const cfReconciliationDiff = cfComputedEndOfYear - (cfForm.cashAndBankBalance + cfForm.termDeposit + cfForm.termLoan);

  // ── SOCIE form state ──
  const [socieForm, setSocieForm] = useState({
    balanceBf: { ...initialSocieRow },
    profitForYear: { ...initialSocieRow },
    eclAdjustments: { ...initialSocieRow },
    otherChanges: { ...initialSocieRow },
    priorYearAdjustments: { ...initialSocieRow },
    transactionsWithOwners: { ...initialSocieRow },
  });

  useEffect(() => {
    if (existingRecord && tab === 'socie') {
      const d = existingRecord.data || {};
      setSocieForm({
        balanceBf: d.balanceBf || { ...initialSocieRow },
        profitForYear: d.profitForYear || { ...initialSocieRow },
        eclAdjustments: d.eclAdjustments || { ...initialSocieRow },
        otherChanges: d.otherChanges || { ...initialSocieRow },
        priorYearAdjustments: d.priorYearAdjustments || { ...initialSocieRow },
        transactionsWithOwners: d.transactionsWithOwners || { ...initialSocieRow },
      });
    } else if (!existingRecord && tab === 'socie') {
      setSocieForm({
        balanceBf: { ...initialSocieRow },
        profitForYear: { ...initialSocieRow },
        eclAdjustments: { ...initialSocieRow },
        otherChanges: { ...initialSocieRow },
        priorYearAdjustments: { ...initialSocieRow },
        transactionsWithOwners: { ...initialSocieRow },
      });
    }
  }, [existingRecord, tab, selectedFy]);

  const socieComputedTotalForYear = addSocieRows(socieForm.profitForYear, socieForm.eclAdjustments, socieForm.otherChanges, socieForm.priorYearAdjustments);
  const socieComputedBalanceCf = addSocieRows(socieForm.balanceBf, socieComputedTotalForYear);
  const socieComputedBalanceAsAt = addSocieRows(socieComputedBalanceCf, socieForm.transactionsWithOwners);

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (tab === 'income') return legacyApi.upsertIncomeStatement(selectedFy, { fiscalYear: selectedFy, periodLabel: `FY${selectedFy}`, data });
      if (tab === 'cashflow') return legacyApi.upsertCashFlowStatement(selectedFy, { fiscalYear: selectedFy, periodLabel: `FY${selectedFy}`, data });
      return legacyApi.upsertSocieStatement(selectedFy, { fiscalYear: selectedFy, periodLabel: `FY${selectedFy}`, data });
    },
    onSuccess: () => {
      setSaveMsg('Saved successfully');
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['legacy', tab, selectedFy] });
      setTimeout(() => setSaveMsg(''), 3000);
    },
    onError: (err: any) => {
      setSaveMsg(`Error: ${err?.message || 'Save failed'}`);
      setTimeout(() => setSaveMsg(''), 5000);
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      if (tab === 'income') return legacyApi.unlockIncomeStatement(selectedFy);
      if (tab === 'cashflow') return legacyApi.unlockCashFlowStatement(selectedFy);
      return legacyApi.unlockSocieStatement(selectedFy);
    },
    onSuccess: () => {
      setConfirmUnlock(null);
      queryClient.invalidateQueries({ queryKey: ['legacy', tab, selectedFy] });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: (data: any) => legacyApi.updateOrg(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org'] });
      setSaveMsg('Settings saved');
      setTimeout(() => setSaveMsg(''), 3000);
    },
  });

  function handleNumberChange(key: string, value: string) {
    setIsForm((prev: any) => ({ ...prev, [key]: toKobo(value) }));
  }
  function handleNoteChange(key: string, value: string) {
    setIsForm((prev: any) => ({ ...prev, [key]: value }));
  }
  function handleCfChange(key: string, value: string) {
    setCfForm((prev: any) => ({ ...prev, [key]: toKobo(value) }));
  }
  function handleSocieChange(row: string, col: string, value: string) {
    setSocieForm((prev: any) => ({
      ...prev,
      [row]: { ...prev[row], [col]: toKobo(value) },
    }));
  }

  function getIsComputed(key: string): number {
    switch (key) {
      case 'grossProfit': return computedGrossProfit;
      case 'operatingProfit': return computedOperatingProfit;
      case 'profitBeforeTax': return computedProfitBeforeTax;
      case 'profitForTheYear': return computedProfitForTheYear;
      case 'ociNetOfTaxes': return computedOciNetOfTaxes;
      case 'totalComprehensiveIncome': return computedTotalComprehensiveIncome;
      default: return 0;
    }
  }

  // ── Export helpers ──
  function handlePdf() {
    const fm = (v: number) => `₦${fmtKobo(v)}`;
    switch (tab) {
      case 'income': {
        const rows = IS_LINES.map(line => {
          if (line.section) return `<tr><td colspan="2" style="background:#f1f5f9;font-weight:700;font-size:11px;padding:6px 12px;color:#475569;text-transform:uppercase;letter-spacing:0.05em">${line.label}</td></tr>`;
          const val = line.computed ? getIsComputed(line.key) : (isForm as any)[line.key] || 0;
          const st = `padding:5px 12px;${line.bold ? 'font-weight:700;' : ''}${line.indent ? 'padding-left:32px;' : ''}`;
          return `<tr><td style="${st}">${line.label}${line.computed ? ' <span style="color:#94a3b8;font-size:10px">(auto)</span>' : ''}</td><td class="r">${fm(val)}</td></tr>`;
        }).join('');
        printWindow('Income Statement (Legacy)', `<table>${rows}</table>`, `FY ${selectedFy}`);
        return;
      }
      case 'cashflow': {
        const r: string[] = [];
        const add = (label: string, val: number, cls?: string) => r.push(`<tr><td style="padding:5px 12px;${cls || ''}">${label}</td><td class="r">${fm(val)}</td></tr>`);
        const sec = (t: string) => r.push(`<tr><td colspan="2" style="background:#f1f5f9;font-weight:700;font-size:11px;padding:6px 12px;color:#475569;text-transform:uppercase;letter-spacing:0.05em">${t}</td></tr>`);
        sec('Operating Activities');
        CF_OPERATING.forEach(l => add(l.label, (cfForm as any)[l.key] || 0));
        add('Cash generated from operating activities', cfComputedCashGenerated, 'font-weight:700');
        add('Income tax paid', cfForm.incomeTaxPaid);
        add('Net Cash generated from operating activities', cfComputedNetOperating, 'font-weight:700');
        sec('Investing Activities');
        CF_INVESTING.forEach(l => add(l.label, (cfForm as any)[l.key] || 0));
        add('Net Cash generated (used in) by investing activities', cfComputedNetInvesting, 'font-weight:700');
        sec('Financing Activities');
        CF_FINANCING.forEach(l => add(l.label, (cfForm as any)[l.key] || 0));
        add('Net Cash generated by (used in) Financing Activities', cfComputedNetFinancing, 'font-weight:700');
        sec('Summary');
        add('Net increase in cash and cash equivalents', cfComputedNetIncrease, 'font-weight:700');
        add('Cash and cash equivalents at the beginning of the year', cfForm.cashAtBeginningOfYear);
        add('Cash and cash equivalents at the end of the year', cfComputedEndOfYear, 'font-weight:700');
        sec('Cash & Cash Equivalents Breakdown');
        add('Cash & Bank balance', cfForm.cashAndBankBalance);
        add('Term Deposit', cfForm.termDeposit);
        add('Term Loan (deduction)', cfForm.termLoan);
        add('Total', cfForm.cashAndBankBalance + cfForm.termDeposit + cfForm.termLoan, 'font-weight:700');
        printWindow('Cash Flow Statement (Legacy)', `<table>${r.join('')}</table>`, `FY ${selectedFy}`);
        return;
      }
      case 'socie': {
        const colLabels = [...SOCIE_COLUMNS.map(c => SOCIE_COLUMN_LABELS[c]), 'Total Equity'];
        const th = colLabels.map(l => `<th style="text-align:right;padding:6px 8px">${l}</th>`).join('');
        const rows: string[] = [];
        const addRow = (label: string, data: typeof initialSocieRow, isComp: boolean) => {
          const td = [...SOCIE_COLUMNS.map(c => `<td class="r">${fm((data as any)[c] || 0)}</td>`), `<td class="r" style="font-weight:700">${fm(socieColumnTotal(data))}</td>`].join('');
          rows.push(`<tr><td style="padding:5px 12px">${label}${isComp ? ' <span style="color:#94a3b8;font-size:10px">(auto)</span>' : ''}</td>${td}</tr>`);
        };
        addRow('Balance b/f', socieForm.balanceBf, false);
        addRow('Profit for the Year', socieForm.profitForYear, false);
        addRow('Expected Credit Loss Adjustments', socieForm.eclAdjustments, false);
        addRow('Other Changes in the year', socieForm.otherChanges, false);
        addRow('Prior Year Adjustments', socieForm.priorYearAdjustments, false);
        addRow('Total for the Year', socieComputedTotalForYear, true);
        addRow('Balance c/f', socieComputedBalanceCf, true);
        rows.push(`<tr><td colspan="${colLabels.length + 1}" style="background:#f1f5f9;font-weight:700;font-size:11px;padding:6px 12px;color:#475569;text-transform:uppercase;letter-spacing:0.05em">Transactions with owners recorded directly in equity</td></tr>`);
        addRow('Total Contribution', socieForm.transactionsWithOwners, false);
        addRow('Balance as at year-end', socieComputedBalanceAsAt, true);
        printWindow('Statement of Changes in Equity (Legacy)', `<table><tr>${th}</tr>${rows.join('')}</table>`, `FY ${selectedFy}`);
        return;
      }
    }
  }

  function handleExcel() {
    const fc = (v: number) => `"${(v / 100).toFixed(2)}"`;
    const q = (s: string) => `"${s}"`;
    switch (tab) {
      case 'income': {
        const lines: string[][] = [[q('Line Item'), q('Amount (NGN)')]];
        IS_LINES.filter(l => !l.section).forEach(line => {
          const val = line.computed ? getIsComputed(line.key) : (isForm as any)[line.key] || 0;
          lines.push([q(line.label), fc(val)]);
        });
        const csv = lines.map(r => r.join(',')).join('\n');
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `legacy_income_statement_fy${selectedFy}.csv`);
        return;
      }
      case 'cashflow': {
        const lines: string[][] = [[q('Section'), q('Line Item'), q('Amount (NGN)')]];
        const add = (section: string, label: string, val: number) => lines.push([q(section), q(label), fc(val)]);
        add('Operating Activities', 'Profit before interest and income taxes', cfForm.profitBeforeInterestAndTax);
        CF_OPERATING.filter(l => l.key !== 'profitBeforeInterestAndTax').forEach(l => add('Operating Activities', l.label, (cfForm as any)[l.key] || 0));
        add('Operating Activities', 'Cash generated from operating activities', cfComputedCashGenerated);
        add('Operating Activities', 'Income tax paid', cfForm.incomeTaxPaid);
        add('Operating Activities', 'Net Cash generated from operating activities', cfComputedNetOperating);
        CF_INVESTING.forEach(l => add('Investing Activities', l.label, (cfForm as any)[l.key] || 0));
        add('Investing Activities', 'Net Cash generated (used in) by investing activities', cfComputedNetInvesting);
        CF_FINANCING.forEach(l => add('Financing Activities', l.label, (cfForm as any)[l.key] || 0));
        add('Financing Activities', 'Net Cash generated by (used in) Financing Activities', cfComputedNetFinancing);
        const csv = lines.map(r => r.join(',')).join('\n');
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `legacy_cash_flow_fy${selectedFy}.csv`);
        return;
      }
      case 'socie': {
        const colHeaders = [q('Row'), ...SOCIE_COLUMNS.map(c => q(SOCIE_COLUMN_LABELS[c])), q('Total Equity')];
        const lines: string[][] = [colHeaders];
        const addRow = (label: string, data: typeof initialSocieRow) => {
          lines.push([q(label), ...SOCIE_COLUMNS.map(c => fc((data as any)[c] || 0)), fc(socieColumnTotal(data))]);
        };
        addRow('Balance b/f', socieForm.balanceBf);
        addRow('Profit for the Year', socieForm.profitForYear);
        addRow('Expected Credit Loss Adjustments', socieForm.eclAdjustments);
        addRow('Other Changes in the year', socieForm.otherChanges);
        addRow('Prior Year Adjustments', socieForm.priorYearAdjustments);
        addRow('Total for the Year', socieComputedTotalForYear);
        addRow('Balance c/f', socieComputedBalanceCf);
        addRow('Total Contribution', socieForm.transactionsWithOwners);
        addRow('Balance as at year-end', socieComputedBalanceAsAt);
        const csv = lines.map(r => r.join(',')).join('\n');
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `legacy_socie_fy${selectedFy}.csv`);
        return;
      }
    }
  }

  // ── Settings tab ──
  function renderSettingsTab() {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2"><Database className="w-5 h-5 text-indigo-500" /> Migration Settings</h3>
          <p className="text-sm text-slate-500 mb-6">
            Configure which fiscal year your organisation started using SkyBooks for live transaction entry.
            Years before this cutover will use manually-entered legacy figures for comparative reporting.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Live GL Start Fiscal Year</label>
              <select value={liveGl} onChange={e => setLiveGl(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— Not set —</option>
                {fiscalYears.map(fy => <option key={fy} value={fy}>{fy}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">The first fiscal year where real transactions were entered. Prior years use legacy snapshots.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Legacy System Name</label>
              <input type="text" value={legacyName} onChange={e => setLegacyName(e.target.value)} placeholder="e.g. QuickBooks, Sage"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-slate-400 mt-1">Displayed as a badge alongside legacy figures (e.g. "Migrated from QuickBooks").</p>
            </div>
            <button onClick={() => updateOrgMutation.mutate({ liveGlStartFiscalYear: liveGl ? parseInt(liveGl) : null, legacySystemName: legacyName })}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
              {updateOrgMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Income Statement form ──
  function renderIncomeStatementForm() {
    const isSaved = !!existingRecord;
    const isLocked = isSaved && locked;

    return (
      <div className="space-y-4">
        {isSaved && (
          <div className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${isLocked ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {isLocked ? 'Locked — click "Unlock to Edit" to make changes' : 'Unlocked — editable'}
            {existingRecord?.data && <span className="ml-auto text-xs opacity-70">Entered at {new Date(existingRecord.enteredAt).toLocaleString()}</span>}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr><th className="text-left px-4 py-3">Line Item</th><th className="text-right px-4 py-3 w-16">Note</th><th className="text-right px-4 py-3">Amount (NGN)</th></tr>
            </thead>
            <tbody>
              {IS_LINES.map(line => {
                if (line.section) {
                  return (
                    <tr key={line.key} className="bg-slate-50">
                      <td colSpan={3} className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{line.label}</td>
                    </tr>
                  );
                }
                const val = line.computed ? getIsComputed(line.key) : (isForm as any)[line.key] || 0;
                const noteKey = line.key === 'earningsPerShareKobo' ? 'earningsPerShareNote'
                  : line.key === 'dilutedEarningsPerShare' ? 'dilutedEpsNote'
                  : line.key + 'Note';
                const noteVal = line.note ? (isForm as any)[noteKey] || '' : '';
                const isComputed = line.computed;
                return (
                  <tr key={line.key} className={`border-t border-slate-100 ${line.bold ? 'bg-slate-50 font-bold' : ''}`}>
                    <td className={`px-4 py-2 ${line.indent ? 'pl-8' : ''} ${isComputed ? 'font-semibold' : ''} text-slate-800`}>
                      {line.label}
                      {isComputed && <span className="ml-2 text-[10px] text-slate-400">(auto)</span>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {line.note && (
                        <input type="text" disabled={isLocked && !isEditing} value={noteVal}
                          onChange={e => handleNoteChange(noteKey, e.target.value)}
                          placeholder="Ref" className="w-14 text-center text-xs border border-slate-200 rounded px-1 py-1" />
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isComputed ? (
                        <span className={line.key === 'profitForTheYear' && val < 0 ? 'text-red-600' : 'text-slate-800'}>
                          ₦{fmtKobo(val)}
                        </span>
                      ) : (
                        <input type="text" disabled={isLocked && !isEditing}
                          value={fmtKobo((isForm as any)[line.key] || 0)}
                          onChange={e => handleNumberChange(line.key, e.target.value)}
                          className={`text-right w-40 px-2 py-1 border border-slate-200 rounded-md text-sm ${isLocked && !isEditing ? 'bg-slate-50 text-slate-500' : 'bg-white'}`} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Cash Flow form ──
  function renderCashFlowForm() {
    const isSaved = !!existingRecord;
    const isLocked = isSaved && locked;

    function cfLabel(key: string): string {
      const all = [...CF_OPERATING, ...CF_INVESTING, ...CF_FINANCING];
      return all.find(l => l.key === key)?.label || key;
    }

    function cfRow(key: string, label: string, isComputed: boolean) {
      const val = isComputed
        ? (key === 'cashGeneratedFromOperations' ? cfComputedCashGenerated
          : key === 'netCashFromOperating' ? cfComputedNetOperating
          : key === 'netCashFromInvesting' ? cfComputedNetInvesting
          : key === 'netCashFromFinancing' ? cfComputedNetFinancing
          : 0)
        : (cfForm as any)[key] || 0;
      return (
        <tr key={key} className="border-t border-slate-100">
          <td className={`px-4 py-2 text-slate-800 ${isComputed ? 'font-semibold' : ''}`}>
            {label}
            {isComputed && <span className="ml-2 text-[10px] text-slate-400">(auto)</span>}
          </td>
          <td className="px-4 py-2 text-right">
            {isComputed ? (
              <span className="text-slate-800">₦{fmtKobo(val)}</span>
            ) : (
              <input type="text" disabled={isLocked && !isEditing}
                value={fmtKobo((cfForm as any)[key] || 0)}
                onChange={e => handleCfChange(key, e.target.value)}
                className={`text-right w-40 px-2 py-1 border border-slate-200 rounded-md text-sm ${isLocked && !isEditing ? 'bg-slate-50 text-slate-500' : 'bg-white'}`} />
            )}
          </td>
        </tr>
      );
    }

    function cfSection(title: string, keys: { key: string; label: string }[], computedKey?: string) {
      return (
        <>
          <tr className="bg-slate-50">
            <td colSpan={2} className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</td>
          </tr>
          {keys.map(({ key, label }) => cfRow(key, label, false))}
          {computedKey && cfRow(computedKey, (() => {
            const map: Record<string, string> = {
              cashGeneratedFromOperations: 'Cash generated from operating activities',
              netCashFromOperating: 'Net Cash generated from operating activities',
              netCashFromInvesting: 'Net Cash generated (used in) by investing activities',
              netCashFromFinancing: 'Net Cash generated by (used in) Financing Activities',
            };
            return map[computedKey] || computedKey;
          })(), true)}
        </>
      );
    }

    return (
      <div className="space-y-4">
        {isSaved && (
          <div className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${isLocked ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {isLocked ? 'Locked' : 'Unlocked — editable'}
            {existingRecord?.data && <span className="ml-auto text-xs opacity-70">Entered at {new Date(existingRecord.enteredAt).toLocaleString()}</span>}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr><th className="text-left px-4 py-3">Line Item</th><th className="text-right px-4 py-3">Amount (NGN)</th></tr>
            </thead>
            <tbody>
              {cfSection('Operating Activities', CF_OPERATING, 'cashGeneratedFromOperations')}
              {cfRow('incomeTaxPaid', 'Income tax paid', false)}
              {cfRow('netCashFromOperating', 'Net Cash generated from operating activities', true)}

              {cfSection('Investing Activities', CF_INVESTING, 'netCashFromInvesting')}

              {cfSection('Financing Activities', CF_FINANCING, 'netCashFromFinancing')}

              {/* Summary */}
              <tr className="bg-slate-50">
                <td colSpan={2} className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Summary</td>
              </tr>
              {cfRow('netIncreaseInCash', 'Net increase in cash and cash equivalents', true)}
              {cfRow('cashAtBeginningOfYear', 'Cash and cash equivalents at the beginning of the year', false)}
              <tr className="border-t border-slate-100">
                <td className="px-4 py-2 font-semibold text-slate-800">
                  Cash and cash equivalents at the end of the year
                  {cfForm.cashAtEndOfYearOverride && <span className="ml-2 text-[10px] text-amber-500">(overridden)</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  {cfForm.cashAtEndOfYearOverride ? (
                    <input type="text" disabled={isLocked && !isEditing}
                      value={fmtKobo(cfForm.cashAtEndOfYear || 0)}
                      onChange={e => handleCfChange('cashAtEndOfYear', e.target.value)}
                      className={`text-right w-40 px-2 py-1 border border-amber-300 rounded-md text-sm ${isLocked && !isEditing ? 'bg-slate-50 text-slate-500' : 'bg-white'}`} />
                  ) : (
                    <span className="text-slate-800">₦{fmtKobo(cfComputedEndOfYear)}</span>
                  )}
                  {!isLocked && (
                    <label className="ml-2 text-xs text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={cfForm.cashAtEndOfYearOverride}
                        onChange={e => setCfForm(prev => ({ ...prev, cashAtEndOfYearOverride: e.target.checked }))}
                        className="mr-1" />Override
                    </label>
                  )}
                </td>
              </tr>

              {/* Cash & Cash Equivalents Breakdown */}
              <tr className="bg-slate-50">
                <td colSpan={2} className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Cash & Cash Equivalents Breakdown</td>
              </tr>
              {cfRow('cashAndBankBalance', 'Cash & Bank balance', false)}
              {cfRow('termDeposit', 'Term Deposit', false)}
              {cfRow('termLoan', 'Term Loan (deduction)', false)}
              <tr className="border-t border-slate-100 bg-slate-50">
                <td className="px-4 py-2 text-xs text-slate-500">
                  Reconciliation to closing cash
                  {Math.abs(cfReconciliationDiff) > 1 && (
                    <span className={`ml-2 font-semibold ${Math.abs(cfReconciliationDiff) > 100 ? 'text-red-500' : 'text-amber-500'}`}>
                      (off by ₦{fmtKobo(cfReconciliationDiff)})
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-xs text-slate-500">
                  ₦{fmtKobo(cfForm.cashAndBankBalance + cfForm.termDeposit + cfForm.termLoan)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── SOCIE form ──
  function renderSocieForm() {
    const isSaved = !!existingRecord;
    const isLocked = isSaved && locked;

    function socieInputRow(label: string, rowKey: string, rowData: typeof initialSocieRow, isComputed: boolean) {
      const cols = [...SOCIE_COLUMNS] as string[];
      return (
        <tr key={rowKey} className="border-t border-slate-100">
          <td className={`px-3 py-2 text-xs text-slate-800 whitespace-nowrap ${isComputed ? 'font-semibold' : ''}`}>
            {label}
            {isComputed && <span className="ml-1 text-[10px] text-slate-400">(auto)</span>}
          </td>
          {cols.map(col => (
            <td key={col} className="px-1 py-1 text-right">
              {isComputed ? (
                <span className="text-xs text-slate-700">₦{fmtKobo((rowData as any)[col] || 0)}</span>
              ) : (
                <input type="text" disabled={isLocked && !isEditing}
                  value={fmtKobo((rowData as any)[col] || 0)}
                  onChange={e => handleSocieChange(rowKey, col, e.target.value)}
                  className={`text-right w-28 px-1 py-1 border border-slate-200 rounded text-xs ${isLocked && !isEditing ? 'bg-slate-50 text-slate-500' : 'bg-white'}`} />
              )}
            </td>
          ))}
          <td className="px-3 py-2 text-right font-semibold text-xs text-slate-800">
            ₦{fmtKobo(socieColumnTotal(rowData))}
          </td>
        </tr>
      );
    }

    return (
      <div className="space-y-4">
        {isSaved && (
          <div className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${isLocked ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {isLocked ? 'Locked' : 'Unlocked — editable'}
            {existingRecord?.data && <span className="ml-auto text-xs opacity-70">Entered at {new Date(existingRecord.enteredAt).toLocaleString()}</span>}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-3 whitespace-nowrap">Statement of Changes in Equity</th>
                {SOCIE_COLUMNS.map(col => (
                  <th key={col} className="text-right px-1 py-3 whitespace-nowrap">{SOCIE_COLUMN_LABELS[col]}</th>
                ))}
                <th className="text-right px-3 py-3 whitespace-nowrap">Total Equity</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-slate-50">
                <td colSpan={SOCIE_COLUMNS.length + 2} className="px-3 py-2 text-xs font-bold text-slate-500">
                  FY{selectedFy}
                </td>
              </tr>

              {socieInputRow('Balance b/f', 'balanceBf', socieForm.balanceBf, false)}
              {socieInputRow('Profit for the Year', 'profitForYear', socieForm.profitForYear, false)}
              {socieInputRow('Expected Credit Loss Adjustments', 'eclAdjustments', socieForm.eclAdjustments, false)}
              {socieInputRow('Other Changes in the year', 'otherChanges', socieForm.otherChanges, false)}
              {socieInputRow('Prior Year Adjustments', 'priorYearAdjustments', socieForm.priorYearAdjustments, false)}
              {socieInputRow('Total for the Year', 'totalForYear', socieComputedTotalForYear, true)}
              {socieInputRow('Balance c/f', 'balanceCf', socieComputedBalanceCf, true)}

              <tr className="bg-slate-100">
                <td colSpan={SOCIE_COLUMNS.length + 2} className="px-3 py-2 text-xs font-bold text-slate-500">
                  Transactions with owners recorded directly in equity
                </td>
              </tr>

              {socieInputRow('Total Contribution', 'transactionsWithOwners', socieForm.transactionsWithOwners, false)}
              {socieInputRow('Balance as at year-end', 'balanceAsAt', socieComputedBalanceAsAt, true)}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl p-3">
          For multi-year rollforward, save the prior year first — its closing balance will be auto-carried as the next year's opening balance when you create a new entry.
        </div>
      </div>
    );
  }

  // ── Main render ──
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-500" /> Legacy / Migration Financial Statements
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter prior-year financial data from your previous accounting system for comparative reporting.
          </p>
        </div>
        {org?.legacySystemName && (
          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-200 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> Migrated from {org.legacySystemName}
          </span>
        )}
      </div>

      {/* Save message */}
      {saveMsg && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${saveMsg.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {saveMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {[
          { key: 'income' as TabType, label: 'Income Statement' },
          { key: 'cashflow' as TabType, label: 'Cash Flow' },
          { key: 'socie' as TabType, label: 'Changes in Equity' },
          { key: 'settings' as TabType, label: 'Settings' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setIsEditing(false); setConfirmUnlock(null); }}
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Fiscal Year selector (not for settings tab) */}
      {tab !== 'settings' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-700">Fiscal Year:</label>
            <select value={selectedFy} onChange={e => { setSelectedFy(parseInt(e.target.value)); setIsEditing(false); }}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
              {fiscalYears.map(fy => <option key={fy} value={fy}>FY {fy}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {tab !== 'settings' && (
              <div className="flex items-center gap-1 mr-2">
                <button onClick={handlePdf} title="Download as PDF"
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  PDF
                </button>
                <button onClick={handleExcel} title="Download as CSV (opens in Excel)"
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  Excel
                </button>
              </div>
            )}
            {existingRecord && locked && !isEditing && (
              <button onClick={() => setConfirmUnlock(`${tab}-${selectedFy}`)}
                className="px-3 py-1.5 text-sm font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5">
                <Unlock className="w-4 h-4" /> Unlock to Edit
              </button>
            )}
            {existingRecord && !locked && (
              <button onClick={() => setIsEditing(!isEditing)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${isEditing ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'}`}>
                {isEditing ? <Eye className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                {isEditing ? 'View Mode' : 'Edit'}
              </button>
            )}
            {(!existingRecord) && (
              <button onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Enter Data
              </button>
            )}
            {(isEditing || (!locked && existingRecord)) && (
              <button onClick={() => {
                if (tab === 'income') {
                  saveMutation.mutate({
                    revenue: isForm.revenue,
                    revenueNote: isForm.revenueNote,
                    costOfSales: isForm.costOfSales,
                    costOfSalesNote: isForm.costOfSalesNote,
                    grossProfit: computedGrossProfit,
                    otherGainsOrLosses: isForm.otherGainsOrLosses,
                    otherGainsOrLossesNote: isForm.otherGainsOrLossesNote,
                    impairmentOnFinancialAssets: isForm.impairmentOnFinancialAssets,
                    impairmentOnFinancialAssetsNote: isForm.impairmentOnFinancialAssetsNote,
                    administrativeExpenses: isForm.administrativeExpenses,
                    administrativeExpensesNote: isForm.administrativeExpensesNote,
                    operatingProfit: computedOperatingProfit,
                    financeCost: isForm.financeCost,
                    financeCostNote: isForm.financeCostNote,
                    profitBeforeTax: computedProfitBeforeTax,
                    incomeTax: isForm.incomeTax,
                    incomeTaxNote: isForm.incomeTaxNote,
                    deferredTax: isForm.deferredTax,
                    deferredTaxNote: isForm.deferredTaxNote,
                    profitForTheYear: computedProfitForTheYear,
                    ociValuationGainLoss: isForm.ociValuationGainLoss,
                    ociValuationNote: isForm.ociValuationNote,
                    ociGrantIncome: isForm.ociGrantIncome,
                    ociGrantNote: isForm.ociGrantNote,
                    ociNetOfTaxes: computedOciNetOfTaxes,
                    totalComprehensiveIncome: computedTotalComprehensiveIncome,
                    earningsPerShareKobo: isForm.earningsPerShareKobo,
                    earningsPerShareNote: isForm.earningsPerShareNote,
                    dilutedEarningsPerShare: isForm.dilutedEarningsPerShare,
                    dilutedEpsNote: isForm.dilutedEpsNote,
                  });
                } else if (tab === 'cashflow') {
                  saveMutation.mutate({
                    profitBeforeInterestAndTax: cfForm.profitBeforeInterestAndTax,
                    depreciationPPE: cfForm.depreciationPPE,
                    amortization: cfForm.amortization,
                    decreaseIncreasePrepayments: cfForm.decreaseIncreasePrepayments,
                    decreaseIncreaseReceivables: cfForm.decreaseIncreaseReceivables,
                    increaseDecreasePayables: cfForm.increaseDecreasePayables,
                    increaseDecreaseDeferredIncome: cfForm.increaseDecreaseDeferredIncome,
                    grantOtherIncome: cfForm.grantOtherIncome,
                    provisionForTax: cfForm.provisionForTax,
                    cashGeneratedFromOperations: cfComputedCashGenerated,
                    incomeTaxPaid: cfForm.incomeTaxPaid,
                    netCashFromOperating: cfComputedNetOperating,
                    purchaseIntangibleAssets: cfForm.purchaseIntangibleAssets,
                    purchasePPE: cfForm.purchasePPE,
                    interestReceived: cfForm.interestReceived,
                    proceedsFromSalePPE: cfForm.proceedsFromSalePPE,
                    netCashFromInvesting: cfComputedNetInvesting,
                    shareCapital: cfForm.shareCapital,
                    depositForShares: cfForm.depositForShares,
                    retainedEarnings: cfForm.retainedEarnings,
                    sharePremium: cfForm.sharePremium,
                    revaluation: cfForm.revaluation,
                    dividendsPaid: cfForm.dividendsPaid,
                    netCashFromFinancing: cfComputedNetFinancing,
                    netIncreaseInCash: cfComputedNetIncrease,
                    cashAtBeginningOfYear: cfForm.cashAtBeginningOfYear,
                    cashAtEndOfYear: cfComputedEndOfYear,
                    cashAtEndOfYearOverride: cfForm.cashAtEndOfYearOverride,
                    cashAndBankBalance: cfForm.cashAndBankBalance,
                    termDeposit: cfForm.termDeposit,
                    termLoan: cfForm.termLoan,
                  });
                } else {
                  saveMutation.mutate({
                    yearLabel: `FY${selectedFy}`,
                    balanceBf: socieForm.balanceBf,
                    profitForYear: socieForm.profitForYear,
                    eclAdjustments: socieForm.eclAdjustments,
                    otherChanges: socieForm.otherChanges,
                    priorYearAdjustments: socieForm.priorYearAdjustments,
                    transactionsWithOwners: socieForm.transactionsWithOwners,
                  });
                }
              }}
                className="px-4 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                disabled={saveMutation.isPending}>
                <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Saving...' : 'Save Statement'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Unlock confirmation modal */}
      {confirmUnlock && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setConfirmUnlock(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 mx-4" onClick={e => e.stopPropagation()}>
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Unlock Legacy Statement?</h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              This will allow editing of a previously locked historical statement. This data feeds comparative reports —
              changing it may affect financial reporting. Are you sure?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmUnlock(null)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={() => unlockMutation.mutate()} className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors">
                {unlockMutation.isPending ? 'Unlocking...' : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {tab === 'settings' && renderSettingsTab()}
      {tab === 'income' && renderIncomeStatementForm()}
      {tab === 'cashflow' && renderCashFlowForm()}
      {tab === 'socie' && renderSocieForm()}
    </div>
  );
}
