import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { Card, CardBody } from "@/components/ui/primitives";
import { Notice } from "@/components/ui/states";
import { getAdminSession, safeInternalPath } from "@/lib/auth/guards";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Sign in",
  // `robots` is inherited from the admin root layout, which is stricter
  // (adds nocache and googleBot noimageindex). Re-declaring it here replaced that
  // value with a weaker one instead of adding to it.
};

// Never prerendered and never cached: it depends on session state.
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;

  // Already signed in with a real role? Skip the form.
  const session = await getAdminSession();
  if (session) {
    const next = safeInternalPath(single(query.next));
    redirect(next ?? "/admin");
  }

  /*
   * `next` is validated against an allowlist shape before it is ever rendered or
   * used: same-origin, absolute path, inside /admin, and not the login page
   * itself. Without that, `?next=https://evil.example` turns the login form into
   * an open redirect that inherits the trust of this domain.
   */
  const next = safeInternalPath(single(query.next));
  const reason = single(query.reason);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-[--radius-lg] bg-primary text-primary-foreground"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 5H7l5.5 7L7 19h10" />
            </svg>
          </span>
          <div>
            <h1 className="text-h2 font-bold">Portfolio admin</h1>
            <p className="mt-1 text-small text-foreground-muted">
              Sign in to manage projects, certificates and site content.
            </p>
          </div>
        </div>

        <Card>
          <CardBody className="flex flex-col gap-5">
            {!isSupabaseConfigured() ? (
              <Notice tone="warning" title="Supabase is not configured">
                <p>
                  Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                  <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then reload. See{" "}
                  <code>.env.example</code>.
                </p>
              </Notice>
            ) : (
              <>
                {reason === "expired" ? (
                  <Notice tone="info" title="Session expired">
                    <p>Please sign in again to continue.</p>
                  </Notice>
                ) : null}

                {reason === "no_role" ? (
                  <Notice tone="warning" title="No admin access">
                    <p>
                      That account is valid but has no admin role assigned, so there
                      is nothing for it to manage. Ask the site owner to grant one.
                    </p>
                  </Notice>
                ) : null}

                <LoginForm nextPath={next} />
              </>
            )}
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-[0.8125rem] text-foreground-subtle">
          Accounts are created by the site owner. There is no public sign-up.
        </p>
      </div>
    </div>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
