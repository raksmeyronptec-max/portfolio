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
  displayFilename,
  PUBLICATION_PDF_TYPES,
  PUBLICATION_SOURCE_TYPES,
  resolveUploadType,
  sanitizeFilename,
  uploadLimitFor,
  validateUpload,
} from "@/lib/media/validate";
import { checksumOf } from "@/lib/media/process";
import {
  deleteStorageObject,
  readStorageObject,
  signUploadUrl,
} from "@/lib/storage";
import type { StorageBucket, StorageProvider } from "@/lib/storage/buckets";

/**
 * Direct-to-storage upload, in two steps.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `POST /api/admin/media/upload` sends the file through the function, and every
 * serverless platform caps the request body it will accept — 4.5 MB on Vercel.
 * A typeset mathematics book is routinely larger. The upload was rejected by the
 * platform before any of our code ran, with a response that was not JSON, so the
 * uploader could only report "Upload failed." No log, no cause, no ceiling that
 * matched the 25 MB the form advertised.
 *
 * Taking the function out of the byte path is the only way to lift that, so the
 * browser PUTs straight to storage.
 *
 * ── What the server still controls ─────────────────────────────────────────
 * Everything that matters, which is why this is not simply a hole in the wall:
 *
 *   `POST ?step=sign`      checks the permission, pins the kind to a bucket and
 *                          a visibility, *chooses the object key* and signs a
 *                          short-lived URL for that one key. The browser cannot
 *                          pick where its bytes land.
 *   `POST ?step=register`  reads the object back and runs the same magic-byte
 *                          validation and checksum the ordinary route runs, then
 *                          inserts the row and the audit entry. Anything that
 *                          fails is deleted before returning.
 *
 * So a signed URL is a permit to write one key that the server named, and bytes
 * that never pass validation never become a media asset — they are removed.
 *
 * ── Scope ──────────────────────────────────────────────────────────────────
 * Publication file kinds only: the PDF, the archival original and the source
 * archive. Those are the large ones, and they are stored byte-for-byte, so
 * nothing here has to reproduce the image pipeline. An image still goes through
 * the ordinary route, where sharp re-encodes it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Long enough for a slow connection to finish a 25 MB PUT, and no longer. */
