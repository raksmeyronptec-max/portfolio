"use client";

import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Scroll-reveal wrapper.
 *
 * Three rules govern this component, all of them from the brief:
 *
 *   1. Content is never hidden behind an animation a visitor cannot trigger.
 *      The element renders *visible* on the server and on first paint. It is
 *      only switched to the hidden state inside an effect, which means a
 *      crawler, a no-JS visitor, or anyone whose browser fails to run this
 *      bundle sees the finished page rather than a blank section.
 *
 *   2. Reduced motion opts out entirely. The media query is checked before the
 *      element is ever hidden, so a reduced-motion visitor never sees the
 *      element disappear and reappear — it simply stays put. (The global
 *      `prefers-reduced-motion` rule in globals.css would collapse the
 *      transition anyway, but that would still cause one hidden frame.)
 *
 *   3. It reveals once and then stops observing. There is no scroll listener,
 *      no rAF loop, and the observer disconnects after firing.
 */
export function Reveal({
  as: Component = "div",
  delay = 0,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  /** Stagger in milliseconds. Applied via a CSS custom property. */
  delay?: number;
  className?: string;
  children: ReactNode;
  } & Record<string, unknown>) {
  const ref = useRef<HTMLElement | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  // `null` means "not yet evaluated", which is also the server state — the
  // element carries no data-reveal attribute at all and is therefore visible.
  const [state, setState] = useState<
    "pending" | "visible" | "complete" | null
  >(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    // Already on screen at mount (above the fold): show it without ever
    // hiding it, so the hero does not flash.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) {
      setState("visible");
      return;
    }

    setShouldAnimate(true);
    setState("pending");

    let completionTimer = 0;
    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== node) return;
      setState("complete");
      node.removeEventListener("transitionend", handleTransitionEnd);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.addEventListener("transitionend", handleTransitionEnd);
            setState("visible");
            observer.disconnect();
            completionTimer = window.setTimeout(
              () => setState("complete"),
              600 + delay,
            );
          }
        }
      },
      // Fires a little before the element reaches the viewport, so the motion
      // completes as it arrives rather than after it has already been read.
      { rootMargin: "0px 0px -40px 0px", threshold: 0.15 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(completionTimer);
      node.removeEventListener("transitionend", handleTransitionEnd);
    };
  }, [delay]);

  return (
    <Component
      ref={ref}
      className={cn("reveal", className)}
      data-reveal={state ?? undefined}
      data-reveal-animated={shouldAnimate ? "true" : undefined}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as object) : undefined}
      {...rest}
    >
      {children}
    </Component>
  );
}
