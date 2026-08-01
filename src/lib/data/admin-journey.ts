import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_COLUMNS, publicStorageUrl, type MediaAsset } from "@/lib/content/media";
import { translationStatus } from "@/lib/content/translation";
import {
  isPubliclyRendered,
  type ConsentStatus,
  type MediaVisibility,
  type PrivacyStatus,
} from "@/lib/validation/media-privacy";
import {
  journeyMediaPublishBlockers,
  journeyPublishBlockers,
  parseVideoUrl,
  type DatePrecision,
  type JourneyMediaKind,
  type JourneyRelationType,
  type PublicationStatus,
} from "@/lib/validation/journey";

/**
 * Admin-side loaders for journey stories.
 *
 * Read through the RLS-constrained client, not the service role. An admin is a
 * real authenticated user with a role, and the admin read policies in migration
 * 0024 already grant them everything — drafts, hidden attachments, rejected ones.
 * Using the service role here would work identically and would therefore hide a
 * broken policy instead of failing on it.
 */

// ── List ────────────────────────────────────────────────────────────────────

export type AdminJourneySummary = {
  id: string;
  slug: string;
  status: PublicationStatus;
  featured: boolean;
  sortOrder: number;
  title: string;
  categoryName: string | null;
  periodLabel: string | null;
  eventDate: string | null;
  needsReview: boolean;
  reviewNote: string | null;
  translationStatus: "complete" | "partial" | "missing";
  hasCover: boolean;
  updatedAt: string;

  photoCount: number;
  videoCount: number;
  /** Attachments currently rendered on the public site. */
  liveCount: number;
  pendingReviewCount: number;
  missingAltTextCount: number;
  missingKhmerCaptionCount: number;
  relationCount: number;

  /** Message codes explaining why this story cannot be published. */
  publishBlockers: string[];
};

type MediaHealthRow = {
  kind: string;
  media_id: string | null;
  privacy_status: PrivacyStatus;
  consent_status: ConsentStatus;
  visibility: MediaVisibility;
  alt_text_en: string | null;
  caption_km: string | null;
  media_assets: { alt_text_en: string | null; caption_km: string | null } | null;
};

export async function listJourneyEntries(): Promise<AdminJourneySummary[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("journey_entries")
      .select(
        `id, slug, status, featured, sort_order, event_date, date_precision,
         period_label_en, period_label_km, cover_media_id, needs_review, review_note,
         updated_at,
         journey_categories(name_en),
         journey_entry_translations(locale, title),
         journey_relations(id),
         journey_media(
           kind, media_id, privacy_status, consent_status, visibility,
           alt_text_en, caption_km,
           media_assets(alt_text_en, caption_km)
         )`,
      )
      .is("deleted_at", null)
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return (
      data as unknown as Array<{
        id: string;
        slug: string;
        status: PublicationStatus;
        featured: boolean;
        sort_order: number;
        event_date: string | null;
        period_label_en: string | null;
        period_label_km: string | null;
        cover_media_id: string | null;
        needs_review: boolean;
        review_note: string | null;
        updated_at: string;
        journey_categories: { name_en: string } | null;
        journey_entry_translations: Array<{ locale: string; title: string }>;
        journey_relations: Array<{ id: string }>;
        journey_media: MediaHealthRow[];
      }>
    ).map((row) => {
      const translations = row.journey_entry_translations ?? [];
      const english = translations.find((t) => t.locale === "en");
      const media = row.journey_media ?? [];

      let liveCount = 0;
      let pendingReviewCount = 0;
      let missingAltTextCount = 0;
      let missingKhmerCaptionCount = 0;

      for (const item of media) {
        if (item.privacy_status === "pending_review") pendingReviewCount += 1;

        if (
          isPubliclyRendered({
            visibility: item.visibility,
            privacyStatus: item.privacy_status,
            consentStatus: item.consent_status,
          })
        ) {
          liveCount += 1;
        }

        // The public page falls back to the asset's own values, so a gap only
        // counts when neither the attachment nor the asset carries one.
        const alt = item.alt_text_en ?? item.media_assets?.alt_text_en ?? null;
        if (!alt?.trim()) missingAltTextCount += 1;

        const captionKm = item.caption_km ?? item.media_assets?.caption_km ?? null;
        if (!captionKm?.trim()) missingKhmerCaptionCount += 1;
      }

      return {
        id: row.id,
        slug: row.slug,
        status: row.status,
        featured: row.featured,
        sortOrder: row.sort_order,
        // English is the admin interface's language throughout, so the list shows
        // the English title and falls back rather than switching script mid-table.
        title: english?.title ?? translations[0]?.title ?? row.slug,
        categoryName: row.journey_categories?.name_en ?? null,
        periodLabel: row.period_label_en ?? row.period_label_km,
        eventDate: row.event_date,
        needsReview: row.needs_review,
        reviewNote: row.review_note,
        translationStatus: translationStatus(translations),
        hasCover: row.cover_media_id !== null || media.some((m) => m.kind === "photo"),
        updatedAt: row.updated_at,

        photoCount: media.filter((m) => m.kind === "photo").length,
        videoCount: media.filter((m) => m.kind === "video").length,
        liveCount,
        pendingReviewCount,
        missingAltTextCount,
        missingKhmerCaptionCount,
        relationCount: (row.journey_relations ?? []).length,

        publishBlockers: journeyPublishBlockers({
          needsReview: row.needs_review,
          hasEnglishTitle: Boolean(english?.title?.trim()),
        }),
      };
    });
  } catch {
    return [];
  }
}

