import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminBackLink } from "@/components/admin/admin-nav";
import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { ExperiencePhotoManager } from "@/components/admin/experience-photo-manager";
import { StatusBadge } from "@/components/admin/status-badge";
import { Icon } from "@/components/ui/icon";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { getExperienceForPhotos } from "@/lib/data/admin-cv";
import {
  listAttachableMedia,
  listExperiencePhotos,
} from "@/lib/data/admin-experience-media";

export const metadata: Metadata = { title: "Experience photos" };
export const dynamic = "force-dynamic";

/**
 * Photo management for one experience entry.
 *
 * A dedicated route rather than another section inside the modal editor, for two
 * reasons. An attachment needs a saved parent row to point at, so the section
 * could not function for an unsaved entry; and the privacy checklist is eight
 * statements that must be read, which a scrolling dialog actively discourages.
 */
export default async function ExperiencePhotosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await requirePermission(
    "editContent",
    `/admin/experience/${id}/photos`,
  );

  const [entry, photos, library] = await Promise.all([
    getExperienceForPhotos(id),
    listExperiencePhotos(id),
    listAttachableMedia(),
  ]);

  if (!entry) notFound();

  return (
    <>
      <AdminPageHeader
        title={entry.roleTitle}
        description={`Photographs for /${entry.slug}`}
        breadcrumb={<AdminBackLink href="/admin/experience" label="All experience" />}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={entry.status} />

            {entry.status === "published" ? (
              <Link
                href="/en/experience"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) border border-border-strong bg-surface px-4 text-small font-medium hover:bg-surface-muted"
              >
                <Icon name="externalLink" size={16} />
                Preview public page
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            ) : (
              <span className="text-[0.8125rem] text-foreground-subtle">
                This entry is not published, so no photograph on it is public yet.
              </span>
            )}
          </div>
        }
      />

      <AdminPageBody>
        <ExperiencePhotoManager
          experienceId={id}
          experienceSlug={entry.slug}
          experienceIsPublished={entry.status === "published"}
          photos={photos}
          library={library}
          /*
            Publishing a photograph of other people is owner-only — see the note
            in lib/actions/experience-media.ts. The server enforces it; this only
            decides whether the controls are shown at all, so an editor is not
            invited to make a change that will be refused.
          */
          canReview={permissions.viewPrivateOriginals(session.role)}
        />
      </AdminPageBody>
    </>
  );
}
