"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/auth/guards";
import { writeAuditLog, type AuditAction } from "@/lib/audit/log";
import {
  fail,
  fromPostgresError,
  ok,
  revalidatePublicContent,
  type ActionResult,
} from "./result";
import {
  collectExperienceMediaErrors,
  experienceMediaSchema,
  isPubliclyRendered,
  type ConsentStatus,
  type MediaVisibility,
  type PrivacyStatus,
} from "@/lib/validation/experience-media";

/**
 * Experience photograph attachments.
 *
 * NOTE — this file is `"use server"`, so every export must be an async function.
 * Constants and types belong in `@/lib/validation/experience-media`; see
 * tests/unit/use-server-exports.test.ts for what happens otherwise.
 *
 * ── Permission model ───────────────────────────────────────────────────────
 * Attaching, captioning and reordering are `editContent`, like every other
 * content change.
 *
 * Recording a privacy review and publishing a photograph are NOT. They need
 * `viewPrivateOriginals`, which is owner-only. The reasoning is the same one that
 * gates certificate originals: an editor can prepare a photograph and describe
 * it, but the decision to put a picture of somebody's pupils on the open web is
 * the site owner's alone, and it should not be delegable by accident. RLS permits
 * an editor to write the row — the database cannot know which column change is
 * the consequential one — so this check is the real boundary and is therefore
 * done before every mutation, not just in the UI.
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Load an attachment plus the slug of its parent, for audit labelling and
 * revalidation. Returns null when the row does not exist or is soft-deleted.
 */
async function loadAttachment(attachmentId: string) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("experience_media")
    .select(
      `id, experience_id, media_id, role, sort_order, privacy_status,
       consent_status, visibility, alt_text_en, reviewed_at,
       experiences(slug)`,
    )
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;

  return data as unknown as {
    id: string;
    experience_id: string;
    media_id: string;
    role: string;
    sort_order: number;
    privacy_status: PrivacyStatus;
    consent_status: ConsentStatus;
    visibility: MediaVisibility;
    alt_text_en: string | null;
    reviewed_at: string | null;
    experiences: { slug: string } | null;
  };
}

// ── Attach ──────────────────────────────────────────────────────────────────

/**
 * Attach an existing media asset to an experience.
 *
 * Created as `private` / `pending_review` / `pending` regardless of what the
 * caller wants, and the caption and privacy decisions are made afterwards in the
 * editor. Two reasons: a photograph is never published by the act of attaching
 * it, and the review therefore always happens against an attachment the reviewer
 * can actually see rendered.
 */
export async function attachExperiencePhoto(
  experienceId: string,
  mediaId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    // The asset must be a public image. A private file has no public URL, so
    // attaching one would create a row that can never render; a PDF cannot be
    // displayed in an <img>. Both are refused with a specific message rather
    // than left to fail silently at render time.
    const { data: asset } = await supabase
      .from("media_assets")
      .select("id, visibility, mime_type, original_filename")
      .eq("id", mediaId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!asset) return fail("not_found");

    if (asset.visibility !== "public") {
      return fail("validation", { fields: { mediaId: "privateAsset" } });
    }

    if (asset.mime_type === "application/pdf") {
      return fail("validation", { fields: { mediaId: "notAnImage" } });
    }

    // Append to the end of the gallery.
    const { data: existing } = await supabase
      .from("experience_media")
      .select("sort_order")
      .eq("experience_id", experienceId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

    const { data: created, error } = await supabase
      .from("experience_media")
      .insert({
        experience_id: experienceId,
        media_id: mediaId,
        role: "gallery",
        sort_order: nextSortOrder,
        privacy_status: "pending_review",
        consent_status: "pending",
        visibility: "private",
      })
      .select("id")
      .single();

    if (error) {
      // 23505 on the partial unique index means it is already attached, which is
      // a duplicate rather than a generic conflict.
      if (error.code === "23505") {
        return fail("conflict", { fields: { mediaId: "alreadyAttached" } });
      }
      return fromPostgresError(error);
    }

    await writeAuditLog({
      action: "experience.photo_attached",
      actor: auth.session,
      entityType: "experience_media",
      entityId: created.id,
      entityLabel: asset.original_filename,
      summary:
        "Attached a photograph to an experience entry. Created private and " +
        "pending privacy review.",
      changes: { experience_id: experienceId, media_id: mediaId },
    });

    // No public revalidation: a newly attached photo is private, so nothing the
    // public site renders has changed.
    return ok({ id: created.id });
  } catch {
    return fail("server_error");
  }
}

