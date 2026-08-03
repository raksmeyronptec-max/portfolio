import { publicSupabaseEnv } from "@/lib/supabase/env";
import { isPublicBucket, type StorageProvider } from "@/lib/storage/buckets";
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
  /**
   * Which backend holds the bytes. Carried on the row rather than inferred,
   * because the logical bucket name is identical in both backends — see
   * migration 0018.
   */
  storage_provider: StorageProvider;
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

/**
 * Public URL for a stored object.
 *
 * Returns `null` for anything in a private bucket. That is the point: a private
 * certificate original has no permanent public URL, and this function refuses to
 * invent one. Private files are reached only through a signed URL minted
 * server-side after an owner-role check.
 *
 * `provider` says which backend to build the URL for. It is a required argument
 * rather than a defaulted one: an asset whose URL is built for the wrong backend
 * renders as a broken image with nothing in any log to explain it, so the call
 * site is made to state which one it means.
 *
 * Safe on the client — both branches read only public configuration.
 */
export function publicStorageUrl(
  bucketId: string,
  storagePath: string | null | undefined,
  provider: StorageProvider,
): string | null {
  if (!storagePath) return null;
  if (!isPublicBucket(bucketId)) return null;

  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");

  if (provider === "r2") {
    // Referenced literally so Next inlines it into the client bundle.
    const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    if (!base) return null;
    // The logical bucket is the first key segment inside the R2 bucket, which
    // is what keeps `storage_path` meaning the same thing in both backends.
    return `${base.replace(/\/+$/, "")}/${bucketId}/${encoded}`;
  }

  const env = publicSupabaseEnv();
  if (!env) return null;

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

  const src = publicStorageUrl(
    asset.bucket_id,
    derivative ?? asset.storage_path,
    asset.storage_provider,
  );
  if (!src) return null;

  return {
    src,
    // Derivative dimensions are unknown, so only the original reports them; the
    // caller then uses `fill` inside a fixed-ratio box, which avoids CLS either
    // way.
    width: derivative ? null : asset.width,
    height: derivative ? null : asset.height,
    alt: usableAltText(pickLocalized(locale, asset.alt_text_en, asset.alt_text_km)),
    blurDataURL: asset.blur_data_url,
    caption: pickLocalized(locale, asset.caption_en, asset.caption_km),
  };
}

/**
 * Filename-shaped alt text, rejected.
 *
 * The upload form pre-fills alt text from the file name as a convenience, and
 * on the live site a number of those were saved unedited. A screen-reader user
 * on the homepage heard "ptec underscore library underscore logo",
 * "krusmart dash one", "Book underscore coverrr" and "cover underscore seq" —
 * strings that describe the asset on disk and tell a reader nothing about the
 * picture.
 *
 * An empty alt is not a good outcome either, but it is a *better* one: an
 * image with `alt=""` is skipped as decorative, while a filename is announced
 * as though it were a description. `isMissingAltText()` below still reports the
 * gap to the admin's content-health panel, so this hides nothing from the
 * owner — it only stops the bad value reaching a visitor.
 *
 * Two signals only, and both are restricted to pure-ASCII strings:
 *
 *   1. an image or document extension — `photo.jpg`, `scan.pdf`;
 *   2. `snake_case` or `kebab-case` with no whitespace — `ptec_library_logo`,
 *      `krusmart-1`, `cover_bacii`, `Certificate_at_techno`.
 *
 * A first attempt also rejected any value with no whitespace, on the theory
 * that prose has spaces and filenames do not. Two unit tests caught what that
 * would have done: **Khmer is written without spaces between words**, so the
 * rule would have blanked essentially every Khmer alt string on the site — a
 * far worse accessibility regression than the one it was fixing. Hence the
 * ASCII-only guard on both signals.
 *
 * The cost of being this conservative is that weak-but-human values like
 * "covers" or "Diploma" still pass through. They are poor alt text and
 * `isMissingAltText()` does not flag them, but they are not machine noise, and
 * blanking a real word because it is short would trade one defect for another.
 */
export function usableAltText(value: string | null | undefined): string {
  const alt = value?.trim();
  if (!alt) return "";

  // Anything outside the ASCII range is prose in some language — leave it be.
  const isAscii = /^[\x20-\x7E]+$/.test(alt);
  if (!isAscii) return alt;

  /*
   * `[\w.()\[\]-]` rather than `[\w.-]`, because brackets are ordinary
   * filename characters and excluding them left a hole worth exactly one real
   * defect: the live certificates page announced a credential preview as
   * "ptec_certificate_(21-11-2024)". The parentheses failed the character
   * class, the string was judged prose, and a screen-reader user got the
   * filename read out. Same string without the brackets was correctly blanked.
   *
   * Still no whitespace in the class: a value with spaces is prose, and "Report
   * (final)" must keep passing.
   */
  const looksLikeFilename =
    /\.(png|jpe?g|webp|avif|gif|svg|heic|pdf)$/i.test(alt) ||
    (/^[\w.()[\]-]+$/.test(alt) && /[_-]/.test(alt));

  return looksLikeFilename ? "" : alt;
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
  id, bucket_id, storage_path, storage_provider, visibility, mime_type,
  file_size_bytes, width, height, blur_data_url, thumbnail_path, card_path,
  preview_path, alt_text_en, alt_text_km, caption_en, caption_km
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
