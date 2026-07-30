import "server-only";

import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_COLUMNS, type MediaAsset } from "@/lib/content/media";
import { defaultLocale, type Locale } from "@/i18n/config";

/**
 * Resume queries.
 *
 * RLS restricts anonymous reads to rows that are active and not archived, so an
 * old or draft resume cannot be discovered — and the storage policy on the
 * `resumes` bucket independently only serves the object behind the active row.
 * Archiving a version therefore removes public access to the file itself, not
 * just the link to it.
 */

export type ActiveResume = {
  id: string;
  versionLabel: string;
  locale: Locale;
  notes: string | null;
  effectiveFrom: string;
  updatedAt: string;
  downloadCount: number;
  asset: MediaAsset;
  /** True when the requested locale had no resume and we fell back. */
  isFallback: boolean;
};

export async function getActiveResume(locale: Locale): Promise<ActiveResume | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("resume_versions")
      .select(
        `id, version_label, locale, notes, effective_from, updated_at, download_count,
         asset:media_assets!resume_versions_media_id_fkey(${MEDIA_COLUMNS})`,
      )
      .eq("is_active", true)
      .eq("is_archived", false);

    if (error || !data || data.length === 0) return null;

    const rows = data as unknown as Array<{
      id: string;
      version_label: string;
      locale: Locale;
      notes: string | null;
      effective_from: string;
      updated_at: string;
      download_count: number;
      asset: MediaAsset | null;
    }>;

    const exact = rows.find((row) => row.locale === locale);
    const fallback = rows.find((row) => row.locale === defaultLocale) ?? rows[0];
    const chosen = exact ?? fallback;

    if (!chosen?.asset) return null;

    return {
      id: chosen.id,
      versionLabel: chosen.version_label,
      locale: chosen.locale,
      notes: chosen.notes,
      effectiveFrom: chosen.effective_from,
      updatedAt: chosen.updated_at,
      downloadCount: chosen.download_count,
      asset: chosen.asset,
      isFallback: !exact,
    };
  } catch {
    return null;
  }
}

/** Locales that currently have an active resume, for the "other language" link. */
export async function getAvailableResumeLocales(): Promise<Locale[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabasePublicClient();
    const { data, error } = await supabase
      .from("resume_versions")
      .select("locale")
      .eq("is_active", true)
      .eq("is_archived", false);

    if (error || !data) return [];
    return [...new Set(data.map((row) => row.locale as Locale))];
  } catch {
    return [];
  }
}
