import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { publicSupabaseEnv } from "./env";

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * route handlers.
 *
 * Runs as the signed-in user (or `anon`), so every query is subject to Row Level
 * Security. This is the client used for all normal reads and writes — the
 * service-role client is reserved for the few operations RLS deliberately
 * forbids everyone (see ./admin.ts).
 */
export async function createSupabaseServerClient() {
  const env = publicSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Session refresh happens in
          // middleware.ts, which can, so swallowing here is correct rather than
          // merely convenient.
        }
      },
    },
  });
}

/**
 * Read-only client for public pages.
 *
 * Identical to the above except that it never writes cookies, which keeps
 * public pages eligible for static rendering and caching. Using the cookie-
 * writing client on a public page would opt it out of the render cache.
 */
export async function createSupabasePublicClient() {
  const env = publicSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example.",
    );
  }

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        /* public reads never touch the session */
      },
    },
  });
}
