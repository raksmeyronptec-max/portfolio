"use client";

import { useEffect } from "react";

const COUNTER_DURATION = 1_200;

function animateCounter(
  node: HTMLElement,
  end: number,
  delay: number,
  onComplete: () => void,
) {
  let frame = 0;
  let startTimestamp: number | null = null;

  const timer = window.setTimeout(() => {
    const step = (timestamp: number) => {
      startTimestamp ??= timestamp;
      const progress = Math.min(
        (timestamp - startTimestamp) / COUNTER_DURATION,
        1,
      );
      const eased = 1 - Math.pow(1 - progress, 3);

      node.textContent = String(Math.floor(eased * end));

      if (progress < 1) {
        frame = window.requestAnimationFrame(step);
      } else {
        node.textContent = String(end);
        onComplete();
      }
    };

    frame = window.requestAnimationFrame(step);
  }, delay);

  return () => {
    window.clearTimeout(timer);
    window.cancelAnimationFrame(frame);
  };
}

/**
 * One tiny client controller for motion that cannot be expressed in CSS:
 * viewport-triggered counters and releasing temporary compositor hints after
 * entrance animations finish. The hero's content remains server-rendered.
 */
export function HeroMotion() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>("[data-home-hero]");
    if (!hero) return;

    const animatedElements = Array.from(
      hero.querySelectorAll<HTMLElement>(
        "[data-hero-stagger], [data-badge-entrance]",
      ),
    );
    const animationCleanups = animatedElements.map((element) => {
      const handleEnd = (event: AnimationEvent) => {
        if (event.target === element) {
          element.dataset.animationComplete = "true";
        }
      };

      element.addEventListener("animationend", handleEnd);
      return () => element.removeEventListener("animationend", handleEnd);
    });

    // Hydration may finish after a fast entrance animation. This fallback
    // still releases every compositor layer once the longest delay has passed.
    const cleanupFallback = window.setTimeout(() => {
      animatedElements.forEach((element) => {
        element.dataset.animationComplete = "true";
      });
    }, 1_600);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const counterCleanups: Array<() => void> = [];
    let observer: IntersectionObserver | null = null;
    let setupTimer = 0;

    const setupCounters = () => {
      if (prefersReducedMotion) return;

      const metrics = hero.querySelector<HTMLElement>("[data-hero-metrics]");
      if (!metrics) return;

      const counters = Array.from(
        metrics.querySelectorAll<HTMLElement>("[data-count-to]"),
      );
      if (counters.length === 0) return;

      metrics.dataset.countReady = "true";
      counters.forEach((counter) => {
        counter.querySelector<HTMLElement>("[data-count-value]")!.textContent =
          "0";
      });

      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry?.isIntersecting) return;

          observer?.disconnect();
          metrics.dataset.counting = "true";

          counters.forEach((counter, index) => {
            const value = counter.querySelector<HTMLElement>(
              "[data-count-value]",
            );
            const suffix = counter.querySelector<HTMLElement>(
              "[data-count-suffix]",
            );
            const end = Number(counter.dataset.countTo);

            if (!value || !Number.isFinite(end)) return;

            counterCleanups.push(
              animateCounter(value, end, index * 100, () => {
                if (suffix) suffix.dataset.visible = "true";
              }),
            );
          });
        },
        { threshold: 0.2 },
      );

      observer.observe(metrics);
    };

    const scheduleCounters = () => {
      setupTimer = window.setTimeout(setupCounters, 0);
    };

    if (document.readyState === "complete") {
      scheduleCounters();
    } else {
      window.addEventListener("load", scheduleCounters, { once: true });
    }

    return () => {
      window.removeEventListener("load", scheduleCounters);
      window.clearTimeout(setupTimer);
      window.clearTimeout(cleanupFallback);
      observer?.disconnect();
      animationCleanups.forEach((cleanup) => cleanup());
      counterCleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  return null;
}
