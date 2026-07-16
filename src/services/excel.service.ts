/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ExcelJS from 'exceljs';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import {
  db,
  accounts,
  journalEntries,
  journalLines,
  organisations,
  employees,
  payrollRuns,
  payrollLines,
  contacts
} from '../db/schema';
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getCashFlowStatement,
  getStatementOfChangesInEquity
} from './ledger.service';
import { getInvoiceAgingReport } from './invoice.service';
import { getBillAgingReport } from './bill.service';
import { getNotes } from './notes.service';
import { AppError } from '../lib/errors';

// Helper to write workbook to buffer
async function writeWorkbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// Helper to add notes worksheet to Excel workbook
async function addNotesSheet(workbook: ExcelJS.Workbook, orgId: string, sourceReport: string): Promise<void> {
  const notes = await getNotes(orgId, sourceReport);
  if (notes.length === 0) return;

  const ws = workbook.addWorksheet('Notes to Financial Statements');

  ws.mergeCells('A1:B1');
  ws.getCell('A1').value = 'Notes to the Financial Statements';
  ws.getCell('A1').font = { name: 'Arial', bold: true, size: 12 };

  ws.addRow([]);

  const hRow = ws.addRow(['Note', 'Content']);
  hRow.height = 22;
  hRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_HEX } };
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFF' } };
  });

  for (const note of notes) {
    ws.addRow([`${note.noteNumber}. ${note.title}`, '']);
    const content = (note.content || '').replace(/\*\*/g, '').replace(/\n/g, ' ');
    ws.addRow(['', content]);
    ws.addRow([]);
  }

  ws.columns = [
    { width: 35 },
    { width: 120 },
  ];
}

// Global Excel styles
const PRIMARY_HEX = '1E3A8A'; // Navy Blue for Headers
const SECONDARY_HEX = 'F3F4F6'; // Muted Gray for accent blocks

// =========================================================================
// 1. EXPORT TRIAL BALANCE
// =========================================================================
export async function exportTrialBalance(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  if (!org) throw new AppError('Organisation not found.', 404);

  const tbRows = await getTrialBalance(orgId, startDate, endDate);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Trial Balance');

  // Page Header Details
  ws.mergeCells('A1:I1');
  ws.getCell('A1').value = org.name.toUpperCase();
  ws.getCell('A1').font = { name: 'Arial', bold: true, size: 14 };

  ws.mergeCells('A2:I2');
  ws.getCell('A2').value = 'TRIAL BALANCE STATEMENT';
  ws.getCell('A2').font = { name: 'Arial', bold: true, size: 11, color: { argb: '4B5563' } };

  ws.mergeCells('A3:I3');
  ws.getCell('A3').value = `Reporting Period: ${startDate.toLocaleDateString('en-GB')} to ${endDate.toLocaleDateString('en-GB')}`;
  ws.getCell('A3').font = { name: 'Arial', italic: true, size: 9 };

  ws.addRow([]); // Blank Row

  // Headers row
  const headerVals = [
    'Account Code',
    'Account Name',
    'Type',
    'Opening Dr',
    'Opening Cr',
    'Period Dr',
    'Period Cr',
    'Closing Dr',
    'Closing Cr'
  ];
  const headerRow = ws.addRow(headerVals);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: PRIMARY_HEX }
    };
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Data rows
  const startRowIndex = 6;
  tbRows.forEach((row) => {
    const r = ws.addRow([
      row.accountCode,
      row.accountName,
      row.accountType.toUpperCase(),
      row.openingDebit / 100,
      row.openingCredit / 100,
      row.periodDebit / 100,
      row.periodCredit / 100,
      row.closingDebit / 100,
      row.closingCredit / 100
    ]);
    r.getCell(1).alignment = { horizontal: 'center' };
    r.getCell(3).alignment = { horizontal: 'center' };

    // Format monetary numbers
    for (let i = 4; i <= 9; i++) {
      r.getCell(i).numFmt = '₦#,##0.00;(₦#,##0.00);"-"';
      r.getCell(i).alignment = { horizontal: 'right' };
    }
  });

  const endRowIndex = startRowIndex + tbRows.length - 1;

  // Add Totals row
  const totalRowIndex = endRowIndex + 1;
  const totalsRow = ws.addRow([
    'TOTALS',
    '',
    '',
    { formula: `SUM(D6:D${endRowIndex})` },
    { formula: `SUM(E6:E${endRowIndex})` },
    { formula: `SUM(F6:F${endRowIndex})` },
    { formula: `SUM(G6:G${endRowIndex})` },
    { formula: `SUM(H6:H${endRowIndex})` },
    { formula: `SUM(I6:I${endRowIndex})` }
  ]);
  totalsRow.height = 22;
  totalsRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Arial', bold: true, size: 10 };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'double' }
    };
    if (colNum >= 4) {
      cell.numFmt = '₦#,##0.00;(₦#,##0.00);"-"';
      cell.alignment = { horizontal: 'right' };
    }
  });

  // Apply conditional formatting for out-of-balance totals using ExcelJS rules
  const colsToCompare = [
    { label: 'Opening Balance Check', formula: `D${totalRowIndex}<>E${totalRowIndex}`, cols: ['D', 'E'] },
    { label: 'Period Activity Check', formula: `F${totalRowIndex}<>G${totalRowIndex}`, cols: ['F', 'G'] },
    { label: 'Ledger Closing Check', formula: `H${totalRowIndex}<>I${totalRowIndex}`, cols: ['H', 'I'] }
  ];

  colsToCompare.forEach(check => {
    check.cols.forEach(col => {
      ws.addConditionalFormatting({
        ref: `${col}${totalRowIndex}`,
        rules: [
          {
            type: 'expression',
            formulae: [check.formula],
            priority: 1,
            style: {
              fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC7CE' }, fgColor: { argb: '9C0006' } },
              font: { color: { argb: '9C0006' }, bold: true }
            }
          }
        ]
      });
    });
  });

  // Column width expansions
  ws.columns = [
    { width: 14 },
    { width: 30 },
    { width: 12 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 }
  ];

  return writeWorkbookToBuffer(workbook);
}

