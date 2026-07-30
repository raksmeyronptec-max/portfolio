import "server-only";

import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_COLUMNS, type MediaAsset } from "@/lib/content/media";
import {
  pickLocalized,
  resolveTranslation,
  type TranslationRow,
} from "@/lib/content/translation";
import type { Locale } from "@/i18n/config";

/**
 * Public project queries.
 *
 * RLS restricts every read here to published, non-future-dated, non-deleted rows,
 * so none of these functions filters on `status` itself. The database is the
 * gate; the query is just a projection. That is deliberate — a forgotten
 * `.eq('status', 'published')` must not be able to leak a draft.
 */

export type ProjectStatus =
  | "live"
  | "in_development"
  | "maintained"
  | "sunset"
  | "concept";

type ProjectTranslationRow = TranslationRow & {
  title: string;
  summary: string | null;
  overview: string | null;
  problem: string | null;
  target_users: string | null;
  goals: string | null;
  my_role: string | null;
  responsibilities: string | null;
  constraints: string | null;
  research: string | null;
  ux_decisions: string | null;
  architecture: string | null;
  database_decisions: string | null;
  key_features: string | null;
  security_notes: string | null;
  accessibility_notes: string | null;
  seo_notes: string | null;
  performance_notes: string | null;
  challenges: string | null;
  solution: string | null;
  results: string | null;
  lessons: string | null;
  next_steps: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export type ProjectCardData = {
  id: string;
  slug: string;
  featured: boolean;
  projectStatus: ProjectStatus;
  role: string | null;
  organization: string | null;
  liveUrl: string | null;
  repositoryUrl: string | null;
  yearLabel: string | null;
  publishedAt: string | null;
  cover: MediaAsset | null;
  title: string;
  summary: string | null;
  problem: string | null;
  /** Locale the prose is actually in, for a correct `lang` attribute. */
  contentLocale: Locale | null;
  isTranslationFallback: boolean;
  technologies: Array<{ id: string; slug: string; name: string }>;
  categories: Array<{ id: string; slug: string; name: string }>;
};

export type ProjectMetric = {
  id: string;
  label: string;
  value: string;
  unit: string | null;
  metricType: string;
  sourceNote: string | null;
  measuredAt: string | null;
};

export type ProjectFeature = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
};

export type ProjectMediaItem = {
  id: string;
  variant:
    | "desktop_screenshot"
    | "mobile_screenshot"
    | "diagram"
    | "before"
    | "after"
    | "gallery";
  caption: string | null;
  pairKey: string | null;
  asset: MediaAsset;
};

export type ProjectDetailData = ProjectCardData & {
  teamSize: number | null;
  durationLabel: string | null;
  periodLabel: string | null;
  startedAt: string | null;
  completedAt: string | null;
  demoVideoUrl: string | null;
  ogImage: MediaAsset | null;
  updatedAt: string;
  translation: ProjectTranslationRow | null;
  features: ProjectFeature[];
  /** Verified metrics only — RLS filters unverified rows out entirely. */
  metrics: ProjectMetric[];
  media: ProjectMediaItem[];
  seoTitle: string | null;
  seoDescription: string | null;
};

const CARD_SELECT = `
  id, slug, featured, project_status, sort_order,
  role_en, role_km, organization_en, organization_km,
  live_url, repository_url, year_label, published_at,
  cover:media_assets!projects_cover_media_id_fkey(${MEDIA_COLUMNS}),
  project_translations(
    locale, title, summary, problem
  ),
  project_technologies(
    sort_order,
    technology:technologies(id, slug, name)
  ),
  project_category_links(
    category:project_categories(id, slug, name_en, name_km)
  )
`;

type RawCardRow = {
  id: string;
  slug: string;
  featured: boolean;
  project_status: ProjectStatus;
  role_en: string | null;
  role_km: string | null;
  organization_en: string | null;
  organization_km: string | null;
  live_url: string | null;
  repository_url: string | null;
  year_label: string | null;
  published_at: string | null;
  cover: MediaAsset | null;
  project_translations: Array<
    TranslationRow & { title: string; summary: string | null; problem: string | null }
  >;
  project_technologies: Array<{
    sort_order: number;
    technology: { id: string; slug: string; name: string } | null;
  }>;
  project_category_links: Array<{
    category: {
      id: string;
      slug: string;
      name_en: string;
      name_km: string | null;
    } | null;
  }>;
};

