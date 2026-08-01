import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminBadgeCounts } from "@/lib/data/admin";

/**
 * Authenticated admin layout.
 *
 * A route group `(authed)` rather than a path segment, so every page inside it is
 * gated without changing any URL: `/admin/projects` still lives at
 * `/admin/projects`.
 *
 * `requireAdminSession()` runs here on every request. Middleware already redirects
 * anonymous traffic away from `/admin`, but middleware is an optimisation, not the
 * boundary — it can be bypassed and it does not know about roles. This check
 * validates the token with the auth server and resolves the role from the database,
 * and RLS enforces the same rules a third time on every query.
 *
 * `force-dynamic` because the page depends on the session; it must never be
 * prerendered or served from a shared cache.
 */
export const dynamic = "force-dynamic";

export default async function AuthedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireAdminSession();
  const badges = await getAdminBadgeCounts();

  return (
    <AdminShell
      session={session}
      unreadMessages={badges.unreadMessages}
      pendingPrivacyReviews={badges.pendingPrivacyReviews}
      pendingJourneyReviews={badges.pendingJourneyReviews}
      pendingPublicationReviews={badges.pendingPublicationReviews}
    >
      {children}
    </AdminShell>
  );
}
