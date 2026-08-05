import Link from "next/link";

import type { Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";

import { AboutSectionHeading } from "./section-heading";

export function AboutPractice({
  locale,
  t,
  positioning,
}: {
  locale: Locale;
  t: Dictionary;
  positioning: string | null;
}) {
  return (
    <section
      data-about-section="practice"
      aria-labelledby="about-practice-heading"
      className="about-v4-section about-v4-section-muted"
    >
      <div className="container-content">
        <AboutSectionHeading
          number={t.about.practice.number}
          eyebrow={t.about.practice.eyebrow}
          title={t.about.practice.heading}
          description={t.about.practice.introduction}
          id="about-practice-heading"
        />

        <div className="about-v4-practice-layout">
          <article data-about-practice="education" className="about-v4-practice-path">
            <span aria-hidden="true" className="about-v4-path-rule about-v4-path-rule-gold" />
            <p className="about-v4-path-label">A</p>
            <h3>{t.about.practice.educationTitle}</h3>
            <p>{t.about.practice.educationBody}</p>
            <div className="about-v4-inline-links">
              <Link href={localePath(locale, "education")}>
                {t.about.practice.educationLink}
              </Link>
              <Link href={localePath(locale, "experience")}>
                {t.about.practice.experienceLink}
              </Link>
            </div>
          </article>

          <article data-about-practice="product" className="about-v4-practice-path">
            <span aria-hidden="true" className="about-v4-path-rule about-v4-path-rule-cyan" />
            <p className="about-v4-path-label">B</p>
            <h3>{t.about.practice.productTitle}</h3>
            <p>{t.about.practice.productBody}</p>
            <div className="about-v4-inline-links">
              <Link href={localePath(locale, "projects")}>
                {t.about.practice.projectsLink}
              </Link>
              <Link href={localePath(locale, "experience")}>
                {t.about.practice.experienceLink}
              </Link>
            </div>
          </article>

          <div
            data-about-practice="shared-purpose"
            className="about-v4-shared-purpose"
          >
            <span aria-hidden="true">×</span>
            <p>{t.about.practice.sharedLabel}</p>
            <strong>{positioning ?? t.about.practice.sharedBody}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
