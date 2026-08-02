import type { EducationTrack } from "@/lib/content/education-view";

/**
 * Which semantic colour each academic element is marked with.
 *
 * These deliberately reference the `--experience-*` tokens rather than
 * introducing a parallel `--education-*` set. The two pages share one palette
 * with the same meanings — education practice is gold, the technical track is
 * cyan, a placement is violet — and globals.css already has to repeat every
 * token across the light, dark and ink scopes (see the note on the identity
 * aliases there), so six new names would mean eighteen new declarations that
 * can silently drift. One vocabulary, two pages. If the tokens are ever
 * renamed to something track-neutral, this file is the education page's only
 * touchpoint.
 *
 * As on the Experience page, the colour is always redundant: every mark sits
 * beside text that already names the track, so nothing is communicated by
 * colour alone.
 */
export function educationTrackMark(track: EducationTrack): string {
  return track === "mathematics"
    ? "var(--experience-product)"
    : "var(--experience-education)";
}

/** Fieldwork is a placement, and takes the placement violet. */
export const FIELDWORK_MARK = "var(--experience-practicum)";

/** The line and node where the two degree paths meet. */
export const CONNECTION_MARK = "var(--experience-connection)";
