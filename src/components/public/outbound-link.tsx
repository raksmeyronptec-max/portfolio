"use client";

import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { trackEvent } from "@/lib/analytics/track";
import type { AnalyticsEvent } from "@/lib/analytics/events";

/**
 * External link that records a click.
 *
 * Does not preventDefault and does not delay navigation: `trackEvent` uses
 * `navigator.sendBeacon`, which survives the page transition. A tracker that makes
 * the user wait for it is a tracker that should be removed.
 *
 * `rel="noopener noreferrer"` is always applied — `noopener` so the destination
 * cannot reach back through `window.opener`, `noreferrer` so our URL is not
 * disclosed in the referrer.
 */
export function OutboundLink({
  href,
  event,
  newTabHint,
  showIcon = false,
  className,
  children,
}: {
  href: string;
  event: AnalyticsEvent;
  /** Screen-reader hint, e.g. "opens in a new tab". */
  newTabHint?: string;
  showIcon?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const isProtocolLink = /^(mailto:|tel:)/i.test(href);

  return (
    <a
      href={href}
      // mailto:/tel: must not open a new tab — it leaves an empty tab behind.
      {...(isProtocolLink ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      onClick={() => {
        void trackEvent(event);
      }}
      className={className}
    >
      {children}
      {showIcon ? (
        <Icon name="externalLink" size={14} className="ml-1 inline align-[-0.1em]" />
      ) : null}
      {!isProtocolLink && newTabHint ? (
        <span className="sr-only"> ({newTabHint})</span>
      ) : null}
    </a>
  );
}
