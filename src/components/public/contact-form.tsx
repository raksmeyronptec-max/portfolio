"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, ErrorSummary, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { formatDuration, interpolate, type Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import {
  contactLimits,
  contactSubmissionSchema,
  collectFieldErrors,
  preferredContactMethods,
  projectTypes,
  type ContactFieldErrors,
} from "@/lib/validation/contact";
import { trackEvent } from "@/lib/analytics/track";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; notified: boolean }
  | { kind: "error"; message: string }
  | { kind: "rate_limited"; secondsLeft: number; reason: "cooldown" | "hourly" };

/**
 * Contact form.
 *
 * Accessibility behaviour worth calling out:
 *  - Validation errors are rendered per field AND collected into an error summary
 *    that receives focus on failed submit, so a keyboard or screen-reader user is
 *    told what went wrong instead of having to hunt for it.
 *  - `aria-describedby` wires each error and hint to its input.
 *  - The success state replaces the form and is announced politely; it is not a
 *    toast that disappears before it can be read.
 *  - The rate-limit countdown updates a live region at most once per second.
 *  - The honeypot is hidden from sighted users *and* from assistive technology,
 *    and is not a tab stop — a hidden field that a screen-reader user can focus and
 *    fill in would lock legitimate people out.
 */
export function ContactForm({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [messageLength, setMessageLength] = useState(0);

  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  /*
   * Mount time, used only to compute how long the visitor took before submitting
   * — one input to the spam score, never a rejection on its own.
   *
   * Stamped in an effect rather than as a `useRef(Date.now())` initialiser: a
   * render must be pure, and `Date.now()` in a render body produces a value that
   * silently changes if React ever re-renders or replays the component.
   */
  const mountedAt = useRef<number | null>(null);

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  const nameId = useId();
  const emailId = useId();
  const organizationId = useId();
  const subjectId = useId();
  const projectTypeId = useId();
  const preferredContactId = useId();
  const messageId = useId();
  const consentId = useId();
  const summaryId = useId();

  const fieldIds: Record<string, string> = {
    name: nameId,
    email: emailId,
    organization: organizationId,
    subject: subjectId,
    projectType: projectTypeId,
    preferredContact: preferredContactId,
    message: messageId,
    consent: consentId,
  };

  /*
   * Countdown for the rate-limit state.
   *
   * The transition back to idle happens inside the timer callback, not in the
   * effect body. Setting state synchronously while the effect runs would queue a
   * second render immediately after the first for every tick.
   */
  useEffect(() => {
    if (status.kind !== "rate_limited") return;

    const timer = window.setTimeout(() => {
      setStatus((current) => {
        if (current.kind !== "rate_limited") return current;
        return current.secondsLeft <= 1
          ? { kind: "idle" }
          : { ...current, secondsLeft: current.secondsLeft - 1 };
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [status]);

  // Move focus to the error summary after a failed submit.
  useEffect(() => {
    if (Object.keys(fieldErrors).length > 0) {
      summaryRef.current?.focus();
    }
  }, [fieldErrors]);

  function localizeError(code: string | undefined): string | undefined {
    if (!code) return undefined;
    const messages = t.contact.validation as Record<string, string>;
    return messages[code] ?? t.contact.errorValidation;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    const raw = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      organization: String(data.get("organization") ?? ""),
      subject: String(data.get("subject") ?? ""),
      message: String(data.get("message") ?? ""),
      projectType: String(data.get("projectType") ?? ""),
      preferredContact: String(data.get("preferredContact") ?? ""),
      consent: data.get("consent") === "on",
      website: String(data.get("website") ?? ""),
      locale,
      // Omitted rather than sent as 0 when unknown: `elapsedMs` is optional on the
      // server, and 0 would read as "submitted instantly", i.e. a spam signal we
      // have no evidence for.
      elapsedMs:
        mountedAt.current === null ? undefined : Date.now() - mountedAt.current,
    };

    // Validate client-side first for instant feedback. The server re-validates
    // with the same schema, so this is convenience, not the gate.
    const parsed = contactSubmissionSchema.safeParse(raw);
    if (!parsed.success) {
      setFieldErrors(collectFieldErrors(parsed.error));
      setStatus({ kind: "idle" });
      return;
    }

    setFieldErrors({});
    setStatus({ kind: "submitting" });

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            notified?: boolean;
            error?: string;
            fields?: ContactFieldErrors;
            reason?: string;
            secondsLeft?: number;
          }
        | null;

      if (response.status === 429) {
        setStatus({
          kind: "rate_limited",
          secondsLeft: body?.secondsLeft ?? 120,
          reason: body?.reason === "hourly" ? "hourly" : "cooldown",
        });
        return;
      }

      if (response.status === 400 && body?.error === "validation") {
        setFieldErrors(body.fields ?? {});
        setStatus({ kind: "idle" });
        return;
      }

      if (!response.ok || !body?.ok) {
        setStatus({ kind: "error", message: t.contact.errorGeneric });
        return;
      }

      void trackEvent({ name: "contact_submit", locale });

      // `notified` is reported truthfully by the API, so the copy never claims a
      // notification was delivered when it was not.
      setStatus({ kind: "success", notified: body.notified === true });
      form.reset();
      setMessageLength(0);
    } catch {
      setStatus({ kind: "error", message: t.contact.errorNetwork });
    }
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (status.kind === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col gap-4 rounded-(--radius-lg) border border-success/30 bg-success-subtle p-6"
      >
        <p className="text-h4 font-semibold text-success-foreground">
          {t.contact.successHeading}
        </p>
        <p className="text-body text-success-foreground">
          {status.notified ? t.contact.successBodyNotified : t.contact.successBody}
        </p>
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => {
            mountedAt.current = Date.now();
            setStatus({ kind: "idle" });
          }}
        >
          {t.contact.sendAnother}
        </Button>
      </div>
    );
  }

  const errorEntries = Object.entries(fieldErrors)
    .filter(([, code]) => Boolean(code))
    .map(([field, code]) => ({
      fieldId: fieldIds[field] ?? field,
      message: localizeError(code) ?? t.contact.errorValidation,
    }));

  const isSubmitting = status.kind === "submitting";
  const isRateLimited = status.kind === "rate_limited";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5"
    >
      <div ref={summaryRef} tabIndex={-1}>
        <ErrorSummary
          id={summaryId}
          heading={interpolate(
            errorEntries.length === 1
              ? t.contact.errorHeading
              : t.contact.errorHeading,
            { count: errorEntries.length },
          )}
          errors={errorEntries}
        />
      </div>

      {status.kind === "error" ? (
        <Notice tone="danger" title={t.contact.errorHeading}>
          <p>{status.message}</p>
        </Notice>
      ) : null}

      {isRateLimited ? (
        <Notice tone="warning">
          {/* Live region so the countdown is announced without spamming. */}
          <p aria-live="polite">
            {interpolate(
              status.reason === "hourly"
                ? t.contact.rateLimitedHourly
                : t.contact.rateLimited,
              { time: formatDuration(status.secondsLeft, locale) },
            )}
          </p>
        </Notice>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={nameId}
          label={t.contact.fields.name}
          required
          requiredLabel={t.a11y.required}
          error={localizeError(fieldErrors.name)}
        >
          {({ describedBy, invalid }) => (
            <TextInput
              id={nameId}
              name="name"
              autoComplete="name"
              required
              maxLength={contactLimits.nameMax}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              placeholder={t.contact.fields.namePlaceholder}
            />
          )}
        </Field>

        <Field
          id={emailId}
          label={t.contact.fields.email}
          required
          requiredLabel={t.a11y.required}
          error={localizeError(fieldErrors.email)}
        >
          {({ describedBy, invalid }) => (
            <TextInput
              id={emailId}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={contactLimits.emailMax}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              placeholder={t.contact.fields.emailPlaceholder}
            />
          )}
        </Field>

        <Field
          id={subjectId}
          label={t.contact.fields.subject}
          optionalLabel={t.a11y.optional}
          showOptional
          error={localizeError(fieldErrors.subject)}
          className="sm:col-span-2"
        >
          {({ describedBy, invalid }) => (
            <TextInput
              id={subjectId}
              name="subject"
              maxLength={contactLimits.subjectMax}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              placeholder={t.contact.fields.subjectPlaceholder}
            />
          )}
        </Field>
      </div>

      <Field
        id={messageId}
        label={t.contact.fields.message}
        required
        requiredLabel={t.a11y.required}
        error={localizeError(fieldErrors.message)}
        hint={interpolate(t.contact.charactersRemaining, {
          count: contactLimits.messageMax - messageLength,
        })}
      >
        {({ describedBy, invalid }) => (
          <TextArea
            id={messageId}
            name="message"
            required
            rows={6}
            maxLength={contactLimits.messageMax}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            placeholder={t.contact.fields.messagePlaceholder}
            onChange={(event) => setMessageLength(event.target.value.length)}
          />
        )}
      </Field>

      {/*
        Optional detail, collapsed by default.

        The brief asked for four fields before the message rather than six.
        A native <details> is the right control here: the inputs stay in the
        DOM, so they still submit and still restore their values after a failed
        validation round-trip, and the open/close behaviour, keyboard support
        and screen-reader semantics come from the platform rather than from a
        hand-rolled toggle.
      */}
      <details className="group rounded-(--radius-md) border border-border bg-surface-muted/40">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-small font-medium [&::-webkit-details-marker]:hidden">
          <Icon
            name="chevronDown"
            size={16}
            className="shrink-0 text-foreground-muted transition-transform duration-200 group-open:rotate-180"
          />
          {t.contact.moreDetails}
          <span className="font-normal text-foreground-subtle">
            — {t.contact.moreDetailsHint}
          </span>
        </summary>

        <div className="grid gap-5 border-t border-border p-4 sm:grid-cols-2">
          <Field
            id={organizationId}
            label={t.contact.fields.organization}
            optionalLabel={t.a11y.optional}
            showOptional
            error={localizeError(fieldErrors.organization)}
          >
            {({ describedBy, invalid }) => (
              <TextInput
                id={organizationId}
                name="organization"
                autoComplete="organization"
                maxLength={contactLimits.organizationMax}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                placeholder={t.contact.fields.organizationPlaceholder}
              />
            )}
          </Field>

          <Field
            id={projectTypeId}
            label={t.contact.fields.projectType}
            optionalLabel={t.a11y.optional}
            showOptional
          >
            {({ describedBy }) => (
              <Select id={projectTypeId} name="projectType" aria-describedby={describedBy}>
                <option value="">{t.common.notSpecified}</option>
                {projectTypes.map((type) => (
                  <option key={type} value={type}>
                    {t.contact.projectTypes[type]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            id={preferredContactId}
            label={t.contact.fields.preferredContact}
            optionalLabel={t.a11y.optional}
            showOptional
          >
            {({ describedBy }) => (
              <Select
                id={preferredContactId}
                name="preferredContact"
                aria-describedby={describedBy}
              >
                <option value="">{t.common.notSpecified}</option>
                {preferredContactMethods.map((method) => (
                  <option key={method} value={method}>
                    {t.contact.preferredContact[method]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </details>

      <Checkbox
        id={consentId}
        name="consent"
        label={t.contact.fields.consent}
        required
        error={localizeError(fieldErrors.consent)}
      />

      {/*
        Honeypot. `aria-hidden` + `tabIndex={-1}` keep it out of both the visual
        and the accessibility tree, so no real user can reach it. Positioned
        off-screen rather than `display:none`, because some bots skip hidden
        inputs but not positioned ones.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] size-px overflow-hidden"
      >
        <label htmlFor="contact-website-field">Website</label>
        <input
          id="contact-website-field"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          size="lg"
          iconStart="send"
          loading={isSubmitting}
          disabled={isRateLimited}
        >
          {isSubmitting ? t.contact.submitting : t.contact.submit}
        </Button>

        <p className="text-[0.8125rem] text-foreground-muted">
          {t.contact.responseTime}
        </p>
      </div>
    </form>
  );
}
