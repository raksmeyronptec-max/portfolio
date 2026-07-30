import Link from "next/link";
import type { Metadata } from "next";

import { AdminBackLink } from "@/components/admin/admin-nav";
import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { CertificateForm } from "@/components/admin/certificate-form";
import { Notice } from "@/components/ui/states";
import { requirePermission } from "@/lib/auth/guards";
import {
  emptyCertificateFormValues,
  getCertificateFormOptions,
} from "@/lib/data/admin-certificate-forms";

export const metadata: Metadata = { title: "New certificate" };
export const dynamic = "force-dynamic";

export default async function NewCertificatePage() {
  await requirePermission("editContent", "/admin/certificates/new");

  const options = await getCertificateFormOptions();

  return (
    <>
      <AdminPageHeader
        title="New certificate"
        description="Add a real credential. Upload the redacted preview and, if you want to keep it, the private original — then complete the privacy review before publishing."
        breadcrumb={<AdminBackLink href="/admin/certificates" label="All certificates" />}
      />

      <AdminPageBody className="flex flex-col gap-5">
        <Notice tone="info" icon="shield" title="Before you start">
          <p>
            Prepare two files: a <strong>redacted</strong> image for public display, and
            optionally the untouched original. Upload both in the{" "}
            <Link href="/admin/media" className="underline">
              Media library
            </Link>{" "}
            first — mark the original as private there. Only private assets can be
            attached as an original, and only public ones as a preview.
          </p>
        </Notice>

        <CertificateForm
          initial={emptyCertificateFormValues()}
          categories={options.categories}
          previewOptions={options.previewOptions}
          originalOptions={options.originalOptions}
          projectOptions={options.projectOptions}
        />
      </AdminPageBody>
    </>
  );
}
