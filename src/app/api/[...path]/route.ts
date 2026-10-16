// A backend-for-frontend proxy, built the same way as the Buddy web app. The browser only ever calls /api/*. This
// handler forwards each call to BACKEND_URL and keeps the admin token in an httpOnly cookie, so page scripts can never
// read it.
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_URL;
const SESSION = "ab_admin"; // the full sign-in token
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
  const token = code && CODE_ROUTES.test(path) ? code : reset && path === "admin/auth/reset-password" ? reset : jar.get(SESSION)?.value;
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
  // One exception: the manual-payout list needs the full account to pay from Citizens.
  // The screen keeps it hidden until the admin presses Show. Everywhere else only the last 4 leave the server.
  if (!(req.method === "GET" && path === "admin/payouts")) maskBank(json.data);

  // Take any token out of the reply and keep it as a cookie instead.
  const fresh: unknown = typeof json.data === "string" ? json.data : json.data?.token;
  if (typeof fresh === "string") { if (typeof json.data === "object") delete json.data.token; else json.data = null; }
  const res = NextResponse.json(json, { status: upstream.status });
  if (typeof fresh === "string") {
    if (stageOf(fresh) === "otp") res.cookies.set(CODE, fresh, { ...cookieBase, maxAge: 15 * 60 });
    // A checked code is NOT a sign-in, although the old admin panel logged you in at this point. It only unlocks the
    // new-password step.
    else if (path === "admin/auth/verify-otp") {
      res.cookies.set(RESET, fresh, { ...cookieBase, maxAge: 15 * 60 });
      res.cookies.delete(CODE);
    } else {
      res.cookies.set(SESSION, fresh, { ...cookieBase, maxAge: 30 * 24 * 3600 });
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
