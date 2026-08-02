import { z } from "zod";

import { locales, type Locale } from "@/i18n/config";
import { privacyStatuses, type PrivacyStatus } from "./media-privacy";

/**
 * Publications — schemas, publish blockers, citation building and the privacy
 * checklist.
 *
 * Isomorphic by design: the admin editor imports these to validate before
 * submitting and the Server Actions import the same objects to validate again.
 * Nothing here touches the database or reads privileged configuration.
 *
 * Every rule below mirrors a constraint in migration 0026. The database is the
 * guarantee; this layer exists so a violation arrives as a message attached to
 * the control the admin just changed, rather than as an opaque 23514.
 */

// ── Shared vocabulary ───────────────────────────────────────────────────────

export { privacyStatuses, type PrivacyStatus };

export const publicationStatuses = [
  "draft",
  "in_review",
  "published",
  "archived",
] as const;
export type PublicationStatus = (typeof publicationStatuses)[number];

/**
 * The language the *book* is written in.
 *
 * Not the locale of the website page describing it. Nearly all of these are
 * Khmer; the English publication page still renders an English description and
 * an English display title next to the Khmer original.
 */
export const contentLanguages = ["km", "en", "bilingual", "other"] as const;
export type ContentLanguage = (typeof contentLanguages)[number];

export const readingLevels = [
  "lower_secondary",
  "upper_secondary",
  "university",
  "teacher",
  "general",
] as const;
export type ReadingLevel = (typeof readingLevels)[number];

/**
 * How much of the book a stranger may look at in the browser.
 *
 * Separate from the download policy on purpose: "you may read five pages here"
 * and "you may keep a copy" are different permissions, and collapsing them into
 * one control would force the owner to pick the stricter answer for both.
 */
export const previewPolicies = ["none", "sample_pages", "first_pages", "full"] as const;
export type PreviewPolicy = (typeof previewPolicies)[number];

export const pdfDownloadPolicies = [
  "none",
  "public",
  "signed",
  "on_request",
  "contact_author",
] as const;
export type PdfDownloadPolicy = (typeof pdfDownloadPolicies)[number];

export const sampleDownloadPolicies = ["none", "public"] as const;
export type SampleDownloadPolicy = (typeof sampleDownloadPolicies)[number];

/**
 * LaTeX source availability. Defaults to `private` and stays there.
 *
 * Note what none of these values can do: make the archive publicly addressable.
 * Even `public` means "the download route will serve this to anyone who asks",
 * because the bytes live in a private bucket either way. That is deliberate — it
 * keeps the decision revocable, which a permanent public URL is not.
 */
export const sourcePolicies = ["private", "on_request", "public", "external_repo"] as const;
export type SourcePolicy = (typeof sourcePolicies)[number];

/**
 * Licences the owner can choose from.
 *
 * `all_rights_reserved` is the default and is never assigned automatically to
 * anything else. An open licence is irrevocable in practice — once a copy is out
 * under CC BY it stays out under CC BY — so it is only ever an explicit choice.
 */
export const licenseTypes = [
  "all_rights_reserved",
  "personal_educational",
  "non_commercial",
  "cc_by",
  "cc_by_sa",
  "cc_by_nd",
  "cc_by_nc",
  "cc_by_nc_sa",
  "cc_by_nc_nd",
  "cc0",
  "public_domain",
  "custom",
] as const;
export type LicenseType = (typeof licenseTypes)[number];

export const latexEngines = ["pdflatex", "xelatex", "lualatex", "other"] as const;
export type LatexEngine = (typeof latexEngines)[number];

export const publicationMediaRoles = ["cover", "sample_page", "gallery"] as const;
export type PublicationMediaRole = (typeof publicationMediaRoles)[number];

export const publicationMediaVisibilities = ["public", "private", "hidden"] as const;
export type PublicationMediaVisibility = (typeof publicationMediaVisibilities)[number];

export const publicationRelationTypes = [
  "journey",
  "experience",
  "education",
  "certificate",
  "project",
] as const;
export type PublicationRelationType = (typeof publicationRelationTypes)[number];

/** Column on `publication_relations` that holds each relation type's target. */
export const publicationRelationColumns: Record<PublicationRelationType, string> = {
  journey: "journey_entry_id",
  experience: "experience_id",
  education: "education_id",
  certificate: "certificate_id",
  project: "project_id",
};

/** The three file slots on an edition, and which media kind fills each. */
export const publicationFileSlots = ["pdf", "original", "source"] as const;
export type PublicationFileSlot = (typeof publicationFileSlots)[number];

export const publicationFileSlotKinds: Record<PublicationFileSlot, string> = {
  pdf: "publication_pdf",
  original: "publication_original",
  source: "publication_source",
};

// ── Field helpers ───────────────────────────────────────────────────────────

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .refine(
    (value) => value === null || value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value),
    { message: "invalidDate" },
  );

/** A whole number, or nothing. Blank strings from a form become `null`. */
const optionalInt = (min: number, max: number, message: string) =>
  z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value === null || value === undefined || value === "") return null;
      const parsed = typeof value === "number" ? value : Number(value);
      return Number.isFinite(parsed) ? Math.round(parsed) : null;
    })
    .refine((value) => value === null || (value >= min && value <= max), { message });

/** Upper bound for any year field: next year, so a forward-dated edition works. */
const maxYear = () => new Date().getUTCFullYear() + 1;

