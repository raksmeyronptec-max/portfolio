"use server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/log";
import {
  fail,
  fromPostgresError,
  ok,
  revalidatePublicContent,
  type ActionResult,
} from "./result";
import { locales } from "@/i18n/config";

/**
 * Resume version management.
 *
 * The interesting property: activation is atomic and exclusive per locale, done in
 * a `SECURITY DEFINER` database function (`activate_resume_version`) rather than as
 * two application-level updates. Two sequential updates would leave a window with
 * either no active resume or two, and the storage policy keys public readability off
 * exactly that flag — so a race here would briefly expose the wrong file or none at
 * all.
 */

const resumeVersionSchema = z.object({
  version_label: z.string().trim().min(1, { message: "labelRequired" }).max(120),
  locale: z.enum(locales),
  media_id: z.uuid({ message: "fileRequired" }),
  notes: z
    .string()
    .trim()
    .max(1000)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
  activate: z.boolean().default(false),
});

export async function createResumeVersion(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("manageResume");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = resumeVersionSchema.safeParse(input);
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

    /*
     * The attached file must live in the `resumes` bucket.
     *
     * Without this check an editor could attach a public image as a "resume", and
     * the download endpoint would then stream it as a PDF. The bucket is the real
     * boundary, so it is what gets verified.
     */
    const { data: asset } = await supabase
      .from("media_assets")
      .select("bucket_id, mime_type, original_filename")
      .eq("id", data.media_id)
      .maybeSingle();

    if (!asset) return fail("not_found", { detail: "That file no longer exists." });

    if (asset.bucket_id !== "resumes") {
      return fail("validation", {
        fields: { media_id: "notAResumeFile" },
        detail:
          "Select a file uploaded as “Resume PDF”. Other files are not stored in the resumes bucket.",
      });
    }

    const { data: created, error } = await supabase
      .from("resume_versions")
      .insert({
        version_label: data.version_label,
        locale: data.locale,
        media_id: data.media_id,
        notes: data.notes ?? null,
        // Never active on insert — activation goes through the RPC so the
        // one-active-per-locale invariant is enforced in a single transaction.
        is_active: false,
      })
      .select("id")
      .single();

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "resume.uploaded",
      actor: auth.session,
      entityType: "resume_version",
      entityId: created.id,
      entityLabel: data.version_label,
      summary: `Added resume version “${data.version_label}” (${data.locale}) from ${asset.original_filename}.`,
    });

    if (data.activate) {
      const activation = await activateResumeVersion(created.id);
      if (!activation.ok) return activation;
    }

    return ok({ id: created.id });
  } catch {
    return fail("server_error");
  }
}

/**
 * Make a version the active one for its locale.
 *
 * Delegates to `public.activate_resume_version`, which deactivates the previous
 * version and activates this one in one statement pair inside a single function
 * call, and re-checks `can_edit_content()` server-side.
 */
export async function activateResumeVersion(
  resumeId: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("manageResume");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc("activate_resume_version", {
      p_id: resumeId,
    });

    if (error) return fromPostgresError(error);

    const activated = data as unknown as
      | { version_label: string; locale: string }
      | null;

    await writeAuditLog({
      action: "resume.activated",
      actor: auth.session,
      entityType: "resume_version",
      entityId: resumeId,
      entityLabel: activated?.version_label ?? resumeId,
      summary: `Activated as the public resume for ${activated?.locale ?? "its locale"}. The previous version is no longer publicly readable.`,
    });

    revalidatePublicContent({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function archiveResumeVersion(
  resumeId: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("manageResume");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("resume_versions")
      .select("version_label, is_active, locale")
      .eq("id", resumeId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    /*
     * Refuse to archive the active version.
     *
     * Archiving revokes public read access to the file through the storage policy,
     * so archiving the active resume would leave the public Resume page with a
     * download button pointing at nothing. Activate a replacement first.
     */
    if (existing.is_active) {
      return fail("conflict", {
        detail: `“${existing.version_label}” is the active ${existing.locale.toUpperCase()} resume. Activate a different version first, then archive this one.`,
      });
    }

    const { error } = await supabase
      .from("resume_versions")
      .update({ is_archived: true, is_active: false })
      .eq("id", resumeId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "resume.archived",
      actor: auth.session,
      entityType: "resume_version",
      entityId: resumeId,
      entityLabel: existing.version_label,
      summary: "Archived. The file is no longer publicly readable.",
    });

    revalidatePublicContent({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function unarchiveResumeVersion(
  resumeId: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("manageResume");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("resume_versions")
      .update({ is_archived: false })
      .eq("id", resumeId);

    if (error) return fromPostgresError(error);

    revalidatePublicContent({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}
