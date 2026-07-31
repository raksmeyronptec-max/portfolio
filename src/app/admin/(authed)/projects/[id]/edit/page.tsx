import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminBackLink } from "@/components/admin/admin-nav";
import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { ProjectForm } from "@/components/admin/project-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { Icon } from "@/components/ui/icon";
import { requirePermission } from "@/lib/auth/guards";
import { getProjectFormOptions, getProjectFormValues } from "@/lib/data/admin-forms";

export const metadata: Metadata = { title: "Edit project" };
export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await requirePermission("editContent", `/admin/projects/${id}/edit`);

  const [values, options] = await Promise.all([
    getProjectFormValues(id),
    getProjectFormOptions(),
  ]);

  if (!values) notFound();

  const englishTitle =
    values.translations.find((translation) => translation.locale === "en")?.title ||
    values.slug;

  return (
    <>
      <AdminPageHeader
        title={englishTitle}
        description={`Editing /${values.slug}`}
        breadcrumb={<AdminBackLink href="/admin/projects" label="All projects" />}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={values.status} />

            {/* Preview: for a published project the real page, otherwise a note
                that there is nothing public to look at yet. */}
            {values.status === "published" ? (
              <Link
                href={`/en/projects/${values.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) border border-border-strong bg-surface px-4 text-small font-medium hover:bg-surface-muted"
              >
                <Icon name="externalLink" size={16} />
                Preview live page
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            ) : (
              <span className="text-[0.8125rem] text-foreground-subtle">
                No public page yet
              </span>
            )}
          </div>
        }
      />

      <AdminPageBody>
        <ProjectForm
          initial={values}
          categories={options.categories}
          technologies={options.technologies}
          mediaOptions={options.media}
        />
      </AdminPageBody>
    </>
  );
}
