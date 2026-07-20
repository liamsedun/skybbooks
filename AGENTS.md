Goal
====================
Maintain and enhance accounting features: fix kobo/naira display, parent-child account rollups, debit/credit columns with totals, CSV exports, vendor import with opening balance, trial balance drill-down links, auto-generated customer IDs (CS-XXXX), and consistent VAT labeling (not "Tax").

## Constraints & Preferences
- Balance values stored in kobo (bigint); frontend must divide by 100 for display (`fmtNaira`)
- Parent accounts must NOT contribute to totals (would double-count children's balances)
- Trial balance drill-down links use `MODULE_LINKS` prefix-matching in `ReportsPage.tsx`; manual journal links pass `?accountId=` to `/accountant/journals` for filtered view
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
- **Chat widget popup**: Facebook-style floating chat widget (`ChatWidget.tsx`) with org user presence tracking (green/red dots), unread badges, minimize, inline messaging; `ChatContext` manages single socket.io connection, conversations, and presence; wired to sidebar "Team Chat" link toggles popup instead of navigating to `/chat`
- **ChatContext fixes**: Fixed `user?.orgId` → `user?.organisationId` (property name mismatch prevented user list from loading); socket auth uses callback `auth: (cb) => cb({ token: ... })` to read fresh token on reconnect (prevents silent presence drop after 15min JWT expiry); mark-as-read now refreshes conversations for immediate badge updates
- **Email SMTP/HTTP settings**: Full email configuration page at `/settings/email-settings` with protocol toggle (HTTP built-in Resend vs SMTP). HTTP mode uses platform-wide `RESEND_API_KEY` — zero setup per org, sends FROM `"OrgName via SkyBooks <FROM_EMAIL>"` with org's email as Reply-To. SMTP mode uses stored credentials with IPv4 DNS resolution + explicit timeouts. Shared `sendOrgEmail()` helper in `src/services/email.service.ts` unifies all email paths (test, invites, future transactional). Invite email refactored to use same helper with `fromName: 'SkyBooks'` override; frontend defaults to HTTP for new/unconfigured orgs.
- **JWT error type distinction**: `authenticate()` middleware now distinguishes `TokenExpiredError` (`errorCode: 'TOKEN_EXPIRED'`) vs `JsonWebTokenError` (`errorCode: 'TOKEN_INVALID'`) vs generic auth failures; global error handler logs routine token expiry at `logger.debug` (not `logger.error`) with concise one-liner, keeping full ERROR severity for invalid-signature/key-mismatch incidents
- **Refresh token logging**: `POST /auth/refresh` now logs each failure path (session-not-found at `warn`, session-expired at `info`, user-inactive at `warn`, JWT-verify-failed at `warn`) with `userId` where available, plus a success line at `info`
- **Balance Sheet Excel export fixed**: `exportBalanceSheet()` rewritten to match `getBalanceSheet()` nested structure (`currentAssets.subSections`, etc.); uses `ws.addRow()` exclusively (no `getRow()`/`commit()`) to avoid XML corruption; `nairaRow` helper formats column 3 with numFmt
- **Cash Flow Statement revamp**: Rewrote `getCashFlowStatement()` and all exports (frontend table, CSV, PDF, Excel) to match the legacy CF layout. Adds `profitBeforeInterestAndTax`, `operatingLineItems` flat list with auto subtotals, `cashBreakdown` section (cash & bank balance, term deposit, term loan), amortization/grant income/provision for tax as separate adjustment lines. Comparative table preserved via old fields.
- **Legacy Migration PDF/Excel exports**: Added PDF (`printWindow`) and Excel (CSV download) buttons to all three statement tabs (Income, Cash Flow, SOCIE) on the Legacy Migration page. PDF build HTML tables with `printWindow()`; Excel generates downloadable CSV files.

### Session 3 — System Architecture & Infrastructure Improvements (Jul 2026)
- **Database performance indexes**: Added 45+ B-tree indexes on all core table foreign keys and date columns — `journal_entries` (org_id, date, status, source, source_id, entry_number), `journal_lines` (entry_id, account_id), `accounts` (org_id, code, parent_id, role), `contacts` (org, type, email), `invoices` (org, contact, status, issue_date), `bills`, `payments`, `items`, `sessions`, `audit_log`, `bank_transactions`, `reconciliation_matches`, `fixed_assets`, `leases`, `revenue_contracts`, `ecl_provisions`, `payroll_runs`, `inventory_adjustments` — all via startup migration (`src/db/migrate.ts:2571-2685`)
- **SELECT FOR UPDATE concurrency protection**: Added `.forUpdate()` lock to both `checkDuplicate()` (`src/services/posting.service.ts:249`) and `createJournalEntry()` duplicate-prevention query (`src/services/ledger.service.ts:120`) — prevents race conditions when two requests post to the same source simultaneously
- **Webhook multi-tenant routing fix**: All three payment gateway webhooks (Paystack, Flutterwave, Moniepoint) previously resolved the org via `organisations LIMIT 1` — always routing to the first org. Fixed with `resolveOrgFromWebhookEvent()` that checks `event.data.metadata.orgId` first, falls back to `paymentGatewayTransactions` reference lookup, and logs a warning if unresolvable (`src/routes/bankingWebhooks.ts:93-129`)
- **Async handler wrapper**: `src/middleware/asyncHandler.ts` — eliminates try/catch boilerplate from route handlers; wraps async functions to auto-forward errors to Express error handler
- **Enhanced error classes**: Added `NotFoundError` (404), `ForbiddenError` (403), `UnauthorizedError` (401), `ConflictError` (409), `ValidationError` (400 with optional `fields` record) to `src/lib/errors.ts`
- **Request ID middleware**: `src/middleware/requestId.ts` — generates `crypto.randomUUID()` per request, attached to `req.requestId`. Logged in every error message via `[${requestId}]` prefix in global error handler (`src/server/index.ts:187-208`)
- **Structured error responses**: Global error handler now returns `{ success: false, error, status, requestId, fields? }` instead of plain `{ error, status }`. ValidationErrors include field-level error map. Log levels: `error` for 500+, `warn` for 4xx, `debug` for TOKEN_EXPIRED (`src/server/index.ts:187-208`)
- **Standardized API response envelope**: `src/lib/response.ts` exports `ok(data)` → `{ success: true, data }` and `paginated(data, total, page, pageSize)` → `{ success: true, data, meta: { page, pageSize, total, totalPages } }` — consistent response shape for all future endpoints
- **Password reset flow**: Full backend (new `password_reset_tokens` table in schema + migration, `POST /auth/forgot-password` and `POST /auth/reset-password` routes at `src/routes/passwordReset.ts`, 60-min expiry, bcrypt hashing, SHA-256 token hash storage); frontend (updated `ForgotPasswordPage` to call real API, new `ResetPasswordPage` with token-from-URL and confirm-password validations, route at `/reset-password` in App.tsx)
- **React ErrorBoundary**: `src/components/ui/ErrorBoundary.tsx` — class-based error boundary with optional `fallback` prop, `onError` callback, "Try again" button; `withErrorBoundary()` HOC for wrapping individual pages. Wrapped entire App root in App.tsx
- **Toast notification system**: `src/contexts/ToastContext.tsx` — `ToastProvider` + `useToast()` hook supporting success/error/info/warning types with auto-dismiss (4s), slide-in animation, Lucide icons, color-coded backgrounds. Integrated into App.tsx root. Replaces all `alert()` calls over time
- **Skeleton loading components**: `src/components/ui/Skeleton.tsx` — `Skeleton` (text/rect/circle variants), `TableSkeleton` (5×4 grid), `CardSkeleton` (card layout). CSS shimmer animation injected once via `injectKeyframes()`
- **Pagination utilities**: `src/lib/pagination.ts` — `getPaginationParams()`, `paginatedResponse()` helpers for consistent paginated API responses; `src/hooks/usePagination.ts` — `usePagination()` hook with page/pageSize/total/totalPages state and `from`/`to` computed values; `src/components/ui/TablePagination.tsx` — reusable pagination bar showing range (Showing X–Y of Z), page selector, prev/next buttons, page size dropdown
- **All changes compile**: `npx tsc --noEmit` passes with 0 errors

### In Progress
- (none)

### Blocked
- (none)

### IFRS Financial Reporting Improvements — Completed Items
- **`report_section_mappings` table**: New DB table (`src/db/schema.ts`) for dynamic account-to-IFRS-line-item mapping with `reportType`, `sectionKey`, `label`, `accountCode`/`accountPrefix`, `signMultiplier`, `includeSubAccounts`, `sortOrder`, `isActive` columns; migration in `migrate.ts`
- **`financial_notes` table**: New DB table (`src/db/schema.ts`) for IFRS disclosure notes with `noteNumber`, `title`, `content`, `autoGenerated`, `sourceReport`, `reportDate`, `noteData` (jsonb), `sortOrder`; migration in `migrate.ts`
- **`mapping.service.ts`** (`src/services/mapping.service.ts`): Full CRUD for report section mappings + `applyMappingsToReport()` that restructures balance sheet/income statement data according to custom mappings (code/prefix matching, recursive section rebuilding, re-summing totals)
- **`notes.service.ts`** (`src/services/notes.service.ts`): Full CRUD for financial notes + `generateDefaultNotes()` auto-generates 15 IFRS disclosure notes (Corporate Info, Accounting Policies, PPE, Receivables, Cash, Payables, Share Capital, Events After Reporting Period, Going Concern, Contingent Liabilities, Related Party, Risk Management, Taxation, Profit for the Year) populated from live BS/PL/CF/SOCIE data
- **`GET /reports/mappings`** and **`PUT /reports/mappings`**: Bulk fetch/save section mappings per report type
- **`POST /reports/mappings/apply`**: Apply mappings to given report data and return restructured result
- **`GET /reports/notes`**, **`POST /reports/notes`**, **`PUT /reports/notes/:id`**, **`DELETE /reports/notes/:id`**: Full CRUD for financial notes
- **`POST /reports/notes/generate`**: Auto-generate 15 IFRS default notes from live financial data (current BS/PL/CF/SOCIE/TB); `regenerate=true` flag deletes existing auto-notes first
- **SOCIE Excel export implemented**: `exportStatementOfChangesInEquity()` in `excel.service.ts` — generates proper XLSX with columns from SOCIE components, data rows for opening/profit/movements/closing, and totals row; route changed from 501 to functional Excel download
- **`reportsApi` extensions**: Added `getMappings`, `saveMappings`, `applyMappings`, `getNotes`, `saveNote`, `updateNote`, `deleteNote`, `generateNotes`, `getConsolidated` methods to `api.ts`
- **Consolidated reports endpoint**: `GET /reports/consolidated` aggregates BS/PL/CF data across multiple orgs (comma-separated `orgIds`); returns entity list + aggregated totals + per-org details
- **Notes in PDF exports**: Income Statement, Balance Sheet, and Cash Flow PDF exports now include a "Notes to the Financial Statements" appendix with auto-generated IFRS notes
- **Notes in Excel exports**: Income Statement, Balance Sheet, and Cash Flow Excel exports now include a "Notes to the Financial Statements" worksheet with full note content
- **Financial Notes frontend page**: `NotesPage.tsx` at `/reports/notes` with filterable note list, inline editing, raw/formatted toggle, and "Generate Notes" button
- **Report Mappings frontend page**: `MappingsPage.tsx` at `/reports/mappings` with per-report-type mapping table, add/remove/save mappings

### IFRS 15 Revenue Recognition — Completed Items
- **Schema (`schema.ts`)**: Added 4 new tables — `revenueContracts` (org FK, customer FK, contract number, status, total value, start/end dates, billing frequency, currency, notes), `performanceObligations` (contract FK, description, timing [point_in_time/over_time], amount, recognized/remaining amounts, recognition method, revenue/deferred/contract asset account FKs, milestone criteria, completion %), `revenueSchedules` (obligation FK, scheduled date, amount, recognized amount, status [pending/recognized/skipped]), `revenueRecognitionEntries` (schedule FK, obligation FK, JE FK, amount, recognized date, method, description); 4 new enums: `contract_status`, `obligation_timing`, `recognition_method`, `schedule_status`
- **Relations**: Added Drizzle ORM relations linking contracts→obligations→schedules→recognition entries with proper FKs to accounts, contacts, users, journal entries
- **Seed accounts**: Added `101050 Unbilled Receivables / Contract Assets` to `ACCOUNT_SEEDS` (current asset, IFRS 15 contract asset role)
- **Migration (`migrate.ts`)**: Creates all 4 enums, 4 tables with indexes, seeds 101050 account per org, adds `revenue_recognition` to `journal_source` enum
- **`src/services/revenue.service.ts`**: Full IFRS 15 engine — `getContracts/getContract/createContract/updateContract/deleteContract` (contract CRUD with audit logging), `getObligations/getObligation/createObligation/updateObligation/deleteObligation` (performance obligation CRUD), `generateSchedule/addManualSchedule` (schedule generation: straight-line monthly amortization, milestone-based from JSON criteria, percentage-of-completion), `recognizeRevenue` (creates JE via `postToGL()`: point-in-time DR Receivables/Contract Asset + CR Revenue, over-time DR Deferred Revenue + CR Revenue; updates schedule status, obligation amounts, contract completion), `recognizeAllPending` (batch recognition for past-due schedules), `getRecognitionReport` (full recognition history with contract/obligation/schedule join), `getDeferredRevenueSummary` (pending recognition totals)
- **`src/routes/revenue.ts`**: 14 RESTful endpoints under `/api/revenue/` — contract CRUD (5), obligation CRUD (5), schedule list/add/generate (3), recognition single/all (2), reports (2)
- **`src/lib/api.ts`**: `revenueApi` with 16 methods — `listContracts/getContract/createContract/updateContract/deleteContract`, `getObligations/getObligation/createObligation/updateObligation/deleteObligation`, `getSchedules/addManualSchedule/generateSchedule`, `recognizeSchedule/recognizeAll`, `getRecognitionReport/getDeferredSummary`
- **`src/server/index.ts`**: Mounted `/api/revenue` routes
- **Revenue Contracts page** (`src/pages/revenue/RevenueContractsPage.tsx`): Full CRUD list view with status badges, value/date columns, delete confirmation; inline create/edit form with contract number/value/dates/billing frequency; detail view with performance obligation management (add obligation form with description/amount/timing/method/dates), obligation status cards showing amounts/recognized/remaining, expandable schedule tables per obligation with Recognize button per schedule + batch Recognize All, schedule status indicators (checkmark/x/clock)
- **Revenue Recognition Report** (`src/pages/revenue/RevenueRecognitionReport.tsx`): Summary cards (total recognized, pending recognition with count, entry count), date filter controls, full historical table with Date/Contract/Obligation/Method/Amount/Description columns, total footer
- **Sidebar navigation**: Added "Revenue Contracts" under ACCOUNTANT group (maps to `/revenue/contracts`), "Revenue Recognition" under REPORTS group (maps to `/revenue/recognition-report`)
- **App.tsx routing**: Routes for `/revenue/contracts` and `/revenue/recognition-report`

### Journal Status Workflow — Completed Items
- **Schema**: `journalStatusEnum` with 7 statuses (draft, pending_review, approved, posted, locked, reversed, cancelled); `status`/`approvedBy`/`postedBy`/`lockedBy`/`cancelledBy` columns on `journalEntries`
- **Migration**: Creates enum, adds columns, backfills reversed entries to `'reversed'`
- **Status transition routes** (journals.ts): `submit-review` (draft→pending), `approve` (pending→approved, accountant/owner), `post` (approved→posted, accountant/owner, also drafts), `lock` (posted→locked, owner only), `cancel` (draft/pending→cancelled)
- **Validation engine** (posting.service.ts): `validateAccounts()`, `validateCurrencyConsistency()`, `validateEntryNumber()`, `validateJournal()` master aggregator
- **`postToGL()`**: Added `status` to `PostToGLParams` type, passes through to `createJournalEntry()`
- **`createJournalEntry()`**: Accepts optional `status` field, defaults to `'posted'`
- **`reverseJournalEntry()`**: Sets `status = 'reversed'` alongside `isReversed = true`
- **GL query filtering**: `getAccountBalance()`, `computePnL()`, `getCashFlowStatement()`, `getTrialBalance()`, `getStatementOfChangesInEquity()`, account activity, and all SOCIE direct equity queries exclude `draft`/`pending_review`/`cancelled`/`reversed` entries
- **Tax/CIT query filtering**: `getGrossTurnover()`, `getAccountingPBT()`, `getAccountBalanceForPeriod()` in `tax.service.ts` now exclude non-posted entries
- **VAT return filtering**: All 4 VAT computation queries in `vat.ts` now exclude non-posted entries
- **Dashboard/Project report filtering**: All revenue/expense/AR/AP/WHT queries in `reports.ts` now exclude non-posted entries
- **Custom report filtering**: All 11 custom report queries (tax summary, cash equivalents, capital accounts, actual-vs-budget, GL summary, GL transactions, tax transactions) in `customReports.ts` now exclude non-posted entries
- **Excel/PDF export filtering**: GL Excel export queries in `excel.service.ts` now exclude non-posted entries
- **Chart of Accounts balance filtering**: Backend balance query in `accountant.ts` now excludes non-posted entries
- **Auto-match filtering**: Bank reconciliation auto-match query in `reconciliation.service.ts` now excludes non-posted entries
- **Banking GL queries**: Candidate matching and ledger lines queries in `banking.ts` now exclude non-posted entries
- **`POST /journals`**: Accepts `status` field (`draft`|`posted`); checks closed periods only for posted entries
- **`PUT /journals/:id`**: Only allows editing draft/pending_review entries
- **`POST /journals/:id/reverse`**: Blocks locked/cancelled/draft/pending entries
- **Frontend (JournalsPage.tsx)**: Status badges with color coding, status filter dropdown, transition buttons (Submit Review, Approve, Post, Lock, Cancel, Reverse) in detail view, Draft/Post selector in create form

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
- Revenue recognition JE wiring: point-in-time obligations DR Receivables/Contract Asset, CR Revenue; over-time obligations DR Deferred Revenue, CR Revenue; always uses `postToGL()` central posting engine for consistency with existing posting rules
- Straight-line schedule generation divides equally across months between start/end dates; last month absorbs rounding remainder

## Next Steps
1. Push to origin/main and verify Render auto-deploy completes
2. Update detail views (InvoiceDetail, BillDetail, etc.) to display currency + both original and base (NGN) amounts
3. Test multi-currency transaction flow end-to-end
4. Investigate Purchase Order unit price bug: AMC Tier 2 item shows extra zero (2,500,000 instead of 250,000) — likely a data issue with the item's stored `purchasePrice` value rather than a code bug
5. Verify bank reconciliation flow still works after bankMap removal — bank feed transactions are imported as 'unreconciled' and matched against GL-based JEs; clearing account (207000) shows the difference
6. Test journal status workflow end-to-end: create draft → submit for review → approve → post → lock/reverse/cancel
7. (Done) Report mappings UI at `/reports/mappings`
8. (Done) Notes to Financial Statements UI at `/reports/notes`
9. (Done) Notes included in PDF/Excel exports for BS, PL, CF
10. (Done) Consolidated reports endpoint (`GET /reports/consolidated`)
11. (Done) IFRS 15 Revenue Recognition: schema, service, routes, API client, migration, frontend (RevenueContractsPage + RevenueRecognitionReport), sidebar nav, App.tsx routing

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
- **Excel export binary handling**: Must use Axios `responseType: 'blob'` (NOT `fetch().then(r => r.blob())` which corrupts binary). Report API functions in `api.ts` use this pattern.
- **Excel row insertion**: Always use `ws.addRow()` rather than `ws.getRow(n)` + `r.commit()` — manual row tracking with `commit()` produces malformed XML in the xlsx.
- **`nairaRow` helper pattern**: `ws.addRow(vals)` then set `r.getCell(n).numFmt` + alignment. Do NOT overwrite the cell value with a separate parameter — the value should already be in `vals` at the correct index.

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
- `src/services/mapping.service.ts`: Dynamic account-to-IFRS-line-item mapping CRUD + `applyMappingsToReport()` transform logic
- `src/services/notes.service.ts`: Financial notes CRUD + `generateDefaultNotes()` auto-generates 15 IFRS disclosure notes from live financial data
- `src/db/schema.ts`: `reportSectionMappings` and `financialNotes` table definitions
- `src/db/migrate.ts`: Migration for report_section_mappings and financial_notes tables
- `src/services/excel.service.ts`: `exportStatementOfChangesInEquity()` SOCIE Excel export addition
- `src/pages/reports/NotesPage.tsx`: Notes to Financial Statements frontend page at `/reports/notes`
- `src/pages/reports/MappingsPage.tsx`: Report section mapping management page at `/reports/mappings`
- `src/services/revenue.service.ts`: IFRS 15 revenue recognition engine — contract CRUD, obligation CRUD, schedule generation (straight-line/milestone/PoC), revenue recognition JE posting, deferred revenue summary, recognition report
- `src/routes/revenue.ts`: 14 RESTful endpoints under `/api/revenue/` for IFRS 15
- `src/pages/revenue/RevenueContractsPage.tsx`: Revenue contracts CRUD with obligations, schedules, and recognition controls
- `src/pages/revenue/RevenueRecognitionReport.tsx`: Historical recognition entries with summary cards and date filtering
- `src/server/index.ts`: Mounted `/api/revenue` routes
- `src/lib/api.ts`: `revenueApi` with 16 methods for IFRS 15 endpoints

### System Architecture & Infrastructure — Files Created
- `src/middleware/asyncHandler.ts`: Async error wrapper for route handlers
- `src/middleware/requestId.ts`: Per-request UUID for error tracing
- `src/lib/response.ts`: `ok()` / `paginated()` API response envelope helpers
- `src/lib/pagination.ts`: `getPaginationParams()` / `paginatedResponse()` for consistent pagination
- `src/hooks/usePagination.ts`: Frontend pagination state hook
- `src/components/ui/ErrorBoundary.tsx`: React error boundary + `withErrorBoundary()` HOC
- `src/components/ui/Skeleton.tsx`: Skeleton/TableSkeleton/CardSkeleton loading components
- `src/components/ui/TablePagination.tsx`: Reusable pagination bar component
- `src/contexts/ToastContext.tsx`: Toast notification system (replaces `alert()`)

### IFRS 16 Lease Accounting — Completed Items
- **Schema tables**: `leases` (org FK, lessor, asset category, ROU/liability/interest account FKs, commencement/end dates, term, payment amount, PV, IBR, initial direct costs, status), `lease_payment_schedules` (lease FK, period number, due date, payment/interest/principal amounts, outstanding balance, is_paid, JE FK), `lease_journal_entries` (lease FK, period number, JE FK, entry type, description); added `lease` to `journal_source` enum; added all relations (`leasesRelations`, `leasePaymentSchedulesRelations`, `leaseJournalEntriesRelations`)
- **Migration (`migrate.ts`)**: Creates all 3 IFRS 16 tables with indexes, seeds ROU asset accounts (201100 Buildings, 201101 Accum Depr Buildings, 201200 Motor Vehicles, 201201 Accum Depr Vehicles), lease liability accounts (304000 Current, 401000 Non-current), interest expense account (910300), depreciation expense account (810900), adds `lease` to `journal_source` enum
- **`src/services/lease.service.ts`**: Full IFRS 16 engine — `createLease` (generates lease number, PV calculation, amortisation schedule with actuarial method), `getLeases/getLease` (with schedule), `updateLease`, `postCommencementEntry` (DR ROU Asset, CR Lease Liability via `postToGL()`), `processLeasePayment` (DR Interest + DR Lease Liability, CR Bank for one period), `batchProcessPayments` (process all unpaid), `postLeaseDepreciation` (DR Depreciation Expense, CR Accum Depr), `batchPostDepreciation` (auto-all periods not yet posted), `modifyLease` (re-measures liability/ROU asset with gain/loss, regenerates schedule), `terminateLease` (derecognises ROU asset & liability through clearing account, recognises gain/loss), `getLeaseReport` (summary cards + per-lease detail with net book value, outstanding liability, total paid/interest)
- **`src/routes/leases.ts`**: 12 RESTful endpoints under `/api/leases/` — lease CRUD (GET list/single, POST create, PUT update), `POST /:id/commencement`, `POST /:id/payments`, `POST /:id/payments/batch`, `POST /:id/depreciation`, `POST /:id/depreciation/batch`, `POST /:id/modify`, `POST /:id/terminate`, `GET /report`; all with Zod validation and audit logging
- **`src/lib/api.ts`**: `leaseApi` with 12 methods — `listLeases/getLease/createLease/updateLease`, `postCommencement/processPayment/batchProcessPayments`, `postDepreciation/batchPostDepreciation`, `modifyLease/terminateLease`, `getLeaseReport`
- **`src/server/index.ts`**: Mounted `/api/leases` routes
- **Leases page** (`src/pages/accountant/LeasesPage.tsx`): Full CRUD list view with summary cards (total leases, active, ROU assets, outstanding liability, monthly payments), status badges, create/edit form with account mapping via `AccountSearchSelect`, detail view with payment schedule table and per-period Pay/Depr buttons, batch process all payments/depreciation, modify modal (adjust payment/term/rate with description), terminate modal with termination date, journal posting buttons (Commencement JE, Process All Payments, Post All Depreciation)
- **Routing/sidebar**: Route at `/accountant/leases` in `App.tsx`; sidebar nav item "Lease Accounting" with Briefcase icon under ACCOUNTANT group in `AppLayout.tsx`

### Next Steps
1. (Done) System Architecture & Infrastructure (Session 3): 45+ DB indexes, FOR UPDATE locking, webhook org resolution, async handler, enhanced errors, request ID middleware, structured error responses, standard API envelope, password reset, ErrorBoundary, Toast notifications, Skeleton/TablePagination components
2. (Done) Report mappings UI at `/reports/mappings`
3. (Done) Notes to Financial Statements UI at `/reports/notes`
4. (Done) Notes included in PDF/Excel exports for BS, PL, CF
5. (Done) Consolidated reports endpoint (`GET /reports/consolidated`)
6. (Done) IFRS 15 Revenue Recognition: schema, service, routes, API client, migration, frontend (RevenueContractsPage + RevenueRecognitionReport), sidebar nav, App.tsx routing
7. (Done) IFRS 16 Lease Accounting: schema, service, routes, API client, migration, frontend (LeasesPage with full CRUD, schedule, payments, depreciation, modify/terminate), sidebar nav, App.tsx routing
8. (Done) Inventory Accounting Improvement: routes, API, frontend, service fixes — committed at `c84649e`, pushed to main (Render auto-deploys)
9. (Done) Nigerian Tax Engine: PAYE, NHF, NSITF, ITF, Stamp Duty, Tax Exemptions, FIRS Reports, Auto Tax Journals — committed at `c84649e`, pushed to main
10. (Pending) Commit Session 3 improvements and push to origin/main
11. (Pending) Split 3955-line ReportsPage.tsx into separate component files
12. (Pending) Begin replacing `alert()` calls across 26+ files with `useToast()`
13. (Pending) Add lazy loading for page-level React components in App.tsx
14. (Pending) Implement rate limiting per-user/per-org

### Nigerian Tax Engine — Completed Items
- **Schema (`schema.ts`)**: Added 7 new tables — `payeSchedules`, `payeScheduleLines`, `itfAssessments`, `stampDutyRecords`, `taxExemptions`, `firsReports`, `autoTaxJournals` — with 6 new enums (`payePeriodStatus`, `itfStatus`, `taxExemptionStatus`, `taxTypeEnum`, `firsReportStatus`, `firsReportType`)
- **Migration (`migrate.ts`)**: Creates all 7 tables with indexes, seeds 5 new accounts (306100 NSITF Payable, 306200 ITF Payable, 306300 Stamp Duty Payable, 950700 ITF Expense, 950800 Stamp Duty Expense)
- **PAYE Engine (`statutory.service.ts`)**: Nigerian PAYE tax bands (7%-24%), consolidated relief (1% or ₦200k + 20%), monthly/annual computation functions, schedule creation, journal posting via `postToGL()`
- **NHF/NSITF/ITF**: NHF 2.5% of basic, NSITF 1% of basic, ITF 1% of annual payroll — all with auto journal posting
- **Stamp Duty**: ₦50 (5000 kobo) per transaction ≥ ₦5,000 with auto JE posting
- **Tax Exemptions**: CRUD for exemptions per tax type with status tracking (active/expired/revoked)
- **FIRS Reports**: Consolidated tax report generation per type (VAT, WHT, CIT, PAYE, ITF, consolidated) with status workflow (draft→filed→assessed→paid)
- **Auto Tax Journal Tracking**: `autoTaxJournals` table records all auto-generated tax JEs for audit trail
- **Tax Dashboard**: `getTaxDashboardSummary()` returns VAT/WHT/PAYE/CIT positions for the overview
- **Routes** (`tax.ts`): 14 new endpoints — dashboard, PAYE CRUD+post, ITF CRUD+post, stamp duty CRUD+summary, exemptions CRUD+status, FIRS reports generate+file, auto journal listing
- **API Client** (`api.ts`): 18 new methods on `taxApi` (dashboard, PAYE, ITF, stamp duty, exemptions, FIRS reports, auto journals)
- **Frontend** (`TaxEnginePage.tsx` at `/reports/tax-engine`): 7-tab page — Dashboard (summary cards), PAYE schedules, ITF assessments, Stamp Duty records, Tax Exemptions, FIRS Reports, VAT Settings — with create modals, status badges, action buttons, Naira formatting
- **Routing/sidebar**: Route at `/reports/tax-engine` in `App.tsx`; sidebar nav item "Tax Engine" with Shield icon under REPORTS group
- **Build**: Passes with 0 errors

## Critical Context
- All tax amounts stored in kobo (bigint); frontend divides by 100 with `fmtNaira`
- PAYE computation uses annualized approach: monthly gross × 12, compute annual tax, divide back by 12
- NHF (2.5%) based on basic salary, not gross pay
- NSITF (1%) is employer-only contribution on basic salary
- ITF (1% of annual payroll) applies to organisations with 5+ employees
- Stamp duty is ₦50 fixed per transaction ≥ ₦5,000 (500000 kobo)  
- All tax journal entries use `postToGL()` with source `'tax_provision'` (cast with `as any` for enum compatibility)
- Tax exemption types include: pioneer_status, export_exemption, agricultural_exemption, first_four_years_exemption, foreign_equity_exemption, and custom types
- FIRS consolidated report generates all sub-reports (VAT, WHT, PAYE, CIT) and aggregates totals
- Pre-existing VAT return at `/reports/vat-return` and CIT computation at `/reports/tax-computation` remain unchanged

## Agent skills

- **Issue tracker** (GitHub): `docs/agents/issue-tracker.md`
- **Domain docs**: `docs/agents/domain.md`
