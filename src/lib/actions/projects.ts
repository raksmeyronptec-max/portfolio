"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  collectProjectErrors,
  projectSchema,
  publishBlockers,
  type ProjectInput,
} from "@/lib/validation/project";

/**
 * Project Server Actions.
 *
 * Every action starts with `checkPermission`, which validates the session token
 * against the auth server and resolves the role from the database. RLS then
 * enforces the same rule on the query itself, so a missing check here still cannot
 * write data — but the check exists so the failure is a typed result the form can
 * render rather than an opaque database error.
 *
 * Publishing is gated twice on purpose:
 *  - `publishBlockers()` is the editorial gate: is the case study actually finished?
 *  - the database is the structural gate: `sync_published_at` derives
 *    `published_at` from the status transition, so a client cannot backdate a
 *    publication.
 */

// ── Save (create or update) ─────────────────────────────────────────────────

export async function saveProject(
  input: unknown,
  projectId?: string,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", { fields: collectProjectErrors(parsed.error) });
  }

  const data = parsed.data;

  // Editorial publish gate. Checked before the write so a blocked publish does not
  // leave a half-applied change behind.
  if (data.status === "published") {
    const blockers = publishBlockers(data);
    if (blockers.length > 0) {
      return fail("publish_blocked", {
        fields: Object.fromEntries(blockers.map((code) => [code, code])),
        detail: "This project is not ready to publish yet.",
      });
    }
  }

  const supabase = await createSupabaseServerClient();

  // Row for the parent table. `published_at` is deliberately absent: the database
  // trigger owns it.
  const row = {
    slug: data.slug,
    status: data.status,
    project_status: data.project_status,
    featured: data.featured,
    sort_order: data.sort_order,
    role_en: data.role_en ?? null,
    role_km: data.role_km ?? null,
    organization_en: data.organization_en ?? null,
    organization_km: data.organization_km ?? null,
    team_size: data.team_size ?? null,
    duration_label_en: data.duration_label_en ?? null,
    duration_label_km: data.duration_label_km ?? null,
    period_label_en: data.period_label_en ?? null,
    period_label_km: data.period_label_km ?? null,
    year_label: data.year_label ?? null,
    live_url: data.live_url ?? null,
    repository_url: data.repository_url ?? null,
    demo_video_url: data.demo_video_url ?? null,
    cover_media_id: data.cover_media_id ?? null,
    og_image_media_id: data.og_image_media_id ?? null,
    started_at: data.started_at ?? null,
    completed_at: data.completed_at ?? null,
    needs_review: data.needs_review,
    review_note: data.review_note ?? null,
    updated_by: auth.session.userId,
  };

  try {
    let before: Record<string, unknown> | null = null;
    let id = projectId;
    let previousStatus: string | null = null;

    if (projectId) {
      const { data: existing } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();

      if (!existing) return fail("not_found");
      before = existing as Record<string, unknown>;
      previousStatus = existing.status;

      const { error } = await supabase
        .from("projects")
        .update(row)
        .eq("id", projectId);

      if (error) return fromPostgresError(error);
    } else {
      const { data: created, error } = await supabase
        .from("projects")
        .insert({ ...row, created_by: auth.session.userId })
        .select("id")
        .single();

      if (error) return fromPostgresError(error);
      id = created.id;
    }

    if (!id) return fail("server_error");

    // ── Translations ────────────────────────────────────────────────────────
    // Upsert on the (project_id, locale) unique constraint, so editing a locale
    // updates rather than duplicating.
    const translationRows = data.translations.map((translation) => ({
      project_id: id,
      locale: translation.locale,
      title: translation.title,
      summary: translation.summary ?? null,
      overview: translation.overview ?? null,
      problem: translation.problem ?? null,
      target_users: translation.target_users ?? null,
      goals: translation.goals ?? null,
      my_role: translation.my_role ?? null,
      responsibilities: translation.responsibilities ?? null,
      constraints: translation.constraints ?? null,
      research: translation.research ?? null,
      ux_decisions: translation.ux_decisions ?? null,
      architecture: translation.architecture ?? null,
      database_decisions: translation.database_decisions ?? null,
      key_features: translation.key_features ?? null,
      security_notes: translation.security_notes ?? null,
      accessibility_notes: translation.accessibility_notes ?? null,
      seo_notes: translation.seo_notes ?? null,
      performance_notes: translation.performance_notes ?? null,
      challenges: translation.challenges ?? null,
      solution: translation.solution ?? null,
      results: translation.results ?? null,
      lessons: translation.lessons ?? null,
      next_steps: translation.next_steps ?? null,
      seo_title: translation.seo_title ?? null,
      seo_description: translation.seo_description ?? null,
      translation_state: deriveTranslationState(translation),
    }));

    const { error: translationError } = await supabase
      .from("project_translations")
      .upsert(translationRows, { onConflict: "project_id,locale" });

    if (translationError) return fromPostgresError(translationError);

    // ── Join tables ─────────────────────────────────────────────────────────
    // Replace-in-place: delete then insert. A diff would be more efficient but
    // these sets are tiny, and replacing removes any chance of orphaned rows.
    await supabase.from("project_category_links").delete().eq("project_id", id);
    if (data.categoryIds.length > 0) {
      await supabase.from("project_category_links").insert(
        data.categoryIds.map((categoryId) => ({
          project_id: id,
          category_id: categoryId,
        })),
      );
    }

    await supabase.from("project_technologies").delete().eq("project_id", id);
    if (data.technologyIds.length > 0) {
      await supabase.from("project_technologies").insert(
        data.technologyIds.map((technologyId, index) => ({
          project_id: id,
          technology_id: technologyId,
          sort_order: index,
        })),
      );
    }

    // ── Revision snapshot ───────────────────────────────────────────────────
    await recordRevision(supabase, {
      entityType: "project",
      entityId: id,
      status: data.status,
      snapshot: { ...row, translations: translationRows },
      authorId: auth.session.userId,
      summary: projectId ? "Updated project" : "Created project",
    });

    // ── Audit ───────────────────────────────────────────────────────────────
    const publishedNow = data.status === "published" && previousStatus !== "published";
    const unpublishedNow = previousStatus === "published" && data.status !== "published";

    await writeAuditLog({
      action: publishedNow
        ? "project.published"
        : unpublishedNow
          ? "project.unpublished"
          : projectId
            ? "project.updated"
            : "project.created",
      actor: auth.session,
      entityType: "project",
      entityId: id,
      entityLabel: data.slug,
      summary: `${projectId ? "Updated" : "Created"} project “${data.slug}” with status ${data.status}.`,
      changes: diffRecords(before, row),
    });

    revalidatePublicContent({ projectSlug: data.slug });

    return ok({ id, slug: data.slug });
  } catch {
    return fail("server_error");
  }
}

