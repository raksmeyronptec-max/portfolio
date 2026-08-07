"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Reveal } from "@/components/motion/reveal";
import { formatDuration, interpolate, type Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import {
  contactLimits,
  contactSubmissionSchema,
  collectFieldErrors,
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
 * The homepage contact form — "Start a conversation".
 *
 * A deliberately shorter form than the one on `/contact`: name, email, subject,
 * message, consent. The optional detail (organisation, project type, preferred
 * reply method) stays on the dedicated page, because the point of this one is
 * that a stranger can send a sentence without deciding anything first.
 *
 * ── What it is not ─────────────────────────────────────────────────────────
 * It does not console.log and it does not call a third-party form service. It
 * posts to `/api/contact`, the same endpoint the full form uses, so:
 *
 *  - the message is written to `contact_messages` and cannot be lost when the
 *    Telegram notification fails — that ordering is the whole reason the route
 *    exists (see its header, and docs/AUDIT.md on v1's leaked bot token);
 *  - rate limiting is evaluated in Postgres against stored messages, so it
 *    survives a cold start;
 *  - the success copy reports whether a notification actually went out rather
 *    than claiming delivery it cannot verify.
 *
 * ── Accessibility ──────────────────────────────────────────────────────────
 * Placeholders are the visible field names in this layout, per the brief, so
 * every input additionally carries a visually hidden <label>: a placeholder is
 * not an accessible name, and it disappears the moment someone starts typing.
 * Errors are wired to their input with `aria-describedby`, the success state
 * replaces the form and is announced politely, and the honeypot is hidden from
 * assistive technology and is not a tab stop.
 */
export function ContactConversation({
  locale,
  t,
  email,
  location,
}: {
  locale: Locale;
  t: Dictionary;
  email: string | null;
  location: string | null;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});

  /*
   * Mount time, used only to measure how long the visitor took before
   * submitting — one input to the spam score, never a rejection on its own.
   * Stamped in an effect because `Date.now()` in a render body is impure.
   */
  const mountedAt = useRef<number | null>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  const nameId = useId();
  const emailId = useId();
  const subjectId = useId();
  const messageId = useId();
  const consentId = useId();
  const honeypotId = useId();

  /*
   * Rate-limit countdown. The transition back to idle happens inside the timer
   * callback rather than in the effect body, which would queue a second render
   * immediately after the first on every tick.
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

  // The form is replaced by the success panel, so focus has to be moved or a
  // keyboard user is left on a button that no longer exists.
  useEffect(() => {
    if (status.kind === "success") successRef.current?.focus();
  }, [status.kind]);

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
      subject: String(data.get("subject") ?? ""),
      message: String(data.get("message") ?? ""),
      consent: data.get("consent") === "on",
      website: String(data.get("website") ?? ""),
      locale,
      // Omitted rather than sent as 0 when unknown: 0 would read as "submitted
      // instantly", a spam signal we have no evidence for.
      elapsedMs:
        mountedAt.current === null ? undefined : Date.now() - mountedAt.current,
    };

    // Client-side parse for instant feedback only. The server re-runs the same
    // schema, and that parse is the gate.
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

      setStatus({ kind: "success", notified: body.notified === true });
      form.reset();
    } catch {
      setStatus({ kind: "error", message: t.contact.errorNetwork });
    }
  }

  const isSubmitting = status.kind === "submitting";
  const isRateLimited = status.kind === "rate_limited";

  return (
    <section
      id="contact"
      data-scheme="ink"
      aria-labelledby="contact-heading"
      className="decorated scroll-section bg-background text-foreground"
    >
      <div
        aria-hidden="true"
        className="glow"
        style={
          {
            "--glow-x": "50%",
            "--glow-y": "10%",
            "--glow-size": "64%",
            "--glow-alpha": "0.18",
          } as object
        }
      />

      {/* 720px, centred — the brief's measure. `container-content` is wider and
          would leave the two columns floating apart on a large display. */}
      <div className="mx-auto max-w-[720px] px-6 py-20">
        <div className="contact-layout">
          {/* ── Left: the invitation ──────────────────────────────────────── */}
          <Reveal className="contact-text">
            <span className="section-label">{t.home.conversation.label}</span>

            <h2 id="contact-heading">{t.home.conversation.heading}</h2>

            <p>{t.home.conversation.description}</p>

            <div className="contact-direct">
              {email ? (
                <a href={`mailto:${email}`} className="contact-email">
                  {email}
                </a>
              ) : null}

              {location ? (
                <span className="contact-location">{location}</span>
              ) : null}
            </div>
          </Reveal>

          {/* ── Right: the form ───────────────────────────────────────────── */}
          {status.kind === "success" ? (
            <div
              ref={successRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className="form-success"
            >
              <p>
                {status.notified
                  ? t.contact.successBodyNotified
                  : t.contact.successBody}
              </p>

              {/* Without this the form is gone until a reload, which is a dead
                  end for anyone who realises they left something out. */}
              <button
                type="button"
                className="form-success__again"
                onClick={() => {
                  mountedAt.current = Date.now();
                  setStatus({ kind: "idle" });
                }}
              >
                {t.contact.sendAnother}
              </button>
            </div>
          ) : (
            <Reveal
              as="form"
              delay={100}
              className="contact-form"
              onSubmit={handleSubmit}
              noValidate
            >
              {status.kind === "error" ? (
                <p role="alert" className="form-error">
                  {status.message}
                </p>
              ) : null}

              {isRateLimited ? (
                <p role="alert" aria-live="polite" className="form-error">
                  {interpolate(
                    status.reason === "hourly"
                      ? t.contact.rateLimitedHourly
                      : t.contact.rateLimited,
                    { time: formatDuration(status.secondsLeft, locale) },
                  )}
                </p>
              ) : null}

              <div className="form-row">
                <PlaceholderField
                  id={nameId}
                  label={t.contact.fields.name}
                  error={localizeError(fieldErrors.name)}
                >
                  {({ describedBy, invalid }) => (
                    <input
                      id={nameId}
                      type="text"
                      name="name"
                      autoComplete="name"
                      required
                      maxLength={contactLimits.nameMax}
                      placeholder={t.contact.fields.name}
                      aria-describedby={describedBy}
                      aria-invalid={invalid || undefined}
                    />
                  )}
                </PlaceholderField>

                <PlaceholderField
                  id={emailId}
                  label={t.contact.fields.email}
                  error={localizeError(fieldErrors.email)}
                >
                  {({ describedBy, invalid }) => (
                    <input
                      id={emailId}
                      type="email"
                      name="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      maxLength={contactLimits.emailMax}
                      placeholder={t.contact.fields.email}
                      aria-describedby={describedBy}
                      aria-invalid={invalid || undefined}
                    />
                  )}
                </PlaceholderField>
              </div>

              <PlaceholderField
                id={subjectId}
                label={t.contact.fields.subject}
                error={localizeError(fieldErrors.subject)}
              >
                {({ describedBy, invalid }) => (
                  <input
                    id={subjectId}
                    type="text"
                    name="subject"
                    maxLength={contactLimits.subjectMax}
                    placeholder={t.contact.fields.subjectPlaceholder}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                  />
                )}
              </PlaceholderField>

              <PlaceholderField
                id={messageId}
                label={t.contact.fields.message}
                error={localizeError(fieldErrors.message)}
              >
                {({ describedBy, invalid }) => (
                  <textarea
                    id={messageId}
                    name="message"
                    rows={5}
                    required
                    maxLength={contactLimits.messageMax}
                    placeholder={t.contact.fields.messagePlaceholder}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                  />
                )}
              </PlaceholderField>

              {/* Consent is not a nicety: `contactSubmissionSchema` requires it
                  and the API rejects the submission without it. */}
              <div>
                <label className="form-consent" htmlFor={consentId}>
                  <input
                    id={consentId}
                    type="checkbox"
                    name="consent"
                    required
                    aria-describedby={
                      fieldErrors.consent ? `${consentId}-error` : undefined
                    }
                    aria-invalid={fieldErrors.consent ? true : undefined}
                  />
                  <span>{t.contact.fields.consent}</span>
                </label>
                {fieldErrors.consent ? (
                  <p id={`${consentId}-error`} className="form-field-error">
                    {localizeError(fieldErrors.consent)}
                  </p>
                ) : null}
              </div>

              {/*
                Honeypot. Positioned off-screen rather than `display: none`,
                because some bots skip hidden inputs but not positioned ones;
                `aria-hidden` and `tabIndex={-1}` keep it out of both trees, so
                no real user can reach it and be locked out.
              */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-[9999px] size-px overflow-hidden"
              >
                <label htmlFor={honeypotId}>Website</label>
                <input
                  id={honeypotId}
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                className="form-submit"
                disabled={isSubmitting || isRateLimited}
              >
                {isSubmitting ? t.contact.submitting : t.contact.submit}
              </button>

              {/* Sets an honest expectation rather than implying a fast reply. */}
              <p className="form-note">{t.contact.responseTime}</p>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * A field whose visible name is its placeholder.
 *
 * The label is rendered and then visually hidden rather than omitted: a
 * placeholder is not an accessible name in any browser/AT pair worth
 * supporting, and it vanishes as soon as the field has content, which leaves a
 * half-filled form with no way to tell what each box was for.
 */
function PlaceholderField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: (state: { describedBy?: string; invalid: boolean }) => React.ReactNode;
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      {children({ describedBy: errorId, invalid: Boolean(error) })}

      {error ? (
        <p id={errorId} className="form-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
