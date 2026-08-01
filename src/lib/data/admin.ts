import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_COLUMNS, type MediaAsset } from "@/lib/content/media";
import { missingLocales, translationStatus } from "@/lib/content/translation";
import { isMediaKind, type MediaKind } from "@/lib/media/kinds";
import type { Locale } from "@/i18n/config";

/**
 * Admin data access.
 *
 * Every read here goes through the RLS-constrained server client, not the
 * service-role client. That means the admin UI is subject to exactly the same
 * policies as anything else: a viewer literally cannot fetch a row they may not
 * see, so a missing UI guard cannot become a data leak.
 *
 * The service-role client is reserved for the four operations RLS forbids everyone
 * (audit writes, signed URLs for private originals, role lookup, contact triage
 * columns).
 */

export type PublicationStatus = "draft" | "in_review" | "published" | "archived";

// ── Sidebar badges ──────────────────────────────────────────────────────────

export async function getAdminBadgeCounts(): Promise<{
  unreadMessages: number;
  pendingPrivacyReviews: number;
  pendingJourneyReviews: number;
  pendingPublicationReviews: number;
}> {
  const empty = {
    unreadMessages: 0,
    pendingPrivacyReviews: 0,
    pendingJourneyReviews: 0,
    pendingPublicationReviews: 0,
  };

  if (!isSupabaseConfigured()) return empty;

  try {
    const supabase = await createSupabaseServerClient();

    const [messages, certificates, journeyMedia, publications] = await Promise.all([
      supabase
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("state", "unread")
        .is("deleted_at", null),
      supabase
        .from("certificates")
        .select("id", { count: "exact", head: true })
        .is("privacy_reviewed_at", null)
        .is("deleted_at", null),
      // Journey photographs and video still awaiting a privacy decision. This is
      // the queue that blocks publication, so it is the one worth a badge.
      supabase
        .from("journey_media")
        .select("id", { count: "exact", head: true })
        .eq("privacy_status", "pending_review")
        .is("deleted_at", null),
      // Publications still awaiting a privacy decision. Same rule again: this is
      // the queue that blocks publication, so it is the one worth a badge.
      supabase
        .from("publications")
        .select("id", { count: "exact", head: true })
        .eq("privacy_status", "pending_review")
        .is("deleted_at", null),
    ]);

    return {
      unreadMessages: messages.count ?? 0,
      pendingPrivacyReviews: certificates.count ?? 0,
      pendingJourneyReviews: journeyMedia.count ?? 0,
      pendingPublicationReviews: publications.count ?? 0,
    };
  } catch {
    return empty;
  }
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export type DashboardSummary = {
  projects: {
    published: number;
    draft: number;
    in_review: number;
    archived: number;
    deleted: number;
  };
  certificates: {
    published: number;
    draft: number;
    in_review: number;
    archived: number;
    awaiting_privacy_review: number;
  };
  messages: { unread: number; total: number; starred: number; spam: number };
  resume: {
    downloads_total: number;
    downloads_30d: number;
    versions: number;
    active_locales: string[];
  };
  traffic: {
    page_views_total: number;
    page_views_30d: number;
    page_views_7d: number;
    unique_visitors_30d: number;
  };
  storage: {
    assets: number;
    bytes_total: number;
    bytes_public: number;
    bytes_private: number;
  };
};

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_dashboard_summary");
    if (error || !data) return null;
    return data as unknown as DashboardSummary;
  } catch {
    return null;
  }
}

export type ContentHealth = {
  missing_translations: Array<{
    entity_type: string;
    entity_id: string;
    slug: string;
    has_en: boolean;
    has_km: boolean;
  }>;
  media_missing_alt_text: Array<{ id: string; filename: string; kind: string }>;
  missing_seo_description: Array<{
    entity_type: string;
    entity_id: string;
    slug: string;
    locale: string;
  }>;
  projects_without_case_study: Array<{ id: string; slug: string; status: string }>;
  certificates_awaiting_privacy_review: Array<{
    id: string;
    slug: string;
    issuer: string;
    status: string;
  }>;
  certificates_missing_verification: Array<{
    id: string;
    slug: string;
    issuer: string;
  }>;
  content_needing_review: Array<{ entity_type: string; id: string; slug: string }>;
  stale_drafts: Array<{
    entity_type: string;
    id: string;
    slug: string;
    updated_at: string;
  }>;
  oversized_media: Array<{
    id: string;
    filename: string;
    bytes: number;
    kind: string;
  }>;
  unverified_metrics: Array<{ project_slug: string; label: string; value: string }>;
  external_links: Array<{ entity_type: string; slug: string; url: string }>;
};

