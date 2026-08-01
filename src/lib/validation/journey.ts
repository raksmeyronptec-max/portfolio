import { z } from "zod";

import { locales } from "@/i18n/config";
import {
  consentStatuses,
  mediaPublishBlockers,
  mediaVisibilities,
  privacyStatuses,
  type ConsentStatus,
  type MediaVisibility,
  type PrivacyStatus,
} from "./media-privacy";

/**
 * Journey stories — schemas, publish blockers and the privacy checklist.
 *
 * Isomorphic by design: the admin form imports the schemas to validate before
 * submitting and the Server Actions import the same objects to validate again.
 * Nothing here touches the database or reads privileged configuration.
 *
 * Every rule below mirrors a constraint in migration 0024. The database is the
 * guarantee; this layer exists so a violation arrives as a message attached to
 * the control the admin just changed, rather than as an opaque 23514.
 */

// ── Shared vocabulary ───────────────────────────────────────────────────────

export {
  consentStatuses,
  mediaVisibilities,
  privacyStatuses,
  type ConsentStatus,
  type MediaVisibility,
  type PrivacyStatus,
};

export const journeyMediaKinds = ["photo", "video"] as const;
export type JourneyMediaKind = (typeof journeyMediaKinds)[number];

export const journeyMediaRoles = ["cover", "gallery"] as const;
export type JourneyMediaRole = (typeof journeyMediaRoles)[number];

export const publicationStatuses = [
  "draft",
  "in_review",
  "published",
  "archived",
] as const;
export type PublicationStatus = (typeof publicationStatuses)[number];

/**
 * How much of `event_date` is actually evidenced.
 *
 * The same problem migration 0012 solved for education and experience: the owner
 * knows a photograph is from 2024 but not the day. Recording the precision means
 * the timeline can render "2024" rather than inventing "1 January 2024", and can
 * group genuinely undated stories separately instead of filing them under a year
 * nobody confirmed.
 */
export const datePrecisions = ["day", "month", "year", "range", "unknown"] as const;
export type DatePrecision = (typeof datePrecisions)[number];

export const journeyRelationTypes = [
  "experience",
  "education",
  "certificate",
  "project",
] as const;
export type JourneyRelationType = (typeof journeyRelationTypes)[number];

/** Column on `journey_relations` that holds each relation type's target. */
export const journeyRelationColumns: Record<JourneyRelationType, string> = {
  experience: "experience_id",
  education: "education_id",
  certificate: "certificate_id",
  project: "project_id",
};

// ── Field helpers ───────────────────────────────────────────────────────────

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .refine(
    (value) => value === null || value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value),
    { message: "invalidDate" },
  );

/** Normalised focal point. `null` means centre. */
const focalCoordinate = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  })
  .refine((value) => value === null || (value >= 0 && value <= 1), {
    message: "focalOutOfRange",
  });

/**
 * An absolute https URL, or nothing.
 *
 * https only, not http. These URLs end up in an `href` and — for video — in an
 * iframe `src`; the site is served over https and a mixed-content embed would be
 * blocked by the browser anyway, so accepting http would only produce links that
 * silently fail. Rejecting anything that is not https also disposes of
 * `javascript:` and `data:` without needing a second rule.
 */
const optionalHttpsUrl = z
  .string()
  .trim()
  .max(600)
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .refine((value) => value === null || value === undefined || /^https:\/\//i.test(value), {
    message: "urlMustBeHttps",
  });

// ── Journey entry ───────────────────────────────────────────────────────────

const translationSchema = z.object({
  locale: z.enum(locales),
  title: z.string().trim().min(1, { message: "titleRequired" }).max(180),
  eyebrow: optionalText(80),
  summary: optionalText(600),
  story: optionalText(20000),
  highlights: optionalText(4000),
  seoTitle: optionalText(70),
  seoDescription: optionalText(200),
});

