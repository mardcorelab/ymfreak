import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Phase 2 adds auth checks for /dashboard and /portal here. Those checks are
// a convenience redirect only — every admin query also calls requireAdmin().
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
