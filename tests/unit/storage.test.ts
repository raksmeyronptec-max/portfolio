import { describe, expect, it } from "vitest";

import {
  isPublicBucket,
  isStorageBucket,
  isStorageProvider,
  r2BucketFor,
  r2KeyFor,
  storageBuckets,
  type StorageBucket,
} from "@/lib/storage/buckets";

/**
 * The public/private split is the whole safety property of the R2 move.
 *
 * Supabase gave every object a per-object policy. R2 does not: public access is
 * a property of the *bucket*, so the only thing standing between a certificate
 * scan and the open internet is which bucket it was written to. These tests pin
 * that mapping, because a one-line change to it would be a silent data leak
 * with no other symptom.
 */

const BUCKETS = { publicBucket: "site-media", privateBucket: "site-private" };

describe("logical buckets", () => {
  it("recognises exactly the known buckets", () => {
    expect([...storageBuckets]).toEqual([
      "public-media",
      "certificate-previews",
      "certificate-originals",
      "resumes",
      "publication-previews",
      "publication-files",
      "publication-originals",
      "publication-sources",
    ]);
    expect(isStorageBucket("public-media")).toBe(true);
    expect(isStorageBucket("admin-uploads")).toBe(false);
    expect(isStorageBucket("")).toBe(false);
  });

  it("treats only the display buckets as public", () => {
    expect(isPublicBucket("public-media")).toBe(true);
    expect(isPublicBucket("certificate-previews")).toBe(true);
    // Covers and rendered sample pages — images the listing shows directly.
    expect(isPublicBucket("publication-previews")).toBe(true);

    expect(isPublicBucket("certificate-originals")).toBe(false);
    expect(isPublicBucket("resumes")).toBe(false);
  });

  /*
   * The three publication file levels, asserted together.
   *
   * `publication-files` holds the PDF readers are *meant* to download, and it is
   * still private — which reads backwards until you follow the request path. A
   * publication carries a download policy whose values include `signed`,
   * `on_request` and `contact_author`, and none of those can be true of an
   * object anybody can fetch by URL. So access is decided by
   * `/api/publications/[slug]/download`, and the bucket stays shut.
   *
   * If a future change makes any of these public, this test is the alarm.
   */
  it("keeps every publication file level private, including the downloadable PDF", () => {
    expect(isPublicBucket("publication-files")).toBe(false);
    expect(isPublicBucket("publication-originals")).toBe(false);
    expect(isPublicBucket("publication-sources")).toBe(false);
  });

  it("fails closed for an unknown bucket name", () => {
    // A typo must not accidentally publish. Anything unrecognised is private.
    expect(isPublicBucket("public-medai")).toBe(false);
    expect(isPublicBucket("")).toBe(false);
  });
});

describe("r2BucketFor", () => {
  it("routes certificate originals and resumes to the private bucket", () => {
    expect(r2BucketFor("certificate-originals", BUCKETS)).toBe("site-private");
    expect(r2BucketFor("resumes", BUCKETS)).toBe("site-private");
  });

  it("routes display media to the public bucket", () => {
    expect(r2BucketFor("public-media", BUCKETS)).toBe("site-media");
    expect(r2BucketFor("certificate-previews", BUCKETS)).toBe("site-media");
  });

  it("never puts a private logical bucket in the public physical bucket", () => {
    for (const bucket of storageBuckets) {
      if (isPublicBucket(bucket)) continue;
      expect(r2BucketFor(bucket as StorageBucket, BUCKETS)).not.toBe(
        BUCKETS.publicBucket,
      );
    }
  });
});

describe("r2KeyFor", () => {
  it("prefixes the key with the logical bucket", () => {
    // This is what lets `media_assets.storage_path` keep meaning "path within
    // its logical bucket" in both backends, so no existing row had to change.
    expect(r2KeyFor("public-media", "projects/a/cover.webp")).toBe(
      "public-media/projects/a/cover.webp",
    );
    expect(r2KeyFor("certificate-originals", "2026/01/scan.pdf")).toBe(
      "certificate-originals/2026/01/scan.pdf",
    );
  });
});

describe("isStorageProvider", () => {
  it("accepts only the two known backends", () => {
    expect(isStorageProvider("supabase")).toBe(true);
    expect(isStorageProvider("r2")).toBe(true);
    expect(isStorageProvider("s3")).toBe(false);
    expect(isStorageProvider("")).toBe(false);
  });
});

/**
 * PDFs and public buckets.
 *
 * The upload route rejects a PDF whenever the resolved visibility is public.
 * That rule used to be belt-and-braces: Supabase storage also enforced a
 * per-bucket MIME allowlist that had no `application/pdf` entry for the public
 * buckets. Cloudflare R2 has no equivalent, so the route check is now the only
 * thing standing between "Other" and a permanently addressable public PDF.
 *
 * These assertions describe the bucket routing that check depends on.
 */
describe("PDF routing", () => {
  const publicKinds = ["public-media", "certificate-previews"] as const;
  const privateKinds = ["certificate-originals", "resumes"] as const;

  it("keeps the two PDF-carrying buckets private", () => {
    // `resumes` holds the CV, `certificate-originals` the raw scans. Both are
    // read server-side or through a signed URL, never from a public origin.
    for (const bucket of privateKinds) {
      expect(isPublicBucket(bucket)).toBe(false);
      expect(r2BucketFor(bucket, BUCKETS)).toBe(BUCKETS.privateBucket);
    }
  });

  it("keeps every public bucket out of the private one, and vice versa", () => {
    for (const bucket of publicKinds) {
      expect(r2BucketFor(bucket, BUCKETS)).toBe(BUCKETS.publicBucket);
      expect(r2BucketFor(bucket, BUCKETS)).not.toBe(BUCKETS.privateBucket);
    }
  });
});
