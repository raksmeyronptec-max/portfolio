import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminBackLink } from "@/components/admin/admin-nav";
import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { PublicationFilesManager } from "@/components/admin/publication-files-manager";
import { PublicationForm } from "@/components/admin/publication-form";
import { PublicationPrivacyReview } from "@/components/admin/publication-privacy-review";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/primitives";
import { Notice } from "@/components/ui/states";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import {
  getAdminPublication,
  getPublicationFileLibrary,
  getPublicationImageOptions,
  getPublicationTypeOptions,
} from "@/lib/data/admin-publications";
import { publicationErrorLabels } from "@/lib/validation/publication";

export const metadata: Metadata = { title: "Edit publication" };
export const dynamic = "force-dynamic";

/**
 * The publication editor page.
 *
 * The form covers the words and the policy. Everything that is a *decision about
 * a file* — which edition is active, which PDF it carries, and whether the whole
 * thing is safe to publish — is rendered here beside it rather than inside the
 * form, because those are not things you change while fixing a subtitle.
 */
export default async function EditPublicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requirePermission("viewAdmin", `/admin/publications/${id}/edit`);

  const [publication, types, images, fileLibrary] = await Promise.all([
    getAdminPublication(id),
    getPublicationTypeOptions(),
    getPublicationImageOptions(),
    getPublicationFileLibrary(),
  ]);

  if (!publication) notFound();

  const canEdit = permissions.editContent(session.role);
  const isOwner = permissions.deleteContent(session.role);

  return (
    <>
      <AdminPageHeader
        title={publication.translations.find((t) => t.locale === "en")?.title ?? publication.slug}
        description={`/${publication.slug}`}
        actions={<AdminBackLink href="/admin/publications" label="All publications" />}
      />

      <AdminPageBody>
        <div className="flex flex-col gap-6">
          {/* ── Status strip ──────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={publication.status} />
            {publication.featured ? <Badge tone="info" icon="star">Featured</Badge> : null}
            <Badge
              tone={
                publication.privacyStatus === "approved"
                  ? "success"
                  : publication.privacyStatus === "rejected"
                    ? "danger"
                    : "warning"
              }
              icon="shield"
            >
              Privacy: {publication.privacyStatus.replace("_", " ")}
            </Badge>
          </div>

          {publication.blockers.length > 0 ? (
            <Notice tone="warning">
              <p className="font-medium">This cannot be published yet:</p>
              <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
                {publication.blockers.map((code) => (
                  <li key={code}>{publicationErrorLabels[code] ?? code}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          {publication.warnings.length > 0 ? (
            <Notice tone="info">
              {/*
               * Warnings, not blockers. A book with no cover or no Khmer
               * translation is publishable; the point is that the owner should
               * decide that knowingly rather than discover it on the live page.
               */}
              <p className="font-medium">Worth checking before publishing:</p>
              <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
                {publication.warnings.map((code) => (
                  <li key={code}>{publicationErrorLabels[code] ?? code}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          {/* ── Cover, editions and sample pages ──────────────────────────── */}
          <PublicationFilesManager
            publicationId={publication.id}
            versions={publication.versions}
            media={publication.media}
            images={images}
            fileLibrary={fileLibrary}
            canEdit={canEdit}
            canPublish={permissions.publishContent(session.role)}
            canDelete={isOwner}
          />

          {/* ── Privacy review ────────────────────────────────────────────── */}
          <PublicationPrivacyReview
            publicationId={publication.id}
            privacyStatus={publication.privacyStatus}
            note={publication.privacyReviewNote}
            reviewedAt={publication.privacyReviewedAt}
            hasSourceArchive={publication.versions.some((version) => version.source !== null)}
            canReview={isOwner}
          />

          {/* ── The form ──────────────────────────────────────────────────── */}
          <PublicationForm
            publication={publication}
            types={types}
            canPublish={permissions.publishContent(session.role) && canEdit}
            canChangePolicy={isOwner}
          />
        </div>
      </AdminPageBody>
    </>
  );
}
