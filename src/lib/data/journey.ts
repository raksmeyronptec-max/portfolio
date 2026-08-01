import "server-only";

import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_COLUMNS } from "@/lib/content/media";
import {
  JOURNEY_ENTRY_COLUMNS,
  JOURNEY_MEDIA_COLUMNS,
  formatJourneyPeriod,
  journeyYear,
  resolveJourneyMedia,
  splitHighlights,
  splitJourneyMedia,
  type JourneyCategory,
  type JourneyEntryDetail,
  type JourneyEntrySummary,
  type JourneyMediaItem,
  type JourneyMediaRow,
  type JourneyRelationTarget,
} from "@/lib/content/journey";
import {
  pickLocalized,
  resolveTranslation,
  type TranslationRow,
} from "@/lib/content/translation";
import { localePath, type Locale } from "@/i18n/config";

/**
 * Public reads for journey stories.
 *
 * Read through `createSupabasePublicClient()` — the anon client that never writes
 * cookies, because a cookie write would opt these pages out of static rendering.
 *
 * As everywhere else in `lib/data/*`, these queries deliberately do NOT filter on
 * `status`, `deleted_at`, `visibility`, `privacy_status` or `consent_status`. RLS
 * does all of it (migration 0024), and re-stating the predicate here would imply
 * the database were not the gate — at which point a forgotten `.eq()` becomes a
 * leak rather than a redundancy. What is filtered here is only ordering and
 * presentation.
 */

type TranslationShape = TranslationRow & {
  title: string;
  eyebrow: string | null;
  summary: string | null;
  story: string | null;
  highlights: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

type CategoryShape = {
  id: string;
  slug: string;
  name_en: string;
  name_km: string | null;
  icon: string | null;
} | null;

type EntryRow = {
  id: string;
  slug: string;
  featured: boolean;
  sort_order: number;
  event_date: string | null;
  date_precision: string;
  period_start: string | null;
  period_end: string | null;
  period_label_en: string | null;
  period_label_km: string | null;
  location_en: string | null;
  location_km: string | null;
  organisation_en: string | null;
  organisation_km: string | null;
  external_url: string | null;
  updated_at: string;
  published_at: string | null;
  journey_categories: CategoryShape;
  journey_entry_translations: TranslationShape[];
  journey_media?: JourneyMediaRow[];
};

const CATEGORY_SELECT = "journey_categories(id, slug, name_en, name_km, icon)";
const TRANSLATION_SELECT =
  "journey_entry_translations(locale, title, eyebrow, summary, story, highlights, seo_title, seo_description)";
const MEDIA_SELECT = `journey_media(${JOURNEY_MEDIA_COLUMNS}, media_assets(${MEDIA_COLUMNS}))`;

/**
 * Resolve and order one entry's media.
 *
 * Cover first, then sort order. `sort_order` alone would let a cover that was
 * added last sort to the end of its own story.
 */
function resolveMediaList(rows: JourneyMediaRow[] | undefined, locale: Locale) {
  return (rows ?? [])
    .slice()
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "cover" ? -1 : 1;
      return a.sort_order - b.sort_order;
    })
    .map((row) => resolveJourneyMedia(row, locale))
    .filter((item): item is JourneyMediaItem => item !== null);
}

function toCategory(row: CategoryShape, locale: Locale): JourneyCategory | null {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: pickLocalized(locale, row.name_en, row.name_km) ?? row.slug,
    icon: row.icon,
  };
}