function toCard(row: RawCardRow, locale: Locale): ProjectCardData {
  const { row: translation, actualLocale, isFallback } = resolveTranslation(
    row.project_translations,
    locale,
  );

  return {
    id: row.id,
    slug: row.slug,
    featured: row.featured,
    projectStatus: row.project_status,
    role: pickLocalized(locale, row.role_en, row.role_km),
    organization: pickLocalized(locale, row.organization_en, row.organization_km),
    liveUrl: row.live_url,
    repositoryUrl: row.repository_url,
    yearLabel: row.year_label,
    publishedAt: row.published_at,
    cover: row.cover,
    // A project always has at least one translation in practice; the slug is a
    // last-resort label rather than a crash.
    title: translation?.title ?? row.slug,
    summary: translation?.summary ?? null,
    problem: translation?.problem ?? null,
    contentLocale: actualLocale,
    isTranslationFallback: isFallback,
    technologies: row.project_technologies
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((link) => link.technology)
      .filter((tech): tech is { id: string; slug: string; name: string } => tech !== null),
    categories: row.project_category_links
      .map((link) => link.category)
      .filter((category) => category !== null)
      .map((category) => ({
        id: category.id,
        slug: category.slug,
        name: pickLocalized(locale, category.name_en, category.name_km) ?? category.slug,
      })),
  };
}

// ── Featured projects (homepage) ─────────────────────────────────────────────

export async function getFeaturedProjects(
  locale: Locale,
  limit = 3,
): Promise<ProjectCardData[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("projects")
      .select(CARD_SELECT)
      .eq("featured", true)
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return (data as unknown as RawCardRow[]).map((row) => toCard(row, locale));
  } catch {
    return [];
  }
}

// ── Project list with filters ───────────────────────────────────────────────

export type ProjectFilters = {
  search?: string;
  category?: string;
  technology?: string;
  status?: ProjectStatus;
  featuredOnly?: boolean;
  page?: number;
  perPage?: number;
};

export type ProjectListResult = {
  items: ProjectCardData[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export async function listProjects(
  locale: Locale,
  filters: ProjectFilters = {},
): Promise<ProjectListResult> {
  const perPage = Math.min(Math.max(filters.perPage ?? 9, 1), 48);
  const page = Math.max(filters.page ?? 1, 1);

  const empty: ProjectListResult = {
    items: [],
    total: 0,
    page,
    perPage,
    totalPages: 0,
  };

  if (!isSupabaseConfigured()) return empty;

  try {
    const supabase = await createSupabasePublicClient();

    // `!inner` turns the embedded resource into a join, which is what makes
    // filtering by a related row possible in a single round trip.
    const select = [
      CARD_SELECT,
      filters.category ? "project_category_links!inner(category:project_categories!inner(slug))" : "",
      filters.technology ? "project_technologies!inner(technology:technologies!inner(slug))" : "",
    ]
      .filter(Boolean)
      .join(",\n");

    let query = supabase
      .from("projects")
      .select(select, { count: "exact" })
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false });

    if (filters.category) {
      query = query.eq("project_category_links.category.slug", filters.category);
    }
    if (filters.technology) {
      query = query.eq("project_technologies.technology.slug", filters.technology);
    }
    if (filters.status) {
      query = query.eq("project_status", filters.status);
    }
    if (filters.featuredOnly) {
      query = query.eq("featured", true);
    }

    const from = (page - 1) * perPage;
    const { data, error, count } = await query.range(from, from + perPage - 1);

    if (error || !data) return empty;

    let items = (data as unknown as RawCardRow[]).map((row) => toCard(row, locale));
    let total = count ?? items.length;

    /*
     * Keyword search is applied in the application rather than in SQL.
     *
     * The searchable text lives in `project_translations`, and PostgREST cannot
     * express "match the row whose locale is X, then fall back to Y" as a filter
     * on an embedded resource. The alternative — a database function — would give
     * up the composability of the other filters. The project count is small
     * enough (single digits) that filtering after fetch is honest and fast; if
     * the catalogue ever grows, this becomes an RPC backed by the existing
     * trigram index.
     */
    const term = filters.search?.trim().toLowerCase();
    if (term) {
      items = items.filter((item) => {
        const haystack = [
          item.title,
          item.summary,
          item.problem,
          item.role,
          item.organization,
          ...item.technologies.map((tech) => tech.name),
          ...item.categories.map((category) => category.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      });
      total = items.length;
    }

    return {
      items,
      total,
      page,
      perPage,
      totalPages: Math.max(Math.ceil(total / perPage), 1),
    };
  } catch {
    return empty;
  }
}

// ── Project detail ──────────────────────────────────────────────────────────

const DETAIL_SELECT = `
  id, slug, featured, project_status, sort_order,
  role_en, role_km, organization_en, organization_km,
  team_size, duration_label_en, duration_label_km,
  period_label_en, period_label_km, year_label,
  live_url, repository_url, demo_video_url,
  started_at, completed_at, published_at, updated_at,
  cover:media_assets!projects_cover_media_id_fkey(${MEDIA_COLUMNS}),
  og_image:media_assets!projects_og_image_media_id_fkey(${MEDIA_COLUMNS}),
  project_translations(*),
  project_technologies(sort_order, technology:technologies(id, slug, name)),
  project_category_links(category:project_categories(id, slug, name_en, name_km)),
  project_features(id, title_en, title_km, description_en, description_km, icon, sort_order),
  project_metrics(
    id, label_en, label_km, value, unit, metric_type, source_note, measured_at, sort_order
  ),
  project_media(
    id, variant, caption_en, caption_km, pair_key, sort_order,
    asset:media_assets(${MEDIA_COLUMNS})
  )
`;

export async function getProjectBySlug(
  slug: string,
  locale: Locale,
): Promise<ProjectDetailData | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("projects")
      .select(DETAIL_SELECT)
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as RawCardRow & {
      team_size: number | null;
      duration_label_en: string | null;
      duration_label_km: string | null;
      period_label_en: string | null;
      period_label_km: string | null;
      started_at: string | null;
      completed_at: string | null;
      demo_video_url: string | null;
      updated_at: string;
      og_image: MediaAsset | null;
      project_translations: ProjectTranslationRow[];
      project_features: Array<{
        id: string;
        title_en: string;
        title_km: string | null;
        description_en: string | null;
        description_km: string | null;
        icon: string | null;
        sort_order: number;
      }>;
      project_metrics: Array<{
        id: string;
        label_en: string;
        label_km: string | null;
        value: string;
        unit: string | null;
        metric_type: string;
        source_note: string | null;
        measured_at: string | null;
        sort_order: number;
      }>;
      project_media: Array<{
        id: string;
        variant: ProjectMediaItem["variant"];
        caption_en: string | null;
        caption_km: string | null;
        pair_key: string | null;
        sort_order: number;
        asset: MediaAsset | null;
      }>;
    };

    const card = toCard(row, locale);
    const { row: translation } = resolveTranslation(row.project_translations, locale);

    return {
      ...card,
      teamSize: row.team_size,
      durationLabel: pickLocalized(
        locale,
        row.duration_label_en,
        row.duration_label_km,
      ),
      periodLabel: pickLocalized(locale, row.period_label_en, row.period_label_km),
      startedAt: row.started_at,
      completedAt: row.completed_at,
      demoVideoUrl: row.demo_video_url,
      ogImage: row.og_image,
      updatedAt: row.updated_at,
      translation: translation ?? null,
      features: row.project_features
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((feature) => ({
          id: feature.id,
          title:
            pickLocalized(locale, feature.title_en, feature.title_km) ??
            feature.title_en,
          description: pickLocalized(
            locale,
            feature.description_en,
            feature.description_km,
          ),
          icon: feature.icon,
        })),
      metrics: row.project_metrics
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((metric) => ({
          id: metric.id,
          label:
            pickLocalized(locale, metric.label_en, metric.label_km) ??
            metric.label_en,
          value: metric.value,
          unit: metric.unit,
          metricType: metric.metric_type,
          sourceNote: metric.source_note,
          measuredAt: metric.measured_at,
        })),
      media: row.project_media
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .flatMap((item) =>
          item.asset
            ? [
                {
                  id: item.id,
                  variant: item.variant,
                  caption: pickLocalized(locale, item.caption_en, item.caption_km),
                  pairKey: item.pair_key,
                  asset: item.asset,
                },
              ]
            : [],
        ),
      seoTitle: translation?.seo_title ?? null,
      seoDescription: translation?.seo_description ?? null,
    };
  } catch {
    return null;
  }
}

