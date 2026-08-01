import type { Metadata } from "next";

import { AdminBackLink } from "@/components/admin/admin-nav";
import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { MediaImporter } from "@/components/admin/media-importer";
import { requirePermission } from "@/lib/auth/guards";
import { scanImportFolder } from "@/lib/data/admin-media-import";

export const metadata: Metadata = { title: "Import media" };
export const dynamic = "force-dynamic";

/**
 * Bulk import from a local folder.
 *
 * The page renders in every environment; the *component* handles the
 * development-only case, because "importing is unavailable here, and here is
 * why" is more useful than a 404 for someone who followed a link from the media
 * library. The API route is the thing that actually refuses in production.
 */
export default async function MediaImportPage() {
  await requirePermission("uploadMedia", "/admin/media/import");

  // Scanned on the server so the list is in the first paint and the client has no
  // mount-time fetch. Re-scanning is a button.
  const initialScan = await scanImportFolder();

  return (
    <>
      <AdminPageHeader
        title="Import from a folder"
        description="Scan a folder of photographs, check what is there, and bring the ones you choose into the media library."
        breadcrumb={<AdminBackLink href="/admin/media" label="Media library" />}
      />

      <AdminPageBody>
        <MediaImporter initialScan={{ ok: true, ...initialScan }} />
      </AdminPageBody>
    </>
  );
}
