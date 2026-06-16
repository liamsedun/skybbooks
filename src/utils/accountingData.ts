/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BankAccount, CreditCard, Employee, PayoutRegister, Transaction, Invoice, ChartOfAccount } from '../types';

const STORAGE_KEY = 'financeos_skyhouse_state_v2';

interface AppState {
  bankAccounts: BankAccount[];
  cards: CreditCard[];
  employees: Employee[];
  payoutRegisters: PayoutRegister[];
  transactions: Transaction[];
  invoices: Invoice[];
  schedulesActive: boolean;
}

// Default initial employees with realistic Nigerian Naira rates scaled (₦1 = 100 kobo)
const DEFAULT_EMPLOYEES: Employee[] = [
  { id: '934651', name: 'Alia Bonner', role: 'Staff Accountant', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 450000, email: 'alia.bonner@skyhouse.acct', joinedDate: '2024-01-15' },
  { id: '934652', name: 'Carmen Lucas', role: 'Senior Tax Advisor', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 650000, email: 'carmen.lucas@skyhouse.acct', joinedDate: '2023-04-12' },
  { id: '934653', name: 'Millie Tran', role: 'Audit Manager', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 750000, email: 'millie.tran@skyhouse.acct', joinedDate: '2022-09-01' },
  { id: '934654', name: 'Sasha Turner', role: 'Financial Analyst', avatar: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 500000, email: 'sasha.turner@skyhouse.acct', joinedDate: '2024-03-31' },
  { id: '934655', name: 'Terry Melton', role: 'Junior Associate', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 350000, email: 'terry.melton@skyhouse.acct', joinedDate: '2025-01-10' },
  { id: '934656', name: 'Maddie Molina', role: 'Bookkeeper', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 400000, email: 'maddie.molina@skyhouse.acct', joinedDate: '2023-11-20' },
  { id: '934657', name: 'Charles Garza', role: 'Client Manager', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 700000, email: 'charles.garza@skyhouse.acct', joinedDate: '2021-06-15' },
  { id: '934658', name: 'Adem Barnes', role: 'Tax Associate', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 520000, email: 'adem.barnes@skyhouse.acct', joinedDate: '2024-05-18' },
  { id: '934659', name: 'Jasmin Lowery', role: 'Auditor', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 600000, email: 'jasmin.lowery@skyhouse.acct', joinedDate: '2023-08-25' },
  { id: '934660', name: 'Katrina Malone', role: 'Senior Auditor', avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 850000, email: 'katrina.malone@skyhouse.acct', joinedDate: '2020-03-14' },
  { id: '934661', name: 'Tanisha Combs', role: 'Operations Lead', avatar: 'https://images.unsplash.com/photo-1548142813-c348350df52b?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 650000, email: 'tanisha.combs@skyhouse.acct', joinedDate: '2022-10-01' },
  { id: '934662', name: 'Vinnie Atkinson', role: 'Accounting Intern', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 250000, email: 'vinnie.atkinson@skyhouse.acct', joinedDate: '2025-05-01' },
  { id: '934663', name: 'Samia Moon', role: 'Corporate Counsel', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100', status: 'active', hourlyRate: 1100000, email: 'samia.moon@skyhouse.acct', joinedDate: '2021-02-19' },
];

/**
 * Helper to calculate Nigerian payroll deductions
 * - PAYE: approximate using simplified 12% average band
 * - Pension: 8% of gross basic salary
 * - NHF: 2.5% of gross basic salary
 */
function calculateDeductions(grossAmount: number) {
  const payeTax = Math.floor(grossAmount * 0.12);
  const pension = Math.floor(grossAmount * 0.08);
  const nhf = Math.floor(grossAmount * 0.025);
  const netPay = grossAmount - (payeTax + pension + nhf);
  return { payeTax, pension, nhf, netPay };
}

// Default registers with realistic Nigerian payroll calculations in kobo
const DEFAULT_REGISTERS: PayoutRegister[] = [
  {
    id: 'Register #281',
    name: 'Bi-Weekly Staff Payroll',
    status: 'Paid',
    totalAmount: 2269204000, // Net pay sum
    date: '12 Oct, 2:52pm',
    totalGrossPay: 2928000000,
    totalTaxWithheld: 351360000,
    items: [
      { id: '281-934651', employeeId: '934651', employeeName: 'Alia Bonner', employeeAvatar: DEFAULT_EMPLOYEES[0].avatar, amount: 412000000, status: 'Pending', ...calculateDeductions(412000000) },
      { id: '281-934652', employeeId: '934652', employeeName: 'Carmen Lucas', employeeAvatar: DEFAULT_EMPLOYEES[1].avatar, amount: 245020000, status: 'Pending', ...calculateDeductions(245020000) },
      { id: '281-934653', employeeId: '934653', employeeName: 'Millie Tran', employeeAvatar: DEFAULT_EMPLOYEES[2].avatar, amount: 374030000, status: 'Paid', ...calculateDeductions(374030000) },
      { id: '281-934654', employeeId: '934654', employeeName: 'Sasha Turner', employeeAvatar: DEFAULT_EMPLOYEES[3].avatar, amount: 398000000, status: 'Paid', ...calculateDeductions(398000000) },
      { id: '281-934655', employeeId: '934655', employeeName: 'Terry Melton', employeeAvatar: DEFAULT_EMPLOYEES[4].avatar, amount: 191500000, status: 'Paid', ...calculateDeductions(191500000) },
      { id: '281-934656', employeeId: '934656', employeeName: 'Maddie Molina', employeeAvatar: DEFAULT_EMPLOYEES[5].avatar, amount: 406500000, status: 'Paid', ...calculateDeductions(406500000) },
      { id: '281-934657', employeeId: '934657', employeeName: 'Charles Garza', employeeAvatar: DEFAULT_EMPLOYEES[6].avatar, amount: 281000000, status: 'Paid', ...calculateDeductions(281000000) },
    ]
  },
  {
    id: 'Register #284',
    name: 'Quarterly Executive Bonus Pool & Senior Contractors',
    status: 'Pending',
    totalAmount: 10345050000,
    date: '14 Oct, 9:00am',
    totalGrossPay: 10345050000,
    totalTaxWithheld: 0,
    items: [
      { id: '284-934651', employeeId: '934651', employeeName: 'Alia Bonner', employeeAvatar: DEFAULT_EMPLOYEES[0].avatar, amount: 500000000, status: 'Pending', ...calculateDeductions(500000000) },
      { id: '284-934660', employeeId: '934660', employeeName: 'Katrina Malone', employeeAvatar: DEFAULT_EMPLOYEES[9].avatar, amount: 1250000000, status: 'Pending', ...calculateDeductions(1250000000) },
      { id: '284-934661', employeeId: '934661', employeeName: 'Tanisha Combs', employeeAvatar: DEFAULT_EMPLOYEES[10].avatar, amount: 950000000, status: 'Pending', ...calculateDeductions(950000000) },
      { id: '284-934663', employeeId: '934663', employeeName: 'Samia Moon', employeeAvatar: DEFAULT_EMPLOYEES[12].avatar, amount: 1545050000, status: 'Pending', ...calculateDeductions(1545050000) },
      { id: '284', employeeId: 'external-1', employeeName: 'Contractor Group (15 pax)', employeeAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100', amount: 6100000000, status: 'Pending', ...calculateDeductions(6100000000) },
    ]
  }
];

// Default Nigerian bank accounts with realistic high nominal values in Naira (stored as kobo)
const DEFAULT_BANK_ACCOUNTS: BankAccount[] = [
  { id: 'ba-1', name: 'Main Operating Access Checking', type: 'Checking', balance: 12825602500, accountNumber: '•••• 4920', pendingAmount: -10600000 },
  { id: 'ba-2', name: 'FGN Tax Reserve Account', type: 'Savings', balance: 4500000000, accountNumber: '•••• 8831', pendingAmount: 0 },
  { id: 'ba-3', name: 'Zenith Escrow Client Holding', type: 'Savings', balance: 3254000000, accountNumber: '•••• 1205', pendingAmount: 0 },
];

const DEFAULT_CARDS: CreditCard[] = [
  { id: 'card-1', name: 'Corporate Master Access', type: 'physical', cardNumber: '•••• 6812', expiry: '09/29', cardType: 'mastercard', limit: 500000000, balance: 14205000, theme: 'amber-fire' },
  { id: 'card-2', name: 'SaaS Virtual Services', type: 'virtual', cardNumber: '•••• 5647', expiry: '12/28', cardType: 'visa', limit: 100000000, balance: 8352000, theme: 'cosmic-wave' },
];

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', date: '2026-06-12', description: 'Vite Software Premium Subscription', amount: 1500000, type: 'credit', category: 'Software', account: 'Main Operating Access Checking', reference: 'VT-9938' },
  { id: 'tx-2', date: '2026-06-11', description: 'Office Depot - Logistics Office Supplies', amount: 32000000, type: 'credit', category: 'Office Rent & Supplies', account: 'Main Operating Access Checking', reference: 'OD-4412' },
  { id: 'tx-3', date: '2026-06-10', description: 'Client Audit Fee - Vertex Ltd', amount: 840000000, type: 'debit', category: 'Consulting Revenue', account: 'Main Operating Access Checking', reference: 'INV-1029' },
  { id: 'tx-4', date: '2026-06-08', description: 'AWS Enterprise Cloud Hosting', amount: 72500000, type: 'credit', category: 'Software', account: 'Main Operating Access Checking', reference: 'TX-9381' },
  { id: 'tx-5', date: '2026-06-05', description: 'Tax Consulting Deposit - Apex Retail', amount: 1250000000, type: 'debit', category: 'Consulting Revenue', account: 'Main Operating Access Checking', reference: 'INV-1030' },
  { id: 'tx-6', date: '2026-06-01', description: 'Skyhouse Ikeja Office Rent Payment', amount: 450000000, type: 'credit', category: 'Office Rent & Supplies', account: 'Main Operating Access Checking', reference: 'RENT-JUN' },
  { id: 'tx-7', date: '2026-05-28', description: 'Corporate Tax Return Fee - NeoCorp', amount: 1450000000, type: 'debit', category: 'Consulting Revenue', account: 'Main Operating Access Checking', reference: 'INV-1028' },
  { id: 'tx-8', date: '2026-05-15', description: 'MDN Fiber Business Interconnect', amount: 12000000, type: 'credit', category: 'Software', account: 'Main Operating Access Checking', reference: 'COM-991' },
];

// Invoices targeting Nigerian SMEs with 7.5% VAT and 10% Withholding Tax (WHT)
const DEFAULT_INVOICES: Invoice[] = [
  {
    id: 'INV-1031',
    clientName: 'Google AI Cloud Nigeria',
    clientEmail: 'billing@google-ai.com',
    date: '2026-06-08',
    dueDate: '2026-07-08',
    status: 'Unpaid',
    total: 2450000000,
    terms: 'Net 30',
    whtAmount: 245000000, // 10% WHT
    vatAmount: 183750000, // 7.5% VAT
    items: [
      { id: 'inv-item-1', description: 'Strategic Financial Advisory (Q2)', quantity: 1, unitPrice: 1500000000, amount: 1500000000 },
      { id: 'inv-item-2', description: 'R&D Tax Credit Filing Services', quantity: 1, unitPrice: 950000000, amount: 950000000 },
    ]
  },
  {
    id: 'INV-1030',
    clientName: 'Apex Retail Lagos',
    clientEmail: 'finance@apexretail.io',
    date: '2026-06-05',
    dueDate: '2026-06-25',
    status: 'Paid',
    total: 1250000000,
    terms: 'Net 20',
    whtAmount: 125000000,
    vatAmount: 93750000,
    items: [
      { id: 'inv-item-3', description: 'Multi-State Sales Tax Audit Prep', quantity: 25, unitPrice: 50000000, amount: 1250000000 },
    ]
  },
  {
    id: 'INV-1029',
    clientName: 'Vertex Ltd',
    clientEmail: 'bills@vertex.co.uk',
    date: '2026-06-02',
    dueDate: '2026-07-02',
    status: 'Paid',
    total: 840000000,
    terms: 'Net 30',
    whtAmount: 84000000,
    vatAmount: 63000000,
    items: [
      { id: 'inv-item-4', description: 'Corporate Forensic Stock Audit', quantity: 1, unitPrice: 840000000, amount: 840000000 },
    ]
  },
  {
    id: 'INV-1028',
    clientName: 'NeoCorp West Africa',
    clientEmail: 'accounts@neocorp.global',
    date: '2026-05-24',
    dueDate: '2026-06-24',
    status: 'Paid',
    total: 1450000000,
    terms: 'Net 30',
    whtAmount: 145000000,
    vatAmount: 108750000,
    items: [
      { id: 'inv-item-5', description: 'Annual Corporate Filing Submission', quantity: 1, unitPrice: 1000000000, amount: 1000000000 },
      { id: 'inv-item-6', description: 'International Tax Structuring Advisory', quantity: 3, unitPrice: 150000000, amount: 450000000 },
    ]
  },
  {
    id: 'INV-1027',
    clientName: 'Hyperion Energy LTD',
    clientEmail: 'pay@hyperion.com',
    date: '2026-05-10',
    dueDate: '2026-06-10',
    status: 'Overdue',
    total: 1890000000,
    terms: 'Net 30',
    whtAmount: 189000000,
    vatAmount: 141750000,
    items: [
      { id: 'inv-item-7', description: 'Mergers & Acquisitions Financial Diligence', quantity: 1, unitPrice: 1890000000, amount: 1890000000 },
    ]
  }
];

export const CHART_OF_ACCOUNTS: ChartOfAccount[] = [
  // Assets
  { code: '1010', name: 'Cash & Cash Equivalents', type: 'Asset', balance: 20579602500 },
  { code: '1100', name: 'Accounts Receivable (AR)', type: 'Asset', balance: 4340000000 },
  { code: '1200', name: 'Prepaid Expenses', type: 'Asset', balance: 1200000000 },
  { code: '1500', name: 'Office Equipment & Computing', type: 'Asset', balance: 856000000 },
  
  // Liabilities
  { code: '2010', name: 'Accounts Payable (AP)', type: 'Liability', balance: 14205000 },
  { code: '2200', name: 'Accrued Payroll Liability', type: 'Liability', balance: 10345050000 },
  { code: '2300', name: 'Unearned Revenue', type: 'Liability', balance: 2500000000 },

  // Equity
  { code: '3010', name: 'Corporate Share Capital', type: 'Equity', balance: 15000000000 },
  { code: '3100', name: 'Retained Earnings', type: 'Equity', balance: 5336142500 },

  // Revenues
  { code: '4000', name: 'Strategic Advisory Revenue', type: 'Revenue', balance: 3540000000 },
  { code: '4100', name: 'Audit & Tax Advisory Fees', type: 'Revenue', balance: 2340000000 },

  // Expenses
  { code: '5015', name: 'Salary & Compensation Expense', type: 'Expense', balance: 6792040000 },
  { code: '5020', name: 'Software & Cloud Services', type: 'Expense', balance: 8600000 },
  { code: '5030', name: 'Office Rent & Ikeja Logistics', type: 'Expense', balance: 48200000 },
];

/**
 * Returns the parsed AppState state representation.
 * Handles migration to FinanceOS schemas gracefully if needed.
 */
export function getInitialState(): AppState {
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      console.error('Failed to parse local state, resetting to default', e);
    }
  }

  const state = {
    bankAccounts: DEFAULT_BANK_ACCOUNTS,
    cards: DEFAULT_CARDS,
    employees: DEFAULT_EMPLOYEES,
    payoutRegisters: DEFAULT_REGISTERS,
    transactions: DEFAULT_TRANSACTIONS,
    invoices: DEFAULT_INVOICES,
    schedulesActive: true,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

/**
 * Saves the current app state inside the persistent browser storage.
 */
export function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Months definitions
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface ChartDataPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}

// Historical Nigerian business curves in Naira values
export const CHART_DUMMY_DATA: ChartDataPoint[] = [
  { month: 'Jan', income: 45000000, expense: 28000000, net: 17000000 },
  { month: 'Feb', income: 52000000, expense: 31000000, net: 21000000 },
  { month: 'Mar', income: 49000000, expense: 29000000, net: 20000000 },
  { month: 'Apr', income: 58000000, expense: 34000000, net: 24000000 },
  { month: 'May', income: 64000000, expense: 42000000, net: 22000000 },
  { month: 'Jun', income: 75000000, expense: 46000000, net: 29000000 },
  { month: 'Jul', income: 82000000, expense: 50000000, net: 32000000 },
  { month: 'Aug', income: 93450000, expense: 62000000, net: 31450000 },
  { month: 'Sep', income: 88000000, expense: 57000000, net: 31000000 },
  { month: 'Oct', income: 103450000, expense: 67920000, net: 35530000 },
  { month: 'Nov', income: 95000000, expense: 53000000, net: 42000000 },
  { month: 'Dec', income: 110000000, expense: 61000000, net: 49000000 },
];
