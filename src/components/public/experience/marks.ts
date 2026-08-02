import type { ExperienceTrack } from "@/lib/content/experience-taxonomy";

/**
 * Which semantic colour a track or a category is marked with.
 *
 * Returns the *token reference*, never a hex, so the mark follows the light,
 * dark and ink scopes without any component knowing which one is active. It is
 * fed to a `--mark-color` custom property and consumed by `.experience-mark`
 * and `.experience-chip` in globals.css.
 *
 * The colour is always redundant. Every mark sits beside text that already
 * names the track or the category, so nothing on this page is communicated by
 * colour alone.
 */
export function trackMark(track: ExperienceTrack): string {
  return track === "product"
    ? "var(--experience-product)"
    : "var(--experience-education)";
}

/**
 * A practicum is education practice, but it is a distinct kind of it — a
 * placement rather than a role — so it takes the violet mark while still living
 * on the education track. Every other kind simply inherits its track's colour,
 * which is why an unrecognised kind can never produce an unstyled chip.
 */
export function kindMark(kind: string, track: ExperienceTrack): string {
  if (kind.toLowerCase() === "practicum") {
    return "var(--experience-practicum)";
  }
  return trackMark(track);
}
