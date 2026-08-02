import type { Locale } from "@/i18n/config";

/**
 * Machine-readable periods for experience entries.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `experiences.started_on` / `ended_on` are nullable, and on the live content
 * every row is null: the migrated evidence names years, not months, and
 * `cv.ts` documents that inventing a month to satisfy a `date` column would be
 * fabrication. The consequence is that the page had no orderable date at all
 * and fell back to `sort_order`, which is hand-maintained and was not
 * chronological — 2023, 2025, 2024, 2025, 2024 down the page.
 *
 * So this module derives the one fact the display strings *do* carry — the
 * year — and nothing more. It never promotes a year to a month, never fills a
 * missing end date, and returns `precision: "unknown"` rather than guessing.
 *
 * ── Why the label is parsed at all ─────────────────────────────────────────
 * Parsing a display string is normally a smell. Here it is the only honest
 * source: the years are real, the editor wrote them, and the alternative is
 * either a migration that invents `2024-01-01` or a page that cannot sort. The
 * stored dates always win when they exist, so this becomes dead weight the
 * moment the CMS gains real dates — which is the intended direction.
 *
 * ── Why `isOngoing` and `endYear` are independent ──────────────────────────
 * The second-year practicum is `is_current = true` *and* labelled `2025–2026`.
 * Both are true: it runs to 2026 and it is running now. Collapsing them would
 * force a choice between printing "2025—Present" (loses the known end) and
 * dropping the status chip (loses the fact that it is current). They are
 * therefore separate: the range renders from the years, the status chip renders
 * from `isOngoing`.
 */

export type ExperiencePeriod = {
  /** Earliest year evidenced, or null when nothing could be established. */
  startYear: number | null;
  /** Latest year evidenced. Null for an open-ended or single-year period. */
  endYear: number | null;
  /** The role is running now. Drives the status chip, never the range. */
  isOngoing: boolean;
  /**
   * How much is actually known.
   *
   * `"year"`     at least a start year is evidenced.
   * `"unknown"`  nothing parsed. The timeline files these under a
   *              "date to be confirmed" heading rather than inventing one.
   */
  precision: "year" | "unknown";
};

export type PeriodSource = {
  startedOn: string | null;
  endedOn: string | null;
  isCurrent: boolean;
  periodLabel: string | null;
};

/** Khmer digits ០–៩ occupy U+17E0–U+17E9, contiguous and in order. */
const KHMER_ZERO = 0x17e0;

function toAsciiDigits(input: string): string {
  return input.replace(/[០-៩]/gu, (digit) =>
    String((digit.codePointAt(0) ?? KHMER_ZERO) - KHMER_ZERO),
  );
}

/**
 * Markers meaning "still running", in both catalogues.
 *
 * Matched case-insensitively against the label so an editor writing "Present",
 * "present" or "បច្ចុប្បន្ន" all land the same way. This is a *fallback* — the
 * database's own `is_current` flag is checked first and always wins.
 */
const ONGOING_MARKERS = ["present", "current", "ongoing", "now", "បច្ចុប្បន្ន"];

/**
 * Four-digit years from 1800 to 2099.
 *
 * Bounded rather than `\d{4}` so a page count, a room number or "12+4" cannot
 * be mistaken for a year. "12+4 Programme" is a real tag on this site.
 */
const YEAR_PATTERN = /\b(?:1[89]\d{2}|20\d{2})\b/g;

function yearFromIsoDate(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getUTCFullYear();
}

function yearsFromLabel(label: string | null): number[] {
  if (!label) return [];
  const matches = toAsciiDigits(label).match(YEAR_PATTERN);
  if (!matches) return [];

  // Sorted and de-duplicated: "practicum 2024, revisited 2024–2025" must yield
  // [2024, 2025] whichever order the editor wrote them in.
  return [...new Set(matches.map(Number))].sort((a, b) => a - b);
}

function labelSuggestsOngoing(label: string | null): boolean {
  if (!label) return false;
  const haystack = label.toLowerCase();
  return ONGOING_MARKERS.some((marker) => haystack.includes(marker));
}

