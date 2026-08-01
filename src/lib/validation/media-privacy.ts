/**
 * The privacy vocabulary shared by every media attachment in this CMS.
 *
 * Extracted from `./experience-media.ts` when journey stories became the second
 * feature that attaches photographs of other people to published content. There
 * must be exactly one definition of what "approved" means, for the same reason
 * there is exactly one `is_publicly_visible()` in the database: two copies drift,
 * and the copy that drifts is the one that publishes a photograph it should not
 * have.
 *
 * These mirror the CHECK constraints in migrations 0022 and 0024 rather than
 * inventing a second, looser rule set. The database is the guarantee; this layer
 * turns a violation into a field-level message instead of a raw 23514.
 *
 * The one rule worth stating twice, because it is the whole point:
 *
 *   an attachment may only be `public` once privacy_status is `approved`
 *   and consent_status is `confirmed` or `not_required`.
 */

export const privacyStatuses = ["pending_review", "approved", "rejected"] as const;
export type PrivacyStatus = (typeof privacyStatuses)[number];

export const consentStatuses = [
  "not_required",
  "pending",
  "confirmed",
  "denied",
] as const;
export type ConsentStatus = (typeof consentStatuses)[number];

export const mediaVisibilities = ["public", "private", "hidden"] as const;
export type MediaVisibility = (typeof mediaVisibilities)[number];

/**
 * True when this attachment is currently rendered on the public site.
 *
 * Note that this is deliberately *not* "is it allowed to be public" — it is "is
 * it public right now". The admin uses it to decide whether an edit needs a
 * revalidation, and the difference matters: a `hidden` attachment is fully
 * approved and still renders nothing.
 */
export function isPubliclyRendered(input: {
  visibility: MediaVisibility;
  privacyStatus: PrivacyStatus;
  consentStatus: ConsentStatus;
}): boolean {
  return (
    input.visibility === "public" &&
    input.privacyStatus === "approved" &&
    (input.consentStatus === "confirmed" || input.consentStatus === "not_required")
  );
}

/**
 * Why a given attachment cannot be published yet.
 *
 * Returns message codes rather than sentences, for the same reason every other
 * result in this codebase does: the server does not choose the reader's language.
 *
 * `requiresAsset` covers the case a photograph cannot have but a video can — a
 * video with no poster frame. A public video without a poster would mean the
 * page loading a third-party player before anyone asked for it, so it is a
 * publication blocker rather than a cosmetic gap.
 */
export function mediaPublishBlockers(input: {
  privacyStatus: PrivacyStatus;
  consentStatus: ConsentStatus;
  altTextEn: string | null | undefined;
  /** Present and false only for a video that has no poster image yet. */
  hasPoster?: boolean;
}): string[] {
  const blockers: string[] = [];

  if (input.privacyStatus === "rejected") blockers.push("privacyRejected");
  else if (input.privacyStatus !== "approved") blockers.push("privacyPending");

  if (input.consentStatus === "denied") blockers.push("consentDenied");
  else if (input.consentStatus === "pending") blockers.push("consentPending");

  if (!input.altTextEn?.trim()) blockers.push("altTextMissing");

  if (input.hasPoster === false) blockers.push("posterMissing");

  return blockers;
}
