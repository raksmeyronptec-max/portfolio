import Link from "next/link";

import type { Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { langAttribute } from "@/lib/content/translation";
import type { AboutText } from "@/lib/content/about-view";

import { AboutSectionHeading } from "./section-heading";

export function AboutStory({
  locale,
  t,
  headline,
  paragraphs,
  hasPublications,
}: {
  locale: Locale;
  t: Dictionary;
  headline: string | null;
  paragraphs: AboutText[];
  hasPublications: boolean;
}) {
  return (
    <section
      id="my-story"
      data-about-section="story"
      aria-labelledby="about-story-heading"
      className="about-v4-section"
    >
      <div className="container-content">
        <AboutSectionHeading
          number={t.about.story.number}
          eyebrow={t.about.story.eyebrow}
          title={t.about.story.heading}
          id="about-story-heading"
        />

        <div className="about-v4-story-layout">
          <p className="about-v4-story-opening">{headline ?? t.about.story.opening}</p>
          {paragraphs.length > 0 ? (
            <div data-about-biography className="about-v4-biography">
              {paragraphs.map((paragraph) => (
                <p
                  key={paragraph.id}
                  lang={langAttribute(locale, paragraph.contentLocale)}
                >
                  {paragraph.text}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <p className="about-v4-pull-statement">{t.about.story.statement}</p>

        <nav aria-label={t.about.story.evidence} className="about-v4-evidence-links">
          <span>{t.about.story.evidence}</span>
          <Link href={localePath(locale, "education")}>{t.about.story.education}</Link>
          <Link href={localePath(locale, "experience")}>
            {t.about.story.experience}
          </Link>
          {hasPublications ? (
            <Link href={localePath(locale, "publications")}>
              {t.about.story.publications}
            </Link>
          ) : null}
        </nav>
      </div>
    </section>
  );
}