const optionalYear = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  })
  .refine((value) => value === null || (value >= 1900 && value <= maxYear()), {
    message: "yearOutOfRange",
  });

/**
 * An absolute https URL, or nothing.
 *
 * https only, for the reason `lib/validation/journey.ts` gives: the site is
 * served over https, a mixed-content link silently fails, and refusing anything
 * that is not https disposes of `javascript:` and `data:` without a second rule.
 */
const optionalHttpsUrl = z
  .string()
  .trim()
  .max(600)
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .refine((value) => value === null || value === undefined || /^https:\/\//i.test(value), {
    message: "urlMustBeHttps",
  });

/**
 * Text that will be shown publicly and must not contain a local file path.
 *
 * Section 13 of the brief: the LaTeX production notes are the one public field
 * that a LaTeX author will naturally paste a build log or a working directory
 * into, and `/Users/macbookpro/Downloads/...` on a public page discloses the
 * owner's real name, their machine's layout, and — via the folder names — what
 * else is on it. Refused rather than silently stripped, because a note with its
 * middle removed reads as a mistake and the author should see why.
 */
const publicTextWithoutLocalPaths = (max: number) =>
  optionalText(max).refine(
    (value) => value === null || value === undefined || !containsLocalPath(value),
    { message: "localPathInPublicText" },
  );

/**
 * Does this text contain something that looks like a local filesystem path?
 *
 * Deliberately broad, and deliberately not clever. False positives here cost an
 * author one edit; a false negative publishes their home directory.
 */
export function containsLocalPath(text: string): boolean {
  const patterns = [
    /(^|\s)\/Users\//i,
    /(^|\s)\/home\/[a-z0-9._-]+\//i,
    /(^|\s)\/var\/folders\//i,
    /(^|\s)~\/[A-Za-z]/,
    /[A-Za-z]:\\/, // C:\ …
    /\\\\[A-Za-z0-9._-]+\\/, // \\server\share
    /(^|[\s/\\])(Desktop|Documents|Downloads)[/\\]/i,
    /file:\/\//i,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

// ── Publication ─────────────────────────────────────────────────────────────

const translationSchema = z.object({
  locale: z.enum(locales),

  /**
   * The display title in this locale — for a Khmer book on the English page,
   * the English translation of the title.
   */
  title: z.string().trim().min(1, { message: "titleRequired" }).max(240),
  /**
   * The title as printed on the book, in the book's own language. Kept so the
   * English page can show "Graphs of Functions" with "ក្រាបនៃអនុគមន៍" beneath
   * it, and so the structured data can carry the real one.
   */
  originalTitle: optionalText(240),
  subtitle: optionalText(300),

  shortSummary: optionalText(400),
  description: optionalText(8000),
  introduction: optionalText(8000),
  targetAudience: optionalText(1000),
  learningObjectives: optionalText(4000),
  authorNote: optionalText(4000),
  acknowledgements: optionalText(4000),

  citationText: optionalText(1000),
  licenseTerms: optionalText(4000),
  productionNotes: publicTextWithoutLocalPaths(2000),

  seoTitle: optionalText(70),
  seoDescription: optionalText(200),
});

export const publicationSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, { message: "slugTooShort" })
      .max(90, { message: "slugTooLong" })
      .regex(/^[a-z0-9-]+$/, { message: "slugFormat" }),

    status: z.enum(publicationStatuses),
    publicationTypeId: z.uuid().nullable().optional(),
    featured: z.coerce.boolean(),
    displayOrder: z.coerce.number().int().min(0).max(9999),

    contentLanguage: z.enum(contentLanguages),

    editionLabel: optionalText(120),
    editionNumber: optionalInt(1, 200, "editionOutOfRange"),
    publicationYear: optionalYear,
    publicationDate: optionalDate,
    pageCount: optionalInt(1, 20000, "pageCountOutOfRange"),

    subjectEn: optionalText(200),
    subjectKm: optionalText(200),
    gradeLevelEn: optionalText(200),
    gradeLevelKm: optionalText(200),
    readingLevel: z.enum(readingLevels).nullable().optional(),

    coverMediaId: z.uuid().nullable().optional(),
    activeVersionId: z.uuid().nullable().optional(),

    // ── Access ──────────────────────────────────────────────────────────────
    previewPolicy: z.enum(previewPolicies),
    previewPageLimit: optionalInt(1, 25, "previewLimitOutOfRange"),
    pdfDownloadPolicy: z.enum(pdfDownloadPolicies),
    sampleDownloadPolicy: z.enum(sampleDownloadPolicies),
    sourcePolicy: z.enum(sourcePolicies),
    sourceRepositoryUrl: optionalHttpsUrl,

    // ── Rights ──────────────────────────────────────────────────────────────
    licenseType: z.enum(licenseTypes),
    copyrightHolder: optionalText(200),
    copyrightYear: optionalYear,
    allowRedistribution: z.coerce.boolean(),
    allowModification: z.coerce.boolean(),

    // ── Production ──────────────────────────────────────────────────────────
    typesetWithLatex: z.coerce.boolean(),
    latexEngine: z.enum(latexEngines).nullable().optional(),
    documentClass: optionalText(120),
    buildYear: optionalYear,

    // ── Identifiers ─────────────────────────────────────────────────────────
    /*
     * All three are optional and none is ever generated. A fabricated ISBN is a
     * false claim about a real registry, and a fabricated DOI resolves to
     * somebody else's paper.
     */
    isbn: optionalText(20).refine(
      (value) =>
        value === null || value === undefined || /^[0-9][0-9Xx-]{9,16}$/.test(value),
      { message: "isbnFormat" },
    ),
    doi: optionalText(200).refine(
      (value) => value === null || value === undefined || /^10\.\d{4,9}\//.test(value),
      { message: "doiFormat" },
    ),
    externalUrl: optionalHttpsUrl,

    // ── Review ──────────────────────────────────────────────────────────────
    privacyStatus: z.enum(privacyStatuses),
    privacyReviewNote: optionalText(4000),
    needsReview: z.coerce.boolean(),
    reviewNote: optionalText(2000),
    noindex: z.coerce.boolean(),

    /*
     * At least one translation, keyed by locale rather than positional, so a
     * form that submits only Khmer is a legal draft.
     */
    translations: z.array(translationSchema).min(1, { message: "translationRequired" }),
  })
  /*
   * `first_pages` without a limit renders as the whole book — the exact failure
   * the policy exists to prevent.
   */
  .refine(
    (data) => data.previewPolicy !== "first_pages" || data.previewPageLimit !== null,
    { message: "previewLimitRequired", path: ["previewPageLimit"] },
  )
  // "The source is on GitHub" with no GitHub link is a heading with no content.
  .refine(
    (data) => data.sourcePolicy !== "external_repo" || Boolean(data.sourceRepositoryUrl),
    { message: "repositoryRequired", path: ["sourceRepositoryUrl"] },
  )
  /*
   * A licence marked `custom` with no wording anywhere is worse than no licence
   * statement at all: the page would print "Custom terms" and then nothing, and
   * a reader would reasonably conclude the terms were being withheld.
   */
  .refine(
    (data) =>
      data.licenseType !== "custom" ||
      data.translations.some((t) => Boolean(t.licenseTerms)),
    { message: "customLicenseNeedsTerms", path: ["licenseType"] },
  )
  // LaTeX production details describe a LaTeX build.
  .refine(
    (data) => data.typesetWithLatex || (!data.latexEngine && !data.documentClass),
    { message: "latexDetailsNeedLatex", path: ["typesetWithLatex"] },
  )
  /*
   * Publication rules, checked here so they arrive as a field error rather than
   * as the migration-0026 trigger's check_violation. The trigger is still the
   * guarantee — this is the version that says which control to fix.
   */
  .refine((data) => data.status !== "published" || !data.needsReview, {
    message: "publishBlockedByReview",
    path: ["needsReview"],
  })
  .refine((data) => data.status !== "published" || data.privacyStatus === "approved", {
    message: "publishNeedsPrivacyReview",
    path: ["privacyStatus"],
  })
  .refine(
    (data) =>
      data.status !== "published" ||
      data.translations.some((t) => t.locale === "en" && t.title.trim() !== ""),
    { message: "publishNeedsEnglish", path: ["translations"] },
  );

