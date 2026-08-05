import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getEducation, getExperiences } from "@/lib/data/cv";
import { getJourneyEntries } from "@/lib/data/journey";
import { listProjects } from "@/lib/data/projects";
import { getPublications } from "@/lib/data/publications";
import {
  getOwnerProfile,
  getSeoOverride,
  getSiteSettings,
  getSocialLinks,
  getSpokenLanguages,
} from "@/lib/data/site";
import { buildPageMetadata, truncateDescription } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema, graph, profilePageSchema } from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/supabase/env";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;
  const t = getDictionary(locale);
  const [override, profile, settings] = await Promise.all([
    getSeoOverride("about", locale),
    getOwnerProfile(locale),
    getSiteSettings(locale),
  ]);

  return buildPageMetadata({
    locale,
    path: "about",
    title: override?.title ?? `${t.about.title} ${profile?.displayName ?? settings.siteName} | ${t.about.positioningHeading}`,
    description: override?.description ?? truncateDescription(profile?.bio ?? t.about.heroLede, locale),
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    type: "profile",
    noIndex: override ? !override.isIndexable : false,
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = getDictionary(locale);

  const [settings, profile, languages, education, experiences, journey, projectResult, publicationResult, socials] = await Promise.all([
    getSiteSettings(locale), getOwnerProfile(locale), getSpokenLanguages(locale),
    getEducation(locale), getExperiences(locale), getJourneyEntries(locale),
    listProjects(locale, { page: 1, perPage: 12 }), getPublications(locale), getSocialLinks(locale),
  ]);
  const projects = projectResult.items.filter((project) =>
    ["krusmart", "ptec-digital-library", "ptec-storage"].includes(project.slug),
  );
  const publications = publicationResult.publications.slice(0, 3);
  const chapters = journey.slice(0, 5);
  const currentStudies = education.filter((entry) => entry.isCurrent);
  const educationEvidence = education.slice(0, 3);
  const educationPractice = experiences.filter((entry) => /teach|practic|tutor/i.test(`${entry.kind} ${entry.slug}`)).slice(0, 4);
  const productPractice = projects.slice(0, 4);
  const name = profile?.displayName ?? settings.siteName;

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.about, url: absoluteUrl(localePath(locale, "about")) },
    ]),
    profilePageSchema({ locale, path: "about", name, description: profile?.bio ?? t.about.heroLede }),
  ]);

  return (
    <article className="about-page">
      <JsonLd data={structuredData} />

      <header data-scheme="ink" className="about-hero decorated">
        <div aria-hidden="true" className="about-grid" />
        <div className="container-content relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.15fr_.85fr] lg:py-28">
          <div className="max-w-3xl">
            <p className="about-eyebrow">{t.about.eyebrow}</p>
            <h1 className="mt-5 text-[clamp(2.8rem,7vw,5.7rem)] font-bold leading-[.96] tracking-[-.055em] text-balance text-foreground">
              {t.about.heroHeadline}
            </h1>
            <p className="mt-7 max-w-[62ch] text-[clamp(1.05rem,1.6vw,1.3rem)] leading-relaxed text-foreground-muted">
              {t.about.heroLede}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#story" className="about-button about-button-primary">{t.about.exploreStory}</a>
              <Link href={localePath(locale, "resume")} className="about-button about-button-secondary">{t.about.viewResume}</Link>
              <Link href={localePath(locale, "contact")} className="about-text-link">{t.about.contact} <span aria-hidden="true">↗</span></Link>
            </div>
            {(settings.location ?? profile?.location) ? <p className="mt-8 text-sm text-foreground-subtle">{settings.location ?? profile?.location}</p> : null}
          </div>
          {profile?.avatarUrl ? (
            <figure className="about-portrait">
              <div className="relative aspect-[4/5] overflow-hidden bg-surface-muted">
                <Image src={profile.avatarUrl} alt={t.about.portraitAlt} fill priority sizes="(min-width: 1024px) 36vw, 90vw" className="object-cover object-top" />
              </div>
              <figcaption>{t.about.positioningHeading}</figcaption>
            </figure>
          ) : null}
        </div>
      </header>

      <section id="story" aria-labelledby="introduction-heading" className="about-section container-content">
        <SectionHeading eyebrow={t.about.introductionEyebrow} title={t.about.introductionHeading} id="introduction-heading" />
        <div className="mt-10 grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
          <p className="text-[clamp(1.35rem,2.5vw,2rem)] leading-snug text-foreground">{profile?.headline ?? t.about.positioningHeading}</p>
          <div className="about-prose"><p>{profile?.bio ?? t.about.introductionFallback}</p></div>
        </div>
        <p className="about-statement">{t.about.practiceConnection}</p>
      </section>

      {(educationPractice.length || productPractice.length) ? (
        <section aria-labelledby="practice-heading" className="about-section container-content">
          <SectionHeading eyebrow="01 — 02" title={t.about.twoIdentities} id="practice-heading" />
          <div className="mt-10 grid gap-px overflow-hidden rounded-3xl bg-border lg:grid-cols-2">
            <Practice title={t.about.educationPractice} items={educationPractice.map((item) => item.roleTitle)} tone="gold" />
            <Practice title={t.about.productPractice} items={productPractice.map((item) => item.title)} tone="cyan" />
          </div>
          <div className="about-purpose-line"><strong>{t.about.sharedPurpose}</strong><span>{t.about.sharedPurposeBody}</span></div>
        </section>
      ) : null}

      {chapters.length ? (
        <section aria-labelledby="chapters-heading" className="about-section container-content">
          <SectionHeading eyebrow={t.about.storyEyebrow} title={t.about.storyHeading} description={t.about.storyDescription} id="chapters-heading" />
          <ol className="about-timeline mt-12">
            {chapters.map((chapter) => <li key={chapter.id}>
              <p className="about-year">{chapter.periodLabel ?? chapter.year}</p>
              <div><h3>{chapter.title}</h3>{chapter.summary ? <p lang={chapter.contentLocale ?? undefined}>{chapter.summary}</p> : null}<Link href={localePath(locale, `/journey/${chapter.slug}`)}>{t.about.viewEvidence} <span aria-hidden="true">→</span></Link></div>
            </li>)}
          </ol>
        </section>
      ) : null}

      {projects.length ? (
        <section data-scheme="ink" aria-labelledby="purpose-heading" className="about-section decorated">
          <div className="container-content">
            <SectionHeading eyebrow={t.about.purposeEyebrow} title={t.about.purposeHeading} description={t.about.purposeDescription} id="purpose-heading" />
            <div className="mt-12 divide-y divide-border">
              {projects.map((project, index) => <div key={project.id} className="grid gap-5 py-8 md:grid-cols-[4rem_.7fr_1.3fr] md:py-10">
                <span className="about-project-number">0{index + 1}</span><h3 className="text-h3 text-foreground">{project.title}</h3>
                <div><p className="leading-relaxed text-foreground-muted">{project.problem ?? project.summary}</p><div className="mt-5 flex flex-wrap gap-5"><Link className="about-text-link" href={localePath(locale, `/projects/${project.slug}`)}>{t.about.projectDetail} →</Link>{project.liveUrl ? <a className="about-text-link" href={project.liveUrl} target="_blank" rel="noreferrer">{t.about.visitLive} ↗</a> : null}</div></div>
              </div>)}
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="principles-heading" className="about-section container-content">
        <SectionHeading eyebrow={t.about.principlesEyebrow} title={t.about.principlesHeading} id="principles-heading" />
        <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">{t.about.principles.map((principle, index) => <li key={principle.title} className="about-principle"><span>0{index + 1}</span><h3>{principle.title}</h3><p>{principle.body}</p></li>)}</ol>
      </section>

      <section aria-labelledby="studies-heading" className="about-section container-content">
        <SectionHeading eyebrow={t.about.studiesEyebrow} title={t.about.studiesHeading} id="studies-heading" />
        <div className="about-convergence mt-12">
          <div><span>01</span><h3>{t.about.teacherEducation}</h3><p>{t.about.teacherEducationBody}</p></div>
          <div><span>02</span><h3>{t.about.mathematics}</h3><p>{t.about.mathematicsBody}</p></div>
          <div><span>Σ</span><h3>{t.about.convergence}</h3><p>{t.about.convergenceBody}</p></div>
        </div>
      </section>

      {(educationEvidence.length || projects.length || publications.length) ? <section aria-labelledby="evidence-heading" className="about-section container-content">
        <SectionHeading eyebrow={t.about.evidenceEyebrow} title={t.about.evidenceHeading} id="evidence-heading" />
        <div className="about-evidence mt-10">
          <Evidence title={t.about.academicPractice} items={educationEvidence.map((item) => ({ id: item.id, title: item.qualification ?? item.fieldOfStudy ?? item.institution, detail: item.institution, href: localePath(locale, "education") }))} label={t.about.viewEvidence} />
          <Evidence title={t.about.productWork} items={projects.map((item) => ({ id: item.id, title: item.title, detail: item.summary, href: localePath(locale, `/projects/${item.slug}`) }))} label={t.about.viewEvidence} />
          <Evidence title={t.about.authoredWork} items={publications.map((item) => ({ id: item.id, title: item.title, detail: item.summary, href: item.href }))} label={t.about.viewEvidence} />
        </div>
      </section> : null}

      <section aria-labelledby="process-heading" className="about-section container-content">
        <SectionHeading eyebrow={t.about.processEyebrow} title={t.about.processHeading} id="process-heading" />
        <ol className="about-process mt-10">{t.about.process.map((step, index) => <li key={step.title}><span>0{index + 1}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
      </section>

      <section aria-labelledby="details-heading" className="about-section container-content">
        <SectionHeading eyebrow={t.about.detailsEyebrow} title={t.about.detailsHeading} id="details-heading" />
        <dl className="about-details mt-10">
          {(settings.location ?? profile?.location) ? <div><dt>{t.about.locationHeading}</dt><dd>{settings.location ?? profile?.location}</dd></div> : null}
          {currentStudies.length ? <div><dt>{t.about.currentStudies}</dt><dd>{currentStudies.map((item) => item.fieldOfStudy ?? item.qualification).filter(Boolean).join(" · ")}</dd></div> : null}
          <div><dt>{t.about.professionalFocus}</dt><dd>{t.about.professionalFocusValue}</dd></div>
          {languages.length ? <div><dt>{t.about.languagesHeading}</dt><dd>{languages.map((item) => `${item.name}${item.proficiency ? ` — ${item.proficiency}` : ""}`).join(" · ")}</dd></div> : null}
          {socials.length ? <div><dt>{t.about.contact}</dt><dd className="flex flex-wrap gap-x-5">{socials.map((social) => <a key={social.id} href={social.url} target={social.url.startsWith("http") ? "_blank" : undefined} rel={social.url.startsWith("http") ? "noreferrer" : undefined}>{social.handle ?? social.label}</a>)}</dd></div> : null}
        </dl>
      </section>

      <section data-scheme="ink" className="about-closing decorated">
        <div className="container-content py-20 text-center sm:py-28"><p className="about-eyebrow">{t.about.introductionEyebrow}</p><h2 className="mx-auto mt-5 max-w-4xl text-[clamp(2rem,5vw,4.2rem)] leading-tight tracking-[-.04em] text-foreground">{t.about.closingHeading}</h2><p className="mx-auto mt-6 max-w-2xl text-lg text-foreground-muted">{t.about.closingBody}</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href={localePath(locale, "contact")} className="about-button about-button-primary">{t.about.contact}</Link><Link href={localePath(locale, "projects")} className="about-button about-button-secondary">{t.about.viewWork}</Link></div></div>
      </section>
    </article>
  );
}

function SectionHeading({ eyebrow, title, description, id }: { eyebrow: string; title: string; description?: string; id: string }) { return <div className="max-w-3xl"><p className="about-eyebrow">{eyebrow}</p><h2 id={id} className="mt-4 text-[clamp(2rem,4vw,3.5rem)] leading-[1.05] tracking-[-.04em] text-foreground">{title}</h2>{description ? <p className="mt-5 max-w-[65ch] text-lg leading-relaxed text-foreground-muted">{description}</p> : null}</div>; }
function Practice({ title, items, tone }: { title: string; items: string[]; tone: "gold" | "cyan" }) { return <div className="about-practice bg-surface" data-tone={tone}><p>{title}</p><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }
function Evidence({ title, items, label }: { title: string; label: string; items: Array<{ id: string; title: string; detail: string | null; href: string }> }) { if (!items.length) return null; return <div><h3>{title}</h3><ul>{items.map((item) => <li key={item.id}><div><strong>{item.title}</strong>{item.detail ? <p>{item.detail}</p> : null}</div><Link href={item.href} aria-label={`${label}: ${item.title}`}>→</Link></li>)}</ul></div>; }
