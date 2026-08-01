import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminBackLink } from "@/components/admin/admin-nav";
import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { JourneyMediaManager } from "@/components/admin/journey-media-manager";
import { StatusBadge } from "@/components/admin/status-badge";
import { Icon } from "@/components/ui/icon";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { listAttachableMedia } from "@/lib/data/admin-experience-media";
import { getJourneyEntryForEdit, listJourneyMedia } from "@/lib/data/admin-journey";

export const metadata: Metadata = { title: "Journey media" };
export const dynamic = "force-dynamic";

/**
 * Photographs and video for one journey story.
 *
 * A dedicated route rather than another section inside the editor, for the same
 * two reasons the experience photos page is separate: an attachment needs a saved
 * parent row to point at, and the privacy checklist is twelve statements that
 * must be read, which a scrolling form actively discourages.
 *
 * The media picker is `listAttachableMedia()` from the experience feature —
 * literally the same library, the same query, the same "used by" hints. A second
 * picker would be the duplicate media library this whole design exists to avoid.
 */
export default async function JourneyMediaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requirePermission("editContent", `/admin/journey/${id}/media`);

  const [entry, media, library] = await Promise.all([
    getJourneyEntryForEdit(id),
    listJourneyMedia(id),
    listAttachableMedia(),
  ]);

  if (!entry) notFound();

  const englishTitle =
    entry.translations.find((t) => t.locale === "en")?.title ?? entry.slug;

  return (
    <>
      <AdminPageHeader
        title={englishTitle}
        description={`Photographs and video for /${entry.slug}`}
        breadcrumb={<AdminBackLink href="/admin/journey" label="All stories" />}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={entry.status} />

            <Link
              href={`/admin/journey/${id}/edit`}
              className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) border border-border-strong bg-surface px-4 text-small font-medium hover:bg-surface-muted"
            >
              <Icon name="edit" size={16} />
              Edit the story
            </Link>

            {entry.status !== "published" ? (
              <span className="text-[0.8125rem] text-foreground-subtle">
                This story is not published, so nothing on it is public yet.
              </span>
            ) : null}
          </div>
        }
      />

      <AdminPageBody>
        <JourneyMediaManager
          journeyEntryId={id}
          entryIsPublished={entry.status === "published"}
          media={media}
          library={library}
          /*
            Publishing a photograph of other people is owner-only — see the note
            in lib/actions/journey-media.ts. The server enforces it; this only
            decides whether the controls are shown at all, so an editor is not
            invited to make a change that will be refused.
          */
          canReview={permissions.viewPrivateOriginals(session.role)}
        />
      </AdminPageBody>
    </>
  );
}