export type PublicationInput = z.infer<typeof publicationSchema>;

// ── Edition ─────────────────────────────────────────────────────────────────

export const publicationVersionSchema = z
  .object({
    publicationId: z.uuid(),
    versionLabel: z.string().trim().min(1, { message: "versionLabelRequired" }).max(120),
    editionNumber: optionalInt(1, 200, "editionOutOfRange"),
    publicationYear: optionalYear,
    publicationDate: optionalDate,
    pageCount: optionalInt(1, 20000, "pageCountOutOfRange"),

    pdfMediaId: z.uuid().nullable().optional(),
    originalMediaId: z.uuid().nullable().optional(),
    sourceArchiveMediaId: z.uuid().nullable().optional(),

    changelogEn: optionalText(4000),
    changelogKm: optionalText(4000),

    isActive: z.coerce.boolean(),
    status: z.enum(publicationStatuses),
  })
  /*
   * The three slots must hold three different files.
   *
   * The same asset serving as both the public download and the archival original
   * means the redaction step silently did not happen — which is precisely the
   * mistake that would publish a phone number.
   */
  .refine(
    (data) =>
      !data.pdfMediaId ||
      !data.originalMediaId ||
      data.pdfMediaId !== data.originalMediaId,
    { message: "pdfIsAlsoOriginal", path: ["originalMediaId"] },
  )
  .refine(
    (data) =>
      !data.pdfMediaId ||
      !data.sourceArchiveMediaId ||
      data.pdfMediaId !== data.sourceArchiveMediaId,
    { message: "filesMustDiffer", path: ["sourceArchiveMediaId"] },
  )
  .refine(
    (data) =>
      !data.originalMediaId ||
      !data.sourceArchiveMediaId ||
      data.originalMediaId !== data.sourceArchiveMediaId,
    { message: "filesMustDiffer", path: ["sourceArchiveMediaId"] },
  )
  /*
   * A published edition with no reader-facing PDF has nothing to publish. It is
   * a legal *draft* — that is how an edition is prepared — but promoting it
   * would put an edition in the public version history that no one can open.
   */
  .refine((data) => data.status !== "published" || Boolean(data.pdfMediaId), {
    message: "publishedVersionNeedsPdf",
    path: ["pdfMediaId"],
  });

export type PublicationVersionInput = z.infer<typeof publicationVersionSchema>;

/** Activating an edition. Separate from editing it — it is a different decision. */
export const publicationVersionActivationSchema = z.object({
  publicationId: z.uuid(),
  versionId: z.uuid(),
});

// ── Chapters ────────────────────────────────────────────────────────────────

