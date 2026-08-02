"use client";

import { useState, type ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { plural } from "@/i18n/dictionary";
import type { Dictionary } from "@/i18n/messages/en";
import type { ExperienceFacet } from "@/lib/content/experience-view";
import { cn } from "@/lib/utils/cn";

/**
 * Track and category filters for the timeline.
 *
 * ── Why filtering happens in CSS ───────────────────────────────────────────
 * The entries are Server Components and are passed through as `children`
 * untouched — this component never re-renders them, it only sets one attribute
 * on their container. Every entry is therefore present in the server-rendered
 * HTML at all times: a crawler indexes all five, `Ctrl+F` finds all five, and a
 * visitor whose bundle never loads reads all five. Filtering in React state
 * would have removed them from the document, which is a real cost for a page
 * whose whole purpose is to be found and read.
 *
 * The matching rules live in globals.css under `.experience-entries`. They hide
 * with `display: none`, which is deliberate: a filtered-out entry must also
 * leave the focus order and the accessibility tree, not merely become invisible.
 *
 * ── Why there is no URL state ──────────────────────────────────────────────
 * Unlike the Projects list, this is one short page with five entries. A filter
 * here narrows a view the visitor is already looking at rather than producing a
 * result set worth sharing, and putting it in the URL would add a navigation
 * and a scroll restoration for no gain.
 */

export type ExperienceFilterOption = {
  value: ExperienceFacet;
  label: string;
  /** Used for the live announcement, and to drop options nothing matches. */
  count: number;
};

export function ExperienceFilters({
  t,
  options,
  children,
}: {
  t: Dictionary;
  options: ExperienceFilterOption[];
  children: ReactNode;
}) {
  const [active, setActive] = useState<ExperienceFacet>("all");

  const activeCount =
    options.find((option) => option.value === active)?.count ?? 0;

  return (
    <>
      <div
        role="group"
        aria-label={t.experience.filters.label}
        className="flex flex-wrap items-center gap-2"
      >
        {options.map((option) => {
          const isActive = option.value === active;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActive(option.value)}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-full)",
                "border px-4 py-2 text-small font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                isActive
                  ? /*
                      Three signals, not one: a filled surface, a heavier
                      weight and a tick. `aria-pressed` carries it for
                      assistive technology, and the tick carries it in
                      forced-colors mode where the fill is discarded.
                    */
                    "border-foreground bg-foreground font-semibold text-background"
                  : "border-border bg-surface text-foreground-muted hover:border-border-interactive hover:text-foreground",
              )}
            >
              {isActive ? <Icon name="check" size={15} /> : null}
              {option.label}
            </button>
          );
        })}
      </div>

      {/*
        Announced after a filter changes. Focus stays on the chip, so without
        this a screen-reader user hears nothing at all when the list behind
        them shrinks.
      */}
      <p aria-live="polite" className="sr-only">
        {plural(
          activeCount,
          t.experience.filters.result,
          t.experience.filters.resultPlural,
        )}
      </p>

      <div className="experience-entries" data-filter={active}>
        {children}
      </div>
    </>
  );
}
