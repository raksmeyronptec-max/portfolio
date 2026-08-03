import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pagination } from "@/components/ui/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";
import { Reveal } from "@/components/motion/reveal";
import { CertificateCard } from "@/components/public/certificate-card";
import { getDictionary, plural } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { getSeoOverride, getSiteCounts } from "@/lib/data/site";
import {
  getCertificateCategories,
  getCertificateFacets,
  isCertificateSort,
  isCredentialVerification,
  listCertificates,
  type CertificateSort,
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

  const search = (single(query.q) ?? "").trim();
  const verificationParam = single(query.verification) ?? "";
  const verification = isCredentialVerification(verificationParam)
    ? verificationParam
    : undefined;
  const sortParam = single(query.sort) ?? "";
  const sort: CertificateSort = isCertificateSort(sortParam) ? sortParam : "newest";
  const category = single(query.category) ?? "";
  const issuer = single(query.issuer) ?? "";
  const yearParam = Number.parseInt(single(query.year) ?? "", 10);
  const year = Number.isFinite(yearParam) ? yearParam : undefined;
  const page = toPositiveInt(single(query.page), 1);

  const [result, categories, facets, counts] = await Promise.all([
    listCertificates(locale, {
      search: search || undefined,
      category: category || undefined,
      issuer: issuer || undefined,
      year,
      verification,
      sort,
      page,
      perPage: 12,
    }),
    getCertificateCategories(locale),
    getCertificateFacets(),
    // The *unfiltered* published total, used to size the filter chrome.
    getSiteCounts(),
  ]);

  const resultLabel = plural(
    result.total,
    t.certificates.resultCount,
    t.certificates.resultCountPlural,
  );

  const hasFilters = Boolean(search || category || issuer || year || verification);

  /*
   * Progressive filtering, per the brief. Eleven category buttons above an
   * empty grid was the single loudest thing on the old page.
   *
   *    0–8 published   no filter chrome
   *   9–20 published   category chips only
   *    >20 published   chips plus the year and issuer rows
   */
  const publishedTotal = counts.publishedCertificates ?? 0;
  const showCategoryChips = publishedTotal >= 9 || hasFilters;
  /*
   * Search appears earlier than the category chips. Chips are only worth their
   * space once there are enough credentials to be worth narrowing, but a
   * visitor looking for one credential by name benefits from a search box as
   * soon as the collection stops fitting on one screen.
   */
  const showSearch = publishedTotal >= 6 || hasFilters;
  const showSecondaryFacets = publishedTotal > 20 || hasFilters;

  /*
   * Only categories that hold something.
   *
   * The old rule kept every category visible "so the taxonomy is discoverable",
   * which in practice meant twelve chips above ten credentials, most of them
   * leading to an empty result. A filter that returns nothing is not
   * discoverability, it is a dead end — and the taxonomy is the admin's concern,
   * not a visitor's.
   *
   * The currently-selected category is always kept, so a visitor who filters
   * down to a category and then narrows further by search does not watch the
   * chip they are standing on disappear.
   */
  const availableCategories = categories.filter(
    (item) => item.count > 0 || category === item.slug,
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
    const merged = { q: search, category, issuer, year, verification, sort, ...overrides };
    if (merged.q) params.set("q", String(merged.q));
    if (merged.category) params.set("category", String(merged.category));
    if (merged.issuer) params.set("issuer", String(merged.issuer));
    if (merged.year) params.set("year", String(merged.year));
    if (merged.verification) params.set("verification", String(merged.verification));
    // "newest" is the default, so it stays out of the URL — a shared link should
    // not carry state the visitor never chose.
    if (merged.sort && merged.sort !== "newest") params.set("sort", String(merged.sort));
    const qs = params.toString();
    return `${localePath(locale, "certificates")}${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <JsonLd data={structuredData} />

      <PageHeader
        title={t.certificates.title}
        description={t.certificates.description}
        eyebrow={t.home.certificates.eyebrow}
        breadcrumbs={[
          { label: t.nav.home, href: localePath(locale) },
          { label: t.nav.certificates },
        ]}
        breadcrumbLabel={t.a11y.breadcrumb}
        /*
          Not a check mark. A page-sized ✓ behind a credential collection makes
          a verification claim about all of it, and none of the published
          credentials currently has a working issuer verification route — the
          per-credential states are "awaiting verification" and "issuer
          verification unavailable". A seal is about documents, not about proof.
        */
        watermark="◈"
      >
        {/*
          Privacy note. Demoted from a full-width info banner to one quiet line
          beside a shield: it is standing context, not a warning, and the brief
          was explicit that a blue alert should be reserved for actual warnings.
        */}
        <p className="flex items-center gap-2 text-small text-foreground-muted">
          <Icon name="shield" size={16} className="text-secondary" />
          {t.certificates.privacyShort}
        </p>
      </PageHeader>

      <div className="container-content flex flex-col gap-10 py-14 sm:py-16">
        {/* ── Filters ────────────────────────────────────────────────────────
            Progressive, per the brief:
              ≤8 published   nothing at all
              9–20           category chips
              >20            chips plus the year and issuer rows
            Sized from the unfiltered total so filtering down does not make the
            controls vanish, and always shown when a filter is already active so
            a visitor arriving on a filtered URL can get back out. */}
        {/* ── Search and sort ────────────────────────────────────────────────
            A plain GET form, so search works with JavaScript unavailable and a
            result is a real, shareable, indexable URL. The sort control submits
            the same form, which is why it carries the current query as hidden
            fields rather than reconstructing them. */}
        {showSearch ? (
          <form
            method="get"
            action={localePath(locale, "certificates")}
            role="search"
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            {/* The other facets ride along so searching does not silently drop
                a category the visitor already chose. */}
            {category ? <input type="hidden" name="category" value={category} /> : null}
            {issuer ? <input type="hidden" name="issuer" value={issuer} /> : null}
            {year ? <input type="hidden" name="year" value={String(year)} /> : null}
            {verification ? (
              <input type="hidden" name="verification" value={verification} />
            ) : null}

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="certificate-search" className="text-small font-medium">
                {t.certificates.searchLabel}
              </label>
              <div className="relative">
                <Icon
                  name="search"
                  size={17}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                />
                <input
                  id="certificate-search"
                  type="search"
                  name="q"
                  defaultValue={search}
                  placeholder={t.certificates.searchPlaceholder}
                  className="min-h-11 w-full rounded-(--radius-md) border border-border-strong bg-surface pl-10 pr-3 text-base"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="certificate-sort" className="text-small font-medium">
                {t.certificates.sortLabel}
              </label>
              <select
                id="certificate-sort"
                name="sort"
                defaultValue={sort}
                className="min-h-11 rounded-(--radius-md) border border-border-strong bg-surface px-3 text-base"
              >
                {(["newest", "oldest", "title", "verification"] as const).map(
                  (option) => (
                    <option key={option} value={option}>
                      {t.certificates.sort[option]}
                    </option>
                  ),
                )}
              </select>
            </div>

            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) border border-border-strong bg-surface px-4 text-small font-medium hover:bg-surface-muted"
            >
              {t.certificates.searchSubmit}
            </button>

            {hasFilters ? (
              <Link
                href={localePath(locale, "certificates")}
                className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) px-3 text-small font-medium text-foreground-muted underline decoration-border-strong underline-offset-4 hover:text-foreground"
              >
                {t.certificates.resetFilters}
              </Link>
            ) : null}
          </form>
        ) : null}

        {showCategoryChips ? (
          <nav aria-label={t.a11y.filters} className="flex flex-col gap-4">
            {/* Bleeds to the viewport edge while scrolling so no chip is left
                half-hidden under the container padding on a narrow screen. */}
            <div className="-mx-4 flex snap-x flex-nowrap gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
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
                  {/* The count is supporting detail, not part of the label, so
                      it is dimmed and follows the name rather than competing
                      with it. */}
                  <span className="ml-1.5 text-foreground-subtle">{item.count}</span>
                </FilterChip>
              ))}
            </div>

            {/* Verification is a first-class facet, not a secondary one: "which
                of these can actually be checked?" is the question a recruiter
                or an institution asks first. */}
            {publishedTotal >= 9 || verification ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.8125rem] font-medium text-foreground-subtle">
                  {t.certificates.filterVerification}
                </span>
                <FilterChip
                  href={buildHref({ verification: undefined })}
                  active={!verification}
                >
                  {t.certificates.allVerifications}
                </FilterChip>
                {facets.verifications.map((value) => (
                  <FilterChip
                    key={value}
                    href={buildHref({ verification: value })}
                    active={verification === value}
                  >
                    {t.certificates.verification[value]}
                  </FilterChip>
                ))}
              </div>
            ) : null}

            {showSecondaryFacets && (facets.years.length > 1 || facets.issuers.length > 1) ? (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-4">
                {facets.years.length > 1 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.8125rem] font-medium text-foreground-subtle">
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
                    <span className="text-[0.8125rem] font-medium text-foreground-subtle">
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

            <p
              aria-live="polite"
              aria-atomic="true"
              className="text-small text-foreground-subtle"
            >
              {resultLabel}
            </p>
          </nav>
        ) : (
          <p aria-live="polite" aria-atomic="true" className="sr-only">
            {resultLabel}
          </p>
        )}

        {result.items.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon="award"
              title={t.certificates.noResults}
              // A dead end is not a helpful empty state: say what to try next.
              description={t.certificates.noResultsHint}
              actions={
                <ButtonLink
                  href={localePath(locale, "certificates")}
                  variant="outline"
                  iconStart="refresh"
                >
                  {t.a11y.clearFilters}
                </ButtonLink>
              }
            />
          ) : (
            // Compact and calm rather than a full-width bordered box: nothing has
            // gone wrong, the credentials are simply still in privacy review.
            <div className="flex max-w-[52ch] flex-col gap-2 rounded-(--radius-lg) bg-surface-muted/60 p-8">
              <h2 className="flex items-center gap-2.5 text-h4 font-semibold">
                <Icon name="shield" size={20} className="text-secondary" />
                {t.certificates.emptyHeading}
              </h2>
              <p className="text-small text-foreground-muted">
                {t.certificates.emptyBody}
              </p>
            </div>
          )
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.items.map((certificate, index) => (
              <li key={certificate.id} className="flex">
                <Reveal delay={Math.min(index, 8) * 50} className="flex flex-1">
                  <CertificateCard
                    certificate={certificate}
                    locale={locale}
                    t={t}
                    headingLevel={2}
                  />
                </Reveal>
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
        "inline-flex min-h-9 items-center rounded-(--radius-full) border px-3.5 text-[0.8125rem] transition-colors",
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
