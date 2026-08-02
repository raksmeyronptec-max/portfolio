import { cn } from "@/lib/utils/cn";

/**
 * The owner's name, with a one-time "academic ink" reveal.
 *
 * A Server Component. There is no `"use client"` here and no hook — the whole
 * effect is CSS, which is the point: the name is the single most important
 * string on the page for a person searching it, so it must not depend on a
 * bundle arriving, on hydration succeeding, or on an IntersectionObserver
 * firing.
 *
 * What that buys, concretely:
 *   • Server-rendered as ordinary text inside the heading it belongs to, so it
 *     is indexable and selectable.
 *   • A reduced-motion visitor sees the finished state on first paint — not the
 *     start state held until a media query is consulted in JavaScript.
 *   • Zero client JavaScript for an effect that runs once and never reacts to
 *     anything.
 *
 * The animation itself lives in `globals.css` under `.identity-name`; see the
 * block there for the timing and the three rules it follows. `data-name`
 * duplicates the text for the highlight pseudo-element's `content` — that copy
 * is decorative, sits in `::after`, and is never read by assistive technology,
 * which reads the real text node.
 */
export function AnimatedIdentityName({
  name,
  className,
  /** Draws the rule that extends beside the name once the reveal finishes. */
  withRule = true,
}: {
  name: string;
  className?: string;
  withRule?: boolean;
}) {
  return (
    <span className="flex items-center gap-3">
      <span
        className={cn(
          "identity-name relative inline-block",
          // `text-balance` is deliberately absent: the name must never wrap to
          // two lines, because the clip animation wipes the whole box and a
          // wrapped name would reveal as a rectangle rather than a line.
          "whitespace-nowrap",
          className,
        )}
        data-name={name}
      >
        {name}
      </span>

      {withRule ? (
        <span
          aria-hidden="true"
          className="identity-name__rule h-px flex-1 bg-gradient-to-r from-border-strong to-transparent"
        />
      ) : null}
    </span>
  );
}
