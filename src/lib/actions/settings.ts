"use server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/auth/guards";
import { diffRecords, writeAuditLog } from "@/lib/audit/log";
import {
  fail,
  fromPostgresError,
  ok,
  revalidatePublicContent,
  type ActionResult,
} from "./result";
import { locales } from "@/i18n/config";

/**
 * Site settings and SEO overrides.
 *
 * Both write values that appear on every public page, so both revalidate the whole
 * public surface rather than a single path.
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

export async function saveSiteSettings(input: unknown): Promise<ActionResult<void>> {
  // Owner-only: these values affect every page and include the contact channel.
  const auth = await checkPermission("manageSettings");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = siteSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fields[path]) fields[path] = issue.message;
    }
    return fail("validation", { fields });
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data: before } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    const row = {
      id: true as const,
      ...parsed.data,
      contact_email: parsed.data.contact_email ?? null,
    };

    // Upsert rather than update: the table is a singleton enforced by a CHECK on a
    // constant primary key, and it may legitimately be empty on a fresh install.
    const { error } = await supabase
      .from("site_settings")
      .upsert(row, { onConflict: "id" });

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "settings.updated",
      actor: auth.session,
      entityType: "site_settings",
      summary: "Updated site settings.",
      changes: diffRecords(before as Record<string, unknown> | null, row),
    });

    revalidatePublicContent({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

// ── SEO overrides ───────────────────────────────────────────────────────────

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

export async function saveSeoOverride(input: unknown): Promise<ActionResult<void>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = seoOverrideSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fields[path]) fields[path] = issue.message;
    }
    return fail("validation", { fields });
  }

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("seo_overrides").upsert(
      {
        route_key: data.route_key,
        locale: data.locale,
        title: data.title ?? null,
        description: data.description ?? null,
        canonical_url: data.canonical_url ?? null,
        og_image_media_id: data.og_image_media_id ?? null,
        is_indexable: data.is_indexable,
        // A noindex page in the sitemap is a contradictory signal, so the two are
        // kept consistent here rather than left to the operator to remember.
        include_in_sitemap: data.is_indexable ? data.include_in_sitemap : false,
      },
      { onConflict: "route_key,locale" },
    );

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "seo.updated",
      actor: auth.session,
      entityType: "seo_override",
      entityLabel: `${data.route_key} (${data.locale})`,
      summary: `Updated SEO metadata. Indexable: ${data.is_indexable ? "yes" : "no"}.`,
    });

    revalidatePublicContent({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

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
