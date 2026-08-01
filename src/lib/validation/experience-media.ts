import { z } from "zod";

import {
  consentStatuses,
  isPubliclyRendered,
  mediaPublishBlockers,
  mediaVisibilities,
  privacyStatuses,
  type ConsentStatus,
  type MediaVisibility,
  type PrivacyStatus,
} from "./media-privacy";

/**
 * Experience photograph attachments.
 *
 * These schemas mirror the CHECK constraints in migration 0022 rather than
 * inventing a second, looser rule set. The database is the guarantee; this is the
 * layer that turns a violation into a field-level message instead of a 23514.
 *
 * The privacy vocabulary itself — the three status enums and the "is it actually
 * public" predicate — lives in `./media-privacy.ts` and is shared with journey
 * stories, which attach photographs of the same classrooms under the same rules.
 * It is re-exported here so existing call sites keep their import path.
 */

export {
  consentStatuses,
  isPubliclyRendered,
  mediaVisibilities,
  privacyStatuses,
  type ConsentStatus,
  type MediaVisibility,
  type PrivacyStatus,
};

export const experienceMediaRoles = ["cover", "gallery"] as const;
export type ExperienceMediaRole = (typeof experienceMediaRoles)[number];

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
 * One attachment as edited in the admin.
 *
 * `mediaId` is the only field that cannot change after creation — replacing the
 * image means replacing the attachment, which keeps the audit trail honest about
 * what was actually published.
 */
export const experienceMediaSchema = z
  .object({
    mediaId: z.uuid({ message: "mediaRequired" }),
    role: z.enum(experienceMediaRoles),
    sortOrder: z.coerce.number().int().min(0).max(9999),

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
  /*
   * The publication invariant, checked here so it arrives as a field error on the
   * control the admin just changed rather than as a database check violation.
   */
  .refine(
    (data) => data.visibility !== "public" || data.privacyStatus === "approved",
    { message: "publicNeedsApproval", path: ["visibility"] },
  )
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
   * be busywork; requiring it at publication time is the point at which the
   * omission would actually harm someone. English is the fallback locale, so it
   * is the one that must exist.
   */
  .refine(
    (data) => data.visibility !== "public" || Boolean(data.altTextEn),
    { message: "publicNeedsAltText", path: ["altTextEn"] },
  );

export type ExperienceMediaInput = z.infer<typeof experienceMediaSchema>;

/** Reordering payload: the attachment ids in their new display order. */
export const experienceMediaOrderSchema = z.object({
  experienceId: z.uuid(),
  orderedIds: z.array(z.uuid()).max(60),
});

/**
 * The privacy checklist for experience photographs.
 *
 * Deliberately not the same list as `PRIVACY_CHECKLIST` in ./certificate.ts. That
 * one is about a scanned document — ID numbers, signatures, verification codes. A
 * classroom photograph fails in entirely different ways, and reusing the document
 * list would have the reviewer ticking irrelevant boxes, which is how a checklist
 * stops being read.
 *
 * As with the certificate list, which boxes were ticked is NOT persisted. Storing
 * them would imply a legal record of consent that a CMS cannot substantiate; only
 * the reviewer, the timestamp and the note are kept.
 */
export const EXPERIENCE_PHOTO_CHECKLIST: Array<{
  id: string;
  label: string;
  detail: string;
}> = [
  {
    id: "permission",
    label: "I have permission to publish this photograph",
    detail:
      "From the school or organisation, and from any adult who is identifiable in it.",
  },
  {
    id: "minors",
    label: "Identifiable minors are permitted, or are not identifiable",
    detail:
      "Pupils' faces need the school's permission. If you do not have it, use a photograph taken from behind, or crop and blur before uploading — this CMS does not blur for you.",
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
      "A school is normally fine. A private home is not — a tutoring photograph should not identify where a pupil lives.",
  },
  {
    id: "caption",
    label: "The caption and alt text reveal nothing private",
    detail:
      "Do not name pupils, and do not describe anyone's circumstances. Describe the professional activity.",
  },
];

/**
 * Why a given photograph cannot be published yet.
 *
 * Returns message codes rather than sentences, for the same reason every other
 * result in this codebase does: the server does not choose the reader's language.
 */
export function photoPublishBlockers(input: {
  privacyStatus: PrivacyStatus;
  consentStatus: ConsentStatus;
  altTextEn: string | null | undefined;
}): string[] {
  return mediaPublishBlockers(input);
}

export const experienceMediaErrorLabels: Record<string, string> = {
  mediaRequired: "Choose an image from the media library.",
  invalidDate: "Use the date picker, or the format YYYY-MM-DD.",
  focalOutOfRange: "The focal point must be between 0 and 1.",
  publicNeedsApproval:
    "Record a privacy review and approve the photograph before making it public.",
  publicNeedsConsent:
    "Consent must be confirmed, or marked as not required, before publishing.",
  publicNeedsAltText: "English alt text is required before a photograph goes public.",
  privacyPending: "The privacy review has not been completed.",
  privacyRejected: "This photograph was rejected in privacy review.",
  consentPending: "Consent has not been confirmed.",
  consentDenied: "Consent was denied for this photograph.",
  altTextMissing: "English alt text is missing.",
  alreadyAttached: "That image is already attached to this experience.",
  coverExists: "This experience already has a cover image.",
  notAnImage: "Only images can be attached — PDFs cannot be displayed inline.",
  privateAsset:
    "That file is stored privately and has no public URL, so it cannot be shown on the public page.",
  stillAttached:
    "This image is still attached to an experience entry. Remove the attachment first.",
};

export function collectExperienceMediaErrors(
  error: z.ZodError,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!result[path]) result[path] = issue.message;
  }
  return result;
}
