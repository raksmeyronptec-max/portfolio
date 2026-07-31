"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/**
 * Error boundary for the admin.
 *
 * Why this exists, and why it is not a copy of the public one
 *
 *   There was no boundary under /admin at all. A client error anywhere in the
 *   CMS therefore escaped to the framework's fallback, which replaces the whole
 *   document — so a crash while filling in a long certificate form took every
 *   unsaved field with it and left nothing to report but "it reloaded".
 *
 *   `reset()` re-renders this route segment without a full document reload. That
 *   does not bring back form state — React state is gone once the tree unmounts
 *   — but it does avoid the hard navigation, and it keeps the session and the
 *   surrounding shell intact.
 *
 *   Unlike the public boundary, this one *shows* the digest. That boundary hides
 *   it deliberately, because printing internal identifiers to anonymous visitors
 *   leaks information. The audience here is the single authenticated owner, and
 *   for them the digest is the only thing that makes a production-only crash
 *   findable in the platform logs. Withholding it protects nobody and costs the
 *   one person who could act on it.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin route error", {
      digest: error.digest ?? "(no digest)",
      message: error.message,
    });
  }, [error]);

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-(--radius-lg) bg-danger-subtle text-danger-foreground"
      >
        <Icon name="alertTriangle" size={26} />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-h2 font-semibold">Something in the admin failed</h1>
        <p className="max-w-[52ch] text-body text-foreground-muted">
          Any unsaved changes on this screen are gone — that part cannot be
          recovered. Try again below; if it keeps happening, the reference under
          this message identifies the failure in the server logs.
        </p>
      </div>

      {/*
        Shown, not hidden. This is the owner-only area, and a production-only
        crash is close to undiagnosable without the digest to search for.
      */}
      <p className="rounded-(--radius-md) border border-border bg-surface-muted px-3 py-2 font-mono text-[0.8125rem] text-foreground-muted">
        {error.digest ? `Reference: ${error.digest}` : error.message || "Unknown error"}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset} iconStart="refresh">
          Try again
        </Button>
        <ButtonLink href="/admin" variant="outline">
          Back to the dashboard
        </ButtonLink>
      </div>
    </section>
  );
}
