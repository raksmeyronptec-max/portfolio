import { pickLocalized } from "./translation";
import { publicStorageUrl, type MediaAsset } from "./media";
import type { Locale } from "@/i18n/config";

/**
 * Resolution of an experience photograph for rendering.
 *
 * Deliberately isomorphic (no `server-only`): the lightbox is a Client Component
 * and receives already-resolved photos as props, so this module has to be
 * importable from both sides for its *types*. No query and no privileged
 * configuration lives here — only the merge rules.
 *
 * ── The merge ──────────────────────────────────────────────────────────────
 * Captions and alt text exist in two places, and that is intentional:
 *
 *   experience_media.caption_en   contextual — what this photo means *here*
 *   media_assets.caption_en       generic — what the file shows
 *
 * The same photograph can legitimately be attached to two experiences with two
 * different captions, so the attachment wins when it has a value and the asset is
 * the fallback. Blank strings count as absent, so clearing a contextual caption
 * reveals the generic one rather than rendering nothing.
 */

export type ExperiencePhotoRow = {
  id: string;
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
  focal_x: number | null;
  focal_y: number | null;
  media_assets: MediaAsset | null;
};

export type ExperiencePhoto = {
  id: string;
  role: "cover" | "gallery";
  /** Card-sized derivative — what the page renders inline. */
  src: string;
  /** Preview-sized derivative — loaded only when the lightbox opens. */
  fullSrc: string;
  thumbnailSrc: string;
  width: number | null;
  height: number | null;
  blurDataURL: string | null;
  alt: string;
  caption: string | null;
  location: string | null;
  credit: string | null;
  photoDate: string | null;
  /** CSS `object-position` value, or null for the default centre. */
  objectPosition: string | null;
};

function firstNonBlank(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim() !== "") return value;
  }
  return null;
}

/**
 * Turn a joined attachment row into render props, or `null` if it cannot be
 * displayed.
 *
 * Returning `null` rather than a partial object is the same defence
 * `resolveImage` makes: a caller cannot accidentally render a broken image, and —
 * more importantly — cannot leak a path for an asset that turned out to be
 * private. RLS should already have excluded such a row; this is the second gate.
 */
export function resolveExperiencePhoto(
  row: ExperiencePhotoRow,
  locale: Locale,
): ExperiencePhoto | null {
  const asset = row.media_assets;
  if (!asset) return null;
  if (asset.visibility !== "public") return null;
  if (asset.mime_type === "application/pdf") return null;

  const card = publicStorageUrl(
    asset.bucket_id,
    asset.card_path ?? asset.storage_path,
    asset.storage_provider,
  );
  if (!card) return null;

  const preview =
    publicStorageUrl(
      asset.bucket_id,
      asset.preview_path ?? asset.storage_path,
      asset.storage_provider,
    ) ?? card;

  const thumbnail =
    publicStorageUrl(
      asset.bucket_id,
      asset.thumbnail_path ?? asset.card_path ?? asset.storage_path,
      asset.storage_provider,
    ) ?? card;

  /*
   * Alt text falls back attachment → asset → empty string.
   *
   * An empty result is left empty rather than filled with the caption or the
   * filename. A wrong description is worse than none: a screen reader announcing
   * "IMG_2481" or repeating the caption verbatim tells the listener nothing and
   * costs them time. The admin surfaces the gap instead, and the publication
   * check refuses to make such a photo public in the first place.
   */
  const alt =
    firstNonBlank(
      pickLocalized(locale, row.alt_text_en, row.alt_text_km),
      pickLocalized(locale, asset.alt_text_en, asset.alt_text_km),
    ) ?? "";

  const caption = firstNonBlank(
    pickLocalized(locale, row.caption_en, row.caption_km),
    pickLocalized(locale, asset.caption_en, asset.caption_km),
  );

  // Only emit object-position when a focal point was actually set, so the
  // default stays the browser's own centring rather than a hardcoded "50% 50%".
  const objectPosition =
    row.focal_x === null && row.focal_y === null
      ? null
      : `${((row.focal_x ?? 0.5) * 100).toFixed(2)}% ${((row.focal_y ?? 0.5) * 100).toFixed(2)}%`;

  return {
    id: row.id,
    role: row.role === "cover" ? "cover" : "gallery",
    src: card,
    fullSrc: preview,
    thumbnailSrc: thumbnail,
    // Derivatives have unknown dimensions, so only an unprocessed original
    // reports them. Callers use a fixed-ratio box either way, which is what
    // keeps CLS at zero.
    width: asset.card_path ? null : asset.width,
    height: asset.card_path ? null : asset.height,
    blurDataURL: asset.blur_data_url,
    alt,
    caption,
    location: pickLocalized(locale, row.location_en, row.location_km),
    credit: row.credit,
    photoDate: row.photo_date,
    objectPosition,
  };
}

/**
 * Split resolved photos into the cover and the gallery.
 *
 * The cover is whichever attachment carries `role = 'cover'`; there is at most
 * one, enforced by a partial unique index. When none is set the first gallery
 * photo is promoted, so an entry with photos always has something to lead with
 * and the admin is not forced to make a choice they do not care about.
 */
export function splitExperiencePhotos(photos: ExperiencePhoto[]): {
  cover: ExperiencePhoto | null;
  gallery: ExperiencePhoto[];
} {
  const explicitCover = photos.find((photo) => photo.role === "cover") ?? null;
  const rest = photos.filter((photo) => photo !== explicitCover);

  if (explicitCover) return { cover: explicitCover, gallery: rest };
  if (rest.length === 0) return { cover: null, gallery: [] };

  const [promoted, ...remaining] = rest;
  return { cover: promoted ?? null, gallery: remaining };
}

/** Columns to select from `experience_media`. Keeps the queries consistent. */
export const EXPERIENCE_MEDIA_COLUMNS = `
  id, role, sort_order, caption_en, caption_km, alt_text_en, alt_text_km,
  photo_date, location_en, location_km, credit, focal_x, focal_y
` as const;
