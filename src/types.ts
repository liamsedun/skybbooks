/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Represents a monetary value in Nigerian Kobo (integer).
 * 1 Naira = 100 Kobo.
 */
export type Kobo = number;

/**
 * Represents a double-entry general ledger transaction.
 */
export interface Transaction {
  id: string;
  date: string;
  description: string;
  /** Amount in kobo (integer) */
  amount: Kobo;
  /** 'debit' increases assets/expenses, 'credit' increases liabilities/equity/revenue */
  type: 'debit' | 'credit';
  /** General Ledger category name */
  category: string;
  /** Capital holding source account */
  account: string;
  /** Audit reference identifier */
  reference?: string;
}

/**
 * Represents a registered bank account.
 */
export interface BankAccount {
  id: string;
  name: string;
  type: 'Checking' | 'Savings' | 'Credit Card';
  /** Account balance in kobo (integer) */
  balance: Kobo;
  accountNumber: string;
  /** Pending audited amount in kobo (integer) */
  pendingAmount: Kobo;
}

/**
 * Represents an expense or commercial credit card.
 */
export interface CreditCard {
  id: string;
  name: string;
  type: 'physical' | 'virtual';
  cardNumber: string;
  expiry: string;
  cardType: 'visa' | 'mastercard';
  /** Spend limit in kobo (integer) */
  limit: Kobo;
  /** Current balance in kobo (integer) */
  balance: Kobo;
  theme: 'amber-fire' | 'cosmic-wave' | 'emerald-glass';
}

/**
 * Represents a corporate employee/consultant record.
 */
export interface Employee {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'active' | 'inactive';
  /** Hourly wage rate in kobo (integer) */
  hourlyRate: Kobo;
  email: string;
  joinedDate: string;
}

/**
 * Represents a payout ledger line item inside a payroll register.
 */
export interface PayoutItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeAvatar: string;
  /** Total gross disbursement in kobo (integer) */
  amount: Kobo;
  status: 'Pending' | 'Paid';
  /** PAYE Withholding deduction in kobo (integer) */
  payeTax?: Kobo;
  /** 8% Pension deduction in kobo (integer) */
  pension?: Kobo;
  /** 2.5% National Housing Fund deduction in kobo (integer) */
  nhf?: Kobo;
  /** Net disbursement to employee bank account in kobo (integer) */
  netPay?: Kobo;
}

/**
 * Represents a collective payroll/bonus payout register.
 */
export interface PayoutRegister {
  id: string;
  name: string;
  status: 'Pending' | 'Paid';
  /** Total sum of net disbursements in kobo (integer) */
  totalAmount: Kobo;
  date: string;
  items: PayoutItem[];
  /** Total gross pay sum of items in kobo (integer) */
  totalGrossPay?: Kobo;
  /** Total tax withheld in kobo (integer) */
  totalTaxWithheld?: Kobo;
}

/**
 * Represents a single line item of a commercial invoice.
 */
export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  /** Price of a single unit in kobo (integer) */
  unitPrice: Kobo;
  /** Product quantity multiplied by unit price in kobo (integer) */
  amount: Kobo;
}

/**
 * Represents a corporate client invoice.
 */
export interface Invoice {
  id: string;
  clientName: string;
  clientEmail: string;
  date: string;
  dueDate: string;
  status: 'Paid' | 'Unpaid' | 'Overdue';
  items: InvoiceItem[];
  /** Invoice pre-tax/post-tax value inside ledger in kobo (integer) */
  total: Kobo;
  terms?: string;
  /** Withholding tax (WHT) of 5% or 10% on corporate invoices in kobo (integer) */
  whtAmount?: Kobo;
  /** VAT of 7.5% on commercial invoices in kobo (integer) */
  vatAmount?: Kobo;
}

/**
 * Represents a Chart of Account general ledger structure.
 */
export interface ChartOfAccount {
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  /** Current account balance in kobo (integer) */
  balance: Kobo;
}
