import "server-only";

import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_COLUMNS, type MediaAsset } from "@/lib/content/media";
import { pickLocalized } from "@/lib/content/translation";
import type { Locale } from "@/i18n/config";

/**
 * Site-wide public data.
 *
 * Every function here is resilient by design: if Supabase is unconfigured or a
 * query fails, it returns a safe default rather than throwing. A misconfigured
 * database should degrade the page, not replace it with a stack trace.
 */

export type SiteSettings = {
  siteName: string;
  tagline: string | null;
  positioning: string | null;
  heroHeadline: string | null;
  heroSubheadline: string | null;
  availabilityStatus: string | null;
  isAvailableForWork: boolean;
  location: string | null;
  contactEmail: string | null;
  telegramHandle: string | null;
  facebookUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  contactFormEnabled: boolean;
  googleSiteVerification: string | null;
  analyticsEnabled: boolean;
};

const FALLBACK_SETTINGS: SiteSettings = {
  siteName: "Ron Raksmey",
  tagline: null,
  positioning: null,
  heroHeadline: null,
  heroSubheadline: null,
  availabilityStatus: null,
  isAvailableForWork: false,
  location: null,
  contactEmail: null,
  telegramHandle: null,
  facebookUrl: null,
  githubUrl: null,
  linkedinUrl: null,
  contactFormEnabled: true,
  googleSiteVerification: null,
  analyticsEnabled: true,
};

export async function getSiteSettings(locale: Locale): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) return FALLBACK_SETTINGS;

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (error || !data) return FALLBACK_SETTINGS;

    return {
      siteName:
        pickLocalized(locale, data.site_name_en, data.site_name_km) ??
        FALLBACK_SETTINGS.siteName,
      tagline: pickLocalized(locale, data.tagline_en, data.tagline_km),
      positioning: pickLocalized(locale, data.positioning_en, data.positioning_km),
      heroHeadline: pickLocalized(locale, data.hero_headline_en, data.hero_headline_km),
      heroSubheadline: pickLocalized(
        locale,
        data.hero_subheadline_en,
        data.hero_subheadline_km,
      ),
      availabilityStatus: pickLocalized(
        locale,
        data.availability_status_en,
        data.availability_status_km,
      ),
      isAvailableForWork: data.is_available_for_work,
      location: pickLocalized(locale, data.location_en, data.location_km),
      contactEmail: data.contact_email,
      telegramHandle: data.telegram_handle,
      facebookUrl: data.facebook_url,
      githubUrl: data.github_url,
      linkedinUrl: data.linkedin_url,
      contactFormEnabled: data.contact_form_enabled,
      googleSiteVerification: data.google_site_verification,
      analyticsEnabled: data.analytics_enabled,
    };
  } catch {
    return FALLBACK_SETTINGS;
  }
}

// ── Owner profile ───────────────────────────────────────────────────────────

export type OwnerProfile = {
  id: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
};

/**
 * Reads the `public_profile` view, not the `profiles` table.
 *
 * The view exposes only the deliberately public columns and anon has no
 * privilege on the underlying table at all, so this call cannot widen into
 * leaking an email address or a last-login timestamp.
 */
export async function getOwnerProfile(locale: Locale): Promise<OwnerProfile | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("public_profile")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error || !data?.id) return null;

    return {
      id: data.id,
      displayName: data.display_name,
      headline: pickLocalized(
        locale,
        data.public_headline_en,
        data.public_headline_km,
      ),
      bio: pickLocalized(locale, data.public_bio_en, data.public_bio_km),
      location: data.public_location,
      avatarUrl: data.public_avatar_url,
    };
  } catch {
    return null;
  }
}

// ── Social links ────────────────────────────────────────────────────────────

export type SocialLink = {
  id: string;
  platform: string;
  label: string;
  url: string;
  handle: string | null;
  icon: string | null;
};

export async function getSocialLinks(locale: Locale): Promise<SocialLink[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("social_links")
      .select("id, platform, label_en, label_km, url, handle, icon, sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    if (error) return [];

    if (data && data.length > 0) {
      return data.map((row) => ({
        id: row.id,
        platform: row.platform,
        label: pickLocalized(locale, row.label_en, row.label_km) ?? row.platform,
        url: row.url,
        handle: row.handle,
        icon: row.icon,
      }));
    }

    /*
     * Fall back to the contact fields in Settings.
     *
     * `social_links` is a richer table — per-platform labels in both languages,
     * ordering, an is_published flag — but it has no editor anywhere in the
     * admin and is written only by seed.sql. On any database that was created by
     * migrations rather than by a local `db reset`, it is therefore empty and
     * always will be.
     *
     * Meanwhile the Settings page collects an email, a Telegram handle and
     * Facebook, GitHub and LinkedIn URLs, stores them on `site_settings`, and
     * nothing public ever rendered them. Filling in that form and seeing no
     * change on the site is exactly the hardcoded-content problem this rebuild
     * set out to remove.
     *
     * So the table stays authoritative when it has rows, and Settings answers
     * when it does not.
     */
    return socialLinksFromSettings(await getSiteSettings(locale), locale);
  } catch {
    return [];
  }
}

/** Telegram is stored as a handle, a t.me URL, or an @handle. Accept all three. */
function telegramUrl(handle: string): string {
  const trimmed = handle.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://t.me/${trimmed.replace(/^@/, "")}`;
}

/**
 * Social links derived from the Settings page.
 *
 * Only fields the owner actually filled in produce a link — an empty field is
 * absent rather than rendered as a dead tile.
 */
