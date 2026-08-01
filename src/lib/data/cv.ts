import "server-only";

import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_COLUMNS, type MediaAsset } from "@/lib/content/media";
import {
  EXPERIENCE_MEDIA_COLUMNS,
  resolveExperiencePhoto,
  splitExperiencePhotos,
  type ExperiencePhoto,
  type ExperiencePhotoRow,
} from "@/lib/content/experience-media";
import {
  pickLocalized,
  resolveTranslation,
  type TranslationRow,
} from "@/lib/content/translation";
import type { Locale } from "@/i18n/config";

/**
 * Education, experience, capabilities and testimonials.
 *
 * Notes on two deliberate shapes:
 *
 *  - Dates are nullable and paired with a `periodLabel`. The migrated v1 content
 *    evidences years but not months, and the teaching practicum has no date at
 *    all, so the UI prefers the label and only formats a date when one really
 *    exists. Inventing a month to satisfy a `date` column would be fabrication.
 *
 *  - Capabilities carry no proficiency number. Evidence is expressed as links to
 *    the projects and credentials that demonstrate the skill, which is what
 *    replaces v1's percentage bars.
 */

// ── Education ───────────────────────────────────────────────────────────────

export type EducationEntry = {
  id: string;
  slug: string;
  kind: string;
  institution: string;
  institutionUrl: string | null;
  qualification: string | null;
  fieldOfStudy: string | null;
  description: string | null;
  achievements: string | null;
  periodLabel: string | null;
  scheduleLabel: string | null;
  startedOn: string | null;
  endedOn: string | null;
  isCurrent: boolean;
  gradeValue: string | null;
  gradeScale: string | null;
  gradeSourceNote: string | null;
  contentLocale: Locale | null;
  sortOrder: number;
};

export async function getEducation(locale: Locale): Promise<EducationEntry[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("education")
      .select(
        `id, slug, kind, institution_url, started_on, ended_on, is_current,
         period_label_en, period_label_km, schedule_label_en, schedule_label_km,
         grade_value, grade_scale, grade_source_note, sort_order,
         education_translations(locale, institution, qualification, field_of_study, description, achievements)`,
      )
      .order("sort_order", { ascending: true })
      .order("started_on", { ascending: false, nullsFirst: false });

    if (error || !data) return [];

    return data.map((row) => {
      const { row: translation, actualLocale } = resolveTranslation(
        row.education_translations as Array<
          TranslationRow & {
            institution: string;
            qualification: string | null;
            field_of_study: string | null;
            description: string | null;
            achievements: string | null;
          }
        >,
        locale,
      );

      return {
        id: row.id,
        slug: row.slug,
        kind: row.kind,
        institution: translation?.institution ?? row.slug,
        institutionUrl: row.institution_url,
        qualification: translation?.qualification ?? null,
        fieldOfStudy: translation?.field_of_study ?? null,
        description: translation?.description ?? null,
        achievements: translation?.achievements ?? null,
        periodLabel: pickLocalized(locale, row.period_label_en, row.period_label_km),
        scheduleLabel: pickLocalized(
          locale,
          row.schedule_label_en,
          row.schedule_label_km,
        ),
        startedOn: row.started_on,
        endedOn: row.ended_on,
        isCurrent: row.is_current,
        gradeValue: row.grade_value,
        gradeScale: row.grade_scale,
        gradeSourceNote: row.grade_source_note,
        contentLocale: actualLocale,
        sortOrder: row.sort_order,
      };
    });
  } catch {
    return [];
  }
}

// ── Experience ──────────────────────────────────────────────────────────────

export type ExperienceEntry = {
  id: string;
  slug: string;
  kind: string;
  roleTitle: string;
  organization: string;
  organizationUrl: string | null;
  location: string | null;
  summary: string | null;
  description: string | null;
  achievements: string | null;
  periodLabel: string | null;
  startedOn: string | null;
  endedOn: string | null;
  isCurrent: boolean;
  tags: Array<{ id: string; label: string }>;
  contentLocale: Locale | null;
  /**
   * Photographs cleared for publication.
   *
   * Always present, frequently empty — an entry with no photos is normal, not a
   * degraded state, and the page renders it identically minus the figure.
   */
  cover: ExperiencePhoto | null;
  gallery: ExperiencePhoto[];
};

