import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Users, Building2, Package, Wrench, DollarSign, Landmark, BookOpen, FileText, ChevronDown, Download, Loader2, Search, Calendar, ExternalLink, ArrowRight, Filter, ChevronRight, PieChart, Receipt, Banknote, Target, Sparkles } from 'lucide-react';
import { customReportsApi } from '../../lib/api';
import { exportToCsv } from '../../lib/csvTemplates';
import { printWindow } from '../../lib/api';

const fmtNaira = (k: number) => `₦${(k / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | Date | null | undefined) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const pct = (v: number) => `${v.toFixed(1)}%`;

const SECTIONS = [
  { id: 'customers', label: 'Customer Reports', icon: Users, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', text: 'text-blue-600', desc: 'Customer summaries, statements & sales analysis' },
  { id: 'suppliers', label: 'Supplier Reports', icon: Building2, color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50', text: 'text-amber-600', desc: 'Vendor summaries, statements & purchase analysis' },
  { id: 'tax', label: 'Tax Reports', icon: TrendingUp, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-600', desc: 'VAT, WHT, PAYE summaries & transaction logs' },
  { id: 'inventory', label: 'Inventory Reports', icon: Package, color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50', text: 'text-purple-600', desc: 'Stock levels, valuations & sales by item' },
  { id: 'fixed-assets', label: 'Fixed Assets Reports', icon: Wrench, color: 'from-rose-500 to-rose-600', bg: 'bg-rose-50', text: 'text-rose-600', desc: 'Asset registers & depreciation schedules' },
  { id: 'payroll', label: 'Payroll Reports', icon: DollarSign, color: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-50', text: 'text-cyan-600', desc: 'Employee lists & payslip breakdowns' },
  { id: 'banking', label: 'Banking Reports', icon: Landmark, color: 'from-violet-500 to-violet-600', bg: 'bg-violet-50', text: 'text-violet-600', desc: 'Cash positions, bank accounts & reconciliations' },
  { id: 'accounting', label: 'GL & Accounting Reports', icon: BookOpen, color: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50', text: 'text-indigo-600', desc: 'Ledger summaries, trial balances & budget variance' },
];

const ICON_MAP: Record<string, React.ElementType> = {
  Users, Building2, TrendingUp, Package, Wrench, DollarSign, Landmark, BookOpen,
};

const REPORTS: Record<string, { id: string; label: string; needsDates: boolean; apiFn: keyof typeof customReportsApi; desc: string; icon: React.ElementType; transform?: (d: any, navigate?: ReturnType<typeof useNavigate>) => { headers: string[]; rows: any[][] }; }[]> = {
  customers: [
    { id: 'customer-summary', label: 'Customer Summary', needsDates: true, apiFn: 'getCustomerSummary', icon: Users, desc: 'All customers with invoice totals, payments & balances', transform: (d, nav) => ({ headers: ['Customer', 'Email', 'Phone', 'Invoiced', 'Paid', 'Balance', 'Last Invoice', 'Count'], rows: d.map((r: any) => [r.name, r.email || '-', r.phone || '-', fmtNaira(r.totalInvoiced), fmtNaira(r.totalPaid), fmtNaira(r.balanceDue), fmtDate(r.lastInvoiceDate), r.invoiceCount]) }) },
    { id: 'customer-statements', label: 'Customer Statements', needsDates: true, apiFn: 'getCustomerStatements', icon: Receipt, desc: 'Per-customer invoice ledgers with balances' },
    { id: 'sales-by-customer', label: 'Sales by Customer', needsDates: true, apiFn: 'getSalesByCustomer', icon: TrendingUp, desc: 'Sales revenue grouped by customer', transform: (d) => ({ headers: ['Customer', 'Email', 'Total Sales', 'Invoices'], rows: d.map((r: any) => [r.customerName, r.customerEmail || '-', fmtNaira(r.totalAmount), r.invoiceCount]) }) },
    { id: 'taxable-sales-per-customer', label: 'Taxable Sales per Customer', needsDates: true, apiFn: 'getTaxableSalesPerCustomer', icon: Receipt, desc: 'VAT-able sales amounts per customer', transform: (d) => ({ headers: ['Customer', 'Email', 'Taxable Amount', 'Invoice Total', 'Invoices'], rows: d.map((r: any) => [r.customerName, r.customerEmail || '-', fmtNaira(r.totalTaxableAmount), fmtNaira(r.totalInvoiceAmount), r.invoiceCount]) }) },
  ],
  suppliers: [
    { id: 'supplier-summary', label: 'Supplier Summary', needsDates: true, apiFn: 'getSupplierSummary', icon: Building2, desc: 'All vendors with bill totals, payments & balances', transform: (d) => ({ headers: ['Supplier', 'Email', 'Phone', 'Billed', 'Paid', 'Balance', 'Last Bill', 'Count'], rows: d.map((r: any) => [r.name, r.email || '-', r.phone || '-', fmtNaira(r.totalBilled), fmtNaira(r.totalPaid), fmtNaira(r.balanceDue), fmtDate(r.lastBillDate), r.billCount]) }) },
    { id: 'supplier-statements', label: 'Supplier Statements', needsDates: true, apiFn: 'getSupplierStatements', icon: Receipt, desc: 'Per-vendor bill ledgers with balances' },
    { id: 'taxable-purchases-per-supplier', label: 'Taxable Purchases per Supplier', needsDates: true, apiFn: 'getTaxablePurchasesPerSupplier', icon: Receipt, desc: 'VAT-able purchase amounts per vendor', transform: (d) => ({ headers: ['Supplier', 'Email', 'Taxable Amount', 'Bill Total', 'Bills'], rows: d.map((r: any) => [r.vendorName, r.vendorEmail || '-', fmtNaira(r.totalTaxableAmount), fmtNaira(r.totalBillAmount), r.billCount]) }) },
  ],
  tax: [
    { id: 'tax-summary', label: 'Tax Summary', needsDates: true, apiFn: 'getTaxSummary', icon: TrendingUp, desc: 'Consolidated VAT, WHT & PAYE totals', transform: undefined },
    { id: 'tax-transactions', label: 'Tax Transactions', needsDates: true, apiFn: 'getTaxTransactions', icon: Receipt, desc: 'Journal entries for all tax-related accounts', transform: (d) => ({ headers: ['Date', 'Entry #', 'Description', 'Account', 'Role', 'Debit', 'Credit'], rows: d.map((r: any) => [fmtDate(r.date), r.entryNumber, r.description || '-', r.accountName, r.accountRole || '-', fmtNaira(r.debitAmount), fmtNaira(r.creditAmount)]) }) },
  ],
  inventory: [
    { id: 'inventory-summary', label: 'Inventory Summary', needsDates: false, apiFn: 'getInventorySummary', icon: Package, desc: 'Stock items with quantities, prices & total value', transform: (d, nav) => ({ headers: ['Item Name', 'SKU', 'Category', 'Qty', 'Unit Price', 'Total Value'], rows: d.map((r: any) => [r.name, r.sku || '-', r.category || '-', r.quantity, fmtNaira(r.unitPrice), fmtNaira(r.totalValue)]) }) },
    { id: 'sales-by-item', label: 'Sales by Item', needsDates: true, apiFn: 'getSalesByItem', icon: TrendingUp, desc: 'Sales revenue grouped by product/item', transform: (d, nav) => ({ headers: ['Item', 'SKU', 'Qty Sold', 'Revenue', 'Transactions'], rows: d.map((r: any) => [r.itemName || '-', r.itemSku || '-', r.totalQuantity, fmtNaira(r.totalAmount), r.lineCount]) }) },
  ],
  'fixed-assets': [
    { id: 'fixed-asset-summary', label: 'Fixed Asset Summary', needsDates: false, apiFn: 'getFixedAssetSummary', icon: Wrench, desc: 'All fixed assets with depreciation & book values', transform: (d) => ({ headers: ['Asset', 'Category', 'Purchase Date', 'Cost', 'Acc. Depr.', 'Net Book Value', 'Status'], rows: d.map((r: any) => [r.name, r.category || '-', fmtDate(r.purchaseDate), fmtNaira(r.purchasePrice), fmtNaira(r.accumulatedDepreciation), fmtNaira(r.netBookValue), r.status || '-']) }) },
    { id: 'fixed-asset-depreciation', label: 'Depreciation Schedule', needsDates: false, apiFn: 'getFixedAssetDepreciation', icon: BarChart3, desc: 'Per-asset depreciation projections & remaining life', transform: (d) => ({ headers: ['Asset', 'Category', 'Cost', 'Residual', 'Acc. Depr.', 'Net Book', 'Method', 'Life', 'Period Depr.', 'Remaining'], rows: d.map((r: any) => [r.name, r.category || '-', fmtNaira(r.purchaseCost), fmtNaira(r.residualValue), fmtNaira(r.accumulatedDepreciation), fmtNaira(r.netBookValue), r.depreciationMethod || '-', r.usefulLifeMonths ?? '-', fmtNaira(r.depreciationPerPeriod), r.remainingLifeMonths]) }) },
  ],
  payroll: [
    { id: 'employee-summary', label: 'Employee Summary', needsDates: false, apiFn: 'getEmployeeSummary', icon: DollarSign, desc: 'Employee directory with pay history & salary info', transform: (d, nav) => ({ headers: ['Name', 'Department', 'Staff ID', 'Email', 'Designation', 'Hired', 'Gross Salary', 'Payslips', 'Last Pay'], rows: d.map((r: any) => [r.name, r.department || '-', r.staffId || '-', r.email || '-', r.designation || '-', fmtDate(r.dateHired), fmtNaira(r.grossSalary), r.totalPayslips, fmtDate(r.lastPayDate)]) }) },
    { id: 'payslip-summary', label: 'Payslip Summary', needsDates: true, apiFn: 'getPayslipSummary', icon: Receipt, desc: 'Aggregate payroll totals for selected period' },
    { id: 'payslip-by-item', label: 'Payslip by Item', needsDates: true, apiFn: 'getPayslipByItem', icon: PieChart, desc: 'Earnings & deductions broken down by component' },
  ],
  banking: [
    { id: 'receipts-payments-summary', label: 'Receipts & Payments Summary', needsDates: true, apiFn: 'getReceiptsPaymentsSummary', icon: Banknote, desc: 'Cash inflow vs outflow with net position' },
    { id: 'bank-account-summary', label: 'Bank Account Summary', needsDates: false, apiFn: 'getBankAccountSummary', icon: Landmark, desc: 'All bank accounts with current balances', transform: (d) => ({ headers: ['Account Name', 'Bank', 'Account #', 'Currency', 'Balance'], rows: d.map((r: any) => [r.name, r.bankName || '-', r.accountNumber || '-', r.currency || 'NGN', fmtNaira(r.currentBalance)]) }) },
    { id: 'cash-equivalents', label: 'Cash & Cash Equivalents', needsDates: false, apiFn: 'getCashEquivalents', icon: Target, desc: 'Total liquid assets including bank & deposit accounts' },
  ],
  accounting: [
    { id: 'gl-summary', label: 'General Ledger Summary', needsDates: true, apiFn: 'getGlSummary', icon: BookOpen, desc: 'All accounts with debit/credit activity & net balance', transform: (d, nav) => ({ headers: ['Code', 'Account Name', 'Type', 'Sub Type', 'Total Debits', 'Total Credits', 'Net Balance'], rows: d.map((r: any) => [r.code, r.name, r.type, r.subType || '-', fmtNaira(r.totalDebits), fmtNaira(r.totalCredits), fmtNaira(r.netBalance)]) }) },
    { id: 'gl-transactions', label: 'GL Transactions', needsDates: true, apiFn: 'getGlTransactions', icon: Receipt, desc: 'Journal transaction detail with account drill-down', transform: (d) => ({ headers: ['Date', 'Entry #', 'Description', 'Account', 'Debit', 'Credit', 'Source'], rows: d.map((r: any) => [fmtDate(r.date), r.entryNumber, r.description || '-', `${r.accountCode} - ${r.accountName}`, fmtNaira(r.debitAmount), fmtNaira(r.creditAmount), r.source || '-']) }) },
    { id: 'capital-accounts-summary', label: 'Capital Accounts Summary', needsDates: false, apiFn: 'getCapitalAccountsSummary', icon: PieChart, desc: 'Equity accounts with current balances', transform: (d) => ({ headers: ['Code', 'Account', 'Type', 'Sub Type', 'Balance'], rows: d.map((r: any) => [r.code, r.name, r.type, r.subType || '-', fmtNaira(r.balance)]) }) },
    { id: 'actual-vs-budget', label: 'Actual vs Budget', needsDates: true, apiFn: 'getActualVsBudget', icon: Target, desc: 'Budget performance with variance analysis', transform: (d) => ({ headers: ['Budget', 'Fiscal Year', 'Account', 'Period', 'Budget', 'Actual', 'Variance', 'Var %'], rows: d.map((r: any) => [r.budgetName, r.fiscalYear, `${r.accountCode} - ${r.accountName}`, r.period, fmtNaira(r.budgetAmount), fmtNaira(r.actualAmount), fmtNaira(r.variance), pct(r.variancePct)]) }) },
    { id: 'expense-claims-summary', label: 'Expense Claims Summary', needsDates: true, apiFn: 'getExpenseClaimsSummary', icon: Receipt, desc: 'Expense transactions with vendor & account details', transform: (d) => ({ headers: ['Date', 'Expense #', 'Description', 'Account', 'Amount', 'VAT', 'Vendor'], rows: d.map((r: any) => [fmtDate(r.date), r.expenseNumber || '-', r.description || '-', `${r.accountCode} - ${r.accountName}`, fmtNaira(r.amount), fmtNaira(r.taxAmount), r.vendorName || '-']) }) },
  ],
};

const SECTION_IDS = ['customers', 'suppliers', 'tax', 'inventory', 'fixed-assets', 'payroll', 'banking', 'accounting'];

function useDateRange() {
  const now = new Date();
  const [startDate, setStartDate] = useState(() => `${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => now.toISOString().split('T')[0]);
  return { startDate, endDate, setStartDate, setEndDate };
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition-all duration-200 group">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 font-mono ${accent || 'text-slate-900'} group-hover:scale-105 transition-transform origin-left`}>{value}</p>
    </div>
  );
}