export const journeyEntrySchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, { message: "slugTooShort" })
      .max(90, { message: "slugTooLong" })
      .regex(/^[a-z0-9-]+$/, { message: "slugFormat" }),

    status: z.enum(publicationStatuses),
    categoryId: z.uuid().nullable().optional(),
    featured: z.coerce.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(9999),

    eventDate: optionalDate,
    datePrecision: z.enum(datePrecisions),
    periodStart: optionalDate,
    periodEnd: optionalDate,
    periodLabelEn: optionalText(120),
    periodLabelKm: optionalText(120),

    locationEn: optionalText(200),
    locationKm: optionalText(200),
    organisationEn: optionalText(200),
    organisationKm: optionalText(200),

    externalUrl: optionalHttpsUrl,
    coverMediaId: z.uuid().nullable().optional(),

    needsReview: z.coerce.boolean(),
    reviewNote: optionalText(2000),

    /*
     * At least one translation, and the array is keyed by locale rather than
     * positional, so a form that submits only Khmer is a legal draft.
     */
    translations: z.array(translationSchema).min(1, { message: "translationRequired" }),
  })
  .refine(
    (data) =>
      !data.periodStart ||
      !data.periodEnd ||
      new Date(data.periodEnd) >= new Date(data.periodStart),
    { message: "periodOutOfOrder", path: ["periodEnd"] },
  )
  /*
   * `range` precision without a range is a contradiction the timeline cannot
   * render — it would fall through to `event_date`, which is exactly the
   * precision the admin just said was wrong.
   */
  .refine(
    (data) => data.datePrecision !== "range" || Boolean(data.periodStart),
    { message: "rangeNeedsStart", path: ["periodStart"] },
  )
  /*
   * Publication rules, checked here so they arrive as a field error rather than
   * as the migration-0024 trigger's check_violation. The trigger is still the
   * guarantee — this is the version that says which control to fix.
   */
  .refine((data) => data.status !== "published" || !data.needsReview, {
    message: "publishBlockedByReview",
    path: ["needsReview"],
  })
  .refine(
    (data) =>
      data.status !== "published" ||
      data.translations.some((t) => t.locale === "en" && t.title.trim() !== ""),
    { message: "publishNeedsEnglish", path: ["translations"] },
  );

export type JourneyEntryInput = z.infer<typeof journeyEntrySchema>;

// ── Journey media attachment ────────────────────────────────────────────────

export const journeyMediaSchema = z
  .object({
    kind: z.enum(journeyMediaKinds),
    role: z.enum(journeyMediaRoles),
    sortOrder: z.coerce.number().int().min(0).max(9999),

    /** The image, or — for a video — the poster frame. */
    mediaId: z.uuid().nullable().optional(),

    videoUrl: optionalHttpsUrl,
    durationSeconds: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((value) => {
        if (value === null || value === undefined || value === "") return null;
        const parsed = typeof value === "number" ? value : Number(value);
        return Number.isFinite(parsed) ? Math.round(parsed) : null;
      })
      .refine((value) => value === null || (value > 0 && value <= 86400), {
        message: "durationOutOfRange",
      }),
    videoTitleEn: optionalText(200),
    videoTitleKm: optionalText(200),
    transcriptEn: optionalText(40000),
    transcriptKm: optionalText(40000),

    captionEn: optionalText(400),
    captionKm: optionalText(400),
    altTextEn: optionalText(400),
    altTextKm: optionalText(400),

    photoDate: optionalDate,
    locationEn: optionalText(200),
    locationKm: optionalText(200),
    credit: optionalText(200),

    privacyStatus: z.enum(privacyStatuses),
    consentStatus: z.enum(consentStatuses),
    visibility: z.enum(mediaVisibilities),

    focalX: focalCoordinate,
    focalY: focalCoordinate,

    reviewNote: optionalText(2000),
  })
  // A photograph is its image.
  .refine((data) => data.kind !== "photo" || Boolean(data.mediaId), {
    message: "mediaRequired",
    path: ["mediaId"],
  })
  // A video is its URL.
  .refine((data) => data.kind !== "video" || Boolean(data.videoUrl), {
    message: "videoUrlRequired",
    path: ["videoUrl"],
  })
  /*
   * A public video must have a poster.
   *
   * Poster-first is what keeps a third-party player — and its cookies — off the
   * page until someone asks for it. "Public" and "no poster" together would mean
   * an embed that loads on render, which is the behaviour this whole design
   * exists to avoid.
   */
  .refine(
    (data) => data.kind !== "video" || data.visibility !== "public" || Boolean(data.mediaId),
    { message: "publicVideoNeedsPoster", path: ["mediaId"] },
  )
  // The publication invariant, restated from the database CHECK.
  .refine((data) => data.visibility !== "public" || data.privacyStatus === "approved", {
    message: "publicNeedsApproval",
    path: ["visibility"],
  })
  .refine(
    (data) =>
      data.visibility !== "public" ||
      data.consentStatus === "confirmed" ||
      data.consentStatus === "not_required",
    { message: "publicNeedsConsent", path: ["visibility"] },
  )
  /*
   * Alt text is required to go public, and only then.
   *
   * A photograph carries information — who, where, doing what — that a
   * screen-reader user gets from nowhere else. Requiring it at draft time would
   * be busywork; requiring it at publication is the point at which the omission
   * would actually cost someone. English is the fallback locale, so it is the one
   * that must exist.
   */
  .refine((data) => data.visibility !== "public" || Boolean(data.altTextEn), {
    message: "publicNeedsAltText",
    path: ["altTextEn"],
  })
  /*
   * A public video needs a title, in a way a photograph does not.
   *
   * The alt text describes the poster image; the title describes what playing the
   * video will show. A "Play" button whose accessible name is only the poster's
   * description tells a screen-reader user nothing about what they are about to
   * start.
   */
  .refine(
    (data) => data.kind !== "video" || data.visibility !== "public" || Boolean(data.videoTitleEn),
    { message: "publicVideoNeedsTitle", path: ["videoTitleEn"] },
  );