function toSummary(row: EntryRow, locale: Locale): JourneyEntrySummary {
  const { row: translation, actualLocale, isFallback } = resolveTranslation(
    row.journey_entry_translations,
    locale,
  );

  const media = resolveMediaList(row.journey_media, locale);
  const { cover } = splitJourneyMedia(media);

  return {
    id: row.id,
    slug: row.slug,
    featured: row.featured,
    // Falling back to the slug keeps a translation-less row renderable rather
    // than blank. RLS makes this unreachable publicly — the publish gate demands
    // an English title — but the listing must not crash on it either way.
    title: translation?.title ?? row.slug,
    eyebrow: translation?.eyebrow ?? null,
    summary: translation?.summary ?? null,
    category: toCategory(row.journey_categories, locale),
    periodLabel: formatJourneyPeriod(locale, {
      periodLabelEn: row.period_label_en,
      periodLabelKm: row.period_label_km,
      eventDate: row.event_date,
      datePrecision: row.date_precision,
      periodStart: row.period_start,
      periodEnd: row.period_end,
    }),
    year: journeyYear({
      eventDate: row.event_date,
      periodStart: row.period_start,
      periodEnd: row.period_end,
    }),
    eventDate: row.event_date,
    location: pickLocalized(locale, row.location_en, row.location_km),
    organisation: pickLocalized(locale, row.organisation_en, row.organisation_km),
    cover,
    photoCount: media.filter((item) => item.kind === "photo").length,
    videoCount: media.filter((item) => item.kind === "video").length,
    contentLocale: actualLocale,
    isFallback,
    updatedAt: row.updated_at,
  };
}

// ── Listing ─────────────────────────────────────────────────────────────────

/**
 * Every published story, newest first.
 *
 * Ordered by the date the story is *about* rather than the date it was typed up,
 * with `nullsFirst: false` so undated stories collect at the end instead of
 * leading a chronological page. `sort_order` is the tiebreaker, which is what
 * lets the owner arrange several stories from the same year deliberately.
 *
 * Media is fetched with the listing rather than per entry: the timeline renders
 * a cover for every row, and N+1 queries for N covers is the single easiest way
 * to make this page slow.
 */
export async function getJourneyEntries(locale: Locale): Promise<JourneyEntrySummary[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();

    const { data, error } = await supabase
      .from("journey_entries")
      .select(
        `${JOURNEY_ENTRY_COLUMNS}, ${CATEGORY_SELECT}, ${TRANSLATION_SELECT}, ${MEDIA_SELECT}`,
      )
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return (data as unknown as EntryRow[]).map((row) => toSummary(row, locale));
  } catch {
    return [];
  }
}

/**
 * Featured stories for the homepage.
 *
 * `limit` defaults to 6, which is the top of the range section 15 of the brief
 * specifies. The homepage is a summary, not the collection.
 */
export async function getFeaturedJourneyEntries(
  locale: Locale,
  limit = 6,
): Promise<JourneyEntrySummary[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();

    const { data, error } = await supabase
      .from("journey_entries")
      .select(
        `${JOURNEY_ENTRY_COLUMNS}, ${CATEGORY_SELECT}, ${TRANSLATION_SELECT}, ${MEDIA_SELECT}`,
      )
      .eq("featured", true)
      .order("sort_order", { ascending: true })
      .order("event_date", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error || !data) return [];

    return (data as unknown as EntryRow[]).map((row) => toSummary(row, locale));
  } catch {
    return [];
  }
}

/** Categories that actually have at least one published story behind them. */
export async function getJourneyCategories(locale: Locale): Promise<
  Array<JourneyCategory & { count: number }>
> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();

    /*
     * `!inner` on the entries join is what makes this "categories in use".
     * Without it every seeded category would appear as a filter chip, including
     * the fourteen the owner has not written a story for yet — a filter that
     * always returns nothing is worse than no filter.
     */
    const { data, error } = await supabase
      .from("journey_categories")
      .select("id, slug, name_en, name_km, icon, sort_order, journey_entries!inner(id)")
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return (
      data as unknown as Array<{
        id: string;
        slug: string;
        name_en: string;
        name_km: string | null;
        icon: string | null;
        journey_entries: Array<{ id: string }>;
      }>
    ).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: pickLocalized(locale, row.name_en, row.name_km) ?? row.slug,
      icon: row.icon,
      count: row.journey_entries.length,
    }));
  } catch {
    return [];
  }
}

// ── Detail ──────────────────────────────────────────────────────────────────

