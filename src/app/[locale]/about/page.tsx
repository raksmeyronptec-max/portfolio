import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AboutChapters } from "@/components/public/about/chapters";
import { AboutClosing } from "@/components/public/about/closing";
import { AboutHero } from "@/components/public/about/hero";
import { AboutPractice } from "@/components/public/about/practice";
import { AboutPrinciplesFocus } from "@/components/public/about/principles-focus";
import { AboutPurpose } from "@/components/public/about/purpose";
import { AboutStory } from "@/components/public/about/story";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import {
  buildAboutChapters,
  buildAboutStory,
  buildCurrentFocus,
  orderPurposeProjects,
  type AboutChapterInput,
} from "@/lib/content/about-view";
import { getEducation, getExperiences } from "@/lib/data/cv";
import { getJourneyEntries } from "@/lib/data/journey";
import { listProjects } from "@/lib/data/projects";
import { hasPublishedPublications } from "@/lib/data/publications";
import { getActiveResume } from "@/lib/data/resume";
import {
  getOwnerProfile,
  getSeoOverride,
  getSiteSettings,
  getSocialLinks,
  getSpokenLanguages,
} from "@/lib/data/site";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  graph,
  personSchema,
  profilePageSchema,
  websiteSchema,
} from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/supabase/env";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};

  const locale: Locale = raw;
  const t = getDictionary(locale);
  const override = await getSeoOverride("about", locale);

  return buildPageMetadata({
    locale,
    path: "about",
    title: override?.title ?? t.about.seoTitle,
    description: override?.description ?? t.about.seoDescription,
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    type: "profile",
    noIndex: override ? !override.isIndexable : false,
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();

  const locale: Locale = raw;
  const t = getDictionary(locale);

  const [
    settings,
    profile,
    languages,
    education,
    experiences,
    journey,
    projectResult,
    socials,
    hasPublications,
    resume,
  ] = await Promise.all([
    getSiteSettings(locale),
    getOwnerProfile(locale),
    getSpokenLanguages(locale),
    getEducation(locale),
    getExperiences(locale),
    getJourneyEntries(locale),
    listProjects(locale, { page: 1, perPage: 12 }),
    getSocialLinks(locale),
    hasPublishedPublications(),
    getActiveResume(locale),
  ]);

  const name = locale === "km"
    ? settings.siteName
    : profile?.displayName ?? settings.siteName;
  const portrait = profile?.avatarUrl ?? "/image/portrait-keyed.webp";
  const currentStudies = education.filter((entry) => entry.isCurrent).slice(0, 2);
  const story = buildAboutStory({
    biography: profile?.bio ?? null,
    locale,
    education,
    experiences,
  });
  const journeyInputs: AboutChapterInput[] = journey.map((entry) => ({
    ...entry,
    categorySlug: entry.category?.slug ?? null,
  }));
  const chapters = buildAboutChapters({
    locale,
    journey: journeyInputs,
    education,
    experiences,
    currentStudiesTitle: t.about.chapters.currentStudiesTitle,
    undatedLabel: t.about.chapters.undated,
  });
  const projects = orderPurposeProjects(projectResult.items);
  const currentFocus = buildCurrentFocus({ locale, education, experiences });

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.about, url: absoluteUrl(localePath(locale, "about")) },
    ]),
    personSchema({
      locale,
      name,
      headline: profile?.headline ?? t.about.hero.identity,
      description: profile?.bio ?? settings.positioning,
      location: settings.location,
      imageUrl: absoluteUrl(portrait),
      email: settings.contactEmail,
      sameAs: socials
        .filter((social) => /^https?:\/\//i.test(social.url))
        .map((social) => social.url),
      knowsLanguage: languages.map((language) => language.code),
      alumniOf: education
        .filter((entry) => !entry.isCurrent)
        .map((entry) => ({ name: entry.institution, url: entry.institutionUrl })),
    }),
    websiteSchema({
      locale,
      name: settings.siteName,
      description: settings.tagline,
    }),
    profilePageSchema({
      locale,
      path: "about",
      name,
      description: profile?.bio ?? settings.positioning,
    }),
  ]);

  return (
    <article data-about-page className="about-v4">
      <JsonLd data={structuredData} />

      <AboutHero
        locale={locale}
        t={t}
        name={name}
        portrait={portrait}
        location={settings.location}
      />
      <AboutStory
        locale={locale}
        t={t}
        headline={profile?.headline ?? null}
        paragraphs={story}
        hasPublications={hasPublications}
      />
      <AboutPractice locale={locale} t={t} positioning={settings.positioning} />
      <AboutChapters locale={locale} t={t} chapters={chapters} />
      <AboutPurpose locale={locale} t={t} projects={projects} />
      <AboutPrinciplesFocus locale={locale} t={t} focus={currentFocus} />
      <AboutClosing
        locale={locale}
        t={t}
        settings={settings}
        studies={currentStudies}
        languages={languages}
        socials={socials}
        hasDownloadableResume={Boolean(resume)}
      />
    </article>
  );
}
