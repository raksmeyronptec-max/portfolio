import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { publicStorageUrl, type MediaAsset } from "@/lib/content/media";
import { MEDIA_COLUMNS } from "@/lib/content/media";
import {
  isPubliclyRendered,
  photoPublishBlockers,
  type ConsentStatus,
  type MediaVisibility,
  type PrivacyStatus,
} from "@/lib/validation/experience-media";

/**
 * Admin-side loaders for experience photographs.
 *
 * Read through the RLS-constrained client, not the service role: an admin is a
 * real authenticated user with a role, and the admin read policy already grants
 * them everything including drafts, hidden attachments and rejected ones. Using
 * the service role here would work identically and would therefore hide a broken
 * policy instead of failing on it.
 */

export type AdminExperiencePhoto = {
  id: string;
  mediaId: string;
  role: "cover" | "gallery";
  sortOrder: number;

  /** Preview URL for the admin UI. `null` for a private asset, which has none. */
  thumbnailSrc: string | null;
  filename: string;
  mimeType: string;
  isPrivateAsset: boolean;

  captionEn: string | null;
  captionKm: string | null;
  altTextEn: string | null;
  altTextKm: string | null;
  /** The asset's own alt text, shown as the fallback the public page would use. */
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

  /** True when this attachment is currently rendered publicly. */
  isLive: boolean;
  /** Message codes explaining why it is not, if it is not. */
  blockers: string[];
};

type JoinedRow = {
  id: string;
  media_id: string;
  role: string;
  sort_order: number;
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
  media_assets:
    | (MediaAsset & { original_filename?: string | null })
    | null;
};

const ATTACHMENT_COLUMNS = `
  id, media_id, role, sort_order, caption_en, caption_km, alt_text_en, alt_text_km,
  photo_date, location_en, location_km, credit, privacy_status, consent_status,
  visibility, focal_x, focal_y, review_note, reviewed_at
`;

function toAdminPhoto(row: JoinedRow): AdminExperiencePhoto {
  const asset = row.media_assets;
  const isPrivateAsset = !asset || asset.visibility !== "public";

  return {
    id: row.id,
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
    filename: asset?.original_filename ?? "Unavailable",
    mimeType: asset?.mime_type ?? "",
    isPrivateAsset,

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
    blockers: photoPublishBlockers({
      privacyStatus: row.privacy_status,
      consentStatus: row.consent_status,
      // The public page falls back to the asset's alt text, so the gap only
      // counts as a blocker when neither carries one.
      altTextEn: row.alt_text_en ?? asset?.alt_text_en ?? null,
    }),
  };
}

export async function listExperiencePhotos(
  experienceId: string,
): Promise<AdminExperiencePhoto[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("experience_media")
      .select(`${ATTACHMENT_COLUMNS}, media_assets(${MEDIA_COLUMNS}, original_filename)`)
      .eq("experience_id", experienceId)
      .is("deleted_at", null)
      .order("role", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return (data as unknown as JoinedRow[]).map(toAdminPhoto);
  } catch {
    return [];
  }
}

/**
 * Per-experience photo summary for the admin list.
 *
 * One query for every entry rather than N queries, because the list renders all
 * of them at once and the counts are the whole reason the row is worth reading.
 */
export type ExperienceMediaSummary = {
  total: number;
  live: number;
  hasCover: boolean;
  pendingReview: number;
  missingAltText: number;
  missingKhmerCaption: number;
};

export const EMPTY_MEDIA_SUMMARY: ExperienceMediaSummary = {
  total: 0,
  live: 0,
  hasCover: false,
  pendingReview: 0,
  missingAltText: 0,
  missingKhmerCaption: 0,
};

export async function getExperienceMediaSummaries(): Promise<
  Record<string, ExperienceMediaSummary>
