import "server-only";

import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_COLUMNS, type MediaAsset } from "@/lib/content/media";
import {
  pickLocalized,
  resolveTranslation,
  type TranslationRow,
} from "@/lib/content/translation";
import type { Locale } from "@/i18n/config";

/**
 * Public certificate queries.
 *
 * Privacy contract, enforced in three independent places:
 *
 *   1. The column list below never mentions `original_media_id`, so a private
 *      scan's identifier is not even fetched.
 *   2. RLS hides the `media_assets` row for any private asset from anonymous
 *      readers, so its storage path cannot be discovered.
 *   3. The `certificate-originals` storage bucket has no anonymous policy at all.
 *
 * The public site therefore renders only the redacted preview. The original is
 * reachable exclusively through an owner-authenticated route handler that mints a
 * short-lived signed URL and writes an audit-log entry.
 */

export type CredentialStatus = "active" | "expired" | "revoked" | "unverified";

type CertificateTranslationRow = TranslationRow & {
  title: string;
  description: string | null;
  image_summary: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export type CertificateCardData = {
  id: string;
  slug: string;
  featured: boolean;
  credentialStatus: CredentialStatus;
  issuer: string;
  issuerUrl: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  credentialId: string | null;
  verificationUrl: string | null;
  allowPublicDownload: boolean;
  preview: MediaAsset | null;
  category: { id: string; slug: string; name: string; icon: string | null } | null;
  title: string;
  description: string | null;
  contentLocale: Locale | null;
  isTranslationFallback: boolean;
};

export type CertificateDetailData = CertificateCardData & {
  imageSummary: string | null;
  ogImage: MediaAsset | null;
  publishedAt: string | null;
  updatedAt: string;
  skills: Array<{ id: string; label: string }>;
  relatedProjects: Array<{ id: string; slug: string; title: string }>;
  seoTitle: string | null;
  seoDescription: string | null;
};

/**
 * Explicit column list. `original_media_id`, `privacy_review_note`,
 * `contains_sensitive_data`, `created_by` and `updated_by` are deliberately
 * absent — a public query has no business selecting them.
 */
const CARD_SELECT = `
  id, slug, featured, credential_status, sort_order,
  issuer_en, issuer_km, issuer_url,
  issued_on, expires_on, credential_id, verification_url,
  allow_public_download, published_at,
  preview:media_assets!certificates_preview_media_id_fkey(${MEDIA_COLUMNS}),
  category:certificate_categories(id, slug, name_en, name_km, icon),
  certificate_translations(locale, title, description)
`;

type RawCertificateRow = {
  id: string;
  slug: string;
  featured: boolean;
  credential_status: CredentialStatus;
  issuer_en: string;
  issuer_km: string | null;
  issuer_url: string | null;
  issued_on: string | null;
  expires_on: string | null;
  credential_id: string | null;
  verification_url: string | null;
  allow_public_download: boolean;
  published_at: string | null;
  preview: MediaAsset | null;
  category: {
    id: string;
    slug: string;
    name_en: string;
    name_km: string | null;
    icon: string | null;
  } | null;
  certificate_translations: Array<
    TranslationRow & { title: string; description: string | null }
  >;
};

function toCard(row: RawCertificateRow, locale: Locale): CertificateCardData {
  const { row: translation, actualLocale, isFallback } = resolveTranslation(
    row.certificate_translations,
    locale,
  );

  return {
    id: row.id,
    slug: row.slug,
    featured: row.featured,
    credentialStatus: row.credential_status,
    issuer: pickLocalized(locale, row.issuer_en, row.issuer_km) ?? row.issuer_en,
    issuerUrl: row.issuer_url,
    issuedOn: row.issued_on,
    expiresOn: row.expires_on,
    credentialId: row.credential_id,
    verificationUrl: row.verification_url,
    allowPublicDownload: row.allow_public_download,
    preview: row.preview,
    category: row.category
      ? {
          id: row.category.id,
          slug: row.category.slug,
          name:
            pickLocalized(locale, row.category.name_en, row.category.name_km) ??
            row.category.slug,
          icon: row.category.icon,
        }
      : null,
    title: translation?.title ?? row.slug,
    description: translation?.description ?? null,
    contentLocale: actualLocale,
    isTranslationFallback: isFallback,
  };
}

// ── Featured certificates (homepage) ────────────────────────────────────────

export async function getFeaturedCertificates(
  locale: Locale,
  limit = 4,
): Promise<CertificateCardData[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("certificates")
      .select(CARD_SELECT)
      .eq("featured", true)
      .order("sort_order", { ascending: true })
      .order("issued_on", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error || !data) return [];
    return (data as unknown as RawCertificateRow[]).map((row) => toCard(row, locale));
  } catch {
    return [];
  }
}

// ── Certificate list ────────────────────────────────────────────────────────

export type CertificateFilters = {
  search?: string;
  category?: string;
  issuer?: string;
  year?: number;
  page?: number;
  perPage?: number;
};

