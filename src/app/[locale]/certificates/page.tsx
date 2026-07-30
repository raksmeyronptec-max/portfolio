import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs, Pagination } from "@/components/ui/navigation";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/primitives";
import { EmptyState, Notice } from "@/components/ui/states";
import { CertificateCard } from "@/components/public/certificate-card";
import { getDictionary, plural } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { getSeoOverride } from "@/lib/data/site";
import {
  getCertificateCategories,
  getCertificateFacets,
  listCertificates,
} from "@/lib/data/certificates";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema, graph, itemListSchema } from "@/lib/seo/jsonld";
import { cn } from "@/lib/utils/cn";

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
  const override = await getSeoOverride("certificates", locale);

  return buildPageMetadata({
    locale,
    path: "certificates",
    title: override?.title ?? t.certificates.title,
    description: override?.description ?? t.certificates.description,
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    noIndex: override ? !override.isIndexable : false,
  });
}

export default async function CertificatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale: raw }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);

  const category = single(query.category) ?? "";
  const issuer = single(query.issuer) ?? "";
  const yearParam = Number.parseInt(single(query.year) ?? "", 10);
  const year = Number.isFinite(yearParam) ? yearParam : undefined;
  const page = toPositiveInt(single(query.page), 1);

  const [result, categories, facets] = await Promise.all([
    listCertificates(locale, {
      category: category || undefined,
      issuer: issuer || undefined,
      year,
      page,
      perPage: 12,
    }),
    getCertificateCategories(locale),
    getCertificateFacets(),
  ]);

  const resultLabel = plural(
    result.total,
    t.certificates.resultCount,
    t.certificates.resultCountPlural,
  );

  const hasFilters = Boolean(category || issuer || year);

  // Only offer a category chip when it can actually return something.
  const availableCategories = categories.filter((item) =>
    result.total > 0 || category === item.slug
      ? true
      : // Keep all categories visible when nothing is filtered, so the taxonomy
        // is discoverable even before credentials are added.
        !hasFilters,
  );

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      {
        name: t.nav.certificates,
        url: absoluteUrl(localePath(locale, "certificates")),
      },
    ]),
    itemListSchema({
      name: t.certificates.title,
      items: result.items.map((certificate) => ({
        name: certificate.title,
        url: absoluteUrl(localePath(locale, `certificates/${certificate.slug}`)),
      })),
    }),
  ]);

  function buildHref(overrides: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    const merged = { category, issuer, year, ...overrides };
    if (merged.category) params.set("category", String(merged.category));
    if (merged.issuer) params.set("issuer", String(merged.issuer));
    if (merged.year) params.set("year", String(merged.year));
    const qs = params.toString();
    return `${localePath(locale, "certificates")}${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <JsonLd data={structuredData} />

      <div className="container-content flex flex-col gap-8 py-10 sm:py-14">
        <Breadcrumbs
          items={[
            { label: t.nav.home, href: localePath(locale) },
            { label: t.nav.certificates },
          ]}
          label={t.a11y.breadcrumb}
        />

        <SectionHeading
          headingLevel={1}
          title={t.certificates.title}
          description={t.certificates.description}
        />

        {/*
          Privacy note, shown unconditionally. Visitors should know that what they
          are looking at is a redacted copy, not the original document.
        */}
        <Notice tone="info" icon="shield">
          <p>{t.certificates.previewNote}</p>
        </Notice>

        {/* ── Filter chips ─────────────────────────────────────────────────── */}
        <nav aria-label={t.a11y.filters} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip href={buildHref({ category: undefined })} active={!category}>
              {t.certificates.allCategories}
            </FilterChip>

            {availableCategories.map((item) => (
              <FilterChip
                key={item.id}
                href={buildHref({ category: item.slug })}
                active={category === item.slug}
              >
                {item.name}
              </FilterChip>
            ))}
          </div>

          {facets.years.length > 1 || facets.issuers.length > 1 ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-4">
              {facets.years.length > 1 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.8125rem] font-medium text-foreground-muted">
                    {t.certificates.filterYear}
                  </span>
                  <FilterChip href={buildHref({ year: undefined })} active={!year}>
                    {t.certificates.allYears}
                  </FilterChip>
                  {facets.years.map((value) => (
                    <FilterChip
                      key={value}
                      href={buildHref({ year: value })}
                      active={year === value}
                    >
                      {value}
                    </FilterChip>
                  ))}
                </div>
              ) : null}

              {facets.issuers.length > 1 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.8125rem] font-medium text-foreground-muted">
                    {t.certificates.filterIssuer}
                  </span>
                  <FilterChip href={buildHref({ issuer: undefined })} active={!issuer}>
                    {t.certificates.allIssuers}
                  </FilterChip>
                  {facets.issuers.map((value) => (
                    <FilterChip
                      key={value}
                      href={buildHref({ issuer: value })}
                      active={issuer === value}
                    >
                      {value}
                    </FilterChip>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </nav>

        <p aria-live="polite" aria-atomic="true" className="text-small text-foreground-muted">
          {resultLabel}
        </p>

        {result.items.length === 0 ? (
          <EmptyState
            icon="award"
            title={hasFilters ? t.certificates.noResults : t.certificates.emptyState}
            actions={
              hasFilters ? (
                <ButtonLink
                  href={localePath(locale, "certificates")}
                  variant="outline"
                  iconStart="refresh"
                >
                  {t.a11y.clearFilters}
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.items.map((certificate) => (
              <li key={certificate.id} className="flex">
                <CertificateCard
                  certificate={certificate}
                  locale={locale}
                  t={t}
                  headingLevel={2}
                />
              </li>
            ))}
          </ul>
        )}

        <Pagination
          currentPage={result.page}
          totalPages={result.totalPages}
          buildHref={(nextPage) => {
            const base = buildHref({});
            const separator = base.includes("?") ? "&" : "?";
            return nextPage > 1 ? `${base}${separator}page=${nextPage}` : base;
          }}
          labels={{
            nav: t.a11y.pagination,
            previous: t.a11y.previous,
            next: t.a11y.next,
            pageOf: t.common.pageOf,
          }}
        />
      </div>
    </>
  );
}

/**
 * Filter chip.
 *
 * A link, not a button: the filter is a URL, so this is navigation. `aria-current`
 * marks the active chip, and the active state is signalled by background *and*
 * weight, never colour alone.
 */
function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-9 items-center rounded-[--radius-full] border px-3.5 text-[0.8125rem] transition-colors",
        active
          ? "border-primary bg-primary font-semibold text-primary-foreground"
          : "border-border bg-surface text-foreground-muted hover:border-border-interactive hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