> {
  if (!isSupabaseConfigured()) return {};

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("experience_media")
      .select(
        `experience_id, role, privacy_status, consent_status, visibility,
         alt_text_en, caption_km,
         media_assets(alt_text_en, caption_km)`,
      )
      .is("deleted_at", null);

    if (error || !data) return {};

    const summaries: Record<string, ExperienceMediaSummary> = {};

    for (const row of data as unknown as Array<{
      experience_id: string;
      role: string;
      privacy_status: PrivacyStatus;
      consent_status: ConsentStatus;
      visibility: MediaVisibility;
      alt_text_en: string | null;
      caption_km: string | null;
      media_assets: { alt_text_en: string | null; caption_km: string | null } | null;
    }>) {
      const current = summaries[row.experience_id] ?? { ...EMPTY_MEDIA_SUMMARY };

      current.total += 1;
      if (row.role === "cover") current.hasCover = true;
      if (row.privacy_status === "pending_review") current.pendingReview += 1;

      if (
        isPubliclyRendered({
          visibility: row.visibility,
          privacyStatus: row.privacy_status,
          consentStatus: row.consent_status,
        })
      ) {
        current.live += 1;
      }

      const altText = row.alt_text_en ?? row.media_assets?.alt_text_en ?? null;
      if (!altText?.trim()) current.missingAltText += 1;

      const captionKm = row.caption_km ?? row.media_assets?.caption_km ?? null;
      if (!captionKm?.trim()) current.missingKhmerCaption += 1;

      summaries[row.experience_id] = current;
    }

    return summaries;
  } catch {
    return {};
  }
}

/**
 * Images eligible to be attached to an experience.
 *
 * Restricted to public images, because a private asset has no public URL and
 * could never be rendered — offering one in the picker would be offering a
 * choice that silently does nothing. PDFs are excluded for the same reason: the
 * gallery renders `<img>`, not an object embed.
 *
 * `experience_photo` assets are listed first since that is what the admin almost
 * always wants, but the other public kinds remain selectable: a screenshot
 * already uploaded for a project is a legitimate illustration of the
 * "Full-Stack Product Builder" role, and forcing a duplicate upload would put
 * the same bytes in the bucket twice.
 */
export type MediaPickerOption = {
  id: string;
  filename: string;
  kind: string;
  thumbnailSrc: string | null;
  altTextEn: string | null;
  altTextKm: string | null;
  captionEn: string | null;
  captionKm: string | null;
  width: number | null;
  height: number | null;
  /** Experience entries already using this asset, for the usage hint. */
  usedBy: string[];
};

export async function listAttachableMedia(): Promise<MediaPickerOption[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("media_assets")
      .select(`${MEDIA_COLUMNS}, original_filename, kind`)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .neq("mime_type", "application/pdf")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error || !data) return [];

    const usage = await getMediaUsageByExperience();

    return (
      data as unknown as Array<
        MediaAsset & { original_filename: string; kind: string }
      >
    )
      .map((asset) => ({
        id: asset.id,
        filename: asset.original_filename,
        kind: asset.kind,
        thumbnailSrc: publicStorageUrl(
          asset.bucket_id,
          asset.thumbnail_path ?? asset.card_path ?? asset.storage_path,
          asset.storage_provider,
        ),
        altTextEn: asset.alt_text_en,
        altTextKm: asset.alt_text_km,
        captionEn: asset.caption_en,
        captionKm: asset.caption_km,
        width: asset.width,
        height: asset.height,
        usedBy: usage[asset.id] ?? [],
      }))
      .sort((a, b) => {
        const aIsPhoto = a.kind === "experience_photo" ? 0 : 1;
        const bIsPhoto = b.kind === "experience_photo" ? 0 : 1;
        return aIsPhoto - bIsPhoto;
      });
  } catch {
    return [];
  }
}

/**
 * Which experiences use each media asset, keyed by asset id.
 *
 * Powers the "Used by: Second-Year Teaching Practicum" line in the media library
 * and the guard that refuses to delete an attached asset. English role titles are
 * used because the admin interface is English throughout.
 */
export async function getMediaUsageByExperience(): Promise<Record<string, string[]>> {
  if (!isSupabaseConfigured()) return {};

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("experience_media")
      .select(
        `media_id,
         experiences!inner(slug, experience_translations(locale, role_title))`,
      )
      .is("deleted_at", null);

    if (error || !data) return {};

    const usage: Record<string, string[]> = {};

    for (const row of data as unknown as Array<{
      media_id: string;
      experiences: {
        slug: string;
        experience_translations: Array<{ locale: string; role_title: string }>;
      } | null;
    }>) {
      const label =
        row.experiences?.experience_translations.find((item) => item.locale === "en")
          ?.role_title ??
        row.experiences?.slug ??
        "an experience entry";

      const current = usage[row.media_id] ?? [];
      if (!current.includes(label)) current.push(label);
      usage[row.media_id] = current;
    }

    return usage;
  } catch {
    return {};
  }
}
