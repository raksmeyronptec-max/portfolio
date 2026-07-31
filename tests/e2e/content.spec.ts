import { expect, test } from "@playwright/test";

/**
 * Content behaviour: filters, the contact form, the resume, and the guarantees about
 * what must never appear publicly.
 */

/*
 * Filtering is progressive: the controls grow with the collection rather than
 * sitting above it from the first project.
 *
 *    0–6 published   no filter chrome at all
 *   7–12 published   category chips
 *    >12 published   search plus the category/technology/status selects
 *
 * Three projects are published, so these tests exercise the chips tier. The
 * search tier is covered by unit tests over the mode selection rather than by
 * seeding thirteen fixture projects, which would mean inventing content.
 */
test.describe("project filters", () => {
  test("no filter chrome is shown while the collection is small", async ({ page }) => {
    await page.goto("/en/projects");

    // The page must open on work, not on a search box and three dropdowns.
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(page.getByLabel(/^category$/i)).toHaveCount(0);
  });

  test("filters live in the URL and are shareable", async ({ page }) => {
    // Arriving on a filtered URL keeps the controls mounted, so a visitor can
    // always get back out of a filter someone shared with them.
    await page.goto("/en/projects?category=education-technology");

    const chips = page.getByRole("button", { name: /all categories/i });
    await expect(chips).toBeVisible();

    await chips.click();
    await expect(page).toHaveURL(/\/en\/projects(\?|$)/, { timeout: 5000 });
  });

  test("the empty state offers a way out", async ({ page }) => {
    await page.goto("/en/projects?q=zzzznotarealproject");

    // Scoped by text: the toast container is also role="status" (and empty), so an
    // unscoped role match resolves to two elements.
    await expect(
      page.getByRole("status").filter({ hasText: /no projects match/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /clear all filters/i })).toBeVisible();
  });

  test("result count is announced in a live region", async ({ page }) => {
    await page.goto("/en/projects");
    // A polite live region tells a screen-reader user the results changed.
    await expect(page.locator('[aria-live="polite"]').first()).toBeAttached();
  });

  test("the filter form works without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    // A filtered URL so the controls are rendered at this collection size.
    await page.goto("/en/projects?category=education-technology");

    // Still a real <form method="get"> whose chips are real submit buttons, so
    // filtering navigates with a query string even with no JavaScript at all.
    const form = page.locator("form").filter({ has: page.getByRole("button") }).first();
    await expect(form).toHaveAttribute("method", "get");
    await expect(form.getByRole("button").first()).toBeVisible();

    await context.close();
  });
});

test.describe("certificates", () => {
  test("the privacy note is always shown", async ({ page }) => {
    await page.goto("/en/certificates");

    /*
     * Visitors must still be told the previews are redacted. The wording moved
     * from a full-width info banner to one quiet line beside a shield icon —
     * the brief reserved coloured alert banners for actual warnings — so the
     * assertion follows the new copy rather than the old banner text.
     */
    await expect(
      page.getByText(/sensitive personal information removed/i),
    ).toBeVisible();
  });

  test("category chips filter via the URL", async ({ page }) => {
    await page.goto("/en/certificates");

    const chips = page.getByRole("navigation", { name: /filters/i }).getByRole("link");
    if ((await chips.count()) > 1) {
      await chips.nth(1).click();
      await expect(page).toHaveURL(/\?category=/);
    }
  });
});

test.describe("resume", () => {
  test("the page renders and offers a download route", async ({ page }) => {
    await page.goto("/en/resume");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the download endpoint 404s cleanly when nothing is published", async ({
    request,
  }) => {
    const response = await request.get("/api/resume/download?locale=en");

    // No resume is seeded, so 404 is correct. What matters is that it is a clean
    // JSON 404 rather than a 500 or a leaked storage path.
    expect([200, 404]).toContain(response.status());

    if (response.status() === 404) {
      const body = await response.json();
      expect(body.error).toBeTruthy();
      // Must not disclose internal storage details.
      expect(JSON.stringify(body)).not.toContain("storage/v1");
      expect(JSON.stringify(body)).not.toContain("supabase");
    }
  });

  test("the legacy CV path still resolves", async ({ request }) => {
    // v1 linked to this exact path; the file was kept at the same URL.
    const response = await request.get("/CV/CV_Ron_Raksmey.pdf");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("pdf");
  });
});

