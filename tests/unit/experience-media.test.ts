import { describe, expect, it } from "vitest";

import {
  resolveExperiencePhoto,
  splitExperiencePhotos,
  type ExperiencePhoto,
  type ExperiencePhotoRow,
} from "@/lib/content/experience-media";
import {
  consentStatuses,
  experienceMediaSchema,
  isPubliclyRendered,
  photoPublishBlockers,
  privacyStatuses,
} from "@/lib/validation/experience-media";
import type { MediaAsset } from "@/lib/content/media";

/**
 * Experience photographs.
 *
 * The tests that matter here are the ones about *not* publishing something: an
 * unreviewed photograph, one whose consent was denied, and one whose underlying
 * file is private. Those are the failures with a cost that cannot be undone, and
 * each is asserted at both layers that are supposed to prevent it — the schema
 * and the resolver.
 */

const publicAsset: MediaAsset = {
  id: "asset-1",
  bucket_id: "public-media",
  storage_path: "experience/2026/07/abc-lesson.webp",
  storage_provider: "supabase",
  visibility: "public",
  mime_type: "image/webp",
  file_size_bytes: 120_000,
  width: 2000,
  height: 1333,
  blur_data_url: "data:image/webp;base64,AAA",
  thumbnail_path: "experience/2026/07/abc-lesson-thumb.webp",
  card_path: "experience/2026/07/abc-lesson-card.webp",
  preview_path: "experience/2026/07/abc-lesson-preview.webp",
  alt_text_en: "Asset-level English alt text",
  alt_text_km: "អត្ថបទជំនួសពីឯកសារ",
  caption_en: "Asset-level English caption",
  caption_km: "ចំណងជើងពីឯកសារ",
};

function row(overrides: Partial<ExperiencePhotoRow> = {}): ExperiencePhotoRow {
  return {
    id: "attach-1",
    role: "gallery",
    sort_order: 0,
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
    media_assets: publicAsset,
    ...overrides,
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    mediaId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    role: "gallery",
    sortOrder: 0,
    captionEn: "Preparing a learner-centred mathematics activity.",
    captionKm: "ការរៀបចំសកម្មភាពគណិតវិទ្យា។",
    altTextEn: "Ron Raksmey beside a classroom whiteboard.",
    altTextKm: "",
    photoDate: "",
    locationEn: "",
    locationKm: "",
    credit: "",
    privacyStatus: "approved",
    consentStatus: "confirmed",
    visibility: "public",
    focalX: "",
    focalY: "",
    reviewNote: "",
    ...overrides,
  };
}

describe("publication invariant", () => {
  it("accepts a reviewed, consented photograph with alt text", () => {
    expect(experienceMediaSchema.safeParse(validInput()).success).toBe(true);
  });

  it("refuses to publish without an approved privacy review", () => {
    for (const status of privacyStatuses.filter((value) => value !== "approved")) {
      const result = experienceMediaSchema.safeParse(
        validInput({ privacyStatus: status }),
      );

      expect(result.success, `privacyStatus=${status} must not publish`).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.message)).toContain(
          "publicNeedsApproval",
        );
      }
    }
  });

  it("refuses to publish when consent is pending or denied", () => {
    for (const status of ["pending", "denied"] as const) {
      const result = experienceMediaSchema.safeParse(
        validInput({ consentStatus: status }),
      );

      expect(result.success, `consentStatus=${status} must not publish`).toBe(false);
    }
  });

  it("treats 'not_required' consent as publishable", () => {
    const result = experienceMediaSchema.safeParse(
      validInput({ consentStatus: "not_required" }),
    );
    expect(result.success).toBe(true);
  });

  it("refuses to publish without English alt text", () => {
    const result = experienceMediaSchema.safeParse(validInput({ altTextEn: "" }));
    expect(result.success).toBe(false);
  });

  /*
   * The same photograph, not published, is allowed to be incomplete. Requiring
   * alt text on a draft would be busywork; requiring it at publication is the
   * point where the omission would actually harm someone.
   */
  it("allows an incomplete photograph while it stays private", () => {
    const result = experienceMediaSchema.safeParse(
      validInput({
        visibility: "private",
        privacyStatus: "pending_review",
        consentStatus: "pending",
        altTextEn: "",
        captionEn: "",
      }),
    );

    expect(result.success).toBe(true);
  });

  it("rejects a focal point outside 0–1", () => {
    expect(experienceMediaSchema.safeParse(validInput({ focalX: "1.4" })).success).toBe(
      false,
    );
    expect(experienceMediaSchema.safeParse(validInput({ focalX: "0.25" })).success).toBe(
      true,
    );
  });

  it("rejects a malformed photo date", () => {
    expect(
      experienceMediaSchema.safeParse(validInput({ photoDate: "July 2026" })).success,
    ).toBe(false);
  });
});

describe("isPubliclyRendered", () => {
  it("is true only for the approved, consented, public combination", () => {
    for (const privacyStatus of privacyStatuses) {
      for (const consentStatus of consentStatuses) {
        for (const visibility of ["public", "private", "hidden"] as const) {
          const expected =
            visibility === "public" &&
            privacyStatus === "approved" &&
            (consentStatus === "confirmed" || consentStatus === "not_required");

          expect(
            isPubliclyRendered({ visibility, privacyStatus, consentStatus }),
            `${visibility}/${privacyStatus}/${consentStatus}`,
          ).toBe(expected);
        }
      }
    }
  });
});

