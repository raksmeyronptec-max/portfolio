import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Badge, ProseText } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/layout/page-header";
import { Capabilities, Testimonials } from "@/components/public/home-sections";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import {
  getOwnerProfile,
  getSeoOverride,
  getSiteSettings,
  getSpokenLanguages,
} from "@/lib/data/site";
import { getCapabilityGroups, getTestimonials } from "@/lib/data/cv";
import { buildPageMetadata, truncateDescription } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema, graph, profilePageSchema } from "@/lib/seo/jsonld";

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
  const [override, profile, settings] = await Promise.all([
    getSeoOverride("about", locale),
    getOwnerProfile(locale),
    getSiteSettings(locale),
  ]);

  return buildPageMetadata({
    locale,
    path: "about",
    title: override?.title ?? `${t.about.title} — ${settings.siteName}`,
    description:
      override?.description ?? truncateDescription(profile?.bio ?? settings.positioning, locale),
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

  const [settings, profile, languages, capabilities, testimonials] = await Promise.all([
    getSiteSettings(locale),
    getOwnerProfile(locale),
    getSpokenLanguages(locale),
    getCapabilityGroups(locale),
    getTestimonials(locale),
  ]);

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.about, url: absoluteUrl(localePath(locale, "about")) },
    ]),
    profilePageSchema({
      locale,
      path: "about",
      name: profile?.displayName ?? settings.siteName,
      description: profile?.bio ?? settings.positioning,
    }),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />

      <PageHeader
        title={t.about.title}
        description={settings.positioning ?? undefined}
        eyebrow={t.home.about.eyebrow}
        breadcrumbs={[
          { label: t.nav.home, href: localePath(locale) },
          { label: t.nav.about },
        ]}
        breadcrumbLabel={t.a11y.breadcrumb}
        watermark="Σ"
      />

      <div className="container-content py-14 sm:py-16">
        {/*
          Story first, portrait alongside. v2 opened with a heading and then put
          the portrait in a bordered box in a sidebar under a facts card; the
          brief asked for a personal story with the portrait still important, and
          without the grid of boxed capability cards that followed it.
        */}
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16">
          <div className="flex flex-col gap-8">
            {profile?.bio ? <ProseText text={profile.bio} /> : null}
            {settings.heroSubheadline && !profile?.bio ? (
              <ProseText text={settings.heroSubheadline} />
            ) : null}

            {/* ── The two identities, stated explicitly ────────────────────
                Now two rows on a hairline rather than two bordered cards, so
                the section reads as part of the story instead of as a widget. */}
            <section aria-labelledby="identities-heading" className="flex flex-col gap-5">
              <h2 id="identities-heading" className="text-h3">
                {t.about.twoIdentities}
              </h2>

              <ul className="flex flex-col">
                {[
                  {
                    key: "education",
                    icon: "graduation" as const,
                    tone: "bg-secondary-subtle text-secondary-subtle-foreground",
                    title: t.about.educationIdentity,
                    detail: [
                      t.experience.kind.teaching,
                      t.education.kind.teacher_education,
                      t.education.kind.university,
                    ].join(" · "),
                  },
                  {
                    key: "technology",
                    icon: "code" as const,
                    tone: "bg-primary-subtle text-primary-subtle-foreground",
                    title: t.about.technologyIdentity,
                    detail: [
                      t.projects.sections.architecture,
                      t.about.capabilitiesHeading,
                      t.projects.sections.accessibility,
                    ].join(" · "),
                  },
                ].map((identity) => (
                  <li
                    key={identity.key}
                    className="flex items-start gap-4 border-b border-border py-5 first:border-t"
                  >
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-(--radius-md) ${identity.tone}`}
                    >
                      <Icon name={identity.icon} size={20} />
                    </span>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-h4 font-semibold">{identity.title}</h3>
                      <p className="text-small text-foreground-muted">{identity.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* ── Portrait and facts ───────────────────────────────────────── */}
          <aside className="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
            {profile?.avatarUrl ? (
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-5 -z-10 rounded-full opacity-45 blur-2xl"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 40%, rgb(var(--glow-primary) / 0.45), transparent 70%)",
                  }}
                />
                <div
                  className="rounded-[2rem] p-px"
                  style={{
                    background:
                      "linear-gradient(150deg, rgb(var(--glow-primary) / 0.55), rgb(var(--glow-accent) / 0.4))",
                  }}
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[calc(2rem-1px)] bg-surface-muted">
                    <Image
                      src={profile.avatarUrl}
                      alt={profile.displayName ?? settings.siteName}
                      fill
                      sizes="(min-width: 1024px) 24rem, 100vw"
                      priority
                      className="object-cover object-top"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <dl className="flex flex-col">
              {settings.location ?? profile?.location ? (
                <div className="flex flex-col gap-1 border-b border-border py-4 first:border-t">
                  <dt className="text-[0.8125rem] font-medium uppercase tracking-wide text-foreground-subtle">
                    {t.about.locationHeading}
                  </dt>
                  <dd className="text-body font-medium">
                    {settings.location ?? profile?.location}
                  </dd>
                </div>
              ) : null}

              {languages.length > 0 ? (
                <div className="flex flex-col gap-2.5 border-b border-border py-4">
                  <dt className="text-[0.8125rem] font-medium uppercase tracking-wide text-foreground-subtle">
                    {t.about.languagesHeading}
                  </dt>
                  <dd>
                    <ul className="flex flex-col gap-2">
                      {languages.map((language) => (
                        <li
                          key={language.id}
                          className="flex items-baseline justify-between gap-3 text-small"
                        >
                          <span className="font-medium">{language.name}</span>
                          {/*
                            A written proficiency label, not a bar. "French A1"
                            is information; "French 40%" is not.
                          */}
                          <Badge tone={language.isNative ? "secondary" : "neutral"}>
                            {language.proficiency}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>
        </div>
      </div>

      <Capabilities locale={locale} t={t} groups={capabilities} />

      <Testimonials locale={locale} t={t} testimonials={testimonials} />
    </>
  );
}
