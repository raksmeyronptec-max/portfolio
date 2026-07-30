import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { PermissionDeniedState } from "@/components/ui/states";
import { getAdminSession } from "@/lib/auth/guards";
import { roleLabels } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Not permitted" };
export const dynamic = "force-dynamic";

/**
 * Permission-denied page.
 *
 * Deliberately not a 404. The user IS authenticated and the route DOES exist —
 * they simply lack the role. Pretending the page is missing would be misleading and
 * would send them looking for a broken link instead of asking for access.
 *
 * The message names the role they have and what it can do, so the next step is
 * obvious.
 */
export default async function NotPermittedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, query] = await Promise.all([getAdminSession(), searchParams]);

  const required = single(query.required);
  const roleInfo = session ? roleLabels[session.role] : null;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <PermissionDeniedState
          title="You do not have permission for this"
          description={
            <>
              {roleInfo ? (
                <>
                  Your role is <strong>{roleInfo.name}</strong>. {roleInfo.description}
                </>
              ) : (
                "Your account does not have an admin role assigned."
              )}
              {required ? (
                <>
                  {" "}
                  This page requires the <code>{required}</code> permission.
                </>
              ) : null}
            </>
          }
          actions={
            <>
              <ButtonLink href="/admin" variant="primary" iconStart="arrowLeft">
                Back to dashboard
              </ButtonLink>
              <ButtonLink href="/en" variant="outline">
                View public site
              </ButtonLink>
            </>
          }
        />
      </div>
    </div>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
