// Backend-for-frontend, same pattern as the provider web (D-41). The browser only calls /api/*; this handler
// forwards to BACKEND_URL and keeps the admin token in an httpOnly cookie, so page scripts can never read it (SEC-41).
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_URL;
const SESSION = "ab_admin"; // full token
const CODE = "ab_admin_code"; // 15-minute forgot-password code token
const RESET = "ab_admin_reset"; // 15-minute token after the code is checked; only reset-password accepts it
const ALLOWED = /^(admin\/|uploads\/presign$)/; // only admin routes pass
const CODE_ROUTES = /^admin\/auth\/(verify-otp|resend-otp)$/;
const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" };

const stageOf = (token: string): string | undefined => {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).stage;
  } catch {
    return undefined;
  }
};

// Bank numbers never reach the browser in full (SEC-42 / AD-11): mask anything that looks like one.
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
  // Admin routes, plus the public home feed read-only (it carries each service's "From $X" price, FEA-46).
  const publicRead = req.method === "GET" && path === "user/homepage";
  if (!ALLOWED.test(path) && !publicRead) return NextResponse.json({ status: 0, message: "Not found." }, { status: 404 });

  const jar = await cookies();
  const code = jar.get(CODE)?.value;
  const reset = jar.get(RESET)?.value;
  const token = code && CODE_ROUTES.test(path) ? code : reset && path === "admin/auth/reset-password" ? reset : jar.get(SESSION)?.value;
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authtoken", token);
  // The browser's address, for per-person rate limits (the backend trusts it only with the shared key; unset, nothing extra).
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
  // One exception: the manual-payout list needs the full account to pay from Citizens (owner, 30 Sep).
  // The screen keeps it hidden until the admin presses Show. Everywhere else only the last 4 leave the server.
  if (!(req.method === "GET" && path === "admin/payouts")) maskBank(json.data);

  // Take any token out of the reply and keep it as a cookie instead.
  const fresh: unknown = typeof json.data === "string" ? json.data : json.data?.token;
  if (typeof fresh === "string") { if (typeof json.data === "object") delete json.data.token; else json.data = null; }
  const res = NextResponse.json(json, { status: upstream.status });
  if (typeof fresh === "string") {
    if (stageOf(fresh) === "otp") res.cookies.set(CODE, fresh, { ...cookieBase, maxAge: 15 * 60 });
    // A checked code is NOT a sign-in: the old admin logged you in here. It only unlocks the new-password step.
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
