import { describe, expect, it } from "vitest";

import { atLeast, isAdminRole, permissions } from "@/lib/auth/roles";
import { safeInternalPath } from "@/lib/auth/guards";
import {
  acceptAttributeFor,
  buildStoragePath,
  displayFilename,
  fileExtension,
  isAllowedUploadType,
  sanitizeFilename,
  SIZE_LIMITS,
  MAX_UPLOAD_SIZE_BYTES,
  uploadLimitFor,
  validateUpload,
} from "@/lib/media/validate";
import { isPrivateKind, MEDIA_KINDS } from "@/lib/media/kinds";
import { publicStorageUrl, resolveImage, type MediaAsset } from "@/lib/content/media";
import {
  classifyBrowser,
  classifyDevice,
  destinationHost,
  referrerHost,
} from "@/lib/analytics/events";

/**
 * Security-relevant unit tests.
 *
 * These cover the checks that cannot be verified by the RLS suite because they live
 * in application code: role predicates, redirect validation, upload validation and
 * the rule that a private asset never yields a public URL.
 */

// ── Roles ───────────────────────────────────────────────────────────────────

describe("role predicates", () => {
  it("recognises only the three real roles", () => {
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("editor")).toBe(true);
    expect(isAdminRole("viewer")).toBe(true);
    expect(isAdminRole("admin")).toBe(false);
    expect(isAdminRole("")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });

  it("returns false for a null role rather than undefined", () => {
    // The SQL equivalent of this bug — NULL instead of false — was caught by the RLS
    // suite. This pins the TypeScript side of the same contract.
    expect(atLeast(null, "viewer")).toBe(false);
    expect(permissions.viewAdmin(null)).toBe(false);
    expect(permissions.editContent(null)).toBe(false);
    expect(permissions.hardDelete(null)).toBe(false);
  });

  it("ranks roles correctly", () => {
    expect(atLeast("viewer", "viewer")).toBe(true);
    expect(atLeast("viewer", "editor")).toBe(false);
    expect(atLeast("editor", "viewer")).toBe(true);
    expect(atLeast("editor", "owner")).toBe(false);
    expect(atLeast("owner", "owner")).toBe(true);
  });

  it("keeps a viewer strictly read-only", () => {
    expect(permissions.viewAdmin("viewer")).toBe(true);
    expect(permissions.viewAnalytics("viewer")).toBe(true);
    expect(permissions.viewMessages("viewer")).toBe(true);
    expect(permissions.editContent("viewer")).toBe(false);
    expect(permissions.publishContent("viewer")).toBe(false);
    expect(permissions.uploadMedia("viewer")).toBe(false);
    expect(permissions.manageMessages("viewer")).toBe(false);
  });

  it("keeps private originals and user management owner-only", () => {
    expect(permissions.viewPrivateOriginals("editor")).toBe(false);
    expect(permissions.viewPrivateOriginals("owner")).toBe(true);
    expect(permissions.manageAdmins("editor")).toBe(false);
    expect(permissions.manageSettings("editor")).toBe(false);
    expect(permissions.hardDelete("editor")).toBe(false);
    expect(permissions.deleteContent("editor")).toBe(false);
  });

  it("lets an editor manage content but not delete it", () => {
    expect(permissions.editContent("editor")).toBe(true);
    expect(permissions.publishContent("editor")).toBe(true);
    expect(permissions.archiveContent("editor")).toBe(true);
    expect(permissions.deleteContent("editor")).toBe(false);
  });
});

// ── Redirect validation ─────────────────────────────────────────────────────

describe("safeInternalPath", () => {
  it("accepts an internal admin path", () => {
    expect(safeInternalPath("/admin/projects")).toBe("/admin/projects");
    expect(safeInternalPath("/admin/certificates/new")).toBe("/admin/certificates/new");
  });

  it("rejects absolute URLs", () => {
    expect(safeInternalPath("https://evil.example/admin")).toBeNull();
    expect(safeInternalPath("http://evil.example")).toBeNull();
  });

  it("rejects protocol-relative URLs", () => {
    // `//evil.example` is a valid absolute URL to a browser.
    expect(safeInternalPath("//evil.example/admin")).toBeNull();
  });

  it("rejects backslash tricks", () => {
    expect(safeInternalPath("/admin\\..\\evil")).toBeNull();
  });

  it("rejects paths outside /admin", () => {
    expect(safeInternalPath("/en/projects")).toBeNull();
    expect(safeInternalPath("/api/contact")).toBeNull();
  });

  it("rejects the login page itself to avoid a redirect loop", () => {
    expect(safeInternalPath("/admin/login")).toBeNull();
  });

  it("rejects empty and nullish input", () => {
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
    expect(safeInternalPath("")).toBeNull();
    expect(safeInternalPath("admin/projects")).toBeNull();
  });
});

