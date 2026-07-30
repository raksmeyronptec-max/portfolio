import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Vitest setup.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` is set to a dummy value because the visitor-hash
 * helper derives its daily salt from it. Without a value the salt would fall back to
 * a constant and the tests would silently exercise a different code path than
 * production.
 */
process.env.NEXT_PUBLIC_SITE_URL = "https://portfolio.test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
