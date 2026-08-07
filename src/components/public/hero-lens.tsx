"use client";

import { useState } from "react";

import type { Locale } from "@/i18n/config";

type Lens = "educator" | "developer";

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
  const copy = COPY[locale][activeLens];
  const labels = LABELS[locale];

  return (
    <div className="home-hero-lens">
      <div className="home-hero-toggle" role="group" aria-label={labels.group}>
        <button
          type="button"
          aria-pressed={activeLens === "educator"}
          data-active={activeLens === "educator"}
          onClick={() => setActiveLens("educator")}
        >
          {labels.educator}
        </button>
        <button
          type="button"
          className="home-hero-toggle__developer"
          aria-pressed={activeLens === "developer"}
          data-active={activeLens === "developer"}
          onClick={() => setActiveLens("developer")}
        >
          {`<${labels.developer} />`}
        </button>
      </div>

      <div key={activeLens} className="home-hero-lens__copy">
        <h1>{copy.headline}</h1>
        <p>{copy.subheadline}</p>
      </div>
    </div>
  );
}
