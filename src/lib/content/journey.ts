import { pickLocalized } from "./translation";
import { publicStorageUrl, type MediaAsset } from "./media";
import { formatDuration, parseVideoUrl, type JourneyMediaKind } from "@/lib/validation/journey";
import { localeMeta, type Locale } from "@/i18n/config";

/**
 * Resolution of journey media for rendering.
 *
 * Deliberately isomorphic (no `server-only`): the gallery and the video facade
 * are Client Components and receive already-resolved items as props, so this
 * module has to be importable from both sides for its types. No query and no
 * privileged configuration lives here — only the merge rules.
 *
 * ── The merge ──────────────────────────────────────────────────────────────
 * Captions and alt text exist in two places, and that is intentional:
 *
 *   journey_media.caption_en   contextual — what this image means *in this story*
 *   media_assets.caption_en    generic — what the file shows
 *
 * The attachment wins when it has a value; the asset is the fallback. Blank
 * strings count as absent, so clearing a contextual caption reveals the generic
 * one rather than rendering nothing.
 *
 * ── Why resolution can return null ─────────────────────────────────────────
 * `resolveJourneyMedia` returns `null` for anything it cannot render safely,
 * rather than a partial object. RLS should already have excluded such a row; this
 * is the second gate, and it is what stops a private storage path reaching the
 * client even if a policy is ever loosened by mistake.
 */

export type JourneyMediaRow = {
  id: string;
  kind: string;
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
  focal_x: number | null;
  focal_y: number | null;
  media_assets: MediaAsset | null;
};

/** A photograph, or a video's poster frame — the shared rendering shape. */
export type JourneyMediaItem = {
  id: string;
  kind: JourneyMediaKind;
  role: "cover" | "gallery";

  /** Card-sized derivative — what the page renders inline. */
  src: string;
  /** Preview-sized derivative — loaded only when the gallery opens. */
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

  // ── Video only ─────────────────────────────────────────────────────────
  video: {
    url: string;
    provider: "youtube" | "vimeo" | "other";
    /** Null when the provider is unrecognised — the renderer links out instead. */
    embedUrl: string | null;
    title: string;
    transcript: string | null;
    durationSeconds: number | null;
    /** Pre-formatted `1:23`, or null. */
    durationLabel: string | null;
  } | null;
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
 * A video without a poster asset resolves to `null` rather than rendering a
 * player with no facade. That case should be unreachable publicly — both the
 * CHECK constraint in migration 0024 and the Zod schema refuse a public video
 * without a poster — but the renderer refusing it too means a loosened rule
 * degrades to "the video does not appear" rather than to "a third-party iframe
 * loads on page render".
 */
export function resolveJourneyMedia(
  row: JourneyMediaRow,
  locale: Locale,
): JourneyMediaItem | null {
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

  const kind: JourneyMediaKind = row.kind === "video" ? "video" : "photo";

  /*
   * Alt text falls back attachment → asset → empty string.
   *
   * An empty result is left empty rather than filled with the caption or the
   * filename. A wrong description is worse than none: a screen reader announcing
   * "IMG_2481" or repeating the caption verbatim costs the listener time and
   * tells them nothing. The admin surfaces the gap instead, and the publication
   * check refuses to make such an item public in the first place.
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

  // Only emit object-position when a focal point was actually set, so the default
  // stays the browser's own centring rather than a hardcoded "50% 50%".
  const objectPosition =
    row.focal_x === null && row.focal_y === null
      ? null
      : `${((row.focal_x ?? 0.5) * 100).toFixed(2)}% ${((row.focal_y ?? 0.5) * 100).toFixed(2)}%`;

  let video: JourneyMediaItem["video"] = null;

  if (kind === "video") {
    if (!row.video_url) return null;

    /*
     * The embed URL is re-derived here rather than trusted from the stored
     * `video_provider`. The stored column is an index and a display hint; the
     * thing that ends up in an iframe `src` is computed from the URL every time,
     * so a row edited directly in Supabase Studio cannot inject an arbitrary
     * origin into the frame.
     */
    const parsed = parseVideoUrl(row.video_url);

    const title =
      firstNonBlank(pickLocalized(locale, row.video_title_en, row.video_title_km), caption, alt) ??
      "";

    video = {
      url: row.video_url,
      provider: parsed.provider,
      embedUrl: parsed.embedUrl,
      title,
      transcript: pickLocalized(locale, row.transcript_en, row.transcript_km),
      durationSeconds: row.duration_seconds,
      durationLabel: formatDuration(row.duration_seconds),
    };
  }

  return {
    id: row.id,
    kind,
    role: row.role === "cover" ? "cover" : "gallery",
    src: card,
    fullSrc: preview,
    thumbnailSrc: thumbnail,
    // Derivatives have unknown dimensions, so only an unprocessed original
    // reports them. Callers use a fixed-ratio box either way, which is what keeps
    // CLS at zero.
    width: asset.card_path ? null : asset.width,
    height: asset.card_path ? null : asset.height,
    blurDataURL: asset.blur_data_url,
    alt,
    caption,
    location: pickLocalized(locale, row.location_en, row.location_km),
    credit: row.credit,
    photoDate: row.photo_date,
    objectPosition,
    video,
  };
}

