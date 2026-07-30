import Link from "next/link";
import type { ReactNode } from "react";

import { AdminNav } from "./admin-nav";
import { AdminUserMenu } from "./admin-user-menu";
import { Badge } from "@/components/ui/primitives";
import { roleLabels, type AdminRole } from "@/lib/auth/roles";
import type { AdminSession } from "@/lib/auth/guards";

/**
 * Admin application shell.
 *
 * Uses the same design tokens as the public site — same palette, same focus ring,
 * same type scale — but a management layout: a persistent sidebar on desktop, a
 * denser rhythm, and information over atmosphere. The brief asked for the brand
 * system adapted to the workflow rather than a generic dashboard template dropped
 * in, so nothing here is a second visual language.
 */
export function AdminShell({
  session,
  unreadMessages,
  pendingPrivacyReviews,
  children,
}: {
  session: AdminSession;
  unreadMessages: number;
  pendingPrivacyReviews: number;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div className="lg:w-64 lg:shrink-0 lg:border-r lg:border-border lg:bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:border-b-0 lg:px-5 lg:py-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-[--radius-md] bg-primary text-primary-foreground"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 5H7l5.5 7L7 19h10" />
              </svg>
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-small font-semibold">Portfolio CMS</span>
              <span className="text-[0.6875rem] uppercase tracking-[0.06em] text-foreground-subtle">
                Ron Raksmey
              </span>
            </span>
          </Link>

          <div className="lg:hidden">
            <AdminUserMenu session={session} />
          </div>
        </div>

        <AdminNav
          role={session.role}
          unreadMessages={unreadMessages}
          pendingPrivacyReviews={pendingPrivacyReviews}
        />
      </div>

      {/* ── Main column ────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden items-center justify-between gap-4 border-b border-border bg-surface px-6 py-3 lg:flex">
          <div className="flex items-center gap-3">
            <RoleBadge role={session.role} />
            {/*
              A viewer sees this permanently, so a failed edit is never a surprise:
              the reason is on screen before they try.
            */}
            {session.role === "viewer" ? (
              <p className="text-[0.8125rem] text-foreground-muted">
                Read-only access — you can browse everything but cannot make changes.
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/en"
              target="_blank"
              rel="noopener noreferrer"
              className="text-small text-foreground-muted underline decoration-transparent underline-offset-2 transition-colors hover:text-foreground hover:decoration-current"
            >
              View public site
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
            <AdminUserMenu session={session} />
          </div>
        </header>

        <main id="admin-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: AdminRole }) {
  const tone = role === "owner" ? "primary" : role === "editor" ? "secondary" : "neutral";

  return (
    <Badge tone={tone} icon={role === "owner" ? "shield" : role === "editor" ? "edit" : "eye"}>
      {roleLabels[role].name}
    </Badge>
  );
}

/**
 * Standard page header for admin routes.
 *
 * Every admin page uses this so the heading level, the description slot and the
 * action alignment are identical throughout — the kind of consistency that stops a
 * management UI feeling assembled from parts.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-surface">
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        {breadcrumb}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-h2 font-bold">{title}</h1>
            {description ? (
              <p className="max-w-[70ch] text-small text-foreground-muted">
                {description}
              </p>
            ) : null}
          </div>

          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function AdminPageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-4 py-6 sm:px-6 lg:px-8 ${className ?? ""}`}>{children}</div>
  );
}
