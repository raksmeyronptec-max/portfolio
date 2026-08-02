"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/log";
import { fail, fromPostgresError, ok, revalidatePublications, type ActionResult } from "./result";
import {
  collectPublicationErrors,
  publicationChapterOrderSchema,
  publicationChapterSchema,
  publicationMediaOrderSchema,
  publicationMediaSchema,
  publicationTopicLinksSchema,
  publicationTopicSchema,
  publicationTypeSchema,
} from "@/lib/validation/publication";

/**
 * Attachments, chapters, topics and types for publications.
 *
 * NOTE — this file is `"use server"`, so every export must be an async function.
 * Constants, schemas and types belong in `@/lib/validation/publication`.
 *
 * Split from `./publications.ts` the same way `journey-media.ts` is split from
 * `journey.ts`: the entity's own lifecycle is one concern, and the things hung
 * off it are another. Nothing here can change a publication's status.
 */

// ── Cover and sample pages ──────────────────────────────────────────────────

/**
 * Attach an image to a publication as its cover, a sample page or a gallery
 * image.
 *
 * Refuses a non-image and refuses a private asset, both before the insert. The
 * database would catch neither: `publication_media` has no MIME constraint,
 * because the sensible place to know "this is a PDF" is where the asset row is
 * already loaded. A private asset resolves to `null` in `resolveImage()`, so
 * attaching one produces a page with an invisible gap and nothing in any log —
 * hence the explicit check and the explicit message.
 */
export async function attachPublicationMedia(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationMediaSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: asset } = await supabase
      .from("media_assets")
      .select("id, mime_type, visibility")
      .eq("id", data.mediaAssetId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!asset) return fail("not_found", { fields: { mediaAssetId: "notFound" } });

    if (asset.mime_type === "application/pdf" || asset.mime_type === "application/zip") {
      return fail("validation", { fields: { mediaAssetId: "notAnImage" } });
    }

    if (asset.visibility !== "public") {
      return fail("validation", { fields: { mediaAssetId: "privateAsset" } });
    }

    const { data: created, error } = await supabase
      .from("publication_media")
      .insert({
        publication_id: data.publicationId,
        media_asset_id: data.mediaAssetId,
        role: data.role,
        sort_order: data.sortOrder,
        page_number: data.pageNumber,
        caption_en: data.captionEn ?? null,
        caption_km: data.captionKm ?? null,
        alt_text_en: data.altTextEn ?? null,
        alt_text_km: data.altTextKm ?? null,
        visibility: data.visibility,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        // Either the (publication, asset, role) uniqueness or the single-cover
        // index. The role tells us which, and the two need different fixes.
        return fail("conflict", {
          fields: {
            mediaAssetId: data.role === "cover" ? "coverExists" : "alreadyAttached",
          },
        });
      }
      return fromPostgresError(error);
    }

    /*
     * A cover lives in two places, and both have to move together.
     *
     * `publication_media` carries the attachment — the caption and alt-text
     * overrides — while `publications.cover_media_id` is what the public reader
     * selects and what the publish trigger checks for public visibility. Setting
     * only the attachment would produce a cover the admin can see and the site
     * cannot, which is exactly the kind of "it says it worked" failure this
     * feature has to avoid.
     *
     * Done here rather than in the component so it holds for every caller.
     */
    if (data.role === "cover") {
      const { error: coverError } = await supabase
        .from("publications")
        .update({ cover_media_id: data.mediaAssetId, updated_by: auth.session.userId })
        .eq("id", data.publicationId)
        .is("deleted_at", null);

      if (coverError) return fromPostgresError(coverError);
    }

    await writeAuditLog({
      action:
        data.role === "cover"
          ? "publication.cover_changed"
          : "publication.sample_pages_changed",
      actor: auth.session,
      entityType: "publication",
      entityId: data.publicationId,
      summary:
        data.role === "cover"
          ? "Set the cover image."
          : `Attached a ${data.role === "sample_page" ? "sample page" : "gallery image"}.`,
      changes: { role: data.role, page_number: data.pageNumber },
    });

    revalidatePublications({});
    return ok({ id: created.id });
  } catch {
    return fail("server_error");
  }
}

