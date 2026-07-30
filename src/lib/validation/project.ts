import { z } from "zod";

import { locales } from "@/i18n/config";

/**
 * Project validation.
 *
 * The same schema runs in the browser and in the Server Action. The database then
 * enforces the same rules a third time through CHECK constraints, so a value that
 * gets past both layers still cannot be stored.
 *
 * Note what is *optional* here: team size, duration, dates, repository URL and
 * every metric. That is deliberate. The three real projects cannot have those facts
 * verified from outside, and a required field would force a guess. An empty field
 * plus `needs_review` is honest; a plausible-looking placeholder is not.
 */

export const publicationStatuses = ["draft", "in_review", "published", "archived"] as const;
export const projectStatuses = [
  "live",
  "in_development",
  "maintained",
  "sunset",
  "concept",
] as const;

/** Trim, then treat an empty string as absent. */
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

export const slugSchema = z
  .string()
  .trim()
  .min(2, { message: "slugTooShort" })
  .max(80, { message: "slugTooLong" })
  .regex(/^[a-z0-9-]+$/, { message: "slugFormat" });

/** One locale's worth of case-study prose. */
export const projectTranslationSchema = z.object({
  locale: z.enum(locales),
  title: z.string().trim().min(1, { message: "titleRequired" }).max(200),
  summary: optionalText(400),

  overview: optionalText(6000),
  problem: optionalText(6000),
  target_users: optionalText(2000),
  goals: optionalText(3000),
  my_role: optionalText(3000),
  responsibilities: optionalText(3000),
  constraints: optionalText(3000),
  research: optionalText(6000),
  ux_decisions: optionalText(6000),
  architecture: optionalText(6000),
  database_decisions: optionalText(6000),
  key_features: optionalText(6000),
  security_notes: optionalText(6000),
  accessibility_notes: optionalText(6000),
  seo_notes: optionalText(6000),
  performance_notes: optionalText(6000),
  challenges: optionalText(6000),
  solution: optionalText(6000),
  results: optionalText(6000),
  lessons: optionalText(6000),
  next_steps: optionalText(3000),

  // Mirrors the database CHECK constraints exactly, so a value that passes here
  // cannot then be rejected by Postgres with an opaque error.
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

export const projectSchema = z.object({
  slug: slugSchema,
  status: z.enum(publicationStatuses),
  project_status: z.enum(projectStatuses),
  featured: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(9999),

  role_en: optionalText(200),
  role_km: optionalText(200),
  organization_en: optionalText(200),
  organization_km: optionalText(200),

  team_size: z
    .union([z.coerce.number().int().min(1).max(500), z.literal("")])
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),

  duration_label_en: optionalText(120),
  duration_label_km: optionalText(120),
  period_label_en: optionalText(120),
  period_label_km: optionalText(120),
  year_label: optionalText(40),

  live_url: optionalUrl,
  repository_url: optionalUrl,
  demo_video_url: optionalUrl,

  cover_media_id: z.uuid().nullable().optional(),
  og_image_media_id: z.uuid().nullable().optional(),

  started_at: optionalDate,
  completed_at: optionalDate,

  needs_review: z.boolean(),
  review_note: optionalText(2000),

  categoryIds: z.array(z.uuid()).max(20).default([]),
  technologyIds: z.array(z.uuid()).max(40).default([]),

  translations: z
    .array(projectTranslationSchema)
    .min(1, { message: "atLeastOneTranslation" }),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectTranslationInput = z.infer<typeof projectTranslationSchema>;

/**
 * Publish readiness.
 *
 * Separate from the schema because these are *editorial* requirements for going
 * live, not structural requirements for saving a draft. A half-written case study
 * must be saveable; it just must not be publishable.
 *
 * Returned as codes so the admin UI can list them as a checklist.
 */
export function publishBlockers(input: ProjectInput): string[] {
  const blockers: string[] = [];

  const defaultTranslation =
    input.translations.find((t) => t.locale === "en") ?? input.translations[0];

  if (!defaultTranslation) {
    blockers.push("noTranslation");
    return blockers;
  }

  if (!defaultTranslation.summary?.trim()) blockers.push("summaryMissing");
  if (!defaultTranslation.overview?.trim()) blockers.push("overviewMissing");
  if (!defaultTranslation.problem?.trim()) blockers.push("problemMissing");
  if (!defaultTranslation.solution?.trim()) blockers.push("solutionMissing");
  if (!defaultTranslation.seo_description?.trim()) blockers.push("seoDescriptionMissing");
  if (!input.cover_media_id) blockers.push("coverMissing");
  if (input.needs_review) blockers.push("needsReview");

  return blockers;
}

/** Human-readable labels for the blocker codes, shown in the publish checklist. */
export const publishBlockerLabels: Record<string, string> = {
  noTranslation: "At least one language version is required.",
  summaryMissing: "A short summary is required — it is used on cards and in search results.",
  overviewMissing: "The case study needs an Overview section.",
  problemMissing: "The case study needs a Problem section.",
  solutionMissing: "The case study needs a Solution section.",
  seoDescriptionMissing:
    "An SEO description (50–160 characters) is required so search engines do not invent one.",
  coverMissing: "A cover image is required for the card and the social preview.",
  needsReview:
    "This project is still marked “needs review”. Confirm the unverified facts, then clear the flag.",
};

/**
 * Generate a URL slug from a title.
 *
 * Mirrors the `public.slugify` SQL function, including the Khmer fallback: Khmer
 * has no case and no ASCII transliteration, so Khmer-only input would otherwise
 * produce an empty slug. The caller is expected to offer this as a suggestion the
 * editor can override.
 */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    // Strip combining marks so accented Latin reduces to ASCII.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base.slice(0, 80);
}

/** Field-level errors keyed by a dotted path, e.g. `translations.0.title`. */
export function collectProjectErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!result[path]) result[path] = issue.message;
  }

  return result;
}
