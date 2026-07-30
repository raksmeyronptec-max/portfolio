import { en, type Dictionary } from "./messages/en";
import { km } from "./messages/km";
import { defaultLocale, localeMeta, type Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { en, km };

/**
 * Message catalogue for a locale.
 *
 * Synchronous and statically imported: both catalogues are small, and a dynamic
 * import here would make every Server Component that needs a label `async` for
 * no benefit.
 */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

/**
 * Interpolate `{placeholder}` tokens.
 *
 * Deliberately minimal: it substitutes and nothing else. There is no expression
 * evaluation and no HTML handling, so a message string can never become an
 * injection vector — which matters because v1 assigned translations with
 * `innerHTML`.
 *
 * A missing value leaves the token in place rather than printing `undefined`, so
 * the gap is obvious during review instead of shipping silently.
 */
export function interpolate(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

/**
 * Pick between a singular and a plural message.
 *
 * Khmer has no grammatical plural, so both catalogue entries are identical for
 * `km` and this simply always resolves correctly there. English needs the
 * distinction, so the choice lives here rather than in each component.
 */
export function plural(
  count: number,
  singular: string,
  pluralForm: string,
  values: Record<string, string | number> = {},
): string {
  return interpolate(count === 1 ? singular : pluralForm, { count, ...values });
}

/** Locale-aware date formatting. */
export function formatDate(
  value: string | Date | null | undefined,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(localeMeta[locale].intlLocale, options).format(date);
}

/** Month + year only, for timelines where the day is not known. */
export function formatMonthYear(
  value: string | Date | null | undefined,
  locale: Locale,
): string {
  return formatDate(value, locale, { year: "numeric", month: "long" });
}

export function formatYear(
  value: string | Date | null | undefined,
  locale: Locale,
): string {
  return formatDate(value, locale, { year: "numeric" });
}

/** Locale-aware number formatting, including Khmer numerals. */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(localeMeta[locale].intlLocale).format(value);
}

/** Human-readable file size, used by download links. */
export function formatFileSize(bytes: number, locale: Locale): string {
  if (bytes < 1024) return `${formatNumber(bytes, locale)} B`;
  if (bytes < 1024 * 1024) {
    return `${formatNumber(Math.round(bytes / 1024), locale)} KB`;
  }
  return `${formatNumber(Math.round((bytes / (1024 * 1024)) * 10) / 10, locale)} MB`;
}

/** Seconds → a short "2m 30s" style label for rate-limit countdowns. */
export function formatDuration(totalSeconds: number, locale: Locale): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return `${formatNumber(seconds, locale)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0
    ? `${formatNumber(minutes, locale)}m ${formatNumber(rest, locale)}s`
    : `${formatNumber(minutes, locale)}m`;
}

export type { Dictionary };
