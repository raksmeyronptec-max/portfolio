import Link from "next/link";
import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/primitives";
import { DataTable, Pagination, Td, Th } from "@/components/ui/navigation";
import { EmptyState, Notice } from "@/components/ui/states";
import { requirePermission } from "@/lib/auth/guards";
import { listAuditLogs } from "@/lib/data/admin";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

/** Action groups, used to colour and filter the log. */
const ACTION_GROUPS = [
  { key: "", label: "All actions" },
  { key: "admin.login", label: "Sign-ins" },
  { key: "admin.unauthorized", label: "Denied access" },
  { key: "project.published", label: "Projects published" },
  { key: "certificate.published", label: "Certificates published" },
  { key: "certificate.original_viewed", label: "Private originals opened" },
  { key: "media.uploaded", label: "Uploads" },
  { key: "settings.updated", label: "Settings changes" },
] as const;

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("viewAuditLogs", "/admin/audit-logs");
  const query = await searchParams;

  const action = single(query.action) ?? "";
  const page = toPositiveInt(single(query.page), 1);

  const result = await listAuditLogs({ page, perPage: 40, action: action || undefined });

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        description="Append-only record of admin activity. No role can update or delete an entry — there is no policy granting it — so this trail cannot be quietly rewritten from the application."
      />

      <AdminPageBody className="flex flex-col gap-5">
        <Notice tone="info" icon="shield">
          <p>
            Entries are written with the service-role key, so an editor cannot forge one
            attributed to someone else. IP addresses are never stored — only a salted,
            daily-rotating hash.
          </p>
        </Notice>

        <nav aria-label="Filter the audit log" className="flex flex-wrap gap-2">
          {ACTION_GROUPS.map((group) => (
            <Link
              key={group.key || "all"}
              href={`/admin/audit-logs${group.key ? `?action=${group.key}` : ""}`}
              aria-current={action === group.key ? "true" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-[--radius-full] border px-3 text-[0.8125rem] transition-colors",
                action === group.key
                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                  : "border-border bg-surface text-foreground-muted hover:border-border-interactive hover:text-foreground",
              )}
            >
              {group.label}
            </Link>
          ))}
        </nav>

        {result.items.length === 0 ? (
          <EmptyState
            icon="history"
            title={action ? "No entries for that action" : "No admin activity recorded yet"}
            description="Entries appear as soon as content is created, published or accessed."
          />
        ) : (
          <>
            <DataTable caption={`${result.total} audit entries`}>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Action</Th>
                  <Th>Who</Th>
                  <Th className="w-[40%]">Detail</Th>
                </tr>
              </thead>

              <tbody>
                {result.items.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-muted/50">
                    <Td className="whitespace-nowrap align-top">
                      <time
                        dateTime={entry.occurredAt}
                        className="font-mono text-[0.75rem] text-foreground-muted"
                      >
                        {new Date(entry.occurredAt).toLocaleString("en-GB")}
                      </time>
                    </Td>

                    <Td className="align-top">
                      <ActionBadge action={entry.action} />
                    </Td>

                    <Td className="align-top">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[0.8125rem]">
                          {entry.actorEmail ?? "system"}
                        </span>
                        {entry.actorRole ? (
                          <span className="text-[0.75rem] text-foreground-subtle">
                            {entry.actorRole}
                          </span>
                        ) : null}
                      </div>
                    </Td>

                    <Td className="align-top">
                      <div className="flex flex-col gap-0.5">
                        {entry.entityLabel ? (
                          <code className="text-[0.75rem] text-foreground-muted">
                            {entry.entityType}: {entry.entityLabel}
                          </code>
                        ) : null}
                        {entry.summary ? (
                          <span className="text-[0.8125rem]">{entry.summary}</span>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>

            <Pagination
              currentPage={result.page}
              totalPages={result.totalPages}
              buildHref={(nextPage) => {
                const params = new URLSearchParams();
                if (action) params.set("action", action);
                if (nextPage > 1) params.set("page", String(nextPage));
                const qs = params.toString();
                return `/admin/audit-logs${qs ? `?${qs}` : ""}`;
              }}
              labels={{
                nav: "Audit log pages",
                previous: "Previous",
                next: "Next",
                pageOf: "Page {current} of {total}",
              }}
            />
          </>
        )}
      </AdminPageBody>
    </>
  );
}

/**
 * Colour by severity, not by entity.
 *
 * A denied access attempt and a private-original view are the two entries worth
 * spotting at a glance in a long list, so they get the strongest treatment.
 */
function ActionBadge({ action }: { action: string }) {
  const tone =
    action === "admin.unauthorized" || action === "admin.login_failed"
      ? "danger"
      : action.includes("original_viewed") || action.includes("original_downloaded")
        ? "warning"
        : action.endsWith(".published")
          ? "success"
          : action.endsWith(".deleted")
            ? "danger"
            : action.startsWith("admin.")
              ? "info"
              : "neutral";

  const [entity, verb] = action.split(".");
  const label = `${entity ?? action} ${(verb ?? "").replace(/_/g, " ")}`.trim();

  return (
    <Badge tone={tone} className="whitespace-nowrap capitalize">
      {label}
    </Badge>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