// ── Single entry, for the editor ────────────────────────────────────────────

export type AdminJourneyTranslation = {
  locale: string;
  title: string;
  eyebrow: string | null;
  summary: string | null;
  story: string | null;
  highlights: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type AdminJourneyEntry = {
  id: string;
  slug: string;
  status: PublicationStatus;
  categoryId: string | null;
  featured: boolean;
  sortOrder: number;
  eventDate: string | null;
  datePrecision: DatePrecision;
  periodStart: string | null;
  periodEnd: string | null;
  periodLabelEn: string | null;
  periodLabelKm: string | null;
  locationEn: string | null;
  locationKm: string | null;
  organisationEn: string | null;
  organisationKm: string | null;
  externalUrl: string | null;
  coverMediaId: string | null;
  coverThumbnailSrc: string | null;
  needsReview: boolean;
  reviewNote: string | null;
  publishedAt: string | null;
  updatedAt: string;
  translations: AdminJourneyTranslation[];
};

export async function getJourneyEntryForEdit(
  id: string,
): Promise<AdminJourneyEntry | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("journey_entries")
      .select(
        `id, slug, status, category_id, featured, sort_order, event_date,
         date_precision, period_start, period_end, period_label_en, period_label_km,
         location_en, location_km, organisation_en, organisation_km, external_url,
         cover_media_id, needs_review, review_note, published_at, updated_at,
         journey_entry_translations(
           locale, title, eyebrow, summary, story, highlights, seo_title, seo_description
         ),
         media_assets:cover_media_id(${MEDIA_COLUMNS})`,
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as {
      id: string;
      slug: string;
      status: PublicationStatus;
      category_id: string | null;
      featured: boolean;
      sort_order: number;
      event_date: string | null;
      date_precision: DatePrecision;
      period_start: string | null;
      period_end: string | null;
      period_label_en: string | null;
      period_label_km: string | null;
      location_en: string | null;
      location_km: string | null;
      organisation_en: string | null;
      organisation_km: string | null;
      external_url: string | null;
      cover_media_id: string | null;
      needs_review: boolean;
      review_note: string | null;
      published_at: string | null;
      updated_at: string;
      journey_entry_translations: Array<{
        locale: string;
        title: string;
        eyebrow: string | null;
        summary: string | null;
        story: string | null;
        highlights: string | null;
        seo_title: string | null;
        seo_description: string | null;
      }>;
      media_assets: MediaAsset | null;
    };

    return {
      id: row.id,
      slug: row.slug,
      status: row.status,
      categoryId: row.category_id,
      featured: row.featured,
      sortOrder: row.sort_order,
      eventDate: row.event_date,
      datePrecision: row.date_precision,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      periodLabelEn: row.period_label_en,
      periodLabelKm: row.period_label_km,
      locationEn: row.location_en,
      locationKm: row.location_km,
      organisationEn: row.organisation_en,
      organisationKm: row.organisation_km,
      externalUrl: row.external_url,
      coverMediaId: row.cover_media_id,
      coverThumbnailSrc: row.media_assets
        ? publicStorageUrl(
            row.media_assets.bucket_id,
            row.media_assets.thumbnail_path ?? row.media_assets.card_path,
            row.media_assets.storage_provider,
          )
        : null,
      needsReview: row.needs_review,
      reviewNote: row.review_note,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      translations: (row.journey_entry_translations ?? []).map((t) => ({
        locale: t.locale,
        title: t.title,
        eyebrow: t.eyebrow,
        summary: t.summary,
        story: t.story,
        highlights: t.highlights,
        seoTitle: t.seo_title,
        seoDescription: t.seo_description,
      })),
    };
  } catch {
    return null;
  }
}

