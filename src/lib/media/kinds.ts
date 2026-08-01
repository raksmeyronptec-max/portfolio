/**
 * Media kinds — the `media_kind` enum, mirrored for the application.
 *
 * Deliberately in its own module with no `server-only` import, because both the
 * upload route handler (server) and the upload form (client) need it. It previously
 * lived in `lib/data/admin.ts`, which is server-only, and importing it from the
 * client form was a real boundary violation that the build caught.
 *
 * The values must stay in step with the `public.media_kind` enum in migration 0001.
 * A mismatch surfaces as a failed insert rather than silent data loss, because the
 * column is typed against the enum.
 */
export const MEDIA_KINDS = [
  "project_cover",
  "project_screenshot",
  "certificate_preview",
  "certificate_original",
  "profile_image",
  "resume_file",
  "experience_photo",
  "journey_photo",
  "video_poster",
  "testimonial_image",
  "open_graph_image",
  "diagram",
  "other",
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

export function isMediaKind(value: string): value is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(value);
}

/** Human labels for the upload form and the library filters. */
export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  project_cover: "Project cover image",
  project_screenshot: "Project screenshot",
  certificate_preview: "Certificate preview (redacted, public)",
  certificate_original: "Certificate original (private)",
  profile_image: "Profile photo",
  resume_file: "Resume PDF (private)",
  // Public, like every other image kind. What makes an experience photograph
  // safe is the privacy review recorded on the *attachment* — see migration 0022
  // — not the bucket it lives in. A photograph that cannot pass that review
  // should not be uploaded here at all.
  experience_photo: "Experience photo (classroom, placement, workplace)",
  // Public for the same reason `experience_photo` is: what makes a journey
  // photograph safe to serve is the privacy review recorded on the *attachment*
  // (migration 0024), not the bucket it lives in.
  journey_photo: "Journey photo (fieldwork, event, award, university life)",
  // A poster frame is not a photograph of an event — it is a still chosen to be
  // legible at small size, standing in for a video. Kept distinct so it does not
  // turn up when the owner filters for photographs they might publish.
  video_poster: "Video poster frame",
  testimonial_image: "Reference avatar",
  open_graph_image: "Social preview image",
  diagram: "Diagram",
  other: "Other",
};

/**
 * Kinds that are stored in a private bucket.
 *
 * Single source of truth for the privacy routing, used by the upload endpoint to
 * choose a bucket and by the form to warn the user before they upload.
 */
export const PRIVATE_MEDIA_KINDS: ReadonlySet<MediaKind> = new Set([
  "certificate_original",
  "resume_file",
]);

export function isPrivateKind(kind: MediaKind): boolean {
  return PRIVATE_MEDIA_KINDS.has(kind);
}
