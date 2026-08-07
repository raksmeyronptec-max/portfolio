"use client";

import { useEffect, useRef, useState } from "react";

import type { Locale } from "@/i18n/config";

type Lens = "educator" | "developer";
type TransitionState =
  | { phase: "idle"; from: Lens; to: Lens }
  | { phase: "exit" | "enter" | "settle"; from: Lens; to: Lens };

const LENSES: Lens[] = ["educator", "developer"];

const COPY: Record<Locale, Record<Lens, { headline: string; subheadline: string }>> = {
  en: {
    educator: {
      headline: "Building tools that teachers actually use.",
      subheadline:
        "Full-stack product builder and mathematics educator based in Cambodia. I ship practical platforms for classrooms and academic institutions.",
    },
    developer: {
      headline: "Shipping full-stack platforms that scale.",
      subheadline:
        "Next.js, Supabase, PostgreSQL. I build bilingual academic systems used by real institutions — from digital libraries to classroom management tools.",
    },
  },
  km: {
    educator: {
      headline: "បង្កើតឧបករណ៍ដែលគ្រូបង្រៀនប្រើប្រាស់ពិតប្រាកដ។",
      subheadline:
        "អ្នកបង្កើតផលិតផល Full-stack និងជាអ្នកអប់រំគណិតវិទ្យានៅកម្ពុជា។ ខ្ញុំបង្កើតវេទិកាជាក់ស្តែងសម្រាប់ថ្នាក់រៀន និងស្ថាប័នសិក្សា។",
    },
    developer: {
      headline: "បង្កើតវេទិកា Full-stack ដែលអាចពង្រីកបាន។",
      subheadline:
        "Next.js, Supabase និង PostgreSQL។ ខ្ញុំបង្កើតប្រព័ន្ធសិក្សាពីរភាសាដែលស្ថាប័នពិតប្រាកដកំពុងប្រើប្រាស់ ចាប់ពីបណ្ណាល័យឌីជីថលដល់ឧបករណ៍គ្រប់គ្រងថ្នាក់រៀន។",
    },
  },
};

const LABELS: Record<Locale, Record<Lens, string> & { group: string }> = {
  en: { educator: "Educator", developer: "Developer", group: "Choose a professional lens" },
  km: { educator: "អ្នកអប់រំ", developer: "អ្នកអភិវឌ្ឍ", group: "ជ្រើសរើសទស្សនៈវិជ្ជាជីវៈ" },
};

export function HeroLens({ locale }: { locale: Locale }) {
  const [activeLens, setActiveLens] = useState<Lens>("educator");
  const [transition, setTransition] = useState<TransitionState>({
    phase: "idle",
    from: "educator",
    to: "educator",
  });
  const timers = useRef<number[]>([]);
  const labels = LABELS[locale];
  const selectedLens =
    transition.phase === "idle" ? activeLens : transition.to;

  useEffect(
    () => () => timers.current.forEach((timer) => window.clearTimeout(timer)),
    [],
  );

  function selectLens(nextLens: Lens) {
    if (nextLens === selectedLens || transition.phase !== "idle") return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActiveLens(nextLens);
      setTransition({ phase: "idle", from: nextLens, to: nextLens });
      return;
    }

    const from = activeLens;
    setTransition({ phase: "exit", from, to: nextLens });

    timers.current = [
      window.setTimeout(() => {
        setActiveLens(nextLens);
        setTransition({ phase: "enter", from, to: nextLens });
      }, 200),
      window.setTimeout(() => {
        setTransition({ phase: "settle", from, to: nextLens });
      }, 250),
      window.setTimeout(() => {
        setTransition({ phase: "idle", from: nextLens, to: nextLens });
        timers.current = [];
      }, 600),
    ];
  }

  function textState(lens: Lens) {
    if (transition.phase === "idle") {
      return lens === activeLens ? "active" : "inactive";
    }
    if (lens === transition.from) return "exit";
    if (lens === transition.to) {
      return transition.phase === "settle" ? "active" : "enter";
    }
    return "inactive";
  }

  return (
    <div className="home-hero-lens">
      <div
        className="home-hero-toggle hero-stagger hero-stagger--toggle"
        role="group"
        aria-label={labels.group}
        data-lens={selectedLens}
        data-hero-stagger
      >
        <button
          type="button"
          aria-pressed={selectedLens === "educator"}
          data-active={selectedLens === "educator"}
          onClick={() => selectLens("educator")}
        >
          {labels.educator}
        </button>
        <button
          type="button"
          className="home-hero-toggle__developer"
          aria-pressed={selectedLens === "developer"}
          data-active={selectedLens === "developer"}
          onClick={() => selectLens("developer")}
        >
          {`<${labels.developer} />`}
        </button>
      </div>

      <div className="home-hero-lens__copy" aria-live="polite">
        {LENSES.map((lens) => (
          <div
            key={lens}
            className={`toggle-text ${textState(lens)}`}
            aria-hidden={lens !== activeLens}
          >
            <h1
              className="hero-stagger hero-stagger--headline"
              data-hero-stagger
            >
              {COPY[locale][lens].headline}
            </h1>
            <p
              className="hero-stagger hero-stagger--subheadline"
              data-hero-stagger
            >
              {COPY[locale][lens].subheadline}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