export async function updatePublicationMedia(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationMediaSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("publication_media")
      .update({
        role: data.role,
        sort_order: data.sortOrder,
        page_number: data.pageNumber,
        caption_en: data.captionEn ?? null,
        caption_km: data.captionKm ?? null,
        alt_text_en: data.altTextEn ?? null,
        alt_text_km: data.altTextKm ?? null,
        visibility: data.visibility,
      })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.sample_pages_changed",
      actor: auth.session,
      entityType: "publication",
      entityId: data.publicationId,
      summary: "Updated an attached image.",
      changes: { role: data.role, visibility: data.visibility },
    });

    revalidatePublications({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

/**
 * Detach an image.
 *
 * A soft delete, matching `journey_media` and `experience_media`: the attachment
 * carries a caption and alt text somebody wrote, and a mis-click should not
 * destroy them. The asset itself is untouched — it is a library row shared with
 * whatever else uses it.
 */
export async function detachPublicationMedia(id: string): Promise<ActionResult<void>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: attachment } = await supabase
      .from("publication_media")
      .select("id, publication_id, role")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!attachment) return fail("not_found");

    const { error } = await supabase
      .from("publication_media")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return fromPostgresError(error);

    // The other half of the pair — see `attachPublicationMedia`. Leaving
    // `cover_media_id` set would keep the cover on the public page after the
    // admin had removed it, which is the more dangerous direction of the two.
    if (attachment.role === "cover") {
      const { error: coverError } = await supabase
        .from("publications")
        .update({ cover_media_id: null, updated_by: auth.session.userId })
        .eq("id", attachment.publication_id);

      if (coverError) return fromPostgresError(coverError);
    }

    await writeAuditLog({
      action:
        attachment.role === "cover"
          ? "publication.cover_changed"
          : "publication.sample_pages_changed",
      actor: auth.session,
      entityType: "publication",
      entityId: attachment.publication_id,
      summary: `Detached a ${attachment.role} image.`,
      changes: { role: attachment.role },
    });

    revalidatePublications({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function reorderPublicationMedia(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationMediaOrderSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const { publicationId, orderedIds } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    for (const [index, id] of orderedIds.entries()) {
      const { error } = await supabase
        .from("publication_media")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("publication_id", publicationId);

      if (error) return fromPostgresError(error);
    }

    await writeAuditLog({
      action: "publication.sample_pages_changed",
      actor: auth.session,
      entityType: "publication",
      entityId: publicationId,
      summary: `Reordered ${orderedIds.length} images.`,
      changes: { count: orderedIds.length },
    });

    revalidatePublications({});
    return ok({ count: orderedIds.length });
  } catch {
    return fail("server_error");
  }
}

// ── Chapters ────────────────────────────────────────────────────────────────

export async function createPublicationChapter(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationChapterSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: created, error } = await supabase
      .from("publication_chapters")
      .insert({
        publication_id: data.publicationId,
        chapter_number: data.chapterNumber ?? null,
        title_en: data.titleEn ?? null,
        title_km: data.titleKm ?? null,
        description_en: data.descriptionEn ?? null,
        description_km: data.descriptionKm ?? null,
        start_page: data.startPage,
        end_page: data.endPage,
        sort_order: data.sortOrder,
      })
      .select("id")
      .single();

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.chapters_changed",
      actor: auth.session,
      entityType: "publication",
      entityId: data.publicationId,
      summary: `Added the chapter "${data.titleEn ?? data.titleKm ?? ""}".`,
      changes: {},
    });

    revalidatePublications({});
    return ok({ id: created.id });
  } catch {
    return fail("server_error");
  }
}

