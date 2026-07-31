"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { signStorageUrl } from "@/lib/storage";
import type { StorageBucket, StorageProvider } from "@/lib/storage/buckets";
import type { Database } from "@/lib/supabase/database.types";
import { checkPermission } from "@/lib/auth/guards";
import { diffRecords, writeAuditLog } from "@/lib/audit/log";
import {
  fail,
  fromPostgresError,
  ok,
  revalidatePublicContent,
  type ActionResult,
} from "./result";
import {
  certificatePublishBlockers,
  certificateSchema,
  collectCertificateErrors,
} from "@/lib/validation/certificate";

/**
 * Certificate Server Actions.
 *
 * The privacy-sensitive parts:
 *
 *  - `saveCertificate` records `privacy_reviewed_at` / `privacy_reviewed_by` from
 *    the *server-side* session, never from the client payload. A submitter cannot
 *    claim someone else performed the review.
 *
 *  - `createOriginalSignedUrl` is the only route to a private scan. It requires the
 *    owner role, mints a 60-second signed URL, and writes an audit entry for every
 *    single access. Viewing an original is a recorded event.
 */

export async function saveCertificate(
  input: unknown,
  certificateId?: string,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = certificateSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectCertificateErrors(parsed.error) });
  }

  const data = parsed.data;

  if (data.status === "published") {
    const blockers = certificatePublishBlockers(data);
    if (blockers.length > 0) {
      return fail("publish_blocked", {
        fields: Object.fromEntries(blockers.map((code) => [code, code])),
        detail: "This credential is not ready to publish yet.",
      });
    }
  }

  const supabase = await createSupabaseServerClient();

  try {
    let before: Record<string, unknown> | null = null;
    let previousStatus: string | null = null;
    let previousReviewedAt: string | null = null;
    let id = certificateId;

    if (certificateId) {
      const { data: existing } = await supabase
        .from("certificates")
        .select("*")
        .eq("id", certificateId)
        .maybeSingle();

      if (!existing) return fail("not_found");
      before = existing as Record<string, unknown>;
      previousStatus = existing.status;
      previousReviewedAt = existing.privacy_reviewed_at;
    }

    /*
     * The privacy review timestamp is server-authored. Once recorded it is kept
     * unless the editor explicitly un-confirms, which clears it — so un-ticking the
     * box genuinely revokes the review rather than leaving a stale approval behind.
     */
    const privacyReviewedAt = data.privacy_review_confirmed
      ? (previousReviewedAt ?? new Date().toISOString())
      : null;

    const row = {
      slug: data.slug,
      internal_ref: data.internal_ref ?? null,
      category_id: data.category_id ?? null,
      status: data.status,
      credential_status: data.credential_status,
      featured: data.featured,
      sort_order: data.sort_order,
      issuer_en: data.issuer_en,
      issuer_km: data.issuer_km ?? null,
      issuer_url: data.issuer_url ?? null,
      issued_on: data.issued_on ?? null,
      expires_on: data.expires_on ?? null,
      credential_id: data.credential_id ?? null,
      verification_url: data.verification_url ?? null,
      preview_media_id: data.preview_media_id ?? null,
      original_media_id: data.original_media_id ?? null,
      og_image_media_id: data.og_image_media_id ?? null,
      allow_public_download: data.allow_public_download,
      contains_sensitive_data: data.contains_sensitive_data,
      privacy_review_note: data.privacy_review_note ?? null,
      privacy_reviewed_at: privacyReviewedAt,
      privacy_reviewed_by: privacyReviewedAt ? auth.session.userId : null,
      needs_review: data.needs_review,
      review_note: data.review_note ?? null,
      updated_by: auth.session.userId,
    };

    if (certificateId) {
      const { error } = await supabase
        .from("certificates")
        .update(row)
        .eq("id", certificateId);
      if (error) return fromPostgresError(error);
    } else {
      const { data: created, error } = await supabase
        .from("certificates")
        .insert({ ...row, created_by: auth.session.userId })
        .select("id")
        .single();
      if (error) return fromPostgresError(error);
      id = created.id;
    }

    if (!id) return fail("server_error");

    // ── Translations ────────────────────────────────────────────────────────
    const translationRows = data.translations.map((translation) => ({
      certificate_id: id,
      locale: translation.locale,
      title: translation.title,
      description: translation.description ?? null,
      image_summary: translation.image_summary ?? null,
      seo_title: translation.seo_title ?? null,
      seo_description: translation.seo_description ?? null,
      translation_state: (translation.description?.trim() && translation.image_summary?.trim()
        ? "complete"
        : "partial") as Database["public"]["Enums"]["translation_state"],
    }));

    const { error: translationError } = await supabase
      .from("certificate_translations")
      .upsert(translationRows, { onConflict: "certificate_id,locale" });

    if (translationError) return fromPostgresError(translationError);

    // ── Skills ──────────────────────────────────────────────────────────────
    await supabase.from("certificate_skills").delete().eq("certificate_id", id);
    if (data.skills.length > 0) {
      // De-duplicate: the table has a unique constraint on (certificate_id,
      // label_en) and a repeated label would otherwise fail the whole save.
      const unique = [...new Set(data.skills.map((skill) => skill.trim()))].filter(Boolean);

      await supabase.from("certificate_skills").insert(
        unique.map((label, index) => ({
          certificate_id: id,
          label_en: label,
          sort_order: index,
        })),
      );
    }

    // ── Related projects ────────────────────────────────────────────────────
    await supabase.from("certificate_project_links").delete().eq("certificate_id", id);
    if (data.relatedProjectIds.length > 0) {
      await supabase.from("certificate_project_links").insert(
        data.relatedProjectIds.map((projectId) => ({
          certificate_id: id,
          project_id: projectId,
        })),
      );
    }

    // ── Audit ───────────────────────────────────────────────────────────────
    const publishedNow = data.status === "published" && previousStatus !== "published";
    const unpublishedNow = previousStatus === "published" && data.status !== "published";
    const reviewedNow = Boolean(privacyReviewedAt) && !previousReviewedAt;

    if (reviewedNow) {
      // Recorded separately: who cleared a credential for publication, and when, is
      // the single most important thing to be able to answer later.
      await writeAuditLog({
        action: "certificate.privacy_reviewed",
        actor: auth.session,
        entityType: "certificate",
        entityId: id,
        entityLabel: data.slug,
        summary: `Privacy review recorded. Contains sensitive data: ${data.contains_sensitive_data ? "yes" : "no"}.`,
        changes: { privacy_review_note: data.privacy_review_note ?? null },
      });
    }

    await writeAuditLog({
      action: publishedNow
        ? "certificate.published"
        : unpublishedNow
          ? "certificate.unpublished"
          : certificateId
            ? "certificate.updated"
            : "certificate.created",
      actor: auth.session,
      entityType: "certificate",
      entityId: id,
      entityLabel: data.slug,
      summary: `${certificateId ? "Updated" : "Created"} credential “${data.slug}” with status ${data.status}.`,
      changes: diffRecords(before, row),
    });

    revalidatePublicContent({ certificateSlug: data.slug });

    return ok({ id, slug: data.slug });
  } catch {
    return fail("server_error");
  }
}

