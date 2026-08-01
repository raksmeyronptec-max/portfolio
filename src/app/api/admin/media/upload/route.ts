import { NextResponse, type NextRequest } from "next/server";

import { checkPermission } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/log";
import {
  isMediaKind,
  isPrivateKind,
  MEDIA_KIND_BUCKETS,
  PUBLICATION_FILE_KINDS,
  type MediaKind,
} from "@/lib/media/kinds";
import {
  buildStoragePath,
  PUBLICATION_PDF_TYPES,
  PUBLICATION_SOURCE_TYPES,
  resolveUploadType,
  SIZE_LIMITS,
  sanitizeFilename,
  STORED_AS_IS_TYPES,
  validateUpload,
} from "@/lib/media/validate";
import { checksumOf, processImage, readDimensions } from "@/lib/media/process";
import { activeStorageProvider, putStorageObject } from "@/lib/storage";
import type { StorageBucket } from "@/lib/storage/buckets";

/**
 * Media upload.
 *
 * A route handler rather than a Server Action because Server Actions carry a body
 * size limit intended for form data (2 MB here), and a 25 MB certificate scan needs
 * a streaming multipart endpoint.
 *
 * Routing by visibility:
 *
 *  | kind                  | bucket                | processing                    |
 *  |-----------------------|-----------------------|-------------------------------|
 *  | certificate_original  | certificate-originals | none — stored byte-for-byte   |
 *  | certificate_preview   | certificate-previews  | full image pipeline           |
 *  | resume_file           | resumes               | none (PDF)                    |
 *  | publication_cover     | publication-previews  | full image pipeline           |
 *  | publication_page      | publication-previews  | full image pipeline           |
 *  | publication_pdf       | publication-files     | none (PDF, private)           |
 *  | publication_original  | publication-originals | none (PDF, private)           |
 *  | publication_source    | publication-sources   | none (ZIP, private)           |
 *  | everything else       | public-media          | full image pipeline           |
 *
 * A certificate original is never processed: it is the evidentiary copy, and
 * re-encoding it would destroy exactly the fidelity that makes it useful. A resume
 * PDF is likewise stored as-is.
 *
 * The bucket column is not written out here — it comes from `MEDIA_KIND_BUCKETS`,
 * and visibility comes from `isPrivateKind()`, so this table documents a mapping
 * rather than duplicating it. All three publication file kinds are private,
 * including the one readers download; `/api/publications/[slug]/download`
 * enforces the download policy, which a permanent public URL could not.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Image processing of a large scan can take a while on a cold function.
export const maxDuration = 60;

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const auth = await checkPermission("uploadMedia");
  if (!auth.ok) {
    return json(
      { ok: false, error: auth.reason },
      auth.reason === "unauthenticated" ? 401 : 403,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "invalid_form" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return json({ ok: false, error: "no_file" }, 400);
  }

  const kindRaw = String(form.get("kind") ?? "other");
  const kind: MediaKind = isMediaKind(kindRaw) ? kindRaw : "other";

  const altTextEn = trimmedOrNull(form.get("alt_text_en"));
  const altTextKm = trimmedOrNull(form.get("alt_text_km"));
  const captionEn = trimmedOrNull(form.get("caption_en"));
  const captionKm = trimmedOrNull(form.get("caption_km"));
  const credit = trimmedOrNull(form.get("credit"));

  // ── Route by kind ─────────────────────────────────────────────────────────
  const isPrivateOriginal = kind === "certificate_original";
  const isResume = kind === "resume_file";
  const isCertificatePreview = kind === "certificate_preview";
  /*
   * A publication's three file levels: the reader-facing PDF, the archival
   * original and the LaTeX source archive. All three are private and all three
   * are stored byte-for-byte — see `PRIVATE_MEDIA_KINDS` for why the first one
   * is private despite being the one people download.
   */
  const isPublicationFile = PUBLICATION_FILE_KINDS.has(kind);
  const isPublicationSource = kind === "publication_source";

  const bucketId = (MEDIA_KIND_BUCKETS[kind] ?? "public-media") as StorageBucket;

  // Derived from the kind rather than restated, so this and the database CHECK
  // in migration 0026 cannot drift apart.
  const visibility: "public" | "private" = isPrivateKind(kind) ? "private" : "public";

  const maxBytes = isPrivateOriginal
    ? SIZE_LIMITS.certificateOriginal
    : isResume
      ? SIZE_LIMITS.resume
      : isCertificatePreview
        ? SIZE_LIMITS.certificatePreview
        : isPublicationFile
          ? SIZE_LIMITS.publicationFile
          : SIZE_LIMITS.publicImage;

  const bytes = new Uint8Array(await file.arrayBuffer());

  /*
   * The effective type.
   *
   * Browsers do not reliably report a MIME type for HEIC — macOS gives
   * `image/heic`, several other platforms give an empty string — so the
   * extension fills the blank. A type the browser *did* state is never
   * overridden, and the magic-byte check below still has to pass either way.
   */
  const declaredType = resolveUploadType(file.name, file.type);

  // ── Validate: declared type, extension AND magic bytes ────────────────────
  const failure = validateUpload({
    filename: file.name,
    declaredType,
    size: bytes.byteLength,
    buffer: bytes,
    maxBytes,
    /*
     * These two kinds are stored byte-for-byte, so whatever arrives is what is
     * served and what goes in `mime_type`. HEIC is excluded there: the DB's
     * MIME allowlist would reject it, and no browser but Safari could display
     * it. Everything else converts to WebP, where HEIC is fine.
     */
    allowedTypes: isPublicationSource
      ? PUBLICATION_SOURCE_TYPES
      : isPublicationFile
        ? PUBLICATION_PDF_TYPES
        : isPrivateOriginal || isResume
          ? STORED_AS_IS_TYPES
          : undefined,
  });

  if (failure) {
    return json({ ok: false, error: failure.code, message: failure.message }, 400);
  }

  const isPdf = declaredType === "application/pdf";

  /*
   * A PDF never belongs in a public bucket.
   *
   * This used to carry an exemption for `kind === "other"`, which was harmless
   * only because Supabase storage enforced a per-bucket MIME allowlist that
   * rejected the upload anyway. Cloudflare R2 has no such allowlist, so the
   * exemption stopped being dead code the moment the bytes moved: a PDF chosen
   * as "Other" would now land in the public bucket and be served from a
   * permanent public URL. Removed rather than special-cased — there is no
   * workflow here that wants a publicly addressable PDF, and the resume, which
   * is the one public-facing document, is deliberately streamed from a private
   * bucket through its own route.
   */
  if (isPdf && visibility === "public") {
    return json(
      {
        ok: false,
        error: "type_not_allowed",
        message:
          "A PDF cannot be stored publicly. Choose “Certificate original” or “Resume PDF” — both are private — or upload an image instead.",
      },
      400,
    );
  }

  const admin = createSupabaseAdminClient();

  try {
    // ── Duplicate detection ─────────────────────────────────────────────────
    const checksum = checksumOf(bytes);

    const { data: duplicate } = await admin
      .from("media_assets")
      .select("id, original_filename")
      .eq("checksum_sha256", checksum)
      .is("deleted_at", null)
      .maybeSingle();

    if (duplicate) {
      // Reported rather than silently de-duplicated: the admin may genuinely want a
      // second copy with different alt text, and should decide.
      return json(
        {
          ok: false,
          error: "duplicate",
          message: `This exact file is already in the library as “${duplicate.original_filename}”.`,
          existingId: duplicate.id,
        },
        409,
      );
    }

    const safeName = sanitizeFilename(file.name);
    const storagePath = buildStoragePath(kind, safeName);

    let width: number | null = null;
    let height: number | null = null;
    let blurDataUrl: string | null = null;
    let thumbnailPath: string | null = null;
    let cardPath: string | null = null;
    let previewPath: string | null = null;
    let storedBytes = bytes.byteLength;
    let storedMime = declaredType;
    let uploadBody: Uint8Array | Buffer = bytes;
    let finalPath = storagePath;
    /*
     * Recorded from the upload that actually happened rather than from the
     * configuration, so a row can never claim to be somewhere its bytes are
     * not. The initial value is only a placeholder; every path below overwrites
     * it before the row is inserted.
     */
    let storageProvider = activeStorageProvider();

    if (isPdf || isPrivateOriginal || isPublicationFile) {
      /*
       * Stored exactly as received.
       *
       * For a certificate original that is the whole point — it is the evidentiary
       * copy. For a PDF there is nothing useful to re-encode, and rasterising it
       * would require a PDF renderer, which is a large attack surface for no gain.
       * The PDF is never executed or parsed by us; it is only ever streamed back
       * out with `Content-Type: application/pdf` and `nosniff`. A publication
       * source archive is likewise stored and returned verbatim — it is never
       * expanded, which is exactly why accepting a ZIP is safe.
       *
       * Dimensions are read only from an actual image. A certificate original may
       * be a scan (dimensions are useful) or a PDF (they are not), and handing a
       * ZIP to `readDimensions` would throw on a file that is perfectly valid.
       */
      const isImageOriginal = isPrivateOriginal && !isPdf;
      const dimensions = isImageOriginal
        ? await readDimensions(bytes)
        : { width: null, height: null };
      width = dimensions.width;
      height = dimensions.height;
    } else {
      // Full pipeline: strip metadata, re-encode to WebP, generate derivatives.
      const processed = await processImage(bytes);

      uploadBody = processed.main.buffer;
      storedBytes = processed.main.buffer.byteLength;
      storedMime = "image/webp";
      width = processed.main.width;
      height = processed.main.height;
      blurDataUrl = processed.blurDataUrl;

      // The stored key gains a .webp extension since the bytes are now WebP.
      finalPath = `${storagePath.replace(/\.[^./]+$/, "")}.webp`;

      const mainUpload = await putStorageObject({
        bucket: bucketId,
        storagePath: finalPath,
        body: processed.main.buffer,
        contentType: "image/webp",
        admin,
      });

      if (mainUpload.error) {
        return json({ ok: false, error: "storage_failed", message: mainUpload.error }, 500);
      }
      storageProvider = mainUpload.provider;

      for (const derivative of processed.derivatives) {
        const derivativePath = `${finalPath.replace(/\.webp$/, "")}-${derivative.suffix}.webp`;

        const derivativeUpload = await putStorageObject({
          bucket: bucketId,
          storagePath: derivativePath,
          body: derivative.buffer,
          contentType: "image/webp",
          admin,
        });

        if (derivativeUpload.error) continue; // A missing derivative degrades gracefully.

        if (derivative.suffix === "thumb") thumbnailPath = derivativePath;
        if (derivative.suffix === "card") cardPath = derivativePath;
        if (derivative.suffix === "preview") previewPath = derivativePath;
      }
    }

    // Non-image and private-original paths still need the main object uploaded.
    if (isPdf || isPrivateOriginal || isPublicationFile) {
      const upload = await putStorageObject({
        bucket: bucketId,
        storagePath: finalPath,
        body: new Uint8Array(uploadBody),
        contentType: declaredType,
        // Private objects are read through the server or a short-lived signed
        // URL, so a long cache would be pointless and slightly risky.
        cacheControl:
          visibility === "private"
            ? "private, max-age=0, no-store"
            : "public, max-age=31536000, immutable",
        admin,
      });

      if (upload.error) {
        return json({ ok: false, error: "storage_failed", message: upload.error }, 500);
      }
      storageProvider = upload.provider;
    }

    // ── Register the asset ──────────────────────────────────────────────────
    const { data: asset, error: insertError } = await admin
      .from("media_assets")
      .insert({
        bucket_id: bucketId,
        storage_path: finalPath,
        storage_provider: storageProvider,
        kind,
        visibility,
        original_filename: safeName,
        mime_type: storedMime,
        file_size_bytes: storedBytes,
        checksum_sha256: checksum,
        width,
        height,
        blur_data_url: blurDataUrl,
        thumbnail_path: thumbnailPath,
        card_path: cardPath,
        preview_path: previewPath,
        alt_text_en: altTextEn,
        alt_text_km: altTextKm,
        caption_en: captionEn,
        caption_km: captionKm,
        credit,
        /*
         * A freshly uploaded original has not been reviewed for redaction yet —
         * and neither has a book PDF. These are real teaching documents: they can
         * carry the author's phone number, a QR code pointing at a channel that
         * has since changed hands, a reviewer's name or a pupil's written work.
         * None of that is detectable automatically, so the file arrives flagged
         * and the publication's publish gate refuses to go public until a human
         * clears it.
         */
        requires_privacy_review: isPrivateOriginal || isPublicationFile,
        uploaded_by: auth.session.userId,
      })
      .select("id")
      .single();

    if (insertError || !asset) {
      // Roll back the storage object so a failed registration does not leave an
      // orphaned file that nothing references.
      await admin.storage.from(bucketId).remove([finalPath]);
      return json({ ok: false, error: "server_error" }, 500);
    }

    await writeAuditLog({
      action: "media.uploaded",
      actor: auth.session,
      entityType: "media_asset",
      entityId: asset.id,
      entityLabel: safeName,
      summary: `Uploaded ${safeName} to ${bucketId} as ${visibility}.`,
      changes: { kind, bytes: storedBytes, mime_type: storedMime },
    });

    return json(
      {
        ok: true,
        id: asset.id,
        filename: safeName,
        visibility,
        bucket: bucketId,
        width,
        height,
        processed: !isPdf && !isPrivateOriginal && !isPublicationFile,
      },
      201,
    );
  } catch (error) {
    // Image processing throws on a corrupt or bomb-like file; surface that as a
    // client error rather than a 500, because it is the caller's file.
    const message =
      error instanceof Error && error.message.includes("dimensions")
        ? "The image could not be read. It may be corrupted."
        : "The upload could not be processed.";

    return json({ ok: false, error: "processing_failed", message }, 400);
  }
}

function trimmedOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, 500);
}
