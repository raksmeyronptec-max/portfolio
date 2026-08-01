"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { trackEvent } from "@/lib/analytics/track";
import type { AnalyticsEventName } from "@/lib/analytics/events";
import type { Locale } from "@/i18n/config";

/**
 * An internal link that records a click.
 *
 * `OutboundLink` exists for links that leave the site and always renders
 * `target="_blank"` with `rel="noopener noreferrer"`. Neither is right for
 * navigation *within* the site: opening another page of the same portfolio in a
 * new tab is disorienting, and it also discards the client-side route transition
 * that makes those navigations fast.
 *
 * So this is the internal counterpart — a real `next/link`, with `sendBeacon`
 * firing alongside the navigation rather than before it. Nothing is
 * preventDefault-ed and nothing is delayed: a tracker that makes the user wait
 * for it is a tracker that should be removed.
 *
 * What is sent: the event name, the locale, and the slug of the page the visitor
 * left. Never the destination's identifiers beyond that, and never anything about
 * the visitor — the server derives its rotating hash from request headers.
 */
export function TrackedInternalLink({
  href,
  locale,
  entrySlug,
  eventName,
  className,
  children,
}: {
  href: string;
  locale: Locale;
  /** Slug of the page the click originated from. */
  entrySlug: string;
  eventName: AnalyticsEventName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        void trackEvent({
          name: eventName,
          locale,
          entityType: "journey",
          entitySlug: entrySlug,
        });
      }}
      className={className}
    >
      {children}
    </Link>
  );
}
