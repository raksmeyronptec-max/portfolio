import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  defaultLocale,
  isLocale,
  negotiateLocale,
} from "@/i18n/config";

/**
 * Middleware responsibilities, in order:
 *
 *  1. Locale prefixing — every public URL must carry its locale, so `/about`
 *     becomes `/en/about`. One rule here rather than a redirect table means the
 *     behaviour cannot drift between routes.
 *  2. Session refresh — Supabase auth tokens are rotated and written back to the
 *     response. Server Components cannot set cookies, so this is the only place
 *     a refreshed token can be persisted.
 *  3. Admin gating — an unauthenticated request to `/admin/*` is redirected to
 *     sign-in here, as a fast first pass. It is NOT the security boundary: every
 *     admin page re-verifies with `getUser()` and a role lookup, and RLS
 *     enforces the same rules at the database. Middleware only saves a render.
 */

/** Paths that must never be locale-prefixed or auth-gated. */
const PASSTHROUGH_PREFIXES = [
  "/_next",
  "/api",
  "/admin",
  "/image",
  "/CV",
  "/ProjectImage",
  "/ask-ron-bot-main",
  "/favicon",
  "/icon",
  "/apple-icon",
  "/opengraph-image",
  "/twitter-image",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
];

function isPassthrough(pathname: string): boolean {
  return PASSTHROUGH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // ── 1. Locale prefixing ───────────────────────────────────────────────────
  if (!isPassthrough(pathname)) {
    const firstSegment = pathname.split("/").filter(Boolean)[0];

    if (!isLocale(firstSegment)) {
      // Prefer a remembered choice, then Accept-Language, then the default.
      const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
      const locale = isLocale(cookieLocale)
        ? cookieLocale
        : negotiateLocale(request.headers.get("accept-language"));

      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;

      // 307, not 308: the negotiated locale depends on the request, so this
      // particular mapping must not be cached as permanent by intermediaries.
      return NextResponse.redirect(url, 307);
    }
  }

  // ── 2. Session refresh ────────────────────────────────────────────────────
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase configured there is no session to refresh and no admin to
  // gate; the public site still renders its documented empty states.
  if (!supabaseUrl || !supabaseAnonKey) {
    return withLocaleCookie(request, response);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Validates the token against the auth server and rotates it if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── 3. Admin gating (first pass only) ─────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const isLoginRoute = pathname === "/admin/login";

    if (!user && !isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }

    if (user && isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Authenticated admin HTML must never sit in a shared cache.
    response.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, must-revalidate, max-age=0",
    );
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return withLocaleCookie(request, response);
}

/**
 * Persist the locale actually being served so the next unprefixed visit lands in
 * the same language. `sameSite: lax` is enough — this is a preference, not a
 * credential — and it is deliberately not `httpOnly: false`-readable by scripts
 * that do not need it.
 */
function withLocaleCookie(request: NextRequest, response: NextResponse) {
  const firstSegment = request.nextUrl.pathname.split("/").filter(Boolean)[0];
  if (!isLocale(firstSegment)) return response;

  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (existing === firstSegment) return response;

  response.cookies.set(LOCALE_COOKIE, firstSegment, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and files with an extension. Static
     * assets under public/ keep their v1 URLs and must not be rewritten.
     */
    "/((?!_next/static|_next/image|.*\\.[^/]+$).*)",
  ],
};

// Default locale is re-exported for tests that assert the fallback behaviour.
export { defaultLocale };
