"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/primitives";
import { interpolate } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import type { JourneyCategory, JourneyEntrySummary } from "@/lib/content/journey";
import { cn } from "@/lib/utils/cn";

/**
 * The journey timeline.
 *
 * ── Editorial, not a feed ──────────────────────────────────────────────────
 * The brief's sharpest constraint is that this must not look like social media,
 * and the failure mode it names — "do not turn every entry into an identical
 * bordered card" — is exactly what a naive implementation produces. So:
 *
 *  · a single hairline rail runs down the page with year markers on it, which is
 *    what makes the page read as a chronology rather than a list;
 *  · entries alternate their image side on desktop, so the eye moves rather than
 *    scanning a column of identical rectangles;
 *  · the first entry in each year gets a larger image than the rest, because an
 *    editorial page has a hierarchy and a feed does not;
 *  · there is no border, no shadow and no card around an entry. The rail, the
 *    whitespace and the type scale do the separating.
 *
 * On mobile all of that collapses to a single column — alternating sides at
 * 390px would only produce ragged text — but the rail, the year markers and the
 * size hierarchy survive, so the structure is still legible at 320px.
 *
 * ── Progressive filters ────────────────────────────────────────────────────
 * Filters appear only when there is something to filter, per section 13:
 *
 *    0–8 entries    nothing. A filter over six items is furniture.
 *    9–20           category chips.
 *    21+            search, category and year.
 *
 * Thresholds are named constants below rather than inline numbers, because the
 * behaviour they produce is a design decision and someone will want to find it.
 */

const CHIPS_FROM = 9;
const FULL_FILTERS_FROM = 21;
const PAGE_SIZE = 12;

