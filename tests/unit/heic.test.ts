/**
 * @vitest-environment node
 *
 * Node, not the suite-wide jsdom. `heic-decode` bundles libheif as WASM and
 * selects a browser code path when it sees a DOM, which then rejects a Node
 * Buffer with "Cannot pass non-string to std::string". The server runtime this
 * code actually runs in is Node, so jsdom would be testing a path that never
 * executes in production — and failing on it.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { processImage } from "@/lib/media/process";
import {
  resolveUploadType,
  validateUpload,
  STORED_AS_IS_TYPES,
} from "@/lib/media/validate";

/**
 * HEIC support.
 *
 * These run against a real HEIC file rather than a synthetic header, because the
 * failure this feature exists to prevent was invisible to a header check: sharp
 * parses the HEIC *container* happily and only fails on the pixel read. A test
 * that stopped at `metadata()` would have passed while every real upload broke.
 */

/** Header of a real single-image HEIC: `ftyp` + the `heic` brand. */
function heicHeader(brand = "heic"): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x00, 0x00, 0x00, 0x20], 0); // box size
  bytes.set([...("ftyp" + brand)].map((c) => c.charCodeAt(0)), 4);
  return bytes;
}

/**
 * A real single-image HEIC, 532 bytes, committed so this runs everywhere.
 *
 * It has to be a genuine HEVC-coded file: the bug this guards against is that
 * the container parses fine and only the pixel decode fails, so a hand-written
 * header would pass while every real photograph broke.
 */
const SAMPLE = new URL("../fixtures/sample.heic", import.meta.url).pathname;

function sample(): Buffer | null {
  try {
    return readFileSync(SAMPLE);
  } catch {
    return null;
  }
}

describe("HEIC validation", () => {
  it("accepts a HEIC file declared as image/heic", () => {
    expect(
      validateUpload({
        filename: "IMG_8277.HEIC",
        declaredType: "image/heic",
        size: 40_000,
        buffer: heicHeader(),
        maxBytes: 10 * 1024 * 1024,
      }),
    ).toBeNull();
  });

  it("accepts an uppercase .HEIC extension", () => {
    // The screenshot that prompted this had both IMG_8277.HEIC and IMG_8327.heic.
    for (const filename of ["IMG_8277.HEIC", "IMG_8327.heic", "photo.HEIF"]) {
      expect(
        validateUpload({
          filename,
          declaredType: "image/heic",
          size: 40_000,
          buffer: heicHeader(),
          maxBytes: 10 * 1024 * 1024,
        }),
        filename,
      ).toBeNull();
    }
  });

  it("accepts every HEIF still brand", () => {
    for (const brand of ["heic", "heix", "heim", "heis", "mif1", "msf1"]) {
      expect(
        validateUpload({
          filename: "x.heic",
          declaredType: "image/heic",
          size: 40_000,
          buffer: heicHeader(brand),
          maxBytes: 10 * 1024 * 1024,
        }),
        brand,
      ).toBeNull();
    }
  });

  it("infers image/heic when the browser reports no type at all", () => {
    // Several Windows and Linux builds send an empty string for HEIC.
    expect(resolveUploadType("IMG_8277.HEIC", "")).toBe("image/heic");
    expect(resolveUploadType("shot.heif", "")).toBe("image/heif");
    // A type the browser did state is never overridden.
    expect(resolveUploadType("odd.heic", "image/png")).toBe("image/png");
  });

  it("still rejects a HEIC renamed to .png", () => {
    const failure = validateUpload({
      filename: "sneaky.png",
      declaredType: "image/png",
      size: 40_000,
      buffer: heicHeader(),
      maxBytes: 10 * 1024 * 1024,
    });
    expect(failure?.code).toBe("signature_mismatch");
  });

  it("no longer lets a HEIC pass as AVIF", () => {
    /*
     * Regression: the AVIF signature used to check for the `ftyp` box alone,
     * which every ISO base media file has — so a HEIC, an MP4 or a MOV declared
     * as AVIF passed. Both are now pinned to their brand lists.
     */
    const failure = validateUpload({
      filename: "sneaky.avif",
      declaredType: "image/avif",
      size: 40_000,
      buffer: heicHeader(),
      maxBytes: 10 * 1024 * 1024,
    });
    expect(failure?.code).toBe("signature_mismatch");
  });

  it("refuses HEIC where the file would be stored byte-for-byte", () => {
    const failure = validateUpload({
      filename: "IMG_8277.HEIC",
      declaredType: "image/heic",
      size: 40_000,
      buffer: heicHeader(),
      maxBytes: 10 * 1024 * 1024,
      allowedTypes: STORED_AS_IS_TYPES,
    });

    expect(failure?.code).toBe("type_not_allowed");
    // The message has to explain the inconsistency, not just refuse.
    expect(failure?.message).toMatch(/converted on upload/i);
  });
});

describe("HEIC decoding", () => {
  const buffer = sample();

  it.skipIf(!buffer)(
    "decodes a real HEIC and re-encodes it to WebP with derivatives",
    async () => {
      const result = await processImage(new Uint8Array(buffer!));

      // The thing sharp alone could not do.
      expect(result.main.contentType).toBe("image/webp");
      expect(result.main.width).toBeGreaterThan(0);
      expect(result.main.buffer.byteLength).toBeGreaterThan(0);

      // WebP magic bytes — proof the output really is WebP, not passed through.
      const header = result.main.buffer;
      expect(String.fromCharCode(...header.subarray(0, 4))).toBe("RIFF");
      expect(String.fromCharCode(...header.subarray(8, 12))).toBe("WEBP");

      expect(result.derivatives.length).toBeGreaterThan(0);
      for (const derivative of result.derivatives) {
        expect(derivative.contentType).toBe("image/webp");
        expect(derivative.buffer.byteLength).toBeGreaterThan(0);
      }

      expect(result.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
      expect(result.checksum).toMatch(/^[0-9a-f]{64}$/);
    },
    60_000,
  );

  it.skipIf(!buffer)(
    "checksums the source bytes, not the converted output",
    async () => {
      // Duplicate detection must identify the file the owner actually has.
      const { createHash } = await import("node:crypto");
      const expected = createHash("sha256").update(buffer!).digest("hex");

      const result = await processImage(new Uint8Array(buffer!));
      expect(result.checksum).toBe(expected);
    },
    60_000,
  );
});
