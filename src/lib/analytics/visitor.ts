import "server-only";

import { createHash } from "node:crypto";

/**
 * Visitor identification for analytics.
 *
 * `visitor_hash` = SHA-256(ip + user-agent + daily-rotating salt).
 *
 * Properties this gives us, deliberately:
 *  - "unique visitors today" is answerable.
 *  - The value is irreversible: the raw IP is never stored anywhere.
 *  - It rotates daily, so a visitor cannot be followed across days. That is the
 *    difference between a privacy-conscious counter and a tracker.
 *  - No cookie is set, so no consent banner is required for this to be lawful in
 *    most jurisdictions — and none of it is shared with a third party.
 *
 * The salt is derived from the service-role key, which is a server-only secret
 * that already exists. Combined with the date, it makes the hash unguessable even
 * for an attacker who knows a target's IP and user-agent.
 */

function dailySalt(): string {
  const day = new Date().toISOString().slice(0, 10);
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "portfolio-analytics";
  return `${day}:${secret}`;
}

/**
 * Extracts the client IP from proxy headers.
 *
 * Netlify sets `x-nf-client-connection-ip`, which is the trustworthy one on this
 * platform. `x-forwarded-for` is only consulted as a fallback and only its first
 * entry is used, since later entries are attacker-controllable.
 */
export function clientIp(headers: Headers): string | null {
  const netlifyIp = headers.get("x-nf-client-connection-ip");
  if (netlifyIp) return netlifyIp.trim();

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return headers.get("x-real-ip")?.trim() ?? null;
}

/** Irreversible, daily-rotating visitor hash. Returns null when IP is unknown. */
export function visitorHash(headers: Headers): string | null {
  const ip = clientIp(headers);
  if (!ip) return null;

  const userAgent = headers.get("user-agent") ?? "";
  return createHash("sha256")
    .update(`${ip}|${userAgent}|${dailySalt()}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Stable hash of the IP alone, used only for contact-form rate limiting.
 *
 * Also salted with the day, so a limit window never outlives its usefulness and
 * the value cannot be correlated with the analytics hash.
 */
export function rateLimitHash(headers: Headers): string | null {
  const ip = clientIp(headers);
  if (!ip) return null;

  return createHash("sha256")
    .update(`ratelimit|${ip}|${dailySalt()}`)
    .digest("hex")
    .slice(0, 40);
}

/**
 * Country from the platform's geo header, when present.
 *
 * Country granularity only — never a city or a region, which would start to be
 * identifying for a small audience.
 */
export function countryCode(headers: Headers): string | null {
  const candidates = [
    headers.get("x-nf-geo-country"),
    headers.get("x-vercel-ip-country"),
    headers.get("cf-ipcountry"),
  ];

  for (const value of candidates) {
    if (value && /^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  }

  return null;
}
