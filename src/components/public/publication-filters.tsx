"use client";

import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/states";
import { PublicationCard } from "./publication-card";
import { getDictionary } from "@/i18n/dictionary";
import { interpolate } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import type { PublicationSummary } from "@/lib/content/publication";
import { cn } from "@/lib/utils/cn";

/**
 * The publications listing, with filters that appear only when they earn their
 * place.
 *
 * ── Progressive disclosure, per section 9 of the brief ─────────────────────
 *   0–8   no search, no filters. Eight covers fit on one screen; a filter bar
 *         above them is more chrome than content and makes a small body of work
 *         look like a database.
 *   9–20  type and subject chips. Enough books that "the exercise collections"
 *         is a real question, still few enough to scan.
 *   21+   search plus type, subject, year and level.
 *
 * The thresholds live here rather than in the page because they are a property
 * of this control, and because a page that computed them would have to know
 * what controls exist.
 *
 * ── Why the cards are still server-rendered ────────────────────────────────
 * They are passed in as already-resolved props and rendered by this component
 * without a fetch. Filtering is a client concern; the content is not. With
 * JavaScript disabled every publication is still in the HTML — just unfiltered,
 * which is the correct degradation for a listing of eleven things.
 */

const CHIP_THRESHOLD = 9;
const FULL_FILTER_THRESHOLD = 21;

