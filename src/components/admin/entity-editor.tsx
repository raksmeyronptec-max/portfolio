"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Divider } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { locales, localeMeta, type Locale } from "@/i18n/config";
import type { ActionResult } from "@/lib/actions/result";
import { cn } from "@/lib/utils/cn";

/**
 * Generic entity editor.
 *
 * Education, experience, references and capabilities all have the same editing
 * shape: a set of locale-independent fields, plus one set of translatable fields per
 * language, plus a save action that returns an `ActionResult`. Rather than writing
 * four near-identical 400-line forms, the shape is described declaratively and this
 * component renders it.
 *
 * What that buys, beyond less code: the accessibility wiring, the error mapping, the
 * unsaved-change warning and the language-tab completeness indicator are implemented
 * once and are therefore identical in all four places.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "url"
  | "date"
  | "number"
  | "select"
  | "checkbox"
  | "tags";

export type FieldSpec = {
  key: string;
  label: string;
  type: FieldType;
  description?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
  /** Renders the input with `lang="km"` so Khmer text uses the Khmer font stack. */
  khmer?: boolean;
  /** Two fields share a row on wide screens. */
  half?: boolean;
};

export type TranslationFieldSpec = FieldSpec & {
  /** Field is required for the language tab to count as complete. */
  completesTranslation?: boolean;
};

export type EntityValues = Record<string, unknown> & {
  translations: Array<Record<string, unknown> & { locale: Locale }>;
};

