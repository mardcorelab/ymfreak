import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { secretMaterial, SESSION_COOKIE, verifySessionToken } from "./server/auth/session";

const intl = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The dashboard is Spanish-only and outside the localized site.
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    if (pathname === "/dashboard/login") return NextResponse.next();
    // Convenience redirect only: every admin page and action re-checks with requireAdmin().
    const session = await verifySessionToken(
      request.cookies.get(SESSION_COOKIE)?.value,
      process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD
        ? secretMaterial({
            AUTH_SECRET: process.env.AUTH_SECRET,
            ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
            DATABASE_URL: process.env.DATABASE_URL,
          })
        : null,
    );
    if (!session) return NextResponse.redirect(new URL("/dashboard/login", request.url));
    return NextResponse.next();
  }

  return intl(request);
}

export const config = {
  // Everything except API routes, Next internals and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
