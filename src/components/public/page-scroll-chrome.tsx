"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";

const SECTION_IDS = ["work", "background", "about", "contact"] as const;

/** Homepage-only progress, section spy, and return-to-top controls. */
export function PageScrollChrome({ backToTopLabel }: { backToTopLabel: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const progress = document.querySelector<HTMLElement>("[data-page-progress]");
    let frame = 0;
    let lastVisible = false;

    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progress?.style.setProperty("--page-progress", String(ratio));
      const nextVisible = window.scrollY > window.innerHeight;
      if (nextVisible !== lastVisible) {
        lastVisible = nextVisible;
        setVisible(nextVisible);
      }
      frame = 0;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });

    const sections = SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    const navTargets = new Map(
      SECTION_IDS.map((id) => [
        id,
        [...document.querySelectorAll<HTMLElement>(`[data-nav-key="${id}"]`)],
      ]),
    );
    const activate = (id: string) => {
      navTargets.forEach((targets, key) => {
        targets.forEach((target) => {
          const active = key === id;
          target.classList.toggle("active", active);
          if (active) target.dataset.scrollActive = "true";
          else delete target.dataset.scrollActive;
        });
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        const current = entries.find((entry) => entry.isIntersecting);
        if (current?.target.id) activate(current.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      navTargets.forEach((targets) =>
        targets.forEach((target) => {
          target.classList.remove("active");
          delete target.dataset.scrollActive;
        }),
      );
    };
  }, []);

  const scrollToTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <>
      <span className="progress-bar" data-page-progress aria-hidden="true" />
      <button
        type="button"
        className={`back-to-top${visible ? " visible" : ""}`}
        aria-label={backToTopLabel}
        onClick={scrollToTop}
      >
        <Icon name="chevronUp" size={16} aria-hidden />
      </button>
    </>
  );
}
