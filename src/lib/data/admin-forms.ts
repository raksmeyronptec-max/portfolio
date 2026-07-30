import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { locales } from "@/i18n/config";
import type { ProjectFormValues } from "@/components/admin/project-form";

/**
 * Form option lists and single-record loaders for the admin editors.
 *
 * All reads use the RLS-constrained client, so the editor cannot load a record the
 * signed-in role is not permitted to see.
 */

export type FormOption = { id: string; label: string };

export async function getProjectFormOptions(): Promise<{
  categories: FormOption[];
  technologies: FormOption[];
  media: FormOption[];
}> {
  if (!isSupabaseConfigured()) {
    return { categories: [], technologies: [], media: [] };
  }

  try {
    const supabase = await createSupabaseServerClient();

    const [categories, technologies, media] = await Promise.all([
      supabase
        .from("project_categories")
        .select("id, name_en, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("technologies")
        .select("id, name, group_name, sort_order")
        .order("sort_order", { ascending: true }),
      // Only public image assets are offerable as a cover or social image — a
      // private asset would render as a broken image on the public page.
      supabase
        .from("media_assets")
        .select("id, original_filename, alt_text_en, kind, width, height")
        .eq("visibility", "public")
        .neq("mime_type", "application/pdf")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    return {
      categories: (categories.data ?? []).map((row) => ({
        id: row.id,
        label: row.name_en,
      })),
      technologies: (technologies.data ?? []).map((row) => ({
        id: row.id,
        label: row.group_name ? `${row.name} · ${row.group_name}` : row.name,
      })),
      media: (media.data ?? []).map((row) => ({
        id: row.id,
        label: [
          row.alt_text_en || row.original_filename,
          row.width && row.height ? `${row.width}×${row.height}` : null,
        ]
          .filter(Boolean)
          .join(" — "),
      })),
    };
  } catch {
    return { categories: [], technologies: [], media: [] };
  }
}

/** Blank project, pre-populated with the safest defaults. */
export function emptyProjectFormValues(): ProjectFormValues {
  return {
    slug: "",
    // New content starts as a draft. Nothing is ever created already-public.
    status: "draft",
    project_status: "live",
    featured: false,
    sort_order: 0,
    role_en: null,
    role_km: null,
    organization_en: null,
    organization_km: null,
    team_size: null,
    duration_label_en: null,
    duration_label_km: null,
    period_label_en: null,
    period_label_km: null,
    year_label: null,
    live_url: null,
    repository_url: null,
    demo_video_url: null,
    cover_media_id: null,
    og_image_media_id: null,
    started_at: null,
    completed_at: null,
    needs_review: false,
    review_note: null,
    categoryIds: [],
    technologyIds: [],
    // A row for every locale, so the editor always has both tabs available rather
    // than having to "add" a language.
    translations: locales.map((locale) => ({
      locale,
      title: "",
      summary: null,
      overview: null,
      problem: null,
      target_users: null,
      goals: null,
      my_role: null,
      responsibilities: null,
      constraints: null,
      research: null,
      ux_decisions: null,
      architecture: null,
      database_decisions: null,
      key_features: null,
      security_notes: null,
      accessibility_notes: null,
      seo_notes: null,
      performance_notes: null,
      challenges: null,
      solution: null,
      results: null,
      lessons: null,
      next_steps: null,
      seo_title: null,
      seo_description: null,
    })),
  };
}

export async function getProjectFormValues(
  projectId: string,
): Promise<ProjectFormValues | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("projects")
      .select(
        `*, project_translations(*),
         project_category_links(category_id),
         project_technologies(technology_id, sort_order)`,
      )
      .eq("id", projectId)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as Record<string, unknown> & {
      project_translations: Array<Record<string, unknown>>;
      project_category_links: Array<{ category_id: string }>;
      project_technologies: Array<{ technology_id: string; sort_order: number }>;
    };

    const base = emptyProjectFormValues();

    // Merge stored translations over the blank set, so a locale that has never
    // been written still gets an editable tab.
    const translations = base.translations.map((blank) => {
      const stored = row.project_translations.find(
        (item) => item.locale === blank.locale,
      );
      if (!stored) return blank;

      return {
        ...blank,
        ...Object.fromEntries(
          Object.entries(stored).filter(([key]) => key in blank),
        ),
        locale: blank.locale,
        title: (stored.title as string) ?? "",
      } as (typeof base.translations)[number];
    });

    return {
      id: projectId,
      slug: (row.slug as string) ?? "",
      status: row.status as ProjectFormValues["status"],
      project_status: row.project_status as ProjectFormValues["project_status"],
      featured: Boolean(row.featured),
      sort_order: Number(row.sort_order ?? 0),
      role_en: (row.role_en as string | null) ?? null,
      role_km: (row.role_km as string | null) ?? null,
      organization_en: (row.organization_en as string | null) ?? null,
      organization_km: (row.organization_km as string | null) ?? null,
      team_size: (row.team_size as number | null) ?? null,
      duration_label_en: (row.duration_label_en as string | null) ?? null,
      duration_label_km: (row.duration_label_km as string | null) ?? null,
      period_label_en: (row.period_label_en as string | null) ?? null,
      period_label_km: (row.period_label_km as string | null) ?? null,
      year_label: (row.year_label as string | null) ?? null,
      live_url: (row.live_url as string | null) ?? null,
      repository_url: (row.repository_url as string | null) ?? null,
      demo_video_url: (row.demo_video_url as string | null) ?? null,
      cover_media_id: (row.cover_media_id as string | null) ?? null,
      og_image_media_id: (row.og_image_media_id as string | null) ?? null,
      started_at: (row.started_at as string | null) ?? null,
      completed_at: (row.completed_at as string | null) ?? null,
      needs_review: Boolean(row.needs_review),
      review_note: (row.review_note as string | null) ?? null,
      categoryIds: row.project_category_links.map((link) => link.category_id),
      technologyIds: row.project_technologies
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((link) => link.technology_id),
      translations,
    };
  } catch {
    return null;
  }
}
