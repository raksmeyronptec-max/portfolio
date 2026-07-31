"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Select, TextInput } from "@/components/ui/field";
import type { Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils/cn";

export type FilterOption = { value: string; label: string };

export type ProjectFilterState = {
  search: string;
  category: string;
  technology: string;
  status: string;
  featuredOnly: boolean;
};

/**
 * Value identity for a filter state.
 *
 * Used to tell "the URL changed" apart from "the parent re-rendered and rebuilt
 * an equal object", which a reference comparison cannot do.
 */
function filterKey(state: ProjectFilterState): string {
  return [
    state.search,
    state.category,
    state.technology,
    state.status,
    state.featuredOnly ? "1" : "0",
  ].join("\u0000");
}

/**
 * Project list filters.
 *
 * Filters live in the URL, which makes a filtered view shareable, bookmarkable,
 * back-button friendly and server-rendered. This is a Client Component only
 * because it needs to debounce typing and push URL changes.
 *
 * Accessibility details that are easy to get wrong and are handled here:
 *  - The form works without JavaScript: it is a real `<form method="get">`, so
 *    submitting it navigates with the right query string even if the debounced
 *    handler never runs.
 *  - Result changes are announced through a polite live region owned by the
 *    parent list, so a screen-reader user hears "12 projects" after filtering
 *    instead of silence.
 *  - `useTransition` keeps the previous results on screen while the new ones
 *    load, rather than flashing an empty state.
 */
export function ProjectFilters({
  locale,
  t,
  initial,
  categories,
  technologies,
  statuses,
  resultLabel,
  mode = "full",
}: {
  locale: Locale;
  t: Dictionary;
  initial: ProjectFilterState;
  categories: FilterOption[];
  technologies: FilterOption[];
  statuses: FilterOption[];
  resultLabel: string;
  /**
   * How much filtering UI to show. Chosen by the page from the *unfiltered*
   * published count, so the controls grow with the collection instead of
   * dominating a page with three projects on it — the brief's progressive
   * filtering rule.
   *
   *   chips  category chips only, scrollable on narrow screens
   *   full   search plus the category/technology/status selects
   *
   * The "none" case is handled by the page not rendering this at all.
   */
  mode?: "chips" | "full";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState(initial);

  const searchId = useId();
  const categoryId = useId();
  const technologyId = useId();
  const statusId = useId();
  const featuredId = useId();

  const debounceRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  /*
   * Keep local state in sync when the URL changes from elsewhere (back button, a
   * "clear filters" link, or a language switch that preserves the query).
   *
   * Compared by *value*, not by reference: `initial` is rebuilt from
   * `searchParams` on every parent render, so a reference comparison would reset
   * the controls — and drop the caret out of the search box — on renders where
   * nothing actually changed.
   *
   * Adjusted during render rather than in an effect for the same reason: the
   * effect version committed the stale values first and corrected them on a second
   * pass, which is visible as a flicker on a slow device.
   */
  const initialKey = filterKey(initial);
  const [syncedKey, setSyncedKey] = useState(initialKey);

  if (syncedKey !== initialKey) {
    setSyncedKey(initialKey);
    setState(initial);
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    // 350ms: long enough not to fire on every keystroke, short enough to feel
    // immediate.
    debounceRef.current = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (state.search.trim()) params.set("q", state.search.trim());
      if (state.category) params.set("category", state.category);
      if (state.technology) params.set("tech", state.technology);
      if (state.status) params.set("status", state.status);
      if (state.featuredOnly) params.set("featured", "1");

      const query = params.toString();
      const href = `${localePath(locale, "projects")}${query ? `?${query}` : ""}`;

      startTransition(() => {
        // `scroll: false` keeps the reader's position: jumping to the top of the
        // page after adjusting a filter loses their place in the results.
        router.push(href, { scroll: false });
      });
    }, 350);

    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [state, locale, router]);

  const hasActiveFilters =
    Boolean(state.search.trim()) ||
    Boolean(state.category) ||
    Boolean(state.technology) ||
    Boolean(state.status) ||
    state.featuredOnly;

  function clearAll() {
    setState({
      search: "",
      category: "",
      technology: "",
      status: "",
      featuredOnly: false,
    });
  }

  /*
   * Chip mode: a single scrollable row of category toggles and nothing else.
   *
   * Still a real GET form with real submit buttons, so it works without
   * JavaScript exactly like the full variant — each chip submits `category`.
   */
  if (mode === "chips") {
    return (
      <form
        method="get"
        action={localePath(locale, "projects")}
        aria-label={t.projects.filterCategory}
        className="flex flex-col gap-3"
        onSubmit={(event) => event.preventDefault()}
      >
        {/* `-mx-*`/`px-*` lets the row bleed to the viewport edge while
            scrolling, so a chip is never half-hidden under the container
            padding on a narrow screen. */}
        <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ value: "", label: t.projects.allCategories }, ...categories].map((option) => {
            const active = state.category === option.value;

            return (
              <li key={option.value || "all"} className="snap-start">
                <button
                  type="submit"
                  name="category"
                  value={option.value}
                  aria-pressed={active}
                  onClick={() =>
                    setState((current) => ({ ...current, category: option.value }))
                  }
                  className={cn(
                    "inline-flex min-h-10 cursor-pointer items-center whitespace-nowrap rounded-(--radius-full) border px-4",
                    "text-small font-medium transition-colors duration-200",
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-surface text-foreground-muted hover:border-border-interactive hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>

        <p
          className={cn(
            "text-small tabular-nums text-foreground-subtle transition-opacity",
            isPending && "opacity-50",
          )}
        >
          {resultLabel}
        </p>
      </form>
    );
  }

  return (
    <form
      method="get"
      action={localePath(locale, "projects")}
      role="search"
      aria-label={t.projects.searchLabel}
      className="flex flex-col gap-4 rounded-(--radius-lg) border border-border bg-surface p-4 sm:p-5"
      onSubmit={(event) => {
        // The debounced effect already navigates; prevent a double navigation
        // when JavaScript is available.
        event.preventDefault();
      }}
    >
      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={searchId} className="text-small font-medium">
          {t.projects.searchLabel}
        </label>

        <div className="relative">
          <Icon
            name="search"
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
          />
          <TextInput
            id={searchId}
            name="q"
            type="search"
            value={state.search}
            placeholder={t.projects.searchPlaceholder}
            autoComplete="off"
            className="pl-10 pr-10"
            onChange={(event) =>
              setState((current) => ({ ...current, search: event.target.value }))
            }
          />
          {state.search ? (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <IconButton
                icon="close"
                label={t.common.clear}
                size="sm"
                variant="ghost"
                onClick={() => setState((current) => ({ ...current, search: "" }))}
              />
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Selects ────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={categoryId} className="text-small font-medium">
            {t.projects.filterCategory}
          </label>
          <Select
            id={categoryId}
            name="category"
            value={state.category}
            onChange={(event) =>
              setState((current) => ({ ...current, category: event.target.value }))
            }
          >
            <option value="">{t.projects.allCategories}</option>
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={technologyId} className="text-small font-medium">
            {t.projects.filterTechnology}
          </label>
          <Select
            id={technologyId}
            name="tech"
            value={state.technology}
            onChange={(event) =>
              setState((current) => ({ ...current, technology: event.target.value }))
            }
          >
            <option value="">{t.projects.allTechnologies}</option>
            {technologies.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={statusId} className="text-small font-medium">
            {t.projects.filterStatus}
          </label>
          <Select
            id={statusId}
            name="status"
            value={state.status}
            onChange={(event) =>
              setState((current) => ({ ...current, status: event.target.value }))
            }
          >
            <option value="">{t.projects.allStatuses}</option>
            {statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* ── Footer row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <input
            id={featuredId}
            name="featured"
            type="checkbox"
            checked={state.featuredOnly}
            onChange={(event) =>
              setState((current) => ({
                ...current,
                featuredOnly: event.target.checked,
              }))
            }
            className="size-5 cursor-pointer rounded-(--radius-xs) border border-border-strong accent-(--primary)"
          />
          <label htmlFor={featuredId} className="cursor-pointer text-small">
            {t.projects.featuredOnly}
          </label>
        </div>

        <div className="flex items-center gap-3">
          <p
            className={cn(
              "text-small tabular-nums text-foreground-muted transition-opacity",
              isPending && "opacity-50",
            )}
          >
            {resultLabel}
          </p>

          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" iconStart="refresh" onClick={clearAll}>
              {t.a11y.clearFilters}
            </Button>
          ) : null}

          {/* No-JS fallback: a real submit button. Hidden when JS is running,
              because the debounced effect already handles navigation. */}
          <noscript>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-(--radius-md) bg-primary px-4 text-small font-medium text-primary-foreground"
            >
              {t.common.search}
            </button>
          </noscript>
        </div>
      </div>
    </form>
  );
}