/** Published slugs, for `generateStaticParams` and the sitemap. */
export async function getPublishedProjectSlugs(): Promise<
  Array<{ slug: string; updatedAt: string; publishedAt: string | null }>
> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("projects")
      .select("slug, updated_at, published_at")
      .order("published_at", { ascending: false });

    if (error || !data) return [];

    return data.map((row) => ({
      slug: row.slug,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
    }));
  } catch {
    return [];
  }
}

// ── Taxonomies for the filter controls ──────────────────────────────────────

export async function getProjectCategories(
  locale: Locale,
): Promise<Array<{ id: string; slug: string; name: string }>> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("project_categories")
      .select("id, slug, name_en, name_km, sort_order")
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: pickLocalized(locale, row.name_en, row.name_km) ?? row.slug,
    }));
  } catch {
    return [];
  }
}

/**
 * Technologies that are actually used by a published project.
 *
 * Filtering to used technologies matters: offering a filter that returns nothing
 * is a dead end, and the seed deliberately contains more technologies than are
 * currently attached to published work.
 */
export async function getUsedTechnologies(): Promise<
  Array<{ id: string; slug: string; name: string }>
> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("project_technologies")
      .select("technology:technologies!inner(id, slug, name, sort_order), projects!inner(id)");

    if (error || !data) return [];

    const seen = new Map<string, { id: string; slug: string; name: string; sortOrder: number }>();

    for (const row of data as unknown as Array<{
      technology: { id: string; slug: string; name: string; sort_order: number } | null;
    }>) {
      if (!row.technology) continue;
      if (!seen.has(row.technology.id)) {
        seen.set(row.technology.id, {
          id: row.technology.id,
          slug: row.technology.slug,
          name: row.technology.name,
          sortOrder: row.technology.sort_order,
        });
      }
    }

    return [...seen.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map(({ id, slug, name }) => ({ id, slug, name }));
  } catch {
    return [];
  }
}
