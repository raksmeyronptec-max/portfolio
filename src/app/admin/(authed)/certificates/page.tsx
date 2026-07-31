import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { CertificateRowActions } from "@/components/admin/certificate-row-actions";
import { StatusBadge, TranslationBadge } from "@/components/admin/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { DataTable, LinkTabs, Td, Th } from "@/components/ui/navigation";
import { EmptyState, Notice } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { requireAdminSession } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { listAdminCertificates, type PublicationStatus } from "@/lib/data/admin";
import { resolveImage } from "@/lib/content/media";

export const metadata: Metadata = { title: "Certificates" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "in_review", label: "In review" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
  { key: "deleted", label: "Deleted" },
] as const;

export default async function AdminCertificatesPage({
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
  const privacyFilter = single(query.privacy) === "pending";

  const [certificates, allCertificates] = await Promise.all([
    listAdminCertificates({ status, search, needsPrivacyReview: privacyFilter }),
    listAdminCertificates({ status: "all" }),
  ]);

  const canEdit = permissions.editContent(session.role);
  const pendingPrivacy = allCertificates.filter((row) => !row.privacyReviewedAt).length;

  const counts: Record<string, number> = {};
  for (const row of allCertificates) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }

  return (
    <>
      <AdminPageHeader
        title="Certificates"
        description="Academic credentials and achievements. Only a redacted preview is ever shown publicly — the original scan stays in a private bucket, reachable only through a logged, 60-second signed link."
        actions={
          canEdit ? (
            <ButtonLink href="/admin/certificates/new" iconStart="plus">
              New certificate
            </ButtonLink>
          ) : undefined
        }
      />

      <AdminPageBody className="flex flex-col gap-5">
        {pendingPrivacy > 0 ? (
          <Notice
            tone="warning"
            icon="shield"
            title={`${pendingPrivacy} credential${pendingPrivacy === 1 ? "" : "s"} awaiting privacy review`}
          >
            <p>
              These cannot be published until the redaction checklist is completed. The
              database rejects the attempt, not just the UI.{" "}
              <Link href="/admin/certificates?privacy=pending" className="underline">
                Show only those
              </Link>
              .
            </p>
          </Notice>
        ) : null}

        <LinkTabs
          label="Filter certificates by status"
          items={TABS.map((tab) => ({
            href: `/admin/certificates${tab.key === "all" ? "" : `?status=${tab.key}`}`,
            label: tab.label,
            active: status === tab.key && !privacyFilter,
            count: tab.key === "all" ? allCertificates.length : counts[tab.key] ?? 0,
          }))}
        />

        <form method="get" role="search" className="flex flex-wrap gap-2">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
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
              aria-label="Search certificates by title, slug or issuer"
              placeholder="Search by title, slug or issuer"
              className="min-h-11 w-full rounded-(--radius-md) border border-border-strong bg-surface pl-10 pr-3 text-base"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-border-strong bg-surface px-4 text-small font-medium hover:bg-surface-muted"
          >
            Search
          </button>
        </form>

        {certificates.length === 0 ? (
          <EmptyState
            icon="award"
            title={
              search
                ? "No certificates match that search"
                : privacyFilter
                  ? "Nothing awaiting privacy review"
                  : "No certificates here yet"
            }
            description={
              privacyFilter
                ? "Every credential has a recorded privacy review."
                : status === "all" && !search
                  ? "The categories are seeded, but no credentials have been added. Add each real document with a redacted preview and, optionally, the private original."
                  : undefined
            }
            actions={
              canEdit && !search && status === "all" && !privacyFilter ? (
                <ButtonLink href="/admin/certificates/new" iconStart="plus">
                  New certificate
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <DataTable caption={`${certificates.length} certificates`}>
            <thead>
              <tr>
                <Th className="w-[38%]">Credential</Th>
                <Th>Status</Th>
                <Th>Privacy</Th>
                <Th>Files</Th>
                <Th>Languages</Th>
                <Th className="text-end">Actions</Th>
              </tr>
            </thead>

            <tbody>
              {certificates.map((certificate) => {
                const preview = resolveImage(certificate.preview, "en", "thumbnail");

                return (
                  <tr key={certificate.id} className="hover:bg-surface-muted/50">
                    <Td>
                      <div className="flex items-start gap-3">
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-(--radius-sm) border border-border bg-surface-muted">
                          {preview ? (
                            <Image
                              src={preview.src}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-contain p-1"
                            />
                          ) : (
                            <span className="flex h-full items-center justify-center text-foreground-subtle">
                              <Icon name="award" size={16} />
                            </span>
                          )}
                        </span>

                        <div className="flex min-w-0 flex-col gap-1">
                          <Link
                            href={`/admin/certificates/${certificate.id}/edit`}
                            className="font-medium hover:text-primary"
                          >
                            {certificate.titleEn ?? certificate.slug}
                          </Link>
                          <p className="text-[0.8125rem] text-foreground-muted">
                            {certificate.issuer}
                            {certificate.issuedOn
                              ? ` · ${new Date(certificate.issuedOn).getFullYear()}`
                              : ""}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {certificate.featured ? (
                              <Badge tone="accent" icon="star">
                                Featured
                              </Badge>
                            ) : null}
                            {certificate.categoryName ? (
                              <Badge tone="primary">{certificate.categoryName}</Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </Td>

                    <Td>
                      <StatusBadge
                        status={certificate.status}
                        deleted={Boolean(certificate.deletedAt)}
                      />
                    </Td>

                    <Td>
                      {certificate.privacyReviewedAt ? (
                        <Badge tone="success" icon="shield">
                          Reviewed
                        </Badge>
                      ) : (
                        <Badge tone="warning" icon="alertTriangle">
                          Review needed
                        </Badge>
                      )}
                    </Td>

                    <Td>
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1.5 text-[0.8125rem]">
                          <Icon
                            name={certificate.hasPreview ? "checkCircle" : "alertCircle"}
                            size={14}
                            className={
                              certificate.hasPreview ? "text-success" : "text-warning"
                            }
                          />
                          Preview
                        </span>
                        <span className="flex items-center gap-1.5 text-[0.8125rem] text-foreground-muted">
                          <Icon
                            name={certificate.hasOriginal ? "lock" : "close"}
                            size={14}
                          />
                          {certificate.hasOriginal ? "Original (private)" : "No original"}
                        </span>
                      </div>
                    </Td>

                    <Td>
                      <TranslationBadge status={certificate.translationStatus} />
                    </Td>

                    <Td className="text-end">
                      <CertificateRowActions
                        certificateId={certificate.id}
                        slug={certificate.slug}
                        status={certificate.status}
                        featured={certificate.featured}
                        isDeleted={Boolean(certificate.deletedAt)}
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

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
