/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import PDFDocument from 'pdfkit';
import { eq, and, sql, gte, lte, desc, asc } from 'drizzle-orm';
import {
  db,
  invoices,
  invoiceLines,
  contacts,
  organisations,
  employees,
  payrollRuns,
  payrollLines,
  bills,
  billLines,
  paymentsReceived,
  paymentsMade,
  creditNotes,
  vendorCredits,
  accounts,
  journalLines,
  journalEntries,
  budgets,
  budgetLines,
  fixedAssets,
  auditLog,
  users
} from '../db/schema';
import { AppError } from '../lib/errors';
import { getTrialBalance, getProfitAndLoss, getBalanceSheet, getCashFlowStatement } from './ledger.service';
import { getInvoiceAgingReport } from './invoice.service';
import { getBillAgingReport } from './bill.service';

// Helper to convert kobo integer to formatted Naira string
function formatNaira(koboAmount: number): string {
  const naira = koboAmount / 100;
  return 'NGN ' + naira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Helper to format Date beautifully
function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Utility to wrap PDF document generation in a promise returning a Buffer
function generatePDFBuffer(builder: (doc: any) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));
    try {
      builder(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Universal header draw helper
function drawReportHeader(doc: any, title: string, subtitle: string, orgName: string, orgSettings: any, themeColor: string) {
  const startX = 40;
  doc.rect(startX, 40, 50, 45).fill(themeColor);
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text(orgName.substring(0, 2).toUpperCase(), startX + 11, 51);

  doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold').text(orgName, startX + 65, 40);
  doc.fontSize(8).font('Helvetica').fillColor('#4b5563');
  doc.text(orgSettings?.address || 'Lagos, Nigeria', startX + 65, 55);
  doc.text(`Email: ${orgSettings?.email || 'finance@os.ng'} | VAT: ${orgSettings?.vatNumber || ''}`, startX + 65, 66);

  doc.fillColor(themeColor).fontSize(16).font('Helvetica-Bold').text(title, 330, 40, { align: 'right', width: 225 });
  doc.fontSize(8).fillColor('#4b5563').text(subtitle, 330, 58, { align: 'right', width: 225 });

  doc.moveTo(startX, 95).lineTo(555, 95).strokeColor('#e5e7eb').lineWidth(1).stroke();
}

// Universal stripe table drawer
function drawStripeTable(
  doc: any,
  yStart: number,
  headers: string[],
  widths: number[],
  aligns: ('left' | 'right' | 'center')[],
  rows: any[][],
  rowHeight = 18,
  headerColor = '#1e3a8a'
): number {
  let y = yStart;
  const startX = 40;

  // Header background
  doc.rect(startX, y, 515, rowHeight + 2).fill(headerColor);
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
  let x = startX;
  headers.forEach((h, i) => {
    doc.text(h, x + 5, y + 6, { width: widths[i] - 10, align: aligns[i] });
    x += widths[i];
  });
  y += rowHeight + 2;

  // Data rows
  doc.font('Helvetica').fontSize(7.5).fillColor('#1f2937');
  rows.forEach((row, rIdx) => {
    // Check page overflow
    if (y > 720) {
      doc.addPage();
      y = 50; // top offset on new page
      // Redraw header
      doc.rect(startX, y, 515, rowHeight + 2).fill(headerColor);
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
      let xx = startX;
      headers.forEach((h, i) => {
        doc.text(h, xx + 5, y + 6, { width: widths[i] - 10, align: aligns[i] });
        xx += widths[i];
      });
      y += rowHeight + 2;
    }

    if (rIdx % 2 === 1) {
      doc.rect(startX, y, 515, rowHeight).fill('#fafbff');
    }
    doc.fillColor('#1f2937');
    x = startX;
    row.forEach((val, cIdx) => {
      doc.text(String(val), x + 5, y + 5, { width: widths[cIdx] - 10, align: aligns[cIdx] });
      x += widths[cIdx];
    });
    y += rowHeight;
  });

  return y;
}

// =========================================================================
// 1. INVOICE PDF GENERATION
// =========================================================================
export async function generateInvoicePDF(invoiceId: string, orgId: string): Promise<Buffer> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.orgId, orgId)))
    .limit(1);

  if (!invoice) {
    throw new AppError('Requested invoice was not found under this organisation.', 404);
  }

  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  if (!org) {
    throw new AppError('Organization context not found.', 404);
  }

  const [client] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, invoice.customerId))
    .limit(1);

  if (!client) {
    throw new AppError('Invoice customer profile was not found.', 404);
  }

  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId));

  const orgSettings = typeof org.settings === 'string' ? JSON.parse(org.settings) : (org.settings || {});
  const brandColor = orgSettings.branding?.primaryColor || '#1e3a8a';

  return generatePDFBuffer((doc) => {
    const PRIMARY_COLOR = brandColor;
    const TEXT_PRIMARY = '#1f2937';
    const MUTED_COLOR = '#4b5563';
    const ACCENT_COLOR = '#10b981';

    const colWidth = [30, 220, 60, 80, 50, 75];
    const startX = 40;

    doc.rect(startX, 40, 50, 50).fill(PRIMARY_COLOR);
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(org.name.substring(0, 2).toUpperCase(), startX + 11, 52);

    doc.fillColor(TEXT_PRIMARY).fontSize(14).font('Helvetica-Bold').text(org.name, startX + 65, 40);
    doc.fontSize(8).font('Helvetica').fillColor(MUTED_COLOR);
    doc.text(org.address || 'No 1, Commercial Avenue, Lagos, Nigeria', startX + 65, 55);
    doc.text(`Phone: ${org.phone || '+234-800-FINANCEOS'} | Email: ${org.email || 'billing@financeos.ng'}`, startX + 65, 66);
    if (org.rcNumber || org.vatNumber) {
      doc.text(`RC Number: ${org.rcNumber || 'RC-XXXXXX'} | VAT: ${org.vatNumber || 'VAT-NGR-XXXX'}`, startX + 65, 77);
    }

    doc.fillColor(PRIMARY_COLOR).fontSize(20).font('Helvetica-Bold').text('INVOICE', 400, 40, { align: 'right' });
    const statusText = (invoice.status || 'draft').toUpperCase();
    doc.fontSize(10).fillColor(invoice.status === 'paid' ? ACCENT_COLOR : '#f59e0b').text(statusText, 400, 63, { align: 'right' });

    doc.moveTo(startX, 105).lineTo(555, 105).strokeColor('#e5e7eb').lineWidth(1).stroke();

    let y = 120;
    doc.fillColor(TEXT_PRIMARY).fontSize(9).font('Helvetica-Bold').text('BILL TO:', startX, y);
    doc.font('Helvetica-Bold').text('INVOICE DETAILS:', 350, y);

    y += 13;
    doc.fontSize(10).font('Helvetica-Bold').text(client.name, startX, y);
    doc.font('Helvetica-Bold').fontSize(9).text(`Invoice Number:`, 350, y);
    doc.font('Helvetica').text(invoice.invoiceNumber, 440, y);

    y += 13;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED_COLOR).text(client.address || '-', startX, y);
    doc.text(`${client.city || ''}, ${client.state || ''}`, startX, y + 10);
    doc.text(`Email: ${client.email || '-'}`, startX, y + 20);
    doc.text(`TIN: ${client.taxPin || '-'}`, startX, y + 30);

    doc.fillColor(TEXT_PRIMARY).font('Helvetica-Bold').text(`Issue Date:`, 350, y);
    doc.font('Helvetica').text(formatShortDate(invoice.date), 440, y);
    doc.font('Helvetica-Bold').text(`Due Date:`, 350, y + 12);
    doc.font('Helvetica').text(formatShortDate(invoice.dueDate), 440, y + 12);
    doc.font('Helvetica-Bold').text(`Terms:`, 350, y + 24);
    doc.font('Helvetica').text(invoice.paymentTerms ? `${invoice.paymentTerms} Days` : 'Due on Receipt', 440, y + 24);

    y = 205;
    doc.rect(startX, y, 515, 20).fill(brandColor);
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    
    doc.text('#', startX + 5, y + 6);
    doc.text('Description', startX + colWidth[0] + 5, y + 6);
    doc.text('Qty', startX + colWidth[0] + colWidth[1] + 5, y + 6, { width: colWidth[2] - 10, align: 'right' });
    doc.text('Unit Price', startX + colWidth[0] + colWidth[1] + colWidth[2] + 5, y + 6, { width: colWidth[3] - 10, align: 'right' });
    doc.text('VAT%', startX + colWidth[0] + colWidth[1] + colWidth[2] + colWidth[3] + 5, y + 6, { width: colWidth[4] - 10, align: 'right' });
    doc.text('Amount', startX + colWidth[0] + colWidth[1] + colWidth[2] + colWidth[3] + colWidth[4] + 5, y + 6, { width: colWidth[5] - 10, align: 'right' });

    y += 20;

    doc.fillColor(TEXT_PRIMARY).font('Helvetica').fontSize(8);
    lines.forEach((line, index) => {
      if (index % 2 === 1) {
        doc.rect(startX, y, 515, 18).fill('#fafdff');
      }
      doc.fillColor(TEXT_PRIMARY);
      doc.text(String(index + 1), startX + 5, y + 5);
      doc.text(line.description || 'Line Item Description', startX + colWidth[0] + 5, y + 5, { width: colWidth[1] - 10, lineBreak: false });
      doc.text(Number(line.quantity).toString(), startX + colWidth[0] + colWidth[1] + 5, y + 5, { width: colWidth[2] - 10, align: 'right' });
      doc.text(formatNaira(line.unitPrice), startX + colWidth[0] + colWidth[1] + colWidth[2] + 5, y + 5, { width: colWidth[3] - 10, align: 'right' });
      doc.text(line.taxRate ? `${parseFloat(line.taxRate.toString())}%` : '0%', startX + colWidth[0] + colWidth[1] + colWidth[2] + colWidth[3] + 5, y + 5, { width: colWidth[4] - 10, align: 'right' });
      doc.text(formatNaira(line.lineTotal), startX + colWidth[0] + colWidth[1] + colWidth[2] + colWidth[3] + colWidth[4] + 5, y + 5, { width: colWidth[5] - 10, align: 'right' });

      y += 18;
    });

    doc.moveTo(startX, y).lineTo(555, y).strokeColor('#e5e7eb').stroke();
    y += 10;

    const summaryLabelX = 350;
    const summaryValX = 475;

    doc.fillColor(MUTED_COLOR).fontSize(8).font('Helvetica');
    doc.text('Subtotal:', summaryLabelX, y);
    doc.fillColor(TEXT_PRIMARY).text(formatNaira(invoice.subtotal), summaryValX, y, { align: 'right' });

    y += 12;
    doc.fillColor(MUTED_COLOR).text('Discount Amount:', summaryLabelX, y);
    doc.fillColor(TEXT_PRIMARY).text(formatNaira(invoice.discountAmount), summaryValX, y, { align: 'right' });

    y += 12;
    doc.fillColor(MUTED_COLOR).text('VAT Tax:', summaryLabelX, y);
    doc.fillColor(TEXT_PRIMARY).text(formatNaira(invoice.taxAmount), summaryValX, y, { align: 'right' });

    y += 14;
    doc.rect(summaryLabelX - 10, y - 4, 215, 20).fill('#f3f4f6');
    doc.fillColor(TEXT_PRIMARY).font('Helvetica-Bold').fontSize(10);
    doc.text('TOTAL:', summaryLabelX, y + 1);
    doc.text(formatNaira(invoice.total), summaryValX, y + 1, { align: 'right' });

    y += 22;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED_COLOR);
    doc.text('Amount Paid:', summaryLabelX, y);
    doc.fillColor(TEXT_PRIMARY).text(formatNaira(invoice.amountPaid), summaryValX, y, { align: 'right' });

    y += 12;
    doc.font('Helvetica-Bold').text('Balance Due:', summaryLabelX, y);
    doc.text(formatNaira(invoice.balanceDue), summaryValX, y, { align: 'right' });

    y = 520;
    doc.moveTo(startX, y).lineTo(555, y).strokeColor('#e5e7eb').stroke();
    y += 15;

    doc.fillColor(PRIMARY_COLOR).fontSize(9).font('Helvetica-Bold').text('PAYMENT BANK DETAILS', startX, y);
    doc.fontSize(8).fillColor(TEXT_PRIMARY).font('Helvetica');
    y += 12;
    doc.text(`Banker Name: Access Bank Plc`, startX, y);
    doc.text(`Account Name: ${org.name}`, startX, y + 10);
    doc.text(`Account Number: 1023904582`, startX, y + 20);

    doc.fillColor(MUTED_COLOR).text('TERMS AND CONDITIONS', 300, y - 12);
    doc.text(invoice.terms || 'Payment is strictly due within specified due-date terms. Late payments might attract a standard fine.', 300, y, { width: 255 });

    doc.fillColor('#9ca3af').fontSize(7).text('FinanceOS Cloud Ledger Workstation — Thank you for your business.', startX, 750, { align: 'center' });
  });
}

