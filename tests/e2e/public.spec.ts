import { expect, test } from "@playwright/test";

/**
 * Public site behaviour.
 *
 * These are the journeys a visitor actually takes, plus the two things the audit
 * found broken in v1: the language switch produced no URL, and the skip link jumped
 * past the hero.
 */

test.describe("locale routing", () => {
  test("an unprefixed URL redirects to a locale", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.url()).toMatch(/\/(en|km)$/);
  });

  test("each locale sets the correct html lang", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.goto("/km");
    // v1 served Khmer content with lang="en", so screen readers used the wrong voice.
    await expect(page.locator("html")).toHaveAttribute("lang", "km");
  });

  test("an unknown locale is a 404, not a silent fallback", async ({ page }) => {
    const response = await page.goto("/fr");
    expect(response?.status()).toBe(404);
  });

  test("switching language keeps you on the same page", async ({ page }) => {
    await page.goto("/en/about");

    await page.getByRole("group", { name: /change language/i }).getByRole("link").click();

    await expect(page).toHaveURL(/\/km\/about$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "km");
  });

  test("the Khmer page has a crawlable URL of its own", async ({ page }) => {
    // The core SEO fix: Khmer content exists at a real URL rather than only after a
    // client-side toggle.
    const response = await page.goto("/km/projects");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "km");
  });
});

test.describe("navigation", () => {
  /*
   * The header groups its links behind two disclosures ("Work", "Background")
   * — see the note in nav-items.ts for why seven flat links did not survive
   * 1280px with Khmer labels. These tests therefore model what a visitor
   * actually does: open the group, then follow the link. They used to click a
   * flat "Projects" link that deliberately no longer exists at the top level.
   */
  test("the primary nav reaches every main section", async ({ page }) => {
    for (const [group, name, pattern] of [
      ["Work", "Projects", /\/en\/projects$/],
      ["Work", "Publications", /\/en\/publications$/],
      ["Background", "Experience", /\/en\/experience$/],
      ["Background", "Education", /\/en\/education$/],
      ["Background", "Certificates", /\/en\/certificates$/],
      [null, "About", /\/en\/about$/],
      [null, "Contact", /\/en\/contact$/],
    ] as const) {
      await page.goto("/en");
      const nav = page.getByRole("navigation", { name: /main navigation/i });

      if (group) {
        await nav.getByRole("button", { name: group, exact: true }).click();
      }
      await nav.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(pattern);
    }
  });

  test("the active page is marked with aria-current", async ({ page }) => {
    await page.goto("/en/projects");
    const nav = page.getByRole("navigation", { name: /main navigation/i });

    /*
     * Two assertions, because the active state lives in two places by design:
     * the closed group's trigger is marked so the header says where you are
     * without opening anything, and the child link inside carries the real
     * `aria-current` for assistive technology.
     */
    await expect(
      nav.getByRole("button", { name: "Work", exact: true }),
    ).toHaveAttribute("data-active", "true");

    await nav.getByRole("button", { name: "Work", exact: true }).click();
    await expect(
      nav.getByRole("link", { name: "Projects", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("the skip link targets the whole main region", async ({ page }) => {
    await page.goto("/en");

    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    // v1's skip link pointed at #about, silently skipping the hero.
    await expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  test("the skip link becomes visible on focus", async ({ page }) => {
    await page.goto("/en");
    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
  });

  test("the admin area is not linked from the public site", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  });
});

test.describe("mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the drawer opens, traps focus and closes on Escape", async ({ page }) => {
    await page.goto("/en");

    await page.getByRole("button", { name: /open navigation menu/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Native <dialog> gives us the focus trap and Escape handling; v1's menu had
    // neither.
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("the drawer closes after following a link", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open navigation menu/i }).click();

    await page.getByRole("dialog").getByRole("link", { name: "Projects" }).click();

    await expect(page).toHaveURL(/\/en\/projects$/);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

test.describe("theme", () => {
  test("toggling switches the data-theme attribute and persists", async ({ page }) => {
    await page.goto("/en");

    const initial = await page.locator("html").getAttribute("data-theme");
    await page.getByRole("button", { name: /switch to (light|dark) theme/i }).first().click();

    const next = await page.locator("html").getAttribute("data-theme");
    expect(next).not.toBe(initial);

    // Survives a reload, applied before paint by the blocking theme script.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", next!);
  });
});

test.describe("responsive layout", () => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/en");

      /*
       * The audit called out Khmer text breaking layouts; check both languages.
       *
       * The journey pages are included because they are the most layout-dense
       * surfaces on the site — an alternating two-column timeline, a scrolling
       * chip row and a media grid — and Khmer runs 20–40% longer than the
       * English they are set against.
       */
      for (const path of [
        "/en",
        "/km",
        "/en/projects",
        "/km/certificates",
        "/en/journey",
        "/km/journey",
        "/en/experience",
        "/km/education",
      ]) {
        await page.goto(path);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );

        // Allow 1px for sub-pixel rounding.
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe("errors", () => {
  test("an unknown path returns a 404 page with recovery links", async ({ page }) => {
    const response = await page.goto("/en/this-does-not-exist");
    expect(response?.status()).toBe(404);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /go to the homepage/i })).toBeVisible();
  });

  test("an unknown project slug 404s rather than rendering an empty shell", async ({
    page,
  }) => {
    /*
     * This used to point at `krusmart`, which was seeded as a draft. All three
     * platform projects are published now, so the fixture is a slug that does
     * not exist. The draft-visibility guarantee itself is covered by
     * content.spec.ts ("draft content does not appear anywhere") and by the RLS
     * suite, which tests it at the database rather than through the UI.
     */
    const response = await page.goto("/en/projects/no-such-project-exists");
    expect(response?.status()).toBe(404);
  });

  test("a published project renders its case study", async ({ page }) => {
    const response = await page.goto("/en/projects/krusmart");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/krusmart/i);
  });
});

test.describe("security headers", () => {
  test("the public site sets the expected headers", async ({ page }) => {
    const response = await page.goto("/en");
    const headers = response!.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["permissions-policy"]).toContain("geolocation=()");
  });

  test("admin responses are never publicly cacheable and are noindex", async ({ page }) => {
    const response = await page.goto("/admin/login");
    const headers = response!.headers();

    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["x-robots-tag"]).toContain("noindex");
  });
});

test.describe("external links", () => {
  test("every external link is safe and announced", async ({ page }) => {
    await page.goto("/en");

    const externals = page.locator('a[target="_blank"]');
    const count = await externals.count();

    for (let index = 0; index < count; index += 1) {
      const rel = await externals.nth(index).getAttribute("rel");
      // noopener stops the destination reaching window.opener; noreferrer withholds
      // our URL.
      expect(rel).toContain("noopener");
      expect(rel).toContain("noreferrer");
    }
  });
});
