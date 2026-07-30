"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Card, CardBody, CardHeader, Divider } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { saveProject } from "@/lib/actions/projects";
import {
  projectSchema,
  publishBlockerLabels,
  publishBlockers,
  slugify,
  type ProjectInput,
} from "@/lib/validation/project";
import { locales, localeMeta, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils/cn";

export type ProjectFormOption = { id: string; label: string };

export type ProjectFormValues = ProjectInput & { id?: string };

/**
 * Project editor.
 *
 * Design decisions:
 *
 *  - **Both languages are edited in one form**, switched by tab, with the
 *    completeness of each tab shown on the tab itself. Editing them on separate
 *    pages would make it easy to publish English and forget Khmer, which is the
 *    single most likely bilingual failure.
 *
 *  - **A live publish checklist** replaces a "Publish" button that fails. The
 *    editor can see exactly what is missing before choosing a status, and the
 *    Published option is disabled until the list is clear.
 *
 *  - **Unsaved-change warning** via `beforeunload`. The case-study fields are long;
 *    losing them to a stray navigation would be costly.
 *
 *  - **Field-level errors come back from the server** keyed by dotted path, so a
 *    Khmer SEO description that is 12 characters too long is reported on that exact
 *    input rather than as a generic failure.
 */
export function ProjectForm({
  initial,
  categories,
  technologies,
  mediaOptions,
}: {
  initial: ProjectFormValues;
  categories: ProjectFormOption[];
  technologies: ProjectFormOption[];
  mediaOptions: ProjectFormOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [values, setValues] = useState<ProjectFormValues>(initial);
  const [activeLocale, setActiveLocale] = useState<Locale>("en");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  const slugId = useId();

  // Warn before losing long-form content to a navigation.
  useEffect(() => {
    if (!isDirty) return;

    function handler(event: BeforeUnloadEvent) {
      event.preventDefault();
      return "";
    }

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const update = useCallback(
    <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) => {
      setValues((current) => ({ ...current, [key]: value }));
      setIsDirty(true);
    },
    [],
  );

  const updateTranslation = useCallback(
    (locale: Locale, key: string, value: string) => {
      setValues((current) => ({
        ...current,
        translations: current.translations.map((translation) =>
          translation.locale === locale
            ? { ...translation, [key]: value }
            : translation,
        ),
      }));
      setIsDirty(true);
    },
    [],
  );

  const translation = useMemo(
    () =>
      values.translations.find((item) => item.locale === activeLocale) ??
      values.translations[0],
    [values.translations, activeLocale],
  );

  // Recomputed on every keystroke, so the checklist is always current.
  const blockers = useMemo(() => publishBlockers(values), [values]);
  const canPublish = blockers.length === 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    // Validate locally first so obvious problems do not need a round trip.
    const parsed = projectSchema.safeParse(values);
    if (!parsed.success) {
      const collected: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!collected[path]) collected[path] = issue.message;
      }
      setErrors(collected);
      toast.show({
        tone: "error",
        title: "Some fields need attention",
        description: "The highlighted fields could not be saved.",
      });
      return;
    }

    startTransition(async () => {
      const result = await saveProject(parsed.data, values.id);

      if (result.ok) {
        setIsDirty(false);
        toast.show({
          tone: "success",
          title: values.id ? "Project saved" : "Project created",
          description:
            values.status === "published"
              ? "The public page has been refreshed."
              : "Saved as a draft — not visible to visitors.",
        });

        if (!values.id) {
          router.replace(`/admin/projects/${result.data.id}/edit`);
        }
        router.refresh();
        return;
      }

      if (result.code === "publish_blocked") {
        toast.show({
          tone: "warning",
          title: "Not ready to publish",
          description: result.detail ?? "Complete the publish checklist first.",
          duration: 0,
        });
        return;
      }

      if (result.fields) setErrors(result.fields);

      toast.show({
        tone: "error",
        title: "Could not save",
        description:
          result.code === "forbidden"
            ? "Your role does not permit this change."
            : result.code === "conflict"
              ? "That slug is already in use by another project."
              : result.detail ?? "Please try again.",
      });
    });
  }

  const localeTabs = locales.map((locale) => {
    const entry = values.translations.find((item) => item.locale === locale);
    const complete =
      Boolean(entry?.title?.trim()) &&
      Boolean(entry?.summary?.trim()) &&
      Boolean(entry?.overview?.trim());

    return {
      locale,
      label: localeMeta[locale].nativeName,
      complete,
      hasContent: Boolean(entry?.title?.trim()),
    };
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {isDirty ? (
        <Notice tone="info" icon="clock">
          <p>You have unsaved changes.</p>
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* ══ Main column ══════════════════════════════════════════════════ */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* ── Identity ─────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-h4 font-semibold">Identity</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Field
                id={slugId}
                label="URL slug"
                description="Used in the public URL: /en/projects/<slug>. Lower-case letters, numbers and hyphens only."
                required
                requiredLabel="required"
                error={friendlyError(errors.slug)}
              >
                {({ describedBy, invalid }) => (
                  <div className="flex gap-2">
                    <TextInput
                      id={slugId}
                      value={values.slug}
                      onChange={(event) => update("slug", event.target.value)}
                      aria-describedby={describedBy}
                      aria-invalid={invalid || undefined}
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        const title = values.translations.find(
                          (item) => item.locale === "en",
                        )?.title;
                        if (title) update("slug", slugify(title));
                      }}
                    >
                      From title
                    </Button>
                  </div>
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <LabelledSelect
                  label="Publication status"
                  value={values.status}
                  onChange={(value) =>
                    update("status", value as ProjectFormValues["status"])
                  }
                  description="Draft → In review → Published → Archived"
                >
                  <option value="draft">Draft</option>
                  <option value="in_review">In review</option>
                  <option value="published" disabled={!canPublish}>
                    Published{canPublish ? "" : " — checklist incomplete"}
                  </option>
                  <option value="archived">Archived</option>
                </LabelledSelect>

                <LabelledSelect
                  label="Project status"
                  value={values.project_status}
                  onChange={(value) =>
                    update("project_status", value as ProjectFormValues["project_status"])
                  }
                  description="The state of the software itself, shown on the card."
                >
                  <option value="live">Live</option>
                  <option value="in_development">In development</option>
                  <option value="maintained">Maintained</option>
                  <option value="sunset">Sunset</option>
                  <option value="concept">Concept</option>
                </LabelledSelect>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SimpleField
                  label="Live URL"
                  value={values.live_url ?? ""}
                  onChange={(value) => update("live_url", value || null)}
                  placeholder="https://example.org"
                  error={friendlyError(errors.live_url)}
                  type="url"
                />
                <SimpleField
                  label="Repository URL"
                  value={values.repository_url ?? ""}
                  onChange={(value) => update("repository_url", value || null)}
                  placeholder="https://github.com/…"
                  error={friendlyError(errors.repository_url)}
                  optional
                  type="url"
                />
              </div>
            </CardBody>
          </Card>

          {/* ── Case study ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <h2 className="text-h4 font-semibold">Case study content</h2>

                {/* Language tabs with completeness on the tab itself. */}
                <div
                  role="tablist"
                  aria-label="Content language"
                  className="flex gap-1"
                >
                  {localeTabs.map((tab) => (
                    <button
                      key={tab.locale}
                      type="button"
                      role="tab"
                      aria-selected={activeLocale === tab.locale}
                      onClick={() => setActiveLocale(tab.locale)}
                      className={cn(
                        "inline-flex min-h-10 items-center gap-2 rounded-[--radius-md] border px-3 text-small font-medium",
                        activeLocale === tab.locale
                          ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                          : "border-border text-foreground-muted hover:bg-surface-muted",
                      )}
                    >
                      <span lang={localeMeta[tab.locale].tag}>{tab.label}</span>
                      {tab.complete ? (
                        <Icon name="checkCircle" size={14} className="text-success" />
                      ) : tab.hasContent ? (
                        <Icon name="clock" size={14} className="text-warning" />
                      ) : (
                        <Icon name="alertCircle" size={14} className="text-danger" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardBody className="flex flex-col gap-5">
              {translation ? (
                <div
                  role="tabpanel"
                  lang={localeMeta[activeLocale].tag}
                  className="flex flex-col gap-5"
                >
                  <SimpleField
                    label="Title"
                    value={translation.title}
                    onChange={(value) => updateTranslation(activeLocale, "title", value)}
                    required
                    error={friendlyError(
                      errors[
                        `translations.${values.translations.findIndex((t) => t.locale === activeLocale)}.title`
                      ],
                    )}
                  />

                  <SimpleTextArea
                    label="Short summary"
                    description="One or two sentences. Shown on the project card and used as the fallback SEO description."
                    value={translation.summary ?? ""}
                    onChange={(value) =>
                      updateTranslation(activeLocale, "summary", value)
                    }
                    rows={3}
                    maxLength={400}
                  />

                  <Divider />

                  {CASE_STUDY_FIELDS.map((field) => (
                    <SimpleTextArea
                      key={field.key}
                      label={field.label}
                      description={field.description}
                      value={(translation[field.key as keyof typeof translation] as string | null) ?? ""}
                      onChange={(value) =>
                        updateTranslation(activeLocale, field.key, value)
                      }
                      rows={field.rows ?? 5}
                    />
                  ))}

                  <Divider />

                  <SimpleField
                    label="SEO title"
                    description="Up to 70 characters. Falls back to the project title."
                    value={translation.seo_title ?? ""}
                    onChange={(value) =>
                      updateTranslation(activeLocale, "seo_title", value)
                    }
                    maxLength={70}
                    optional
                    hint={`${(translation.seo_title ?? "").length}/70`}
                  />

                  <SimpleTextArea
                    label="SEO description"
                    description="Between 50 and 160 characters. Required to publish — without it, search engines invent their own snippet."
                    value={translation.seo_description ?? ""}
                    onChange={(value) =>
                      updateTranslation(activeLocale, "seo_description", value)
                    }
                    rows={3}
                    maxLength={160}
                    hint={`${(translation.seo_description ?? "").length}/160`}
                    error={friendlyError(
                      errors[
                        `translations.${values.translations.findIndex((t) => t.locale === activeLocale)}.seo_description`
                      ],
                    )}
                  />
                </div>
              ) : null}
            </CardBody>
          </Card>

          {/* ── Facts ────────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-h4 font-semibold">Project facts</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Notice tone="info" icon="info">
                <p>
                  Leave anything you cannot verify empty. The public page shows
                  “Not yet confirmed” for empty team size and duration, which is
                  honest — a plausible-looking guess is not.
                </p>
              </Notice>

              <div className="grid gap-4 sm:grid-cols-2">
                <SimpleField
                  label="Role (English)"
                  value={values.role_en ?? ""}
                  onChange={(value) => update("role_en", value || null)}
                  optional
                />
                <SimpleField
                  label="Role (Khmer)"
                  value={values.role_km ?? ""}
                  onChange={(value) => update("role_km", value || null)}
                  optional
                  lang="km"
                />
                <SimpleField
                  label="Organisation (English)"
                  value={values.organization_en ?? ""}
                  onChange={(value) => update("organization_en", value || null)}
                  optional
                />
                <SimpleField
                  label="Organisation (Khmer)"
                  value={values.organization_km ?? ""}
                  onChange={(value) => update("organization_km", value || null)}
                  optional
                  lang="km"
                />
                <SimpleField
                  label="Team size"
                  value={values.team_size ? String(values.team_size) : ""}
                  onChange={(value) =>
                    update("team_size", value ? Number(value) : null)
                  }
                  type="number"
                  optional
                  description="Leave empty if unconfirmed."
                />
                <SimpleField
                  label="Year label"
                  value={values.year_label ?? ""}
                  onChange={(value) => update("year_label", value || null)}
                  optional
                  placeholder="2024 or 2023–2024"
                  description="Only the precision you can actually evidence."
                />
                <SimpleField
                  label="Duration (English)"
                  value={values.duration_label_en ?? ""}
                  onChange={(value) => update("duration_label_en", value || null)}
                  optional
                  placeholder="4 months"
                />
                <SimpleField
                  label="Duration (Khmer)"
                  value={values.duration_label_km ?? ""}
                  onChange={(value) => update("duration_label_km", value || null)}
                  optional
                  lang="km"
                />
                <SimpleField
                  label="Started on"
                  value={values.started_at ?? ""}
                  onChange={(value) => update("started_at", value || null)}
                  type="date"
                  optional
                  error={friendlyError(errors.started_at)}
                />
                <SimpleField
                  label="Completed on"
                  value={values.completed_at ?? ""}
                  onChange={(value) => update("completed_at", value || null)}
                  type="date"
                  optional
                  error={friendlyError(errors.completed_at)}
                />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ══ Sidebar ══════════════════════════════════════════════════════ */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-4">
          {/* ── Publish checklist ────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-h4 font-semibold">Publish checklist</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              {canPublish ? (
                <p className="flex items-start gap-2 text-small text-success-foreground">
                  <Icon name="checkCircle" size={16} className="mt-0.5" />
                  Ready to publish.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {blockers.map((code) => (
                    <li key={code} className="flex items-start gap-2 text-small">
                      <Icon
                        name="alertCircle"
                        size={16}
                        className="mt-0.5 shrink-0 text-warning"
                      />
                      <span className="text-foreground-muted">
                        {publishBlockerLabels[code] ?? code}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* ── Review flag ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-h4 font-semibold">Review status</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <Checkbox
                id="needs-review"
                label="Needs review — contains unconfirmed facts"
                description="Set automatically for content migrated from the old site. Publishing is blocked while this is on."
                checked={values.needs_review}
                onChange={(event) => update("needs_review", event.target.checked)}
              />

              <SimpleTextArea
                label="Review note"
                description="What specifically is unconfirmed?"
                value={values.review_note ?? ""}
                onChange={(value) => update("review_note", value || null)}
                rows={5}
                optional
              />
            </CardBody>
          </Card>

          {/* ── Presentation ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-h4 font-semibold">Presentation</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Checkbox
                id="featured"
                label="Featured on the homepage"
                checked={values.featured}
                onChange={(event) => update("featured", event.target.checked)}
              />

              <SimpleField
                label="Sort order"
                value={String(values.sort_order)}
                onChange={(value) => update("sort_order", Number(value) || 0)}
                type="number"
                description="Lower numbers appear first."
              />

              <LabelledSelect
                label="Cover image"
                value={values.cover_media_id ?? ""}
                onChange={(value) => update("cover_media_id", value || null)}
                description="Required to publish. Upload in the Media library first."
              >
                <option value="">No cover image</option>
                {mediaOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </LabelledSelect>

              <LabelledSelect
                label="Social preview image"
                value={values.og_image_media_id ?? ""}
                onChange={(value) => update("og_image_media_id", value || null)}
                description="Falls back to the cover image."
              >
                <option value="">Use the cover image</option>
                {mediaOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </LabelledSelect>
            </CardBody>
          </Card>

          {/* ── Taxonomies ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-h4 font-semibold">Categories</h2>
            </CardHeader>
            <CardBody>
              <CheckboxGroup
                legend="Project categories"
                options={categories}
                selected={values.categoryIds}
                onChange={(ids) => update("categoryIds", ids)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-h4 font-semibold">Technologies</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <p className="text-[0.8125rem] text-foreground-muted">
                Only list what the project genuinely uses.
              </p>
              <CheckboxGroup
                legend="Technologies used"
                options={technologies}
                selected={values.technologyIds}
                onChange={(ids) => update("technologyIds", ids)}
                scrollable
              />
            </CardBody>
          </Card>
        </aside>
      </div>

      {/* ══ Sticky action bar ═════════════════════════════════════════════ */}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <p className="text-[0.8125rem] text-foreground-muted">
          {values.status === "published"
            ? "This project is live on the public site."
            : "This project is not visible to visitors."}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (
                !isDirty ||
                window.confirm("Discard unsaved changes and leave this page?")
              ) {
                router.push("/admin/projects");
              }
            }}
          >
            Cancel
          </Button>

          <Button type="submit" loading={isPending} iconStart="check">
            {values.id ? "Save changes" : "Create project"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ── Case-study field definitions ────────────────────────────────────────────

const CASE_STUDY_FIELDS: Array<{
  key: string;
  label: string;
  description?: string;
  rows?: number;
}> = [
  { key: "overview", label: "Overview", description: "What is this, in plain terms?", rows: 5 },
  { key: "problem", label: "The problem", description: "What was wrong before this existed?", rows: 5 },
  { key: "target_users", label: "Who it is for", rows: 3 },
  { key: "goals", label: "Goals", rows: 4 },
  { key: "my_role", label: "My role", rows: 3 },
  { key: "responsibilities", label: "Responsibilities", rows: 4 },
  { key: "constraints", label: "Constraints", rows: 3 },
  { key: "research", label: "Research and discovery", rows: 4 },
  { key: "ux_decisions", label: "UX decisions", rows: 5 },
  { key: "architecture", label: "Architecture", rows: 5 },
  { key: "database_decisions", label: "Database decisions", rows: 5 },
  { key: "key_features", label: "Key features", rows: 5 },
  { key: "security_notes", label: "Security", rows: 4 },
  { key: "accessibility_notes", label: "Accessibility", rows: 4 },
  { key: "seo_notes", label: "SEO", rows: 4 },
  { key: "performance_notes", label: "Performance", rows: 4 },
  { key: "challenges", label: "Challenges", rows: 4 },
  { key: "solution", label: "Solution", description: "How it works now.", rows: 5 },
  {
    key: "results",
    label: "Results",
    description:
      "Prose only. Numbers belong in Measured results, where each figure carries its source.",
    rows: 4,
  },
  { key: "lessons", label: "What I learned", rows: 4 },
  { key: "next_steps", label: "Next improvements", rows: 3 },
];

// ── Small field wrappers ────────────────────────────────────────────────────

function SimpleField({
  label,
  value,
  onChange,
  description,
  error,
  required = false,
  optional = false,
  type = "text",
  placeholder,
  maxLength,
  hint,
  lang,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
  lang?: string;
}) {
  const id = useId();

  return (
    <Field
      id={id}
      label={label}
      description={description}
      error={error}
      required={required}
      requiredLabel="required"
      optionalLabel="optional"
      showOptional={optional}
      hint={hint}
    >
      {({ describedBy, invalid }) => (
        <TextInput
          id={id}
          type={type}
          value={value}
          lang={lang}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

function SimpleTextArea({
  label,
  value,
  onChange,
  description,
  error,
  rows = 4,
  maxLength,
  hint,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  error?: string;
  rows?: number;
  maxLength?: number;
  hint?: string;
  optional?: boolean;
}) {
  const id = useId();

  return (
    <Field
      id={id}
      label={label}
      description={description}
      error={error}
      optionalLabel="optional"
      showOptional={optional}
      hint={hint}
    >
      {({ describedBy, invalid }) => (
        <TextArea
          id={id}
          rows={rows}
          value={value}
          maxLength={maxLength}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

function LabelledSelect({
  label,
  value,
  onChange,
  description,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  children: React.ReactNode;
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
          {children}
        </Select>
      )}
    </Field>
  );
}

/**
 * Multi-select as a real checkbox group inside a `<fieldset>` with a `<legend>`.
 *
 * A multi-select `<select multiple>` is notoriously hard to operate — especially on
 * touch — and screen readers announce it poorly. Checkboxes are unambiguous.
 */
function CheckboxGroup({
  legend,
  options,
  selected,
  onChange,
  scrollable = false,
}: {
  legend: string;
  options: ProjectFormOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  scrollable?: boolean;
}) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="sr-only">{legend}</legend>

      <div
        className={cn(
          "flex flex-col gap-1.5",
          scrollable && "max-h-64 overflow-y-auto pr-1",
        )}
      >
        {options.length === 0 ? (
          <p className="text-small text-foreground-muted">Nothing available yet.</p>
        ) : (
          options.map((option) => {
            const checked = selected.includes(option.id);

            return (
              <label
                key={option.id}
                className="flex min-h-9 cursor-pointer items-center gap-2.5 text-small"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, option.id]
                        : selected.filter((id) => id !== option.id),
                    )
                  }
                  className="size-4 rounded-[--radius-xs] border border-border-strong accent-[--primary]"
                />
                {option.label}
              </label>
            );
          })
        )}
      </div>
    </fieldset>
  );
}

/** Turn a validation code into a sentence. */
function friendlyError(code: string | undefined): string | undefined {
  if (!code) return undefined;

  const map: Record<string, string> = {
    slugTooShort: "The slug must be at least 2 characters.",
    slugTooLong: "The slug must be 80 characters or fewer.",
    slugFormat: "Use lower-case letters, numbers and hyphens only.",
    slugTaken: "That slug is already used by another project.",
    titleRequired: "A title is required.",
    urlMustBeAbsolute: "Enter a full URL starting with https://",
    invalidDate: "Use the date picker, or the format YYYY-MM-DD.",
    seoTitleTooLong: "The SEO title must be 70 characters or fewer.",
    seoDescriptionLength:
      "The SEO description must be between 50 and 160 characters, or left empty.",
    atLeastOneTranslation: "At least one language version is required.",
  };

  return map[code] ?? code;
}
