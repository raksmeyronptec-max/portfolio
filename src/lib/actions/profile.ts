"use server";

import { diffRecords, writeAuditLog } from "@/lib/audit/log";
import { checkPermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ownerProfileSchema } from "@/lib/validation/profile";

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
 * self-granted through this action. Moving that flag is a separate, owner-only
 * operation — see `claimSiteOwner` at the bottom of this file.
 */

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

/**
 * Claim the site-owner profile for the signed-in account.
 *
 * Fixes the trap this page could otherwise sit in indefinitely: `public_profile`
 * is `where is_site_owner`, only the seed ever set that flag, and on a real
 * deployment the owner's row arrives without it. Everything saved above is then
 * written to a row the public site never reads — silently, because the pages
 * simply fall back to site settings and still look correct.
 *
 * The work is done by the `claim_site_owner()` RPC rather than here. Claiming has
 * to clear the flag on whichever row currently holds it, which `profiles_self_update`
 * cannot express — a caller may only touch their own row — and putting the
 * authorisation check in the database means it applies to psql and Supabase Studio
 * too, not just to this action. The function takes no arguments: it always claims
 * for `auth.uid()`, so it cannot be used to hand the site's identity to anyone else.
 *
 * The permission check here is the same one the save above uses. It is not the
 * boundary — the RPC re-checks `is_owner()` — it just turns a refusal into a typed
 * result the form can render instead of a raised exception.
 */
export async function claimSiteOwner(): Promise<ActionResult<void>> {
  const auth = await checkPermission("manageSettings");
  if (!auth.ok) {
    return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("claim_site_owner");

    if (error) {
      // 42501 is the RPC refusing a non-owner; anything else is unexpected.
      if (error.code === "42501") return fail("forbidden");
      return fromPostgresError(error);
    }

    await writeAuditLog({
      action: "profile.site_owner_claimed",
      actor: auth.session,
      entityType: "profile",
      entityId: auth.session.userId,
      summary:
        "Claimed the site-owner profile. The public site now reads this " +
        "account's name, headline, biography and portrait.",
    });

    // Every public surface reads the owner profile, so all of them are stale.
    revalidatePublicContent({});

    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}
