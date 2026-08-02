"use client";

import { useState } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { SmartLink } from "@/components/ui/primitives";
import { interpolate, plural } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import { formatNumeral } from "@/lib/content/experience-period";
import type {
  EvidenceItem,
  EvidenceTheme,
} from "@/lib/content/experience-view";
import { cn } from "@/lib/utils/cn";
import { trackMark } from "./marks";

/**
 * Themes, and the real work that evidences them.
 *
 * ── What this replaces ─────────────────────────────────────────────────────
 * A skills list with proficiency bars. Nothing in the CMS measures proficiency,
 * so any number on this page would have been invented — and the useful question
 * is not "how good" but "shown where". Every theme here lists roles, products
 * and publications that exist, each one a link to the thing itself. A theme
 * that collects nothing is filtered out upstream and never renders.
 *
 * ── Why selecting a theme highlights rather than filters ───────────────────
 * Selecting emphasises one group; it never hides the others. The relationships
 * between themes are half the point — mathematics evidenced by both a tutoring
 * role and four published books is the argument — and a filter that blanks the
 * rest destroys exactly that. Nothing here is behind hover, and nothing is
 * revealed only on selection.
 *
 * ── Why this one is a Client Component ─────────────────────────────────────
 * It holds selection state and needs to re-render the group it emphasises. The
 * data is a few dozen plain strings and links, and it is still server-rendered
 * on first paint, so the evidence is in the HTML whether the bundle arrives or
 * not.
 */

const KIND_ICONS: Record<EvidenceItem["kind"], IconName> = {
  experience: "briefcase",
  project: "layers",
  publication: "book",
};

export function EvidenceMap({
  locale,
  t,
  themes,
  headingId,
}: {
  locale: Locale;
  t: Dictionary;
  themes: EvidenceTheme[];
  headingId: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (themes.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="bg-surface-muted">
      <div className="container-content section-y flex flex-col gap-10">
        <div className="flex max-w-[54ch] flex-col gap-3">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {t.experience.evidence.eyebrow}
          </p>
          <h2 id={headingId} className="text-h2">
            {t.experience.evidence.heading}
          </h2>
          <p className="text-body-lg text-foreground-muted">
            {t.experience.evidence.description}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-12">
          {/* ── Theme index ───────────────────────────────────────────────
              A wrapped row of chips on narrow screens and a column on wide
              ones — the same buttons either way, never a second copy. */}
          <div
            role="group"
            aria-label={t.experience.evidence.themeListLabel}
            className="flex flex-wrap gap-2 lg:sticky lg:top-24 lg:flex-col lg:self-start"
          >
            {themes.map((theme) => {
              const isActive = theme.id === activeId;

              return (
                <button
                  key={theme.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveId(isActive ? null : theme.id)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) border",
                    "px-3.5 py-2 text-start text-small transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                    "lg:w-full lg:justify-between",
                    isActive
                      ? "border-foreground bg-surface font-semibold text-foreground"
                      : "border-border bg-surface/60 font-medium text-foreground-muted hover:border-border-interactive hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: trackMark(theme.track) }}
                    />
                    {theme.label}
                  </span>

                  {/* Counts follow the reader's numerals, like the dates. */}
                  <span className="font-mono text-[0.75rem] text-foreground-subtle">
                    {formatNumeral(theme.items.length, locale)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Groups ────────────────────────────────────────────────────
              Always all of them, always fully readable. Selection changes the
              rule and the surface, not the contrast of the text. */}
          <ul className="flex flex-col gap-5">
            {themes.map((theme) => (
              <EvidenceGroup
                key={theme.id}
                locale={locale}
                t={t}
                theme={theme}
                isActive={theme.id === activeId}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function EvidenceGroup({
  locale,
  t,
  theme,
  isActive,
}: {
  locale: Locale;
  t: Dictionary;
  theme: EvidenceTheme;
  isActive: boolean;
}) {
  const mark = trackMark(theme.track);

  return (
    <li
      className={cn(
        "rounded-(--radius-xl) border bg-surface p-5 transition-[border-color,box-shadow] sm:p-6",
        isActive
          ? "border-border-strong shadow-(--shadow-sm)"
          : "border-border shadow-none",
      )}
      style={
        isActive
          ? ({
              borderInlineStartWidth: "3px",
              borderInlineStartColor: mark,
            } as object)
          : undefined
      }
    >
      <div className="flex flex-col gap-1.5">
        <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-h4 font-semibold">
          {theme.label}
          <span className="text-[0.8125rem] font-normal text-foreground-subtle">
            {plural(
              theme.items.length,
              t.experience.evidence.itemCount,
              t.experience.evidence.itemCountPlural,
              { count: formatNumeral(theme.items.length, locale) },
            )}
          </span>
        </h3>
        <p className="max-w-[62ch] text-small text-foreground-muted">
          {theme.description}
        </p>
      </div>

      <ul
        aria-label={interpolate(t.experience.evidence.evidenceFor, {
          theme: theme.label,
        })}
        className="mt-4 grid gap-2 sm:grid-cols-2"
      >
        {theme.items.map((item) => (
          <li key={item.id}>
            <SmartLink
              href={item.href}
              className={cn(
                "group/evidence flex min-h-11 items-start gap-2.5 rounded-(--radius-md)",
                "border border-border bg-surface-muted/50 px-3 py-2.5 transition-colors",
                "hover:border-border-interactive hover:bg-surface-muted",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
              )}
            >
              <span
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-foreground-subtle"
                style={{ color: mark }}
              >
                <Icon name={KIND_ICONS[item.kind]} size={15} />
              </span>

              <span className="flex flex-col gap-0.5">
                <span className="text-small font-medium text-foreground group-hover/evidence:underline">
                  {item.label}
                </span>
                <span className="text-[0.75rem] text-foreground-subtle">
                  {/* The kind is named, not only iconised. */}
                  {t.experience.evidence.kinds[item.kind]}
                  {item.detail ? ` · ${item.detail}` : ""}
                </span>
              </span>
            </SmartLink>
          </li>
        ))}
      </ul>
    </li>
  );
}
