import type { Metadata } from "next";

import { AdminBackLink } from "@/components/admin/admin-nav";
import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { JourneyForm } from "@/components/admin/journey-form";
import { Notice } from "@/components/ui/states";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { listJourneyCategories } from "@/lib/data/admin-journey";

export const metadata: Metadata = { title: "New journey story" };
export const dynamic = "force-dynamic";

export default async function NewJourneyStoryPage() {
  const session = await requirePermission("editContent", "/admin/journey/new");
  const categories = await listJourneyCategories();

  return (
    <>
      <AdminPageHeader
        title="New journey story"
        description="Write the story first. Photographs, video and links to other records are added once it is saved."
        breadcrumb={<AdminBackLink href="/admin/journey" label="All stories" />}
      />

      <AdminPageBody>
        <div className="flex flex-col gap-6">
          <Notice tone="info" icon="info" title="Only what you can evidence">
            <p>
              Leave a field empty rather than guessing at it. The date precision control
              exists so &ldquo;2024, month unknown&rdquo; is a real answer — you never
              have to invent a day to satisfy a date field, and an undated story files
              under its own heading on the timeline rather than under a year nobody
              confirmed.
            </p>
          </Notice>

          <JourneyForm
            entry={null}
            categories={categories}
            canPublish={permissions.publishContent(session.role)}
          />
        </div>
      </AdminPageBody>
    </>
  );
}
