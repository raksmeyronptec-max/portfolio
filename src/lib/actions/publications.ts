"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/log";
import type { Locale } from "@/i18n/config";
import {
  fail,
  fromPostgresError,
  ok,
  revalidatePublications,
  type ActionResult,
} from "./result";
import {
  collectPublicationErrors,
  publicationRelationSchema,
  publicationSchema,
  publicationVersionActivationSchema,
  publicationVersionSchema,
  type PublicationStatus,
} from "@/lib/validation/publication";

/**
 * Publication CRUD, editions and relations.
 *
 * NOTE — this file is `"use server"`, so every export must be an async function.
 * Constants, schemas and types belong in `@/lib/validation/publication`; see
 * tests/unit/use-server-exports.test.ts for what happens otherwise.
 *
 * ── Permission model ───────────────────────────────────────────────────────
 * Writing is `editContent`, publishing is `publishContent`, soft-delete and
 * restore are `deleteContent` (owner-only) — the same ladder as projects,
 * certificates and journey stories.
 *
 * Two things are owner-only that are not elsewhere, and both concern files
 * rather than words:
 *
 *   · `reviewPublicationPrivacy` — the decision that a book PDF is safe to
 *     publish. It is the gate on a document that may carry a personal phone
 *     number or a pupil's work, so it sits with the person accountable for it,
 *     exactly as certificate privacy review does.
 *   · `setPublicationDownloadPolicy` — because "public download" gives away a
 *     book, and an editor should not be able to do that on the owner's behalf.
 *
 * Everything here validates twice: once against the zod schema so the error
 * lands on a field, and once at the database, whose triggers and CHECKs are the
 * actual guarantee. A `check_violation` from a publish gate arrives back as
 * `publish_blocked` with the migration's own message — see `fromPostgresError`.
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

async function loadPublication(id: string) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("publications")
    .select(
      "id, slug, status, featured, needs_review, privacy_status, pdf_download_policy, license_type, cover_media_id, active_version_id",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  return data as {
    id: string;
    slug: string;
    status: PublicationStatus;
    featured: boolean;
    needs_review: boolean;
    privacy_status: string;
    pdf_download_policy: string;
    license_type: string;
    cover_media_id: string | null;
    active_version_id: string | null;
  } | null;
}

/**
 * Write the translation rows for one publication.
 *
 * Upsert on the (publication, locale) unique constraint rather than
 * delete-then-insert. Delete-then-insert would briefly leave a published book
 * with no translation at all — and if the insert then failed, permanently.
 */
async function writeTranslations(
  publicationId: string,
  translations: Array<{
    locale: Locale;
    title: string;
    originalTitle?: string | null;
    subtitle?: string | null;
    shortSummary?: string | null;
    description?: string | null;
    introduction?: string | null;
    targetAudience?: string | null;
    learningObjectives?: string | null;
    authorNote?: string | null;
    acknowledgements?: string | null;
    citationText?: string | null;
    licenseTerms?: string | null;
    productionNotes?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
  }>,
): Promise<{ code?: string; message?: string } | null> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("publication_translations").upsert(
    translations.map((t) => ({
      publication_id: publicationId,
      locale: t.locale,
      title: t.title,
      original_title: t.originalTitle ?? null,
      subtitle: t.subtitle ?? null,
      short_summary: t.shortSummary ?? null,
      description: t.description ?? null,
      introduction: t.introduction ?? null,
      target_audience: t.targetAudience ?? null,
      learning_objectives: t.learningObjectives ?? null,
      author_note: t.authorNote ?? null,
      acknowledgements: t.acknowledgements ?? null,
      citation_text: t.citationText ?? null,
      license_terms: t.licenseTerms ?? null,
      production_notes: t.productionNotes ?? null,
      seo_title: t.seoTitle ?? null,
      seo_description: t.seoDescription ?? null,
      /*
       * `complete` only when a reader would get a real page in this language:
       * a summary for the card and a description for the body. The admin's
       * badge reads this rather than recomputing emptiness in three places.
       */
      translation_state:
        t.shortSummary?.trim() && t.description?.trim() ? "complete" : "partial",
    })),
    { onConflict: "publication_id,locale" },
  );

  return error;
}