export async function updatePublicationChapter(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationChapterSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("publication_chapters")
      .update({
        chapter_number: data.chapterNumber ?? null,
        title_en: data.titleEn ?? null,
        title_km: data.titleKm ?? null,
        description_en: data.descriptionEn ?? null,
        description_km: data.descriptionKm ?? null,
        start_page: data.startPage,
        end_page: data.endPage,
        sort_order: data.sortOrder,
      })
      .eq("id", id);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.chapters_changed",
      actor: auth.session,
      entityType: "publication",
      entityId: data.publicationId,
      summary: "Updated a chapter.",
      changes: {},
    });

    revalidatePublications({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function deletePublicationChapter(id: string): Promise<ActionResult<void>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: chapter } = await supabase
      .from("publication_chapters")
      .select("id, publication_id")
      .eq("id", id)
      .maybeSingle();

    if (!chapter) return fail("not_found");

    const { error } = await supabase.from("publication_chapters").delete().eq("id", id);
    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.chapters_changed",
      actor: auth.session,
      entityType: "publication",
      entityId: chapter.publication_id,
      summary: "Deleted a chapter.",
      changes: {},
    });

    revalidatePublications({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function reorderPublicationChapters(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationChapterOrderSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const { publicationId, orderedIds } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    for (const [index, id] of orderedIds.entries()) {
      const { error } = await supabase
        .from("publication_chapters")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("publication_id", publicationId);

      if (error) return fromPostgresError(error);
    }

    await writeAuditLog({
      action: "publication.chapters_changed",
      actor: auth.session,
      entityType: "publication",
      entityId: publicationId,
      summary: `Reordered ${orderedIds.length} chapters.`,
      changes: { count: orderedIds.length },
    });

    revalidatePublications({});
    return ok({ count: orderedIds.length });
  } catch {
    return fail("server_error");
  }
}

// ── Topics ──────────────────────────────────────────────────────────────────

/**
 * Replace a publication's topic links wholesale.
 *
 * Delete-then-insert is safe here in a way it is not for translations: a topic
 * link carries no authored content, so a failed re-insert loses a checkbox
 * rather than a paragraph, and the alternative — diffing two id sets — is more
 * code for a worse failure mode.
 */
export async function setPublicationTopics(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationTopicLinksSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const { publicationId, topicIds } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { error: deleteError } = await supabase
      .from("publication_topic_links")
      .delete()
      .eq("publication_id", publicationId);

    if (deleteError) return fromPostgresError(deleteError);

    if (topicIds.length > 0) {
      const { error } = await supabase.from("publication_topic_links").insert(
        topicIds.map((topicId, index) => ({
          publication_id: publicationId,
          topic_id: topicId,
          sort_order: index,
        })),
      );

      if (error) return fromPostgresError(error);
    }

    await writeAuditLog({
      action: "publication.topics_changed",
      actor: auth.session,
      entityType: "publication",
      entityId: publicationId,
      summary: `Set ${topicIds.length} topics.`,
      changes: { count: topicIds.length },
    });

    revalidatePublications({});
    return ok({ count: topicIds.length });
  } catch {
    return fail("server_error");
  }
}

export async function createPublicationTopic(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationTopicSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: created, error } = await supabase
      .from("publication_topics")
      .insert({
        slug: data.slug,
        name_en: data.nameEn,
        name_km: data.nameKm ?? null,
        sort_order: data.sortOrder,
      })
      .select("id")
      .single();

    if (error) return fromPostgresError(error);

    revalidatePublications({});
    return ok({ id: created.id });
  } catch {
    return fail("server_error");
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

export async function createPublicationType(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationTypeSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: created, error } = await supabase
      .from("publication_types")
      .insert({
        slug: data.slug,
        name_en: data.nameEn,
        name_km: data.nameKm ?? null,
        description_en: data.descriptionEn ?? null,
        description_km: data.descriptionKm ?? null,
        icon: data.icon ?? null,
        sort_order: data.sortOrder,
      })
      .select("id")
      .single();

    if (error) return fromPostgresError(error);

    revalidatePublications({});
    return ok({ id: created.id });
  } catch {
    return fail("server_error");
  }
}

export async function updatePublicationType(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationTypeSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("publication_types")
      .update({
        slug: data.slug,
        name_en: data.nameEn,
        name_km: data.nameKm ?? null,
        description_en: data.descriptionEn ?? null,
        description_km: data.descriptionKm ?? null,
        icon: data.icon ?? null,
        sort_order: data.sortOrder,
      })
      .eq("id", id);

    if (error) return fromPostgresError(error);

    revalidatePublications({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}
