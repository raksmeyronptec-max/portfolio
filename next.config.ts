import type { NextConfig } from "next";

/**
 * Supabase project host, derived from the public URL so the image allowlist and
 * the CSP stay in sync with whichever project is configured.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Host *including* the port. What a CSP origin needs. */
let supabaseHost: string | null = null;
/**
 * Host *excluding* the port, plus the port on its own.
 *
 * `next/image` remotePatterns splits these into two fields, and passing a
 * "host:port" string as `hostname` matches nothing — the optimiser then rejects
 * every CMS image with "hostname is not configured", which is exactly what it
 * did locally where Supabase runs on 127.0.0.1:55321. A hosted project has no
 * explicit port, so this is a no-op in production.
 */
let supabaseHostname: string | null = null;
let supabasePort = "";
/** `http` or `https`, taken from the configured URL rather than assumed. */
let supabaseScheme: "http" | "https" = "https";

try {
  if (supabaseUrl) {
    const parsed = new URL(supabaseUrl);
    supabaseHost = parsed.host;
    supabaseHostname = parsed.hostname;
    supabasePort = parsed.port;
    supabaseScheme = parsed.protocol === "http:" ? "http" : "https";
  }
} catch {
  supabaseHost = null;
  supabaseHostname = null;
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
/**
 * Is the configured Supabase a local stack rather than a hosted project?
 *
 * Matched on the hostname, not on NODE_ENV: what matters is where the images
 * actually come from. A production build pointed at a hosted project is
 * correctly false here even when someone runs it with NODE_ENV unset.
 */
const isLocalSupabase =
  supabaseHostname === "127.0.0.1" ||
  supabaseHostname === "localhost" ||
  supabaseHostname === "::1";

const supabaseOrigin = supabaseHost ? `${supabaseScheme}://${supabaseHost}` : null;
const supabaseSocket = supabaseHost
  ? `${supabaseScheme === "http" ? "ws" : "wss"}://${supabaseHost}`
  : null;

/**
 * Cloudflare R2 public origin, when media is served from there.
 *
 * Only the *public* bucket has an origin at all. The private bucket is
 * deliberately unreachable from the browser — its objects are read server-side
 * or through a short-lived signed URL — so nothing about it belongs in a CSP or
 * an image allowlist.
 */
let r2PublicOrigin: string | null = null;
let r2PublicHostname: string | null = null;

/**
 * The R2 S3 API origin, for `connect-src` only.
 *
 * A publication file is uploaded straight from the browser to a presigned URL,
 * because the hosting platform caps request bodies at 4.5 MB and a book is
 * larger. That PUT goes to `<account>.r2.cloudflarestorage.com`, which is a
 * different origin from the public bucket URL — so without this the browser
 * blocks it and the uploader reports a bare "Failed to fetch".
 *
 * Deliberately narrow: this appears in `connect-src` and nowhere else. It is not
 * an image or media source — nothing is ever *rendered* from the S3 endpoint,
 * and the private bucket behind it must stay unreachable for reads.
 *
 * Note that the CSP is only half of it: the R2 bucket itself must also allow
 * the site origin in its CORS policy, which is configured in Cloudflare rather
 * than here. See docs/DEPLOYMENT-R2-CORS.md.
 */
const r2ApiOrigin = process.env.R2_ACCOUNT_ID?.trim()
  ? `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`
  : null;

try {
  const raw = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim().replace(/^["']|["']$/g, "");
  if (raw) {
    const parsed = new URL(raw);
    r2PublicOrigin = parsed.origin;
    r2PublicHostname = parsed.hostname;
  }
} catch {
  r2PublicOrigin = null;
  r2PublicHostname = null;
}

const isDev = process.env.NODE_ENV === "development";

/**
 * `upgrade-insecure-requests` would rewrite the http Supabase origin above to
 * https and re-break local sign-in, so it is only emitted when every allowed
 * origin is already https — which is the case for any real deployment.
 */
const upgradeInsecureRequests = false;

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
  // R2 is added alongside Supabase rather than replacing it: media uploaded
  // before the move still lives in Supabase storage, and both must load.
  `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${r2PublicOrigin ? ` ${r2PublicOrigin}` : ""}`,
  `media-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${r2PublicOrigin ? ` ${r2PublicOrigin}` : ""}`,
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseSocket}` : ""}${r2PublicOrigin ? ` ${r2PublicOrigin}` : ""}${r2ApiOrigin ? ` ${r2ApiOrigin}` : ""}`,
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
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,

  // Next 16 no longer accepts an `eslint` key here; linting is configured
  // entirely in eslint.config.mjs and run via `npm run lint`.
  typedRoutes: false,

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              // Same reasoning as the CSP: local storage is served over http, and
              // a hard-coded https here made every local media thumbnail a 400
              // from the image optimiser.
              protocol: supabaseScheme,
              // Hostname only — the port is its own field. See the note above.
              hostname: supabaseHostname,
              ...(supabasePort ? { port: supabasePort } : {}),
              pathname: "/storage/v1/object/public/**",
            } as const,
          ]
        : []),
      ...(r2PublicHostname
        ? [
            {
              protocol: "https" as const,
              hostname: r2PublicHostname,
              // Scoped to the two public logical buckets rather than left open.
              // The private bucket has no public origin at all, but pinning the
              // prefixes here means a mistake elsewhere cannot turn the image
              // optimiser into a proxy for arbitrary keys.
              pathname: "/{public-media,certificate-previews}/**",
            } as const,
          ]
        : []),
    ],
    /*
     * Next 16 refuses to optimise an upstream image that resolves to a private
     * IP — sensible SSRF protection, and it must stay on in production.
     *
     * It also breaks local development completely: the Supabase stack runs on
     * 127.0.0.1, so every CMS image (project covers, screenshots, certificate
     * previews) rendered as a broken box locally while being perfectly fine
     * once deployed. That is the worst kind of difference between environments,
     * because the thing you cannot see locally is the thing you ship.
     *
     * So it is relaxed only when the configured Supabase URL is itself a local
     * address. A hosted project never matches, and the guard stays fully armed
     * in production even if NODE_ENV were somehow wrong.
     */
    dangerouslyAllowLocalIP: isLocalSupabase,
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
        /*
         * The publication preview is the one response on this site that is meant
         * to be framed.
         *
         * `securityHeaders` sends `frame-ancestors 'none'` and
         * `X-Frame-Options: DENY` to every path, which is right for every page
         * — and it silently broke the in-page PDF reader, because the browser
         * refused to render a document that forbids being framed. The symptom
         * was a blank frame with a broken-document glyph and nothing in any log.
         *
         * These rules come after the catch-all, so they win for this path only.
         * What they relax is narrow and deliberate:
         *
         *   frame-ancestors 'self'  — our own reader may frame it. Nobody else
         *                             can, so this is not clickjacking surface.
         *   sandbox allow-scripts   — the browser's built-in PDF viewer is
         *                             script-driven; a bare `sandbox` renders
         *                             nothing. Crucially there is no
         *                             `allow-same-origin`, so the document sits
         *                             in an opaque origin and its scripts can
         *                             reach neither our cookies nor our DOM.
         *
         * Everything else stays shut: no navigation, no forms, no popups, and
         * `default-src 'none'` means the document cannot fetch anything at all.
         */
        source: "/api/publications/:slug/preview",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'none'",
              "object-src 'none'",
              "frame-ancestors 'self'",
              "sandbox allow-scripts",
            ].join("; "),
          },
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
