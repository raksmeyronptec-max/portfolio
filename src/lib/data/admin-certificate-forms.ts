import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { locales } from "@/i18n/config";
import type { CertificateFormValues } from "@/components/admin/certificate-form";
import type { FormOption } from "./admin-forms";

/**
 * Option lists and record loading for the certificate editor.
 *
 * The two media lists are deliberately disjoint:
 *  - `previewOptions` = PUBLIC image assets, the only things eligible to be shown.
 *  - `originalOptions` = PRIVATE assets, the only things eligible to be an original.
 *
 * That separation is what stops an editor from accidentally attaching an
 * unredacted scan as the public preview. The database enforces the same rule with
 * a trigger; this just makes the mistake unavailable in the UI.
 */
export async function getCertificateFormOptions(): Promise<{
  categories: FormOption[];
  previewOptions: FormOption[];
  originalOptions: FormOption[];
  projectOptions: FormOption[];
}> {
  const empty = {
    categories: [],
    previewOptions: [],
    originalOptions: [],
    projectOptions: [],
  };

  if (!isSupabaseConfigured()) return empty;

  try {
    const supabase = await createSupabaseServerClient();

    const [categories, previews, originals, projects] = await Promise.all([
      supabase
        .from("certificate_categories")
        .select("id, name_en, sort_order")
        .order("sort_order", { ascending: true }),

      supabase
        .from("media_assets")
        .select("id, original_filename, alt_text_en, kind, width, height")
        .eq("visibility", "public")
        .neq("mime_type", "application/pdf")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),

      supabase
        .from("media_assets")
        .select("id, original_filename, kind, mime_type, file_size_bytes")
        .eq("visibility", "private")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),

      supabase
        .from("projects")
        .select("id, slug, project_translations(locale, title)")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true }),
    ]);

    return {
      categories: (categories.data ?? []).map((row) => ({
        id: row.id,
        label: row.name_en,
      })),

      previewOptions: (previews.data ?? []).map((row) => ({
        id: row.id,
        label: [
          row.alt_text_en || row.original_filename,
          row.width && row.height ? `${row.width}×${row.height}` : null,
        ]
          .filter(Boolean)
          .join(" — "),
      })),

      originalOptions: (originals.data ?? []).map((row) => ({
        id: row.id,
        label: `${row.original_filename} (${formatBytes(row.file_size_bytes)})`,
      })),

      projectOptions: (
        (projects.data ?? []) as unknown as Array<{
          id: string;
          slug: string;
          project_translations: Array<{ locale: string; title: string }>;
        }>
      ).map((row) => ({
        id: row.id,
        label:
          row.project_translations.find((item) => item.locale === "en")?.title ??
          row.slug,
      })),
    };
  } catch {
    return empty;
  }
}

export function emptyCertificateFormValues(): CertificateFormValues {
  return {
    slug: "",
    internal_ref: null,
    category_id: null,
    status: "draft",
    credential_status: "unverified",
    featured: false,
    sort_order: 0,
    issuer_en: "",
    issuer_km: null,
    issuer_url: null,
    issued_on: null,
    expires_on: null,
    credential_id: null,
    verification_url: null,
    preview_media_id: null,
    original_media_id: null,
    og_image_media_id: null,
    allow_public_download: false,
    // Assume sensitive until a human says otherwise. The safe default for a
    // document nobody has looked at yet.
    contains_sensitive_data: true,
    privacy_review_note: null,
    privacy_review_confirmed: false,
    needs_review: false,
    review_note: null,
    skills: [],
    relatedProjectIds: [],
    privacyReviewedAt: null,
    translations: locales.map((locale) => ({
      locale,
      title: "",
      description: null,
      image_summary: null,
      seo_title: null,
      seo_description: null,
    })),
  };
}

export async function getCertificateFormValues(
  certificateId: string,
): Promise<CertificateFormValues | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("certificates")
      .select(
        `*, certificate_translations(*),
         certificate_skills(label_en, sort_order, evidence_kind),
         certificate_project_links(project_id)`,
      )
      .eq("id", certificateId)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as Record<string, unknown> & {
      certificate_translations: Array<Record<string, unknown>>;
      certificate_skills: Array<{
        label_en: string;
        sort_order: number;
        evidence_kind: string;
      }>;
      certificate_project_links: Array<{ project_id: string }>;
    };

    const base = emptyCertificateFormValues();

    const translations = base.translations.map((blank) => {
      const stored = row.certificate_translations.find(
        (item) => item.locale === blank.locale,
      );
      if (!stored) return blank;

      return {
        locale: blank.locale,
        title: (stored.title as string) ?? "",
        description: (stored.description as string | null) ?? null,
        image_summary: (stored.image_summary as string | null) ?? null,
        seo_title: (stored.seo_title as string | null) ?? null,
        seo_description: (stored.seo_description as string | null) ?? null,
      };
    });

    const privacyReviewedAt = (row.privacy_reviewed_at as string | null) ?? null;

    return {
      id: certificateId,
      slug: (row.slug as string) ?? "",
      internal_ref: (row.internal_ref as string | null) ?? null,
      category_id: (row.category_id as string | null) ?? null,
      status: row.status as CertificateFormValues["status"],
      credential_status: row.credential_status as CertificateFormValues["credential_status"],
      featured: Boolean(row.featured),
      sort_order: Number(row.sort_order ?? 0),
      issuer_en: (row.issuer_en as string) ?? "",
      issuer_km: (row.issuer_km as string | null) ?? null,
      issuer_url: (row.issuer_url as string | null) ?? null,
      issued_on: (row.issued_on as string | null) ?? null,
      expires_on: (row.expires_on as string | null) ?? null,
      credential_id: (row.credential_id as string | null) ?? null,
      verification_url: (row.verification_url as string | null) ?? null,
      preview_media_id: (row.preview_media_id as string | null) ?? null,
      original_media_id: (row.original_media_id as string | null) ?? null,
      og_image_media_id: (row.og_image_media_id as string | null) ?? null,
      allow_public_download: Boolean(row.allow_public_download),
      contains_sensitive_data: Boolean(row.contains_sensitive_data),
      privacy_review_note: (row.privacy_review_note as string | null) ?? null,
      // Reflects the stored state: an already-reviewed credential loads confirmed.
      privacy_review_confirmed: Boolean(privacyReviewedAt),
      privacyReviewedAt,
      needs_review: Boolean(row.needs_review),
      review_note: (row.review_note as string | null) ?? null,
      skills: row.certificate_skills
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((skill) => ({
          label: skill.label_en,
          confirms: skill.evidence_kind === "confirms",
        })),
      relatedProjectIds: row.certificate_project_links.map((link) => link.project_id),
      translations,
    };
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