/**
 * Split resolved media into the cover and the rest.
 *
 * The cover is whichever attachment carries `role = 'cover'`; there is at most
 * one, enforced by a partial unique index. When none is set the first *photo* is
 * promoted — not the first item, because a video poster leading a story means the
 * page's most prominent element is a play button, and the entry-level cover is
 * chosen to be looked at rather than clicked. If a story is nothing but video,
 * the first video is used after all: something must lead it.
 */
export function splitJourneyMedia(items: JourneyMediaItem[]): {
  cover: JourneyMediaItem | null;
  gallery: JourneyMediaItem[];
} {
  const explicitCover = items.find((item) => item.role === "cover") ?? null;
  if (explicitCover) {
    return { cover: explicitCover, gallery: items.filter((i) => i !== explicitCover) };
  }

  const promoted = items.find((item) => item.kind === "photo") ?? items[0] ?? null;
  if (!promoted) return { cover: null, gallery: [] };

  return { cover: promoted, gallery: items.filter((i) => i !== promoted) };
}

// ── Entry-level shapes ──────────────────────────────────────────────────────

export type JourneyRelationTarget = {
  type: "experience" | "education" | "certificate" | "project";
  id: string;
  label: string;
  /** Populated only for types that have a public detail page. */
  href: string | null;
};

export type JourneyCategory = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
};

export type JourneyEntrySummary = {
  id: string;
  slug: string;
  featured: boolean;
  title: string;
  eyebrow: string | null;
  summary: string | null;
  category: JourneyCategory | null;
  /** Pre-formatted display period at the precision that is actually known. */
  periodLabel: string | null;
  /** Year for the timeline's grouping rail, or null when genuinely undated. */
  year: string | null;
  eventDate: string | null;
  location: string | null;
  organisation: string | null;
  cover: JourneyMediaItem | null;
  photoCount: number;
  videoCount: number;
  /** Locale the prose is actually written in, for the `lang` attribute. */
  contentLocale: Locale | null;
  isFallback: boolean;
  updatedAt: string;
};

export type JourneyEntryDetail = JourneyEntrySummary & {
  story: string | null;
  highlights: string[];
  externalUrl: string | null;
  gallery: JourneyMediaItem[];
  relations: JourneyRelationTarget[];
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
};

/**
 * The label the timeline groups by.
 *
 * Returns null rather than a placeholder year for an undated story. The timeline
 * then files those under an explicit "date to confirm" heading, which is honest;
 * inventing a year to sort by would put a story in the wrong place on a page
 * whose whole structure is chronological.
 */
export function journeyYear(input: {
  eventDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}): string | null {
  const source = input.eventDate ?? input.periodStart ?? input.periodEnd;
  if (!source) return null;
  const year = source.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

/**
 * Display period at the precision that is actually evidenced.
 *
 * The manually written `period_label_*` always wins — it is the field that exists
 * precisely so a human can say "2023 — 2028 (expected)" when no pair of dates
 * expresses that. Only when it is absent does this format the dates, and it
 * formats them at the recorded precision rather than at whatever the `date`
 * column happens to contain.
 */
export function formatJourneyPeriod(
  locale: Locale,
  input: {
    periodLabelEn: string | null;
    periodLabelKm: string | null;
    eventDate: string | null;
    datePrecision: string;
    periodStart: string | null;
    periodEnd: string | null;
  },
): string | null {
  const manual = pickLocalized(locale, input.periodLabelEn, input.periodLabelKm);
  if (manual) return manual;

  const intlLocale = localeMeta[locale].intlLocale;

  const format = (iso: string, precision: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso.slice(0, 4);

    if (precision === "year") {
      return new Intl.DateTimeFormat(intlLocale, { year: "numeric" }).format(date);
    }
    if (precision === "month") {
      return new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "long",
      }).format(date);
    }
    return new Intl.DateTimeFormat(intlLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  if (input.datePrecision === "range" || (input.periodStart && input.periodEnd)) {
    const start = input.periodStart ? format(input.periodStart, "month") : null;
    const end = input.periodEnd ? format(input.periodEnd, "month") : null;
    if (start && end) return `${start} — ${end}`;
    if (start) return start;
    if (end) return end;
  }

  if (input.datePrecision === "unknown") return null;
  if (!input.eventDate) return null;

  return format(input.eventDate, input.datePrecision);
}

/** Newline-separated bullets, matching how `achievements` works on experiences. */
export function splitHighlights(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

/** Columns to select from `journey_media`. Keeps every query consistent. */
export const JOURNEY_MEDIA_COLUMNS = `
  id, kind, role, sort_order, video_url, video_provider, duration_seconds,
  video_title_en, video_title_km, transcript_en, transcript_km,
  caption_en, caption_km, alt_text_en, alt_text_km,
  photo_date, location_en, location_km, credit, focal_x, focal_y
` as const;

/** Columns to select from `journey_entries` for a public read. */
export const JOURNEY_ENTRY_COLUMNS = `
  id, slug, featured, sort_order, event_date, date_precision,
  period_start, period_end, period_label_en, period_label_km,
  location_en, location_km, organisation_en, organisation_km,
  external_url, updated_at, published_at
` as const;
