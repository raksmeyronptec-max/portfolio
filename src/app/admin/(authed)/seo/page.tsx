import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { SeoManager } from "@/components/admin/seo-manager";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Notice } from "@/components/ui/states";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { listSeoOverrides } from "@/lib/data/admin-cv";
import { getContentHealth } from "@/lib/data/admin";
import { siteUrl } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "SEO" };
export const dynamic = "force-dynamic";

/** Routes with a metadata override. Project and certificate SEO lives on the record. */
const ROUTE_KEYS = [
  { key: "home", label: "Homepage", path: "" },
  { key: "projects", label: "Projects list", path: "projects" },
  { key: "certificates", label: "Certificates list", path: "certificates" },
  { key: "about", label: "About", path: "about" },
  { key: "experience", label: "Experience", path: "experience" },
  { key: "education", label: "Education", path: "education" },
  { key: "resume", label: "Resume", path: "resume" },
  { key: "contact", label: "Contact", path: "contact" },
] as const;

export default async function AdminSeoPage() {
  const session = await requirePermission("editContent", "/admin/seo");

  const [overrides, health] = await Promise.all([
    listSeoOverrides(),
    getContentHealth(),
  ]);

  const missingDescriptions = health?.missing_seo_description ?? [];

  return (
    <>
      <AdminPageHeader
        title="SEO"
        description="Per-route metadata for the static pages. Projects and certificates carry their own SEO fields on the record itself, so they are edited there."
      />

      <AdminPageBody className="flex flex-col gap-6">
        <Notice tone="info" icon="globe" title="What is automatic">
          <p>
            Canonical URLs, <code>hreflang</code> pairs including{" "}
            <code>x-default</code>, Open Graph tags, Twitter cards, JSON-LD and the
            sitemap are all generated from content — you do not maintain them by hand.
            These overrides only replace the derived title and description where you
            want different wording. Everything resolves against{" "}
            <code>{siteUrl()}</code>.
          </p>
        </Notice>

        {missingDescriptions.length > 0 ? (
          <Notice
            tone="warning"
            icon="alertTriangle"
            title={`${missingDescriptions.length} published page${missingDescriptions.length === 1 ? "" : "s"} without an SEO description`}
          >
            <p>
              Without one, search engines write their own snippet from whatever text
              they find. Affected:{" "}
              {missingDescriptions
                .slice(0, 6)
                .map((item) => `${item.slug} (${item.locale})`)
                .join(", ")}
              {missingDescriptions.length > 6
                ? ` +${missingDescriptions.length - 6} more`
                : ""}
              .
            </p>
          </Notice>
        ) : null}

        <SeoManager
          routes={ROUTE_KEYS.map((route) => ({ ...route }))}
          overrides={overrides}
          canEdit={permissions.editContent(session.role)}
        />

        <Card>
          <CardHeader>
            <h2 className="text-h4 font-semibold">Generated files</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-2 text-small">
            <p className="text-foreground-muted">
              Both are generated from published content and refresh when you publish.
            </p>
            <ul className="flex flex-col gap-1">
              <li>
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  /sitemap.xml
                </a>
                <span className="text-foreground-muted">
                  {" "}
                  — published pages, projects and certificates in both languages
                </span>
              </li>
              <li>
                <a
                  href="/robots.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  /robots.txt
                </a>
                <span className="text-foreground-muted">
                  {" "}
                  — disallows /admin and /api; blocks everything on preview hosts
                </span>
              </li>
            </ul>
          </CardBody>
        </Card>
      </AdminPageBody>
    </>
  );
}