export const publicationChapterSchema = z
  .object({
    publicationId: z.uuid(),
    // Text, not a number: real books have "1", "1.2", "A" and "មេរៀនទី ១".
    chapterNumber: optionalText(30),
    titleEn: optionalText(300),
    titleKm: optionalText(300),
    descriptionEn: optionalText(2000),
    descriptionKm: optionalText(2000),
    startPage: optionalInt(1, 20000, "pageOutOfRange"),
    endPage: optionalInt(1, 20000, "pageOutOfRange"),
    sortOrder: z.coerce.number().int().min(0).max(9999),
  })
  .refine((data) => Boolean(data.titleEn) || Boolean(data.titleKm), {
    message: "chapterNeedsTitle",
    path: ["titleEn"],
  })
  .refine(
    (data) => !data.startPage || !data.endPage || data.endPage >= data.startPage,
    { message: "pagesOutOfOrder", path: ["endPage"] },
  );

export type PublicationChapterInput = z.infer<typeof publicationChapterSchema>;

export const publicationChapterOrderSchema = z.object({
  publicationId: z.uuid(),
  orderedIds: z.array(z.uuid()).max(400),
});

// ── Presentation media (cover, sample pages, gallery) ───────────────────────

export const publicationMediaSchema = z
  .object({
    publicationId: z.uuid(),
    mediaAssetId: z.uuid(),
    role: z.enum(publicationMediaRoles),
    sortOrder: z.coerce.number().int().min(0).max(9999),
    pageNumber: optionalInt(1, 20000, "pageOutOfRange"),

    captionEn: optionalText(400),
    captionKm: optionalText(400),
    altTextEn: optionalText(400),
    altTextKm: optionalText(400),

    visibility: z.enum(publicationMediaVisibilities),
  })
  /*
   * A sample page without a page number cannot be ordered against the book or
   * labelled in the viewer — "image 3" tells a reader nothing about where in a
   * 214-page book they are looking.
   */
  .refine((data) => data.role !== "sample_page" || data.pageNumber !== null, {
    message: "samplePageNeedsNumber",
    path: ["pageNumber"],
  })
  /*
   * Alt text is required to go public, and only then.
   *
   * Same rule as journey media, same reason: a rendered page of mathematics is
   * an image, and a screen-reader user gets its content from nowhere else.
   * Requiring it at draft time would be busywork; requiring it at publication is
   * the point at which the omission would actually cost someone.
   */
  .refine((data) => data.visibility !== "public" || Boolean(data.altTextEn), {
    message: "publicNeedsAltText",
    path: ["altTextEn"],
  });

export type PublicationMediaInput = z.infer<typeof publicationMediaSchema>;

export const publicationMediaOrderSchema = z.object({
  publicationId: z.uuid(),
  orderedIds: z.array(z.uuid()).max(200),
});

// ── Topics, types and relations ─────────────────────────────────────────────

export const publicationTopicSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, { message: "slugTooShort" })
    .max(60, { message: "slugTooLong" })
    .regex(/^[a-z0-9-]+$/, { message: "slugFormat" }),
  nameEn: z.string().trim().min(1, { message: "nameRequired" }).max(120),
  nameKm: optionalText(120),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export const publicationTypeSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, { message: "slugTooShort" })
    .max(60, { message: "slugTooLong" })
    .regex(/^[a-z0-9-]+$/, { message: "slugFormat" }),
  nameEn: z.string().trim().min(1, { message: "nameRequired" }).max(120),
  nameKm: optionalText(120),
  descriptionEn: optionalText(500),
  descriptionKm: optionalText(500),
  icon: optionalText(60),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export const publicationTopicLinksSchema = z.object({
  publicationId: z.uuid(),
  topicIds: z.array(z.uuid()).max(60),
});

export const publicationRelationSchema = z.object({
  publicationId: z.uuid(),
  relatedType: z.enum(publicationRelationTypes),
  relatedId: z.uuid(),
});

export const publicationOrderSchema = z.object({
  orderedIds: z.array(z.uuid()).max(400),
});

// ── Access resolution ───────────────────────────────────────────────────────

/**
 * What a *reader* may do with a publication's files.
 *
 * One function, used by the detail page to decide which buttons to render and by
 * the download route to decide whether to serve. Sharing it is the point: a
 * button the page shows and the route refuses is a bug report, and a file the
 * route serves without a button is a leak.
 *
 * The route is still the enforcement point. This is not a "check on the client
 * and trust it" arrangement — the route calls this function itself, server-side,
 * with the row it just loaded.
 */
export type PublicationAccess = {
  canPreview: boolean;
  /** How many pages the inline viewer may render. `null` means all of them. */
  previewPageLimit: number | null;
  canDownloadPdf: boolean;
  /** Download requires a short-lived token rather than being open. */
  pdfNeedsSignature: boolean;
  canDownloadSamples: boolean;
  canDownloadSource: boolean;
  /** Render a "request access" or "contact the author" call to action instead. */
  showPdfRequestCta: boolean;
  showSourceRequestCta: boolean;
  /** Send the reader to a repository rather than serving an archive. */
  sourceRepositoryUrl: string | null;
};