type RelationRow = {
  display_order: number;
  experiences: {
    id: string;
    slug: string;
    experience_translations: Array<{ locale: string; role_title: string }>;
  } | null;
  education: {
    id: string;
    slug: string;
    education_translations: Array<{ locale: string; institution: string }>;
  } | null;
  certificates: {
    id: string;
    slug: string;
    certificate_translations: Array<{ locale: string; title: string }>;
  } | null;
  projects: {
    id: string;
    slug: string;
    project_translations: Array<{ locale: string; title: string }>;
  } | null;
};

/**
 * Resolve a relation row into a labelled, linkable target.
 *
 * Experience and Education have no per-entry public page — they are sections of a
 * listing — so their `href` is the listing anchored to the entry. Certificates and
 * projects have real detail routes.
 */
function toRelationTarget(
  row: RelationRow,
  locale: Locale,
): JourneyRelationTarget | null {
  const label = (rows: Array<TranslationRow & Record<string, unknown>>, field: string) => {
    const { row: translation } = resolveTranslation(rows, locale);
    const value = translation?.[field];
    return typeof value === "string" && value.trim() !== "" ? value : null;
  };

  if (row.experiences) {
    return {
      type: "experience",
      id: row.experiences.id,
      label:
        label(row.experiences.experience_translations, "role_title") ??
        row.experiences.slug,
      href: `${localePath(locale, "experience")}#experience-${row.experiences.slug}`,
    };
  }

  if (row.education) {
    return {
      type: "education",
      id: row.education.id,
      label:
        label(row.education.education_translations, "institution") ?? row.education.slug,
      href: `${localePath(locale, "education")}#education-${row.education.slug}`,
    };
  }

  if (row.certificates) {
    return {
      type: "certificate",
      id: row.certificates.id,
      label:
        label(row.certificates.certificate_translations, "title") ??
        row.certificates.slug,
      href: localePath(locale, `certificates/${row.certificates.slug}`),
    };
  }

  if (row.projects) {
    return {
      type: "project",
      id: row.projects.id,
      label: label(row.projects.project_translations, "title") ?? row.projects.slug,
      href: localePath(locale, `projects/${row.projects.slug}`),
    };
  }

  // Unreachable: a CHECK constraint requires exactly one target. Returning null
  // rather than throwing keeps one bad row from taking down the page.
  return null;
}

export async function getJourneyEntry(
  slug: string,
  locale: Locale,
): Promise<JourneyEntryDetail | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabasePublicClient();

    const { data, error } = await supabase
      .from("journey_entries")
      .select(
        `${JOURNEY_ENTRY_COLUMNS}, ${CATEGORY_SELECT}, ${TRANSLATION_SELECT}, ${MEDIA_SELECT},
         journey_relations(
           display_order,
           experiences(id, slug, experience_translations(locale, role_title)),
           education(id, slug, education_translations(locale, institution)),
           certificates(id, slug, certificate_translations(locale, title)),
           projects(id, slug, project_translations(locale, title))
         )`,
      )
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as EntryRow & { journey_relations: RelationRow[] };
    const summary = toSummary(row, locale);

    const { row: translation } = resolveTranslation(
      row.journey_entry_translations,
      locale,
    );

    const media = resolveMediaList(row.journey_media, locale);
    const { gallery } = splitJourneyMedia(media);

    const relations = (row.journey_relations ?? [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map((relation) => toRelationTarget(relation, locale))
      .filter((target): target is JourneyRelationTarget => target !== null);

    return {
      ...summary,
      story: translation?.story ?? null,
      highlights: splitHighlights(translation?.highlights),
      externalUrl: row.external_url,
      gallery,
      relations,
      seoTitle: translation?.seo_title ?? null,
      seoDescription: translation?.seo_description ?? null,
      publishedAt: row.published_at,
    };
  } catch {
    return null;
  }
}

/** Slugs and modification times for the sitemap. */
export async function getPublishedJourneySlugs(): Promise<
  Array<{ slug: string; updatedAt: string }>
> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("journey_entries")
      .select("slug, updated_at")
      .order("event_date", { ascending: false, nullsFirst: false });

    if (error || !data) return [];

    return data.map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));
  } catch {
    return [];
  }
}

/**
 * Previous / next navigation within the timeline.
 *
 * Derived from the full ordered list rather than from two bounded queries. The
 * ordering is `event_date desc, sort_order asc` with nulls last, which is not
 * expressible as a single `.lt()` comparison — two queries would silently
 * disagree with the listing page for exactly the undated stories the seed data
 * is full of.
 */
export async function getJourneyNeighbours(
  slug: string,
  locale: Locale,
): Promise<{ previous: JourneyEntrySummary | null; next: JourneyEntrySummary | null }> {
  const entries = await getJourneyEntries(locale);
  const index = entries.findIndex((entry) => entry.slug === slug);

  if (index === -1) return { previous: null, next: null };

  return {
    previous: entries[index - 1] ?? null,
    next: entries[index + 1] ?? null,
  };
}

// ── Reverse lookups, for the pages a story is evidence for ──────────────────

export type LinkedJourneyStory = {
  slug: string;
  title: string;
  categoryName: string | null;
  photoCount: number;
  videoCount: number;
};

/**
 * Published stories linked to each record of one type, keyed by that record's id.
 *
 * One query for the whole page rather than one per entry. The Experience page
 * renders every role at once, and asking per role is how a five-row page becomes
 * six round trips.
 *
 * The counts drive the "12 photos" hint on the link, so the caller can offer
 * "View all photos" only when there is something behind it.
 */
export async function getJourneyStoriesByRelation(
  type: "experience" | "education" | "certificate" | "project",
  locale: Locale,
): Promise<Record<string, LinkedJourneyStory[]>> {
  if (!isSupabaseConfigured()) return {};

  const column = {
    experience: "experience_id",
    education: "education_id",
    certificate: "certificate_id",
    project: "project_id",
  }[type];

  try {
    const supabase = await createSupabasePublicClient();

    /*
     * `!inner` on the entry join drops relations whose story is not published.
     * RLS already refuses those rows, so this is belt-and-braces — but it also
     * turns "story exists but is a draft" into no row rather than a row with a
     * null entry, which is what the mapping below assumes.
     */
    const { data, error } = await supabase
      .from("journey_relations")
      .select(
        `${column}, display_order,
         journey_entries!inner(
           slug, ${TRANSLATION_SELECT}, ${CATEGORY_SELECT},
           journey_media(kind)
         )`,
      )
      .not(column, "is", null)
      .order("display_order", { ascending: true });

    if (error || !data) return {};

    const grouped: Record<string, LinkedJourneyStory[]> = {};

    for (const raw of data as unknown as Array<
      Record<string, unknown> & {
        journey_entries: {
          slug: string;
          journey_entry_translations: TranslationShape[];
          journey_categories: CategoryShape;
          journey_media: Array<{ kind: string }>;
        } | null;
      }
    >) {
      const targetId = raw[column];
      const entry = raw.journey_entries;
      if (typeof targetId !== "string" || !entry) continue;

      const { row: translation } = resolveTranslation(
        entry.journey_entry_translations,
        locale,
      );

      const list = grouped[targetId] ?? [];
      list.push({
        slug: entry.slug,
        title: translation?.title ?? entry.slug,
        categoryName: entry.journey_categories
          ? pickLocalized(
              locale,
              entry.journey_categories.name_en,
              entry.journey_categories.name_km,
            )
          : null,
        // RLS has already restricted `journey_media` to publicly renderable rows,
        // so these counts are what a visitor would actually see.
        photoCount: entry.journey_media.filter((m) => m.kind === "photo").length,
        videoCount: entry.journey_media.filter((m) => m.kind === "video").length,
      });
      grouped[targetId] = list;
    }

    return grouped;
  } catch {
    return {};
  }
}
