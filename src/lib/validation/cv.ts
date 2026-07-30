import { z } from "zod";

import { locales } from "@/i18n/config";

/**
 * Education, experience, capability and testimonial schemas.
 *
 * A recurring decision across all four: dates are optional and paired with a
 * free-text `period_label`. The migrated v1 content evidences years but not months,
 * and the teaching practicum has no date at all. A required `date` column would
 * force an invented day, so the label carries exactly the precision that is known
 * and the date columns exist only for sorting and structured data.
 */

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

const slug = z
  .string()
  .trim()
  .min(2, { message: "slugTooShort" })
  .max(80, { message: "slugTooLong" })
  .regex(/^[a-z0-9-]+$/, { message: "slugFormat" });

const publicationStatus = z.enum(["draft", "in_review", "published", "archived"]);

// ── Education ───────────────────────────────────────────────────────────────

export const educationKinds = [
  "high_school",
  "teacher_education",
  "university",
  "professional_development",
  "certification",
  "other",
] as const;

export const educationSchema = z
  .object({
    slug,
    status: publicationStatus,
    kind: z.enum(educationKinds),
    sort_order: z.coerce.number().int().min(0).max(9999),

    institution_url: optionalUrl,
    started_on: optionalDate,
    ended_on: optionalDate,
    is_current: z.boolean(),

    period_label_en: optionalText(120),
    period_label_km: optionalText(120),
    schedule_label_en: optionalText(120),
    schedule_label_km: optionalText(120),

    grade_value: optionalText(40),
    grade_scale: optionalText(120),
    grade_source_note: optionalText(500),

    needs_review: z.boolean(),
    review_note: optionalText(2000),

    translations: z
      .array(
        z.object({
          locale: z.enum(locales),
          institution: z
            .string()
            .trim()
            .min(1, { message: "institutionRequired" })
            .max(250),
          qualification: optionalText(250),
          field_of_study: optionalText(200),
          description: optionalText(3000),
          achievements: optionalText(3000),
        }),
      )
      .min(1, { message: "atLeastOneTranslation" }),
  })
  .refine((data) => !data.is_current || !data.ended_on, {
    message: "currentHasEndDate",
    path: ["ended_on"],
  })
  .refine(
    (data) =>
      !data.started_on ||
      !data.ended_on ||
      new Date(data.ended_on) >= new Date(data.started_on),
    { message: "endBeforeStart", path: ["ended_on"] },
  )
  .refine(
    /*
     * A grade may not be stored without its scale.
     *
     * This is the schema-level answer to v1's "3.79" and "A" appearing as bare
     * numbers. 3.79 out of what? An A on which scale? Mirrors the
     * `education_grade_needs_scale` CHECK constraint.
     */
    (data) => !data.grade_value || Boolean(data.grade_scale),
    { message: "gradeNeedsScale", path: ["grade_scale"] },
  );

export type EducationInput = z.infer<typeof educationSchema>;

// ── Experience ──────────────────────────────────────────────────────────────

export const experienceKinds = [
  "teaching",
  "practicum",
  "development",
  "volunteer",
  "leadership",
  "tutoring",
  "other",
] as const;

export const experienceSchema = z
  .object({
    slug,
    status: publicationStatus,
    kind: z.enum(experienceKinds),
    sort_order: z.coerce.number().int().min(0).max(9999),

    organization_url: optionalUrl,
    location_en: optionalText(200),
    location_km: optionalText(200),
    employment_type: optionalText(80),

    started_on: optionalDate,
    ended_on: optionalDate,
    is_current: z.boolean(),
    period_label_en: optionalText(120),
    period_label_km: optionalText(120),

    needs_review: z.boolean(),
    review_note: optionalText(2000),

    tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),

    translations: z
      .array(
        z.object({
          locale: z.enum(locales),
          role_title: z.string().trim().min(1, { message: "roleRequired" }).max(250),
          organization: z
            .string()
            .trim()
            .min(1, { message: "organizationRequired" })
            .max(250),
          summary: optionalText(600),
          description: optionalText(4000),
          achievements: optionalText(3000),
        }),
      )
      .min(1, { message: "atLeastOneTranslation" }),
  })
  .refine((data) => !data.is_current || !data.ended_on, {
    message: "currentHasEndDate",
    path: ["ended_on"],
  })
  .refine(
    (data) =>
      !data.started_on ||
      !data.ended_on ||
      new Date(data.ended_on) >= new Date(data.started_on),
    { message: "endBeforeStart", path: ["ended_on"] },
  );

