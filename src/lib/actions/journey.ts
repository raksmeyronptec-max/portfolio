"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/auth/guards";
import { isLocale, type Locale } from "@/i18n/config";
import { writeAuditLog, type AuditAction } from "@/lib/audit/log";
import {
  fail,
  fromPostgresError,
  ok,
  revalidateJourney,
  type ActionResult,
} from "./result";
import {
  collectJourneyErrors,
  journeyEntrySchema,
  journeyRelationSchema,
  type JourneyRelationType,
  type PublicationStatus,
} from "@/lib/validation/journey";

/**
 * Journey story CRUD and relations.
 *
 * NOTE — this file is `"use server"`, so every export must be an async function.
 * Constants, schemas and types belong in `@/lib/validation/journey`; see
 * tests/unit/use-server-exports.test.ts for what happens otherwise.
 *
 * ── Permission model ───────────────────────────────────────────────────────
 * Writing a story is `editContent`, like every other content change. Publishing
 * is `publishContent`. Soft-delete and restore are `deleteContent` (owner-only),
 * matching projects and certificates.
 *
 * The privacy decisions that gate whether a *photograph* becomes public are in
 * `./journey-media.ts` and are owner-only there, for reasons set out in that
 * file. Publishing the story itself is a lower bar deliberately: a story with no
 * approved media publishes as prose, which is harmless, and the media stays dark
 * until someone with the owner role says otherwise.
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

async function loadEntry(id: string) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("journey_entries")
    .select("id, slug, status, featured, needs_review")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  return data as {
    id: string;
    slug: string;
    status: PublicationStatus;
    featured: boolean;
    needs_review: boolean;
  } | null;
}

/**
 * Write the translation rows for one entry.
 *
 * Upsert on the (entry, locale) unique constraint rather than delete-then-insert.
 * Delete-then-insert would briefly leave a published story with no translation
 * at all — and if the insert then failed, permanently.
 */
async function writeTranslations(
  entryId: string,
  translations: Array<{
    locale: Locale;
    title: string;
    eyebrow?: string | null;
    summary?: string | null;
    story?: string | null;
    highlights?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
  }>,
): Promise<{ code?: string; message?: string } | null> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("journey_entry_translations").upsert(
    translations.map((t) => ({
      journey_entry_id: entryId,
      locale: t.locale,
      title: t.title,
      eyebrow: t.eyebrow ?? null,
      summary: t.summary ?? null,
      story: t.story ?? null,
      highlights: t.highlights ?? null,
      seo_title: t.seoTitle ?? null,
      seo_description: t.seoDescription ?? null,
      // `complete` only when the whole prose body exists; the admin's badge reads
      // this rather than recomputing it from column emptiness in three places.
      translation_state: t.story?.trim() && t.summary?.trim() ? "complete" : "partial",
    })),
    { onConflict: "journey_entry_id,locale" },
  );

  return error;
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createJourneyEntry(
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = journeyEntrySchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectJourneyErrors(parsed.error) });
  }

  const data = parsed.data;

  // Publishing is a separate permission from editing.
  if (data.status === "published") {
    const publisher = await checkPermission("publishContent");
    if (!publisher.ok) return fail("forbidden");
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data: created, error } = await supabase
      .from("journey_entries")
      .insert({
        slug: data.slug,
        status: data.status,
        category_id: data.categoryId ?? null,
        featured: data.featured,
        sort_order: data.sortOrder,
        event_date: data.eventDate ?? null,
        date_precision: data.datePrecision,
        period_start: data.periodStart ?? null,
        period_end: data.periodEnd ?? null,
        period_label_en: data.periodLabelEn ?? null,
        period_label_km: data.periodLabelKm ?? null,
        location_en: data.locationEn ?? null,
        location_km: data.locationKm ?? null,
        organisation_en: data.organisationEn ?? null,
        organisation_km: data.organisationKm ?? null,
        external_url: data.externalUrl ?? null,
        cover_media_id: data.coverMediaId ?? null,
        needs_review: data.needsReview,
        review_note: data.reviewNote ?? null,
        created_by: auth.session.userId,
        updated_by: auth.session.userId,
      })
      .select("id, slug")
      .single();

    if (error) return fromPostgresError(error);

    const translationError = await writeTranslations(created.id, data.translations);
    if (translationError) return fromPostgresError(translationError);

    await writeAuditLog({
      action: "journey.created",
      actor: auth.session,
      entityType: "journey_entry",
      entityId: created.id,
      entityLabel: created.slug,
      summary: `Created the journey story "${data.translations[0]?.title ?? created.slug}".`,
      changes: { slug: data.slug, status: data.status },
    });

    if (data.status === "published") revalidateJourney({ slug: created.slug });

    return ok({ id: created.id, slug: created.slug });
  } catch {
    return fail("server_error");
  }
}

