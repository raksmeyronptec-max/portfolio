import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The pre-redesign static site is kept for content reference only.
    "legacy/**",
    "public/**",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
    "supabase/.branches/**",
    "supabase/.temp/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Guard the two mistakes this codebase most needs to avoid.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "The service-role client is server-only. Import it from Server Components, Server Actions or route handlers — never from a file that can reach the browser bundle.",
            },
          ],
        },
      ],
      "react/no-danger": "error",
    },
  },
  {
    /*
     * The service-role client has to be imported *somewhere*. This is the closed
     * allowlist of modules permitted to do it, and it is the whole point of the
     * rule above: adding `@/lib/supabase/admin` to any file outside this list
     * fails lint, so the key cannot drift into a module that the browser bundle
     * can reach.
     *
     * Every entry is provably server-only:
     *   - `src/app/api/ ** /route.ts`  route handlers, never bundled for the client
     *   - `src/lib/actions/ **`        every file begins with "use server"
     *   - `src/lib/audit`, `src/lib/auth`, `src/lib/analytics`
     *                                  every file begins with import "server-only"
     */
    files: [
      "src/app/api/**/route.ts",
      "src/lib/actions/**/*.ts",
      "src/lib/audit/**/*.ts",
      "src/lib/auth/**/*.ts",
      "src/lib/analytics/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
