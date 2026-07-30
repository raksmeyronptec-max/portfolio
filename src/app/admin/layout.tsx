import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeScript } from "@/components/theme/theme-script";
import { ToastProvider } from "@/components/ui/toast";
import { fontVariables } from "../fonts";

import "../globals.css";

/**
 * Admin root layout.
 *
 * A second root layout, sibling to the public one at src/app/[locale]/layout.tsx.
 * Next.js permits multiple root layouts when none is nested under another, which is
 * why there is no src/app/layout.tsx.
 *
 * The admin UI is English-only and `lang="en"` here is therefore honest. Localising
 * the whole management interface for a single-operator CMS would be work with no
 * reader — the *content* is bilingual, which is what matters, and the editor sees
 * both languages side by side in the translation tabs.
 *
 * Why the admin does not simply live inside the locale tree: it must not be
 * locale-prefixed (there is no /en/admin), it must never be statically rendered or
 * publicly cached, and it must be excluded from the sitemap. Keeping it as its own
 * root makes all three structural rather than something to remember.
 */
export const metadata: Metadata = {
  title: {
    template: "%s · Portfolio admin",
    default: "Portfolio admin",
  },
  // Belt and braces with the X-Robots-Tag header set in next.config.ts,
  // netlify.toml and middleware.ts. Three independent layers, because an
  // accidentally indexed admin login page is a permanent embarrassment.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
        {/*
          No hand-written <meta name="robots"> here. `metadata.robots` above
          already emits one, and a second hard-coded tag produced two conflicting
          robots meta elements on any admin page that set its own `robots` value —
          one saying "noindex, nofollow, noarchive, noimageindex" and one saying
          just "noindex, nofollow". Two sources of truth for one directive.
          The response headers (next.config.ts, netlify.toml, middleware.ts) are
          the redundancy; a duplicate tag is not.
        */}
      </head>
      <body className="min-h-dvh bg-background text-foreground">
        <a
          href="#admin-content"
          className="sr-only-focusable fixed left-4 top-4 z-50 rounded-[--radius-md] bg-primary px-4 py-2.5 text-small font-semibold text-primary-foreground shadow-[--shadow-md]"
        >
          Skip to main content
        </a>

        <ToastProvider dismissLabel="Dismiss">{children}</ToastProvider>
      </body>
    </html>
  );
}
