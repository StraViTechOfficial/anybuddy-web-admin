# Any-Buddy Admin (anybuddy-web-admin)

Rebuild of the Appsinvo admin (TSK-81, owner decisions D-61…D-70). Next 15 + React 19 + TypeScript, 4 dependencies, CSS modules.
Design = the approved prototype https://claude.ai/artifact/9QLrY8FCvJaQJBZwpALJei (Direction A).

## Run
    npm ci
    cp .env.example .env.local      # BACKEND_URL=http://localhost:6001/api (never the live API)
    npm run dev                      # http://localhost:3300
Checks: `npm run typecheck`, `NEXT_DIST_DIR=.next-build npx next build`.

## How it talks to the backend
The browser only calls `/api/*` (src/app/api/[...path]/route.ts). That proxy forwards `admin/*` routes (plus the public
home feed, read-only) and keeps the token in httpOnly cookies: `ab_admin` (session), `ab_admin_code` (forgot-password
code step), `ab_admin_reset` (after the code, only for reset-password; never a sign-in). Bank numbers are masked to the
last 4 on the way through. Dot-segment paths are refused.

## Screens and what they still need from the backend
| Screen | Works now | Waiting on |
|---|---|---|
| Sign-in, forgot, code, reset | yes | SEC-43 (reset needs the code token server-side) |
| Dashboard | yes | BUG-96 (revenue counts canceled bookings) |
| Buddies (review queue, detail, block) | yes | FEA-45 reject reason stored, BUG-100 status in detail, BUG-95 block cancels jobs |
| Categories & services | yes (add, edit, wizard, retire) | FEA-42 own order, FEA-46 From price in admin API, BUG-90/91 |
| Bookings | yes, retry failed refund | FEA-43 admin cancel / refund |
| Customers | yes, block | – |
| Payouts | failed / waiting queue (Stripe Connect, D-70) | FEA-41 retry |
| Money | totals from bookings | FEA-47 ledger endpoints (/api/admin/money/*) |
| Support | read, reply by email | FEA-44 replies + status |
| Notifications | send + history | BUG-92 (500+ recipients) |
| Reviews | home-page reviews | A-15 admin reviews API |
| Fees & tax | yes, limits checked here | BUG-88 server-side limits |
| Content pages | yes | – |
| Account | change password | SEC-44 sign out other devices |