// ── Update ──────────────────────────────────────────────────────────────────

export async function updateJourneyEntry(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = journeyEntrySchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectJourneyErrors(parsed.error) });
  }

  const data = parsed.data;

  try {
    const before = await loadEntry(id);
    if (!before) return fail("not_found");

    const statusChanged = before.status !== data.status;

    if (statusChanged && data.status === "published") {
      const publisher = await checkPermission("publishContent");
      if (!publisher.ok) return fail("forbidden");
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("journey_entries")
      .update({
        slug: data.slug,
        status: data.status,
        category_id: data.categoryId ?? null,
        featured: data.featured,
        sort_order: data.sortOrder,
        event_date: data.eventDate ?? null,
        date_precision: data.datePrecision,
        period_start: data.periodStart ?? null,
        period_end: data.periodEnd ?? null,
        period_label_en: data.periodLabelEn ?? null,
        period_label_km: data.periodLabelKm ?? null,
        location_en: data.locationEn ?? null,
        location_km: data.locationKm ?? null,
        organisation_en: data.organisationEn ?? null,
        organisation_km: data.organisationKm ?? null,
        external_url: data.externalUrl ?? null,
        cover_media_id: data.coverMediaId ?? null,
        needs_review: data.needsReview,
        review_note: data.reviewNote ?? null,
        updated_by: auth.session.userId,
      })
      .eq("id", id);

    if (error) return fromPostgresError(error);

    const translationError = await writeTranslations(id, data.translations);
    if (translationError) return fromPostgresError(translationError);

    /*
     * One audit entry per meaningful decision rather than a single "updated".
     * A publish and a featured-flag change are separately answerable later, and
     * collapsing them into `journey.updated` would make the trail useless for
     * exactly the questions it exists for.
     */
    const entries: Array<{ action: AuditAction; summary: string }> = [];

    if (statusChanged) {
      if (data.status === "published") {
        entries.push({
          action: "journey.published",
          summary: "The story is now visible on the public site.",
        });
      } else if (before.status === "published") {
        entries.push({
          action: data.status === "archived" ? "journey.archived" : "journey.unpublished",
          summary: `The story left published state and is now ${data.status}.`,
        });
      }
    }

    if (before.featured !== data.featured) {
      entries.push({
        action: "journey.featured_changed",
        summary: data.featured
          ? "Added to the homepage's selected moments."
          : "Removed from the homepage's selected moments.",
      });
    }

    if (entries.length === 0) {
      entries.push({
        action: "journey.updated",
        summary: "Updated the story's content or metadata.",
      });
    }

    for (const entry of entries) {
      await writeAuditLog({
        ...entry,
        actor: auth.session,
        entityType: "journey_entry",
        entityId: id,
        entityLabel: data.slug,
        changes: {
          slug: data.slug,
          status: data.status,
          featured: data.featured,
          needs_review: data.needsReview,
        },
      });
    }

    // Revalidate when the story is public now, or was before this edit —
    // unpublishing has to clear the cached page too.
    if (data.status === "published" || before.status === "published") {
      revalidateJourney({ slug: data.slug, previousSlug: before.slug });
    }

    return ok({ id, slug: data.slug });
  } catch {
    return fail("server_error");
  }
}

