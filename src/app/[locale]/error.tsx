"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getDictionary } from "@/i18n/dictionary";
import { defaultLocale, localePath } from "@/i18n/config";

/**
 * Error boundary for the public site.
 *
 * Shows recovery options and nothing else. The `error.digest` is deliberately not
 * displayed: it is a server-side correlation id, and printing internal identifiers
 * or stack traces to visitors is exactly the "error messages that expose internal
 * details" this build is meant to avoid. The digest is logged for the operator
 * instead.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = getDictionary(defaultLocale);

  useEffect(() => {
    // Server-side logs already contain the full error; this records the digest so
    // a report from a user can be correlated with it.
    console.error("Public route error", error.digest ?? "(no digest)");
  }, [error]);

  return (
    <div className="container-prose flex min-h-[60vh] flex-col items-center justify-center gap-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-danger-subtle text-danger-foreground"
      >
        <Icon name="alertTriangle" size={26} />
      </span>

      <div className="flex flex-col gap-3">
        <h1 className="text-h2 font-bold">{t.errors.genericTitle}</h1>
        <p className="text-body-lg text-foreground-muted">{t.errors.genericBody}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="primary" iconStart="refresh" onClick={reset}>
          {t.common.retry}
        </Button>
        <ButtonLink href={localePath(defaultLocale)} variant="outline">
          {t.errors.notFoundHome}
        </ButtonLink>
      </div>
    </div>
  );
}
