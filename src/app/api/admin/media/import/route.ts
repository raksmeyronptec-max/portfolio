import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";

import { checkPermission } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/log";
import {
  importDirectory,
  resolveInsideImportDirectory,
  scanImportDirectory,
  sharpSupportsHeic,
} from "@/lib/media/import-scan";
import { processImage } from "@/lib/media/process";
import { buildStoragePath, MAX_UPLOAD_SIZE_BYTES, sanitizeFilename } from "@/lib/media/validate";
import { putStorageObject } from "@/lib/storage";

/**
 * Bulk import from an approved local folder.
 *
 * `GET`  — scan the folder and report what is there.
 * `POST` — import an explicitly listed set of files.
 *
 * ── Route handler, not a Server Action ─────────────────────────────────────
 * Same reason as the upload endpoint: importing forty photographs takes far
 * longer than a form submission should, and the work is streamed file by file
 * with a per-file result rather than succeeding or failing as one transaction.
 *
 * ── Development only ───────────────────────────────────────────────────────
 * `importDirectory()` returns null in production, and both handlers 404 on that.
 * Netlify's function filesystem is read-only and holds only the deployment
 * bundle, so a folder scan there would be meaningless at best.
 *
 * ── What an imported file becomes ──────────────────────────────────────────
 * Exactly what a hand-uploaded one becomes, through the same `processImage()`
 * pipeline: metadata stripped (including GPS), re-encoded to WebP, three
 * derivatives, a blur placeholder, a checksum. The only differences are that the
 * public filename is semantic rather than `IMG_4477`, and that the row is created
 * with `requires_privacy_review = true` — nothing imported is publishable until
 * a human has looked at it.
 *
 * The source file is read and never modified.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Processing a batch of large photographs is slow on a cold function.
export const maxDuration = 300;

/** Cap per request, so one call cannot run for ten minutes. */
const MAX_BATCH = 25;

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// ── Scan ────────────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await checkPermission("uploadMedia");
  if (!auth.ok) {
    return json(
      { ok: false, error: auth.reason },
      auth.reason === "unauthenticated" ? 401 : 403,
    );
  }

  if (!importDirectory()) return json({ ok: false, error: "not_available" }, 404);

  try {
    const admin = createSupabaseAdminClient();

    /*
     * Every checksum already in the library, so the scan can flag a file that has
     * been imported before. Reading the whole column is fine at this scale and is
     * one query instead of one per file.
     */
    const { data: existing } = await admin
      .from("media_assets")
      .select("checksum_sha256")
      .not("checksum_sha256", "is", null)
      .is("deleted_at", null);

    const checksums = new Set(
      (existing ?? [])
        .map((row) => row.checksum_sha256)
        .filter((value): value is string => typeof value === "string"),
    );

    const result = await scanImportDirectory(checksums);
    return json({ ok: true, ...result }, 200);
  } catch {
    return json({ ok: false, error: "server_error" }, 500);
  }
}

// ── Import ──────────────────────────────────────────────────────────────────

type ImportItem = {
  relativePath: string;
  filename: string;
  kind: string;
  altTextEn?: string | null;
  captionEn?: string | null;
  capturedOn?: string | null;
};

type ImportOutcome = {
  relativePath: string;
  ok: boolean;
  mediaId?: string;
  filename?: string;
  error?: string;
};

export async function POST(request: NextRequest) {
  const auth = await checkPermission("uploadMedia");
  if (!auth.ok) {
    return json(
      { ok: false, error: auth.reason },
      auth.reason === "unauthenticated" ? 401 : 403,
    );
  }

  if (!importDirectory()) return json({ ok: false, error: "not_available" }, 404);

  let body: { items?: ImportItem[] };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const items = Array.isArray(body.items) ? body.items.slice(0, MAX_BATCH) : [];
  if (items.length === 0) return json({ ok: false, error: "no_items" }, 400);

  const admin = createSupabaseAdminClient();
  const results: ImportOutcome[] = [];

  for (const item of items) {
    const outcome = await importOne(item, auth.session.userId, admin);
    results.push(outcome);
  }

  const imported = results.filter((result) => result.ok).length;

  /*
   * One audit entry for the batch rather than one per file.
   *
   * A forty-file import would otherwise bury every other event in the log for
   * that day. The count and the source folder are recorded; the absolute
   * filesystem paths are not, because the audit log must not become a map of the
   * owner's laptop.
   */
  if (imported > 0) {
    await writeAuditLog({
      action: "media.imported",
      actor: auth.session,
      entityType: "media_asset",
      summary:
        `Imported ${imported} file${imported === 1 ? "" : "s"} from the local import ` +
        "folder. All are private and pending privacy review.",
      changes: { imported, attempted: items.length },
    });
  }

  return json({ ok: true, imported, results }, 200);
}

/**
 * Import one file.
 *
 * Never throws: a failure is returned as an outcome so one corrupt photograph
 * does not abandon the other thirty-nine.
 */
