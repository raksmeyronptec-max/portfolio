"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/button";
import { permissions, type AdminRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils/cn";

type NavEntry = {
  href: string;
  label: string;
  icon: IconName;
  /** Permission required to see this entry. */
  permission?: keyof typeof permissions;
  /** Live count badge. */
  badge?: number;
};

type NavGroup = { label: string; entries: NavEntry[] };

/**
 * Admin navigation.
 *
 * Entries are filtered by role, but that filtering is *presentation only* — every
 * route re-checks permission server-side and RLS enforces it again at the
 * database. Hiding a link is a courtesy, never the control.
 */
export function AdminNav({
  role,
  unreadMessages,
  pendingPrivacyReviews,
  pendingJourneyReviews = 0,
  pendingPublicationReviews = 0,
}: {
  role: AdminRole;
  unreadMessages: number;
  pendingPrivacyReviews: number;
  /** Journey media still awaiting a privacy decision. */
  pendingJourneyReviews?: number;
  /** Publications still awaiting a privacy decision. */
  pendingPublicationReviews?: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const groups: NavGroup[] = [
    {
      label: "Overview",
      entries: [{ href: "/admin", label: "Dashboard", icon: "layoutDashboard" }],
    },
    {
      label: "Content",
      entries: [
        { href: "/admin/projects", label: "Projects", icon: "layers" },
        {
          href: "/admin/certificates",
          label: "Certificates",
          icon: "award",
          badge: pendingPrivacyReviews,
        },
        { href: "/admin/education", label: "Education", icon: "graduation" },
        { href: "/admin/experience", label: "Experience", icon: "briefcase" },
        {
          href: "/admin/journey",
          label: "Journey",
          icon: "mapPin",
          // The badge counts media still waiting on a privacy decision, which is
          // the only journey work that blocks publication and the only queue
          // worth interrupting the owner about.
          badge: pendingJourneyReviews,
        },
        {
          href: "/admin/publications",
          label: "Publications",
          icon: "book",
          // Books awaiting a privacy decision. Same rule as the journey badge:
          // the only queue that blocks publication is the only one worth
          // interrupting the owner about.
          badge: pendingPublicationReviews,
        },
        { href: "/admin/skills", label: "Capabilities", icon: "target" },
        { href: "/admin/testimonials", label: "References", icon: "users" },
      ],
    },
    {
      label: "Assets",
      entries: [
        { href: "/admin/media", label: "Media library", icon: "image" },
        { href: "/admin/resume", label: "Resume versions", icon: "fileText" },
      ],
    },
    {
      label: "Inbox",
      entries: [
        {
          href: "/admin/messages",
          label: "Messages",
          icon: "inbox",
          badge: unreadMessages,
          permission: "viewMessages",
        },
      ],
    },
    {
      label: "Insight",
      entries: [
        {
          href: "/admin/analytics",
          label: "Analytics",
          icon: "barChart",
          permission: "viewAnalytics",
        },
        {
          href: "/admin/audit-logs",
          label: "Audit log",
          icon: "history",
          permission: "viewAuditLogs",
        },
      ],
    },
    {
      label: "Configuration",
      entries: [
        {
          href: "/admin/profile",
          label: "Profile",
          icon: "user",
          permission: "manageSettings",
        },
        { href: "/admin/seo", label: "SEO", icon: "globe" },
        {
          href: "/admin/settings",
          label: "Settings",
          icon: "settings",
          permission: "manageSettings",
        },
      ],
    },
  ];

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter(
        (entry) => !entry.permission || permissions[entry.permission](role),
      ),
    }))
    .filter((group) => group.entries.length > 0);

  return (
    <>
      {/* ── Mobile toggle ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="admin-nav-list"
          className="inline-flex min-h-11 items-center gap-2 text-small font-medium"
        >
          <Icon name={mobileOpen ? "close" : "menu"} size={18} />
          Menu
        </button>

        {unreadMessages > 0 ? (
          <span className="rounded-(--radius-full) bg-accent px-2 py-0.5 text-[0.75rem] font-semibold text-accent-foreground">
            {unreadMessages} unread
          </span>
        ) : null}
      </div>

      <nav
        id="admin-nav-list"
        aria-label="Admin sections"
        className={cn(
          "border-b border-border bg-surface lg:block lg:border-b-0",
          mobileOpen ? "block" : "hidden",
        )}
      >
        <div className="flex flex-col gap-5 px-3 py-4 lg:px-3">
          {visibleGroups.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <p className="px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-foreground-subtle">
                {group.label}
              </p>

              <ul className="flex flex-col gap-0.5">
                {group.entries.map((entry) => {
                  // Exact match for the dashboard, subtree match for the rest, so
                  // /admin/projects/new still highlights Projects.
                  const active =
                    entry.href === "/admin"
                      ? pathname === "/admin"
                      : pathname === entry.href || pathname.startsWith(`${entry.href}/`);

                  return (
                    <li key={entry.href}>
                      <Link
                        href={entry.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex min-h-10 items-center gap-2.5 rounded-(--radius-md) px-2.5 text-small transition-colors",
                          active
                            ? "bg-primary-subtle font-semibold text-primary-subtle-foreground"
                            : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                        )}
                      >
                        <Icon name={entry.icon} size={17} />
                        <span className="flex-1">{entry.label}</span>

                        {entry.badge && entry.badge > 0 ? (
                          <span className="rounded-(--radius-full) bg-accent px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-accent-foreground">
                            {entry.badge}
                            <span className="sr-only"> needing attention</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}

/** Small helper so pages can render a consistent back link. */
export function AdminBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-small text-foreground-muted underline decoration-transparent underline-offset-2 transition-colors hover:text-foreground hover:decoration-current"
    >
      <Icon name="arrowLeft" size={15} />
      {label}
    </Link>
  );
}

export { IconButton };
