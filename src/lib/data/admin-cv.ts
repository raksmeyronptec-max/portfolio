import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { translationStatus } from "@/lib/content/translation";
import {
  getExperienceMediaSummaries,
  type ExperienceMediaSummary,
} from "@/lib/data/admin-experience-media";
import { locales } from "@/i18n/config";
import type { CvItem } from "@/components/admin/cv-manager";
import type { EntityValues } from "@/components/admin/entity-editor";

/**
 * Admin loaders for education, experience and references.
 *
 * Each returns `CvItem[]`, which bundles the display labels *and* the editor values,
 * so the list and the editor cannot disagree about what a record contains.
 */

export async function listAdminEducation(): Promise<CvItem[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("education")
      .select("*, education_translations(*)")
      .order("sort_order", { ascending: true })
      .order("started_on", { ascending: false, nullsFirst: false });

    if (error || !data) return [];

    return (data as unknown as Array<Record<string, unknown> & {
      education_translations: Array<Record<string, unknown> & { locale: string }>;
    }>).map((row) => {
      const translations = row.education_translations ?? [];
      const en = translations.find((item) => item.locale === "en");

      return {
        id: row.id as string,
        slug: row.slug as string,
        status: row.status as CvItem["status"],
        deletedAt: (row.deleted_at as string | null) ?? null,
        primaryLabel:
          (en?.institution as string | undefined) ?? (row.slug as string),
        secondaryLabel: (en?.qualification as string | null) ?? null,
        metaLabel: (row.period_label_en as string | null) ?? null,
        needsReview: Boolean(row.needs_review),
        reviewNote: (row.review_note as string | null) ?? null,
        translationStatus: translationStatus(translations),
        values: {
          slug: row.slug,
          status: row.status,
          kind: row.kind,
          sort_order: row.sort_order,
          institution_url: row.institution_url ?? "",
          started_on: row.started_on ?? "",
          ended_on: row.ended_on ?? "",
          is_current: Boolean(row.is_current),
          period_label_en: row.period_label_en ?? "",
          period_label_km: row.period_label_km ?? "",
          schedule_label_en: row.schedule_label_en ?? "",
          schedule_label_km: row.schedule_label_km ?? "",
          grade_value: row.grade_value ?? "",
          grade_scale: row.grade_scale ?? "",
          grade_source_note: row.grade_source_note ?? "",
          needs_review: Boolean(row.needs_review),
          review_note: row.review_note ?? "",
          translations: locales.map((locale) => {
            const stored = translations.find((item) => item.locale === locale);
            return {
              locale,
              institution: (stored?.institution as string | undefined) ?? "",
              qualification: (stored?.qualification as string | undefined) ?? "",
              field_of_study: (stored?.field_of_study as string | undefined) ?? "",
              description: (stored?.description as string | undefined) ?? "",
              achievements: (stored?.achievements as string | undefined) ?? "",
            };
          }),
        } satisfies EntityValues,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Compact photo status for one experience row.
 *
 * Kept to at most three badges. The list already carries status, translation and
 * review badges, and a row that reports six things reports none — so this states
 * the count, whichever single problem is most urgent, and nothing else. The full
 * picture is one click away on the photos page.
 */
function mediaBadges(
  summary: ExperienceMediaSummary | undefined,
): CvItem["badges"] {
  if (!summary || summary.total === 0) return undefined;

  const badges: NonNullable<CvItem["badges"]> = [
    {
      label: `${summary.total} ${summary.total === 1 ? "photo" : "photos"}`,
      tone: "neutral",
    },
  ];

  if (summary.pendingReview > 0) {
    badges.push({
      label: `${summary.pendingReview} awaiting privacy review`,
      tone: "warning",
    });
  } else if (!summary.hasCover) {
    badges.push({ label: "No cover", tone: "warning" });
  } else if (summary.missingAltText > 0) {
    badges.push({ label: "Alt text missing", tone: "warning" });
  } else if (summary.live > 0) {
    badges.push({ label: `${summary.live} public`, tone: "success" });
  }

  return badges;
}

export async function listAdminExperience(): Promise<CvItem[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const [{ data, error }, mediaSummaries] = await Promise.all([
      supabase
        .from("experiences")
        .select("*, experience_translations(*), experience_tags(label_en, sort_order)")
        .order("sort_order", { ascending: true })
        .order("started_on", { ascending: false, nullsFirst: false }),
      getExperienceMediaSummaries(),
    ]);

    if (error || !data) return [];

    return (data as unknown as Array<Record<string, unknown> & {
      experience_translations: Array<Record<string, unknown> & { locale: string }>;
      experience_tags: Array<{ label_en: string; sort_order: number }>;
    }>).map((row) => {
      const translations = row.experience_translations ?? [];
      const en = translations.find((item) => item.locale === "en");
      const tags = (row.experience_tags ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((tag) => tag.label_en);

      return {
        id: row.id as string,
        badges: mediaBadges(mediaSummaries[row.id as string]),
        slug: row.slug as string,
        status: row.status as CvItem["status"],
        deletedAt: (row.deleted_at as string | null) ?? null,
        primaryLabel: (en?.role_title as string | undefined) ?? (row.slug as string),
        secondaryLabel: (en?.organization as string | null) ?? null,
        metaLabel: (row.period_label_en as string | null) ?? null,
        needsReview: Boolean(row.needs_review),
        reviewNote: (row.review_note as string | null) ?? null,
        translationStatus: translationStatus(translations),
        values: {
          slug: row.slug,
          status: row.status,
          kind: row.kind,
          sort_order: row.sort_order,
          organization_url: row.organization_url ?? "",
          location_en: row.location_en ?? "",
          location_km: row.location_km ?? "",
          employment_type: row.employment_type ?? "",
          started_on: row.started_on ?? "",
          ended_on: row.ended_on ?? "",
          is_current: Boolean(row.is_current),
          period_label_en: row.period_label_en ?? "",
          period_label_km: row.period_label_km ?? "",
          needs_review: Boolean(row.needs_review),
          review_note: row.review_note ?? "",
          tags,
          translations: locales.map((locale) => {
            const stored = translations.find((item) => item.locale === locale);
            return {
              locale,
              role_title: (stored?.role_title as string | undefined) ?? "",
              organization: (stored?.organization as string | undefined) ?? "",
              summary: (stored?.summary as string | undefined) ?? "",
              description: (stored?.description as string | undefined) ?? "",
              achievements: (stored?.achievements as string | undefined) ?? "",
            };
          }),
        } satisfies EntityValues,
      };
    });
  } catch {
    return [];
  }
}

export async function listAdminTestimonials(): Promise<CvItem[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("testimonials")
      .select("*, testimonial_translations(*)")
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return (data as unknown as Array<Record<string, unknown> & {
      testimonial_translations: Array<Record<string, unknown> & { locale: string }>;
    }>).map((row) => {
      const translations = row.testimonial_translations ?? [];
      const en = translations.find((item) => item.locale === "en");
      const consentRecordedAt = (row.consent_recorded_at as string | null) ?? null;

      return {
        id: row.id as string,
        slug: row.slug as string,
        status: row.status as CvItem["status"],
        deletedAt: (row.deleted_at as string | null) ?? null,
        primaryLabel: row.author_name_en as string,
        secondaryLabel:
          [en?.author_role, en?.organization].filter(Boolean).join(" · ") || null,
        metaLabel: (row.relationship as string | null) ?? null,
        needsReview: false,
        reviewNote: null,
        featured: Boolean(row.featured),
        translationStatus: translationStatus(translations),
        // Consent is the gate on publishing, so its state belongs in the list.
        badges: [
          consentRecordedAt
            ? { label: "Consent recorded", tone: "success" as const }
            : { label: "No consent recorded", tone: "warning" as const },
        ],
        values: {
          slug: row.slug,
          status: row.status,
          featured: Boolean(row.featured),
          sort_order: row.sort_order,
          author_name_en: row.author_name_en,
          author_name_km: row.author_name_km ?? "",
          author_url: row.author_url ?? "",
          avatar_media_id: row.avatar_media_id ?? null,
          relationship: row.relationship ?? "",
          consent_confirmed: Boolean(consentRecordedAt),
          consent_note: row.consent_note ?? "",
          translations: locales.map((locale) => {
            const stored = translations.find((item) => item.locale === locale);
            return {
              locale,
              quote: (stored?.quote as string | undefined) ?? "",
              author_role: (stored?.author_role as string | undefined) ?? "",
              organization: (stored?.organization as string | undefined) ?? "",
            };
          }),
        } satisfies EntityValues,
      };
    });
  } catch {
    return [];
  }
}

// ── Capabilities ────────────────────────────────────────────────────────────

export type AdminSkillCategory = {
  id: string;
  slug: string;
  nameEn: string;
  nameKm: string | null;
  descriptionEn: string | null;
  icon: string | null;
  sortOrder: number;
  isPublished: boolean;
  skills: Array<{
    id: string;
    slug: string;
    nameEn: string;
    nameKm: string | null;
    isPublished: boolean;
    sortOrder: number;
    projectSlugs: string[];
  }>;
};

export async function listAdminSkills(): Promise<AdminSkillCategory[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("skill_categories")
      .select(
        `id, slug, name_en, name_km, description_en, icon, sort_order, is_published,
         skills(
           id, slug, name_en, name_km, is_published, sort_order,
           skill_project_links(project:projects(slug))
         )`,
      )
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return (data as unknown as Array<{
      id: string;
      slug: string;
      name_en: string;
      name_km: string | null;
      description_en: string | null;
      icon: string | null;
      sort_order: number;
      is_published: boolean;
      skills: Array<{
        id: string;
        slug: string;
        name_en: string;
        name_km: string | null;
        is_published: boolean;
        sort_order: number;
        skill_project_links: Array<{ project: { slug: string } | null }>;
      }>;
    }>).map((category) => ({
      id: category.id,
      slug: category.slug,
      nameEn: category.name_en,
      nameKm: category.name_km,
      descriptionEn: category.description_en,
      icon: category.icon,
      sortOrder: category.sort_order,
      isPublished: category.is_published,
      skills: (category.skills ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((skill) => ({
          id: skill.id,
          slug: skill.slug,
          nameEn: skill.name_en,
          nameKm: skill.name_km,
          isPublished: skill.is_published,
          sortOrder: skill.sort_order,
          projectSlugs: (skill.skill_project_links ?? [])
            .map((link) => link.project?.slug)
            .filter((slug): slug is string => Boolean(slug)),
        })),
    }));
  } catch {
    return [];
  }
}

// ── Resume versions ─────────────────────────────────────────────────────────

export type AdminResumeVersion = {
  id: string;
  versionLabel: string;
  locale: string;
  isActive: boolean;
  isArchived: boolean;
  notes: string | null;
  downloadCount: number;
  effectiveFrom: string;
  createdAt: string;
  filename: string | null;
  fileSizeBytes: number | null;
};

export async function listAdminResumeVersions(): Promise<AdminResumeVersion[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("resume_versions")
      .select(
        `id, version_label, locale, is_active, is_archived, notes, download_count,
         effective_from, created_at,
         asset:media_assets!resume_versions_media_id_fkey(original_filename, file_size_bytes)`,
      )
      .is("deleted_at", null)
      .order("is_active", { ascending: false })
      .order("effective_from", { ascending: false });

    if (error || !data) return [];

    return (data as unknown as Array<{
      id: string;
      version_label: string;
      locale: string;
      is_active: boolean;
      is_archived: boolean;
      notes: string | null;
      download_count: number;
      effective_from: string;
      created_at: string;
      asset: { original_filename: string; file_size_bytes: number } | null;
    }>).map((row) => ({
      id: row.id,
      versionLabel: row.version_label,
      locale: row.locale,
      isActive: row.is_active,
      isArchived: row.is_archived,
      notes: row.notes,
      downloadCount: row.download_count,
      effectiveFrom: row.effective_from,
      createdAt: row.created_at,
      filename: row.asset?.original_filename ?? null,
      fileSizeBytes: row.asset?.file_size_bytes ?? null,
    }));
  } catch {
    return [];
  }
}

/** Uploaded resume PDFs available to attach to a new version. */
export async function listResumeFileOptions(): Promise<
  Array<{ id: string; label: string }>
> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("media_assets")
      .select("id, original_filename, file_size_bytes, created_at")
      .eq("bucket_id", "resumes")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      label: `${row.original_filename} (${Math.round(row.file_size_bytes / 1024)} KB)`,
    }));
  } catch {
    return [];
  }
}

