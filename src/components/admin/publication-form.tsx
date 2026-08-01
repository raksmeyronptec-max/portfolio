"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, ErrorSummary, Field, Fieldset, Select, TextArea, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { createPublication, updatePublication } from "@/lib/actions/publications";
import type { AdminPublication, PublicationTypeOption } from "@/lib/data/admin-publications";
import {
  contentLanguages,
  latexEngines,
  licenseImplications,
  licenseTypes,
  pdfDownloadPolicies,
  previewPolicies,
  publicationErrorLabels,
  publicationStatuses,
  readingLevels,
  sampleDownloadPolicies,
  sourcePolicies,
  type ContentLanguage,
  type LicenseType,
  type PdfDownloadPolicy,
  type PreviewPolicy,
  type PublicationStatus,
  type ReadingLevel,
  type SampleDownloadPolicy,
  type SourcePolicy,
} from "@/lib/validation/publication";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils/cn";

/**
 * The publication editor.
 *
 * ── Why this is tabbed and the journey form is not ─────────────────────────
 * A publication carries five genuinely separate decisions — what it is, what it
 * says, who may have the files, what the licence is, and whether it is safe to
 * publish — and the last two are decisions somebody makes deliberately rather
 * than while typing a summary. One long form would put "release this under CC
 * BY" three inches below "subtitle", which is how an irrevocable choice gets
 * made by accident.
 *
 * The tabs are real tabs: `role="tablist"`, arrow-key navigation, and every
 * panel stays mounted so an unsaved change in Access is not lost by clicking
 * Content. All fields submit together — this is one form, not five.
 *
 * ── What this form deliberately cannot do ──────────────────────────────────
 * Set `privacy_status`. That moves only through `reviewPublicationPrivacy`,
 * which records who decided and when. Approving a book PDF is a statement that
 * somebody opened it and looked; it must not be a side effect of fixing a typo.
 */

const STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: "Draft — not visible on the site",
  in_review: "In review — not visible on the site",
  published: "Published — visible on the site",
  archived: "Archived — withdrawn from the site",
};

const LANGUAGE_LABELS: Record<ContentLanguage, string> = {
  km: "Khmer",
  en: "English",
  bilingual: "Khmer and English",
  other: "Another language",
};

const LEVEL_LABELS: Record<ReadingLevel, string> = {
  lower_secondary: "Lower secondary",
  upper_secondary: "Upper secondary",
  university: "University",
  teacher: "Teachers",
  general: "General readers",
};

const PREVIEW_LABELS: Record<PreviewPolicy, string> = {
  none: "No preview — cover only",
  sample_pages: "Sample pages — the page images you attach, and nothing else",
  first_pages: "First N pages — a genuinely truncated PDF is served",
  full: "Full book — the whole PDF is readable in the browser",
};

const DOWNLOAD_LABELS: Record<PdfDownloadPolicy, string> = {
  none: "No download",
  public: "Public download — anyone may download the PDF",
  signed: "Signed download — served through the download route only",
  on_request: "Available on request — shows a contact prompt",
  contact_author: "Contact the author — shows a contact prompt",
};

const SAMPLE_DOWNLOAD_LABELS: Record<SampleDownloadPolicy, string> = {
  none: "Sample pages are viewable but not downloadable",
  public: "Sample page images may be downloaded",
};

const SOURCE_LABELS: Record<SourcePolicy, string> = {
  private: "Private — the LaTeX source is never served (default)",
  on_request: "Available on request — shows a note, serves nothing",
  public: "Public download — served through the download route",
  external_repo: "External repository — links out to GitHub or similar",
};

const LICENSE_LABELS: Record<LicenseType, string> = {
  all_rights_reserved: "All rights reserved (default)",
  personal_educational: "Free for personal and educational use",
  non_commercial: "Free for non-commercial use",
  cc_by: "CC BY 4.0",
  cc_by_sa: "CC BY-SA 4.0",
  cc_by_nd: "CC BY-ND 4.0",
  cc_by_nc: "CC BY-NC 4.0",
  cc_by_nc_sa: "CC BY-NC-SA 4.0",
  cc_by_nc_nd: "CC BY-NC-ND 4.0",
  cc0: "CC0 — public domain dedication",
  public_domain: "Public domain",
  custom: "Custom terms",
};

