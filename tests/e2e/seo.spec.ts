import { expect, test } from "@playwright/test";

/**
 * SEO output.
 *
 * Each assertion maps to a defect the audit found in v1: a canonical pointing at the
 * wrong host, a relative `og:image`, no hreflang, no sitemap, no robots.txt, and no
 * structured data at all.
 */

test.describe("metadata", () => {
  test("every public page has a unique title and description", async ({ page }) => {
    const seen = new Map<string, string>();

    for (const path of [
      "/en",
      "/en/projects",
      "/en/certificates",
      "/en/about",
      "/en/experience",
      "/en/education",
      "/en/resume",
      "/en/contact",
    ]) {
      await page.goto(path);

      const title = await page.title();
      expect(title.length, `${path} has a title`).toBeGreaterThan(10);

      const description = await page
        .locator('meta[name="description"]')
        .getAttribute("content");
      expect(description, `${path} has a description`).toBeTruthy();

      // A duplicate title across pages is a real SEO problem, so it is asserted
      // rather than assumed.
      const previous = seen.get(title);
      expect(previous, `${path} duplicates the title of ${previous}`).toBeUndefined();
      seen.set(title, path);
    }
  });

  test("the canonical URL is absolute, self-referencing and single", async ({ page }) => {
    await page.goto("/en/projects");

    const canonicals = page.locator('link[rel="canonical"]');

    // Exactly one. Two canonicals is the same as none.
    await expect(canonicals).toHaveCount(1);

    const canonical = await canonicals.getAttribute("href");

    /*
     * v1's canonical pointed at ron-raksmey.vercel.app while the site was served
     * from Netlify, so this asserts the shape that bug violated: absolute, and
     * self-referencing for the path being served.
     *
     * It deliberately does NOT compare the host to the Playwright baseURL. The
     * canonical host comes from NEXT_PUBLIC_SITE_URL — that is the point of the
     * setting, and it is correct for it to differ from an ephemeral test port.
     * Asserting otherwise would test the harness, not the site.
     */
    expect(canonical?.startsWith("http")).toBe(true);
    expect(canonical?.endsWith("/en/projects")).toBe(true);
  });

  test("hreflang covers both locales plus x-default", async ({ page }) => {
    await page.goto("/en/about");

    const alternates = page.locator('link[rel="alternate"]');
    const hrefLangs = await alternates.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("hreflang")),
    );

    expect(hrefLangs).toContain("en");
    expect(hrefLangs).toContain("km");
    expect(hrefLangs).toContain("x-default");
  });

  test("hreflang is reciprocal between the two locales", async ({ page }) => {
    const collect = async (path: string) => {
      await page.goto(path);
      return page
        .locator('link[rel="alternate"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            lang: node.getAttribute("hreflang"),
            href: node.getAttribute("href"),
          })),
        );
    };

    const fromEn = await collect("/en/about");
    const fromKm = await collect("/km/about");

    // Non-reciprocal hreflang is ignored by search engines.
    expect(fromEn.find((entry) => entry.lang === "km")?.href).toBe(
      fromKm.find((entry) => entry.lang === "km")?.href,
    );
  });

  test("the Open Graph image is an absolute URL", async ({ page }) => {
    await page.goto("/en");

    const image = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");

    // v1 used a relative path, so social previews had no image at all.
    expect(image?.startsWith("http")).toBe(true);
  });

  test("Open Graph and Twitter cards are present", async ({ page }) => {
    await page.goto("/en");

    for (const property of ["og:title", "og:description", "og:url", "og:type"]) {
      await expect(page.locator(`meta[property="${property}"]`)).toHaveCount(1);
    }

    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  });

  test("the Khmer page declares the Khmer Open Graph locale", async ({ page }) => {
    await page.goto("/km");
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
      "content",
      "km_KH",
    );
  });
});

test.describe("structured data", () => {
  test("the homepage emits a valid JSON-LD graph", async ({ page }) => {
    await page.goto("/en");

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));

    expect(blocks.length).toBeGreaterThan(0);

    const parsed = blocks.map((block) => JSON.parse(block));
    const graph = parsed.flatMap((entry) => entry["@graph"] ?? [entry]);
    const types = graph.map((node: { "@type": string }) => node["@type"]);

    expect(types).toContain("Person");
    expect(types).toContain("WebSite");
    expect(types).toContain("ProfilePage");
  });

  test("JSON-LD contains no null values", async ({ page }) => {
    await page.goto("/en");

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));

    for (const block of blocks) {
      // A null property is an error in structured data; absence is valid.
      expect(block).not.toContain(":null");
      expect(JSON.parse(block)).toBeTruthy();
    }
  });

  test("listing pages emit breadcrumbs", async ({ page }) => {
    await page.goto("/en/projects");

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));

    const types = blocks
      .map((block) => JSON.parse(block))
      .flatMap((entry) => entry["@graph"] ?? [entry])
      .map((node: { "@type": string }) => node["@type"]);

    expect(types).toContain("BreadcrumbList");
  });
});

test.describe("robots and sitemap", () => {
  test("robots.txt keeps crawlers out of the admin area", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("Sitemap:");

    /*
     * Two valid outcomes, because `src/app/robots.ts` deliberately behaves
     * differently off production:
     *
     *  - On a production host it allows `/` and disallows `/admin` and `/api/`.
     *  - On localhost, a deploy preview or a branch subdomain it disallows `/`
     *    entirely, so a staging copy cannot compete with production in search.
     *
     * Both satisfy the actual requirement — the admin area is not crawlable — and
     * a test that only accepted the first would fail against every local run for
     * a reason that is not a defect.
     */
    const blanketDisallow = /^Disallow:\s*\/\s*$/m.test(body);
    expect(blanketDisallow || body.includes("/admin")).toBe(true);

    if (!blanketDisallow) {
      expect(body).toContain("Disallow: /admin");
      expect(body).toContain("Disallow: /api/");
    }
  });

  test("the sitemap is valid XML and excludes admin and api", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");

    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("/en");
    expect(body).toContain("/km");

    // Admin and API must never be advertised for crawling.
    expect(body).not.toContain("/admin");
    expect(body).not.toContain("/api/");
  });

  test("the sitemap carries hreflang alternates", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();
    expect(body).toContain("hreflang");
  });

  test("the sitemap contains no unpublished content", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    // The seeded projects are drafts, so their URLs must be absent.
    expect(body).not.toContain("/projects/krusmart");
    expect(body).not.toContain("/projects/ptec-digital-library");
  });
});

test.describe("heading structure", () => {
  test("each page has exactly one h1", async ({ page }) => {
    for (const path of [
      "/en",
      "/en/projects",
      "/en/certificates",
      "/en/about",
      "/en/experience",
      "/en/education",
      "/en/contact",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1"), `${path} has one h1`).toHaveCount(1);
    }
  });

  test("heading levels are not skipped", async ({ page }) => {
    await page.goto("/en");

    const levels = await page
      .locator("h1, h2, h3, h4, h5, h6")
      .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))));

    // v1 jumped from h2 to h4 inside the About card, which breaks screen-reader
    // navigation by heading level.
    for (let index = 1; index < levels.length; index += 1) {
      const jump = levels[index]! - levels[index - 1]!;
      expect(jump, `heading jump at index ${index}`).toBeLessThanOrEqual(1);
    }
  });
});