export function resolvePublicationAccess(input: {
  previewPolicy: PreviewPolicy;
  previewPageLimit: number | null;
  pdfDownloadPolicy: PdfDownloadPolicy;
  sampleDownloadPolicy: SampleDownloadPolicy;
  sourcePolicy: SourcePolicy;
  sourceRepositoryUrl: string | null;
  /** False when the active edition has no PDF attached. */
  hasPdf: boolean;
  hasSourceArchive: boolean;
  hasSamplePages: boolean;
}): PublicationAccess {
  /*
   * Every capability is gated on the file existing as well as on the policy
   * allowing it. A download button for a publication whose active edition has
   * no PDF is a 404 with a nice label, which is worse than no button.
   */
  const canPreview =
    input.hasPdf &&
    (input.previewPolicy === "full" ||
      input.previewPolicy === "first_pages" ||
      (input.previewPolicy === "sample_pages" && input.hasSamplePages));

  return {
    canPreview,
    previewPageLimit:
      input.previewPolicy === "first_pages" ? (input.previewPageLimit ?? 5) : null,

    canDownloadPdf:
      input.hasPdf &&
      (input.pdfDownloadPolicy === "public" || input.pdfDownloadPolicy === "signed"),
    pdfNeedsSignature: input.pdfDownloadPolicy === "signed",

    canDownloadSamples: input.hasSamplePages && input.sampleDownloadPolicy === "public",

    canDownloadSource: input.hasSourceArchive && input.sourcePolicy === "public",

    showPdfRequestCta:
      input.pdfDownloadPolicy === "on_request" ||
      input.pdfDownloadPolicy === "contact_author",
    showSourceRequestCta: input.sourcePolicy === "on_request",

    sourceRepositoryUrl:
      input.sourcePolicy === "external_repo" ? input.sourceRepositoryUrl : null,
  };
}

// ── Publish blockers ────────────────────────────────────────────────────────

/**
 * Why a publication cannot be published yet.
 *
 * Mirrors `enforce_publication_publish_rules()` in migration 0026, plus the
 * softer warnings the trigger does not enforce — a book with no Khmer
 * translation or no cover is publishable, but the admin should be told before
 * rather than after.
 *
 * Returns message codes; the client picks the language.
 */
export function publicationPublishBlockers(input: {
  needsReview: boolean;
  privacyStatus: PrivacyStatus;
  hasEnglishTitle: boolean;
  pdfDownloadPolicy: PdfDownloadPolicy;
  hasActiveVersion: boolean;
  activeVersionHasPdf: boolean;
  /**
   * Whether the active edition is itself published.
   *
   * Necessary as well as `activeVersionHasPdf`: the public page reads
   * `public_publication_versions`, which filters out an unpublished edition, so
   * a draft edition renders no download button however complete it looks in the
   * admin. Migration 0028 refuses this at the database too.
   */
  activeVersionPublished: boolean;
}): string[] {
  const blockers: string[] = [];

  if (input.needsReview) blockers.push("needsReview");
  if (input.privacyStatus === "pending_review") blockers.push("privacyPending");
  if (input.privacyStatus === "rejected") blockers.push("privacyRejected");
  if (!input.hasEnglishTitle) blockers.push("missingEnglishTitle");

  if (input.pdfDownloadPolicy === "public" || input.pdfDownloadPolicy === "signed") {
    if (!input.hasActiveVersion) blockers.push("noActiveVersion");
    else if (!input.activeVersionHasPdf) blockers.push("activeVersionHasNoPdf");
    else if (!input.activeVersionPublished) blockers.push("activeVersionNotPublished");
  }

  return blockers;
}

/** Non-blocking gaps worth showing the admin before they publish. */
export function publicationPublishWarnings(input: {
  hasCover: boolean;
  hasKhmerTitle: boolean;
  hasEnglishSummary: boolean;
  hasChapters: boolean;
  pageCount: number | null;
  previewPolicy: PreviewPolicy;
  activeVersionPublished: boolean;
  sourcePolicy: SourcePolicy;
  hasSourceArchive: boolean;
}): string[] {
  const warnings: string[] = [];
  if (!input.hasCover) warnings.push("noCover");
  if (!input.hasKhmerTitle) warnings.push("noKhmerTitle");
  if (!input.hasEnglishSummary) warnings.push("noEnglishSummary");
  if (!input.hasChapters) warnings.push("noChapters");
  if (input.pageCount === null) warnings.push("noPageCount");

  /*
   * A preview that will not appear.
   *
   * The publish gate blocks a *download* promised by a draft edition, because a
   * button that 404s is worse than none. A preview fails more quietly: the
   * reader control simply does not render, and the owner is left comparing a
   * setting that says "the whole PDF is readable in the browser" against a page
   * that offers nothing. A warning rather than a blocker — the page is still
   * perfectly usable without the preview.
   */
  if (
    (input.previewPolicy === "full" || input.previewPolicy === "first_pages") &&
    !input.activeVersionPublished
  ) {
    warnings.push("previewWillNotRender");
  }

  // Same shape for the source archive: a policy that offers a file there is none
  // of renders nothing, with no error anywhere.
  if (
    (input.sourcePolicy === "public" || input.sourcePolicy === "on_request") &&
    !input.hasSourceArchive
  ) {
    warnings.push("sourcePolicyWithoutArchive");
  }

  return warnings;
}

// ── LaTeX source hygiene ────────────────────────────────────────────────────

/**
 * Build artefacts that must never be shipped in a source archive.
 *
 * Section 6 of the brief. `.log` and `.aux` are the dangerous ones: a LaTeX log
 * records every absolute path the compiler touched, so publishing one publishes
 * the author's home directory listing whether or not the notes field was clean.
 */