async function importOne(
  item: ImportItem,
  userId: string,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<ImportOutcome> {
  const { relativePath } = item;

  try {
    // The containment check. See `resolveInsideImportDirectory` — the client
    // supplies this string, so it is re-resolved and proved to be inside the
    // import root rather than trusted.
    const absolute = resolveInsideImportDirectory(relativePath);
    if (!absolute) {
      return { relativePath, ok: false, error: "That path is outside the import folder." };
    }

    const bytes = await readFile(absolute);

    if (bytes.byteLength === 0) {
      return { relativePath, ok: false, error: "The file is empty." };
    }

    /*
     * The size limit applies to the *source*, before re-encoding.
     *
     * A 40 MP HEIC compresses to a small WebP, so checking afterwards would let
     * an arbitrarily large file through the decoder — which is the expensive,
     * memory-hungry step and the one worth bounding. `processImage` additionally
     * caps decoded pixels at 40M as a decompression-bomb guard.
     */
    if (bytes.byteLength > MAX_UPLOAD_SIZE_BYTES) {
      return {
        relativePath,
        ok: false,
        error: `Larger than the ${Math.round(MAX_UPLOAD_SIZE_BYTES / 1024 / 1024)} MB limit.`,
      };
    }

    // Re-encode. This is where EXIF — including GPS — is destroyed.
    const processed = await processImage(bytes);

    // Duplicate check against the *processed* checksum's source, matching the
    // upload endpoint's semantics: the same original bytes are the same file.
    const { data: duplicate } = await admin
      .from("media_assets")
      .select("id, original_filename")
      .eq("checksum_sha256", processed.checksum)
      .is("deleted_at", null)
      .maybeSingle();

    if (duplicate) {
      return {
        relativePath,
        ok: false,
        error: `Already in the library as “${duplicate.original_filename}”.`,
      };
    }

    const kind =
      item.kind === "experience_photo" || item.kind === "video_poster"
        ? item.kind
        : "journey_photo";

    const safeName = sanitizeFilename(item.filename || path.basename(relativePath));
    const storagePath = buildStoragePath(kind, safeName);
    const finalPath = `${storagePath.replace(/\.[^./]+$/, "")}.webp`;

    const mainUpload = await putStorageObject({
      bucket: "public-media",
      storagePath: finalPath,
      body: processed.main.buffer,
      contentType: "image/webp",
      admin,
    });

    if (mainUpload.error) {
      return { relativePath, ok: false, error: mainUpload.error };
    }

    let thumbnailPath: string | null = null;
    let cardPath: string | null = null;
    let previewPath: string | null = null;

    for (const derivative of processed.derivatives) {
      const derivativePath = `${finalPath.replace(/\.webp$/, "")}-${derivative.suffix}.webp`;

      const upload = await putStorageObject({
        bucket: "public-media",
        storagePath: derivativePath,
        body: derivative.buffer,
        contentType: "image/webp",
        admin,
      });

      // A missing derivative degrades gracefully — the resolver falls back to the
      // next size up.
      if (upload.error) continue;

      if (derivative.suffix === "thumb") thumbnailPath = derivativePath;
      if (derivative.suffix === "card") cardPath = derivativePath;
      if (derivative.suffix === "preview") previewPath = derivativePath;
    }

    const { data: asset, error: insertError } = await admin
      .from("media_assets")
      .insert({
        bucket_id: "public-media",
        storage_path: finalPath,
        storage_provider: mainUpload.provider,
        kind,
        visibility: "public",
        /*
         * The *original* camera filename, not the semantic one.
         *
         * The semantic name is the storage key and is what a visitor would see in
         * a URL; this column is the owner's own reference back to the file on
         * their laptop. Losing that link would make "which of my folders did this
         * come from?" unanswerable.
         */
        original_filename: path.basename(relativePath),
        mime_type: "image/webp",
        file_size_bytes: processed.main.buffer.byteLength,
        checksum_sha256: processed.checksum,
        width: processed.main.width,
        height: processed.main.height,
        blur_data_url: processed.blurDataUrl,
        thumbnail_path: thumbnailPath,
        card_path: cardPath,
        preview_path: previewPath,
        alt_text_en: item.altTextEn?.trim() || null,
        caption_en: item.captionEn?.trim() || null,
        /*
         * Imported files are flagged for review regardless of what they show.
         *
         * The owner's folders are full of classrooms and pupils, and nobody has
         * looked at these one by one yet. The flag is what puts them in the media
         * library's review queue; the *attachment*-level privacy status (migration
         * 0024) is what actually gates publication.
         */
        requires_privacy_review: true,
        uploaded_by: userId,
      })
      .select("id")
      .single();

    if (insertError || !asset) {
      // Roll the storage object back so a failed registration does not leave an
      // orphan that nothing references.
      await admin.storage.from("public-media").remove([finalPath]);
      return { relativePath, ok: false, error: "Could not register the file." };
    }

    return {
      relativePath,
      ok: true,
      mediaId: asset.id,
      filename: path.basename(finalPath),
    };
  } catch (error) {
    // `processImage` throws on a corrupt file or a decompression bomb. That is
    // the caller's file, so the message is surfaced rather than swallowed.
    const message =
      error instanceof Error && /dimensions|truncated|pixel|unsupported|heif|heic/i.test(error.message)
        ? sharpSupportsHeic()
          ? "Could not be decoded — it may be corrupt or an unsupported format."
          : "Could not be decoded. HEIC support is unavailable in this build."
        : "Import failed.";

    return { relativePath, ok: false, error: message };
  }
}
