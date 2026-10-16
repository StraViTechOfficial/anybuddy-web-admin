// A backend-for-frontend proxy, built the same way as the Buddy web app. The browser only ever calls /api/*. This
// handler forwards each call to BACKEND_URL and keeps the admin token in an httpOnly cookie, so page scripts can never
// read it.
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_URL;
const SESSION = "ab_admin"; // the full sign-in token, for a 12-hour session that renews while the admin is active
const SESSION_AGE = 12 * 3600;
const CODE = "ab_admin_code"; // a 15-minute token for the forgot-password code step
const RESET = "ab_admin_reset"; // a 15-minute token issued once the code is checked. Only reset-password accepts it.
const ALLOWED = /^(admin\/|uploads\/presign$)/; // only admin routes and photo upload links get through
const CODE_ROUTES = /^admin\/auth\/(verify-otp|resend-otp)$/;
const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" };

const stageOf = (token: string): string | undefined => {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).stage;
  } catch {
    return undefined;
  }
};

// The one reply allowed to carry full bank numbers: an admin pressing Show on a payout still to send. The backend
// records each of these views.
const BANK_REVEAL = /^admin\/payouts\/[0-9a-f]{24}\/bank$/;

// Bank numbers never reach the browser in full: mask anything that looks like one.
const BANK_KEYS = new Set(["account_number", "accountNumber", "routing_number", "routingNumber"]);
function maskBank(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(maskBank);
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      (v as Record<string, unknown>)[k] = BANK_KEYS.has(k) && typeof x === "string" && x.length > 4 ? "••••" + x.slice(-4) : maskBank(x);
    }
  }
  return v;
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const parts = (await ctx.params).path;
  // "admin/../user/x" would pass the admin-only check and then resolve upstream to /user/x, so dot segments are refused.
  if (parts.some((p) => p === "." || p === ".." || /[\\/%]/.test(p))) return NextResponse.json({ status: 0, message: "Not found." }, { status: 404 });
  const path = parts.join("/");
  if (!BACKEND) return NextResponse.json({ status: 0, message: "BACKEND_URL is not set." }, { status: 500 });
  // Admin routes are allowed, plus read-only access to the public home feed, which carries each service's "From $X" price.
  const publicRead = req.method === "GET" && path === "user/homepage";
  if (!ALLOWED.test(path) && !publicRead) return NextResponse.json({ status: 0, message: "Not found." }, { status: 404 });

  const jar = await cookies();
  const code = jar.get(CODE)?.value;
  const reset = jar.get(RESET)?.value;
  const session = jar.get(SESSION)?.value;
  const token = code && CODE_ROUTES.test(path) ? code : reset && path === "admin/auth/reset-password" ? reset : session;
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authtoken", token);
  // Passes on the browser's IP address so the backend can rate-limit each person. The backend trusts it only when the
  // shared key comes with it. When the key isn't set, nothing extra is sent.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip");
  if (process.env.PROXY_SHARED_SECRET && ip) {
    headers.set("x-ab-proxy-key", process.env.PROXY_SHARED_SECRET);
    headers.set("x-ab-client-ip", ip);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/${path}${req.nextUrl.search}`, {
      method: req.method,
      headers,
      body: req.method === "GET" ? undefined : await req.text(),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ status: 0, message: "We can't reach the Any-Buddy server right now. Try again in a moment." }, { status: 502 });
  }
  const json = await upstream.json().catch(() => null);
  if (!json) {
    const busy = upstream.status === 429;
    return NextResponse.json({ status: 0, message: busy ? "Too many tries. Wait a few minutes and try again." : "Something went wrong. Try again." }, { status: busy ? 429 : 502 });
  }
  if (!(req.method === "GET" && BANK_REVEAL.test(path))) maskBank(json.data);

  // Take any token out of the reply and keep it as a cookie instead. The session renews while in use, so a renewed
  // token can also arrive in the X-Auth-Token header of an ordinary reply. That header counts only on calls made with
  // the session itself, never with a code or reset token.
  const inBody: unknown = typeof json.data === "string" ? json.data : json.data?.token;
  if (typeof inBody === "string") { if (typeof json.data === "object") delete json.data.token; else json.data = null; }
  const fresh = typeof inBody === "string" ? inBody : session && token === session ? upstream.headers.get("x-auth-token") : null;
  const res = NextResponse.json(json, { status: upstream.status });
  if (fresh) {
    if (stageOf(fresh) === "otp") res.cookies.set(CODE, fresh, { ...cookieBase, maxAge: 15 * 60 });
    // A checked code is NOT a sign-in, although the old admin panel logged you in at this point. It only unlocks the
    // new-password step.
    else if (path === "admin/auth/verify-otp") {
      res.cookies.set(RESET, fresh, { ...cookieBase, maxAge: 15 * 60 });
      res.cookies.delete(CODE);
    } else {
      res.cookies.set(SESSION, fresh, { ...cookieBase, maxAge: SESSION_AGE });
      res.cookies.delete(CODE);
      res.cookies.delete(RESET);
    }
  }
  const expired = upstream.status === 401 || (upstream.status === 403 && /expired token/i.test(json.message ?? ""));
  // Logout clears the cookie whatever the server says, so a failed call never leaves the admin signed in.
  if ((expired && path !== "admin/auth/login") || path === "admin/auth/logout") {
    res.cookies.delete(SESSION);
    res.cookies.delete(CODE);
    res.cookies.delete(RESET);
  }
  return res;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
