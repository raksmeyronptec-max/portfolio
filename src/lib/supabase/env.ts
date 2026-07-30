/**
 * Environment access for Supabase.
 *
 * Split into "public" and "server-only" halves so the service-role key can never
 * be reached from a module that the browser bundle imports. `serverEnv()` throws
 * if it is somehow evaluated in a browser context.
 */

export type PublicSupabaseEnv = {
  url: string;
  anonKey: string;
};

let cachedPublic: PublicSupabaseEnv | null = null;

/**
 * Reads the public Supabase configuration. Safe on the client.
 *
 * Returns `null` rather than throwing when unset, so the site degrades to
 * documented empty states during first-time setup instead of crashing with a
 * stack trace that leaks configuration details.
 */
export function publicSupabaseEnv(): PublicSupabaseEnv | null {
  if (cachedPublic) return cachedPublic;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  cachedPublic = { url, anonKey };
  return cachedPublic;
}

/**
 * True when Supabase is configured. Used to render "not configured" empty
 * states rather than error pages on a fresh checkout.
 */
export function isSupabaseConfigured(): boolean {
  return publicSupabaseEnv() !== null;
}

/**
 * Reads the service-role key. Server contexts only.
 *
 * @throws if called in a browser, or if the key is missing.
 */
export function serviceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error(
      "The Supabase service-role key is server-only and must never be read in the browser.",
    );
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is required for signed URLs, " +
        "audit logging and privileged admin reads. See .env.example.",
    );
  }

  return key;
}

/**
 * The site's public origin, without a trailing slash.
 *
 * v1 shipped a canonical URL pointing at a host it was not served from, so this
 * value is normalised in one place and reused by canonicals, hreflang, the
 * sitemap, Open Graph URLs and JSON-LD `@id`s.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.URL as string | undefined) ?? // Netlify provides this
    "http://127.0.0.1:3000";

  return raw.replace(/\/+$/, "");
}

/** Build an absolute URL against the configured origin. */
export function absoluteUrl(path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${clean}`;
}