export async function getContentHealth(): Promise<ContentHealth | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_content_health");
    if (error || !data) return null;
    return data as unknown as ContentHealth;
  } catch {
    return null;
  }
}

export type AdminInsights = {
  window_days: number;
  most_viewed_projects: Array<{ slug: string; views: number }>;
  most_viewed_certificates: Array<{ slug: string; views: number }>;
  most_clicked_outbound: Array<{ host: string; context: string; clicks: number }>;
  traffic_by_locale: Record<string, number>;
  traffic_by_device: Record<string, number>;
  top_referrers: Array<{ host: string; views: number }>;
  daily_page_views: Array<{ day: string; views: number }>;
  recent_resume_downloads: Array<{
    label: string | null;
    locale: string | null;
    at: string;
  }>;
  contact_conversion: { submissions: number; contact_page_views: number };
};

export async function getAdminInsights(days = 30): Promise<AdminInsights | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_insights", { p_days: days });
    if (error || !data) return null;
    return data as unknown as AdminInsights;
  } catch {
    return null;
  }
}

// ── Recent activity ─────────────────────────────────────────────────────────

export type AuditEntryRow = {
  id: number;
  action: string;
  actorEmail: string | null;
  actorRole: string | null;
  entityType: string | null;
  entityLabel: string | null;
  summary: string | null;
  occurredAt: string;
};

export async function getRecentActivity(limit = 12): Promise<AuditEntryRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select(
        "id, action, actor_email, actor_role, entity_type, entity_label, summary, occurred_at",
      )
      .order("occurred_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      action: row.action,
      actorEmail: row.actor_email,
      actorRole: row.actor_role,
      entityType: row.entity_type,
      entityLabel: row.entity_label,
      summary: row.summary,
      occurredAt: row.occurred_at,
    }));
  } catch {
    return [];
  }
}

export type AuditLogPage = {
  items: AuditEntryRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export async function listAuditLogs(options: {
  page?: number;
  perPage?: number;
  action?: string;
}): Promise<AuditLogPage> {
  const perPage = Math.min(Math.max(options.perPage ?? 40, 1), 200);
  const page = Math.max(options.page ?? 1, 1);
  const empty: AuditLogPage = { items: [], total: 0, page, perPage, totalPages: 0 };

  if (!isSupabaseConfigured()) return empty;

  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("audit_logs")
      .select(
        "id, action, actor_email, actor_role, entity_type, entity_label, summary, occurred_at",
        { count: "exact" },
      )
      .order("occurred_at", { ascending: false });

    if (options.action) query = query.eq("action", options.action);

    const from = (page - 1) * perPage;
    const { data, error, count } = await query.range(from, from + perPage - 1);

    if (error || !data) return empty;

    const total = count ?? data.length;

    return {
      items: data.map((row) => ({
        id: row.id,
        action: row.action,
        actorEmail: row.actor_email,
        actorRole: row.actor_role,
        entityType: row.entity_type,
        entityLabel: row.entity_label,
        summary: row.summary,
        occurredAt: row.occurred_at,
      })),
      total,
      page,
      perPage,
      totalPages: Math.max(Math.ceil(total / perPage), 1),
    };
  } catch {
    return empty;
  }
}

// ── Admin project list ──────────────────────────────────────────────────────

export type AdminProjectRow = {
  id: string;
  slug: string;
  status: PublicationStatus;
  projectStatus: string;
  featured: boolean;
  sortOrder: number;
  needsReview: boolean;
  reviewNote: string | null;
  liveUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
  deletedAt: string | null;
  titleEn: string | null;
  titleKm: string | null;
  translationStatus: "complete" | "partial" | "missing";
  missingLocales: Locale[];
  hasCaseStudy: boolean;
  cover: MediaAsset | null;
};