// =========================================================================
// 2. PAYSLIP PDF GENERATION
// =========================================================================
export async function generatePayslipPDF(payrollLineId: string): Promise<Buffer> {
  const [line] = await db
    .select()
    .from(payrollLines)
    .where(eq(payrollLines.id, payrollLineId))
    .limit(1);

  if (!line) {
    throw new AppError('Requested payroll breakdown line was not found.', 404);
  }

  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, line.runId))
    .limit(1);

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, line.employeeId))
    .limit(1);

  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, run.orgId))
    .limit(1);

  let logoBuffer: Buffer | null = null;
  if (org.logoUrl) {
    try {
      const resp = await fetch(org.logoUrl);
      if (resp.ok) logoBuffer = Buffer.from(await resp.arrayBuffer());
    } catch { /* ignore */ }
  }

  const orgSettings = typeof org.settings === 'string' ? JSON.parse(org.settings) : (org.settings || {});
  const brandColor = orgSettings.branding?.primaryColor || '#0f172a';
  const nhisVal = (line as any).nhis || 0;
  const intDed = Array.isArray((line as any).internalDeductions) ? (line as any).internalDeductions : [];
  const intDedTotal = intDed.reduce((s: number, d: any) => s + (d.amount || 0), 0);
  const gp = line.grossPay;

  // Use stored line values for earnings breakdown (backend now computes these properly)
  const basicAmt = line.basic;
  const housingAmt = line.housing;
  const transportAmt = line.transport;
  const otherAllowancesAmt = line.otherAllowances;
  // utilities/meals not stored in db yet — derive from employee pcts
  const up = employee.utilitiesPct ?? 10;
  const mp = employee.mealsPct ?? 5;
  const bp = employee.basicSalaryPct ?? 50;
  const hp = employee.housingPct ?? 20;
  const tp = employee.transportPct ?? 10;
  const op = employee.othersPct ?? 5;
  const sumPct = bp + hp + tp + up + mp + op;
  const utilitiesAmt = Math.round(gp * up / sumPct);
  const mealsAmt = Math.round(gp * mp / sumPct);
  const othersAmt = gp - basicAmt - housingAmt - transportAmt - utilitiesAmt - mealsAmt;
  // Recompute total deduction covering all items
  const totalDeducts = line.paye + line.pensionEmployee + nhisVal + line.nhf + intDedTotal;

  // Compute annual / chargeable logic for PDF display
  const annualGross = gp * 12;
  const annualPension = (line.pensionEmployee || 0) * 12;
  const annualNHIS = nhisVal * 12;
  const annualNHF = (line.nhf || 0) * 12;

  // Re-derive relief for display (read from stored taxRelief column)
  const rentRelief = line.taxRelief || 0;
  // mortgage / life not stored separately — skip if unavailable
  const hasRelief = rentRelief > 0;

  const chargeableIncome = Math.max(0, annualGross - annualPension - annualNHIS - annualNHF - rentRelief);
  const annualPAYE = (line.paye || 0) * 12;
  const effectiveRate = annualGross > 0 ? Number((annualPAYE / annualGross * 100).toFixed(2)) : 0;

  const orgContactItems: string[] = [];
  if (org.address) orgContactItems.push(org.address);
  if (org.phone) orgContactItems.push(`Tel: ${org.phone}`);
  if (org.email) orgContactItems.push(org.email);

  return generatePDFBuffer((doc) => {
    const TEXT_PRIMARY = '#0f172a';
    const MUTED_COLOR = '#475569';
    const LIGHT_BORDER = '#e2e8f0';
    const SECTION_HDR = '#8b9ab0';
    const DARK_HEADER = '#1e3a5f';
    const startX = 40;
    const pageW = 515;
    let y = 30;

    // ── Modern Header ──
    doc.rect(startX, y, pageW, 52).fill(DARK_HEADER);
    // Logo
    if (logoBuffer) {
      doc.save();
      doc.circle(startX + 30, y + 26, 20);
      doc.clip();
      doc.image(logoBuffer, startX + 12, y + 8, { width: 36, height: 36 });
      doc.restore();
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text(org.name, startX + 54, y + 10);
    } else {
      doc.roundedRect(startX + 14, y + 10, 36, 36, 9).fillColor('#ffffff').opacity(0.1).fill();
      doc.opacity(1).fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text((org.name || 'S').substring(0, 1).toUpperCase(), startX + 28, y + 18);
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text(org.name, startX + 56, y + 10);
    }
    doc.fontSize(7).font('Helvetica').fillColor('#a0b8d4').text(orgContactItems.join(' • '), startX + 54, y + 25);
    // Badge
    const badgeW = 130;
    doc.roundedRect(startX + pageW - badgeW - 10, y + 10, badgeW, 22, 11).fillColor('#ffffff').opacity(0.1).fill();
    doc.opacity(1).fillColor('#e8f0fe').fontSize(12).font('Helvetica-Bold').text(`PAYSLIP`, startX + pageW - badgeW - 10 + 12, y + 14, { align: 'left' });
    doc.fillColor('#e8f0fe').fontSize(10).font('Helvetica-Bold').text(run?.runNumber || '', startX + pageW - 12, y + 16, { align: 'right' });
    y += 62;

    // ── Employee Row (clean two-column) ──
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e3a5f').text(`${employee.firstName} ${employee.lastName}`, startX, y);
    const empLine = [employee.staffId, employee.department, employee.designation].filter(Boolean).join(' • ');
    doc.fontSize(7.5).font('Helvetica').fillColor(MUTED_COLOR);
    if (empLine) doc.text(empLine, startX, y + 14);
    if (employee.email) doc.text(employee.email, startX, y + (empLine ? 24 : 14));
    if (employee.phone) doc.text(employee.phone, startX, y + (empLine ? 33 : (employee.email ? 23 : 14)));
    if (employee.address) doc.text(employee.address, startX, y + (empLine ? 42 : (employee.email ? 32 : (employee.phone ? 22 : 14))));

    // Period on the right
    doc.fontSize(7).font('Helvetica').fillColor(MUTED_COLOR);
    doc.text('Period', startX + pageW - 155, y);
    doc.font('Helvetica-Bold').fillColor(TEXT_PRIMARY).text(`${formatShortDate(run.periodStart)} – ${formatShortDate(run.periodEnd)}`, startX + pageW - 125, y);
    doc.font('Helvetica').fillColor(MUTED_COLOR).text('Pay Date', startX + pageW - 155, y + 10);
    doc.font('Helvetica-Bold').fillColor(TEXT_PRIMARY).text(formatShortDate(run.payDate), startX + pageW - 125, y + 10);

    const empBottom = employee.address ? y + 52 : employee.phone ? y + 43 : employee.email ? y + 33 : y + 24;
    y = empBottom + 16;

    // Draw separator line
    doc.moveTo(startX, y).lineTo(startX + pageW, y).strokeColor(LIGHT_BORDER).lineWidth(1).stroke();
    y += 14;

    // ── Two-column Card Layout: Earnings | Statutory Deductions ──
    const colW = 248;
    const gap = 19;
    const leftCol = startX;
    const rightCol = startX + colW + gap;

    // Helper: draw a bordered card
    function drawCard(d: any, cx: number, cy: number, cw: number, rows: { l: string; v: string; b?: boolean; ital?: boolean }[], total?: { l: string; v: string }) {
      d.roundedRect(cx, cy, cw, 4, 4).fillColor('#fff').fill();
      d.roundedRect(cx, cy, cw, 4, 4).lineWidth(1).strokeColor(LIGHT_BORDER).stroke();
      d.fontSize(7.5).fillColor(TEXT_PRIMARY);
      rows.forEach((r, idx) => {
        const ry = cy + 6 + idx * 11;
        d.rect(cx, ry, cw, 11).fillColor(idx % 2 === 1 ? '#f8fafc' : '#ffffff').fill();
        d.fillColor(TEXT_PRIMARY);
        d.font(r.b ? 'Helvetica-Bold' : r.ital ? 'Helvetica-Oblique' : 'Helvetica');
        d.text(r.l, cx + 8, ry + 2);
        d.font(r.b ? 'Helvetica-Bold' : 'Helvetica');
        d.text(r.v, cx + cw - 8, ry + 2, { align: 'right' });
      });
      d.fillColor('#ffffff').fill();
      if (total) {
        const ty = cy + 6 + rows.length * 11;
        d.rect(cx, ty, cw, 13).fillColor('#f1f5f9').fill();
        const borderY = ty - 1;
        d.lineWidth(1.5).strokeColor('#1e3a5f').moveTo(cx + 4, borderY).lineTo(cx + cw - 4, borderY).stroke();
        d.fillColor('#1e3a5f').font('Helvetica-Bold').fontSize(7.5);
        d.text(total.l, cx + 8, ty + 3);
        d.text(total.v, cx + cw - 8, ty + 3, { align: 'right' });
        return ty + 13;
      }
      return cy + 6 + rows.length * 11;
    }

    // Section header
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor(SECTION_HDR);
    doc.text('EARNINGS', leftCol, y);
    doc.text('STATUTORY DEDUCTIONS', rightCol, y);
    y += 8;

    // Earnings rows
    const earns = [
      { l: 'Basic Salary', v: formatNaira(basicAmt) },
      { l: 'Housing Allowance', v: formatNaira(housingAmt) },
      { l: 'Transport Allowance', v: formatNaira(transportAmt) },
      { l: 'Utilities Allowance', v: formatNaira(utilitiesAmt) },
      { l: 'Meals Allowance', v: formatNaira(mealsAmt) },
      { l: 'Other Allowances', v: formatNaira(otherAllowancesAmt) },
    ];

    // Deduction rows
    const deducts: { l: string; v: string; ital?: boolean }[] = [
      { l: 'PAYE Tax', v: formatNaira(line.paye) },
      { l: 'Pension (EE)', v: formatNaira(line.pensionEmployee) },
      { l: 'NHIS', v: formatNaira(nhisVal) },
      { l: 'NHF', v: formatNaira(line.nhf) },
    ];
    intDed.forEach((d: any) => {
      deducts.push({ l: d.description, v: formatNaira(d.amount || 0), ital: true });
    });

    const eTop = drawCard(doc, leftCol, y, colW, earns, { l: 'Total Gross', v: formatNaira(gp) });
    const dTop = drawCard(doc, rightCol, y, colW, deducts, { l: 'Total Deductions', v: formatNaira(totalDeducts) });
    y = Math.max(eTop, dTop) + 16;

    // ── Net Pay Panel (gradient look) ──
    doc.roundedRect(startX, y, pageW, 28, 8).fillColor('#1e3a5f').fill();
    // Simulate gradient with a lighter rect on left
    doc.roundedRect(startX, y, pageW * 0.55, 28, 8).fillColor('#2d5a87').fill();
    doc.fillColor('#b8cfe8').fontSize(7).font('Helvetica-Bold').text('NET PAY', startX + 18, y + 4);
    doc.fontSize(6).font('Helvetica').fillColor('#8aadd0').text('After all statutory & internal deductions', startX + 18, y + 13);
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text(formatNaira(line.netPay), startX + pageW - 18, y + 5, { align: 'right' });
    y += 36;

    // ── Two-column: Tax Computation (Annual) | Payment Info ──
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor(SECTION_HDR);
    doc.text('TAX COMPUTATION (ANNUAL)', leftCol, y);
    doc.text('PAYMENT INFO', rightCol, y);
    y += 8;

    const taxItems: { l: string; v: string; b?: boolean; ital?: boolean }[] = [
      { l: 'Annual Gross', v: formatNaira(annualGross) },
      { l: 'Less: Pension (EE)', v: formatNaira(annualPension) },
      { l: 'Less: NHIS', v: formatNaira(annualNHIS) },
      { l: 'Less: NHF', v: formatNaira(annualNHF) },
    ];
    if (hasRelief) {
      taxItems.push({ l: 'Less: Tax Reliefs (Monthly)', v: '', b: true });
    }
    taxItems.push({ l: '  Rent Relief', v: formatNaira(rentRelief || 0), ital: true });
    const mortgageRelief = (line as any).mortgageInterestRelief || 0;
    const lifeRelief = (line as any).lifeAssuranceRelief || 0;
    taxItems.push({ l: '  Mortgage Loan Interest', v: formatNaira(mortgageRelief), ital: true });
    taxItems.push({ l: '  Life Insurance', v: formatNaira(lifeRelief), ital: true });
    taxItems.push({ l: 'Chargeable Income', v: formatNaira(chargeableIncome), b: true });
    taxItems.push({ l: 'Annual PAYE', v: formatNaira(annualPAYE) });
    taxItems.push({ l: 'Effective Rate', v: `${effectiveRate.toFixed(2)}%` });

    const taxEnd = drawCard(doc, leftCol, y, colW, taxItems);

    const payInfoRows = [
      { l: 'Bank', v: employee.bankName || '—' },
      { l: 'Account', v: employee.accountNumber || '—' },
      { l: 'Tax ID', v: employee.taxId || '—' },
    ];
    if (employee.pensionPin) payInfoRows.push({ l: 'Pension PIN', v: employee.pensionPin });
    if (employee.nhfNumber) payInfoRows.push({ l: 'NHF Number', v: employee.nhfNumber });

    const payEnd = drawCard(doc, rightCol, y, colW, payInfoRows);
    y = Math.max(taxEnd, payEnd) + 14;

    // ── Employer Contributions ──
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor(SECTION_HDR);
    doc.text('EMPLOYER CONTRIBUTIONS', leftCol, y);
    y += 8;
    const erRows: { l: string; v: string; b?: boolean; ital?: boolean }[] = [
      { l: 'Pension (ER 10%)', v: formatNaira(line.pensionEmployer) },
      { l: 'Total Pension Obligation', v: formatNaira((line.pensionEmployee || 0) + (line.pensionEmployer || 0)), b: true },
    ];
    y = drawCard(doc, leftCol, y, colW, erRows) + 16;

    // ── Tax Band Breakdown Table ──
    const bands = [
      { name: 'First ₦800,000 @ 0%', limit: 800000 * 100, rate: 0.00 },
      { name: 'Next ₦2,200,000 @ 15%', limit: 2200000 * 100, rate: 0.15 },
      { name: 'Next ₦9,000,000 @ 18%', limit: 9000000 * 100, rate: 0.18 },
      { name: 'Next ₦13,000,000 @ 21%', limit: 13000000 * 100, rate: 0.21 },
      { name: 'Next ₦25,000,000 @ 23%', limit: 25000000 * 100, rate: 0.23 },
      { name: 'Above ₦50,000,000 @ 25%', limit: Infinity, rate: 0.25 },
    ];
    let remaining = chargeableIncome;
    const bandRows: { name: string; rate: number; taxable: number; tax: number }[] = [];
    for (const b of bands) {
      if (remaining <= 0) break;
      const taxable = Math.min(remaining, b.limit);
      const tax = Math.round(taxable * b.rate);
      bandRows.push({ name: b.name, rate: b.rate, taxable, tax });
      remaining -= taxable;
    }

    if (bandRows.length > 0) {
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor(SECTION_HDR);
      doc.text('TAX BAND BREAKDOWN', startX, y);
      y += 8;

      // Table header with dark background - narrower & centered
      const tw = Math.round(pageW * 0.75);
      const tx = startX + Math.round((pageW - tw) / 2);
      const bw = [Math.round(tw * 0.38), Math.round(tw * 0.12), Math.round(tw * 0.25), tw - Math.round(tw * 0.38) - Math.round(tw * 0.12) - Math.round(tw * 0.25)];
      doc.roundedRect(tx, y, tw, 14, 4).fillColor('#1e3a5f').fill();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6);
      doc.text('Band', tx + 8, y + 4);
      doc.text('Rate', tx + bw[0] + 8, y + 4, { align: 'right', width: bw[1] - 16 });
      doc.text('Taxable Amount', tx + bw[0] + bw[1] + 8, y + 4, { align: 'right', width: bw[2] - 16 });
      doc.text('Tax', tx + bw[0] + bw[1] + bw[2] + 8, y + 4, { align: 'right', width: bw[3] - 16 });
      y += 14;

      bandRows.forEach((b, idx) => {
        if (y > 740) { doc.addPage(); y = 40; }
        doc.rect(tx, y, tw, 10).fillColor(idx % 2 === 0 ? '#ffffff' : '#f8fafc').fill();
        doc.rect(tx, y, tw, 10).lineWidth(0.5).strokeColor('#eef2f6').stroke();
        doc.fillColor(TEXT_PRIMARY).font('Helvetica').fontSize(6);
        doc.text(b.name, tx + 8, y + 2);
        doc.text(`${(b.rate * 100).toFixed(0)}%`, tx + bw[0] + 8, y + 2, { align: 'right', width: bw[1] - 16 });
        doc.text(formatNaira(b.taxable), tx + bw[0] + bw[1] + 8, y + 2, { align: 'right', width: bw[2] - 16 });
        doc.text(formatNaira(b.tax), tx + bw[0] + bw[1] + bw[2] + 8, y + 2, { align: 'right', width: bw[3] - 16 });
        y += 10;
      });
      y += 10;
    }

    // ── Annual Overview Metrics Grid ──
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor(SECTION_HDR);
    doc.text('ANNUAL OVERVIEW', startX, y);
    y += 8;

    const metrics = [
      { l: 'Annual Gross', v: formatNaira(annualGross) },
      { l: 'Annual PAYE', v: formatNaira(annualPAYE) },
      { l: 'Monthly PAYE', v: formatNaira(line.paye) },
      { l: 'Annual Net Pay', v: formatNaira(line.netPay * 12) },
    ];
    const mw = (pageW - 18) / 4;
    metrics.forEach((m, i) => {
      const mx = startX + i * (mw + 6);
      doc.roundedRect(mx, y, mw, 34, 8).fillColor('#fafbfc').fill();
      doc.roundedRect(mx, y, mw, 34, 8).lineWidth(1).strokeColor(LIGHT_BORDER).stroke();
      doc.fillColor(SECTION_HDR).fontSize(6).font('Helvetica-Bold').text(m.l, mx + 4, y + 5, { width: mw - 8, align: 'center' });
      doc.fillColor(TEXT_PRIMARY).fontSize(11).font('Helvetica-Bold').text(m.v, mx + 4, y + 16, { width: mw - 8, align: 'center' });
    });
    y += 40;

    // ── Footer ──
    doc.fontSize(6.5).fillColor('#94a3b8').text(
      `${org.name} • Confidential • Computer-generated document`,
      startX, y, { align: 'center', width: pageW }
    );
  });
}