function getSourceLink(source: string, sourceId: string): { path: string; label: string } | null {
  if (!sourceId) return null;
  switch (source?.toLowerCase()) {
    case 'invoice': return { path: `/sales/invoices/${sourceId}`, label: 'View Invoice' };
    case 'bill': return { path: `/purchases/bills/${sourceId}`, label: 'View Bill' };
    case 'payment':
    case 'payment_received': return { path: `/banking`, label: 'View Payment' };
    case 'payment_made': return { path: `/purchases/payments`, label: 'View Payment' };
    case 'payroll': return { path: `/payroll`, label: 'View Payroll' };
    case 'journal':
    case 'manual_journal': return { path: `/accountant/manual-journals`, label: 'View Journal' };
    case 'expense': return { path: `/purchases/expenses`, label: 'View Expense' };
    default: return null;
  }
}

export function CustomReportsPage() {
  const navigate = useNavigate();
  const { startDate, endDate, setStartDate, setEndDate } = useDateRange();
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['customers', 'suppliers', 'tax']));
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const fetchReport = useCallback(async (reportId: string) => {
    setLoading(true);
    setError(null);
    setActiveReport(reportId);
    setData(null);
    try {
      const sectionId = SECTION_IDS.find(sid => (REPORTS[sid] || []).some(r => r.id === reportId));
      if (!sectionId) return;
      const reportDef = REPORTS[sectionId].find(r => r.id === reportId);
      if (!reportDef) return;
      const fn = customReportsApi[reportDef.apiFn] as any;
      const params = reportDef.needsDates ? { startDate, endDate } : {};
      const res = await fn(params);
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const handleRowClick = (source: string | undefined, sourceId: string | undefined) => {
    const link = getSourceLink(source || '', sourceId || '');
    if (link) navigate(link.path);
  };

  const renderTable = useCallback((reportId: string) => {
    if (loading) return <div className="flex items-center justify-center py-24"><div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /><span className="text-sm text-slate-400">Loading report data...</span></div></div>;
    if (error) return <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm"><span className="w-2 h-2 rounded-full bg-red-500" /> {error}</div>;
    if (!data) return (
      <div className="text-center py-20 text-slate-400">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-sm font-medium">Select a report to view data</p>
        <p className="text-xs mt-1 text-slate-400">Choose from the categorized sections below</p>
      </div>
    );

    const sectionId = SECTION_IDS.find(sid => (REPORTS[sid] || []).some(r => r.id === reportId));
    if (!sectionId) return null;
    const reportDef = REPORTS[sectionId].find(r => r.id === reportId);
    if (!reportDef) return null;

    const isSubReport = reportId === 'customer-statements' || reportId === 'supplier-statements';

    if (!reportDef.transform && !isSubReport) {
      const d = data as any;
      if (reportId === 'tax-summary') return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryCard label="Output VAT (Sales)" value={fmtNaira(d.totalOutputVat)} accent="text-emerald-600" />
          <SummaryCard label="Input VAT (Purchases)" value={fmtNaira(d.totalInputVat)} accent="text-blue-600" />
          <SummaryCard label="Net VAT" value={fmtNaira(d.netVat)} accent="text-indigo-600" />
          <SummaryCard label="WHT Deducted" value={fmtNaira(d.totalWhtDeducted)} accent="text-amber-600" />
          <SummaryCard label="WHT Payable" value={fmtNaira(d.totalWhtPayable)} accent="text-rose-600" />
          <SummaryCard label="PAYE Collected" value={fmtNaira(d.totalPayeCollected)} accent="text-cyan-600" />
        </div>
      );
      if (reportId === 'receipts-payments-summary') return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryCard label="Total Receipts" value={fmtNaira(d.totalReceipts)} accent="text-emerald-600" />
          <SummaryCard label="Total Payments" value={fmtNaira(d.totalPayments)} accent="text-rose-600" />
          <SummaryCard label="Net Cash Flow" value={fmtNaira(d.netCashFlow)} accent={d.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
          <SummaryCard label="Receipt Count" value={String(d.receiptCount)} />
          <SummaryCard label="Payment Count" value={String(d.paymentCount)} />
        </div>
      );
      if (reportId === 'cash-equivalents') return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryCard label="Bank Balances" value={fmtNaira(d.bankAccountBalances)} accent="text-blue-600" />
          <SummaryCard label="Deposit Balances" value={fmtNaira(d.depositAccountBalances)} accent="text-purple-600" />
          <SummaryCard label="Total Cash Equiv." value={fmtNaira(d.totalCashEquivalents)} accent="text-emerald-600" />
          <SummaryCard label="As of Date" value={fmtDate(d.asOfDate)} />
        </div>
      );
      if (reportId === 'payslip-summary') return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryCard label="Total Gross Pay" value={fmtNaira(d.totalGrossPay)} accent="text-blue-600" />
          <SummaryCard label="Total Deductions" value={fmtNaira(d.totalDeductions)} accent="text-rose-600" />
          <SummaryCard label="Total Net Pay" value={fmtNaira(d.totalNetPay)} accent="text-emerald-600" />
          <SummaryCard label="Payslip Count" value={String(d.payslipCount)} />
          <SummaryCard label="Run Count" value={String(d.runCount)} />
        </div>
      );
      if (reportId === 'payslip-by-item' && d) return (
        <div className="space-y-8">
          <div>
            <h4 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /> Earnings</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <SummaryCard label="Basic" value={fmtNaira(d.earnings?.basic)} />
              <SummaryCard label="Housing" value={fmtNaira(d.earnings?.housing)} />
              <SummaryCard label="Transport" value={fmtNaira(d.earnings?.transport)} />
              <SummaryCard label="Other Allowances" value={fmtNaira(d.earnings?.otherAllowances)} />
              <SummaryCard label="Total Gross" value={fmtNaira(d.earnings?.totalGross)} accent="text-blue-600" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500" /> Deductions</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <SummaryCard label="PAYE" value={fmtNaira(d.deductions?.paye)} />
              <SummaryCard label="Pension (Employee)" value={fmtNaira(d.deductions?.pensionEmployee)} />
              <SummaryCard label="Pension (Employer)" value={fmtNaira(d.deductions?.pensionEmployer)} />
              <SummaryCard label="NHF" value={fmtNaira(d.deductions?.nhf)} />
              <SummaryCard label="NHIS" value={fmtNaira(d.deductions?.nhis)} />
              <SummaryCard label="Other Deductions" value={fmtNaira(d.deductions?.otherDeductions)} />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Net Pay</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SummaryCard label="Total Net Pay" value={fmtNaira(d.netPay)} accent="text-emerald-600" />
            </div>
          </div>
        </div>
      );
    }

    if (isSubReport) {
      const items = Array.isArray(data) ? data : [];
      return (
        <div className="space-y-6">
          {items.map((item: any, i: number) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300">
              <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-400">{item.email || item.phone || '-'}</p>
                </div>
                <span className="text-xs text-slate-400 font-medium">{(item.invoices || item.bills || []).length} transactions</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5 font-semibold">#</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Date</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Due Date</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Total</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Paid</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Balance</th>
                      <th className="text-center px-4 py-2.5 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {(item.invoices || item.bills || []).map((inv: any, j: number) => {
                      const link = getSourceLink(inv.invoiceNumber ? 'invoice' : 'bill', inv.id);
                      return (
                        <tr key={j} className="border-t border-slate-100 hover:bg-indigo-50/50 transition-colors cursor-pointer" onClick={() => link && navigate(link.path)}>
                          <td className="px-4 py-2.5 font-mono text-xs text-indigo-600 font-medium">{inv.invoiceNumber || inv.billNumber || '-'}</td>
                          <td className="px-4 py-2.5 text-slate-700">{fmtDate(inv.date)}</td>
                          <td className="px-4 py-2.5 text-slate-600">{fmtDate(inv.dueDate)}</td>
                          <td className="px-4 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            inv.status === 'paid' || inv.status === 'settled' ? 'bg-emerald-100 text-emerald-700' :
                            inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>{inv.status}</span></td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-800">{fmtNaira(inv.total)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-emerald-600">{fmtNaira(inv.amountPaid)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-800">{fmtNaira(inv.balanceDue)}</td>
                          <td className="px-4 py-2.5 text-center"><ExternalLink className="w-3.5 h-3.5 text-slate-300 inline-block" /></td>
                        </tr>
                      );
                    })}
                    {(item.invoices?.length === 0 && item.bills?.length === 0) && (
                      <tr><td colSpan={8} className="text-center py-8 text-slate-400 text-sm">No transactions found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm text-sm">No customer/vendor data found</div>}
        </div>
      );
    }

    if (reportDef.transform) {
      const { headers, rows } = reportDef.transform(data, navigate);
      const totalIdx = headers.findIndex(h => /total|balance|amount|value|debits|credits|variance|price|salary/i.test(h));
      const hasTotalRow = totalIdx >= 0;
      return (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-900 to-slate-800 text-white text-xs uppercase tracking-wider">
                {headers.map((h, i) => (
                  <th key={i} className={`px-4 py-3 font-semibold ${i === 0 ? 'text-left' : 'text-right'} ${i === 0 ? 'rounded-tl-xl' : ''} ${i === headers.length - 1 ? 'rounded-tr-xl' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={`border-t border-slate-100 transition-all duration-150 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-indigo-50/70 hover:scale-[1.002] cursor-pointer`}
                  onClick={() => handleRowClick(undefined, undefined)}>
                  {row.map((cell: any, j: number) => (
                    <td key={j} className={`px-4 py-3 ${j === 0 ? 'text-left font-medium text-slate-900' : 'text-right font-mono text-slate-700'} ${j === 0 ? '' : 'tabular-nums'}`}>{cell}</td>
                  ))}
                </tr>
              ))}
              {hasTotalRow && rows.length > 0 && (
                <tr className="bg-slate-800 text-white font-semibold">
                  {headers.map((h, i) => {
                    if (i === 0) return <td key={i} className="px-4 py-3 text-left text-xs uppercase tracking-wider">Total</td>;
                    if (i === totalIdx) {
                      const sum = rows.reduce((acc: number, r: any) => {
                        const v = typeof r[i] === 'string' && /^₦/.test(r[i]) ? parseFloat(r[i].replace(/[₦,]/g, '')) * 100 : 0;
                        return acc + v;
                      }, 0);
                      return <td key={i} className="px-4 py-3 text-right font-mono">{fmtNaira(sum)}</td>;
                    }
                    return <td key={i} className="px-4 py-3 text-right">-</td>;
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }

    return <div className="text-center py-8 text-slate-400 text-sm">Data loaded ({Array.isArray(data) ? data.length : 'object'} items)</div>;
  }, [data, loading, error, navigate]);

  const handleExportCsv = () => {
    if (!data || !activeReport) return;
    const sectionId = SECTION_IDS.find(sid => (REPORTS[sid] || []).some(r => r.id === activeReport));
    if (!sectionId) return;
    const reportDef = REPORTS[sectionId].find(r => r.id === activeReport);
    if (!reportDef || !reportDef.transform) return;
    const { headers, rows } = reportDef.transform(data);
    if (rows.length === 0) return;
    exportToCsv(`custom_report_${activeReport}_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handlePrintPdf = () => {
    if (!data || !activeReport) return;
    const sectionId = SECTION_IDS.find(sid => (REPORTS[sid] || []).some(r => r.id === activeReport));
    if (!sectionId) return;
    const reportDef = REPORTS[sectionId].find(r => r.id === activeReport);
    if (!reportDef || !reportDef.transform) return;
    const { headers, rows } = reportDef.transform(data);
    if (rows.length === 0) return;
    const sectionLabel = SECTIONS.find(s => s.id === sectionId)?.label || '';
    const reportLabel = reportDef.label;
    const subtitle = `${sectionLabel} — ${reportLabel}`;
    const th = headers.map(h => `<th class="r">${h}</th>`).join('');
    const tr = rows.map((row: any[]) => `<tr>${row.map((c, i) => `<td class="${i === 0 ? '' : 'r'}">${c}</td>`).join('')}</tr>`).join('');
    const thead = rows.length > 0 ? `<tr class="bg-slate-900 text-white font-semibold"><td class="r" colspan="${headers.length}"><strong>TOTAL</strong></td></tr>` : '';
    const tableHtml = `<table>${th ? `<thead><tr>${th}</tr></thead>` : ''}<tbody>${tr}</tbody>${thead ? `<tfoot>${thead}</tfoot>` : ''}</table>`;
    printWindow(reportLabel, tableHtml, subtitle);
  };

  const filteredSections = SECTIONS.filter(s => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const reports = REPORTS[s.id] || [];
    return s.label.toLowerCase().includes(q) || reports.some(r => r.label.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q));
  });

  const allReports = SECTION_IDS.flatMap(sid => REPORTS[sid] || []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Custom Reports</h1>
            <p className="text-sm text-slate-400">40+ categorized reports across all modules</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search reports by name or description..." className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm" />
      </div>

      {/* Quick filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {allReports.map(r => {
          const sectionId2 = SECTION_IDS.find(sid => (REPORTS[sid] || []).some(x => x.id === r.id));
          const section2 = SECTIONS.find(s => s.id === sectionId2);
          const isActive = activeReport === r.id;
          const RIcon2 = r.icon;
          let btnClasses = 'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-200 ';
          if (isActive) {
            if (section2?.id === 'customers') btnClasses += 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-transparent shadow-md shadow-blue-200 scale-105';
            else if (section2?.id === 'suppliers') btnClasses += 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-transparent shadow-md shadow-amber-200 scale-105';
            else if (section2?.id === 'tax') btnClasses += 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-transparent shadow-md shadow-emerald-200 scale-105';
            else if (section2?.id === 'inventory') btnClasses += 'bg-gradient-to-r from-purple-500 to-purple-600 text-white border-transparent shadow-md shadow-purple-200 scale-105';
            else if (section2?.id === 'fixed-assets') btnClasses += 'bg-gradient-to-r from-rose-500 to-rose-600 text-white border-transparent shadow-md shadow-rose-200 scale-105';
            else if (section2?.id === 'payroll') btnClasses += 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-transparent shadow-md shadow-cyan-200 scale-105';
            else if (section2?.id === 'banking') btnClasses += 'bg-gradient-to-r from-violet-500 to-violet-600 text-white border-transparent shadow-md shadow-violet-200 scale-105';
            else btnClasses += 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-transparent shadow-md shadow-indigo-200 scale-105';
          } else {
            btnClasses += 'bg-white text-slate-600 border-slate-200 hover:-translate-y-0.5 hover:shadow-md';
            if (section2?.id === 'customers') btnClasses += ' hover:border-blue-300 hover:text-blue-600 hover:shadow-blue-100';
            else if (section2?.id === 'suppliers') btnClasses += ' hover:border-amber-300 hover:text-amber-600 hover:shadow-amber-100';
            else if (section2?.id === 'tax') btnClasses += ' hover:border-emerald-300 hover:text-emerald-600 hover:shadow-emerald-100';
            else if (section2?.id === 'inventory') btnClasses += ' hover:border-purple-300 hover:text-purple-600 hover:shadow-purple-100';
            else if (section2?.id === 'fixed-assets') btnClasses += ' hover:border-rose-300 hover:text-rose-600 hover:shadow-rose-100';
            else if (section2?.id === 'payroll') btnClasses += ' hover:border-cyan-300 hover:text-cyan-600 hover:shadow-cyan-100';
            else if (section2?.id === 'banking') btnClasses += ' hover:border-violet-300 hover:text-violet-600 hover:shadow-violet-100';
            else btnClasses += ' hover:border-indigo-300 hover:text-indigo-600 hover:shadow-indigo-100';
          }
          return (
            <button key={r.id} onClick={() => fetchReport(r.id)} className={btnClasses}>
              <RIcon2 className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Date range + export */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white" />
          <span className="text-slate-300">—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white" />
        </div>
        {activeReport && data && (
          <div className="flex items-center gap-2">
            <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 border border-transparent rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-sm shadow-indigo-200">
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        )}
      </div>

      {/* Active report table */}
      <div ref={tableRef} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 transition-all duration-300">
        {activeReport ? (
          <>
            {(() => {
              const sectionId = SECTION_IDS.find(sid => (REPORTS[sid] || []).some(r => r.id === activeReport));
              const reportDef = sectionId ? REPORTS[sectionId].find(r => r.id === activeReport) : null;
              const section = SECTIONS.find(s => s.id === sectionId);
              const Icon = reportDef?.icon || BarChart3;
              return reportDef ? (
                <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${section?.bg || 'bg-indigo-50'} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${section?.text || 'text-indigo-600'}`} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{reportDef.label}</h2>
                      <p className="text-xs text-slate-400">{reportDef.desc}</p>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
            {renderTable(activeReport)}
          </>
        ) : (
          <div className="text-center py-20 text-slate-400">
            <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center border border-indigo-100">
              <BarChart3 className="w-9 h-9 text-indigo-400" />
            </div>
            <p className="text-base font-semibold text-slate-600">Select a Report</p>
            <p className="text-sm mt-1">Choose from the categorized sections below or use the quick filter pills above</p>
          </div>
        )}
      </div>

      {/* Categorized sections grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredSections.map(section => {
          const Icon = section.icon;
          const reports = REPORTS[section.id] || [];
          const isOpen = expandedSections.has(section.id);
          return (
            <div key={section.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 group">
              <button onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl ${section.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-5 h-5 ${section.text}`} />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-slate-900 text-sm">{section.label}</span>
                    <p className="text-[11px] text-slate-400 leading-tight">{section.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{reports.length}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {isOpen && (
                <div className="px-5 pb-4 space-y-1">
                  {reports.map(r => {
                    const RIcon = r.icon;
                    return (
                      <button key={r.id} onClick={() => fetchReport(r.id)}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                          activeReport === r.id ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}>
                        <RIcon className={`w-4 h-4 ${activeReport === r.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                        <div className="flex items-center justify-between flex-1">
                          <span>{r.label}</span>
                          <div className="flex items-center gap-2">
                            {r.needsDates && <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">Date Range</span>}
                            {activeReport === r.id && <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