export async function setCertificateStatus(
  certificateId: string,
  status: "draft" | "in_review" | "published" | "archived",
): Promise<ActionResult<{ slug: string }>> {
  const auth = await checkPermission("publishContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("certificates")
      .select("slug, status, privacy_reviewed_at, preview_media_id")
      .eq("id", certificateId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    // Pre-empt the database trigger with a readable explanation. The trigger is
    // still the real gate; this just avoids surfacing a raw check violation.
    if (status === "published") {
      const blockers: string[] = [];
      if (!existing.privacy_reviewed_at) blockers.push("privacyReviewMissing");
      if (!existing.preview_media_id) blockers.push("previewMissing");

      if (blockers.length > 0) {
        return fail("publish_blocked", {
          fields: Object.fromEntries(blockers.map((code) => [code, code])),
        });
      }
    }

    const { error } = await supabase
      .from("certificates")
      .update({ status, updated_by: auth.session.userId })
      .eq("id", certificateId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action:
        status === "published"
          ? "certificate.published"
          : status === "archived"
            ? "certificate.archived"
            : existing.status === "published"
              ? "certificate.unpublished"
              : "certificate.updated",
      actor: auth.session,
      entityType: "certificate",
      entityId: certificateId,
      entityLabel: existing.slug,
      summary: `Status changed from ${existing.status} to ${status}.`,
      changes: { status: { from: existing.status, to: status } },
    });

    revalidatePublicContent({ certificateSlug: existing.slug });
    return ok({ slug: existing.slug });
  } catch {
    return fail("server_error");
  }
}

