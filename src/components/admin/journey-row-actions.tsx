"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  deleteJourneyEntry,
  duplicateJourneyEntry,
  setJourneyFeatured,
  setJourneyStatus,
} from "@/lib/actions/journey";
import type { AdminJourneySummary } from "@/lib/data/admin-journey";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Row actions for the journey list.
 *
 * Publishing here goes through `setJourneyStatus`, which does not carry the
 * form's translations — so the database publish gate is the only thing checking,
 * and it reports itself through `publish_blocked` with the message authored in
 * migration 0024. That is deliberate: a one-click publish must not be able to
 * bypass a rule the form would have enforced.
 */
export function JourneyRowActions({
  entry,
  canPublish,
  canDelete,
}: {
  entry: AdminJourneySummary;
  canPublish: boolean;
  canDelete: boolean;
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
        // The publish gate's own message. It names the specific rule that failed,
        // which is more useful than anything this component could reconstruct.
        description: result.detail ?? "Please try again.",
        duration: 0,
      });
    });
  }

  const isPublished = entry.status === "published";

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          icon={entry.featured ? "star" : "star"}
          label={
            entry.featured
              ? `Remove "${entry.title}" from the homepage`
              : `Feature "${entry.title}" on the homepage`
          }
          size="sm"
          variant={entry.featured ? "primary" : "ghost"}
          disabled={isPending}
          onClick={() =>
            run(
              entry.featured ? "Removed from the homepage" : "Added to the homepage",
              () => setJourneyFeatured(entry.id, !entry.featured),
            )
          }
        />

        {canPublish ? (
          <IconButton
            icon={isPublished ? "eyeOff" : "globe"}
            label={
              isPublished ? `Unpublish "${entry.title}"` : `Publish "${entry.title}"`
            }
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() =>
              run(isPublished ? "Unpublished" : "Published", () =>
                setJourneyStatus(entry.id, isPublished ? "draft" : "published"),
              )
            }
          />
        ) : null}

        <IconButton
          icon="copy"
          label={`Duplicate "${entry.title}"`}
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await duplicateJourneyEntry(entry.id);
              if (result.ok) {
                toast.show({
                  tone: "success",
                  title: "Duplicated as a draft",
                  description: "Media and links were not copied — see the review note.",
                });
                router.push(`/admin/journey/${result.data.id}/edit`);
                return;
              }
              toast.show({ tone: "error", title: "Could not duplicate", duration: 0 });
            })
          }
        />

        {canDelete ? (
          <IconButton
            icon="trash"
            label={`Delete "${entry.title}"`}
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
          run("Story deleted", () => deleteJourneyEntry(entry.id));
        }}
        title={`Delete "${entry.title}"?`}
        description="This is a soft delete — the story is withdrawn from the site and can be restored. Its photographs stay in the media library and nothing else using them is affected."
        confirmLabel="Delete story"
        cancelLabel="Cancel"
        closeLabel="Close"
        tone="danger"
      />
    </>
  );
}