// ── Status transitions ──────────────────────────────────────────────────────

/**
 * Move a project through the workflow.
 *
 * Publishing re-runs the editorial gate rather than trusting that the form checked
 * it: this action is reachable from list-row buttons too, not only from the editor.
 */
export async function setProjectStatus(
  projectId: string,
  status: "draft" | "in_review" | "published" | "archived",
): Promise<ActionResult<{ slug: string }>> {
  const auth = await checkPermission("publishContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("projects")
      .select(
        `*, project_translations(locale, title, summary, overview, problem, solution,
          seo_title, seo_description, target_users, goals, my_role, responsibilities,
          constraints, research, ux_decisions, architecture, database_decisions,
          key_features, security_notes, accessibility_notes, seo_notes,
          performance_notes, challenges, results, lessons, next_steps)`,
      )
      .eq("id", projectId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    if (status === "published") {
      const blockers = publishBlockers({
        ...(existing as unknown as ProjectInput),
        status: "published",
        translations: (existing.project_translations ??
          []) as unknown as ProjectInput["translations"],
        categoryIds: [],
        technologyIds: [],
      });

      if (blockers.length > 0) {
        return fail("publish_blocked", {
          fields: Object.fromEntries(blockers.map((code) => [code, code])),
        });
      }
    }

    const { error } = await supabase
      .from("projects")
      .update({ status, updated_by: auth.session.userId })
      .eq("id", projectId);

    if (error) return fromPostgresError(error);

    const action =
      status === "published"
        ? "project.published"
        : status === "archived"
          ? "project.archived"
          : existing.status === "published"
            ? "project.unpublished"
            : "project.updated";

    await writeAuditLog({
      action,
      actor: auth.session,
      entityType: "project",
      entityId: projectId,
      entityLabel: existing.slug,
      summary: `Status changed from ${existing.status} to ${status}.`,
      changes: { status: { from: existing.status, to: status } },
    });

    revalidatePublicContent({ projectSlug: existing.slug });

    return ok({ slug: existing.slug });
  } catch {
    return fail("server_error");
  }
}

export async function toggleProjectFeatured(
  projectId: string,
  featured: boolean,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("projects")
      .select("slug, featured")
      .eq("id", projectId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    const { error } = await supabase
      .from("projects")
      .update({ featured, updated_by: auth.session.userId })
      .eq("id", projectId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "project.updated",
      actor: auth.session,
      entityType: "project",
      entityId: projectId,
      entityLabel: existing.slug,
      summary: featured ? "Marked as featured." : "Removed from featured.",
      changes: { featured: { from: existing.featured, to: featured } },
    });

    revalidatePublicContent({ projectSlug: existing.slug });
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

/**
 * Soft delete.
 *
 * Sets `deleted_at`. The row leaves every public query (RLS checks
 * `deleted_at is null`) and its slug is freed for reuse, because the uniqueness
 * index is partial. Nothing is destroyed, so this is reversible.
 */
export async function softDeleteProject(
  projectId: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("projects")
      .select("slug")
      .eq("id", projectId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    const { error } = await supabase
      .from("projects")
      .update({
        deleted_at: new Date().toISOString(),
        status: "archived",
        updated_by: auth.session.userId,
      })
      .eq("id", projectId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "project.deleted",
      actor: auth.session,
      entityType: "project",
      entityId: projectId,
      entityLabel: existing.slug,
      summary: "Soft-deleted (recoverable).",
    });

    revalidatePublicContent({ projectSlug: existing.slug });
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function restoreProject(projectId: string): Promise<ActionResult<void>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("projects")
      .select("slug")
      .eq("id", projectId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    /*
     * Restore as a draft, never straight back to published. The slug may have been
     * reused while this row was deleted, and republishing silently could resurrect
     * content nobody has looked at since.
     */
    const { error } = await supabase
      .from("projects")
      .update({ deleted_at: null, status: "draft", updated_by: auth.session.userId })
      .eq("id", projectId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "project.restored",
      actor: auth.session,
      entityType: "project",
      entityId: projectId,
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
 * Duplicate a project as a fresh draft.
 *
 * Copies the parent row, every translation, and the category/technology links, but
 * deliberately not the publication state, the metrics or the screenshots: a copy
 * starts as an unpublished draft with no borrowed evidence attached to it.
 */
export async function duplicateProject(
  projectId: string,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: source } = await supabase
      .from("projects")
      .select("*, project_translations(*), project_category_links(category_id), project_technologies(technology_id, sort_order)")
      .eq("id", projectId)
      .maybeSingle();

    if (!source) return fail("not_found");

    const newSlug = await nextAvailableSlug(supabase, `${source.slug}-copy`);

    const {
      id: _id,
      created_at: _createdAt,
      updated_at: _updatedAt,
      published_at: _publishedAt,
      deleted_at: _deletedAt,
      project_translations: translations,
      project_category_links: categoryLinks,
      project_technologies: technologyLinks,
      ...rest
    } = source as Record<string, unknown> & {
      project_translations: Array<Record<string, unknown>>;
      project_category_links: Array<{ category_id: string }>;
      project_technologies: Array<{ technology_id: string; sort_order: number }>;
    };

    const { data: created, error } = await supabase
      .from("projects")
      .insert({
        ...rest,
        slug: newSlug,
        status: "draft",
        featured: false,
        // A duplicate inherits the uncertainty of its source.
        needs_review: true,
        review_note: `Duplicated from “${source.slug}”. Review every field before publishing.`,
        created_by: auth.session.userId,
        updated_by: auth.session.userId,
      })
      .select("id")
      .single();

    if (error) return fromPostgresError(error);

    if (translations.length > 0) {
      /*
       * The rows are copied wholesale minus their identity and timestamp columns.
       * TypeScript cannot see through the rest-spread of a Record, so the payload
       * is asserted — the shape is guaranteed by the source rows having come from
       * this same table.
       */
      const copiedTranslations = translations.map((translation) => {
        const {
          id: _tid,
          project_id: _pid,
          created_at: _tcreated,
          updated_at: _tupdated,
          ...translationRest
        } = translation;
        return { ...translationRest, project_id: created.id };
      }) as unknown as Database["public"]["Tables"]["project_translations"]["Insert"][];

      await supabase.from("project_translations").insert(copiedTranslations);
    }

    if (categoryLinks.length > 0) {
      await supabase.from("project_category_links").insert(
        categoryLinks.map((link) => ({
          project_id: created.id,
          category_id: link.category_id,
        })),
      );
    }

    if (technologyLinks.length > 0) {
      await supabase.from("project_technologies").insert(
        technologyLinks.map((link) => ({
          project_id: created.id,
          technology_id: link.technology_id,
          sort_order: link.sort_order,
        })),
      );
    }

    await writeAuditLog({
      action: "project.duplicated",
      actor: auth.session,
      entityType: "project",
      entityId: created.id,
      entityLabel: newSlug,
      summary: `Duplicated from “${source.slug}”.`,
    });

    return ok({ id: created.id, slug: newSlug });
  } catch {
    return fail("server_error");
  }
}

export async function reorderProjects(
  order: Array<{ id: string; sortOrder: number }>,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    for (const entry of order) {
      const { error } = await supabase
        .from("projects")
        .update({ sort_order: entry.sortOrder })
        .eq("id", entry.id);
      if (error) return fromPostgresError(error);
    }

    await writeAuditLog({
      action: "project.updated",
      actor: auth.session,
      entityType: "project",
      summary: `Reordered ${order.length} projects.`,
    });

    revalidatePublicContent({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Suffix a slug with -2, -3 … until it is free among non-deleted rows. */
async function nextAvailableSlug(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  candidate: string,
): Promise<string> {
  let slug = candidate.slice(0, 76);
  let attempt = 1;

  for (;;) {
    const { data } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (!data) return slug;

    attempt += 1;
    slug = `${candidate.slice(0, 72)}-${attempt}`;
  }
}

/**
 * Derive translation completeness from the content itself.
 *
 * Stored rather than computed on read so the admin's "missing translations" panel
 * and the public fallback logic agree without either re-deriving it.
 */
function deriveTranslationState(translation: {
  title: string;
  summary?: string | null;
  overview?: string | null;
  problem?: string | null;
  solution?: string | null;
}): "missing" | "partial" | "complete" | "needs_review" {
  const hasCore =
    Boolean(translation.summary?.trim()) &&
    Boolean(translation.overview?.trim()) &&
    Boolean(translation.problem?.trim()) &&
    Boolean(translation.solution?.trim());

  if (!translation.title.trim()) return "missing";
  return hasCore ? "complete" : "partial";
}

/** Append a revision snapshot. Never blocks the save if it fails. */
async function recordRevision(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: {
    entityType: string;
    entityId: string;
    status: string;
    snapshot: Record<string, unknown>;
    authorId: string;
    summary: string;
  },
): Promise<void> {
  try {
    const { data: next } = await supabase.rpc("next_revision_no", {
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
    });

    await supabase.from("content_revisions").insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      revision_no: typeof next === "number" ? next : 1,
      status_at_revision: input.status as never,
      snapshot: input.snapshot as never,
      change_summary: input.summary,
      author_id: input.authorId,
    });
  } catch {
    // A missing revision is a lesser problem than a refused save.
  }
}
