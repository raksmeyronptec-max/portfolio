import "server-only";

import { createHash } from "node:crypto";
import sharp, { type Sharp } from "sharp";

/**
 * Server-side image processing.
 *
 * What happens to every public image on upload:
 *  1. Metadata is stripped. EXIF on a phone photo routinely contains GPS
 *     coordinates and a device serial — publishing that alongside a portrait is a
 *     privacy leak nobody intends.
 *  2. Three derivatives are generated (thumbnail / card / preview) so the browser
 *     is never sent a 4000px original to display at 400px.
 *  3. Everything is re-encoded to WebP. One format, predictable size, and
 *     re-encoding also neutralises anything hidden in the original container.
 *  4. A tiny blurred placeholder is produced for `next/image`, which is what
 *     removes the layout-shift-on-load problem.
 *  5. A SHA-256 checksum is computed for duplicate detection.
 *
 * Private originals are deliberately NOT processed: a certificate scan must be
 * stored exactly as it arrived, because it is the evidentiary copy.
 */

export type ProcessedDerivative = {
  suffix: string;
  buffer: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
};

export type ProcessedImage = {
  /** Re-encoded full-size image, metadata stripped. */
  main: { buffer: Buffer; contentType: "image/webp"; width: number; height: number };
  derivatives: ProcessedDerivative[];
  blurDataUrl: string | null;
  checksum: string;
};

/** Derivative widths, matching the `sizes` attributes used in the components. */
const DERIVATIVES = [
  { suffix: "thumb", width: 200 },
  { suffix: "card", width: 800 },
  { suffix: "preview", width: 1600 },
] as const;

/** Cap on the stored full-size image. Nothing on this site displays wider. */
const MAX_DIMENSION = 2400;

/** Shared sharp options: reject a truncated upload, and cap decoded pixels. */
const SHARP_OPTIONS = { failOn: "truncated", limitInputPixels: 40_000_000 } as const;

/**
 * True when the bytes are a HEIF-family still image (`ftyp` + a HEIF brand).
 *
 * AVIF shares the same container, and sharp reads AVIF natively, so the AVIF
 * brands are deliberately excluded here — routing AVIF through the HEIC decoder
 * would be slower and pointless.
 */
function isHeic(input: Uint8Array): boolean {
  if (input.length < 12) return false;

  const at = (offset: number, text: string) =>
    [...text].every((char, index) => input[offset + index] === char.charCodeAt(0));

  if (!at(4, "ftyp")) return false;

  return ["heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs", "mif1", "msf1"].some(
    (brand) => at(8, brand),
  );
}

/**
 * A decoded source that sharp can read.
 *
 * ── Why HEIC needs its own decoder ─────────────────────────────────────────
 * Every iPhone shoots HEIC by default, so refusing it would mean the owner
 * converting a folder by hand before anything could be published. But sharp's
 * prebuilt libvips ships libheif with an AV1 decoder only — there is no HEVC
 * decoder in it, for patent reasons. The failure mode is nasty: `metadata()`
 * succeeds and even reports `compression: 'hevc'`, because parsing the container
 * needs no codec, and only the *pixel* read then fails with an opaque
 * "bad seek" error. Feature-detecting on `sharp.format.heif.input` is therefore
 * a false positive — it is true for AVIF.
 *
 * So HEIC is decoded by `heic-decode` (libheif + libde265, compiled to WASM) to
 * raw RGBA, and sharp takes it from there. The import is dynamic so the decoder
 * is only loaded when a HEIC actually arrives; the common JPEG path never pays
 * for it.
 *
 * Two consequences worth knowing:
 *  · raw RGBA carries no metadata at all, so EXIF — including GPS — is gone by
 *    construction rather than by `.rotate()` stripping it;
 *  · libheif applies the container's own `irot`/`imir` rotation during decode,
 *    so the pixels arrive upright and there is no EXIF orientation left to act
 *    on. `.rotate()` becomes a no-op on this path, which is correct.
 */
type DecodedSource = {
  /** Builds a fresh sharp instance over the source. */
  open: () => Sharp;
  width: number;
  height: number;
};