// ── SEO overrides ───────────────────────────────────────────────────────────

export type AdminSeoOverride = {
  routeKey: string;
  locale: string;
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  isIndexable: boolean;
  includeInSitemap: boolean;
};

export async function listSeoOverrides(): Promise<AdminSeoOverride[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("seo_overrides")
      .select(
        "route_key, locale, title, description, canonical_url, is_indexable, include_in_sitemap",
      )
      .order("route_key", { ascending: true })
      .order("locale", { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      routeKey: row.route_key,
      locale: row.locale,
      title: row.title,
      description: row.description,
      canonicalUrl: row.canonical_url,
      isIndexable: row.is_indexable,
      includeInSitemap: row.include_in_sitemap,
    }));
  } catch {
    return [];
  }
}

/**
 * Minimal experience header for the photo-management page.
 *
 * Deliberately not `listAdminExperience().find(...)`: that loads every entry with
 * every translation and tag to render one title.
 */
export async function getExperienceForPhotos(id: string): Promise<{
  slug: string;
  status: CvItem["status"];
  roleTitle: string;
} | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();

    const { data } = await supabase
      .from("experiences")
      .select("slug, status, experience_translations(locale, role_title)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!data) return null;

    const row = data as unknown as {
      slug: string;
      status: CvItem["status"];
      experience_translations: Array<{ locale: string; role_title: string }>;
    };

    return {
      slug: row.slug,
      status: row.status,
      roleTitle:
        row.experience_translations.find((item) => item.locale === "en")?.role_title ??
        row.slug,
    };
  } catch {
    return null;
  }
}

export async function getSiteSettingsRow(): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    return (data as Record<string, unknown> | null) ?? null;
  } catch {
    return null;
  }
}
