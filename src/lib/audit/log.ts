import "server-only";

import { headers } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimitHash } from "@/lib/analytics/visitor";
import type { AdminRole } from "@/lib/auth/roles";

/**
 * Audit logging.
 *
 * Written with the service-role client because no client role has an INSERT grant
 * on `audit_logs`. That is the point: an editor cannot forge an entry attributed
 * to someone else, and no role can UPDATE or DELETE an existing entry, so the
 * trail is append-only from the application's perspective.
 *
 * Two rules for what goes in:
 *  1. Never a secret. Diffs record *which* fields changed and their new values only
 *     for non-sensitive columns; anything sensitive is recorded as a key with a
 *     redaction marker.
 *  2. Never a raw IP. The same salted, daily-rotating hash used for rate limiting
 *     is stored instead, so an action can be correlated within a day without
 *     retaining an address.
 */

export type AuditAction =
  | "admin.login"
  | "admin.login_failed"
  | "admin.logout"
  | "admin.unauthorized"
  | "admin.role_changed"
  | "profile.updated"
  | "project.created"
  | "project.updated"
  | "project.published"
  | "project.unpublished"
  | "project.archived"
  | "project.restored"
  | "project.deleted"
  | "project.duplicated"
  | "certificate.created"
  | "certificate.updated"
  | "certificate.published"
  | "certificate.unpublished"
  | "certificate.archived"
  | "certificate.restored"
  | "certificate.deleted"
  | "certificate.original_viewed"
  | "certificate.original_downloaded"
  | "certificate.privacy_reviewed"
  | "media.uploaded"
  | "media.replaced"
  | "media.deleted"
  | "resume.uploaded"
  | "resume.activated"
  | "resume.archived"
  | "education.updated"
  | "experience.updated"
  | "skill.updated"
  | "testimonial.updated"
  | "message.updated"
  | "message.deleted"
  | "seo.updated"
  | "settings.updated";

/** Columns never written to the log in cleartext. */
const REDACTED_KEYS = new Set([
  "password",
  "token",
  "secret",
  "api_key",
  "service_role_key",
  "encrypted_password",
  "ip_hash",
  "email",
]);

export type AuditEntry = {
  action: AuditAction;
  actor: { userId: string; email: string; role: AdminRole } | null;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  summary?: string;
  changes?: Record<string, unknown>;
};

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const requestHeaders = await headers();

    await admin.from("audit_logs").insert({
      actor_id: entry.actor?.userId ?? null,
      actor_email: entry.actor?.email ?? null,
      actor_role: entry.actor?.role ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      entity_label: entry.entityLabel?.slice(0, 200) ?? null,
      summary: entry.summary?.slice(0, 500) ?? null,
      // sanitizeChanges only ever returns JSON-safe scalars and short strings, so
      // the cast is narrowing to the generated Json type rather than widening.
      changes: sanitizeChanges(entry.changes ?? {}) as Record<string, string | number | boolean | null>,
      ip_hash: rateLimitHash(requestHeaders),
      user_agent: requestHeaders.get("user-agent")?.slice(0, 300) ?? null,
    });
  } catch {
    /*
     * A logging failure must never block the action the admin was performing.
     * The alternative — refusing to save a project because the audit insert
     * failed — is worse than a gap in the trail.
     */
  }
}

/** Replace sensitive values with a marker, and cap value size. */
function sanitizeChanges(
  changes: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const output: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(changes)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      output[key] = "[redacted]";
      continue;
    }

    if (typeof value === "string") {
      output[key] = value.length > 300 ? `${value.slice(0, 300)}…` : value;
      continue;
    }

    if (value === null || typeof value === "number" || typeof value === "boolean") {
      output[key] = value;
      continue;
    }

    // Objects and arrays are recorded as a shape summary rather than dumped
    // wholesale, which keeps the log readable and bounded.
    output[key] = Array.isArray(value)
      ? `[array:${value.length}]`
      : typeof value === "object"
        ? `[object:${Object.keys(value as object).length} keys]`
        : String(value);
  }

  return output;
}

/**
 * Field-level diff between two records.
 *
 * Only changed keys are returned, which makes the audit trail answer "what
 * changed" instead of "what was submitted".
 */
export function diffRecords(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): Record<string, unknown> {
  if (!before) return { created: true };

  const changes: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(after)) {
    const previous = before[key];
    const changed =
      typeof value === "object" || typeof previous === "object"
        ? JSON.stringify(previous ?? null) !== JSON.stringify(value ?? null)
        : previous !== value;

    if (changed) {
      changes[key] = { from: normalise(previous), to: normalise(value) };
    }
  }

  return changes;
}

function normalise(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 120)}…` : value;
  }
  if (value === null || ["number", "boolean", "undefined"].includes(typeof value)) {
    return value ?? null;
  }
  return Array.isArray(value) ? `[array:${value.length}]` : "[object]";
}
