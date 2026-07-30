import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { Icon } from "./icon";

/* ═══════════════════════════════════════════════════════════════════════════
   Breadcrumbs, pagination and tabs. All server-rendered — none of these needs
   client JavaScript, which keeps public pages light.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Breadcrumbs ─────────────────────────────────────────────────────────────

export type Crumb = { label: string; href?: string };

/**
 * Breadcrumb trail.
 *
 * The final crumb is the current page: it is not a link, and carries
 * `aria-current="page"`. Separators are `aria-hidden` so the trail is not read
 * as "Home slash Projects slash".
 */
export function Breadcrumbs({
  items,
  label,
  className,
}: {
  items: readonly Crumb[];
  /** Accessible name for the nav landmark, localised. */
  label: string;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={label} className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.8125rem] text-foreground-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="rounded-[--radius-xs] underline decoration-transparent underline-offset-2 transition-colors hover:text-foreground hover:decoration-current"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="font-medium text-foreground"
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}

              {!isLast ? (
                <Icon
                  name="chevronRight"
                  size={13}
                  className="text-foreground-subtle"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────

/**
 * Link-based pagination.
 *
 * Uses real anchors so each page is crawlable and shareable, and so it works
 * without JavaScript. The current page is marked with `aria-current="page"`, and
 * disabled arrows are rendered as `<span>` rather than as links with
 * `aria-disabled`, because a disabled link is still focusable and confusing.
 */
export function Pagination({
  currentPage,
  totalPages,
  buildHref,
  labels,
  className,
}: {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
  labels: {
    nav: string;
    previous: string;
    next: string;
    /** Template containing {current} and {total}. */
    pageOf: string;
  };
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const pages = pageWindow(currentPage, totalPages);

  const arrowClasses =
    "inline-flex min-h-11 items-center gap-1.5 rounded-[--radius-md] border border-border px-3 text-small font-medium";

  return (
    <nav aria-label={labels.nav} className={cn("flex flex-col gap-3", className)}>
      <p className="text-center text-[0.8125rem] text-foreground-muted">
        {labels.pageOf
          .replace("{current}", String(currentPage))
          .replace("{total}", String(totalPages))}
      </p>

      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {hasPrevious ? (
            <Link
              href={buildHref(currentPage - 1)}
              rel="prev"
              className={cn(arrowClasses, "bg-surface hover:bg-surface-muted")}
            >
              <Icon name="chevronLeft" size={16} />
              {labels.previous}
            </Link>
          ) : (
            <span className={cn(arrowClasses, "opacity-45")}>
              <Icon name="chevronLeft" size={16} />
              {labels.previous}
            </span>
          )}
        </li>

        {pages.map((page, index) =>
          page === "gap" ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              className="px-1 text-foreground-subtle"
            >
              …
            </li>
          ) : (
            <li key={page}>
              <Link
                href={buildHref(page)}
                aria-current={page === currentPage ? "page" : undefined}
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-[--radius-md] border text-small font-medium",
                  page === currentPage
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface hover:bg-surface-muted",
                )}
              >
                {page}
              </Link>
            </li>
          ),
        )}

        <li>
          {hasNext ? (
            <Link
              href={buildHref(currentPage + 1)}
              rel="next"
              className={cn(arrowClasses, "bg-surface hover:bg-surface-muted")}
            >
              {labels.next}
              <Icon name="chevronRight" size={16} />
            </Link>
          ) : (
            <span className={cn(arrowClasses, "opacity-45")}>
              {labels.next}
              <Icon name="chevronRight" size={16} />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}

/** First, last, current and its neighbours; everything else collapses to a gap. */
function pageWindow(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];

  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && page - previous > 1) result.push("gap");
    result.push(page);
  });

  return result;
}

// ── Tabs (link-based) ───────────────────────────────────────────────────────

/**
 * Tab-styled navigation backed by real links.
 *
 * Deliberately NOT an ARIA tablist. A tablist implies client-side panel
 * switching with arrow-key navigation; these "tabs" change the URL, so
 * presenting them as navigation is both simpler and more honest. Screen-reader
 * users get a nav landmark and a normal link list.
 */
export function LinkTabs({
  items,
  label,
  className,
}: {
  items: ReadonlyArray<{ href: string; label: string; active: boolean; count?: number }>;
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("border-b border-border", className)}>
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 border-b-2 px-3 py-2 text-small font-medium transition-colors",
                item.active
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground-muted hover:border-border-strong hover:text-foreground",
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span
                  className={cn(
                    "rounded-[--radius-full] px-1.5 py-0.5 text-[0.75rem] tabular-nums",
                    item.active
                      ? "bg-primary-subtle text-primary-subtle-foreground"
                      : "bg-surface-muted text-foreground-muted",
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── In-page table of contents ───────────────────────────────────────────────

/**
 * Case-study section index. Anchors, so it works with JS disabled, and
 * `scroll-padding-top` in globals.css keeps targets clear of the sticky header.
 */
export function TableOfContents({
  heading,
  items,
  className,
}: {
  heading: string;
  items: ReadonlyArray<{ id: string; label: string }>;
  className?: string;
}) {
  if (items.length < 3) return null;

  return (
    <nav aria-labelledby="toc-heading" className={className}>
      <p
        id="toc-heading"
        className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-foreground-muted"
      >
        {heading}
      </p>
      <ul className="mt-3 flex flex-col gap-1.5 border-l border-border">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-small text-foreground-muted transition-colors hover:border-primary hover:text-foreground"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Data table ──────────────────────────────────────────────────────────────

/**
 * Admin data table primitives.
 *
 * A real `<table>` with `<caption>`, `<th scope>` and a horizontal scroll
 * container that is focusable (`tabIndex={0}`) so keyboard users can scroll it —
 * an overflow container that only responds to a mouse is a common a11y failure.
 */
export function DataTable({
  caption,
  captionVisible = false,
  className,
  children,
}: {
  caption: string;
  captionVisible?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={caption}
      className={cn(
        "overflow-x-auto rounded-[--radius-lg] border border-border bg-surface",
        className,
      )}
    >
      <table className="w-full border-collapse text-small">
        <caption
          className={cn(
            "px-4 py-3 text-start text-small text-foreground-muted",
            !captionVisible && "sr-only",
          )}
        >
          {caption}
        </caption>
        {children}
      </table>
    </div>
  );
}

export function Th({
  className,
  children,
  scope = "col",
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <th
      scope={scope}
      className={cn(
        "border-b border-border bg-surface-muted px-4 py-3 text-start font-semibold text-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({
  className,
  children,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <td
      className={cn("border-b border-border px-4 py-3 align-middle", className)}
      {...rest}
    >
      {children}
    </td>
  );
}
