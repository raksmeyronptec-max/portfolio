import { describe, expect, it } from "vitest";

import {
  formatDuration,
  isoDuration,
  journeyEntrySchema,
  journeyMediaPublishBlockers,
  journeyMediaSchema,
  journeyPublishBlockers,
  parseVideoUrl,
} from "@/lib/validation/journey";
import { isPubliclyRendered, mediaPublishBlockers } from "@/lib/validation/media-privacy";
import {
  formatJourneyPeriod,
  journeyYear,
  resolveJourneyMedia,
  splitHighlights,
  splitJourneyMedia,
  type JourneyMediaItem,
  type JourneyMediaRow,
} from "@/lib/content/journey";
import { semanticFilename } from "@/lib/media/import-scan";
import type { MediaAsset } from "@/lib/content/media";

/**
 * Journey unit tests.
 *
 * The emphasis is deliberate. Most of what follows exercises the *refusals* —
 * the cases where a photograph must not become public, where a URL must not
 * reach an iframe, and where a date must not be invented. Those are the
 * behaviours the whole feature exists to guarantee, and the ones a future
 * refactor is most likely to quietly relax.
 */

// ── Fixtures ────────────────────────────────────────────────────────────────

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset-1",
    bucket_id: "public-media",
    storage_path: "journey/2026/08/abc-photo.webp",
    storage_provider: "supabase",
    visibility: "public",
    mime_type: "image/webp",
    file_size_bytes: 1024,
    width: 1600,
    height: 1200,
    blur_data_url: null,
    thumbnail_path: "journey/2026/08/abc-photo-thumb.webp",
    card_path: "journey/2026/08/abc-photo-card.webp",
    preview_path: "journey/2026/08/abc-photo-preview.webp",
    alt_text_en: "Asset alt",
    alt_text_km: null,
    caption_en: "Asset caption",
    caption_km: null,
    ...overrides,
  };
}

function mediaRow(overrides: Partial<JourneyMediaRow> = {}): JourneyMediaRow {
  return {
    id: "attachment-1",
    kind: "photo",
    role: "gallery",
    sort_order: 0,
    video_url: null,
    video_provider: null,
    duration_seconds: null,
    video_title_en: null,
    video_title_km: null,
    transcript_en: null,
    transcript_km: null,
    caption_en: null,
    caption_km: null,
    alt_text_en: null,
    alt_text_km: null,
    photo_date: null,
    location_en: null,
    location_km: null,
    credit: null,
    focal_x: null,
    focal_y: null,
    media_assets: asset(),
    ...overrides,
  };
}

function validMediaInput(overrides: Record<string, unknown> = {}) {
  return {
    kind: "photo",
    role: "gallery",
    sortOrder: 0,
    mediaId: "11111111-1111-4111-8111-111111111111",
    privacyStatus: "pending_review",
    consentStatus: "pending",
    visibility: "private",
    ...overrides,
  };
}

function validEntryInput(overrides: Record<string, unknown> = {}) {
  return {
    slug: "science-fair-activities",
    status: "draft",
    featured: false,
    sortOrder: 0,
    datePrecision: "unknown",
    needsReview: false,
    translations: [{ locale: "en", title: "Science Fair Activities" }],
    ...overrides,
  };
}

// ── Video URL parsing ───────────────────────────────────────────────────────

describe("parseVideoUrl", () => {
  it("recognises the standard YouTube watch URL", () => {
    const result = parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.provider).toBe("youtube");
    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.embedUrl).toContain("youtube-nocookie.com");
  });

  it("recognises youtu.be, /embed/, /live/ and /shorts/ forms", () => {
    for (const url of [
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/live/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ]) {
      expect(parseVideoUrl(url).videoId, url).toBe("dQw4w9WgXcQ");
    }
  });

  it("uses the nocookie domain and never sets autoplay", () => {
    const { embedUrl } = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(embedUrl).toMatch(/^https:\/\/www\.youtube-nocookie\.com\//);
    expect(embedUrl).not.toContain("autoplay");
  });

  it("rejects an id that is not YouTube's 11-character format", () => {
    // Guards the embed URL against arbitrary path injection.
    expect(parseVideoUrl("https://youtu.be/../../evil").videoId).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/watch?v=short").videoId).toBeNull();
  });

  it("recognises a plain numeric Vimeo URL and sets dnt", () => {
    const result = parseVideoUrl("https://vimeo.com/123456789");
    expect(result.provider).toBe("vimeo");
    expect(result.embedUrl).toContain("dnt=1");
  });

  it("refuses to build an embed for an unlisted Vimeo URL with a private hash", () => {
    /*
     * The private hash is what makes an unlisted video reachable. Folding it into
     * an embed URL would republish a link the owner may have deliberately kept
     * unlisted, so the URL is recognised as Vimeo but gets no embed.
     */
    const result = parseVideoUrl("https://vimeo.com/123456789/abcdef0123");
    expect(result.provider).toBe("vimeo");
    expect(result.embedUrl).toBeNull();
  });

  it("never produces an embed URL for an unrecognised host", () => {
    for (const url of [
      "https://evil.example.com/video.mp4",
      "https://dailymotion.com/video/x123",
    ]) {
      const result = parseVideoUrl(url);
      expect(result.provider, url).toBe("other");
      expect(result.embedUrl, url).toBeNull();
    }
  });

  it("refuses non-https and non-URL input without throwing", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "not a url",
      "",
      null,
      undefined,
    ]) {
      const result = parseVideoUrl(url as string | null | undefined);
      expect(result.embedUrl, String(url)).toBeNull();
    }
  });
});

