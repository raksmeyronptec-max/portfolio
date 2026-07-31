/**
 * Upload validation.
 *
 * Three independent checks, because any one of them alone is bypassable:
 *
 *  1. **Declared MIME type** — trivially spoofed by the client, so it is only the
 *     first filter.
 *  2. **File extension** — must agree with the declared type.
 *  3. **Magic bytes** — the actual file signature, read from the buffer. This is
 *     the check that matters: a PHP script renamed to `.png` with
 *     `Content-Type: image/png` passes the first two and fails this one.
 *
 * SVG is deliberately excluded from uploads even though the bucket allows it for
 * pre-existing assets: an SVG is an XML document that can carry `<script>`, and
 * serving one from our own origin would hand an attacker same-origin script
 * execution. There is no use case here that requires it.
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const ALLOWED_DOCUMENT_TYPES = ["application/pdf"] as const;

export const ALLOWED_UPLOAD_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
] as const;

export type AllowedUploadType = (typeof ALLOWED_UPLOAD_TYPES)[number];

/** Extensions permitted per MIME type. */
const EXTENSIONS: Record<AllowedUploadType, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  "application/pdf": ["pdf"],
};

/**
 * File signatures (magic bytes).
 *
 * WebP and AVIF are container formats, so their signature check needs a second
 * marker at an offset — a bare `RIFF` header is not enough to prove WebP.
 */
const SIGNATURES: Record<
  AllowedUploadType,
  Array<{ offset: number; bytes: number[]; mask?: number[] }>
> = {
  "image/jpeg": [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  "image/png": [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  "image/webp": [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // "WEBP"
  ],
  "image/avif": [
    { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // "ftyp"
  ],
  "application/pdf": [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }], // "%PDF-"
};

/**
 * One upload ceiling for every kind: 10 MB.
 *
 * Previously each kind had its own limit (8 MB for a certificate preview, 25 MB
 * for an original), which meant an upload could be rejected for a reason the
 * editor had no way to predict from the UI. A single number is explainable, and
 * it is the number the storage bucket, the database CHECK constraint and the
 * upload form all state.
 *
 * The per-kind keys are kept rather than collapsed into a single constant so the
 * upload route still reads as "this kind, this limit" — and so a future kind
 * that genuinely needs a different ceiling has somewhere to say so.
 *
 * Note what this does *not* change: a certificate original is still stored
 * byte-for-byte with no re-encoding. It just has to arrive under 10 MB. A 300 dpi
 * A4 colour scan can exceed that, so scan at 200 dpi or as greyscale if one is
 * rejected — the readable evidence survives either.
 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const SIZE_LIMITS = {
  publicImage: MAX_UPLOAD_BYTES,
  certificatePreview: MAX_UPLOAD_BYTES,
  certificateOriginal: MAX_UPLOAD_BYTES,
  resume: MAX_UPLOAD_BYTES,
} as const;

/** The ceiling itself, for anything that needs to display or enforce it. */
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_BYTES;

export type ValidationFailure = {
  code:
    | "type_not_allowed"
    | "extension_mismatch"
    | "signature_mismatch"
    | "too_large"
    | "empty_file"
    | "name_too_long";
  message: string;
};

export function isAllowedUploadType(value: string): value is AllowedUploadType {
  return (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(value);
}

export function fileExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

/**
 * Validate an upload against all three checks.
 *
 * @param buffer the first kilobyte is sufficient for the signature check, but the
 *               whole buffer is accepted for convenience.
 */
export function validateUpload(input: {
  filename: string;
  declaredType: string;
  size: number;
  buffer: Uint8Array;
  maxBytes: number;
}): ValidationFailure | null {
  if (input.size === 0) {
    return { code: "empty_file", message: "The file is empty." };
  }

  if (input.filename.length > 200) {
    return { code: "name_too_long", message: "The filename is too long." };
  }

  if (!isAllowedUploadType(input.declaredType)) {
    return {
      code: "type_not_allowed",
      message: `${input.declaredType || "That file type"} is not allowed. Upload a JPEG, PNG, WebP, AVIF or PDF.`,
    };
  }

  if (input.size > input.maxBytes) {
    return {
      code: "too_large",
      message: `The file is ${formatBytes(input.size)}; the limit is ${formatBytes(input.maxBytes)}.`,
    };
  }

  const extension = fileExtension(input.filename);
  if (!EXTENSIONS[input.declaredType].includes(extension)) {
    return {
      code: "extension_mismatch",
      message: `A ${input.declaredType} file should have one of these extensions: ${EXTENSIONS[input.declaredType].join(", ")}.`,
    };
  }

  if (!matchesSignature(input.buffer, input.declaredType)) {
    return {
      code: "signature_mismatch",
      // Deliberately blunt: this is the case where someone renamed a file, and the
      // message should say so rather than being vaguely technical.
      message:
        "The file's contents do not match its extension. It may be renamed or corrupted.",
    };
  }

  return null;
}

function matchesSignature(buffer: Uint8Array, type: AllowedUploadType): boolean {
  const checks = SIGNATURES[type];

  return checks.every((check) => {
    if (buffer.length < check.offset + check.bytes.length) return false;
    return check.bytes.every(
      (byte, index) => buffer[check.offset + index] === byte,
    );
  });
}

/**
 * Produce a safe storage filename.
 *
 * Strips path separators, control characters and anything outside a conservative
 * allowlist, collapses runs of separators, and caps the length. The result is only
 * ever used as the final segment of a storage key that is otherwise generated, so
 * traversal is impossible even before this runs — this exists so the stored name
 * stays readable and cannot break a `Content-Disposition` header later.
 */
export function sanitizeFilename(filename: string): string {
  const extension = fileExtension(filename);

  const base = filename
    .slice(0, filename.length - (extension ? extension.length + 1 : 0))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 80);

  const safeBase = base || "file";
  return extension ? `${safeBase}.${extension}` : safeBase;
}

/** Storage key: `<scope>/<yyyy>/<mm>/<random>-<safe-name>`. */
export function buildStoragePath(scope: string, filename: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  // A random prefix means two uploads of "certificate.pdf" never collide, and a
  // storage key cannot be guessed from the filename alone.
  const random = crypto.randomUUID().slice(0, 8);

  return `${scope}/${year}/${month}/${random}-${sanitizeFilename(filename)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
