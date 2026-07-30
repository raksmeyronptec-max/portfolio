"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { publicSupabaseEnv } from "./env";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser Supabase client, using the anon key only.
 *
 * Used for exactly two things: the admin sign-in form and signing out. Every
 * other read and write goes through a Server Component, Server Action or route
 * handler, which keeps authorisation decisions on the server where they cannot
 * be bypassed by editing client state.
 */
export function getSupabaseBrowserClient() {
  if (cached) return cached;

  const env = publicSupabaseEnv();
  if (!env) {
    throw new Error("Supabase is not configured in this environment.");
  }

  cached = createBrowserClient<Database>(env.url, env.anonKey);
  return cached;
}
