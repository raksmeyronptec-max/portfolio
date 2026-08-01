import { z } from "zod";

import { locales } from "@/i18n/config";

/**
 * Analytics event contract.
 *
 * The same Zod schema validates on the client before sending and on the server
 * before writing, so the event table cannot accumulate junk names or unbounded
 * property bags. The allowlist matches the CHECK constraint on
 * `analytics_events.event_name` — if they ever drift, inserts fail loudly rather
 * than silently dropping data.
 *
 * Privacy: nothing here carries an identifier. No cookie, no device id, no raw
 * IP. The server derives a daily-rotating `visitor_hash` for unique counts and
 * that value is unlinkable across days.
 */

export const analyticsEventNames = [
  "page_view",
  "project_view",
  "project_live_link_click",
  "project_repository_click",
  "certificate_view",
  "certificate_verify_click",
  "resume_view",
  "resume_download",
  "contact_submit",
  "email_click",
  "telegram_click",
  "social_link_click",
  "language_change",
  "theme_change",
  "outbound_link_click",
  /*
   * Journey. All of these describe what was looked at, never who looked — the
   * gallery event carries a story slug and a position index, and nothing else.
   * `journey_photo_view` in particular is deliberately not per-photograph
   * identity: it records that the gallery advanced, which is what tells the owner
   * whether anyone reaches the end of a story.
   */
  "journey_view",
  "journey_gallery_open",
  "journey_photo_view",
  "journey_video_play",
  "journey_related_experience_click",
  "journey_related_education_click",
  "journey_related_certificate_click",
  "journey_related_project_click",
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export const entityTypes = [
  "project",
  "certificate",
  "resume",
  "page",
  "social_link",
  "journey",
] as const;

/**
 * Property values are constrained to short scalars. This is what stops an
 * accidental `properties: { user }` from persisting personal data.
 */
const propertyValue = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
]);

export const analyticsEventSchema = z.object({
  name: z.enum(analyticsEventNames),
  locale: z.enum(locales).optional(),
  path: z.string().max(512).optional(),
  entityType: z.enum(entityTypes).optional(),
  entityId: z.uuid().optional(),
  entitySlug: z.string().max(120).optional(),
  properties: z.record(z.string().max(40), propertyValue).optional(),
});

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

/** Events that also get a row in the narrow `page_views` projection. */
export const pageViewEvents: ReadonlySet<AnalyticsEventName> = new Set([
  "page_view",
  "project_view",
  "certificate_view",
  "resume_view",
  "journey_view",
]);

/** Events that also get a row in `outbound_clicks`. */
export const outboundEvents: Record<
  string,
  "project_live" | "project_repo" | "certificate_verify" | "social" | "email" | "telegram" | "other"
> = {
  project_live_link_click: "project_live",
  project_repository_click: "project_repo",
  certificate_verify_click: "certificate_verify",
  social_link_click: "social",
  email_click: "email",
  telegram_click: "telegram",
  outbound_link_click: "other",
};

/**
 * Coarse device bucket from a user-agent string.
 *
 * Deliberately crude: three buckets plus a bot flag. Anything more precise moves
 * towards fingerprinting, which this design is trying to avoid.
 */
export function classifyDevice(
  userAgent: string | null,
): "mobile" | "tablet" | "desktop" | "bot" | "unknown" {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();

  if (/bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pagespeed/.test(ua)) {
    return "bot";
  }
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

/** Browser family, again deliberately coarse. Order matters: Chrome-based UAs
 *  mention Safari, and Edge mentions Chrome. */
export function classifyBrowser(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();

  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("samsungbrowser")) return "Samsung Internet";
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("chrome") || ua.includes("crios")) return "Chrome";
  if (ua.includes("safari")) return "Safari";
  return null;
}

export function classifyOs(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();

  if (ua.includes("windows")) return "Windows";
  if (ua.includes("android")) return "Android";
  if (/iphone|ipad|ipod/.test(ua)) return "iOS";
  if (ua.includes("mac os")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  return null;
}

/**
 * Referrer host only — never the full referring URL, which can carry query
 * parameters belonging to another site's users. Self-referrals are dropped so
 * internal navigation does not pollute the acquisition report.
 */
export function referrerHost(
  referer: string | null,
  ownHost: string | null,
): string | null {
  if (!referer) return null;
  try {
    const { host } = new URL(referer);
    if (!host || host === ownHost) return null;
    return host.slice(0, 200);
  } catch {
    return null;
  }
}

/** Destination host for an outbound click. */
export function destinationHost(url: string): string | null {
  try {
    return new URL(url).host.slice(0, 200) || null;
  } catch {
    return null;
  }
}
