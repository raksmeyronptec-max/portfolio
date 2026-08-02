import Link from "next/link";

import { localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionary";
import { cn } from "@/lib/utils/cn";

/* ═══════════════════════════════════════════════════════════════════════════
   Brand: the Sigma mark and the wordmark beside it.

   The Sigma is carried over from v1's logo idea because it says "mathematics"
   in one glyph, and it is drawn rather than typed. A text "Σ" renders through
   whatever the user's font stack resolves it to — different weights, different
   proportions, and on some Android builds a fallback that is visibly not a
   sigma. A path is the same shape everywhere and stays sharp at any density.

   What changed from the previous inline version:
     • The tile is larger (34 → 40px) and its Sigma is drawn with a heavier,
       squarer stroke; at 34px the old 2.4px stroke read as a spindly "E".
     • The gradient runs indigo → cyan rather than primary → secondary raw, and
       the Sigma is academic gold, so the mark states the two halves of the
       identity in the same order the hero does.
     • A top-left specular highlight and a hairline border give it dimension
       without a shadow heavy enough to look like a button.
     • The mark and the name are one link with one accessible name, rather than
       a decorative SVG sitting next to a separate text node.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The Sigma tile.
 *
 * Always decorative: every caller renders the name as text beside it, so the
 * accessible name comes from there. Marking it up as an image with a label
 * would make a screen reader announce the brand twice.
 *
 * `gradientId` is required and must be unique per rendered instance — the
 * header and the footer both draw this on the same page, and two `<linearGradient>`
 * elements sharing an id is the classic SVG bug where one silently adopts the
 * other's stops.
 */
export function BrandMark({
  gradientId,
  size = 40,
  className,
}: {
  gradientId: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={`${gradientId}-tile`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--identity-indigo)" />
          <stop offset="100%" stopColor="var(--identity-cyan)" />
        </linearGradient>

        {/* Specular highlight: a soft white wash across the top-left corner,
            which is what stops the tile reading as a flat coloured square. */}
        <linearGradient id={`${gradientId}-shine`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="40" height="40" rx="12" fill={`url(#${gradientId}-tile)`} />
      <rect width="40" height="40" rx="12" fill={`url(#${gradientId}-shine)`} />
      {/* Hairline, inset by half a stroke so it sits on the edge rather than
          straddling it. */}
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="11.5"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.22"
      />

      {/*
        Σ, drawn as a stroked path rather than a font glyph.

        Optically centred rather than mathematically: the sigma's arms make it
        top-heavy, so the box is nudged down a fraction. The stroke is 3.2 with
        round joins, heavy enough to hold at 32px in the mobile header.
      */}
      <path
        d="M25.5 12.2H14.6l6.5 7.9-6.5 7.9h10.9"
        fill="none"
        stroke="var(--identity-gold)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The full brand lockup: mark, name, and an optional role subtitle.
 *
 * One `<Link>` wrapping everything, with an explicit `aria-label` — "Ron
 * Raksmey — Home" — because the visible text alone ("Ron Raksmey", plus a
 * subtitle) does not say that activating it goes home.
 */
export function Brand({
  locale,
  showSubtitle = false,
  markSize = 40,
  gradientId,
  className,
}: {
  locale: Locale;
  /** The subtitle is hidden below `xl` by the caller; see SiteHeader. */
  showSubtitle?: boolean;
  markSize?: number;
  gradientId: string;
  className?: string;
}) {
  const t = getDictionary(locale);

  return (
    <Link
      href={localePath(locale)}
      aria-label={t.brand.homeLabel}
      className={cn(
        "group flex items-center gap-2.5 rounded-(--radius-md)",
        className,
      )}
    >
      {/* The tile lifts a single pixel on hover. Not a spin, not a pulse — the
          brief asks for "very subtle", and a logo that performs on every
          pass of the cursor is the opposite of calm. */}
      <span className="transition-transform duration-200 ease-out group-hover:-translate-y-px">
        <BrandMark gradientId={gradientId} size={markSize} />
      </span>

      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "truncate text-[1.125rem] font-semibold tracking-[-0.015em] text-foreground",
            "transition-colors duration-200 group-hover:text-(--identity-gold)",
          )}
        >
          {t.meta.siteName}
        </span>

        {/* Hidden below `xl` rather than width-checked in JavaScript: at 1280
            with Khmer navigation labels the bar is already tight, and a second
            line of brand text is what pushes it into the utilities. Above 1280
            there is room. */}
        {/* `text-eyebrow` rather than an arbitrary size/tracking pair: the
            utility carries a `:lang(km)` override that drops the letter-spacing
            and the uppercase transform, both of which are Latin devices that
            pull Khmer clusters apart. Hand-rolled arbitrary values would bypass
            that correction silently. Scaled down here because the header's
            subtitle is smaller than a section eyebrow. */}
        {showSubtitle ? (
          <span className="mt-1 hidden truncate text-eyebrow text-[0.6875rem] font-medium uppercase text-foreground-subtle xl:block">
            {t.brand.role}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
