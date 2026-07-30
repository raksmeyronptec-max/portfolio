import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils/cn";
import { Icon } from "./icon";

/* ═══════════════════════════════════════════════════════════════════════════
   Form controls.

   Accessibility contract enforced by the types and the markup, not by
   convention:
     • Every control has a real `<label>` bound by `htmlFor`/`id`.
     • Descriptions and errors are wired via `aria-describedby`, so they are
       announced with the field instead of being visually adjacent only.
     • `aria-invalid` is set from the presence of an error.
     • Required fields carry `required` AND a visible marker with a text
       equivalent — an asterisk alone is not an accessible name.
     • Errors are text, never colour alone.
     • Controls inherit the type stack, so Khmer input and placeholders are not
       clipped.
   ═══════════════════════════════════════════════════════════════════════════ */

const controlBase = [
  "w-full rounded-[--radius-md] border bg-surface",
  "px-3 py-2.5 min-h-11",
  "text-base text-foreground",
  "placeholder:text-foreground-subtle",
  "border-border-strong",
  "transition-colors",
  "hover:border-border-interactive",
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
  "aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-subtle/40",
].join(" ");

// ── Field wrapper ───────────────────────────────────────────────────────────

export type FieldProps = {
  /** Must match the control's `id`. */
  id: string;
  label: string;
  /** Helper text, announced with the control. */
  description?: string;
  /** Error text. Presence flips the control into the invalid state. */
  error?: string;
  required?: boolean;
  /** Visible text for the required marker, e.g. "required". Localised. */
  requiredLabel?: string;
  optionalLabel?: string;
  /** Show an "(optional)" hint instead of a required marker. */
  showOptional?: boolean;
  /** Right-aligned hint, e.g. a character counter. */
  hint?: ReactNode;
  className?: string;
  children: (ids: { describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

export function Field({
  id,
  label,
  description,
  error,
  required = false,
  requiredLabel,
  optionalLabel,
  showOptional = false,
  hint,
  className,
  children,
}: FieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-small font-medium text-foreground">
          {label}
          {required && requiredLabel ? (
            <>
              {" "}
              <span className="text-danger" aria-hidden="true">
                *
              </span>
              <span className="sr-only"> ({requiredLabel})</span>
            </>
          ) : null}
          {!required && showOptional && optionalLabel ? (
            <span className="ml-1 font-normal text-foreground-subtle">
              ({optionalLabel})
            </span>
          ) : null}
        </label>
        {hint ? (
          <span className="text-[0.8125rem] text-foreground-subtle">{hint}</span>
        ) : null}
      </div>

      {description ? (
        <p id={descriptionId} className="text-[0.8125rem] text-foreground-muted">
          {description}
        </p>
      ) : null}

      {children({ describedBy, invalid: Boolean(error) })}

      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger-foreground"
        >
          <Icon name="alertCircle" size={14} className="mt-0.5" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className, ...rest }: TextInputProps) {
  return <input className={cn(controlBase, className)} {...rest} />;
}

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ className, rows = 5, ...rest }: TextAreaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(controlBase, "min-h-28 resize-y", className)}
      {...rest}
    />
  );
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

/**
 * Native `<select>` on purpose.
 *
 * A custom listbox would need a hand-rolled keyboard model, an
 * `aria-activedescendant` implementation and mobile handling. The native control
 * already has all of that, plus the platform's own accessibility affordances.
 */
export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          controlBase,
          "cursor-pointer appearance-none pr-10",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={18}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted"
      />
    </div>
  );
}

export function Checkbox({
  id,
  label,
  description,
  error,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  label: ReactNode;
  description?: string;
  error?: string;
}) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Generous padding gives the label + box a 44px touch target. */}
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(
            "mt-0.5 size-5 shrink-0 cursor-pointer rounded-[--radius-xs]",
            "border border-border-strong accent-[--primary]",
            "aria-[invalid=true]:border-danger",
          )}
          {...rest}
        />
        <label htmlFor={id} className="cursor-pointer text-small text-foreground">
          {label}
        </label>
      </div>

      {description ? (
        <p id={descriptionId} className="pl-8 text-[0.8125rem] text-foreground-muted">
          {description}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 pl-8 text-[0.8125rem] font-medium text-danger-foreground"
        >
          <Icon name="alertCircle" size={14} className="mt-0.5" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

// ── Fieldset ────────────────────────────────────────────────────────────────

/**
 * Groups related controls with a real `<legend>`, which is how a screen reader
 * learns that a set of radios or checkboxes belongs together.
 */
export function Fieldset({
  legend,
  description,
  className,
  children,
}: {
  legend: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={cn("flex flex-col gap-3 border-0 p-0", className)}>
      <legend className="mb-1 text-small font-medium text-foreground">
        {legend}
      </legend>
      {description ? (
        <p className="-mt-2 text-[0.8125rem] text-foreground-muted">{description}</p>
      ) : null}
      {children}
    </fieldset>
  );
}

// ── Error summary ───────────────────────────────────────────────────────────

/**
 * Error summary shown above a submitted form.
 *
 * Each entry links to its field, which is the pattern that actually helps on a
 * long form: the user hears how many problems there are and can jump straight to
 * each one. `tabIndex={-1}` lets the calling form move focus here after a failed
 * submit.
 */
export function ErrorSummary({
  heading,
  errors,
  className,
  id = "form-error-summary",
}: {
  heading: string;
  errors: ReadonlyArray<{ fieldId: string; message: string }>;
  className?: string;
  id?: string;
}) {
  if (errors.length === 0) return null;

  return (
    <div
      id={id}
      role="alert"
      tabIndex={-1}
      className={cn(
        "rounded-[--radius-md] border border-danger/30 bg-danger-subtle p-4",
        className,
      )}
    >
      <p className="flex items-center gap-2 font-semibold text-danger-foreground">
        <Icon name="alertTriangle" size={18} />
        {heading}
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-small text-danger-foreground">
        {errors.map((error) => (
          <li key={error.fieldId}>
            <a href={`#${error.fieldId}`} className="underline hover:decoration-2">
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
