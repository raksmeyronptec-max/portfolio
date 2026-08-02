import { describe, expect, it } from "vitest";

import {
  buildBibTeX,
  buildCitation,
  citationKey,
  containsLocalPath,
  isLatexBuildArtefact,
  latexSourceWarnings,
  licenseImplications,
  licenseUrl,
  publicationChapterSchema,
  publicationErrorLabels,
  publicationPublishBlockers,
  publicationPublishWarnings,
  publicationMediaSchema,
  publicationSchema,
  publicationVersionSchema,
  resolvePublicationAccess,
  type LicenseType,
} from "@/lib/validation/publication";

/**
 * Publications — the rules that would be expensive to get wrong.
 *
 * Weighted towards the two places this feature can actually cause harm: a
 * download policy that hands out a file it should not, and generated text that
 * asserts something nobody verified.
 */

const validPublication = {
  slug: "graphs-of-functions",
  status: "draft" as const,
  publicationTypeId: null,
  featured: false,
  displayOrder: 0,
  contentLanguage: "km" as const,
  editionLabel: "",
  editionNumber: "",
  publicationYear: "",
  publicationDate: "",
  pageCount: "",
  subjectEn: "",
  subjectKm: "",
  gradeLevelEn: "",
  gradeLevelKm: "",
  readingLevel: null,
  coverMediaId: null,
  previewPolicy: "sample_pages" as const,
  previewPageLimit: "",
  pdfDownloadPolicy: "none" as const,
  sampleDownloadPolicy: "none" as const,
  sourcePolicy: "private" as const,
  sourceRepositoryUrl: "",
  licenseType: "all_rights_reserved" as const,
  copyrightHolder: "",
  copyrightYear: "",
  allowRedistribution: false,
  allowModification: false,
  typesetWithLatex: true,
  latexEngine: null,
  documentClass: "",
  buildYear: "",
  isbn: "",
  doi: "",
  externalUrl: "",
  privacyStatus: "pending_review" as const,
  privacyReviewNote: "",
  needsReview: false,
  reviewNote: "",
  noindex: false,
  translations: [{ locale: "en" as const, title: "Graphs of Functions" }],
};

const parse = (overrides: Record<string, unknown> = {}) =>
  publicationSchema.safeParse({ ...validPublication, ...overrides });

// ── Slug ────────────────────────────────────────────────────────────────────

describe("publication slug", () => {
  it("accepts lowercase, digits and hyphens", () => {
    expect(parse({ slug: "bac-ii-2002-2025" }).success).toBe(true);
  });

  it.each([
    ["uppercase", "Graphs"],
    ["spaces", "graphs of functions"],
    ["underscores", "graphs_of_functions"],
    ["a leading slash", "/graphs"],
    ["Khmer script", "ក្រាបនៃអនុគមន៍"],
  ])("rejects %s", (_label, slug) => {
    expect(parse({ slug }).success).toBe(false);
  });

  it("rejects a one-character slug", () => {
    expect(parse({ slug: "a" }).success).toBe(false);
  });
});

// ── Identifiers ─────────────────────────────────────────────────────────────

describe("identifiers are never invented", () => {
  it("accepts a blank ISBN — the seeded books have none", () => {
    expect(parse({ isbn: "" }).success).toBe(true);
  });

  it("rejects an ISBN that is obviously not one", () => {
    expect(parse({ isbn: "not-an-isbn" }).success).toBe(false);
    expect(parse({ isbn: "12" }).success).toBe(false);
  });

  it("accepts a real-shaped ISBN-13 with hyphens", () => {
    expect(parse({ isbn: "978-9924-00-000-1" }).success).toBe(true);
  });

  it("rejects a DOI that does not start with a registrant prefix", () => {
    expect(parse({ doi: "doi:whatever" }).success).toBe(false);
    expect(parse({ doi: "10.1000/xyz123" }).success).toBe(true);
  });
});

// ── Access policy coherence ─────────────────────────────────────────────────

