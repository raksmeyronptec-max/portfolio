import type { Metadata } from "next";

import { AdminBackLink } from "@/components/admin/admin-nav";
import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { PublicationForm } from "@/components/admin/publication-form";
import { Notice } from "@/components/ui/states";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { getPublicationTypeOptions } from "@/lib/data/admin-publications";

export const metadata: Metadata = { title: "New publication" };
export const dynamic = "force-dynamic";

export default async function NewPublicationPage() {
  const session = await requirePermission("editContent", "/admin/publications/new");
  const types = await getPublicationTypeOptions();

  return (
    <>
      <AdminPageHeader
        title="New publication"
        description="Create the record first. Editions, files, chapters and sample pages are added afterwards, on the publication's own page."
        actions={<AdminBackLink href="/admin/publications" label="All publications" />}
      />

      <AdminPageBody>
        <Notice tone="info">
          {/*
           * Said up front rather than discovered at the publish button. A new
           * publication starts unreviewed by construction — the create action
           * forces `pending_review` whatever the form submits — and the reason
           * is worth stating: the review is about a file that does not exist yet.
           */}
          A new publication starts as a draft with its privacy review pending. You
          will be able to approve it once the PDF is attached and you have read
          through it.
        </Notice>

        <PublicationForm
          publication={null}
          types={types}
          canPublish={permissions.publishContent(session.role)}
          canChangePolicy={permissions.deleteContent(session.role)}
        />
      </AdminPageBody>
    </>
  );
}