// =========================================================================
// 3. CONTACT STATEMENT PDF GENERATION
// =========================================================================
export async function generateStatementPDF(
  contactId: string,
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)))
    .limit(1);

  if (!contact) {
    throw new AppError('Profile for statement generation context was not identified.', 404);
  }

  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  const isCustomer = contact.type === 'customer' || contact.type === 'both';

  const invoicesList = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), eq(invoices.customerId, contactId)));

  const pRecList = await db
    .select()
    .from(paymentsReceived)
    .where(and(eq(paymentsReceived.orgId, orgId), eq(paymentsReceived.customerId, contactId)));

  const creditNotesList = await db
    .select()
    .from(creditNotes)
    .where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.customerId, contactId)));

  const billsList = await db
    .select()
    .from(bills)
    .where(and(eq(bills.orgId, orgId), eq(bills.vendorId, contactId)));

  const pMadeList = await db
    .select()
    .from(paymentsMade)
    .where(and(eq(paymentsMade.orgId, orgId), eq(paymentsMade.vendorId, contactId)));

  const vCreditsList = await db
    .select()
    .from(vendorCredits)
    .where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.vendorId, contactId)));

  const allTxns: any[] = [];

  invoicesList.forEach(inv => {
    if (inv.status === 'draft') return;
    allTxns.push({
      date: new Date(inv.date),
      number: inv.invoiceNumber,
      type: 'Sales Invoice',
      debit: inv.total,
      credit: 0
    });
  });

  pRecList.forEach(pmt => {
    allTxns.push({
      date: new Date(pmt.date),
      number: pmt.paymentNumber,
      type: 'Client Payment',
      debit: 0,
      credit: pmt.amount
    });
  });

  creditNotesList.forEach(cn => {
    if (cn.status === 'draft') return;
    allTxns.push({
      date: new Date(cn.date),
      number: cn.cnNumber,
      type: 'Customer Credit',
      debit: 0,
      credit: cn.total
    });
  });

  billsList.forEach(bl => {
    if (bl.status === 'draft') return;
    allTxns.push({
      date: new Date(bl.date),
      number: bl.billNumber,
      type: 'Vendor Bill',
      debit: 0,
      credit: bl.total
    });
  });

  pMadeList.forEach(pmt => {
    allTxns.push({
      date: new Date(pmt.date),
      number: pmt.paymentNumber,
      type: 'Bank Transfer Disbursed',
      debit: pmt.amount,
      credit: 0
    });
  });

  vCreditsList.forEach(vc => {
    allTxns.push({
      date: new Date(vc.date),
      number: vc.vcNumber,
      type: 'Vendor Adjustment Credit',
      debit: vc.total,
      credit: 0
    });
  });

  allTxns.sort((a, b) => a.date.getTime() - b.date.getTime());

  let runningBalRaw = 0;
  let openingBalance = 0;
  const currentPeriodTxns: any[] = [];

  allTxns.forEach(txn => {
    if (isCustomer) {
      runningBalRaw += (txn.debit - txn.credit);
    } else {
      runningBalRaw += (txn.credit - txn.debit);
    }

    if (txn.date.getTime() < startDate.getTime()) {
      openingBalance = runningBalRaw;
    } else if (txn.date.getTime() <= endDate.getTime()) {
      currentPeriodTxns.push({
        ...txn,
        balanceAfter: runningBalRaw
      });
    }
  });

  const closingBalance = runningBalRaw;

  const orgSettings = typeof org.settings === 'string' ? JSON.parse(org.settings) : (org.settings || {});
  const brandColor = orgSettings.branding?.primaryColor || '#0f766e';

  return generatePDFBuffer((doc) => {
    const PRIMARY_COLOR = brandColor;
    const TEXT_PRIMARY = '#1f2937';
    const MUTED_COLOR = '#4b5563';
    const startX = 40;

    doc.rect(startX, 40, 50, 50).fill(PRIMARY_COLOR);
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(org.name.substring(0, 2).toUpperCase(), startX + 11, 52);

    doc.fillColor(TEXT_PRIMARY).fontSize(14).font('Helvetica-Bold').text(org.name, startX + 65, 40);
    doc.fontSize(8).font('Helvetica').fillColor(MUTED_COLOR);
    doc.text(org.address || 'No 1, Commercial Avenue, Lagos, Nigeria', startX + 65, 55);
    doc.text(`VAT: ${org.vatNumber || '-'} | RC: ${org.rcNumber || '-'}`, startX + 65, 66);

    doc.fillColor(PRIMARY_COLOR).fontSize(18).font('Helvetica-Bold').text('STATEMENT OF ACCOUNT', 350, 40, { align: 'right' });
    doc.fontSize(8).fillColor(MUTED_COLOR).text(`Duration: ${formatShortDate(startDate)} - ${formatShortDate(endDate)}`, 350, 60, { align: 'right' });

    doc.moveTo(startX, 105).lineTo(555, 105).strokeColor('#e5e7eb').stroke();

    let y = 120;
    doc.fillColor(TEXT_PRIMARY).fontSize(9).font('Helvetica-Bold').text('ISSUED TO:', startX, y);
    doc.text('STATEMENT SUMMARY', 350, y);

    y += 12;
    doc.fontSize(10).font('Helvetica-Bold').text(contact.name, startX, y);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED_COLOR).text(contact.address || '-', startX, y + 11);
    doc.text(`${contact.city || ''}, ${contact.state || ''}`, startX, y + 21);
    doc.text(`Email: ${contact.email || ''}`, startX, y + 31);

    doc.rect(340, y - 4, 215, 60).fill('#f9fafb');
    doc.fillColor(TEXT_PRIMARY).font('Helvetica').fontSize(8);
    doc.text('Opening Balance:', 350, y + 2);
    doc.fillColor(TEXT_PRIMARY).text(formatNaira(openingBalance), 470, y + 2, { align: 'right', width: 75 });

    doc.fillColor(MUTED_COLOR).text(isCustomer ? 'Total Sales Invoiced:' : 'Total Bills Received:', 350, y + 14);
    const sumDrCr = currentPeriodTxns.reduce((sum, el) => sum + (isCustomer ? el.debit : el.credit), 0);
    doc.fillColor(TEXT_PRIMARY).text(formatNaira(sumDrCr), 470, y + 14, { align: 'right', width: 75 });

    doc.fillColor(MUTED_COLOR).text(isCustomer ? 'Total Cash Receipts:' : 'Total Cash Out:', 350, y + 26);
    const sumReceipts = currentPeriodTxns.reduce((sum, el) => sum + (isCustomer ? el.credit : el.debit), 0);
    doc.fillColor(TEXT_PRIMARY).text(formatNaira(sumReceipts), 470, y + 26, { align: 'right', width: 75 });

    doc.font('Helvetica-Bold').text('CLOSING BALANCE:', 350, y + 40);
    doc.text(formatNaira(closingBalance), 470, y + 40, { align: 'right', width: 75 });

    y = 210;
    const cw = [60, 75, 160, 70, 70, 80];
    const headers = ['Date', 'Document Ref', 'Particulars', 'Debit (+)', 'Credit (-)', 'Balance'];
    const aligns: ('left' | 'right' | 'center')[] = ['left', 'left', 'left', 'right', 'right', 'right'];
    
    const rows: any[][] = currentPeriodTxns.map(txn => [
      formatShortDate(txn.date),
      txn.number,
      txn.type,
      txn.debit > 0 ? formatNaira(txn.debit) : '-',
      txn.credit > 0 ? formatNaira(txn.credit) : '-',
      formatNaira(txn.balanceAfter)
    ]);

    y = drawStripeTable(doc, y, headers, cw, aligns, rows, 18, brandColor);

    y += 10;
    doc.rect(startX, y, 515, 24).fill('#f3f4f6');
    doc.fillColor(TEXT_PRIMARY).font('Helvetica-Bold').fontSize(9);
    doc.text('STATEMENT ACCOUNT CLOSING BALANCE:', startX + 15, y + 7);
    doc.fontSize(11).text(formatNaira(closingBalance), 400, y + 6, { align: 'right', width: 140 });

    doc.fillColor('#9ca3af').fontSize(7).text('Confidential Statement — Generated securely by FinanceOS Cloud Server Platform.', startX, 750, { align: 'center' });
  });
}

