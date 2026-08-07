# Repository Guidelines

## Project Structure & Module Organization

This is a bilingual English/Khmer portfolio CMS built with Next.js 16, React 19, TypeScript, Tailwind CSS, and Supabase. Public and admin routes live in `src/app/[locale]/` and `src/app/admin/`; there is intentionally no shared `src/app/layout.tsx`. Reusable UI is under `src/components/`, while `src/lib/` separates data reads, server actions, validation, storage, authentication, and media processing. Locale catalogs are in `src/i18n/messages/`. Database migrations and seeds live in `supabase/`. Unit, end-to-end, and RLS tests are in `tests/unit/`, `tests/e2e/`, and `tests/integration/`. Treat `legacy/` as reference-only and place static assets in `public/`.

## Build, Test, and Development Commands

- `npm install` installs dependencies; Node.js 20.11 or newer is required.
- `npm run dev` starts the development server on port 3000.
- `npm run build && npm start` creates and serves a production build.
- `npm run verify` runs TypeScript checks, ESLint, and all Vitest unit tests.
- `npm run test:e2e` builds the app and runs Playwright at desktop, 390px, and 320px widths.
- `npm run db:start`, `npm run db:reset`, and `npm run test:rls` manage and verify the local Supabase stack.

Copy `.env.example` to `.env.local`; never commit real credentials.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, double quotes, semicolons, and the `@/` alias for `src/`. Name React components and files in kebab case (`language-switcher.tsx`), components in PascalCase, and helpers in camelCase. Server-only modules must import `server-only`; files under `src/lib/actions/` must begin with `"use server"` and export only async functions. Run `npm run lint:fix` for safe automatic fixes. Never use `dangerouslySetInnerHTML` or import the Supabase service-role client outside ESLint’s allowlist.

## Testing Guidelines

Write Vitest files as `*.test.ts` or `*.test.tsx`; add Playwright scenarios as `*.spec.ts`. Test behavior and security boundaries, not implementation details. For focused runs, use `npx vitest run tests/unit/validation.test.ts` or `npx playwright test tests/e2e/admin.spec.ts --project=chromium`. No numeric coverage threshold is enforced, but new logic and regressions should have tests. Run `npm run verify` before every pull request.

## Commits & Pull Requests

Recent commits use short, imperative summaries such as `Fix About page accessibility contrast`; keep each commit focused. Pull requests should explain the user-visible change, note database or environment impacts, link relevant issues, and include screenshots for UI changes in both locales and responsive layouts. Report the commands run and regenerate `src/lib/supabase/database.types.ts` after every migration.