// ── Upload validation ───────────────────────────────────────────────────────

const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const WEBP_HEADER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe("upload type allowlist", () => {
  it("allows the image formats and PDF", () => {
    expect(isAllowedUploadType("image/jpeg")).toBe(true);
    expect(isAllowedUploadType("image/png")).toBe(true);
    expect(isAllowedUploadType("image/webp")).toBe(true);
    expect(isAllowedUploadType("image/avif")).toBe(true);
    expect(isAllowedUploadType("application/pdf")).toBe(true);
  });

  it("excludes SVG", () => {
    // An SVG is XML that can carry <script>; serving one from our origin would grant
    // same-origin script execution.
    expect(isAllowedUploadType("image/svg+xml")).toBe(false);
  });

  it("excludes anything executable or unknown", () => {
    expect(isAllowedUploadType("text/html")).toBe(false);
    expect(isAllowedUploadType("application/javascript")).toBe(false);
    expect(isAllowedUploadType("application/octet-stream")).toBe(false);
    expect(isAllowedUploadType("")).toBe(false);
  });
});

describe("validateUpload", () => {
  const base = {
    filename: "photo.jpg",
    declaredType: "image/jpeg",
    size: 1024,
    buffer: JPEG_HEADER,
    maxBytes: SIZE_LIMITS.publicImage,
  };

  it("accepts a genuine JPEG", () => {
    expect(validateUpload(base)).toBeNull();
  });

  it("accepts PNG, WebP and PDF with matching signatures", () => {
    expect(
      validateUpload({
        ...base,
        filename: "a.png",
        declaredType: "image/png",
        buffer: PNG_HEADER,
      }),
    ).toBeNull();

    expect(
      validateUpload({
        ...base,
        filename: "a.webp",
        declaredType: "image/webp",
        buffer: WEBP_HEADER,
      }),
    ).toBeNull();

    expect(
      validateUpload({
        ...base,
        filename: "scan.pdf",
        declaredType: "application/pdf",
        buffer: PDF_HEADER,
      }),
    ).toBeNull();
  });

  it("rejects a disallowed type", () => {
    expect(
      validateUpload({ ...base, filename: "x.svg", declaredType: "image/svg+xml" })
        ?.code,
    ).toBe("type_not_allowed");
  });

  it("rejects an extension that disagrees with the declared type", () => {
    expect(
      validateUpload({ ...base, filename: "photo.png", declaredType: "image/jpeg" })
        ?.code,
    ).toBe("extension_mismatch");
  });

  it("rejects a file whose CONTENTS do not match its extension", () => {
    // The important case: a script renamed to .png with a spoofed Content-Type
    // passes the first two checks and is caught by the magic-byte check.
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");

    expect(
      validateUpload({
        ...base,
        filename: "evil.png",
        declaredType: "image/png",
        buffer: html,
      })?.code,
    ).toBe("signature_mismatch");
  });

  it("rejects a PDF disguised as a JPEG", () => {
    expect(
      validateUpload({ ...base, buffer: PDF_HEADER })?.code,
    ).toBe("signature_mismatch");
  });

  it("rejects an oversized file", () => {
    expect(
      validateUpload({ ...base, size: SIZE_LIMITS.publicImage + 1 })?.code,
    ).toBe("too_large");
  });

  it("rejects an empty file", () => {
    expect(validateUpload({ ...base, size: 0 })?.code).toBe("empty_file");
  });

  it("rejects a truncated buffer that cannot contain a signature", () => {
    expect(
      validateUpload({ ...base, buffer: new Uint8Array([0xff]) })?.code,
    ).toBe("signature_mismatch");
  });
});