// =========================================================================
// 5. GENERIC LIST PDF GENERATOR (for tabular data pages)
// =========================================================================
export async function generateListPDF(
  orgId: string,
  title: string,
  subtitle: string,
  headers: string[],
  widths: number[],
  aligns: ('left' | 'right' | 'center')[],
  rows: any[][],
  themeColor?: string
): Promise<Buffer> {
  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const orgSettings = typeof org?.settings === 'string' ? JSON.parse(org.settings) : (org?.settings || {});
  const brandColor = themeColor || orgSettings.branding?.primaryColor || '#1e3a8a';
  return generatePDFBuffer((doc) => {
    drawReportHeader(doc, title, subtitle, org?.name || 'FinanceOS', org, brandColor);
    const y = drawStripeTable(doc, 110, headers, widths, aligns, rows, 16, brandColor);
    doc.fillColor('#9ca3af').fontSize(7).text('Generated by FinanceOS Cloud Server Platform.', 40, 750, { align: 'center' });
  });
}

// =========================================================================
// 6. BILL PDF (single bill detail)
// =========================================================================
export async function generateBillPDF(billId: string, orgId: string): Promise<Buffer> {
  const [bill] = await db.select().from(bills).where(and(eq(bills.id, billId), eq(bills.orgId, orgId))).limit(1);
  if (!bill) throw new AppError('Bill not found.', 404);
  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const [vendor] = await db.select().from(contacts).where(eq(contacts.id, bill.vendorId)).limit(1);
  const lines = await db.select().from(billLines).where(eq(billLines.billId, billId));

  const orgSettings = typeof org.settings === 'string' ? JSON.parse(org.settings) : (org.settings || {});
  const brandColor = orgSettings.branding?.primaryColor || '#1e3a8a';

  return generatePDFBuffer((doc) => {
    const PRIMARY = brandColor; const TXT = '#1f2937'; const MUTED = '#4b5563'; const ACCENT = '#10b981';
    const startX = 40;
    doc.rect(startX, 40, 50, 50).fill(PRIMARY);
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(org.name.substring(0, 2).toUpperCase(), startX + 11, 52);
    doc.fillColor(TXT).fontSize(14).font('Helvetica-Bold').text(org.name, startX + 65, 40);
    doc.fontSize(8).font('Helvetica').fillColor(MUTED).text(org.address || '', startX + 65, 55).text(`RC: ${org.rcNumber || '-'} | VAT: ${org.vatNumber || '-'}`, startX + 65, 66);
    doc.fillColor(PRIMARY).fontSize(20).font('Helvetica-Bold').text('BILL', 400, 40, { align: 'right' });
    const sText = (bill.status || 'draft').toUpperCase();
    doc.fontSize(10).fillColor(bill.status === 'paid' ? ACCENT : '#f59e0b').text(sText, 400, 63, { align: 'right' });
    doc.moveTo(startX, 105).lineTo(555, 105).strokeColor('#e5e7eb').lineWidth(1).stroke();
    let y = 120;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(TXT).text('VENDOR:', startX, y).text('BILL DETAILS:', 350, y);
    y += 13;
    doc.fontSize(10).font('Helvetica-Bold').text(vendor?.name || '-', startX, y);
    doc.font('Helvetica-Bold').fontSize(9).text('Bill Number:', 350, y); doc.font('Helvetica').text(bill.billNumber, 440, y);
    y += 13;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(vendor?.address || '-', startX, y).text(`${vendor?.city || ''} ${vendor?.state || ''}`, startX, y + 10).text(`Email: ${vendor?.email || '-'}`, startX, y + 20).text(`TIN: ${vendor?.taxPin || '-'}`, startX, y + 30);
    doc.fillColor(TXT).font('Helvetica-Bold').text('Date:', 350, y).font('Helvetica').text(formatShortDate(bill.date), 440, y);
    doc.font('Helvetica-Bold').text('Due Date:', 350, y + 12).font('Helvetica').text(formatShortDate(bill.dueDate), 440, y + 12);
    if (bill.currency && bill.currency !== 'NGN') { doc.font('Helvetica-Bold').text('Currency:', 350, y + 24).font('Helvetica').text(bill.currency, 440, y + 24); }
    y = 210;
    const cw = [30, 220, 60, 80, 75]; const aligns2: ('left'|'right'|'center')[] = ['left','left','right','right','right'];
    doc.rect(startX, y, 515, 20).fill(brandColor);
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    doc.text('#', startX + 5, y + 6); doc.text('Description', startX + cw[0] + 5, y + 6);
    doc.text('Qty', startX + cw[0]+cw[1]+5, y + 6, { width: cw[2]-10, align: 'right' });
    doc.text('Unit Price', startX + cw[0]+cw[1]+cw[2]+5, y + 6, { width: cw[3]-10, align: 'right' });
    doc.text('Amount', startX + cw[0]+cw[1]+cw[2]+cw[3]+5, y + 6, { width: cw[4]-10, align: 'right' });
    y += 20;
    doc.fillColor(TXT).font('Helvetica').fontSize(8);
    lines.forEach((line, i) => {
      if (i % 2 === 1) doc.rect(startX, y, 515, 18).fill('#fafdff');
      doc.fillColor(TXT);
      doc.text(String(i+1), startX+5, y+5); doc.text(line.description || '', startX+cw[0]+5, y+5, { width: cw[1]-10 });
      doc.text(Number(line.quantity).toString(), startX+cw[0]+cw[1]+5, y+5, { width: cw[2]-10, align: 'right' });
      doc.text(formatNaira(line.unitPrice), startX+cw[0]+cw[1]+cw[2]+5, y+5, { width: cw[3]-10, align: 'right' });
      doc.text(formatNaira(line.lineTotal), startX+cw[0]+cw[1]+cw[2]+cw[3]+5, y+5, { width: cw[4]-10, align: 'right' });
      y += 18;
    });
    doc.moveTo(startX, y).lineTo(555, y).strokeColor('#e5e7eb').stroke(); y += 10;
    const lx = 350, vx = 475;
    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text('Subtotal:', lx, y); doc.fillColor(TXT).text(formatNaira(bill.subtotal), vx, y, { align: 'right' }); y += 12;
    doc.fillColor(MUTED).text('Tax:', lx, y); doc.fillColor(TXT).text(formatNaira(bill.taxAmount), vx, y, { align: 'right' }); y += 12;
    y += 2; doc.rect(lx-10, y-4, 215, 20).fill('#f3f4f6');
    doc.fillColor(TXT).font('Helvetica-Bold').fontSize(10).text('TOTAL:', lx, y+1).text(formatNaira(bill.total), vx, y+1, { align: 'right' }); y += 22;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Amount Paid:', lx, y); doc.fillColor(TXT).text(formatNaira(bill.amountPaid), vx, y, { align: 'right' }); y += 12;
    doc.font('Helvetica-Bold').text('Balance Due:', lx, y); doc.text(formatNaira(bill.balanceDue), vx, y, { align: 'right' });
    if (bill.notes) { y += 20; doc.fillColor(MUTED).fontSize(8).font('Helvetica').text('Notes:', startX, y); doc.fillColor(TXT).text(bill.notes, startX, y+10, { width: 515 }); }
    doc.fillColor('#9ca3af').fontSize(7).text('Generated by FinanceOS Cloud Ledger Workstation.', startX, 750, { align: 'center' });
  });
}

