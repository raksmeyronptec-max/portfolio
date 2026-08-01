"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/auth/guards";
import { writeAuditLog, type AuditAction } from "@/lib/audit/log";
import {
  fail,
  fromPostgresError,
  ok,
  revalidateJourney,
  type ActionResult,
} from "./result";
import { isPubliclyRendered } from "@/lib/validation/media-privacy";
import {
  collectJourneyErrors,
  journeyMediaSchema,
  parseVideoUrl,
  type ConsentStatus,
  type JourneyMediaKind,
  type MediaVisibility,
  type PrivacyStatus,
} from "@/lib/validation/journey";

/**
 * Journey media attachments — photographs and video references.
 *
 * NOTE — this file is `"use server"`, so every export must be an async function.
 * Constants and types belong in `@/lib/validation/journey`; see
 * tests/unit/use-server-exports.test.ts for what happens otherwise.
 *
 * ── Permission model ───────────────────────────────────────────────────────
 * Attaching, captioning and reordering are `editContent`, like every other
 * content change.
 *
 * Recording a privacy review, asserting consent, and publishing an item are NOT.
 * They need `viewPrivateOriginals`, which is owner-only. The reasoning is the
 * same one that gates certificate originals and experience photographs: an editor
 * can prepare an item and describe it, but the decision to put a picture of
 * somebody's pupils — or a video with somebody's audio in it — on the open web is
 * the site owner's alone, and it must not be delegable by accident.
 *
 * RLS permits an editor to write the row, because the database cannot know which
 * column change is the consequential one. This check is therefore the real
 * boundary, and it runs before every mutation rather than only in the UI.
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

type AttachmentState = {
  id: string;
  journey_entry_id: string;
  media_id: string | null;
  kind: JourneyMediaKind;
  role: string;
  sort_order: number;
  privacy_status: PrivacyStatus;
  consent_status: ConsentStatus;
  visibility: MediaVisibility;
  alt_text_en: string | null;
  reviewed_at: string | null;
  journey_entries: { slug: string; status: string } | null;
};

async function loadAttachment(attachmentId: string): Promise<AttachmentState | null> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("journey_media")
    .select(
      `id, journey_entry_id, media_id, kind, role, sort_order, privacy_status,
       consent_status, visibility, alt_text_en, reviewed_at,
       journey_entries(slug, status)`,
    )
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;
  return data as unknown as AttachmentState;
}

/** Next free position at the end of a story's gallery. */
async function nextSortOrder(journeyEntryId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("journey_media")
    .select("sort_order")
    .eq("journey_entry_id", journeyEntryId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1);

  return (data?.[0]?.sort_order ?? -1) + 1;
}

/**
 * Refuse an asset that could never render publicly.
 *
 * A private file has no public URL, and a PDF cannot go in an `<img>`. Attaching
 * either would create a row that silently resolves to nothing at render time, so
 * both are refused here with a specific message instead.
 */
async function assertUsableAsset(
  mediaId: string,
): Promise<{ ok: true; filename: string } | { ok: false; result: ActionResult<never> }> {
  const supabase = await createSupabaseServerClient();

  const { data: asset } = await supabase
    .from("media_assets")
    .select("id, visibility, mime_type, original_filename")
    .eq("id", mediaId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!asset) return { ok: false, result: fail("not_found") };

  if (asset.visibility !== "public") {
    return {
      ok: false,
      result: fail("validation", { fields: { mediaId: "privateAsset" } }),
    };
  }

  if (asset.mime_type === "application/pdf") {
    return {
      ok: false,
      result: fail("validation", { fields: { mediaId: "notAnImage" } }),
    };
  }

  return { ok: true, filename: asset.original_filename };
}

// ── Attach a photograph ─────────────────────────────────────────────────────

