import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/ui/navigation";
import {
  Badge,
  Card,
  CardBody,
  ProseText,
  SectionHeading,
  SmartLink,
  Tag,
} from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { getSeoOverride } from "@/lib/data/site";
import { getExperiences } from "@/lib/data/cv";
import { langAttribute } from "@/lib/content/translation";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema, graph } from "@/lib/seo/jsonld";

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
  const override = await getSeoOverride("experience", locale);

  return buildPageMetadata({
    locale,
    path: "experience",
    title: override?.title ?? t.experience.title,
    description: override?.description ?? t.experience.description,
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    noIndex: override ? !override.isIndexable : false,
  });
}

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const experiences = await getExperiences(locale);

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.experience, url: absoluteUrl(localePath(locale, "experience")) },
    ]),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />

      <div className="container-content flex flex-col gap-8 py-10 sm:py-14">
        <Breadcrumbs
          items={[
            { label: t.nav.home, href: localePath(locale) },
            { label: t.nav.experience },
          ]}
          label={t.a11y.breadcrumb}
        />

        <SectionHeading
          headingLevel={1}
          title={t.experience.title}
          description={t.experience.description}
        />

        {experiences.length === 0 ? (
          <EmptyState icon="briefcase" title={t.experience.emptyState} />
        ) : (
          <ol className="flex flex-col gap-6">
            {experiences.map((entry) => {
              const contentLang = langAttribute(locale, entry.contentLocale);
              const kindLabel =
                t.experience.kind[entry.kind as keyof typeof t.experience.kind] ??
                entry.kind;

              return (
                <li key={entry.id}>
                  <Card as="article">
                    <CardBody className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        {entry.periodLabel ? (
                          <span className="font-mono text-[0.8125rem] text-foreground-muted">
                            {entry.periodLabel}
                          </span>
                        ) : null}

                        {entry.isCurrent ? (
                          <Badge tone="success">{t.experience.current}</Badge>
                        ) : null}

                        <Badge tone="neutral" icon="briefcase">
                          {kindLabel}
                        </Badge>
                      </div>

                      <h2 className="text-h3 font-semibold" lang={contentLang}>
                        {entry.roleTitle}
                      </h2>

                      <p className="text-body text-foreground-muted" lang={contentLang}>
                        {entry.organizationUrl ? (
                          <SmartLink
                            href={entry.organizationUrl}
                            newTabHint={t.a11y.opensInNewTab}
                            className="underline underline-offset-2 hover:decoration-2"
                          >
                            {entry.organization}
                          </SmartLink>
                        ) : (
                          entry.organization
                        )}

                        {entry.location ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-small">
                            <Icon name="mapPin" size={14} />
                            {entry.location}
                          </span>
                        ) : null}
                      </p>

                      {entry.description ? (
                        <ProseText text={entry.description} className="text-small" />
                      ) : entry.summary ? (
                        <ProseText text={entry.summary} className="text-small" />
                      ) : null}

                      {entry.achievements ? (
                        <div className="flex flex-col gap-1.5">
                          <h3 className="text-small font-semibold">
                            {t.experience.achievements}
                          </h3>
                          <ProseText
                            text={entry.achievements}
                            className="text-small"
                          />
                        </div>
                      ) : null}

                      {entry.tags.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5 pt-1">
                          {entry.tags.map((tag) => (
                            <li key={tag.id}>
                              <Tag>{tag.label}</Tag>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}
