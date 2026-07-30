import type { Metadata } from "next";

import { AdminBackLink } from "@/components/admin/admin-nav";
import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { ProjectForm } from "@/components/admin/project-form";
import { requirePermission } from "@/lib/auth/guards";
import {
  emptyProjectFormValues,
  getProjectFormOptions,
} from "@/lib/data/admin-forms";

export const metadata: Metadata = { title: "New project" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  // Server-side permission check. A viewer who navigates here directly is sent to
  // the not-permitted page rather than shown a form whose save would fail.
  await requirePermission("editContent", "/admin/projects/new");

  const options = await getProjectFormOptions();

  return (
    <>
      <AdminPageHeader
        title="New project"
        description="Created as a draft. It becomes visible to visitors only once the publish checklist is complete and you set the status to Published."
        breadcrumb={<AdminBackLink href="/admin/projects" label="All projects" />}
      />

      <AdminPageBody>
        <ProjectForm
          initial={emptyProjectFormValues()}
          categories={options.categories}
          technologies={options.technologies}
          mediaOptions={options.media}
        />
      </AdminPageBody>
    </>
  );
}
