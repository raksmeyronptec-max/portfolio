"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { trackEvent } from "@/lib/analytics/track";
import type { Locale } from "@/i18n/config";
import type { AnalyticsEvent } from "@/lib/analytics/events";

/**
 * Records a page view on mount and on every client-side navigation.
 *
 * Two details that matter:
 *
 *  - A ref guards against double-firing. React 19 Strict Mode runs effects twice
 *    in development, and without the guard every dev page view would be counted
 *    twice — which then quietly skews the numbers you use to make decisions.
 *
 *  - Entity-scoped views (a project or certificate page) pass the entity id, so
 *    the dashboard's "most viewed project" can join on it rather than parsing
 *    URLs. Pages that know their entity render the tracker with those props.
 */
export function PageViewTracker({
  locale,
  entityType,
  entityId,
  entitySlug,
  eventName = "page_view",
}: {
  locale: Locale;
  entityType?: AnalyticsEvent["entityType"];
  entityId?: string;
  entitySlug?: string;
  eventName?: AnalyticsEvent["name"];
}) {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    const key = `${eventName}:${pathname}`;
    if (lastTracked.current === key) return;
    lastTracked.current = key;

    void trackEvent({
      name: eventName,
      locale,
      path: pathname,
      entityType,
      entityId,
      entitySlug,
    });
  }, [pathname, locale, entityType, entityId, entitySlug, eventName]);

  return null;
}
