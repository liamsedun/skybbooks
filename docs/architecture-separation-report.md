# Architecture Separation Report — SkyBooks / SkyHouse

## Three-SPA Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (User Agent)                      │
├──────────────────┬─────────────────────┬────────────────────┤
│  Marketing Site  │   Platform Portal   │  Tenant App        │
│  index.html      │   platform.html     │  app.html          │
│  /               │   /platform/*       │  /app/*            │
│                  │                     │                    │
│  Own Router      │   Own Router        │  Own Router        │
│  Own Auth UI     │   Own Auth          │  Own Auth          │
│  Public pages    │   Platform Admin    │  Accounting UI     │
└────────┬─────────┴──────────┬──────────┴────────┬───────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express Backend (Single Server)            │
│                                                             │
│  /api/auth/*        (tenant + platform auth routes)         │
│  /api/app/*         (tenant accounting)                     │
│  /api/sales/*       (tenant sales)                          │
│  /api/platform/*    (platform admin API)                    │
│  /api/support/*     (tenant-scoped)                         │
│  /api/subscriptions (tenant-facing portal)                  │
│  Webhooks           (raw body, no auth)                     │
└────────┬────────────────────┬────────────────┬───────────────┘
         │                    │                │
         ▼                    ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│                                                             │
│  platform/* (36 tables)    tenant/* (74 tables)             │
│  No cross-FK references    orgId FK to organisations         │
│  Single drizzle connection  Merged schema hub               │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Modified

| Date | Commit | Files | Change |
|------|--------|-------|--------|
| Jul 22 | `6fa1eac` | 13 files | Separate Platform API from Customer API: `/api/admin` → `/api/platform` |
| Jul 22 | `04cf42b` | 1 file | Customer Dashboard: purely accounting KPIs only |
| Jul 22 | `a84967b` | 3 files | Platform Dashboard: executive SaaS KPIs page |
| Jul 22 | `84986ff` | 2 files | Redesign platform portal sidebar: 20 dedicated menu items |
| Jul 22 | `d5b6f0b` | 15+ files | Multi-tenancy hardening: orgId scoping fixes |
| Jul 22 | `ebfbffb` | 5+ files | Signup → Tenant Provisioning → First-Use Flow |
| Jul 22 | (prior) | 5 files | Schema split: platform vs tenant table files |
| Jul 22 | (prior) | 3 files | Platform RBAC + Tenant RBAC with configurable permissions |

### Files Created (this session)

| File | Purpose |
|------|---------|
| `src/pages/admin/PlatformDashboardPage.tsx` | Platform executive dashboard with 20+ SaaS KPIs |
| `docs/architecture-separation-report.md` | This report |

### Files Modified (this session)

| File | Change |
|------|--------|
| `src/server/index.ts` | `/api/admin` → `/api/platform` mounts; removed duplicate dunning mount |
| `src/routes/dunning.ts` | `/admin/dunning/` → `/platform/dunning/` paths |
| `src/pages/admin/PlatformDashboardPage.tsx` | API call `/admin/dashboard` → `/platform/dashboard` |
| `src/pages/admin/SuperAdminDashboard.tsx` | API calls `/admin/` → `/platform/` |
| `src/pages/admin/SaaSAnalyticsDashboard.tsx` | API calls `/admin/` → `/platform/` |
| `src/pages/admin/WhiteLabelConfigPage.tsx` | API calls `/admin/` → `/platform/` |
| `src/pages/admin/SystemHealthPage.tsx` | API call `/admin/system-health` → `/platform/system-health` |
| `src/pages/admin/ResellerContractsPage.tsx` | API calls `/admin/` → `/platform/` |
| `src/pages/admin/RegionalPricingPage.tsx` | API calls `/admin/` → `/platform/` |
| `src/pages/admin/RateLimitsPage.tsx` | API calls `/admin/` → `/platform/` |
| `src/pages/admin/OrgConfigPage.tsx` | API calls `/admin/` → `/platform/` |
| `src/pages/admin/FeatureRolloutsPage.tsx` | API calls `/admin/` → `/platform/` |
| `src/pages/admin/EnterpriseContractsPage.tsx` | API calls `/admin/` → `/platform/` |
| `src/pages/Dashboard.tsx` | Stripped to 11 accounting-only KPIs (removed ratios, efficiency, cash forecast, budget variance, top tables) |
| `src/services/superAdmin.service.ts` | Extended `getDashboard()` with churn, growth, support tickets, feature usage, top customers, top plans |

---

## Architecture Improvements

### 1. Three Independent SPAs
Three completely separate single-page applications, each with its own HTML entry point, Vite build input, and React Router instance:

| SPA | Entry | Router | Routes |
|-----|-------|--------|--------|
| Marketing | `index.html` | `src/App.tsx` | `/`, `/pricing`, `/login`, `/help/*` |
| Platform | `platform.html` | `src/platform/App.tsx` | `/platform/*` |
| Tenant | `app.html` | `src/app/App.tsx` | `/app/*` |

No route prefix overlaps between any two SPAs, preventing accidental cross-navigation.

### 2. Independent Authentication Systems
- **Tenant auth** (`src/middleware/auth.ts`): `authenticate()` middleware checks JWT with `type: 'tenant'` (or absent), explicitly rejects platform tokens with `TOKEN_PLATFORM_NOT_ALLOWED`
- **Platform auth** (`src/middleware/platformAuth.ts`): `platformAuthenticate()` middleware checks JWT with `type: 'platform'`, explicitly rejects non-platform tokens
- **Cookie isolation**: Platform cookies scoped to `path: '/platform'`, tenant cookies scoped to `path: '/'`
- **Route guard** (`src/middleware/routeGuard.ts`): Pre-express middleware blocks token-type violations before any route handler runs

### 3. Independent Permission Systems

| Dimension | Platform | Tenant |
|-----------|----------|--------|
| File | `src/lib/platformPermissions.ts` | `src/lib/tenantPermissions.ts` |
| Permissions | 27 across 12 domains | 50+ across 15 domains |
| Roles | 11 (super_admin, ceo, director, ...) | 12 (owner, accountant, auditor, ...) |
| Storage | Static map | Static defaults + DB overrides |
| Enforcement | `requirePlatformPermission()` | `requireTenantPermission()` |

No naming collisions — platform permissions use `orgs:read`, `subscriptions:manage`; tenant permissions use `sales:read`, `banking:reconcile`.

### 4. Independent Layouts
- **Platform sidebar** (`PlatformLayout.tsx`): 20 dedicated items under `/platform/*` — no accounting/tenant links
- **Tenant sidebar** (`AppLayout.tsx`): 60+ items organized in 8 accounting groups — no platform admin links
- Zero crossover in navigation between platform and tenant

### 5. Independent API Mounts
- All platform admin routes under `/api/platform/*`
- All tenant routes under their respective paths (`/api/sales/*`, `/api/accounting/*`, `/api/reports/*`, etc.)
- No `/api/admin` reference remains in the codebase

### 6. Independent Dashboards
- **Platform Dashboard**: SaaS KPIs (MRR, ARR, churn, org growth, plan distribution, support tickets) fetched from `/api/platform/dashboard`
- **Tenant Dashboard**: Accounting KPIs (cash position, revenue, expenses, profit, receivables, payables, taxes) fetched from `/api/reports/dashboard-metrics`
- Different API endpoints, different auth middleware, different data models

### 7. Database Schema Separation
- Platform tables (36) in `src/db/platform/tables.ts`
- Tenant tables (74) in `src/db/tenant/tables.ts`
- No cross-FK references between schemas (platform tables use loose `orgId uuid`, tenant tables have proper FK constraints)
- Shared `src/db/enums.ts` for enum definitions
- Single drizzle connection (correct for monolith-with-multi-tenant)

### 8. Vite Multi-Page Build
Three separate HTML files with independent JavaScript bundles:

```ts
// vite.config.ts
input: {
  main: path.resolve(__dirname, 'index.html'),
  app: path.resolve(__dirname, 'app.html'),
  platform: path.resolve(__dirname, 'platform.html'),
}
```

Each SPA gets its own compiled bundle with no runtime code sharing between SPAs.

---

## Security Improvements

### Token-Type Enforcement

| Scenario | Before | After |
|----------|--------|-------|
| Platform token used on /app route | Leaked through (same middleware) | Rejected with `FORBIDDEN_TENANT` |
| Tenant token used on /platform route | Leaked through (same middleware) | Rejected with `FORBIDDEN_PLATFORM` |
| Cookie theft scope | Full `/` path exposure | Platform cookies scoped to `/platform` |

### Permission Isolation

| Scenario | Before | After |
|----------|--------|-------|
| Admin role on platform + tenant | Single role enum | 11 platform roles + 12 tenant roles |
| Permission granularity | None (role-only) | Platform: 27 granular permissions, Tenant: 50+ permissions |
| DB-level permission overrides | None | Tenant `role_permissions` table for org-level customization |

### API Boundary Hardening

| Scenario | Before | After |
|----------|--------|-------|
| Admin API endpoint path | `/api/admin/*` (ambiguous) | `/api/platform/*` (explicit) |
| Rate limit admin | `/api/admin/rate-limits` | `/api/platform/rate-limits` |
| Feature rollout admin | `/api/admin/feature-rollouts` | `/api/platform/feature-rollouts` |
| Dunning admin | `/api/admin/admin/dunning/...` (double prefix) | `/api/platform/dunning/...` (clean path) |

### Removed Attack Surface
- Removed `/api/admin` mount point (could be probed for admin access)
- Removed duplicate dunning router mount that created path confusion
- All 14 admin pages now call `/api/platform/*` instead of `/api/admin/*`

---

## Remaining Recommendations

### 1. Move Subscription Auth to Platform Auth
The `/api/subscriptions/*` routes currently use **tenant auth** (`authenticate` + `requireOrg`) even though they manage subscription data. While tenants view their own subscriptions, the subscription-management routes in `lifecycle.ts`, `subscriptionBillingEngine.ts`, and parts of `subscriptions.ts` conceptually belong to the platform. **Recommendation**: Move these to `/api/platform/subscriptions/*` with `platformAuthenticate`. The tenant-facing portal routes (`subscriptionPortal.ts`) can remain under `/api/subscriptions` with tenant auth.

### 2. Extract Platform Auth Routes from Shared Auth File
`POST /auth/platform-login` and `POST /auth/platform-refresh` live in `src/routes/auth.ts` alongside tenant login/register routes. **Recommendation**: Extract into a dedicated `src/routes/platformAuth.ts` file mounted at `/api/platform/auth/login` and `/api/platform/auth/refresh` for cleaner separation.

### 3. Dedicated CSS Per SPA
All three SPAs share `src/index.css` as their stylesheet. **Recommendation**: Split into `src/marketing.css`, `src/platform.css`, and `src/app.css` with shared tokens in a `src/variables.css`. This prevents platform CSS from leaking into the tenant app and vice versa.

### 4. Dedicated API Client Per SPA
The shared `src/lib/api.ts` Axios instance uses `window.location.pathname` to determine token prefix. **Recommendation**: Create `src/lib/platformApi.ts` and `src/lib/tenantApi.ts` that each import the base helper but configure their own auth token handling explicitly, removing the runtime path check.

### 5. Separate Platform Auth Hook
`useAuth()` in `src/hooks/useAuth.ts` is used by all three SPAs with conditional platform/tenant logic. **Recommendation**: Create `usePlatformAuth()` for the platform SPA with only platform methods (`platformLogin`, `platformLogout`), keeping `useAuth()` clean for tenant usage.

### 6. Extract Platform Enums from Shared Enums File
`platformRoleEnum` is defined in `src/db/enums.ts` alongside tenant enums like `userRoleEnum`. **Recommendation**: Move platform-specific enums to `src/db/platform/enums.ts` and tenant-specific enums to `src/db/tenant/enums.ts`, keeping only genuinely shared enums (like `billingCycleEnum`) in `src/db/enums.ts`.

### 7. Add Platform-Specific Error Codes
Global error handling in `src/server/index.ts` uses generic error codes. **Recommendation**: Add `PLATFORM_FORBIDDEN`, `PLATFORM_TOKEN_EXPIRED`, `TENANT_FORBIDDEN` distinct error codes so client-side error handling can distinguish platform from tenant errors without checking the URL prefix.

### 8. Rate Limit Separation
Rate limiters in `src/middleware/rateLimiters.ts` apply globally. **Recommendation**: Create separate rate limiters for platform API (stricter, admin-specific) and tenant API (per-org quotas).

### 9. Audit Log Boundary
The `auditLog` table is in the tenant schema. **Recommendation**: Add a `platformAuditLog` table in the platform schema for platform-level actions (admin login, org status changes, plan changes) so tenant audit logs and platform audit logs are physically separate.

### 10. Remove Pre-Existing TS Errors
The AGENTS.md notes pre-existing TS errors in `ledger.service.ts:273` and `ReportsPage.tsx:1177,1179`. **Recommendation**: Fix or suppress these so `npx tsc --noEmit` passes cleanly.