describe("sanitizeFilename", () => {
  it("strips path separators", () => {
    expect(sanitizeFilename("../../etc/passwd.png")).not.toContain("/");
    expect(sanitizeFilename("..\\..\\windows\\file.png")).not.toContain("\\");
  });

  it("keeps the extension", () => {
    expect(sanitizeFilename("My Photo.JPG")).toBe("my-photo.jpg");
    expect(fileExtension(sanitizeFilename("scan.pdf"))).toBe("pdf");
  });

  it("removes characters that could break a header", () => {
    const result = sanitizeFilename('bad"name\nhere.png');
    expect(result).not.toContain('"');
    expect(result).not.toContain("\n");
  });

  it("never returns an empty base name", () => {
    expect(sanitizeFilename("...png").length).toBeGreaterThan(0);
    expect(sanitizeFilename("!!!.jpg")).toBe("file.jpg");
  });

  it("caps the length", () => {
    expect(sanitizeFilename(`${"a".repeat(300)}.png`).length).toBeLessThanOrEqual(85);
  });
});

describe("buildStoragePath", () => {
  it("namespaces by kind and date and adds a random prefix", () => {
    const path = buildStoragePath("certificate_original", "scan.pdf");
    expect(path).toMatch(
      /^certificate_original\/\d{4}\/\d{2}\/[0-9a-f]{8}-scan\.pdf$/,
    );
  });

  it("produces a different path for the same filename each time", () => {
    // Two uploads of "certificate.pdf" must not collide.
    const a = buildStoragePath("other", "certificate.pdf");
    const b = buildStoragePath("other", "certificate.pdf");
    expect(a).not.toBe(b);
  });

  it("cannot be made to traverse out of its prefix", () => {
    const path = buildStoragePath("other", "../../secret.png");
    expect(path.startsWith("other/")).toBe(true);
    expect(path).not.toContain("..");
  });
});

describe("media kinds", () => {
  it("marks certificate originals and resumes as private", () => {
    expect(isPrivateKind("certificate_original")).toBe(true);
    expect(isPrivateKind("resume_file")).toBe(true);
  });

  /*
   * All three publication file levels are private — including `publication_pdf`,
   * the one readers download.
   *
   * That is deliberate rather than an over-tightening. The publication's
   * `pdf_download_policy` can say `signed`, `on_request` or `contact_author`,
   * and none of those can be enforced against an object with a permanent public
   * URL. The download route is the enforcement point; the bucket stays shut.
   * Migration 0026 states the same rule as a CHECK constraint.
   */
  it("marks every publication file level as private", () => {
    expect(isPrivateKind("publication_pdf")).toBe(true);
    expect(isPrivateKind("publication_original")).toBe(true);
    expect(isPrivateKind("publication_source")).toBe(true);
  });

  it("keeps publication covers and sample pages public", () => {
    // These are ordinary images the listing renders directly; nothing is gained
    // by routing them through a handler.
    expect(isPrivateKind("publication_cover")).toBe(false);
    expect(isPrivateKind("publication_page")).toBe(false);
  });

  it("marks everything else as public", () => {
    const privateKinds = new Set([
      "certificate_original",
      "resume_file",
      "publication_pdf",
      "publication_original",
      "publication_source",
    ]);

    for (const kind of MEDIA_KINDS) {
      if (privateKinds.has(kind)) continue;
      expect(isPrivateKind(kind), `${kind} should be public`).toBe(false);
    }
  });
});

// ── Private assets never yield a public URL ──────────────────────────────────

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset-1",
    bucket_id: "public-media",
    storage_path: "project_cover/2026/01/abc-file.webp",
    storage_provider: "supabase",
    visibility: "public",
    mime_type: "image/webp",
    file_size_bytes: 1000,
    width: 1200,
    height: 800,
    blur_data_url: null,
    thumbnail_path: null,
    card_path: null,
    preview_path: null,
    alt_text_en: "Alt",
    alt_text_km: "អាល់",
    caption_en: null,
    caption_km: null,
    ...overrides,
  };
}

