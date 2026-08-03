import "server-only";

import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_COLUMNS, type MediaAsset } from "@/lib/content/media";
import {
  pickLocalized,
  resolveTranslation,
  type TranslationRow,
} from "@/lib/content/translation";
import { localeMeta, type Locale } from "@/i18n/config";

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

/**
 * Is the qualification still in force? Nothing to do with whether anyone has
 * checked it is genuine — see `CredentialVerification`. Conflating the two is
 * what produced a live site where a permanent school diploma was labelled
 * "Active" with a green dot, which a visitor reads as "verified".
 */
export type CredentialValidity =
  | "valid"
  | "no_expiry"
  | "expired"
  | "revoked"
  | "unknown";

/** How well established it is that the credential is genuine, and by what route. */
export type CredentialVerification =
  | "verified_by_issuer"
  | "verification_link_available"
  | "manually_reviewed"
  | "awaiting_verification"
  | "issuer_verification_unavailable"
  | "unverified";

export type CertificateCardData = {
  id: string;
  slug: string;
  featured: boolean;
  credentialStatus: CredentialStatus;
  issuer: string;
  issuerUrl: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  /** Only present when the owner opted in; see `public_credential_id`. */
  publicCredentialId: string | null;
  validityStatus: CredentialValidity;
  verificationStatus: CredentialVerification;
  verifiedOn: string | null;
  showExactScore: boolean;
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
  /**
   * What the document itself evidences — completion, attendance, a grade.
   *
   * Kept separate from `relatedInterests` because merging them is how an
   * attendance certificate comes to imply an assessed competency. See
   * migration 0032.
   */
  confirms: Array<{ id: string; label: string }>;
  /** Topics the credential connects to but does not assess. */
  relatedInterests: Array<{ id: string; label: string }>;
  relatedProjects: Array<{ id: string; slug: string; title: string }>;
  seoTitle: string | null;
  seoDescription: string | null;
};

/**
 * Explicit column list. `original_media_id`, `privacy_review_note`,
 * `contains_sensitive_data`, `created_by` and `updated_by` are deliberately
 * absent — a public query has no business selecting them.
 *
 * `credential_id` is absent for a stronger reason: it is frequently an
 * examination or serial number, and on the published Bac II record it is a
 * 21-digit examination identifier that this query used to select and the detail
 * page used to render. `public_credential_id` is a generated column that is NULL
 * unless the owner explicitly opted in, so the private value is not in the
 * result set at all rather than being fetched and then remembered about.
 */