// =========================================================================
// 7. CREDIT NOTE PDF (single credit note detail)
// =========================================================================
export async function generateCreditNotePDF(cnId: string, orgId: string): Promise<Buffer> {
  const [cn] = await db.select().from(creditNotes).where(and(eq(creditNotes.id, cnId), eq(creditNotes.orgId, orgId))).limit(1);
  if (!cn) throw new AppError('Credit note not found.', 404);
  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const [customer] = await db.select().from(contacts).where(eq(contacts.id, cn.customerId)).limit(1);

  const orgSettings = typeof org.settings === 'string' ? JSON.parse(org.settings) : (org.settings || {});
  const brandColor = orgSettings.branding?.primaryColor || '#059669';

  return generatePDFBuffer((doc) => {
    const PRIMARY = brandColor; const TXT = '#1f2937'; const MUTED = '#4b5563';
    const startX = 40;
    doc.rect(startX, 40, 50, 50).fill(PRIMARY);
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(org.name.substring(0,2).toUpperCase(), startX+11, 52);
    doc.fillColor(TXT).fontSize(14).font('Helvetica-Bold').text(org.name, startX+65, 40);
    doc.fontSize(8).font('Helvetica').fillColor(MUTED).text(org.address || '', startX+65, 55);
    doc.fillColor(PRIMARY).fontSize(18).font('Helvetica-Bold').text('CREDIT NOTE', 400, 40, { align: 'right' });
    doc.fontSize(10).fillColor('#059669').text((cn.status||'').toUpperCase(), 400, 63, { align: 'right' });
    doc.moveTo(startX, 105).lineTo(555, 105).strokeColor('#e5e7eb').stroke();
    let y = 120;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(TXT).text('CUSTOMER:', startX, y).text('CREDIT NOTE DETAILS:', 350, y); y += 13;
    doc.fontSize(10).font('Helvetica-Bold').text(customer?.name||'-', startX, y);
    doc.font('Helvetica-Bold').fontSize(9).text('CN Number:', 350, y); doc.font('Helvetica').text(cn.cnNumber, 440, y); y += 13;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`Email: ${customer?.email||'-'}`, startX, y);
    doc.fillColor(TXT).font('Helvetica-Bold').text('Date:', 350, y).font('Helvetica').text(formatShortDate(cn.date), 440, y);
    if (cn.invoiceId) { y += 12; doc.fillColor(TXT).font('Helvetica-Bold').text('Originating Invoice:', 350, y).font('Helvetica').text(cn.invoiceNumber||'', 440, y); }
    y = 220;
    doc.fillColor(TXT).fontSize(10).font('Helvetica-Bold').text('Total Credit Amount:', startX, y);
    doc.text(formatNaira(cn.total), 400, y, { align: 'right', width: 140 }); y += 14;
    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text('Remaining Credit:', startX, y);
    doc.fillColor('#d97706').text(formatNaira(cn.remainingCredit), 400, y, { align: 'right', width: 140 }); y += 12;
    doc.fillColor(MUTED).fontSize(8).text('Subtotal:', startX, y); doc.fillColor(TXT).text(formatNaira(cn.subtotal), 400, y, { align: 'right', width: 140 }); y += 10;
    doc.fillColor(MUTED).text('Tax:', startX, y); doc.fillColor(TXT).text(formatNaira(cn.tax), 400, y, { align: 'right', width: 140 }); y += 10;
    if (cn.notes) { y += 10; doc.fillColor(MUTED).font('Helvetica').text('Notes:', startX, y); doc.fillColor(TXT).text(cn.notes, startX, y+10, { width: 515 }); }
    doc.fillColor('#9ca3af').fontSize(7).text('Generated by FinanceOS Cloud Ledger Workstation.', startX, 750, { align: 'center' });
  });
}

