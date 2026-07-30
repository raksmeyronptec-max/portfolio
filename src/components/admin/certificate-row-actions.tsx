"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  restoreCertificate,
  setCertificateStatus,
  softDeleteCertificate,
  toggleCertificateFeatured,
} from "@/lib/actions/certificates";
import { certificateBlockerLabels } from "@/lib/validation/certificate";
import type { ActionResult } from "@/lib/actions/result";

export function CertificateRowActions({
  certificateId,
  slug,
  status,
  featured,
  isDeleted,
  canEdit,
  canDelete,
}: {
  certificateId: string;
  slug: string;
  status: "draft" | "in_review" | "published" | "archived";
  featured: boolean;
  isDeleted: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handle(label: string, run: () => Promise<ActionResult<unknown>>) {
    startTransition(async () => {
      const result = await run();

      if (result.ok) {
        toast.show({ tone: "success", title: label });
        router.refresh();
        return;
      }

      if (result.code === "publish_blocked" && result.fields) {
        toast.show({
          tone: "warning",
          title: "Not ready to publish",
          description: Object.keys(result.fields)
            .map((code) => certificateBlockerLabels[code] ?? code)
            .join(" "),
          duration: 0,
        });
        return;
      }

      toast.show({
        tone: "error",
        title: "Action failed",
        description:
          result.code === "forbidden"
            ? "Your role does not permit this."
            : result.detail ?? "Please try again.",
      });
    });
  }

  if (isDeleted) {
    return (
      <div className="flex justify-end gap-1">
        <IconButton
          icon="restore"
          label={`Restore ${slug}`}
          size="sm"
          variant="outline"
          disabled={!canDelete || isPending}
          onClick={() => handle("Restored as draft", () => restoreCertificate(certificateId))}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        {status === "published" ? (
          <Link
            href={`/en/certificates/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${slug} on the public site`}
            title="View on the public site"
            className="inline-flex size-8 items-center justify-center rounded-[--radius-md] text-foreground-muted hover:bg-surface-muted hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </Link>
        ) : null}

        <IconButton
          icon="edit"
          label={`Edit ${slug}`}
          size="sm"
          variant="ghost"
          onClick={() => router.push(`/admin/certificates/${certificateId}/edit`)}
        />

        {canEdit ? (
          <>
            <IconButton
              icon="star"
              label={featured ? `Unfeature ${slug}` : `Feature ${slug}`}
              size="sm"
              variant={featured ? "accent" : "ghost"}
              aria-pressed={featured}
              disabled={isPending}
              onClick={() =>
                handle(featured ? "Removed from featured" : "Marked as featured", () =>
                  toggleCertificateFeatured(certificateId, !featured),
                )
              }
            />

            {status === "published" ? (
              <IconButton
                icon="eyeOff"
                label={`Unpublish ${slug}`}
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  handle("Unpublished", () => setCertificateStatus(certificateId, "draft"))
                }
              />
            ) : (
              <IconButton
                icon="checkCircle"
                label={`Publish ${slug}`}
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  handle("Published", () =>
                    setCertificateStatus(certificateId, "published"),
                  )
                }
              />
            )}

            {status !== "archived" ? (
              <IconButton
                icon="archive"
                label={`Archive ${slug}`}
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  handle("Archived", () => setCertificateStatus(certificateId, "archived"))
                }
              />
            ) : null}
          </>
        ) : null}

        {canDelete ? (
          <IconButton
            icon="trash"
            label={`Delete ${slug}`}
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => setConfirmDelete(true)}
          />
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          handle("Moved to deleted", () => softDeleteCertificate(certificateId));
        }}
        title="Delete this credential?"
        description="A soft delete: the credential is hidden from the public site and can be restored from the Deleted tab."
        confirmLabel="Delete credential"
        cancelLabel="Cancel"
        closeLabel="Close"
        confirmPhrase={slug}
        confirmPhraseLabel={`Type the slug “${slug}” to confirm`}
      >
        <p className="text-small text-foreground-muted">
          The private original scan is retained, not destroyed. Removing the file itself
          is a separate action in the Media library.
        </p>
      </ConfirmDialog>
    </>
  );
}