export type CertificateListResult = {
  items: CertificateCardData[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export async function listCertificates(
  locale: Locale,
  filters: CertificateFilters = {},
): Promise<CertificateListResult> {
  const perPage = Math.min(Math.max(filters.perPage ?? 12, 1), 48);
  const page = Math.max(filters.page ?? 1, 1);

  const empty: CertificateListResult = {
    items: [],
    total: 0,
    page,
    perPage,
    totalPages: 0,
  };

  if (!isSupabaseConfigured()) return empty;

  try {
    const supabase = await createSupabasePublicClient();

    const select = filters.category
      ? `${CARD_SELECT},category_filter:certificate_categories!inner(slug)`
      : CARD_SELECT;

    let query = supabase
      .from("certificates")
      .select(select, { count: "exact" })
      .order("featured", { ascending: false })
      .order("issued_on", { ascending: false, nullsFirst: false })
      .order("sort_order", { ascending: true });

    if (filters.category) {
      query = query.eq("category_filter.slug", filters.category);
    }
    if (filters.issuer) {
      query = query.eq("issuer_en", filters.issuer);
    }
    if (filters.year) {
      query = query
        .gte("issued_on", `${filters.year}-01-01`)
        .lte("issued_on", `${filters.year}-12-31`);
    }

    const from = (page - 1) * perPage;
    const { data, error, count } = await query.range(from, from + perPage - 1);

    if (error || !data) return empty;

    let items = (data as unknown as RawCertificateRow[]).map((row) =>
      toCard(row, locale),
    );
    let total = count ?? items.length;

    // Same rationale as the project search: the searchable text lives in the
    // translation table and the collection is small.
    const term = filters.search?.trim().toLowerCase();
    if (term) {
      items = items.filter((item) =>
        [item.title, item.description, item.issuer, item.category?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
      total = items.length;
    }

    return {
      items,
      total,
      page,
      perPage,
      totalPages: Math.max(Math.ceil(total / perPage), 1),
    };
  } catch {
    return empty;
  }
}

// ── Certificate detail ──────────────────────────────────────────────────────

export async function getCertificateBySlug(
  slug: string,
  locale: Locale,
): Promise<CertificateDetailData | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("certificates")
      .select(
        `${CARD_SELECT.replace(
          "certificate_translations(locale, title, description)",
          "certificate_translations(locale, title, description, image_summary, seo_title, seo_description)",
        )},
         updated_at,
         og_image:media_assets!certificates_og_image_media_id_fkey(${MEDIA_COLUMNS}),
         certificate_skills(id, label_en, label_km, sort_order),
         certificate_project_links(
           project:projects(id, slug, project_translations(locale, title))
         )`,
      )
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as RawCertificateRow & {
      updated_at: string;
      og_image: MediaAsset | null;
      certificate_translations: CertificateTranslationRow[];
      certificate_skills: Array<{
        id: string;
        label_en: string;
        label_km: string | null;
        sort_order: number;
      }>;
      certificate_project_links: Array<{
        project: {
          id: string;
          slug: string;
          project_translations: Array<TranslationRow & { title: string }>;
        } | null;
      }>;
    };

    const card = toCard(row, locale);
    const { row: translation } = resolveTranslation(
      row.certificate_translations,
      locale,
    );

    return {
      ...card,
      imageSummary: translation?.image_summary ?? null,
      ogImage: row.og_image,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      skills: row.certificate_skills
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((skill) => ({
          id: skill.id,
          label: pickLocalized(locale, skill.label_en, skill.label_km) ?? skill.label_en,
        })),
      // Only published projects survive RLS, so a credential linked to a draft
      // project simply shows no link rather than a dead one.
      relatedProjects: row.certificate_project_links
        .map((link) => link.project)
        .filter((project) => project !== null)
        .map((project) => {
          const { row: projectTranslation } = resolveTranslation(
            project.project_translations,
            locale,
          );
          return {
            id: project.id,
            slug: project.slug,
            title: projectTranslation?.title ?? project.slug,
          };
        }),
      seoTitle: translation?.seo_title ?? null,
      seoDescription: translation?.seo_description ?? null,
    };
  } catch {
    return null;
  }
}

export async function getPublishedCertificateSlugs(): Promise<
  Array<{ slug: string; updatedAt: string; publishedAt: string | null }>
> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("certificates")
      .select("slug, updated_at, published_at")
      .order("issued_on", { ascending: false, nullsFirst: false });

    if (error || !data) return [];

    return data.map((row) => ({
      slug: row.slug,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
    }));
  } catch {
    return [];
  }
}

// ── Filter options ──────────────────────────────────────────────────────────

export async function getCertificateCategories(
  locale: Locale,
): Promise<Array<{ id: string; slug: string; name: string; icon: string | null }>> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("certificate_categories")
      .select("id, slug, name_en, name_km, icon, sort_order")
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: pickLocalized(locale, row.name_en, row.name_km) ?? row.slug,
      icon: row.icon,
    }));
  } catch {
    return [];
  }
}

/** Issuers and years that actually occur in published credentials. */
export async function getCertificateFacets(): Promise<{
  issuers: string[];
  years: number[];
}> {
  if (!isSupabaseConfigured()) return { issuers: [], years: [] };

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("certificates")
      .select("issuer_en, issued_on");

    if (error || !data) return { issuers: [], years: [] };

    const issuers = [...new Set(data.map((row) => row.issuer_en))].sort((a, b) =>
      a.localeCompare(b),
    );

    const years = [
      ...new Set(
        data
          .map((row) => (row.issued_on ? new Date(row.issued_on).getFullYear() : null))
          .filter((year): year is number => year !== null && Number.isFinite(year)),
      ),
    ].sort((a, b) => b - a);

    return { issuers, years };
  } catch {
    return { issuers: [], years: [] };
  }
}
