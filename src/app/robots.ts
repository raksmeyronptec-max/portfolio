import type { MetadataRoute } from "next";

import { absoluteUrl, siteUrl } from "@/lib/supabase/env";

/**
 * robots.txt — v1 had none at all.
 *
 * Disallow rules cover every non-public surface. Note that these are *requests*
 * to well-behaved crawlers, not access control: /admin is additionally protected
 * by authentication, by `X-Robots-Tag: noindex` response headers, and by RLS at the
 * database. A disallow line alone would be security theatre.
 *
 * `/api/` is disallowed because those endpoints are machinery, not content, and
 * indexing them wastes crawl budget on routes that return 405 to a GET.
 */
export default function robots(): MetadataRoute.Robots {
  const host = siteUrl();

  // On a preview or local origin, ask crawlers to stay out entirely — a staging
  // copy competing with production in search results is a real risk.
  const isProductionHost =
    !host.includes("127.0.0.1") &&
    !host.includes("localhost") &&
    !host.includes("deploy-preview") &&
    !host.includes("--");

  if (!isProductionHost) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      sitemap: absoluteUrl("/sitemap.xml"),
      host,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          // The legacy embedded chat widget is a standalone document that should
          // not compete with the real pages in search results.
          "/ask-ron-bot-main/",
        ],
      },
      {
        // Explicit rule for the AI crawlers that honour it, kept separate so the
        // policy for them can diverge from the general rule later.
        userAgent: ["GPTBot", "CCBot", "Google-Extended"],
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host,
  };
}
