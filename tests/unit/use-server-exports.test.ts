import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A `"use server"` module may export nothing but async functions.
 *
 * Next enforces this when it loads the module to run an action, and the failure
 * mode is brutal: exporting a single schema or label object makes *every* action
 * in that file throw
 *
 *   A "use server" file can only export async functions, found object.
 *
 * Nothing caught it. TypeScript is happy, ESLint is happy, `next build` is
 * happy, and every page renders — because a GET never loads the action module.
 * It surfaces only when someone presses Save in a production build, and there it
 * arrives as an opaque digest with the message stripped out.
 *
 * That is exactly what happened on /admin/profile, /admin/settings, /admin/seo
 * and /admin/messages: saving was broken in production while every local check
 * passed. This test is the check that was missing.
 */

const ACTIONS_DIR = path.join(process.cwd(), "src/lib/actions");

function actionFiles(): string[] {
  return readdirSync(ACTIONS_DIR)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join(ACTIONS_DIR, name));
}

function isUseServerModule(source: string): boolean {
  // The directive must be the first statement, so only the opening lines matter.
  return /^\s*(["'])use server\1/.test(source);
}

/**
 * Exported names that are not `async function`.
 *
 * Deliberately a regex over the source rather than an import of the module:
 * importing it would execute `server-only` guards and pull in the Supabase
 * client. The shapes being matched are the ones the codebase actually writes.
 */
function nonAsyncExports(source: string): string[] {
  const offenders: string[] = [];

  for (const match of source.matchAll(/^export\s+(?!type\b|interface\b)(.+)$/gm)) {
    const declaration = match[1]!.trim();

    // The only legal form.
    if (declaration.startsWith("async function")) continue;

    // `export { x } from "…"` re-exports are just as illegal, but a bare
    // `export type { … }` is fine and already excluded above.
    const name =
      /^(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/.exec(declaration)?.[1] ??
      declaration.slice(0, 40);

    offenders.push(name);
  }

  return offenders;
}

describe('"use server" modules', () => {
  const files = actionFiles();

  it("finds the action modules to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (!isUseServerModule(source)) continue;

    it(`${path.basename(file)} exports only async functions`, () => {
      expect(
        nonAsyncExports(source),
        `${path.basename(file)} exports a non-async value. Move schemas, label maps and ` +
          "constants into src/lib/validation/ — exporting one from a \"use server\" " +
          "module breaks every action in the file, but only in production, and only on save.",
      ).toEqual([]);
    });
  }
});
