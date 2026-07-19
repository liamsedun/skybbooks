import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { reportsApi, apiDownload, orgApi, downloadBlob, printWindow } from '../../../lib/api';
import { Loader2, AlertCircle, CheckCircle2, Download, Upload, X } from 'lucide-react';
import { downloadCsv, exportToCsv, CSV_TEMPLATES } from '../../../lib/csvTemplates';
import { useToast } from '../../../contexts/ToastContext';
import { fmtNaira, fmtDate, getDefaultDateRange, getDefaultCompareDates, getDefaultCompareAsOf, ReportType, ReportPageProps } from '../reportUtils';
import { ReportTable } from './ReportTable';
import { AccountDrilldownModal } from './AccountDrilldownModal';

export function ReportShell({ reportType, title }: ReportPageProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { startDate, endDate } = getDefaultDateRange();
  const [sDate, setSDate] = useState(startDate);
  const [eDate, setEDate] = useState(endDate);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drillDown, setDrillDown] = useState<any | null>(null);
  const [showZero, setShowZero] = useState(() => localStorage.getItem('bs_showZero') !== 'true');
  const [showCodes, setShowCodes] = useState(() => localStorage.getItem('bs_showCodes') === 'true');
  const [isShowZero, setIsShowZero] = useState(() => localStorage.getItem('is_showZero') !== 'false');
  const [isShowCodes, setIsShowCodes] = useState(() => localStorage.getItem('is_showCodes') === 'true');
  const [cfShowZero, setCfShowZero] = useState(() => localStorage.getItem('cf_showZero') !== 'false');
  const [cfShowCodes, setCfShowCodes] = useState(() => localStorage.getItem('cf_showCodes') === 'true');

  const isBalanceSheet = reportType === 'balance-sheet';
  const isSocie = reportType === 'statement-of-changes-in-equity';
  const isAgedReport = reportType === 'aged-receivables' || reportType === 'aged-payables';
  const isComparativeReport = !isAgedReport;
  const isAsOfDateReport = isBalanceSheet || isSocie;

  const defaultCompare = getDefaultCompareDates(sDate, eDate);
  const defaultBSCompare = getDefaultCompareAsOf(asOfDate);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareSDate, setCompareSDate] = useState(defaultCompare.compareStart);
  const [compareEDate, setCompareEDate] = useState(defaultCompare.compareEnd);
  const [compareAsOf, setCompareAsOf] = useState(defaultBSCompare);

  React.useEffect(() => {
    if (!compareEnabled) {
      try {
        const d = getDefaultCompareDates(sDate, eDate);
        if (d.compareStart) setCompareSDate(d.compareStart);
        if (d.compareEnd) setCompareEDate(d.compareEnd);
        const a = getDefaultCompareAsOf(asOfDate);
        if (a) setCompareAsOf(a);
      } catch { /* ignore invalid dates while typing */ }
    }
  }, [sDate, eDate, asOfDate]);

  const { data: orgData } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg });

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', reportType, sDate, eDate, asOfDate, compareEnabled, compareSDate, compareEDate, compareAsOf],
    queryFn: async () => {
      if (isBalanceSheet || isSocie) {
        const params: any = { asOfDate, format: 'json' };
        if (compareEnabled) params.compareAsOf = compareAsOf;
        const res = isBalanceSheet
          ? await reportsApi.getBalanceSheet(params)
          : await reportsApi.getStatementOfChangesInEquity(params);
        return res.data || res;
      }
      if (isAgedReport) {
        if (reportType === 'aged-receivables') {
          const res = await reportsApi.getAgedReceivables({ format: 'json' });
          const report = res.report || res.data || res;
          const rows = (report?.byCustomer || []).map((r: any) => ({ name: r.customerName, entityId: r.customerId, current: r.current, days1to30: r.days1To30, days31to60: r.days31To60, days61to90: r.days61To90, days90Plus: r.daysOver90, total: r.totalOutstanding }));
          return { rows, invoices: report?.invoices || [] };
        }
        const res = await reportsApi.getAgedPayables({ format: 'json' });
        const report = res.report || res.data || res;
        const rows = (report?.byVendor || []).map((r: any) => ({ name: r.vendorName, entityId: r.vendorId, current: r.current, days1to30: r.days1To30, days31to60: r.days31To60, days61to90: r.days61To90, days90Plus: r.daysOver90, total: r.totalOutstanding }));
        return { rows, bills: report?.bills || [] };
      }
      if (reportType === 'cash-flow') {
        const params: any = { startDate: sDate, endDate: eDate, format: 'json' };
        if (compareEnabled) {
          params.compareStart = compareSDate;
          params.compareEnd = compareEDate;
        }
        const res = await reportsApi.getCashFlow(params);
        return res.data || res;
      }
      const params: any = { startDate: sDate, endDate: eDate, format: 'json' };
      if (compareEnabled) {
        params.compareStart = compareSDate;
        params.compareEnd = compareEDate;
      }
      const res = await reportsApi.getIncomeStatement(params);
      return res.data || res;
    },
  });

  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    if (format === 'csv') {
      const today = new Date().toISOString().split('T')[0];
      let headers: string[];
      let csvRows: string[][];
      if (reportType === 'income-statement') {
        headers = ['Account', 'Amount'];
        csvRows = [];
        const isData = (data as any)?.current || data || {};
        const opRev = isData.operatingRevenue || {};
        const ooi = isData.otherOperatingIncome || {};
        const cos = isData.costOfSales || {};
        const sc = isData.staffCosts || {};
        const adm = isData.administrative || {};
        const sd = isData.sellingDistribution || {};
        const ooe = isData.otherOperatingExpenses || {};
        const fi = isData.financeIncome || {};
        const fc = isData.financeCosts || {};
        const tx = isData.incomeTaxExpense || {};
        const opRevTotal = opRev.total || 0;
        const ooiTotal = ooi.total || 0;
        const totalRevenue = isData.totalRevenue ?? (opRevTotal + ooiTotal);
        const cosTotal = cos.total || 0;
        const grossProfit = isData.grossProfit ?? (totalRevenue - cosTotal);
        const scTotal = sc.total || 0;
        const admTotal = adm.total || 0;
        const sdTotal = sd.total || 0;
        const ooeTotal = ooe.total || 0;
        const opExTotal = isData.totalOperatingExpenses ?? (scTotal + admTotal + sdTotal + ooeTotal);
        const operatingProfit = isData.operatingProfit ?? (grossProfit - opExTotal);
        const fiTotal = fi.total || 0;
        const fcTotal = fc.total || 0;
        const pbt = isData.profitBeforeTax ?? (operatingProfit + fiTotal - fcTotal);
        const txTotal = tx.total || 0;
        const netProfit = isData.netProfit ?? (pbt - txTotal);
        const addSec = (label: string, accounts: any[], total: number) => {
          csvRows.push([label, '']);
          (accounts || []).forEach((a: any) => csvRows.push([a.name, ((a.balance||0)/100).toFixed(2)]));
          csvRows.push([`Total ${label}`, (total/100).toFixed(2)]);
        };
        const addSubSec = (label: string, data: any) => {
          if (!data || !data.accounts || !data.accounts.length) return;
          csvRows.push([label, '']);
          data.accounts.forEach((a: any) => csvRows.push([a.name, ((a.balance||0)/100).toFixed(2)]));
          csvRows.push([`Total ${label}`, (data.total/100).toFixed(2)]);
        };
        addSec('Operating Revenue', opRev.accounts, opRevTotal);
        addSec('Other Operating Income', ooi.accounts, ooiTotal);
        csvRows.push(['TOTAL REVENUE', (totalRevenue/100).toFixed(2)]);
        csvRows.push(['Cost of Sales', '']);
        if (cos.openingStock !== undefined) {
          if (Math.abs(cos.openingStock) >= 0.01 || showZero) csvRows.push(['Opening Stock', (cos.openingStock/100).toFixed(2)]);
          if (cos.purchasesOfGoods && (Math.abs(cos.purchasesOfGoods.balance) >= 0.01 || showZero)) csvRows.push([`${cos.purchasesOfGoods.name} (${cos.purchasesOfGoods.code})`, (cos.purchasesOfGoods.balance/100).toFixed(2)]);
          if (Math.abs(cos.closingStock) >= 0.01 || showZero) csvRows.push(['Closing Stock', (-cos.closingStock/100).toFixed(2)]);
          csvRows.push(['Cost of Inventory Sold', (cos.inventorySold/100).toFixed(2)]);
        }
        (cos.accounts || []).forEach((a: any) => csvRows.push([a.name, ((a.balance||0)/100).toFixed(2)]));
        csvRows.push(['Total Cost of Sales', (cosTotal/100).toFixed(2)]);
        csvRows.push(['GROSS PROFIT', (grossProfit/100).toFixed(2)]);
        csvRows.push(['Operating Expenses', '']);
        addSubSec('Staff Costs', sc);
        addSubSec('Administrative Expenses', adm);
        addSubSec('Selling & Distribution Expenses', sd);
        addSubSec('Other Operating Expenses', ooe);
        csvRows.push(['Total Operating Expenses', (opExTotal/100).toFixed(2)]);
        csvRows.push(['OPERATING PROFIT (EBIT)', (operatingProfit/100).toFixed(2)]);
        if (fi.accounts?.length) addSec('Finance Income', fi.accounts, fiTotal);
        if (fc.accounts?.length) addSec('Finance Costs', fc.accounts, fcTotal);
        csvRows.push(['PROFIT BEFORE TAX', (pbt/100).toFixed(2)]);
        if (tx.accounts?.length) addSec('Income Tax Expense', tx.accounts, txTotal);
        csvRows.push(['NET PROFIT AFTER TAX', (netProfit/100).toFixed(2)]);
      } else if (reportType === 'balance-sheet') {
          headers = ['Account', 'Amount'];
          csvRows = [];
          const bsData = (data as any)?.data || data || {};
          const addCSSec = (label: string, items: any[], total: number) => {
            csvRows.push([label, '']);
            items.forEach((i: any) => csvRows.push([i.name || i.code || '', ((i.balance || 0) / 100).toFixed(2)]));
            csvRows.push([`Total ${label}`, (total / 100).toFixed(2)]);
          };
          const addCSVSection = (label: string, total: number, subSections: any[]) => {
            csvRows.push([`--- ${label} ---`, '']);
            (subSections || []).forEach((sec: any) => {
              if (sec.key === 'ppe' || sec.key === 'rou' || sec.key === 'intangibles') {
                addCSSec(sec.label, [...(sec.items || []), ...(sec.contraItems || []).map((ci: any) => ({ ...ci, balance: -Math.abs(ci.balance || 0) }))], sec.netTotal ?? sec.total);
              } else {
                addCSSec(sec.label, sec.items || [], sec.total || 0);
              }
            });
            csvRows.push([`Total ${label}`, (total / 100).toFixed(2)]);
          };
          const ca = bsData.currentAssets || {};
          const nca = bsData.nonCurrentAssets || {};
          const cl = bsData.currentLiabilities || {};
          const ncl = bsData.nonCurrentLiabilities || {};
          const eq = bsData.equity || {};
          csvRows.push(['ASSETS', '']);
          addCSVSection('Current Assets', ca.total || 0, ca.subSections || []);
          addCSVSection('Non-Current Assets', nca.total || 0, nca.subSections || []);
          csvRows.push(['Total Assets', ((bsData.totalAssets || 0) / 100).toFixed(2)]);
          csvRows.push(['', '']);
          csvRows.push(['LIABILITIES', '']);
          addCSVSection('Current Liabilities', cl.total || 0, cl.subSections || []);
          addCSVSection('Non-Current Liabilities', ncl.total || 0, ncl.subSections || []);
          csvRows.push(['Total Liabilities', ((bsData.totalLiabilities || 0) / 100).toFixed(2)]);
          csvRows.push(['', '']);
          csvRows.push(['EQUITY', '']);
          addCSVSection('Equity', eq.total || 0, eq.subSections || []);
          csvRows.push(['Total Equity', ((bsData.totalEquity || 0) / 100).toFixed(2)]);
          csvRows.push(['Total Liabilities & Equity', (((bsData.totalLiabilities || 0) + (bsData.totalEquity || 0)) / 100).toFixed(2)]);
        } else {
        const rows = data?.rows || (Array.isArray(data) ? data : []);
        if (!rows.length) return;
        if (reportType === 'aged-receivables' || reportType === 'aged-payables') {
          headers = ['Name', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total'];
          csvRows = rows.map((r: any) => [r.name || r.customerName || r.vendorName || '', (r.current/100).toFixed(2), (r.days1to30/100).toFixed(2), (r.days31to60/100).toFixed(2), (r.days61to90/100).toFixed(2), (r.days90Plus/100).toFixed(2), (r.total/100).toFixed(2)]);
        } else if (reportType === 'statement-of-changes-in-equity') {
          const socie = data?.data || data || {};
          const cy = socie.currentYear;
          if (!cy) { headers = []; csvRows = []; return; }
          const colKeys = cy.columns.map((c: any) => c.key);
          const colLabels = cy.columns.map((c: any) => c.label);
          headers = ['', ...colLabels, 'Total'];
          const rowTotal = (row: any) => colKeys.reduce((t: number, k: string) => t + (row.columns[k] || 0), 0);
          csvRows = cy.rows.map((r: any) => [r.label, ...colKeys.map((k: string) => ((r.columns[k] || 0) / 100).toFixed(2)), (rowTotal(r) / 100).toFixed(2)]);
          if (socie.priorYear) {
            csvRows.push(['']);
            csvRows.push([`${socie.priorYear.yearLabel}`, ...colKeys.map(() => ''), '']);
            socie.priorYear.rows.forEach((r: any) => csvRows.push([r.label, ...colKeys.map((k: string) => ((r.columns[k] || 0) / 100).toFixed(2)), (rowTotal(r) / 100).toFixed(2)]));
          }
        } else if (reportType === 'cash-flow') {
          const cf = data?.data || data || {};
          headers = ['Line Item', 'Amount'];
          const flatRows: string[][] = [];
          const addRow = (label: string, amt: number) => flatRows.push([label, (amt/100).toFixed(2)]);
          const operatingLineItems = cf.operatingLineItems || [];
          const investing = cf.investingActivities || {};
          const financing = cf.financingActivities || {};
          const cb = cf.cashBreakdown || {};
          addRow('OPERATING ACTIVITIES', 0);
          operatingLineItems.forEach((item: any) => addRow(item.auto ? `${item.name}(auto)` : item.name, item.amount));
          addRow('Net Cash from Operating Activities', (cf.operatingActivities?.total || 0));
          addRow('INVESTING ACTIVITIES', 0);
          (investing.items || []).forEach((iv: any) => addRow(iv.name, iv.amount));
          addRow('Net Cash from Investing Activities', investing.total || 0);
          addRow('FINANCING ACTIVITIES', 0);
          (financing.items || []).forEach((fn: any) => addRow(fn.name, fn.amount));
          addRow('Net Cash from Financing Activities', financing.total || 0);
          addRow('Net Increase in Cash and Cash Equivalents', cf.netChangeInCash || 0);
          addRow('Cash and cash equivalents at the beginning of the year', cf.openingCash || 0);
          addRow('Cash and cash equivalents at the end of the year', cf.closingCash || 0);
          addRow('CASH & CASH EQUIVALENTS BREAKDOWN', 0);
          addRow('Cash & Bank balance', cb.cashAndBankBalance || 0);
          addRow('Term Deposit', cb.termDeposit || 0);
          addRow('Term Loan (deduction)', cb.termLoan || 0);
          addRow(`Reconciliation to closing cash(off by ${(cb.reconciliationDiff || 0)/100})`, cb.breakdownTotal || 0);
          csvRows = flatRows;
        } else {
          headers = ['Account Code', 'Account Name', 'Type', 'Debit', 'Credit'];
          csvRows = rows.map((r: any) => [r.code||r.accountCode||'', r.name||r.accountName||'', r.type||r.accountType||'', ((r.debit||r.debitAmount||0)/100).toFixed(2), ((r.credit||r.creditAmount||0)/100).toFixed(2)]);
        }
      }
      exportToCsv(`${reportType}_${today}.csv`, headers, csvRows);
      return;
    }
    if (format === 'pdf') {
      try {
        if (reportType === 'income-statement') {
          const current = (data as any)?.current || data || {};
          const opRev = current.operatingRevenue || {};
          const ooi = current.otherOperatingIncome || {};
          const cos = current.costOfSales || {};
          const sc = current.staffCosts || {};
          const adm = current.administrative || {};
          const sd = current.sellingDistribution || {};
          const ooe = current.otherOperatingExpenses || {};
          const fi = current.financeIncome || {};
          const fc = current.financeCosts || {};
          const tx = current.incomeTaxExpense || {};
          const opRevTotal = opRev.total || 0;
          const ooiTotal = ooi.total || 0;
          const totalRevenue = current.totalRevenue ?? (opRevTotal + ooiTotal);
          const cosTotal = cos.total || 0;
          const grossProfit = current.grossProfit ?? (totalRevenue - cosTotal);
          const scTotal = sc.total || 0;
          const admTotal = adm.total || 0;
          const sdTotal = sd.total || 0;
          const ooeTotal = ooe.total || 0;
          const opExTotal = current.totalOperatingExpenses ?? (scTotal + admTotal + sdTotal + ooeTotal);
          const operatingProfit = current.operatingProfit ?? (grossProfit - opExTotal);
          const fiTotal = fi.total || 0;
          const fcTotal = fc.total || 0;
          const pbt = current.profitBeforeTax ?? (operatingProfit + fiTotal - fcTotal);
          const txTotal = tx.total || 0;
          const netProfit = current.netProfit ?? (pbt - txTotal);
          const etr = current.effectiveTaxRate ?? (pbt > 0 ? Math.round((txTotal / pbt) * 1000) / 10 : 0);
          const org = (orgData as any)?.data || orgData || {};
          const orgName = org.name || '';
          const orgAddr = org.address ? `<p style="margin:0;font-size:11px;color:#475569">${org.address}</p>` : '';
          const orgPhone = org.phone || '';
          const orgEmail = org.email || '';
          const orgWebsite = org.website || '';
          const orgLogo = org.logoUrl ? `<img src="${org.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain" />` : '';
          const contactInfo = [orgPhone, orgEmail, orgWebsite].filter(Boolean).join(' | ');

          function cogsRows(cos: any) {
            const opening = cos?.openingStock ?? 0;
            const closing = cos?.closingStock ?? 0;
            const invSold = cos?.inventorySold ?? 0;
            const pog = cos?.purchasesOfGoods || null;
            const accounts = cos?.accounts || [];
            const casTotal = cos?.total || 0;
            const hasInvCalc = opening !== 0 || (pog && pog.balance !== 0) || closing !== 0;
            let r = '<tr style="background:#f1f5f9"><td colspan="2" style="padding:6px 12px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase">Cost of Sales</td></tr>';
            if (hasInvCalc || invSold !== 0) {
              r += '<tr style="background:#f8fafc"><td colspan="2" style="padding:4px 12px;padding-left:28px;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Cost of Inventory Sold</td></tr>';
              if (opening !== 0) r += `<tr><td style="padding:3px 12px;padding-left:36px;font-size:10px;border-bottom:1px solid #f1f5f9">Opening Stock</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${(opening/100).toLocaleString()}</td></tr>`;
              if (pog && pog.balance !== 0) r += `<tr><td style="padding:3px 12px;padding-left:36px;font-size:10px;border-bottom:1px solid #f1f5f9">${pog.name} (${pog.code})</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${(pog.balance/100).toLocaleString()}</td></tr>`;
              if (closing !== 0) r += `<tr><td style="padding:3px 12px;padding-left:36px;font-size:10px;border-bottom:1px solid #f1f5f9">Closing Stock</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${(-closing/100).toLocaleString()}</td></tr>`;
              r += `<tr style="border-top:1px solid #e2e8f0;background:#f8fafc;font-weight:600"><td style="padding:4px 12px;padding-left:28px;font-size:10px;color:#64748b">Cost of Inventory Sold</td><td style="padding:4px 12px;font-size:10px;text-align:right;font-family:monospace">₦${(invSold/100).toLocaleString()}</td></tr>`;
            }
            const accRows = (accounts || []).map((a: any) =>
              `<tr><td style="padding:4px 12px;padding-left:24px;font-size:11px;border-bottom:1px solid #f1f5f9">${a.name}</td><td style="padding:4px 12px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((a.balance||0)/100).toLocaleString()}</td></tr>`
            ).join('');
            r += accRows;
            r += `<tr style="border-top:1px solid #cbd5e1;background:#f8fafc;font-weight:600"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:#0f172a">Total Cost of Sales</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace">₦${(casTotal/100).toLocaleString()}</td></tr>`;
            return r;
          }
          function secRows(label: string, accounts: any[], total: number) {
            const accRows = (accounts || []).map((a: any) =>
              `<tr><td style="padding:4px 12px;padding-left:24px;font-size:11px;border-bottom:1px solid #f1f5f9">${a.name}</td><td style="padding:4px 12px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((a.balance||0)/100).toLocaleString()}</td></tr>`
            ).join('');
            return `<tr style="background:#f1f5f9"><td colspan="2" style="padding:6px 12px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase">${label}</td></tr>${accRows}<tr style="border-top:1px solid #cbd5e1;background:#f8fafc;font-weight:600"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:#0f172a">Total ${label}</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace">₦${(total/100).toLocaleString()}</td></tr>`;
          }
          function subSecRows(label: string, data: any) {
            if (!data || !data.accounts || data.accounts.length === 0) return '';
            const accRows = data.accounts.map((a: any) =>
              `<tr><td style="padding:3px 12px;padding-left:36px;font-size:10px;border-bottom:1px solid #f1f5f9">${a.name}</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((a.balance||0)/100).toLocaleString()}</td></tr>`
            ).join('');
            return `<tr style="background:#f8fafc"><td colspan="2" style="padding:4px 12px;padding-left:28px;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">${label}</td></tr>${accRows}<tr style="border-top:1px solid #e2e8f0;background:#f8fafc;font-weight:600"><td style="padding:4px 12px;padding-left:28px;font-size:10px;color:#64748b">Total ${label}</td><td style="padding:4px 12px;font-size:10px;text-align:right;font-family:monospace">₦${(data.total/100).toLocaleString()}</td></tr>`;
          }

          const summaryRows =
            `<tr style="border-top:2px solid #94a3b8;background:${pbt < 0 ? '#fef2f2' : '#eef2f3'};font-weight:700"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:${pbt < 0 ? '#dc2626' : '#1e293b'}">PROFIT BEFORE TAX</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace;color:${pbt < 0 ? '#dc2626' : '#1e293b'}">₦${(pbt/100).toLocaleString()}</td></tr>` +
            (tx.accounts?.length ? secRows('Income Tax Expense', tx.accounts, txTotal) : '') +
            `<tr style="border-top:3px double #0f172a;background:#f8fafc;font-weight:700"><td style="padding:8px 12px;padding-left:24px;font-size:13px;color:#0f172a">NET PROFIT AFTER TAX</td><td style="padding:8px 12px;font-size:13px;text-align:right;font-family:monospace;color:#0f172a">₦${(netProfit/100).toLocaleString()}</td></tr>` +
            (pbt > 0 ? `<tr style="background:#f8fafc"><td colspan="2" style="padding:4px 12px;font-size:10px;color:#64748b;font-style:italic">Effective Tax Rate: ${etr}%  (Tax Expense ÷ Profit Before Tax)</td></tr>` : '');
          const mainRows =
            secRows('Operating Revenue', opRev.accounts, opRevTotal) +
            secRows('Other Operating Income', ooi.accounts, ooiTotal) +
            `<tr style="border-top:1px solid #cbd5e1;background:#f1f5f9;font-weight:700"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:#0f172a">TOTAL REVENUE</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace">₦${(totalRevenue/100).toLocaleString()}</td></tr>` +
            cogsRows(cos) +
            `<tr style="border-top:2px solid ${grossProfit < 0 ? '#dc2626' : '#059669'};background:${grossProfit < 0 ? '#fef2f2' : '#ecfdf5'};font-weight:700"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:${grossProfit < 0 ? '#dc2626' : '#059669'}">GROSS PROFIT</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace;color:${grossProfit < 0 ? '#dc2626' : '#059669'}">₦${(grossProfit/100).toLocaleString()}</td></tr>` +
            `<tr style="background:#f1f5f9"><td colspan="2" style="padding:6px 12px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase">Operating Expenses</td></tr>` +
            subSecRows('Staff Costs', sc) +
            subSecRows('Administrative Expenses', adm) +
            subSecRows('Selling & Distribution Expenses', sd) +
            subSecRows('Other Operating Expenses', ooe) +
            `<tr style="border-top:1px solid #cbd5e1;background:#f1f5f9;font-weight:600"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:#0f172a">Total Operating Expenses</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace">₦${(opExTotal/100).toLocaleString()}</td></tr>` +
            `<tr style="border-top:2px solid #94a3b8;background:#eef2f3;font-weight:700"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:#1e293b">OPERATING PROFIT (EBIT)</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace">₦${(operatingProfit/100).toLocaleString()}</td></tr>` +
            (fi.accounts?.length ? secRows('Finance Income', fi.accounts, fiTotal) : '') +
            (fc.accounts?.length ? secRows('Finance Costs', fc.accounts, fcTotal) : '');

          printWindow('Income Statement',
            `<h2 style="font-size:16px;color:#0f172a;margin:0 0 8px">Income Statement</h2>
            <p style="font-size:11px;color:#64748b;margin:0 0 12px">Period: ${sDate} - ${eDate} &bull; Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Account</th>
                  <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>${(mainRows||'') + summaryRows || '<tr><td colspan="2" style="text-align:center;color:#94a3b8;padding:20px">No data</td></tr>'}</tbody>
            </table>`,
            `Period: ${sDate} - ${eDate}`
          );
        } else if (reportType === 'balance-sheet') {
          const bsData = (data as any)?.data || data || {};
          const totalAssets = bsData?.totalAssets || 0;
          const totalLiabilities = bsData?.totalLiabilities || 0;
          const totalEquity = bsData?.totalEquity || 0;
          const org = (orgData as any)?.data || orgData || {};
          const orgName = org.name || '';
          const orgAddr = org.address ? `<p style="margin:0;font-size:11px;color:#475569">${org.address}</p>` : '';
          const orgPhone = org.phone || '';
          const orgEmail = org.email || '';
          const orgWebsite = org.website || '';
          const orgLogo = org.logoUrl ? `<img src="${org.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain" />` : '';
          const contactInfo = [orgPhone, orgEmail, orgWebsite].filter(Boolean).join(' | ');
          function printSecRows(label: string, items: any[], total: number): string {
            const accRows = items.filter((i: any) => i.name !== label).map((i: any) =>
              `<tr><td style="padding:3px 12px;padding-left:24px;font-size:10px">${i.code ? `<span style="color:#94a3b8;font-family:monospace;font-size:9px;margin-right:4px">${i.code}</span>` : ''}${i.name||''}</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace">₦${((i.balance||0)/100).toLocaleString()}</td></tr>`
            ).join('');
            return `<tr style="background:#f1f5f9"><td colspan="2" style="padding:6px 12px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase">${label}</td></tr>${accRows}<tr style="border-top:1px solid #e2e8f0;font-weight:600;background:#f8fafc"><td style="padding:4px 12px;padding-left:24px;font-size:10px;color:#64748b">Total ${label}</td><td style="padding:4px 12px;font-size:10px;text-align:right;font-family:monospace">₦${(total/100).toLocaleString()}</td></tr>`;
          }
          function printNBVSec(label: string, costItems: any[], costTotal: number, contraItems: any[], contraTotal: number, netTotal: number): string {
            return `<tr style="background:#f1f5f9"><td colspan="2" style="padding:6px 12px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase">${label}</td></tr>${costItems.map((i: any) => `<tr><td style="padding:3px 12px;padding-left:24px;font-size:10px">${i.name||''}</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace">₦${((i.balance||0)/100).toLocaleString()}</td></tr>`).join('')}${contraItems.map((i: any) => `<tr><td style="padding:3px 12px;padding-left:24px;font-size:10px;color:#64748b">Less: ${i.name||''}</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace;color:#64748b">(₦${(Math.abs(i.balance||0)/100).toLocaleString()})</td></tr>`).join('')}<tr style="border-top:1px solid #e2e8f0;font-weight:600;background:#f8fafc"><td style="padding:4px 12px;padding-left:24px;font-size:10px;color:#64748b">Net Book Value – ${label}</td><td style="padding:4px 12px;font-size:10px;text-align:right;font-family:monospace">₦${((netTotal??costTotal)/100).toLocaleString()}</td></tr>`;
          }
          function printSection(label: string, total: number, items: any[]): string {
            return items.map((sec: any) => sec.key === 'ppe' || sec.key === 'rou' || sec.key === 'intangibles'
              ? printNBVSec(sec.label, sec.items||[], sec.total||0, sec.contraItems||[], sec.contraTotal||0, sec.netTotal??sec.total)
              : printSecRows(sec.label, sec.items||[], sec.total||0)
            ).join('') + `<tr style="border-top:1px solid #cbd5e1;background:#eef2f3;font-weight:700"><td style="padding:5px 12px;padding-left:16px;font-size:11px;color:#0f172a">Total ${label}</td><td style="padding:5px 12px;font-size:11px;text-align:right;font-family:monospace">₦${(total/100).toLocaleString()}</td></tr>`;
          }
          const ca = bsData.currentAssets || {}; const nca = bsData.nonCurrentAssets || {};
          const cl = bsData.currentLiabilities || {}; const ncl = bsData.nonCurrentLiabilities || {};
          const eq = bsData.equity || {};
          const assetHtml = printSection('Current Assets', ca.total||0, ca.subSections||[]) + printSection('Non-Current Assets', nca.total||0, nca.subSections||[]);
          const liabilityHtml = printSection('Current Liabilities', cl.total||0, cl.subSections||[]) + printSection('Non-Current Liabilities', ncl.total||0, ncl.subSections||[]);
          const equityHtml = printSection('Equity', eq.total||0, eq.subSections||[]);
          printWindow('Balance Sheet',
            `<h2 style="font-size:16px;color:#0f172a;margin:0 0 8px">Balance Sheet</h2>
            <p style="font-size:11px;color:#64748b;margin:0 0 12px">As of ${asOfDate} &bull; Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Account</th>
                  <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr style="background:#eff6ff;font-weight:bold"><td colspan="2" style="padding:8px 10px">ASSETS</td></tr>${assetHtml}
                <tr style="font-weight:bold;border-top:2px solid"><td style="padding:7px 10px">Total Assets</td><td style="padding:7px 10px;text-align:right;font-family:monospace">₦${(totalAssets/100).toLocaleString()}</td></tr>
                <tr style="background:#fffbeb;font-weight:bold"><td colspan="2" style="padding:8px 10px">LIABILITIES</td></tr>${liabilityHtml}
                <tr style="font-weight:bold;border-top:2px solid"><td style="padding:7px 10px">Total Liabilities</td><td style="padding:7px 10px;text-align:right;font-family:monospace">₦${(totalLiabilities/100).toLocaleString()}</td></tr>
                <tr style="background:#f5f3ff;font-weight:bold"><td colspan="2" style="padding:8px 10px">EQUITY</td></tr>${equityHtml}
                <tr style="font-weight:bold;border-top:2px solid"><td style="padding:7px 10px">Total Equity</td><td style="padding:7px 10px;text-align:right;font-family:monospace">₦${(totalEquity/100).toLocaleString()}</td></tr>
                <tr style="font-weight:bold;border-top:3px double;background:#f1f5f9"><td style="padding:7px 10px">Total Liabilities &amp; Equity</td><td style="padding:7px 10px;text-align:right;font-family:monospace">₦${((totalLiabilities+totalEquity)/100).toLocaleString()}</td></tr>
              </tbody>
            </table>`,
            `As of ${asOfDate}`
          );
        } else if (reportType === 'cash-flow') {
          const cf = data?.data || data || {};
          const fmtPdf = (v: number) => v < 0 ? `(₦${(Math.abs(v)/100).toLocaleString()})` : `₦${(v/100).toLocaleString()}`;
          const pdfRows: string[] = [];
          const addPdfRow = (label: string, amt: string, cls?: string) => pdfRows.push(`<tr${cls?` class="${cls}"`:''}><td style="padding:4px 10px">${label}</td><td class="r" style="padding:4px 10px">${amt}</td></tr>`);
          const operatingLineItems = cf.operatingLineItems || [];
          const investing = cf.investingActivities || {};
          const financing = cf.financingActivities || {};
          const cb = cf.cashBreakdown || {};
          addPdfRow('OPERATING ACTIVITIES', '', 'bg-emerald-50');
          operatingLineItems.forEach((item: any) => addPdfRow(item.auto ? `${item.name}(auto)` : item.name, fmtPdf(item.amount)));
          addPdfRow('Net Cash from Operating Activities', fmtPdf(cf.operatingActivities?.total || 0), 'fw-bold border-top-2');
          addPdfRow('INVESTING ACTIVITIES', '', 'bg-blue-50');
          (investing.items || []).forEach((iv: any) => addPdfRow(iv.name, fmtPdf(iv.amount)));
          addPdfRow('Net Cash from Investing Activities', fmtPdf(investing.total || 0), 'fw-bold border-top-2');
          addPdfRow('FINANCING ACTIVITIES', '', 'bg-violet-50');
          (financing.items || []).forEach((fn: any) => addPdfRow(fn.name, fmtPdf(fn.amount)));
          addPdfRow('Net Cash from Financing Activities', fmtPdf(financing.total || 0), 'fw-bold border-top-2');
          addPdfRow('Net Increase in Cash and Cash Equivalents', fmtPdf(cf.netChangeInCash || 0), 'fw-bold border-top-3');
          addPdfRow('Cash and cash equivalents at the beginning of the year', fmtPdf(cf.openingCash || 0));
          addPdfRow('Cash and cash equivalents at the end of the year', fmtPdf(cf.closingCash || 0), 'fw-bold');
          addPdfRow('CASH & CASH EQUIVALENTS BREAKDOWN', '', 'bg-amber-50');
          addPdfRow('Cash & Bank balance', fmtPdf(cb.cashAndBankBalance || 0));
          addPdfRow('Term Deposit', fmtPdf(cb.termDeposit || 0));
          addPdfRow('Term Loan (deduction)', fmtPdf(cb.termLoan || 0));
          const offBy = Math.abs(cb.reconciliationDiff || 0) > 1 ? ` (off by ${fmtPdf(cb.reconciliationDiff)})` : '';
          addPdfRow(`Reconciliation to closing cash${offBy}`, fmtPdf(cb.breakdownTotal || 0), 'fw-bold');
          printWindow('Cash Flow Statement',
            `<h2 style="font-size:16px;color:#0f172a;margin:0 0 8px">Cash Flow Statement</h2>
            <p style="font-size:11px;color:#64748b;margin:0 0 12px">Period: ${sDate} - ${eDate} &bull; Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Line Item</th>
                  <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>${pdfRows.join('')}</tbody>
            </table>`,
            `Period: ${sDate} - ${eDate}`
          );
        } else if (reportType === 'statement-of-changes-in-equity') {
          const socie = data?.data || data || {};
          const cy = socie.currentYear;
          const fmtPdf = (v: number) => v < 0 ? `(₦${(Math.abs(v)/100).toLocaleString()})` : `₦${(v/100).toLocaleString()}`;
          let pdfSocieHtml = '';
          if (cy) {
            const colKeys = cy.columns.map((c: any) => c.key);
            const colLabels = cy.columns.map((c: any) => c.label);
            const rowTotal = (row: any) => colKeys.reduce((t: number, k: string) => t + (row.columns[k] || 0), 0);
            const th = `<th style="padding:6px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase"></th>${colLabels.map((l: string) => `<th style="padding:6px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">${l}</th>`).join('')}<th style="padding:6px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Total</th>`;
            const tr = cy.rows.map((r: any) => `<tr style="border-top:1px solid #f1f5f9"><td style="padding:5px 10px;font-size:11px">${r.label}</td>${colKeys.map((k: string) => `<td style="padding:5px 10px;font-size:11px;text-align:right;font-family:monospace">${fmtPdf(r.columns[k] || 0)}</td>`).join('')}<td style="padding:5px 10px;font-size:11px;text-align:right;font-weight:600;font-family:monospace">${fmtPdf(rowTotal(r))}</td></tr>`).join('');
            pdfSocieHtml = `<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc">${th}</tr></thead><tbody>${tr}</tbody></table>`;
            if (socie.priorYear) {
              const pyTr = socie.priorYear.rows.map((r: any) => `<tr style="border-top:1px solid #f1f5f9"><td style="padding:5px 10px;font-size:11px">${r.label}</td>${colKeys.map((k: string) => `<td style="padding:5px 10px;font-size:11px;text-align:right;font-family:monospace">${fmtPdf(r.columns[k] || 0)}</td>`).join('')}<td style="padding:5px 10px;font-size:11px;text-align:right;font-weight:600;font-family:monospace">${fmtPdf(rowTotal(r))}</td></tr>`).join('');
              pdfSocieHtml += `<br/><div style="background:#fffbeb;padding:6px 10px;font-size:11px;font-weight:700;color:#92400e">Prior Year — ${socie.priorYear.yearLabel}</div><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc">${th}</tr></thead><tbody>${pyTr}</tbody></table>`;
            }
          }
          printWindow('Statement of Changes in Equity',
            `<h2 style="font-size:16px;color:#0f172a;margin:0 0 8px">Statement of Changes in Equity</h2>
            <p style="font-size:11px;color:#64748b;margin:0 0 12px">As of ${asOfDate} &bull; Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            ${pdfSocieHtml}`,
            `As of ${asOfDate}`
          );
        } else if (reportType === 'aged-receivables' || reportType === 'aged-payables') {
          const label = reportType === 'aged-receivables' ? 'Customer' : 'Vendor';
          const title = reportType === 'aged-receivables' ? 'Aged Receivables' : 'Aged Payables';
          const list = data?.rows || (Array.isArray(data) ? data : []);
          const pdfRows = list.map((r: any) =>
            `<tr><td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f1f5f9">${r.name||''}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((r.current||0)/100).toLocaleString()}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((r.days1to30||0)/100).toLocaleString()}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((r.days31to60||0)/100).toLocaleString()}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((r.days61to90||0)/100).toLocaleString()}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((r.days90Plus||0)/100).toLocaleString()}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-weight:600;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((r.total||0)/100).toLocaleString()}</td></tr>`
          ).join('');
          const tCurr = list.reduce((s: number, r: any) => s + (r.current||0), 0);
          const t1_30 = list.reduce((s: number, r: any) => s + (r.days1to30||0), 0);
          const t31_60 = list.reduce((s: number, r: any) => s + (r.days31to60||0), 0);
          const t61_90 = list.reduce((s: number, r: any) => s + (r.days61to90||0), 0);
          const t90 = list.reduce((s: number, r: any) => s + (r.days90Plus||0), 0);
          const tTotal = list.reduce((s: number, r: any) => s + (r.total||0), 0);
          printWindow(title,
            `<h2 style="font-size:16px;color:#0f172a;margin:0 0 8px">${title}</h2>
            <p style="font-size:11px;color:#64748b;margin:0 0 12px">As of ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">${label}</th>
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Current</th>
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">1-30</th>
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">31-60</th>
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">61-90</th>
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">90+</th>
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Total</th>
                </tr>
              </thead>
              <tbody>${pdfRows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px">No data</td></tr>'}</tbody>
              <tfoot>
                <tr style="border-top:2px solid #0f172a;font-weight:700">
                  <td style="padding:8px 10px;font-size:12px">TOTAL</td>
                  <td style="padding:8px 10px;font-size:12px;text-align:right;font-family:monospace">₦${(tCurr/100).toLocaleString()}</td>
                  <td style="padding:8px 10px;font-size:12px;text-align:right;font-family:monospace">₦${(t1_30/100).toLocaleString()}</td>
                  <td style="padding:8px 10px;font-size:12px;text-align:right;font-family:monospace">₦${(t31_60/100).toLocaleString()}</td>
                  <td style="padding:8px 10px;font-size:12px;text-align:right;font-family:monospace">₦${(t61_90/100).toLocaleString()}</td>
                  <td style="padding:8px 10px;font-size:12px;text-align:right;font-family:monospace">₦${(t90/100).toLocaleString()}</td>
                  <td style="padding:8px 10px;font-size:12px;text-align:right;font-family:monospace">₦${(tTotal/100).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>`,
            `${list.length} entries`
          );
        } else {
          const list = (Array.isArray(data) ? data : []);
          const rows = list.map((r: any) =>
            `<tr><td>${(r.code||r.accountCode||'')}</td><td>${(r.name||r.accountName||'')}</td><td class="c">${r.type||r.accountType||''}</td><td class="r">₦${((r.debit||r.debitAmount||0)/100).toLocaleString()}</td><td class="r">₦${((r.credit||r.creditAmount||0)/100).toLocaleString()}</td></tr>`
          ).join('');
          const pdfTotalDr = list.reduce((s: number, r: any) => s + (r.debit||r.debitAmount||0), 0);
          const pdfTotalCr = list.reduce((s: number, r: any) => s + (r.credit||r.creditAmount||0), 0);
          printWindow('Report', `<table><thead><tr><th>Code</th><th>Account</th><th class="c">Type</th><th class="r">Debit</th><th class="r">Credit</th></tr></thead><tbody>${rows||'<tr><td colspan="5" style="text-align:center;color:#94a3b8">No data</td></tr>'}</tbody><tfoot><tr style="font-weight:700;border-top:2px solid #cbd5e1;background:#f1f5f9"><td colspan="3" style="padding:7px 12px">Total</td><td class="r">₦${(pdfTotalDr/100).toLocaleString()}</td><td class="r">₦${(pdfTotalCr/100).toLocaleString()}</td></tr></tfoot></table>`);
        }
      } catch (err) {
        toast('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
        console.error('Print error:', err);
      }
      return;
    }
    if (reportType === 'income-statement') {
      reportsApi.getIncomeStatement({ startDate: sDate, endDate: eDate, format: 'excel' }).then((blob: any) => {
        downloadBlob(blob, `income_statement_${new Date().toISOString().split('T')[0]}.xlsx`);
      }).catch((err: any) => {
        console.error('Excel export failed:', err);
        toast('Failed to export Excel. Please try again.', 'error');
      });
    } else if (reportType === 'balance-sheet') {
      reportsApi.getBalanceSheet({ asOfDate, format: 'excel' }).then((blob: any) => {
        downloadBlob(blob, `balance_sheet_${new Date().toISOString().split('T')[0]}.xlsx`);
      }).catch((err: any) => {
        console.error('Excel export failed:', err);
        toast('Failed to export Excel. Please try again.', 'error');
      });
    } else if (reportType === 'cash-flow') {
      reportsApi.getCashFlow({ startDate: sDate, endDate: eDate, format: 'excel' }).then((blob: any) => {
        downloadBlob(blob, `cash_flow_${new Date().toISOString().split('T')[0]}.xlsx`);
      }).catch((err: any) => {
        console.error('Excel export failed:', err);
        toast('Failed to export Excel. Please try again.', 'error');
      });
    } else if (reportType === 'aged-receivables') {
      reportsApi.getAgedReceivables({ format: 'excel' }).then((blob: any) => {
        downloadBlob(blob, `aged_receivables_${new Date().toISOString().split('T')[0]}.xlsx`);
      }).catch((err: any) => {
        console.error('Excel export failed:', err);
        toast('Failed to export Excel. Please try again.', 'error');
      });
    } else if (reportType === 'aged-payables') {
      reportsApi.getAgedPayables({ format: 'excel' }).then((blob: any) => {
        downloadBlob(blob, `aged_payables_${new Date().toISOString().split('T')[0]}.xlsx`);
      }).catch((err: any) => {
        console.error('Excel export failed:', err);
        toast('Failed to export Excel. Please try again.', 'error');
      });
    } else if (reportType === 'statement-of-changes-in-equity') {
      const socieParams: any = { asOfDate, format };
      if (compareEnabled) socieParams.compareAsOf = compareAsOf;
      reportsApi.getStatementOfChangesInEquity(socieParams).then((blob: any) => {
        downloadBlob(blob, `statement_of_changes_in_equity_${new Date().toISOString().split('T')[0]}.${format}`);
      }).catch((err: any) => {
        console.error(`${format} export failed:`, err);
        toast('Failed to export. Please try again.', 'error');
      });
    } else {
      apiDownload(`/reports/${reportType}?format=${format}&startDate=${sDate}&endDate=${eDate}`, `${reportType}_${new Date().toISOString().split('T')[0]}.${format}`);
    }
  };

  const handleImportOB = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await reportsApi.importTrialBalanceOpeningBalances({ csvData: csvText });
      setImportMsg({ type: 'success', text: res.message || 'Opening balances imported successfully.' });
      setCsvText('');
      setTimeout(() => { setShowImport(false); setImportMsg(null); }, 1500);
    } catch (err: any) {
      setImportMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Import failed.' });
    } finally { setImporting(false); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-all duration-200"><Upload className="w-3.5 h-3.5" /> Import OB</button>
          <button onClick={() => handleExport('csv')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => handleExport('pdf')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all duration-200"><Download className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => handleExport('excel')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all duration-200"><Download className="w-3.5 h-3.5" /> Excel</button>
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowImport(false); setImportMsg(null); }}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Import Opening Balances</h2>
              <button onClick={() => { setShowImport(false); setImportMsg(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500">Upload a CSV file with columns: accountCode, accountName, debit (NGN), credit (NGN)</p>
            <button onClick={() => downloadCsv('trial-balance-opening-balances-template.csv', CSV_TEMPLATES.trialBalanceOpeningBalances.headers, CSV_TEMPLATES.trialBalanceOpeningBalances.sample)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">Download sample CSV</button>
            <input ref={fileRef} type="file" accept=".csv" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => setCsvText(ev.target?.result as string);
              reader.readAsText(file);
            }} className="w-full text-sm" />
            {csvText && (
              <div className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">File loaded ({csvText.split(/\n/).length} rows)</div>
            )}
            {importMsg && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${importMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {importMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {importMsg.text}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowImport(false); setImportMsg(null); }} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all duration-200">Cancel</button>
              <button onClick={handleImportOB} disabled={!csvText || importing}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200">
                {importing ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Import
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 items-center bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        {isAgedReport ? (
          <p className="text-sm text-slate-500">Aging as of {fmtDate(new Date().toISOString())}</p>
        ) : isAsOfDateReport ? (
          <>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">As of:</label>
            <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>
          {isBalanceSheet && (
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => { setShowZero(!showZero); localStorage.setItem('bs_showZero', String(!showZero)); }} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${showZero ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{showZero ? 'Hide Zero Accounts' : 'Show Zero Accounts'}</button>
            <button onClick={() => { setShowCodes(!showCodes); localStorage.setItem('bs_showCodes', String(!showCodes)); }} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${showCodes ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{showCodes ? 'Hide Codes' : 'Show Codes'}</button>
          </div>
          )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">From:</label>
              <input type="date" value={sDate} onChange={e => setSDate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">To:</label>
              <input type="date" value={eDate} onChange={e => setEDate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {reportType === 'income-statement' && (
                <>
                  <button onClick={() => { setIsShowZero(!isShowZero); localStorage.setItem('is_showZero', String(!isShowZero)); }} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${isShowZero ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{isShowZero ? 'Hide Zero Accounts' : 'Show Zero Accounts'}</button>
                  <button onClick={() => { setIsShowCodes(!isShowCodes); localStorage.setItem('is_showCodes', String(!isShowCodes)); }} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${isShowCodes ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{isShowCodes ? 'Hide Codes' : 'Show Codes'}</button>
                </>
              )}
              {reportType === 'cash-flow' && (
                <>
                  <button onClick={() => { setCfShowZero(!cfShowZero); localStorage.setItem('cf_showZero', String(!cfShowZero)); }} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${cfShowZero ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{cfShowZero ? 'Hide Zero Accounts' : 'Show Zero Accounts'}</button>
                  <button onClick={() => { setCfShowCodes(!cfShowCodes); localStorage.setItem('cf_showCodes', String(!cfShowCodes)); }} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${cfShowCodes ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{cfShowCodes ? 'Hide Codes' : 'Show Codes'}</button>
                </>
              )}
            </div>
          </>
        )}

        {isComparativeReport && (
          <div className="flex items-center gap-3 ml-auto">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={compareEnabled} onChange={e => setCompareEnabled(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Compare to prior period
            </label>
            {compareEnabled && (
              <>
                {isAsOfDateReport ? (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-500">Prior as of:</label>
                    <input type="date" value={compareAsOf} onChange={e => setCompareAsOf(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-slate-500">Prior from:</label>
                      <input type="date" value={compareSDate} onChange={e => setCompareSDate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-slate-500">To:</label>
                      <input type="date" value={compareEDate} onChange={e => setCompareEDate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><div className="bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl h-8 w-48"></div></div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm"><AlertCircle className="w-4 h-4" /> Failed to load report.</div>
      ) : (
        <ReportTable data={data} reportType={reportType} compareEnabled={compareEnabled} onAccountClick={(acct: any) => setDrillDown(acct)} showZero={showZero} showCodes={showCodes} isShowZero={isShowZero} isShowCodes={isShowCodes} cfShowZero={cfShowZero} cfShowCodes={cfShowCodes} asOfDate={asOfDate} />
      )}

      {drillDown && <AccountDrilldownModal account={drillDown} sDate={sDate} eDate={isBalanceSheet ? `${asOfDate}` : eDate} onClose={() => setDrillDown(null)} />}
    </div>
  );
}
