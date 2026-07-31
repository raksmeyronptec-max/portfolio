"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A slowly cross-fading word, used for the hero's "I build …" line.
 *
 * The brief asked for a rotating phrase but explicitly ruled out fast
 * typewriter effects that hurt readability, so this holds each word for a full
 * 2.6 seconds and cross-fades over 400ms. Nothing is ever partially typed.
 *
 * Accessibility and SEO:
 *   • Every word is present in the DOM from the first server render, inside a
 *     visually hidden list. Assistive technology and crawlers therefore receive
 *     the complete phrase set, not whichever word happened to be showing.
 *   • The animated element is `aria-hidden`, so a screen reader is never
 *     interrupted by a word swapping underneath it.
 *   • Reduced motion pins it to the first word — no timer is ever started.
 *
 * Layout: the widest word is rendered invisibly to reserve the line's width, so
 * the surrounding text does not reflow on each swap. That matters because this
 * sits inside the hero, where a reflow would shift the call-to-action buttons.
 */
export function RotatingWords({
  words,
  className,
  intervalMs = 2600,
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

    // Fade out, swap, fade back in — a pair of timers rather than a CSS
    // keyframe, so the word is only ever swapped while it is fully transparent.
    let swapTimer = 0;

    const cycle = window.setInterval(() => {
      setVisible(false);
      swapTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % words.length);
        setVisible(true);
      }, 400);
    }, intervalMs);

    return () => {
      window.clearInterval(cycle);
      window.clearTimeout(swapTimer);
    };
  }, [words.length, intervalMs]);

  const [first] = words;
  if (first === undefined) return null;

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), first);
  const current = words[index] ?? first;

  return (
    <span className={cn("relative inline-grid align-bottom", className)}>
      {/* Reserves the width of the longest word so nothing reflows. */}
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 whitespace-nowrap"
      >
        {longest}
      </span>

      {/* The animated word. Hidden from assistive tech; the list below is the
          accessible copy. */}
      <span
        aria-hidden="true"
        className={cn(
          "col-start-1 row-start-1 whitespace-nowrap text-gradient",
          "transition-opacity duration-400 ease-out",
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        {current}
      </span>

      {/* Server-rendered, always complete, never animated. */}
      <span className="sr-only">{words.join(", ")}</span>
    </span>
  );
}
