import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  AboutPreview,
  Capabilities,
  CertificatesPreview,
  ContactCta,
  CredibilityStrip,
  FeaturedProjects,
  Hero,
  Journey,
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
import { getFeaturedProjects } from "@/lib/data/projects";
import { getFeaturedCertificates } from "@/lib/data/certificates";
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
  ]);

  const displayName = profile?.displayName ?? settings.siteName;

  const structuredData = graph([
    personSchema({
      locale,
      name: displayName,
      headline: settings.tagline ?? profile?.headline,
      description: profile?.bio ?? settings.heroSubheadline,
      location: settings.location ?? profile?.location,
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

      <Hero
        locale={locale}
        t={t}
        settings={settings}
        profile={profile}
        languages={languages}
        socialLinks={socialLinks}
      />

      <CredibilityStrip t={t} counts={counts} />

      <FeaturedProjects locale={locale} t={t} projects={featuredProjects} />

      <AboutPreview
        locale={locale}
        t={t}
        settings={settings}
        profile={profile}
        languages={languages}
      />

      <Capabilities locale={locale} t={t} groups={capabilities} />

      <CertificatesPreview locale={locale} t={t} certificates={featuredCertificates} />

      <Journey locale={locale} t={t} education={education} experiences={experiences} />

      <Testimonials locale={locale} t={t} testimonials={testimonials} />

      <ContactCta locale={locale} t={t} settings={settings} socialLinks={socialLinks} />
    </>
  );
}
