/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  FileText,
  AlertOctagon,
  Calendar,
  CheckCircle,
  Upload,
  Layers,
  ArrowRight,
  ShieldAlert,
  Loader2,
  FileCode,
  DollarSign,
  X,
  Plus,
} from 'lucide-react';
import { api, purchasesApi } from '../../lib/api';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';

interface Insight {
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'alert';
  metric?: string;
}

interface Anomaly {
  transactionId: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  // UI-enriched fields
  date?: string;
  description?: string;
  amountKobo?: number;
}

export default function InsightsDashboard() {
  const [activeTab, setActiveTab] = useState<'insights' | 'playground'>('insights');
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  
  // Insights & Anomalies State
  const [insights, setInsights] = useState<Insight[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [anomaliesError, setAnomaliesError] = useState<string | null>(null);
  const [expandedInsights, setExpandedInsights] = useState<Record<number, boolean>>({});

  // Playground State - Receipt OCR
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Expense creation from OCR
  const [expenseModal, setExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ accountId: '', vendorId: '', date: '', amount: '', description: '', paymentMethod: 'cash', reference: '' });
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseCreated, setExpenseCreated] = useState(false);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const expenseAccounts = useMemo(() => accountsList.filter((a: any) => a.type === 'expense'), [accountsList]);

  // Pre-fill expense form when OCR result arrives
  useEffect(() => {
    if (ocrResult && ocrResult.totalAmountKobo > 0) {
      setExpenseForm(prev => ({
        ...prev,
        description: ocrResult.vendorName !== 'Unknown Vendor' ? `Payment to ${ocrResult.vendorName}` : (ocrFile?.name?.replace(/\.[^/.]+$/, '') || 'Expense'),
        amount: String((ocrResult.totalAmountKobo / 100).toFixed(2)),
        date: ocrResult.date || new Date().toISOString().split('T')[0],
        reference: ocrResult.receiptNumber || '',
      }));
      setExpenseCreated(false);
    }
  }, [ocrResult, ocrFile]);

  // Load accounts and vendors when modal opens
  useEffect(() => {
    if (expenseModal) {
      api.get('/accountant/accounts').then(r => setAccountsList(Array.isArray(r.data) ? r.data : [])).catch(() => {});
      api.get('/purchases/vendors').then(r => setVendorsList(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    }
  }, [expenseModal]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.accountId || !expenseForm.amount) return;
    setExpenseSaving(true);
    setExpenseError(null);
    try {
      const amountKobo = Math.round(parseFloat(expenseForm.amount) * 100);
      await purchasesApi.createExpense({
        accountId: expenseForm.accountId,
        vendorId: expenseForm.vendorId || undefined,
        date: expenseForm.date,
        amount: amountKobo,
        description: expenseForm.description,
        reference: expenseForm.reference || undefined,
        paymentMethod: expenseForm.paymentMethod,
      });
      setExpenseCreated(true);
      setTimeout(() => setExpenseModal(false), 1500);
    } catch (err: any) {
      setExpenseError(err.response?.data?.error || err.message || 'Failed to create expense.');
    } finally {
      setExpenseSaving(false);
    }
  };

  // Playground State - Categorisation
  const [catDesc, setCatDesc] = useState('Uber Trip Lagos');
  const [catAmount, setCatAmount] = useState('15000');
  const [catCategories, setCatCategories] = useState('Office Expense, Travel & Transport, Staff Welfare, Marketing');
  const [catLoading, setCatLoading] = useState(false);
  const [catResult, setCatResult] = useState<any | null>(null);
  const [catError, setCatError] = useState<string | null>(null);

  // Playground State - Description autocomplete suggestions
  const [suggestInput, setSuggestInput] = useState('Generator fuel purchase');
  const [suggestResult, setSuggestResult] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Load Monthly CFO Insights
  const fetchMonthlyInsights = async (forceInit = false) => {
    setLoadingInsights(true);
    setInsightsError(null);
    try {
      const response = await api.get(`/ai/insights/${selectedMonth}-01`);
      if (response.data?.success) {
        setInsights(response.data.data);
      } else {
        setInsightsError('Could not render response. Please ensure API is healthy.');
      }
    } catch (err: any) {
      setInsightsError(
        err.response?.data?.error || 'CFO insights engine was unable to pull insights for this date range.'
      );
    } finally {
      setLoadingInsights(false);
    }
  };

  // Scan and Detect Anomalies from real data
  const runAnomalyScan = async () => {
    setLoadingAnomalies(true);
    setAnomaliesError(null);
    try {
      // Strategy: pull real transactions from bank → journal entries → payments
      let combinedTxns: any[] = [];

      // 1. Try bank transactions
      const accountsRes = await api.get('/banking/accounts');
      if (accountsRes.data && accountsRes.data.length > 0) {
        const txnsRes = await api.get(`/banking/accounts/${accountsRes.data[0].id}/transactions`, {
          params: { limit: 100 },
        });
        if (txnsRes.data?.transactions?.length) {
          combinedTxns = txnsRes.data.transactions;
        }
      }

      // 2. Fallback: journal entries
      if (combinedTxns.length === 0) {
        const jeRes = await api.get('/journals');
        if (Array.isArray(jeRes.data) && jeRes.data.length > 0) {
          const monthStart = new Date(`${selectedMonth}-01`);
          const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
          const filtered = jeRes.data.filter((e: any) => {
            const d = new Date(e.date);
            return d >= monthStart && d <= monthEnd;
          });
          combinedTxns = filtered.map((e: any) => ({
            id: e.id,
            description: e.description || 'Journal Entry',
            amount: 0,
            date: e.date?.split('T')[0],
            reference: e.entryNumber,
          }));
        }
      }

      // 3. Fallback: payments received
      if (combinedTxns.length === 0) {
        const pmtRes = await api.get('/sales/payments', { params: { limit: 200 } });
        if (pmtRes.data?.length) {
          combinedTxns = pmtRes.data.map((p: any) => ({
            id: p.id,
            description: p.description || p.reference || 'Payment received',
            amount: p.amount || 0,
            date: p.date?.split('T')[0],
          }));
        }
      }

      // 4. Fallback: payments made
      if (combinedTxns.length === 0) {
        const pmtRes = await api.get('/purchases/payments', { params: { limit: 200 } });
        if (pmtRes.data?.length) {
          combinedTxns = pmtRes.data.map((p: any) => ({
            id: p.id,
            description: p.description || p.reference || 'Payment made',
            amount: p.amount || 0,
            date: p.date?.split('T')[0],
          }));
        }
      }

      // If still no real data, show empty state — no placeholders
      if (combinedTxns.length === 0) {
        setAnomalies([]);
        setLoadingAnomalies(false);
        return;
      }

      const scanRes = await api.post('/ai/detect-anomalies', { transactions: combinedTxns });
      if (scanRes.data?.success) {
        const enriched = scanRes.data.data.map((anom: Anomaly) => {
          const matchTx = combinedTxns.find((t) => t.id === anom.transactionId);
          return {
            ...anom,
            date: matchTx?.date,
            description: matchTx?.description,
            amountKobo: matchTx?.amount || matchTx?.amountKobo,
          };
        });
        setAnomalies(enriched);
      }
    } catch (err: any) {
      setAnomaliesError(err.response?.data?.error || 'Unable to execute transaction scan.');
    } finally {
      setLoadingAnomalies(false);
    }
  };

  // Run on initial mount & month change
  useEffect(() => {
    fetchMonthlyInsights();
    runAnomalyScan();
  }, [selectedMonth]);

  // Handle Receipt Upload OCR
  const handleReceiptOcrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocrFile) return;

    setOcrLoading(true);
    setOcrError(null);
    setOcrResult(null);

    const formData = new FormData();
    formData.append('file', ocrFile);

    try {
      const res = await api.post('/ai/extract-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        setOcrResult(res.data.data);
      }
    } catch (err: any) {
      setOcrError(err.response?.data?.error?.includes('quota') ? 'AI vision service is temporarily unavailable due to high demand. Please try again later.' : (err.response?.data?.error || 'Receipt OCR processing failed. Check file type.'));
    } finally {
      setOcrLoading(false);
    }
  };

  // Handle Categorisation Run
  const handleCategorisation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatLoading(true);
    setCatError(null);
    setCatResult(null);

    const catsArr = catCategories.split(',').map((c) => c.trim()).filter(Boolean);

    try {
      const res = await api.post('/ai/categorise-transaction', {
        description: catDesc,
        amount: Number(catAmount),
        orgCategories: catsArr,
      });
      if (res.data?.success) {
        setCatResult(res.data.data);
      }
    } catch (err: any) {
      setCatError(err.response?.data?.error || 'Category matching failed.');
    } finally {
      setCatLoading(false);
    }
  };

  // Handle autocomplete input change
  const handleSuggestKey = async (val: string) => {
    setSuggestInput(val);
    if (val.length < 3) {
      setSuggestResult([]);
      return;
    }
    setSuggestLoading(true);
    try {
      const res = await api.post('/ai/suggest-description', { partialDescription: val });
      if (res.data?.success) {
        setSuggestResult(res.data.data);
      }
    } catch (err) {
      console.warn('AutoComplete returned error:', err);
    } finally {
      setSuggestLoading(false);
    }
  };

  const toggleInsightExpand = (index: number) => {
    setExpandedInsights((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const formatNaira = (kobo: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(kobo / 100);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="h-6 w-6 text-indigo-600 animate-pulse" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Financial Assistant</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time CFO intelligence. Automated audit scans, financial ratio alerts, and business performance monitoring.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center space-x-3 bg-white p-1.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all duration-200 ${
              activeTab === 'insights'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Insights & Auditing
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all duration-200 ${
              activeTab === 'playground'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Capabilities Playground
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'insights' ? (
          <motion.div
            key="insights-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Left Column: Config controller & CFO Insights */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-3 self-start sm:self-center">
                  <Calendar className="h-5 w-5 text-indigo-500" />
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black font-mono text-slate-400 uppercase">Analysis Period:</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="text-sm font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      fetchMonthlyInsights();
                      runAnomalyScan();
                    }}
                    disabled={loadingInsights || loadingAnomalies}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingInsights || loadingAnomalies ? 'animate-spin' : ''}`} />
                    <span>Refresh CFO Audit</span>
                  </button>
                </div>
              </div>

              {/* Monthly Insights Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-md font-bold text-slate-800 tracking-tight flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                    <span>SME CFO Monthly Insights</span>
                  </h2>
                  <span className="text-[10px] text-slate-400 font-bold font-mono">Month: {selectedMonth}</span>
                </div>

                {loadingInsights ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center space-y-4 min-h-[300px]">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-600 animate-pulse">Analysing all module data for CFO insights...</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">Computing revenue, costs, cash flow, and key metrics</p>
                    </div>
                  </div>
                ) : insightsError ? (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 flex items-start space-x-3 text-amber-800">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs">CFO Advice Offline</h4>
                      <p className="text-xs mt-1 text-slate-600 leading-relaxed">{insightsError}</p>
                      <button
                        onClick={() => fetchMonthlyInsights()}
                        className="mt-3 text-[10px] font-black uppercase text-indigo-600 hover:underline"
                      >
                        Retry Insights compilation
                      </button>
                    </div>
                  </div>
                ) : insights.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center min-h-[200px] flex flex-col items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                    <h4 className="font-bold text-xs text-slate-700">Perfect Month Clean Ledger</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      No significant variance or threats found. Let's trigger a CFO ledger audit to compile new forecasts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {insights.map((insight, idx) => {
                      const expanded = expandedInsights[idx] || false;
                      const isAlert = insight.severity === 'alert';
                      const isWarning = insight.severity === 'warning';
                      
                      const borderColor = isAlert
                        ? 'border-l-4 border-l-red-500'
                        : isWarning
                        ? 'border-l-4 border-l-amber-500'
                        : 'border-l-4 border-l-blue-500';

                      const severityBg = isAlert
                        ? 'bg-red-50 text-red-700'
                        : isWarning
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-700';

                      return (
                        <motion.div
                          layout
                          key={`insight-${idx}`}
                          className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer transition-all hover:bg-slate-50/50 ${borderColor}`}
                          onClick={() => toggleInsightExpand(idx)}
                        >
                          <div className="p-4 flex items-start justify-between gap-4">
                            <div className="flex items-start space-x-3">
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${severityBg}`}>
                                {insight.severity}
                              </span>
                              <div>
                                <h3 className="text-sm font-bold text-slate-800 tracking-tight">{insight.title}</h3>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2 md:line-clamp-none">
                                  {insight.detail}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              {insight.metric && (
                                <span className="text-xs font-mono font-black py-1 px-2.5 bg-slate-50 border border-slate-200 rounded text-indigo-700 whitespace-nowrap">
                                  {insight.metric}
                                </span>
                              )}
                              <button className="text-slate-400 hover:text-slate-600">
                                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>

                          <AnimatePresence>
                            {expanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-slate-100 bg-slate-50 p-4"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">CFO Analysis Detail</h4>
                                <p className="text-xs leading-relaxed text-slate-600">
                                  {insight.detail} This was flagged under your corporate risk profiling system to maintain optimum cash reserve standards. Nigerian tax compliances and interest-bearing operations should be adjusted accordingly.
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Transaction Anomalies Audit Feed */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center space-x-2">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  <span>Interactive Audit-Shield</span>
                </h2>
                <span className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full animate-pulse">
                  Unusual Active Feed
                </span>
              </div>

              {loadingAnomalies ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                  <p className="text-[10px] font-bold text-slate-500 tracking-tight">Scanning ledger feeds for round numbers / duplicates...</p>
                </div>
              ) : anomaliesError ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center text-slate-500">
                  <AlertTriangle className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs">{anomaliesError}</p>
                </div>
              ) : anomalies.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <h4 className="font-bold text-xs text-slate-700">Perfect Internal Audit</h4>
                  <p className="text-[11px] text-slate-400 mt-1">We couldn't detect anomalies in the reviewed transactions window.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {anomalies.map((anom, idx) => {
                    const isHigh = anom.severity === 'high';
                    const isMed = anom.severity === 'medium';
                    const sColor = isHigh
                      ? 'border-l-4 border-l-red-500 bg-red-50/20'
                      : isMed
                      ? 'border-l-4 border-l-amber-500 bg-amber-50/20'
                      : 'border-l-4 border-l-slate-400 bg-slate-50/50';

                    return (
                      <div
                        key={`anomaly-${idx}`}
                        className={`p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2.5 transition-all hover:bg-slate-50/30 ${sColor}`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isHigh ? 'bg-red-100 text-red-800' : isMed ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {anom.severity} Threat
                          </span>
                          {anom.date && (
                            <span className="text-[9px] text-slate-400 font-mono font-bold">
                              {new Date(anom.date).toLocaleDateString('en-GB')}
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="text-xs font-bold text-slate-800 tracking-tight leading-tight">
                            {anom.description || 'Unknown Narrative'}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            {anom.reason}
                          </p>
                        </div>

                        {anom.amountKobo !== undefined && (
                          <div className="flex justify-between items-center border-t border-slate-100/60 pt-2">
                            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Indexed sum:</span>
                            <span className="text-xs font-bold font-mono text-slate-700">
                              {formatNaira(anom.amountKobo)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="playground-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Box 1: Receipt OCR and Auto-Extraction */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Upload className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-800">Receipt OCR & Data Extractor</h3>
                </div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">
                    AI Vision OCR
                  </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-6">
                <form onSubmit={handleReceiptOcrSubmit} className="space-y-4">
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50/50 cursor-pointer transition relative">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setOcrFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    {ocrFile ? (
                      <div>
                        <p className="text-xs font-bold text-slate-700 truncate">{ocrFile.name}</p>
                        <p className="text-[10px] text-indigo-600 font-mono mt-1">Ready for vision analysis (Click Upload)</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-bold text-slate-600">Select or drop purchase receipt file</p>
                        <p className="text-[9px] text-slate-400 mt-1">Supports PNG, JPG, PDF (Max 10MB)</p>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={ocrLoading || !ocrFile}
                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs py-2.5 rounded-lg transition-all"
                  >
                    {ocrLoading ? 'Extracting...' : 'Extract Receipt Data'}
                  </button>
                </form>

                {ocrError && (
                  <div className="p-3 bg-red-50 text-red-800 border border-red-100 text-xs rounded-lg">
                    {ocrError}
                  </div>
                )}

                {ocrResult && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 font-mono text-[11px]">
                    {ocrResult._note && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[10px] leading-relaxed">
                        {ocrResult._note}
                      </div>
                    )}
                    <div className="flex justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-slate-400 font-bold">VEND:</span>
                      <span className="text-slate-700 font-black">{ocrResult.vendorName}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-slate-400 font-bold">DATE:</span>
                      <span className="text-slate-700">{ocrResult.date || 'NOT FOUND'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-slate-400 font-bold">TOTAL SUM:</span>
                      <span className="text-emerald-700 font-black">{formatNaira(ocrResult.totalAmountKobo)}</span>
                    </div>
                    {ocrResult.receiptNumber && (
                      <div className="flex justify-between border-b border-slate-200 pb-1.5">
                        <span className="text-slate-400 font-bold">REF/INV #:</span>
                        <span className="text-slate-600">{ocrResult.receiptNumber}</span>
                      </div>
                    )}

                    <div className="pt-1.5">
                      <span className="text-slate-400 font-bold block mb-1 uppercase tracking-wide">Line Items:</span>
                      <div className="space-y-1">
                        {ocrResult.lineItems?.length > 0 ? ocrResult.lineItems.map((li: any, i: number) => (
                          <div key={i} className="flex justify-between text-slate-600 bg-white p-1.5 rounded border border-slate-200">
                            <span>{li.description}</span>
                            <span>{li.quantity}x @ {formatNaira(li.unitPriceKobo)}</span>
                          </div>
                        )) : (
                          <p className="text-[10px] text-slate-400 italic">No items extracted</p>
                        )}
                      </div>
                    </div>

                    {!ocrResult._note && ocrResult.totalAmountKobo > 0 && (
                      <button
                        onClick={() => { setExpenseModal(true); setExpenseCreated(false); }}
                        className="w-full mt-2 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-lg transition-all"
                      >
                        <Plus size={14} />
                        Create Expense from Receipt
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Box 2: Smart Categorization & Suggestions */}
            <div className="space-y-6">
              {/* Transaction Categoriser */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-800">Dynamic Transaction Auto-Categoriser</h3>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">
                    Smart Classifier
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  <form onSubmit={handleCategorisation} className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">FEED DESCRIPTION</label>
                      <input
                        type="text"
                        value={catDesc}
                        onChange={(e) => setCatDesc(e.target.value)}
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2.5 mt-1 focus:outline-none focus:border-indigo-500"
                        placeholder="e.g., MTN Recharge Lagos Nigeria"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase">AMOUNT (₦ NAIRA)</label>
                      <input
                        type="number"
                        value={catAmount}
                        onChange={(e) => setCatAmount(e.target.value)}
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2.5 mt-1 focus:outline-none focus:border-indigo-500 font-mono"
                        placeholder="15000"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase">CATEGORIES SET</label>
                      <input
                        type="text"
                        value={catCategories}
                        onChange={(e) => setCatCategories(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2.5 mt-1 focus:outline-none focus:border-indigo-500"
                        placeholder="Category A, Category B"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={catLoading}
                      className="col-span-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-lg transition-all"
                    >
                      {catLoading ? 'Analysing...' : 'Categorise Feed Transaction'}
                    </button>
                  </form>

                  {catResult && (
                    <div className="p-4 bg-indigo-500/5 border border-indigo-100 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-500">Suggested Category:</span>
                        <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {catResult.category}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Confidence Score:</span>
                        <span className="font-black font-mono text-slate-600">
                          {Math.round(catResult.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100/50 pt-2 mt-1.5">
                        <span className="font-bold text-slate-600">Reasoning:</span> {catResult.reasoning}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Autocomplete Input Line Descriptions */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 tracking-tight">Invoice Line Autocomplete Suggestions</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Suggests line item names based on historical data as you type.</p>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={suggestInput}
                    onChange={(e) => handleSuggestKey(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2.5 mt-1 focus:outline-none focus:border-indigo-500"
                    placeholder="Type to search (e.g., generator, fuel...)"
                  />
                  {suggestLoading && (
                    <span className="absolute right-3 top-3.5">
                      <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
                    </span>
                  )}
                </div>

                {suggestResult.length > 0 && (
                  <div className="space-y-1">
                    {suggestResult.map((text, i) => (
                      <button
                        key={i}
                        onClick={() => setSuggestInput(text)}
                        className="w-full text-left text-xs bg-slate-50 hover:bg-indigo-50/50 hover:text-indigo-700 border border-slate-200 p-2 rounded transition-all flex items-center justify-between"
                      >
                        <span>{text}</span>
                        <ArrowRight className="h-3 w-3 text-indigo-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Expense from OCR Modal */}
      {expenseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Create Expense from Receipt</h2>
              <button onClick={() => setExpenseModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateExpense} className="px-6 py-5 space-y-4">
              {expenseError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertTriangle size={14} /> {expenseError}
                </div>
              )}
              {expenseCreated && (
                <div className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-center gap-2">
                  <CheckCircle size={14} /> Expense created successfully!
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expense Account *</label>
                  <AccountSearchSelect
                    accounts={expenseAccounts}
                    value={expenseForm.accountId}
                    onChange={id => setExpenseForm({ ...expenseForm, accountId: id })}
                    placeholder="Search and select account..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₦) *</label>
                  <input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                  <select value={expenseForm.paymentMethod} onChange={e => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    {['cash', 'bank_transfer', 'card', 'cheque', 'pos', 'ussd'].map(m => <option key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor (optional)</label>
                  <select value={expenseForm.vendorId} onChange={e => setExpenseForm({ ...expenseForm, vendorId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Select vendor</option>
                    {vendorsList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                  <input value={expenseForm.reference} onChange={e => setExpenseForm({ ...expenseForm, reference: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                  <input value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setExpenseModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={expenseSaving || !expenseForm.accountId || !expenseForm.amount} className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                  {expenseSaving && <Loader2 size={14} className="animate-spin" />}
                  {expenseCreated ? 'Created!' : 'Create Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