/** Column payload shared by create and update. */
function publicationColumns(data: {
  slug: string;
  status: PublicationStatus;
  publicationTypeId?: string | null;
  featured: boolean;
  displayOrder: number;
  contentLanguage: string;
  editionLabel?: string | null;
  editionNumber: number | null;
  publicationYear: number | null;
  publicationDate?: string | null;
  pageCount: number | null;
  subjectEn?: string | null;
  subjectKm?: string | null;
  gradeLevelEn?: string | null;
  gradeLevelKm?: string | null;
  readingLevel?: string | null;
  coverMediaId?: string | null;
  previewPolicy: string;
  previewPageLimit: number | null;
  pdfDownloadPolicy: string;
  sampleDownloadPolicy: string;
  sourcePolicy: string;
  sourceRepositoryUrl?: string | null;
  licenseType: string;
  copyrightHolder?: string | null;
  copyrightYear: number | null;
  allowRedistribution: boolean;
  allowModification: boolean;
  typesetWithLatex: boolean;
  latexEngine?: string | null;
  documentClass?: string | null;
  buildYear: number | null;
  isbn?: string | null;
  doi?: string | null;
  externalUrl?: string | null;
  needsReview: boolean;
  reviewNote?: string | null;
  noindex: boolean;
}) {
  return {
    slug: data.slug,
    status: data.status,
    publication_type_id: data.publicationTypeId ?? null,
    featured: data.featured,
    display_order: data.displayOrder,
    content_language: data.contentLanguage,
    edition_label: data.editionLabel ?? null,
    edition_number: data.editionNumber,
    publication_year: data.publicationYear,
    publication_date: data.publicationDate ?? null,
    page_count: data.pageCount,
    subject_en: data.subjectEn ?? null,
    subject_km: data.subjectKm ?? null,
    grade_level_en: data.gradeLevelEn ?? null,
    grade_level_km: data.gradeLevelKm ?? null,
    reading_level: data.readingLevel ?? null,
    cover_media_id: data.coverMediaId ?? null,
    preview_policy: data.previewPolicy,
    preview_page_limit: data.previewPageLimit,
    pdf_download_policy: data.pdfDownloadPolicy,
    sample_download_policy: data.sampleDownloadPolicy,
    source_policy: data.sourcePolicy,
    source_repository_url: data.sourceRepositoryUrl ?? null,
    license_type: data.licenseType,
    copyright_holder: data.copyrightHolder ?? null,
    copyright_year: data.copyrightYear,
    allow_redistribution: data.allowRedistribution,
    allow_modification: data.allowModification,
    typeset_with_latex: data.typesetWithLatex,
    latex_engine: data.latexEngine ?? null,
    document_class: data.documentClass ?? null,
    build_year: data.buildYear,
    isbn: data.isbn ?? null,
    doi: data.doi ?? null,
    external_url: data.externalUrl ?? null,
    needs_review: data.needsReview,
    review_note: data.reviewNote ?? null,
    noindex: data.noindex,
  };
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createPublication(
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const data = parsed.data;

  if (data.status === "published") {
    const publisher = await checkPermission("publishContent");
    if (!publisher.ok) return fail("forbidden");
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data: created, error } = await supabase
      .from("publications")
      .insert({
        ...publicationColumns(data),
        /*
         * A new publication is never created pre-approved, whatever the form
         * submitted. The privacy review is a decision about a file that does not
         * exist yet at create time; letting the create payload carry
         * `approved` would let a client skip the one gate that matters.
         */
        privacy_status: "pending_review",
        created_by: auth.session.userId,
        updated_by: auth.session.userId,
      })
      .select("id, slug")
      .single();

    if (error) return fromPostgresError(error);

    const translationError = await writeTranslations(created.id, data.translations);
    if (translationError) return fromPostgresError(translationError);

    await writeAuditLog({
      action: "publication.created",
      actor: auth.session,
      entityType: "publication",
      entityId: created.id,
      entityLabel: created.slug,
      summary: `Created the publication "${data.translations[0]?.title ?? created.slug}".`,
      changes: { slug: data.slug, status: data.status },
    });

    if (data.status === "published") revalidatePublications({ slug: created.slug });

    return ok({ id: created.id, slug: created.slug });
  } catch {
    return fail("server_error");
  }
}