// ── Status transitions ──────────────────────────────────────────────────────

/**
 * Publish / unpublish / archive / restore, without going through the full form.
 *
 * A separate action rather than a `updateJourneyEntry` call with one field
 * changed: the list page's row actions have no form state to submit, and routing
 * them through the full schema would demand translations they never loaded.
 */
export async function setJourneyStatus(
  id: string,
  status: PublicationStatus,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission(
    status === "published" ? "publishContent" : "editContent",
  );
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const before = await loadEntry(id);
    if (!before) return fail("not_found");

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("journey_entries")
      .update({ status, updated_by: auth.session.userId })
      .eq("id", id);

    // The publish gate in migration 0024 raises check_violation with a message we
    // authored, which `fromPostgresError` turns into `publish_blocked` carrying
    // that text — this is how "clear needs-review first" reaches the admin.
    if (error) return fromPostgresError(error);

    const action: AuditAction =
      status === "published"
        ? "journey.published"
        : status === "archived"
          ? "journey.archived"
          : before.status === "published"
            ? "journey.unpublished"
            : "journey.updated";

    await writeAuditLog({
      action,
      actor: auth.session,
      entityType: "journey_entry",
      entityId: id,
      entityLabel: before.slug,
      summary: `Status changed from ${before.status} to ${status}.`,
      changes: { status },
    });

    revalidateJourney({ slug: before.slug });
    return ok({ id });
  } catch {
    return fail("server_error");
  }
}

/** Toggle a story's place in the homepage's selected moments. */
export async function setJourneyFeatured(
  id: string,
  featured: boolean,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const before = await loadEntry(id);
    if (!before) return fail("not_found");

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("journey_entries")
      .update({ featured, updated_by: auth.session.userId })
      .eq("id", id);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "journey.featured_changed",
      actor: auth.session,
      entityType: "journey_entry",
      entityId: id,
      entityLabel: before.slug,
      summary: featured
        ? "Added to the homepage's selected moments."
        : "Removed from the homepage's selected moments.",
      changes: { featured },
    });

    if (before.status === "published") revalidateJourney({ slug: before.slug });
    return ok({ id });
  } catch {
    return fail("server_error");
  }
}

// ── Duplicate ───────────────────────────────────────────────────────────────

/**
 * Copy a story as a new draft.
 *
 * Copies the entry and its translations. Deliberately does NOT copy the media
 * attachments or the relations:
 *
 *  · every attachment carries a privacy review naming a reviewer and a date, and
 *    copying that would fabricate a review of a story nobody has looked at;
 *  · the copy exists because the owner is writing a *different* story, and
 *    inheriting the original's links would silently mis-attribute it.
 *
 * The new draft therefore starts with prose and no media, which is the state the
 * owner would have to reach anyway.
 */
