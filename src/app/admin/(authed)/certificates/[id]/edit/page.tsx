import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminBackLink } from "@/components/admin/admin-nav";
import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { CertificateForm } from "@/components/admin/certificate-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { Icon } from "@/components/ui/icon";
import { requirePermission } from "@/lib/auth/guards";
import {
  getCertificateFormOptions,
  getCertificateFormValues,
} from "@/lib/data/admin-certificate-forms";

export const metadata: Metadata = { title: "Edit certificate" };
export const dynamic = "force-dynamic";

export default async function EditCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await requirePermission("editContent", `/admin/certificates/${id}/edit`);

  const [values, options] = await Promise.all([
    getCertificateFormValues(id),
    getCertificateFormOptions(),
  ]);

  if (!values) notFound();

  const title =
    values.translations.find((translation) => translation.locale === "en")?.title ||
    values.slug;

  return (
    <>
      <AdminPageHeader
        title={title}
        description={`${values.issuer_en} · /${values.slug}`}
        breadcrumb={<AdminBackLink href="/admin/certificates" label="All certificates" />}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={values.status} />
            {values.status === "published" ? (
              <Link
                href={`/en/certificates/${values.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-[--radius-md] border border-border-strong bg-surface px-4 text-small font-medium hover:bg-surface-muted"
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
        <CertificateForm
          initial={values}
          categories={options.categories}
          previewOptions={options.previewOptions}
          originalOptions={options.originalOptions}
          projectOptions={options.projectOptions}
        />
      </AdminPageBody>
    </>
  );
}
