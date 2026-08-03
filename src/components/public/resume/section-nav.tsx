"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * In-page résumé navigation.
 *
 * ── Plain anchors, enhanced ────────────────────────────────────────────────
 * These are ordinary `<a href="#id">` links: they work before hydration,
 * without JavaScript, and with the browser's own back behaviour intact.
 * Everything this component adds is the *active* marking — nothing about
 * reaching a section depends on it.
 *
 * ── Why IntersectionObserver and not scroll maths ──────────────────────────
 * One observer, no scroll listener, no rAF loop. `rootMargin` biases the
 * detection band toward the top of the viewport so the entry whose heading has
 * just passed under the sticky header is the one marked, which is what a reader
 * perceives as "where I am".
 *
 * The active state is carried by `aria-current="location"` plus a weight change
 * and a filled marker — never colour alone. `location` rather than `page`: the
 * target is a section of this page, not another page.
 */
export function ResumeSectionNav({
  label,
  sections,
}: {
  label: string;
  sections: Array<{ id: string; label: string }>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost intersecting section wins, so scrolling up marks the
        // section being returned to rather than the one below it.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label={label}
      data-print="hide"
      /*
        Scrollable on narrow screens with a visible fade at the trailing edge,
        and wrapped into a column once there is room. `scrollbar-none` hides the
        bar, not the ability to scroll — the fade is the affordance.
      */
      className="relative -mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0"
    >
      <ul className="flex gap-1.5 lg:flex-col lg:gap-0.5">
        {sections.map((section) => {
          const isActive = section.id === activeId;

          return (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) px-3",
                  "text-small whitespace-nowrap transition-colors lg:w-full",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                  isActive
                    ? "bg-surface-muted font-semibold text-foreground"
                    : "font-medium text-foreground-muted hover:bg-surface-muted/60 hover:text-foreground",
                )}
              >
                {/* A filled marker, so the active state survives forced-colors
                    mode and is not carried by colour alone. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "hidden size-1.5 shrink-0 rounded-full lg:block",
                    isActive ? "bg-accent" : "bg-border-strong",
                  )}
                />
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
