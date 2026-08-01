"use server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteStorageObject } from "@/lib/storage";
import type { StorageBucket, StorageProvider } from "@/lib/storage/buckets";
import { checkPermission } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/log";
import {
  fail,
  fromPostgresError,
  ok,
  revalidatePublicContent,
  type ActionResult,
} from "./result";

/**
 * Media Server Actions.
 *
 * Deletion is the interesting one: an asset that is still referenced by content is
 * refused rather than cascaded. Cascading would silently blank a cover image on a
 * published page, and the editor would only discover it by looking at the live site.
 */

const metadataSchema = z.object({
  alt_text_en: z.string().trim().max(500).nullable().optional(),
  alt_text_km: z.string().trim().max(500).nullable().optional(),
  caption_en: z.string().trim().max(500).nullable().optional(),
  caption_km: z.string().trim().max(500).nullable().optional(),
  credit: z.string().trim().max(200).nullable().optional(),
});

export async function updateMediaMetadata(
  mediaId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("uploadMedia");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = metadataSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("media_assets")
      .select("original_filename, alt_text_en, alt_text_km")
      .eq("id", mediaId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    const normalise = (value: string | null | undefined) =>
      value && value.trim() !== "" ? value.trim() : null;

    const { error } = await supabase
      .from("media_assets")
      .update({
        alt_text_en: normalise(parsed.data.alt_text_en),
        alt_text_km: normalise(parsed.data.alt_text_km),
        caption_en: normalise(parsed.data.caption_en),
        caption_km: normalise(parsed.data.caption_km),
        credit: normalise(parsed.data.credit),
      })
      .eq("id", mediaId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "media.replaced",
      actor: auth.session,
      entityType: "media_asset",
      entityId: mediaId,
      entityLabel: existing.original_filename,
      summary: "Updated media metadata (alt text, caption, credit).",
    });

    // Alt text appears on public pages, so the cached HTML is now stale.
    revalidatePublicContent({});

    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

/**
 * Delete an asset and its stored objects.
 *
 * Refuses when the asset is referenced. The reference check runs before anything is
 * removed, so a refusal leaves the system exactly as it was.
 */
export async function deleteMediaAsset(
  mediaId: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("hardDelete");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: asset } = await supabase
      .from("media_assets")
      .select(
        `id, bucket_id, storage_path, storage_provider, thumbnail_path,
         card_path, preview_path, original_filename, visibility, kind,
         project_cover:projects!projects_cover_media_id_fkey(id, slug),
         project_og:projects!projects_og_image_media_id_fkey(id, slug),
         project_media(id),
         certificate_preview:certificates!certificates_preview_media_id_fkey(id, slug),
         certificate_original:certificates!certificates_original_media_id_fkey(id, slug),
         certificate_og:certificates!certificates_og_image_media_id_fkey(id, slug),
         testimonial_avatar:testimonials!testimonials_avatar_media_id_fkey(id, slug),
         resume_versions(id, version_label),
         experience_media(id, deleted_at, experiences(slug)),
         journey_media(id, deleted_at, kind, journey_entries(slug)),
         journey_cover:journey_entries!journey_entries_cover_media_id_fkey(id, slug)`,
      )
      .eq("id", mediaId)
      .maybeSingle();

    if (!asset) return fail("not_found");

    const row = asset as unknown as {
      bucket_id: string;
      storage_path: string;
      storage_provider: StorageProvider;
      thumbnail_path: string | null;
      card_path: string | null;
      preview_path: string | null;
      original_filename: string;
      visibility: string;
      kind: string;
      project_cover: Array<{ slug: string }> | null;
      project_og: Array<{ slug: string }> | null;
      project_media: Array<{ id: string }> | null;
      certificate_preview: Array<{ slug: string }> | null;
      certificate_original: Array<{ slug: string }> | null;
      certificate_og: Array<{ slug: string }> | null;
      testimonial_avatar: Array<{ slug: string }> | null;
      resume_versions: Array<{ version_label: string }> | null;
      experience_media: Array<{
        deleted_at: string | null;
        experiences: { slug: string } | null;
      }> | null;
      journey_media: Array<{
        deleted_at: string | null;
        kind: string;
        journey_entries: { slug: string } | null;
      }> | null;
      journey_cover: Array<{ slug: string }> | null;
    };

    /*
     * Only live attachments block a delete. A detached photograph leaves a
     * soft-deleted row behind as a record of what was once published, and that
     * record must not make the image undeletable forever.
     *
     * The database says the same thing independently: `experience_media.media_id`
     * is ON DELETE RESTRICT, so even a soft-deleted attachment would refuse the
     * delete at the FK level. Which is why the row is hard-deleted below when the
     * asset is genuinely going.
     */
    const liveExperienceAttachments = (row.experience_media ?? []).filter(
      (item) => item.deleted_at === null,
    );

    // Same rule for journey stories. `journey_media.media_id` is likewise ON
    // DELETE RESTRICT, so a live attachment could not be orphaned even if this
    // guard were removed — but the guard is what turns a foreign-key violation
    // into a sentence naming the story to detach it from.
    const liveJourneyAttachments = (row.journey_media ?? []).filter(
      (item) => item.deleted_at === null,
    );

    // Name the actual referencing records: "in use" without saying where is not
    // actionable.
    const references = [
      ...(row.project_cover ?? []).map((item) => `project cover: ${item.slug}`),
      ...(row.project_og ?? []).map((item) => `project social image: ${item.slug}`),
      ...(row.project_media?.length
        ? [`${row.project_media.length} project screenshot(s)`]
        : []),
      ...(row.certificate_preview ?? []).map(
        (item) => `certificate preview: ${item.slug}`,
      ),
      ...(row.certificate_original ?? []).map(
        (item) => `certificate original: ${item.slug}`,
      ),
      ...(row.certificate_og ?? []).map(
        (item) => `certificate social image: ${item.slug}`,
      ),
      ...(row.testimonial_avatar ?? []).map((item) => `reference avatar: ${item.slug}`),
      ...(row.resume_versions ?? []).map((item) => `resume version: ${item.version_label}`),
      ...liveExperienceAttachments.map(
        (item) => `experience photo: ${item.experiences?.slug ?? "unknown entry"}`,
      ),
      ...liveJourneyAttachments.map(
        (item) =>
          `journey ${item.kind === "video" ? "video poster" : "photo"}: ${
            item.journey_entries?.slug ?? "unknown story"
          }`,
      ),
      ...(row.journey_cover ?? []).map((item) => `journey cover: ${item.slug}`),
    ];

    if (references.length > 0) {
      return fail("conflict", {
        detail: `Still in use by — ${references.join("; ")}. Detach it there first.`,
      });
    }

    // Remove the derivatives alongside the main object; leaving them behind would
    // quietly consume storage forever.
    const paths = [
      row.storage_path,
      row.thumbnail_path,
      row.card_path,
      row.preview_path,
    ].filter((path): path is string => Boolean(path));

    const admin = createSupabaseAdminClient();

    // Deleted one object at a time because R2's S3 API has no batch remove that
    // is worth the extra code path here. A failure to delete the bytes must not
    // block deleting the row: an orphaned object costs storage, whereas a row
    // pointing at nothing renders as a broken image.
    for (const path of paths) {
      try {
        await deleteStorageObject({
          provider: row.storage_provider,
          bucket: row.bucket_id as StorageBucket,
          storagePath: path,
          admin,
        });
      } catch {
        // Deliberately ignored — see above.
      }
    }

    /*
     * Purge soft-deleted experience attachments first.
     *
     * `experience_media.media_id` is ON DELETE RESTRICT — deliberately, so that a
     * *live* attachment can never be orphaned by a media delete. The guard above
     * already refused that case, so anything remaining here is a detached row
     * kept only as history, and history must not make an asset permanently
     * undeletable. Without this, the delete below fails with a foreign-key
     * violation the admin has no way to act on.
     */
    await supabase
      .from("experience_media")
      .delete()
      .eq("media_id", mediaId)
      .not("deleted_at", "is", null);

    // And the journey equivalent, for the same reason.
    await supabase
      .from("journey_media")
      .delete()
      .eq("media_id", mediaId)
      .not("deleted_at", "is", null);

    const { error } = await supabase.from("media_assets").delete().eq("id", mediaId);
    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "media.deleted",
      actor: auth.session,
      entityType: "media_asset",
      entityId: mediaId,
      entityLabel: row.original_filename,
      summary: `Deleted ${row.original_filename} (${row.visibility}) and ${paths.length} stored object(s).`,
      changes: { kind: row.kind, bucket: row.bucket_id },
    });

    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

/**
 * Clear the "needs privacy review" flag on a private original.
 *
 * Owner-only: the flag exists to record that a human has looked at a raw scan, and
 * an editor cannot open one in the first place.
 */
export async function markOriginalReviewed(
  mediaId: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("viewPrivateOriginals");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("media_assets")
      .select("original_filename")
      .eq("id", mediaId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    const { error } = await supabase
      .from("media_assets")
      .update({ requires_privacy_review: false })
      .eq("id", mediaId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "certificate.privacy_reviewed",
      actor: auth.session,
      entityType: "media_asset",
      entityId: mediaId,
      entityLabel: existing.original_filename,
      summary: "Marked the private original as reviewed.",
    });

    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}