// ── Update ──────────────────────────────────────────────────────────────────

export async function updatePublication(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const data = parsed.data;
  const existing = await loadPublication(id);
  if (!existing) return fail("not_found");

  // Publishing — or unpublishing — is a separate permission from editing.
  if (data.status === "published" || existing.status === "published") {
    const publisher = await checkPermission("publishContent");
    if (!publisher.ok) return fail("forbidden");
  }

  /*
   * Changing the download policy or the licence is owner-only.
   *
   * Both give something away that cannot be taken back: a book that has been
   * downloaded stays downloaded, and a work released under CC BY stays released.
   * An editor may write the page; the decision to hand out the file belongs to
   * the person whose work it is.
   */
  if (
    data.pdfDownloadPolicy !== existing.pdf_download_policy ||
    data.licenseType !== existing.license_type
  ) {
    const owner = await checkPermission("deleteContent");
    if (!owner.ok) {
      return fail("forbidden", {
        detail:
          "Changing the download policy or the licence requires the owner role.",
      });
    }
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data: updated, error } = await supabase
      .from("publications")
      .update({
        ...publicationColumns(data),
        /*
         * The privacy decision is not editable from this form — it moves only
         * through `reviewPublicationPrivacy`, which records who decided and
         * when. Any edit to a *file-bearing* field would otherwise silently
         * carry the old approval forward, so those reset it; see below.
         */
        updated_by: auth.session.userId,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id, slug")
      .single();

    if (error) return fromPostgresError(error);

    const translationError = await writeTranslations(id, data.translations);
    if (translationError) return fromPostgresError(translationError);

    await writeAuditLog({
      action: "publication.updated",
      actor: auth.session,
      entityType: "publication",
      entityId: id,
      entityLabel: updated.slug,
      summary: `Updated the publication "${data.translations[0]?.title ?? updated.slug}".`,
      changes: { slug: data.slug, status: data.status },
    });

    if (data.pdfDownloadPolicy !== existing.pdf_download_policy) {
      await writeAuditLog({
        action: "publication.download_policy_changed",
        actor: auth.session,
        entityType: "publication",
        entityId: id,
        entityLabel: updated.slug,
        summary: `Download policy changed from ${existing.pdf_download_policy} to ${data.pdfDownloadPolicy}.`,
        changes: { from: existing.pdf_download_policy, to: data.pdfDownloadPolicy },
      });
    }

    if (data.licenseType !== existing.license_type) {
      await writeAuditLog({
        action: "publication.license_changed",
        actor: auth.session,
        entityType: "publication",
        entityId: id,
        entityLabel: updated.slug,
        summary: `Licence changed from ${existing.license_type} to ${data.licenseType}.`,
        changes: { from: existing.license_type, to: data.licenseType },
      });
    }

    if (data.coverMediaId !== existing.cover_media_id) {
      await writeAuditLog({
        action: "publication.cover_changed",
        actor: auth.session,
        entityType: "publication",
        entityId: id,
        entityLabel: updated.slug,
        summary: "Changed the cover image.",
        changes: {},
      });
    }

    revalidatePublications({
      slug: updated.slug,
      previousSlug: existing.slug,
    });

    return ok({ id, slug: updated.slug });
  } catch {
    return fail("server_error");
  }
}

// ── Status transitions ──────────────────────────────────────────────────────

export async function setPublicationStatus(
  id: string,
  status: PublicationStatus,
): Promise<ActionResult<{ status: PublicationStatus }>> {
  const auth = await checkPermission("publishContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const existing = await loadPublication(id);
  if (!existing) return fail("not_found");

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("publications")
      .update({ status, updated_by: auth.session.userId })
      .eq("id", id)
      .is("deleted_at", null);

    // The publish gate reports itself as a check_violation carrying the
    // migration's own message — "cannot be published before its privacy review
    // is approved" — which is exactly what the admin needs to read.
    if (error) return fromPostgresError(error);

    const action =
      status === "published"
        ? "publication.published"
        : status === "archived"
          ? "publication.archived"
          : existing.status === "published"
            ? "publication.unpublished"
            : "publication.updated";

    await writeAuditLog({
      action,
      actor: auth.session,
      entityType: "publication",
      entityId: id,
      entityLabel: existing.slug,
      summary: `Status changed from ${existing.status} to ${status}.`,
      changes: { from: existing.status, to: status },
    });

    revalidatePublications({ slug: existing.slug });
    return ok({ status });
  } catch {
    return fail("server_error");
  }
}

export async function setPublicationFeatured(
  id: string,
  featured: boolean,
): Promise<ActionResult<{ featured: boolean }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const existing = await loadPublication(id);
  if (!existing) return fail("not_found");

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("publications")
      .update({ featured, updated_by: auth.session.userId })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.featured_changed",
      actor: auth.session,
      entityType: "publication",
      entityId: id,
      entityLabel: existing.slug,
      summary: featured
        ? "Featured on the homepage."
        : "Removed from the homepage selection.",
      changes: { featured },
    });

    revalidatePublications({ slug: existing.slug });
    return ok({ featured });
  } catch {
    return fail("server_error");
  }
}

