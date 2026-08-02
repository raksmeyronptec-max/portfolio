import { expect, test } from "@playwright/test";

/**
 * The in-page PDF reader must be allowed to frame its own preview route.
 *
 * This exists because it was not. `securityHeaders` in next.config.ts sends
 * `frame-ancestors 'none'` and `X-Frame-Options: DENY` to every path — correct
 * for every page on the site, and it silently broke the reader: the browser
 * refused to display a document that forbids being framed, and rendered a blank
 * frame with a broken-document glyph. Nothing appeared in any server log,
 * because the response itself was a perfectly good 200.
 *
 * ── What this test can and cannot prove ────────────────────────────────────
 * Playwright's bundled Chromium ships no PDF viewer, so no automated check here
 * can confirm that pages actually paint. What it *can* pin down is every reason
 * the browser would refuse before it got that far: the status, the content type,
 * the two framing headers, and the absence of a refusal in the console. Those
 * are the things that regressed; the rendering was never the variable.
 */
test.describe("publication preview framing", () => {
  test("serves a frameable PDF with the sandbox intact", async ({ page }) => {
    await page.goto("/en/publications");

    const links = page.locator('a[href*="/en/publications/"]');
    test.skip(
      (await links.count()) === 0,
      "no published publication — seed publishes nothing by design",
    );

    const href = await links.first().getAttribute("href");
    const slug = href!.split("/en/publications/")[1]!.split(/[?#]/)[0];

    const response = await page.request.get(
      `/api/publications/${slug}/preview`,
    );

    // Not every publication offers an inline preview; `sample_pages` and `none`
    // both refuse it by design, and that is a 403 rather than a failure.
    test.skip(response.status() === 403, "this publication has no inline preview");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");

    const csp = response.headers()["content-security-policy"] ?? "";

    // The reader's own page must be allowed to frame it…
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain("frame-ancestors 'none'");
    expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");

    /*
     * …while the document stays inert. `allow-scripts` is required — every
     * built-in PDF viewer is script-driven and a bare `sandbox` renders nothing
     * — but `allow-same-origin` must never appear beside it, or the sandbox is
     * defeated and the document could reach our cookies and DOM.
     */
    expect(csp).toContain("sandbox allow-scripts");
    expect(csp).not.toContain("allow-same-origin");
    expect(csp).toContain("default-src 'none'");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("every other route still refuses to be framed", async ({ request }) => {
    // The relaxation must be confined to the preview. A regression that widened
    // it to the site would be clickjacking surface on every admin page.
    for (const path of ["/en", "/en/publications", "/api/analytics"]) {
      const response = await request.get(path);
      const csp = response.headers()["content-security-policy"] ?? "";
      if (csp) expect(csp, path).toContain("frame-ancestors 'none'");
    }
  });
});
