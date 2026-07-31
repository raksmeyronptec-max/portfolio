"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Card, CardBody, CardHeader, Divider, Tag } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PrivacyReviewPanel } from "./privacy-review";
import { OriginalViewer } from "./original-viewer";
import { saveCertificate } from "@/lib/actions/certificates";
import {
  certificateBlockerLabels,
  certificatePublishBlockers,
  certificateSchema,
  type CertificateInput,
} from "@/lib/validation/certificate";
import { slugify } from "@/lib/validation/project";
import { locales, localeMeta, type Locale } from "@/i18n/config";
import type { FormOption } from "@/lib/data/admin-forms";
import { cn } from "@/lib/utils/cn";

export type CertificateFormValues = CertificateInput & {
  id?: string;
  /** Server-recorded review timestamp, read-only in the form. */
  privacyReviewedAt: string | null;
};

export function CertificateForm({
  initial,
  categories,
  previewOptions,
  originalOptions,
  projectOptions,
}: {
  initial: CertificateFormValues;
  categories: FormOption[];
  /** Public image assets, eligible as a redacted preview. */
  previewOptions: FormOption[];
  /** Private assets, eligible as the original scan. */
  originalOptions: FormOption[];
  projectOptions: FormOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [values, setValues] = useState<CertificateFormValues>(initial);
  const [activeLocale, setActiveLocale] = useState<Locale>("en");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [skillDraft, setSkillDraft] = useState("");

  const slugId = useId();
  const skillInputId = useId();

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
    <K extends keyof CertificateFormValues>(key: K, value: CertificateFormValues[K]) => {
      setValues((current) => ({ ...current, [key]: value }));
      setIsDirty(true);
    },
    [],
  );

  const updateTranslation = useCallback((locale: Locale, key: string, value: string) => {
    setValues((current) => ({
      ...current,
      translations: current.translations.map((translation) =>
        translation.locale === locale ? { ...translation, [key]: value } : translation,
      ),
    }));
    setIsDirty(true);
  }, []);

  const translation = useMemo(
    () =>
      values.translations.find((item) => item.locale === activeLocale) ??
      values.translations[0],
    [values.translations, activeLocale],
  );

  const blockers = useMemo(() => certificatePublishBlockers(values), [values]);
  const canPublish = blockers.length === 0;
  const translationIndex = values.translations.findIndex((t) => t.locale === activeLocale);

  function addSkill() {
    const label = skillDraft.trim();
    if (!label) return;
    if (values.skills.includes(label)) {
      setSkillDraft("");
      return;
    }
    update("skills", [...values.skills, label]);
    setSkillDraft("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsed = certificateSchema.safeParse(values);
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
        description: Object.values(collected).map(friendlyError).join(" "),
      });
      return;
    }

    startTransition(async () => {
      const result = await saveCertificate(parsed.data, values.id);

      if (result.ok) {
        setIsDirty(false);
        toast.show({
          tone: "success",
          title: values.id ? "Credential saved" : "Credential created",
          description:
            values.status === "published"
              ? "The public page has been refreshed."
              : "Saved as a draft — not visible to visitors.",
        });

        if (!values.id) {
          router.replace(`/admin/certificates/${result.data.id}/edit`);
        }
        router.refresh();
        return;
      }

      if (result.code === "publish_blocked") {
        toast.show({
          tone: "warning",
          title: "Not ready to publish",
          description: Object.keys(result.fields ?? {})
            .map((code) => certificateBlockerLabels[code] ?? code)
            .join(" "),
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
              ? "That slug is already used by another credential."
              : result.detail ?? "Please try again.",
      });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {isDirty ? (
        <Notice tone="info" icon="clock">
          <p>You have unsaved changes.</p>
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {/* ── Credential details ───────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-h4 font-semibold">Credential details</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Field
                id={slugId}
                label="URL slug"
                description="Used in the public URL: /en/certificates/<slug>."
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
                        const title = values.translations.find((t) => t.locale === "en")
                          ?.title;
                        if (title) update("slug", slugify(title));
                      }}
                    >
                      From title
                    </Button>
                  </div>
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <SimpleField
                  label="Issuing organisation (English)"
                  value={values.issuer_en}
                  onChange={(value) => update("issuer_en", value)}
                  required
                  error={friendlyError(errors.issuer_en)}
                />
                <SimpleField
                  label="Issuing organisation (Khmer)"
                  value={values.issuer_km ?? ""}
                  onChange={(value) => update("issuer_km", value || null)}
                  optional
                  lang="km"
                />
                <SimpleField
                  label="Issuer website"
                  value={values.issuer_url ?? ""}
                  onChange={(value) => update("issuer_url", value || null)}
                  type="url"
                  optional
                  error={friendlyError(errors.issuer_url)}
                />
                <LabelledSelect
                  label="Category"
                  value={values.category_id ?? ""}
                  onChange={(value) => update("category_id", value || null)}
                >
                  <option value="">Uncategorised</option>
                  {categories.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </LabelledSelect>
                <SimpleField
                  label="Issued on"
                  value={values.issued_on ?? ""}
                  onChange={(value) => update("issued_on", value || null)}
                  type="date"
                  error={friendlyError(errors.issued_on)}
                  description="Required to publish."
                />
                <SimpleField
                  label="Expires on"
                  value={values.expires_on ?? ""}
                  onChange={(value) => update("expires_on", value || null)}
                  type="date"
                  optional
                  error={friendlyError(errors.expires_on)}
                  description="Leave empty if it does not expire."
                />
                <SimpleField
                  label="Credential ID"
                  value={values.credential_id ?? ""}
                  onChange={(value) => update("credential_id", value || null)}
                  optional
                  description="Only if it is meant to be public for verification."
                />
                <SimpleField
                  label="Verification URL"
                  value={values.verification_url ?? ""}
                  onChange={(value) => update("verification_url", value || null)}
                  type="url"
                  optional
                  error={friendlyError(errors.verification_url)}
                />
                <SimpleField
                  label="Internal reference"
                  value={values.internal_ref ?? ""}
                  onChange={(value) => update("internal_ref", value || null)}
                  optional
                  description="Your own filing reference. Never shown publicly."
                />
                <LabelledSelect
                  label="Credential status"
                  value={values.credential_status}
                  onChange={(value) =>
                    update(
                      "credential_status",
                      value as CertificateFormValues["credential_status"],
                    )
                  }
                >
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="revoked">Revoked</option>
                  <option value="unverified">Awaiting verification</option>
                </LabelledSelect>
              </div>
            </CardBody>
          </Card>

          {/* ── Content ──────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <h2 className="text-h4 font-semibold">Content</h2>

                <div role="tablist" aria-label="Content language" className="flex gap-1">
                  {locales.map((locale) => {
                    const entry = values.translations.find((t) => t.locale === locale);
                    const complete =
                      Boolean(entry?.title?.trim()) && Boolean(entry?.image_summary?.trim());

                    return (
                      <button
                        key={locale}
                        type="button"
                        role="tab"
                        aria-selected={activeLocale === locale}
                        onClick={() => setActiveLocale(locale)}
                        className={cn(
                          "inline-flex min-h-10 items-center gap-2 rounded-(--radius-md) border px-3 text-small font-medium",
                          activeLocale === locale
                            ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                            : "border-border text-foreground-muted hover:bg-surface-muted",
                        )}
                      >
                        <span lang={localeMeta[locale].tag}>
                          {localeMeta[locale].nativeName}
                        </span>
                        <Icon
                          name={complete ? "checkCircle" : "alertCircle"}
                          size={14}
                          className={complete ? "text-success" : "text-warning"}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardHeader>

            <CardBody className="flex flex-col gap-5">
              {translation ? (
                <div lang={localeMeta[activeLocale].tag} className="flex flex-col gap-5">
                  <SimpleField
                    label="Credential title"
                    value={translation.title}
                    onChange={(value) => updateTranslation(activeLocale, "title", value)}
                    required
                    error={friendlyError(errors[`translations.${translationIndex}.title`])}
                  />

                  <SimpleTextArea
                    label="Description"
                    description="What this credential is and what it represents."
                    value={translation.description ?? ""}
                    onChange={(value) =>
                      updateTranslation(activeLocale, "description", value)
                    }
                    rows={4}
                  />

                  <SimpleTextArea
                    label="What the document shows"
                    description="Required to publish. This is the text alternative to the scan — describe what is written on it for anyone who cannot see the image."
                    value={translation.image_summary ?? ""}
                    onChange={(value) =>
                      updateTranslation(activeLocale, "image_summary", value)
                    }
                    rows={4}
                  />

                  <Divider />

                  <SimpleField
                    label="SEO title"
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
                    description="Between 50 and 160 characters, or leave empty."
                    value={translation.seo_description ?? ""}
                    onChange={(value) =>
                      updateTranslation(activeLocale, "seo_description", value)
                    }
                    rows={3}
                    maxLength={160}
                    hint={`${(translation.seo_description ?? "").length}/160`}
                    error={friendlyError(
                      errors[`translations.${translationIndex}.seo_description`],
                    )}
                  />
                </div>
              ) : null}
            </CardBody>
          </Card>

          {/* ── Privacy review ───────────────────────────────────────────── */}
          <PrivacyReviewPanel
            confirmed={values.privacy_review_confirmed}
            onConfirmedChange={(value) => update("privacy_review_confirmed", value)}
            note={values.privacy_review_note ?? ""}
            onNoteChange={(value) => update("privacy_review_note", value || null)}
            containsSensitiveData={values.contains_sensitive_data}
            onContainsSensitiveDataChange={(value) => {
              update("contains_sensitive_data", value);
              // Keep the pair consistent so the form can never submit the
              // combination the database rejects.
              if (value) update("allow_public_download", false);
            }}
            allowPublicDownload={values.allow_public_download}
            onAllowPublicDownloadChange={(value) => update("allow_public_download", value)}
            reviewedAt={values.privacyReviewedAt}
            hasOriginal={Boolean(values.original_media_id)}
            hasPreview={Boolean(values.preview_media_id)}
          />

          {/* ── Skills ───────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-h4 font-semibold">Skills demonstrated</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={skillInputId} className="text-small font-medium">
                  Add a skill
                </label>
                <div className="flex gap-2">
                  <TextInput
                    id={skillInputId}
                    value={skillDraft}
                    onChange={(event) => setSkillDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        // Enter adds the skill instead of submitting the whole form,
                        // which is what a user expects in a tag input.
                        event.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="Lesson planning"
                  />
                  <Button variant="outline" iconStart="plus" onClick={addSkill}>
                    Add
                  </Button>
                </div>
              </div>

              {values.skills.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {values.skills.map((skill) => (
                    <li key={skill}>
                      <span className="inline-flex items-center gap-1.5 rounded-(--radius-sm) border border-border bg-surface px-2 py-1 text-[0.8125rem]">
                        {skill}
                        <button
                          type="button"
                          aria-label={`Remove ${skill}`}
                          onClick={() =>
                            update(
                              "skills",
                              values.skills.filter((item) => item !== skill),
                            )
                          }
                          className="rounded-(--radius-xs) text-foreground-muted hover:text-danger"
                        >
                          <Icon name="close" size={13} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-foreground-muted">No skills added yet.</p>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ══ Sidebar ══════════════════════════════════════════════════════ */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-4">
          <Card>
            <CardHeader>
              <h2 className="text-h4 font-semibold">Publish checklist</h2>
            </CardHeader>
            <CardBody>
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
                        {certificateBlockerLabels[code] ?? code}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-h4 font-semibold">Files</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <LabelledSelect
                label="Public preview (redacted)"
                value={values.preview_media_id ?? ""}
                onChange={(value) => update("preview_media_id", value || null)}
                description="The only image shown publicly. Required to publish."
              >
                <option value="">No preview attached</option>
                {previewOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </LabelledSelect>

              <LabelledSelect
                label="Private original"
                value={values.original_media_id ?? ""}
                onChange={(value) => update("original_media_id", value || null)}
                description="Stored privately. Only private assets can be selected here — the database rejects a public one."
              >
                <option value="">No original attached</option>
                {originalOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </LabelledSelect>

              {values.id && values.original_media_id ? (
                <OriginalViewer certificateId={values.id} />
              ) : null}

              <LabelledSelect
                label="Social preview image"
                value={values.og_image_media_id ?? ""}
                onChange={(value) => update("og_image_media_id", value || null)}
                description="Falls back to the redacted preview."
              >
                <option value="">Use the preview image</option>
                {previewOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </LabelledSelect>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-h4 font-semibold">Publication</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <LabelledSelect
                label="Status"
                value={values.status}
                onChange={(value) =>
                  update("status", value as CertificateFormValues["status"])
                }
              >
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="published" disabled={!canPublish}>
                  Published{canPublish ? "" : " — checklist incomplete"}
                </option>
                <option value="archived">Archived</option>
              </LabelledSelect>

              <Checkbox
                id="certificate-featured"
                label="Featured on the homepage"
                checked={values.featured}
                onChange={(event) => update("featured", event.target.checked)}
              />

              <SimpleField
                label="Sort order"
                value={String(values.sort_order)}
                onChange={(value) => update("sort_order", Number(value) || 0)}
                type="number"
              />

              <Divider />

              <Checkbox
                id="certificate-needs-review"
                label="Needs review — unconfirmed details"
                checked={values.needs_review}
                onChange={(event) => update("needs_review", event.target.checked)}
              />

              <SimpleTextArea
                label="Review note"
                value={values.review_note ?? ""}
                onChange={(value) => update("review_note", value || null)}
                rows={3}
                optional
              />
            </CardBody>
          </Card>

          {projectOptions.length > 0 ? (
            <Card>
              <CardHeader>
                <h2 className="text-h4 font-semibold">Related projects</h2>
              </CardHeader>
              <CardBody>
                <fieldset className="border-0 p-0">
                  <legend className="sr-only">Projects related to this credential</legend>
                  <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
                    {projectOptions.map((option) => (
                      <label
                        key={option.id}
                        className="flex min-h-9 cursor-pointer items-center gap-2.5 text-small"
                      >
                        <input
                          type="checkbox"
                          checked={values.relatedProjectIds.includes(option.id)}
                          onChange={(event) =>
                            update(
                              "relatedProjectIds",
                              event.target.checked
                                ? [...values.relatedProjectIds, option.id]
                                : values.relatedProjectIds.filter((id) => id !== option.id),
                            )
                          }
                          className="size-4 rounded-(--radius-xs) border border-border-strong accent-(--primary)"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <p className="text-[0.8125rem] text-foreground-muted">
          {values.status === "published"
            ? "This credential is live on the public site."
            : "This credential is not visible to visitors."}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!isDirty || window.confirm("Discard unsaved changes and leave?")) {
                router.push("/admin/certificates");
              }
            }}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isPending} iconStart="check">
            {values.id ? "Save changes" : "Create credential"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ── Field helpers (local to keep the form self-contained) ───────────────────

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

function friendlyError(code: string | undefined): string | undefined {
  if (!code) return undefined;

  const map: Record<string, string> = {
    slugTooShort: "The slug must be at least 2 characters.",
    slugTooLong: "The slug must be 90 characters or fewer.",
    slugFormat: "Use lower-case letters, numbers and hyphens only.",
    slugTaken: "That slug is already used by another credential.",
    titleRequired: "A title is required.",
    issuerRequired: "The issuing organisation is required.",
    urlMustBeAbsolute: "Enter a full URL starting with https://",
    invalidDate: "Use the date picker, or the format YYYY-MM-DD.",
    expiryBeforeIssue: "The expiry date cannot be before the issue date.",
    downloadWhileSensitive:
      "Public download cannot be enabled while the document is flagged as sensitive.",
    seoTitleTooLong: "The SEO title must be 70 characters or fewer.",
    seoDescriptionLength:
      "The SEO description must be between 50 and 160 characters, or left empty.",
    atLeastOneTranslation: "At least one language version is required.",
  };

  return map[code] ?? code;
}

export { Tag };
