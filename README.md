# Any-Buddy Admin

The business's admin panel for AnyBuddy. Admins approve and manage Buddies (service providers), follow sign-ups and
the waitlist, look after bookings and customers, pay and record Buddy payouts, see the money side (platform payouts,
commission, tax), answer support messages, and edit the service catalog, site content, reviews and fees.

## Stack

- Next.js 15 (App Router), React 19, TypeScript.
- Icons: `@phosphor-icons/react`; DOMPurify for the content editor. Styles are plain CSS.

## How it talks to the API

- The browser only calls `/api/*` on this site. `src/app/api/[...path]/route.ts` forwards each call to
  `BACKEND_URL` (the AnyBuddy API; production is `https://api-prod.any-buddy.com/api`).
- The login token never reaches page scripts: the proxy takes it out of the API reply and keeps it in httpOnly,
  `SameSite=Strict` cookies (`ab_admin`, the 30-day session).
- Forgot password uses two separate 15-minute cookies: `ab_admin_code` for the emailed code, then `ab_admin_reset`,
  which only the reset-password call accepts. A correct code is not a sign-in; `src/middleware.ts` keeps `/code` and
  `/reset` closed without the matching cookie, and sends signed-out visitors to `/login`.
- Only `admin/*` routes and `uploads/presign` are forwarded, plus a read-only `GET user/homepage` (the public
  service feed). Path segments `.` and `..` are refused.
- Bank account and routing numbers are masked to their last 4 digits in every reply, except the manual payout list
  (`GET admin/payouts`), which needs the full account; the screen keeps it hidden until the admin presses Show.
- Logout clears the cookies whatever the API answers. An expired session clears them too.
- With `PROXY_SHARED_SECRET` set, the proxy passes the visitor's address to the API so rate limits apply per visitor.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3300
npm run typecheck    # optional: TypeScript check
```

Environment variables (put them in `.env.local`; names only, never commit values):

| Name | Purpose |
|---|---|
| `BACKEND_URL` | Base URL of the AnyBuddy API, ending in `/api`. Required. |
| `PROXY_SHARED_SECRET` | Same value as the API's; lets rate limits see the visitor's address. Optional. |
| `NEXT_DIST_DIR` | Optional build output folder (default `.next`). |

## Build and deploy

- `npm run build`, then `npm run start` (port 3300) to run the build locally.
- Deployed on Vercel from the `staging` branch. Set the environment variables above in the Vercel project.

## Security notes

- `next.config.ts` sends security headers on every page: `Content-Security-Policy: frame-ancestors 'none'`,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`;
  the `X-Powered-By` header is off.
- After login the `next` redirect only accepts same-site paths.
- Cookies are httpOnly, `SameSite=Strict`, and `Secure` in production.
- The content (CMS) editor cleans HTML with DOMPurify before publishing (scripts, frames, event handlers,
  `javascript:`/`data:` links); support messages and reviews are shown as plain text.