export async function toggleCertificateFeatured(
  certificateId: string,
  featured: boolean,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("certificates")
      .select("slug")
      .eq("id", certificateId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    const { error } = await supabase
      .from("certificates")
      .update({ featured, updated_by: auth.session.userId })
      .eq("id", certificateId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "certificate.updated",
      actor: auth.session,
      entityType: "certificate",
      entityId: certificateId,
      entityLabel: existing.slug,
      summary: featured ? "Marked as featured." : "Removed from featured.",
    });

    revalidatePublicContent({ certificateSlug: existing.slug });
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function softDeleteCertificate(
  certificateId: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("certificates")
      .select("slug")
      .eq("id", certificateId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    const { error } = await supabase
      .from("certificates")
      .update({
        deleted_at: new Date().toISOString(),
        status: "archived",
        updated_by: auth.session.userId,
      })
      .eq("id", certificateId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "certificate.deleted",
      actor: auth.session,
      entityType: "certificate",
      entityId: certificateId,
      entityLabel: existing.slug,
      summary: "Soft-deleted (recoverable). The private original is retained.",
    });

    revalidatePublicContent({ certificateSlug: existing.slug });
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function restoreCertificate(
  certificateId: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("certificates")
      .select("slug")
      .eq("id", certificateId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    const { error } = await supabase
      .from("certificates")
      .update({ deleted_at: null, status: "draft", updated_by: auth.session.userId })
      .eq("id", certificateId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "certificate.restored",
      actor: auth.session,
      entityType: "certificate",
      entityId: certificateId,
      entityLabel: existing.slug,
      summary: "Restored as a draft.",
    });

    revalidatePublicContent({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

/**
 * Mint a short-lived signed URL for a private certificate original.
 *
 * The only path to a raw scan, and deliberately narrow:
 *
 *  1. Owner role required — `viewPrivateOriginals` is owner-only, so an editor who
 *     can upload an original cannot later read it back.
 *  2. The asset must actually be `visibility = 'private'`, checked rather than
 *     assumed.
 *  3. The URL expires in 60 seconds. Long enough to open, too short to share.
 *  4. Every access is written to the audit log before the URL is returned.
 *
 * The service-role client is required because the `certificate-originals` bucket
 * has no anonymous policy at all, and signing needs privileged access. On
 * Cloudflare R2 the equivalent is a bucket with no public URL at all, signed
 * per-request with SigV4 — see lib/storage/buckets.ts for why that is a separate
 * bucket rather than a prefix.
 */
export async function createOriginalSignedUrl(
  certificateId: string,
): Promise<ActionResult<{ url: string; expiresInSeconds: number; filename: string }>> {
  const auth = await checkPermission("viewPrivateOriginals");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: certificate } = await supabase
      .from("certificates")
      .select(
        `slug, original_media_id,
         original:media_assets!certificates_original_media_id_fkey(
           bucket_id, storage_path, storage_provider, visibility,
           original_filename, mime_type
         )`,
      )
      .eq("id", certificateId)
      .maybeSingle();

    if (!certificate?.original_media_id) return fail("not_found");

    const original = certificate.original as unknown as {
      bucket_id: string;
      storage_path: string;
      storage_provider: StorageProvider;
      visibility: string;
      original_filename: string;
      mime_type: string;
    } | null;

    if (!original) return fail("not_found");

    // Defence in depth: the schema already forbids a public asset here, but a
    // signed URL for a public object would be a silent contradiction.
    if (original.visibility !== "private") {
      return fail("forbidden", {
        detail: "That asset is not stored privately; refusing to sign it.",
      });
    }

    const EXPIRY_SECONDS = 60;
    const admin = createSupabaseAdminClient();

    // Signed against whichever backend actually holds the scan. Both produce a
    // URL that expires on its own; neither leaves a permanently reachable link.
    const signedUrl = await signStorageUrl({
      provider: original.storage_provider,
      bucket: original.bucket_id as StorageBucket,
      storagePath: original.storage_path,
      expiresInSeconds: EXPIRY_SECONDS,
      admin,
    });

    if (!signedUrl) return fail("server_error");

    // Logged before returning, so an access is recorded even if the caller never
    // follows the URL.
    await writeAuditLog({
      action: "certificate.original_viewed",
      actor: auth.session,
      entityType: "certificate",
      entityId: certificateId,
      entityLabel: certificate.slug,
      summary: `Signed a ${EXPIRY_SECONDS}s URL for the private original.`,
      changes: { filename: original.original_filename },
    });

    return ok({
      url: signedUrl,
      expiresInSeconds: EXPIRY_SECONDS,
      filename: original.original_filename,
    });
  } catch {
    return fail("server_error");
  }
}
