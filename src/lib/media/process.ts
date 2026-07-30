import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";

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

export async function processImage(input: Uint8Array): Promise<ProcessedImage> {
  const checksum = createHash("sha256").update(input).digest("hex");

  // `failOn: "truncated"` rejects a partially uploaded file rather than storing a
  // half-decoded image. `limitInputPixels` guards against decompression bombs —
  // a small file that expands to gigabytes of raw pixels.
  const base = sharp(input, {
    failOn: "truncated",
    limitInputPixels: 40_000_000,
  });

  const metadata = await base.metadata();
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;

  if (sourceWidth === 0 || sourceHeight === 0) {
    throw new Error("Could not read the image dimensions.");
  }

  // `rotate()` with no argument applies the EXIF orientation and then discards it,
  // so a portrait phone photo is not stored sideways once metadata is stripped.
  const mainPipeline = sharp(input, { failOn: "truncated", limitInputPixels: 40_000_000 })
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

    const result = await sharp(input, {
      failOn: "truncated",
      limitInputPixels: 40_000_000,
    })
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
    blurDataUrl: await generateBlurPlaceholder(input),
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
async function generateBlurPlaceholder(input: Uint8Array): Promise<string | null> {
  try {
    const buffer = await sharp(input, { failOn: "truncated" })
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
