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
 *   • Every phrase is in the DOM from the first server render, inside a
 *     visually hidden list. Assistive technology and crawlers get the complete
 *     set, not whichever phrase happened to be showing.
 *   • The animated element is `aria-hidden`, so a screen reader is never
 *     interrupted by text swapping underneath it, and there is no live region
 *     announcing a change every few seconds.
 *   • Reduced motion pins it to the first phrase and starts no timer at all.
 *
 * Layout
 *   The longest phrase is rendered invisibly in the same grid cell to reserve
 *   the line's width and height, so a swap can never reflow the hero or shift
 *   the call to action underneath it. Both the visible and the hidden copy sit
 *   in `col-start-1 row-start-1`, which is what makes the box the size of the
 *   longest phrase rather than the current one.
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

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), first);
  const current = words[index] ?? first;

  return (
    <span className={cn("relative inline-grid align-bottom", className)}>
      {/* Reserves the width and height of the longest phrase so nothing
          reflows. Khmer runs 20–40% longer than English, which is exactly why
          this is measured from the rendered strings rather than guessed at with
          a fixed `min-width`. */}
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 whitespace-nowrap"
      >
        {longest}
      </span>

      {/* The animated phrase. Hidden from assistive tech; the list below is the
          accessible copy.

          Cyan rather than the multi-stop gradient this used to carry: the
          identity system gives gold to education and cyan to the technology
          half, and a phrase that changes every four seconds is the wrong place
          for a third treatment competing with the heading above it. */}
      <span
        aria-hidden="true"
        className={cn(
          "col-start-1 row-start-1 whitespace-nowrap font-semibold",
          "text-(--identity-cyan)",
          // Transform and opacity only — both compositor properties, so the
          // swap cannot trigger layout.
          "transition-[opacity,transform] duration-320 ease-out",
          visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        )}
      >
        {current}
      </span>

      {/* Server-rendered, always complete, never animated. */}
      <span className="sr-only">{words.join(", ")}</span>
    </span>
  );
}
