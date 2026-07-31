import Link from "next/link";
import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { MediaCard } from "@/components/admin/media-card";
import { MediaUploader } from "@/components/admin/media-uploader";
import { Card, CardBody } from "@/components/ui/primitives";
import { EmptyState, Notice } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { requireAdminSession } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { listAdminMedia } from "@/lib/data/admin";
import { MEDIA_KINDS } from "@/lib/media/kinds";
import { formatBytes } from "@/lib/media/validate";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Media library" };
export const dynamic = "force-dynamic";

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, query] = await Promise.all([requireAdminSession(), searchParams]);

  const kind = single(query.kind) ?? "";
  const visibilityParam = single(query.visibility) ?? "";
  const visibility =
    visibilityParam === "public" || visibilityParam === "private"
      ? visibilityParam
      : undefined;
  const search = single(query.q) ?? "";

  const [assets, allAssets] = await Promise.all([
    listAdminMedia({ kind: kind || undefined, visibility, search }),
    listAdminMedia({}),
  ]);

  const canEdit = permissions.uploadMedia(session.role);
  const canDelete = permissions.hardDelete(session.role);

  const totalBytes = allAssets.reduce((sum, asset) => sum + asset.file_size_bytes, 0);
  const privateCount = allAssets.filter((asset) => asset.visibility === "private").length;
  const unusedCount = allAssets.filter((asset) => asset.usageCount === 0).length;
  const missingAltCount = allAssets.filter(
    (asset) =>
      asset.visibility === "public" &&
      asset.mime_type !== "application/pdf" &&
      (!asset.alt_text_en || !asset.alt_text_km),
  ).length;

  function href(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { kind, visibility: visibilityParam, q: search, ...overrides };
    if (merged.kind) params.set("kind", merged.kind);
    if (merged.visibility) params.set("visibility", merged.visibility);
    if (merged.q) params.set("q", merged.q);
    const qs = params.toString();
    return `/admin/media${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <AdminPageHeader
        title="Media library"
        description="Every uploaded file. Public images are re-encoded to WebP, stripped of EXIF metadata and resized into thumbnail, card and preview versions. Private files have no public URL at all."
      />

      <AdminPageBody className="flex flex-col gap-6">
        {/* ── Summary ──────────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Files" value={String(allAssets.length)} icon="image" />
          <SummaryTile label="Storage used" value={formatBytes(totalBytes)} icon="database" />
          <SummaryTile
            label="Private files"
            value={String(privateCount)}
            icon="lock"
            href={href({ visibility: "private", kind: undefined })}
          />
          <SummaryTile
            label="Missing alt text"
            value={String(missingAltCount)}
            icon="alertTriangle"
            tone={missingAltCount > 0 ? "warning" : undefined}
          />
        </div>

        {missingAltCount > 0 ? (
          <Notice
            tone="warning"
            icon="alertTriangle"
            title={`${missingAltCount} public image${missingAltCount === 1 ? "" : "s"} missing alt text`}
          >
            <p>
              Every public image needs alt text in both English and Khmer. Edit each
              file below to add it.
            </p>
          </Notice>
        ) : null}

        {unusedCount > 0 ? (
          <Notice tone="info" icon="info">
            <p>
              {unusedCount} file{unusedCount === 1 ? " is" : "s are"} not referenced by
              any content. They are safe to delete, and deleting is refused
              automatically for anything still in use.
            </p>
          </Notice>
        ) : null}

        {canEdit ? <MediaUploader /> : null}

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <nav aria-label="Filter media" className="flex flex-wrap gap-2">
            <FilterChip href={href({ kind: undefined, visibility: undefined })} active={!kind && !visibility}>
              All files
            </FilterChip>
            <FilterChip href={href({ visibility: "public", kind: undefined })} active={visibility === "public"}>
              Public
            </FilterChip>
            <FilterChip href={href({ visibility: "private", kind: undefined })} active={visibility === "private"}>
              Private
            </FilterChip>

            {MEDIA_KINDS.map((option) => (
              <FilterChip
                key={option}
                href={href({ kind: option, visibility: undefined })}
                active={kind === option}
              >
                {option.replace(/_/g, " ")}
              </FilterChip>
            ))}
          </nav>

          <form method="get" role="search" className="flex flex-wrap gap-2">
            {kind ? <input type="hidden" name="kind" value={kind} /> : null}
            {visibility ? (
              <input type="hidden" name="visibility" value={visibility} />
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
                aria-label="Search media by filename or alt text"
                placeholder="Search by filename or alt text"
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
        </div>

        {/* ── Grid ─────────────────────────────────────────────────────────── */}
        {assets.length === 0 ? (
          <EmptyState
            icon="image"
            title={
              search || kind || visibility
                ? "No files match these filters"
                : "No files uploaded yet"
            }
            description={
              search || kind || visibility
                ? "Try clearing a filter."
                : "Upload project covers, screenshots, certificate previews and resume PDFs here."
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset) => (
              <li key={asset.id} className="flex">
                <div className="flex w-full">
                  <MediaCard asset={asset} canEdit={canEdit} canDelete={canDelete} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminPageBody>
    </>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  icon: "image" | "database" | "lock" | "alertTriangle";
  tone?: "warning";
  href?: string;
}) {
  const content = (
    <Card interactive={Boolean(href)} className="h-full">
      <CardBody className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-(--radius-md)",
            tone === "warning"
              ? "bg-warning-subtle text-warning-foreground"
              : "bg-primary-subtle text-primary-subtle-foreground",
          )}
        >
          <Icon name={icon} size={17} />
        </span>
        <span className="flex flex-col">
          <span className="text-h4 font-bold tabular-nums">{value}</span>
          <span className="text-[0.8125rem] text-foreground-muted">{label}</span>
        </span>
      </CardBody>
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full rounded-(--radius-lg)">
      {content}
    </Link>
  ) : (
    content
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-9 items-center rounded-(--radius-full) border px-3 text-[0.8125rem] capitalize transition-colors",
        active
          ? "border-primary bg-primary font-semibold text-primary-foreground"
          : "border-border bg-surface text-foreground-muted hover:border-border-interactive hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