export async function duplicateJourneyEntry(
  id: string,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: source } = await supabase
      .from("journey_entries")
      .select("*, journey_entry_translations(*)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!source) return fail("not_found");

    /*
     * Typed narrowly here rather than relying on the generated row type. The
     * duplicate reads `*`, and every column it copies is one this function
     * decides to copy — spelling them out is what makes "the cover and the
     * attachments are deliberately not copied" checkable at a glance.
     */
    const original = source as unknown as {
      slug: string;
      category_id: string | null;
      sort_order: number;
      event_date: string | null;
      date_precision: string;
      period_start: string | null;
      period_end: string | null;
      period_label_en: string | null;
      period_label_km: string | null;
      location_en: string | null;
      location_km: string | null;
      organisation_en: string | null;
      organisation_km: string | null;
      external_url: string | null;
      journey_entry_translations: Array<{
        locale: string;
        title: string;
        eyebrow: string | null;
        summary: string | null;
        story: string | null;
        highlights: string | null;
      }>;
    };

    // `-copy`, then `-copy-2`, `-copy-3`… A timestamp would be unreadable and a
    // random suffix would make the URL meaningless in the admin list.
    const baseSlug = `${original.slug}-copy`.slice(0, 84);
    let slug = baseSlug;
    for (let attempt = 2; attempt <= 20; attempt += 1) {
      const { data: clash } = await supabase
        .from("journey_entries")
        .select("id")
        .eq("slug", slug)
        .is("deleted_at", null)
        .maybeSingle();

      if (!clash) break;
      slug = `${baseSlug}-${attempt}`;
    }

    const { data: created, error } = await supabase
      .from("journey_entries")
      .insert({
        slug,
        // Always a draft, never inheriting `published`. A duplicate is unreviewed
        // by definition.
        status: "draft",
        category_id: original.category_id ?? null,
        featured: false,
        sort_order: original.sort_order ?? 0,
        event_date: original.event_date ?? null,
        date_precision: original.date_precision ?? "unknown",
        period_start: original.period_start ?? null,
        period_end: original.period_end ?? null,
        period_label_en: original.period_label_en ?? null,
        period_label_km: original.period_label_km ?? null,
        location_en: original.location_en ?? null,
        location_km: original.location_km ?? null,
        organisation_en: original.organisation_en ?? null,
        organisation_km: original.organisation_km ?? null,
        external_url: original.external_url ?? null,
        // The cover is an attachment decision, and attachments are not copied.
        cover_media_id: null,
        needs_review: true,
        review_note:
          "Duplicated from another story. Confirm every field, and attach media and links.",
        created_by: auth.session.userId,
        updated_by: auth.session.userId,
      })
      .select("id, slug")
      .single();

    if (error) return fromPostgresError(error);

    /*
     * SEO titles and descriptions are deliberately NOT copied. They are written
     * for one story's search result; carrying them onto a different story would
     * produce two pages competing under the same description, which is the exact
     * duplicate-content problem the SEO layer exists to avoid.
     */
    const translations = (original.journey_entry_translations ?? [])
      .filter((t): t is typeof t & { locale: Locale } => isLocale(t.locale))
      .map((t) => ({
        locale: t.locale,
        title: t.title,
        eyebrow: t.eyebrow,
        summary: t.summary,
        story: t.story,
        highlights: t.highlights,
        seoTitle: null,
        seoDescription: null,
      }));

    if (translations.length > 0) {
      const translationError = await writeTranslations(created.id, translations);
      if (translationError) return fromPostgresError(translationError);
    }

    await writeAuditLog({
      action: "journey.duplicated",
      actor: auth.session,
      entityType: "journey_entry",
      entityId: created.id,
      entityLabel: created.slug,
      summary: `Duplicated "${original.slug}" as a new draft. Media and links were not copied.`,
      changes: { source_slug: original.slug, slug: created.slug },
    });

    return ok({ id: created.id, slug: created.slug });
  } catch {
    return fail("server_error");
  }
}

// ── Delete / restore ────────────────────────────────────────────────────────

export async function deleteJourneyEntry(id: string): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const before = await loadEntry(id);
    if (!before) return fail("not_found");

    const supabase = await createSupabaseServerClient();

    /*
     * Soft delete, and unpublish in the same statement.
     *
     * `is_publicly_visible()` already excludes a soft-deleted row, so clearing
     * the status is redundant for the public site — but it means the row cannot
     * be restored straight back into `published` without a human choosing to,
     * which is the safer default for a story that was deleted for a reason.
     */
    const { error } = await supabase
      .from("journey_entries")
      .update({
        deleted_at: new Date().toISOString(),
        status: "archived",
        featured: false,
        updated_by: auth.session.userId,
      })
      .eq("id", id);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "journey.deleted",
      actor: auth.session,
      entityType: "journey_entry",
      entityId: id,
      entityLabel: before.slug,
      summary:
        "Soft-deleted the story. Its media attachments remain, and the media " +
        "library is untouched.",
    });

    revalidateJourney({ slug: before.slug });
    return ok({ id });
  } catch {
    return fail("server_error");
  }
}

