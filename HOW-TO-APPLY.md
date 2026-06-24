# SkyBooks Mobile Responsiveness — How to Apply

## What Was Fixed

### 1. `src/index.css`
- Added `.mobile-table-scroll` utility class
- Added `min-height: 36px` on buttons/links for touch targets on mobile
- Added `@media (max-width: 640px)` rules for drawer full-width

### 2. `src/components/layout/AppLayout.tsx`
- **Sidebar now opens at `lg` (1024px) instead of `xl` (1280px)** — the menu was hidden even on tablets
- Main content padding reduced: `p-4 sm:p-6 md:p-8` (was always `p-6 md:p-8`)
- All `xl:hidden` / `xl:static` breakpoints updated to `lg:`

### 3. `src/components/ui/DataTable.tsx`
- Added `min-w-[600px]` to the `<table>` so it scrolls horizontally on small screens instead of squishing
- Cell padding reduced from `px-6` → `px-4 sm:px-6`

### 4. `src/pages/sales/InvoiceList.tsx`
- Table: added `min-w-[800px]`
- Filter row: `grid-cols-1 md:grid-cols-4` → `grid-cols-1 sm:grid-cols-2 md:grid-cols-4`

### 5. All other pages with inline tables (Customers, Quotes, SalesOrders, PaymentsReceived, CreditNotes, RecurringInvoices, Expenses, Vendors, PaymentsMade, PurchaseOrders)
- Wrapped every `<table>` with `<div className="overflow-x-auto">`
- Added `min-w-[640px]` to each `<table>` so content doesn't squish

---

## How to Apply

Copy each file from this folder into your project at `C:\Users\Admin\Downloads\skybooks\`:

```
src/index.css
src/components/layout/AppLayout.tsx
src/components/ui/DataTable.tsx
src/pages/sales/InvoiceList.tsx
src/pages/sales/Customers.tsx
src/pages/sales/Quotes.tsx
src/pages/sales/SalesOrders.tsx
src/pages/sales/PaymentsReceived.tsx
src/pages/sales/CreditNotes.tsx
src/pages/sales/RecurringInvoices.tsx
src/pages/purchases/Expenses.tsx
src/pages/purchases/Vendors.tsx
src/pages/purchases/PaymentsMade.tsx
src/pages/purchases/PurchaseOrders.tsx
src/pages/purchases/RecurringExpenses.tsx
```

Then rebuild and deploy:

```bash
npm run build
# commit and push to trigger Render redeploy, or use Render manual deploy
```

---

## Notes on Incomplete Table Closures

The `overflow-x-auto` wrapper `<div>` added around tables needs a matching `</div>` after `</table>` in the JSX. Since the original files had varied structure, **check that each wrapped table has a closing `</div>` after `</table>`** in the output files. Most modern editors (VS Code) will highlight unmatched tags.
