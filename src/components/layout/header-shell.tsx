"use client";

import { useEffect } from "react";

/**
 * Scroll-state sync for the site header.
 *
 * Renders nothing. It finds the server-rendered `<header data-site-header>` and
 * flips two attributes on it as the page scrolls:
 *
 *   data-scrolled   "true" once past the opening band, which CSS uses to fade
 *                   in the blurred background and the bottom border.
 *   data-scheme     "ink" while at the top, so the header's controls resolve to
 *                   their light values over the dark hero; removed once the
 *                   header sits on the page background again.
 *
 * Why an effect that mutates the DOM rather than a client component that owns
 * the <header>:
 *
 *   The first version wrapped the whole header in a client component. That made
 *   the <header> element itself part of a client boundary, and on the
 *   `notFound()` render path Next then failed to render that boundary at all —
 *   the header's children appeared but its wrapper did not, and the response
 *   fell back to Next's built-in error document, `<html id="__next_error__">`
 *   with no `lang` and no `<title>`. axe caught it as two serious WCAG
 *   violations on every 404.
 *
 *   Keeping `<header>` server-rendered and touching only two attributes from an
 *   effect avoids the boundary entirely. The server already emits the correct
 *   initial state (a page always loads at scroll position 0), so there is no
 *   flash and nothing to hydrate.
 *
 * The listener is passive and only writes when the state actually changes, so
 * it does no work on the vast majority of scroll events.
 */
export function HeaderScrollSync() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    if (!header) return;

    // Slightly less than the header height, so the swap happens while the
    // opening band is still behind the bar rather than after a gap has opened.
    const threshold = 56;
    let scrolled: boolean | null = null;

    const read = () => {
      const next = window.scrollY > threshold;
      if (next === scrolled) return;
      scrolled = next;

      header.dataset.scrolled = next ? "true" : "false";
      if (next) {
        delete header.dataset.scheme;
      } else {
        header.dataset.scheme = "ink";
      }
    };

    // Covers landing part-way down the page via an anchor or a restored
    // scroll position.
    read();

    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, []);

  return null;
}