export async function getExperiences(locale: Locale): Promise<ExperienceEntry[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("experiences")
      .select(
        `id, slug, kind, organization_url, location_en, location_km,
         started_on, ended_on, is_current, period_label_en, period_label_km, sort_order,
         experience_translations(locale, role_title, organization, summary, description, achievements),
         experience_tags(id, label_en, label_km, sort_order),
         experience_media(${EXPERIENCE_MEDIA_COLUMNS}, media_assets(${MEDIA_COLUMNS}))`,
      )
      .order("sort_order", { ascending: true })
      .order("started_on", { ascending: false, nullsFirst: false });

    if (error || !data) return [];

    return data.map((row) => {
      const { row: translation, actualLocale } = resolveTranslation(
        row.experience_translations as Array<
          TranslationRow & {
            role_title: string;
            organization: string;
            summary: string | null;
            description: string | null;
            achievements: string | null;
          }
        >,
        locale,
      );

      const tags = (
        row.experience_tags as Array<{
          id: string;
          label_en: string;
          label_km: string | null;
          sort_order: number;
        }>
      )
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((tag) => ({
          id: tag.id,
          label: pickLocalized(locale, tag.label_en, tag.label_km) ?? tag.label_en,
        }));

      /*
       * No `status`/`privacy` filtering here, matching every other public query
       * in this file: RLS already restricts the join to attachments that are
       * public, privacy-approved, consent-settled and pointing at a live public
       * asset. Re-filtering in the query would suggest the database were not the
       * gate, and a forgotten clause would then become a leak.
       *
       * Cover first, then gallery order — `sort_order` alone would let a cover
       * added last sort to the end of its own entry.
       */
      const photos = (
        (row.experience_media ?? []) as unknown as ExperiencePhotoRow[]
      )
        .slice()
        .sort((a, b) => {
          if (a.role !== b.role) return a.role === "cover" ? -1 : 1;
          return a.sort_order - b.sort_order;
        })
        .map((photo) => resolveExperiencePhoto(photo, locale))
        .filter((photo): photo is ExperiencePhoto => photo !== null);

      const { cover, gallery } = splitExperiencePhotos(photos);

      return {
        id: row.id,
        slug: row.slug,
        kind: row.kind,
        roleTitle: translation?.role_title ?? row.slug,
        organization: translation?.organization ?? "",
        organizationUrl: row.organization_url,
        location: pickLocalized(locale, row.location_en, row.location_km),
        summary: translation?.summary ?? null,
        description: translation?.description ?? null,
        achievements: translation?.achievements ?? null,
        periodLabel: pickLocalized(locale, row.period_label_en, row.period_label_km),
        startedOn: row.started_on,
        endedOn: row.ended_on,
        isCurrent: row.is_current,
        tags,
        contentLocale: actualLocale,
        cover,
        gallery,
      };
    });
  } catch {
    return [];
  }
}

// ── Capabilities ────────────────────────────────────────────────────────────

export type CapabilityGroup = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  skills: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    /** Published projects that evidence this capability. */
    projects: Array<{ id: string; slug: string; title: string }>;
  }>;
};

export async function getCapabilityGroups(locale: Locale): Promise<CapabilityGroup[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("skill_categories")
      .select(
        `id, slug, name_en, name_km, description_en, description_km, icon, sort_order,
         skills(
           id, slug, name_en, name_km, description_en, description_km, sort_order, is_published,
           skill_project_links(
             project:projects(id, slug, project_translations(locale, title))
           )
         )`,
      )
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return data.map((group) => ({
      id: group.id,
      slug: group.slug,
      name: pickLocalized(locale, group.name_en, group.name_km) ?? group.slug,
      description: pickLocalized(locale, group.description_en, group.description_km),
      icon: group.icon,
      skills: (
        group.skills as Array<{
          id: string;
          slug: string;
          name_en: string;
          name_km: string | null;
          description_en: string | null;
          description_km: string | null;
          sort_order: number;
          is_published: boolean;
          skill_project_links: Array<{
            project: {
              id: string;
              slug: string;
              project_translations: Array<TranslationRow & { title: string }>;
            } | null;
          }>;
        }>
      )
        .filter((skill) => skill.is_published)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((skill) => ({
          id: skill.id,
          slug: skill.slug,
          name: pickLocalized(locale, skill.name_en, skill.name_km) ?? skill.slug,
          description: pickLocalized(
            locale,
            skill.description_en,
            skill.description_km,
          ),
          projects: skill.skill_project_links
            .map((link) => link.project)
            .filter((project) => project !== null)
            .map((project) => {
              const { row: translation } = resolveTranslation(
                project.project_translations,
                locale,
              );
              return {
                id: project.id,
                slug: project.slug,
                title: translation?.title ?? project.slug,
              };
            }),
        })),
    }));
  } catch {
    return [];
  }
}

// ── Testimonials ────────────────────────────────────────────────────────────

/**
 * Note what this type does NOT contain: any rating, and any private contact
 * detail. v1 rendered invented five-star ratings and one referee's mobile
 * number; neither is representable here.
 */
export type Testimonial = {
  id: string;
  slug: string;
  authorName: string;
  authorUrl: string | null;
  relationship: string | null;
  quote: string;
  authorRole: string | null;
  organization: string | null;
  avatar: MediaAsset | null;
  contentLocale: Locale | null;
};

export async function getTestimonials(locale: Locale): Promise<Testimonial[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("testimonials")
      .select(
        `id, slug, author_name_en, author_name_km, author_url, relationship, sort_order,
         avatar:media_assets!testimonials_avatar_media_id_fkey(${MEDIA_COLUMNS}),
         testimonial_translations(locale, quote, author_role, organization)`,
      )
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return data
      .map((row) => {
        const { row: translation, actualLocale } = resolveTranslation(
          row.testimonial_translations as Array<
            TranslationRow & {
              quote: string;
              author_role: string | null;
              organization: string | null;
            }
          >,
          locale,
        );

        if (!translation) return null;

        return {
          id: row.id,
          slug: row.slug,
          authorName:
            pickLocalized(locale, row.author_name_en, row.author_name_km) ??
            row.author_name_en,
          authorUrl: row.author_url,
          relationship: row.relationship,
          quote: translation.quote,
          authorRole: translation.author_role,
          organization: translation.organization,
          avatar: (row.avatar as MediaAsset | null) ?? null,
          contentLocale: actualLocale,
        };
      })
      .filter((item): item is Testimonial => item !== null);
  } catch {
    return [];
  }
}
