import Link from "next/link";
import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, Divider } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icon";
import { EmptyState, Notice } from "@/components/ui/states";
import { requireAdminSession } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import {
  getAdminInsights,
  getContentHealth,
  getDashboardSummary,
  getRecentActivity,
  type ContentHealth,
} from "@/lib/data/admin";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Dashboard.
 *
 * Built around one question: what needs my attention right now? The summary cards
 * are the status quo, Content health is the to-do list, and Recent activity is the
 * record. Nothing here is a vanity metric.
 *
 * Every figure comes from a `SECURITY DEFINER` RPC that checks `can_view_admin()`
 * as its first statement, so an unauthorised caller gets an exception rather than
 * an empty dashboard that looks like real data.
 */
export default async function AdminDashboardPage() {
  const session = await requireAdminSession();

  const [summary, health, insights, activity] = await Promise.all([
    getDashboardSummary(),
    getContentHealth(),
    permissions.viewAnalytics(session.role) ? getAdminInsights(30) : null,
    getRecentActivity(10),
  ]);

  if (!summary) {
    return (
      <>
        <AdminPageHeader title="Dashboard" />
        <AdminPageBody>
          <Notice tone="warning" title="Could not load dashboard data">
            <p>
              The database did not return summary data. Check that Supabase is
              running and that the migrations have been applied.
            </p>
          </Notice>
        </AdminPageBody>
      </>
    );
  }

  const healthItems = health ? buildHealthItems(health) : [];
  const urgentCount = healthItems.filter((item) => item.tone === "danger").length;

  return (
    <>
      <AdminPageHeader
        title={`Welcome back${session.displayName ? `, ${session.displayName.split(" ")[0]}` : ""}`}
        description="Operational overview of the portfolio: what is published, what needs attention, and what visitors are doing."
        actions={
          permissions.editContent(session.role) ? (
            <>
              <ButtonLink href="/admin/projects/new" iconStart="plus">
                New project
              </ButtonLink>
              <ButtonLink href="/admin/certificates/new" variant="outline" iconStart="plus">
                New certificate
              </ButtonLink>
            </>
          ) : undefined
        }
      />

      <AdminPageBody className="flex flex-col gap-8">
        {/* ── Summary cards ─────────────────────────────────────────────────── */}
        <section aria-labelledby="summary-heading" className="flex flex-col gap-4">
          <h2 id="summary-heading" className="text-h4 font-semibold">
            At a glance
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon="layers"
              label="Published projects"
              value={summary.projects.published}
              hint={`${summary.projects.draft} draft · ${summary.projects.in_review} in review`}
              href="/admin/projects"
            />
            <StatCard
              icon="award"
              label="Published certificates"
              value={summary.certificates.published}
              hint={`${summary.certificates.draft} draft · ${summary.certificates.awaiting_privacy_review} awaiting privacy review`}
              tone={summary.certificates.awaiting_privacy_review > 0 ? "warning" : undefined}
              href="/admin/certificates"
            />
            <StatCard
              icon="inbox"
              label="Unread messages"
              value={summary.messages.unread}
              hint={`${summary.messages.total} total · ${summary.messages.spam} spam`}
              tone={summary.messages.unread > 0 ? "accent" : undefined}
              href="/admin/messages"
            />
            <StatCard
              icon="download"
              label="Resume downloads"
              value={summary.resume.downloads_total}
              hint={`${summary.resume.downloads_30d} in the last 30 days`}
              href="/admin/resume"
            />
            <StatCard
              icon="eye"
              label="Page views (30 days)"
              value={summary.traffic.page_views_30d}
              hint={`${summary.traffic.page_views_7d} in the last 7 days`}
              href="/admin/analytics"
            />
            <StatCard
              icon="users"
              label="Unique visitors (30 days)"
              value={summary.traffic.unique_visitors_30d}
              hint="Counted from a daily-rotating hash — no cookies"
              href="/admin/analytics"
            />
            <StatCard
              icon="image"
              label="Media assets"
              value={summary.storage.assets}
              hint={`${formatBytes(summary.storage.bytes_total)} total`}
              href="/admin/media"
            />
            <StatCard
              icon="lock"
              label="Private storage"
              value={formatBytes(summary.storage.bytes_private)}
              hint="Certificate originals and archived resumes"
              href="/admin/media?visibility=private"
            />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {/* ── Content health ──────────────────────────────────────────────── */}
          <section aria-labelledby="health-heading" className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id="health-heading" className="text-h4 font-semibold">
                Content health
              </h2>
              {urgentCount > 0 ? (
                <Badge tone="danger">{urgentCount} needing action</Badge>
              ) : (
                <Badge tone="success" icon="check">
                  Nothing blocking
                </Badge>
              )}
            </div>

            {healthItems.length === 0 ? (
              <EmptyState
                icon="checkCircle"
                title="Everything looks healthy"
                description="No missing translations, alt text, SEO descriptions or pending privacy reviews."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {healthItems.map((item) => (
                  <li key={item.key}>
                    <Card>
                      <CardBody className="flex items-start gap-3 p-4">
                        <span
                          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-(--radius-md) ${
                            item.tone === "danger"
                              ? "bg-danger-subtle text-danger-foreground"
                              : item.tone === "warning"
                                ? "bg-warning-subtle text-warning-foreground"
                                : "bg-info-subtle text-info-foreground"
                          }`}
                        >
                          <Icon name={item.icon} size={16} />
                        </span>

                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <p className="text-small font-semibold">
                            {item.label}{" "}
                            <span className="tabular-nums text-foreground-muted">
                              ({item.count})
                            </span>
                          </p>
                          <p className="text-[0.8125rem] text-foreground-muted">
                            {item.description}
                          </p>
                          {item.examples.length > 0 ? (
                            <p className="text-[0.8125rem] text-foreground-subtle">
                              {item.examples.slice(0, 3).join(", ")}
                              {item.count > 3 ? ` +${item.count - 3} more` : ""}
                            </p>
                          ) : null}
                        </div>

                        {item.href ? (
                          <Link
                            href={item.href}
                            className="shrink-0 text-small text-primary underline underline-offset-2"
                          >
                            Fix
                          </Link>
                        ) : null}
                      </CardBody>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Insights + activity ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            {insights ? (
              <Card>
                <CardHeader>
                  <h2 className="text-h4 font-semibold">
                    Insights
                    <span className="ml-2 text-small font-normal text-foreground-muted">
                      last {insights.window_days} days
                    </span>
                  </h2>
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                  <InsightList
                    title="Most viewed projects"
                    empty="No project views recorded yet."
                    items={insights.most_viewed_projects.map((item) => ({
                      label: item.slug,
                      value: item.views,
                    }))}
                  />

                  <Divider />

                  <InsightList
                    title="Most clicked outbound links"
                    empty="No outbound clicks recorded yet."
                    items={insights.most_clicked_outbound.map((item) => ({
                      label: `${item.host} (${item.context})`,
                      value: item.clicks,
                    }))}
                  />

                  <Divider />

                  <InsightList
                    title="Traffic by language"
                    empty="No page views recorded yet."
                    items={Object.entries(insights.traffic_by_locale).map(
                      ([locale, views]) => ({ label: locale, value: views }),
                    )}
                  />

                  <Divider />

                  <div className="flex flex-col gap-1">
                    <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.04em] text-foreground-subtle">
                      Contact conversion
                    </p>
                    <p className="text-small text-foreground-muted">
                      {insights.contact_conversion.submissions} submission
                      {insights.contact_conversion.submissions === 1 ? "" : "s"} from{" "}
                      {insights.contact_conversion.contact_page_views} contact-page
                      view
                      {insights.contact_conversion.contact_page_views === 1 ? "" : "s"}
                      {insights.contact_conversion.contact_page_views > 0
                        ? ` (${Math.round(
                            (insights.contact_conversion.submissions /
                              insights.contact_conversion.contact_page_views) *
                              100,
                          )}%)`
                        : ""}
                    </p>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-h4 font-semibold">Recent activity</h2>
                  <Link
                    href="/admin/audit-logs"
                    className="text-small text-primary underline underline-offset-2"
                  >
                    Full log
                  </Link>
                </div>
              </CardHeader>
              <CardBody>
                {activity.length === 0 ? (
                  <p className="text-small text-foreground-muted">
                    No admin activity recorded yet.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {activity.map((entry) => (
                      <li key={entry.id} className="flex flex-col gap-0.5">
                        <p className="text-small">
                          <span className="font-medium">
                            {formatAction(entry.action)}
                          </span>
                          {entry.entityLabel ? (
                            <span className="text-foreground-muted">
                              {" "}
                              — {entry.entityLabel}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[0.75rem] text-foreground-subtle">
                          {entry.actorEmail ?? "system"} ·{" "}
                          <time dateTime={entry.occurredAt}>
                            {new Date(entry.occurredAt).toLocaleString("en-GB")}
                          </time>
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </AdminPageBody>
    </>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
  href,
}: {
  icon: IconName;
  label: string;
  value: number | string;
  hint?: string;
  tone?: "warning" | "accent";
  href?: string;
}) {
  const body = (
    <Card interactive={Boolean(href)} className="h-full">
      <CardBody className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`flex size-8 items-center justify-center rounded-(--radius-md) ${
              tone === "warning"
                ? "bg-warning-subtle text-warning-foreground"
                : tone === "accent"
                  ? "bg-accent-subtle text-accent-subtle-foreground"
                  : "bg-primary-subtle text-primary-subtle-foreground"
            }`}
          >
            <Icon name={icon} size={16} />
          </span>
          {href ? (
            <Icon name="chevronRight" size={16} className="text-foreground-subtle" />
          ) : null}
        </div>

        <p className="text-h2 font-bold tabular-nums">{value}</p>
        <p className="text-[0.8125rem] font-medium">{label}</p>
        {hint ? (
          <p className="text-[0.75rem] text-foreground-subtle">{hint}</p>
        ) : null}
      </CardBody>
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full rounded-(--radius-lg)">
      {body}
    </Link>
  ) : (
    body
  );
}

function InsightList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.04em] text-foreground-subtle">
        {title}
      </p>

      {items.length === 0 ? (
        <p className="text-small text-foreground-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.slice(0, 5).map((item) => (
            <li
              key={item.label}
              className="flex items-baseline justify-between gap-3 text-small"
            >
              <span className="truncate">{item.label}</span>
              <span className="tabular-nums text-foreground-muted">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type HealthItem = {
  key: string;
  label: string;
  description: string;
  count: number;
  tone: "danger" | "warning" | "info";
  icon: IconName;
  href?: string;
  examples: string[];
};

/**
 * Turn the raw health payload into a prioritised list.
 *
 * `danger` is reserved for things that block publication or expose a risk;
 * everything else is `warning` or `info`. Empty categories are dropped so the panel
 * only ever shows real work.
 */
function buildHealthItems(health: ContentHealth): HealthItem[] {
  const items: HealthItem[] = [
    {
      key: "privacy",
      label: "Certificates awaiting privacy review",
      description:
        "These cannot be published until the redaction checklist is completed. The database enforces this.",
      count: health.certificates_awaiting_privacy_review.length,
      tone: "danger",
      icon: "shield",
      href: "/admin/certificates?privacy=pending",
      examples: health.certificates_awaiting_privacy_review.map((item) => item.slug),
    },
    {
      key: "review",
      label: "Content marked “needs review”",
      description:
        "Migrated from the old site with facts that could not be verified. Confirm or correct before publishing.",
      count: health.content_needing_review.length,
      tone: "danger",
      icon: "alertTriangle",
      href: "/admin/projects",
      examples: health.content_needing_review.map((item) => `${item.entity_type}:${item.slug}`),
    },
    {
      key: "alt",
      label: "Public images missing alt text",
      description: "Every public image needs alt text in both English and Khmer.",
      count: health.media_missing_alt_text.length,
      tone: "warning",
      icon: "image",
      href: "/admin/media",
      examples: health.media_missing_alt_text.map((item) => item.filename),
    },
    {
      key: "translations",
      label: "Missing translations",
      description: "Content that exists in only one language.",
      count: health.missing_translations.length,
      tone: "warning",
      icon: "languages",
      examples: health.missing_translations.map(
        (item) => `${item.slug} (missing ${item.has_en ? "km" : "en"})`,
      ),
    },
    {
      key: "case-study",
      label: "Projects without a case study",
      description:
        "Overview, problem and solution are all required for the page to be worth publishing.",
      count: health.projects_without_case_study.length,
      tone: "warning",
      icon: "fileText",
      href: "/admin/projects",
      examples: health.projects_without_case_study.map((item) => item.slug),
    },
    {
      key: "seo",
      label: "Published pages missing an SEO description",
      description: "Without one, search engines invent their own snippet.",
      count: health.missing_seo_description.length,
      tone: "warning",
      icon: "globe",
      href: "/admin/seo",
      examples: health.missing_seo_description.map(
        (item) => `${item.slug} (${item.locale})`,
      ),
    },
    {
      key: "verification",
      label: "Published certificates with no verification route",
      description: "Neither a verification URL nor a credential ID is recorded.",
      count: health.certificates_missing_verification.length,
      tone: "info",
      icon: "badge",
      href: "/admin/certificates",
      examples: health.certificates_missing_verification.map((item) => item.slug),
    },
    {
      key: "unverified-metrics",
      label: "Unverified project metrics",
      description:
        "These are hidden from the public site until a source is recorded and they are marked verified.",
      count: health.unverified_metrics.length,
      tone: "info",
      icon: "barChart",
      examples: health.unverified_metrics.map(
        (item) => `${item.project_slug}: ${item.label}`,
      ),
    },
    {
      key: "stale",
      label: "Drafts untouched for 30 days",
      description: "Either finish them or archive them.",
      count: health.stale_drafts.length,
      tone: "info",
      icon: "clock",
      examples: health.stale_drafts.map((item) => item.slug),
    },
    {
      key: "oversized",
      label: "Oversized public images",
      description: "Public images above 1 MB slow down the pages that use them.",
      count: health.oversized_media.length,
      tone: "info",
      icon: "image",
      href: "/admin/media",
      examples: health.oversized_media.map(
        (item) => `${item.filename} (${formatBytes(item.bytes)})`,
      ),
    },
  ];

  const order = { danger: 0, warning: 1, info: 2 } as const;

  return items
    .filter((item) => item.count > 0)
    .sort((a, b) => order[a.tone] - order[b.tone] || b.count - a.count);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** "project.published" → "Project published" */
function formatAction(action: string): string {
  const [entity, verb] = action.split(".");
  if (!entity || !verb) return action;
  const readable = `${entity} ${verb.replace(/_/g, " ")}`;
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}