describe("preview and source policy", () => {
  it("refuses first_pages without a page limit", () => {
    /*
     * Without a limit the preview route would have nothing to truncate to and
     * would serve the whole book — the exact outcome the policy exists to
     * prevent.
     */
    const result = parse({ previewPolicy: "first_pages", previewPageLimit: "" });
    expect(result.success).toBe(false);
  });

  it("accepts first_pages with a limit inside the ceiling", () => {
    expect(
      parse({ previewPolicy: "first_pages", previewPageLimit: "5" }).success,
    ).toBe(true);
  });

  it("refuses a preview limit above 25", () => {
    expect(
      parse({ previewPolicy: "first_pages", previewPageLimit: "200" }).success,
    ).toBe(false);
  });

  it("refuses external_repo without a repository URL", () => {
    expect(parse({ sourcePolicy: "external_repo" }).success).toBe(false);
    expect(
      parse({
        sourcePolicy: "external_repo",
        sourceRepositoryUrl: "https://github.com/example/book",
      }).success,
    ).toBe(true);
  });

  it("refuses an http repository URL", () => {
    expect(
      parse({
        sourcePolicy: "external_repo",
        sourceRepositoryUrl: "http://github.com/example/book",
      }).success,
    ).toBe(false);
  });
});

// ── resolvePublicationAccess ────────────────────────────────────────────────

const accessInput = {
  previewPolicy: "sample_pages" as const,
  previewPageLimit: null,
  pdfDownloadPolicy: "none" as const,
  sampleDownloadPolicy: "none" as const,
  sourcePolicy: "private" as const,
  sourceRepositoryUrl: null,
  hasPdf: true,
  hasSourceArchive: true,
  hasSamplePages: true,
};

describe("resolvePublicationAccess", () => {
  it("never offers a download when the policy is none", () => {
    const access = resolvePublicationAccess(accessInput);
    expect(access.canDownloadPdf).toBe(false);
    expect(access.showPdfRequestCta).toBe(false);
  });

  it.each(["on_request", "contact_author"] as const)(
    "shows a contact prompt rather than a download for %s",
    (policy) => {
      const access = resolvePublicationAccess({
        ...accessInput,
        pdfDownloadPolicy: policy,
      });
      expect(access.canDownloadPdf).toBe(false);
      expect(access.showPdfRequestCta).toBe(true);
    },
  );

  it("never offers a download when the edition has no PDF", () => {
    /*
     * The gate that stops a button that 404s. A policy of `public` is a
     * permission, not a promise that the file exists.
     */
    const access = resolvePublicationAccess({
      ...accessInput,
      pdfDownloadPolicy: "public",
      hasPdf: false,
    });
    expect(access.canDownloadPdf).toBe(false);
  });

  it("keeps the LaTeX source shut by default", () => {
    expect(resolvePublicationAccess(accessInput).canDownloadSource).toBe(false);
  });

  it("does not open the source for on_request — that means ask the author", () => {
    const access = resolvePublicationAccess({
      ...accessInput,
      sourcePolicy: "on_request",
    });
    expect(access.canDownloadSource).toBe(false);
    expect(access.showSourceRequestCta).toBe(true);
  });

  it("opens the source only for an explicit public policy", () => {
    expect(
      resolvePublicationAccess({ ...accessInput, sourcePolicy: "public" })
        .canDownloadSource,
    ).toBe(true);
  });

  it("does not preview sample pages when there are none", () => {
    expect(
      resolvePublicationAccess({ ...accessInput, hasSamplePages: false }).canPreview,
    ).toBe(false);
  });

  it("defaults an unset first_pages limit to five rather than to everything", () => {
    const access = resolvePublicationAccess({
      ...accessInput,
      previewPolicy: "first_pages",
      previewPageLimit: null,
    });
    expect(access.previewPageLimit).toBe(5);
  });

  it("reports no page limit for a full preview", () => {
    const access = resolvePublicationAccess({
      ...accessInput,
      previewPolicy: "full",
    });
    expect(access.previewPageLimit).toBeNull();
  });
});

