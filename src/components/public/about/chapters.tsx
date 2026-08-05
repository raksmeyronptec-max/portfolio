import Image from "next/image";
import Link from "next/link";

import { formatNumber, type Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import type { AboutChapterView } from "@/lib/content/about-view";
import { langAttribute } from "@/lib/content/translation";

import { AboutSectionHeading } from "./section-heading";

export function AboutChapters({
  locale,
  t,
  chapters,
}: {
  locale: Locale;
  t: Dictionary;
  chapters: AboutChapterView[];
}) {
  return (
    <section
      data-about-section="chapters"
      aria-labelledby="about-chapters-heading"
      className="about-v4-section"
    >
      <div className="container-content">
        <AboutSectionHeading
          number={t.about.chapters.number}
          eyebrow={t.about.chapters.eyebrow}
          title={t.about.chapters.heading}
          description={t.about.chapters.description}
          id="about-chapters-heading"
        />

        {chapters.length > 0 ? (
          <ol className="about-v4-chapters">
            {chapters.map((chapter, index) => (
              <li key={chapter.id} data-about-chapter className="about-v4-chapter">
                <div className="about-v4-chapter-index" aria-hidden="true">
                  {formatNumber(index + 1, locale)}
                </div>

                <article>
                  <h3
                    lang={
                      chapter.kind === "dual-study"
                        ? undefined
                        : langAttribute(locale, chapter.evidence[0].contentLocale)
                    }
                  >
                    {chapter.title}
                  </h3>

                  <div className="about-v4-chapter-evidence">
                    {chapter.evidence.map((evidence) => (
                      <div key={evidence.id}>
                        <p className="about-v4-chapter-period">{evidence.period}</p>
                        {chapter.kind === "dual-study" ? (
                          <h4 lang={langAttribute(locale, evidence.contentLocale)}>
                            {evidence.title}
                          </h4>
                        ) : null}
                        <p lang={langAttribute(locale, evidence.contentLocale)}>
                          {evidence.summary}
                        </p>
                        <Link href={evidence.href}>
                          {t.about.chapters.link}
                          <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    ))}
                  </div>
                </article>

                {chapter.cover ? (
                  <figure className="about-v4-chapter-image">
                    <Image
                      src={chapter.cover.src}
                      alt={chapter.cover.alt}
                      fill
                      sizes="(min-width: 1024px) 27vw, (min-width: 640px) 45vw, 92vw"
                      className="object-cover"
                      style={{ objectPosition: chapter.cover.objectPosition ?? "50% 50%" }}
                      placeholder={chapter.cover.blurDataURL ? "blur" : "empty"}
                      blurDataURL={chapter.cover.blurDataURL ?? undefined}
                    />
                  </figure>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
