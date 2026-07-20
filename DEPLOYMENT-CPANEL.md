# SkyBooks — cPanel Deployment Notes (books.skyaccounting.com.ng)

## What's in this package
- `dist/` — pre-built frontend + `dist/server.cjs` (backend bundle)
- `app.js` — cPanel/Passenger/LiteSpeed entry point
- `package.runtime.json` — rename this to `package.json` on the server.
  It has only the 22 packages the compiled server actually requires
  (traced directly from `dist/server.cjs`'s require() calls), not the
  full ~65-package dev list. This avoids the native-compile and
  postinstall-script crashes (EAGAIN/SIGABRT) this host hits under
  CloudLinux resource limits when installing heavier dev tooling like
  esbuild/vite/firebase.
- `package.json` — the original, full dependency list. Keep this one
  for your own local dev; do NOT upload it to the server.

## Upload to cPanel
1. New folder outside `public_html`, e.g. `books-app`.
2. Upload `dist/`, `app.js`, and `package.runtime.json` (renamed to
   `package.json`) into it.

## Setup Node.js App
- Node.js version: 20.20.2
- Application mode: Production
- Application root: books-app
- Application URL: books.skyaccounting.com.ng
- Application startup file: app.js

## Environment variables to set now (core app)
Copy these from Render's environment variables dashboard — paste
directly into cPanel's env var fields, not into any chat or doc:
- `DATABASE_URL` — same Neon connection string Render uses
- `JWT_PRIVATE_KEY`
- `JWT_PUBLIC_KEY`
- `ENCRYPTION_KEY`
- `GEMINI_API_KEY`

Also set:
- `ALLOWED_ORIGINS` = `https://books.skyaccounting.com.ng`

(`NODE_ENV` is set automatically by "Application mode"; `PORT` is
injected automatically by Passenger — no action needed for either.)

## Deferred until payment gateways are wired up
Not required for the core app to run — every payment provider key
defaults to an empty string if unset, so these fail gracefully only
when that specific feature is used, not at startup:
- `MONO_SECRET_KEY`, `MONO_PUBLIC_KEY`, `MONO_WEBHOOK_SECRET`
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`
- `FLW_SECRET_KEY`, `FLW_PUBLIC_KEY`
- `MONIEPOINT_API_KEY`, `MONIEPOINT_SECRET`, `MONIEPOINT_BASE_URL`,
  `MONIEPOINT_WEBHOOK_SECRET`

## After setting env vars
1. Run NPM Install (should be fast — only 22 packages, no native
   compile steps found in this dependency tree).
2. Restart.
3. Visit https://books.skyaccounting.com.ng

## If something goes wrong
Same playbook that worked for the other two deployments on this host:
```
source /home/<user>/nodevenv/books-app/20/bin/activate && cd /home/<user>/books-app
node app.js
```
This shows the real error directly, rather than the generic 503 page.

## Known code changes made for this deployment
- Swapped `bcrypt` (native, risky to compile here) for `bcryptjs`
  (pure JS, identical API) in `auth.ts`, `passwordReset.ts`, and
  `organisations.ts`.
- Fixed `bcryptjs` version in package.json — `^6.0.0` doesn't exist on
  npm; corrected to `^3.0.3`.
- Made the `vite` import in `src/server/index.ts` dynamic (only
  loaded in the dev-mode branch) so production doesn't need vite
  installed at all — same fix applied to the other two projects today.
- Built with `VITE_API_URL=https://books.skyaccounting.com.ng/api`
  baked in, so the frontend's API and Socket.IO calls point at the
  right domain (this is baked in at build time, not configurable via
  cPanel's runtime env vars — if the domain ever changes, this needs
  a rebuild, not just an env var update).

## Known non-blocking issue (not fixed, just noted)
`express-rate-limit` logs a validation warning at startup about a
custom keyGenerator not handling IPv6 properly — doesn't crash
anything, but is a legitimate small security gap worth fixing later
(could let IPv6 clients bypass rate limits).
