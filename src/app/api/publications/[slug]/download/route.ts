import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { readStorageObject } from "@/lib/storage";
import type { StorageBucket, StorageProvider } from "@/lib/storage/buckets";
import { checkPermission } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/log";
import { visitorHash } from "@/lib/analytics/visitor";
import { isLocale } from "@/i18n/config";
import {
  resolvePublicationAccess,
  type PdfDownloadPolicy,
  type PreviewPolicy,
  type SampleDownloadPolicy,
  type SourcePolicy,
} from "@/lib/validation/publication";

/**
 * Publication file download — the single enforcement point for every file
 * policy in this feature.
 *
 * ── Why every level goes through here ──────────────────────────────────────
 * All three of a publication's files live in private buckets, including the one
 * readers are meant to download. That is not caution for its own sake: the
 * publication carries a `pdf_download_policy` whose values include `signed`,
 * `on_request` and `contact_author`, and none of those can be true of an object
 * anybody can fetch by URL. Access has to be decided somewhere the request
 * passes through, so it is decided here.
 *
 * The consequence is that this handler is load-bearing, and it is written to
 * fail closed at every step:
 *
 *  1. The publication row is read through the **anon** client, so RLS decides
 *     whether it exists at all. A draft is a 404 to a stranger for the same
 *     reason its page is.
 *  2. The policy is evaluated with `resolvePublicationAccess()` — the same
 *     function the detail page uses to decide which buttons to draw. A button
 *     the page shows and this route refuses would be a bug report; a file this
 *     route serves without a button would be a leak.
 *  3. Only then is the service-role client used, and only to read the one asset
 *     the query above returned. It is never used to *find* an asset.
 *
 * ── The three levels ───────────────────────────────────────────────────────
 *   ?file=pdf     the reader-facing edition. Governed by `pdf_download_policy`.
 *   ?file=source  the LaTeX archive. Governed by `source_policy`; `private` and
 *                 `on_request` both refuse, because "on request" means the owner
 *                 sends it, not that the route hands it over.
 *   ?file=original the archival copy. **Owner only, always.** There is no policy
 *                 value that opens it — a reader has no business with the
 *                 unredacted file, and the only legitimate caller is the owner
 *                 retrieving their own archive from the admin.
 *
 * Bytes are streamed through this handler rather than redirected to a signed
 * URL, which keeps the private storage path out of the browser entirely.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A 25 MB book on a cold function needs more than the default.
export const maxDuration = 60;

const FILE_SLOTS = ["pdf", "source", "original"] as const;
type FileSlot = (typeof FILE_SLOTS)[number];

type VersionAsset = {
  bucket_id: string;
  storage_path: string;
  storage_provider: StorageProvider;
  mime_type: string;
  original_filename: string;
} | null;

type PublicationRow = {
  id: string;
  slug: string;
  active_version_id: string | null;
  preview_policy: PreviewPolicy;
  preview_page_limit: number | null;
  pdf_download_policy: PdfDownloadPolicy;
  sample_download_policy: SampleDownloadPolicy;
  source_policy: SourcePolicy;
  source_repository_url: string | null;
};

function deny(status: number, error: string) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  if (!isSupabaseConfigured()) return deny(503, "Not available.");

  const { slug } = await context.params;

  const fileParam = request.nextUrl.searchParams.get("file") ?? "pdf";
  if (!(FILE_SLOTS as readonly string[]).includes(fileParam)) {
    return deny(400, "Unknown file.");
  }
  const slot = fileParam as FileSlot;

  const localeParam = request.nextUrl.searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : undefined;

  /*
   * A specific edition may be requested, for the version history's per-edition
   * download. It is validated against the publication below rather than trusted:
   * an edition id from another publication would otherwise serve that
   * publication's file under this publication's policy.
   */
  const requestedVersionId = request.nextUrl.searchParams.get("edition");

  try {
    // ── 1. The publication, through RLS ─────────────────────────────────────
    const supabase = await createSupabasePublicClient();

    const { data: publicationData } = await supabase
      .from("publications")
      .select(
        `id, slug, active_version_id, preview_policy, preview_page_limit,
         pdf_download_policy, sample_download_policy, source_policy,
         source_repository_url`,
      )
      .eq("slug", slug)
      .maybeSingle();

    /*
     * An anonymous caller sees a draft as "not found", never as "forbidden".
     *
     * The distinction matters: `403` on an unpublished slug confirms the book
     * exists and is being worked on, which is exactly what an unpublished draft
     * should not disclose.
     */
    const publication = publicationData as PublicationRow | null;
    if (!publication) return deny(404, "Not found.");

    // ── 2. The archival original never reaches a reader ─────────────────────
    if (slot === "original") {
      const auth = await checkPermission("deleteContent");
      if (!auth.ok) return deny(auth.reason === "unauthenticated" ? 401 : 403, "Forbidden.");
    }

    // ── 3. Resolve the edition ──────────────────────────────────────────────
    const admin = createSupabaseAdminClient();

    /*
     * The asset ids live on `publication_versions`, which anonymous callers
     * cannot read at all — that is the whole point of the column boundary. So
     * this read uses the service role, and the query is constrained to the
     * publication resolved through RLS in step 1. The service role is used to
     * *fetch* a known row, never to *decide* whether the caller may have it.
     */
    let versionQuery = admin
      .from("publication_versions")
      .select(
        `id, version_label, publication_id, status,
         pdf:media_assets!publication_versions_pdf_media_id_fkey(
           bucket_id, storage_path, storage_provider, mime_type, original_filename
         ),
         original:media_assets!publication_versions_original_media_id_fkey(
           bucket_id, storage_path, storage_provider, mime_type, original_filename
         ),
         source:media_assets!publication_versions_source_archive_media_id_fkey(
           bucket_id, storage_path, storage_provider, mime_type, original_filename
         )`,
      )
      .eq("publication_id", publication.id);

    versionQuery = requestedVersionId
      ? versionQuery.eq("id", requestedVersionId)
      : versionQuery.eq("id", publication.active_version_id ?? "");

    const { data: versionData } = await versionQuery.maybeSingle();

    const version = versionData as unknown as
      | {
          id: string;
          version_label: string;
          publication_id: string;
          status: string;
          pdf: VersionAsset;
          original: VersionAsset;
          source: VersionAsset;
        }
      | null;

    if (!version) return deny(404, "No edition available.");

    /*
     * A specific edition must itself be published before a reader may have it.
     *
     * Without this, `?edition=<draft id>` would serve the edition being prepared
     * — which is the copy that has not been through privacy review yet. The
     * owner is exempt, because retrieving a draft edition from the admin is the
     * legitimate use of the parameter.
     */
    if (requestedVersionId && version.status !== "published") {
      const auth = await checkPermission("viewAdmin");
      if (!auth.ok) return deny(404, "No edition available.");
    }

    const asset =
      slot === "pdf" ? version.pdf : slot === "source" ? version.source : version.original;

    if (!asset) return deny(404, "No file for that edition.");

    // ── 4. The policy check ─────────────────────────────────────────────────
    const access = resolvePublicationAccess({
      previewPolicy: publication.preview_policy,
      previewPageLimit: publication.preview_page_limit,
      pdfDownloadPolicy: publication.pdf_download_policy,
      sampleDownloadPolicy: publication.sample_download_policy,
      sourcePolicy: publication.source_policy,
      sourceRepositoryUrl: publication.source_repository_url,
      hasPdf: Boolean(version.pdf),
      hasSourceArchive: Boolean(version.source),
      hasSamplePages: true,
    });

    if (slot === "pdf" && !access.canDownloadPdf) {
      /*
       * An editor previewing their own unpublished download is a real workflow,
       * so an admin session bypasses the policy. Everyone else is refused —
       * including when the policy is `on_request`, which means "ask the author",
       * not "the route will hand it over if you construct the URL".
       */
      const auth = await checkPermission("viewAdmin");
      if (!auth.ok) {
        await recordFailure(publication, locale, request, "policy");
        return deny(403, "This publication is not available for download.");
      }
    }

    if (slot === "source" && !access.canDownloadSource) {
      const auth = await checkPermission("viewAdmin");
      if (!auth.ok) {
        await recordFailure(publication, locale, request, "source_policy");
        return deny(403, "The source archive is not publicly available.");
      }
    }

    // ── 5. Read the bytes ───────────────────────────────────────────────────
    const file = await readStorageObject({
      provider: asset.storage_provider,
      bucket: asset.bucket_id as StorageBucket,
      storagePath: asset.storage_path,
      admin,
    });

    if (!file) {
      await recordFailure(publication, locale, request, "missing_object");
      return deny(404, "File unavailable.");
    }

    // ── 6. Record it, without ever blocking the file ────────────────────────
    try {
      await admin.from("analytics_events").insert({
        event_name:
          slot === "source" ? "publication_source_download" : "publication_pdf_download",
        entity_type: "publication",
        entity_id: publication.id,
        entity_slug: publication.slug,
        locale,
        path: `/publications/${publication.slug}`,
        visitor_hash: visitorHash(request.headers),
        // The edition travels here rather than in a column — see migration 0026.
        properties: { edition: version.version_label, file: slot },
      });
    } catch {
      // Deliberately ignored: a counter failure must never cost the reader
      // their download.
    }

    /*
     * Retrieving a private file is an audited act, and the two private levels
     * are audited separately from the public one. "Somebody downloaded the
     * book" is analytics; "somebody took the archival original" is a question
     * the owner may need answered by name.
     */
    if (slot === "original" || slot === "source") {
      const auth = await checkPermission("viewAdmin");
      if (auth.ok) {
        await writeAuditLog({
          action:
            slot === "original"
              ? "publication.original_downloaded"
              : "publication.source_downloaded",
          actor: auth.session,
          entityType: "publication",
          entityId: publication.id,
          entityLabel: publication.slug,
          summary: `Downloaded the ${slot === "original" ? "archival original" : "LaTeX source archive"} for edition "${version.version_label}".`,
          // Never the storage path or a signed URL — see the rule in log.ts.
          changes: { edition: version.version_label },
        });
      }
    }

    const filename = sanitizeFilename(
      asset.original_filename || `${publication.slug}-${slot}`,
    );

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": asset.mime_type,
        // Taken from the bytes actually read, not from the row: a stale
        // `file_size_bytes` would truncate the response or hang the client.
        "Content-Length": String(file.byteLength),
        /*
         * `attachment`, always — including for the PDF.
         *
         * `inline` would let the browser render a document from our own origin,
         * and a PDF is an active format. The inline *preview* is a separate
         * route that serves the same bytes to a sandboxed viewer; a link
         * somebody shares should download rather than execute.
         */
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        // Private and short-lived. The active edition can change at any time,
        // and a shared CDN must never hold a publication file — the whole point
        // of routing it through here is that access is decided per request.
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return deny(500, "Unexpected error.");
  }
}

/**
 * Record a refused or failed download.
 *
 * Section 26 of the brief asks for failed downloads, and they are genuinely
 * invisible otherwise: a reader whose download is refused reports "the button
 * does nothing", and without this there is no evidence of which publication or
 * which policy produced it. The reason is a short enum, never the request.
 */
async function recordFailure(
  publication: { id: string; slug: string },
  locale: string | undefined,
  request: NextRequest,
  reason: string,
) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("analytics_events").insert({
      event_name: "publication_pdf_download_failed",
      entity_type: "publication",
      entity_id: publication.id,
      entity_slug: publication.slug,
      locale: locale as "en" | "km" | undefined,
      path: `/publications/${publication.slug}`,
      visitor_hash: visitorHash(request.headers),
      properties: { reason },
    });
  } catch {
    // Deliberately ignored.
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
      .slice(0, 120) || "publication"
  );
}
