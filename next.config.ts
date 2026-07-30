import type { NextConfig } from "next";

/**
 * Supabase project host, derived from the public URL so the image allowlist and
 * the CSP stay in sync with whichever project is configured.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

let supabaseHost: string | null = null;
/** `http` or `https`, taken from the configured URL rather than assumed. */
let supabaseScheme: "http" | "https" = "https";

try {
  if (supabaseUrl) {
    const parsed = new URL(supabaseUrl);
    supabaseHost = parsed.host;
    supabaseScheme = parsed.protocol === "http:" ? "http" : "https";
  }
} catch {
  supabaseHost = null;
}

/*
 * The scheme matters, and hard-coding `https://` here was a real bug.
 *
 * The local Supabase stack is served over plain http on 127.0.0.1. A CSP that
 * only allowed `https://127.0.0.1:55321` blocked every auth request from the
 * browser, so admin sign-in failed locally with a generic "not recognised"
 * message while the API itself was perfectly healthy.
 *
 * Deriving the scheme keeps production exactly as strict as before (a hosted
 * Supabase project is always https) without lying about the configured origin.
 */
const supabaseOrigin = supabaseHost ? `${supabaseScheme}://${supabaseHost}` : null;
const supabaseSocket = supabaseHost
  ? `${supabaseScheme === "http" ? "ws" : "wss"}://${supabaseHost}`
  : null;

const isDev = process.env.NODE_ENV === "development";

/**
 * `upgrade-insecure-requests` would rewrite the http Supabase origin above to
 * https and re-break local sign-in, so it is only emitted when every allowed
 * origin is already https — which is the case for any real deployment.
 */
const upgradeInsecureRequests = supabaseScheme === "https";

/**
 * Content-Security-Policy.
 *
 * `'unsafe-inline'` is required for `style-src` because Next.js inlines critical
 * styles, and for `script-src` in development only (React refresh). In
 * production, inline scripts are limited to the JSON-LD `<script type=
 * "application/ld+json">` blocks, which are covered by `'unsafe-inline'` — a
 * nonce-based policy would require opting every route out of static rendering,
 * which would defeat the performance goals. `object-src`/`frame-ancestors` are
 * locked down, which is what actually mitigates the high-impact attacks here.
 */
const csp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' data: https://fonts.gstatic.com`,
  `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  `media-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseSocket}` : ""}`,
  // The legacy Ask-Ron chat widget is served from our own origin as a static
  // document and is only framed by us.
  `frame-src 'self'`,
  `worker-src 'self' blob:`,
  `manifest-src 'self'`,
  ...(upgradeInsecureRequests ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Next 16 no longer accepts an `eslint` key here; linting is configured
  // entirely in eslint.config.mjs and run via `npm run lint`.
  typedRoutes: false,

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost
      ? [
          {
            // Same reasoning as the CSP: local storage is served over http, and a
            // hard-coded https here made every local media thumbnail a 400 from
            // the image optimiser.
            protocol: supabaseScheme,
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
    // Widths that match the container/grid breakpoints in the design system.
    deviceSizes: [320, 375, 430, 640, 768, 1024, 1280, 1440, 1920],
    imageSizes: [64, 96, 128, 192, 256, 384, 512],
  },

  experimental: {
    // Keeps Server Action payloads small; uploads go through route handlers.
    serverActions: { bodySizeLimit: "2mb" },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Never let a shared cache hold on to authenticated admin HTML.
        source: "/admin/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate, max-age=0",
          },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // Legacy v1 assets kept at their original paths under public/. Next.js
        // already sets immutable caching for its own fingerprinted output in
        // /_next/static, so that path is deliberately left alone — overriding it
        // breaks development behaviour and Next warns about it.
        source: "/image/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },

  async redirects() {
    // Locale prefixing for unprefixed paths is handled generically in
    // `middleware.ts` so there is one source of truth for that rule.
    //
    // v1 was a single page whose sections were in-page anchors (`#about`,
    // `#journey`, …). Fragments are never sent to the server, so those links
    // cannot break — they resolve against `/` and the locale middleware then
    // forwards to `/en`. The only real v1 file URLs are the static assets under
    // `/image/*`, `/CV/*`, `/ProjectImage/*` and `/ask-ron-bot-main/*`, which
    // were kept at their original paths inside `public/` and therefore still
    // resolve without any redirect.
    return [
      // v1's own nav pointed here; make the legacy section names resolve to the
      // new dedicated routes rather than 404.
      { source: "/journey", destination: "/en/experience", permanent: true },
      { source: "/skills", destination: "/en/about", permanent: true },
      { source: "/testimonials", destination: "/en/about", permanent: true },
      { source: "/achievements", destination: "/en/projects", permanent: true },
    ];
  },
};

export default nextConfig;
