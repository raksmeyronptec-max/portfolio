import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Capabilities,
  CertificatesPreview,
  ContactCta,
  CredibilityStrip,
  FeaturedProjects,
  Hero,
  Journey,
  SelectedMoments,
  SelectedPublications,
  Testimonials,
} from "@/components/public/home-sections";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import {
  getOwnerProfile,
  getSeoOverride,
  getSiteCounts,
  getSiteSettings,
  getSocialLinks,
  getSpokenLanguages,
} from "@/lib/data/site";
import { DualIdentity } from "@/components/public/dual-identity";
import { FeaturedCaseStudy } from "@/components/public/featured-case-study";
import { ProjectEcosystem } from "@/components/public/project-ecosystem";
import { SystemMap } from "@/components/public/system-map";
import { getFeaturedProjects, getProjectBySlug } from "@/lib/data/projects";
import { getFeaturedCertificates } from "@/lib/data/certificates";
import { getFeaturedJourneyEntries } from "@/lib/data/journey";
import { getFeaturedPublications } from "@/lib/data/publications";
import {
  getCapabilityGroups,
  getEducation,
  getExperiences,
  getTestimonials,
} from "@/lib/data/cv";
import { buildPageMetadata, truncateDescription } from "@/lib/seo/metadata";
import {
  JsonLd,
  graph,
  personSchema,
  profilePageSchema,
  websiteSchema,
} from "@/lib/seo/jsonld";

