import Link from "next/link";

import type { Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { readableSocialLabel } from "@/lib/content/about-view";
import { langAttribute } from "@/lib/content/translation";
import type { EducationEntry } from "@/lib/data/cv";
import type { SiteSettings, SocialLink, SpokenLanguage } from "@/lib/data/site";

import { AboutSectionHeading } from "./section-heading";

export function AboutClosing({
  locale,
  t,
  settings,
  studies,
  languages,
  socials,
  hasDownloadableResume,
}: {
  locale: Locale;
  t: Dictionary;
  settings: SiteSettings;
  studies: EducationEntry[];
  languages: SpokenLanguage[];
  socials: SocialLink[];
  hasDownloadableResume: boolean;
}) {
  return (
    <section
      data-about-section="closing"
      aria-labelledby="about-details-heading"
      className="about-v4-section about-v4-closing"
    >
      <div className="container-content">
        <AboutSectionHeading
          number={t.about.closing.number}
          eyebrow={t.about.closing.eyebrow}
          title={t.about.closing.detailsHeading}
          id="about-details-heading"
        />

        <div className="about-v4-closing-layout">
          <dl data-about-personal-details className="about-v4-details">
            {settings.location ? (
              <div>
                <dt>{t.about.closing.location}</dt>
                <dd>{settings.location}</dd>
              </div>
            ) : null}

            {studies.length > 0 ? (
              <div>
                <dt>{t.about.closing.studies}</dt>
                <dd>
                  <ul>
                    {studies.map((study) => (
                      <li key={study.id} lang={langAttribute(locale, study.contentLocale)}>
                        <strong>
                          {study.fieldOfStudy ?? study.qualification ?? study.institution}
                        </strong>
                        <span>{study.institution}</span>
                        {study.periodLabel ? <span>{study.periodLabel}</span> : null}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}

            <div>
              <dt>{t.about.closing.focus}</dt>
              <dd>{t.about.closing.focusValue}</dd>
            </div>

            {languages.length > 0 ? (
              <div>
                <dt>{t.about.closing.languages}</dt>
                <dd>
                  <ul className="about-v4-language-list">
                    {languages.map((language) => (
                      <li key={language.id}>
                        <strong>{language.name}</strong>
                        {language.proficiency ? <span>{language.proficiency}</span> : null}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}

            {settings.availabilityStatus ? (
              <div>
                <dt>{t.about.closing.availability}</dt>
                <dd>{settings.availabilityStatus}</dd>
              </div>
            ) : null}

            {socials.length > 0 ? (
              <div>
                <dt>{t.about.closing.contact}</dt>
                <dd>
                  <address>
                    <ul className="about-v4-contact-list">
                      {socials.map((social) => {
                        const external = /^https?:\/\//i.test(social.url);
                        return (
                          <li key={social.id}>
                            <span>{social.label}</span>
                            <a
                              href={social.url}
                              {...(external
                                ? { target: "_blank", rel: "noopener noreferrer" }
                                : {})}
                            >
                              {readableSocialLabel(social)}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </address>
                </dd>
              </div>
            ) : null}
          </dl>

          <div data-about-closing-cta data-scheme="ink" className="about-v4-cta">
            <p>{t.about.closing.ctaEyebrow}</p>
            <h2>{t.about.closing.heading}</h2>
            <p>{t.about.closing.body}</p>
            <div className="about-v4-actions">
              <Link
                href={localePath(locale, "contact")}
                className="about-v4-button about-v4-button-primary"
              >
                {t.about.closing.contactAction}
              </Link>
              <Link
                href={localePath(locale, "projects")}
                className="about-v4-button about-v4-button-secondary"
              >
                {t.about.closing.workAction}
              </Link>
              {hasDownloadableResume ? (
                <a
                  href={`/api/resume/download?locale=${locale}`}
                  className="about-v4-text-action"
                >
                  {t.about.closing.resumeAction}
                  <span aria-hidden="true">↓</span>
                </a>
              ) : (
                <Link
                  href={localePath(locale, "resume")}
                  className="about-v4-text-action"
                >
                  {t.about.hero.resume}
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
