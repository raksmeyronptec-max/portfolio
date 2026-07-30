"use client";

import type { AnalyticsEvent } from "./events";

/**
 * Client-side analytics dispatch.
 *
 * Design choices:
 *  - Fire-and-forget. A failed analytics call must never surface to the user or
 *    block navigation, so every error is swallowed.
 *  - `navigator.sendBeacon` when available, so an event fired during an outbound
 *    click or a page unload still gets delivered. `fetch` with `keepalive` is the
 *    fallback.
 *  - Honours Do Not Track and Global Privacy Control. The brief asks for
 *    privacy-conscious analytics, and ignoring an explicit opt-out signal would
 *    not be that.
 *  - No identifier is attached here. The server derives a rotating visitor hash
 *    from request headers.
 */

function optedOut(): boolean {
  if (typeof navigator === "undefined") return true;

  const nav = navigator as Navigator & {
    doNotTrack?: string;
    globalPrivacyControl?: boolean;
    msDoNotTrack?: string;
  };

  if (nav.globalPrivacyControl === true) return true;
  if (nav.doNotTrack === "1" || nav.msDoNotTrack === "1") return true;
  if (
    typeof window !== "undefined" &&
    (window as Window & { doNotTrack?: string }).doNotTrack === "1"
  ) {
    return true;
  }

  return false;
}

const ENDPOINT = "/api/analytics";

export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  if (typeof window === "undefined") return;
  if (optedOut()) return;

  const payload = JSON.stringify({
    ...event,
    path: event.path ?? window.location.pathname,
  });

  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }

    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Intentionally silent.
  }
}

/**
 * Click handler for outbound links.
 *
 * Does NOT preventDefault or delay navigation. `sendBeacon` survives the page
 * transition, so the event does not need the user to wait — a tracker that adds
 * latency to a link is a tracker that should not exist.
 */
export function trackOutbound(event: AnalyticsEvent) {
  return () => {
    void trackEvent(event);
  };
}