export function parseExperiencePeriod(source: PeriodSource): ExperiencePeriod {
  const storedStart = yearFromIsoDate(source.startedOn);
  const storedEnd = yearFromIsoDate(source.endedOn);
  const labelYears = yearsFromLabel(source.periodLabel);

  const startYear = storedStart ?? labelYears[0] ?? null;

  /*
   * The end year is taken from the stored date, else from the label — but only
   * when the label names a *second* year. A label of "2023 — present" yields
   * [2023]; reading its single year as both ends would print "2023" for a role
   * that is still running.
   */
  const labelEnd =
    labelYears.length > 1 ? labelYears[labelYears.length - 1] : null;
  const endYear = storedEnd ?? labelEnd ?? null;

  const isOngoing = source.isCurrent || labelSuggestsOngoing(source.periodLabel);

  if (startYear === null) {
    return { startYear: null, endYear: null, isOngoing, precision: "unknown" };
  }

  return {
    startYear,
    // Guard against a reversed or malformed pair rather than rendering
    // "2025—2024". Equal years collapse to a single year at format time.
    endYear: endYear !== null && endYear >= startYear ? endYear : null,
    isOngoing,
    precision: "year",
  };
}

/** Khmer digits, indexed by value. The inverse of `toAsciiDigits` above. */
const KHMER_DIGITS = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];

/**
 * A number in the reader's own numerals.
 *
 * ── Why this is a lookup and not `Intl` ────────────────────────────────────
 * `km-KH` resolves to *Latin* digits in CLDR, so the Khmer numbering system has
 * to be asked for explicitly — otherwise a Khmer page shows "២០២៤–២០២៥" from the
 * CMS beside "2023" from the formatter, in the same line.
 *
 * But `Intl.NumberFormat("km-KH-u-nu-khmr")` is **not portable**: Node resolves
 * it to `khmr` and ships Khmer digits, while Chromium resolves the very same tag
 * to `latn` and ships Latin ones. On a server-rendered page that is a hydration
 * mismatch — React error #418, and the digits visibly flip after hydration —
 * which is exactly what happened before this became a table.
 *
 * Ten characters, one substitution, identical on every runtime. Grouping is
 * deliberately absent: everything this formats is a year or a small count, and
 * `Intl` would otherwise render a year as "2,023".
 *
 * Deliberately not `formatNumber` from the dictionary: changing that would move
 * every count on the site to Khmer numerals, which is a site-wide editorial
 * decision rather than a fix to this page.
 */
export function formatNumeral(value: number, locale: Locale): string {
  const sign = value < 0 ? "-" : "";
  const digits = Math.trunc(Math.abs(value)).toString();

  if (locale !== "km") return sign + digits;

  return (
    sign + digits.replace(/[0-9]/g, (digit) => KHMER_DIGITS[Number(digit)] ?? digit)
  );
}

/**
 * The single display form for a period. One dash, one shape, both locales.
 *
 * An em dash with no surrounding spaces, matching the standardised form in the
 * brief. Returns `null` when nothing is known, so the caller renders its own
 * "date to be confirmed" label rather than an empty or invented range.
 */
export function formatExperiencePeriod(
  period: ExperiencePeriod,
  locale: Locale,
  presentLabel: string,
): string | null {
  if (period.startYear === null) return null;

  const start = formatNumeral(period.startYear, locale);

  if (period.endYear !== null && period.endYear !== period.startYear) {
    return `${start}—${formatNumeral(period.endYear, locale)}`;
  }

  // No end year and still running: the open end is the *point*, so it is named
  // in the reader's language rather than left blank or written as "…".
  if (period.endYear === null && period.isOngoing) {
    return `${start}—${presentLabel}`;
  }

  return start;
}

/**
 * Chronological comparison, oldest first.
 *
 * The page reads as a progression — classroom practice leading into the
 * products it informed — so ascending is the narrative order as well as the
 * sortable one.
 *
 * Policy for the ties this data actually produces:
 *
 *   1. Entries with no evidenced date sort last, together. They cannot be
 *      placed in the chronology without inventing a position for them.
 *   2. Same start year: the one that ends sooner comes first, so a closed
 *      placement precedes the open-ended role it overlaps with. An ongoing role
 *      with no end year is treated as extending furthest.
 *   3. Still tied: the CMS's own `sortOrder`, which is the editor's deliberate
 *      choice and the only remaining signal.
 */
export function compareByPeriod(
  a: { period: ExperiencePeriod; sortOrder: number },
  b: { period: ExperiencePeriod; sortOrder: number },
): number {
  const aUnknown = a.period.precision === "unknown";
  const bUnknown = b.period.precision === "unknown";
  if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;

  if (!aUnknown && !bUnknown) {
    const startDelta = (a.period.startYear ?? 0) - (b.period.startYear ?? 0);
    if (startDelta !== 0) return startDelta;

    const aEnd = a.period.endYear ?? Number.POSITIVE_INFINITY;
    const bEnd = b.period.endYear ?? Number.POSITIVE_INFINITY;
    if (aEnd !== bEnd) return aEnd - bEnd;
  }

  return a.sortOrder - b.sortOrder;
}