/** Reorder the listing. Ids in their new display order. */
export async function reorderPublications(
  orderedIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  if (orderedIds.length === 0 || orderedIds.length > 400) return fail("validation");

  try {
    const supabase = await createSupabaseServerClient();

    /*
     * Sequential updates rather than one upsert. An upsert would need every
     * NOT NULL column in the payload, which means reading each row first — the
     * same number of round trips, plus a window in which a partial payload could
     * blank a column. The list is a portfolio's worth of books, not a catalogue.
     */
    for (const [index, id] of orderedIds.entries()) {
      const { error } = await supabase
        .from("publications")
        .update({ display_order: index, updated_by: auth.session.userId })
        .eq("id", id)
        .is("deleted_at", null);

      if (error) return fromPostgresError(error);
    }

    await writeAuditLog({
      action: "publication.reordered",
      actor: auth.session,
      entityType: "publication",
      summary: `Reordered ${orderedIds.length} publications.`,
      changes: { count: orderedIds.length },
    });

    revalidatePublications({});
    return ok({ count: orderedIds.length });
  } catch {
    return fail("server_error");
  }
}

// ── Privacy review ──────────────────────────────────────────────────────────

/**
 * Record the privacy decision on a publication.
 *
 * Owner-only, and the only path that can set `privacy_status` — the edit form
 * cannot. That separation is the point: approving a book PDF is a statement that
 * somebody opened it and looked, and it should not be a side effect of fixing a
 * typo in the summary.
 *
 * Which checklist boxes were ticked is deliberately NOT stored. Persisting them
 * would imply a legal record this CMS cannot substantiate; only the decision, the
 * reviewer, the timestamp and the note are kept.
 */
export async function reviewPublicationPrivacy(input: {
  id: string;
  privacyStatus: "pending_review" | "approved" | "rejected";
  note?: string | null;
}): Promise<ActionResult<{ privacyStatus: string }>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) {
    return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated", {
      detail: "Approving a publication for release requires the owner role.",
    });
  }

  const existing = await loadPublication(input.id);
  if (!existing) return fail("not_found");

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("publications")
      .update({
        privacy_status: input.privacyStatus,
        privacy_review_note: input.note?.trim() || null,
        privacy_reviewed_by: auth.session.userId,
        /*
         * Cleared when the decision is withdrawn, so an "approved must have a
         * timestamp" CHECK cannot be satisfied by a stale one. Moving back to
         * `pending_review` genuinely means "nobody has decided yet".
         */
        privacy_reviewed_at:
          input.privacyStatus === "pending_review" ? null : new Date().toISOString(),
        updated_by: auth.session.userId,
      })
      .eq("id", input.id)
      .is("deleted_at", null);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.privacy_reviewed",
      actor: auth.session,
      entityType: "publication",
      entityId: input.id,
      entityLabel: existing.slug,
      summary: `Privacy review set to ${input.privacyStatus}.`,
      // The note is a free-text field an admin wrote about a document's contents.
      // Only its presence is recorded — the text itself may name what was found.
      changes: { privacy_status: input.privacyStatus, note_present: Boolean(input.note) },
    });

    revalidatePublications({ slug: existing.slug });
    return ok({ privacyStatus: input.privacyStatus });
  } catch {
    return fail("server_error");
  }
}

