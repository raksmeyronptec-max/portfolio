import "server-only";

import { revalidatePath } from "next/cache";

import { locales } from "@/i18n/config";

/**
 * Server Action result contract.
 *
 * A discriminated union rather than throwing. Thrown errors in a Server Action
 * surface to the user as an opaque "something went wrong" boundary and lose the
 * field-level detail a form needs, so failures are returned as values.
 *
 * Error messages are CODES, localised by the client, for the same reason the
 * contact API returns codes: the server must not choose the user's language.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ActionErrorCode;
      /** Field-scoped validation errors, keyed by field name. */
      fields?: Record<string, string>;
      /** Safe operator-facing detail. Never contains internal identifiers. */
      detail?: string;
    };

export type ActionErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "validation"
  | "not_found"
  | "conflict"
  | "publish_blocked"
  | "server_error";

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  code: ActionErrorCode,
  options: { fields?: Record<string, string>; detail?: string } = {},
): ActionResult<never> {
  return { ok: false, code, ...options };
}

/**
 * Map a Postgres error onto an action error code.
 *
 * The publish gates on certificates and testimonials raise `check_violation` with
 * a human-readable message; that message is authored by us in the migration and is
 * safe to surface, which is what makes "you must complete the privacy review
 * first" reach the admin instead of a generic failure.
 */
export function fromPostgresError(error: {
  code?: string;
  message?: string;
  details?: string | null;
}): ActionResult<never> {
  switch (error.code) {
    // check_violation — this is how the publish gates report themselves. The
    // message text is authored by us in the migrations (e.g. "cannot be published
    // before a privacy review is recorded"), so it is safe and useful to surface.
    case "23514":
      return fail("publish_blocked", { detail: error.message });

    // unique_violation — almost always a duplicate slug.
    case "23505":
      return fail("conflict", {
        fields: error.message?.includes("slug") ? { slug: "slugTaken" } : undefined,
        detail: "A record with that identifier already exists.",
      });

    // foreign_key_violation
    case "23503":
      return fail("conflict", { detail: "A referenced record no longer exists." });

    // not_null_violation — a required field was empty.
    case "23502":
      return fail("validation");

    // insufficient_privilege — RLS or a missing grant rejected the write. This is
    // the expected outcome when a viewer attempts an edit.
    case "42501":
      return fail("forbidden");

    // PostgREST: no rows returned where exactly one was expected.
    case "PGRST116":
      return fail("not_found");

    default:
      // Anything else is unexpected. The caller gets a generic code; the real
      // error is left to the server logs rather than shown to a user.
      return fail("server_error");
  }
}

/**
 * Revalidate every public surface a content change can appear on.
 *
 * Called after any publish/unpublish/update so an edit shows up immediately
 * rather than waiting out the ISR window. The window remains as a backstop for
 * changes made outside the app (directly in Supabase Studio, for instance).
 */
export function revalidatePublicContent(
  options: {
    projectSlug?: string;
    certificateSlug?: string;
    /** Also refresh the listing and homepage. Default true. */
    includeListings?: boolean;
  } = {},
) {
  const { projectSlug, certificateSlug, includeListings = true } = options;

  for (const locale of locales) {
    if (includeListings) {
      revalidatePath(`/${locale}`);
      revalidatePath(`/${locale}/projects`);
      revalidatePath(`/${locale}/certificates`);
      revalidatePath(`/${locale}/about`);
      revalidatePath(`/${locale}/experience`);
      revalidatePath(`/${locale}/education`);
      revalidatePath(`/${locale}/resume`);
      revalidatePath(`/${locale}/journey`);
      revalidatePath(`/${locale}/publications`);
    }

    if (projectSlug) revalidatePath(`/${locale}/projects/${projectSlug}`);
    if (certificateSlug) revalidatePath(`/${locale}/certificates/${certificateSlug}`);
  }

  // The sitemap's entry list and its lastModified values both change.
  revalidatePath("/sitemap.xml");
}

/**
 * Revalidate the surfaces a journey change can appear on.
 *
 * Narrower than `revalidatePublicContent` on purpose. A journey story appears on
 * the timeline, its own page, the homepage's selected moments, and — through
 * `journey_relations` — on the Experience, Education and Certificate pages. It
 * does not appear on the projects listing or the resume, and busting those on
 * every caption edit would discard warm caches for nothing.
 *
 * `previousSlug` covers a rename: without it the old URL keeps serving the story
 * from cache under a path that no longer resolves.
 */
/**
 * Revalidate the surfaces a publication change can appear on.
 *
 * Narrower than `revalidatePublicContent`, on the same reasoning
 * `revalidateJourney` uses. A publication appears on its own page, the
 * publications listing, the homepage's selected publications, and — through
 * `publication_relations` — on the Journey, Experience and Education pages. It
 * does not appear on the projects listing or the resume, and busting those on
 * every chapter edit would discard warm caches for nothing.
 *
 * `previousSlug` covers a rename: without it the old URL keeps serving the
 * publication from cache under a path that no longer resolves.
 */
export function revalidatePublications(
  options: { slug?: string; previousSlug?: string } = {},
) {
  const { slug, previousSlug } = options;

  for (const locale of locales) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/publications`);
    revalidatePath(`/${locale}/about`);
    revalidatePath(`/${locale}/journey`);
    revalidatePath(`/${locale}/experience`);
    revalidatePath(`/${locale}/education`);

    if (slug) revalidatePath(`/${locale}/publications/${slug}`);
    if (previousSlug && previousSlug !== slug) {
      revalidatePath(`/${locale}/publications/${previousSlug}`);
    }
  }

  revalidatePath("/sitemap.xml");
}

export function revalidateJourney(
  options: { slug?: string; previousSlug?: string } = {},
) {
  const { slug, previousSlug } = options;

  for (const locale of locales) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/journey`);
    revalidatePath(`/${locale}/about`);
    revalidatePath(`/${locale}/experience`);
    revalidatePath(`/${locale}/education`);
    revalidatePath(`/${locale}/certificates`);

    if (slug) revalidatePath(`/${locale}/journey/${slug}`);
    if (previousSlug && previousSlug !== slug) {
      revalidatePath(`/${locale}/journey/${previousSlug}`);
    }
  }

  revalidatePath("/sitemap.xml");
}
