import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { isAdminRole, permissions, type AdminRole } from "./roles";

export type AdminSession = {
  userId: string;
  email: string;
  role: AdminRole;
  displayName: string | null;
};

/**
 * Resolve the caller's admin session, or `null`.
 *
 * Two deliberate details:
 *
 *  - `getUser()` is used rather than `getSession()`. `getSession()` only decodes
 *    the cookie, which a client controls; `getUser()` validates the token with
 *    the auth server. Authorisation must not be based on a self-asserted cookie.
 *
 *  - The role is looked up with the service-role client. `admin_roles` is
 *    readable by its own user under RLS, so the anon-key client would also work,
 *    but reading it privileged means a broken policy cannot silently downgrade
 *    someone to "no access" and lock the owner out of their own dashboard.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) return null;

  const admin = createSupabaseAdminClient();

  const { data: roleRow } = await admin
    .from("admin_roles")
    .select("role, revoked_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();

  if (!roleRow || !isAdminRole(roleRow.role)) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email,
    role: roleRow.role,
    displayName: profile?.display_name ?? null,
  };
}

/**
 * Require an admin session, redirecting to the sign-in page otherwise.
 *
 * `nextPath` is passed through so sign-in can return the user to where they
 * were, and is validated as an internal path to avoid an open redirect.
 */
export async function requireAdminSession(nextPath?: string): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session) return session;

  const target = safeInternalPath(nextPath);
  redirect(
    target ? `/admin/login?next=${encodeURIComponent(target)}` : "/admin/login",
  );
}

/**
 * Require a specific permission. Renders the "not permitted" route rather than
 * pretending the page does not exist, because the user IS authenticated — they
 * simply lack the role, and saying so is more useful than a 404.
 */
export async function requirePermission(
  permission: keyof typeof permissions,
  nextPath?: string,
): Promise<AdminSession> {
  const session = await requireAdminSession(nextPath);

  if (!permissions[permission](session.role)) {
    redirect(`/admin/not-permitted?required=${encodeURIComponent(permission)}`);
  }

  return session;
}

/**
 * Non-redirecting permission check, for Server Actions that need to return a
 * typed error instead of navigating.
 */
export async function checkPermission(
  permission: keyof typeof permissions,
): Promise<
  | { ok: true; session: AdminSession }
  | { ok: false; reason: "unauthenticated" | "forbidden" }
> {
  const session = await getAdminSession();
  if (!session) return { ok: false, reason: "unauthenticated" };
  if (!permissions[permission](session.role)) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, session };
}

/**
 * Accept only same-origin, absolute-path redirect targets.
 *
 * Rejects protocol-relative (`//evil.com`), absolute URLs, and anything outside
 * `/admin`, so the `next` parameter cannot be turned into an open redirect or
 * used to bounce a freshly authenticated admin onto a public page.
 */
export function safeInternalPath(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//")) return null;
  if (candidate.includes("://")) return null;
  if (candidate.includes("\\")) return null;
  if (!candidate.startsWith("/admin")) return null;
  if (candidate.startsWith("/admin/login")) return null;
  return candidate;
}
