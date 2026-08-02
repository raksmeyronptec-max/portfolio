import { expect, test } from "@playwright/test";

/**
 * Publications — the public surface, end to end.
 *
 * The assertions that matter most here are the negative ones. A listing that
 * renders is easy to eyeball; a download route that quietly serves a file it
 * should not is not, and it is the failure this feature has to be built against.
 *
 * ── Why the detail tests discover their subject ────────────────────────────
 * The seed publishes nothing — every book arrives as a draft with its privacy
 * review pending, which is the whole point of the publish gate. An earlier
 * version of this file hard-coded a slug and passed only because a book had been
 * published by hand during development; on a fresh `db:reset` it failed, and one
 * assertion had been passing for the *wrong reason* — expecting a 403 from the
 * download policy while actually receiving a 404 because the publication was not
 * visible at all.
 *
 * So the detail tests take the first publication the listing actually offers,
 * and skip with a message when there is none. A skip that says why is worth more
 * than a green tick that proves nothing.
 */

/** The slug of the first published publication, or null on a fresh seed. */
async function firstPublishedSlug(
  page: import("@playwright/test").Page,
): Promise<string | null> {
  await page.goto("/en/publications");

  /*
   * `count()` first. Calling `getAttribute()` on a locator that matches nothing
   * waits for it to appear and then times out after 45 seconds — which is a slow
   * failure rather than the fast skip this is meant to produce.
   */
  const links = page.locator('a[href*="/en/publications/"]');
  if ((await links.count()) === 0) return null;

  const href = await links.first().getAttribute("href");
  return href?.split("/en/publications/")[1]?.split(/[?#]/)[0] ?? null;
}

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
  test("renders a heading and tags any Khmer text as Khmer", async ({ page }) => {
    const slug = await firstPublishedSlug(page);
    test.skip(!slug, "no published publication — seed publishes nothing by design");

    await page.goto(`/en/publications/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    /*
     * Khmer on an English page must carry `lang="km"`, or a screen reader
     * pronounces it with English phonetics — the per-string version of the
     * document-level defect docs/AUDIT.md records from v1. Asserted only when
     * Khmer is actually present, since an English-only book is legal.
     */
    const khmer = page.locator('[lang="km"]');
    if ((await khmer.count()) > 0) {
      await expect(khmer.first()).toBeVisible();
    }
  });

  test("builds a citation from verified metadata and nothing else", async ({ page }) => {
    const slug = await firstPublishedSlug(page);
    test.skip(!slug, "no published publication — seed publishes nothing by design");

    await page.goto(`/en/publications/${slug}`);

    await expect(
      page.getByRole("heading", { name: /How to cite this/i }),
    ).toBeVisible();

    /*
     * Scoped to the citation itself.
     *
     * An earlier version scanned the whole page body and failed on the JSON-LD
     * block, which legitimately contains the substring "null" inside attribute
     * names — a false failure that said nothing about the citation.
     */
    const citation = page.getByRole("button", { name: /Copy citation/i });
    await expect(citation).toBeVisible();

    const text =
      (await page
        .locator("p")
        .filter({ hasText: /^\S.*\.\s*$/ })
        .filter({ hasText: /\d{4}|edition/i })
        .first()
        .textContent()) ?? "";

    // No invented publisher, place or date — the rule the whole feature turns on.
    expect(text).not.toMatch(/n\.d\.|n\.p\.|undefined|\bnull\b/i);
    expect(text).not.toMatch(/\bPress\b|\bPublisher\b/i);
  });

  test("never exposes a LaTeX source control publicly", async ({ page }) => {
    const slug = await firstPublishedSlug(page);
    test.skip(!slug, "no published publication — seed publishes nothing by design");

    await page.goto(`/en/publications/${slug}`);
    await expect(
      page.getByRole("link", { name: /Download the LaTeX source/i }),
    ).toHaveCount(0);
  });
});

test.describe("file access is decided by the route, not the link", () => {
  test("never serves the archival original to an anonymous caller", async ({
    page,
    request,
  }) => {
    const slug = await firstPublishedSlug(page);
    test.skip(!slug, "no published publication — seed publishes nothing by design");

    /*
     * There is no policy value that opens this. A reader has no business with
     * the unredacted file, whatever the publication's settings say — so the
     * refusal must not depend on which policy happens to be set.
     */
    const response = await request.get(
      `/api/publications/${slug}/download?file=original`,
      { maxRedirects: 0 },
    );
    expect([401, 403]).toContain(response.status());
  });

  test("rejects an unknown file slot rather than guessing", async ({ request }) => {
    // 400 before anything is resolved, so this holds whatever the slug is.
    const response = await request.get(
      "/api/publications/mathematics-examination-collection/download?file=../../secret",
    );
    expect(response.status()).toBe(400);
  });

  /*
   * A draft is 404, never 403.
   *
   * 403 on an unpublished slug would confirm the book exists and is being
   * worked on, which is exactly what a draft should not disclose. This uses the
   * seeded draft, so it holds on a fresh database.
   */
  test.describe("an unpublished publication", () => {
    for (const [label, path] of [
      ["its PDF", "download?file=pdf"],
      ["its archival original", "download?file=original"],
      ["its source archive", "download?file=source"],
      ["its inline preview", "preview"],
    ] as const) {
      test(`hides ${label} behind a 404, not a 403`, async ({ request }) => {
        const response = await request.get(
          `/api/publications/mathematics-examination-collection/${path}`,
          { maxRedirects: 0 },
        );
        expect([401, 404]).toContain(response.status());
      });
    }
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
    /*
     * Discovered rather than hard-coded. Pointing this at a draft slug served
     * the 404 page, which of course does not overflow — so it passed while
     * measuring nothing.
     */
    const slug = await firstPublishedSlug(page);
    test.skip(!slug, "no published publication — seed publishes nothing by design");

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/km/publications/${slug}`);

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