export function EntityEditor({
  open,
  onClose,
  title,
  description,
  fields,
  translationFields,
  values: initialValues,
  errorLabels,
  onSave,
  saveLabel = "Save",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  fields: FieldSpec[];
  translationFields: TranslationFieldSpec[];
  values: EntityValues;
  errorLabels: Record<string, string>;
  onSave: (values: EntityValues) => Promise<ActionResult<unknown>>;
  saveLabel?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [values, setValues] = useState<EntityValues>(initialValues);
  const [activeLocale, setActiveLocale] = useState<Locale>("en");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  /*
   * Reset when the dialog is reopened for a different record.
   *
   * Adjusted during render rather than in an effect. React's documented pattern
   * for "derive state from a changed prop" — the guard makes it run once per
   * transition, React re-renders immediately without committing the stale values,
   * and the editor therefore never paints the previous record's data for a frame.
   */
  const [renderedFor, setRenderedFor] = useState<EntityValues | null>(
    open ? initialValues : null,
  );

  if (open && renderedFor !== initialValues) {
    setRenderedFor(initialValues);
    setValues(initialValues);
    setErrors({});
    setIsDirty(false);
    setActiveLocale("en");
  } else if (!open && renderedFor !== null) {
    setRenderedFor(null);
  }

  function update(key: string, value: unknown) {
    setValues((current) => ({ ...current, [key]: value }));
    setIsDirty(true);
  }

  function updateTranslation(locale: Locale, key: string, value: unknown) {
    setValues((current) => ({
      ...current,
      translations: current.translations.map((translation) =>
        translation.locale === locale ? { ...translation, [key]: value } : translation,
      ),
    }));
    setIsDirty(true);
  }

  const translation = values.translations.find((item) => item.locale === activeLocale);

  function label(code: string | undefined): string | undefined {
    if (!code) return undefined;
    return errorLabels[code] ?? code;
  }

  function save() {
    setErrors({});

    startTransition(async () => {
      const result = await onSave(values);

      if (result.ok) {
        setIsDirty(false);
        toast.show({ tone: "success", title: "Saved" });
        onClose();
        router.refresh();
        return;
      }

      if (result.fields) setErrors(result.fields);

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
            ? Object.values(result.fields).map(label).filter(Boolean).join(" ")
            : "Please try again."),
        duration: result.code === "publish_blocked" ? 0 : undefined,
      });
    });
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isDirty || window.confirm("Discard unsaved changes?")) onClose();
      }}
      title={title}
      description={description}
      closeLabel="Close"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={save} loading={isPending} iconStart="check">
            {saveLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* ── Locale-independent fields ─────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className={field.half ? "" : "sm:col-span-2"}>
              <RenderField
                spec={field}
                value={values[field.key]}
                error={label(errors[field.key])}
                onChange={(value) => update(field.key, value)}
              />
            </div>
          ))}
        </div>

        <Divider />

        {/* ── Language tabs ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label="Content language" className="flex gap-1">
            {locales.map((locale) => {
              const entry = values.translations.find((item) => item.locale === locale);

              const complete = translationFields
                .filter((field) => field.completesTranslation)
                .every((field) => {
                  const value = entry?.[field.key];
                  return typeof value === "string" && value.trim() !== "";
                });

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

          {translation ? (
            <div
              lang={localeMeta[activeLocale].tag}
              className="grid gap-4 sm:grid-cols-2"
            >
              {translationFields.map((field) => {
                const index = values.translations.findIndex(
                  (item) => item.locale === activeLocale,
                );

                return (
                  <div key={field.key} className={field.half ? "" : "sm:col-span-2"}>
                    <RenderField
                      spec={field}
                      value={translation[field.key]}
                      error={label(errors[`translations.${index}.${field.key}`])}
                      onChange={(value) =>
                        updateTranslation(activeLocale, field.key, value)
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {isDirty ? (
          <Notice tone="info" icon="clock">
            <p>Unsaved changes.</p>
          </Notice>
        ) : null}
      </div>
    </Dialog>
  );
}

// ── Field renderer ──────────────────────────────────────────────────────────

function RenderField({
  spec,
  value,
  error,
  onChange,
}: {
  spec: FieldSpec;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const id = useId();

  if (spec.type === "checkbox") {
    return (
      <Checkbox
        id={id}
        label={spec.label}
        description={spec.description}
        error={error}
        checked={Boolean(value)}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  }

  const stringValue =
    value === null || value === undefined
      ? ""
      : Array.isArray(value)
        ? value.join(", ")
        : String(value);

  return (
    <Field
      id={id}
      label={spec.label}
      description={spec.description}
      error={error}
      required={spec.required}
      requiredLabel="required"
      optionalLabel="optional"
      showOptional={!spec.required}
      hint={
        spec.maxLength ? `${stringValue.length}/${spec.maxLength}` : undefined
      }
    >
      {({ describedBy, invalid }) => {
        const shared = {
          id,
          "aria-describedby": describedBy,
          "aria-invalid": invalid || undefined,
          lang: spec.khmer ? "km" : undefined,
        };

        if (spec.type === "textarea") {
          return (
            <TextArea
              {...shared}
              rows={spec.rows ?? 4}
              maxLength={spec.maxLength}
              value={stringValue}
              placeholder={spec.placeholder}
              onChange={(event) => onChange(event.target.value)}
            />
          );
        }

        if (spec.type === "select") {
          return (
            <Select
              {...shared}
              value={stringValue}
              onChange={(event) => onChange(event.target.value)}
            >
              {spec.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          );
        }

        if (spec.type === "tags") {
          return (
            <TextInput
              {...shared}
              value={stringValue}
              placeholder={spec.placeholder ?? "Comma-separated"}
              onChange={(event) =>
                // Split on save rather than on every keystroke, so typing a comma
                // does not fight the caret.
                onChange(
                  event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                )
              }
            />
          );
        }

        return (
          <TextInput
            {...shared}
            type={
              spec.type === "url"
                ? "url"
                : spec.type === "date"
                  ? "date"
                  : spec.type === "number"
                    ? "number"
                    : "text"
            }
            value={stringValue}
            maxLength={spec.maxLength}
            placeholder={spec.placeholder}
            onChange={(event) =>
              onChange(
                spec.type === "number"
                  ? event.target.value === ""
                    ? null
                    : Number(event.target.value)
                  : event.target.value,
              )
            }
          />
        );
      }}
    </Field>
  );
}
