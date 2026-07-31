import { z } from "zod";

import { locales } from "@/i18n/config";

/**
 * Site settings and SEO overrides — schemas and error labels.
 *
 * Kept out of the Server Action module: a `"use server"` file may only export
 * async functions, and a schema or label object exported from one makes every
 * action in that file fail at invocation time with
 * "A \"use server\" file can only export async functions, found object."
 * See src/lib/validation/profile.ts for the full note.
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

export const siteSettingsSchema = z.object({
  site_name_en: z.string().trim().min(1, { message: "nameRequired" }).max(120),
  site_name_km: z.string().trim().min(1, { message: "nameRequired" }).max(120),
  tagline_en: optionalText(300),
  tagline_km: optionalText(300),
  positioning_en: optionalText(500),
  positioning_km: optionalText(500),
  hero_headline_en: optionalText(300),
  hero_headline_km: optionalText(300),
  hero_subheadline_en: optionalText(800),
  hero_subheadline_km: optionalText(800),
  availability_status_en: optionalText(200),
  availability_status_km: optionalText(200),
  is_available_for_work: z.boolean(),
  location_en: optionalText(200),
  location_km: optionalText(200),
  contact_email: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine(
      (value) =>
        value === null || value === undefined || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
      { message: "invalidEmail" },
    ),
  telegram_handle: optionalText(80),
  facebook_url: optionalUrl,
  github_url: optionalUrl,
  linkedin_url: optionalUrl,
  google_site_verification: optionalText(200),
  contact_form_enabled: z.boolean(),
  analytics_enabled: z.boolean(),
  chat_widget_enabled: z.boolean(),
});

export const seoOverrideSchema = z.object({
  route_key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, { message: "routeKeyFormat" }),
  locale: z.enum(locales),
  title: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine(
      (value) =>
        value === null ||
        value === undefined ||
        (value.length >= 15 && value.length <= 70),
      { message: "titleLength" },
    ),
  description: z
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
      { message: "descriptionLength" },
    ),
  canonical_url: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine(
      (value) => value === null || value === undefined || /^https:\/\//i.test(value),
      { message: "canonicalMustBeHttps" },
    ),
  og_image_media_id: z.uuid().nullable().optional(),
  is_indexable: z.boolean(),
  include_in_sitemap: z.boolean(),
});

export const seoErrorLabels: Record<string, string> = {
  nameRequired: "A site name is required in both languages.",
  invalidEmail: "Enter a valid email address.",
  urlMustBeAbsolute: "Enter a full URL starting with https://",
  routeKeyFormat: "Use lower-case letters, numbers and hyphens only.",
  titleLength: "A title must be between 15 and 70 characters, or left empty.",
  descriptionLength:
    "A description must be between 50 and 160 characters, or left empty.",
  canonicalMustBeHttps: "A canonical URL must start with https://",
  labelRequired: "A version label is required.",
  fileRequired: "Select an uploaded resume PDF.",
  notAResumeFile: "That file was not uploaded as a resume PDF.",
};

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
export type SeoOverrideInput = z.infer<typeof seoOverrideSchema>;