// =========================================================================
// 2. EXPORT COMPENSATED COMPARATIVE INCOME STATEMENT
// =========================================================================
export async function exportIncomeStatement(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  if (!org) throw new AppError('Organisation not found.', 404);

  // Determine equivalent previous period
  const currentDurationMs = endDate.getTime() - startDate.getTime();
  const priorStartDate = new Date(startDate.getTime() - currentDurationMs - 1000);
  const priorEndDate = new Date(startDate.getTime() - 1000);

  // Fetch comparative P&L
  const pnlResult = await getProfitAndLoss(orgId, startDate, endDate, priorStartDate, priorEndDate);
  const currentPnl = pnlResult.current;
  const priorPnl = pnlResult.prior!;

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Income Statement');

  // Header Details
  ws.mergeCells('A1:E1');
  ws.getCell('A1').value = org.name.toUpperCase();
  ws.getCell('A1').font = { name: 'Arial', bold: true, size: 13 };

  ws.mergeCells('A2:E2');
  ws.getCell('A2').value = 'COMPARATIVE INCOME STATEMENT (PROFIT & LOSS)';
  ws.getCell('A2').font = { name: 'Arial', bold: true, size: 11, color: { argb: '10B981' } };

  ws.mergeCells('A3:E3');
  ws.getCell('A3').value = `Current Period: ${startDate.toLocaleDateString('en-GB')} - ${endDate.toLocaleDateString('en-GB')}  |  Prior Period: ${priorStartDate.toLocaleDateString('en-GB')} - ${priorEndDate.toLocaleDateString('en-GB')}`;
  ws.getCell('A3').font = { name: 'Arial', italic: true, size: 9 };

  ws.addRow([]);

  // Setup comparative headers
  const comparativeHeaders = [
    'Financial Category / Ledger Account',
    'Current Period',
    'Prior Period',
    'Variance (₦)',
    'Variance (%)'
  ];
  const hRow = ws.addRow(comparativeHeaders);
  hRow.height = 24;
  hRow.eachCell((cell, colNum) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '10B981' } // Success Emerald
    };
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'right' };
  });

  const numberFormat = '₦#,##0.00;(₦#,##0.00);"-"';
  const percentFormat = '0.0%';

  // Utility helper to inject comparative blocks
  function writeCategorySection(
    title: string,
    currentAccounts: any[],
    priorAccounts: any[]
  ) {
    // Section title
    const sectionHeader = ws.addRow([title.toUpperCase()]);
    sectionHeader.getCell(1).font = { name: 'Arial', bold: true, size: 11, color: { argb: PRIMARY_HEX } };
    ws.addRow([]);

    // Gather union of accounts
    const accountRegistry = new Map<string, { name: string; current: number; prior: number }>();
    currentAccounts.forEach(c => {
      accountRegistry.set(c.code, { name: c.name, current: c.balance, prior: 0 });
    });
    priorAccounts.forEach(p => {
      const existing = accountRegistry.get(p.code);
      if (existing) {
        existing.prior = p.balance;
      } else {
        accountRegistry.set(p.code, { name: p.name, current: 0, prior: p.balance });
      }
    });

    // Write registry rows
    const codesSorted = Array.from(accountRegistry.keys()).sort();
    codesSorted.forEach(code => {
      const entry = accountRegistry.get(code)!;
      const currentVal = entry.current / 100;
      const priorVal = entry.prior / 100;
      const varianceVal = currentVal - priorVal;
      
      const dataRow = ws.addRow([
        `[${code}] ${entry.name}`,
        currentVal,
        priorVal,
        varianceVal,
        priorVal !== 0 ? varianceVal / priorVal : 0
      ]);

      dataRow.getCell(2).numFmt = numberFormat;
      dataRow.getCell(3).numFmt = numberFormat;
      dataRow.getCell(4).numFmt = numberFormat;
      dataRow.getCell(5).numFmt = percentFormat;
      for (let i = 2; i <= 5; i++) {
        dataRow.getCell(i).alignment = { horizontal: 'right' };
      }
    });

    ws.addRow([]); // Separation spacer
  }

  function writeTotalRow(label: string, curTotal: number, priTotal: number, opts?: { style?: any; fill?: any }) {
    const cur = curTotal / 100;
    const pri = priTotal / 100;
    const varNum = cur - pri;
    const varPct = pri !== 0 ? varNum / pri : 0;
    const row = ws.addRow([label, cur, pri, varNum, varPct]);
    row.eachCell((cell: any, colNum: number) => {
      cell.font = opts?.style?.font || { name: 'Arial', bold: true, size: 10 };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
      if (opts?.fill) cell.fill = opts.fill;
      if (colNum >= 2) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = colNum === 5 ? percentFormat : numberFormat;
      }
    });
    ws.addRow([]);
    return row;
  }

  function writeSubSectionExcel(title: string, currentData: any, priorData: any) {
    const sectionHeader = ws.addRow([title.toUpperCase()]);
    sectionHeader.getCell(1).font = { name: 'Arial', bold: true, size: 10, color: { argb: '64748b' } };
    // Account rows
    const accountRegistry = new Map<string, { name: string; current: number; prior: number }>();
    (currentData.accounts || []).forEach((c: any) => { accountRegistry.set(c.code, { name: c.name, current: c.balance, prior: 0 }); });
    (priorData.accounts || []).forEach((p: any) => {
      const existing = accountRegistry.get(p.code);
      if (existing) { existing.prior = p.balance; } else { accountRegistry.set(p.code, { name: p.name, current: 0, prior: p.balance }); }
    });
    Array.from(accountRegistry.keys()).sort().forEach((code: string) => {
      const entry = accountRegistry.get(code)!;
      const row = ws.addRow([`  ${entry.name}`, entry.current/100, entry.prior/100, (entry.current - entry.prior)/100, entry.prior !== 0 ? (entry.current - entry.prior)/entry.prior : 0]);
      for (let i = 2; i <= 5; i++) { row.getCell(i).numFmt = i === 5 ? percentFormat : numberFormat; row.getCell(i).alignment = { horizontal: 'right' }; }
    });
    ws.addRow([]);
    writeTotalRow(`Total ${title}`, currentData.total, priorData.total);
  }

  // OPERATING REVENUE
  writeCategorySection('Operating Revenue', currentPnl.operatingRevenue.accounts, priorPnl.operatingRevenue.accounts);
  // OTHER OPERATING INCOME
  if (currentPnl.otherOperatingIncome.accounts.length > 0 || priorPnl.otherOperatingIncome.accounts.length > 0) {
    writeCategorySection('Other Operating Income', currentPnl.otherOperatingIncome.accounts, priorPnl.otherOperatingIncome.accounts);
  }
  const totalRevenueCurr = currentPnl.totalRevenue ?? (currentPnl.operatingRevenue.total + currentPnl.otherOperatingIncome.total);
  const totalRevenuePrior = priorPnl.totalRevenue ?? (priorPnl.operatingRevenue.total + priorPnl.otherOperatingIncome.total);
  writeTotalRow('TOTAL REVENUE', totalRevenueCurr, totalRevenuePrior);

  // COST OF SALES
  writeCategorySection('Cost of Sales', currentPnl.costOfSales.accounts, priorPnl.costOfSales.accounts);
  writeTotalRow('TOTAL COST OF SALES', currentPnl.costOfSales.total, priorPnl.costOfSales.total);

  // GROSS PROFIT
  const gpCurr = currentPnl.grossProfit ?? (totalRevenueCurr - currentPnl.costOfSales.total);
  const gpPrior = priorPnl.grossProfit ?? (totalRevenuePrior - priorPnl.costOfSales.total);
  writeTotalRow('GROSS PROFIT', gpCurr, gpPrior, {
    style: { font: { name: 'Arial', bold: true, size: 10, color: { argb: PRIMARY_HEX } } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: SECONDARY_HEX } },
  });

  // OPERATING EXPENSES
  ws.addRow(['OPERATING EXPENSES'.toUpperCase()]).getCell(1).font = { name: 'Arial', bold: true, size: 11, color: { argb: PRIMARY_HEX } };
  writeSubSectionExcel('Staff Costs', currentPnl.staffCosts, priorPnl.staffCosts);
  writeSubSectionExcel('Administrative Expenses', currentPnl.administrative, priorPnl.administrative);
  writeSubSectionExcel('Selling & Distribution Expenses', currentPnl.sellingDistribution, priorPnl.sellingDistribution);
  if ((currentPnl.otherOperatingExpenses?.accounts || []).length > 0 || (priorPnl.otherOperatingExpenses?.accounts || []).length > 0) {
    writeSubSectionExcel('Other Operating Expenses', currentPnl.otherOperatingExpenses, priorPnl.otherOperatingExpenses);
  }
  const opExCurr = currentPnl.totalOperatingExpenses ?? (currentPnl.staffCosts.total + currentPnl.administrative.total + currentPnl.sellingDistribution.total + (currentPnl.otherOperatingExpenses?.total || 0));
  const opExPrior = priorPnl.totalOperatingExpenses ?? (priorPnl.staffCosts.total + priorPnl.administrative.total + priorPnl.sellingDistribution.total + (priorPnl.otherOperatingExpenses?.total || 0));
  writeTotalRow('TOTAL OPERATING EXPENSES', opExCurr, opExPrior);

  // OPERATING PROFIT (EBIT)
  const opCurr = currentPnl.operatingProfit ?? (gpCurr - opExCurr);
  const opPrior = priorPnl.operatingProfit ?? (gpPrior - opExPrior);
  writeTotalRow('OPERATING PROFIT (EBIT)', opCurr, opPrior, {
    style: { font: { name: 'Arial', bold: true, size: 10, color: { argb: '1E3A8A' } } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEF2F3' } },
  });

  // FINANCE INCOME
  if ((currentPnl.financeIncome?.accounts || []).length > 0 || (priorPnl.financeIncome?.accounts || []).length > 0) {
    writeCategorySection('Finance Income', currentPnl.financeIncome.accounts, priorPnl.financeIncome.accounts);
    writeTotalRow('TOTAL FINANCE INCOME', currentPnl.financeIncome.total, priorPnl.financeIncome.total);
  }

  // FINANCE COSTS
  if ((currentPnl.financeCosts?.accounts || []).length > 0 || (priorPnl.financeCosts?.accounts || []).length > 0) {
    writeCategorySection('Finance Costs', currentPnl.financeCosts.accounts, priorPnl.financeCosts.accounts);
    writeTotalRow('TOTAL FINANCE COSTS', currentPnl.financeCosts.total, priorPnl.financeCosts.total);
  }

  // PROFIT BEFORE TAX
  const fiCurr = currentPnl.financeIncome?.total || 0;
  const fcCurr = currentPnl.financeCosts?.total || 0;
  const fiPrior = priorPnl.financeIncome?.total || 0;
  const fcPrior = priorPnl.financeCosts?.total || 0;
  const pbtCurr = currentPnl.profitBeforeTax ?? (opCurr + fiCurr - fcCurr);
  const pbtPrior = priorPnl.profitBeforeTax ?? (opPrior + fiPrior - fcPrior);
  writeTotalRow('PROFIT BEFORE TAX', pbtCurr, pbtPrior, {
    style: { font: { name: 'Arial', bold: true, size: 10, color: { argb: '1E3A8A' } } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEF2F3' } },
  });

  // INCOME TAX EXPENSE
  if ((currentPnl.incomeTaxExpense?.accounts || []).length > 0 || (priorPnl.incomeTaxExpense?.accounts || []).length > 0) {
    writeCategorySection('Income Tax Expense', currentPnl.incomeTaxExpense.accounts, priorPnl.incomeTaxExpense.accounts);
    writeTotalRow('TOTAL INCOME TAX EXPENSE', currentPnl.incomeTaxExpense.total, priorPnl.incomeTaxExpense.total);
  }

  // NET PROFIT AFTER TAX
  const npCurr = currentPnl.netProfit ?? (pbtCurr - (currentPnl.incomeTaxExpense?.total || 0));
  const npPrior = priorPnl.netProfit ?? (pbtPrior - (priorPnl.incomeTaxExpense?.total || 0));
  writeTotalRow('NET PROFIT AFTER TAX', npCurr, npPrior, {
    style: { font: { name: 'Arial', bold: true, size: 12, color: { argb: 'FFFFFF' } } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } },
  });

  // Cell padding
  ws.columns = [
    { width: 48 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 15 }
  ];

  await addNotesSheet(workbook, orgId, 'income_statement');

  return writeWorkbookToBuffer(workbook);
}