export async function restoreJourneyEntry(id: string): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: entry } = await supabase
      .from("journey_entries")
      .select("id, slug")
      .eq("id", id)
      .maybeSingle();

    if (!entry) return fail("not_found");

    const { error } = await supabase
      .from("journey_entries")
      .update({ deleted_at: null, status: "draft", updated_by: auth.session.userId })
      .eq("id", id);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "journey.restored",
      actor: auth.session,
      entityType: "journey_entry",
      entityId: id,
      entityLabel: entry.slug,
      summary: "Restored the story as a draft.",
    });

    return ok({ id });
  } catch {
    return fail("server_error");
  }
}

// ── Relations ───────────────────────────────────────────────────────────────

/**
 * Link a story to an Experience, Education, Certificate or Project record.
 *
 * The target column is chosen from a fixed map rather than interpolated from the
 * caller's string. `journeyRelationColumns` is keyed by a Zod enum, so an
 * unexpected value cannot reach the query builder at all — which matters because
 * this is the one place in the feature where a column name is dynamic.
 */
export async function addJourneyRelation(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = journeyRelationSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectJourneyErrors(parsed.error) });
  }

  const { journeyEntryId, relatedType, relatedId } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("journey_relations")
      .select("display_order")
      .eq("journey_entry_id", journeyEntryId)
      .order("display_order", { ascending: false })
      .limit(1);

    const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

    /*
     * The four target columns are written out rather than computed from
     * `relatedType`, so the generated row type checks each one. A dynamic key
     * would type-erase the payload to `Record<string, unknown>` and silently
     * accept a column that does not exist — on the one table in this feature
     * where getting the column wrong means linking a story to the wrong record.
     */
    const { data: created, error } = await supabase
      .from("journey_relations")
      .insert({
        journey_entry_id: journeyEntryId,
        experience_id: relatedType === "experience" ? relatedId : null,
        education_id: relatedType === "education" ? relatedId : null,
        certificate_id: relatedType === "certificate" ? relatedId : null,
        project_id: relatedType === "project" ? relatedId : null,
        display_order: nextOrder,
      })
      .select("id")
      .single();

    if (error) {
      // 23505 on one of the partial unique indexes means the link already exists.
      if (error.code === "23505") {
        return fail("conflict", { fields: { relatedId: "relationExists" } });
      }
      // 23503 means the target row is gone.
      if (error.code === "23503") {
        return fail("not_found", { fields: { relatedId: "relationTargetMissing" } });
      }
      return fromPostgresError(error);
    }

    await writeAuditLog({
      action: "journey.relation_added",
      actor: auth.session,
      entityType: "journey_entry",
      entityId: journeyEntryId,
      summary: `Linked the story to a ${relatedType} record.`,
      changes: { related_type: relatedType, related_id: relatedId },
    });

    revalidateJourney({});
    return ok({ id: created.id });
  } catch {
    return fail("server_error");
  }
}

export async function removeJourneyRelation(
  relationId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: relation } = await supabase
      .from("journey_relations")
      .select("id, journey_entry_id, experience_id, education_id, certificate_id, project_id")
      .eq("id", relationId)
      .maybeSingle();

    if (!relation) return fail("not_found");

    /*
     * A hard delete, unlike everything else in this feature.
     *
     * A relation carries no content of its own — no caption, no review, no
     * authored prose. There is nothing to recover, so a soft-deleted relation
     * would only be a row that every query has to remember to filter.
     */
    const { error } = await supabase
      .from("journey_relations")
      .delete()
      .eq("id", relationId);

    if (error) return fromPostgresError(error);

    const relatedType: JourneyRelationType | "unknown" = relation.experience_id
      ? "experience"
      : relation.education_id
        ? "education"
        : relation.certificate_id
          ? "certificate"
          : relation.project_id
            ? "project"
            : "unknown";

    await writeAuditLog({
      action: "journey.relation_removed",
      actor: auth.session,
      entityType: "journey_entry",
      entityId: relation.journey_entry_id,
      summary: `Removed the story's link to a ${relatedType} record.`,
      changes: { related_type: relatedType },
    });

    revalidateJourney({});
    return ok({ id: relationId });
  } catch {
    return fail("server_error");
  }
}
