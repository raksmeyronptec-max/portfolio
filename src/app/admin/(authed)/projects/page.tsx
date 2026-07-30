import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { ProjectRowActions } from "@/components/admin/project-row-actions";
import { ReviewBadge, StatusBadge, TranslationBadge } from "@/components/admin/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { DataTable, LinkTabs, Td, Th } from "@/components/ui/navigation";
import { EmptyState, Notice } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { requireAdminSession } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { listAdminProjects, type PublicationStatus } from "@/lib/data/admin";
import { resolveImage } from "@/lib/content/media";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

const TABS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "in_review", label: "In review" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
  { key: "deleted", label: "Deleted" },
];

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, query] = await Promise.all([requireAdminSession(), searchParams]);

  const statusParam = single(query.status) ?? "all";
  const status = TABS.some((tab) => tab.key === statusParam)
    ? (statusParam as PublicationStatus | "all" | "deleted")
    : "all";
  const search = single(query.q) ?? "";

  const [projects, allProjects] = await Promise.all([
    listAdminProjects({ status, search }),
    listAdminProjects({ status: "all" }),
  ]);

  const canEdit = permissions.editContent(session.role);
  const counts = countByStatus(allProjects);

  return (
    <>
      <AdminPageHeader
        title="Projects"
        description="Case studies for the public portfolio. Nothing is visible to visitors until it is published, and publishing requires a complete case study."
        actions={
          canEdit ? (
            <ButtonLink href="/admin/projects/new" iconStart="plus">
              New project
            </ButtonLink>
          ) : undefined
        }
      />

      <AdminPageBody className="flex flex-col gap-5">
        <LinkTabs
          label="Filter projects by status"
          items={TABS.map((tab) => ({
            href: `/admin/projects${tab.key === "all" ? "" : `?status=${tab.key}`}`,
            label: tab.label,
            active: status === tab.key,
            count: tab.key === "all" ? allProjects.length : counts[tab.key] ?? 0,
          }))}
        />

        {/* No-JS search: a plain GET form. */}
        <form method="get" role="search" className="flex flex-wrap gap-2">
          {status !== "all" ? (
            <input type="hidden" name="status" value={status} />
          ) : null}
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Icon
              name="search"
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
            />
            <input
              type="search"
              name="q"
              defaultValue={search}
              aria-label="Search projects by title or slug"
              placeholder="Search by title or slug"
              className="min-h-11 w-full rounded-[--radius-md] border border-border-strong bg-surface pl-10 pr-3 text-base"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-[--radius-md] border border-border-strong bg-surface px-4 text-small font-medium hover:bg-surface-muted"
          >
            Search
          </button>
        </form>

        {status === "deleted" && projects.length > 0 ? (
          <Notice tone="info" icon="trash">
            <p>
              These are soft-deleted and invisible to visitors. Restoring returns them
              as drafts, never straight back to published — their slugs may have been
              reused.
            </p>
          </Notice>
        ) : null}

        {projects.length === 0 ? (
          <EmptyState
            icon="layers"
            title={search ? "No projects match that search" : "No projects here yet"}
            description={
              search
                ? "Try a different term, or clear the search."
                : status === "all"
                  ? "Create your first project to start building the portfolio."
                  : `There are no projects with the “${status}” status.`
            }
            actions={
              canEdit && !search && status === "all" ? (
                <ButtonLink href="/admin/projects/new" iconStart="plus">
                  New project
                </ButtonLink>
              ) : search ? (
                <ButtonLink href="/admin/projects" variant="outline">
                  Clear search
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <DataTable caption={`${projects.length} projects`}>
            <thead>
              <tr>
                <Th className="w-[46%]">Project</Th>
                <Th>Status</Th>
                <Th>Languages</Th>
                <Th>Case study</Th>
                <Th className="text-end">Actions</Th>
              </tr>
            </thead>

            <tbody>
              {projects.map((project) => {
                const cover = resolveImage(project.cover, "en", "thumbnail");

                return (
                  <tr key={project.id} className="hover:bg-surface-muted/50">
                    <Td>
                      <div className="flex items-start gap-3">
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-[--radius-sm] border border-border bg-surface-muted">
                          {cover ? (
                            <Image
                              src={cover.src}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="flex h-full items-center justify-center text-foreground-subtle">
                              <Icon name="image" size={16} />
                            </span>
                          )}
                        </span>

                        <div className="flex min-w-0 flex-col gap-1">
                          <Link
                            href={`/admin/projects/${project.id}/edit`}
                            className="font-medium hover:text-primary"
                          >
                            {project.titleEn ?? project.slug}
                          </Link>

                          <code className="text-[0.75rem] text-foreground-subtle">
                            /{project.slug}
                          </code>

                          <div className="flex flex-wrap gap-1.5">
                            {project.featured ? (
                              <Badge tone="accent" icon="star">
                                Featured
                              </Badge>
                            ) : null}
                            {project.needsReview ? (
                              <ReviewBadge note={project.reviewNote} />
                            ) : null}
                          </div>

                          {project.needsReview && project.reviewNote ? (
                            <p className="max-w-[52ch] text-[0.75rem] leading-snug text-warning-foreground">
                              {project.reviewNote.length > 160
                                ? `${project.reviewNote.slice(0, 160)}…`
                                : project.reviewNote}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </Td>

                    <Td>
                      <StatusBadge
                        status={project.status}
                        deleted={Boolean(project.deletedAt)}
                      />
                    </Td>

                    <Td>
                      <TranslationBadge
                        status={project.translationStatus}
                        missing={project.missingLocales}
                      />
                    </Td>

                    <Td>
                      {project.hasCaseStudy ? (
                        <Badge tone="success" icon="check">
                          Complete
                        </Badge>
                      ) : (
                        <Badge tone="warning" icon="alertTriangle">
                          Incomplete
                        </Badge>
                      )}
                    </Td>

                    <Td className="text-end">
                      <ProjectRowActions
                        projectId={project.id}
                        slug={project.slug}
                        status={project.status}
                        featured={project.featured}
                        isDeleted={Boolean(project.deletedAt)}
                        canEdit={canEdit}
                        canDelete={permissions.deleteContent(session.role)}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </AdminPageBody>
    </>
  );
}

function countByStatus(
  projects: Awaited<ReturnType<typeof listAdminProjects>>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const project of projects) {
    counts[project.status] = (counts[project.status] ?? 0) + 1;
  }
  return counts;
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
