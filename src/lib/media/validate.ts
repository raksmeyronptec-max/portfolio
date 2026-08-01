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
  /*
   * HEIC/HEIF — what every iPhone produces by default.
   *
   * Accepted because refusing it means the owner has to convert a folder of
   * holiday-format photographs by hand before they can be published, which is
   * the friction this CMS exists to remove. It is safe to accept precisely
   * because it is never *served*: `processImage()` decodes it through sharp's
   * libheif and re-encodes to WebP, so the browser only ever sees WebP and the
   * stored MIME is `image/webp`.
   *
   * That is also why HEIC is refused for the byte-for-byte kinds — see
   * `STORED_AS_IS_TYPES` below.
   */
  "image/heic",
  "image/heif",
] as const;

export const ALLOWED_DOCUMENT_TYPES = ["application/pdf"] as const;

/**
 * ZIP — LaTeX source packages, and nothing else.
 *
 * Kept in its own list rather than folded into the document types because it is
 * only ever accepted for one kind. A ZIP is an archive of arbitrary files, so
 * the reasons it is safe here are specific and worth stating:
 *
 *  · it is never expanded, parsed or executed by this application — the bytes
 *    are stored and later streamed back verbatim;
 *  · it can only be uploaded as `publication_source`, which a database CHECK
 *    pins to a private bucket, so it is never served from a public URL;
 *  · the download route sets `Content-Disposition: attachment` and
 *    `X-Content-Type-Options: nosniff`, so the browser saves it rather than
 *    trying to interpret it.
 *
 * The archive's *contents* are the owner's responsibility and the privacy
 * checklist's subject — `latexSourceWarnings()` flags build artefacts and
 * absolute paths, but nothing here can verify what is inside a ZIP without
 * expanding it, which is precisely what this refuses to do.
 */
export const ALLOWED_ARCHIVE_TYPES = ["application/zip"] as const;

export const ALLOWED_UPLOAD_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
  ...ALLOWED_ARCHIVE_TYPES,
] as const;

export type AllowedUploadType = (typeof ALLOWED_UPLOAD_TYPES)[number];

/**
 * What may be stored without re-encoding.
 *
 * A certificate original is kept byte-for-byte because it is the evidentiary
 * copy, and a resume is a PDF. Neither goes through `processImage()`, so
 * whatever arrives is what gets stored — and a stored HEIC would be a file the
 * `media_assets_mime_allowlist` CHECK rejects, that no browser but Safari can
 * display, and that the owner could never preview. So HEIC is accepted
 * everywhere the image is converted, and refused where it would be kept.
 */
export const STORED_AS_IS_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

/** What a publication's three file slots accept. PDFs, or a source archive. */
export const PUBLICATION_PDF_TYPES = ["application/pdf"] as const;
export const PUBLICATION_SOURCE_TYPES = ["application/zip"] as const;

/** Extensions permitted per MIME type. */
const EXTENSIONS: Record<AllowedUploadType, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  // Both extensions are accepted for both types: the container is the same and
  // encoders are inconsistent about which pair they emit.
  "image/heic": ["heic", "heif"],
  "image/heif": ["heif", "heic"],
  "application/pdf": ["pdf"],
  "application/zip": ["zip"],
};

/**
 * MIME type inferred from a filename extension.
 *
 * Needed because browsers do not reliably report a type for HEIC: macOS gives
 * `image/heic`, several Windows and Linux builds give an empty string, and an
 * empty `declaredType` would otherwise fail the allowlist before the magic-byte
 * check — the one check that could actually identify the file — ever ran.
 *
 * This only ever *fills in a blank*. A declared type is never overridden, and
 * the signature check still has to pass either way, so a `.png` full of HEIC
 * bytes is still rejected.
 */
const EXTENSION_TO_TYPE: Record<string, AllowedUploadType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  zip: "application/zip",
};

/**
 * The type an upload should be validated and stored as.
 *
 * Returns the browser's own value when it gave one, and otherwise the type
 * implied by the extension. Callers use the result for the allowlist check and
 * for the stored `mime_type`, so the two can never disagree.
 */
export function resolveUploadType(filename: string, declaredType: string): string {
  const declared = declaredType.trim();
  if (declared) return declared;

  return EXTENSION_TO_TYPE[fileExtension(filename)] ?? "";
}

/** ASCII helper, so the tables below read as the four-character codes they are. */
const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));

/**
 * File signatures (magic bytes).
 *
 * WebP, AVIF and HEIC are container formats, so their check needs a second
 * marker at an offset — a bare `RIFF` header is not enough to prove WebP, and a
 * bare `ftyp` box proves only "some ISO base media file", which HEIC, AVIF, MP4
 * and MOV all are.
 *
 * That last point is why `anyOf` exists. AVIF and HEIC share the `ftyp` box at
 * offset 4 and are told apart only by the *brand* at offset 8, of which each has
 * several. Previously `image/avif` checked for `ftyp` alone, which meant a HEIC
 * — or an MP4 — renamed to `.avif` and declared as AVIF passed the signature
 * check. Both are now pinned to their brand lists.
 */
type SignatureCheck =
  | { offset: number; bytes: number[] }
  /** Passes when the bytes at `offset` match any one of these sequences. */
  | { offset: number; anyOf: number[][] };

/** ISOBMFF brands that denote a HEIF-family still image. */
const HEIF_BRANDS = [
  "heic", // the common iPhone brand
  "heix",
  "heim",
  "heis",
  "hevc", // HEVC image sequences
  "hevx",
  "hevm",
  "hevs",
  "mif1", // generic HEIF image
  "msf1", // generic HEIF sequence
].map(ascii);

const AVIF_BRANDS = ["avif", "avis"].map(ascii);