export async function listAdminProjects(options: {
  status?: PublicationStatus | "all" | "deleted";
  search?: string;
} = {}): Promise<AdminProjectRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("projects")
      .select(
        `id, slug, status, project_status, featured, sort_order, needs_review, review_note,
         live_url, published_at, updated_at, deleted_at,
         cover:media_assets!projects_cover_media_id_fkey(${MEDIA_COLUMNS}),
         project_translations(locale, title, overview, problem, solution)`,
      )
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false });

    // Soft-deleted rows are hidden unless explicitly requested, so "deleted" is a
    // deliberate view rather than something you stumble into.
    if (options.status === "deleted") {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
      if (options.status && options.status !== "all") {
        query = query.eq("status", options.status);
      }
    }

    const { data, error } = await query;
    if (error || !data) return [];

    type Row = {
      id: string;
      slug: string;
      status: PublicationStatus;
      project_status: string;
      featured: boolean;
      sort_order: number;
      needs_review: boolean;
      review_note: string | null;
      live_url: string | null;
      published_at: string | null;
      updated_at: string;
      deleted_at: string | null;
      cover: MediaAsset | null;
      project_translations: Array<{
        locale: string;
        title: string;
        overview: string | null;
        problem: string | null;
        solution: string | null;
      }>;
    };

    const rows = data as unknown as Row[];

    const mapped = rows.map((row) => {
      const translations = row.project_translations ?? [];
      const en = translations.find((item) => item.locale === "en");
      const km = translations.find((item) => item.locale === "km");

      return {
        id: row.id,
        slug: row.slug,
        status: row.status,
        projectStatus: row.project_status,
        featured: row.featured,
        sortOrder: row.sort_order,
        needsReview: row.needs_review,
        reviewNote: row.review_note,
        liveUrl: row.live_url,
        publishedAt: row.published_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
        titleEn: en?.title ?? null,
        titleKm: km?.title ?? null,
        translationStatus: translationStatus(translations),
        missingLocales: missingLocales(translations),
        // "Has a case study" means the three sections that make a page worth
        // publishing are all present, not merely that a row exists.
        hasCaseStudy: translations.some(
          (item) =>
            Boolean(item.overview?.trim()) &&
            Boolean(item.problem?.trim()) &&
            Boolean(item.solution?.trim()),
        ),
        cover: row.cover,
      } satisfies AdminProjectRow;
    });

    const term = options.search?.trim().toLowerCase();
    if (!term) return mapped;

    return mapped.filter((row) =>
      [row.slug, row.titleEn, row.titleKm]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  } catch {
    return [];
  }
}

// ── Admin certificate list ──────────────────────────────────────────────────

export type AdminCertificateRow = {
  id: string;
  slug: string;
  status: PublicationStatus;
  credentialStatus: string;
  featured: boolean;
  issuer: string;
  issuedOn: string | null;
  categoryName: string | null;
  privacyReviewedAt: string | null;
  containsSensitiveData: boolean;
  allowPublicDownload: boolean;
  hasPreview: boolean;
  hasOriginal: boolean;
  verificationUrl: string | null;
  credentialId: string | null;
  updatedAt: string;
  deletedAt: string | null;
  titleEn: string | null;
  titleKm: string | null;
  translationStatus: "complete" | "partial" | "missing";
  preview: MediaAsset | null;
};

