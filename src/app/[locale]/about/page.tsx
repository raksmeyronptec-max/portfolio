import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/ui/navigation";
import {
  Badge,
  Card,
  CardBody,
  MetaList,
  ProseText,
  SectionHeading,
} from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
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

      <div className="container-content flex flex-col gap-10 py-10 sm:py-14">
        <Breadcrumbs
          items={[
            { label: t.nav.home, href: localePath(locale) },
            { label: t.nav.about },
          ]}
          label={t.a11y.breadcrumb}
        />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-14">
          <div className="flex flex-col gap-6">
            <SectionHeading
              headingLevel={1}
              title={t.about.title}
              description={settings.positioning ?? undefined}
            />

            {profile?.bio ? <ProseText text={profile.bio} /> : null}
            {settings.heroSubheadline && !profile?.bio ? (
              <ProseText text={settings.heroSubheadline} />
            ) : null}

            {/* ── The two identities, stated explicitly ────────────────────── */}
            <section aria-labelledby="identities-heading" className="flex flex-col gap-4">
              <h2 id="identities-heading" className="text-h3 font-semibold">
                {t.about.twoIdentities}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardBody className="flex flex-col gap-2">
                    <span className="flex size-10 items-center justify-center rounded-[--radius-md] bg-secondary-subtle text-secondary-subtle-foreground">
                      <Icon name="graduation" size={20} />
                    </span>
                    <h3 className="text-h4 font-semibold">
                      {t.about.educationIdentity}
                    </h3>
                    <p className="text-small text-foreground-muted">
                      {t.experience.kind.teaching} · {t.education.kind.teacher_education} ·{" "}
                      {t.education.kind.university}
                    </p>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody className="flex flex-col gap-2">
                    <span className="flex size-10 items-center justify-center rounded-[--radius-md] bg-primary-subtle text-primary-subtle-foreground">
                      <Icon name="code" size={20} />
                    </span>
                    <h3 className="text-h4 font-semibold">
                      {t.about.technologyIdentity}
                    </h3>
                    <p className="text-small text-foreground-muted">
                      {t.projects.sections.architecture} · {t.about.capabilitiesHeading} ·{" "}
                      {t.projects.sections.accessibility}
                    </p>
                  </CardBody>
                </Card>
              </div>
            </section>
          </div>

          {/* ── Facts sidebar ────────────────────────────────────────────── */}
          <aside className="flex flex-col gap-6">
            {profile?.avatarUrl ? (
              <div className="relative aspect-[4/5] overflow-hidden rounded-[--radius-lg] border border-border bg-surface-muted">
                <Image
                  src={profile.avatarUrl}
                  alt={profile.displayName ?? settings.siteName}
                  fill
                  sizes="(min-width: 1024px) 24rem, 100vw"
                  priority
                  className="object-cover object-top"
                />
              </div>
            ) : null}

            <Card>
              <CardBody className="flex flex-col gap-4">
                <MetaList
                  items={[
                    {
                      label: t.about.locationHeading,
                      value: settings.location ?? profile?.location ?? undefined,
                    },
                  ]}
                />

                {languages.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-[0.8125rem] font-medium uppercase tracking-[0.04em] text-foreground-subtle">
                      {t.about.languagesHeading}
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {languages.map((language) => (
                        <li
                          key={language.id}
                          className="flex items-baseline justify-between gap-3 text-small"
                        >
                          <span>{language.name}</span>
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
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>

      <Capabilities locale={locale} t={t} groups={capabilities} />

      <Testimonials locale={locale} t={t} testimonials={testimonials} />
    </>
  );
}
