import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

/**
 * The ink-scoped band that closes a content page: one restated argument, up to
 * three routes onward, in descending commitment.
 *
 * Extracted from the Experience page's closing CTA the moment a second page
 * needed the identical structure — the alternative was a copy that drifts.
 * Deliberately quiet: no glow beyond the shared ambient one, no promised
 * response times, no contact details in the markup.
 */
export type ClosingAction = {
  href: string;
  label: string;
  variant: "accent" | "outline" | "link";
  iconStart?: "fileText";
  iconEnd?: "arrowRight";
};

export function ClosingBand({
  headingId,
  eyebrow,
  heading,
  body,
  actions,
}: {
  headingId: string;
  eyebrow: string;
  heading: string;
  body: string;
  actions: ClosingAction[];
}) {
  return (
    <section
      data-scheme="ink"
      aria-labelledby={headingId}
      className="decorated bg-background text-foreground"
    >
      <div
        aria-hidden="true"
        className="grid-lines"
        style={{ "--grid-alpha": "0.045" } as object}
      />
      <div
        aria-hidden="true"
        className="glow"
        style={
          {
            "--glow-x": "22%",
            "--glow-y": "85%",
            "--glow-size": "52%",
            "--glow-alpha": "0.18",
          } as object
        }
      />

      <div className="container-content section-y">
        <Reveal className="mx-auto flex max-w-[46ch] flex-col items-center gap-5 text-center">
          <p className="text-eyebrow font-semibold uppercase text-accent">
            {eyebrow}
          </p>

          <h2 id={headingId} className="text-h2 text-balance">
            {heading}
          </h2>

          <p className="text-body-lg text-foreground-muted">{body}</p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {actions.map((action) => (
              <ButtonLink
                key={action.href}
                href={action.href}
                variant={action.variant}
                iconStart={action.iconStart}
                iconEnd={action.iconEnd}
              >
                {action.label}
              </ButtonLink>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
