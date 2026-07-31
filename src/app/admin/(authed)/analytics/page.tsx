import Link from "next/link";
import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Notice } from "@/components/ui/states";
import { requirePermission } from "@/lib/auth/guards";
import { getAdminInsights, getDashboardSummary } from "@/lib/data/admin";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const WINDOWS = [7, 30, 90, 365] as const;

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("viewAnalytics", "/admin/analytics");
  const query = await searchParams;

  const daysParam = Number.parseInt(single(query.days) ?? "", 10);
  const days = (WINDOWS as readonly number[]).includes(daysParam) ? daysParam : 30;

  const [insights, summary] = await Promise.all([
    getAdminInsights(days),
    getDashboardSummary(),
  ]);

  const hasData =
    insights !== null &&
    (insights.daily_page_views.length > 0 ||
      insights.most_viewed_projects.length > 0 ||
      Object.keys(insights.traffic_by_locale).length > 0);

  return (
    <>
      <AdminPageHeader
        title="Analytics"
        description="First-party, cookieless analytics. A visitor is represented by a salted hash of IP + user-agent that rotates daily, so unique counts are possible but a visitor cannot be followed across days."
      />

      <AdminPageBody className="flex flex-col gap-6">
        <Notice tone="info" icon="shield">
          <p>
            No cookies, no third-party scripts, no raw IP addresses, and{" "}
            <code>Do Not Track</code> / <code>Sec-GPC</code> are honoured on both the
            client and the server. Bot traffic is discarded rather than counted.
          </p>
        </Notice>

        <nav aria-label="Reporting period" className="flex flex-wrap gap-2">
          {WINDOWS.map((window) => (
            <Link
              key={window}
              href={`/admin/analytics?days=${window}`}
              aria-current={days === window ? "true" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-(--radius-full) border px-3.5 text-[0.8125rem] transition-colors",
                days === window
                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                  : "border-border bg-surface text-foreground-muted hover:border-border-interactive hover:text-foreground",
              )}
            >
              Last {window} days
            </Link>
          ))}
        </nav>

        {!insights || !hasData ? (
          <EmptyState
            icon="barChart"
            title="No analytics data yet"
            description="Events are recorded as visitors browse the public site. Nothing is backfilled, so this fills up from the moment the site goes live."
          />
        ) : (
          <>
            {/* ── Headline numbers ─────────────────────────────────────────── */}
            {summary ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Page views"
                  value={summary.traffic.page_views_30d}
                  hint="last 30 days"
                />
                <Stat
                  label="Unique visitors"
                  value={summary.traffic.unique_visitors_30d}
                  hint="last 30 days, privacy-safe"
                />
                <Stat
                  label="Resume downloads"
                  value={summary.resume.downloads_30d}
                  hint="last 30 days"
                />
                <Stat
                  label="Contact submissions"
                  value={insights.contact_conversion.submissions}
                  hint={`last ${days} days`}
                />
              </div>
            ) : null}

            {/* ── Daily trend ──────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <h2 className="text-h4 font-semibold">Daily page views</h2>
              </CardHeader>
              <CardBody>
                <DailyChart data={insights.daily_page_views} />
              </CardBody>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <RankedList
                title="Most viewed projects"
                icon="layers"
                items={insights.most_viewed_projects.map((item) => ({
                  label: item.slug,
                  value: item.views,
                  href: `/en/projects/${item.slug}`,
                }))}
                empty="No project pages have been viewed yet."
              />

              <RankedList
                title="Most viewed certificates"
                icon="award"
                items={insights.most_viewed_certificates.map((item) => ({
                  label: item.slug,
                  value: item.views,
                  href: `/en/certificates/${item.slug}`,
                }))}
                empty="No certificate pages have been viewed yet."
              />

              <RankedList
                title="Most clicked outbound links"
                icon="externalLink"
                items={insights.most_clicked_outbound.map((item) => ({
                  label: `${item.host} · ${item.context.replace(/_/g, " ")}`,
                  value: item.clicks,
                }))}
                empty="No outbound clicks recorded yet."
              />

              <RankedList
                title="Top referrers"
                icon="globe"
                items={insights.top_referrers.map((item) => ({
                  label: item.host,
                  value: item.views,
                }))}
                empty="No external referrers yet. Direct visits are not counted here."
              />

              <RankedList
                title="Traffic by language"
                icon="languages"
                items={Object.entries(insights.traffic_by_locale).map(
                  ([locale, views]) => ({ label: locale.toUpperCase(), value: views }),
                )}
                empty="No page views yet."
              />

              <RankedList
                title="Traffic by device"
                icon="users"
                items={Object.entries(insights.traffic_by_device).map(
                  ([device, views]) => ({ label: device, value: views }),
                )}
                empty="No page views yet."
              />
            </div>

            {/* ── Contact conversion ───────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <h2 className="text-h4 font-semibold">Contact conversion</h2>
              </CardHeader>
              <CardBody className="flex flex-col gap-2">
                <p className="text-body">
                  <strong className="tabular-nums">
                    {insights.contact_conversion.submissions}
                  </strong>{" "}
                  submission
                  {insights.contact_conversion.submissions === 1 ? "" : "s"} from{" "}
                  <strong className="tabular-nums">
                    {insights.contact_conversion.contact_page_views}
                  </strong>{" "}
                  contact-page view
                  {insights.contact_conversion.contact_page_views === 1 ? "" : "s"}
                  {insights.contact_conversion.contact_page_views > 0 ? (
                    <>
                      {" "}
                      —{" "}
                      <strong>
                        {Math.round(
                          (insights.contact_conversion.submissions /
                            insights.contact_conversion.contact_page_views) *
                            100,
                        )}
                        %
                      </strong>
                    </>
                  ) : null}
                </p>
                <p className="text-[0.8125rem] text-foreground-muted">
                  Counted over the last {insights.window_days} days.
                </p>
              </CardBody>
            </Card>

            {insights.recent_resume_downloads.length > 0 ? (
              <Card>
                <CardHeader>
                  <h2 className="text-h4 font-semibold">Recent resume downloads</h2>
                </CardHeader>
                <CardBody>
                  <ol className="flex flex-col gap-2">
                    {insights.recent_resume_downloads.map((download, index) => (
                      <li
                        key={`${download.at}-${index}`}
                        className="flex flex-wrap items-baseline justify-between gap-2 text-small"
                      >
                        <span>
                          {download.label ?? "Resume"}
                          {download.locale ? ` (${download.locale.toUpperCase()})` : ""}
                        </span>
                        <time
                          dateTime={download.at}
                          className="font-mono text-[0.75rem] text-foreground-muted"
                        >
                          {new Date(download.at).toLocaleString("en-GB")}
                        </time>
                      </li>
                    ))}
                  </ol>
                </CardBody>
              </Card>
            ) : null}
          </>
        )}
      </AdminPageBody>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-1 p-4">
        <p className="text-h2 font-bold tabular-nums text-primary">{value}</p>
        <p className="text-small font-medium">{label}</p>
        {hint ? (
          <p className="text-[0.75rem] text-foreground-subtle">{hint}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

/**
 * Sparkline-style bar chart, rendered as a definition list.
 *
 * Deliberately not a charting library: this is ~40 bars of a single series, and
 * shipping a chart bundle to render it would cost more than the page it lives on.
 * The bars are `aria-hidden` and the real values are exposed as a `<dl>`, so screen
 * readers get the numbers rather than a decorative graphic.
 */
function DailyChart({ data }: { data: Array<{ day: string; views: number }> }) {
  if (data.length === 0) {
    return <p className="text-small text-foreground-muted">No views in this period.</p>;
  }

  const max = Math.max(...data.map((point) => point.views), 1);

  return (
    <div className="flex flex-col gap-3">
      <div
        aria-hidden="true"
        className="flex h-32 items-end gap-1 overflow-hidden"
      >
        {data.map((point) => (
          <span
            key={point.day}
            title={`${point.day}: ${point.views}`}
            style={{ height: `${Math.max((point.views / max) * 100, 2)}%` }}
            className="min-w-1 flex-1 rounded-t-[2px] bg-primary/70"
          />
        ))}
      </div>

      <details className="text-small">
        <summary className="cursor-pointer text-foreground-muted">
          View the numbers ({data.length} day{data.length === 1 ? "" : "s"})
        </summary>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((point) => (
            <div key={point.day} className="flex justify-between gap-2">
              <dt className="text-foreground-muted">{point.day}</dt>
              <dd className="tabular-nums">{point.views}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

function RankedList({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: "layers" | "award" | "externalLink" | "globe" | "languages" | "users";
  items: Array<{ label: string; value: number; href?: string }>;
  empty: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-h4 font-semibold">
          <Icon name={icon} size={17} className="text-foreground-muted" />
          {title}
        </h2>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <p className="text-small text-foreground-muted">{empty}</p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {items.map((item) => (
              <li key={item.label} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-small">
                  <span className="truncate">
                    {item.href ? (
                      <Link
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-transparent underline-offset-2 hover:decoration-current"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      item.label
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-foreground-muted">
                    {item.value}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className="h-1 rounded-full bg-primary/60"
                  style={{ width: `${Math.max((item.value / max) * 100, 3)}%` }}
                />
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
