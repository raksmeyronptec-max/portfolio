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
  "publication_cover",
  "publication_page",
  "publication_pdf",
  "publication_original",
  "publication_source",
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

  // ── Publications (migration 0026) ────────────────────────────────────────
  // The first two are public images. The last three are private files, and the
  // gap between them is the entire security story of the feature — see
  // PRIVATE_MEDIA_KINDS below.
  publication_cover: "Publication cover",
  publication_page: "Publication sample page",
  publication_pdf: "Publication PDF (public-safe edition, served through the download route)",
  publication_original: "Publication original (private archival copy)",
  publication_source: "Publication LaTeX source archive (private)",

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
  /*
   * All three publication file levels, including the one a reader can download.
   *
   * `publication_pdf` looks like it belongs on the public side and does not. A
   * publication carries a `pdf_download_policy` whose values include `signed`,
   * `on_request` and `contact_author`; none of those can be enforced against an
   * object with a permanent public URL, because the URL is the access. So the
   * bytes stay private and `/api/publications/[slug]/download` is the only way
   * in — the same shape as the resume, which is also a public-facing document
   * served from a private bucket.
   *
   * A migration-0026 CHECK constraint says the same thing at the database, so
   * this set and the schema cannot drift into disagreeing.
   */
  "publication_pdf",
  "publication_original",
  "publication_source",
]);

export function isPrivateKind(kind: MediaKind): boolean {
  return PRIVATE_MEDIA_KINDS.has(kind);
}

/**
 * Which logical bucket a kind's bytes belong in.
 *
 * Single source of truth for the routing, so the upload endpoint, the importer
 * and any future script all agree. Kept here rather than in the upload route
 * because it is now a five-way decision rather than the three-way conditional
 * that route grew organically.
 */
export const MEDIA_KIND_BUCKETS: Partial<Record<MediaKind, string>> = {
  certificate_original: "certificate-originals",
  certificate_preview: "certificate-previews",
  resume_file: "resumes",
  publication_cover: "publication-previews",
  publication_page: "publication-previews",
  publication_pdf: "publication-files",
  publication_original: "publication-originals",
  publication_source: "publication-sources",
};

/** Publication kinds that are stored byte-for-byte rather than re-encoded. */
export const PUBLICATION_FILE_KINDS: ReadonlySet<MediaKind> = new Set([
  "publication_pdf",
  "publication_original",
  "publication_source",
]);
