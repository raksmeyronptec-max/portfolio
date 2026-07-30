"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  collectCvErrors,
  educationSchema,
  experienceSchema,
  skillCategorySchema,
  skillSchema,
  testimonialPublishBlockers,
  testimonialSchema,
} from "@/lib/validation/cv";

/**
 * Education, experience, capability and testimonial actions.
 *
 * These four follow the same shape as the project and certificate actions —
 * permission check, parse, write parent, upsert translations, replace join rows,
 * audit, revalidate — so there is one pattern to learn rather than four.
 */

// ── Education ───────────────────────────────────────────────────────────────

export async function saveEducation(
  input: unknown,
  educationId?: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = educationSchema.safeParse(input);
  if (!parsed.success) return fail("validation", { fields: collectCvErrors(parsed.error) });

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const row = {
      slug: data.slug,
      status: data.status,
      kind: data.kind,
      sort_order: data.sort_order,
      institution_url: data.institution_url ?? null,
      started_on: data.started_on ?? null,
      ended_on: data.ended_on ?? null,
      is_current: data.is_current,
      period_label_en: data.period_label_en ?? null,
      period_label_km: data.period_label_km ?? null,
      schedule_label_en: data.schedule_label_en ?? null,
      schedule_label_km: data.schedule_label_km ?? null,
      grade_value: data.grade_value ?? null,
      grade_scale: data.grade_scale ?? null,
      grade_source_note: data.grade_source_note ?? null,
      needs_review: data.needs_review,
      review_note: data.review_note ?? null,
    };

    let before: Record<string, unknown> | null = null;
    let id = educationId;

    if (educationId) {
      const { data: existing } = await supabase
        .from("education")
        .select("*")
        .eq("id", educationId)
        .maybeSingle();

      if (!existing) return fail("not_found");
      before = existing as Record<string, unknown>;

      const { error } = await supabase.from("education").update(row).eq("id", educationId);
      if (error) return fromPostgresError(error);
    } else {
      const { data: created, error } = await supabase
        .from("education")
        .insert(row)
        .select("id")
        .single();
      if (error) return fromPostgresError(error);
      id = created.id;
    }

    if (!id) return fail("server_error");

    const { error: translationError } = await supabase
      .from("education_translations")
      .upsert(
        data.translations.map((translation) => ({
          education_id: id,
          locale: translation.locale,
          institution: translation.institution,
          qualification: translation.qualification ?? null,
          field_of_study: translation.field_of_study ?? null,
          description: translation.description ?? null,
          achievements: translation.achievements ?? null,
        })),
        { onConflict: "education_id,locale" },
      );

    if (translationError) return fromPostgresError(translationError);

    await writeAuditLog({
      action: "education.updated",
      actor: auth.session,
      entityType: "education",
      entityId: id,
      entityLabel: data.slug,
      summary: `${educationId ? "Updated" : "Created"} education entry with status ${data.status}.`,
      changes: diffRecords(before, row),
    });

    revalidatePublicContent({});
    return ok({ id });
  } catch {
    return fail("server_error");
  }
}

// ── Experience ──────────────────────────────────────────────────────────────

export async function saveExperience(
  input: unknown,
  experienceId?: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = experienceSchema.safeParse(input);
  if (!parsed.success) return fail("validation", { fields: collectCvErrors(parsed.error) });

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const row = {
      slug: data.slug,
      status: data.status,
      kind: data.kind,
      sort_order: data.sort_order,
      organization_url: data.organization_url ?? null,
      location_en: data.location_en ?? null,
      location_km: data.location_km ?? null,
      employment_type: data.employment_type ?? null,
      started_on: data.started_on ?? null,
      ended_on: data.ended_on ?? null,
      is_current: data.is_current,
      period_label_en: data.period_label_en ?? null,
      period_label_km: data.period_label_km ?? null,
      needs_review: data.needs_review,
      review_note: data.review_note ?? null,
    };

    let before: Record<string, unknown> | null = null;
    let id = experienceId;

    if (experienceId) {
      const { data: existing } = await supabase
        .from("experiences")
        .select("*")
        .eq("id", experienceId)
        .maybeSingle();

      if (!existing) return fail("not_found");
      before = existing as Record<string, unknown>;

      const { error } = await supabase
        .from("experiences")
        .update(row)
        .eq("id", experienceId);
      if (error) return fromPostgresError(error);
    } else {
      const { data: created, error } = await supabase
        .from("experiences")
        .insert(row)
        .select("id")
        .single();
      if (error) return fromPostgresError(error);
      id = created.id;
    }

    if (!id) return fail("server_error");

    const { error: translationError } = await supabase
      .from("experience_translations")
      .upsert(
        data.translations.map((translation) => ({
          experience_id: id,
          locale: translation.locale,
          role_title: translation.role_title,
          organization: translation.organization,
          summary: translation.summary ?? null,
          description: translation.description ?? null,
          achievements: translation.achievements ?? null,
        })),
        { onConflict: "experience_id,locale" },
      );

    if (translationError) return fromPostgresError(translationError);

    // Tags are replaced wholesale; de-duplicated because of the unique constraint.
    await supabase.from("experience_tags").delete().eq("experience_id", id);
    const uniqueTags = [...new Set(data.tags.map((tag) => tag.trim()))].filter(Boolean);
    if (uniqueTags.length > 0) {
      await supabase.from("experience_tags").insert(
        uniqueTags.map((label, index) => ({
          experience_id: id,
          label_en: label,
          sort_order: index,
        })),
      );
    }

    await writeAuditLog({
      action: "experience.updated",
      actor: auth.session,
      entityType: "experience",
      entityId: id,
      entityLabel: data.slug,
      summary: `${experienceId ? "Updated" : "Created"} experience entry with status ${data.status}.`,
      changes: diffRecords(before, row),
    });

    revalidatePublicContent({});
    return ok({ id });
  } catch {
    return fail("server_error");
  }
}