async function decodeSource(input: Uint8Array): Promise<DecodedSource> {
  if (isHeic(input)) {
    const { default: decode } = await import("heic-decode");

    let frame;
    try {
      frame = await decode({ buffer: Buffer.from(input) });
    } catch (cause) {
      throw new Error(
        `This HEIC file could not be decoded. It may be a multi-image “Live Photo” or be corrupt. ${
          cause instanceof Error ? cause.message : ""
        }`.trim(),
      );
    }

    const { width, height, data } = frame;

    if (width * height > 40_000_000) {
      throw new Error("Could not read the image dimensions.");
    }

    const raw = Buffer.from(data.buffer, data.byteOffset, data.byteLength);

    return {
      open: () => sharp(raw, { raw: { width, height, channels: 4 } }),
      width,
      height,
    };
  }

  const metadata = await sharp(input, SHARP_OPTIONS).metadata();

  return {
    open: () => sharp(input, SHARP_OPTIONS),
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

export async function processImage(input: Uint8Array): Promise<ProcessedImage> {
  const checksum = createHash("sha256").update(input).digest("hex");

  // Computed from the *source* bytes, so duplicate detection identifies the file
  // the owner actually has, not the derived WebP.
  const source = await decodeSource(input);
  const sourceWidth = source.width;
  const sourceHeight = source.height;

  if (sourceWidth === 0 || sourceHeight === 0) {
    throw new Error("Could not read the image dimensions.");
  }

  // `rotate()` with no argument applies the EXIF orientation and then discards it,
  // so a portrait phone photo is not stored sideways once metadata is stripped.
  const mainPipeline = source
    .open()
    .rotate()
    .resize({
      width: Math.min(sourceWidth, MAX_DIMENSION),
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 });

  const mainResult = await mainPipeline.toBuffer({ resolveWithObject: true });

  const derivatives: ProcessedDerivative[] = [];

  for (const derivative of DERIVATIVES) {
    // Skip a derivative that would be an upscale of the source.
    if (derivative.width > sourceWidth * 1.1) continue;

    const result = await source
      .open()
      .rotate()
      .resize({ width: derivative.width, withoutEnlargement: true })
      .webp({ quality: derivative.suffix === "thumb" ? 72 : 80, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    derivatives.push({
      suffix: derivative.suffix,
      buffer: result.data,
      contentType: "image/webp",
      width: result.info.width,
      height: result.info.height,
    });
  }

  return {
    main: {
      buffer: mainResult.data,
      contentType: "image/webp",
      width: mainResult.info.width,
      height: mainResult.info.height,
    },
    derivatives,
    blurDataUrl: await generateBlurPlaceholder(source),
    checksum,
  };
}

/**
 * A 16px-wide blurred data URL for `next/image`'s `placeholder="blur"`.
 *
 * Kept deliberately tiny — it is inlined into the HTML, so a large placeholder
 * would trade one performance problem for another. Returns null on failure rather
 * than throwing: a missing placeholder is cosmetic, a failed upload is not.
 */
async function generateBlurPlaceholder(source: DecodedSource): Promise<string | null> {
  try {
    const buffer = await source
      .open()
      .rotate()
      .resize(16, 16, { fit: "inside" })
      .webp({ quality: 40 })
      .toBuffer();

    return `data:image/webp;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Checksum for an unprocessed file (private originals, PDFs). */
export function checksumOf(input: Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Dimensions of an image without re-encoding it.
 *
 * Used for private originals, which are stored byte-for-byte but whose dimensions
 * are still worth recording for the admin listing.
 */
export async function readDimensions(
  input: Uint8Array,
): Promise<{ width: number | null; height: number | null }> {
  try {
    const metadata = await sharp(input, { failOn: "none" }).metadata();
    return { width: metadata.width ?? null, height: metadata.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

/**
 * Suggest a redacted preview from an original.
 *
 * Deliberately NOT automatic redaction — that is not something a library can do
 * reliably, and pretending otherwise would be dangerous. This only downscales and
 * re-encodes, producing a starting point that the admin must still redact by hand.
 * The privacy checklist in the UI is explicit that this is a manual step.
 */
export async function derivePreviewCandidate(
  input: Uint8Array,
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  try {
    const result = await sharp(input, { failOn: "truncated" })
      .rotate()
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: result.data,
      width: result.info.width,
      height: result.info.height,
    };
  } catch {
    return null;
  }
}