export async function listAdminCertificates(options: {
  status?: PublicationStatus | "all" | "deleted";
  search?: string;
  needsPrivacyReview?: boolean;
} = {}): Promise<AdminCertificateRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("certificates")
      .select(
        `id, slug, status, credential_status, featured, issuer_en, issuer_km, issued_on,
         privacy_reviewed_at, contains_sensitive_data, allow_public_download,
         preview_media_id, original_media_id, verification_url, credential_id,
         updated_at, deleted_at,
         category:certificate_categories(name_en),
         preview:media_assets!certificates_preview_media_id_fkey(${MEDIA_COLUMNS}),
         certificate_translations(locale, title)`,
      )
      .order("sort_order", { ascending: true })
      .order("issued_on", { ascending: false, nullsFirst: false });

    if (options.status === "deleted") {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
      if (options.status && options.status !== "all") {
        query = query.eq("status", options.status);
      }
    }

    if (options.needsPrivacyReview) {
      query = query.is("privacy_reviewed_at", null);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    type Row = {
      id: string;
      slug: string;
      status: PublicationStatus;
      credential_status: string;
      featured: boolean;
      issuer_en: string;
      issuer_km: string | null;
      issued_on: string | null;
      privacy_reviewed_at: string | null;
      contains_sensitive_data: boolean;
      allow_public_download: boolean;
      preview_media_id: string | null;
      original_media_id: string | null;
      verification_url: string | null;
      credential_id: string | null;
      updated_at: string;
      deleted_at: string | null;
      category: { name_en: string } | null;
      preview: MediaAsset | null;
      certificate_translations: Array<{ locale: string; title: string }>;
    };

    const rows = data as unknown as Row[];

    const mapped = rows.map((row) => {
      const translations = row.certificate_translations ?? [];

      return {
        id: row.id,
        slug: row.slug,
        status: row.status,
        credentialStatus: row.credential_status,
        featured: row.featured,
        issuer: row.issuer_en,
        issuedOn: row.issued_on,
        categoryName: row.category?.name_en ?? null,
        privacyReviewedAt: row.privacy_reviewed_at,
        containsSensitiveData: row.contains_sensitive_data,
        allowPublicDownload: row.allow_public_download,
        hasPreview: Boolean(row.preview_media_id),
        hasOriginal: Boolean(row.original_media_id),
        verificationUrl: row.verification_url,
        credentialId: row.credential_id,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
        titleEn: translations.find((item) => item.locale === "en")?.title ?? null,
        titleKm: translations.find((item) => item.locale === "km")?.title ?? null,
        translationStatus: translationStatus(translations),
        preview: row.preview,
      } satisfies AdminCertificateRow;
    });

    const term = options.search?.trim().toLowerCase();
    if (!term) return mapped;

    return mapped.filter((row) =>
      [row.slug, row.titleEn, row.titleKm, row.issuer]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  } catch {
    return [];
  }
}

// ── Messages ────────────────────────────────────────────────────────────────

export type AdminMessageRow = {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  subject: string | null;
  message: string;
  projectType: string | null;
  preferredContact: string | null;
  locale: string;
  state: "unread" | "read" | "archived" | "spam";
  isStarred: boolean;
  spamScore: number;
  notificationSent: boolean;
  notificationError: string | null;
  consentGiven: boolean;
  createdAt: string;
  readAt: string | null;
  repliedAt: string | null;
};

export async function listAdminMessages(options: {
  state?: AdminMessageRow["state"] | "all" | "starred";
  search?: string;
} = {}): Promise<AdminMessageRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("contact_messages")
      .select(
        `id, name, email, organization, subject, message, project_type, preferred_contact,
         locale, state, is_starred, spam_score, notification_sent, notification_error,
         consent_given, created_at, read_at, replied_at`,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);

    if (options.state === "starred") {
      query = query.eq("is_starred", true);
    } else if (options.state && options.state !== "all") {
      query = query.eq("state", options.state);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const mapped = data.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      organization: row.organization,
      subject: row.subject,
      message: row.message,
      projectType: row.project_type,
      preferredContact: row.preferred_contact,
      locale: row.locale,
      state: row.state,
      isStarred: row.is_starred,
      spamScore: row.spam_score,
      notificationSent: row.notification_sent,
      notificationError: row.notification_error,
      consentGiven: row.consent_given,
      createdAt: row.created_at,
      readAt: row.read_at,
      repliedAt: row.replied_at,
    })) as AdminMessageRow[];

    const term = options.search?.trim().toLowerCase();
    if (!term) return mapped;

    return mapped.filter((row) =>
      [row.name, row.email, row.subject, row.organization, row.message]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  } catch {
    return [];
  }
}

// ── Media library ───────────────────────────────────────────────────────────

