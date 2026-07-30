import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  resolve: {
    // Native tsconfig path resolution — replaces vite-tsconfig-paths, which Vite now
    // warns is redundant.
    tsconfigPaths: true,

    alias: {
      /*
       * `server-only` throws on import outside a server context. That is the point of
       * the package, and it is what makes a unit test unable to import a server
       * module to test its pure helpers. Aliasing it to an empty module here is safe
       * because the real boundary is enforced by `next build`, which fails if a
       * Client Component reaches a server-only module.
       */
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", "legacy/**"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/supabase/database.types.ts"],
    },
  },
});
