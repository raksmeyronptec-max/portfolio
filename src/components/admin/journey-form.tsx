"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, ErrorSummary, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Divider } from "@/components/ui/primitives";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { createJourneyEntry, updateJourneyEntry } from "@/lib/actions/journey";
import type { AdminJourneyEntry } from "@/lib/data/admin-journey";
import {
  datePrecisions,
  journeyErrorLabels,
  publicationStatuses,
  type DatePrecision,
  type PublicationStatus,
} from "@/lib/validation/journey";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils/cn";

/**
 * The journey story editor.
 *
 * ── Why the date fields look the way they do ───────────────────────────────
 * `datePrecision` is the field that stops this CMS fabricating. The owner
 * frequently knows a photograph is from 2024 and nothing more, and a bare `date`
 * input would force them to pick a day. So the precision is chosen explicitly,
 * the form explains what each choice does to the rendered page, and `unknown`
 * is a first-class answer rather than an empty field.
 *
 * ── Why publication is at the bottom ───────────────────────────────────────
 * Same argument as the media manager: the interface's ordering is the argument.
 * Describe, then date, then check, then publish — and the publish control states
 * its blockers rather than simply refusing.
 */

const STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: "Draft — not visible on the site",
  in_review: "In review — not visible on the site",
  published: "Published — visible on the site",
  archived: "Archived — withdrawn from the site",
};

const PRECISION_LABELS: Record<DatePrecision, string> = {
  day: "Exact day — renders as “14 March 2024”",
  month: "Month and year — renders as “March 2024”",
  year: "Year only — renders as “2024”",
  range: "A period — uses the start and end dates below",
  unknown: "Not known — the story files under “Date to be confirmed”",
};

const LOCALE_NAMES: Record<Locale, string> = { en: "English", km: "Khmer" };

type TranslationValues = {
  title: string;
  eyebrow: string;
  summary: string;
  story: string;
  highlights: string;
  seoTitle: string;
  seoDescription: string;
};

type FormValues = {
  slug: string;
  status: PublicationStatus;
  categoryId: string;
  featured: boolean;
  sortOrder: string;
  eventDate: string;
  datePrecision: DatePrecision;
  periodStart: string;
  periodEnd: string;
  periodLabelEn: string;
  periodLabelKm: string;
  locationEn: string;
  locationKm: string;
  organisationEn: string;
  organisationKm: string;
  externalUrl: string;
  needsReview: boolean;
  reviewNote: string;
  translations: Record<Locale, TranslationValues>;
};

const EMPTY_TRANSLATION: TranslationValues = {
  title: "",
  eyebrow: "",
  summary: "",
  story: "",
  highlights: "",
  seoTitle: "",
  seoDescription: "",
};

function toFormValues(entry: AdminJourneyEntry | null): FormValues {
  const translations: Record<Locale, TranslationValues> = {
    en: { ...EMPTY_TRANSLATION },
    km: { ...EMPTY_TRANSLATION },
  };

  for (const translation of entry?.translations ?? []) {
    const locale = translation.locale as Locale;
    if (!locales.includes(locale)) continue;
    translations[locale] = {
      title: translation.title,
      eyebrow: translation.eyebrow ?? "",
      summary: translation.summary ?? "",
      story: translation.story ?? "",
      highlights: translation.highlights ?? "",
      seoTitle: translation.seoTitle ?? "",
      seoDescription: translation.seoDescription ?? "",
    };
  }

  return {
    slug: entry?.slug ?? "",
    status: entry?.status ?? "draft",
    categoryId: entry?.categoryId ?? "",
    featured: entry?.featured ?? false,
    sortOrder: (entry?.sortOrder ?? 0).toString(),
    eventDate: entry?.eventDate ?? "",
    datePrecision: entry?.datePrecision ?? "unknown",
    periodStart: entry?.periodStart ?? "",
    periodEnd: entry?.periodEnd ?? "",
    periodLabelEn: entry?.periodLabelEn ?? "",
    periodLabelKm: entry?.periodLabelKm ?? "",
    locationEn: entry?.locationEn ?? "",
    locationKm: entry?.locationKm ?? "",
    organisationEn: entry?.organisationEn ?? "",
    organisationKm: entry?.organisationKm ?? "",
    externalUrl: entry?.externalUrl ?? "",
    needsReview: entry?.needsReview ?? true,
    reviewNote: entry?.reviewNote ?? "",
    translations,
  };
}

