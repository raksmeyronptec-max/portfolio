import type { ReactNode } from "react";

import { Breadcrumbs } from "@/components/ui/navigation";

/**
 * Standard opening band for every public page other than the homepage.
 *
 * Two jobs:
 *
 *  1. Brand consistency. Every public page now opens on the same ink ground as
 *    the homepage hero, so the site reads as one design rather than a dark
 *    landing page bolted onto a set of white documents.
 *
 *  2. Header contrast. `HeaderShell` is transparent and ink-scoped until the
 *    visitor scrolls, which only works if what sits underneath it is reliably
 *    dark. Making that a shared component means a new page cannot accidentally
 *    put light content behind a light-on-transparent header.
 *
 * The band is deliberately shallow — it introduces the page and gets out of the
 * way, unlike the homepage hero which is the destination itself.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
  breadcrumbLabel,
  children,
  watermark,
}: {
  title: string;
  description?: string | null;
  eyebrow?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  breadcrumbLabel?: string;
  /** Actions or metadata rendered under the description. */
  children?: ReactNode;
  /** Large decorative glyph. Always aria-hidden. */
  watermark?: string;
}) {
  return (
    <section
      data-scheme="ink"
      className="decorated bg-background text-foreground"
      /*
       * The header is `position: sticky`, so it occupies layout space and would
       * otherwise sit *above* this band on the page background — leaving the
       * ink-scoped (light) header text on a light surface at 1.2:1. Pulling the
       * band up by exactly the header height puts it underneath the transparent
       * header instead, which is what the ink scope assumes. The padding below
       * gives the space back, so nothing is ever hidden.
       */
      style={{ marginTop: "calc(-1 * var(--header-height))" }}
    >
      <div aria-hidden="true" className="grid-lines" style={{ "--grid-alpha": "0.045" } as object} />
      <div
        aria-hidden="true"
        className="glow"
        style={{ "--glow-x": "78%", "--glow-y": "10%", "--glow-size": "58%", "--glow-alpha": "0.2" } as object}
      />

      <div
        className="container-content flex flex-col gap-6 pb-14"
        // Clears the transparent fixed header without a magic number.
        style={{ paddingTop: "calc(var(--header-height) + clamp(2rem, 4vw, 3.5rem))" }}
      >
        {breadcrumbs && breadcrumbLabel ? (
          <Breadcrumbs items={breadcrumbs} label={breadcrumbLabel} />
        ) : null}

        <div className="relative flex flex-col gap-4">
          {watermark ? (
            <span
              aria-hidden="true"
              className="watermark -top-6 right-0 text-[7rem] sm:text-[9rem]"
              style={{ opacity: 0.06 }}
            >
              {watermark}
            </span>
          ) : null}

          {eyebrow ? (
            <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent">
              <span aria-hidden="true" className="h-px w-8 bg-accent" />
              {eyebrow}
            </p>
          ) : null}

          <h1 className="text-h1 max-w-[20ch]">{title}</h1>

          {description ? (
            <p className="max-w-[60ch] text-body-lg text-foreground-muted">{description}</p>
          ) : null}
        </div>

        {children}
      </div>
    </section>
  );
}
