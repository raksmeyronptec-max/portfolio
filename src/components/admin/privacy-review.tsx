"use client";

import { useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Checkbox, TextArea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { PRIVACY_CHECKLIST } from "@/lib/validation/certificate";
import { cn } from "@/lib/utils/cn";

/**
 * Redaction checklist and privacy review.
 *
 * The design intent: make confirming the review *harder* than the surrounding
 * fields, because it is the one decision with a consequence that cannot be taken
 * back once a document is published to the open web.
 *
 * So the confirmation control is disabled until every individual item has been
 * ticked. That turns "I confirm I reviewed this" into nine specific statements
 * about nine specific risks, rather than one reflexive click.
 *
 * The ticks themselves are not persisted — only the reviewer, the timestamp and the
 * note are. Storing which boxes were ticked would imply a legal record the CMS
 * cannot actually guarantee.
 */
export function PrivacyReviewPanel({
  confirmed,
  onConfirmedChange,
  note,
  onNoteChange,
  containsSensitiveData,
  onContainsSensitiveDataChange,
  allowPublicDownload,
  onAllowPublicDownloadChange,
  reviewedAt,
  hasOriginal,
  hasPreview,
}: {
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  note: string;
  onNoteChange: (value: string) => void;
  containsSensitiveData: boolean;
  onContainsSensitiveDataChange: (value: boolean) => void;
  allowPublicDownload: boolean;
  onAllowPublicDownloadChange: (value: boolean) => void;
  /** When the review was previously recorded, if it was. */
  reviewedAt: string | null;
  hasOriginal: boolean;
  hasPreview: boolean;
}) {
  const [ticked, setTicked] = useState<Set<string>>(
    // An already-reviewed credential starts with the list satisfied, so a small
    // unrelated edit does not force the whole checklist again.
    () => (reviewedAt ? new Set(PRIVACY_CHECKLIST.map((item) => item.id)) : new Set()),
  );

  const allTicked = PRIVACY_CHECKLIST.every((item) => ticked.has(item.id));
  const remaining = PRIVACY_CHECKLIST.length - ticked.size;

  function toggle(id: string, checked: boolean) {
    setTicked((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

    // Un-ticking any item revokes the confirmation: the review no longer covers
    // the full list.
    if (!checked && confirmed) onConfirmedChange(false);
  }

  return (
    <Card className="border-warning/40">
      <CardHeader className="bg-warning-subtle/40">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[--radius-md] bg-warning-subtle text-warning-foreground">
            <Icon name="shield" size={18} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-h4 font-semibold">Privacy review</h2>
            <p className="text-[0.8125rem] text-foreground-muted">
              Required before this credential can be published. The database enforces
              it — publication is rejected without a recorded review.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardBody className="flex flex-col gap-5">
        {reviewedAt ? (
          <Notice tone="success" icon="checkCircle">
            <p>
              A privacy review was recorded on{" "}
              <time dateTime={reviewedAt}>
                {new Date(reviewedAt).toLocaleString("en-GB")}
              </time>
              . Un-tick the confirmation below to revoke it.
            </p>
          </Notice>
        ) : null}

        {!hasPreview ? (
          <Notice tone="danger" icon="alertTriangle" title="No preview image attached">
            <p>
              Attach a <strong>redacted</strong> preview image below. This is the only
              image that will ever be shown publicly.
            </p>
          </Notice>
        ) : null}

        {hasOriginal ? (
          <Notice tone="info" icon="lock">
            <p>
              An original scan is attached and stored privately. It has no public URL,
              is invisible to anonymous visitors at the database level, and can only be
              opened by an owner through a 60-second signed link — every access is
              logged.
            </p>
          </Notice>
        ) : null}

        {/* ── The checklist ────────────────────────────────────────────────── */}
        <fieldset className="flex flex-col gap-3 border-0 p-0">
          <legend className="text-small font-semibold">
            Confirm the preview image has been redacted of:
          </legend>

          <ul className="flex flex-col gap-2.5">
            {PRIVACY_CHECKLIST.map((item) => {
              const isTicked = ticked.has(item.id);

              return (
                <li key={item.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-[--radius-md] border p-3 transition-colors",
                      isTicked
                        ? "border-success/40 bg-success-subtle/40"
                        : "border-border hover:bg-surface-muted",
                    )}
                  >
                    {/*
                      An explicit id even though the wrapping <label> already
                      associates the control: it gives each item a stable handle
                      for the E2E checklist assertions and for anyone scripting
                      against this form.
                    */}
                    <input
                      id={`privacy-check-${item.id}`}
                      type="checkbox"
                      checked={isTicked}
                      onChange={(event) => toggle(item.id, event.target.checked)}
                      className="mt-0.5 size-5 shrink-0 rounded-[--radius-xs] border border-border-strong accent-[--primary]"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-small font-medium">{item.label}</span>
                      <span className="text-[0.8125rem] text-foreground-muted">
                        {item.detail}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        {/* ── Confirmation ─────────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex flex-col gap-3 rounded-[--radius-md] border p-4",
            allTicked ? "border-border" : "border-dashed border-border-strong opacity-70",
          )}
        >
          <Checkbox
            id="privacy-review-confirmed"
            label="I have reviewed the preview image and confirm it contains no sensitive personal information."
            description={
              allTicked
                ? undefined
                : `Tick all ${PRIVACY_CHECKLIST.length} items above first — ${remaining} remaining.`
            }
            checked={confirmed}
            disabled={!allTicked}
            onChange={(event) => onConfirmedChange(event.target.checked)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="privacy-review-note"
            className="text-small font-medium"
          >
            Review note
            <span className="ml-1 font-normal text-foreground-subtle">(optional)</span>
          </label>
          <p
            id="privacy-review-note-description"
            className="text-[0.8125rem] text-foreground-muted"
          >
            What did you redact, and what did you deliberately leave visible? Useful
            when you revisit this in a year.
          </p>
          <TextArea
            id="privacy-review-note"
            rows={3}
            value={note}
            aria-describedby="privacy-review-note-description"
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </div>

        <hr className="border-t border-border" />

        {/* ── Sensitivity flags ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Checkbox
            id="contains-sensitive-data"
            label="The original document still contains sensitive data"
            description="Leave this on unless the original itself has been redacted. It only describes the private original, not the public preview."
            checked={containsSensitiveData}
            onChange={(event) => onContainsSensitiveDataChange(event.target.checked)}
          />

          <Checkbox
            id="allow-public-download"
            label="Allow visitors to download the document"
            description={
              containsSensitiveData
                ? "Unavailable while the document is flagged as containing sensitive data. The database rejects this combination."
                : "Only enable this for documents that are safe to distribute in full."
            }
            checked={allowPublicDownload}
            disabled={containsSensitiveData}
            onChange={(event) => onAllowPublicDownloadChange(event.target.checked)}
          />
        </div>
      </CardBody>
    </Card>
  );
}
