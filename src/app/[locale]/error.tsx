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
    /*
     * Ink-scoped, for the same reason as not-found.tsx: the site header is
     * transparent and ink-scoped until the visitor scrolls, so a light page at
     * the top of the document leaves the header's own controls light-on-light.
     * Every public entry point opens on ink.
     */
    <section
      data-scheme="ink"
      className="decorated flex flex-1 flex-col bg-background text-foreground"
      style={{ marginTop: "calc(-1 * var(--header-height))" }}
    >
      <div
        aria-hidden="true"
        className="glow"
        style={{ "--glow-x": "50%", "--glow-y": "22%", "--glow-alpha": "0.14" } as object}
      />

      <div
        className="container-prose flex flex-1 flex-col items-center justify-center gap-7 pb-24 text-center"
        style={{ paddingTop: "calc(var(--header-height) + clamp(3rem, 8vw, 6rem))" }}
      >
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-(--radius-lg) bg-danger-subtle text-danger-foreground"
        >
          <Icon name="alertTriangle" size={28} />
        </span>

        <div className="flex flex-col gap-3">
          <h1 className="text-h2">{t.errors.genericTitle}</h1>
          <p className="text-body-lg text-foreground-muted">{t.errors.genericBody}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Button
            variant="accent"
            iconStart="refresh"
            onClick={reset}
            className="rounded-(--radius-full) px-5"
          >
            {t.common.retry}
          </Button>
          <ButtonLink
            href={localePath(defaultLocale)}
            variant="outline"
            className="rounded-(--radius-full) px-5"
          >
            {t.errors.notFoundHome}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
