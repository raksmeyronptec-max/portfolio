import { z } from "zod";

import { locales } from "@/i18n/config";

/**
 * Certificate validation.
 *
 * The privacy model is the reason this file exists separately from the project
 * schema. A credential scan can carry a national ID, a date of birth, a signature,
 * a home address or a private QR code. So:
 *
 *  - The public surface is a *redacted preview*, which is required to publish.
 *  - The original scan lives in a private bucket and is never publicly linkable.
 *  - A privacy review must be recorded before publication. The database enforces
 *    this with a trigger, so the rule holds even if a future code path forgets it.
 *
 * `PRIVACY_CHECKLIST` below is the human half of that: the specific things to look
 * for before ticking the box.
 */

export const publicationStatuses = ["draft", "in_review", "published", "archived"] as const;
export const credentialStatuses = ["active", "expired", "revoked", "unverified"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .refine(
    (value) => value === null || value === undefined || /^https?:\/\//i.test(value),
    { message: "urlMustBeAbsolute" },
  );

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

export const certificateTranslationSchema = z.object({
  locale: z.enum(locales),
  title: z.string().trim().min(1, { message: "titleRequired" }).max(250),
  description: optionalText(4000),

  /**
   * A written description of what the document shows.
   *
   * This is the text alternative to the scan. A certificate image is unreadable to
   * a screen reader and to anyone who cannot see it, so without this the page is a
   * dead end for those users — which is why it is part of the publish checklist.
   */
  image_summary: optionalText(1500),

  seo_title: z
    .string()
    .trim()
    .max(70, { message: "seoTitleTooLong" })
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
  seo_description: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine(
      (value) =>
        value === null ||
        value === undefined ||
        (value.length >= 50 && value.length <= 160),
      { message: "seoDescriptionLength" },
    ),
});

export const certificateSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, { message: "slugTooShort" })
      .max(90, { message: "slugTooLong" })
      .regex(/^[a-z0-9-]+$/, { message: "slugFormat" }),

    internal_ref: optionalText(60),
    category_id: z.uuid().nullable().optional(),

    status: z.enum(publicationStatuses),
    credential_status: z.enum(credentialStatuses),
    featured: z.boolean(),
    sort_order: z.coerce.number().int().min(0).max(9999),

    issuer_en: z.string().trim().min(1, { message: "issuerRequired" }).max(250),
    issuer_km: optionalText(250),
    issuer_url: optionalUrl,

    issued_on: optionalDate,
    expires_on: optionalDate,
    credential_id: optionalText(120),
    verification_url: optionalUrl,

    preview_media_id: z.uuid().nullable().optional(),
    original_media_id: z.uuid().nullable().optional(),
    og_image_media_id: z.uuid().nullable().optional(),

    allow_public_download: z.boolean(),
    contains_sensitive_data: z.boolean(),
    privacy_review_note: optionalText(2000),
    /** Set by the form when the checklist is confirmed in this submission. */
    privacy_review_confirmed: z.boolean(),

    needs_review: z.boolean(),
    review_note: optionalText(2000),

    skills: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
    relatedProjectIds: z.array(z.uuid()).max(20).default([]),

    translations: z
      .array(certificateTranslationSchema)
      .min(1, { message: "atLeastOneTranslation" }),
  })
  .refine(
    (data) =>
      !data.issued_on ||
      !data.expires_on ||
      new Date(data.expires_on) >= new Date(data.issued_on),
    { message: "expiryBeforeIssue", path: ["expires_on"] },
  )
  .refine(
    // Mirrors the database trigger: offering a public download of a document still
    // flagged as sensitive is a contradiction, so it is rejected here with a
    // readable message rather than surfacing as a raw check violation.
    (data) => !data.allow_public_download || !data.contains_sensitive_data,
    { message: "downloadWhileSensitive", path: ["allow_public_download"] },
  );

export type CertificateInput = z.infer<typeof certificateSchema>;

/**
 * The redaction checklist.
 *
 * Shown before publishing so the review is a deliberate act against a specific
 * list, not a box someone ticks out of habit.
 */
export const PRIVACY_CHECKLIST: Array<{ id: string; label: string; detail: string }> = [
  {
    id: "national-id",
    label: "National identification number",
    detail: "Cambodian ID numbers appear on many official documents.",
  },
  {
    id: "student-number",
    label: "Student or candidate number",
    detail: "Often printed alongside exam results.",
  },
  {
    id: "date-of-birth",
    label: "Date of birth",
    detail: "Combined with a full name, this is enough for identity fraud.",
  },
  {
    id: "signature",
    label: "Handwritten signature",
    detail: "Yours and the issuing officer's.",
  },
  {
    id: "address",
    label: "Home address",
    detail: "Including a village, commune or district that identifies a residence.",
  },
  {
    id: "qr-code",
    label: "QR codes and barcodes",
    detail: "These frequently encode a private verification URL or an ID number.",
  },
  {
    id: "serial",
    label: "Serial and certificate numbers",
    detail: "Redact unless the number is meant to be public for verification.",
  },
  {
    id: "contact",
    label: "Personal phone number or email",
    detail: "Yours or anyone else's named on the document.",
  },
  {
    id: "third-parties",
    label: "Other people's details",
    detail: "Class lists, co-signatories and other candidates' results.",
  },
];

/**
 * Publish readiness.
 *
 * Editorial and privacy requirements for going live. Saving a draft is never
 * blocked — a half-entered credential must be storable.
 */
export function certificatePublishBlockers(input: CertificateInput): string[] {
  const blockers: string[] = [];

  const defaultTranslation =
    input.translations.find((t) => t.locale === "en") ?? input.translations[0];

  if (!defaultTranslation) {
    blockers.push("noTranslation");
    return blockers;
  }

  if (!defaultTranslation.title.trim()) blockers.push("titleMissing");

  // The text alternative to an unreadable image.
  if (!defaultTranslation.image_summary?.trim()) blockers.push("imageSummaryMissing");

  if (!input.preview_media_id) blockers.push("previewMissing");

  if (!input.privacy_review_confirmed) blockers.push("privacyReviewMissing");

  if (!input.issued_on) blockers.push("issueDateMissing");

  if (input.needs_review) blockers.push("needsReview");

  if (input.allow_public_download && input.contains_sensitive_data) {
    blockers.push("downloadWhileSensitive");
  }

  return blockers;
}

export const certificateBlockerLabels: Record<string, string> = {
  noTranslation: "At least one language version is required.",
  titleMissing: "A title is required.",
  imageSummaryMissing:
    "A written description of what the document shows is required — the scan itself is unreadable to screen readers.",
  previewMissing:
    "A redacted preview image is required. The private original is never shown publicly.",
  privacyReviewMissing:
    "Complete the redaction checklist and confirm the privacy review before publishing.",
  issueDateMissing: "An issue date is required so the credential can be placed in time.",
  needsReview:
    "This credential is still marked “needs review”. Confirm the unverified details first.",
  downloadWhileSensitive:
    "Public download cannot be enabled while the document is flagged as containing sensitive data.",
};

export function collectCertificateErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!result[path]) result[path] = issue.message;
  }
  return result;
}
