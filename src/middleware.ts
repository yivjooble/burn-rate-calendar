import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import authConfig from "./auth.config";
import {
  checkRateLimit,
  getClientIdentifier,
  AUTH_RATE_LIMIT,
  API_RATE_LIMIT
} from "@/lib/rate-limit";

// Create Edge-compatible auth instance (no database/Node.js modules)
const { auth } = NextAuth(authConfig);

/**
 * Middleware to protect routes and API endpoints.
 *
 * Features:
 * - Authentication check
 * - Rate limiting (brute-force protection)
 *
 * Protected routes:
 * - /api/db/* - Database operations (settings, transactions, etc.)
 * - /api/mono/* - Monobank API proxy
 *
 * Public routes:
 * - /login - Login page
 * - /api/auth/* - NextAuth endpoints
 */
export default auth(async function middleware(request) {
  const { pathname } = request.nextUrl;
  const clientId = getClientIdentifier(request);

  // Rate limiting for auth endpoints (strict)
  if (pathname.startsWith("/api/auth")) {
    const rateLimitKey = `auth:${clientId}`;
    const { allowed, remaining, resetTime } = checkRateLimit(rateLimitKey, AUTH_RATE_LIMIT);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((resetTime - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  }

  // Public routes - always accessible (after rate limit check)
  const publicRoutes = ["/login"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Rate limiting for API endpoints (standard)
  if (pathname.startsWith("/api/")) {
    const rateLimitKey = `api:${clientId}`;
    const { allowed, remaining, resetTime } = checkRateLimit(rateLimitKey, API_RATE_LIMIT);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((resetTime - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
  }

  // Check authentication using NextAuth v5 - session is now on request.auth
  const isAuthenticated = !!request.auth?.user;

  console.log("[MIDDLEWARE]", { pathname, isAuthenticated, userId: request.auth?.user?.id });

  // Protected API routes - return 401 if not authenticated
  const protectedApiRoutes = ["/api/db", "/api/mono"];
  const isProtectedApi = protectedApiRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedApi && !isAuthenticated) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in." },
      { status: 401 }
    );
  }

  // Protected pages - redirect to login if not authenticated
  if (!isAuthenticated && pathname !== "/login") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page
  if (isAuthenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