export function JourneyTimeline({
  locale,
  t,
  entries,
  categories,
}: {
  locale: Locale;
  t: Dictionary;
  entries: JourneyEntrySummary[];
  categories: Array<JourneyCategory & { count: number }>;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const showChips = entries.length >= CHIPS_FROM;
  const showFullFilters = entries.length >= FULL_FILTERS_FROM;

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) if (entry.year) set.add(entry.year);
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return entries.filter((entry) => {
      if (category && entry.category?.slug !== category) return false;
      if (year && entry.year !== year) return false;

      if (needle) {
        /*
         * Matched against title, summary, organisation and location.
         *
         * `toLowerCase()` is a no-op for Khmer, which has no case — the match is
         * therefore a plain substring test in Khmer, which is the correct
         * behaviour for a script with no word separators. Tokenising on spaces
         * would break Khmer entirely.
         */
        const haystack = [
          entry.title,
          entry.summary,
          entry.organisation,
          entry.location,
          entry.category?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [category, entries, query, year]);

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > shown.length;

  // Reset paging whenever the result set changes, so "Show more" never reveals
  // a page of a previous filter's results.
  const resetPaging = () => setVisible(PAGE_SIZE);

  /*
   * Group by year for the rail's markers. Undated stories collect under their own
   * heading at the end rather than being filed under an invented year — see
   * `journeyYear()` for why they have no year at all.
   */
  const groups = useMemo(() => {
    const map = new Map<string, JourneyEntrySummary[]>();
    for (const entry of shown) {
      const key = entry.year ?? "__undated";
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [shown]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      {showChips ? (
        <div className="flex flex-col gap-4">
          {showFullFilters ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="journey-search"
                  className="mb-1.5 block text-[0.8125rem] font-medium text-foreground-muted"
                >
                  {t.journey.searchLabel}
                </label>
                <div className="relative">
                  <Icon
                    name="search"
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-foreground-subtle"
                  />
                  <input
                    id="journey-search"
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      resetPaging();
                    }}
                    placeholder={t.journey.searchPlaceholder}
                    className={cn(
                      "min-h-11 w-full rounded-(--radius-md) border border-border bg-surface",
                      "pl-9 pr-3 text-small",
                      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)",
                    )}
                  />
                </div>
              </div>

              {years.length > 1 ? (
                <div className="sm:w-40">
                  <label
                    htmlFor="journey-year"
                    className="mb-1.5 block text-[0.8125rem] font-medium text-foreground-muted"
                  >
                    {t.journey.filterYear}
                  </label>
                  <select
                    id="journey-year"
                    value={year ?? ""}
                    onChange={(event) => {
                      setYear(event.target.value || null);
                      resetPaging();
                    }}
                    className={cn(
                      "min-h-11 w-full rounded-(--radius-md) border border-border bg-surface px-3 text-small",
                      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)",
                    )}
                  >
                    <option value="">{t.journey.allYears}</option>
                    {years.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}

          {categories.length > 1 ? (
            /*
              A horizontally scrollable chip row rather than a wrapping one.

              At 320px a wrapping row of Khmer category names becomes four or five
              lines that push the first story below the fold. Scrolling keeps the
              filter one line tall at every width; `snap` makes it land cleanly,
              and every chip stays a real focusable button so keyboard users reach
              them in order regardless of what is visible.
            */
            <div
              role="group"
              aria-label={t.journey.filterCategory}
              className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1"
            >
              <FilterChip
                active={category === null}
                onClick={() => {
                  setCategory(null);
                  resetPaging();
                }}
              >
                {t.journey.allCategories}
              </FilterChip>

              {categories.map((entry) => (
                <FilterChip
                  key={entry.slug}
                  active={category === entry.slug}
                  onClick={() => {
                    setCategory(category === entry.slug ? null : entry.slug);
                    resetPaging();
                  }}
                >
                  {entry.name}
                  <span className="ml-1.5 tabular-nums opacity-60">{entry.count}</span>
                </FilterChip>
              ))}
            </div>
          ) : null}

          {/*
            The result count, announced politely. Filtering does not move focus,
            so without a live region a screen-reader user pressing a chip gets no
            confirmation that anything happened.
          */}
          <p aria-live="polite" className="text-[0.8125rem] text-foreground-subtle">
            {interpolate(
              filtered.length === 1 ? t.journey.resultCount : t.journey.resultCountPlural,
              { count: filtered.length },
            )}
          </p>
        </div>
      ) : null}

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-(--radius-lg) border border-dashed border-border-strong px-6 py-12 text-center">
          <p className="text-body font-medium">{t.journey.noResults}</p>
          <p className="mt-1 text-small text-foreground-muted">
            {t.journey.noResultsHint}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map(([key, groupEntries]) => (
            <section key={key} className="flex flex-col gap-6">
              {/* ── Year marker ─────────────────────────────────────────── */}
              <h2 className="flex items-center gap-3">
                <span
                  className={cn(
                    "font-mono text-[1.375rem] font-semibold tabular-nums",
                    key === "__undated" ? "text-foreground-subtle" : "text-foreground",
                  )}
                >
                  {key === "__undated" ? t.journey.undatedHeading : key}
                </span>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </h2>

              <ol className="flex list-none flex-col gap-10 p-0 sm:gap-12">
                {groupEntries.map((entry, index) => (
                  <li key={entry.id}>
                    <TimelineEntry
                      locale={locale}
                      t={t}
                      entry={entry}
                      // The first story of each year leads it. Every other entry
                      // is the standard size, which is what creates the rhythm.
                      lead={index === 0}
                      // Alternate the image side from the second entry onwards.
                      flipped={index > 0 && index % 2 === 0}
                    />
                  </li>
                ))}
              </ol>
            </section>
          ))}

          {hasMore ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((count) => count + PAGE_SIZE)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-(--radius-full)",
                  "border border-border-strong px-5 text-small font-medium",
                  "transition-colors hover:bg-surface-muted",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                )}
              >
                <Icon name="chevronDown" size={16} />
                {t.journey.loadMore}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── One entry ───────────────────────────────────────────────────────────────

function TimelineEntry({
  locale,
  t,
  entry,
  lead,
  flipped,
}: {
  locale: Locale;
  t: Dictionary;
  entry: JourneyEntrySummary;
  lead: boolean;
  flipped: boolean;
}) {
  const href = localePath(locale, `journey/${entry.slug}`);

  return (
    <article
      className={cn(
        "grid gap-5 sm:gap-7",
        // A single column until there is genuinely room for two. Below this the
        // text column would be too narrow for Khmer, which runs 20–40% longer
        // than the English it is set against.
        entry.cover ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center" : "",
        entry.cover && flipped ? "md:[&>figure]:order-2" : "",
      )}
    >
      {entry.cover ? (
        <figure className="m-0">
          <Link
            href={href}
            tabIndex={-1}
            // Excluded from the tab order: the heading below links to the same
            // place, and two adjacent tab stops to one destination is noise for
            // a keyboard user. The image stays clickable for everyone else.
            aria-hidden="true"
            className={cn(
              "group relative block overflow-hidden rounded-(--radius-lg)",
              "border border-border bg-surface-muted",
              lead ? "aspect-[16/10]" : "aspect-[4/3]",
            )}
          >
            <Image
              src={entry.cover.src}
              alt=""
              fill
              sizes={
                lead
                  ? "(min-width: 768px) 560px, 100vw"
                  : "(min-width: 768px) 460px, 100vw"
              }
              loading="lazy"
              placeholder={entry.cover.blurDataURL ? "blur" : undefined}
              blurDataURL={entry.cover.blurDataURL ?? undefined}
              style={
                entry.cover.objectPosition
                  ? { objectPosition: entry.cover.objectPosition }
                  : undefined
              }
              className={cn(
                "object-cover",
                "transition-transform duration-500 group-hover:scale-[1.02]",
                "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
              )}
            />

            {entry.videoCount > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  "bg-gradient-to-t from-black/40 to-transparent",
                )}
              >
                <span className="flex size-12 items-center justify-center rounded-(--radius-full) bg-white/90 text-black">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                </span>
              </span>
            ) : null}
          </Link>
        </figure>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {/* ── Eyebrow: period · category ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.8125rem]">
          {entry.periodLabel ? (
            <span className="font-mono text-foreground-subtle tabular-nums">
              {entry.periodLabel}
            </span>
          ) : null}

          {entry.category ? (
            <>
              {entry.periodLabel ? (
                <span aria-hidden="true" className="text-foreground-subtle">
                  ·
                </span>
              ) : null}
              <Badge tone="neutral">{entry.category.name}</Badge>
            </>
          ) : null}
        </div>

        <h3
          className={cn(
            "font-semibold text-balance",
            lead ? "text-[1.375rem] leading-tight sm:text-[1.5rem]" : "text-[1.125rem] leading-snug",
          )}
        >
          <Link
            href={href}
            /*
              A stretched link would be simpler, but it would also swallow the
              text selection of the summary underneath it — and on a page whose
              whole purpose is reading, being unable to select a sentence is a
              real regression. So the heading is the link and the image is a
              second, aria-hidden path to the same URL.
            */
            className={cn(
              "underline decoration-transparent underline-offset-4 transition-colors",
              "hover:decoration-current",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
            )}
            // `lang` when the prose fell back to the other locale, so a screen
            // reader does not pronounce English text with Khmer phonetics.
            lang={
              entry.isFallback && entry.contentLocale && entry.contentLocale !== locale
                ? entry.contentLocale
                : undefined
            }
          >
            {entry.title}
          </Link>
        </h3>

        {entry.summary ? (
          <p
            className="max-w-[62ch] text-small leading-relaxed text-foreground-muted"
            lang={
              entry.isFallback && entry.contentLocale && entry.contentLocale !== locale
                ? entry.contentLocale
                : undefined
            }
          >
            {entry.summary}
          </p>
        ) : null}

        {/* ── Where ──────────────────────────────────────────────────────── */}
        {entry.organisation || entry.location ? (
          <p className="flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-foreground-subtle">
            <Icon name="mapPin" size={13} aria-hidden="true" />
            {[entry.organisation, entry.location].filter(Boolean).join(" · ")}
          </p>
        ) : null}

        {/* ── Media counts and the call to action ────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          <Link
            href={href}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 text-small font-medium",
              "underline decoration-border-strong underline-offset-4 transition-colors",
              "hover:decoration-current",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
            )}
          >
            {t.journey.viewStory}
            <Icon name="arrowRight" size={15} />
          </Link>

          {entry.photoCount > 0 || entry.videoCount > 0 ? (
            <p className="flex items-center gap-3 text-[0.75rem] text-foreground-subtle">
              {entry.photoCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Icon name="image" size={13} aria-hidden="true" />
                  {interpolate(
                    entry.photoCount === 1
                      ? t.journey.photoCount
                      : t.journey.photoCountPlural,
                    { count: entry.photoCount },
                  )}
                </span>
              ) : null}

              {entry.videoCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Icon name="file" size={13} aria-hidden="true" />
                  {interpolate(
                    entry.videoCount === 1
                      ? t.journey.videoCount
                      : t.journey.videoCountPlural,
                    { count: entry.videoCount },
                  )}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

// ── Filter chip ─────────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 shrink-0 snap-start items-center rounded-(--radius-full)",
        "border px-3.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
        active
          ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
          : "border-border text-foreground-muted hover:border-border-interactive hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
