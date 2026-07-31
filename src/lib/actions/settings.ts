"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/auth/guards";
import { diffRecords, writeAuditLog } from "@/lib/audit/log";
import {
  seoOverrideSchema,
  siteSettingsSchema,
} from "@/lib/validation/settings";

import {
  fail,
  fromPostgresError,
  ok,
  revalidatePublicContent,
  type ActionResult,
} from "./result";

/**
 * Site settings and SEO overrides.
 *
 * Both write values that appear on every public page, so both revalidate the whole
 * public surface rather than a single path.
 */

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