const CARD_SELECT = `
  id, slug, featured, credential_status, sort_order,
  issuer_en, issuer_km, issuer_url,
  issued_on, expires_on, public_credential_id, verification_url,
  validity_status, verification_status, verified_on, show_exact_score,
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
  public_credential_id: string | null;
  validity_status: CredentialValidity;
  verification_status: CredentialVerification;
  verified_on: string | null;
  show_exact_score: boolean;
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
    publicCredentialId: row.public_credential_id,
    validityStatus: row.validity_status,
    verificationStatus: row.verification_status,
    verifiedOn: row.verified_on,
    showExactScore: row.show_exact_score,
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

// ── Featured certificates ───────────────────────────────────────────────────

/**
 * How many credentials may carry the featured treatment.
 *
 * Eight of the ten published credentials are flagged `featured`, which makes the
 * flag say nothing: a badge on almost everything is a badge on nothing.
 *
 * The cap is applied when reading rather than by clearing the owner's flags,
 * because *which* credentials matter most is an editorial judgement that belongs
 * to them. This only limits how many can shout at once, and the order below —
 * `sort_order` then newest — is the lever they already have for choosing which.
 */
export const FEATURED_LIMIT = 3;


export async function getFeaturedCertificates(
  locale: Locale,
  limit: number = FEATURED_LIMIT,
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

/** Ceiling on the rows a search scans. See the note at the `range` call. */
const SEARCH_SCAN_CAP = 200;

export type CertificateSort =
  | "newest"
  | "oldest"
  | "title"
  | "verification";

export type CertificateFilters = {
  search?: string;
  category?: string;
  issuer?: string;
  year?: number;
  verification?: CredentialVerification;
  sort?: CertificateSort;
  page?: number;
  perPage?: number;
};

/**
 * Verification states ordered by how much they actually establish.
 *
 * Used by the `verification` sort. Deliberately explicit rather than the enum's
 * declaration order, so reordering the enum for any other reason cannot silently
 * change what a visitor sees first.
 */
const VERIFICATION_RANK: Record<CredentialVerification, number> = {
  verified_by_issuer: 0,
  verification_link_available: 1,
  manually_reviewed: 2,
  awaiting_verification: 3,
  issuer_verification_unavailable: 4,
  unverified: 5,
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

    let query = supabase.from("certificates").select(select, { count: "exact" });

    /*
     * Featured first is the default only for the default sort. When a visitor
     * has asked for "oldest" or "A–Z", promoting featured entries above the
     * order they requested silently ignores the request.
     */
    const sort = filters.sort ?? "newest";
    if (sort === "newest") {
      query = query
        .order("featured", { ascending: false })
        .order("issued_on", { ascending: false, nullsFirst: false })
        .order("sort_order", { ascending: true });
    } else if (sort === "oldest") {
      query = query.order("issued_on", { ascending: true, nullsFirst: false });
    } else if (sort === "verification") {
      // Ordered in the database by the enum's own order, then refined in memory
      // by VERIFICATION_RANK so the ranking is the documented one.
      query = query
        .order("verification_status", { ascending: true })
        .order("issued_on", { ascending: false, nullsFirst: false });
    } else {
      // Title lives in the translation table, so it is sorted in memory below.
      query = query.order("issued_on", { ascending: false, nullsFirst: false });
    }

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
    if (filters.verification) {
      query = query.eq("verification_status", filters.verification);
    }

    /*
     * A search has to see every candidate row, not one page of them, because the
     * matching happens after the fetch. The cap keeps that bounded: past it the
     * search would need to move into the database, and the cap is the signal
     * that the time has come rather than a silently truncated result.
     */
    const searching = Boolean(filters.search?.trim());
    const from = searching ? 0 : (page - 1) * perPage;
    const to = searching ? SEARCH_SCAN_CAP - 1 : from + perPage - 1;

    const { data, error, count } = await query.range(from, to);

    if (error || !data) return empty;

    let items = (data as unknown as RawCertificateRow[]).map((row) =>
      toCard(row, locale),
    );
    let total = count ?? items.length;

    /*
     * Two sorts finish in memory.
     *
     * `title` because the title lives in the translation table and is resolved
     * per locale, so the database cannot order by the string a visitor actually
     * reads. `localeCompare` with the active locale is what makes Khmer titles
     * sort as a Khmer reader expects rather than by code point.
     *
     * `verification` because the database can only order by the enum's
     * declaration order, and the ranking a visitor should see is "how much does
     * this actually establish" — which is VERIFICATION_RANK, stated once and
     * independent of how the enum happens to be declared.
     *
     * Both are only correct across the whole result set on a single page, which
     * is the case here: the collection is bounded and the page size is 12. A
     * larger collection would need this pushed into the query.
     */
    if (sort === "title") {
      items = items
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title, localeMeta[locale].intlLocale));
    } else if (sort === "verification") {
      items = items
        .slice()
        .sort(
          (a, b) =>
            VERIFICATION_RANK[a.verificationStatus] -
            VERIFICATION_RANK[b.verificationStatus],
        );
    }

    /*
     * Search runs in memory, and the query above deliberately fetched an
     * unpaginated page when a term is present — see `searching` below.
     *
     * It used to run here on the already-paginated slice, which meant a search
     * only ever examined the twelve rows the current page happened to hold. With
     * ten published credentials that was invisible; it would have surfaced as
     * "search finds nothing on page 2" the moment the collection grew.
     *
     * The text being searched lives in the translation table, so a SQL filter
     * would need an OR across an embedded resource and a top-level column, which
     * PostgREST cannot express. The collection is bounded (see SEARCH_SCAN_CAP)
     * and this only runs when someone actually types, so the trade is worth it.
     */
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

      // Paginate after filtering, not before.
      const start = (page - 1) * perPage;
      items = items.slice(start, start + perPage);
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
         certificate_skills(id, label_en, label_km, sort_order, evidence_kind),
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
        evidence_kind: "confirms" | "related_interest";
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
      confirms: toSkillList(row.certificate_skills, "confirms", locale),
      relatedInterests: toSkillList(row.certificate_skills, "related_interest", locale),
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

/**
 * Categories, each carrying how many published credentials it actually holds.
 *
 * The count is the point. The page previously offered all twelve categories as
 * filter chips regardless of whether any of them could return a result, so a
 * visitor was invited to filter by "Competition" and "Volunteer Certificate"
 * when the collection contained neither — twelve buttons, most of them dead
 * ends, above a grid of ten credentials.
 *
 * Counting here rather than in the page keeps the number and the label together:
 * a hardcoded count is a number that goes stale the first time a credential is
 * published, and the brief was explicit that counts must come from the data.
 */
export async function getCertificateCategories(
  locale: Locale,
): Promise<
  Array<{ id: string; slug: string; name: string; icon: string | null; count: number }>
> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();

    const [{ data, error }, { data: published }] = await Promise.all([
      supabase
        .from("certificate_categories")
        .select("id, slug, name_en, name_km, icon, sort_order")
        .order("sort_order", { ascending: true }),
      // RLS restricts this to published, non-deleted rows, so the tally is the
      // public count without needing to restate the visibility rule here.
      supabase.from("certificates").select("category_id"),
    ]);

    if (error || !data) return [];

    const counts = new Map<string, number>();
    for (const row of published ?? []) {
      if (!row.category_id) continue;
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }

    return data.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: pickLocalized(locale, row.name_en, row.name_km) ?? row.slug,
      icon: row.icon,
      count: counts.get(row.id) ?? 0,
    }));
  } catch {
    return [];
  }
}

/** Issuers and years that actually occur in published credentials. */
export async function getCertificateFacets(): Promise<{
  issuers: string[];
  years: number[];
  verifications: CredentialVerification[];
}> {
  const empty = { issuers: [], years: [], verifications: [] };
  if (!isSupabaseConfigured()) return empty;

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("certificates")
      .select("issuer_en, issued_on, verification_status");

    if (error || !data) return empty;

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

    /*
     * Only states that actually occur. Offering "Verified by issuer" as a filter
     * when nothing is verified sends a visitor to an empty result and implies
     * the collection contains something it does not.
     */
    const verifications = [
      ...new Set(
        data.map((row) => row.verification_status as CredentialVerification),
      ),
    ].sort((a, b) => VERIFICATION_RANK[a] - VERIFICATION_RANK[b]);

    return { issuers, years, verifications };
  } catch {
    return empty;
  }
}

/**
 * The credentials either side of this one.
 *
 * Ordered exactly as the default listing is — featured first, then newest — so
 * "next" means the card that followed the one the visitor clicked. Ordering
 * these by anything else produces navigation that disagrees with the page the
 * visitor just came from, which reads as a bug even when each page is
 * internally consistent.
 *
 * Draft and deleted credentials cannot appear: the query is RLS-constrained, so
 * an unpublished neighbour is simply not in the list rather than being a link
 * that 404s.
 */
export async function getCertificateNeighbours(
  slug: string,
  locale: Locale,
): Promise<{
  previous: CertificateCardData | null;
  next: CertificateCardData | null;
}> {
  const none = { previous: null, next: null };

  // One page wide enough to hold the whole published collection. If it ever
  // stops being, this returns no neighbours at the boundary rather than wrong
  // ones.
  const { items } = await listCertificates(locale, { perPage: 48 });
  const index = items.findIndex((item) => item.slug === slug);
  if (index === -1) return none;

  return {
    previous: items[index - 1] ?? null,
    next: items[index + 1] ?? null,
  };
}

/** One evidence group, sorted and localised. */
function toSkillList(
  skills: Array<{
    id: string;
    label_en: string;
    label_km: string | null;
    sort_order: number;
    evidence_kind: "confirms" | "related_interest";
  }>,
  kind: "confirms" | "related_interest",
  locale: Locale,
): Array<{ id: string; label: string }> {
  return skills
    .filter((skill) => skill.evidence_kind === kind)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((skill) => ({
      id: skill.id,
      label: pickLocalized(locale, skill.label_en, skill.label_km) ?? skill.label_en,
    }));
}

/** Narrow a query-string value to a verification state. */
export function isCredentialVerification(
  value: string,
): value is CredentialVerification {
  return value in VERIFICATION_RANK;
}

/** Narrow a query-string value to a sort option. */
export function isCertificateSort(value: string): value is CertificateSort {
  return ["newest", "oldest", "title", "verification"].includes(value);
}
