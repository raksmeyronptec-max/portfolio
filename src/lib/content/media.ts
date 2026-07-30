import { publicSupabaseEnv } from "@/lib/supabase/env";
import { pickLocalized } from "./translation";
import type { Locale } from "@/i18n/config";

/**
 * Media asset shape used throughout the app. Narrower than the table row so
 * callers cannot accidentally depend on private columns.
 */
export type MediaAsset = {
  id: string;
  bucket_id: string;
  storage_path: string;
  visibility: "public" | "private";
  mime_type: string;
  file_size_bytes: number;
  width: number | null;
  height: number | null;
  blur_data_url: string | null;
  thumbnail_path: string | null;
  card_path: string | null;
  preview_path: string | null;
  alt_text_en: string | null;
  alt_text_km: string | null;
  caption_en: string | null;
  caption_km: string | null;
};

export type ResolvedImage = {
  src: string;
  width: number | null;
  height: number | null;
  alt: string;
  blurDataURL: string | null;
  caption: string | null;
};

const PUBLIC_BUCKETS = new Set(["public-media", "certificate-previews"]);

/**
 * Public URL for a stored object.
 *
 * Returns `null` for anything in a private bucket. That is the point: a private
 * certificate original has no permanent public URL, and this function refuses to
 * invent one. Private files are reached only through a signed URL minted
 * server-side after an owner-role check.
 */
export function publicStorageUrl(
  bucketId: string,
  storagePath: string | null | undefined,
): string | null {
  if (!storagePath) return null;
  if (!PUBLIC_BUCKETS.has(bucketId)) return null;

  const env = publicSupabaseEnv();
  if (!env) return null;

  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${env.url}/storage/v1/object/public/${bucketId}/${encoded}`;
}

/**
 * Turn a media row into props for `next/image`.
 *
 * `size` selects a pre-generated derivative rather than asking the image
 * optimiser to downscale the original, which keeps certificate scans and large
 * screenshots off the hot path.
 *
 * Returns `null` when the asset is private or unresolvable, so a caller cannot
 * render a broken image — and cannot leak a private path.
 */
export function resolveImage(
  asset: MediaAsset | null | undefined,
  locale: Locale,
  size: "thumbnail" | "card" | "preview" | "original" = "card",
): ResolvedImage | null {
  if (!asset) return null;
  if (asset.visibility !== "public") return null;

  const derivative =
    size === "thumbnail"
      ? asset.thumbnail_path
      : size === "card"
        ? asset.card_path
        : size === "preview"
          ? asset.preview_path
          : null;

  const src = publicStorageUrl(asset.bucket_id, derivative ?? asset.storage_path);
  if (!src) return null;

  return {
    src,
    // Derivative dimensions are unknown, so only the original reports them; the
    // caller then uses `fill` inside a fixed-ratio box, which avoids CLS either
    // way.
    width: derivative ? null : asset.width,
    height: derivative ? null : asset.height,
    alt: pickLocalized(locale, asset.alt_text_en, asset.alt_text_km) ?? "",
    blurDataURL: asset.blur_data_url,
    caption: pickLocalized(locale, asset.caption_en, asset.caption_km),
  };
}

/**
 * True when a public image is missing alt text in the current locale.
 *
 * Alt text is a content field, so it can be absent. Rather than silently
 * shipping `alt=""` on a meaningful image, callers use this to surface the gap in
 * the admin's content-health panel.
 */
export function isMissingAltText(asset: MediaAsset | null | undefined): boolean {
  if (!asset) return false;
  if (asset.mime_type === "application/pdf") return false;
  const en = asset.alt_text_en?.trim();
  const km = asset.alt_text_km?.trim();
  return !en || !km;
}

/** Columns to select for a media asset. Keeps every query consistent. */
export const MEDIA_COLUMNS = `
  id, bucket_id, storage_path, visibility, mime_type, file_size_bytes,
  width, height, blur_data_url, thumbnail_path, card_path, preview_path,
  alt_text_en, alt_text_km, caption_en, caption_km
` as const;

/** Human-readable MIME label for download links. */
export function fileTypeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/avif": "AVIF",
    "image/gif": "GIF",
    "image/svg+xml": "SVG",
  };
  return map[mimeType] ?? mimeType;
}