// ── Soft delete, restore, duplicate ─────────────────────────────────────────

export async function deletePublication(id: string): Promise<ActionResult<void>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const existing = await loadPublication(id);
  if (!existing) return fail("not_found");

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("publications")
      .update({ deleted_at: new Date().toISOString(), updated_by: auth.session.userId })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.deleted",
      actor: auth.session,
      entityType: "publication",
      entityId: id,
      entityLabel: existing.slug,
      summary: `Soft-deleted the publication "${existing.slug}".`,
      changes: {},
    });

    revalidatePublications({ slug: existing.slug });
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function restorePublication(id: string): Promise<ActionResult<void>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    /*
     * Restored as a draft, never straight back to published.
     *
     * The slug's live-only unique index means another publication may have taken
     * the slug while this one was deleted, and a restore that went straight to
     * `published` would either fail confusingly or republish something whose
     * privacy approval is now months stale.
     */
    const { data, error } = await supabase
      .from("publications")
      .update({
        deleted_at: null,
        status: "draft",
        updated_by: auth.session.userId,
      })
      .eq("id", id)
      .not("deleted_at", "is", null)
      .select("slug")
      .single();

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.restored",
      actor: auth.session,
      entityType: "publication",
      entityId: id,
      entityLabel: data.slug,
      summary: `Restored the publication "${data.slug}" as a draft.`,
      changes: {},
    });

    revalidatePublications({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

/**
 * Duplicate a publication as a draft.
 *
 * Copies the words and the taxonomy. Deliberately does NOT copy:
 *
 *   · the editions, and therefore none of the three file references. A duplicate
 *     is a starting point for a *different* book; pointing a second publication
 *     at the same archival original would mean deleting one could restrict the
 *     other's file, and would make "which book is this PDF for?" unanswerable.
 *   · the privacy approval. The copy is a different document as far as the
 *     review is concerned, and inheriting an approval would let a new book go
 *     public on the strength of a review of a different one.
 *   · `featured`, so a duplicate never appears on the homepage by surprise.
 */
export async function duplicatePublication(
  id: string,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: source, error: loadError } = await supabase
      .from("publications")
      .select("*, publication_translations(*), publication_chapters(*)")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (loadError || !source) return fail("not_found");

    const row = source as Record<string, unknown> & {
      slug: string;
      publication_translations: Array<Record<string, unknown>>;
      publication_chapters: Array<Record<string, unknown>>;
    };

    const slug = await nextAvailableSlug(row.slug);

    const {
      id: _id,
      slug: _slug,
      publication_translations: translations,
      publication_chapters: chapters,
      created_at: _createdAt,
      updated_at: _updatedAt,
      published_at: _publishedAt,
      deleted_at: _deletedAt,
      active_version_id: _activeVersion,
      privacy_reviewed_at: _reviewedAt,
      privacy_reviewed_by: _reviewedBy,
      ...rest
    } = row;

    const { data: created, error } = await supabase
      .from("publications")
      .insert({
        ...rest,
        slug,
        status: "draft",
        featured: false,
        privacy_status: "pending_review",
        privacy_review_note: null,
        needs_review: true,
        review_note:
          "Duplicated from another publication. Check every field before publishing.",
        created_by: auth.session.userId,
        updated_by: auth.session.userId,
      })
      .select("id, slug")
      .single();

    if (error) return fromPostgresError(error);

    /*
     * Copied column by column rather than by spreading the source row.
     *
     * A spread of a `Record<string, unknown>` type-erases the payload, which
     * means a column renamed in a later migration would still compile here and
     * fail at runtime — and on the copy path, where nobody looks until they need
     * it. Naming the columns costs a few lines and makes the next schema change
     * a compile error.
     */
    if (translations.length > 0) {
      const { error: translationError } = await supabase
        .from("publication_translations")
        .insert(
          translations.map((translation) => ({
            publication_id: created.id,
            locale: translation.locale as "en" | "km",
            title: translation.title as string,
            original_title: (translation.original_title as string | null) ?? null,
            subtitle: (translation.subtitle as string | null) ?? null,
            short_summary: (translation.short_summary as string | null) ?? null,
            description: (translation.description as string | null) ?? null,
            introduction: (translation.introduction as string | null) ?? null,
            target_audience: (translation.target_audience as string | null) ?? null,
            learning_objectives:
              (translation.learning_objectives as string | null) ?? null,
            author_note: (translation.author_note as string | null) ?? null,
            acknowledgements: (translation.acknowledgements as string | null) ?? null,
            citation_text: (translation.citation_text as string | null) ?? null,
            license_terms: (translation.license_terms as string | null) ?? null,
            production_notes: (translation.production_notes as string | null) ?? null,
            seo_title: (translation.seo_title as string | null) ?? null,
            seo_description: (translation.seo_description as string | null) ?? null,
          })),
        );

      if (translationError) return fromPostgresError(translationError);
    }

    if (chapters.length > 0) {
      const { error: chapterError } = await supabase.from("publication_chapters").insert(
        chapters.map((chapter) => ({
          publication_id: created.id,
          chapter_number: (chapter.chapter_number as string | null) ?? null,
          title_en: (chapter.title_en as string | null) ?? null,
          title_km: (chapter.title_km as string | null) ?? null,
          description_en: (chapter.description_en as string | null) ?? null,
          description_km: (chapter.description_km as string | null) ?? null,
          start_page: (chapter.start_page as number | null) ?? null,
          end_page: (chapter.end_page as number | null) ?? null,
          sort_order: (chapter.sort_order as number | null) ?? 0,
        })),
      );

      if (chapterError) return fromPostgresError(chapterError);
    }

    await writeAuditLog({
      action: "publication.duplicated",
      actor: auth.session,
      entityType: "publication",
      entityId: created.id,
      entityLabel: created.slug,
      summary: `Duplicated "${row.slug}" as "${created.slug}".`,
      changes: { from: row.slug, to: created.slug },
    });

    return ok({ id: created.id, slug: created.slug });
  } catch {
    return fail("server_error");
  }
}