function socialLinksFromSettings(
  settings: SiteSettings,
  locale: Locale,
): SocialLink[] {
  const links: SocialLink[] = [];

  const add = (
    platform: string,
    labelEn: string,
    labelKm: string,
    url: string | null,
    handle: string | null,
    icon: string,
  ) => {
    if (!url) return;
    links.push({
      // Stable, derived id: these rows do not exist in the database, and the
      // list is keyed by it in the footer.
      id: `settings-${platform}`,
      platform,
      label: pickLocalized(locale, labelEn, labelKm) ?? labelEn,
      url,
      handle,
      icon,
    });
  };

  add(
    "email",
    "Email",
    "អ៊ីមែល",
    settings.contactEmail ? `mailto:${settings.contactEmail}` : null,
    settings.contactEmail,
    "mail",
  );
  add(
    "telegram",
    "Telegram",
    "តេឡេក្រាម",
    settings.telegramHandle ? telegramUrl(settings.telegramHandle) : null,
    settings.telegramHandle,
    "telegram",
  );
  add("facebook", "Facebook", "ហ្វេសប៊ុក", settings.facebookUrl, null, "facebook");
  add("github", "GitHub", "GitHub", settings.githubUrl, null, "github");
  // The icon set has no LinkedIn mark; a globe is honest rather than wrong.
  add("linkedin", "LinkedIn", "LinkedIn", settings.linkedinUrl, null, "globe");

  return links;
}

// ── Languages ───────────────────────────────────────────────────────────────

export type SpokenLanguage = {
  id: string;
  code: string;
  name: string;
  proficiency: string;
  cefrLevel: string | null;
  isNative: boolean;
};

export async function getSpokenLanguages(locale: Locale): Promise<SpokenLanguage[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("languages")
      .select(
        "id, code, name_en, name_km, proficiency_label_en, proficiency_label_km, cefr_level, is_native, sort_order",
      )
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      code: row.code,
      name: pickLocalized(locale, row.name_en, row.name_km) ?? row.code,
      proficiency:
        pickLocalized(
          locale,
          row.proficiency_label_en,
          row.proficiency_label_km,
        ) ?? "",
      cefrLevel: row.cefr_level,
      isNative: row.is_native,
    }));
  } catch {
    return [];
  }
}

// ── Credibility counts ──────────────────────────────────────────────────────

export type SiteCounts = {
  publishedProjects: number;
  featuredProjects: number;
  publishedCertificates: number;
  publishedEducation: number;
  publishedExperiences: number;
  languages: number;
  publishedTestimonials: number;
  /** Whole years since the earliest published education or experience. */
  yearsOnJourney: number | null;
};

const EMPTY_COUNTS: SiteCounts = {
  publishedProjects: 0,
  featuredProjects: 0,
  publishedCertificates: 0,
  publishedEducation: 0,
  publishedExperiences: 0,
  languages: 0,
  publishedTestimonials: 0,
  yearsOnJourney: null,
};

/**
 * Counts for the homepage credibility strip.
 *
 * Read from the `public_site_counts` view, which runs with `security_invoker`, so
 * every figure is counted under the caller's RLS and can only ever include
 * published rows. This is what makes the strip trustworthy: there is no path by
 * which it can display a number that is not backed by public content.
 */
export async function getSiteCounts(): Promise<SiteCounts> {
  if (!isSupabaseConfigured()) return EMPTY_COUNTS;

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("public_site_counts")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error || !data) return EMPTY_COUNTS;

    let yearsOnJourney: number | null = null;
    if (data.journey_started_on) {
      const start = new Date(data.journey_started_on);
      if (!Number.isNaN(start.getTime())) {
        const years = Math.floor(
          (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
        );
        // A "0 years" badge says nothing useful, so it is suppressed.
        yearsOnJourney = years >= 1 ? years : null;
      }
    }

    return {
      publishedProjects: Number(data.published_projects ?? 0),
      featuredProjects: Number(data.featured_projects ?? 0),
      publishedCertificates: Number(data.published_certificates ?? 0),
      publishedEducation: Number(data.published_education ?? 0),
      publishedExperiences: Number(data.published_experiences ?? 0),
      languages: Number(data.languages ?? 0),
      publishedTestimonials: Number(data.published_testimonials ?? 0),
      yearsOnJourney,
    };
  } catch {
    return EMPTY_COUNTS;
  }
}

// ── SEO overrides ───────────────────────────────────────────────────────────

export type SeoOverride = {
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  isIndexable: boolean;
  includeInSitemap: boolean;
  sitemapPriority: number | null;
  ogImage: MediaAsset | null;
};

export async function getSeoOverride(
  routeKey: string,
  locale: Locale,
): Promise<SeoOverride | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("seo_overrides")
      .select(
        `title, description, canonical_url, is_indexable, include_in_sitemap,
         sitemap_priority, og_image:media_assets!seo_overrides_og_image_media_id_fkey(${MEDIA_COLUMNS})`,
      )
      .eq("route_key", routeKey)
      .eq("locale", locale)
      .maybeSingle();

    if (error || !data) return null;

    return {
      title: data.title,
      description: data.description,
      canonicalUrl: data.canonical_url,
      isIndexable: data.is_indexable,
      includeInSitemap: data.include_in_sitemap,
      sitemapPriority: data.sitemap_priority,
      ogImage: (data.og_image as MediaAsset | null) ?? null,
    };
  } catch {
    return null;
  }
}