describe("duration formatting", () => {
  it("produces ISO 8601 durations for VideoObject", () => {
    expect(isoDuration(90)).toBe("PT1M30S");
    expect(isoDuration(3661)).toBe("PT1H1M1S");
    expect(isoDuration(45)).toBe("PT45S");
  });

  it("produces display durations", () => {
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("returns null rather than a zero for an unknown length", () => {
    for (const value of [null, undefined, 0, -5]) {
      expect(isoDuration(value)).toBeNull();
      expect(formatDuration(value)).toBeNull();
    }
  });
});

// ── Privacy and consent ─────────────────────────────────────────────────────

describe("isPubliclyRendered", () => {
  it("is true only for approved, consent-settled, public attachments", () => {
    expect(
      isPubliclyRendered({
        visibility: "public",
        privacyStatus: "approved",
        consentStatus: "confirmed",
      }),
    ).toBe(true);

    expect(
      isPubliclyRendered({
        visibility: "public",
        privacyStatus: "approved",
        consentStatus: "not_required",
      }),
    ).toBe(true);
  });

  it("is false for every unpublishable combination", () => {
    const cases = [
      { visibility: "public", privacyStatus: "pending_review", consentStatus: "confirmed" },
      { visibility: "public", privacyStatus: "rejected", consentStatus: "confirmed" },
      { visibility: "public", privacyStatus: "approved", consentStatus: "pending" },
      { visibility: "public", privacyStatus: "approved", consentStatus: "denied" },
      { visibility: "hidden", privacyStatus: "approved", consentStatus: "confirmed" },
      { visibility: "private", privacyStatus: "approved", consentStatus: "confirmed" },
    ] as const;

    for (const input of cases) {
      expect(isPubliclyRendered(input), JSON.stringify(input)).toBe(false);
    }
  });
});

describe("publish blockers", () => {
  it("names every outstanding reason at once", () => {
    const blockers = mediaPublishBlockers({
      privacyStatus: "pending_review",
      consentStatus: "pending",
      altTextEn: null,
    });

    expect(blockers).toEqual(
      expect.arrayContaining(["privacyPending", "consentPending", "altTextMissing"]),
    );
  });

  it("returns nothing when an attachment is ready", () => {
    expect(
      mediaPublishBlockers({
        privacyStatus: "approved",
        consentStatus: "confirmed",
        altTextEn: "A group of students holding awards at an academic event.",
      }),
    ).toEqual([]);
  });

  it("counts whitespace-only alt text as missing", () => {
    expect(
      mediaPublishBlockers({
        privacyStatus: "approved",
        consentStatus: "not_required",
        altTextEn: "   ",
      }),
    ).toContain("altTextMissing");
  });

  it("requires a poster for a video but not for a photograph", () => {
    expect(
      journeyMediaPublishBlockers({
        kind: "video",
        privacyStatus: "approved",
        consentStatus: "confirmed",
        altTextEn: "Poster description",
        hasPoster: false,
      }),
    ).toContain("posterMissing");

    expect(
      journeyMediaPublishBlockers({
        kind: "photo",
        privacyStatus: "approved",
        consentStatus: "confirmed",
        altTextEn: "Photo description",
        hasPoster: false,
      }),
    ).toEqual([]);
  });
});

describe("journeyPublishBlockers", () => {
  it("blocks a story that still needs review or has no English title", () => {
    expect(
      journeyPublishBlockers({ needsReview: true, hasEnglishTitle: true }),
    ).toContain("needsReview");

    expect(
      journeyPublishBlockers({ needsReview: false, hasEnglishTitle: false }),
    ).toContain("missingEnglishTitle");

    expect(
      journeyPublishBlockers({ needsReview: false, hasEnglishTitle: true }),
    ).toEqual([]);
  });
});

// ── Media schema ────────────────────────────────────────────────────────────

describe("journeyMediaSchema", () => {
  it("accepts a private, pending photograph with no description", () => {
    expect(journeyMediaSchema.safeParse(validMediaInput()).success).toBe(true);
  });

  it("refuses a photograph with no image", () => {
    const result = journeyMediaSchema.safeParse(validMediaInput({ mediaId: null }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "mediaRequired")).toBe(true);
    }
  });

  it("refuses a video with no URL", () => {
    const result = journeyMediaSchema.safeParse(
      validMediaInput({ kind: "video", mediaId: null }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "videoUrlRequired")).toBe(true);
    }
  });

  it("refuses a public attachment that has not been approved", () => {
    const result = journeyMediaSchema.safeParse(
      validMediaInput({
        visibility: "public",
        privacyStatus: "pending_review",
        consentStatus: "confirmed",
        altTextEn: "Something",
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "publicNeedsApproval")).toBe(
        true,
      );
    }
  });

  it("refuses a public attachment whose consent is pending or denied", () => {
    for (const consentStatus of ["pending", "denied"] as const) {
      const result = journeyMediaSchema.safeParse(
        validMediaInput({
          visibility: "public",
          privacyStatus: "approved",
          consentStatus,
          altTextEn: "Something",
        }),
      );
      expect(result.success, consentStatus).toBe(false);
    }
  });

  it("refuses a public attachment with no English alt text", () => {
    const result = journeyMediaSchema.safeParse(
      validMediaInput({
        visibility: "public",
        privacyStatus: "approved",
        consentStatus: "confirmed",
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "publicNeedsAltText")).toBe(
        true,
      );
    }
  });

  it("refuses a public video with no poster", () => {
    const result = journeyMediaSchema.safeParse(
      validMediaInput({
        kind: "video",
        mediaId: null,
        videoUrl: "https://youtu.be/dQw4w9WgXcQ",
        visibility: "public",
        privacyStatus: "approved",
        consentStatus: "confirmed",
        altTextEn: "Poster description",
        videoTitleEn: "How to use AI",
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "publicVideoNeedsPoster"),
      ).toBe(true);
    }
  });

  it("refuses a public video with no English title", () => {
    const result = journeyMediaSchema.safeParse(
      validMediaInput({
        kind: "video",
        videoUrl: "https://youtu.be/dQw4w9WgXcQ",
        visibility: "public",
        privacyStatus: "approved",
        consentStatus: "confirmed",
        altTextEn: "Poster description",
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "publicVideoNeedsTitle"),
      ).toBe(true);
    }
  });

  it("accepts a fully prepared public video", () => {
    const result = journeyMediaSchema.safeParse(
      validMediaInput({
        kind: "video",
        videoUrl: "https://youtu.be/dQw4w9WgXcQ",
        visibility: "public",
        privacyStatus: "approved",
        consentStatus: "confirmed",
        altTextEn: "A projected slide during the presentation.",
        videoTitleEn: "How to use AI",
        durationSeconds: "420",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a non-https video URL", () => {
    const result = journeyMediaSchema.safeParse(
      validMediaInput({ kind: "video", videoUrl: "http://youtu.be/dQw4w9WgXcQ" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a focal point outside 0–1", () => {
    expect(
      journeyMediaSchema.safeParse(validMediaInput({ focalX: "1.5" })).success,
    ).toBe(false);
  });
});

// ── Entry schema ────────────────────────────────────────────────────────────

describe("journeyEntrySchema", () => {
  it("accepts an undated draft", () => {
    expect(journeyEntrySchema.safeParse(validEntryInput()).success).toBe(true);
  });

  it("rejects a slug with uppercase or spaces", () => {
    for (const slug of ["Science Fair", "science_fair", "SCIENCE"]) {
      expect(journeyEntrySchema.safeParse(validEntryInput({ slug })).success, slug).toBe(
        false,
      );
    }
  });

  it("refuses to publish while needs_review is set", () => {
    const result = journeyEntrySchema.safeParse(
      validEntryInput({ status: "published", needsReview: true }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "publishBlockedByReview"),
      ).toBe(true);
    }
  });

  it("refuses to publish without an English translation", () => {
    const result = journeyEntrySchema.safeParse(
      validEntryInput({
        status: "published",
        translations: [{ locale: "km", title: "ពិព័រណ៍វិទ្យាសាស្ត្រ" }],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "publishNeedsEnglish"),
      ).toBe(true);
    }
  });

  it("allows a Khmer-only draft", () => {
    expect(
      journeyEntrySchema.safeParse(
        validEntryInput({ translations: [{ locale: "km", title: "ពិព័រណ៍" }] }),
      ).success,
    ).toBe(true);
  });

  it("rejects a period whose end precedes its start", () => {
    const result = journeyEntrySchema.safeParse(
      validEntryInput({
        datePrecision: "range",
        periodStart: "2024-06-01",
        periodEnd: "2024-01-01",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a range precision with no start date", () => {
    const result = journeyEntrySchema.safeParse(
      validEntryInput({ datePrecision: "range" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "rangeNeedsStart")).toBe(true);
    }
  });

  it("rejects a non-https external URL", () => {
    expect(
      journeyEntrySchema.safeParse(
        validEntryInput({ externalUrl: "javascript:alert(1)" }),
      ).success,
    ).toBe(false);
  });
});

// ── Media resolution ────────────────────────────────────────────────────────

describe("resolveJourneyMedia", () => {
  it("returns null for a private asset", () => {
    const row = mediaRow({ media_assets: asset({ visibility: "private" }) });
    expect(resolveJourneyMedia(row, "en")).toBeNull();
  });

  it("returns null for a PDF", () => {
    const row = mediaRow({ media_assets: asset({ mime_type: "application/pdf" }) });
    expect(resolveJourneyMedia(row, "en")).toBeNull();
  });

  it("returns null for a missing asset", () => {
    expect(resolveJourneyMedia(mediaRow({ media_assets: null }), "en")).toBeNull();
  });

  it("returns null for a video with no poster asset", () => {
    // The renderer's own gate: even if a policy were loosened, the outcome is
    // "the video does not appear" rather than "a third-party iframe loads".
    const row = mediaRow({
      kind: "video",
      video_url: "https://youtu.be/dQw4w9WgXcQ",
      media_assets: null,
    });
    expect(resolveJourneyMedia(row, "en")).toBeNull();
  });

  it("returns null for a video with no URL", () => {
    expect(resolveJourneyMedia(mediaRow({ kind: "video" }), "en")).toBeNull();
  });

  it("prefers the attachment's caption over the asset's", () => {
    const row = mediaRow({ caption_en: "Contextual caption" });
    expect(resolveJourneyMedia(row, "en")?.caption).toBe("Contextual caption");
  });

  it("falls back to the asset's caption when the attachment's is blank", () => {
    const row = mediaRow({ caption_en: "   " });
    expect(resolveJourneyMedia(row, "en")?.caption).toBe("Asset caption");
  });

  it("leaves alt text empty rather than substituting a filename or caption", () => {
    const row = mediaRow({
      media_assets: asset({ alt_text_en: null, alt_text_km: null }),
    });
    expect(resolveJourneyMedia(row, "en")?.alt).toBe("");
  });

  it("emits object-position only when a focal point was set", () => {
    expect(resolveJourneyMedia(mediaRow(), "en")?.objectPosition).toBeNull();
    expect(
      resolveJourneyMedia(mediaRow({ focal_x: 0.25, focal_y: 0.75 }), "en")
        ?.objectPosition,
    ).toBe("25.00% 75.00%");
  });

  it("re-derives the embed URL from the URL rather than the stored provider", () => {
    // A row edited directly in Supabase Studio cannot inject an arbitrary origin
    // into an iframe by lying about the provider.
    const row = mediaRow({
      kind: "video",
      video_url: "https://evil.example.com/x",
      video_provider: "youtube",
      video_title_en: "Claims to be YouTube",
    });
    const resolved = resolveJourneyMedia(row, "en");
    expect(resolved?.video?.provider).toBe("other");
    expect(resolved?.video?.embedUrl).toBeNull();
  });
});

describe("splitJourneyMedia", () => {
  const photo = (id: string, role: "cover" | "gallery" = "gallery") =>
    ({ id, kind: "photo", role }) as JourneyMediaItem;
  const video = (id: string, role: "cover" | "gallery" = "gallery") =>
    ({ id, kind: "video", role }) as JourneyMediaItem;

  it("uses the explicit cover when one is set", () => {
    const { cover, gallery } = splitJourneyMedia([
      photo("a"),
      photo("b", "cover"),
      photo("c"),
    ]);
    expect(cover?.id).toBe("b");
    expect(gallery.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("promotes the first photo rather than a video when no cover is set", () => {
    // A video poster leading a story makes the page's most prominent element a
    // play button; the cover should be looked at rather than clicked.
    const { cover } = splitJourneyMedia([video("v"), photo("p")]);
    expect(cover?.id).toBe("p");
  });

  it("falls back to the first video when a story is video-only", () => {
    const { cover, gallery } = splitJourneyMedia([video("v1"), video("v2")]);
    expect(cover?.id).toBe("v1");
    expect(gallery.map((item) => item.id)).toEqual(["v2"]);
  });

  it("handles an empty list", () => {
    expect(splitJourneyMedia([])).toEqual({ cover: null, gallery: [] });
  });
});

// ── Dates ───────────────────────────────────────────────────────────────────

describe("journeyYear", () => {
  it("reads the year from whichever date exists", () => {
    expect(
      journeyYear({ eventDate: "2024-03-14", periodStart: null, periodEnd: null }),
    ).toBe("2024");
    expect(
      journeyYear({ eventDate: null, periodStart: "2023-09-01", periodEnd: null }),
    ).toBe("2023");
  });

  it("returns null for a genuinely undated story rather than inventing one", () => {
    expect(
      journeyYear({ eventDate: null, periodStart: null, periodEnd: null }),
    ).toBeNull();
  });
});

describe("formatJourneyPeriod", () => {
  const base = {
    periodLabelEn: null,
    periodLabelKm: null,
    eventDate: null,
    datePrecision: "unknown",
    periodStart: null,
    periodEnd: null,
  };

  it("prefers the hand-written label over any computed date", () => {
    expect(
      formatJourneyPeriod("en", {
        ...base,
        periodLabelEn: "2023 — 2028 (expected)",
        eventDate: "2024-03-14",
        datePrecision: "day",
      }),
    ).toBe("2023 — 2028 (expected)");
  });

  it("renders only the precision that is evidenced", () => {
    expect(
      formatJourneyPeriod("en", {
        ...base,
        eventDate: "2024-03-14",
        datePrecision: "year",
      }),
    ).toBe("2024");

    expect(
      formatJourneyPeriod("en", {
        ...base,
        eventDate: "2024-03-14",
        datePrecision: "month",
      }),
    ).toContain("2024");
  });

  it("returns null for unknown precision rather than formatting a stored date", () => {
    expect(
      formatJourneyPeriod("en", {
        ...base,
        eventDate: "2024-03-14",
        datePrecision: "unknown",
      }),
    ).toBeNull();
  });

  it("falls back to the other locale's label when one is blank", () => {
    expect(
      formatJourneyPeriod("km", { ...base, periodLabelEn: "March 2024", periodLabelKm: "" }),
    ).toBe("March 2024");
  });
});

describe("splitHighlights", () => {
  it("splits on newlines and strips bullet characters", () => {
    expect(splitHighlights("- First\n• Second\n* Third")).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });

  it("drops blank lines and handles absent input", () => {
    expect(splitHighlights("One\n\n\nTwo")).toEqual(["One", "Two"]);
    expect(splitHighlights(null)).toEqual([]);
    expect(splitHighlights("")).toEqual([]);
  });
});

// ── Import filenames ────────────────────────────────────────────────────────

describe("semanticFilename", () => {
  it("replaces a camera name with a readable, collision-safe one", () => {
    const name = semanticFilename(
      "Korean Teacher Exchange",
      "a".repeat(64),
      "2024-06-01",
    );
    expect(name).toBe("korean-teacher-exchange-2024-aaaaaaaa.webp");
  });

  it("omits the year when no capture date was recorded", () => {
    const name = semanticFilename("Science Fair", "b".repeat(64), null);
    expect(name).toBe("science-fair-bbbbbbbb.webp");
  });

  it("is deterministic, so re-importing the same bytes yields the same name", () => {
    const first = semanticFilename("PTOM", "c".repeat(64), "2025-01-02");
    const second = semanticFilename("PTOM", "c".repeat(64), "2025-01-02");
    expect(first).toBe(second);
  });

  it("survives a folder name with no latin characters", () => {
    const name = semanticFilename("ពិព័រណ៍", "d".repeat(64), null);
    expect(name).toBe("journey-dddddddd.webp");
  });

  it("always produces a .webp name, because that is what is stored", () => {
    expect(semanticFilename("anything", "e".repeat(64), null)).toMatch(/\.webp$/);
  });
});
