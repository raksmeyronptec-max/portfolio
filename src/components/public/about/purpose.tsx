import Link from "next/link";

import type { Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import type { AboutProjectInput } from "@/lib/content/about-view";
import { langAttribute } from "@/lib/content/translation";

import { AboutSectionHeading } from "./section-heading";

export function AboutPurpose({
  locale,
  t,
  projects,
}: {
  locale: Locale;
  t: Dictionary;
  projects: AboutProjectInput[];
}) {
  return (
    <section
      data-about-section="purpose"
      data-scheme="ink"
      aria-labelledby="about-purpose-heading"
      className="about-v4-section about-v4-purpose-section"
    >
      <div className="container-content">
        <AboutSectionHeading
          number={t.about.purpose.number}
          eyebrow={t.about.purpose.eyebrow}
          title={t.about.purpose.heading}
          description={t.about.purpose.description}
          id="about-purpose-heading"
        />

        {projects.length > 0 ? (
          <div className="about-v4-purpose-list">
            {projects.map((project, index) => {
              const contentLang = langAttribute(locale, project.contentLocale);
              return (
                <article
                  key={project.id}
                  data-about-purpose-project
                  data-project-slug={project.slug}
                  className="about-v4-purpose-row"
                >
                  <div className="about-v4-purpose-number" aria-hidden="true">
                    0{index + 1}
                  </div>

                  <div className="about-v4-purpose-project">
                    {project.yearLabel ? <p>{project.yearLabel}</p> : null}
                    <h3 lang={contentLang}>{project.title}</h3>
                    {project.role ? (
                      <dl>
                        <div>
                          <dt>{t.about.purpose.role}</dt>
                          <dd lang={contentLang}>{project.role}</dd>
                        </div>
                      </dl>
                    ) : null}
                  </div>

                  <div className="about-v4-problem-response">
                    {project.problem ? (
                      <div>
                        <h4>{t.about.purpose.problem}</h4>
                        <p lang={contentLang}>{project.problem}</p>
                      </div>
                    ) : null}
                    {project.summary ? (
                      <div>
                        <h4>{t.about.purpose.response}</h4>
                        <p lang={contentLang}>{project.summary}</p>
                      </div>
                    ) : null}
                    <div className="about-v4-inline-links">
                      <Link href={localePath(locale, `projects/${project.slug}`)}>
                        {t.about.purpose.project}
                      </Link>
                      {project.liveUrl ? (
                        <a
                          href={project.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t.about.purpose.live}
                          <span aria-hidden="true">↗</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