export type AdminMediaRow = MediaAsset & {
  kind: string;
  original_filename: string;
  created_at: string;
  requires_privacy_review: boolean;
  /** Number of content rows referencing this asset. */
  usageCount: number;
  /**
   * English role titles of the experience entries displaying this asset.
   *
   * Named rather than counted: "used by 2 things" is not actionable, and the
   * question an admin actually has before deleting a photograph is *which*
   * entry would lose it.
   */
  usedByExperiences: string[];
  /** English titles of the journey stories currently using this asset. */
  usedByJourney: string[];
};

export async function listAdminMedia(options: {
  kind?: string;
  visibility?: "public" | "private";
  search?: string;
} = {}): Promise<AdminMediaRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("media_assets")
      .select(
        `${MEDIA_COLUMNS}, kind, original_filename, created_at, requires_privacy_review,
         project_cover:projects!projects_cover_media_id_fkey(id),
         project_media(id),
         certificate_preview:certificates!certificates_preview_media_id_fkey(id),
         certificate_original:certificates!certificates_original_media_id_fkey(id),
         resume_versions(id),
         experience_media(id, deleted_at, experiences(slug, experience_translations(locale, role_title))),
         journey_media(id, deleted_at, journey_entries(slug, journey_entry_translations(locale, title)))`,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);

    // `kind` arrives from a query string, so it is narrowed against the enum
    // rather than trusted. An unknown value simply applies no filter.
    if (options.kind && isMediaKind(options.kind)) {
      query = query.eq("kind", options.kind as MediaKind);
    }
    if (options.visibility) query = query.eq("visibility", options.visibility);

    const { data, error } = await query;
    if (error || !data) return [];

    const mapped = (data as unknown as Array<
      MediaAsset & {
        kind: string;
        original_filename: string;
        created_at: string;
        requires_privacy_review: boolean;
        project_cover: Array<{ id: string }> | null;
        project_media: Array<{ id: string }> | null;
        certificate_preview: Array<{ id: string }> | null;
        certificate_original: Array<{ id: string }> | null;
        resume_versions: Array<{ id: string }> | null;
        experience_media: Array<{
          id: string;
          deleted_at: string | null;
          experiences: {
            slug: string;
            experience_translations: Array<{ locale: string; role_title: string }>;
          } | null;
        }> | null;
        journey_media: Array<{
          id: string;
          deleted_at: string | null;
          journey_entries: {
            slug: string;
            journey_entry_translations: Array<{ locale: string; title: string }>;
          } | null;
        }> | null;
      }
    >).map((row) => {
      // Detached attachments are history, not usage — they must not make an
      // asset look in use, and they do not block deleting it.
      const liveExperienceUses = (row.experience_media ?? []).filter(
        (item) => item.deleted_at === null,
      );
      const liveJourneyUses = (row.journey_media ?? []).filter(
        (item) => item.deleted_at === null,
      );

      const usageCount =
        (row.project_cover?.length ?? 0) +
        (row.project_media?.length ?? 0) +
        (row.certificate_preview?.length ?? 0) +
        (row.certificate_original?.length ?? 0) +
        (row.resume_versions?.length ?? 0) +
        liveExperienceUses.length +
        liveJourneyUses.length;

      return {
        ...row,
        usageCount,
        usedByExperiences: [
          ...new Set(
            liveExperienceUses.map(
              (item) =>
                item.experiences?.experience_translations.find(
                  (translation) => translation.locale === "en",
                )?.role_title ??
                item.experiences?.slug ??
                "an experience entry",
            ),
          ),
        ],
        usedByJourney: [
          ...new Set(
            liveJourneyUses.map(
              (item) =>
                item.journey_entries?.journey_entry_translations.find(
                  (translation) => translation.locale === "en",
                )?.title ??
                item.journey_entries?.slug ??
                "a journey story",
            ),
          ),
        ],
      } as AdminMediaRow;
    });

    const term = options.search?.trim().toLowerCase();
    if (!term) return mapped;

    return mapped.filter((row) =>
      [row.original_filename, row.alt_text_en, row.alt_text_km, row.caption_en]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  } catch {
    return [];
  }
}
