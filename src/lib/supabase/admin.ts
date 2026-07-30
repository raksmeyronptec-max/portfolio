import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { publicSupabaseEnv, serviceRoleKey } from "./env";

/**
 * Service-role Supabase client. **Bypasses Row Level Security.**
 *
 * `import "server-only"` makes importing this from a Client Component a build
 * error, and eslint.config.mjs additionally flags the import path. Between them,
 * this key cannot end up in a browser bundle by accident.
 *
 * It exists for exactly four jobs, each of which RLS deliberately forbids to
 * every client role:
 *
 *   1. Writing `audit_logs`. No role has an INSERT grant, so an editor cannot
 *      forge an entry attributed to someone else.
 *   2. Minting short-lived signed URLs for private certificate originals, after
 *      the caller's owner role has been verified server-side.
 *   3. Resolving the caller's admin role during middleware/layout checks.
 *   4. Recording contact-message triage fields (ip_hash, spam_score) that the
 *      anonymous insert policy explicitly forbids the submitter from setting.
 *
 * Anything else belongs on the RLS-constrained client in ./server.ts. If you
 * find yourself reaching for this to "make a query work", the policy is the
 * thing to fix.
 */
export function createSupabaseAdminClient() {
  const env = publicSupabaseEnv();
  if (!env) {
    throw new Error("Supabase is not configured; cannot create an admin client.");
  }

  return createClient<Database>(env.url, serviceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        // Makes privileged traffic identifiable in Supabase logs.
        "x-application-name": "portfolio-cms-service-role",
      },
    },
  });
}
