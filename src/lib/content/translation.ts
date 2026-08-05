import { defaultLocale, locales, type Locale } from "@/i18n/config";

/** Any row from a `*_translations` table. */
export type TranslationRow = { locale: string };

export type TranslationResolution<T> = {
  /** The row to render. */
  row: T | null;
  /** Locale the row is actually written in. */
  actualLocale: Locale | null;
  /** True when the requested locale was unavailable and we fell back. */
  isFallback: boolean;
};

/**
 * Resolve a translation for a locale, with a documented fallback chain:
 *
 *   requested locale → default locale (en) → any available locale → null
 *
 * Falling back is preferable to rendering an empty page, but the caller is told
 * it happened via `isFallback` so it can set `lang` correctly on the rendered
 * text. Announcing English prose as Khmer would make a screen reader mispronounce
 * the whole page, which is exactly the bug v1 had at the document level.
 */
export function resolveTranslation<T extends TranslationRow>(
  rows: readonly T[] | null | undefined,
  requested: Locale,
): TranslationResolution<T> {
  if (!rows || rows.length === 0) {
    return { row: null, actualLocale: null, isFallback: false };
  }

  const exact = rows.find((row) => row.locale === requested);
  if (exact) {
    return { row: exact, actualLocale: requested, isFallback: false };
  }

  const fallback = rows.find((row) => row.locale === defaultLocale);
  if (fallback) {
    return { row: fallback, actualLocale: defaultLocale, isFallback: true };
  }

  const first = rows[0];
  if (!first) return { row: null, actualLocale: null, isFallback: false };

  const actualLocale = locales.find((l) => l === first.locale) ?? null;
  return { row: first, actualLocale, isFallback: true };
}

/**
 * Pick between paired `*_en` / `*_km` columns.
 *
 * Used for short locale-dependent labels that live on the parent table rather
 * than in a translation row (category names, tag labels, issuer names). Empty
 * strings count as missing, so a blank Khmer field falls back rather than
 * rendering nothing.
 */
export function pickLocalized(
  locale: Locale,
  en: string | null | undefined,
  km: string | null | undefined,
): string | null {
  const preferred = locale === "km" ? km : en;
  if (preferred && preferred.trim() !== "") return preferred;

  const other = locale === "km" ? en : km;
  if (other && other.trim() !== "") return other;

  return null;
}

/**
 * Pick only the requested locale from a paired-column field.
 *
 * Most compact labels may safely fall back and carry their true `lang`, but
 * personal biography and headline prose must not silently turn an otherwise
 * Khmer page into a mixed-language profile. Those fields use this stricter
 * helper and disappear when their requested translation is absent.
 */
export function pickExactLocale(
  locale: Locale,
  en: string | null | undefined,
  km: string | null | undefined,
): string | null {
  const value = locale === "km" ? km : en;
  if (!value || value.trim() === "") return null;

  const trimmed = value.trim();
  const hasKhmer = /[\u1780-\u17ff]/u.test(trimmed);
  const hasLatin = /[a-z]/iu.test(trimmed);

  // This helper is intentionally limited to personal prose fields. A non-empty
  // Khmer column containing only English was previously treated as translated
  // and leaked an English profile headline into `/km/about`.
  if (locale === "km" && !hasKhmer) return null;
  if (locale === "en" && hasKhmer && !hasLatin) return null;

  return trimmed;
}

/**
 * `lang` attribute for a block of text, or `undefined` when it matches the page.
 *
 * Returning `undefined` rather than always emitting `lang` keeps the markup
 * clean; the attribute appears only where the text genuinely differs from the
 * document language.
 */
export function langAttribute(
  pageLocale: Locale,
  contentLocale: Locale | null,
): string | undefined {
  if (!contentLocale || contentLocale === pageLocale) return undefined;
  return contentLocale;
}

/** Translation completeness for the admin's status indicators. */
export function translationStatus(
  rows: readonly TranslationRow[] | null | undefined,
): "complete" | "partial" | "missing" {
  if (!rows || rows.length === 0) return "missing";
  const present = new Set(rows.map((row) => row.locale));
  const all = locales.every((locale) => present.has(locale));
  return all ? "complete" : "partial";
}

/** Which locales are missing a translation row. */
export function missingLocales(
  rows: readonly TranslationRow[] | null | undefined,
): Locale[] {
  const present = new Set((rows ?? []).map((row) => row.locale));
  return locales.filter((locale) => !present.has(locale));
}
