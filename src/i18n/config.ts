/**
 * Locale configuration.
 *
 * Strategy: every public URL carries its locale as the first path segment
 * (`/en/...`, `/km/...`). This is the SEO-safe option — each language gets its
 * own indexable URL, hreflang pairs are trivial to emit, and the Khmer content
 * is crawlable instead of only existing after a client-side click, which was
 * v1's core i18n problem.
 */

export const locales = ["en", "km"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Cookie used to remember an explicit language choice across visits. */
export const LOCALE_COOKIE = "portfolio_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Metadata for the language switcher and the `hreflang` attributes. */
export const localeMeta: Record<
  Locale,
  {
    /** BCP-47 tag for `lang` and `hreflang`. */
    tag: string;
    /** Language name written in that language. */
    nativeName: string;
    /** Language name in English, for the switcher's accessible label. */
    englishName: string;
    /** Short label for the compact switcher. */
    shortLabel: string;
    dir: "ltr" | "rtl";
    /** Intl locale used for dates and numbers. */
    intlLocale: string;
  }
> = {
  en: {
    tag: "en",
    nativeName: "English",
    englishName: "English",
    shortLabel: "EN",
    dir: "ltr",
    intlLocale: "en-GB",
  },
  km: {
    tag: "km",
    nativeName: "ខ្មែរ",
    englishName: "Khmer",
    shortLabel: "ខ្មែរ",
    dir: "ltr",
    intlLocale: "km-KH",
  },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/**
 * The other locale(s), used to emit alternate links.
 */
export function otherLocales(current: Locale): Locale[] {
  return locales.filter((l) => l !== current);
}

/**
 * Prefix a locale-relative path. Accepts `""`, `"/"` or `"projects/x"` and
 * always returns a rooted, locale-prefixed path with no double slashes.
 */
export function localePath(locale: Locale, path = ""): string {
  const clean = path.replace(/^\/+/, "").replace(/\/+$/, "");
  return clean ? `/${locale}/${clean}` : `/${locale}`;
}

/**
 * Swap the locale segment of an existing pathname, preserving the rest.
 * Used by the language switcher so switching language keeps you on the page.
 */
export function switchLocaleInPath(pathname: string, next: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return `/${next}`;
  if (isLocale(segments[0])) {
    segments[0] = next;
    return `/${segments.join("/")}`;
  }
  return `/${next}/${segments.join("/")}`;
}

/**
 * Strip the locale prefix, yielding the route-relative path.
 * `/km/projects/krusmart` → `projects/krusmart`
 */
export function stripLocaleFromPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && isLocale(segments[0])) segments.shift();
  return segments.join("/");
}

/**
 * Negotiate a locale from an `Accept-Language` header. Falls back to the
 * default rather than guessing from anything less reliable.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1] ?? "0") : 1;
      return { tag: (tag ?? "").trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }

  return defaultLocale;
}