// ── Update ──────────────────────────────────────────────────────────────────

/**
 * Update an attachment's captions, alt text, metadata and privacy state.
 *
 * The privacy and consent fields are validated here and re-checked by the
 * database CHECK constraint. If the two ever disagree the constraint wins, and
 * `fromPostgresError` maps its violation onto `publish_blocked` with the
 * migration-authored message — which is the behaviour the admin needs when a
 * rule changes underneath a stale form.
 */
export async function updateExperiencePhoto(
  attachmentId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = experienceMediaSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectExperienceMediaErrors(parsed.error) });
  }

  const data = parsed.data;

  try {
    const before = await loadAttachment(attachmentId);
    if (!before) return fail("not_found");

    const privacyChanged = before.privacy_status !== data.privacyStatus;
    const consentChanged = before.consent_status !== data.consentStatus;
    const visibilityChanged = before.visibility !== data.visibility;

    /*
     * Owner-only decisions.
     *
     * Approving a privacy review, asserting consent, or moving a photograph to
     * `public` are all irreversible in the way that matters: once a picture of a
     * classroom has been served publicly it may have been copied. An editor can
     * do everything else.
     */
    if (privacyChanged || consentChanged || visibilityChanged) {
      const elevated = await checkPermission("viewPrivateOriginals");
      if (!elevated.ok) {
        return fail("forbidden", {
          detail:
            "Only the site owner can change the privacy review, the consent " +
            "status, or whether a photograph is public.",
        });
      }
    }

    const supabase = await createSupabaseServerClient();

    /*
     * `reviewed_at` is stamped server-side from the transition, never taken from
     * the client. A review date the browser could set would be worthless as a
     * record, and the database additionally refuses an approval without one.
     */
    const reviewedAt =
      data.privacyStatus === "approved"
        ? (privacyChanged ? new Date().toISOString() : before.reviewed_at)
        : null;

    const { error } = await supabase
      .from("experience_media")
      .update({
        role: data.role,
        sort_order: data.sortOrder,
        caption_en: data.captionEn ?? null,
        caption_km: data.captionKm ?? null,
        alt_text_en: data.altTextEn ?? null,
        alt_text_km: data.altTextKm ?? null,
        photo_date: data.photoDate ?? null,
        location_en: data.locationEn ?? null,
        location_km: data.locationKm ?? null,
        credit: data.credit ?? null,
        privacy_status: data.privacyStatus,
        consent_status: data.consentStatus,
        visibility: data.visibility,
        focal_x: data.focalX,
        focal_y: data.focalY,
        review_note: data.reviewNote ?? null,
        reviewed_by: data.privacyStatus === "approved" ? auth.session.userId : null,
        reviewed_at: reviewedAt,
      })
      .eq("id", attachmentId);

    if (error) return fromPostgresError(error);

    /*
     * One audit entry per meaningful decision rather than a single "updated".
     * Each of these is separately answerable a year later, and collapsing them
     * would make the trail useless for exactly the questions it exists for.
     */
    const wasLive = isPubliclyRendered({
      visibility: before.visibility,
      privacyStatus: before.privacy_status,
      consentStatus: before.consent_status,
    });
    const isLive = isPubliclyRendered({
      visibility: data.visibility,
      privacyStatus: data.privacyStatus,
      consentStatus: data.consentStatus,
    });

    const entries: Array<{ action: AuditAction; summary: string }> = [];

    if (privacyChanged) {
      entries.push({
        action: "experience.photo_privacy_changed",
        summary: `Privacy review changed from ${before.privacy_status} to ${data.privacyStatus}.`,
      });
    }

    if (consentChanged) {
      entries.push({
        action: "experience.photo_consent_changed",
        summary: `Consent status changed from ${before.consent_status} to ${data.consentStatus}.`,
      });
    }

    if (!wasLive && isLive) {
      entries.push({
        action: "experience.photo_published",
        summary: "Photograph is now rendered on the public Experience page.",
      });
    } else if (wasLive && !isLive) {
      entries.push({
        action: "experience.photo_hidden",
        summary: "Photograph is no longer rendered publicly.",
      });
    }

    if (entries.length === 0) {
      entries.push({
        action: "experience.photo_updated",
        summary: "Updated a photograph's captions, alt text or metadata.",
      });
    }

    for (const entry of entries) {
      await writeAuditLog({
        ...entry,
        actor: auth.session,
        entityType: "experience_media",
        entityId: attachmentId,
        entityLabel: before.experiences?.slug,
        /*
         * Captions and alt text are recorded because they are published prose and
         * a change to them is a change to what the site says. The storage path is
         * NOT recorded: it is the one field that would turn the audit log into a
         * directory of private file locations.
         */
        changes: {
          caption_en: data.captionEn,
          caption_km: data.captionKm,
          alt_text_en: data.altTextEn,
          alt_text_km: data.altTextKm,
          visibility: data.visibility,
          privacy_status: data.privacyStatus,
          consent_status: data.consentStatus,
        },
      });
    }

    // Only revalidate when what the public sees actually changed.
    if (wasLive || isLive) revalidatePublicContent({});

    return ok({ id: attachmentId });
  } catch {
    return fail("server_error");
  }
}

