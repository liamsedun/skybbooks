Goal
====================
Maintain and enhance accounting features: fix kobo/naira display, parent-child account rollups, debit/credit columns with totals, CSV exports, vendor import with opening balance, trial balance drill-down links, and auto-generated customer IDs (CS-XXXX).

## Constraints & Preferences
- Balance values stored in kobo (bigint); frontend must divide by 100 for display (`fmtNaira`)
- Parent accounts must NOT contribute to totals (would double-count children's balances)
- Trial balance drill-down links use `MODULE_LINKS` prefix-matching in `ReportsPage.tsx`
- Contacts table used for both customers and vendors (differentiated by `type` column)

## Progress
### Done
- **Chart of Accounts `fmtNaira` fix**: Both positive and negative balance formatting now divide by 100 (kobo→naira), matching Trial Balance implementation
- **Parent-child aggregation**: `computeAggregateBalances()` in Chart of Accounts and backend rollup in `getTrialBalance()` sum child balances into parent accounts recursively
- **Debit/Credit columns**: Replaced single Balance column with separate Debit/Credit columns in Chart of Accounts; added totals footer row excluding parent accounts
- **Double-counting fix**: Parent accounts excluded from totals in Chart of Accounts (frontend `parentIds` set), Trial Balance backend (`parentChildren.has(r.accountId) ? 0`), and print/CSV exports
- **Chart of Accounts CSV export**: Replaced backend `apiDownload` with client-side `exportToCsv()` using loaded `effectiveAccounts` data, including Debit/Credit columns and parent-excluded TOTAL row
- **Trial Balance hierarchical tree (reverted)**: Added `parentId` to `TrialBalanceRow` type, built tree rendering with indentation — reverted because drill-down links to Customers/Banking/Items were lost
- **Vendor bulk CSV import**: Backend `POST /purchases/vendors/import-csv` route parses CSV with flexible column matching, validates emails, inserts into contacts table; frontend Sample CSV + Import CSV modal with file upload, preview, error handling
- **Vendor opening balance**: Added `openingBalance` field to Add/Edit Vendor form (NGN input, converted to kobo); included in CSV template, export (`Opening Balance` column), and import route (`balance` column)
- **Trial balance revert**: Hierarchical tree reverted to restore flat rendering with ExternalLink drill-down buttons
- **1010 prefix → Customers**: Trade & Other Receivables (101000) links to `/sales/customers`
- **3000 prefix → Bills**: Trade & Other Payables (300000) links to `/purchases/bills`
- **Customer ID (CS-XXXX)**: Auto-generated sequential customer code on create; displayed as read-only field in Add/Edit Customer form; stored in `contacts.customer_code` column
- **TB AR/AP account resolution fix**: Changed `arAccount`/`apAccount` resolution to use `systemAccountRole` first (matching all transaction services), with fallback to name-based search for backward compatibility (`src/services/ledger.service.ts:426-429`)
- **TB Customer/Vendor OB logic fix**: Replaced broken `max(0, customerOB - jeAr)` gap formula with simple `openingDebits += customerOB` — always adds customer opening balances on top of JE activity, so TB Trade Receivables matches the Customers page total (₦103.2M) exactly
- **Bulk send invoices fix**: Replaced N individual `POST /invoices/:id/send` calls with a single `POST /invoices/bulk-send` endpoint that processes all invoices in one DB transaction — prevents transaction contention and inventory lot deadlocks (`src/services/invoice.service.ts:568-630`, `src/routes/sales.ts:300-314`, `src/pages/sales/InvoiceList.tsx:257-267`)
- **Prevent duplicate customers on CSV re-import**: `POST /customers` now checks for existing customer by name+org. If found, updates the record (adds opening balance to existing balance, merges contact fields) instead of creating a duplicate (`src/routes/sales.ts:651-698`)
- **Duplicate customer merge migration**: Startup migration detects duplicate customer names, reassigns invoices/payments/creditnotes/quotes to the kept record, merges balances, and deletes the duplicate (`src/db/migrate.ts:233-262`)

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Parent-child rollup done post-hoc after individual account balances are computed (backend for Trial Balance, `useMemo` for Chart of Accounts frontend)
- Parents identified by which account IDs are referenced as `parentId` by other accounts
- Vendor CSV import uses custom CSV parser (handle quoted fields) rather than a library
- Trial balance drill-down links preserved over hierarchical tree display when trade-off arose
- `balance` column in contacts table doubles as opening balance for vendors, stored in kobo
- Customer code uses count+1 of existing customer records per org (not a dedicated sequence table)

## Next Steps
1. Push to origin/main and verify Render auto-deploy completes
2. Test period close flow end-to-end
3. Test bank reconciliation statement print

## Critical Context
- `TrialBalanceRow` type no longer includes `parentId` after revert (field removed from backend type and response)
- `MODULE_LINKS` prefix-matching is sequential — order matters; `1010` before `1011` to avoid `1011` catching `1010` prefixes
- `contacts.balance` is in kobo; form inputs in Naira are multiplied by 100 before sending
- `parentChildren.has(accountId)` guards prevent double-counting in Trial Balance totals; frontend uses `parentIds` set derived from `effectiveAccounts`
- Pre-existing TS errors (module resolution, `opening_stock` enum) still present in `ledger.service.ts:273` and `ReportsPage.tsx:1177,1179`

## Relevant Files
- `src/pages/accountant/ChartOfAccounts.tsx`: `fmtNaira()` kobo→naira fix, `computeAggregateBalances()` parent rollup, `toDebitCredit()` helper, debit/credit columns, parent-excluded totals, client-side CSV export
- `src/services/ledger.service.ts`: `parentChildren` aggregation in `getTrialBalance()`, parent-excluded totalDr/totalCr
- `src/pages/reports/ReportsPage.tsx`: `MODULE_LINKS` array (1010→Customers, 3000→Bills), flat trial balance rendering with ExternalLink buttons, parent-excluded CSV totals
- `src/pages/purchases/Vendors.tsx`: `openingBalance` in form state/modal/export, Sample CSV + Import CSV modal
- `src/routes/purchases.ts`: `POST /vendors/import-csv` route with CSV parsing, validation, opening balance column
- `src/pages/sales/Customers.tsx`: Auto-generated read-only customer code (CS-XXXX) in Add/Edit modal
- `src/routes/sales.ts`: `POST /customers` generates sequential `customerCode` per org
- `src/db/schema.ts`: `contacts.customerCode` column added
- `src/db/migrate.ts`: Migration for `customer_code` column
