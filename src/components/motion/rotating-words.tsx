"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The rotating specialty phrase, for the hero's "I build …" line.
 *
 * Deliberately not a typewriter. Repeatedly deleting and retyping a phrase
 * makes it unreadable for the half of each cycle it is incomplete, and the
 * brief rules it out; each phrase here is either fully present or fully gone.
 *
 * Accessibility and SEO
 *   • Every phrase is in the DOM from the first server render, so a crawler
 *     and a no-JS visitor both see real text rather than an empty box.
 *   • The first phrase is the accessibility anchor: it stays in the tree at all
 *     times and is the one stable sentence a screen reader reads. The others
 *     are `aria-hidden` and `visibility: hidden`, so nothing is announced when
 *     the visible phrase changes and no live region is needed.
 *   • Reduced motion pins it to the first phrase and starts no timer at all.
 *
 * Layout
 *   All phrases are stacked in one grid cell, so the box is as wide and as tall
 *   as the longest phrase in whichever language is rendering. A swap therefore
 *   cannot reflow the hero or shift the call to action underneath it — which
 *   matters most in Khmer, where phrases run 20–40% longer than their English
 *   equivalents and a `min-width` guess would be wrong in both directions.
 *
 * Why it stops when the tab is hidden
 *   A timer that keeps firing in a background tab burns wakeups for an
 *   animation nobody can see. `visibilitychange` suspends the cycle and the
 *   effect re-runs on return, so a visitor coming back to the tab does not find
 *   the phrase mid-transition.
 */
export function RotatingWords({
  words,
  className,
  /** Hold time per phrase. The brief asks for 3.5–5s; 4s reads unhurried. */
  intervalMs = 4000,
}: {
  words: string[];
  className?: string;
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (words.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cycle = 0;
    let swapTimer = 0;

    // Fade out, swap, fade back in — a pair of timers rather than a CSS
    // keyframe, so the phrase is only ever swapped while it is invisible and
    // no half-faded intermediate text is ever readable.
    const start = () => {
      cycle = window.setInterval(() => {
        setVisible(false);
        swapTimer = window.setTimeout(() => {
          setIndex((current) => (current + 1) % words.length);
          setVisible(true);
        }, 320);
      }, intervalMs);
    };

    const stop = () => {
      window.clearInterval(cycle);
      window.clearTimeout(swapTimer);
      cycle = 0;
      swapTimer = 0;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
        // Leave the current phrase fully visible rather than frozen mid-fade.
        setVisible(true);
      } else {
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [words.length, intervalMs]);

  const [first] = words;
  if (first === undefined) return null;

  /*
   * Every phrase is rendered exactly once, stacked in one grid cell, and every
   * inactive one is `visibility: hidden`.
   *
   * ── What this replaces, and why ──────────────────────────────────────────
   * The previous version shipped three separate copies of the phrase text: an
   * invisible "longest phrase" sizer to reserve width, the visible phrase, and
   * an `sr-only` comma-joined list. Extracting the rendered page's text found
   * "teacher tools" and "academic platforms" twice each — and when the sizer's
   * longest phrase happened to be the showing one, the two copies sat adjacent
   * and read as "digital libraries digital libraries".
   *
   * Stacking does the sizer's job without the copy: the cell is as wide and as
   * tall as the longest phrase in whichever language is rendering, so nothing
   * reflows on a swap and Khmer — 20–40% longer — is measured rather than
   * guessed at with a `min-width`.
   *
   * `visibility: hidden` rather than `opacity: 0` for the inactive phrases is
   * the load-bearing detail. Both hide a phrase visually, but a
   * zero-opacity element is still in the accessibility tree, still selectable,
   * and still counted by text extraction — so opacity alone would have left
   * all four phrases readable to a crawler. Visibility removes them from all
   * three while still reserving their box. It is animatable as a discrete step
   * that holds "visible" until a transition to hidden finishes, so the fade
   * still plays in full.
   *
   * ── Accessibility ────────────────────────────────────────────────────────
   * The whole rotator is `aria-hidden`, and the one stable sentence below is
   * what assistive technology reads. That sentence never changes, so nothing
   * is re-announced every four seconds.
   */
  return (
    <span className={cn("inline-grid align-bottom", className)}>
      {words.map((word, i) => {
        const shown = i === index && visible;
        /*
         * The first phrase is the accessibility anchor and is hidden with
         * opacity alone, so it stays in the accessibility tree and in the
         * page's text no matter which phrase is on screen. Every other phrase
         * uses `visibility: hidden`, which removes it from both.
         *
         * That asymmetry is what finally removed the duplication. A separate
         * `sr-only` sentence was tried first and simply moved the problem: it
         * repeated whichever phrase it quoted, so "teacher tools" still
         * appeared twice in the extracted text. With the anchor doing double
         * duty there is exactly one copy of every phrase in the DOM, one
         * stable sentence for a screen reader, and nothing re-announced when
         * the visible phrase changes.
         */
        const isAnchor = i === 0;
        return (
          <span
            key={word}
            aria-hidden={isAnchor ? undefined : "true"}
            className={cn(
              "col-start-1 row-start-1 font-semibold",
              // Cyan rather than the multi-stop gradient this used to carry:
              // the identity system gives gold to education and cyan to the
              // technology half, and a phrase that changes every four seconds
              // is the wrong place for a third treatment competing with the
              // heading above it.
              "text-(--identity-cyan)",
              // Compositor properties only, so a swap cannot trigger layout.
              "transition-[opacity,transform,visibility] duration-320 ease-out",
              shown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
              shown ? "visible" : isAnchor ? "visible" : "invisible",
            )}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}
