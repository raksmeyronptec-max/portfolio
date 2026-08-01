import { expect, test } from "@playwright/test";

/**
 * Publications — the public surface, end to end.
 *
 * The assertions that matter most here are the negative ones. A listing that
 * renders is easy to eyeball; a download route that quietly serves a file it
 * should not is not, and it is the failure this feature has to be built against.
 *
 * These run against seeded data, so they assert *behaviour that holds whatever
 * is published* rather than specific titles — except where the seed is the
 * point, as with the draft that must stay invisible.
 */

test.describe("publications listing", () => {
  test("renders in both locales with the right heading and language", async ({ page }) => {
    await page.goto("/en/publications");
    await expect(page.getByRole("heading", { name: "Publications", level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.goto("/km/publications");
    await expect(page.locator("html")).toHaveAttribute("lang", "km");
    // The Khmer navigation label, which is also the page's own title.
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ស្នាដៃនិពន្ធ");
  });

  test("is reachable from the primary navigation", async ({ page }) => {
    await page.goto("/en");
    await page
      .getByRole("navigation")
      .first()
      .getByRole("link", { name: "Publications" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/publications$/);
  });

  test("does not list an unpublished publication", async ({ page }) => {
    /*
     * The seed leaves the examination collection as a draft with its privacy
     * review pending. It must not appear anywhere public.
     */
    await page.goto("/en/publications");
    await expect(page.getByText("Mathematics Examination Collection")).toHaveCount(0);
  });

  test("a draft publication's own URL is a 404, not a 403", async ({ page }) => {
    // 403 would confirm the book exists and is being worked on.
    const response = await page.goto("/en/publications/mathematics-examination-collection");
    expect(response?.status()).toBe(404);
  });
});

test.describe("publication detail", () => {
  test("shows the book's own title with its own lang attribute", async ({ page }) => {
    await page.goto("/en/publications/sequences-of-real-numbers");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    /*
     * The Khmer original on an English page must carry `lang="km"`, or a screen
     * reader pronounces Khmer with English phonetics — the per-string version of
     * the document-level defect docs/AUDIT.md records from v1.
     */
    const khmer = page.locator('[lang="km"]').filter({ hasText: "ស្វ៊ីតនៃចំនួនពិត" });
    await expect(khmer.first()).toBeVisible();
  });

  test("builds a citation from verified metadata and nothing else", async ({ page }) => {
    await page.goto("/en/publications/sequences-of-real-numbers");

    const citation = page.getByText(/Ron Raksmey\./).first();
    await expect(citation).toBeVisible();

    // No invented publisher, place or date.
    const text = (await citation.textContent()) ?? "";
    expect(text).not.toMatch(/n\.d\.|n\.p\.|undefined|null|Press|Publisher/i);
  });

  test("offers no download when the policy does not allow one", async ({ page }) => {
    await page.goto("/en/publications/sequences-of-real-numbers");
    await expect(page.getByRole("link", { name: /Download the PDF/i })).toHaveCount(0);
  });

  test("never exposes a LaTeX source control publicly", async ({ page }) => {
    await page.goto("/en/publications/sequences-of-real-numbers");
    await expect(page.getByRole("link", { name: /Download the LaTeX source/i })).toHaveCount(0);
  });
});

test.describe("file access is decided by the route, not the link", () => {
  test("refuses a PDF download when the policy is not open", async ({ request }) => {
    const response = await request.get(
      "/api/publications/sequences-of-real-numbers/download?file=pdf",
      { maxRedirects: 0 },
    );
    expect(response.status()).toBe(403);
  });

  test("never serves the archival original to an anonymous caller", async ({ request }) => {
    /*
     * There is no policy value that opens this. A reader has no business with
     * the unredacted file, whatever the publication's settings say.
     */
    const response = await request.get(
      "/api/publications/sequences-of-real-numbers/download?file=original",
      { maxRedirects: 0 },
    );
    expect([401, 403]).toContain(response.status());
  });

  test("refuses an inline preview the policy does not permit", async ({ request }) => {
    const response = await request.get("/api/publications/sequences-of-real-numbers/preview");
    expect(response.status()).toBe(403);
  });

  test("rejects an unknown file slot rather than guessing", async ({ request }) => {
    const response = await request.get(
      "/api/publications/sequences-of-real-numbers/download?file=../../secret",
    );
    expect(response.status()).toBe(400);
  });

  test("treats a draft publication's files as absent", async ({ request }) => {
    const response = await request.get(
      "/api/publications/mathematics-examination-collection/download?file=pdf",
    );
    expect(response.status()).toBe(404);
  });
});

test.describe("responsive", () => {
  // 320px is the narrowest supported width; the Khmer titles are the long ones.
  test("the Khmer listing does not scroll horizontally at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/km/publications");

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });

  test("the detail page does not scroll horizontally at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/km/publications/sequences-of-real-numbers");

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});

test.describe("sitemap", () => {
  test("lists published publications and omits drafts", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    const xml = await response.text();

    expect(xml).toContain("/en/publications");
    expect(xml).toContain("/km/publications");
    expect(xml).not.toContain("mathematics-examination-collection");
  });
});
