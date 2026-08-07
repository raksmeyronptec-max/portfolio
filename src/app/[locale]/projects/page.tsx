import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Pagination } from "@/components/ui/navigation";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";
import { Reveal } from "@/components/motion/reveal";
import { ProjectCard } from "@/components/public/project-card";
import { ProjectShowcase } from "@/components/public/project-showcase";
import { ProjectFilters } from "@/components/public/project-filters";
import { LivePlatformsFallback } from "@/components/public/home-sections";
import { getDictionary, plural } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { getSeoOverride, getSiteCounts } from "@/lib/data/site";
import {
  getProjectCategories,
  getUsedTechnologies,
  listProjects,
  type ProjectStatus,
} from "@/lib/data/projects";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  graph,
  itemListSchema,
} from "@/lib/seo/jsonld";

export const revalidate = 300;

const PROJECT_STATUSES: ProjectStatus[] = [
  "live",
  "in_development",
  "maintained",
  "sunset",
  "concept",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const override = await getSeoOverride("projects", locale);

  return buildPageMetadata({
    locale,
    path: "projects",
    title: override?.title ?? t.projects.title,
    description: override?.description ?? t.projects.description,
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    noIndex: override ? !override.isIndexable : false,
  });
}

export default async function ProjectsPage({
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

  // Every parameter is read defensively: a hand-edited URL must degrade to the
  // unfiltered list rather than error.
  const search = single(query.q) ?? "";
  const category = single(query.category) ?? "";
  const technology = single(query.tech) ?? "";
  const statusParam = single(query.status) ?? "";
  const status = PROJECT_STATUSES.includes(statusParam as ProjectStatus)
    ? (statusParam as ProjectStatus)
    : undefined;
  const featuredOnly = single(query.featured) === "1";
  const page = toPositiveInt(single(query.page), 1);

  const [result, categories, technologies, counts] = await Promise.all([
    listProjects(locale, {
      search,
      category: category || undefined,
      technology: technology || undefined,
      status,
      featuredOnly,
      page,
      perPage: 9,
    }),
    getProjectCategories(locale),
    getUsedTechnologies(),
    // The *unfiltered* published total. Filter chrome is sized from this rather
    // than from `result.total`, so filtering down to one project does not make
    // the controls disappear underneath the visitor.
    getSiteCounts(),
  ]);

  const resultLabel = plural(
    result.total,
    t.projects.resultCount,
    t.projects.resultCountPlural,
  );

  const hasFilters =
    Boolean(search) || Boolean(category) || Boolean(technology) || Boolean(status) || featuredOnly;

  /*
   * Progressive filtering, per the brief.
   *
   *    0–6 published   no filter chrome at all
   *   7–12 published   category chips only
   *    >12 published   search plus the full select row
   *
   * A page with three projects on it should never open with a search box and
   * three dropdowns above the content — that is what made the old page read as
   * a catalogue-management screen. The controls are also kept mounted whenever
   * a filter is already active, so a visitor who arrives on a filtered URL can
   * always get back out.
   */
  const publishedTotal = counts.publishedProjects ?? 0;
  const filterMode: "none" | "chips" | "full" =
    publishedTotal > 12 ? "full" : publishedTotal >= 7 ? "chips" : "none";
  const showFilters = filterMode !== "none" || hasFilters;

  // On an unfiltered first page, the leading project is promoted to a
  // full-width showcase so the page opens with work rather than with controls.
  // On a filtered or paginated view every result stays in the grid, because
  // promoting an arbitrary match would imply a ranking that does not exist.
  const promoteLead = !hasFilters && result.page === 1 && result.items.length > 0;
  const lead = promoteLead ? result.items[0] : undefined;
  const rest = promoteLead ? result.items.slice(1) : result.items;

  const breadcrumbs = [
    { label: t.nav.home, href: localePath(locale) },
    { label: t.nav.projects },
  ];

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.projects, url: absoluteUrl(localePath(locale, "projects")) },
    ]),
    itemListSchema({
      name: t.projects.title,
      items: result.items.map((project) => ({
        name: project.title,
        url: absoluteUrl(localePath(locale, `projects/${project.slug}`)),
      })),
    }),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />

      <PageHeader
        title={t.projects.title}
        description={t.projects.description}
        eyebrow={t.home.featured.eyebrow}
        breadcrumbs={breadcrumbs}
        breadcrumbLabel={t.a11y.breadcrumb}
        watermark="{ }"
      />

      <div className="container-content flex flex-col gap-12 py-14 sm:py-16">
        {showFilters ? (
          <ProjectFilters
            locale={locale}
            t={t}
            mode={filterMode === "full" ? "full" : "chips"}
            initial={{
              search,
              category,
              technology,
              status: status ?? "",
              featuredOnly,
            }}
            categories={categories.map((item) => ({
              value: item.slug,
              label: item.name,
            }))}
            technologies={technologies.map((item) => ({
              value: item.slug,
              label: item.name,
            }))}
            statuses={PROJECT_STATUSES.map((value) => ({
              value,
              label: t.projects.projectStatus[value],
            }))}
            resultLabel={resultLabel}
          />
        ) : null}

        {/*
          Polite live region. Announces the new count after filtering so a
          screen-reader user is told the results changed instead of having to go
          looking for them.
        */}
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {resultLabel}
        </p>

        {result.items.length === 0 ? (
          hasFilters ? (
            // A genuinely empty *filter result* — the collection is fine, this
            // query just matched nothing.
            <EmptyState
              icon="layers"
              title={t.projects.noResults}
              description={t.projects.noResultsHint}
              actions={
                <ButtonLink
                  href={localePath(locale, "projects")}
                  variant="outline"
                  iconStart="refresh"
                >
                  {t.a11y.clearFilters}
                </ButtonLink>
              }
            />
          ) : (
            // Nothing published at all. Never "there are no projects yet": the
            // platforms are live, so link to them.
            <LivePlatformsFallback locale={locale} t={t} />
          )
        ) : (
          <div className="flex flex-col gap-14">
            {lead ? (
              <Reveal>
                <ProjectShowcase
                  project={lead}
                  locale={locale}
                  t={t}
                  headingLevel={2}
                />
              </Reveal>
            ) : null}

            {rest.length > 0 ? (
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((project, index) => (
                  <li key={project.id} className="flex">
                    <Reveal delay={index * 60} className="flex flex-1">
                      <ProjectCard
                        project={project}
                        locale={locale}
                        t={t}
                        headingLevel={2}
                      />
                    </Reveal>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <Pagination
          currentPage={result.page}
          totalPages={result.totalPages}
          buildHref={(nextPage) => {
            const params = new URLSearchParams();
            if (search) params.set("q", search);
            if (category) params.set("category", category);
            if (technology) params.set("tech", technology);
            if (status) params.set("status", status);
            if (featuredOnly) params.set("featured", "1");
            if (nextPage > 1) params.set("page", String(nextPage));
            const qs = params.toString();
            return `${localePath(locale, "projects")}${qs ? `?${qs}` : ""}`;
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

/** Query params can arrive as arrays; take the first value. */
function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
