import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SECTION_ORDER = [
  "hero",
  "story",
  "practice",
  "chapters",
  "purpose",
  "principles-focus",
  "closing",
];

const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1366, 1440, 1536];

test.describe("About editorial experience", () => {
  for (const locale of ["en", "km"] as const) {
    test(`${locale} renders one complete seven-section content tree`, async ({ page }) => {
      await page.goto(`/${locale}/about`);

      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("article[data-about-page]")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);

      const sections = await page
        .locator("[data-about-section]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-about-section")));
      expect(sections).toEqual(SECTION_ORDER);

      await expect(page.locator("[data-about-portrait] img")).toHaveAttribute("alt", /.+/);
      await expect(page.locator("[data-about-biography]")).toBeVisible();
      expect((await page.locator("[data-about-biography]").innerText()).trim().length)
        .toBeGreaterThan(80);

      await expect(page.locator("[data-about-principle]")).toHaveCount(4);
      expect(await page.locator("[data-about-chapter]").count()).toBeLessThanOrEqual(4);

      const purposeProjects = await page
        .locator("[data-about-purpose-project]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-project-slug")));
      expect(purposeProjects).toEqual([
        "krusmart",
        "ptec-digital-library",
        "ptec-storage",
      ]);

      // A Telegram URL may be the href, but it must never be printed as contact copy.
      const detailsText = await page.locator("[data-about-personal-details]").innerText();
      expect(detailsText).not.toContain("https://t.me/");
    });
  }

  test("biography and all seven bands remain visible without JavaScript", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "custom no-JS context runs once");

    for (const locale of ["en", "km"] as const) {
      const context = await browser.newContext({
        baseURL: testInfo.project.use.baseURL as string,
        javaScriptEnabled: false,
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      await page.goto(`/${locale}/about`);

      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("[data-about-biography]")).toBeVisible();
      await expect(page.locator("[data-about-section]")).toHaveCount(7);
      await expect(page.getByText(/read more/i)).toHaveCount(0);

      await context.close();
    }
  });

  test("responsive matrix has no horizontal overflow or clipped actions", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "full matrix runs once");
    test.setTimeout(120_000);

    for (const locale of ["en", "km"] as const) {
      await page.goto(`/${locale}/about`);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${locale} at ${width}px`).toBeLessThanOrEqual(1);

        const undersizedActions = await page
          .locator("[data-about-hero-actions] a, [data-about-closing-cta] a")
          .evaluateAll((nodes) =>
            nodes.filter((node) => {
              const rect = node.getBoundingClientRect();
              return rect.width < 44 || rect.height < 44;
            }).length,
          );
        expect(undersizedActions, `${locale} action targets at ${width}px`).toBe(0);

        if (width <= 430) {
          const order = await page.evaluate(() => {
            const actions = document.querySelector("[data-about-hero-actions]");
            const portrait = document.querySelector("[data-about-portrait]");
            if (!actions || !portrait) return null;
            return actions.compareDocumentPosition(portrait) & Node.DOCUMENT_POSITION_FOLLOWING;
          });
          expect(order, `${locale} mobile portrait follows the actions`).not.toBe(0);
        }
      }
    }
  });

  test.describe.serial("WCAG theme and locale matrix", () => {
    for (const locale of ["en", "km"] as const) {
      for (const theme of ["light", "dark"] as const) {
        test(`${locale} ${theme} passes automated WCAG 2.2 AA checks`, async ({
          page,
        }, testInfo) => {
          test.skip(testInfo.project.name !== "chromium", "theme matrix runs once");

          await page.addInitScript((selectedTheme) => {
            localStorage.setItem("portfolio-theme", selectedTheme);
          }, theme);
          await page.goto(`/${locale}/about`);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();
          expect(
            results.violations.map((violation) => ({
              id: violation.id,
              impact: violation.impact,
              nodes: violation.nodes.map((node) => node.target),
            })),
          ).toEqual([]);
        });
      }
    }
  });

  test("internal evidence links resolve and fragment targets exist", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "link audit runs once");
    await page.goto("/en/about");

    const hrefs = await page
      .locator('article[data-about-page] a[href^="/en/"]')
      .evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute("href")))]);

    for (const href of hrefs) {
      if (!href) continue;
      const [path, fragment] = href.split("#");
      const response = await request.get(path ?? href);
      expect(response.status(), href).toBeLessThan(400);

      if (fragment) {
        await page.goto(href);
        await expect(page.locator(`#${fragment}`), href).toHaveCount(1);
      }
    }
  });

  test("About JSON-LD resolves its ProfilePage to an emitted Person", async ({
    page,
  }) => {
    await page.goto("/en/about");
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((node) => JSON.parse(node.textContent ?? "{}")));
    const nodes = blocks.flatMap((entry) => entry["@graph"] ?? [entry]);
    const types = nodes.map((node: { "@type"?: string }) => node["@type"]);

    expect(types).toEqual(
      expect.arrayContaining(["BreadcrumbList", "Person", "WebSite", "ProfilePage"]),
    );

    const person = nodes.find((node: { "@type"?: string }) => node["@type"] === "Person");
    const profile = nodes.find(
      (node: { "@type"?: string }) => node["@type"] === "ProfilePage",
    );
    expect(profile.mainEntity["@id"]).toBe(person["@id"]);
    expect(JSON.stringify(nodes)).not.toMatch(/birthDate|telephone|public_location/);
  });

  test("does not emit hydration warnings or serious console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/en/about");
    await page.waitForLoadState("networkidle");

    expect(errors.filter((message) => /hydration|uncaught|failed/i.test(message))).toEqual([]);
  });
});