export const LATEX_BUILD_ARTEFACT_EXTENSIONS = [
  "aux",
  "log",
  "out",
  "toc",
  "lof",
  "lot",
  "nav",
  "snm",
  "vrb",
  "synctex.gz",
  "fls",
  "fdb_latexmk",
  "bbl",
  "blg",
  "idx",
  "ilg",
  "ind",
  "run.xml",
  "bcf",
] as const;

/** Filenames that should never be in an archive at all. */
const SECRET_FILENAMES = [
  ".env",
  ".env.local",
  ".git",
  "id_rsa",
  ".npmrc",
  ".netrc",
  "credentials",
];

/**
 * Warn about a proposed archive's file list.
 *
 * Takes a list of *names*, not an archive — nothing in this codebase expands a
 * ZIP, and this function exists precisely so the importer can check a folder
 * before it is zipped rather than the application unpacking one afterwards.
 *
 * Returns message codes with the offending names attached, so the admin can see
 * which file to remove rather than being told "something is wrong".
 */
export function latexSourceWarnings(filenames: readonly string[]): Array<{
  code: string;
  files: string[];
}> {
  const warnings: Array<{ code: string; files: string[] }> = [];

  const artefacts = filenames.filter((name) => isLatexBuildArtefact(name));
  if (artefacts.length > 0) warnings.push({ code: "buildArtefacts", files: artefacts });

  const secrets = filenames.filter((name) => {
    const base = name.split("/").pop()?.toLowerCase() ?? "";
    return SECRET_FILENAMES.some(
      (secret) => base === secret || base.startsWith(`${secret}.`),
    );
  });
  if (secrets.length > 0) warnings.push({ code: "possibleSecrets", files: secrets });

  const fonts = filenames.filter((name) => /\.(ttf|otf|pfb|woff2?)$/i.test(name));
  if (fonts.length > 0) warnings.push({ code: "bundledFonts", files: fonts });

  const absolute = filenames.filter((name) => containsLocalPath(name));
  if (absolute.length > 0) warnings.push({ code: "absolutePaths", files: absolute });

  return warnings;
}

export function isLatexBuildArtefact(filename: string): boolean {
  const lower = filename.toLowerCase();
  return LATEX_BUILD_ARTEFACT_EXTENSIONS.some((extension) =>
    lower.endsWith(`.${extension}`),
  );
}

// ── Citation ────────────────────────────────────────────────────────────────

export type CitationInput = {
  authorName: string | null;
  /** The title as printed on the book, preferred over a translation. */
  originalTitle: string | null;
  title: string | null;
  editionLabel: string | null;
  editionNumber: number | null;
  publicationYear: number | null;
  isbn: string | null;
  doi: string | null;
  url: string | null;
};

/**
 * Build a citation from verified metadata, and nothing else.
 *
 * Every element is omitted when it is unknown. There is deliberately no
 * "n.p."/"n.d." fallback and no inferred publisher or place: a citation is a
 * factual claim, and a generated one that invents a publisher is a worse outcome
 * than a short citation that omits it. The owner can always edit the result —
 * `citation_text` on the translation row overrides this entirely.
 *
 * Uses the book's own title in preference to a translated one, because that is
 * what a reader would need to find the actual object.
 */
