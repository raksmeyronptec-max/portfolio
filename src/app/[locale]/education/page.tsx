import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Badge,
  Card,
  CardBody,
  MetaList,
  ProseText,
  SmartLink,
} from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { getSeoOverride, getSpokenLanguages } from "@/lib/data/site";
import { getEducation } from "@/lib/data/cv";
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
  const override = await getSeoOverride("education", locale);

  return buildPageMetadata({
    locale,
    path: "education",
    title: override?.title ?? t.education.title,
    description: override?.description ?? t.education.description,
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    noIndex: override ? !override.isIndexable : false,
  });
}

export default async function EducationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const [education, languages] = await Promise.all([
    getEducation(locale),
    getSpokenLanguages(locale),
  ]);

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.education, url: absoluteUrl(localePath(locale, "education")) },
    ]),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />

      <PageHeader
        title={t.education.title}
        description={t.education.description}
        eyebrow={t.nav.education}
        breadcrumbs={[
          { label: t.nav.home, href: localePath(locale) },
          { label: t.nav.education },
        ]}
        breadcrumbLabel={t.a11y.breadcrumb}
        watermark="∑"
      />

      <div className="container-content flex flex-col gap-8 py-14 sm:py-16">
        {education.length === 0 ? (
          <EmptyState icon="graduation" title={t.education.emptyState} />
        ) : (
          <ol className="flex flex-col gap-6">
            {education.map((entry) => {
              const contentLang = langAttribute(locale, entry.contentLocale);
              const kindLabel =
                t.education.kind[entry.kind as keyof typeof t.education.kind] ??
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
                          <Badge tone="success">{t.education.current}</Badge>
                        ) : null}

                        <Badge tone="neutral" icon="graduation">
                          {kindLabel}
                        </Badge>
                      </div>

                      <h2 className="text-h3 font-semibold" lang={contentLang}>
                        {entry.institutionUrl ? (
                          <SmartLink
                            href={entry.institutionUrl}
                            newTabHint={t.a11y.opensInNewTab}
                            className="underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
                          >
                            {entry.institution}
                          </SmartLink>
                        ) : (
                          entry.institution
                        )}
                      </h2>

                      <MetaList
                        items={[
                          {
                            label: t.education.qualification,
                            value: entry.qualification ?? undefined,
                          },
                          {
                            label: t.education.fieldOfStudy,
                            value: entry.fieldOfStudy ?? undefined,
                          },
                          {
                            label: t.education.schedule,
                            value: entry.scheduleLabel ?? undefined,
                          },
                          {
                            /*
                             * A grade is only ever rendered together with its
                             * scale. v1 printed "3.79" and "A" as bare numbers,
                             * which is meaningless without knowing the scale — and
                             * in the 3.79 case, without knowing which institution
                             * awarded it.
                             */
                            label: t.education.grade,
                            value:
                              entry.gradeValue && entry.gradeScale
                                ? `${entry.gradeValue} — ${entry.gradeScale}`
                                : undefined,
                          },
                        ]}
                      />

                      {entry.description ? (
                        <ProseText text={entry.description} className="text-small" />
                      ) : null}

                      {entry.achievements ? (
                        <ProseText text={entry.achievements} className="text-small" />
                      ) : null}
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}

        {/* ── Languages ────────────────────────────────────────────────────── */}
        {languages.length > 0 ? (
          <section aria-labelledby="languages-heading" className="flex flex-col gap-3">
            <h2 id="languages-heading" className="text-h3 font-semibold">
              {t.about.languagesHeading}
            </h2>

            <ul className="grid gap-3 sm:grid-cols-3">
              {languages.map((language) => (
                <li key={language.id}>
                  <Card>
                    <CardBody className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{language.name}</span>
                      <Badge tone={language.isNative ? "secondary" : "neutral"}>
                        {language.proficiency}
                      </Badge>
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
