import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/config";

/**
 * Catch-all for unmatched paths inside a locale.
 *
 * Without this, `/en/this-does-not-exist` matches no route in the `[locale]`
 * segment, so Next falls back to its own built-in 404 — an unstyled page with no
 * navigation and no recovery links. A global `src/app/not-found.tsx` cannot fix
 * that here, because this app deliberately has no single root layout:
 * `[locale]/layout.tsx` and `admin/layout.tsx` each own their own `<html>`.
 *
 * Matching the path here instead means `notFound()` resolves to
 * `[locale]/not-found.tsx`, which renders the real 404 content and still returns a
 * 404 status.
 *
 * A catch-all has the lowest routing priority, so every real route
 * (`/en/projects`, `/en/projects/[slug]`, …) still wins.
 *
 * No `generateMetadata` here: page metadata is not applied when a page throws
 * `notFound()`. The `<title>` is rendered from inside `not-found.tsx` instead.
 */

export const dynamic = "force-dynamic";

export default async function UnmatchedPath({
  params,
}: {
  params: Promise<{ locale: string; unmatched: string[] }>;
}) {
  const { locale } = await params;

  // An unknown locale is a 404 too, not a silent fallback to English.
  if (!isLocale(locale)) notFound();

  notFound();
}