// ── Editions ────────────────────────────────────────────────────────────────

const validVersion = {
  publicationId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  versionLabel: "First edition",
  editionNumber: "1",
  publicationYear: "2025",
  publicationDate: "",
  pageCount: "37",
  pdfMediaId: null,
  originalMediaId: null,
  sourceArchiveMediaId: null,
  changelogEn: "",
  changelogKm: "",
  isActive: true,
  status: "draft" as const,
};

describe("edition files", () => {
  const asset = (n: number) => `3f2504e0-4f89-41d3-9a0c-0305e82c330${n}`;

  it("refuses the same file as both the public PDF and the archival original", () => {
    /*
     * The single most consequential mistake available here: it means the
     * redaction step silently did not happen, and the unredacted book is what
     * readers download.
     */
    const result = publicationVersionSchema.safeParse({
      ...validVersion,
      pdfMediaId: asset(1),
      originalMediaId: asset(1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toContain("pdfIsAlsoOriginal");
    }
  });

  it("accepts three distinct files", () => {
    expect(
      publicationVersionSchema.safeParse({
        ...validVersion,
        pdfMediaId: asset(1),
        originalMediaId: asset(2),
        sourceArchiveMediaId: asset(3),
      }).success,
    ).toBe(true);
  });

  it("refuses to publish an edition with no PDF", () => {
    expect(
      publicationVersionSchema.safeParse({
        ...validVersion,
        status: "published",
        pdfMediaId: null,
      }).success,
    ).toBe(false);
  });

  it("allows a draft edition with no PDF — that is how one is prepared", () => {
    expect(
      publicationVersionSchema.safeParse({ ...validVersion, status: "draft" }).success,
    ).toBe(true);
  });
});

// ── Chapters ────────────────────────────────────────────────────────────────

describe("chapter page ranges", () => {
  const base = {
    publicationId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    chapterNumber: "1",
    titleEn: "Sequences",
    titleKm: "",
    descriptionEn: "",
    descriptionKm: "",
    startPage: "1",
    endPage: "12",
    sortOrder: 0,
  };

  it("accepts an ordered range", () => {
    expect(publicationChapterSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an end page before the start page", () => {
    expect(
      publicationChapterSchema.safeParse({ ...base, startPage: "12", endPage: "1" })
        .success,
    ).toBe(false);
  });

  it("requires a title in at least one language", () => {
    expect(
      publicationChapterSchema.safeParse({ ...base, titleEn: "", titleKm: "" }).success,
    ).toBe(false);
  });

  it("accepts a Khmer-only chapter title", () => {
    expect(
      publicationChapterSchema.safeParse({
        ...base,
        titleEn: "",
        titleKm: "ស្វ៊ីតនៃចំនួនពិត",
      }).success,
    ).toBe(true);
  });

  it("accepts a non-numeric chapter number, because real books have them", () => {
    expect(
      publicationChapterSchema.safeParse({ ...base, chapterNumber: "មេរៀនទី ១" }).success,
    ).toBe(true);
  });
});

// ── Sample pages ────────────────────────────────────────────────────────────

describe("sample page attachments", () => {
  const base = {
    publicationId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    mediaAssetId: "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
    role: "sample_page" as const,
    sortOrder: 0,
    pageNumber: "7",
    captionEn: "",
    captionKm: "",
    altTextEn: "A worked example on convergence",
    altTextKm: "",
    visibility: "public" as const,
  };

  it("requires a page number for a sample page", () => {
    expect(publicationMediaSchema.safeParse({ ...base, pageNumber: "" }).success).toBe(
      false,
    );
  });

  it("does not require a page number for a gallery image", () => {
    expect(
      publicationMediaSchema.safeParse({ ...base, role: "gallery", pageNumber: "" })
        .success,
    ).toBe(true);
  });

  it("requires English alt text before an image goes public", () => {
    expect(publicationMediaSchema.safeParse({ ...base, altTextEn: "" }).success).toBe(
      false,
    );
  });

  it("allows missing alt text while the image is private", () => {
    expect(
      publicationMediaSchema.safeParse({ ...base, altTextEn: "", visibility: "private" })
        .success,
    ).toBe(true);
  });
});

// ── Publish blockers ────────────────────────────────────────────────────────

describe("publicationPublishBlockers", () => {
  const ready = {
    needsReview: false,
    privacyStatus: "approved" as const,
    hasEnglishTitle: true,
    pdfDownloadPolicy: "none" as const,
    hasActiveVersion: true,
    activeVersionHasPdf: true,
    activeVersionPublished: true,
  };

  it("reports nothing when everything is in place", () => {
    expect(publicationPublishBlockers(ready)).toEqual([]);
  });

  it("blocks on a pending privacy review", () => {
    expect(
      publicationPublishBlockers({ ...ready, privacyStatus: "pending_review" }),
    ).toContain("privacyPending");
  });

  it("blocks on a rejected privacy review", () => {
    expect(
      publicationPublishBlockers({ ...ready, privacyStatus: "rejected" }),
    ).toContain("privacyRejected");
  });

  it("blocks when the download policy promises a file that is not there", () => {
    expect(
      publicationPublishBlockers({
        ...ready,
        pdfDownloadPolicy: "public",
        activeVersionHasPdf: false,
      }),
    ).toContain("activeVersionHasNoPdf");
  });

  /*
   * The gap that shipped: the gate read publication_versions directly and the
   * public page reads public_publication_versions, which filters out an
   * unpublished edition. A publication could pass the gate and still render no
   * download button, with nothing logged.
   */
  it("blocks when the active edition is complete but still a draft", () => {
    expect(
      publicationPublishBlockers({
        ...ready,
        pdfDownloadPolicy: "public",
        activeVersionPublished: false,
      }),
    ).toContain("activeVersionNotPublished");
  });

  it("reports one reason at a time, most fundamental first", () => {
    // No edition at all should not also complain that it has no PDF.
    const none = publicationPublishBlockers({
      ...ready,
      pdfDownloadPolicy: "public",
      hasActiveVersion: false,
      activeVersionHasPdf: false,
      activeVersionPublished: false,
    });
    expect(none).toContain("noActiveVersion");
    expect(none).not.toContain("activeVersionHasNoPdf");
  });

  it("does not complain about a missing PDF when nothing is offered", () => {
    expect(
      publicationPublishBlockers({
        ...ready,
        pdfDownloadPolicy: "none",
        activeVersionHasPdf: false,
        activeVersionPublished: false,
      }),
    ).toEqual([]);
  });

  it("has a human-readable label for every blocker it can emit", () => {
    const emitted = new Set([
      ...publicationPublishBlockers({
        needsReview: true,
        privacyStatus: "pending_review",
        hasEnglishTitle: false,
        pdfDownloadPolicy: "public",
        hasActiveVersion: false,
        activeVersionHasPdf: false,
        activeVersionPublished: false,
      }),
      ...publicationPublishBlockers({ ...ready, privacyStatus: "rejected" }),
      ...publicationPublishBlockers({
        ...ready,
        pdfDownloadPolicy: "signed",
        activeVersionHasPdf: false,
      }),
      ...publicationPublishBlockers({
        ...ready,
        pdfDownloadPolicy: "public",
        activeVersionPublished: false,
      }),
    ]);

    expect(emitted.size).toBeGreaterThan(0);
    for (const code of emitted) {
      expect(publicationErrorLabels[code], `missing label for ${code}`).toBeTruthy();
    }
  });
});

// ── Publish gate, mirrored in the schema ────────────────────────────────────

describe("publishing rules in the schema", () => {
  it("refuses to publish without an approved privacy review", () => {
    const result = parse({ status: "published", privacyStatus: "pending_review" });
    expect(result.success).toBe(false);
  });

  it("refuses to publish while flagged as needing review", () => {
    expect(
      parse({ status: "published", privacyStatus: "approved", needsReview: true }).success,
    ).toBe(false);
  });

  it("refuses to publish with only a Khmer title", () => {
    expect(
      parse({
        status: "published",
        privacyStatus: "approved",
        translations: [{ locale: "km", title: "ក្រាបនៃអនុគមន៍" }],
      }).success,
    ).toBe(false);
  });

  it("publishes when the privacy review is approved and English exists", () => {
    expect(parse({ status: "published", privacyStatus: "approved" }).success).toBe(true);
  });
});

// ── Local paths in public text ──────────────────────────────────────────────

describe("containsLocalPath", () => {
  it.each([
    "/Users/macbookpro/Downloads/book/main.tex",
    "Built from ~/Documents/book",
    "C:\\Users\\Ron\\book",
    "See file:///tmp/output.log",
    "Sources in Desktop/latex",
    "/home/ron/projects/book",
  ])("flags %s", (text) => {
    expect(containsLocalPath(text)).toBe(true);
  });

  it.each([
    "Typeset with XeLaTeX using the book class.",
    "Figures were drawn with TikZ.",
    "រៀបចំដោយប្រើ LaTeX",
    "Compiled in 2025.",
  ])("leaves %s alone", (text) => {
    expect(containsLocalPath(text)).toBe(false);
  });

  it("refuses production notes that name the author's machine", () => {
    const result = parse({
      translations: [
        {
          locale: "en",
          title: "Graphs of Functions",
          productionNotes: "Built from /Users/macbookpro/Downloads/book/main.tex",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ── LaTeX source hygiene ────────────────────────────────────────────────────

describe("latexSourceWarnings", () => {
  it("flags build artefacts, which record absolute paths", () => {
    const warnings = latexSourceWarnings([
      "main.tex",
      "main.aux",
      "main.log",
      "main.synctex.gz",
      "chapters/one.tex",
    ]);

    const artefacts = warnings.find((w) => w.code === "buildArtefacts");
    expect(artefacts?.files).toEqual(["main.aux", "main.log", "main.synctex.gz"]);
  });

  it("flags things that should never be in an archive", () => {
    const warnings = latexSourceWarnings(["main.tex", ".env", "id_rsa"]);
    expect(warnings.find((w) => w.code === "possibleSecrets")?.files).toEqual([
      ".env",
      "id_rsa",
    ]);
  });

  it("flags bundled fonts, whose redistribution rights are rarely checked", () => {
    const warnings = latexSourceWarnings(["main.tex", "fonts/KhmerOS.ttf"]);
    expect(warnings.find((w) => w.code === "bundledFonts")?.files).toEqual([
      "fonts/KhmerOS.ttf",
    ]);
  });

  it("says nothing about a clean archive", () => {
    expect(
      latexSourceWarnings([
        "README.md",
        "main.tex",
        "chapters/sequences.tex",
        "images/figure-1.pdf",
        "styles/book.sty",
        "LICENSE",
      ]),
    ).toEqual([]);
  });

  it("recognises the multi-part .synctex.gz extension", () => {
    expect(isLatexBuildArtefact("book.synctex.gz")).toBe(true);
    expect(isLatexBuildArtefact("book.tex")).toBe(false);
    expect(isLatexBuildArtefact("figure.pdf")).toBe(false);
  });
});

// ── Citation ────────────────────────────────────────────────────────────────

describe("buildCitation", () => {
  const full = {
    authorName: "Ron Raksmey",
    originalTitle: "ក្រាបនៃអនុគមន៍",
    title: "Graphs of Functions",
    editionLabel: "First edition",
    editionNumber: 1,
    publicationYear: 2025,
    isbn: null,
    doi: null,
    url: null,
  };

  it("uses the book's own title, which is what finds the object", () => {
    expect(buildCitation(full)).toBe("Ron Raksmey. ក្រាបនៃអនុគមន៍. First edition, 2025.");
  });

  it("omits what it does not know rather than inventing it", () => {
    /*
     * The rule the whole feature turns on. No "n.p.", no "n.d.", no inferred
     * publisher — a short citation is correct, an invented one is a false claim.
     */
    const citation = buildCitation({
      ...full,
      editionLabel: null,
      editionNumber: null,
      publicationYear: null,
    });

    expect(citation).toBe("Ron Raksmey. ក្រាបនៃអនុគមន៍.");
    expect(citation).not.toMatch(/n\.d\.|n\.p\.|unknown|undefined|null/i);
  });

  it("never names a publisher, because these are self-published", () => {
    expect(buildCitation(full)).not.toMatch(/press|publisher|publishing/i);
  });

  it("falls back to the translated title when there is no original", () => {
    expect(buildCitation({ ...full, originalTitle: null })).toContain(
      "Graphs of Functions",
    );
  });

  it("prefers a DOI over a bare URL", () => {
    const citation = buildCitation({
      ...full,
      doi: "10.1000/xyz",
      url: "https://example.org/book",
    });
    expect(citation).toContain("https://doi.org/10.1000/xyz");
    expect(citation).not.toContain("example.org");
  });

  it("derives an edition label from a number when none was written", () => {
    expect(buildCitation({ ...full, editionLabel: null })).toContain("1st edition");
  });
});

describe("buildBibTeX", () => {
  const base = {
    authorName: "Ron Raksmey",
    originalTitle: "ស្វ៊ីតនៃចំនួនពិត",
    title: "Sequences of Real Numbers",
    editionLabel: "First edition",
    editionNumber: 1,
    publicationYear: 2025,
    isbn: null,
    doi: null,
    url: null,
    citationKey: "sequencesofrealnumbers2025",
  };

  it("produces an entry when author, title and year are all known", () => {
    const entry = buildBibTeX(base);
    expect(entry).toContain("@book{sequencesofrealnumbers2025,");
    expect(entry).toContain("author = {Ron Raksmey}");
    expect(entry).toContain("year = {2025}");
  });

  it("returns null rather than a broken entry when the year is unknown", () => {
    /*
     * BibTeX `@book` needs author, title and year. An entry missing one renders
     * as a broken reference in whatever document it lands in, so no button is
     * better than a bad one.
     */
    expect(buildBibTeX({ ...base, publicationYear: null })).toBeNull();
    expect(buildBibTeX({ ...base, authorName: null })).toBeNull();
  });

  it("never emits a publisher field", () => {
    expect(buildBibTeX(base)).not.toContain("publisher");
  });

  it("passes Khmer through untouched", () => {
    expect(buildBibTeX(base)).toContain("ស្វ៊ីតនៃចំនួនពិត");
  });

  it("escapes the characters that would break a field", () => {
    const entry = buildBibTeX({ ...base, title: "Cost & Value {100%}", originalTitle: null });
    expect(entry).toContain("\\&");
    expect(entry).toContain("\\%");
    expect(entry).toContain("\\{");
  });

  it("builds an ASCII-only citation key from a slug and a year", () => {
    expect(citationKey("sequences-of-real-numbers", 2025)).toBe(
      "sequencesofrealnumbers2025",
    );
    expect(citationKey("graphs-of-functions", null)).toBe("graphsoffunctions");
  });
});

// ── Licences ────────────────────────────────────────────────────────────────

describe("licences", () => {
  it("keeps all rights reserved closed", () => {
    expect(licenseImplications("all_rights_reserved")).toEqual({
      redistribution: false,
      modification: false,
    });
  });

  it("opens redistribution but not adaptation for a NoDerivatives licence", () => {
    expect(licenseImplications("cc_by_nd")).toEqual({
      redistribution: true,
      modification: false,
    });
  });

  it("opens both for CC BY", () => {
    expect(licenseImplications("cc_by")).toEqual({
      redistribution: true,
      modification: true,
    });
  });

  it("gives a canonical URL for every Creative Commons licence and none for the rest", () => {
    const cc: LicenseType[] = [
      "cc_by",
      "cc_by_sa",
      "cc_by_nd",
      "cc_by_nc",
      "cc_by_nc_sa",
      "cc_by_nc_nd",
      "cc0",
    ];
    for (const license of cc) {
      expect(licenseUrl(license), license).toMatch(/^https:\/\/creativecommons\.org\//);
    }

    expect(licenseUrl("all_rights_reserved")).toBeNull();
    expect(licenseUrl("custom")).toBeNull();
  });

  it("refuses a custom licence with no terms written anywhere", () => {
    expect(parse({ licenseType: "custom" }).success).toBe(false);
  });

  it("accepts a custom licence whose terms are written in one language", () => {
    expect(
      parse({
        licenseType: "custom",
        translations: [
          {
            locale: "en",
            title: "Graphs of Functions",
            licenseTerms: "Free to print for classroom use in Cambodia.",
          },
        ],
      }).success,
    ).toBe(true);
  });
});

// ── LaTeX production details ────────────────────────────────────────────────

describe("LaTeX production details", () => {
  it("refuses an engine on a book that was not typeset in LaTeX", () => {
    expect(
      parse({ typesetWithLatex: false, latexEngine: "xelatex" }).success,
    ).toBe(false);
  });

  it("accepts a non-LaTeX book with no engine recorded", () => {
    expect(
      parse({ typesetWithLatex: false, latexEngine: null, documentClass: "" }).success,
    ).toBe(true);
  });
});

/*
 * Settings that render nothing, silently.
 *
 * These are warnings rather than blockers: the page still works without a
 * preview. But the owner should not have to compare a setting that says "the
 * whole PDF is readable in the browser" against a page that offers no control,
 * with nothing anywhere explaining the difference.
 */
describe("publicationPublishWarnings", () => {
  const complete = {
    hasCover: true,
    hasKhmerTitle: true,
    hasEnglishSummary: true,
    hasChapters: true,
    pageCount: 37,
    previewPolicy: "sample_pages" as const,
    activeVersionPublished: true,
    sourcePolicy: "private" as const,
    hasSourceArchive: false,
  };

  it("says nothing when everything is in place", () => {
    expect(publicationPublishWarnings(complete)).toEqual([]);
  });

  it.each(["full", "first_pages"] as const)(
    "warns that a %s preview will not render off a draft edition",
    (previewPolicy) => {
      expect(
        publicationPublishWarnings({
          ...complete,
          previewPolicy,
          activeVersionPublished: false,
        }),
      ).toContain("previewWillNotRender");
    },
  );

  it("does not warn about a preview that needs no PDF", () => {
    expect(
      publicationPublishWarnings({
        ...complete,
        previewPolicy: "sample_pages",
        activeVersionPublished: false,
      }),
    ).not.toContain("previewWillNotRender");
  });

  it("warns when the source policy offers an archive there is none of", () => {
    for (const sourcePolicy of ["public", "on_request"] as const) {
      expect(
        publicationPublishWarnings({ ...complete, sourcePolicy, hasSourceArchive: false }),
      ).toContain("sourcePolicyWithoutArchive");
    }
  });

  it("stays quiet when the source is private, which promises nothing", () => {
    expect(
      publicationPublishWarnings({
        ...complete,
        sourcePolicy: "private",
        hasSourceArchive: false,
      }),
    ).not.toContain("sourcePolicyWithoutArchive");
  });

  it("has a readable label for every warning it can emit", () => {
    const emitted = new Set([
      ...publicationPublishWarnings({
        hasCover: false,
        hasKhmerTitle: false,
        hasEnglishSummary: false,
        hasChapters: false,
        pageCount: null,
        previewPolicy: "full",
        activeVersionPublished: false,
        sourcePolicy: "public",
        hasSourceArchive: false,
      }),
    ]);

    for (const code of emitted) {
      expect(publicationErrorLabels[code], `missing label for ${code}`).toBeTruthy();
    }
  });
});