// ── Media attached to one story ─────────────────────────────────────────────

export type AdminJourneyMedia = {
  id: string;
  kind: JourneyMediaKind;
  mediaId: string | null;
  role: "cover" | "gallery";
  sortOrder: number;

  /** Preview URL for the admin UI. `null` for a private asset, which has none. */
  thumbnailSrc: string | null;
  filename: string | null;
  isPrivateAsset: boolean;

  videoUrl: string | null;
  videoProvider: string | null;
  /** Re-derived from the URL, so an unrecognised host is visible in the editor. */
  videoIsEmbeddable: boolean;
  durationSeconds: number | null;
  videoTitleEn: string | null;
  videoTitleKm: string | null;
  transcriptEn: string | null;
  transcriptKm: string | null;

  captionEn: string | null;
  captionKm: string | null;
  altTextEn: string | null;
  altTextKm: string | null;
  /** The asset's own values, shown as the fallback the public page would use. */
  assetAltTextEn: string | null;
  assetAltTextKm: string | null;

  photoDate: string | null;
  locationEn: string | null;
  locationKm: string | null;
  credit: string | null;

  privacyStatus: PrivacyStatus;
  consentStatus: ConsentStatus;
  visibility: MediaVisibility;
  focalX: number | null;
  focalY: number | null;
  reviewNote: string | null;
  reviewedAt: string | null;

  isLive: boolean;
  blockers: string[];
};

const ATTACHMENT_COLUMNS = `
  id, kind, media_id, role, sort_order, video_url, video_provider, duration_seconds,
  video_title_en, video_title_km, transcript_en, transcript_km,
  caption_en, caption_km, alt_text_en, alt_text_km,
  photo_date, location_en, location_km, credit,
  privacy_status, consent_status, visibility, focal_x, focal_y,
  review_note, reviewed_at
`;

type AttachmentRow = {
  id: string;
  kind: string;
  media_id: string | null;
  role: string;
  sort_order: number;
  video_url: string | null;
  video_provider: string | null;
  duration_seconds: number | null;
  video_title_en: string | null;
  video_title_km: string | null;
  transcript_en: string | null;
  transcript_km: string | null;
  caption_en: string | null;
  caption_km: string | null;
  alt_text_en: string | null;
  alt_text_km: string | null;
  photo_date: string | null;
  location_en: string | null;
  location_km: string | null;
  credit: string | null;
  privacy_status: PrivacyStatus;
  consent_status: ConsentStatus;
  visibility: MediaVisibility;
  focal_x: number | null;
  focal_y: number | null;
  review_note: string | null;
  reviewed_at: string | null;
  media_assets: (MediaAsset & { original_filename?: string | null }) | null;
};

