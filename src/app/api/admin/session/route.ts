import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit/log";
import { isAdminRole } from "@/lib/auth/roles";

/**
 * Post-sign-in verification.
 *
 * The browser has just obtained a Supabase session. This endpoint decides whether
 * that session means anything:
 *
 *  1. Validates the token with the auth server via `getUser()` — not `getSession()`,
 *     which only decodes a client-controlled cookie.
 *  2. Looks up the active `admin_roles` row. No row means no access, regardless of
 *     how valid the credentials were.
 *  3. Records the login (or the rejected attempt) in the audit log, attributed
 *     server-side so it cannot be forged.
 *  4. Stamps `last_login_at` on the profile.
 *
 * Doing this server-side is what keeps "is this person an admin?" out of the
 * browser's hands entirely.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) {
      await writeAuditLog({
        action: "admin.login_failed",
        actor: null,
        summary: "Sign-in attempt with no valid session.",
      });

      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: roleRow } = await admin
      .from("admin_roles")
      .select("role, revoked_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .maybeSingle();

    if (!roleRow || !isAdminRole(roleRow.role)) {
      // A real account with no admin role. Logged as an unauthorised attempt,
      // because it is exactly the event worth noticing if it repeats.
      await writeAuditLog({
        action: "admin.unauthorized",
        actor: null,
        entityType: "user",
        entityId: user.id,
        summary: "Authenticated account without an admin role attempted to sign in.",
      });

      return NextResponse.json(
        { ok: false, reason: "no_role" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Keep the profile row in step with auth.users, creating it on first sign-in so
    // a manually created account does not need a second manual step.
    await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email,
          last_login_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select("id");

    await writeAuditLog({
      action: "admin.login",
      actor: { userId: user.id, email: user.email, role: roleRow.role },
      summary: `Signed in as ${roleRow.role}.`,
    });

    return NextResponse.json(
      { ok: true, role: roleRow.role },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, reason: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
