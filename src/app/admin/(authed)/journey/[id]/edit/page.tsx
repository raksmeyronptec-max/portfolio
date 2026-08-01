import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminBackLink } from "@/components/admin/admin-nav";
import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { JourneyForm } from "@/components/admin/journey-form";
import { JourneyRelationsManager } from "@/components/admin/journey-relations-manager";
import { StatusBadge } from "@/components/admin/status-badge";
import { Divider } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import {
  getJourneyEntryForEdit,
  listJourneyCategories,
  listJourneyRelations,
  listRelationTargets,
} from "@/lib/data/admin-journey";

export const metadata: Metadata = { title: "Edit journey story" };
export const dynamic = "force-dynamic";

export default async function EditJourneyStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requirePermission("editContent", `/admin/journey/${id}/edit`);

  const [entry, categories, relations, targets] = await Promise.all([
    getJourneyEntryForEdit(id),
    listJourneyCategories(),
    listJourneyRelations(id),
    listRelationTargets(),
  ]);

  if (!entry) notFound();

  const englishTitle =
    entry.translations.find((t) => t.locale === "en")?.title ?? entry.slug;

  return (
    <>
      <AdminPageHeader
        title={englishTitle}
        description={`/${entry.slug}`}
        breadcrumb={<AdminBackLink href="/admin/journey" label="All stories" />}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={entry.status} />

            <Link
              href={`/admin/journey/${id}/media`}
              className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) border border-border-strong bg-surface px-4 text-small font-medium hover:bg-surface-muted"
            >
              <Icon name="image" size={16} />
              Photographs and video
            </Link>

            {entry.status === "published" ? (
              <Link
                href={`/en/journey/${entry.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) border border-border-strong bg-surface px-4 text-small font-medium hover:bg-surface-muted"
              >
                <Icon name="externalLink" size={16} />
                Preview
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            ) : null}
          </div>
        }
      />

      <AdminPageBody>
        <div className="flex flex-col gap-8">
          <JourneyForm
            entry={entry}
            categories={categories}
            canPublish={permissions.publishContent(session.role)}
          />

          <Divider />

          {/*
            Relations live on the edit page rather than behind their own route,
            unlike media. Media needs a dedicated page because the privacy
            checklist is twelve statements that must actually be read; a relation
            is one dropdown and belongs next to the prose it contextualises.
          */}
          <section className="flex max-w-3xl flex-col gap-4">
            <div>
              <h2 className="text-body font-semibold">What this connects to</h2>
              <p className="mt-1 text-small text-foreground-muted">
                Link this story to the Experience, Education, Certificate or Project
                record it is evidence for. The link appears on both pages, but only once
                each side is published.
              </p>
            </div>

            <JourneyRelationsManager
              journeyEntryId={id}
              relations={relations}
              targets={targets}
            />
          </section>
        </div>
      </AdminPageBody>
    </>
  );
}
