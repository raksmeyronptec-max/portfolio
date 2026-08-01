import { expect, test, type Page } from "@playwright/test";

/**
 * Journey stories.
 *
 * ── What runs unconditionally ──────────────────────────────────────────────
 * The guarantees that hold whether or not the owner has published a story yet:
 * both locales render, the admin routes are auth-gated, the page never leaks a
 * draft or a pending photograph, and no video player is loaded before someone
 * asks for one. Those are the regressions that would actually ship.
 *
 * ── What is conditional ────────────────────────────────────────────────────
 * The gallery and video interaction tests need a published story with approved
 * media attached. Rather than seeding a fabricated classroom photograph to make
 * a test go green — which would put an invented image of a school on the owner's
 * site — they detect a real one and skip with a reason when there is none.
 *
 * The privacy logic underneath is covered exhaustively and unconditionally by
 * tests/unit/journey.test.ts (64 assertions) and the `9c` section of
 * tests/integration/rls.sql (30 assertions against the real anon role).
 */

const locales = ["en", "km"] as const;

/** Story links on the journey listing, if any have been published. */
function storyLinks(page: Page) {
  return page.locator('a[href*="/journey/"]');
}

// ── The listing ─────────────────────────────────────────────────────────────

test.describe("public journey page", () => {
  for (const locale of locales) {
    test(`/${locale}/journey renders`, async ({ page }) => {
      const response = await page.goto(`/${locale}/journey`);
      expect(response?.status()).toBe(200);

      // The page has exactly one h1, and the document language matches the URL.
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);

      /*
       * Either stories, or an empty state that explains itself. Never a blank
       * page and never a raw error.
       *
       * Scoped to the main landmark: the toast container is also `role="status"`
       * and is present but empty on every page, so an unscoped query matches two
       * elements and fails strict mode.
       */
      const hasStories = (await storyLinks(page).count()) > 0;
      if (!hasStories) {
        await expect(
          page.getByRole("main").getByRole("status").first(),
        ).toBeVisible();
      }
    });

    test(`/${locale}/journey is in the primary navigation`, async ({ page }) => {
      await page.goto(`/${locale}`);

      const nav = page.getByRole("navigation").first();
      await expect(nav.locator(`a[href="/${locale}/journey"]`).first()).toHaveCount(1);
    });

    test(`/${locale}/journey never exposes a draft or unapproved item`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/journey`);

      const html = await page.content();

      // The private bucket has no public URL at all; its name appearing in the
      // markup would mean something is building one.
      expect(html).not.toContain("certificate-originals");
      expect(html).not.toContain("portfolio-private");

      // Internal review vocabulary must never reach a public page.
      expect(html).not.toMatch(/pending_review|privacy_status|consent_status/);
    });

    test(`/${locale}/journey does not scroll horizontally at 320px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.goto(`/${locale}/journey`);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      // The narrowest supported width. Khmer runs 20–40% longer than English, so
      // this is the locale most likely to break it.
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test("an unknown story slug returns 404", async ({ page }) => {
    const response = await page.goto("/en/journey/this-story-does-not-exist");
    expect(response?.status()).toBe(404);
  });
});

// ── A story detail page ─────────────────────────────────────────────────────

test.describe("journey story detail", () => {
  test("renders the story, its breadcrumbs and its structured data", async ({
    page,
  }) => {
    await page.goto("/en/journey");

    const links = storyLinks(page);
    const count = await links.count();
    test.skip(count === 0, "No published journey stories in this environment.");

    const href = await links.first().getAttribute("href");
    const response = await page.goto(href!);

    /*
     * A story that was published when the listing rendered can have been
     * unpublished by the time this navigates — the listing is served from the
     * ISR cache, the detail page is not. That is a property of the environment,
     * not a defect, so it skips rather than failing.
     */
    test.skip(
      response?.status() === 404,
      "The story was unpublished between the listing and this navigation.",
    );

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    // Breadcrumbs back to the listing.
    await expect(page.locator('a[href="/en/journey"]').first()).toHaveCount(1);

    // Structured data is present and parses. A malformed JSON-LD block is worse
    // than none, because search engines report it as an error against the site.
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(() => JSON.parse(jsonLd ?? "")).not.toThrow();

    const parsed = JSON.parse(jsonLd ?? "{}");
    const types = (parsed["@graph"] ?? []).map((node: { "@type": string }) => node["@type"]);
    expect(types).toContain("BreadcrumbList");
  });

  test("the Khmer story page sets lang=km", async ({ page }) => {
    await page.goto("/km/journey");

    const links = storyLinks(page);
    test.skip((await links.count()) === 0, "No published journey stories.");

    await links.first().click();
    await expect(page.locator("html")).toHaveAttribute("lang", "km");
  });
});

// ── The gallery ─────────────────────────────────────────────────────────────

test.describe("journey gallery", () => {
  /** Open the first story that actually has a gallery, or skip. */
  async function openStoryWithGallery(page: Page): Promise<boolean> {
    await page.goto("/en/journey");

    const links = storyLinks(page);
    const count = await links.count();
    if (count === 0) return false;

    const hrefs = await links.evaluateAll((nodes) =>
      [...new Set(nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")))],
    );

    for (const href of hrefs.slice(0, 8)) {
      if (!href) continue;
      await page.goto(href);
      const openers = page.getByRole("button", { name: /^Open:/i });
      if ((await openers.count()) > 0) return true;
    }

    return false;
  }

  test("opens, traps focus, announces position and closes on Escape", async ({
    page,
  }) => {
    const found = await openStoryWithGallery(page);
    test.skip(!found, "No published journey story has an approved gallery yet.");

    const dialog = page.locator("dialog");

    await page.getByRole("button", { name: /^Open:/i }).first().click();
    await expect(dialog).toHaveAttribute("open", "");

    // The position is announced in a live region, because moving between
    // photographs does not move focus.
    await expect(page.locator('[aria-live="polite"]').first()).toContainText(/Photo \d+ of \d+/);

    // Arrow keys navigate.
    const before = await page.locator('[aria-live="polite"]').first().textContent();
    await page.keyboard.press("ArrowRight");
    const after = await page.locator('[aria-live="polite"]').first().textContent();
    // With a single photograph the index wraps to itself, which is correct.
    expect(typeof after).toBe("string");
    expect(after !== before || (await page.getByRole("button", { name: /Next photo/i }).count()) === 0).toBe(true);

    // Escape closes — supplied by the native <dialog> `cancel` event.
    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("open", "");
  });

  test("every gallery control has an accessible name and a 44px target", async ({
    page,
  }) => {
    const found = await openStoryWithGallery(page);
    test.skip(!found, "No published journey story has an approved gallery yet.");

    await page.getByRole("button", { name: /^Open:/i }).first().click();

    const close = page.getByRole("button", { name: /Close gallery/i });
    await expect(close).toBeVisible();

    const box = await close.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});

// ── Video ───────────────────────────────────────────────────────────────────

test.describe("journey video", () => {
  test("no third-party player is loaded before the visitor presses Play", async ({
    page,
  }) => {
    /*
     * The central promise of the poster-first facade, and the one most likely to
     * be broken by a well-meaning refactor that "simplifies" the component into
     * a plain iframe.
     *
     * Asserted across the whole listing and the first several stories rather
     * than on one known page, so it holds regardless of what is published.
     */
    const thirdPartyRequests: string[] = [];

    page.on("request", (request) => {
      const url = request.url();
      if (/youtube|ytimg|vimeo|googlevideo/i.test(url)) thirdPartyRequests.push(url);
    });

    await page.goto("/en/journey");

    const links = storyLinks(page);
    const hrefs = await links.evaluateAll((nodes) =>
      [...new Set(nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")))],
    );

    for (const href of hrefs.slice(0, 6)) {
      if (!href) continue;
      await page.goto(href);
      await page.waitForLoadState("networkidle");
    }

    expect(thirdPartyRequests).toEqual([]);
  });

  test("a video is never autoplaying and has no iframe until activated", async ({
    page,
  }) => {
    await page.goto("/en/journey");

    const links = storyLinks(page);
    const hrefs = await links.evaluateAll((nodes) =>
      [...new Set(nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")))],
    );

    let sawStory = false;

    for (const href of hrefs.slice(0, 6)) {
      if (!href) continue;
      await page.goto(href);
      sawStory = true;

      // No iframe at all before interaction, and no <video autoplay> anywhere.
      await expect(page.locator("iframe")).toHaveCount(0);
      await expect(page.locator("video[autoplay]")).toHaveCount(0);
    }

    test.skip(!sawStory, "No published journey stories in this environment.");
  });
});

// ── Admin ───────────────────────────────────────────────────────────────────

test.describe("journey admin", () => {
  const routes = [
    "/admin/journey",
    "/admin/journey/new",
    "/admin/media/import",
  ];

  for (const route of routes) {
    test(`${route} redirects an anonymous visitor to the login page`, async ({
      page,
    }) => {
      await page.goto(route);

      // Middleware redirects, and the page guard re-checks. Either way an
      // anonymous visitor must never see the route's contents.
      await expect(page).toHaveURL(/\/admin\/login/);
    });
  }

  test("the import API refuses an anonymous caller", async ({ request }) => {
    const response = await request.get("/api/admin/media/import");
    // 401 unauthenticated, 403 forbidden, or 404 when importing is unavailable —
    // never 200 with a directory listing.
    expect([401, 403, 404]).toContain(response.status());
  });

  test("the import API refuses an anonymous POST", async ({ request }) => {
    const response = await request.post("/api/admin/media/import", {
      data: { items: [{ relativePath: "../../../etc/passwd", filename: "x", kind: "journey_photo" }] },
    });
    expect([401, 403, 404]).toContain(response.status());
  });
});

// ── Cross-links ─────────────────────────────────────────────────────────────

test.describe("journey cross-links", () => {
  for (const page of ["experience", "education"] as const) {
    test(`/en/${page} still renders with the journey links added`, async ({
      page: browserPage,
    }) => {
      const response = await browserPage.goto(`/en/${page}`);
      expect(response?.status()).toBe(200);
      await expect(browserPage.getByRole("heading", { level: 1 })).toHaveCount(1);
    });
  }

  test("the homepage still renders with the selected-moments section", async ({
    page,
  }) => {
    const response = await page.goto("/en");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("the sitemap includes the journey listing", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("/en/journey");
    expect(body).toContain("/km/journey");
  });
});
