import Link from "next/link";
import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { JourneyRowActions } from "@/components/admin/journey-row-actions";
import { StatusBadge, TranslationBadge, ReviewBadge } from "@/components/admin/status-badge";
import { Badge, Card, CardBody } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { getJourneyHealth, listJourneyEntries } from "@/lib/data/admin-journey";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Journey" };
export const dynamic = "force-dynamic";

/**
 * The journey story list, and the content-health panel above it.
 *
 * The health counts lead the page rather than sitting in a sidebar because they
 * are the work queue: media pending privacy review is what blocks publication,
 * and a missing Khmer caption is what the owner would otherwise never notice.
 */
export default async function AdminJourneyPage() {
  const session = await requirePermission("viewAdmin", "/admin/journey");

  const [entries, health] = await Promise.all([
    listJourneyEntries(),
    getJourneyHealth(),
  ]);

  const canEdit = permissions.editContent(session.role);
  const canPublish = permissions.publishContent(session.role);
  const canDelete = permissions.deleteContent(session.role);

  return (
    <>
      <AdminPageHeader
        title="Journey"
        description="Stories about fieldwork, teaching practice, exchanges, awards and events — with the photographs and video that show them."
        actions={
          canEdit ? (
            <ButtonLink href="/admin/journey/new" iconStart="plus">
              New story
            </ButtonLink>
          ) : null
        }
      />

      <AdminPageBody>
        <div className="flex flex-col gap-6">
          {/* ── Health ────────────────────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HealthTile label="Stories" value={health.entries} icon="mapPin" />
            <HealthTile label="Published" value={health.published} icon="globe" />
            <HealthTile label="Featured" value={health.featured} icon="star" />
            <HealthTile
              label="Pending media review"
              value={health.pendingMediaReview}
              icon="shield"
              tone={health.pendingMediaReview > 0 ? "warning" : "neutral"}
            />
          </div>

          {/*
            The second row is only rendered when it has something to say. A grid
            of zeroes trains the owner to stop reading the panel, which is exactly
            when the one non-zero number would be missed.
          */}
          {health.missingKhmerCaptions > 0 ||
          health.missingAltText > 0 ||
          health.privateArchive > 0 ||
          health.videosWithoutPoster > 0 ||
          health.entriesMissingKhmer > 0 ||
          health.entriesWithoutDate > 0 ? (
            <div className="flex flex-wrap gap-2">
              {health.missingAltText > 0 ? (
                <Badge tone="warning" icon="alertCircle">
                  {health.missingAltText} missing alt text
                </Badge>
              ) : null}
              {health.missingKhmerCaptions > 0 ? (
                <Badge tone="warning" icon="languages">
                  {health.missingKhmerCaptions} missing Khmer captions
                </Badge>
              ) : null}
              {health.entriesMissingKhmer > 0 ? (
                <Badge tone="neutral" icon="languages">
                  {health.entriesMissingKhmer} stories without Khmer
                </Badge>
              ) : null}
              {health.videosWithoutPoster > 0 ? (
                <Badge tone="warning" icon="file">
                  {health.videosWithoutPoster} videos without a poster
                </Badge>
              ) : null}
              {health.entriesWithoutDate > 0 ? (
                <Badge tone="neutral" icon="clock">
                  {health.entriesWithoutDate} without a date
                </Badge>
              ) : null}
              {health.privateArchive > 0 ? (
                <Badge tone="neutral" icon="lock">
                  {health.privateArchive} in the private archive
                </Badge>
              ) : null}
            </div>
          ) : null}

          {/* ── The list ──────────────────────────────────────────────────── */}
          {entries.length === 0 ? (
            <EmptyState
              icon="mapPin"
              title="No journey stories yet"
              description="A story is one thing that happened — a fieldwork visit, an award, an exchange — with its own photographs. Start with one and attach the media afterwards."
              actions={
                canEdit ? (
                  <ButtonLink href="/admin/journey/new" iconStart="plus">
                    New story
                  </ButtonLink>
                ) : null
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <Card className={cn(entry.featured && "border-primary/40")}>
                    <CardBody className="flex flex-wrap items-start gap-4 p-4">
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={entry.status} />
                          {entry.featured ? (
                            <Badge tone="accent" icon="star">
                              Featured
                            </Badge>
                          ) : null}
                          <TranslationBadge status={entry.translationStatus} />
                          {entry.needsReview ? (
                            <ReviewBadge note={entry.reviewNote} />
                          ) : null}
                        </div>

                        <h2 className="text-body font-semibold">
                          <Link
                            href={`/admin/journey/${entry.id}/edit`}
                            className={cn(
                              "underline decoration-transparent underline-offset-2 transition-colors",
                              "hover:decoration-current",
                              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                            )}
                          >
                            {entry.title}
                          </Link>
                        </h2>

                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-foreground-subtle">
                          <code className="truncate">/{entry.slug}</code>
                          {entry.categoryName ? <span>{entry.categoryName}</span> : null}
                          {entry.periodLabel ? <span>{entry.periodLabel}</span> : null}
                        </p>

                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-foreground-muted">
                          <span className="inline-flex items-center gap-1">
                            <Icon name="image" size={13} />
                            {entry.photoCount} photo{entry.photoCount === 1 ? "" : "s"}
                          </span>

                          {entry.videoCount > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Icon name="file" size={13} />
                              {entry.videoCount} video{entry.videoCount === 1 ? "" : "s"}
                            </span>
                          ) : null}

                          <span className="inline-flex items-center gap-1">
                            <Icon name="globe" size={13} />
                            {entry.liveCount} public
                          </span>

                          {entry.relationCount > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Icon name="layers" size={13} />
                              {entry.relationCount} link
                              {entry.relationCount === 1 ? "" : "s"}
                            </span>
                          ) : null}

                          {entry.pendingReviewCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-warning-foreground">
                              <Icon name="shield" size={13} />
                              {entry.pendingReviewCount} pending review
                            </span>
                          ) : null}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          href={`/admin/journey/${entry.id}/media`}
                          className={cn(
                            "inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md)",
                            "border border-border px-3 text-small font-medium transition-colors",
                            "hover:bg-surface-muted",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                          )}
                        >
                          <Icon name="image" size={15} />
                          Media
                        </Link>

                        {canEdit ? (
                          <JourneyRowActions
                            entry={entry}
                            canPublish={canPublish}
                            canDelete={canDelete}
                          />
                        ) : null}
                      </div>
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {entries.some((entry) => entry.needsReview) ? (
            <Notice tone="info" icon="info" title="Seeded stories need your facts">
              <p>
                The stories created by the initial migration contain only what was
                supplied in writing — no dates, no organisers, no award titles, because
                none were given. Each one&rsquo;s review note names exactly which fields
                are unconfirmed. The database refuses to publish a story while
                &ldquo;needs review&rdquo; is set.
              </p>
            </Notice>
          ) : null}
        </div>
      </AdminPageBody>
    </>
  );
}

function HealthTile({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: "mapPin" | "globe" | "star" | "shield";
  tone?: "neutral" | "warning";
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-(--radius-md)",
            tone === "warning"
              ? "bg-warning-subtle text-warning-foreground"
              : "bg-surface-muted text-foreground-muted",
          )}
        >
          <Icon name={icon} size={17} />
        </span>

        <span className="flex flex-col">
          <span className="text-[1.25rem] font-semibold tabular-nums leading-none">
            {value}
          </span>
          <span className="text-[0.75rem] text-foreground-subtle">{label}</span>
        </span>
      </CardBody>
    </Card>
  );
}
