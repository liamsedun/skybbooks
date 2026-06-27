const BOM = '\uFEFF';

function csvEscape(val: string): string {
  return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
}

export function downloadCsv(filename: string, headers: string[], sampleRow: string[]) {
  const csv = [headers.map(csvEscape).join(','), sampleRow.map(csvEscape).join(',')].join('\n');
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r$/, '');
  const lines = cleaned.split(/\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(line => parseCsvLine(line));
  return { headers, rows };
}

export const CSV_TEMPLATES: Record<string, { headers: string[]; sample: string[]; filename: string }> = {
  customers: {
    filename: 'customers-template.csv',
    headers: ['name', 'email', 'phone', 'address', 'city', 'state', 'country', 'taxPin', 'paymentTerms (days)', 'creditLimit (NGN)', 'openingBalance (NGN)', 'currency', 'notes'],
    sample: ['Acme Corp', 'contact@acme.com', '+2348012345678', '123 Main St', 'Lagos', 'Lagos', 'Nigeria', 'PST-001', '30', '500000', '0', 'NGN', 'Preferred customer'],
  },
  quotes: {
    filename: 'quotes-template.csv',
    headers: ['customerId (or name)', 'date (YYYY-MM-DD)', 'expiryDate', 'currency', 'notes', 'terms', 'line_description', 'line_quantity', 'line_unitPrice (NGN)', 'line_discountPct', 'line_taxRate'],
    sample: ['Acme Corp', '2026-06-24', '2026-07-24', 'NGN', 'Quote notes', 'Standard terms', 'Consulting service', '1', '50000', '0', '7.5'],
  },
  salesOrders: {
    filename: 'sales-orders-template.csv',
    headers: ['customerId (or name)', 'date (YYYY-MM-DD)', 'expectedDelivery', 'currency', 'notes', 'line_description', 'line_quantity', 'line_unitPrice (NGN)', 'line_discountPct', 'line_taxRate'],
    sample: ['Acme Corp', '2026-06-24', '2026-07-24', 'NGN', 'Order notes', 'Product A', '10', '2500', '0', '7.5'],
  },
  invoices: {
    filename: 'invoices-template.csv',
    headers: ['customerId (or name)', 'date (YYYY-MM-DD)', 'dueDate', 'currency', 'notes', 'terms', 'line_description', 'line_quantity', 'line_unitPrice (NGN)', 'line_discountPct', 'line_taxRate'],
    sample: ['Acme Corp', '2026-06-24', '2026-07-24', 'NGN', 'Invoice notes', 'Net 30', 'Web development', '1', '200000', '0', '7.5'],
  },
  paymentsReceived: {
    filename: 'payments-received-template.csv',
    headers: ['customerId (or name)', 'payerName', 'date (YYYY-MM-DD)', 'amount (NGN)', 'paymentMethod', 'reference', 'category', 'notes'],
    sample: ['Acme Corp', 'Acme Corp', '2026-06-24', '50000', 'bank_transfer', 'TXN-12345', 'sales_invoice', 'Payment for INV-0001'],
  },
  creditNotes: {
    filename: 'credit-notes-template.csv',
    headers: ['customerId (or name)', 'invoiceNumber (optional)', 'date (YYYY-MM-DD)', 'subtotal (NGN)', 'tax (NGN)', 'notes'],
    sample: ['Acme Corp', 'INV-0001', '2026-06-24', '50000', '3750', 'Credit for damaged goods'],
  },
  recurringInvoices: {
    filename: 'recurring-invoices-template.csv',
    headers: ['customerId (or name)', 'frequency', 'startDate (YYYY-MM-DD)', 'endDate', 'template_paymentTerms (days)', 'template_currency', 'template_notes', 'template_terms', 'line_description', 'line_quantity', 'line_unitPrice (NGN)', 'line_discountPct', 'line_taxRate'],
    sample: ['Acme Corp', 'monthly', '2026-06-24', '2027-06-24', '30', 'NGN', 'Monthly retainer', 'Net 30', 'Retainer fee', '1', '100000', '0', '7.5'],
  },
  // Purchases module
  vendors: {
    filename: 'vendors-template.csv',
    headers: ['name', 'email', 'phone', 'address', 'city', 'state', 'country', 'taxPin', 'paymentTerms (days)', 'creditLimit (NGN)', 'openingBalance (NGN)', 'currency', 'notes'],
    sample: ['Supply Corp', 'supply@example.com', '+2348012345678', '456 Industrial Ave', 'Lagos', 'Lagos', 'Nigeria', 'VAT-001', '30', '500000', '0', 'NGN', 'Preferred vendor'],
  },
  expenses: {
    filename: 'expenses-template.csv',
    headers: ['vendorId (or name)', 'accountId (or name)', 'date (YYYY-MM-DD)', 'amount (NGN)', 'taxAmount (NGN)', 'paymentMethod', 'reference', 'description', 'isBillable (yes/no)'],
    sample: ['Supply Corp', 'Office Supplies', '2026-06-24', '50000', '3750', 'bank_transfer', 'EXP-001', 'Office supplies purchase', 'no'],
  },
  recurringExpenses: {
    filename: 'recurring-expenses-template.csv',
    headers: ['vendorId (or name)', 'accountId (or name)', 'frequency', 'amount (NGN)', 'taxAmount (NGN)', 'description', 'paymentMethod', 'startDate (YYYY-MM-DD)', 'endDate'],
    sample: ['Supply Corp', 'Rent Expense', 'monthly', '200000', '15000', 'Office rent', 'bank_transfer', '2026-06-24', '2027-06-24'],
  },
  purchaseOrders: {
    filename: 'purchase-orders-template.csv',
    headers: ['vendorId (or name)', 'date (YYYY-MM-DD)', 'expectedDate', 'notes', 'line_description', 'line_quantity', 'line_unitPrice (NGN)', 'line_taxRate'],
    sample: ['Supply Corp', '2026-06-24', '2026-07-24', 'PO notes', 'Raw materials', '100', '500', '7.5'],
  },
  bills: {
    filename: 'bills-template.csv',
    headers: ['vendorId (or name)', 'date (YYYY-MM-DD)', 'dueDate', 'currency', 'notes', 'line_description', 'line_quantity', 'line_unitPrice (NGN)', 'line_taxRate'],
    sample: ['Supply Corp', '2026-06-24', '2026-07-24', 'NGN', 'Bill notes', 'Consulting services', '1', '250000', '7.5'],
  },
  paymentsMade: {
    filename: 'payments-made-template.csv',
    headers: ['vendorId (or name)', 'date (YYYY-MM-DD)', 'amount (NGN)', 'paymentMethod', 'reference', 'notes'],
    sample: ['Supply Corp', '2026-06-24', '100000', 'bank_transfer', 'PMT-REF-001', 'Payment for invoices'],
  },
  employees: {
    filename: 'employees-template.csv',
    headers: ['staffId', 'firstName', 'middleName', 'lastName', 'email', 'phone', 'department', 'designation', 'dateOfBirth (YYYY-MM-DD)', 'dateHired (YYYY-MM-DD)', 'bankName', 'accountNumber', 'grossSalary (NGN)', 'paymentFrequency', 'pensionPin', 'nhfNumber', 'taxId', 'isActive (yes/no)'],
    sample: ['EMP-001', 'John', 'Michael', 'Doe', 'john@company.com', '+2348012345678', 'Engineering', 'Software Engineer', '1990-01-15', '2024-06-01', 'GTBank', '0123456789', '500000', 'monthly', 'PEN100012345', 'NHF123456', 'TIN12345678', 'yes'],
  },
  purchaseCreditNotes: {
    filename: 'vendor-credit-notes-template.csv',
    headers: ['vendorId (or name)', 'date (YYYY-MM-DD)', 'subtotal (NGN)', 'tax (NGN)', 'notes', 'billNumber (optional)'],
    sample: ['Supply Corp', '2026-06-24', '50000', '3750', 'Returned damaged goods', 'BILL-0001'],
  },
  // Inventory module
  inventoryOpeningStock: {
    filename: 'inventory-opening-stock-template.csv',
    headers: ['itemName (or SKU)', 'quantity', 'unitCost (NGN)', 'total (NGN)'],
    sample: ['Android Mobile POS', '100', '152500', '15250000'],
  },
  // Banking module
  bankOpeningBalances: {
    filename: 'bank-opening-balances-template.csv',
    headers: ['bankName (or accountNumber)', 'openingBalance (NGN)'],
    sample: ['Guaranty Trust Bank • ****6789', '5000000'],
  },
  trialBalanceOpeningBalances: {
    filename: 'trial-balance-opening-balances-template.csv',
    headers: ['accountCode', 'accountName', 'debit (NGN)', 'credit (NGN)'],
    sample: ['100000', 'Cash and Cash Equivalents', '5000000', '0'],
  },
};
