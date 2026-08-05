import Image from "next/image";
import Link from "next/link";

import { interpolate, type Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";

export function AboutHero({
  locale,
  t,
  name,
  portrait,
  location,
}: {
  locale: Locale;
  t: Dictionary;
  name: string;
  portrait: string;
  location: string | null;
}) {
  return (
    <header
      data-about-section="hero"
      data-scheme="ink"
      className="about-v4-hero"
    >
      <div aria-hidden="true" className="about-v4-coordinate-grid" />
      <div className="container-content about-v4-hero-layout">
        <div data-about-hero-copy className="about-v4-hero-copy">
          <div className="about-v4-kicker about-v4-kicker-hero">
            <span aria-hidden="true">{t.about.hero.number}</span>
            <p>{t.about.hero.eyebrow}</p>
          </div>

          <h1>{t.about.hero.headline}</h1>
          <p className="about-v4-hero-intro">
            {interpolate(t.about.hero.introduction, { name })}
          </p>

          <div data-about-hero-actions className="about-v4-actions">
            <a href="#my-story" className="about-v4-button about-v4-button-primary">
              {t.about.hero.explore}
            </a>
            <Link
              href={localePath(locale, "resume")}
              className="about-v4-button about-v4-button-secondary"
            >
              {t.about.hero.resume}
            </Link>
            <Link href={localePath(locale, "contact")} className="about-v4-text-action">
              {t.about.hero.contact}
              <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="about-v4-focus-map" aria-label={t.about.hero.focus}>
            <p>{t.about.hero.focus}</p>
            <ul>
              {t.about.hero.signals.map((signal, index) => (
                <li key={signal}>
                  <span aria-hidden="true">0{index + 1}</span>
                  {signal}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <figure data-about-portrait className="about-v4-portrait">
          <div className="about-v4-portrait-frame">
            <div aria-hidden="true" className="about-v4-portrait-field" />
            <Image
              src={portrait}
              alt={t.about.portraitAlt}
              fill
              priority
              sizes="(min-width: 1280px) 31rem, (min-width: 1024px) 40vw, (min-width: 640px) 70vw, 92vw"
              className="about-v4-portrait-image"
            />
          </div>
          <figcaption>
            <strong>{name}</strong>
            <span>{t.about.hero.identity}</span>
            {location ? (
              <span>
                {t.about.hero.location} {location}
              </span>
            ) : null}
          </figcaption>
        </figure>
      </div>
    </header>
  );
}