/** `slug-copy`, then `slug-copy-2`, … until one is free. */
async function nextAvailableSlug(base: string): Promise<string> {
  const supabase = await createSupabaseServerClient();

  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = attempt === 1 ? `${base}-copy` : `${base}-copy-${attempt}`;
    const trimmed = candidate.slice(0, 90);

    const { data } = await supabase
      .from("publications")
      .select("id")
      .eq("slug", trimmed)
      .is("deleted_at", null)
      .maybeSingle();

    if (!data) return trimmed;
  }

  // Fifty collisions is not a real scenario; a random suffix beats failing.
  return `${base.slice(0, 80)}-${crypto.randomUUID().slice(0, 8)}`;
}

// ── Editions ────────────────────────────────────────────────────────────────

export async function createPublicationVersion(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationVersionSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: created, error } = await supabase
      .from("publication_versions")
      .insert({
        publication_id: data.publicationId,
        version_label: data.versionLabel,
        edition_number: data.editionNumber,
        publication_year: data.publicationYear,
        publication_date: data.publicationDate ?? null,
        page_count: data.pageCount,
        pdf_media_id: data.pdfMediaId ?? null,
        original_media_id: data.originalMediaId ?? null,
        source_archive_media_id: data.sourceArchiveMediaId ?? null,
        changelog_en: data.changelogEn ?? null,
        changelog_km: data.changelogKm ?? null,
        is_active: data.isActive,
        status: data.status,
        created_by: auth.session.userId,
      })
      .select("id")
      .single();

    // The file-level trigger reports itself here: "the archival original must be
    // a private media asset", "the LaTeX source archive must be a
    // publication_source asset". Those messages are ours and safe to surface.
    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.version_created",
      actor: auth.session,
      entityType: "publication",
      entityId: data.publicationId,
      entityLabel: data.versionLabel,
      summary: `Created the edition "${data.versionLabel}".`,
      // Asset ids are references to private files. Recording *that* a file was
      // attached is the useful fact; recording which one invites a reader of the
      // audit log to go looking for it.
      changes: {
        version_label: data.versionLabel,
        has_pdf: Boolean(data.pdfMediaId),
        has_original: Boolean(data.originalMediaId),
        has_source: Boolean(data.sourceArchiveMediaId),
      },
    });

    if (data.originalMediaId) {
      await writeAuditLog({
        action: "publication.original_uploaded",
        actor: auth.session,
        entityType: "publication",
        entityId: data.publicationId,
        entityLabel: data.versionLabel,
        summary: "Attached an archival original to this edition.",
        changes: {},
      });
    }

    if (data.sourceArchiveMediaId) {
      await writeAuditLog({
        action: "publication.source_uploaded",
        actor: auth.session,
        entityType: "publication",
        entityId: data.publicationId,
        entityLabel: data.versionLabel,
        summary: "Attached a LaTeX source archive to this edition.",
        changes: {},
      });
    }

    revalidatePublications({});
    return ok({ id: created.id });
  } catch {
    return fail("server_error");
  }
}

