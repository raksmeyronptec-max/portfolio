import Link from "next/link";

import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import type { AboutFocusItem } from "@/lib/content/about-view";
import { langAttribute } from "@/lib/content/translation";

import { AboutSectionHeading } from "./section-heading";

export function AboutPrinciplesFocus({
  locale,
  t,
  focus,
}: {
  locale: Locale;
  t: Dictionary;
  focus: AboutFocusItem[];
}) {
  const kindLabel = (kind: AboutFocusItem["kind"]) => {
    if (kind === "study") return t.about.principlesFocus.study;
    if (kind === "product") return t.about.principlesFocus.product;
    return t.about.principlesFocus.practice;
  };

  return (
    <section
      data-about-section="principles-focus"
      aria-labelledby="about-principles-heading"
      className="about-v4-section about-v4-section-muted"
    >
      <div className="container-content">
        <AboutSectionHeading
          number={t.about.principlesFocus.number}
          eyebrow={t.about.principlesFocus.eyebrow}
          title={t.about.principlesFocus.heading}
          id="about-principles-heading"
        />

        <div className="about-v4-principles-layout">
          <ol className="about-v4-principles">
            {t.about.principlesFocus.principles.map((principle, index) => (
              <li key={principle.title} data-about-principle>
                <span aria-hidden="true">0{index + 1}</span>
                <div>
                  <h3>{principle.title}</h3>
                  <p>{principle.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {focus.length > 0 ? (
            <aside data-about-current-focus className="about-v4-current-focus">
              <p className="about-v4-focus-eyebrow">
                {t.about.principlesFocus.focusEyebrow}
              </p>
              <h3>{t.about.principlesFocus.focusHeading}</h3>
              <p>{t.about.principlesFocus.focusDescription}</p>
              <ul>
                {focus.map((item) => (
                  <li key={item.id}>
                    <div>
                      <span>{kindLabel(item.kind)}</span>
                      {item.period ? <time>{item.period}</time> : null}
                    </div>
                    <h4 lang={langAttribute(locale, item.contentLocale)}>{item.title}</h4>
                    {item.description ? (
                      <p lang={langAttribute(locale, item.contentLocale)}>
                        {item.description}
                      </p>
                    ) : null}
                    <Link href={item.href}>
                      {t.about.principlesFocus.related}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  );
}
