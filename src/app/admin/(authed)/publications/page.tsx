import Link from "next/link";
import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { PublicationRowActions } from "@/components/admin/publication-row-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge, Card, CardBody } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/states";
import { Icon, type IconName } from "@/components/ui/icon";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { getAdminPublications } from "@/lib/data/admin-publications";
import { publicationErrorLabels } from "@/lib/validation/publication";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Publications" };
export const dynamic = "force-dynamic";

/**
 * The publications list, and the work queue above it.
 *
 * The counts lead the page for the same reason the journey ones do: they are the
 * work. A book waiting on a privacy review is a book that cannot be published,
 * and that fact is far more useful at the top of the page than the row count.
 *
 * Each row states *why* it cannot be published rather than only that it cannot.
 * "Privacy review not completed" is actionable; a greyed-out publish button is
 * a puzzle.
 */
export default async function AdminPublicationsPage() {
  const session = await requirePermission("viewAdmin", "/admin/publications");
  const publications = await getAdminPublications({ includeDeleted: true });

  const canEdit = permissions.editContent(session.role);
  const canPublish = permissions.publishContent(session.role);
  const canDelete = permissions.deleteContent(session.role);

  const live = publications.filter((publication) => publication.deletedAt === null);
  const deleted = publications.filter((publication) => publication.deletedAt !== null);

  const published = live.filter((publication) => publication.status === "published").length;
  const featured = live.filter((publication) => publication.featured).length;
  const pendingReview = live.filter(
    (publication) => publication.privacyStatus === "pending_review",
  ).length;
  const blocked = live.filter(
    (publication) => publication.status !== "published" && publication.blockers.length > 0,
  ).length;

  return (
    <>
      <AdminPageHeader
        title="Publications"
        description="Authored books, exercise collections and lecture notes — their editions, files, table of contents and access policy."
        actions={
          canEdit ? (
            <ButtonLink href="/admin/publications/new" iconStart="plus">
              New publication
            </ButtonLink>
          ) : null
        }
      />

      <AdminPageBody>
        <div className="flex flex-col gap-6">
          {/* ── Work queue ────────────────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Publications" value={live.length} icon="book" />
            <Tile label="Published" value={published} icon="globe" />
            <Tile label="Featured" value={featured} icon="star" />
            <Tile
              label="Awaiting privacy review"
              value={pendingReview}
              icon="shield"
              tone={pendingReview > 0 ? "warning" : "neutral"}
            />
          </div>

          {blocked > 0 ? (
            <Notice tone="warning">
              {blocked === 1
                ? "One publication cannot be published yet."
                : `${blocked} publications cannot be published yet.`}{" "}
              The reason is listed on each row.
            </Notice>
          ) : null}

          {/* ── Rows ──────────────────────────────────────────────────────── */}
          {live.length === 0 ? (
            <EmptyState
              icon="book"
              title="No publications yet"
              description="Add a book, an exercise collection or a set of lecture notes. Nothing is published until its privacy review is approved."
              actions={
                canEdit ? (
                  <ButtonLink href="/admin/publications/new">New publication</ButtonLink>
                ) : null
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {live.map((publication) => (
                <li key={publication.id}>
                  <Card>
                    <CardBody className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/admin/publications/${publication.id}/edit`}
                              className="text-body font-semibold leading-khmer text-foreground hover:underline"
                            >
                              {publication.title}
                            </Link>
                            <StatusBadge status={publication.status} />
                            {publication.featured ? (
                              <Badge tone="info" icon="star">
                                Featured
                              </Badge>
                            ) : null}
                            {publication.privacyStatus === "approved" ? (
                              <Badge tone="success" icon="shield">
                                Privacy approved
                              </Badge>
                            ) : publication.privacyStatus === "rejected" ? (
                              <Badge tone="danger" icon="shield">
                                Privacy rejected
                              </Badge>
                            ) : (
                              <Badge tone="warning" icon="shield">
                                Privacy review pending
                              </Badge>
                            )}
                          </div>

                          <p className="text-small text-foreground-muted">
                            {[
                              publication.typeName,
                              publication.editionLabel,
                              publication.year ? String(publication.year) : null,
                              publication.pageCount
                                ? `${publication.pageCount} pages`
                                : null,
                              `/${publication.slug}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>

                          {/*
                            Translation coverage as a fact rather than a badge
                            colour: "en" alone means the Khmer page falls back to
                            English, which is legal but worth seeing.
                          */}
                          <p className="text-[0.75rem] text-foreground-subtle">
                            Languages: {publication.translationLocales.join(", ") || "none"}
                            {publication.hasActiveEdition
                              ? publication.activeEditionHasPdf
                                ? " · active edition has a PDF"
                                : " · active edition has no PDF"
                              : " · no active edition"}
                          </p>
                        </div>

                        <PublicationRowActions
                          id={publication.id}
                          slug={publication.slug}
                          status={publication.status}
                          featured={publication.featured}
                          canEdit={canEdit}
                          canPublish={canPublish}
                          canDelete={canDelete}
                          blocked={publication.blockers.length > 0}
                        />
                      </div>

                      {publication.blockers.length > 0 ? (
                        <ul className="flex flex-col gap-1 rounded-(--radius-md) bg-surface-muted p-2.5">
                          {publication.blockers.map((code) => (
                            <li
                              key={code}
                              className="flex items-start gap-1.5 text-[0.75rem] text-foreground-muted"
                            >
                              <Icon name="info" size={13} aria-hidden className="mt-0.5" />
                              {publicationErrorLabels[code] ?? code}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {/* ── Soft-deleted ──────────────────────────────────────────────── */}
          {deleted.length > 0 && canDelete ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-small font-semibold uppercase tracking-[0.06em] text-foreground-subtle">
                Deleted
              </h2>
              <ul className="flex flex-col gap-2">
                {deleted.map((publication) => (
                  <li key={publication.id}>
                    <Card>
                      <CardBody className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-small leading-khmer text-foreground-muted">
                          {publication.title}
                        </span>
                        <PublicationRowActions
                          id={publication.id}
                          slug={publication.slug}
                          status={publication.status}
                          featured={publication.featured}
                          canEdit={canEdit}
                          canPublish={canPublish}
                          canDelete={canDelete}
                          deleted
                        />
                      </CardBody>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </AdminPageBody>
    </>
  );
}

function Tile({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: IconName;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-(--radius-md)",
            tone === "warning"
              ? "bg-warning-subtle text-warning-subtle-foreground"
              : "bg-surface-muted text-foreground-muted",
          )}
        >
          <Icon name={icon} size={17} aria-hidden />
        </span>
        <span className="flex flex-col">
          <span className="text-heading-sm font-semibold tabular-nums text-foreground">
            {value}
          </span>
          <span className="text-[0.75rem] text-foreground-subtle">{label}</span>
        </span>
      </CardBody>
    </Card>
  );
}