// =========================================================================
// 8. BILLS LIST PDF
// =========================================================================
export async function generateChartOfAccountsPDF(orgId: string): Promise<Buffer> {
  const list = await db
    .select()
    .from(accounts)
    .where(eq(accounts.orgId, orgId))
    .orderBy(accounts.code);
  const rows = list.map(a => [
    a.code,
    a.name,
    a.type.charAt(0).toUpperCase() + a.type.slice(1),
    a.subType || '-',
    a.isActive ? 'Active' : 'Inactive'
  ]);
  return generateListPDF(
    orgId,
    'CHART OF ACCOUNTS',
    `${list.length} accounts · Double-entry general ledger structure`,
    ['Code', 'Account Name', 'Type', 'Sub-type', 'Status'],
    [70, 180, 80, 100, 50],
    ['left', 'left', 'left', 'left', 'left'],
    rows,
    '#1e3a8a'
  );
}

export async function generateFixedAssetsPDF(orgId: string): Promise<Buffer> {
  const list = await db
    .select()
    .from(fixedAssets)
    .where(eq(fixedAssets.orgId, orgId))
    .orderBy(asc(fixedAssets.name));
  const rows = list.map(a => [
    a.assetNumber,
    a.name,
    a.category || '-',
    formatNaira(a.purchaseCost),
    formatNaira(a.accumulatedDepreciation),
    formatNaira(a.bookValue),
    (a.status || '').charAt(0).toUpperCase() + (a.status || '').slice(1)
  ]);
  return generateListPDF(
    orgId,
    'FIXED ASSETS',
    `${list.length} assets · Fixed asset schedule`,
    ['Asset #', 'Name', 'Category', 'Cost', 'Depreciation', 'Book Value', 'Status'],
    [70, 120, 70, 70, 75, 75, 60],
    ['left', 'left', 'left', 'right', 'right', 'right', 'left'],
    rows,
    '#1e3a8a'
  );
}

export async function generateBillsListPDF(orgId: string, startDate: Date, endDate: Date): Promise<Buffer> {
  const list = await db.select().from(bills).where(and(eq(bills.orgId, orgId), gte(bills.date, startDate), lte(bills.date, endDate))).orderBy(desc(bills.date));
  const vendorIds = [...new Set(list.map(b => b.vendorId))];
  const vendors = await db.select().from(contacts).where(sql`${contacts.id} = ANY(${vendorIds})`);
  const vMap = new Map(vendors.map(v => [v.id, v.name]));
  const rows = list.map(b => [b.billNumber, vMap.get(b.vendorId)||'-', formatShortDate(b.date), (b.status||'').toUpperCase(), formatNaira(b.total), formatNaira(b.amountPaid), formatNaira(b.balanceDue)]);
  return generateListPDF(orgId, 'BILLS LIST', `Period: ${formatShortDate(startDate)} - ${formatShortDate(endDate)}`, ['Bill #','Vendor','Date','Status','Total','Paid','Balance Due'], [60,130,65,60,70,70,60], ['left','left','left','center','right','right','right'], rows, '#1e3a8a');
}

// =========================================================================
// 9. CREDIT NOTES LIST PDF
// =========================================================================
export async function generateCreditNotesListPDF(orgId: string, startDate: Date, endDate: Date): Promise<Buffer> {
  const list = await db.select().from(creditNotes).where(and(eq(creditNotes.orgId, orgId), gte(creditNotes.date, startDate), lte(creditNotes.date, endDate))).orderBy(desc(creditNotes.date));
  const custIds = [...new Set(list.map(c => c.customerId))];
  const custs = await db.select().from(contacts).where(sql`${contacts.id} = ANY(${custIds})`);
  const cMap = new Map(custs.map(c => [c.id, c.name]));
  const rows = list.map(c => [c.cnNumber, cMap.get(c.customerId)||'-', formatShortDate(c.date), (c.status||'').toUpperCase(), formatNaira(c.total), formatNaira(c.remainingCredit)]);
  return generateListPDF(orgId, 'CREDIT NOTES LIST', `Period: ${formatShortDate(startDate)} - ${formatShortDate(endDate)}`, ['CN #','Customer','Date','Status','Total','Remaining'], [60,130,65,60,70,70], ['left','left','left','center','right','right'], rows, '#059669');
}

// =========================================================================
// 10. EMPLOYEES LIST PDF
// =========================================================================
export async function generateEmployeesListPDF(orgId: string): Promise<Buffer> {
  const list = await db.select().from(employees).where(eq(employees.orgId, orgId)).orderBy(asc(employees.lastName));
  const rows = list.map(e => [e.staffId, `${e.firstName} ${e.lastName}`, e.department||'-', e.designation||'-', formatNaira(e.grossSalary), (e.paymentFrequency||'monthly'), e.isActive ? 'Active' : 'Inactive']);
  return generateListPDF(orgId, 'EMPLOYEES LIST', `As of: ${formatShortDate(new Date())}`, ['Staff ID','Name','Department','Designation','Gross Salary','Frequency','Status'], [60,120,80,80,80,60,55], ['left','left','left','left','right','center','center'], rows, '#4f46e5');
}

// =========================================================================
// 11. PAYROLL RUNS LIST PDF
// =========================================================================
export async function generatePayrollRunsListPDF(orgId: string, startDate: Date, endDate: Date): Promise<Buffer> {
  const list = await db.select().from(payrollRuns).where(and(eq(payrollRuns.orgId, orgId), gte(payrollRuns.periodStart, startDate), lte(payrollRuns.periodEnd, endDate))).orderBy(desc(payrollRuns.createdAt));
  const rows = list.map(r => [r.runNumber, `${formatShortDate(r.periodStart)} - ${formatShortDate(r.periodEnd)}`, formatShortDate(r.payDate), (r.status||'').toUpperCase(), formatNaira(r.totalGross), formatNaira(r.totalPaye), formatNaira(r.totalPension), formatNaira(r.totalNet)]);
  return generateListPDF(orgId, 'PAYROLL RUNS', `Period: ${formatShortDate(startDate)} - ${formatShortDate(endDate)}`, ['Run #','Period','Pay Date','Status','Gross','PAYE','Pension','Net'], [55,110,60,55,55,55,55,55], ['left','left','left','center','right','right','right','right'], rows, '#4f46e5');
}