const LOCALE_NAMES: Record<Locale, string> = { en: "English", km: "Khmer" };

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "content", label: "Content" },
  { id: "academic", label: "Academic" },
  { id: "access", label: "Access" },
  { id: "rights", label: "Rights" },
  { id: "production", label: "Production" },
  { id: "seo", label: "SEO" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type TranslationValues = {
  title: string;
  originalTitle: string;
  subtitle: string;
  shortSummary: string;
  description: string;
  introduction: string;
  targetAudience: string;
  learningObjectives: string;
  authorNote: string;
  acknowledgements: string;
  citationText: string;
  licenseTerms: string;
  productionNotes: string;
  seoTitle: string;
  seoDescription: string;
};

const EMPTY_TRANSLATION: TranslationValues = {
  title: "",
  originalTitle: "",
  subtitle: "",
  shortSummary: "",
  description: "",
  introduction: "",
  targetAudience: "",
  learningObjectives: "",
  authorNote: "",
  acknowledgements: "",
  citationText: "",
  licenseTerms: "",
  productionNotes: "",
  seoTitle: "",
  seoDescription: "",
};

type FormValues = {
  slug: string;
  status: PublicationStatus;
  publicationTypeId: string;
  featured: boolean;
  displayOrder: string;
  contentLanguage: ContentLanguage;
  editionLabel: string;
  editionNumber: string;
  publicationYear: string;
  publicationDate: string;
  pageCount: string;
  subjectEn: string;
  subjectKm: string;
  gradeLevelEn: string;
  gradeLevelKm: string;
  readingLevel: string;
  previewPolicy: PreviewPolicy;
  previewPageLimit: string;
  pdfDownloadPolicy: PdfDownloadPolicy;
  sampleDownloadPolicy: SampleDownloadPolicy;
  sourcePolicy: SourcePolicy;
  sourceRepositoryUrl: string;
  licenseType: LicenseType;
  copyrightHolder: string;
  copyrightYear: string;
  allowRedistribution: boolean;
  allowModification: boolean;
  typesetWithLatex: boolean;
  latexEngine: string;
  documentClass: string;
  buildYear: string;
  isbn: string;
  doi: string;
  externalUrl: string;
  needsReview: boolean;
  reviewNote: string;
  noindex: boolean;
  translations: Record<Locale, TranslationValues>;
};

function initialValues(publication: AdminPublication | null): FormValues {
  const translations = {} as Record<Locale, TranslationValues>;
  for (const locale of locales) {
    const existing = publication?.translations.find((t) => t.locale === locale);
    translations[locale] = existing
      ? {
          title: existing.title,
          originalTitle: existing.originalTitle ?? "",
          subtitle: existing.subtitle ?? "",
          shortSummary: existing.shortSummary ?? "",
          description: existing.description ?? "",
          introduction: existing.introduction ?? "",
          targetAudience: existing.targetAudience ?? "",
          learningObjectives: existing.learningObjectives ?? "",
          authorNote: existing.authorNote ?? "",
          acknowledgements: existing.acknowledgements ?? "",
          citationText: existing.citationText ?? "",
          licenseTerms: existing.licenseTerms ?? "",
          productionNotes: existing.productionNotes ?? "",
          seoTitle: existing.seoTitle ?? "",
          seoDescription: existing.seoDescription ?? "",
        }
      : { ...EMPTY_TRANSLATION };
  }

  return {
    slug: publication?.slug ?? "",
    status: publication?.status ?? "draft",
    publicationTypeId: publication?.publicationTypeId ?? "",
    featured: publication?.featured ?? false,
    displayOrder: String(publication?.displayOrder ?? 0),
    contentLanguage: publication?.contentLanguage ?? "km",
    editionLabel: publication?.editionLabel ?? "",
    editionNumber: publication?.editionNumber?.toString() ?? "",
    publicationYear: publication?.publicationYear?.toString() ?? "",
    publicationDate: publication?.publicationDate ?? "",
    pageCount: publication?.pageCount?.toString() ?? "",
    subjectEn: publication?.subjectEn ?? "",
    subjectKm: publication?.subjectKm ?? "",
    gradeLevelEn: publication?.gradeLevelEn ?? "",
    gradeLevelKm: publication?.gradeLevelKm ?? "",
    readingLevel: publication?.readingLevel ?? "",
    previewPolicy: publication?.previewPolicy ?? "sample_pages",
    previewPageLimit: publication?.previewPageLimit?.toString() ?? "",
    pdfDownloadPolicy: publication?.pdfDownloadPolicy ?? "none",
    sampleDownloadPolicy: publication?.sampleDownloadPolicy ?? "none",
    sourcePolicy: publication?.sourcePolicy ?? "private",
    sourceRepositoryUrl: publication?.sourceRepositoryUrl ?? "",
    licenseType: publication?.licenseType ?? "all_rights_reserved",
    copyrightHolder: publication?.copyrightHolder ?? "",
    copyrightYear: publication?.copyrightYear?.toString() ?? "",
    allowRedistribution: publication?.allowRedistribution ?? false,
    allowModification: publication?.allowModification ?? false,
    typesetWithLatex: publication?.typesetWithLatex ?? true,
    latexEngine: publication?.latexEngine ?? "",
    documentClass: publication?.documentClass ?? "",
    buildYear: publication?.buildYear?.toString() ?? "",
    isbn: publication?.isbn ?? "",
    doi: publication?.doi ?? "",
    externalUrl: publication?.externalUrl ?? "",
    needsReview: publication?.needsReview ?? false,
    reviewNote: publication?.reviewNote ?? "",
    noindex: publication?.noindex ?? false,
    translations,
  };
}

export function PublicationForm({
  publication,
  types,
  canPublish,
  canChangePolicy,
}: {
  publication: AdminPublication | null;
  types: PublicationTypeOption[];
  canPublish: boolean;
  /** Owner-only: the download policy and the licence give something away. */
  canChangePolicy: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const formId = useId();
  const [isPending, startTransition] = useTransition();

  const [values, setValues] = useState<FormValues>(() => initialValues(publication));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<TabId>("basics");

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const setTranslation = (
    locale: Locale,
    key: keyof TranslationValues,
    value: string,
  ) =>
    setValues((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: { ...current.translations[locale], [key]: value },
      },
    }));

  /**
   * Changing the licence pre-fills the two permission toggles.
   *
   * Without this the page could print "CC BY" beside "Redistribution: not
   * permitted", which is a contradiction a reader would be right to complain
   * about. The toggles stay editable — the owner may add restrictions a licence
   * does not require, they just should not have to remember to.
   */
  const onLicenseChange = (license: LicenseType) => {
    const implied = licenseImplications(license);
    setValues((current) => ({
      ...current,
      licenseType: license,
      allowRedistribution: implied.redistribution,
      allowModification: implied.modification,
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});

    const payload = {
      slug: values.slug,
      status: values.status,
      publicationTypeId: values.publicationTypeId || null,
      featured: values.featured,
      displayOrder: Number(values.displayOrder) || 0,
      contentLanguage: values.contentLanguage,
      editionLabel: values.editionLabel,
      editionNumber: values.editionNumber,
      publicationYear: values.publicationYear,
      publicationDate: values.publicationDate,
      pageCount: values.pageCount,
      subjectEn: values.subjectEn,
      subjectKm: values.subjectKm,
      gradeLevelEn: values.gradeLevelEn,
      gradeLevelKm: values.gradeLevelKm,
      readingLevel: values.readingLevel || null,
      coverMediaId: publication?.coverMediaId ?? null,
      previewPolicy: values.previewPolicy,
      previewPageLimit: values.previewPageLimit,
      pdfDownloadPolicy: values.pdfDownloadPolicy,
      sampleDownloadPolicy: values.sampleDownloadPolicy,
      sourcePolicy: values.sourcePolicy,
      sourceRepositoryUrl: values.sourceRepositoryUrl,
      licenseType: values.licenseType,
      copyrightHolder: values.copyrightHolder,
      copyrightYear: values.copyrightYear,
      allowRedistribution: values.allowRedistribution,
      allowModification: values.allowModification,
      typesetWithLatex: values.typesetWithLatex,
      latexEngine: values.latexEngine || null,
      documentClass: values.documentClass,
      buildYear: values.buildYear,
      isbn: values.isbn,
      doi: values.doi,
      externalUrl: values.externalUrl,
      privacyStatus: publication?.privacyStatus ?? "pending_review",
      privacyReviewNote: publication?.privacyReviewNote ?? "",
      needsReview: values.needsReview,
      reviewNote: values.reviewNote,
      noindex: values.noindex,
      /*
       * Only locales the owner actually filled in. Submitting an empty Khmer
       * translation would create a row whose blank title fails the NOT-BLANK
       * check, and reporting that as "title required" on a language nobody
       * touched would be baffling.
       */
      translations: locales
        .filter((locale) => values.translations[locale].title.trim() !== "")
        .map((locale) => ({ locale, ...values.translations[locale] })),
    };

    startTransition(async () => {
      const result = publication
        ? await updatePublication(publication.id, payload)
        : await createPublication(payload);

      if (result.ok) {
        toast.show({ tone: "success", title: publication ? "Saved" : "Created" });
        if (!publication) router.push(`/admin/publications/${result.data.id}/edit`);
        else router.refresh();
        return;
      }

      setErrors(result.fields ?? {});
      toast.show({
        tone: result.code === "publish_blocked" ? "warning" : "error",
        title:
          result.code === "publish_blocked"
            ? "Not ready to publish"
            : result.code === "forbidden"
              ? "Not permitted"
              : "Could not save",
        description:
          result.detail ??
          (result.fields
            ? "Check the highlighted fields."
            : "Please try again."),
        duration: 0,
      });
    });
  };

  const errorList = Object.entries(errors).map(([field, code]) => ({
    fieldId: `${formId}-${field}`,
    message: publicationErrorLabels[code] ?? code,
  }));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <ErrorSummary heading="This publication could not be saved" errors={errorList} />

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Publication sections"
        className="flex flex-wrap gap-1 border-b border-border"
        onKeyDown={(event) => {
          const index = TABS.findIndex((candidate) => candidate.id === tab);
          if (event.key === "ArrowRight") {
            event.preventDefault();
            setTab(TABS[(index + 1) % TABS.length]!.id);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            setTab(TABS[(index - 1 + TABS.length) % TABS.length]!.id);
          }
        }}
      >
        {TABS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            id={`${formId}-tab-${candidate.id}`}
            aria-selected={tab === candidate.id}
            aria-controls={`${formId}-panel-${candidate.id}`}
            // Roving tabindex: only the selected tab is in the tab order, and
            // the arrow keys move between them. This is what makes a tablist
            // behave the way a screen-reader user expects.
            tabIndex={tab === candidate.id ? 0 : -1}
            onClick={() => setTab(candidate.id)}
            className={cn(
              "min-h-11 rounded-t-(--radius-md) px-3.5 text-small transition-colors",
              tab === candidate.id
                ? "border-b-2 border-primary font-semibold text-foreground"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      {/* ── Basics ───────────────────────────────────────────────────────── */}
      <Panel id={formId} tab="basics" active={tab}>
        <Field id={`${formId}-slug`} label="URL slug" required error={errors.slug ? publicationErrorLabels[errors.slug] : undefined} description="Lowercase letters, numbers and hyphens. This is the public address of the page.">
          {({ describedBy, invalid }) => (
            <TextInput
              id={`${formId}-slug`}
              value={values.slug}
              onChange={(e) => set("slug", e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required
            />
          )}
        </Field>

        <Field id={`${formId}-type`} label="Type" description="Editable in the database — add a type there if none fits.">
          {({ describedBy }) => (
            <Select
              id={`${formId}-type`}
              value={values.publicationTypeId}
              onChange={(e) => set("publicationTypeId", e.target.value)}
              aria-describedby={describedBy}
            >
              <option value="">No type</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.nameEn}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field id={`${formId}-status`} label="Status">
          {() => (
            <Select
              id={`${formId}-status`}
              value={values.status}
              onChange={(e) => set("status", e.target.value as PublicationStatus)}
              disabled={!canPublish}
            >
              {publicationStatuses.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field id={`${formId}-language`} label="Language of the book" description="The language the book itself is written in — not the language of this website page.">
          {({ describedBy }) => (
            <Select
              id={`${formId}-language`}
              value={values.contentLanguage}
              onChange={(e) => set("contentLanguage", e.target.value as ContentLanguage)}
              aria-describedby={describedBy}
            >
              {contentLanguages.map((language) => (
                <option key={language} value={language}>
                  {LANGUAGE_LABELS[language]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${formId}-displayOrder`} label="Display order" description="Lower numbers appear first.">
            {({ describedBy }) => (
              <TextInput
                id={`${formId}-displayOrder`}
                type="number"
                min={0}
                max={9999}
                value={values.displayOrder}
                onChange={(e) => set("displayOrder", e.target.value)}
                aria-describedby={describedBy}
              />
            )}
          </Field>

          <div className="flex flex-col justify-end gap-3 pb-1">
            <Checkbox
              id={`${formId}-featured`}
              label="Feature on the homepage"
              checked={values.featured}
              onChange={(e) => set("featured", e.target.checked)}
            />
            <Checkbox
              id={`${formId}-noindex`}
              label="Hide from search engines"
              description="Keeps the page public but out of the sitemap and search results."
              checked={values.noindex}
              onChange={(e) => set("noindex", e.target.checked)}
            />
          </div>
        </div>

        <Fieldset legend="Review" description="A publication marked as needing review cannot be published until the flag is cleared.">
          <Checkbox
            id={`${formId}-needsReview`}
            label="This still needs review"
            checked={values.needsReview}
            onChange={(e) => set("needsReview", e.target.checked)}
          />
          <Field id={`${formId}-reviewNote`} label="What needs checking?">
            {() => (
              <TextArea
                id={`${formId}-reviewNote`}
                rows={2}
                value={values.reviewNote}
                onChange={(e) => set("reviewNote", e.target.value)}
              />
            )}
          </Field>
        </Fieldset>
      </Panel>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <Panel id={formId} tab="content" active={tab}>
        {locales.map((locale) => (
          <Fieldset
            key={locale}
            legend={LOCALE_NAMES[locale]}
            description={
              locale === "en"
                ? "English is required before a publication can be published — it is the site's fallback language."
                : "Optional. Without it the Khmer page falls back to English, correctly labelled."
            }
          >
            <Field
              id={`${formId}-${locale}-title`}
              label="Display title"
              description={
                locale === "en"
                  ? "For a Khmer book, the English translation of the title."
                  : "The title as readers of this language should see it."
              }
            >
              {({ describedBy }) => (
                <TextInput
                  id={`${formId}-${locale}-title`}
                  value={values.translations[locale].title}
                  onChange={(e) => setTranslation(locale, "title", e.target.value)}
                  aria-describedby={describedBy}
                />
              )}
            </Field>

            <Field
              id={`${formId}-${locale}-originalTitle`}
              label="Original title"
              description="The title as printed on the book, in the book's own language. Shown beside the display title."
            >
              {({ describedBy }) => (
                <TextInput
                  id={`${formId}-${locale}-originalTitle`}
                  value={values.translations[locale].originalTitle}
                  onChange={(e) => setTranslation(locale, "originalTitle", e.target.value)}
                  aria-describedby={describedBy}
                  lang={values.contentLanguage === "km" ? "km" : undefined}
                />
              )}
            </Field>

            <Field id={`${formId}-${locale}-subtitle`} label="Subtitle">
              {() => (
                <TextInput
                  id={`${formId}-${locale}-subtitle`}
                  value={values.translations[locale].subtitle}
                  onChange={(e) => setTranslation(locale, "subtitle", e.target.value)}
                />
              )}
            </Field>

            <Field
              id={`${formId}-${locale}-shortSummary`}
              label="Short summary"
              description="One or two sentences. This is what the listing card shows."
            >
              {({ describedBy }) => (
                <TextArea
                  id={`${formId}-${locale}-shortSummary`}
                  rows={2}
                  value={values.translations[locale].shortSummary}
                  onChange={(e) => setTranslation(locale, "shortSummary", e.target.value)}
                  aria-describedby={describedBy}
                />
              )}
            </Field>

            <Field id={`${formId}-${locale}-description`} label="Description">
              {() => (
                <TextArea
                  id={`${formId}-${locale}-description`}
                  rows={5}
                  value={values.translations[locale].description}
                  onChange={(e) => setTranslation(locale, "description", e.target.value)}
                />
              )}
            </Field>

            <Field id={`${formId}-${locale}-introduction`} label="Introduction">
              {() => (
                <TextArea
                  id={`${formId}-${locale}-introduction`}
                  rows={4}
                  value={values.translations[locale].introduction}
                  onChange={(e) => setTranslation(locale, "introduction", e.target.value)}
                />
              )}
            </Field>

            <Field id={`${formId}-${locale}-targetAudience`} label="Who this is for">
              {() => (
                <TextArea
                  id={`${formId}-${locale}-targetAudience`}
                  rows={2}
                  value={values.translations[locale].targetAudience}
                  onChange={(e) => setTranslation(locale, "targetAudience", e.target.value)}
                />
              )}
            </Field>

            <Field
              id={`${formId}-${locale}-learningObjectives`}
              label="What the reader will learn"
              description="One per line. Rendered as a list."
            >
              {({ describedBy }) => (
                <TextArea
                  id={`${formId}-${locale}-learningObjectives`}
                  rows={4}
                  value={values.translations[locale].learningObjectives}
                  onChange={(e) =>
                    setTranslation(locale, "learningObjectives", e.target.value)
                  }
                  aria-describedby={describedBy}
                />
              )}
            </Field>

            <Field id={`${formId}-${locale}-authorNote`} label="Author's note">
              {() => (
                <TextArea
                  id={`${formId}-${locale}-authorNote`}
                  rows={3}
                  value={values.translations[locale].authorNote}
                  onChange={(e) => setTranslation(locale, "authorNote", e.target.value)}
                />
              )}
            </Field>

            <Field id={`${formId}-${locale}-acknowledgements`} label="Acknowledgements">
              {() => (
                <TextArea
                  id={`${formId}-${locale}-acknowledgements`}
                  rows={3}
                  value={values.translations[locale].acknowledgements}
                  onChange={(e) =>
                    setTranslation(locale, "acknowledgements", e.target.value)
                  }
                />
              )}
            </Field>

            <Field
              id={`${formId}-${locale}-citationText`}
              label="Citation override"
              description="Leave blank to use the citation generated from the metadata below."
            >
              {({ describedBy }) => (
                <TextArea
                  id={`${formId}-${locale}-citationText`}
                  rows={2}
                  value={values.translations[locale].citationText}
                  onChange={(e) => setTranslation(locale, "citationText", e.target.value)}
                  aria-describedby={describedBy}
                />
              )}
            </Field>
          </Fieldset>
        ))}
      </Panel>

      {/* ── Academic ─────────────────────────────────────────────────────── */}
      <Panel id={formId} tab="academic" active={tab}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${formId}-subjectEn`} label="Subject (English)">
            {() => (
              <TextInput
                id={`${formId}-subjectEn`}
                value={values.subjectEn}
                onChange={(e) => set("subjectEn", e.target.value)}
              />
            )}
          </Field>
          <Field id={`${formId}-subjectKm`} label="Subject (Khmer)">
            {() => (
              <TextInput
                id={`${formId}-subjectKm`}
                lang="km"
                value={values.subjectKm}
                onChange={(e) => set("subjectKm", e.target.value)}
              />
            )}
          </Field>
          <Field id={`${formId}-gradeLevelEn`} label="Grade or level (English)">
            {() => (
              <TextInput
                id={`${formId}-gradeLevelEn`}
                value={values.gradeLevelEn}
                onChange={(e) => set("gradeLevelEn", e.target.value)}
              />
            )}
          </Field>
          <Field id={`${formId}-gradeLevelKm`} label="Grade or level (Khmer)">
            {() => (
              <TextInput
                id={`${formId}-gradeLevelKm`}
                lang="km"
                value={values.gradeLevelKm}
                onChange={(e) => set("gradeLevelKm", e.target.value)}
              />
            )}
          </Field>
        </div>

        <Field id={`${formId}-readingLevel`} label="Reading level">
          {() => (
            <Select
              id={`${formId}-readingLevel`}
              value={values.readingLevel}
              onChange={(e) => set("readingLevel", e.target.value)}
            >
              <option value="">Not specified</option>
              {readingLevels.map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Fieldset
          legend="Edition"
          description="These mirror the active edition. Activating an edition on the Editions page updates them automatically."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${formId}-editionLabel`} label="Edition label">
              {() => (
                <TextInput
                  id={`${formId}-editionLabel`}
                  value={values.editionLabel}
                  onChange={(e) => set("editionLabel", e.target.value)}
                  placeholder="First edition"
                />
              )}
            </Field>
            <Field
              id={`${formId}-editionNumber`}
              label="Edition number"
              error={errors.editionNumber ? publicationErrorLabels[errors.editionNumber] : undefined}
            >
              {({ invalid }) => (
                <TextInput
                  id={`${formId}-editionNumber`}
                  type="number"
                  min={1}
                  value={values.editionNumber}
                  onChange={(e) => set("editionNumber", e.target.value)}
                  aria-invalid={invalid}
                />
              )}
            </Field>
            <Field
              id={`${formId}-publicationYear`}
              label="Publication year"
              error={errors.publicationYear ? publicationErrorLabels[errors.publicationYear] : undefined}
              description="Leave blank rather than guessing — the page omits what it does not know."
            >
              {({ describedBy, invalid }) => (
                <TextInput
                  id={`${formId}-publicationYear`}
                  type="number"
                  value={values.publicationYear}
                  onChange={(e) => set("publicationYear", e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </Field>
            <Field id={`${formId}-pageCount`} label="Page count">
              {() => (
                <TextInput
                  id={`${formId}-pageCount`}
                  type="number"
                  min={1}
                  value={values.pageCount}
                  onChange={(e) => set("pageCount", e.target.value)}
                />
              )}
            </Field>
          </div>
        </Fieldset>

        <Fieldset
          legend="Identifiers"
          description="Leave these blank unless you have a real one. An invented ISBN or DOI is a false claim about a public registry."
        >
          <Field
            id={`${formId}-isbn`}
            label="ISBN"
            error={errors.isbn ? publicationErrorLabels[errors.isbn] : undefined}
          >
            {({ invalid }) => (
              <TextInput
                id={`${formId}-isbn`}
                value={values.isbn}
                onChange={(e) => set("isbn", e.target.value)}
                aria-invalid={invalid}
              />
            )}
          </Field>
          <Field
            id={`${formId}-doi`}
            label="DOI"
            error={errors.doi ? publicationErrorLabels[errors.doi] : undefined}
          >
            {({ invalid }) => (
              <TextInput
                id={`${formId}-doi`}
                value={values.doi}
                onChange={(e) => set("doi", e.target.value)}
                aria-invalid={invalid}
              />
            )}
          </Field>
          <Field id={`${formId}-externalUrl`} label="External link">
            {() => (
              <TextInput
                id={`${formId}-externalUrl`}
                type="url"
                value={values.externalUrl}
                onChange={(e) => set("externalUrl", e.target.value)}
              />
            )}
          </Field>
        </Fieldset>
      </Panel>

      {/* ── Access ───────────────────────────────────────────────────────── */}
      <Panel id={formId} tab="access" active={tab}>
        {!canChangePolicy ? (
          <Notice tone="info">
            Changing the download policy requires the owner role. A book that has
            been downloaded stays downloaded, so the decision to hand out the file
            sits with the person whose work it is.
          </Notice>
        ) : null}

        <Field
          id={`${formId}-previewPolicy`}
          label="What may be read in the browser"
          description="Separate from downloading. A book can be readable in full and not downloadable, or the other way round."
        >
          {({ describedBy }) => (
            <Select
              id={`${formId}-previewPolicy`}
              value={values.previewPolicy}
              onChange={(e) => set("previewPolicy", e.target.value as PreviewPolicy)}
              aria-describedby={describedBy}
            >
              {previewPolicies.map((policy) => (
                <option key={policy} value={policy}>
                  {PREVIEW_LABELS[policy]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {values.previewPolicy === "first_pages" ? (
          <Field
            id={`${formId}-previewPageLimit`}
            label="How many pages"
            required
            error={
              errors.previewPageLimit
                ? publicationErrorLabels[errors.previewPageLimit]
                : undefined
            }
            description="A genuinely truncated PDF is built and served — the rest of the book never leaves the server."
          >
            {({ describedBy, invalid }) => (
              <TextInput
                id={`${formId}-previewPageLimit`}
                type="number"
                min={1}
                max={25}
                value={values.previewPageLimit}
                onChange={(e) => set("previewPageLimit", e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
        ) : null}

        <Field id={`${formId}-pdfDownloadPolicy`} label="PDF download">
          {() => (
            <Select
              id={`${formId}-pdfDownloadPolicy`}
              value={values.pdfDownloadPolicy}
              onChange={(e) =>
                set("pdfDownloadPolicy", e.target.value as PdfDownloadPolicy)
              }
              disabled={!canChangePolicy}
            >
              {pdfDownloadPolicies.map((policy) => (
                <option key={policy} value={policy}>
                  {DOWNLOAD_LABELS[policy]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field id={`${formId}-sampleDownloadPolicy`} label="Sample pages">
          {() => (
            <Select
              id={`${formId}-sampleDownloadPolicy`}
              value={values.sampleDownloadPolicy}
              onChange={(e) =>
                set("sampleDownloadPolicy", e.target.value as SampleDownloadPolicy)
              }
            >
              {sampleDownloadPolicies.map((policy) => (
                <option key={policy} value={policy}>
                  {SAMPLE_DOWNLOAD_LABELS[policy]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          id={`${formId}-sourcePolicy`}
          label="LaTeX source"
          description="Defaults to private. Whatever this says, the archive is never given a public URL — it is served, if at all, through the download route."
        >
          {({ describedBy }) => (
            <Select
              id={`${formId}-sourcePolicy`}
              value={values.sourcePolicy}
              onChange={(e) => set("sourcePolicy", e.target.value as SourcePolicy)}
              aria-describedby={describedBy}
              disabled={!canChangePolicy}
            >
              {sourcePolicies.map((policy) => (
                <option key={policy} value={policy}>
                  {SOURCE_LABELS[policy]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {values.sourcePolicy === "external_repo" ? (
          <Field
            id={`${formId}-sourceRepositoryUrl`}
            label="Repository URL"
            required
            error={
              errors.sourceRepositoryUrl
                ? publicationErrorLabels[errors.sourceRepositoryUrl]
                : undefined
            }
          >
            {({ invalid }) => (
              <TextInput
                id={`${formId}-sourceRepositoryUrl`}
                type="url"
                value={values.sourceRepositoryUrl}
                onChange={(e) => set("sourceRepositoryUrl", e.target.value)}
                aria-invalid={invalid}
              />
            )}
          </Field>
        ) : null}
      </Panel>

      {/* ── Rights ───────────────────────────────────────────────────────── */}
      <Panel id={formId} tab="rights" active={tab}>
        <Notice tone="info">
          An open licence cannot be withdrawn in practice — a copy released under
          CC BY stays released. Nothing here is ever set automatically.
        </Notice>

        <Field id={`${formId}-licenseType`} label="Licence">
          {() => (
            <Select
              id={`${formId}-licenseType`}
              value={values.licenseType}
              onChange={(e) => onLicenseChange(e.target.value as LicenseType)}
              disabled={!canChangePolicy}
            >
              {licenseTypes.map((license) => (
                <option key={license} value={license}>
                  {LICENSE_LABELS[license]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${formId}-copyrightHolder`} label="Copyright holder">
            {() => (
              <TextInput
                id={`${formId}-copyrightHolder`}
                value={values.copyrightHolder}
                onChange={(e) => set("copyrightHolder", e.target.value)}
              />
            )}
          </Field>
          <Field id={`${formId}-copyrightYear`} label="Copyright year">
            {() => (
              <TextInput
                id={`${formId}-copyrightYear`}
                type="number"
                value={values.copyrightYear}
                onChange={(e) => set("copyrightYear", e.target.value)}
              />
            )}
          </Field>
        </div>

        <Fieldset legend="Permissions">
          <Checkbox
            id={`${formId}-allowRedistribution`}
            label="Readers may share copies"
            checked={values.allowRedistribution}
            onChange={(e) => set("allowRedistribution", e.target.checked)}
          />
          <Checkbox
            id={`${formId}-allowModification`}
            label="Readers may adapt the work"
            checked={values.allowModification}
            onChange={(e) => set("allowModification", e.target.checked)}
          />
        </Fieldset>

        {values.licenseType === "custom" ? (
          <>
            {locales.map((locale) => (
              <Field
                key={locale}
                id={`${formId}-${locale}-licenseTerms`}
                label={`Custom terms (${LOCALE_NAMES[locale]})`}
                error={
                  errors.licenseType
                    ? publicationErrorLabels[errors.licenseType]
                    : undefined
                }
              >
                {() => (
                  <TextArea
                    id={`${formId}-${locale}-licenseTerms`}
                    rows={4}
                    value={values.translations[locale].licenseTerms}
                    onChange={(e) => setTranslation(locale, "licenseTerms", e.target.value)}
                  />
                )}
              </Field>
            ))}
          </>
        ) : null}
      </Panel>

      {/* ── Production ───────────────────────────────────────────────────── */}
      <Panel id={formId} tab="production" active={tab}>
        <Checkbox
          id={`${formId}-typesetWithLatex`}
          label="Typeset with LaTeX"
          description="Shows the “Created with LaTeX” panel on the public page."
          checked={values.typesetWithLatex}
          onChange={(e) => set("typesetWithLatex", e.target.checked)}
        />

        {values.typesetWithLatex ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${formId}-latexEngine`} label="Engine">
                {() => (
                  <Select
                    id={`${formId}-latexEngine`}
                    value={values.latexEngine}
                    onChange={(e) => set("latexEngine", e.target.value)}
                  >
                    <option value="">Not specified</option>
                    {latexEngines.map((engine) => (
                      <option key={engine} value={engine}>
                        {engine}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field id={`${formId}-documentClass`} label="Document class">
                {() => (
                  <TextInput
                    id={`${formId}-documentClass`}
                    value={values.documentClass}
                    onChange={(e) => set("documentClass", e.target.value)}
                    placeholder="book"
                  />
                )}
              </Field>
              <Field id={`${formId}-buildYear`} label="Typeset in">
                {() => (
                  <TextInput
                    id={`${formId}-buildYear`}
                    type="number"
                    value={values.buildYear}
                    onChange={(e) => set("buildYear", e.target.value)}
                  />
                )}
              </Field>
            </div>

            {locales.map((locale) => (
              <Field
                key={locale}
                id={`${formId}-${locale}-productionNotes`}
                label={`Technical notes (${LOCALE_NAMES[locale]})`}
                error={
                  errors[`translations.${locales.indexOf(locale)}.productionNotes`]
                    ? publicationErrorLabels[
                        errors[`translations.${locales.indexOf(locale)}.productionNotes`]!
                      ]
                    : undefined
                }
                description="Shown publicly. Never paste a build log or a file path — /Users/… names your machine and would be published as written."
              >
                {({ describedBy }) => (
                  <TextArea
                    id={`${formId}-${locale}-productionNotes`}
                    rows={3}
                    value={values.translations[locale].productionNotes}
                    onChange={(e) =>
                      setTranslation(locale, "productionNotes", e.target.value)
                    }
                    aria-describedby={describedBy}
                  />
                )}
              </Field>
            ))}
          </>
        ) : null}
      </Panel>

      {/* ── SEO ──────────────────────────────────────────────────────────── */}
      <Panel id={formId} tab="seo" active={tab}>
        {locales.map((locale) => (
          <Fieldset key={locale} legend={LOCALE_NAMES[locale]}>
            <Field
              id={`${formId}-${locale}-seoTitle`}
              label="SEO title"
              description="Up to 70 characters. Falls back to the display title."
              hint={`${values.translations[locale].seoTitle.length}/70`}
            >
              {({ describedBy }) => (
                <TextInput
                  id={`${formId}-${locale}-seoTitle`}
                  maxLength={70}
                  value={values.translations[locale].seoTitle}
                  onChange={(e) => setTranslation(locale, "seoTitle", e.target.value)}
                  aria-describedby={describedBy}
                />
              )}
            </Field>
            <Field
              id={`${formId}-${locale}-seoDescription`}
              label="SEO description"
              description="Up to 200 characters. Falls back to the short summary."
              hint={`${values.translations[locale].seoDescription.length}/200`}
            >
              {({ describedBy }) => (
                <TextArea
                  id={`${formId}-${locale}-seoDescription`}
                  rows={3}
                  maxLength={200}
                  value={values.translations[locale].seoDescription}
                  onChange={(e) =>
                    setTranslation(locale, "seoDescription", e.target.value)
                  }
                  aria-describedby={describedBy}
                />
              )}
            </Field>
          </Fieldset>
        ))}
      </Panel>

      {/* ── Save ─────────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-border bg-surface py-3">
        <Button type="submit" loading={isPending}>
          <Icon name="check" size={16} />
          {publication ? "Save changes" : "Create publication"}
        </Button>

        {publication ? (
          <span className="text-small text-foreground-muted">
            Editions, files, chapters, sample pages and the privacy review are on
            their own pages — this form covers the words and the policy.
          </span>
        ) : null}
      </div>
    </form>
  );
}

/**
 * One tab panel.
 *
 * Hidden with `hidden` rather than unmounted, so a half-typed description in
 * Content survives a trip to Access. `hidden` also removes it from the
 * accessibility tree, which `display: none` via a class would too — but the
 * attribute states the intent.
 */
function Panel({
  id,
  tab,
  active,
  children,
}: {
  id: string;
  tab: TabId;
  active: TabId;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${id}-panel-${tab}`}
      aria-labelledby={`${id}-tab-${tab}`}
      hidden={tab !== active}
      // `tabIndex={0}` so a keyboard user can reach the panel itself after
      // activating its tab, which is what the APG pattern expects when the panel
      // contains no focusable element at its start.
      tabIndex={0}
      className="flex flex-col gap-5"
    >
      {children}
    </div>
  );
}
