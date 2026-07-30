"use server";

import { z } from "zod";

import { diffRecords, writeAuditLog } from "@/lib/audit/log";
import { checkPermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  fail,
  fromPostgresError,
  ok,
  revalidatePublicContent,
  type ActionResult,
} from "./result";

/**
 * The site owner's public profile.
 *
 * Separate from site settings on purpose. Site settings are about the *site*
 * (hero copy, feature switches, contact channels); this is about the *person*
 * (name, headline, biography, portrait) and is the source for the `public_profile`
 * view that the homepage and About page read.
 *
 * The write goes through the RLS-constrained client, so `profiles_self_update`
 * is the final authority: a signed-in admin can only ever rewrite their own row,
 * and `is_site_owner` is not in the schema below and therefore cannot be
 * self-granted through this action.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const ownerProfileSchema = z.object({
  display_name: z.string().trim().min(1, { message: "nameRequired" }).max(120),
  public_headline_en: optionalText(300),
  public_headline_km: optionalText(300),
  public_bio_en: optionalText(2000),
  public_bio_km: optionalText(2000),
  public_location: optionalText(200),
  /**
   * Either a media asset chosen from the library or an empty string. Stored
   * alongside the resolved URL so "which upload is this?" stays answerable.
   */
  avatar_media_id: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine(
      (value) =>
        value === null ||
        value === undefined ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
      { message: "invalidMediaId" },
    ),
  /**
   * A root-relative path (`/image/portrait.jpg`) or an absolute https URL.
   * Root-relative is allowed because the migrated portrait still lives in
   * `public/`; refusing it would mean pretending the file is not there.
   */
  public_avatar_url: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine(
      (value) =>
        value === null ||
        value === undefined ||
        value.startsWith("/") ||
        /^https:\/\//i.test(value),
      { message: "avatarUrlFormat" },
    )
    .refine((value) => value === null || value === undefined || !value.startsWith("//"), {
      message: "avatarUrlFormat",
    }),
});

export async function saveOwnerProfile(input: unknown): Promise<ActionResult<void>> {
  // Owner-only: these fields are the public identity of the site.
  const auth = await checkPermission("manageSettings");
  if (!auth.ok) {
    return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");
  }

  const parsed = ownerProfileSchema.safeParse(input);
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

    const { data: before } = await supabase
      .from("profiles")
      .select(
        `id, display_name, public_headline_en, public_headline_km,
         public_bio_en, public_bio_km, public_location,
         public_avatar_url, avatar_media_id`,
      )
      .eq("id", auth.session.userId)
      .maybeSingle();

    if (!before) return fail("not_found");

    const row = {
      display_name: data.display_name,
      public_headline_en: data.public_headline_en ?? null,
      public_headline_km: data.public_headline_km ?? null,
      public_bio_en: data.public_bio_en ?? null,
      public_bio_km: data.public_bio_km ?? null,
      public_location: data.public_location ?? null,
      public_avatar_url: data.public_avatar_url ?? null,
      avatar_media_id: data.avatar_media_id ?? null,
    };

    // `.eq('id', …)` in addition to RLS. Belt and braces: if the policy were ever
    // loosened, this statement still cannot touch another person's row.
    const { error } = await supabase
      .from("profiles")
      .update(row)
      .eq("id", auth.session.userId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "profile.updated",
      actor: auth.session,
      entityType: "profile",
      entityId: auth.session.userId,
      entityLabel: data.display_name,
      summary: "Updated the public owner profile.",
      changes: diffRecords(before as Record<string, unknown>, row),
    });

    revalidatePublicContent({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export const profileErrorLabels: Record<string, string> = {
  nameRequired: "A display name is required.",
  invalidMediaId: "Choose a portrait from the media library, or leave it unset.",
  avatarUrlFormat:
    "Use a path that starts with / (a file in public/) or a full https:// URL.",
};