/*
 * The picker has to offer the file the server would accept.
 *
 * These two functions exist because the form and the route drifted: the route
 * learned the publication kinds and the uploader did not, so selecting
 * "Publication PDF" left every PDF greyed out in the file picker — the upload
 * was impossible from the UI while being perfectly valid at the endpoint. The
 * pairing is asserted here so a future kind cannot be added to one side only.
 */
describe("accept attribute matches what the server will take", () => {
  it("offers PDFs for both reader-facing and archival publication files", () => {
    for (const kind of ["publication_pdf", "publication_original"] as const) {
      const accept = acceptAttributeFor(kind);
      expect(accept, kind).toContain("application/pdf");
      expect(accept, kind).toContain(".pdf");
    }
  });

  it("offers only a ZIP for a LaTeX source archive", () => {
    const accept = acceptAttributeFor("publication_source");
    expect(accept).toContain("application/zip");
    // Offering a PDF here would let an editor fill a slot whose database CHECK
    // requires a source archive.
    expect(accept).not.toContain("application/pdf");
  });

  it("does not offer a PDF for an image kind", () => {
    expect(acceptAttributeFor("publication_cover")).not.toContain("application/pdf");
    expect(acceptAttributeFor("project_cover")).not.toContain("application/pdf");
  });

  it("keeps HEIC selectable by extension for kinds that convert it", () => {
    // Several platforms report no MIME type for HEIC, so a MIME-only accept
    // greys the file out in the picker.
    expect(acceptAttributeFor("journey_photo")).toContain(".heic");
  });

  it("does not offer HEIC where the file is kept byte-for-byte", () => {
    for (const kind of [
      "certificate_original",
      "resume_file",
      "publication_pdf",
      "publication_original",
    ] as const) {
      expect(acceptAttributeFor(kind), kind).not.toContain(".heic");
    }
  });
});

describe("uploadLimitFor", () => {
  it("gives publication files the larger ceiling", () => {
    for (const kind of [
      "publication_pdf",
      "publication_original",
      "publication_source",
    ] as const) {
      expect(uploadLimitFor(kind), kind).toBe(SIZE_LIMITS.publicationFile);
    }
  });

  it("gives everything else the common ceiling", () => {
    for (const kind of ["project_cover", "journey_photo", "publication_cover"] as const) {
      expect(uploadLimitFor(kind), kind).toBe(MAX_UPLOAD_SIZE_BYTES);
    }
  });

  it("fails closed to the common ceiling for an unrecognised kind", () => {
    expect(uploadLimitFor("something_new")).toBe(MAX_UPLOAD_SIZE_BYTES);
  });
});

