import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/log";

/**
 * Sign-out.
 *
 * The session is read and logged *before* it is destroyed — afterwards there is no
 * authenticated actor left to attribute the event to, which is how logout entries
 * end up anonymous in naive implementations.
 *
 * `signOut()` is also called server-side so the auth cookies are cleared by a
 * `Set-Cookie` on this response. Relying only on the client call would leave a
 * valid cookie if the browser navigated away mid-flight.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getAdminSession();

  if (session) {
    await writeAuditLog({
      action: "admin.logout",
      actor: session,
      summary: "Signed out.",
    });
  }

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Even if the auth call fails, the client also clears its own session.
  }

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