export type JourneyMediaInput = z.infer<typeof journeyMediaSchema>;

/** Reordering payload: attachment ids in their new display order. */
export const journeyMediaOrderSchema = z.object({
  journeyEntryId: z.uuid(),
  orderedIds: z.array(z.uuid()).max(120),
});

/** Adding or removing a link to another content record. */
export const journeyRelationSchema = z.object({
  journeyEntryId: z.uuid(),
  relatedType: z.enum(journeyRelationTypes),
  relatedId: z.uuid(),
});

// ── Video URL parsing ───────────────────────────────────────────────────────

export type VideoProvider = "youtube" | "vimeo" | "other";

export type ParsedVideo = {
  provider: VideoProvider;
  /** Platform video id, when one could be extracted. */
  videoId: string | null;
  /**
   * Privacy-preserving embed URL, or `null` when the provider is unrecognised.
   *
   * YouTube goes through `youtube-nocookie.com` and Vimeo through `dnt=1`. Both
   * are still third-party requests — the point is that they happen only after the
   * visitor clicks Play, which is what the poster-first facade guarantees.
   */
  embedUrl: string | null;
};

/**
 * Recognise a video URL and derive its embed form.
 *
 * Deliberately strict about which hosts it recognises. An unrecognised URL is
 * classified `other` with no embed URL, and the renderer then links out to it
 * rather than putting an arbitrary origin in an iframe — a page that will frame
 * whatever URL an admin pastes is a page that will eventually frame something
 * hostile, and the site's CSP `frame-src` would have to be opened to `*` to let
 * it work at all.
 *
 * Never throws: a malformed URL is `other` with no id, which renders as a plain
 * outbound link.
 */
export function parseVideoUrl(rawUrl: string | null | undefined): ParsedVideo {
  const fallback: ParsedVideo = { provider: "other", videoId: null, embedUrl: null };
  if (!rawUrl) return fallback;

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return fallback;
  }

  if (url.protocol !== "https:") return fallback;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // ── YouTube ───────────────────────────────────────────────────────────────
  if (host === "youtu.be") {
    const id = sanitizeVideoId(url.pathname.slice(1));
    return id ? youtube(id) : fallback;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    // /watch?v=ID
    const queryId = sanitizeVideoId(url.searchParams.get("v"));
    if (queryId) return youtube(queryId);

    // /embed/ID, /live/ID, /shorts/ID
    const match = url.pathname.match(/^\/(?:embed|live|shorts|v)\/([^/?#]+)/);
    const pathId = sanitizeVideoId(match?.[1]);
    if (pathId) return youtube(pathId);

    return fallback;
  }

  // ── Vimeo ─────────────────────────────────────────────────────────────────
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    /*
     * Only the numeric id form is recognised. Vimeo's unlisted videos carry a
     * second private hash (`/123456789/abcdef0123`) and folding that into an
     * embed URL here would republish a link the owner may have deliberately kept
     * unlisted — section 12 of the brief calls that out specifically. An unlisted
     * video should be pasted as-is and will render as an outbound link.
     */
    const match = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/);
    const id = match?.[1];
    if (id) {
      return {
        provider: "vimeo",
        videoId: id,
        embedUrl: `https://player.vimeo.com/video/${id}?dnt=1&title=0&byline=0&portrait=0`,
      };
    }
    return { provider: "vimeo", videoId: null, embedUrl: null };
  }

  return fallback;
}

