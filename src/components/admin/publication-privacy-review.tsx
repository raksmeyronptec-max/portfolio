"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/primitives";
import { Checkbox, Field, TextArea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { reviewPublicationPrivacy } from "@/lib/actions/publications";
import {
  PUBLICATION_PRIVACY_CHECKLIST,
  type PrivacyStatus,
} from "@/lib/validation/publication";

/**
 * The privacy review for a publication.
 *
 * ── What is and is not recorded ────────────────────────────────────────────
 * The ticked boxes are NOT persisted, here or anywhere else in this CMS.
 * Storing them would produce something that looks like a legal record of due
 * diligence, which a portfolio CMS cannot substantiate and should not imply.
 * What is stored is the decision, who made it, when, and their note.
 *
 * The checklist exists to make the reviewer look, not to generate evidence that
 * they did. That is why Approve stays disabled until every box is ticked — the
 * friction is the feature — and why nothing stops them ticking all of them
 * without opening the PDF. The gate is a human one; this is its prompt.
 *
 * ── Why this is not part of the main form ──────────────────────────────────
 * Approving a book PDF is a statement that somebody opened it and read to the
 * end. It must not be a side effect of saving a corrected subtitle, so it has
 * its own action, its own permission (owner) and its own audit verb.
 */
export function PublicationPrivacyReview({
  publicationId,
  privacyStatus,
  note,
  reviewedAt,
  hasSourceArchive,
  canReview,
}: {
  publicationId: string;
  privacyStatus: PrivacyStatus;
  note: string | null;
  reviewedAt: string | null;
  /** Source-specific checks are irrelevant when no archive is attached. */
  hasSourceArchive: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const formId = useId();
  const [isPending, startTransition] = useTransition();

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [reviewNote, setReviewNote] = useState(note ?? "");

  const items = PUBLICATION_PRIVACY_CHECKLIST.filter(
    (item) => !item.sourceOnly || hasSourceArchive,
  );

  const allChecked = items.every((item) => checked.has(item.id));

  const toggle = (id: string, on: boolean) =>
    setChecked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const submit = (status: PrivacyStatus, label: string) => {
    startTransition(async () => {
      const result = await reviewPublicationPrivacy({
        id: publicationId,
        privacyStatus: status,
        note: reviewNote,
      });

      if (result.ok) {
        toast.show({ tone: "success", title: label });
        router.refresh();
        return;
      }

      toast.show({
        tone: "error",
        title: result.code === "forbidden" ? "Not permitted" : "Could not save",
        description: result.detail ?? "Please try again.",
        duration: 0,
      });
    });
  };

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-body font-semibold text-foreground">
            <Icon name="shield" size={17} aria-hidden />
            Privacy review
          </h2>
          {reviewedAt ? (
            <span className="text-small text-foreground-subtle">
              Last decided {new Date(reviewedAt).toLocaleDateString("en-GB")}
            </span>
          ) : null}
        </div>

        {privacyStatus === "approved" ? (
          <Notice tone="success">
            Approved for publication. Re-open this if you replace the PDF — the
            approval describes the file that was reviewed, not the record.
          </Notice>
        ) : privacyStatus === "rejected" ? (
          <Notice tone="danger">
            Rejected. This publication cannot be published until the problem is
            fixed and it is approved.
          </Notice>
        ) : (
          <Notice tone="warning">
            Not yet reviewed. A publication cannot go public until this is
            approved — the database refuses it, not just this page.
          </Notice>
        )}

        {canReview ? (
          <>
            <ul className="flex flex-col gap-2.5">
              {items.map((item) => (
                <li key={item.id}>
                  <Checkbox
                    id={`${formId}-${item.id}`}
                    label={item.label}
                    description={item.detail}
                    checked={checked.has(item.id)}
                    onChange={(e) => toggle(item.id, e.target.checked)}
                  />
                </li>
              ))}
            </ul>

            <Field
              id={`${formId}-note`}
              label="Review note"
              description="What you checked, or what still needs fixing. Kept internally — it is never shown on the public page."
            >
              {({ describedBy }) => (
                <TextArea
                  id={`${formId}-note`}
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  aria-describedby={describedBy}
                />
              )}
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                loading={isPending}
                /*
                 * Disabled until every box is ticked. The friction is the point:
                 * the list is what makes somebody open the last page of the PDF
                 * and check whether their phone number is still on it.
                 */
                disabled={!allChecked || isPending}
                onClick={() => submit("approved", "Approved for publication")}
              >
                <Icon name="check" size={16} />
                Approve
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => submit("rejected", "Marked as rejected")}
              >
                Reject
              </Button>

              {privacyStatus !== "pending_review" ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => submit("pending_review", "Reset to pending")}
                >
                  Reset to pending
                </Button>
              ) : null}

              {!allChecked ? (
                <span className="text-small text-foreground-subtle">
                  {items.length - checked.size} of {items.length} still to confirm.
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-small text-foreground-muted">
            Approving a publication for release requires the owner role.
            {note ? ` Note on file: ${note}` : ""}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