/**
 * Attach an existing media asset to a story as a photograph.
 *
 * Created `private` / `pending_review` / `pending` regardless of what the caller
 * asks for, with captions and privacy decisions made afterwards in the editor.
 * Two reasons, both from the experience-photo design: a photograph is never
 * published by the act of attaching it, and the review therefore always happens
 * against an attachment the reviewer can actually see rendered.
 */
export async function attachJourneyPhoto(
  journeyEntryId: string,
  mediaId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const asset = await assertUsableAsset(mediaId);
    if (!asset.ok) return asset.result;

    const supabase = await createSupabaseServerClient();

    const { data: created, error } = await supabase
      .from("journey_media")
      .insert({
        journey_entry_id: journeyEntryId,
        media_id: mediaId,
        kind: "photo",
        role: "gallery",
        sort_order: await nextSortOrder(journeyEntryId),
        privacy_status: "pending_review",
        consent_status: "pending",
        visibility: "private",
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return fail("conflict", { fields: { mediaId: "alreadyAttached" } });
      }
      return fromPostgresError(error);
    }

    await writeAuditLog({
      action: "journey.media_attached",
      actor: auth.session,
      entityType: "journey_media",
      entityId: created.id,
      entityLabel: asset.filename,
      summary:
        "Attached a photograph to a journey story. Created private and pending " +
        "privacy review.",
      changes: { journey_entry_id: journeyEntryId, media_id: mediaId, kind: "photo" },
    });

    // No public revalidation: a newly attached photo is private, so nothing the
    // public site renders has changed.
    return ok({ id: created.id });
  } catch {
    return fail("server_error");
  }
}

// ── Attach a video ──────────────────────────────────────────────────────────

/**
 * Attach an external video reference.
 *
 * The URL's provider is derived here and stored, so the admin list can show
 * "YouTube" without re-parsing on every render — but the *embed* URL is never
 * stored. It is recomputed from the URL at render time (see
 * `lib/content/journey.ts`), so a row edited directly in Supabase Studio cannot
 * put an arbitrary origin into an iframe `src`.
 *
 * Like a photograph, the attachment starts private and pending review. A video
 * needs more review than a still, not less: it carries audio, and a safe opening
 * frame says nothing about minute four.
 */
export async function attachJourneyVideo(
  journeyEntryId: string,
  videoUrl: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const trimmed = videoUrl.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    return fail("validation", { fields: { videoUrl: "urlMustBeHttps" } });
  }

  try {
    const parsed = parseVideoUrl(trimmed);
    const supabase = await createSupabaseServerClient();

    const { data: created, error } = await supabase
      .from("journey_media")
      .insert({
        journey_entry_id: journeyEntryId,
        kind: "video",
        // No poster yet. The CHECK constraint refuses to make this public until
        // one is chosen, which is what keeps the facade honest.
        media_id: null,
        role: "gallery",
        sort_order: await nextSortOrder(journeyEntryId),
        video_url: trimmed,
        video_provider: parsed.provider,
        privacy_status: "pending_review",
        consent_status: "pending",
        visibility: "private",
      })
      .select("id")
      .single();

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "journey.video_added",
      actor: auth.session,
      entityType: "journey_media",
      entityId: created.id,
      summary:
        "Added a video reference to a journey story. Created private and pending " +
        "privacy review, with no poster yet.",
      // The provider is recorded; the URL is not. A private or unlisted video
      // URL is exactly the kind of thing an audit log should not become a
      // directory of.
      changes: { journey_entry_id: journeyEntryId, video_provider: parsed.provider },
    });

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
 * `fromPostgresError` maps its violation onto `publish_blocked` — which is the
 * behaviour the admin needs when a rule changes underneath a stale form.
 */
