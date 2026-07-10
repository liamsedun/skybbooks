import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart3, TrendingUp, Users, Building2, Package, Wrench, DollarSign, Landmark, BookOpen, FileText, ChevronDown, Download, Loader2, Search, Calendar } from 'lucide-react';
import { customReportsApi } from '../../lib/api';
import { exportToCsv } from '../../lib/csvTemplates';
import { printWindow } from '../../lib/api';

const fmtNaira = (k: number) => `₦${(k / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | Date | null | undefined) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const pct = (v: number) => `${v.toFixed(1)}%`;

const SECTIONS = [
  { id: 'customers', label: 'Customer Reports', icon: Users },
  { id: 'suppliers', label: 'Supplier Reports', icon: Building2 },
  { id: 'tax', label: 'Tax Reports', icon: TrendingUp },
  { id: 'inventory', label: 'Inventory Reports', icon: Package },
  { id: 'fixed-assets', label: 'Fixed Assets Reports', icon: Wrench },
  { id: 'payroll', label: 'Payroll Reports', icon: DollarSign },
  { id: 'banking', label: 'Banking Reports', icon: Landmark },
  { id: 'accounting', label: 'GL & Accounting Reports', icon: BookOpen },
];

const REPORTS: Record<string, { id: string; label: string; needsDates: boolean; apiFn: keyof typeof customReportsApi; transform?: (d: any) => { headers: string[]; rows: any[][] }; }[]> = {
  customers: [
    { id: 'customer-summary', label: 'Customer Summary', needsDates: true, apiFn: 'getCustomerSummary', transform: (d) => ({ headers: ['Name', 'Email', 'Phone', 'Total Invoiced', 'Total Paid', 'Balance Due', 'Last Invoice', 'Invoice Count'], rows: d.map((r: any) => [r.name, r.email || '-', r.phone || '-', fmtNaira(r.totalInvoiced), fmtNaira(r.totalPaid), fmtNaira(r.balanceDue), fmtDate(r.lastInvoiceDate), r.invoiceCount]) }) },
    { id: 'customer-statements', label: 'Customer Statements', needsDates: true, apiFn: 'getCustomerStatements' },
    { id: 'sales-by-customer', label: 'Sales by Customer', needsDates: true, apiFn: 'getSalesByCustomer', transform: (d) => ({ headers: ['Customer', 'Email', 'Total Amount', 'Invoice Count'], rows: d.map((r: any) => [r.customerName, r.customerEmail || '-', fmtNaira(r.totalAmount), r.invoiceCount]) }) },
    { id: 'taxable-sales-per-customer', label: 'Taxable Sales per Customer', needsDates: true, apiFn: 'getTaxableSalesPerCustomer', transform: (d) => ({ headers: ['Customer', 'Email', 'Taxable Amount', 'Total Invoice Amount', 'Invoice Count'], rows: d.map((r: any) => [r.customerName, r.customerEmail || '-', fmtNaira(r.totalTaxableAmount), fmtNaira(r.totalInvoiceAmount), r.invoiceCount]) }) },
  ],
  suppliers: [
    { id: 'supplier-summary', label: 'Supplier Summary', needsDates: true, apiFn: 'getSupplierSummary', transform: (d) => ({ headers: ['Name', 'Email', 'Phone', 'Total Billed', 'Total Paid', 'Balance Due', 'Last Bill', 'Bill Count'], rows: d.map((r: any) => [r.name, r.email || '-', r.phone || '-', fmtNaira(r.totalBilled), fmtNaira(r.totalPaid), fmtNaira(r.balanceDue), fmtDate(r.lastBillDate), r.billCount]) }) },
    { id: 'supplier-statements', label: 'Supplier Statements', needsDates: true, apiFn: 'getSupplierStatements' },
    { id: 'taxable-purchases-per-supplier', label: 'Taxable Purchases per Supplier', needsDates: true, apiFn: 'getTaxablePurchasesPerSupplier', transform: (d) => ({ headers: ['Supplier', 'Email', 'Taxable Amount', 'Total Bill Amount', 'Bill Count'], rows: d.map((r: any) => [r.vendorName, r.vendorEmail || '-', fmtNaira(r.totalTaxableAmount), fmtNaira(r.totalBillAmount), r.billCount]) }) },
  ],
  tax: [
    { id: 'tax-summary', label: 'Tax Summary', needsDates: true, apiFn: 'getTaxSummary' },
    { id: 'tax-transactions', label: 'Tax Transactions', needsDates: true, apiFn: 'getTaxTransactions', transform: (d) => ({ headers: ['Date', 'Entry #', 'Description', 'Account', 'Role', 'Debit', 'Credit'], rows: d.map((r: any) => [fmtDate(r.date), r.entryNumber, r.description || '-', r.accountName, r.accountRole || '-', fmtNaira(r.debitAmount), fmtNaira(r.creditAmount)]) }) },
  ],
  inventory: [
    { id: 'inventory-summary', label: 'Inventory Summary', needsDates: false, apiFn: 'getInventorySummary', transform: (d) => ({ headers: ['Name', 'SKU', 'Category', 'Quantity', 'Unit Price', 'Total Value'], rows: d.map((r: any) => [r.name, r.sku || '-', r.category || '-', r.quantity, fmtNaira(r.unitPrice), fmtNaira(r.totalValue)]) }) },
    { id: 'sales-by-item', label: 'Sales by Item', needsDates: true, apiFn: 'getSalesByItem', transform: (d) => ({ headers: ['Item', 'SKU', 'Total Quantity', 'Total Amount', 'Line Count'], rows: d.map((r: any) => [r.itemName || '-', r.itemSku || '-', r.totalQuantity, fmtNaira(r.totalAmount), r.lineCount]) }) },
  ],
  'fixed-assets': [
    { id: 'fixed-asset-summary', label: 'Fixed Asset Summary', needsDates: false, apiFn: 'getFixedAssetSummary', transform: (d) => ({ headers: ['Name', 'Category', 'Purchase Date', 'Purchase Price', 'Accum. Depr.', 'Net Book Value', 'Status'], rows: d.map((r: any) => [r.name, r.category || '-', fmtDate(r.purchaseDate), fmtNaira(r.purchasePrice), fmtNaira(r.accumulatedDepreciation), fmtNaira(r.netBookValue), r.status || '-']) }) },
    { id: 'fixed-asset-depreciation', label: 'Depreciation Schedule', needsDates: false, apiFn: 'getFixedAssetDepreciation', transform: (d) => ({ headers: ['Name', 'Category', 'Purchase Price', 'Residual Value', 'Accum. Depr.', 'Net Book Value', 'Method', 'Life (Months)', 'Depr./Period', 'Remaining Months'], rows: d.map((r: any) => [r.name, r.category || '-', fmtNaira(r.purchaseCost), fmtNaira(r.residualValue), fmtNaira(r.accumulatedDepreciation), fmtNaira(r.netBookValue), r.depreciationMethod || '-', r.usefulLifeMonths ?? '-', fmtNaira(r.depreciationPerPeriod), r.remainingLifeMonths]) }) },
  ],
  payroll: [
    { id: 'employee-summary', label: 'Employee Summary', needsDates: false, apiFn: 'getEmployeeSummary', transform: (d) => ({ headers: ['Name', 'Department', 'Staff ID', 'Email', 'Designation', 'Date Hired', 'Gross Salary', 'Total Payslips', 'Last Pay Date'], rows: d.map((r: any) => [r.name, r.department || '-', r.staffId || '-', r.email || '-', r.designation || '-', fmtDate(r.dateHired), fmtNaira(r.grossSalary), r.totalPayslips, fmtDate(r.lastPayDate)]) }) },
    { id: 'payslip-summary', label: 'Payslip Summary', needsDates: true, apiFn: 'getPayslipSummary' },
    { id: 'payslip-by-item', label: 'Payslip by Item', needsDates: true, apiFn: 'getPayslipByItem' },
  ],
  banking: [
    { id: 'receipts-payments-summary', label: 'Receipts & Payments Summary', needsDates: true, apiFn: 'getReceiptsPaymentsSummary' },
    { id: 'bank-account-summary', label: 'Bank Account Summary', needsDates: false, apiFn: 'getBankAccountSummary', transform: (d) => ({ headers: ['Name', 'Bank', 'Account #', 'Currency', 'Current Balance'], rows: d.map((r: any) => [r.name, r.bankName || '-', r.accountNumber || '-', r.currency || 'NGN', fmtNaira(r.currentBalance)]) }) },
    { id: 'cash-equivalents', label: 'Cash & Cash Equivalents', needsDates: false, apiFn: 'getCashEquivalents' },
  ],
  accounting: [
    { id: 'gl-summary', label: 'General Ledger Summary', needsDates: true, apiFn: 'getGlSummary', transform: (d) => ({ headers: ['Code', 'Name', 'Type', 'Sub Type', 'Total Debits', 'Total Credits', 'Net Balance'], rows: d.map((r: any) => [r.code, r.name, r.type, r.subType || '-', fmtNaira(r.totalDebits), fmtNaira(r.totalCredits), fmtNaira(r.netBalance)]) }) },
    { id: 'gl-transactions', label: 'GL Transactions', needsDates: true, apiFn: 'getGlTransactions', transform: (d) => ({ headers: ['Date', 'Entry #', 'Description', 'Account', 'Debit', 'Credit', 'Source'], rows: d.map((r: any) => [fmtDate(r.date), r.entryNumber, r.description || '-', `${r.accountCode} - ${r.accountName}`, fmtNaira(r.debitAmount), fmtNaira(r.creditAmount), r.source || '-']) }) },
    { id: 'capital-accounts-summary', label: 'Capital Accounts Summary', needsDates: false, apiFn: 'getCapitalAccountsSummary', transform: (d) => ({ headers: ['Code', 'Name', 'Type', 'Sub Type', 'Balance'], rows: d.map((r: any) => [r.code, r.name, r.type, r.subType || '-', fmtNaira(r.balance)]) }) },
    { id: 'actual-vs-budget', label: 'Actual vs Budget', needsDates: true, apiFn: 'getActualVsBudget', transform: (d) => ({ headers: ['Budget', 'Fiscal Year', 'Account', 'Period', 'Budget Amount', 'Actual Amount', 'Variance', 'Variance %'], rows: d.map((r: any) => [r.budgetName, r.fiscalYear, `${r.accountCode} - ${r.accountName}`, r.period, fmtNaira(r.budgetAmount), fmtNaira(r.actualAmount), fmtNaira(r.variance), pct(r.variancePct)]) }) },
    { id: 'expense-claims-summary', label: 'Expense Claims Summary', needsDates: true, apiFn: 'getExpenseClaimsSummary', transform: (d) => ({ headers: ['Date', 'Expense #', 'Description', 'Account', 'Amount', 'VAT', 'Vendor'], rows: d.map((r: any) => [fmtDate(r.date), r.expenseNumber || '-', r.description || '-', `${r.accountCode} - ${r.accountName}`, fmtNaira(r.amount), fmtNaira(r.taxAmount), r.vendorName || '-']) }) },
  ],
};

function useDateRange() {
  const now = new Date();
  const [startDate, setStartDate] = useState(() => `${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => now.toISOString().split('T')[0]);
  return { startDate, endDate, setStartDate, setEndDate };
}

function ReportHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1 font-mono">{value}</p>
    </div>
  );
}

export function CustomReportsPage() {
  const { startDate, endDate, setStartDate, setEndDate } = useDateRange();
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
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
      const sectionId = Object.entries(REPORTS).find(([, reports]) => reports.some(r => r.id === reportId))?.[0];
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

  const renderTable = useCallback((reportId: string) => {
    if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
    if (error) return <div className="text-center py-12 text-red-500 text-sm">{error}</div>;
    if (!data) return <div className="text-center py-12 text-slate-400 text-sm">Click a report to view data</div>;

    const sectionId = Object.entries(REPORTS).find(([, reports]) => reports.some(r => r.id === reportId))?.[0];
    if (!sectionId) return null;
    const reportDef = REPORTS[sectionId].find(r => r.id === reportId);
    if (!reportDef) return null;

    const isDataReport = reportId === 'expense-claims-summary' || reportId === 'fixed-asset-summary' || reportId === 'fixed-asset-depreciation' || reportId === 'inventory-summary' || reportId === 'employee-summary' || reportId === 'customer-summary' || reportId === 'supplier-summary' || reportId === 'sales-by-customer' || reportId === 'sales-by-item' || reportId === 'taxable-sales-per-customer' || reportId === 'taxable-purchases-per-supplier' || reportId === 'gl-summary' || reportId === 'gl-transactions' || reportId === 'tax-transactions' || reportId === 'capital-accounts-summary' || reportId === 'actual-vs-budget' || reportId === 'bank-account-summary';

    const isSubReport = reportId === 'customer-statements' || reportId === 'supplier-statements';

    if (reportId === 'tax-summary') {
      const d = data as any;
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryCard label="Output VAT (Sales)" value={fmtNaira(d.totalOutputVat)} />
          <SummaryCard label="Input VAT (Purchases)" value={fmtNaira(d.totalInputVat)} />
          <SummaryCard label="Net VAT" value={fmtNaira(d.netVat)} />
          <SummaryCard label="WHT Deducted" value={fmtNaira(d.totalWhtDeducted)} />
          <SummaryCard label="WHT Payable" value={fmtNaira(d.totalWhtPayable)} />
          <SummaryCard label="PAYE Collected" value={fmtNaira(d.totalPayeCollected)} />
        </div>
      );
    }

    if (reportId === 'receipts-payments-summary') {
      const d = data as any;
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryCard label="Total Receipts" value={fmtNaira(d.totalReceipts)} />
          <SummaryCard label="Total Payments" value={fmtNaira(d.totalPayments)} />
          <SummaryCard label="Net Cash Flow" value={fmtNaira(d.netCashFlow)} />
          <SummaryCard label="Receipt Count" value={String(d.receiptCount)} />
          <SummaryCard label="Payment Count" value={String(d.paymentCount)} />
        </div>
      );
    }

    if (reportId === 'cash-equivalents') {
      const d = data as any;
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryCard label="Bank Account Balances" value={fmtNaira(d.bankAccountBalances)} />
          <SummaryCard label="Deposit Account Balances" value={fmtNaira(d.depositAccountBalances)} />
          <SummaryCard label="Total Cash Equivalents" value={fmtNaira(d.totalCashEquivalents)} />
          <SummaryCard label="As of Date" value={fmtDate(d.asOfDate)} />
        </div>
      );
    }

    if (reportId === 'payslip-summary') {
      const d = data as any;
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryCard label="Total Gross Pay" value={fmtNaira(d.totalGrossPay)} />
          <SummaryCard label="Total Deductions" value={fmtNaira(d.totalDeductions)} />
          <SummaryCard label="Total Net Pay" value={fmtNaira(d.totalNetPay)} />
          <SummaryCard label="Payslip Count" value={String(d.payslipCount)} />
          <SummaryCard label="Run Count" value={String(d.runCount)} />
        </div>
      );
    }

    if (reportId === 'payslip-by-item') {
      const d = data as any;
      return (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Earnings</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <SummaryCard label="Basic" value={fmtNaira(d.earnings?.basic)} />
              <SummaryCard label="Housing" value={fmtNaira(d.earnings?.housing)} />
              <SummaryCard label="Transport" value={fmtNaira(d.earnings?.transport)} />
              <SummaryCard label="Other Allowances" value={fmtNaira(d.earnings?.otherAllowances)} />
              <SummaryCard label="Total Gross" value={fmtNaira(d.earnings?.totalGross)} />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Deductions</h4>
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
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Net Pay</h4>
            <SummaryCard label="Total Net Pay" value={fmtNaira(d.netPay)} />
          </div>
        </div>
      );
    }

    if (isSubReport) {
      const items = Array.isArray(data) ? data : [];
      return (
        <div className="space-y-6">
          {items.map((item: any, i: number) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">{item.email || item.phone || '-'}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5 font-semibold">#</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Date</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Due Date</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Total</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Paid</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(item.invoices || item.bills || []).map((inv: any, j: number) => (
                      <tr key={j} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs">{inv.invoiceNumber || inv.billNumber || '-'}</td>
                        <td className="px-4 py-2.5">{fmtDate(inv.date)}</td>
                        <td className="px-4 py-2.5">{fmtDate(inv.dueDate)}</td>
                        <td className="px-4 py-2.5"><span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">{inv.status}</span></td>
                        <td className="px-4 py-2.5 text-right font-mono">{fmtNaira(inv.total)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{fmtNaira(inv.amountPaid)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{fmtNaira(inv.balanceDue)}</td>
                      </tr>
                    ))}
                    {(item.invoices?.length === 0 && item.bills?.length === 0) && (
                      <tr><td colSpan={7} className="text-center py-8 text-slate-400 text-sm">No transactions found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No data</div>}
        </div>
      );
    }

    if (isDataReport && reportDef.transform) {
      const { headers, rows } = reportDef.transform(data);
      const totalIdx = headers.findIndex(h => h.startsWith('Total ') || h === 'Balance' || h === 'Net Balance' || h === 'Amount' || h === 'Total Invoiced' || h === 'Total Paid' || h === 'Balance Due' || h === 'Total Billed' || h === 'Total Amount' || h === 'Total Value' || h === 'Total VAT' || h === 'VAT' || h === 'Total Debits' || h === 'Total Credits' || h === 'Budget Amount' || h === 'Actual Amount' || h === 'Variance' || h === 'Price' || h === 'Unit Price' || h === 'Purchase Price' || h === 'Accum. Depr.' || h === 'Net Book Value' || h === 'Depr./Period' || h === 'Current Balance' || h === 'Gross Salary' || h === 'Line Count' || h === 'Taxable Amount' || h === 'Total Invoice Amount' || h === 'Total Bill Amount');

      const hasTotalRow = totalIdx >= 0;
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                {headers.map((h, i) => (
                  <th key={i} className={`px-4 py-2.5 font-semibold ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  {row.map((cell: any, j: number) => (
                    <td key={j} className={`px-4 py-2.5 ${j === 0 ? 'text-left font-medium text-slate-900' : 'text-right font-mono text-slate-700'}`}>{cell}</td>
                  ))}
                </tr>
              ))}
              {hasTotalRow && rows.length > 0 && (
                <tr className="bg-slate-900 text-white font-semibold">
                  {headers.map((h, i) => {
                    if (i === 0) return <td key={i} className="px-4 py-3 text-left text-xs uppercase tracking-wider">Total</td>;
                    if (i === totalIdx) {
                      const sum = rows.reduce((acc: number, r: any) => {
                        const v = typeof r[i] === 'string' && r[i].startsWith('₦') ? parseFloat(r[i].replace(/[₦,]/g, '')) * 100 : 0;
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
  }, [data, loading, error]);

  const handleExportCsv = () => {
    if (!data || !activeReport) return;
    const sectionId = Object.entries(REPORTS).find(([, reports]) => reports.some(r => r.id === activeReport))?.[0];
    if (!sectionId) return;
    const reportDef = REPORTS[sectionId].find(r => r.id === activeReport);
    if (!reportDef || !reportDef.transform) return;
    const { headers, rows } = reportDef.transform(data);
    if (rows.length === 0) return;
    exportToCsv(`custom_report_${activeReport}_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handlePrintPdf = () => {
    if (!data || !activeReport) return;
    const sectionId = Object.entries(REPORTS).find(([, reports]) => reports.some(r => r.id === activeReport))?.[0];
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
    return s.label.toLowerCase().includes(q) || reports.some(r => r.label.toLowerCase().includes(q));
  });

  const allReports = Object.values(REPORTS).flat();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Custom Reports</h1>
            <p className="text-sm text-slate-500">40+ categorized reports across all modules</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search reports..." className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
      </div>

      <div className="flex gap-2.5 flex-wrap">
        {allReports.map(r => (
          <button key={r.id} onClick={() => fetchReport(r.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 ${
              activeReport === r.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
        </div>
        {activeReport && data && (
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all duration-200">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all duration-200">
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        )}
      </div>

      <div ref={tableRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        {activeReport ? (
          <>
            {(() => {
              const sectionId = Object.entries(REPORTS).find(([, reports]) => reports.some(r => r.id === activeReport))?.[0];
              const reportDef = sectionId ? REPORTS[sectionId].find(r => r.id === activeReport) : null;
              return reportDef ? <ReportHeader title={reportDef.label} subtitle={`${SECTIONS.find(s => s.id === sectionId)?.label || ''}`} /> : null;
            })()}
            {renderTable(activeReport)}
          </>
        ) : (
          <div className="text-center py-16 text-slate-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">Select a report to view data</p>
            <p className="text-xs mt-1">Choose from the categorized sections below</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSections.map(section => {
          const Icon = section.icon;
          const reports = REPORTS[section.id] || [];
          const isOpen = expandedSections.has(section.id);
          return (
            <div key={section.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-indigo-600" />
                  </div>
                  <span className="font-semibold text-slate-900 text-sm">{section.label}</span>
                  <span className="text-xs text-slate-400 font-medium">({reports.length})</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-5 pb-4 space-y-1">
                  {reports.map(r => (
                    <button key={r.id} onClick={() => fetchReport(r.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                        activeReport === r.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}>
                      <div className="flex items-center justify-between">
                        <span>{r.label}</span>
                        {r.needsDates && <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Date Range</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
