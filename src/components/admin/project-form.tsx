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
  formatList,
  projectSchema,
  publishBlockerLabels,
  publishBlockerShortLabels,
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

  /*
   * ── Repeatable lists ──────────────────────────────────────────────────────
   * Features and metrics are edited as ordered arrays. Display order is the
   * array order, so "move up" is a real move rather than the editor typing
   * sort-order numbers and hoping they stay unique. One generic updater keeps
   * the two lists behaving identically.
   */
  const updateList = useCallback(
    <K extends "features" | "metrics">(
      key: K,
      mutate: (current: ProjectFormValues[K]) => ProjectFormValues[K],
    ) => {
      setValues((current) => ({ ...current, [key]: mutate(current[key]) }));
      setIsDirty(true);
    },
    [],
  );

  const moveInList = useCallback(
    (key: "features" | "metrics", index: number, direction: -1 | 1) => {
      updateList(key, (current) => {
        const target = index + direction;
        if (target < 0 || target >= current.length) return current;

        // Index-based swap rather than destructuring, so the compiler does not
        // have to reason about a possibly-undefined element under
        // noUncheckedIndexedAccess.
        return current.map((item, position) =>
          position === index
            ? current[target]!
            : position === target
              ? current[index]!
              : item,
        ) as typeof current;
      });
    },
    [updateList],
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

      const paths = Object.keys(collected);
      const named = paths.map((path) => describeFieldPath(path, values.translations));

      /*
       * Switch to the tab holding the first error. Without this, a Khmer SEO
       * description that is twelve characters too long reports an error on a
       * panel the editor is not looking at, and the form appears to fail for no
       * reason at all.
       */
      const firstLocale = paths
        .map((path) => localeForPath(path, values.translations))
        .find((locale): locale is Locale => locale !== null);
      if (firstLocale && firstLocale !== activeLocale) setActiveLocale(firstLocale);

      toast.show({
        tone: "error",
        title:
          named.length === 1
            ? "One field needs attention"
            : `${named.length} fields need attention`,
        // Capped so a form-wide failure does not produce a wall of text; the
        // fields themselves are highlighted either way.
        description: `${formatList(named.slice(0, 5))}${named.length > 5 ? `, and ${named.length - 5} more` : ""}.`,
        duration: 0,
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
        /*
         * The server returns the blocker codes in `result.fields`; this used to
         * discard them and show only "This project is not ready to publish yet",
         * which told the editor nothing they did not already know. The publish
         * checklist in the sidebar has always listed them, but it scrolls out of
         * view on a form this long.
         *
         * "Nothing was saved" is stated first and is not a hedge: saveProject
         * runs the publish gate *before* it writes, so a blocked publish leaves
         * the database untouched. An editor who assumed otherwise and navigated
         * away would lose the whole form.
         */
        const missing = Object.keys(result.fields ?? {}).map(
          (code) => publishBlockerShortLabels[code] ?? code,
        );

        toast.show({
          tone: "warning",
          title: "Not ready to publish",
          description:
            missing.length > 0
              ? `Nothing was saved. Still to do: ${formatList(missing)}. To keep your edits now, set the status back to Draft and save.`
              : (result.detail ?? "Complete the publish checklist first."),
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
                        "inline-flex min-h-10 items-center gap-2 rounded-(--radius-md) border px-3 text-small font-medium",
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

          {/* ── Key features ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-h4 font-semibold">Key features</h2>
                <p className="text-[0.8125rem] text-foreground-muted">
                  Rendered as a grid on the case study, in this order. Aim for
                  5–12 — the important ones, not every button.
                </p>
              </div>
              <Button
                variant="outline"
                iconStart="plus"
                onClick={() =>
                  updateList("features", (current) => [
                    ...current,
                    {
                      title_en: "",
                      title_km: null,
                      description_en: null,
                      description_km: null,
                      icon: null,
                    },
                  ])
                }
              >
                Add feature
              </Button>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {values.features.length === 0 ? (
                <p className="text-small text-foreground-muted">
                  No features yet. The features section is simply not rendered
                  when this list is empty.
                </p>
              ) : null}

              {values.features.map((feature, index) => (
                <RepeatableRow
                  key={index}
                  label={feature.title_en || `Feature ${index + 1}`}
                  index={index}
                  count={values.features.length}
                  onMove={(direction) => moveInList("features", index, direction)}
                  onRemove={() =>
                    updateList("features", (current) =>
                      current.filter((_, position) => position !== index),
                    )
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SimpleField
                      label="Title (English)"
                      value={feature.title_en}
                      onChange={(value) =>
                        updateList("features", (current) =>
                          current.map((item, position) =>
                            position === index ? { ...item, title_en: value } : item,
                          ),
                        )
                      }
                      required
                      error={friendlyError(errors[`features.${index}.title_en`])}
                    />
                    <SimpleField
                      label="Title (Khmer)"
                      value={feature.title_km ?? ""}
                      onChange={(value) =>
                        updateList("features", (current) =>
                          current.map((item, position) =>
                            position === index
                              ? { ...item, title_km: value || null }
                              : item,
                          ),
                        )
                      }
                      optional
                      lang="km"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <SimpleTextArea
                      label="Description (English)"
                      value={feature.description_en ?? ""}
                      onChange={(value) =>
                        updateList("features", (current) =>
                          current.map((item, position) =>
                            position === index
                              ? { ...item, description_en: value || null }
                              : item,
                          ),
                        )
                      }
                      rows={3}
                      optional
                    />
                    <SimpleTextArea
                      label="Description (Khmer)"
                      value={feature.description_km ?? ""}
                      onChange={(value) =>
                        updateList("features", (current) =>
                          current.map((item, position) =>
                            position === index
                              ? { ...item, description_km: value || null }
                              : item,
                          ),
                        )
                      }
                      rows={3}
                      optional
                      lang="km"
                    />
                  </div>

                  <SimpleField
                    label="Icon"
                    value={feature.icon ?? ""}
                    onChange={(value) =>
                      updateList("features", (current) =>
                        current.map((item, position) =>
                          position === index ? { ...item, icon: value || null } : item,
                        ),
                      )
                    }
                    optional
                    placeholder="shield"
                    description="An icon name from the site's set. An unknown name falls back to a checkmark rather than breaking."
                  />
                </RepeatableRow>
              ))}
            </CardBody>
          </Card>

          {/* ── Measured results ─────────────────────────────────────────── */}
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-h4 font-semibold">Measured results</h2>
                <p className="text-[0.8125rem] text-foreground-muted">
                  Numbers only, each with its source. Prose belongs in the
                  Results section of the case study.
                </p>
              </div>
              <Button
                variant="outline"
                iconStart="plus"
                onClick={() =>
                  updateList("metrics", (current) => [
                    ...current,
                    {
                      label_en: "",
                      label_km: null,
                      value: "",
                      unit: null,
                      metric_type: "other" as const,
                      source_note: null,
                      measured_at: null,
                      // Unverified by default: a number has to earn its way onto
                      // the public page, not be published and checked later.
                      is_verified: false,
                    },
                  ])
                }
              >
                Add result
              </Button>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Notice tone="info" icon="info">
                <p>
                  Only results marked verified are shown to visitors, and a
                  verified result must state where the number came from — the
                  source is printed next to it. Anything you cannot source stays
                  unverified and stays private.
                </p>
              </Notice>

              {values.metrics.map((metric, index) => (
                <RepeatableRow
                  key={index}
                  label={metric.label_en || `Result ${index + 1}`}
                  index={index}
                  count={values.metrics.length}
                  onMove={(direction) => moveInList("metrics", index, direction)}
                  onRemove={() =>
                    updateList("metrics", (current) =>
                      current.filter((_, position) => position !== index),
                    )
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SimpleField
                      label="Label (English)"
                      value={metric.label_en}
                      onChange={(value) =>
                        updateList("metrics", (current) =>
                          current.map((item, position) =>
                            position === index ? { ...item, label_en: value } : item,
                          ),
                        )
                      }
                      required
                      error={friendlyError(errors[`metrics.${index}.label_en`])}
                    />
                    <SimpleField
                      label="Label (Khmer)"
                      value={metric.label_km ?? ""}
                      onChange={(value) =>
                        updateList("metrics", (current) =>
                          current.map((item, position) =>
                            position === index
                              ? { ...item, label_km: value || null }
                              : item,
                          ),
                        )
                      }
                      optional
                      lang="km"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <SimpleField
                      label="Value"
                      value={metric.value}
                      onChange={(value) =>
                        updateList("metrics", (current) =>
                          current.map((item, position) =>
                            position === index ? { ...item, value } : item,
                          ),
                        )
                      }
                      required
                      error={friendlyError(errors[`metrics.${index}.value`])}
                    />
                    <SimpleField
                      label="Unit"
                      value={metric.unit ?? ""}
                      onChange={(value) =>
                        updateList("metrics", (current) =>
                          current.map((item, position) =>
                            position === index
                              ? { ...item, unit: value || null }
                              : item,
                          ),
                        )
                      }
                      optional
                      placeholder="s"
                    />
                    <LabelledSelect
                      label="Type"
                      value={metric.metric_type}
                      onChange={(value) =>
                        updateList("metrics", (current) =>
                          current.map((item, position) =>
                            position === index
                              ? {
                                  ...item,
                                  metric_type:
                                    value as (typeof current)[number]["metric_type"],
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      {METRIC_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </LabelledSelect>
                  </div>

                  <SimpleTextArea
                    label="Source"
                    description="Where this number came from. Required before it can be verified, and shown publicly."
                    value={metric.source_note ?? ""}
                    onChange={(value) =>
                      updateList("metrics", (current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, source_note: value || null }
                            : item,
                        ),
                      )
                    }
                    rows={2}
                    error={friendlyError(errors[`metrics.${index}.source_note`])}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <SimpleField
                      label="Measured on"
                      value={metric.measured_at ?? ""}
                      onChange={(value) =>
                        updateList("metrics", (current) =>
                          current.map((item, position) =>
                            position === index
                              ? { ...item, measured_at: value || null }
                              : item,
                          ),
                        )
                      }
                      type="date"
                      optional
                    />
                    <div className="flex items-end pb-1">
                      <Checkbox
                        id={`metric-verified-${index}`}
                        label="Verified — show this publicly"
                        checked={metric.is_verified}
                        onChange={(event) =>
                          updateList("metrics", (current) =>
                            current.map((item, position) =>
                              position === index
                                ? { ...item, is_verified: event.target.checked }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                </RepeatableRow>
              ))}
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

// ── Naming what went wrong ──────────────────────────────────────────────────

/**
 * Human labels for every field a validation error can land on.
 *
 * "The highlighted fields could not be saved" is only useful if you can see the
 * highlight. In this form you routinely cannot: the offending input may be on
 * the other language tab, inside a collapsed feature row, or simply below the
 * fold of a very long page. Naming the fields — and their language — turns a
 * dead end into an instruction.
 */
const PROJECT_FIELD_LABELS: Record<string, string> = {
  slug: "URL slug",
  status: "Publication status",
  project_status: "Project status",
  sort_order: "Sort order",
  role_en: "Role (English)",
  role_km: "Role (Khmer)",
  organization_en: "Organisation (English)",
  organization_km: "Organisation (Khmer)",
  team_size: "Team size",
  duration_label_en: "Duration (English)",
  duration_label_km: "Duration (Khmer)",
  period_label_en: "Period (English)",
  period_label_km: "Period (Khmer)",
  year_label: "Year label",
  live_url: "Live URL",
  repository_url: "Repository URL",
  demo_video_url: "Demo video URL",
  started_at: "Started on",
  completed_at: "Completed on",
  review_note: "Review note",
  cover_media_id: "Cover image",
  og_image_media_id: "Social preview image",
};

const TRANSLATION_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  summary: "Short summary",
  seo_title: "SEO title",
  seo_description: "SEO description",
};

const FEATURE_FIELD_LABELS: Record<string, string> = {
  title_en: "Title (English)",
  title_km: "Title (Khmer)",
  description_en: "Description (English)",
  description_km: "Description (Khmer)",
  icon: "Icon",
};

const METRIC_FIELD_LABELS: Record<string, string> = {
  label_en: "Label (English)",
  label_km: "Label (Khmer)",
  value: "Value",
  unit: "Unit",
  metric_type: "Type",
  source_note: "Source",
  measured_at: "Measured on",
};

/** Turns a dotted error path into something an editor can act on. */
function describeFieldPath(
  path: string,
  translations: ProjectFormValues["translations"],
): string {
  const [head, second, third] = path.split(".");

  if (head === "translations") {
    const locale = translations[Number(second)]?.locale;
    const language = locale ? localeMeta[locale].englishName : "Translation";
    const field =
      TRANSLATION_FIELD_LABELS[third ?? ""] ??
      CASE_STUDY_FIELDS.find((entry) => entry.key === third)?.label ??
      third ??
      "field";
    return `${language} · ${field}`;
  }

  if (head === "features") {
    return `Feature ${Number(second) + 1} · ${FEATURE_FIELD_LABELS[third ?? ""] ?? third}`;
  }

  if (head === "metrics") {
    return `Result ${Number(second) + 1} · ${METRIC_FIELD_LABELS[third ?? ""] ?? third}`;
  }

  return PROJECT_FIELD_LABELS[head ?? ""] ?? head ?? "field";
}

/** The locale tab an error belongs to, so the form can switch to it. */
function localeForPath(
  path: string,
  translations: ProjectFormValues["translations"],
): Locale | null {
  const [head, second] = path.split(".");
  if (head !== "translations") return null;
  return translations[Number(second)]?.locale ?? null;
}

// ── Repeatable list row ─────────────────────────────────────────────────────

const METRIC_TYPES = [
  "scale",
  "performance",
  "efficiency",
  "accessibility",
  "seo",
  "deployment",
  "other",
] as const;

/**
 * One entry in an ordered list, with its own move and remove controls.
 *
 * Reordering is two buttons rather than drag-and-drop on purpose: buttons work
 * from the keyboard and with a screen reader without any extra work, and these
 * lists are short enough that dragging would not be meaningfully faster.
 */
function RepeatableRow({
  label,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-(--radius-lg) border border-border p-4">
      <legend className="flex items-center gap-2 px-1 text-small font-semibold">
        {label}
      </legend>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          iconStart="chevronUp"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label={`Move “${label}” up`}
        >
          Up
        </Button>
        <Button
          variant="ghost"
          iconStart="chevronDown"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          aria-label={`Move “${label}” down`}
        >
          Down
        </Button>
        <Button
          variant="ghost"
          iconStart="trash"
          onClick={onRemove}
          aria-label={`Remove “${label}”`}
        >
          Remove
        </Button>
      </div>

      {children}
    </fieldset>
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
  lang,
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
  /** Marks Khmer inputs, so the field renders in the right script and font. */
  lang?: string;
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
          lang={lang}
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
                  className="size-4 rounded-(--radius-xs) border border-border-strong accent-(--primary)"
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