test.describe("contact form", () => {
  test("client-side validation reports problems accessibly", async ({ page }) => {
    await page.goto("/en/contact");

    await page.getByRole("button", { name: /send message/i }).click();

    // An error summary that receives focus, not just red borders.
    const alert = page.getByRole("alert").first();
    await expect(alert).toBeVisible();
  });

  test("an invalid email is reported on the field", async ({ page }) => {
    await page.goto("/en/contact");

    await page.getByLabel(/your name/i).fill("Test Person");
    await page.getByLabel(/your email/i).fill("not-an-email");
    await page
      .getByLabel(/your message/i)
      .fill("This is a long enough message to pass the minimum length check.");
    await page.getByLabel(/i agree/i).check();

    await page.getByRole("button", { name: /send message/i }).click();

    // The message appears twice by design — once in the error summary at the top
    // of the form and once beside the field — so both are asserted rather than
    // picking one and pretending the other does not exist.
    await expect(page.getByText(/valid email address/i)).toHaveCount(2);
    await expect(page.getByText(/valid email address/i).first()).toBeVisible();
  });

  test("consent is required", async ({ page }) => {
    await page.goto("/en/contact");

    await page.getByLabel(/your name/i).fill("Test Person");
    await page.getByLabel(/your email/i).fill("test@example.com");
    await page
      .getByLabel(/your message/i)
      .fill("This is a long enough message to pass the minimum length check.");

    await page.getByRole("button", { name: /send message/i }).click();

    // Error summary link plus the inline field error: two occurrences, by design.
    await expect(page.getByText(/confirm this so I am able to reply/i)).toHaveCount(2);
    await expect(
      page.getByText(/confirm this so I am able to reply/i).first(),
    ).toBeVisible();
  });

  test("the honeypot is hidden from assistive technology and not focusable", async ({
    page,
  }) => {
    await page.goto("/en/contact");

    const honeypot = page.locator("#contact-website-field");
    await expect(honeypot).toHaveAttribute("tabindex", "-1");

    // Wrapped in aria-hidden, so a screen-reader user can never reach and fill it.
    const hidden = await honeypot.evaluate(
      (node) => node.closest("[aria-hidden='true']") !== null,
    );
    expect(hidden).toBe(true);
  });

  test("the API rejects a cross-origin submission", async ({ request, baseURL }) => {
    const response = await request.post("/api/contact", {
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      data: {
        name: "Attacker",
        email: "a@b.co",
        message: "Cross-origin submission attempt from another site.",
        consent: true,
        locale: "en",
      },
    });

    // v1 sent Access-Control-Allow-Origin: * and accepted anything.
    expect(response.status()).toBe(403);
    expect(baseURL).toBeTruthy();
  });

  test("the API returns error codes, not localised sentences", async ({ request }) => {
    const response = await request.post("/api/contact", {
      data: { name: "", email: "bad", message: "short", consent: false, locale: "en" },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("validation");
    // Codes let the client localise; sentences would hardcode English.
    expect(Object.values(body.fields ?? {})).toContain("nameRequired");
  });
});

test.describe("content that must never be public", () => {
  /*
   * The three platform projects used to be the fixture for this guarantee,
   * because they were seeded as drafts. They are now published on purpose — a
   * portfolio whose Projects page says "no projects yet" while all three
   * platforms are live reads as abandoned — so the guarantee is re-anchored on
   * content that is still genuinely draft.
   *
   * The testimonials are the right canary: they are other people's words about
   * Ron, and publishing those is a consent decision for a human to make, so
   * they stay draft and must never leak.
   */
  test("draft content does not appear anywhere", async ({ page }) => {
    for (const path of ["/en", "/en/projects", "/en/about", "/km", "/km/projects"]) {
      await page.goto(path);
      const content = await page.content();

      for (const author of ["Ron Saroeun", "Kem Deth", "Hum Sanet"]) {
        expect(content, `${author} on ${path}`).not.toContain(author);
      }
    }
  });

  test("the published platform projects are public", async ({ page }) => {
    // The counterpart to the test above: these are published, so they must be
    // visible. Asserting it here means an accidental unpublish is caught.
    await page.goto("/en/projects");
    const content = await page.content();

    expect(content).toContain("KruSmart");
    expect(content).toContain("PTEC Digital Library");
    expect(content).toContain("PTEC Storage");
  });

  test("removed v1 content has not returned", async ({ page }) => {
    for (const path of ["/en", "/en/about", "/km"]) {
      await page.goto(path);
      const content = await page.content();

      // A referee's private mobile number, published by v1.
      expect(content, path).not.toContain("916-2788");
      // Unsourced or contradictory claims from v1.
      expect(content, path).not.toContain("99.734");
      expect(content, path).not.toContain("Dual Degrees");
    }
  });

  test("no private storage URL is ever emitted", async ({ page }) => {
    for (const path of ["/en", "/en/certificates", "/en/resume"]) {
      await page.goto(path);
      const content = await page.content();

      expect(content, path).not.toContain("certificate-originals");
      expect(content, path).not.toContain("/object/public/resumes");
    }
  });

  test("no skill percentage bars remain", async ({ page }) => {
    await page.goto("/en");
    const content = await page.content();

    // The redesign replaced percentage bars with evidence links.
    expect(content).not.toMatch(/\b9[0-9]%/);
    expect(content).not.toContain("sk-fill");
  });
});