// ── Testimonials ────────────────────────────────────────────────────────────

export async function saveTestimonial(
  input: unknown,
  testimonialId?: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) return fail("validation", { fields: collectCvErrors(parsed.error) });

  const data = parsed.data;

  if (data.status === "published") {
    const blockers = testimonialPublishBlockers(data);
    if (blockers.length > 0) {
      return fail("publish_blocked", {
        fields: Object.fromEntries(blockers.map((code) => [code, code])),
      });
    }
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Existing consent is preserved; un-ticking genuinely revokes it.
    let previousConsent: string | null = null;
    if (testimonialId) {
      const { data: existing } = await supabase
        .from("testimonials")
        .select("consent_recorded_at")
        .eq("id", testimonialId)
        .maybeSingle();
      previousConsent = existing?.consent_recorded_at ?? null;
    }

    const consentRecordedAt = data.consent_confirmed
      ? (previousConsent ?? new Date().toISOString())
      : null;

    const row = {
      slug: data.slug,
      status: data.status,
      featured: data.featured,
      sort_order: data.sort_order,
      author_name_en: data.author_name_en,
      author_name_km: data.author_name_km ?? null,
      author_url: data.author_url ?? null,
      avatar_media_id: data.avatar_media_id ?? null,
      relationship: data.relationship ?? null,
      consent_recorded_at: consentRecordedAt,
      consent_note: data.consent_note ?? null,
    };

    let before: Record<string, unknown> | null = null;
    let id = testimonialId;

    if (testimonialId) {
      const { data: existing } = await supabase
        .from("testimonials")
        .select("*")
        .eq("id", testimonialId)
        .maybeSingle();

      if (!existing) return fail("not_found");
      before = existing as Record<string, unknown>;

      const { error } = await supabase
        .from("testimonials")
        .update(row)
        .eq("id", testimonialId);
      if (error) return fromPostgresError(error);
    } else {
      const { data: created, error } = await supabase
        .from("testimonials")
        .insert(row)
        .select("id")
        .single();
      if (error) return fromPostgresError(error);
      id = created.id;
    }

    if (!id) return fail("server_error");

    const { error: translationError } = await supabase
      .from("testimonial_translations")
      .upsert(
        data.translations
          // A blank quote is not a translation; skip rather than fail the CHECK.
          .filter((translation) => translation.quote.trim() !== "")
          .map((translation) => ({
            testimonial_id: id,
            locale: translation.locale,
            quote: translation.quote,
            author_role: translation.author_role ?? null,
            organization: translation.organization ?? null,
          })),
        { onConflict: "testimonial_id,locale" },
      );

    if (translationError) return fromPostgresError(translationError);

    await writeAuditLog({
      action: "testimonial.updated",
      actor: auth.session,
      entityType: "testimonial",
      entityId: id,
      entityLabel: data.author_name_en,
      summary: `${testimonialId ? "Updated" : "Created"} reference from ${data.author_name_en}. Consent recorded: ${consentRecordedAt ? "yes" : "no"}.`,
      changes: diffRecords(before, row),
    });

    revalidatePublicContent({});
    return ok({ id });
  } catch {
    return fail("server_error");
  }
}

// ── Capabilities ────────────────────────────────────────────────────────────