describe("upload size ceiling", () => {
  it("is 10 MB for every kind except a publication file", () => {
    /*
     * One number the form, the route, the buckets and the CHECK constraint all
     * agree on. A per-kind limit is what made a rejected upload look arbitrary.
     *
     * Publications are the one documented exception: a 200-page typeset
     * mathematics book with embedded figures does not fit in 10 MB, and refusing
     * the owner's own books is a broken feature rather than a security posture.
     * 25 MB is what `media_assets_size_limit` and the storage buckets already
     * permit, so nothing downstream has to change to accept it.
     */
    for (const [kind, limit] of Object.entries(SIZE_LIMITS)) {
      if (kind === "publicationFile") continue;
      expect(limit, `${kind} should share the common ceiling`).toBe(
        MAX_UPLOAD_SIZE_BYTES,
      );
    }

    expect(MAX_UPLOAD_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(SIZE_LIMITS.publicationFile).toBe(25 * 1024 * 1024);
  });

  it("keeps the publication ceiling inside what the database will accept", () => {
    // `media_assets_size_limit` is 25 MiB. A larger app-side ceiling would mean
    // the bytes upload and *then* the row insert fails — the worst place to find
    // out, because the object is already written.
    expect(SIZE_LIMITS.publicationFile).toBeLessThanOrEqual(26214400);
  });

  it("rejects a file one byte over, for every kind", () => {
    for (const limit of Object.values(SIZE_LIMITS)) {
      expect(
        validateUpload({
          filename: "photo.jpg",
          declaredType: "image/jpeg",
          size: limit + 1,
          buffer: JPEG_HEADER,
          maxBytes: limit,
        })?.code,
      ).toBe("too_large");
    }
  });
});

describe("publicStorageUrl", () => {
  it("builds a URL for a public bucket", () => {
    const url = publicStorageUrl("public-media", "a/b.webp", "supabase");
    expect(url).toContain("/storage/v1/object/public/public-media/");
  });

  it("builds a URL for the certificate-previews bucket", () => {
    expect(
      publicStorageUrl("certificate-previews", "a/b.webp", "supabase"),
    ).toContain("certificate-previews");
  });

  it("returns null for a missing path", () => {
    expect(publicStorageUrl("public-media", null, "supabase")).toBeNull();
    expect(publicStorageUrl("public-media", undefined, "supabase")).toBeNull();
  });

  it("encodes each path segment", () => {
    const url = publicStorageUrl(
      "public-media",
      "folder name/file name.webp",
      "supabase",
    );
    expect(url).toContain("folder%20name/file%20name.webp");
  });

  /*
   * The load-bearing assertion, and the reason it is parameterised over both
   * backends: there must be no code path that produces a public link to a raw
   * certificate scan or a resume file, whichever storage holds it.
   *
   * On Cloudflare R2 this matters more than it did on Supabase, not less. R2 has
   * no per-object access control — public access is a property of the whole
   * bucket — so the private files live in a physically separate bucket that has
   * no public URL at all, and this function must refuse to address them through
   * the public one.
   */
  for (const provider of ["supabase", "r2"] as const) {
    describe(`on ${provider}`, () => {
      it("refuses to build a URL for a private bucket", () => {
        expect(
          publicStorageUrl("certificate-originals", "a/scan.pdf", provider),
        ).toBeNull();
        expect(publicStorageUrl("resumes", "a/cv.pdf", provider)).toBeNull();
        expect(publicStorageUrl("admin-uploads", "a/temp.png", provider)).toBeNull();
      });
    });
  }

  it("addresses R2 objects under their logical bucket prefix", () => {
    // The logical bucket is the first key segment, which is what lets
    // `storage_path` keep meaning the same thing in both backends.
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL = "https://cdn.example.test";
    expect(publicStorageUrl("public-media", "a/b.webp", "r2")).toBe(
      "https://cdn.example.test/public-media/a/b.webp",
    );
    delete process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  });

  it("returns null for an R2 asset when no public URL is configured", () => {
    const saved = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    delete process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    expect(publicStorageUrl("public-media", "a/b.webp", "r2")).toBeNull();
    if (saved !== undefined) process.env.NEXT_PUBLIC_R2_PUBLIC_URL = saved;
  });
});

describe("resolveImage", () => {
  it("resolves a public asset", () => {
    const image = resolveImage(makeAsset(), "en", "card");
    expect(image).not.toBeNull();
    expect(image?.alt).toBe("Alt");
  });

  it("returns null for a private asset regardless of the requested size", () => {
    const privateAsset = makeAsset({
      visibility: "private",
      bucket_id: "certificate-originals",
    });

    for (const size of ["thumbnail", "card", "preview", "original"] as const) {
      expect(resolveImage(privateAsset, "en", size)).toBeNull();
    }
  });

  it("returns null for a nullish asset", () => {
    expect(resolveImage(null, "en")).toBeNull();
    expect(resolveImage(undefined, "en")).toBeNull();
  });

  it("uses the locale-appropriate alt text", () => {
    expect(resolveImage(makeAsset(), "km")?.alt).toBe("អាល់");
  });

  it("falls back to an empty alt rather than undefined", () => {
    const asset = makeAsset({ alt_text_en: null, alt_text_km: null });
    expect(resolveImage(asset, "en")?.alt).toBe("");
  });
});

// ── Analytics classification ────────────────────────────────────────────────

describe("analytics classification", () => {
  it("identifies bots so they are not counted as visitors", () => {
    expect(classifyDevice("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe("bot");
    expect(classifyDevice("Lighthouse")).toBe("bot");
    expect(classifyDevice("HeadlessChrome/120")).toBe("bot");
  });

  it("buckets devices coarsely", () => {
    expect(classifyDevice("iPhone; CPU iPhone OS 17_0 like Mac OS X Mobile")).toBe(
      "mobile",
    );
    expect(classifyDevice("iPad; CPU OS 17_0")).toBe("tablet");
    expect(classifyDevice("Macintosh; Intel Mac OS X 10_15_7")).toBe("desktop");
    expect(classifyDevice(null)).toBe("unknown");
  });

  it("distinguishes Chrome-based browsers in the right order", () => {
    // Every Chromium UA mentions Safari, and Edge mentions Chrome.
    expect(classifyBrowser("Mozilla/5.0 Chrome/120 Safari/537 Edg/120")).toBe("Edge");
    expect(classifyBrowser("Mozilla/5.0 Chrome/120 Safari/537")).toBe("Chrome");
    expect(classifyBrowser("Mozilla/5.0 Version/17 Safari/605")).toBe("Safari");
    expect(classifyBrowser("Mozilla/5.0 Firefox/121")).toBe("Firefox");
  });

  it("reduces a referrer to a host and drops self-referrals", () => {
    expect(referrerHost("https://google.com/search?q=secret", "portfolio.test")).toBe(
      "google.com",
    );
    // Internal navigation must not pollute the acquisition report.
    expect(referrerHost("https://portfolio.test/en", "portfolio.test")).toBeNull();
    expect(referrerHost(null, "portfolio.test")).toBeNull();
    expect(referrerHost("not a url", "portfolio.test")).toBeNull();
  });

  it("never retains a full referring URL", () => {
    // Another site's query string can contain their users' data.
    const host = referrerHost("https://example.com/page?token=abc123", "portfolio.test");
    expect(host).toBe("example.com");
    expect(host).not.toContain("token");
  });

  it("extracts a destination host for outbound clicks", () => {
    expect(destinationHost("https://www.krusmart.org/login")).toBe("www.krusmart.org");
    expect(destinationHost("mailto:x@y.z")).toBeNull();
    expect(destinationHost("garbage")).toBeNull();
  });
});

/*
 * A Khmer filename must survive to the library and to the reader's disk.
 *
 * `sanitizeFilename` reduces anything outside [a-z0-9._-] to a hyphen, which is
 * right for a storage key and destructive for a label: a Khmer name has no ASCII
 * in it at all, so it collapsed to the "file" fallback and every one of the
 * owner's three books uploaded as file.pdf — indistinguishable in the media
 * library, and the name every reader would have downloaded.
 */
describe("displayFilename", () => {
  it("keeps a Khmer filename intact", () => {
    const name = "\u179f\u17d2\u179c\u17c9\u17b8\u178f\u1793\u17c3\u1785\u17c6\u1793\u17bd\u1793\u1796\u17b7\u178f.pdf";
    expect(displayFilename(name)).toBe(name);
  });

  it("leaves the storage key ASCII, which is a different job", () => {
    const name = "\u1780\u17d2\u179a\u17b6\u1794\u1793\u17c3\u17a2\u1793\u17bb\u1782\u1798\u1793\u17cd.pdf";
    expect(displayFilename(name)).toBe(name);
    // The key becomes a URL path segment and an S3 object key.
    expect(sanitizeFilename(name)).toMatch(/^[a-z0-9._-]+$/);
  });

  it("tells the three books apart, which the sanitised name could not", () => {
    const books = [
      "\u1780\u1798\u17d2\u179a\u1784\u179c\u17b7\u1789\u17d2\u1789\u17b6\u179f\u17b6.pdf",
      "\u1780\u17d2\u179a\u17b6\u1794\u1793\u17c3\u17a2\u1793\u17bb\u1782\u1798\u1793\u17cd.pdf",
      "\u179f\u17d2\u179c\u17c9\u17b8\u178f\u1793\u17c3\u1785\u17c6\u1793\u17bd\u1793\u1796\u17b7\u178f.pdf",
    ];
    expect(new Set(books.map(displayFilename)).size).toBe(3);
    // The defect: all three sanitise to the same fallback.
    expect(new Set(books.map(sanitizeFilename)).size).toBe(1);
  });

  it("strips path separators and quotes", () => {
    expect(displayFilename("../../etc/passwd")).not.toContain("/");
    expect(displayFilename('a"b.pdf')).not.toContain('"');
  });

  it("falls back rather than returning an empty label", () => {
    expect(displayFilename("")).toBe("file");
    expect(displayFilename("///")).not.toBe("");
  });
});