function toAdminMedia(row: AttachmentRow): AdminJourneyMedia {
  const asset = row.media_assets;
  const kind: JourneyMediaKind = row.kind === "video" ? "video" : "photo";
  const parsed = parseVideoUrl(row.video_url);

  return {
    id: row.id,
    kind,
    mediaId: row.media_id,
    role: row.role === "cover" ? "cover" : "gallery",
    sortOrder: row.sort_order,

    thumbnailSrc: asset
      ? publicStorageUrl(
          asset.bucket_id,
          asset.thumbnail_path ?? asset.card_path ?? asset.storage_path,
          asset.storage_provider,
        )
      : null,
    filename: asset?.original_filename ?? null,
    isPrivateAsset: Boolean(asset) && asset?.visibility !== "public",

    videoUrl: row.video_url,
    videoProvider: row.video_provider,
    videoIsEmbeddable: parsed.embedUrl !== null,
    durationSeconds: row.duration_seconds,
    videoTitleEn: row.video_title_en,
    videoTitleKm: row.video_title_km,
    transcriptEn: row.transcript_en,
    transcriptKm: row.transcript_km,

    captionEn: row.caption_en,
    captionKm: row.caption_km,
    altTextEn: row.alt_text_en,
    altTextKm: row.alt_text_km,
    assetAltTextEn: asset?.alt_text_en ?? null,
    assetAltTextKm: asset?.alt_text_km ?? null,

    photoDate: row.photo_date,
    locationEn: row.location_en,
    locationKm: row.location_km,
    credit: row.credit,

    privacyStatus: row.privacy_status,
    consentStatus: row.consent_status,
    visibility: row.visibility,
    focalX: row.focal_x,
    focalY: row.focal_y,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,

    isLive: isPubliclyRendered({
      visibility: row.visibility,
      privacyStatus: row.privacy_status,
      consentStatus: row.consent_status,
    }),
    blockers: journeyMediaPublishBlockers({
      kind,
      privacyStatus: row.privacy_status,
      consentStatus: row.consent_status,
      altTextEn: row.alt_text_en ?? asset?.alt_text_en ?? null,
      hasPoster: row.media_id !== null,
    }),
  };
}

export async function listJourneyMedia(
  journeyEntryId: string,
): Promise<AdminJourneyMedia[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("journey_media")
      .select(`${ATTACHMENT_COLUMNS}, media_assets(${MEDIA_COLUMNS}, original_filename)`)
      .eq("journey_entry_id", journeyEntryId)
      .is("deleted_at", null)
      .order("role", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return (data as unknown as AttachmentRow[]).map(toAdminMedia);
  } catch {
    return [];
  }
}

// ── Relations ───────────────────────────────────────────────────────────────

export type AdminJourneyRelation = {
  id: string;
  type: JourneyRelationType;
  targetId: string;
  label: string;
  displayOrder: number;
};

export async function listJourneyRelations(
  journeyEntryId: string,
): Promise<AdminJourneyRelation[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("journey_relations")
      .select(
        `id, display_order, experience_id, education_id, certificate_id, project_id,
         experiences(slug, experience_translations(locale, role_title)),
         education(slug, education_translations(locale, institution)),
         certificates(slug, certificate_translations(locale, title)),
         projects(slug, project_translations(locale, title))`,
      )
      .eq("journey_entry_id", journeyEntryId)
      .order("display_order", { ascending: true });

    if (error || !data) return [];

    const englishLabel = (
      rows: Array<Record<string, unknown> & { locale: string }> | undefined,
      field: string,
    ): string | null => {
      const en = rows?.find((r) => r.locale === "en") ?? rows?.[0];
      const value = en?.[field];
      return typeof value === "string" && value.trim() !== "" ? value : null;
    };

    const out: AdminJourneyRelation[] = [];

    for (const raw of data as unknown as Array<{
      id: string;
      display_order: number;
      experience_id: string | null;
      education_id: string | null;
      certificate_id: string | null;
      project_id: string | null;
      experiences: {
        slug: string;
        experience_translations: Array<{ locale: string; role_title: string }>;
      } | null;
      education: {
        slug: string;
        education_translations: Array<{ locale: string; institution: string }>;
      } | null;
      certificates: {
        slug: string;
        certificate_translations: Array<{ locale: string; title: string }>;
      } | null;
      projects: {
        slug: string;
        project_translations: Array<{ locale: string; title: string }>;
      } | null;
    }>) {
      if (raw.experience_id && raw.experiences) {
        out.push({
          id: raw.id,
          type: "experience",
          targetId: raw.experience_id,
          label:
            englishLabel(raw.experiences.experience_translations, "role_title") ??
            raw.experiences.slug,
          displayOrder: raw.display_order,
        });
      } else if (raw.education_id && raw.education) {
        out.push({
          id: raw.id,
          type: "education",
          targetId: raw.education_id,
          label:
            englishLabel(raw.education.education_translations, "institution") ??
            raw.education.slug,
          displayOrder: raw.display_order,
        });
      } else if (raw.certificate_id && raw.certificates) {
        out.push({
          id: raw.id,
          type: "certificate",
          targetId: raw.certificate_id,
          label:
            englishLabel(raw.certificates.certificate_translations, "title") ??
            raw.certificates.slug,
          displayOrder: raw.display_order,
        });
      } else if (raw.project_id && raw.projects) {
        out.push({
          id: raw.id,
          type: "project",
          targetId: raw.project_id,
          label:
            englishLabel(raw.projects.project_translations, "title") ??
            raw.projects.slug,
          displayOrder: raw.display_order,
        });
      }
    }

    return out;
  } catch {
    return [];
  }
}