export function buildCitation(input: CitationInput): string {
  const parts: string[] = [];

  if (input.authorName) parts.push(`${input.authorName}.`);

  const title = input.originalTitle ?? input.title;
  if (title) parts.push(`${title}.`);

  const edition =
    input.editionLabel ??
    (input.editionNumber ? `${ordinal(input.editionNumber)} edition` : null);
  if (edition) parts.push(`${edition},`);

  if (input.publicationYear) parts.push(`${input.publicationYear}.`);
  if (input.isbn) parts.push(`ISBN ${input.isbn}.`);
  if (input.doi) parts.push(`https://doi.org/${input.doi}`);
  else if (input.url) parts.push(input.url);

  return parts
    .join(" ")
    .replace(/,\s*\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A BibTeX entry, when there is enough to make one.
 *
 * Returns `null` rather than a stub below the useful threshold: BibTeX's `@book`
 * requires an author, a title and a year, and an entry missing any of them will
 * render as a broken reference in whatever document it lands in. Better to offer
 * no button than a broken one.
 *
 * `publisher` is deliberately absent even though BibTeX wants it — see
 * `buildCitation`. These are self-published works and inventing an imprint would
 * be a false claim.
 */
export function buildBibTeX(
  input: CitationInput & { citationKey: string },
): string | null {
  const title = input.originalTitle ?? input.title;
  if (!input.authorName || !title || !input.publicationYear) return null;

  const fields: Array<[string, string]> = [
    ["author", input.authorName],
    ["title", title],
    ["year", String(input.publicationYear)],
  ];

  const edition =
    input.editionLabel ??
    (input.editionNumber ? `${ordinal(input.editionNumber)}` : null);
  if (edition) fields.push(["edition", edition]);
  if (input.isbn) fields.push(["isbn", input.isbn]);
  if (input.doi) fields.push(["doi", input.doi]);
  if (input.url) fields.push(["url", input.url]);

  const body = fields
    .map(([key, value]) => `  ${key} = {${escapeBibTeX(value)}}`)
    .join(",\n");

  return `@book{${input.citationKey},\n${body}\n}`;
}

/**
 * Escape what would break a BibTeX entry.
 *
 * Only the four characters that actually terminate or restructure a field. Khmer
 * text passes through untouched — a modern LuaLaTeX or XeLaTeX document handles
 * it, and mangling it into `\k{}` sequences would produce something that neither
 * renders nor round-trips.
 */
function escapeBibTeX(value: string): string {
  return value.replace(/[{}\\]/g, "\\$&").replace(/[%#$&_]/g, "\\$&");
}

function ordinal(value: number): string {
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  return `${value}${suffixes[value % 10] ?? "th"}`;
}

/** A stable, ASCII-only BibTeX key from a slug and a year. */
export function citationKey(slug: string, year: number | null): string {
  const base = slug.replace(/[^a-z0-9]+/g, "");
  return year ? `${base}${year}` : base;
}

// ── Licence presentation ────────────────────────────────────────────────────

/**
 * Whether a licence lets a reader redistribute or adapt the work by default.
 *
 * Used to pre-fill the two permission toggles when the licence changes, so the
 * page does not print "CC BY" next to "Redistribution: not permitted", which is
 * a contradiction a reader would be right to complain about. The toggles remain
 * editable — the owner may add restrictions a licence does not require.
 */
export function licenseImplications(license: LicenseType): {
  redistribution: boolean;
  modification: boolean;
} {
  switch (license) {
    case "cc0":
    case "public_domain":
    case "cc_by":
    case "cc_by_sa":
    case "cc_by_nc":
    case "cc_by_nc_sa":
      return { redistribution: true, modification: true };
    case "cc_by_nd":
    case "cc_by_nc_nd":
      return { redistribution: true, modification: false };
    case "all_rights_reserved":
    case "personal_educational":
    case "non_commercial":
    case "custom":
    default:
      return { redistribution: false, modification: false };
  }
}

/** Canonical URL for a Creative Commons licence, or `null` for the rest. */
export function licenseUrl(license: LicenseType): string | null {
  const map: Partial<Record<LicenseType, string>> = {
    cc_by: "https://creativecommons.org/licenses/by/4.0/",
    cc_by_sa: "https://creativecommons.org/licenses/by-sa/4.0/",
    cc_by_nd: "https://creativecommons.org/licenses/by-nd/4.0/",
    cc_by_nc: "https://creativecommons.org/licenses/by-nc/4.0/",
    cc_by_nc_sa: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    cc_by_nc_nd: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
    cc0: "https://creativecommons.org/publicdomain/zero/1.0/",
  };
  return map[license] ?? null;
}

// ── Privacy checklist ───────────────────────────────────────────────────────

/**
 * The checklist shown before a publication can be approved for publishing.
 *
 * These are not photographs, so the journey and experience lists do not fit: the
 * risks in a typeset book are a contact page, a QR code, a colophon naming
 * reviewers, and third-party figures whose licence nobody checked.
 *
 * As with every other checklist here, which boxes were ticked is NOT persisted.
 * Storing them would imply a legal record the CMS cannot substantiate; only the
 * reviewer, the timestamp and the note are kept.
 */
export const PUBLICATION_PRIVACY_CHECKLIST: Array<{
  id: string;
  label: string;
  detail: string;
  /** Shown only when a LaTeX source archive is attached. */
  sourceOnly?: boolean;
}> = [
  {
    id: "contact-details",
    label: "Any contact details in the PDF are ones you intend to publish",
    detail:
      "Check the cover, the colophon and the last page. A personal mobile number printed for a 2019 class is still a personal mobile number today.",
  },
  {
    id: "qr-codes",
    label: "Every QR code still points somewhere safe",
    detail:
      "Scan them. A Telegram or Facebook link can be dead, renamed, or now owned by somebody else — and a QR code is unreadable to you but not to a reader.",
  },
  {
    id: "student-data",
    label: "No pupil names, marks or written work appear",
    detail:
      "Worked solutions photographed from an exercise book, a class list used as an example, a scanned answer sheet with a name on it.",
  },
  {
    id: "third-party-names",
    label: "Named reviewers and contributors have agreed to be named",
    detail:
      "A colleague who checked a draft in 2023 did not necessarily agree to appear on a public website.",
  },
  {
    id: "image-rights",
    label: "Third-party figures and photographs are cleared for use",
    detail:
      "Diagrams redrawn from a textbook, photographs from the internet, or a logo used without permission. Redraw, replace, or remove.",
  },
  {
    id: "font-rights",
    label: "Embedded fonts are licensed for redistribution",
    detail:
      "A PDF embeds its fonts. Khmer fonts in particular vary — some Limon and commercial Khmer families forbid embedding in a distributed document.",
  },
  {
    id: "approved-edition",
    label: "The attached PDF is the edition you mean to publish",
    detail:
      "Not the working draft, and not the one with the unfinished chapter. Open it and check the last page.",
  },
  {
    id: "redaction",
    label: "The public PDF is redacted where the original was not",
    detail:
      "If you removed anything, confirm the public file is the redacted one. The archival original stays private and is never overwritten.",
  },
  {
    id: "source-secrets",
    label: "The source archive contains no credentials or private notes",
    detail:
      "A .env file, an API key in a build script, a TODO comment about a colleague. Nothing here expands the archive to check for you.",
    sourceOnly: true,
  },
  {
    id: "source-artefacts",
    label: "The source archive contains no build artefacts",
    detail:
      "A .log file records every absolute path the compiler touched, which publishes your home directory listing. Remove .aux, .log, .out, .toc, .synctex.gz and friends before zipping.",
    sourceOnly: true,
  },
  {
    id: "source-paths",
    label: "No absolute local paths remain in the source",
    detail:
      "\\includegraphics{/Users/…} and \\input{~/Documents/…} both name your machine. Use relative paths.",
    sourceOnly: true,
  },
];

// ── Error labels ────────────────────────────────────────────────────────────

export const publicationErrorLabels: Record<string, string> = {
  // Publication
  slugTooShort: "The URL slug needs at least 2 characters.",
  slugTooLong: "The URL slug must be 90 characters or fewer.",
  slugFormat: "Use lowercase letters, numbers and hyphens only.",
  slugTaken: "Another publication already uses that URL slug.",
  nameRequired: "Enter a name.",
  titleRequired: "Enter a title.",
  translationRequired: "Add at least one language.",
  invalidDate: "Use the date picker, or the format YYYY-MM-DD.",
  yearOutOfRange: "Enter a four-digit year between 1900 and next year.",
  editionOutOfRange: "Enter an edition number between 1 and 200.",
  pageCountOutOfRange: "Enter a page count between 1 and 20,000.",
  pageOutOfRange: "Enter a page number between 1 and 20,000.",
  isbnFormat: "That is not a valid ISBN. Leave it blank unless you have a real one.",
  doiFormat: "A DOI starts with “10.” followed by a registrant code and a slash.",
  urlMustBeHttps: "Enter a full https:// address.",
  localPathInPublicText:
    "This text contains a local file path. Remove it — it would be published, and it names your machine.",

  // Access
  previewLimitRequired:
    "Choose how many pages the preview shows. Without a limit it would show the whole book.",
  previewLimitOutOfRange: "The preview limit must be between 1 and 25 pages.",
  repositoryRequired: "Add the repository URL, or choose a different source policy.",
  customLicenseNeedsTerms:
    "A custom licence needs its terms written out in at least one language.",
  latexDetailsNeedLatex:
    "Clear the LaTeX engine and document class, or mark this as typeset with LaTeX.",

  // Publishing
  publishBlockedByReview:
    "This publication is still marked as needing review. Confirm the uncertain fields and clear the flag before publishing.",
  publishNeedsPrivacyReview:
    "Complete and approve the privacy review before publishing.",
  publishNeedsEnglish:
    "An English title is required before a publication can be published.",
  needsReview: "The publication is still marked as needing review.",
  privacyPending: "The privacy review has not been completed.",
  privacyRejected: "This was rejected in privacy review.",
  missingEnglishTitle: "There is no English translation.",
  noActiveVersion:
    "No edition is active, so there is no file to download. Create an edition and activate it.",
  activeVersionHasNoPdf:
    "The active edition has no PDF, but the download policy offers one.",
  activeVersionNotPublished:
    "The active edition is still a draft, so no download button would appear. Set its status to Published in the Editions panel.",

  // Warnings
  noCover: "There is no cover image.",
  noKhmerTitle: "There is no Khmer translation.",
  noEnglishSummary: "There is no English summary for the listing card.",
  noChapters: "No table of contents has been added.",
  noPageCount: "The page count is unknown.",
  previewWillNotRender:
    "The preview will not appear: the active edition is still a draft, so the public page cannot see its PDF. Set the edition's status to Published.",
  sourcePolicyWithoutArchive:
    "The LaTeX source policy offers an archive, but no source archive is attached to the active edition.",

  // Editions
  versionLabelRequired: "Give this edition a label, for example “First edition”.",
  publishedVersionNeedsPdf: "A published edition needs a PDF attached.",
  pdfIsAlsoOriginal:
    "The public PDF and the archival original are the same file. If you redacted the book, attach the redacted copy as the public PDF and keep the original separate.",
  filesMustDiffer: "Each of the three file slots needs a different file.",
  versionNotFound: "That edition no longer exists.",
  lastVersion: "This is the only edition. Delete the publication instead.",

  // Chapters
  chapterNeedsTitle: "Give the chapter a title in at least one language.",
  pagesOutOfOrder: "The end page is before the start page.",

  // Media
  samplePageNeedsNumber: "Enter which page of the book this image shows.",
  publicNeedsAltText: "English alt text is required before this goes public.",
  alreadyAttached: "That file is already attached to this publication.",
  coverExists: "This publication already has a cover image.",
  notAnImage: "Only images can be used as a cover or a sample page.",
  privateAsset:
    "That file is stored privately and has no public URL, so it cannot be shown on the public page.",
  wrongFileKind:
    "That file is the wrong kind for this slot. Upload it again with the matching kind.",
  publicFileNotAllowed:
    "A publication file must be private. It is served through the download route, which enforces the download policy.",
  stillAttached:
    "This file is still attached to a publication. Remove the attachment first.",

  // Relations
  relationExists: "That link already exists.",
  relationTargetMissing: "That record no longer exists.",
};

export function collectPublicationErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!result[path]) result[path] = issue.message;
  }
  return result;
}

// ── Display helpers ─────────────────────────────────────────────────────────

/**
 * BCP-47 tag for a publication's own language, for the `lang` attribute.
 *
 * `bilingual` and `other` return `null`: the caller then leaves the attribute
 * off and inherits the page's, which is the honest answer. Marking a bilingual
 * book as `km` would have a screen reader read its English half in Khmer.
 */
export function contentLanguageTag(language: ContentLanguage): Locale | null {
  if (language === "km") return "km";
  if (language === "en") return "en";
  return null;
}
