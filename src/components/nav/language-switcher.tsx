"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";

import { Icon } from "@/components/ui/icon";
import {
  localeMeta,
  locales,
  switchLocaleInPath,
  type Locale,
} from "@/i18n/config";
import { trackEvent } from "@/lib/analytics/track";
import { cn } from "@/lib/utils/cn";

/**
 * Language switcher.
 *
 * Real `<a>` elements pointing at the other locale's URL for the *current* page,
 * so switching language keeps the reader where they were and the alternate URL is
 * crawlable. v1 swapped text client-side, which meant Khmer content had no URL of
 * its own and search engines never saw it.
 *
 * Only two locales exist, so this renders as a segmented pair rather than a
 * dropdown: one fewer interaction, and the alternative is always visible.
 */
export function LanguageSwitcher({
  currentLocale,
  label,
  className,
  variant = "segmented",
}: {
  currentLocale: Locale;
  label: string;
  className?: string;
  variant?: "segmented" | "list";
}) {
  const pathname = usePathname();
  const router = useRouter();

  /**
   * Click handler.
   *
   * The query string is read from `window.location` here rather than via
   * `useSearchParams()`. `useSearchParams()` forces a client-side bailout during
   * static rendering, which would make this control — and therefore the whole
   * header — render as a Suspense fallback on first paint of every statically
   * generated page, crawlers included. Reading it at click time keeps the header
   * fully static while still preserving active filters when the reader switches
   * language on, say, a filtered project list. The plain `href` stays correct for
   * middle-click, copy-link and no-JS.
   */
  function handleSwitch(
    next: Locale,
    href: string,
    event: MouseEvent<HTMLAnchorElement>,
  ) {
    /*
     * The preference cookie is deliberately NOT written here.
     *
     * `withLocaleCookie` in middleware already persists whichever locale is
     * actually served, and it runs for this navigation too — including RSC
     * navigations, middle-clicks and no-JS follows, none of which reach this
     * handler. Writing it here as well would be a second writer for one value,
     * and the one that runs less often.
     */
    void trackEvent({
      name: "language_change",
      properties: { from: currentLocale, to: next },
    });

    const search = typeof window === "undefined" ? "" : window.location.search;

    // Only intercept when there is a query string worth preserving, and never
    // for modified clicks (open in new tab, download, middle-click).
    if (
      search &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      router.push(`${href}${search}`);
    }
  }

  if (variant === "list") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <p className="px-1 text-eyebrow font-semibold uppercase tracking-[0.08em] text-foreground-muted">
          {label}
        </p>

        {locales.map((locale) => {
          const isCurrent = locale === currentLocale;
          const href = switchLocaleInPath(pathname, locale);
          const meta = localeMeta[locale];

          return (
            <Link
              key={locale}
              href={href}
              hrefLang={meta.tag}
              lang={meta.tag}
              aria-current={isCurrent ? "true" : undefined}
              onClick={(event) => {
                if (!isCurrent) handleSwitch(locale, href, event);
              }}
              className={cn(
                "flex min-h-11 items-center justify-between gap-2 rounded-[--radius-md] px-3 text-base",
                isCurrent
                  ? "bg-primary-subtle font-medium text-primary-subtle-foreground"
                  : "text-foreground hover:bg-surface-muted",
              )}
            >
              <span>{meta.nativeName}</span>
              {isCurrent ? <Icon name="check" size={16} /> : null}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center rounded-[--radius-md] border border-border p-0.5",
        className,
      )}
      role="group"
      aria-label={label}
    >
      {locales.map((locale) => {
        const isCurrent = locale === currentLocale;
        const meta = localeMeta[locale];

        // The current locale is not a link: a self-link adds a pointless tab stop
        // and a redundant self-referencing URL.
        if (isCurrent) {
          return (
            <span
              key={locale}
              aria-current="true"
              lang={meta.tag}
              className="inline-flex min-h-9 items-center rounded-[--radius-sm] bg-primary px-2.5 text-[0.8125rem] font-semibold text-primary-foreground"
            >
              {meta.shortLabel}
            </span>
          );
        }

        const href = switchLocaleInPath(pathname, locale);

        return (
          <Link
            key={locale}
            href={href}
            hrefLang={meta.tag}
            lang={meta.tag}
            onClick={(event) => handleSwitch(locale, href, event)}
            className="inline-flex min-h-9 items-center rounded-[--radius-sm] px-2.5 text-[0.8125rem] font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {meta.shortLabel}
            <span className="sr-only"> — {meta.englishName}</span>
          </Link>
        );
      })}
    </div>
  );
}
