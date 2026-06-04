import { NextRequest, NextResponse } from "next/server";

const ADMIN_PREFIX = "/oss-ctrl-9x7k2m";
const ADMIN_LOGIN = `${ADMIN_PREFIX}/login`;

/**
 * SECURITY (SEC-025): Server-side auth gate for admin routes.
 *
 * The client-side layout guard (useEffect + checkSession) still runs, but this
 * middleware prevents Next.js from even sending the admin page bundle, component
 * tree, or RSC payload to unauthenticated browsers. Without the admin_token
 * cookie, the request is redirected to the login page.
 *
 * NOTE: This only checks cookie *presence and format* — the full session
 * validity check (expiry, IP binding, etc.) still happens server-side in the
 * layout's checkSession call and in every API handler via verifyAdminSession.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith(ADMIN_PREFIX)) {
    return NextResponse.next();
  }

  if (pathname === ADMIN_LOGIN || pathname === `${ADMIN_LOGIN}/`) {
    return NextResponse.next();
  }

  const adminToken = request.cookies.get("admin_token")?.value;
  const isValidFormat = adminToken && /^[a-f0-9]{64}$/i.test(adminToken);

  if (!isValidFormat) {
    const loginUrl = new URL(ADMIN_LOGIN, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/oss-ctrl-9x7k2m/:path*"],
};