// ── Cover ───────────────────────────────────────────────────────────────────

/**
 * Promote one attachment to cover, demoting whichever held the role.
 *
 * Demote-then-promote in that order: a partial unique index permits only one
 * cover per experience, so doing it the other way round fails on the second
 * statement and leaves the entry with no cover at all.
 */
export async function setExperienceCover(
  attachmentId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const target = await loadAttachment(attachmentId);
    if (!target) return fail("not_found");

    const supabase = await createSupabaseServerClient();

    const { error: demoteError } = await supabase
      .from("experience_media")
      .update({ role: "gallery" })
      .eq("experience_id", target.experience_id)
      .eq("role", "cover")
      .is("deleted_at", null);

    if (demoteError) return fromPostgresError(demoteError);

    const { error } = await supabase
      .from("experience_media")
      .update({ role: "cover" })
      .eq("id", attachmentId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "experience.cover_changed",
      actor: auth.session,
      entityType: "experience_media",
      entityId: attachmentId,
      entityLabel: target.experiences?.slug,
      summary: "Changed which photograph leads this experience entry.",
    });

    if (
      isPubliclyRendered({
        visibility: target.visibility,
        privacyStatus: target.privacy_status,
        consentStatus: target.consent_status,
      })
    ) {
      revalidatePublicContent({});
    }

    return ok({ id: attachmentId });
  } catch {
    return fail("server_error");
  }
}

// ── Reorder ─────────────────────────────────────────────────────────────────

/**
 * Persist a new gallery order.
 *
 * Ids are re-checked against the parent rather than trusted: without that, a
 * caller could pass an attachment belonging to a different experience and
 * renumber it. RLS would permit the write — the row is theirs to edit — so this
 * is an application-level integrity check, not a security one.
 */
export async function reorderExperienceGallery(
  experienceId: string,
  orderedIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: owned } = await supabase
      .from("experience_media")
      .select("id")
      .eq("experience_id", experienceId)
      .is("deleted_at", null);

    const ownedIds = new Set((owned ?? []).map((row) => row.id));
    const valid = orderedIds.filter((id) => ownedIds.has(id));

    if (valid.length === 0) return fail("not_found");

    for (const [index, id] of valid.entries()) {
      const { error } = await supabase
        .from("experience_media")
        .update({ sort_order: index })
        .eq("id", id);

      if (error) return fromPostgresError(error);
    }

    await writeAuditLog({
      action: "experience.gallery_reordered",
      actor: auth.session,
      entityType: "experience",
      entityId: experienceId,
      summary: `Reordered ${valid.length} photographs.`,
    });

    revalidatePublicContent({});
    return ok({ count: valid.length });
  } catch {
    return fail("server_error");
  }
}

// ── Remove ──────────────────────────────────────────────────────────────────

/**
 * Detach a photograph from an experience.
 *
 * A soft delete of the ATTACHMENT only. The media asset is untouched and stays in
 * the library for other content to use — this is the distinction the media
 * library's usage panel exists to make visible, and getting it wrong would delete
 * a shared file because someone tidied one timeline entry.
 */
export async function removeExperiencePhoto(
  attachmentId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const before = await loadAttachment(attachmentId);
    if (!before) return fail("not_found");

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("experience_media")
      .update({ deleted_at: new Date().toISOString(), visibility: "private" })
      .eq("id", attachmentId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "experience.photo_removed",
      actor: auth.session,
      entityType: "experience_media",
      entityId: attachmentId,
      entityLabel: before.experiences?.slug,
      summary:
        "Detached a photograph from an experience entry. The image itself " +
        "remains in the media library.",
      changes: { media_id: before.media_id },
    });

    if (
      isPubliclyRendered({
        visibility: before.visibility,
        privacyStatus: before.privacy_status,
        consentStatus: before.consent_status,
      })
    ) {
      revalidatePublicContent({});
    }

    return ok({ id: attachmentId });
  } catch {
    return fail("server_error");
  }
}
