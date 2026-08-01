import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminBackLink } from "@/components/admin/admin-nav";
import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { PublicationForm } from "@/components/admin/publication-form";
import { PublicationPrivacyReview } from "@/components/admin/publication-privacy-review";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge, Card, CardBody } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { getAdminPublication, getPublicationTypeOptions } from "@/lib/data/admin-publications";
import { publicationErrorLabels } from "@/lib/validation/publication";
import { formatBytes } from "@/lib/media/validate";

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

  const [publication, types] = await Promise.all([
    getAdminPublication(id),
    getPublicationTypeOptions(),
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

          {/* ── Editions and their files ──────────────────────────────────── */}
          <Card>
            <CardBody className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-body font-semibold text-foreground">Editions</h2>
                <span className="text-small text-foreground-subtle">
                  {publication.versions.length} recorded
                </span>
              </div>

              {publication.versions.length === 0 ? (
                <p className="text-small text-foreground-muted">
                  No editions yet. An edition carries the three files: the
                  public-safe PDF, the private archival original, and the LaTeX
                  source archive.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {publication.versions.map((version) => (
                    <li
                      key={version.id}
                      className="flex flex-col gap-1.5 rounded-(--radius-md) border border-border p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {version.versionLabel}
                        </span>
                        {version.isActive ? (
                          <Badge tone="success">Active</Badge>
                        ) : null}
                        <StatusBadge status={version.status} />
                        {version.publicationYear ? (
                          <span className="text-small tabular-nums text-foreground-subtle">
                            {version.publicationYear}
                          </span>
                        ) : null}
                      </div>

                      {/*
                        The three slots, always all three, so an empty one is
                        visible as a gap rather than as an absence. The archival
                        original in particular is the file nobody notices is
                        missing until they need it.
                      */}
                      <dl className="grid gap-1.5 text-[0.8125rem] sm:grid-cols-3">
                        <FileSlot label="Public PDF" file={version.pdf} />
                        <FileSlot label="Archival original" file={version.original} />
                        <FileSlot label="LaTeX source" file={version.source} />
                      </dl>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-[0.75rem] text-foreground-subtle">
                Files are uploaded through the{" "}
                <Link href="/admin/media" className="underline">
                  media library
                </Link>{" "}
                with the matching kind — “Publication PDF”, “Publication original”
                or “Publication LaTeX source”. All three are stored privately and
                are served only through the download route, which checks this
                publication’s policy first.
              </p>
            </CardBody>
          </Card>

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

function FileSlot({
  label,
  file,
}: {
  label: string;
  file: { filename: string; sizeBytes: number; visibility: string } | null;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-foreground-subtle">{label}</dt>
      <dd className="flex items-center gap-1.5 text-foreground">
        {file ? (
          <>
            <Icon
              name={file.visibility === "private" ? "lock" : "globe"}
              size={13}
              aria-hidden
            />
            <span className="min-w-0 truncate" title={file.filename}>
              {file.filename}
            </span>
            <span className="shrink-0 text-foreground-subtle">
              ({formatBytes(file.sizeBytes)})
            </span>
          </>
        ) : (
          <span className="text-foreground-subtle">Not attached</span>
        )}
      </dd>
    </div>
  );
}
