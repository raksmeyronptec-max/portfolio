"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AdminSession } from "@/lib/auth/guards";

/**
 * Signed-in identity and sign-out.
 *
 * Sign-out clears the Supabase session client-side and then calls the server
 * route so the audit entry is written by the server rather than trusted from the
 * browser. `router.refresh()` afterwards discards the cached authenticated render
 * — without it, the previous page can remain visible from the client router cache
 * after the session is gone.
 */
export function AdminUserMenu({ session }: { session: AdminSession }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);

    try {
      // Record the logout server-side first: after the session is cleared there
      // is no longer an authenticated actor to attribute it to.
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // A logging failure must not prevent signing out.
    }

    try {
      await getSupabaseBrowserClient().auth.signOut();
    } catch {
      // Even if this fails, the cookie is cleared by the server route.
    }

    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle
        labels={{
          toggle: "Switch colour theme",
          toLight: "Switch to light theme",
          toDark: "Switch to dark theme",
        }}
      />

      <div className="hidden flex-col text-right leading-tight sm:flex">
        <span className="text-[0.8125rem] font-medium">
          {session.displayName ?? session.email}
        </span>
        {session.displayName ? (
          <span className="text-[0.75rem] text-foreground-subtle">{session.email}</span>
        ) : null}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={signOut}
        loading={signingOut}
        className="min-h-10"
      >
        <span className="flex items-center gap-1.5">
          <Icon name="logOut" size={16} />
          Sign out
        </span>
      </Button>
    </div>
  );
}
