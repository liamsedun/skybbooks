Goal
====================
Maintain and enhance accounting features: fix kobo/naira display, parent-child account rollups, debit/credit columns with totals, CSV exports, vendor import with opening balance, trial balance drill-down links, auto-generated customer IDs (CS-XXXX), and consistent VAT labeling (not "Tax").

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
- **Tax → VAT rename**: Renamed all "Tax" display labels to "VAT" across Sales and Purchases modules: column headers (`Tax %` → `VAT %`, `Tax (₦)` → `VAT (₦)`), CSV export headers, detail view labels, and PDF labels in 8 files
- **Multi-currency backend**: Added `fxRate` column + `populateFxRate()` calls to expenses, credit notes, vendor credits, purchase orders, and payments made services; fixed `populateFxRate` calls that incorrectly passed `tx` as baseCurrency
- **CurrencySelector component**: Reusable `src/components/ui/CurrencySelector.tsx` with currency dropdown + auto-filled fxRate from rates API; shows editable FX Rate input for non-NGN currencies
- **CurrencySelector integration**: Added to all 9 transaction forms — InvoiceForm, Bills, Expenses, PaymentsReceived, RecordPaymentDrawer, PaymentsMade (create+edit), CreditNotes, PurchaseCreditNotes, PurchaseOrders — replacing hardcoded `currency: 'NGN'` with dynamic selector
- **Opening stock TB/IS fix**: `getInventoryValueAsOf()` rewritten to forward approach; Opening Stock in Trial Balance now matches Income Statement (₦103.2M)
- **Payroll JE restructure**: Added 301501 PAYE Payable, 306000 NHIS Payable, 800301 PAYE Expense accounts; payroll JEs wire through 301500 clearing; employer NHIS (10% of basic) added
- **balanceSheet bank override → JE-based approach**: Removed `bankMap` from both `getTrialBalance()` and `getBalanceSheet()`; Flutterwave sync no longer sets `currentBalance` directly; manual balance adjust / OB import create JEs through 207000 Bank Clearing Suspense
- **Audit trail system**: Added `userAgent` column + indexes to `audit_log` schema (`src/db/schema.ts:998`); startup migration creates column+indexes; admin-only guard on `GET /audit-log` + `/pdf` via `requireRole('admin')`; entity-route mapping in `AuditLogsPage.tsx` with collapsible `DiffView` (old→new field changes); action badge colors (create=green, update=amber, delete=red); user-agent and IP display in CSV/PDF exports; wired `createAuditLog()` into 10 key write routes (customer/vendor create+update, invoice/bill create+void, JE create+reverse)
- **Legacy Migration system**: Complete pipeline via `POST /migrate/legacy` backend route with financial extraction, chart normalization, entity migration (customers/vendors/accounts/JEs), opening balances as JEs through clearing account; DB migration adds `migration_id`, `legacy_data` columns to ledgers, creates `legacy_migrations` table; `LegacyImportPage` at `/settings/legacy-import` with 5-step wizard (upload → mapping → preview → execute → results)
- **IS Line Items fix**: Replaced simplified placeholder IS lines with correct structure — Revenue, COS, Gross Profit, Admin Expenses, Marketing Expenses, Other Income, Other Expenses, Finance Income, Finance Cost, Net Profit
- **Cash Flow Statement form**: Built indirect method with Operating Activities (net income → adjustments → working capital), Investing Activities (fixed assets, investments), Financing Activities (loans, equity, dividends), net cash change sections
- **SOCIE form**: Built Statement of Changes in Equity with Opening Balance, Net Income, Drawings, Dividends, Closing Balance rows
- **Comparative Reports legacy handling**: `buildPnLRows()` handles legacy line-item shape mismatch with `legacyDetail` expandable section; `buildBalanceSheetRows()` handles legacy accounts shape with category ordering; `ComparativePnLTable` + `ComparativeCashFlowTable` accept `priorLegacy`/`priorEmpty` flags — shows "Legacy" badge on Prior column header + "Migrated from Prior System" banner when `priorLegacy`, shows "No comparative data" amber card when `priorEmpty`; entry point at `ReportTable` passes both flags

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
- PO approval flow: draft → confirmed → accepted → approved → bill/expense; only draft can be deleted, draft+confirmed can be edited
- PO status enum extended with `confirmed`, `accepted`, `approved` for the approval workflow
- CurrencySelector fetches rates via `bankingApi.getCurrencyRates()` and auto-fills fxRate on currency change; rate field editable for manual override
- `fxRate` sent as `number | undefined` in payloads; `populateFxRate()` on backend handles null/undefined by looking up latest rate
- Audit logs are immutable append-only; corrections must deep-link to entity edit/reversal rather than modifying logs directly