const SIGNED_URL_TTL_SECONDS = 15 * 60;

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

  const step = request.nextUrl.searchParams.get("step");

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const kindRaw = String(payload.kind ?? "");
  if (!isMediaKind(kindRaw)) return json({ ok: false, error: "unknown_kind" }, 400);
  const kind: MediaKind = kindRaw;

  /*
   * Only the byte-for-byte publication kinds. An image routed here would skip
   * `processImage()` entirely and be stored as an unstripped camera original —
   * metadata, GPS and all — which is the one thing the upload pipeline exists to
   * prevent.
   */
  if (!PUBLICATION_FILE_KINDS.has(kind)) {
    return json(
      {
        ok: false,
        error: "kind_not_supported",
        message: "Only publication files upload directly. Use the ordinary upload for images.",
      },
      400,
    );
  }

  const bucketId = (MEDIA_KIND_BUCKETS[kind] ?? "public-media") as StorageBucket;
  const visibility: "public" | "private" = isPrivateKind(kind) ? "private" : "public";

  // ── Step 1: hand back a URL for a key the server chose ────────────────────
  if (step === "sign") {
    const filename = String(payload.filename ?? "");
    const declaredSize = Number(payload.size ?? 0);
    const declaredType = resolveUploadType(filename, String(payload.contentType ?? ""));

    if (!filename) return json({ ok: false, error: "no_filename" }, 400);

    /*
     * The size is checked here on the client's word, which is worth exactly
     * what that is worth — nothing, on its own. It is a courtesy so an
     * oversized file fails before the transfer rather than after it. The
     * authoritative check is in `register`, against the bytes that actually
     * landed.
     */
    const maxBytes = uploadLimitFor(kind);
    if (declaredSize > maxBytes) {
      return json({ ok: false, error: "too_large", message: "The file is too large." }, 400);
    }

    const allowed =
      kind === "publication_source" ? PUBLICATION_SOURCE_TYPES : PUBLICATION_PDF_TYPES;

    if (!allowed.includes(declaredType as never)) {
      return json(
        {
          ok: false,
          error: "type_not_allowed",
          message:
            kind === "publication_source"
              ? "A LaTeX source archive must be a ZIP."
              : "A publication file must be a PDF.",
        },
        400,
      );
    }

    // The extension is taken from the sanitised name, so the key is ASCII and
    // cannot be steered by the caller.
    const storagePath = buildStoragePath(kind, sanitizeFilename(filename));

    const admin = createSupabaseAdminClient();
    const signed = await signUploadUrl({
      bucket: bucketId,
      storagePath,
      contentType: declaredType,
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      admin,
    });

    if (!signed) {
      return json({ ok: false, error: "sign_failed" }, 500);
    }

    return json(
      {
        ok: true,
        uploadUrl: signed.url,
        provider: signed.provider,
        storagePath,
        contentType: declaredType,
      },
      200,
    );
  }

  // ── Step 2: validate what landed, then register it ────────────────────────
  if (step === "register") {
    const storagePath = String(payload.storagePath ?? "");
    const provider = String(payload.provider ?? "") as StorageProvider;
    const filename = String(payload.filename ?? "file");

    /*
     * The key must be one this endpoint could have issued. Without this a caller
     * could register any object already in the bucket — including one belonging
     * to a different kind — and attach a `media_assets` row to it.
     */
    if (!storagePath.startsWith(`${kind}/`)) {
      return json({ ok: false, error: "path_mismatch" }, 400);
    }

    const admin = createSupabaseAdminClient();

    const buffer = await readStorageObject({
      provider,
      bucket: bucketId,
      storagePath,
      admin,
    });

    if (!buffer) return json({ ok: false, error: "object_missing" }, 404);

    const bytes = new Uint8Array(buffer);
    const declaredType = resolveUploadType(filename, String(payload.contentType ?? ""));

    /*
     * The same three checks the ordinary route runs — declared type, extension
     * and magic bytes — against the bytes that actually arrived rather than the
     * ones the client promised. This is the check that matters: everything
     * before it was the client describing itself.
     */
    const failure = validateUpload({
      filename,
      declaredType,
      size: bytes.byteLength,
      buffer: bytes,
      maxBytes: uploadLimitFor(kind),
      allowedTypes:
        kind === "publication_source" ? PUBLICATION_SOURCE_TYPES : PUBLICATION_PDF_TYPES,
    });

    if (failure) {
      // Never leave bytes that failed validation sitting in the bucket.
      await deleteStorageObject({ provider, bucket: bucketId, storagePath, admin });
      return json({ ok: false, error: failure.code, message: failure.message }, 400);
    }

    const checksum = checksumOf(bytes);

    const { data: duplicate } = await admin
      .from("media_assets")
      .select("id, original_filename")
      .eq("checksum_sha256", checksum)
      .is("deleted_at", null)
      .maybeSingle();

    if (duplicate) {
      await deleteStorageObject({ provider, bucket: bucketId, storagePath, admin });
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

    const displayName = displayFilename(filename);

    const { data: asset, error: insertError } = await admin
      .from("media_assets")
      .insert({
        bucket_id: bucketId,
        storage_path: storagePath,
        storage_provider: provider,
        kind,
        visibility,
        original_filename: displayName,
        mime_type: declaredType,
        file_size_bytes: bytes.byteLength,
        checksum_sha256: checksum,
        // A book PDF has not been read for a phone number, a QR code or a
        // pupil's work yet. Same rule as the ordinary route.
        requires_privacy_review: true,
        uploaded_by: auth.session.userId,
      })
      .select("id")
      .single();

    if (insertError || !asset) {
      await deleteStorageObject({ provider, bucket: bucketId, storagePath, admin });
      return json({ ok: false, error: "server_error" }, 500);
    }

    await writeAuditLog({
      action: "media.uploaded",
      actor: auth.session,
      entityType: "media_asset",
      entityId: asset.id,
      entityLabel: displayName,
      summary: `Uploaded ${displayName} to ${bucketId} as ${visibility} (direct).`,
      changes: { kind, bytes: bytes.byteLength, mime_type: declaredType, direct: true },
    });

    return json(
      {
        ok: true,
        id: asset.id,
        filename: displayName,
        visibility,
        bucket: bucketId,
        processed: false,
      },
      201,
    );
  }

  return json({ ok: false, error: "unknown_step" }, 400);
}
