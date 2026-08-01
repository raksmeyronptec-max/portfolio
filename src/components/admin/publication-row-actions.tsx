"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  deletePublication,
  duplicatePublication,
  restorePublication,
  setPublicationFeatured,
  setPublicationStatus,
} from "@/lib/actions/publications";
import type { ActionResult } from "@/lib/actions/result";
import type { PublicationStatus } from "@/lib/validation/publication";

/**
 * Row actions for the publications list.
 *
 * Publishing here goes through `setPublicationStatus`, which does not carry the
 * form's fields — so the database publish gate is the only thing checking, and it
 * reports itself through `publish_blocked` with the message authored in migration
 * 0026 ("cannot be published before its privacy review is approved"). That is
 * deliberate: a one-click publish must not be able to bypass a rule the form
 * would have enforced.
 *
 * `blocked` only greys nothing out — it changes the button's label so the reason
 * is visible before the click rather than after. Disabling it would remove the
 * only path to the explanation.
 */
export function PublicationRowActions({
  id,
  slug,
  status,
  featured,
  canEdit,
  canPublish,
  canDelete,
  blocked = false,
  deleted = false,
}: {
  id: string;
  slug: string;
  status: PublicationStatus;
  featured: boolean;
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
  blocked?: boolean;
  deleted?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function run(label: string, action: () => Promise<ActionResult<unknown>>) {
    startTransition(async () => {
      const result = await action();

      if (result.ok) {
        toast.show({ tone: "success", title: label });
        router.refresh();
        return;
      }

      toast.show({
        tone: result.code === "publish_blocked" ? "warning" : "error",
        title:
          result.code === "publish_blocked"
            ? "Not ready to publish"
            : result.code === "forbidden"
              ? "Not permitted"
              : "Something went wrong",
        /*
         * The gate's own message. It names the specific rule that failed —
         * which is more useful than anything this component could reconstruct,
         * and is the reason the migration bothers to write a sentence rather
         * than raising a bare constraint violation.
         */
        description: result.detail ?? "Please try again.",
        duration: 0,
      });
    });
  }

  if (deleted) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          icon="history"
          label={`Restore "${slug}"`}
          size="sm"
          disabled={!canDelete || isPending}
          onClick={() => run("Restored as a draft", () => restorePublication(id))}
        />
      </div>
    );
  }

  const isPublished = status === "published";

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          icon="star"
          label={
            featured
              ? `Remove "${slug}" from the homepage`
              : `Feature "${slug}" on the homepage`
          }
          size="sm"
          variant={featured ? "primary" : "ghost"}
          disabled={!canEdit || isPending}
          onClick={() =>
            run(featured ? "Removed from the homepage" : "Featured on the homepage", () =>
              setPublicationFeatured(id, !featured),
            )
          }
        />

        <IconButton
          icon={isPublished ? "eyeOff" : "globe"}
          label={
            isPublished
              ? `Unpublish "${slug}"`
              : blocked
                ? `Publish "${slug}" — not ready yet`
                : `Publish "${slug}"`
          }
          size="sm"
          disabled={!canPublish || isPending}
          onClick={() =>
            run(isPublished ? "Unpublished" : "Published", () =>
              setPublicationStatus(id, isPublished ? "draft" : "published"),
            )
          }
        />

        <IconButton
          icon="copy"
          label={`Duplicate "${slug}"`}
          size="sm"
          disabled={!canEdit || isPending}
          onClick={() =>
            run("Duplicated as a draft", async () => {
              const result = await duplicatePublication(id);
              if (result.ok) router.push(`/admin/publications/${result.data.id}/edit`);
              return result;
            })
          }
        />

        <IconButton
          icon="trash"
          label={`Delete "${slug}"`}
          size="sm"
          variant="ghost"
          disabled={!canDelete || isPending}
          onClick={() => setConfirmDelete(true)}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        cancelLabel="Cancel"
        closeLabel="Close"
        title={`Delete "${slug}"?`}
        /*
         * Says what is and is not destroyed. A soft delete that reads like a
         * hard one makes people avoid the button; one that reads too gently
         * makes them careless. The files staying put is the fact that matters —
         * the archival original is the thing nobody wants to lose.
         */
        description="The publication is hidden from the site and can be restored from this page. Its editions and uploaded files are not deleted."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => run("Deleted", () => deletePublication(id))}
      />
    </>
  );
}