const FTYP = { offset: 4, bytes: ascii("ftyp") };

const SIGNATURES: Record<AllowedUploadType, SignatureCheck[]> = {
  "image/jpeg": [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  "image/png": [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  "image/webp": [
    { offset: 0, bytes: ascii("RIFF") },
    { offset: 8, bytes: ascii("WEBP") },
  ],
  "image/avif": [FTYP, { offset: 8, anyOf: AVIF_BRANDS }],
  "image/heic": [FTYP, { offset: 8, anyOf: HEIF_BRANDS }],
  "image/heif": [FTYP, { offset: 8, anyOf: HEIF_BRANDS }],
  "application/pdf": [{ offset: 0, bytes: ascii("%PDF-") }],
  /*
   * ZIP local-file header, `PK\x03\x04`.
   *
   * The two other `PK` signatures are deliberately accepted as well: `PK\x05\x06`
   * is an empty archive and `PK\x07\x08` a spanned one. Neither is what a LaTeX
   * package should look like, but rejecting them *here* would report "the file's
   * contents do not match its extension", which is untrue and unhelpful — they
   * are genuinely ZIPs. An empty archive is a content problem, and the privacy
   * checklist is where it belongs.
   */
  "application/zip": [
    {
      offset: 0,
      anyOf: [
        [0x50, 0x4b, 0x03, 0x04],
        [0x50, 0x4b, 0x05, 0x06],
        [0x50, 0x4b, 0x07, 0x08],
      ],
    },
  ],
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

/**
 * The exception the paragraph above anticipated: a book.
 *
 * A 200-page typeset mathematics book with embedded figures does not fit in
 * 10 MB — the examination collection spanning Bac II 2002–2025 is not going to.
 * Refusing the owner's own books is not a security posture, it is a broken
 * feature, so the publication kinds get the 25 MB the `media_assets` size CHECK
 * and the storage buckets already permit.
 *
 * It is still a ceiling rather than "no limit": 25 MB is what the database
 * constraint allows, so a larger file would be rejected on insert *after* the
 * bytes had been uploaded, which is the worst possible place to find out.
 */
const MAX_PUBLICATION_BYTES = 25 * 1024 * 1024;

export const SIZE_LIMITS = {
  publicImage: MAX_UPLOAD_BYTES,
  certificatePreview: MAX_UPLOAD_BYTES,
  certificateOriginal: MAX_UPLOAD_BYTES,
  resume: MAX_UPLOAD_BYTES,
  publicationFile: MAX_PUBLICATION_BYTES,
} as const;

/** The ceiling itself, for anything that needs to display or enforce it. */
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_BYTES;
export const MAX_PUBLICATION_UPLOAD_BYTES = MAX_PUBLICATION_BYTES;

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
  /**
   * Narrows the allowlist for this upload. Defaults to everything.
   *
   * The upload route passes `STORED_AS_IS_TYPES` for the kinds it keeps
   * byte-for-byte, which is what refuses a HEIC certificate original while
   * still accepting one as a journey photograph.
   */
  allowedTypes?: readonly string[];
}): ValidationFailure | null {
  const allowed = input.allowedTypes ?? ALLOWED_UPLOAD_TYPES;

  if (input.size === 0) {
    return { code: "empty_file", message: "The file is empty." };
  }

  if (input.filename.length > 200) {
    return { code: "name_too_long", message: "The filename is too long." };
  }

  if (!isAllowedUploadType(input.declaredType) || !allowed.includes(input.declaredType)) {
    /*
     * HEIC gets its own sentence. "image/heic is not allowed" next to a list
     * that includes JPEG is baffling when the same file uploaded as a journey
     * photograph a minute earlier worked — so say which kinds keep the file
     * as-is, and why that excludes it.
     */
    const isHeif = input.declaredType === "image/heic" || input.declaredType === "image/heif";

    return {
      code: "type_not_allowed",
      message: isHeif
        ? "HEIC files are converted on upload, so they cannot be used where the original is kept byte-for-byte — a certificate original or a resume. Export this one as JPEG or PDF first."
        : /*
           * Names the types allowed for *this* upload rather than the full set.
           * A narrowed allowlist — a publication source archive accepts only
           * ZIP — otherwise produced "application/pdf is not allowed. Upload a
           * JPEG, PNG, WebP, AVIF, HEIC or PDF", which contradicts itself.
           */
          `${input.declaredType || "That file type"} is not allowed here. Upload ${describeTypes(allowed)}.`,
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

/** "a JPEG, PNG or PDF" — the allowed set, in words, for an error message. */
function describeTypes(allowed: readonly string[]): string {
  const labels = [
    ...new Set(
      allowed.map(
        (type) =>
          ({
            "image/jpeg": "JPEG",
            "image/png": "PNG",
            "image/webp": "WebP",
            "image/avif": "AVIF",
            "image/heic": "HEIC",
            "image/heif": "HEIC",
            "application/pdf": "PDF",
            "application/zip": "ZIP",
          })[type] ?? type,
      ),
    ),
  ];

  if (labels.length === 0) return "a supported file";
  if (labels.length === 1) return `a ${labels[0]}`;
  return `a ${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

function matchesSignature(buffer: Uint8Array, type: AllowedUploadType): boolean {
  const matchesAt = (offset: number, expected: number[]): boolean => {
    if (buffer.length < offset + expected.length) return false;
    return expected.every((byte, index) => buffer[offset + index] === byte);
  };

  return SIGNATURES[type].every((check) =>
    "anyOf" in check
      ? check.anyOf.some((candidate) => matchesAt(check.offset, candidate))
      : matchesAt(check.offset, check.bytes),
  );
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