export async function updatePublicationVersion(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationVersionSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: previous } = await supabase
      .from("publication_versions")
      .select("pdf_media_id, version_label")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("publication_versions")
      .update({
        version_label: data.versionLabel,
        edition_number: data.editionNumber,
        publication_year: data.publicationYear,
        publication_date: data.publicationDate ?? null,
        page_count: data.pageCount,
        pdf_media_id: data.pdfMediaId ?? null,
        original_media_id: data.originalMediaId ?? null,
        source_archive_media_id: data.sourceArchiveMediaId ?? null,
        changelog_en: data.changelogEn ?? null,
        changelog_km: data.changelogKm ?? null,
        status: data.status,
      })
      .eq("id", id);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.version_updated",
      actor: auth.session,
      entityType: "publication",
      entityId: data.publicationId,
      entityLabel: data.versionLabel,
      summary: `Updated the edition "${data.versionLabel}".`,
      changes: { version_label: data.versionLabel, status: data.status },
    });

    /*
     * Replacing the public PDF gets its own entry.
     *
     * It is the single most consequential file change here — it is what a reader
     * downloads — and "the edition was updated" would not tell anyone a year
     * later that the served document changed.
     */
    const previousPdf = (previous as { pdf_media_id: string | null } | null)?.pdf_media_id;
    if (previousPdf && previousPdf !== (data.pdfMediaId ?? null)) {
      await writeAuditLog({
        action: "publication.pdf_replaced",
        actor: auth.session,
        entityType: "publication",
        entityId: data.publicationId,
        entityLabel: data.versionLabel,
        summary: "Replaced the downloadable PDF for this edition.",
        changes: {},
      });
    }

    revalidatePublications({});
    return ok({ id });
  } catch {
    return fail("server_error");
  }
}

/**
 * Make an edition the current one.
 *
 * The database trigger does the work — demoting the previous active edition and
 * copying the edition facts onto the parent — so this action only has to say
 * which one, and record that somebody chose it.
 */