export async function updateJourneyMedia(
  attachmentId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = journeyMediaSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectJourneyErrors(parsed.error) });
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
     * Approving a privacy review, asserting consent, or moving an item to
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
            "status, or whether an item is public.",
        });
      }
    }

    // A poster can be added or swapped after the fact; it must still be a public
    // image when it is set.
    if (data.mediaId && data.mediaId !== before.media_id) {
      const asset = await assertUsableAsset(data.mediaId);
      if (!asset.ok) return asset.result;
    }

    const supabase = await createSupabaseServerClient();

    /*
     * `reviewed_at` is stamped server-side from the transition, never taken from
     * the client. A review date the browser could set would be worthless as a
     * record, and the database additionally refuses an approval without one.
     */
    const reviewedAt =
      data.privacyStatus === "approved"
        ? privacyChanged
          ? new Date().toISOString()
          : before.reviewed_at
        : null;

    const provider = data.videoUrl ? parseVideoUrl(data.videoUrl).provider : null;

    const { error } = await supabase
      .from("journey_media")
      .update({
        kind: data.kind,
        role: data.role,
        sort_order: data.sortOrder,
        media_id: data.mediaId ?? null,
        video_url: data.videoUrl ?? null,
        video_provider: provider,
        duration_seconds: data.durationSeconds,
        video_title_en: data.videoTitleEn ?? null,
        video_title_km: data.videoTitleKm ?? null,
        transcript_en: data.transcriptEn ?? null,
        transcript_km: data.transcriptKm ?? null,
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

    /*
     * One audit entry per meaningful decision rather than a single "updated".
     * Each of these is separately answerable a year later, and collapsing them
     * would make the trail useless for exactly the questions it exists for.
     */
    const entries: Array<{ action: AuditAction; summary: string }> = [];

    if (privacyChanged) {
      entries.push({
        action: "journey.media_privacy_changed",
        summary: `Privacy review changed from ${before.privacy_status} to ${data.privacyStatus}.`,
      });
    }

    if (consentChanged) {
      entries.push({
        action: "journey.media_consent_changed",
        summary: `Consent status changed from ${before.consent_status} to ${data.consentStatus}.`,
      });
    }

    if (!wasLive && isLive) {
      entries.push({
        action: "journey.media_published",
        summary: `A ${data.kind} is now rendered on the public journey page.`,
      });
    } else if (wasLive && !isLive) {
      entries.push({
        action: "journey.media_hidden",
        summary: `A ${data.kind} is no longer rendered publicly.`,
      });
    }

    if (entries.length === 0) {
      entries.push({
        action: "journey.media_updated",
        summary: "Updated captions, alt text or metadata.",
      });
    }

    for (const entry of entries) {
      await writeAuditLog({
        ...entry,
        actor: auth.session,
        entityType: "journey_media",
        entityId: attachmentId,
        entityLabel: before.journey_entries?.slug,
        /*
         * Captions and alt text are recorded because they are published prose and
         * a change to them is a change to what the site says. The storage path
         * and the video URL are NOT recorded: those are the two fields that would
         * turn the audit log into a directory of private file locations.
         */
        changes: {
          kind: data.kind,
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
    if (wasLive || isLive) {
      revalidateJourney({ slug: before.journey_entries?.slug });
    }

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
 * cover per story, so doing it the other way round fails on the second statement
 * and leaves the story with no cover at all.
 */
export async function setJourneyCover(
  attachmentId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const target = await loadAttachment(attachmentId);
    if (!target) return fail("not_found");

    const supabase = await createSupabaseServerClient();

    const { error: demoteError } = await supabase
      .from("journey_media")
      .update({ role: "gallery" })
      .eq("journey_entry_id", target.journey_entry_id)
      .eq("role", "cover")
      .is("deleted_at", null);

    if (demoteError) return fromPostgresError(demoteError);

    const { error } = await supabase
      .from("journey_media")
      .update({ role: "cover" })
      .eq("id", attachmentId);

    if (error) return fromPostgresError(error);

    /*
     * The entry's own `cover_media_id` is kept in step.
     *
     * Two fields express "the lead image" because they answer different
     * questions: `journey_media.role` orders the gallery, while
     * `journey_entries.cover_media_id` is what the listing and the OG image read
     * without joining the whole gallery. Letting them drift would mean the
     * timeline card and the detail page leading with different pictures.
     */
    if (target.media_id) {
      await supabase
        .from("journey_entries")
        .update({ cover_media_id: target.media_id })
        .eq("id", target.journey_entry_id);
    }

    await writeAuditLog({
      action: "journey.cover_changed",
      actor: auth.session,
      entityType: "journey_media",
      entityId: attachmentId,
      entityLabel: target.journey_entries?.slug,
      summary: "Changed which image leads this journey story.",
    });

    if (
      isPubliclyRendered({
        visibility: target.visibility,
        privacyStatus: target.privacy_status,
        consentStatus: target.consent_status,
      })
    ) {
      revalidateJourney({ slug: target.journey_entries?.slug });
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
 * caller could pass an attachment belonging to a different story and renumber it.
 * RLS would permit the write — the row is theirs to edit — so this is an
 * application-level integrity check, not a security one.
 */
export async function reorderJourneyMedia(
  journeyEntryId: string,
  orderedIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: owned } = await supabase
      .from("journey_media")
      .select("id")
      .eq("journey_entry_id", journeyEntryId)
      .is("deleted_at", null);

    const ownedIds = new Set((owned ?? []).map((row) => row.id));
    const valid = orderedIds.filter((id) => ownedIds.has(id));

    if (valid.length === 0) return fail("not_found");

    for (const [index, id] of valid.entries()) {
      const { error } = await supabase
        .from("journey_media")
        .update({ sort_order: index })
        .eq("id", id);

      if (error) return fromPostgresError(error);
    }

    const { data: entry } = await supabase
      .from("journey_entries")
      .select("slug")
      .eq("id", journeyEntryId)
      .maybeSingle();

    await writeAuditLog({
      action: "journey.gallery_reordered",
      actor: auth.session,
      entityType: "journey_entry",
      entityId: journeyEntryId,
      entityLabel: entry?.slug,
      summary: `Reordered ${valid.length} items.`,
    });

    revalidateJourney({ slug: entry?.slug });
    return ok({ count: valid.length });
  } catch {
    return fail("server_error");
  }
}

// ── Remove ──────────────────────────────────────────────────────────────────

/**
 * Detach a photograph or video from a story.
 *
 * A soft delete of the ATTACHMENT only. The media asset is untouched and stays in
 * the library for other content to use — this is the distinction the media
 * library's usage panel exists to make visible, and getting it wrong would delete
 * a shared file because someone tidied one story.
 */
export async function removeJourneyMedia(
  attachmentId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const before = await loadAttachment(attachmentId);
    if (!before) return fail("not_found");

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("journey_media")
      .update({ deleted_at: new Date().toISOString(), visibility: "private" })
      .eq("id", attachmentId);

    if (error) return fromPostgresError(error);

    // If this was the entry's cover, clear the denormalised pointer too — a
    // published story whose cover_media_id names a detached image would render a
    // lead photograph the gallery no longer contains.
    if (before.role === "cover") {
      await supabase
        .from("journey_entries")
        .update({ cover_media_id: null })
        .eq("id", before.journey_entry_id);
    }

    await writeAuditLog({
      action: before.kind === "video" ? "journey.video_removed" : "journey.media_removed",
      actor: auth.session,
      entityType: "journey_media",
      entityId: attachmentId,
      entityLabel: before.journey_entries?.slug,
      summary:
        before.kind === "video"
          ? "Removed a video reference from a journey story."
          : "Detached a photograph from a journey story. The image itself remains " +
            "in the media library.",
      changes: { kind: before.kind },
    });

    if (
      isPubliclyRendered({
        visibility: before.visibility,
        privacyStatus: before.privacy_status,
        consentStatus: before.consent_status,
      })
    ) {
      revalidateJourney({ slug: before.journey_entries?.slug });
    }

    return ok({ id: attachmentId });
  } catch {
    return fail("server_error");
  }
}