// =========================================================================
// 3. EXPORT GENERAL LEDGER ACCOUNT DOCK
// =========================================================================
export async function exportGeneralLedger(
  orgId: string,
  accountId: string,
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  if (!org) throw new AppError('Organisation not found.', 404);

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.orgId, orgId)))
    .limit(1);

  if (!account) throw new AppError('Ledger account structure was not found.', 404);

  // Parse prior values for Opening balance
  const priorLinesPr = await db
    .select({
      debitAmount: journalLines.debitAmount,
      creditAmount: journalLines.creditAmount
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        eq(journalLines.accountId, accountId),
        sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`,
        sql`${journalEntries.date} < ${startDate}`
      )
    );

  const matchedLines = await db
    .select({
      date: journalEntries.date,
      entryNumber: journalEntries.entryNumber,
      description: journalLines.description,
      reference: journalEntries.reference,
      debitAmount: journalLines.debitAmount,
      creditAmount: journalLines.creditAmount
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        eq(journalLines.accountId, accountId),
        sql`${journalEntries.status} NOT IN ('draft', 'pending_review', 'cancelled', 'reversed')`,
        gte(journalEntries.date, startDate),
        lte(journalEntries.date, endDate)
      )
    )
    .orderBy(journalEntries.date);

  const isDebitBalanceType = account.type === 'asset' || account.type === 'expense';

  // Opening balance calculations
  let priorDebits = priorLinesPr.reduce((s, c) => s + c.debitAmount, 0);
  let priorCredits = priorLinesPr.reduce((s, c) => s + c.creditAmount, 0);
  let openingBalRaw = isDebitBalanceType ? (priorDebits - priorCredits) : (priorCredits - priorDebits);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('General Ledger');

  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = org.name.toUpperCase();
  ws.getCell('A1').font = { name: 'Arial', bold: true, size: 13 };

  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = `GENERAL LEDGER: [${account.code}] ${account.name.toUpperCase()}`;
  ws.getCell('A2').font = { name: 'Arial', bold: true, size: 10, color: { argb: PRIMARY_HEX } };

  ws.mergeCells('A3:G3');
  ws.getCell('A3').value = `Duration: ${startDate.toLocaleDateString('en-GB')} to ${endDate.toLocaleDateString('en-GB')} | Account Type: ${account.type.toUpperCase()}`;
  ws.getCell('A3').font = { name: 'Arial', italic: true, size: 9 };

  ws.addRow([]);

  // Generate headers
  const columnsHeader = ws.addRow([
    'Date',
    'Journal Ref',
    'Particulars / Detailed Description',
    'External Reference',
    'Debit (+)',
    'Credit (-)',
    'Running Balance'
  ]);
  columnsHeader.height = 24;
  columnsHeader.eachCell((cell, cNum) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_HEX } };
    cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: cNum <= 4 ? 'left' : 'right' };
  });

  const numF = '₦#,##0.00;(₦#,##0.00);"-"';

  // Opening balance row
  const openRow = ws.addRow([
    startDate,
    'OPENING',
    'Balance Brought Forward',
    '',
    '',
    '',
    openingBalRaw / 100
  ]);
  openRow.height = 20;
  openRow.getCell(1).numFmt = 'dd/mm/yyyy';
  openRow.getCell(7).numFmt = numF;
  openRow.getCell(7).font = { bold: true };
  openRow.getCell(7).alignment = { horizontal: 'right' };

  // Loop current items
  let balanceTracker = openingBalRaw;
  matchedLines.forEach((row, i) => {
    const dr = row.debitAmount;
    const cr = row.creditAmount;
    if (isDebitBalanceType) {
      balanceTracker += (dr - cr);
    } else {
      balanceTracker += (cr - dr);
    }

    const dataRow = ws.addRow([
      new Date(row.date),
      row.entryNumber,
      row.description || 'Ledger transaction line',
      row.reference || '',
      dr > 0 ? dr / 100 : '',
      cr > 0 ? cr / 100 : '',
      balanceTracker / 100
    ]);

    dataRow.getCell(1).numFmt = 'dd/mm/yyyy';
    dataRow.getCell(5).numFmt = numF;
    dataRow.getCell(6).numFmt = numF;
    dataRow.getCell(7).numFmt = numF;

    dataRow.getCell(5).alignment = { horizontal: 'right' };
    dataRow.getCell(6).alignment = { horizontal: 'right' };
    dataRow.getCell(7).alignment = { horizontal: 'right' };
  });

  ws.columns = [
    { width: 12 },
    { width: 14 },
    { width: 40 },
    { width: 18 },
    { width: 15 },
    { width: 15 },
    { width: 18 }
  ];

  return writeWorkbookToBuffer(workbook);
}

// =========================================================================
// 4. EXPORT PAYROLL SCHEDULE
// =========================================================================
export async function exportPayrollSchedule(runId: string, orgId: string): Promise<Buffer> {
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.orgId, orgId)))
    .limit(1);

  if (!run) throw new AppError('Matched payroll run cycle could not be located.', 404);

  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, run.orgId))
    .limit(1);

  const lines = await db
    .select()
    .from(payrollLines)
    .innerJoin(employees, eq(payrollLines.employeeId, employees.id))
    .where(eq(payrollLines.runId, runId));

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Payroll Bank Payment Schedule');

  ws.mergeCells('A1:H1');
  ws.getCell('A1').value = org?.name.toUpperCase() || 'FINANCEOS CORPORATION';
  ws.getCell('A1').font = { name: 'Arial', bold: true, size: 13 };

  ws.mergeCells('A2:H2');
  ws.getCell('A2').value = `BANK SETTLEMENT PAYMENT SCHEDULE: CYCLE [${run.runNumber}]`;
  ws.getCell('A2').font = { name: 'Arial', bold: true, size: 10, color: { argb: '4F46E5' } };

  ws.mergeCells('A3:H3');
  ws.getCell('A3').value = `Pay Period: ${run.periodStart.toLocaleDateString('en-GB')} to ${run.periodEnd.toLocaleDateString('en-GB')} | Pay Disbursement Date: ${run.payDate.toLocaleDateString('en-GB')}`;
  ws.getCell('A3').font = { name: 'Arial', italic: true, size: 9 };

  ws.addRow([]);

  // Table Headers
  const columnHeaders = [
    'Recipient Employee Name',
    'Beneficiary Bank Name',
    'Disbursing Account No',
    'Gross Salary (₦)',
    'PAYE Tax (₦)',
    'Pension Contribution (₦)',
    'NHF Deduct (₦)',
    'Net Pay Settlement (₦)'
  ];

  const colRow = ws.addRow(columnHeaders);
  colRow.height = 24;
  colRow.eachCell((cell, cId) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } }; // Indigo Theme
    cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: cId >= 4 ? 'right' : 'left' };
  });

  const numF = '₦#,##0.00;(₦#,##0.00);"-"';
  const dataStartRow = 6;
  lines.forEach((line) => {
    const r = ws.addRow([
      `${line.employees.firstName} ${line.employees.lastName}`,
      line.employees.bankName || 'Unknown Bank',
      line.employees.accountNumber || '-',
      line.payroll_lines.grossPay / 100,
      line.payroll_lines.paye / 100,
      line.payroll_lines.pensionEmployee / 100,
      line.payroll_lines.nhf / 100,
      line.payroll_lines.netPay / 100
    ]);
    r.getCell(3).alignment = { horizontal: 'center' };
    for (let c = 4; c <= 8; c++) {
      r.getCell(c).numFmt = numF;
      r.getCell(c).alignment = { horizontal: 'right' };
    }
  });

  const dataEndRow = dataStartRow + lines.length - 1;

  // Add formula totals row
  const totalsRowVal = [
    'TOTAL PAYMENT SUMMARY',
    '',
    '',
    { formula: `SUM(D6:D${dataEndRow})` },
    { formula: `SUM(E6:E${dataEndRow})` },
    { formula: `SUM(F6:F${dataEndRow})` },
    { formula: `SUM(G6:G${dataEndRow})` },
    { formula: `SUM(H6:H${dataEndRow})` }
  ];

  const tRow = ws.addRow(totalsRowVal);
  tRow.height = 22;
  tRow.eachCell((cell, cNum) => {
    cell.font = { name: 'Arial', bold: true, size: 9 };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
    if (cNum >= 4) {
      cell.numFmt = numF;
      cell.alignment = { horizontal: 'right' };
    }
  });

  ws.columns = [
    { width: 28 },
    { width: 24 },
    { width: 18 },
    { width: 16 },
    { width: 14 },
    { width: 20 },
    { width: 14 },
    { width: 22 }
  ];

  return writeWorkbookToBuffer(workbook);
}

// =========================================================================
// 5. EXPORT AGED RECEIVABLES REPORT
// =========================================================================
export async function exportAgedReceivables(orgId: string): Promise<Buffer> {
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  const report = await getInvoiceAgingReport(orgId);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Aged Receivables');

  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = org?.name.toUpperCase() || 'FINANCEOS CORPORATION';
  ws.getCell('A1').font = { name: 'Arial', bold: true, size: 13 };

  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = 'AGED RECEIVABLES STATEMENT (ACCOUNTS RECEIVABLE)';
  ws.getCell('A2').font = { name: 'Arial', bold: true, size: 10, color: { argb: PRIMARY_HEX } };

  ws.mergeCells('A3:G3');
  ws.getCell('A3').value = `As of Today: ${new Date().toLocaleDateString('en-GB')}`;
  ws.getCell('A3').font = { name: 'Arial', italic: true, size: 9 };

  ws.addRow([]);

  // Column Headers
  const columnHeaders = [
    'Debtor Customer Name',
    'Current (Outstanding ₦)',
    '1 - 30 Days overdue',
    '31 - 60 Days overdue',
    '61 - 90 Days overdue',
    'Over 90 Days overdue',
    'Total Outstanding (₦)'
  ];

  const colRow = ws.addRow(columnHeaders);
  colRow.height = 24;
  colRow.eachCell((cell, idx) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_HEX } };
    cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 1 ? 'left' : 'right' };
  });

  const numF = '₦#,##0.00;(₦#,##0.00);"-"';
  const startRow = 6;
  report.byCustomer.forEach((cust: any) => {
    const r = ws.addRow([
      cust.customerName,
      cust.current / 100,
      cust.days1To30 / 100,
      cust.days31To60 / 100,
      cust.days61To90 / 100,
      cust.daysOver90 / 100,
      cust.totalOutstanding / 100
    ]);
    for (let i = 2; i <= 7; i++) {
      r.getCell(i).numFmt = numF;
      r.getCell(i).alignment = { horizontal: 'right' };
    }
  });

  const endRow = startRow + report.byCustomer.length - 1;

  // Bottom totals row of formulas
  const totalsFormulaRow = [
    'TOTAL OBLIGATION SUMMARY',
    { formula: `SUM(B6:B${endRow})` },
    { formula: `SUM(C6:C${endRow})` },
    { formula: `SUM(D6:D${endRow})` },
    { formula: `SUM(E6:E${endRow})` },
    { formula: `SUM(F6:F${endRow})` },
    { formula: `SUM(G6:G${endRow})` }
  ];

  const tRow = ws.addRow(totalsFormulaRow);
  tRow.height = 22;
  tRow.eachCell((cell, colId) => {
    cell.font = { name: 'Arial', bold: true, size: 9 };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
    if (colId >= 2) {
      cell.numFmt = numF;
      cell.alignment = { horizontal: 'right' };
    }
  });

  ws.columns = [
    { width: 34 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 22 }
  ];

  return writeWorkbookToBuffer(workbook);
}

// =========================================================================
// 6. EXPORT AGED PAYABLES REPORT
// =========================================================================
export async function exportAgedPayables(orgId: string): Promise<Buffer> {
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  const report = await getBillAgingReport(orgId);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Aged Payables');

  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = org?.name.toUpperCase() || 'FINANCEOS CORPORATION';
  ws.getCell('A1').font = { name: 'Arial', bold: true, size: 13 };

  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = 'AGED PAYABLES STATEMENT (ACCOUNTS PAYABLE)';
  ws.getCell('A2').font = { name: 'Arial', bold: true, size: 10, color: { argb: 'B91C1C' } }; // Deep Red header

  ws.mergeCells('A3:G3');
  ws.getCell('A3').value = `As of Today: ${new Date().toLocaleDateString('en-GB')}`;
  ws.getCell('A3').font = { name: 'Arial', italic: true, size: 9 };

  ws.addRow([]);

  // Column Headers
  const columnHeaders = [
    'Creditor Supplier Name',
    'Current (Outstanding ₦)',
    '1 - 30 Days overdue',
    '31 - 60 Days overdue',
    '61 - 90 Days overdue',
    'Over 90 Days overdue',
    'Total Outstanding (₦)'
  ];

  const colRow = ws.addRow(columnHeaders);
  colRow.height = 24;
  colRow.eachCell((cell, idx) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'B91C1C' } };
    cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 1 ? 'left' : 'right' };
  });

  const numF = '₦#,##0.00;(₦#,##0.00);"-"';
  const startRow = 6;
  report.byVendor.forEach((vend: any) => {
    const r = ws.addRow([
      vend.vendorName,
      vend.current / 100,
      vend.days1To30 / 100,
      vend.days31To60 / 100,
      vend.days61To90 / 100,
      vend.daysOver90 / 100,
      vend.totalOutstanding / 100
    ]);
    for (let i = 2; i <= 7; i++) {
      r.getCell(i).numFmt = numF;
      r.getCell(i).alignment = { horizontal: 'right' };
    }
  });

  const endRow = startRow + report.byVendor.length - 1;

  // Bottom totals row
  const totalsFormulaRow = [
    'TOTAL CREDITOR OBLIGATIONS',
    { formula: `SUM(B6:B${endRow})` },
    { formula: `SUM(C6:C${endRow})` },
    { formula: `SUM(D6:D${endRow})` },
    { formula: `SUM(E6:E${endRow})` },
    { formula: `SUM(F6:F${endRow})` },
    { formula: `SUM(G6:G${endRow})` }
  ];

  const tRow = ws.addRow(totalsFormulaRow);
  tRow.height = 22;
  tRow.eachCell((cell, colId) => {
    cell.font = { name: 'Arial', bold: true, size: 9 };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
    if (colId >= 2) {
      cell.numFmt = numF;
      cell.alignment = { horizontal: 'right' };
    }
  });

  ws.columns = [
    { width: 34 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 22 }
  ];

  return writeWorkbookToBuffer(workbook);
}

// =========================================================================
// 7. EXPORT BALANCE SHEET (formerly 7, now 7)
// =========================================================================
export async function exportBalanceSheet(orgId: string, asOfDate: Date): Promise<Buffer> {
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  if (!org) throw new AppError('Organisation not found.', 404);

  const bs = await getBalanceSheet(orgId, asOfDate);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Balance Sheet');

  ws.mergeCells('A1:C1');
  ws.getCell('A1').value = org.name.toUpperCase();
  ws.getCell('A1').font = { name: 'Arial', bold: true, size: 13 };

  ws.mergeCells('A2:C2');
  ws.getCell('A2').value = 'BALANCE SHEET STATEMENT OF FINANCIAL POSITION';
  ws.getCell('A2').font = { name: 'Arial', bold: true, size: 10, color: { argb: PRIMARY_HEX } };

  ws.mergeCells('A3:C3');
  ws.getCell('A3').value = `As of Date: ${asOfDate.toLocaleDateString('en-GB')}`;
  ws.getCell('A3').font = { name: 'Arial', italic: true, size: 9 };

  ws.addRow([]);

  const colHeaders = ['Account Description', 'Sub-section', 'Book Value (₦)'];
  const hRow = ws.addRow(colHeaders);
  hRow.height = 24;
  hRow.eachCell((cell, idx) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_HEX } };
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 3 ? 'right' : 'left' };
  });

  const numF = '₦#,##0.00;(₦#,##0.00);"-"';

  function nairaRow(vals: any[]) {
    const r = ws.addRow(vals);
    r.getCell(3).numFmt = numF;
    r.getCell(3).alignment = { horizontal: 'right' };
    return r;
  }

  function styleRow(r: any, font?: any, fill?: any, border?: any) {
    if (font) r.eachCell((c: any) => { c.font = font; });
    if (fill) r.eachCell((c: any) => { c.fill = fill; });
    if (border) r.eachCell((c: any) => { c.border = border; });
  }

  function writeSubSection(label: string, total: number, items: any[]) {
    nairaRow([label, '', total / 100]);
    for (const item of items) {
      nairaRow([`  [${item.code}] ${item.name}`, '', item.balance / 100]);
    }
    const t = nairaRow([`Total ${label}`, '', total / 100]);
    styleRow(t, { name: 'Arial', bold: true, size: 10 }, undefined, { top: { style: 'thin' }, bottom: { style: 'thin' } });
    ws.addRow([]);
  }

  function writeNBVSubSection(label: string, costItems: any[], costTotal: number, contraItems: any[], contraTotal: number, netTotal: number) {
    nairaRow([label, '', costTotal / 100]);
    for (const item of costItems) {
      nairaRow([`  [${item.code}] ${item.name}`, '', item.balance / 100]);
    }
    if (contraItems.length > 0) {
      ws.addRow(['  Less: Accumulated Depreciation/Amortisation']);
      for (const item of contraItems) {
        nairaRow([`    [${item.code}] ${item.name}`, '', item.balance / 100]);
      }
    }
    const t = nairaRow([`Net Book Value – ${label}`, '', netTotal / 100]);
    styleRow(t, { name: 'Arial', bold: true, size: 10 }, undefined, { top: { style: 'thin' }, bottom: { style: 'thin' } });
    ws.addRow([]);
  }

  function writeSectionGroup(label: string, section: { total: number; subSections: any[] }) {
    const sr = nairaRow([label.toUpperCase(), '', section.total / 100]);
    styleRow(sr, { name: 'Arial', bold: true, size: 11, color: { argb: PRIMARY_HEX } });
    for (const sec of section.subSections) {
      if (sec.key === 'ppe' || sec.key === 'rou' || sec.key === 'intangibles') {
        writeNBVSubSection(sec.label, sec.items || [], sec.total || 0, sec.contraItems || [], sec.contraTotal || 0, sec.netTotal ?? sec.total);
      } else {
        writeSubSection(sec.label, sec.total || 0, sec.items || []);
      }
    }
  }

  // ASSETS
  let sr = nairaRow(['ASSETS', '', bs.totalAssets / 100]);
  styleRow(sr, { name: 'Arial', bold: true, size: 11, color: { argb: PRIMARY_HEX } });
  writeSectionGroup('Current Assets', bs.currentAssets);
  writeSectionGroup('Non-Current Assets', bs.nonCurrentAssets);
  let tr = nairaRow(['TOTAL ASSETS', '', bs.totalAssets / 100]);
  styleRow(tr, { name: 'Arial', bold: true, size: 10 }, undefined, { top: { style: 'thin' }, bottom: { style: 'thin' } });
  ws.addRow([]);

  // LIABILITIES
  sr = nairaRow(['LIABILITIES', '', bs.totalLiabilities / 100]);
  styleRow(sr, { name: 'Arial', bold: true, size: 11, color: { argb: PRIMARY_HEX } });
  writeSectionGroup('Current Liabilities', bs.currentLiabilities);
  writeSectionGroup('Non-Current Liabilities', bs.nonCurrentLiabilities);
  tr = nairaRow(['TOTAL LIABILITIES', '', bs.totalLiabilities / 100]);
  styleRow(tr, { name: 'Arial', bold: true, size: 10 }, undefined, { top: { style: 'thin' }, bottom: { style: 'thin' } });
  ws.addRow([]);

  // EQUITY
  sr = nairaRow(['EQUITY', '', bs.totalEquity / 100]);
  styleRow(sr, { name: 'Arial', bold: true, size: 11, color: { argb: PRIMARY_HEX } });
  writeSectionGroup('Equity', bs.equity);
  tr = nairaRow(['TOTAL EQUITY', '', bs.totalEquity / 100]);
  styleRow(tr, { name: 'Arial', bold: true, size: 10 }, undefined, { top: { style: 'thin' }, bottom: { style: 'thin' } });
  ws.addRow([]);

  // GRAND TOTAL
  const fRow = nairaRow(['TOTAL LIABILITIES AND EQUITY', '', bs.liabilitiesAndEquity / 100]);
  styleRow(fRow,
    { name: 'Arial', bold: true, size: 11, color: { argb: 'FFFFFF' } },
    { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_HEX } },
    { top: { style: 'thin' }, bottom: { style: 'double' } }
  );

  ws.columns = [
    { width: 55 },
    { width: 20 },
    { width: 22 }
  ];

  await addNotesSheet(workbook, orgId, 'balance_sheet');

  return writeWorkbookToBuffer(workbook);
}

// =========================================================================
// 9. EXPORT STATEMENT OF CHANGES IN EQUITY
// =========================================================================
export async function exportStatementOfChangesInEquity(
  orgId: string,
  asOfDate: Date,
  compareAsOfDate?: Date
): Promise<Buffer> {
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  if (!org) throw new AppError('Organisation not found.', 404);

  const socie = await getStatementOfChangesInEquity(orgId, asOfDate, compareAsOfDate);
  const current = socie.currentYear;

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('SOCIE');

  ws.mergeCells('A1:D1');
  ws.getCell('A1').value = org.name.toUpperCase();
  ws.getCell('A1').font = { name: 'Arial', bold: true, size: 13 };

  ws.mergeCells('A2:D2');
  ws.getCell('A2').value = 'STATEMENT OF CHANGES IN EQUITY';
  ws.getCell('A2').font = { name: 'Arial', bold: true, size: 10, color: { argb: '7C3AED' } };

  ws.mergeCells('A3:D3');
  ws.getCell('A3').value = `As of Date: ${asOfDate.toLocaleDateString('en-GB')}`;
  ws.getCell('A3').font = { name: 'Arial', italic: true, size: 9 };

  ws.addRow([]);

  const columns = current.columns || [];
  const headers = ['Description', ...columns.map((c: any) => c.label || c.key), 'Total'];
  const hRow = ws.addRow(headers);
  hRow.height = 24;
  hRow.eachCell((cell, idx) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7C3AED' } };
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 1 ? 'left' : 'right' };
  });

  const numF = '₦#,##0.00;(₦#,##0.00);"-"';

  (current.rows || []).forEach((row: any) => {
    const total = columns.reduce((s: number, c: any) => s + (row.columns[c.key] || 0), 0);
    const vals = [row.label];
    for (const c of columns) vals.push((row.columns[c.key] || 0) / 100);
    vals.push(total / 100);
    const r = ws.addRow(vals);
    for (let i = 2; i <= columns.length + 1; i++) {
      r.getCell(i).numFmt = numF;
      r.getCell(i).alignment = { horizontal: 'right' };
    }
  });

  const closingRow = current.rows?.[current.rows.length - 1];
  if (closingRow) {
    const totalsRow = ws.addRow(['Closing Balance']);
    let grandTotal = 0;
    for (let i = 0; i < columns.length; i++) {
      const val = (closingRow.columns[columns[i].key] || 0) / 100;
      grandTotal += (closingRow.columns[columns[i].key] || 0);
      totalsRow.getCell(i + 2).value = val;
      totalsRow.getCell(i + 2).numFmt = numF;
      totalsRow.getCell(i + 2).alignment = { horizontal: 'right' };
    }
    totalsRow.getCell(columns.length + 2).value = grandTotal / 100;
    totalsRow.getCell(columns.length + 2).numFmt = numF;
    totalsRow.getCell(columns.length + 2).alignment = { horizontal: 'right' };
    totalsRow.eachCell((cell) => { cell.font = { name: 'Arial', bold: true, size: 10 }; });
  }

  ws.columns = [
    { width: 40 },
    ...columns.map(() => ({ width: 20 })),
    { width: 22 },
  ];

  return writeWorkbookToBuffer(workbook);
}

// =========================================================================
// 8. EXPORT CASH FLOW STATEMENT
// =========================================================================
export async function exportCashFlow(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  if (!org) throw new AppError('Organisation not found.', 404);

  const cf = await getCashFlowStatement(orgId, startDate, endDate);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Statement of Cash Flows');

  ws.mergeCells('A1:B1');
  ws.getCell('A1').value = org.name.toUpperCase();
  ws.getCell('A1').font = { name: 'Arial', bold: true, size: 13 };

  ws.mergeCells('A2:B2');
  ws.getCell('A2').value = 'STATEMENT OF CASH FLOWS (DIRECT METHOD RECONCILIATION)';
  ws.getCell('A2').font = { name: 'Arial', bold: true, size: 10, color: { argb: '0F766E' } };

  ws.mergeCells('A3:B3');
  ws.getCell('A3').value = `Reporting Period: ${startDate.toLocaleDateString('en-GB')} to ${endDate.toLocaleDateString('en-GB')}`;
  ws.getCell('A3').font = { name: 'Arial', italic: true, size: 9 };

  ws.addRow([]);

  const colHeaders = ['Cash Flow Activity Segment Detail', 'Net Cash Transaction Amount (₦)'];
  const hRow = ws.addRow(colHeaders);
  hRow.height = 24;
  hRow.eachCell((cell, idx) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F766E' } };
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 2 ? 'right' : 'left' };
  });

  const numF = '₦#,##0.00;(₦#,##0.00);"-"';

  function writeSectionHeader(title: string) {
    const r = ws.addRow([title.toUpperCase()]);
    r.getCell(1).font = { name: 'Arial', bold: true, size: 11, color: { argb: '0F766E' } };
  }

  function writeSectionSummary(title: string, amount: number) {
    const r = ws.addRow([`NET CASH FROM ${title.toUpperCase()}`, amount / 100]);
    r.eachCell((cell, idx) => {
      cell.font = { name: 'Arial', bold: true, size: 10 };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
      if (idx === 2) {
        cell.numFmt = numF;
        cell.alignment = { horizontal: 'right' };
      }
    });
    ws.addRow([]);
  }

  const operatingLineItems = cf.operatingLineItems || [];
  const investing = cf.investingActivities || {};
  const financing = cf.financingActivities || {};
  const cb = cf.cashBreakdown || {};

  function addRow(label: string, amount: number) {
    const r = ws.addRow([label, amount / 100]);
    r.getCell(2).numFmt = numF;
    return r;
  }
  function boldRow(label: string, amount: number) {
    const r = ws.addRow([label, amount / 100]);
    r.eachCell((cell, idx) => {
      cell.font = { name: 'Arial', bold: true, size: 10 };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
      if (idx === 2) {
        cell.numFmt = numF;
        cell.alignment = { horizontal: 'right' };
      }
    });
    return r;
  }

  // 1. Operating Activities
  writeSectionHeader('Operating Activities');
  operatingLineItems.forEach((item: any) => {
    const label = item.auto ? `${item.name}(auto)` : item.name;
    ws.addRow([label, item.amount / 100]).getCell(2).numFmt = numF;
  });
  boldRow('Net Cash from Operating Activities', cf.operatingActivities?.total || 0);
  ws.addRow([]);

  // 2. Investing Activities
  writeSectionHeader('Investing Activities');
  (investing.items || []).forEach((item: any) => {
    ws.addRow([item.name, item.amount / 100]).getCell(2).numFmt = numF;
  });
  boldRow('Net Cash from Investing Activities', investing.total || 0);
  ws.addRow([]);

  // 3. Financing Activities
  writeSectionHeader('Financing Activities');
  (financing.items || []).forEach((item: any) => {
    ws.addRow([item.name, item.amount / 100]).getCell(2).numFmt = numF;
  });
  boldRow('Net Cash from Financing Activities', financing.total || 0);
  ws.addRow([]);

  // Summary
  writeSectionHeader('Summary');
  ws.addRow(['Net increase in cash and cash equivalents', cf.netChangeInCash / 100]).getCell(2).numFmt = numF;
  ws.addRow(['Cash and cash equivalents at the beginning of the year', cf.openingCash / 100]).getCell(2).numFmt = numF;
  ws.addRow([]);
  const totRow = ws.addRow(['Cash and cash equivalents at the end of the year', cf.closingCash / 100]);
  totRow.eachCell((cell, idx) => {
    cell.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F766E' } };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
    if (idx === 2) {
      cell.numFmt = numF;
      cell.alignment = { horizontal: 'right' };
    }
  });
  ws.addRow([]);

  // Cash & Cash Equivalents Breakdown
  writeSectionHeader('Cash & Cash Equivalents Breakdown');
  ws.addRow(['Cash & Bank balance', (cb.cashAndBankBalance || 0) / 100]).getCell(2).numFmt = numF;
  ws.addRow(['Term Deposit', (cb.termDeposit || 0) / 100]).getCell(2).numFmt = numF;
  ws.addRow(['Term Loan (deduction)', (cb.termLoan || 0) / 100]).getCell(2).numFmt = numF;
  const offBy = Math.abs(cb.reconciliationDiff || 0) > 1 ? ` (off by ${(cb.reconciliationDiff || 0) / 100})` : '';
  boldRow(`Reconciliation to closing cash${offBy}`, cb.breakdownTotal || 0);
  ws.addRow([]);

  // Align cells
  ws.eachRow((row) => {
    if (row.number > 5) {
      row.getCell(2).alignment = { horizontal: 'right' };
    }
  });

  ws.columns = [
    { width: 62 },
    { width: 25 }
  ];

  await addNotesSheet(workbook, orgId, 'cash_flow');

  return writeWorkbookToBuffer(workbook);
}