// =========================================================================
// 12. PAYE SCHEDULE PDF (per run)
// =========================================================================
export async function generatePAYESchedulePDF(runId: string, orgId: string): Promise<Buffer> {
  const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, runId), eq(payrollRuns.orgId, orgId))).limit(1);
  if (!run) throw new AppError('Payroll run not found.', 404);
  const lines = await db.select().from(payrollLines).where(eq(payrollLines.runId, runId));
  const empIds = [...new Set(lines.map(l => l.employeeId))];
  const emps = await db.select().from(employees).where(sql`${employees.id} = ANY(${empIds})`);
  const empMap = new Map(emps.map(e => [e.id, { name: `${e.firstName} ${e.lastName}`, staffId: e.staffId || '' }]));
  const rows = lines.map(l => {
    const emp = empMap.get(l.employeeId) || { name: '-', staffId: '' };
    const annualGross = l.annualGross || 0;
    const relief = l.taxRelief || 0;
    const pensionAnnual = (l.pensionEmployee || 0) * 12;
    const nhfAnnual = (l.nhf || 0) * 12;
    const chargeable = Math.max(0, annualGross - relief - pensionAnnual - nhfAnnual);
    return [
      emp.staffId, emp.name, formatNaira(l.grossPay),
      formatNaira(l.pensionEmployee), formatNaira(l.nhf),
      formatNaira(annualGross), formatNaira(relief),
      formatNaira(chargeable), formatNaira(l.paye), formatNaira(l.netPay),
    ];
  });
  return generateListPDF(orgId, 'PAYE SCHEDULE', `Run: ${run.runNumber} | ${formatShortDate(run.periodStart)} - ${formatShortDate(run.periodEnd)}`,
    ['Staff', 'Employee', 'Gross Pay', 'Pension (EE)', 'NHF', 'Annual Gross', 'Relief', 'Chargeable', 'PAYE', 'Net Pay'],
    [55, 95, 65, 65, 50, 65, 55, 65, 50, 55],
    ['left', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
    rows, '#b91c1c');
}

// =========================================================================
// 13. PENSION SCHEDULE PDF (per run)
// =========================================================================
export async function generatePensionSchedulePDF(runId: string, orgId: string): Promise<Buffer> {
  const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, runId), eq(payrollRuns.orgId, orgId))).limit(1);
  if (!run) throw new AppError('Payroll run not found.', 404);
  const lines = await db.select().from(payrollLines).where(eq(payrollLines.runId, runId));
  const empIds = [...new Set(lines.map(l => l.employeeId))];
  const emps = await db.select().from(employees).where(sql`${employees.id} = ANY(${empIds})`);
  const empMap = new Map(emps.map(e => [e.id, { name: `${e.firstName} ${e.lastName}`, staffId: e.staffId || '' }]));
  const rows = lines.map(l => {
    const emp = empMap.get(l.employeeId) || { name: '-', staffId: '' };
    const pensionable = l.basic || 0;
    return [
      emp.staffId, emp.name, formatNaira(l.grossPay),
      formatNaira(pensionable), formatNaira(l.pensionEmployee),
      formatNaira(l.pensionEmployer), formatNaira((l.pensionEmployee || 0) + (l.pensionEmployer || 0)),
    ];
  });
  return generateListPDF(orgId, 'PENSION CONTRIBUTION SCHEDULE', `Run: ${run.runNumber} | ${formatShortDate(run.periodStart)} - ${formatShortDate(run.periodEnd)}`,
    ['Staff ID', 'Employee', 'Gross Pay', 'Pensionable', 'EE (8%)', 'ER (10%)', 'Total'],
    [55, 100, 65, 65, 60, 60, 60],
    ['left', 'left', 'right', 'right', 'right', 'right', 'right'],
    rows, '#d97706');
}

// =========================================================================
// 14. MANUAL JOURNALS LIST PDF
// =========================================================================
export async function generateManualJournalsPDF(orgId: string, startDate: Date, endDate: Date): Promise<Buffer> {
  const list = await db.select().from(journalEntries).where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.source, 'manual'), gte(journalEntries.date, startDate), lte(journalEntries.date, endDate))).orderBy(desc(journalEntries.date));
  const rows = list.map(j => [j.entryNumber, formatShortDate(j.date), (j.description||'').substring(0,60), j.reference||'-']);
  return generateListPDF(orgId, 'MANUAL JOURNALS', `Period: ${formatShortDate(startDate)} - ${formatShortDate(endDate)}`, ['Entry #','Date','Description','Reference'], [80,70,230,70], ['left','left','left','left'], rows, '#1e3a8a');
}

// =========================================================================
// 15. BUDGETS LIST PDF
// =========================================================================
export async function generateBudgetsPDF(orgId: string): Promise<Buffer> {
  const list = await db.select().from(budgets).where(eq(budgets.orgId, orgId)).orderBy(desc(budgets.createdAt));
  const rows = list.map(b => [b.name, String(b.fiscalYear), (b.period||'').toUpperCase(), (b.status||'').toUpperCase()]);
  return generateListPDF(orgId, 'BUDGETS', `As of: ${formatShortDate(new Date())}`, ['Name','Fiscal Year','Period','Status'], [170,100,100,100], ['left','center','center','center'], rows, '#059669');
}

// =========================================================================
// 16. AUDIT LOGS PDF
// =========================================================================
export async function generateAuditLogsPDF(orgId: string, startDate: Date, endDate: Date): Promise<Buffer> {
  const list = await db.select({
    log: auditLog,
    user: { name: users.name, email: users.email }
  }).from(auditLog).leftJoin(users, eq(auditLog.userId, users.id))
    .where(and(eq(auditLog.orgId, orgId), gte(auditLog.createdAt, startDate), lte(auditLog.createdAt, endDate)))
    .orderBy(desc(auditLog.createdAt));
  const rows = list.map(row => [formatShortDate(row.log.createdAt), row.log.action?.toUpperCase()||'-', row.log.entityType||'-', row.user?.name||'-', row.log.ipAddress||'-']);
  return generateListPDF(orgId, 'AUDIT LOGS', `Period: ${formatShortDate(startDate)} - ${formatShortDate(endDate)}`, ['Date','Action','Entity','User','IP Address'], [65,65,100,100,70], ['left','center','left','left','left'], rows, '#4f46e5');
}

// =========================================================================
// 17. CUSTOM REPORT PDF (generic data report)
// =========================================================================
export async function generateCustomReportPDF(orgId: string, title: string, headers: string[], rows: any[][]): Promise<Buffer> {
  const widths = headers.map(() => Math.floor(460 / headers.length));
  const aligns: ('left'|'right'|'center')[] = headers.map(() => 'left');
  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1).catch(() => []);
  const orgSettings = typeof org?.settings === 'string' ? JSON.parse(org.settings) : (org?.settings || {});
  const themeColor = orgSettings.branding?.primaryColor || '#0f766e';
  return generateListPDF(orgId, title, `As of: ${formatShortDate(new Date())}`, headers, widths.slice(0, 8), aligns.slice(0, 8), rows, themeColor);
}

// =========================================================================
// 4. ACCOUNTING STATEMENTS PDFS CONVERTERS
// =========================================================================

// Trial Balance PDF
export async function generateTrialBalancePDF(orgId: string, startDate: Date, endDate: Date): Promise<Buffer> {
  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const tb = await getTrialBalance(orgId, startDate, endDate);

  const orgSettings = typeof org?.settings === 'string' ? JSON.parse(org.settings) : (org?.settings || {});
  const brandColor = orgSettings.branding?.primaryColor || '#1e3a8a';

  return generatePDFBuffer((doc) => {
    drawReportHeader(doc, 'TRIAL BALANCE', `Period: ${formatShortDate(startDate)} - ${formatShortDate(endDate)}`, org?.name || 'FinanceOS Unit', org, brandColor);
    
    const cw = [50, 135, 50, 47, 47, 47, 47, 47, 47];
    const headers = ['Code', 'Account Name', 'Type', 'Open Dr', 'Open Cr', 'Per Dr', 'Per Cr', 'Close Dr', 'Close Cr'];
    const aligns: ('left' | 'right' | 'center')[] = ['center', 'left', 'center', 'right', 'right', 'right', 'right', 'right', 'right'];
    
    const rows = tb.map(row => [
      row.accountCode,
      row.accountName,
      row.accountType.substring(0, 3).toUpperCase(),
      formatNaira(row.openingDebit),
      formatNaira(row.openingCredit),
      formatNaira(row.periodDebit),
      formatNaira(row.periodCredit),
      formatNaira(row.closingDebit),
      formatNaira(row.closingCredit)
    ]);

    const y = drawStripeTable(doc, 110, headers, cw, aligns, rows, 16, brandColor);

    // Render Totals
    doc.rect(40, y, 515, 20).fill('#f3f4f6');
    doc.fillColor('#1f2937').fontSize(7.5).font('Helvetica-Bold');
    doc.text('TOTAL DEBITS & CREDITS', 40 + 5, y + 6);
    
    const fieldsToSum = [
      tb.reduce((s, r) => s + r.openingDebit, 0),
      tb.reduce((s, r) => s + r.openingCredit, 0),
      tb.reduce((s, r) => s + r.periodDebit, 0),
      tb.reduce((s, r) => s + r.periodCredit, 0),
      tb.reduce((s, r) => s + r.closingDebit, 0),
      tb.reduce((s, r) => s + r.closingCredit, 0)
    ];

    let x = 40 + 50 + 135 + 50;
    fieldsToSum.forEach((val, i) => {
      doc.text(formatNaira(val), x + 5, y + 6, { width: 47 - 10, align: 'right' });
      x += 47;
    });
  });
}

