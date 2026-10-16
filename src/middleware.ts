import { NextResponse, type NextRequest } from "next/server";

// Pages a signed-out admin may open. Everything else needs the session cookie.
const PUBLIC = ["/login", "/forgot", "/code", "/reset"];

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
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|favicon|mark.png).*)"] };
