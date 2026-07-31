import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readStorageObject } from "@/lib/storage";
import type { StorageBucket, StorageProvider } from "@/lib/storage/buckets";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { visitorHash } from "@/lib/analytics/visitor";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

/**
 * Resume download.
 *
 * Why this is a route handler rather than a direct storage link:
 *  1. The active version can change; this URL never does.
 *  2. Downloads are counted server-side, so the dashboard figure is real rather
 *     than an estimate from client events that ad blockers drop.
 *  3. The `resumes` bucket is private. On Supabase a storage policy grants access
 *     only to the object behind the ACTIVE, non-archived version. On Cloudflare
 *     R2 there is no such policy layer, so the equivalent guarantee comes from
 *     the query above: the row is read through the RLS-constrained client, and
 *     the bytes are fetched only for the asset that query returned.
 *
 * The file is streamed through this handler rather than redirected to a signed
 * URL, which keeps the private storage path out of the browser entirely.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }

  const localeParam = request.nextUrl.searchParams.get("locale");
  const locale: Locale = isLocale(localeParam) ? localeParam : defaultLocale;

  try {
    // Read the active version through the RLS-constrained client, so this
    // endpoint can only ever serve something the public is allowed to have.
    const supabase = await createSupabasePublicClient();

    const { data: rows, error } = await supabase
      .from("resume_versions")
      .select(
        `id, version_label, locale,
         asset:media_assets!resume_versions_media_id_fkey(
           bucket_id, storage_path, storage_provider, mime_type, file_size_bytes,
           original_filename
         )`,
      )
      .eq("is_active", true)
      .eq("is_archived", false);

    if (error || !rows || rows.length === 0) {
      return NextResponse.json({ error: "No resume published." }, { status: 404 });
    }

    type Row = {
      id: string;
      version_label: string;
      locale: Locale;
      asset: {
        bucket_id: string;
        storage_path: string;
        storage_provider: StorageProvider;
        mime_type: string;
        file_size_bytes: number;
        original_filename: string;
      } | null;
    };

    const candidates = rows as unknown as Row[];
    const chosen =
      candidates.find((row) => row.locale === locale) ??
      candidates.find((row) => row.locale === defaultLocale) ??
      candidates[0];

    if (!chosen?.asset) {
      return NextResponse.json({ error: "No resume published." }, { status: 404 });
    }

    // Downloading requires reading a private object, which the anon key cannot do.
    const admin = createSupabaseAdminClient();

    const file = await readStorageObject({
      provider: chosen.asset.storage_provider,
      bucket: chosen.asset.bucket_id as StorageBucket,
      storagePath: chosen.asset.storage_path,
      admin,
    });

    if (!file) {
      return NextResponse.json({ error: "File unavailable." }, { status: 404 });
    }

    // Count the download before responding, but never let a counter failure
    // block the file.
    try {
      await admin.rpc("record_resume_download", {
        p_resume_id: chosen.id,
        // The RPC accepts a null hash (it simply records no visitor), but the
        // generated types model the parameter as optional rather than nullable.
        p_visitor_hash: visitorHash(request.headers) ?? undefined,
      });
    } catch {
      // Deliberately ignored.
    }

    const filename = sanitizeFilename(
      chosen.asset.original_filename || `resume-${chosen.locale}.pdf`,
    );

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": chosen.asset.mime_type,
        // Taken from the bytes actually read, not from the row: a stale
        // `file_size_bytes` would truncate the response or hang the client.
        "Content-Length": String(file.byteLength),
        // `attachment` with a quoted, sanitised filename. RFC 5987 form is added
        // so non-ASCII names survive.
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        // Private and short-lived: the active version can change at any time, and
        // a CDN must not pin an old resume.
        "Cache-Control": "private, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

/**
 * Strip anything that could break the header or traverse a path.
 *
 * A filename arrives from the media library, which an editor controls, so it is
 * not fully trusted for use in a response header.
 */
function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[/\\]/g, "-")
      .replace(/[\u0000-\u001f\u007f"]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "resume.pdf"
  );
}