describe("photoPublishBlockers", () => {
  it("reports every unmet condition, not just the first", () => {
    expect(
      photoPublishBlockers({
        privacyStatus: "pending_review",
        consentStatus: "pending",
        altTextEn: null,
      }),
    ).toEqual(["privacyPending", "consentPending", "altTextMissing"]);
  });

  it("reports nothing when the photograph is ready", () => {
    expect(
      photoPublishBlockers({
        privacyStatus: "approved",
        consentStatus: "not_required",
        altTextEn: "A classroom activity.",
      }),
    ).toEqual([]);
  });
});

describe("resolveExperiencePhoto", () => {
  it("prefers the attachment's caption and alt text over the asset's", () => {
    const photo = resolveExperiencePhoto(
      row({
        caption_en: "Contextual English caption",
        alt_text_en: "Contextual English alt text",
      }),
      "en",
    );

    expect(photo?.caption).toBe("Contextual English caption");
    expect(photo?.alt).toBe("Contextual English alt text");
  });

  it("falls back to the asset's values when the attachment has none", () => {
    const photo = resolveExperiencePhoto(row(), "en");

    expect(photo?.caption).toBe("Asset-level English caption");
    expect(photo?.alt).toBe("Asset-level English alt text");
  });

  it("treats a blank contextual caption as absent rather than as empty", () => {
    const photo = resolveExperiencePhoto(row({ caption_en: "   " }), "en");
    expect(photo?.caption).toBe("Asset-level English caption");
  });

  it("serves Khmer text on the Khmer locale, falling back to English", () => {
    const km = resolveExperiencePhoto(
      row({ caption_en: "English only", caption_km: "ខេមរភាសា" }),
      "km",
    );
    expect(km?.caption).toBe("ខេមរភាសា");

    const missingKm = resolveExperiencePhoto(
      row({ caption_en: "English only", caption_km: null, media_assets: {
        ...publicAsset,
        caption_en: null,
        caption_km: null,
      } }),
      "km",
    );
    expect(missingKm?.caption).toBe("English only");
  });

  /*
   * The second gate. RLS should never return a row pointing at a private asset,
   * but if one arrives the resolver must not build a URL for it.
   */
  it("returns null for a private asset rather than inventing a URL", () => {
    const photo = resolveExperiencePhoto(
      row({ media_assets: { ...publicAsset, visibility: "private" } }),
      "en",
    );
    expect(photo).toBeNull();
  });

  it("returns null for a PDF and for a missing asset", () => {
    expect(
      resolveExperiencePhoto(
        row({ media_assets: { ...publicAsset, mime_type: "application/pdf" } }),
        "en",
      ),
    ).toBeNull();

    expect(resolveExperiencePhoto(row({ media_assets: null }), "en")).toBeNull();
  });

  it("never emits alt text derived from the filename or the caption", () => {
    const photo = resolveExperiencePhoto(
      row({
        caption_en: "A caption",
        media_assets: { ...publicAsset, alt_text_en: null, alt_text_km: null },
      }),
      "en",
    );

    // Empty, so the admin's content-health check surfaces the gap — rather than
    // a screen reader being read "abc-lesson.webp" or the caption twice.
    expect(photo?.alt).toBe("");
  });

  it("uses derivatives: card inline, preview for the lightbox, thumb for the strip", () => {
    const photo = resolveExperiencePhoto(row(), "en");

    expect(photo?.src).toContain("abc-lesson-card.webp");
    expect(photo?.fullSrc).toContain("abc-lesson-preview.webp");
    expect(photo?.thumbnailSrc).toContain("abc-lesson-thumb.webp");
    // The camera original is never the src.
    expect(photo?.src).not.toContain("abc-lesson.webp?");
  });

  it("emits object-position only when a focal point was set", () => {
    expect(resolveExperiencePhoto(row(), "en")?.objectPosition).toBeNull();
    expect(
      resolveExperiencePhoto(row({ focal_x: 0.25, focal_y: 0.1 }), "en")
        ?.objectPosition,
    ).toBe("25.00% 10.00%");
  });
});

describe("splitExperiencePhotos", () => {
  const photo = (id: string, role: "cover" | "gallery"): ExperiencePhoto => ({
    id,
    role,
    src: `${id}.webp`,
    fullSrc: `${id}-preview.webp`,
    thumbnailSrc: `${id}-thumb.webp`,
    width: null,
    height: null,
    blurDataURL: null,
    alt: id,
    caption: null,
    location: null,
    credit: null,
    photoDate: null,
    objectPosition: null,
  });

  it("uses the explicit cover and leaves the rest as the gallery", () => {
    const { cover, gallery } = splitExperiencePhotos([
      photo("a", "gallery"),
      photo("b", "cover"),
      photo("c", "gallery"),
    ]);

    expect(cover?.id).toBe("b");
    expect(gallery.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("promotes the first photo when no cover is set", () => {
    const { cover, gallery } = splitExperiencePhotos([
      photo("a", "gallery"),
      photo("b", "gallery"),
    ]);

    expect(cover?.id).toBe("a");
    expect(gallery.map((item) => item.id)).toEqual(["b"]);
  });

  it("returns no cover for an entry with no photos", () => {
    expect(splitExperiencePhotos([])).toEqual({ cover: null, gallery: [] });
  });
});