/** Everything a story can be linked to, grouped by type, for the picker. */
export type RelationOption = { id: string; label: string; status: string };

export async function listRelationTargets(): Promise<
  Record<JourneyRelationType, RelationOption[]>
> {
  const empty: Record<JourneyRelationType, RelationOption[]> = {
    experience: [],
    education: [],
    certificate: [],
    project: [],
  };

  if (!isSupabaseConfigured()) return empty;

  try {
    const supabase = await createSupabaseServerClient();

    const pick = (
      rows: Array<Record<string, unknown>> | null,
      translationKey: string,
      field: string,
    ): RelationOption[] =>
      (rows ?? []).map((row) => {
        const translations = row[translationKey] as
          | Array<Record<string, unknown> & { locale: string }>
          | undefined;
        const en = translations?.find((t) => t.locale === "en") ?? translations?.[0];
        const label = en?.[field];
        return {
          id: String(row.id),
          label:
            typeof label === "string" && label.trim() !== ""
              ? label
              : String(row.slug ?? row.id),
          status: String(row.status ?? "published"),
        };
      });

    const [experiences, education, certificates, projects] = await Promise.all([
      supabase
        .from("experiences")
        .select("id, slug, status, experience_translations(locale, role_title)")
        .is("deleted_at", null)
        .order("sort_order"),
      supabase
        .from("education")
        .select("id, slug, status, education_translations(locale, institution)")
        .is("deleted_at", null)
        .order("sort_order"),
      supabase
        .from("certificates")
        .select("id, slug, status, certificate_translations(locale, title)")
        .is("deleted_at", null)
        .order("issued_on", { ascending: false, nullsFirst: false }),
      supabase
        .from("projects")
        .select("id, slug, status, project_translations(locale, title)")
        .is("deleted_at", null)
        .order("sort_order"),
    ]);

    return {
      experience: pick(experiences.data, "experience_translations", "role_title"),
      education: pick(education.data, "education_translations", "institution"),
      certificate: pick(certificates.data, "certificate_translations", "title"),
      project: pick(projects.data, "project_translations", "title"),
    };
  } catch {
    return empty;
  }
}

/** Editable categories, for the entry form's select. */
export async function listJourneyCategories(): Promise<
  Array<{ id: string; slug: string; nameEn: string; nameKm: string | null }>
> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("journey_categories")
      .select("id, slug, name_en, name_km")
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      slug: row.slug,
      nameEn: row.name_en,
      nameKm: row.name_km,
    }));
  } catch {
    return [];
  }
}

// ── Media-library usage ─────────────────────────────────────────────────────

/**
 * Which stories use each media asset, keyed by asset id.
 *
 * Powers the "Used by" line in the media library and the guard that refuses to
 * delete an attached asset. English titles, because the admin interface is
 * English throughout.
 */