export type ExperienceInput = z.infer<typeof experienceSchema>;

// ── Testimonials ────────────────────────────────────────────────────────────

export const relationships = [
  "colleague",
  "mentor",
  "classmate",
  "supervisor",
  "collaborator",
  "student",
  "other",
] as const;

/**
 * Note what this schema cannot express: a rating, and any private contact detail.
 *
 * v1 published invented five-star ratings on real people's words, and one referee's
 * mobile number. Neither has a field here, so neither can return.
 *
 * `consent_confirmed` is required to publish and is enforced by a database trigger
 * as well — a quote attributed to a named person should not go public on the
 * author's word alone.
 */
export const testimonialSchema = z.object({
  slug,
  status: publicationStatus,
  featured: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(9999),

  author_name_en: z.string().trim().min(1, { message: "authorRequired" }).max(200),
  author_name_km: optionalText(200),
  /** Public profile link only. */
  author_url: optionalUrl,
  avatar_media_id: z.uuid().nullable().optional(),
  relationship: z.enum(relationships).nullable().optional(),

  consent_confirmed: z.boolean(),
  consent_note: optionalText(1000),

  translations: z
    .array(
      z.object({
        locale: z.enum(locales),
        quote: z
          .string()
          .trim()
          .min(1, { message: "quoteRequired" })
          .max(1200, { message: "quoteTooLong" }),
        author_role: optionalText(200),
        organization: optionalText(200),
      }),
    )
    .min(1, { message: "atLeastOneTranslation" }),
});

export type TestimonialInput = z.infer<typeof testimonialSchema>;

export function testimonialPublishBlockers(input: TestimonialInput): string[] {
  const blockers: string[] = [];
  if (!input.consent_confirmed) blockers.push("consentMissing");

  const primary =
    input.translations.find((t) => t.locale === "en") ?? input.translations[0];
  if (!primary?.quote.trim()) blockers.push("quoteMissing");

  return blockers;
}

// ── Capabilities ────────────────────────────────────────────────────────────

/** No proficiency field by design — evidence is a project link, not a score. */
export const skillCategorySchema = z.object({
  slug,
  name_en: z.string().trim().min(1, { message: "nameRequired" }).max(120),
  name_km: optionalText(120),
  description_en: optionalText(600),
  description_km: optionalText(600),
  icon: optionalText(40),
  sort_order: z.coerce.number().int().min(0).max(9999),
  is_published: z.boolean(),
});

export const skillSchema = z.object({
  category_id: z.uuid(),
  slug,
  name_en: z.string().trim().min(1, { message: "nameRequired" }).max(120),
  name_km: optionalText(120),
  description_en: optionalText(600),
  description_km: optionalText(600),
  sort_order: z.coerce.number().int().min(0).max(9999),
  is_published: z.boolean(),
  projectIds: z.array(z.uuid()).max(40).default([]),
});

export type SkillCategoryInput = z.infer<typeof skillCategorySchema>;
export type SkillInput = z.infer<typeof skillSchema>;

// ── Shared error labels ─────────────────────────────────────────────────────

export const cvErrorLabels: Record<string, string> = {
  slugTooShort: "The slug must be at least 2 characters.",
  slugTooLong: "The slug is too long.",
  slugFormat: "Use lower-case letters, numbers and hyphens only.",
  slugTaken: "That slug is already in use.",
  institutionRequired: "The institution name is required.",
  roleRequired: "The role title is required.",
  organizationRequired: "The organisation is required.",
  authorRequired: "The author's name is required.",
  quoteRequired: "The quote is required.",
  quoteTooLong: "The quote must be 1,200 characters or fewer.",
  nameRequired: "A name is required.",
  urlMustBeAbsolute: "Enter a full URL starting with https://",
  invalidDate: "Use the date picker, or the format YYYY-MM-DD.",
  endBeforeStart: "The end date cannot be before the start date.",
  currentHasEndDate: "Remove the end date, or untick “currently ongoing”.",
  gradeNeedsScale:
    "A grade needs its scale — “3.79” and “A” are meaningless without one.",
  consentMissing:
    "Recorded consent is required before publishing a quote attributed to a named person.",
  quoteMissing: "A quote is required.",
  atLeastOneTranslation: "At least one language version is required.",
};

export function collectCvErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!result[path]) result[path] = issue.message;
  }
  return result;
}
