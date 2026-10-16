import { NextResponse, type NextRequest } from "next/server";

// Pages a signed-out admin may open. Everything else needs the session cookie.
const PUBLIC = ["/login", "/forgot", "/code", "/reset"];

// The files bucket. Photos are shown from it, and uploads go straight to it with a presigned link. The backend builds
// links in the regional form, and older records may use the global form.
const S3 = "https://anybuddy-files-2026.s3.us-east-1.amazonaws.com https://anybuddy-files-2026.s3.amazonaws.com";

/** The Content Security Policy for one page view. Scripts run only from this site or inline with this request's nonce,
 *  so an injected script tag can't run, and the admin panel loads nothing from other sites except the hosts below.
 *  Next.js sets inline style attributes, so styles keep 'unsafe-inline'. */
function policy(nonce: string, local: boolean) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // The dev server also needs eval for hot reload.
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Photos come from the files bucket. Category and service photos are Unsplash links, and customers who signed in
    // with Google have their Google profile photo (lh3.googleusercontent.com). data: and blob: cover inline icons and
    // files generated in the browser.
    `img-src 'self' data: blob: ${S3} https://images.unsplash.com https://lh3.googleusercontent.com`,
    // The proxy at /api is on this site, and photo uploads go straight to the files bucket.
    `connect-src 'self' ${S3}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // On the live https site, any stray http:// link is fetched over https instead. A local run is plain http, where
    // this would break the page's own requests.
    ...(local ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const signedIn = req.cookies.has("ab_admin");
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
  // The reset page needs the cookie from the code step, not a full session. The old admin panel let a reset token sign
  // you in, which we no longer allow.
  if (pathname === "/reset" && !req.cookies.has("ab_admin_reset")) return NextResponse.redirect(new URL("/forgot", req.url));
  if (!signedIn && !isPublic) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname === "/code" && !req.cookies.has("ab_admin_code")) return NextResponse.redirect(new URL("/forgot", req.url));
  if (signedIn && isPublic) return NextResponse.redirect(new URL("/", req.url));
  // Next.js reads the nonce from the request's policy header and adds it to its own inline scripts. The root layout
  // reads x-nonce for the theme script, and reading it also makes every page render per request, which nonces need.
  const nonce = btoa(crypto.randomUUID());
  const csp = policy(nonce, req.nextUrl.hostname === "localhost");
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = { matcher: ["/((?!api|_next|favicon|mark.png).*)"] };