export async function getMediaUsageByJourney(): Promise<Record<string, string[]>> {
  if (!isSupabaseConfigured()) return {};

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("journey_media")
      .select(
        `media_id, journey_entries!inner(slug, journey_entry_translations(locale, title))`,
      )
      .is("deleted_at", null)
      .not("media_id", "is", null);

    if (error || !data) return {};

    const usage: Record<string, string[]> = {};

    for (const row of data as unknown as Array<{
      media_id: string | null;
      journey_entries: {
        slug: string;
        journey_entry_translations: Array<{ locale: string; title: string }>;
      } | null;
    }>) {
      if (!row.media_id) continue;

      const label =
        row.journey_entries?.journey_entry_translations.find((t) => t.locale === "en")
          ?.title ??
        row.journey_entries?.slug ??
        "a journey story";

      const current = usage[row.media_id] ?? [];
      if (!current.includes(label)) current.push(label);
      usage[row.media_id] = current;
    }

    return usage;
  } catch {
    return {};
  }
}

// ── Dashboard health ────────────────────────────────────────────────────────

export type JourneyHealth = {
  entries: number;
  published: number;
  drafts: number;
  featured: number;
  pendingMediaReview: number;
  missingKhmerCaptions: number;
  missingAltText: number;
  privateArchive: number;
  videosWithoutPoster: number;
  entriesWithoutDate: number;
  entriesWithoutCover: number;
  entriesMissingKhmer: number;
};

export const EMPTY_JOURNEY_HEALTH: JourneyHealth = {
  entries: 0,
  published: 0,
  drafts: 0,
  featured: 0,
  pendingMediaReview: 0,
  missingKhmerCaptions: 0,
  missingAltText: 0,
  privateArchive: 0,
  videosWithoutPoster: 0,
  entriesWithoutDate: 0,
  entriesWithoutCover: 0,
  entriesMissingKhmer: 0,
};

/**
 * The counts the admin dashboard shows.
 *
 * Two queries rather than a view, because the numbers are small and a view would
 * need its own RLS reasoning. If the media library ever outgrows this, the
 * `admin_content_health()` RPC in migration 0011 is where it should move.
 */
export async function getJourneyHealth(): Promise<JourneyHealth> {
  if (!isSupabaseConfigured()) return EMPTY_JOURNEY_HEALTH;

  try {
    const supabase = await createSupabaseServerClient();

    const [entriesResult, mediaResult] = await Promise.all([
      supabase
        .from("journey_entries")
        .select(
          `id, status, featured, event_date, date_precision, cover_media_id,
           journey_entry_translations(locale)`,
        )
        .is("deleted_at", null),
      supabase
        .from("journey_media")
        .select(
          `kind, media_id, privacy_status, visibility, alt_text_en, caption_km,
           media_assets(alt_text_en, caption_km)`,
        )
        .is("deleted_at", null),
    ]);

    const health = { ...EMPTY_JOURNEY_HEALTH };

    for (const row of (entriesResult.data ?? []) as unknown as Array<{
      status: string;
      featured: boolean;
      event_date: string | null;
      date_precision: string;
      cover_media_id: string | null;
      journey_entry_translations: Array<{ locale: string }>;
    }>) {
      health.entries += 1;
      if (row.status === "published") health.published += 1;
      if (row.status === "draft" || row.status === "in_review") health.drafts += 1;
      if (row.featured) health.featured += 1;
      if (!row.event_date && row.date_precision !== "range") health.entriesWithoutDate += 1;
      if (!row.cover_media_id) health.entriesWithoutCover += 1;
      if (!row.journey_entry_translations.some((t) => t.locale === "km")) {
        health.entriesMissingKhmer += 1;
      }
    }

    for (const row of (mediaResult.data ?? []) as unknown as MediaHealthRow[]) {
      if (row.privacy_status === "pending_review") health.pendingMediaReview += 1;
      if (row.visibility === "private") health.privateArchive += 1;
      if (row.kind === "video" && !row.media_id) health.videosWithoutPoster += 1;

      const alt = row.alt_text_en ?? row.media_assets?.alt_text_en ?? null;
      if (!alt?.trim()) health.missingAltText += 1;

      const captionKm = row.caption_km ?? row.media_assets?.caption_km ?? null;
      if (!captionKm?.trim()) health.missingKhmerCaptions += 1;
    }

    return health;
  } catch {
    return EMPTY_JOURNEY_HEALTH;
  }
}