function youtube(id: string): ParsedVideo {
  return {
    provider: "youtube",
    videoId: id,
    // `nocookie` plus `rel=0`. `modestbranding` is ignored by YouTube now, so it
    // is not sent rather than being cargo-culted.
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`,
  };
}

/** YouTube ids are `[A-Za-z0-9_-]{11}`; anything else is not an id. */
function sanitizeVideoId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{11}$/.test(trimmed) ? trimmed : null;
}

/** `PT#M#S` for `VideoObject.duration`, or null. */
export function isoDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `PT${hours > 0 ? `${hours}H` : ""}${minutes > 0 ? `${minutes}M` : ""}${secs > 0 ? `${secs}S` : ""}`;
}

/** `1:23` / `1:02:03` for display next to a play button. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const paddedSecs = String(secs).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSecs}`;
  return `${minutes}:${paddedSecs}`;
}

// ── Publish blockers ────────────────────────────────────────────────────────

/**
 * Why a given attachment cannot be published yet.
 *
 * Wraps the shared implementation, adding the poster rule that only applies to
 * video. Returns message codes; the client picks the language.
 */
export function journeyMediaPublishBlockers(input: {
  kind: JourneyMediaKind;
  privacyStatus: PrivacyStatus;
  consentStatus: ConsentStatus;
  altTextEn: string | null | undefined;
  hasPoster: boolean;
}): string[] {
  return mediaPublishBlockers({
    privacyStatus: input.privacyStatus,
    consentStatus: input.consentStatus,
    altTextEn: input.altTextEn,
    hasPoster: input.kind === "video" ? input.hasPoster : undefined,
  });
}

/**
 * Why a story cannot be published yet.
 *
 * Mirrors `enforce_journey_publish_rules()` in migration 0024, plus the softer
 * warnings the trigger does not enforce — a story with no Khmer translation is
 * publishable, but the admin should be told before rather than after.
 */
export function journeyPublishBlockers(input: {
  needsReview: boolean;
  hasEnglishTitle: boolean;
}): string[] {
  const blockers: string[] = [];
  if (input.needsReview) blockers.push("needsReview");
  if (!input.hasEnglishTitle) blockers.push("missingEnglishTitle");
  return blockers;
}

// ── Privacy checklist ───────────────────────────────────────────────────────

/**
 * The privacy checklist shown before a journey photograph can be approved.
 *
 * Extends the experience-photo list rather than repeating it, because journey
 * media covers two situations that list does not: private tutoring in somebody's
 * home, and video, which carries audio and can capture things a still frame never
 * would.
 *
 * As with the certificate and experience lists, which boxes were ticked is NOT
 * persisted. Storing them would imply a legal record of consent that a CMS cannot
 * substantiate; only the reviewer, the timestamp and the note are kept.
 */
export const JOURNEY_MEDIA_CHECKLIST: Array<{
  id: string;
  label: string;
  detail: string;
  /** Shown only for video attachments. */
  videoOnly?: boolean;
}> = [
  {
    id: "permission",
    label: "I have permission to publish this",
    detail:
      "From the school, university or organisation, and from any adult who is identifiable in it.",
  },
  {
    id: "minors",
    label: "Identifiable minors are permitted, or are not identifiable",
    detail:
      "Pupils' faces need the school's permission. If you do not have it, use a shot taken from behind, or crop and blur before uploading — this CMS does not blur for you.",
  },
  {
    id: "student-records",
    label: "No pupil records, marks or name lists are legible",
    detail:
      "Registers, mark sheets, exercise books with names, and anything pinned to a wall listing pupils.",
  },
  {
    id: "contact-details",
    label: "No phone numbers, addresses or email addresses are legible",
    detail: "Including anything written on a board, a noticeboard or a document.",
  },
  {
    id: "credentials",
    label: "No passwords, screens or account details are legible",
    detail:
      "A projected slide, a laptop screen or a sticky note can carry a login. Check the background.",
  },
  {
    id: "school-records",
    label: "No confidential school or staff documents are visible",
    detail: "Staff lists, internal reports, budgets, disciplinary records.",
  },
  {
    id: "location",
    label: "The location is safe to disclose",
    detail:
      "A school or a university campus is normally fine. A private home is not — a tutoring photograph must not identify where a pupil lives.",
  },
  {
    id: "caption",
    label: "The caption and alt text reveal nothing private",
    detail:
      "Do not name other people, and do not describe anyone's circumstances. Describe the professional activity.",
  },
  {
    id: "guests",
    label: "Visiting guests have agreed to appear",
    detail:
      "An international exchange photograph shows people who did not consent to a Cambodian portfolio when they agreed to a school visit. Ask, or use a wide shot.",
  },
  {
    id: "audio",
    label: "The audio contains nothing private",
    detail:
      "Background conversation, a pupil's name called across a room, or a phone number read aloud. Watch the whole thing with the sound on before approving.",
    videoOnly: true,
  },
  {
    id: "video-scope",
    label: "The whole video has been reviewed, not just the poster frame",
    detail:
      "A safe opening shot says nothing about minute four. Every frame is published, not just the one you chose.",
    videoOnly: true,
  },
  {
    id: "video-hosting",
    label: "The hosting visibility is what you intend",
    detail:
      "An unlisted video linked from a public page is effectively public. If it should stay unlisted, do not publish this attachment.",
    videoOnly: true,
  },
];

// ── Error labels ────────────────────────────────────────────────────────────

export const journeyErrorLabels: Record<string, string> = {
  // Entry
  slugTooShort: "The URL slug needs at least 2 characters.",
  slugTooLong: "The URL slug must be 90 characters or fewer.",
  slugFormat: "Use lowercase letters, numbers and hyphens only.",
  slugTaken: "Another story already uses that URL slug.",
  titleRequired: "Enter a title.",
  translationRequired: "Add at least one language.",
  invalidDate: "Use the date picker, or the format YYYY-MM-DD.",
  periodOutOfOrder: "The end date is before the start date.",
  rangeNeedsStart: "A date range needs a start date.",
  publishBlockedByReview:
    "This story is still marked as needing review. Confirm the uncertain fields and clear the flag before publishing.",
  publishNeedsEnglish: "An English title is required before a story can be published.",
  needsReview: "The story is still marked as needing review.",
  missingEnglishTitle: "There is no English translation.",
  urlMustBeHttps: "Enter a full https:// address.",

  // Media
  mediaRequired: "Choose an image from the media library.",
  videoUrlRequired: "Paste the video's https:// address.",
  durationOutOfRange: "Enter the length in seconds, up to 24 hours.",
  focalOutOfRange: "The focal point must be between 0 and 1.",
  publicNeedsApproval:
    "Record a privacy review and approve this before making it public.",
  publicNeedsConsent:
    "Consent must be confirmed, or marked as not required, before publishing.",
  publicNeedsAltText: "English alt text is required before this goes public.",
  publicVideoNeedsPoster:
    "Choose a poster image. Without one the page would have to load the video player before anyone asks for it.",
  publicVideoNeedsTitle: "An English video title is required before it goes public.",
  privacyPending: "The privacy review has not been completed.",
  privacyRejected: "This was rejected in privacy review.",
  consentPending: "Consent has not been confirmed.",
  consentDenied: "Consent was denied.",
  altTextMissing: "English alt text is missing.",
  posterMissing: "This video has no poster image.",
  alreadyAttached: "That image is already attached to this story.",
  coverExists: "This story already has a cover image.",
  notAnImage: "Only images can be attached — PDFs cannot be displayed inline.",
  privateAsset:
    "That file is stored privately and has no public URL, so it cannot be shown on the public page.",
  stillAttached:
    "This image is still attached to a journey story. Remove the attachment first.",

  // Relations
  relationExists: "That link already exists.",
  relationTargetMissing: "That record no longer exists.",
};

export function collectJourneyErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!result[path]) result[path] = issue.message;
  }
  return result;
}