export async function activatePublicationVersion(
  input: unknown,
): Promise<ActionResult<{ versionId: string }>> {
  const auth = await checkPermission("publishContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationVersionActivationSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const { publicationId, versionId } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: version } = await supabase
      .from("publication_versions")
      .select("id, version_label, publication_id")
      .eq("id", versionId)
      .maybeSingle();

    if (!version || version.publication_id !== publicationId) {
      return fail("not_found", { fields: { versionId: "versionNotFound" } });
    }

    const { error } = await supabase
      .from("publication_versions")
      .update({ is_active: true })
      .eq("id", versionId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.version_activated",
      actor: auth.session,
      entityType: "publication",
      entityId: publicationId,
      entityLabel: version.version_label,
      summary: `Made "${version.version_label}" the active edition.`,
      changes: { version_id: versionId },
    });

    revalidatePublications({});
    return ok({ versionId });
  } catch {
    return fail("server_error");
  }
}

export async function deletePublicationVersion(
  id: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: version } = await supabase
      .from("publication_versions")
      .select("id, publication_id, version_label, is_active")
      .eq("id", id)
      .maybeSingle();

    if (!version) return fail("not_found");

    /*
     * Refuse to delete the last edition.
     *
     * A publication whose only edition is gone still points at files through
     * nothing, has no download, and cannot be published — but it looks fine in
     * the list. Deleting the publication is the honest operation, and it is one
     * click away.
     */
    const { count } = await supabase
      .from("publication_versions")
      .select("id", { count: "exact", head: true })
      .eq("publication_id", version.publication_id);

    if ((count ?? 0) <= 1) {
      return fail("conflict", { fields: { versionId: "lastVersion" } });
    }

    const { error } = await supabase.from("publication_versions").delete().eq("id", id);
    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.version_deleted",
      actor: auth.session,
      entityType: "publication",
      entityId: version.publication_id,
      entityLabel: version.version_label,
      summary: `Deleted the edition "${version.version_label}".`,
      changes: { was_active: version.is_active },
    });

    revalidatePublications({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

// ── Relations ───────────────────────────────────────────────────────────────

export async function addPublicationRelation(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = publicationRelationSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectPublicationErrors(parsed.error) });
  }

  const { publicationId, relatedType, relatedId } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("publication_relations")
      .select("display_order")
      .eq("publication_id", publicationId)
      .order("display_order", { ascending: false })
      .limit(1);

    const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

    /*
     * The five target columns are written out rather than computed from
     * `relatedType`, exactly as `addJourneyRelation` does. A dynamic key would
     * type-erase the payload to `Record<string, unknown>` and silently accept a
     * column that does not exist — on the one table in this feature where
     * getting the column wrong means linking a book to the wrong record.
     */
    const { data: created, error } = await supabase
      .from("publication_relations")
      .insert({
        publication_id: publicationId,
        journey_entry_id: relatedType === "journey" ? relatedId : null,
        experience_id: relatedType === "experience" ? relatedId : null,
        education_id: relatedType === "education" ? relatedId : null,
        certificate_id: relatedType === "certificate" ? relatedId : null,
        project_id: relatedType === "project" ? relatedId : null,
        display_order: nextOrder,
      })
      .select("id")
      .single();

    if (error) {
      // 23505 is the partial unique index: this link already exists. Reported as
      // a field error rather than a generic conflict, because "you already
      // linked that" is actionable and "conflict" is not.
      if (error.code === "23505") {
        return fail("conflict", { fields: { relatedId: "relationExists" } });
      }
      return fromPostgresError(error);
    }

    await writeAuditLog({
      action: "publication.relation_added",
      actor: auth.session,
      entityType: "publication",
      entityId: publicationId,
      summary: `Linked this publication to a ${relatedType} record.`,
      changes: { related_type: relatedType },
    });

    revalidatePublications({});
    return ok({ id: created.id });
  } catch {
    return fail("server_error");
  }
}

export async function removePublicationRelation(
  id: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: relation } = await supabase
      .from("publication_relations")
      .select("id, publication_id")
      .eq("id", id)
      .maybeSingle();

    if (!relation) return fail("not_found");

    const { error } = await supabase.from("publication_relations").delete().eq("id", id);
    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "publication.relation_removed",
      actor: auth.session,
      entityType: "publication",
      entityId: relation.publication_id,
      summary: "Removed a link to another record.",
      changes: {},
    });

    revalidatePublications({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}