// Income Statement PDF
export async function generateIncomeStatementPDF(orgId: string, startDate: Date, endDate: Date): Promise<Buffer> {
  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const pnlResult = await getProfitAndLoss(orgId, startDate, endDate);
  const pnl = pnlResult.current;

  const orgSettings = typeof org?.settings === 'string' ? JSON.parse(org.settings) : (org?.settings || {});
  const brandColor = orgSettings.branding?.primaryColor || '#10b981';

  return generatePDFBuffer((doc) => {
    drawReportHeader(doc, 'INCOME STATEMENT', `Period: ${formatShortDate(startDate)} - ${formatShortDate(endDate)}`, org?.name || 'FinanceOS Unit', org, brandColor);
    
    let y = 110;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827');

    const sections = [
      { label: 'REVENUE', data: pnl.revenue },
      { label: 'COST OF GOODS SOLD', data: pnl.costOfGoodsSold },
      { label: 'OPERATING EXPENSES', data: pnl.expense }
    ];

    sections.forEach(sec => {
      doc.fontSize(9).font('Helvetica-Bold').text(sec.label, 40, y);
      y += 12;
      doc.moveTo(40, y).lineTo(555, y).strokeColor('#e5e7eb').stroke();
      y += 6;

      doc.fontSize(8).font('Helvetica').fillColor('#374151');
      if (sec.data.accounts.length === 0) {
        doc.text('No active accounts in period', 55, y);
        y += 12;
      } else {
        sec.data.accounts.forEach((acc: any) => {
          doc.text(`[${acc.code}] ${acc.name}`, 55, y);
          doc.text(formatNaira(acc.balance), 400, y, { align: 'right', width: 140 });
          y += 12;
        });
      }

      y += 4;
      doc.font('Helvetica-Bold').text(`Total ${sec.label}:`, 40, y);
      doc.text(formatNaira(sec.data.total), 400, y, { align: 'right', width: 140 });
      y += 18;
    });

    doc.rect(40, y, 515, 24).fill('#eef2f3');
    doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold');
    doc.text('NET OPERATING PROFIT / (LOSS)', 50, y + 7);
    doc.text(formatNaira(pnl.netProfit), 400, y + 7, { align: 'right', width: 140 });
  });
}

// Balance Sheet PDF
export async function generateBalanceSheetPDF(orgId: string, asOfDate: Date): Promise<Buffer> {
  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const bs = await getBalanceSheet(orgId, asOfDate);

  const orgSettings = typeof org?.settings === 'string' ? JSON.parse(org.settings) : (org?.settings || {});
  const brandColor = orgSettings.branding?.primaryColor || '#1e3a8a';

  return generatePDFBuffer((doc) => {
    drawReportHeader(doc, 'BALANCE SHEET', `As of: ${formatShortDate(asOfDate)}`, org?.name || 'FinanceOS Unit', org, brandColor);
    
    let y = 110;

    const sections = [
      { label: 'ASSETS', data: bs.assets },
      { label: 'LIABILITIES', data: bs.liabilities },
      { label: 'EQUITY & RESERVES', data: bs.equity }
    ];

    sections.forEach(sec => {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text(sec.label, 40, y);
      y += 12;
      doc.moveTo(40, y).lineTo(555, y).strokeColor('#e5e7eb').stroke();
      y += 6;

      doc.fontSize(8).font('Helvetica').fillColor('#374151');
      if (sec.data.accounts.length === 0) {
        doc.text('No matching active account accounts', 55, y);
        y += 12;
      } else {
        sec.data.accounts.forEach((acc: any) => {
          doc.text(`[${acc.code}] ${acc.name}`, 55, y);
          doc.text(formatNaira(acc.balance), 400, y, { align: 'right', width: 140 });
          y += 12;
        });
      }

      y += 4;
      doc.font('Helvetica-Bold').text(`Total ${sec.label}:`, 40, y);
      doc.text(formatNaira(sec.data.total), 400, y, { align: 'right', width: 140 });
      y += 18;
    });

    doc.rect(40, y, 515, 24).fill('#e1e7ec');
    doc.fillColor('#0f294a').fontSize(10).font('Helvetica-Bold');
    doc.text('TOTAL LIABILITIES AND EQUITY', 50, y + 7);
    doc.text(formatNaira(bs.liabilitiesAndEquity), 400, y + 7, { align: 'right', width: 140 });
  });
}

// Cash Flow Statement PDF
export async function generateCashFlowPDF(orgId: string, startDate: Date, endDate: Date): Promise<Buffer> {
  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const cf = await getCashFlowStatement(orgId, startDate, endDate);

  const orgSettings = typeof org?.settings === 'string' ? JSON.parse(org.settings) : (org?.settings || {});
  const brandColor = orgSettings.branding?.primaryColor || '#0f766e';

  return generatePDFBuffer((doc) => {
    drawReportHeader(doc, 'STATEMENT OF CASH FLOWS', `Period: ${formatShortDate(startDate)} - ${formatShortDate(endDate)}`, org?.name || 'FinanceOS Unit', org, brandColor);
    
    let y = 110;

    // Operating
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('1. OPERATING ACTIVITIES', 40, y);
    y += 12;
    doc.fontSize(8).font('Helvetica').fillColor('#374151');
    doc.text('Net income before adjustments', 55, y);
    doc.text(formatNaira(cf.netIncome), 400, y, { align: 'right', width: 140 });
    y += 12;

    cf.operatingActivities.adjustments.forEach((adj: any) => {
      doc.text(adj.name, 55, y);
      doc.text(formatNaira(adj.amount), 400, y, { align: 'right', width: 140 });
      y += 12;
    });
    cf.operatingActivities.workingCapitalChanges.forEach((wc: any) => {
      doc.text(wc.name, 55, y);
      doc.text(formatNaira(wc.amount), 400, y, { align: 'right', width: 140 });
      y += 12;
    });
    doc.font('Helvetica-Bold').text('Net Cash from Operating Activities:', 40, y);
    doc.text(formatNaira(cf.operatingActivities.total), 400, y, { align: 'right', width: 140 });
    y += 18;

    // Investing
    doc.fontSize(9).font('Helvetica-Bold').text('2. INVESTING ACTIVITIES', 40, y);
    y += 12;
    doc.fontSize(8).font('Helvetica').fillColor('#374151');
    cf.investingActivities.items.forEach((item: any) => {
      doc.text(item.name, 55, y);
      doc.text(formatNaira(item.amount), 400, y, { align: 'right', width: 140 });
      y += 12;
    });
    doc.font('Helvetica-Bold').text('Net Cash from Investing Activities:', 40, y);
    doc.text(formatNaira(cf.investingActivities.total), 400, y, { align: 'right', width: 140 });
    y += 18;

    // Financing
    doc.fontSize(9).font('Helvetica-Bold').text('3. FINANCING ACTIVITIES', 40, y);
    y += 12;
    doc.fontSize(8).font('Helvetica').fillColor('#374151');
    cf.financingActivities.items.forEach((item: any) => {
      doc.text(item.name, 55, y);
      doc.text(formatNaira(item.amount), 400, y, { align: 'right', width: 140 });
      y += 12;
    });
    doc.font('Helvetica-Bold').text('Net Cash from Financing Activities:', 40, y);
    doc.text(formatNaira(cf.financingActivities.total), 400, y, { align: 'right', width: 140 });
    y += 18;

    // Reconciliation Summary Block
    doc.rect(40, y, 515, 52).fill('#f1f5f9');
    doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold');
    doc.text('CASH RECONCILIATION SUMMARY', 50, y + 6);
    
    doc.font('Helvetica').fontSize(8).fillColor('#475569');
    doc.text(`Opening Cash Balance (${formatShortDate(startDate)}): ${formatNaira(cf.openingCash)}`, 50, y + 18);
    doc.text(`Net Periodic Change in Cash resources: ${formatNaira(cf.netChangeInCash)}`, 50, y + 29);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`Closing Cash Balance (${formatShortDate(endDate)}): ${formatNaira(cf.closingCash)}`, 50, y + 40);
  });
}

// Aged Receivables/Payables PDF
export async function generateAgedReportPDF(orgId: string, isReceivable: boolean): Promise<Buffer> {
  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  const report = isReceivable ? await getInvoiceAgingReport(orgId) : await getBillAgingReport(orgId);

  const orgSettings = typeof org?.settings === 'string' ? JSON.parse(org.settings) : (org?.settings || {});
  const brandColor = orgSettings.branding?.primaryColor || (isReceivable ? '#1e3a8a' : '#b91c1c');

  return generatePDFBuffer((doc) => {
    drawReportHeader(
      doc,
      isReceivable ? 'AGED RECEIVABLES REPORT' : 'AGED PAYABLES REPORT',
      `As of: ${formatShortDate(new Date())}`, 
      org?.name || 'FinanceOS Unit',
      org,
      brandColor
    );

    const cw = [155, 60, 60, 60, 60, 60, 60];
    const headers = [
      isReceivable ? 'Customer' : 'Vendor',
      'Current',
      '1-30 Days',
      '31-60 Days',
      '61-90 Days',
      '90+ Days',
      'Total'
    ];
    const aligns: ('left' | 'right' | 'center')[] = ['left', 'right', 'right', 'right', 'right', 'right', 'right'];

    const dataList = isReceivable ? report.byCustomer : report.byVendor;
    const rows = dataList.map((item: any) => [
      isReceivable ? item.customerName : item.vendorName,
      formatNaira(item.current),
      formatNaira(item.days1To30),
      formatNaira(item.days31To60),
      formatNaira(item.days61To90),
      formatNaira(item.daysOver90),
      formatNaira(item.totalOutstanding)
    ]);

    const y = drawStripeTable(doc, 110, headers, cw, aligns, rows, 18, brandColor);

    // Totals row
    doc.rect(40, y, 515, 20).fill('#f3f4f6');
    doc.fillColor('#1f2937').fontSize(7.5).font('Helvetica-Bold');
    doc.text('TOTAL OUTSTANDING', 40 + 5, y + 6);

    const sums = [
      report.summary.current,
      report.summary.days1To30,
      report.summary.days31To60,
      report.summary.days61To90,
      report.summary.daysOver90,
      report.summary.totalOutstanding
    ];

    let x = 40 + 155;
    sums.forEach((val) => {
      doc.text(formatNaira(val), x + 5, y + 6, { width: 60 - 10, align: 'right' });
      x += 60;
    });
  });
}