export async function saveSkillCategory(
  input: unknown,
  categoryId?: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = skillCategorySchema.safeParse(input);
  if (!parsed.success) return fail("validation", { fields: collectCvErrors(parsed.error) });

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const row = {
      slug: data.slug,
      name_en: data.name_en,
      name_km: data.name_km ?? null,
      description_en: data.description_en ?? null,
      description_km: data.description_km ?? null,
      icon: data.icon ?? null,
      sort_order: data.sort_order,
      is_published: data.is_published,
    };

    let id = categoryId;

    if (categoryId) {
      const { error } = await supabase
        .from("skill_categories")
        .update(row)
        .eq("id", categoryId);
      if (error) return fromPostgresError(error);
    } else {
      const { data: created, error } = await supabase
        .from("skill_categories")
        .insert(row)
        .select("id")
        .single();
      if (error) return fromPostgresError(error);
      id = created.id;
    }

    if (!id) return fail("server_error");

    await writeAuditLog({
      action: "skill.updated",
      actor: auth.session,
      entityType: "skill_category",
      entityId: id,
      entityLabel: data.slug,
      summary: `${categoryId ? "Updated" : "Created"} capability group “${data.name_en}”.`,
    });

    revalidatePublicContent({});
    return ok({ id });
  } catch {
    return fail("server_error");
  }
}

export async function saveSkill(
  input: unknown,
  skillId?: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await checkPermission("editContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = skillSchema.safeParse(input);
  if (!parsed.success) return fail("validation", { fields: collectCvErrors(parsed.error) });

  const data = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const row = {
      category_id: data.category_id,
      slug: data.slug,
      name_en: data.name_en,
      name_km: data.name_km ?? null,
      description_en: data.description_en ?? null,
      description_km: data.description_km ?? null,
      sort_order: data.sort_order,
      is_published: data.is_published,
    };

    let id = skillId;

    if (skillId) {
      const { error } = await supabase.from("skills").update(row).eq("id", skillId);
      if (error) return fromPostgresError(error);
    } else {
      const { data: created, error } = await supabase
        .from("skills")
        .insert(row)
        .select("id")
        .single();
      if (error) return fromPostgresError(error);
      id = created.id;
    }

    if (!id) return fail("server_error");

    /*
     * Evidence links. This is what replaces a proficiency percentage: a capability
     * is demonstrated by the projects attached to it, and the public page renders
     * those as links.
     */
    await supabase.from("skill_project_links").delete().eq("skill_id", id);
    if (data.projectIds.length > 0) {
      await supabase.from("skill_project_links").insert(
        data.projectIds.map((projectId) => ({ skill_id: id, project_id: projectId })),
      );
    }

    await writeAuditLog({
      action: "skill.updated",
      actor: auth.session,
      entityType: "skill",
      entityId: id,
      entityLabel: data.slug,
      summary: `${skillId ? "Updated" : "Created"} capability “${data.name_en}” with ${data.projectIds.length} evidence link(s).`,
    });

    revalidatePublicContent({});
    return ok({ id });
  } catch {
    return fail("server_error");
  }
}

// ── Shared status / delete helpers ──────────────────────────────────────────

type CvTable = "education" | "experiences" | "testimonials";

export async function setCvStatus(
  table: CvTable,
  id: string,
  status: "draft" | "in_review" | "published" | "archived",
): Promise<ActionResult<void>> {
  const auth = await checkPermission("publishContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from(table)
      .select("slug, status")
      .eq("id", id)
      .maybeSingle();

    if (!existing) return fail("not_found");

    const { error } = await supabase.from(table).update({ status }).eq("id", id);
    // A testimonial without recorded consent is rejected by a trigger; surface the
    // reason rather than a generic failure.
    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action:
        table === "education"
          ? "education.updated"
          : table === "experiences"
            ? "experience.updated"
            : "testimonial.updated",
      actor: auth.session,
      entityType: table,
      entityId: id,
      entityLabel: existing.slug,
      summary: `Status changed from ${existing.status} to ${status}.`,
    });

    revalidatePublicContent({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function softDeleteCvEntry(
  table: CvTable,
  id: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from(table)
      .select("slug")
      .eq("id", id)
      .maybeSingle();

    if (!existing) return fail("not_found");

    const { error } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString(), status: "archived" })
      .eq("id", id);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action:
        table === "education"
          ? "education.updated"
          : table === "experiences"
            ? "experience.updated"
            : "testimonial.updated",
      actor: auth.session,
      entityType: table,
      entityId: id,
      entityLabel: existing.slug,
      summary: "Soft-deleted (recoverable).",
    });

    revalidatePublicContent({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function restoreCvEntry(
  table: CvTable,
  id: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from(table)
      .update({ deleted_at: null, status: "draft" })
      .eq("id", id);

    if (error) return fromPostgresError(error);

    revalidatePublicContent({});
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}
