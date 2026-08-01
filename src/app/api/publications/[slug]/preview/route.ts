import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { readStorageObject } from "@/lib/storage";
import type { StorageBucket, StorageProvider } from "@/lib/storage/buckets";
import { checkPermission } from "@/lib/auth/guards";
import { extractFirstPages } from "@/lib/media/pdf";
import type {
  PdfDownloadPolicy,
  PreviewPolicy,
  SampleDownloadPolicy,
  SourcePolicy,
} from "@/lib/validation/publication";

/**
 * Inline PDF preview.
 *
 * Separate from the download route on purpose. They enforce *different*
 * policies: `preview_policy` decides what may be read in the browser,
 * `pdf_download_policy` decides what may be kept. A book can be readable in full
 * and not downloadable, or downloadable and not previewed, and one route serving
 * both with one `Content-Disposition` could not express that.
 *
 * ── What `first_pages` actually does ───────────────────────────────────────
 * It serves a genuinely truncated document, rebuilt by `extractFirstPages()`. It
 * would have been much easier to stream the whole file and let the viewer open
 * on page one, and that would have been a lie: the bytes of the entire book
 * would be in the browser's cache, and anyone who looked at the network tab
 * would have the lot. If the owner says five pages, five pages is what leaves
 * the server.
 *
 * ── Why an iframe of the browser's own viewer, and no PDF.js bundle ────────
 * Zoom, page navigation, keyboard control, text selection, find-in-page,
 * full-screen and screen-reader support all already exist in every browser's
 * built-in viewer, in the user's own language, tuned to their own platform.
 * Shipping ~350 KB of PDF.js to reimplement them worse would fail section 25's
 * bundle budget to produce a less accessible result. The iframe is created only
 * after the reader clicks, so nothing here is on the initial page load.
 *
 * `Content-Disposition: inline` is safe here specifically because the response
 * carries `Content-Security-Policy: sandbox`, `X-Content-Type-Options: nosniff`
 * and a fixed `Content-Type` — see the headers below.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PublicationRow = {
  id: string;
  slug: string;
  active_version_id: string | null;
  preview_policy: PreviewPolicy;
  preview_page_limit: number | null;
  pdf_download_policy: PdfDownloadPolicy;
  sample_download_policy: SampleDownloadPolicy;
  source_policy: SourcePolicy;
};

function deny(status: number, error: string) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  if (!isSupabaseConfigured()) return deny(503, "Not available.");

  const { slug } = await context.params;

  try {
    // The publication through RLS, so a draft is a 404 to a stranger.
    const supabase = await createSupabasePublicClient();

    const { data } = await supabase
      .from("publications")
      .select(
        `id, slug, active_version_id, preview_policy, preview_page_limit,
         pdf_download_policy, sample_download_policy, source_policy`,
      )
      .eq("slug", slug)
      .maybeSingle();

    const publication = data as PublicationRow | null;
    if (!publication) return deny(404, "Not found.");

    /*
     * `none` and `sample_pages` have no inline document.
     *
     * `sample_pages` is not an oversight: that policy means "the reader sees the
     * page images the owner chose", and those are ordinary public images on the
     * page. Serving the PDF here as well would quietly widen the policy from a
     * curated handful of pages to the whole book.
     */
    if (publication.preview_policy === "none" || publication.preview_policy === "sample_pages") {
      const auth = await checkPermission("viewAdmin");
      if (!auth.ok) return deny(403, "No inline preview for this publication.");
    }

    const admin = createSupabaseAdminClient();

    const { data: versionData } = await admin
      .from("publication_versions")
      .select(
        `id, status, publication_id,
         pdf:media_assets!publication_versions_pdf_media_id_fkey(
           bucket_id, storage_path, storage_provider, mime_type
         )`,
      )
      .eq("publication_id", publication.id)
      .eq("id", publication.active_version_id ?? "")
      .maybeSingle();

    const version = versionData as unknown as {
      id: string;
      status: string;
      pdf: {
        bucket_id: string;
        storage_path: string;
        storage_provider: StorageProvider;
        mime_type: string;
      } | null;
    } | null;

    if (!version?.pdf) return deny(404, "No preview available.");

    const file = await readStorageObject({
      provider: version.pdf.storage_provider,
      bucket: version.pdf.bucket_id as StorageBucket,
      storagePath: version.pdf.storage_path,
      admin,
    });

    if (!file) return deny(404, "File unavailable.");

    let body = new Uint8Array(file);

    if (publication.preview_policy === "first_pages") {
      const limit = publication.preview_page_limit ?? 5;
      const truncated = await extractFirstPages(body, limit);

      /*
       * A truncation failure refuses the preview rather than falling back to the
       * whole document. Serving everything because the slicer failed is exactly
       * the outcome the policy exists to prevent, and it would fail silently.
       */
      if (!truncated) return deny(500, "The preview could not be prepared.");
      body = new Uint8Array(truncated);
    }

    return new NextResponse(body as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(body.byteLength),
        // `inline` — this response is meant to be rendered by the viewer in the
        // iframe. The filename still matters: it is what "Save" offers.
        "Content-Disposition": `inline; filename="${slug}-preview.pdf"`,
        /*
         * A per-response CSP that overrides the site's.
         *
         * `sandbox` on a PDF response is what keeps the document inert: no
         * scripts, no forms, no top-level navigation, no plugins — so an
         * embedded `/OpenAction` or a link that tries to break out of the frame
         * has nothing to act on. This is the header that makes serving a PDF
         * `inline` from our own origin a reasonable thing to do.
         */
        "Content-Security-Policy": "sandbox; default-src 'none'; object-src 'none'",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        /*
         * `private` and short-lived. The active edition can change, a truncated
         * preview is derived from a policy that can change, and a shared CDN
         * must never hold either — the whole reason this goes through a route is
         * that the answer is decided per request.
         */
        "Cache-Control": "private, max-age=0, must-revalidate",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return deny(500, "Unexpected error.");
  }
}