/** Derive a URL slug from an English title. Mirrors `slugify()` in migration 0001. */
function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function JourneyForm({
  entry,
  categories,
  canPublish,
}: {
  entry: AdminJourneyEntry | null;
  categories: Array<{ id: string; nameEn: string }>;
  canPublish: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [values, setValues] = useState<FormValues>(() => toFormValues(entry));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [activeLocale, setActiveLocale] = useState<Locale>("en");

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

  /*
   * Publication blockers, computed live.
   *
   * Restates the trigger in migration 0024 so the reason appears next to the
   * control rather than arriving as a check_violation after the save. The trigger
   * remains the guarantee.
   */
  const blockers: string[] = [];
  if (values.needsReview) blockers.push("This story is still marked as needing review.");
  if (!values.translations.en.title.trim()) blockers.push("There is no English title.");

  function submit() {
    setFieldErrors({});

    /*
     * Only locales with a title are submitted. An empty Khmer tab must not create
     * a blank translation row — a row with an empty title violates the NOT-BLANK
     * constraint, and one with only a summary would make `resolveTranslation()`
     * pick it and render a story with no heading.
     */
    const translations = locales
      .filter((locale) => values.translations[locale].title.trim() !== "")
      .map((locale) => ({
        locale,
        title: values.translations[locale].title,
        eyebrow: values.translations[locale].eyebrow,
        summary: values.translations[locale].summary,
        story: values.translations[locale].story,
        highlights: values.translations[locale].highlights,
        seoTitle: values.translations[locale].seoTitle,
        seoDescription: values.translations[locale].seoDescription,
      }));

    const payload = {
      slug: values.slug.trim() || slugify(values.translations.en.title),
      status: values.status,
      categoryId: values.categoryId || null,
      featured: values.featured,
      sortOrder: Number(values.sortOrder) || 0,
      eventDate: values.eventDate,
      datePrecision: values.datePrecision,
      periodStart: values.periodStart,
      periodEnd: values.periodEnd,
      periodLabelEn: values.periodLabelEn,
      periodLabelKm: values.periodLabelKm,
      locationEn: values.locationEn,
      locationKm: values.locationKm,
      organisationEn: values.organisationEn,
      organisationKm: values.organisationKm,
      externalUrl: values.externalUrl,
      // The cover is set from the media manager, where the image can be seen.
      // Preserved here so saving the form does not clear it.
      coverMediaId: entry?.coverMediaId ?? null,
      needsReview: values.needsReview,
      reviewNote: values.reviewNote,
      translations,
    };

    startTransition(async () => {
      const result = entry
        ? await updateJourneyEntry(entry.id, payload)
        : await createJourneyEntry(payload);

      if (result.ok) {
        toast.show({
          tone: "success",
          title: entry ? "Story saved" : "Story created",
          description: entry
            ? undefined
            : "Now add photographs and video, and link it to the records it evidences.",
        });

        if (!entry) {
          router.push(`/admin/journey/${result.data.id}/edit`);
          return;
        }

        router.refresh();
        return;
      }

      if (result.fields) setFieldErrors(result.fields);

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
            ? Object.values(result.fields)
                .map((code) => journeyErrorLabels[code] ?? code)
                .join(" ")
            : "Please check the highlighted fields and try again."),
        duration: 0,
      });
    });
  }

  const errorEntries = Object.entries(fieldErrors).map(([field, code]) => ({
    field,
    message: journeyErrorLabels[code] ?? code,
  }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex max-w-3xl flex-col gap-6"
    >
      {errorEntries.length > 0 ? (
        <ErrorSummary
          heading="This story could not be saved"
          errors={errorEntries.map((error) => ({
            fieldId: error.field,
            message: error.message,
          }))}
        />
      ) : null}

      {/* ── Language tabs ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div role="tablist" aria-label="Content language" className="flex gap-1">
          {locales.map((locale) => (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={activeLocale === locale}
              onClick={() => setActiveLocale(locale)}
              className={cn(
                "min-h-11 rounded-(--radius-md) px-4 text-small font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                activeLocale === locale
                  ? "bg-primary-subtle text-primary-subtle-foreground"
                  : "text-foreground-muted hover:bg-surface-muted",
              )}
            >
              {LOCALE_NAMES[locale]}
              {values.translations[locale].title.trim() ? null : (
                <span className="ml-1.5 text-foreground-subtle">·</span>
              )}
            </button>
          ))}
        </div>

        {activeLocale === "km" && !values.translations.km.title.trim() ? (
          <Notice tone="info" icon="languages">
            <p>
              Leaving Khmer empty is fine. The site falls back to English and marks the
              text with <code>lang=&quot;en&quot;</code>, so a screen reader pronounces it
              correctly rather than reading English with Khmer phonetics. Do not
              transliterate an institution&rsquo;s name — get the official Khmer form or
              leave it.
            </p>
          </Notice>
        ) : null}

        <LabelledInput
          label={`Title (${LOCALE_NAMES[activeLocale]})`}
          description={
            activeLocale === "en"
              ? "Required before the story can be published."
              : undefined
          }
          value={values.translations[activeLocale].title}
          onChange={(value) => setTranslation(activeLocale, "title", value)}
          khmer={activeLocale === "km"}
        />

        <LabelledInput
          label={`Eyebrow (${LOCALE_NAMES[activeLocale]})`}
          description="A short label above the title. Optional."
          value={values.translations[activeLocale].eyebrow}
          onChange={(value) => setTranslation(activeLocale, "eyebrow", value)}
          khmer={activeLocale === "km"}
        />

        <LabelledArea
          label={`Summary (${LOCALE_NAMES[activeLocale]})`}
          description="One or two sentences. Shown on the timeline and used as the search description."
          rows={3}
          value={values.translations[activeLocale].summary}
          onChange={(value) => setTranslation(activeLocale, "summary", value)}
          khmer={activeLocale === "km"}
        />

        <LabelledArea
          label={`Story (${LOCALE_NAMES[activeLocale]})`}
          description="The full account. Leave a blank line between paragraphs."
          rows={10}
          value={values.translations[activeLocale].story}
          onChange={(value) => setTranslation(activeLocale, "story", value)}
          khmer={activeLocale === "km"}
        />

        <LabelledArea
          label={`Highlights (${LOCALE_NAMES[activeLocale]})`}
          description="One per line. Rendered as a checked list."
          rows={4}
          value={values.translations[activeLocale].highlights}
          onChange={(value) => setTranslation(activeLocale, "highlights", value)}
          khmer={activeLocale === "km"}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <LabelledInput
            label={`SEO title (${LOCALE_NAMES[activeLocale]})`}
            description="Up to 70 characters. Defaults to the title."
            value={values.translations[activeLocale].seoTitle}
            onChange={(value) => setTranslation(activeLocale, "seoTitle", value)}
            khmer={activeLocale === "km"}
          />
          <LabelledInput
            label={`SEO description (${LOCALE_NAMES[activeLocale]})`}
            description="Up to 200 characters. Defaults to the summary."
            value={values.translations[activeLocale].seoDescription}
            onChange={(value) => setTranslation(activeLocale, "seoDescription", value)}
            khmer={activeLocale === "km"}
          />
        </div>
      </div>

      <Divider />

      {/* ── Facts ─────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <LabelledInput
          label="URL slug"
          description="Lowercase letters, numbers and hyphens. Left empty, it is derived from the English title."
          value={values.slug}
          onChange={(value) => set("slug", value)}
        />
        <LabelledSelect
          label="Category"
          value={values.categoryId}
          options={[
            { value: "", label: "No category" },
            ...categories.map((category) => ({
              value: category.id,
              label: category.nameEn,
            })),
          ]}
          onChange={(value) => set("categoryId", value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LabelledInput
          label="Organisation (English)"
          value={values.organisationEn}
          onChange={(value) => set("organisationEn", value)}
        />
        <LabelledInput
          label="Organisation (Khmer)"
          value={values.organisationKm}
          onChange={(value) => set("organisationKm", value)}
          khmer
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LabelledInput
          label="Location (English)"
          value={values.locationEn}
          onChange={(value) => set("locationEn", value)}
        />
        <LabelledInput
          label="Location (Khmer)"
          value={values.locationKm}
          onChange={(value) => set("locationKm", value)}
          khmer
        />
      </div>

      <LabelledInput
        label="Related link"
        description="An https:// address for a programme page, article or announcement. Optional."
        value={values.externalUrl}
        onChange={(value) => set("externalUrl", value)}
      />

      <Divider />

      {/* ── Dates ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <h2 className="text-small font-semibold">When it happened</h2>

        <LabelledSelect
          label="How precisely is the date known?"
          description="Choose only what is actually evidenced. Inventing a day to fill the field is exactly what this control exists to prevent."
          value={values.datePrecision}
          options={datePrecisions.map((precision) => ({
            value: precision,
            label: PRECISION_LABELS[precision],
          }))}
          onChange={(value) => set("datePrecision", value as DatePrecision)}
        />

        {values.datePrecision !== "unknown" && values.datePrecision !== "range" ? (
          <LabelledInput
            label="Date"
            description="Only the part matching the precision above is displayed."
            type="date"
            value={values.eventDate}
            onChange={(value) => set("eventDate", value)}
          />
        ) : null}

        {values.datePrecision === "range" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <LabelledInput
              label="Start"
              type="date"
              value={values.periodStart}
              onChange={(value) => set("periodStart", value)}
            />
            <LabelledInput
              label="End"
              description="Leave empty if it is ongoing."
              type="date"
              value={values.periodEnd}
              onChange={(value) => set("periodEnd", value)}
            />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <LabelledInput
            label="Period label (English)"
            description="Overrides everything above. Use it when no pair of dates says it properly — “2023 — 2028 (expected)”."
            value={values.periodLabelEn}
            onChange={(value) => set("periodLabelEn", value)}
          />
          <LabelledInput
            label="Period label (Khmer)"
            value={values.periodLabelKm}
            onChange={(value) => set("periodLabelKm", value)}
            khmer
          />
        </div>
      </div>

      <Divider />

      {/* ── Review and publication ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <h2 className="text-small font-semibold">Review and publication</h2>

        <LabelledCheckbox
          checked={values.needsReview}
          label="This story still needs review"
          description="Blocks publication. Clear it once every uncertain field has been confirmed — the database refuses to publish while it is set."
          onChange={(next) => set("needsReview", next)}
        />

        <LabelledArea
          label="Review note"
          description="Name exactly which fields are unconfirmed. “Needs review” on its own says only that something is wrong."
          rows={3}
          value={values.reviewNote}
          onChange={(value) => set("reviewNote", value)}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <LabelledSelect
            label="Status"
            value={values.status}
            options={publicationStatuses.map((status) => ({
              value: status,
              label: STATUS_LABELS[status],
              disabled:
                status === "published" && (!canPublish || blockers.length > 0),
            }))}
            onChange={(value) => set("status", value as PublicationStatus)}
          />

          <div className="flex items-end pb-2">
            <LabelledCheckbox
              checked={values.featured}
              label="Featured"
              description="Shown in the homepage's selected moments."
              onChange={(next) => set("featured", next)}
            />
          </div>

          <LabelledInput
            label="Sort order"
            description="Tiebreaker within the same year. Lower first."
            type="number"
            value={values.sortOrder}
            onChange={(value) => set("sortOrder", value)}
          />
        </div>

        {blockers.length > 0 ? (
          <Notice tone="warning" icon="alertCircle" title="Cannot be published yet">
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </Notice>
        ) : null}

        {!canPublish ? (
          <Notice tone="info" icon="lock">
            <p>Your role can edit this story but cannot publish it.</p>
          </Notice>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending} loading={isPending}>
          {entry ? "Save story" : "Create story"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/admin/journey")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Small labelled controls ─────────────────────────────────────────────────

/**
 * `Checkbox` takes a required `id` and a native change event. This wrapper
 * supplies the id from `useId()` and hands the caller a boolean, which is what
 * every call site here actually wants.
 */
function LabelledCheckbox({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description?: string;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();

  return (
    <Checkbox
      id={id}
      checked={checked}
      label={label}
      description={description}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

function LabelledInput({
  label,
  description,
  value,
  onChange,
  type = "text",
  khmer,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  khmer?: boolean;
}) {
  const id = useId();

  return (
    <Field id={id} label={label} description={description}>
      {({ describedBy }) => (
        <TextInput
          id={id}
          type={type}
          lang={khmer ? "km" : undefined}
          value={value}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

function LabelledArea({
  label,
  description,
  rows = 3,
  value,
  onChange,
  khmer,
}: {
  label: string;
  description?: string;
  rows?: number;
  value: string;
  onChange: (value: string) => void;
  khmer?: boolean;
}) {
  const id = useId();

  return (
    <Field id={id} label={label} description={description}>
      {({ describedBy }) => (
        <TextArea
          id={id}
          rows={rows}
          lang={khmer ? "km" : undefined}
          value={value}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

function LabelledSelect({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <Field id={id} label={label} description={description}>
      {({ describedBy }) => (
        <Select
          id={id}
          value={value}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