## Next Steps
1. Push to origin/main and verify Render auto-deploy completes
2. Update detail views (InvoiceDetail, BillDetail, etc.) to display currency + both original and base (NGN) amounts
3. Test multi-currency transaction flow end-to-end
4. Investigate Purchase Order unit price bug: AMC Tier 2 item shows extra zero (2,500,000 instead of 250,000) — likely a data issue with the item's stored `purchasePrice` value rather than a code bug
5. Verify bank reconciliation flow still works after bankMap removal — bank feed transactions are imported as 'unreconciled' and matched against GL-based JEs; clearing account (207000) shows the difference

## Critical Context
- `TrialBalanceRow` type no longer includes `parentId` after revert (field removed from backend type and response)
- `MODULE_LINKS` prefix-matching is sequential — order matters; `1010` before `1011` to avoid `1011` catching `1010` prefixes
- `contacts.balance` is in kobo; form inputs in Naira are multiplied by 100 before sending
- `parentChildren.has(accountId)` guards prevent double-counting in Trial Balance totals; frontend uses `parentIds` set derived from `effectiveAccounts`
- Pre-existing TS errors (module resolution, `opening_stock` enum) still present in `ledger.service.ts:273` and `ReportsPage.tsx:1177,1179`
- CurrencySelector component at `src/components/ui/CurrencySelector.tsx`; relied upon by all 9 transaction form files
- `populateFxRate(orgId, currency, date)` takes 3 args (no `tx` parameter)
- Bank balance in TB/BS now comes solely from journal lines; `bankAccounts.currentBalance` is a side-effect of `createJournalEntry()` — no more manual override
- Manual balance adjustments and CSV opening balance imports create JEs debiting/crediting bank GL account with contra to 207000 (Bank Clearing Suspense)
- Flutterwave sync imports transactions as unreconciled; no JE is created during sync; currentBalance unchanged
- 207000 Bank Clearing Suspense must exist in every org (seed + migration); it's the counterparty for any balance JE not backed by a real transaction

## Relevant Files
- `src/pages/accountant/ChartOfAccounts.tsx`: `fmtNaira()` kobo→naira fix, `computeAggregateBalances()` parent rollup, `toDebitCredit()` helper, debit/credit columns, parent-excluded totals, client-side CSV export
- `src/services/ledger.service.ts`: `parentChildren` aggregation in `getTrialBalance()`, parent-excluded totalDr/totalCr
- `src/pages/reports/ReportsPage.tsx`: `MODULE_LINKS` array (1010→Customers, 3000→Bills), flat trial balance rendering with ExternalLink buttons, parent-excluded CSV totals
- `src/pages/purchases/Vendors.tsx`: `openingBalance` in form state/modal/export, Sample CSV + Import CSV modal
- `src/routes/purchases.ts`: `POST /vendors/import-csv` route with CSV parsing, validation, opening balance column
- `src/pages/sales/Customers.tsx`: Auto-generated read-only customer code (CS-XXXX) in Add/Edit modal
- `src/routes/sales.ts`: `POST /customers` generates sequential `customerCode` per org
- `src/db/schema.ts`: `contacts.customerCode` column added; `auditLog` table with `userAgent` column + indexes
- `src/db/migrate.ts`: Migration for `customer_code` column; migration for `user_agent` column + audit_log indexes
- `src/services/audit.service.ts`: `createAuditLog()` helper, `extractReqMeta()` for IP/User-Agent extraction
- `src/routes/auditLog.ts`: Admin-only route guard via `requireRole('admin')`
- `src/pages/reports/AuditLogsPage.tsx`: Entity deep-links (customers/invoices/bills/etc.), collapsible DiffView for field changes, action badge colors, user-agent display, CSV/PDF with new columns
- `src/pages/settings/LegacyImportPage.tsx`: 5-step wizard (upload → mapping → preview → execute → results) for legacy migration
- `src/routes/migrate.ts`: `POST /migrate/legacy` backend route for legacy data migration pipeline