export function PublicationFilters({
  publications,
  locale,
  types,
  subjects,
  years,
}: {
  publications: PublicationSummary[];
  locale: Locale;
  types: Array<{ id: string; slug: string; name: string; count: number }>;
  subjects: string[];
  years: number[];
}) {
  const t = getDictionary(locale);
  const searchInputId = useId();

  const mode =
    publications.length >= FULL_FILTER_THRESHOLD
      ? "full"
      : publications.length >= CHIP_THRESHOLD
        ? "chips"
        : "none";

  const [query, setQuery] = useState("");
  const [typeId, setTypeId] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return publications.filter((publication) => {
      if (typeId && publication.type?.id !== typeId) return false;
      if (subject && publication.subject !== subject) return false;
      if (year !== null && publication.year !== year) return false;

      if (!needle) return true;

      /*
       * Search covers the title, the book's own title, the summary, the subject
       * and the topics. The original title matters: someone looking for
       * ក្រាបនៃអនុគមន៍ on the English page should find "Graphs of Functions",
       * and they will type the Khmer.
       */
      const haystack = [
        publication.title,
        publication.originalTitle,
        publication.subtitle,
        publication.summary,
        publication.subject,
        publication.gradeLevel,
        ...publication.topics.map((topic) => topic.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [publications, query, typeId, subject, year]);

  const hasActiveFilter =
    query.trim() !== "" || typeId !== null || subject !== null || year !== null;

  const clearAll = () => {
    setQuery("");
    setTypeId(null);
    setSubject(null);
    setYear(null);
  };

  const countLabel = interpolate(
    filtered.length === 1 ? t.publications.resultCount : t.publications.resultCountPlural,
    { count: filtered.length },
  );

  return (
    <div className="flex flex-col gap-6">
      {mode !== "none" ? (
        <div className="flex flex-col gap-4">
          {mode === "full" ? (
            <>
              {/*
               * The toggle exists only on small screens. Above `sm` the controls
               * are always visible — hiding four selects behind a button on a
               * desktop is a tap for nothing.
               */}
              <div className="sm:hidden">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                  aria-controls="publication-filter-controls"
                >
                  <Icon name={filtersOpen ? "close" : "search"} size={16} />
                  {filtersOpen ? t.publications.hideFilters : t.publications.showFilters}
                </Button>
              </div>

              <div
                id="publication-filter-controls"
                className={cn(
                  "flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-end",
                  filtersOpen ? "flex" : "hidden sm:flex",
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <label
                    htmlFor={searchInputId}
                    className="text-small font-medium text-foreground"
                  >
                    {t.publications.searchLabel}
                  </label>
                  <input
                    id={searchInputId}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t.publications.searchPlaceholder}
                    className="min-h-11 w-full rounded-(--radius-md) border border-border bg-surface px-3 text-body leading-khmer text-foreground placeholder:text-foreground-subtle"
                  />
                </div>

                <FilterSelect
                  label={t.publications.filterType}
                  value={typeId ?? ""}
                  onChange={(value) => setTypeId(value || null)}
                  allLabel={t.publications.allTypes}
                  options={types.map((type) => ({
                    value: type.id,
                    label: `${type.name} (${type.count})`,
                  }))}
                />

                {subjects.length > 1 ? (
                  <FilterSelect
                    label={t.publications.filterSubject}
                    value={subject ?? ""}
                    onChange={(value) => setSubject(value || null)}
                    allLabel={t.publications.allSubjects}
                    options={subjects.map((value) => ({ value, label: value }))}
                  />
                ) : null}

                {years.length > 1 ? (
                  <FilterSelect
                    label={t.publications.filterYear}
                    value={year === null ? "" : String(year)}
                    onChange={(value) => setYear(value ? Number(value) : null)}
                    allLabel={t.publications.allYears}
                    options={years.map((value) => ({
                      value: String(value),
                      label: String(value),
                    }))}
                  />
                ) : null}
              </div>
            </>
          ) : (
            /* ── Chips ─────────────────────────────────────────────────── */
            <div className="flex flex-col gap-3">
              {types.length > 1 ? (
                <ChipRow
                  legend={t.publications.filterType}
                  allLabel={t.publications.allTypes}
                  value={typeId}
                  onChange={setTypeId}
                  options={types.map((type) => ({ value: type.id, label: type.name }))}
                />
              ) : null}

              {subjects.length > 1 ? (
                <ChipRow
                  legend={t.publications.filterSubject}
                  allLabel={t.publications.allSubjects}
                  value={subject}
                  onChange={setSubject}
                  options={subjects.map((value) => ({ value, label: value }))}
                />
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {/*
             * The count is a live region so a screen-reader user hears the
             * result of a filter change. Without it, changing a select silently
             * replaces the content below and there is nothing to announce it.
             */}
            <p aria-live="polite" className="text-small text-foreground-muted">
              {countLabel}
            </p>

            {hasActiveFilter ? (
              <Button type="button" variant="ghost" onClick={clearAll}>
                {t.publications.clearFilters}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title={t.publications.noResults}
          description={t.publications.noResultsHint}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((publication) => (
            <li key={publication.id} className="flex">
              <PublicationCard publication={publication} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium text-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-(--radius-md) border border-border bg-surface px-3 text-body leading-khmer text-foreground"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * A row of toggle chips.
 *
 * `fieldset`/`legend` rather than a div with a label, because these are one
 * group of mutually exclusive choices and the legend is what gives a screen
 * reader the context for each button. `aria-pressed` carries the state — colour
 * alone would not.
 */
function ChipRow({
  legend,
  allLabel,
  value,
  onChange,
  options,
}: {
  legend: string;
  allLabel: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{legend}</legend>

      <Chip pressed={value === null} onClick={() => onChange(null)}>
        {allLabel}
      </Chip>

      {options.map((option) => (
        <Chip
          key={option.value}
          pressed={value === option.value}
          onClick={() => onChange(value === option.value ? null : option.value)}
        >
          {option.label}
        </Chip>
      ))}
    </fieldset>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        // 44px minimum target, per WCAG 2.2 Target Size (Minimum).
        "inline-flex min-h-11 items-center rounded-(--radius-full) border px-3.5 text-small leading-khmer transition-colors",
        pressed
          ? "border-primary bg-primary-subtle font-semibold text-primary-subtle-foreground"
          : "border-border bg-surface text-foreground-muted hover:border-border-strong hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