/**
 * Homepage.
 *
 * ISR with a 5-minute window. Publishing from the admin also triggers an explicit
 * `revalidatePath`, so an edit appears immediately rather than after the window —
 * the window is only a backstop.
 */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;

  const [settings, override] = await Promise.all([
    getSiteSettings(locale),
    getSeoOverride("home", locale),
  ]);

  const title =
    override?.title ??
    `${settings.siteName} — ${settings.tagline ?? "Educator and Full-Stack Product Builder"}`;

  return buildPageMetadata({
    locale,
    path: "",
    title,
    description:
      override?.description ??
      truncateDescription(settings.heroSubheadline ?? settings.positioning, locale),
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    type: "profile",
    noIndex: override ? !override.isIndexable : false,
    suffixSiteName: false,
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);

  // Parallel fetch: these are independent reads and the page cannot render until
  // all of them resolve, so waterfalling them would only add latency.
  const [
    settings,
    profile,
    socialLinks,
    languages,
    counts,
    featuredProjects,
    featuredCertificates,
    capabilities,
    education,
    experiences,
    testimonials,
    featuredMoments,
    featuredPublications,
  ] = await Promise.all([
    getSiteSettings(locale),
    getOwnerProfile(locale),
    getSocialLinks(locale),
    getSpokenLanguages(locale),
    getSiteCounts(),
    getFeaturedProjects(locale, 3),
    getFeaturedCertificates(locale, 4),
    getCapabilityGroups(locale),
    getEducation(locale),
    getExperiences(locale),
    getTestimonials(locale),
    // Four to six, per section 15 of the brief. The homepage is a summary, not
    // the collection — the Journey page holds the rest.
    getFeaturedJourneyEntries(locale, 6),
    // Four at most — the section is a signal that these exist, not a catalogue.
    getFeaturedPublications(locale, 4),
  ]);

  const displayName = profile?.displayName ?? settings.siteName;

  /*
   * The flagship is whichever featured project the CMS sorts first — see
   * `FeaturedCaseStudy`. Fetched in a second round trip rather than in the
   * batch above because the slug is not known until the first batch resolves,
   * and the case study needs the full detail row (features, metrics, the long
   * prose fields) that the card select deliberately does not carry.
   */
  const flagship = featuredProjects[0]
    ? await getProjectBySlug(featuredProjects[0].slug, locale)
    : null;

  /*
   * The ecosystem section shows how the platforms relate, so it needs at least
   * two of them. With one project it would be a diagram of a single node.
   */
  const ecosystemProjects = featuredProjects.slice(0, 3);

  const structuredData = graph([
    personSchema({
      locale,
      name: displayName,
      headline: settings.tagline ?? profile?.headline,
      description: profile?.bio ?? settings.heroSubheadline,
      location: settings.location,
      imageUrl: absoluteUrl(profile?.avatarUrl ?? "/image/MyPF.jpg"),
      email: settings.contactEmail,
      sameAs: socialLinks
        .filter((link) => link.url.startsWith("http"))
        .map((link) => link.url),
      knowsLanguage: languages.map((language) => language.code),
      // Only institutions that exist as published education rows — never a
      // hardcoded list.
      alumniOf: education.map((entry) => ({
        name: entry.institution,
        url: entry.institutionUrl,
      })),
    }),
    websiteSchema({
      locale,
      name: settings.siteName,
      description: settings.tagline,
    }),
    profilePageSchema({
      locale,
      name: displayName,
      description: settings.heroSubheadline ?? settings.positioning,
    }),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />

      <Hero locale={locale} t={t} settings={settings} profile={profile} />

      <CredibilityStrip
        t={t}
        counts={counts}
        location={settings.location}
        languages={languages}
      />

      {/*
        Order below follows the brief's information architecture, and the
        reasoning behind it is that the page should answer questions in the
        order a stranger asks them:

          can he build?          the flagship, told end to end
          is it one system?      the ecosystem the three products form
          with what?             capabilities, grouped by outcome
          why him specifically?  the two practices, and what they do to
                                 each other
          says who?              roles, books, credentials, the record

        The remaining featured projects come after the case study rather than
        before it: leading with three equal cards asks the visitor to choose
        where to start, which is the thing the flagship exists to avoid.
      */}
      {flagship ? (
        <FeaturedCaseStudy project={flagship} locale={locale} t={t} />
      ) : null}

      <ProjectEcosystem projects={ecosystemProjects} locale={locale} t={t} />

      <FeaturedProjects locale={locale} t={t} projects={featuredProjects} />

      {/*
        Dual identity before Capabilities, not after: it frames the four
        capability groups as two practices, so the detailed section that
        follows is read as evidence for a claim rather than as a list.

        It replaces the old About preview outright. That block carried the same
        biography paragraph and the same "more about me" link, plus a facts list
        — location, languages, availability — that the hero's status line now
        states above the fold. Keeping both would have said everything twice.
      */}
      <DualIdentity
        locale={locale}
        t={t}
        groups={capabilities}
        settings={settings}
        profile={profile}
      />

      {/*
        The system map sits between the dual-identity claim and the capability
        list, because it is what connects them: the two practices above state
        that one person does both, this shows the route between them, and the
        capabilities below are the things that route requires.
      */}
      <SystemMap
        locale={locale}
        t={t}
        experiences={experiences}
        projects={featuredProjects}
        publications={featuredPublications}
      />

      <Capabilities locale={locale} t={t} groups={capabilities} />

      <Journey locale={locale} t={t} education={education} experiences={experiences} />

      {/*
        The books are the most durable evidence on the page — an authored
        mathematics collection is a harder claim than a list of roles — so they
        now sit directly after the record that establishes the roles, rather
        than trailing the page. Renders nothing when no publication is featured.
      */}
      <SelectedPublications locale={locale} t={t} publications={featuredPublications} />

      <CertificatesPreview locale={locale} t={t} certificates={featuredCertificates} />

      {/*
        Journey stories close the evidence run: the timeline states what the
        roles were, and these show what they looked like. Renders nothing when
        no story is featured.
      */}
      <SelectedMoments locale={locale} t={t} entries={featuredMoments} />

      <Testimonials locale={locale} t={t} testimonials={testimonials} />

      <ContactCta locale={locale} t={t} settings={settings} socialLinks={socialLinks} />
    </>
  );
}
