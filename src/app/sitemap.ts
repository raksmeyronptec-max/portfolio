import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/supabase/env";
import { localeMeta, localePath, locales } from "@/i18n/config";
import { getPublishedProjectSlugs } from "@/lib/data/projects";
import { getPublishedCertificateSlugs } from "@/lib/data/certificates";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Sitemap.
 *
 * Included: published public pages, published projects, published certificates,
 * in both locales, each entry carrying its `alternates.languages` pairing.
 *
 * Excluded, by construction rather than by filtering: anything under /admin,
 * /api, drafts, archived content, private files and preview routes. Project and
 * certificate slugs come from RLS-constrained queries, so an unpublished item
 * cannot appear here even if this file forgot to exclude it — the database will not
 * return it.
 *
 * Routes whose `seo_overrides` row sets `include_in_sitemap = false` are dropped.
 */
export const revalidate = 3600;

type StaticRoute = {
  key: string;
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
};

const STATIC_ROUTES: StaticRoute[] = [
  { key: "home", path: "", priority: 1.0, changeFrequency: "weekly" },
  { key: "projects", path: "projects", priority: 0.9, changeFrequency: "weekly" },
  { key: "certificates", path: "certificates", priority: 0.8, changeFrequency: "monthly" },
  { key: "about", path: "about", priority: 0.7, changeFrequency: "monthly" },
  { key: "experience", path: "experience", priority: 0.7, changeFrequency: "monthly" },
  { key: "education", path: "education", priority: 0.7, changeFrequency: "monthly" },
  { key: "resume", path: "resume", priority: 0.6, changeFrequency: "monthly" },
  { key: "contact", path: "contact", priority: 0.6, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const excluded = await excludedRouteKeys();

  const entries: MetadataRoute.Sitemap = [];

  // ── Static routes ─────────────────────────────────────────────────────────
  for (const route of STATIC_ROUTES) {
    if (excluded.has(route.key)) continue;

    for (const locale of locales) {
      entries.push({
        url: absoluteUrl(localePath(locale, route.path)),
        lastModified: new Date(),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: { languages: languageMap(route.path) },
      });
    }
  }

  // ── Content routes ────────────────────────────────────────────────────────
  const [projects, certificates] = await Promise.all([
    getPublishedProjectSlugs(),
    getPublishedCertificateSlugs(),
  ]);

  for (const project of projects) {
    const path = `projects/${project.slug}`;
    for (const locale of locales) {
      entries.push({
        url: absoluteUrl(localePath(locale, path)),
        lastModified: new Date(project.updatedAt),
        changeFrequency: "monthly",
        priority: 0.85,
        alternates: { languages: languageMap(path) },
      });
    }
  }

  for (const certificate of certificates) {
    const path = `certificates/${certificate.slug}`;
    for (const locale of locales) {
      entries.push({
        url: absoluteUrl(localePath(locale, path)),
        lastModified: new Date(certificate.updatedAt),
        changeFrequency: "yearly",
        priority: 0.7,
        alternates: { languages: languageMap(path) },
      });
    }
  }

  return entries;
}

/** hreflang map for one route, including x-default. */
function languageMap(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[localeMeta[locale].tag] = absoluteUrl(localePath(locale, path));
  }
  languages["x-default"] = absoluteUrl(localePath("en", path));
  return languages;
}

/**
 * Route keys the admin has excluded from the sitemap, or marked noindex.
 *
 * A `noindex` page in a sitemap is a contradictory signal, so both flags exclude.
 */
async function excludedRouteKeys(): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("seo_overrides")
      .select("route_key, include_in_sitemap, is_indexable");

    if (error || !data) return new Set();

    return new Set(
      data
        .filter((row) => !row.include_in_sitemap || !row.is_indexable)
        .map((row) => row.route_key),
    );
  } catch {
    return new Set();
  }
}
