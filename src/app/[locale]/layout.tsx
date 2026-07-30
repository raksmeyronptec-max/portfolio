import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeScript } from "@/components/theme/theme-script";
import { ToastProvider } from "@/components/ui/toast";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localeMeta, locales, type Locale } from "@/i18n/config";
import { getSiteSettings, getSocialLinks } from "@/lib/data/site";
import { buildRootMetadata } from "@/lib/seo/metadata";
import { fontVariables } from "../fonts";

import "../globals.css";

/**
 * Public root layout.
 *
 * This is a *root* layout — it owns <html> — because that is the only way to set
 * `lang` to the actual content language. v1 hardcoded `lang="en"` and then swapped
 * in Khmer text client-side, so every Khmer page was announced to screen readers
 * in English and hyphenated with English rules.
 *
 * The admin app has its own root layout at src/app/admin/layout.tsx. Next.js
 * supports multiple root layouts as long as none of them is nested under another,
 * which is why there is no src/app/layout.tsx.
 */

export const metadata = buildRootMetadata();

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximum-scale, no user-scalable=no. Pinch-zoom must never be blocked, and
  // the layout is verified usable at 200% zoom.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f17" },
  ],
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function PublicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  // An unknown first segment is a 404, not a silent fallback to English — a URL
  // like /fr/projects should not quietly serve English content at a French URL.
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;

  const t = getDictionary(locale);
  const [settings, socialLinks] = await Promise.all([
    getSiteSettings(locale),
    getSocialLinks(locale),
  ]);

  return (
    <html
      lang={localeMeta[locale].tag}
      dir={localeMeta[locale].dir}
      className={fontVariables}
      // ThemeScript sets data-theme before hydration.
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col">
        {/*
          Skip link targets the whole <main>, not a section partway down the page.
          v1's skip link pointed at #about, which skipped the entire hero.
        */}
        <a
          href="#main-content"
          className="sr-only-focusable fixed left-4 top-4 z-50 rounded-[--radius-md] bg-primary px-4 py-2.5 text-small font-semibold text-primary-foreground shadow-[--shadow-md]"
        >
          {t.a11y.skipToContent}
        </a>

        <ToastProvider dismissLabel={t.common.close}>
          <SiteHeader locale={locale} />

          <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>

          <SiteFooter locale={locale} settings={settings} socialLinks={socialLinks} />
        </ToastProvider>

        {settings.analyticsEnabled ? <PageViewTracker locale={locale} /> : null}
      </body>
    </html>
  );
}
