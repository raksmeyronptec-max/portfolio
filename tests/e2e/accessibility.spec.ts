import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automated accessibility checks.
 *
 * Scope note, stated plainly: axe catches roughly a third of WCAG issues. It cannot
 * judge whether alt text is *meaningful*, whether a heading structure is *logical*,
 * or whether a flow is operable end to end with a screen reader. Those need manual
 * testing, which is why docs/ACCESSIBILITY.md lists what was verified by hand.
 *
 * These tests are the floor, not the ceiling.
 */

const PUBLIC_PAGES = [
  { path: "/en", name: "homepage (English)" },
  { path: "/km", name: "homepage (Khmer)" },
  { path: "/en/projects", name: "projects list" },
  { path: "/km/projects", name: "projects list (Khmer)" },
  { path: "/en/certificates", name: "certificates list" },
  { path: "/en/about", name: "about" },
  { path: "/en/experience", name: "experience" },
  { path: "/en/education", name: "education" },
  { path: "/en/resume", name: "resume" },
  { path: "/en/contact", name: "contact" },
  { path: "/en/publications", name: "publications list" },
  /*
   * Both locales for the publications list, because it is the page where Khmer
   * and Latin script sit side by side in the same card — a translated display
   * title above the book's own Khmer title — and that is where a colour-contrast
   * or line-height regression would actually land.
   */
  { path: "/km/publications", name: "publications list (Khmer)" },
  { path: "/en/this-page-does-not-exist", name: "404 page" },
];

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const page of PUBLIC_PAGES) {
  test(`${page.name} has no automatically detectable WCAG 2.2 AA violations`, async ({
    page: browserPage,
  }) => {
    await browserPage.goto(page.path);

    /*
     * Wait for React to own the document before scanning.
     *
     * `goto()` resolves on `load`, which is before hydration finishes. That is
     * harmless on every route whose server HTML is already correct, but the 404
     * is served as Next's built-in shell — `<html id="__next_error__">` with no
     * `lang` and no `<title>` — and React only replaces it during hydration.
     * Scanning at `load` therefore raced hydration and made this test pass or
     * fail on timing rather than on the page, which is exactly the kind of
     * flake that hides real regressions.
     *
     * `lang` is the signal because the public layout always sets it and the
     * error shell never does.
     *
     * NOTE: the shell itself is a real, separate defect — a crawler or a no-JS
     * visitor still receives a document with no language and no title. It is
     * pre-existing (it reproduces on the pre-redesign commit) and is recorded
     * in docs/ACCESSIBILITY.md rather than papered over here.
     */
    await browserPage.waitForFunction(
      () => document.documentElement.lang.length > 0,
      undefined,
      { timeout: 10_000 },
    );

    const results = await new AxeBuilder({ page: browserPage })
      .withTags(WCAG_TAGS)
      .analyze();

    // Report the rule ids and the offending selectors, so a failure is actionable
    // rather than a bare count.
    const summary = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target.join(" ")),
    }));

    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}

test.describe("keyboard operability", () => {
  test("the whole header is reachable by keyboard", async ({ page }) => {
    await page.goto("/en");

    const describeFocus = () =>
      page.evaluate(() => {
        const element = document.activeElement;
        if (!element) return "none";
        return `${element.tagName.toLowerCase()}:${element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 30) ?? ""}`;
      });

    // The skip link must be the first tab stop.
    await page.keyboard.press("Tab");
    expect((await describeFocus()).toLowerCase()).toContain("skip");

    /*
     * The section links live behind the "Work"/"Background" disclosures, so
     * keyboard reachability means: Tab lands on the group trigger, Enter opens
     * it, and the next Tab enters the links. That is the path this walks —
     * the old version expected a flat "Projects" link that the grouped header
     * deliberately no longer has.
     */
    const reached: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      await page.keyboard.press("Tab");
      const description = await describeFocus();
      reached.push(description);
      if (description === "button:Work") break;
    }
    expect(reached[reached.length - 1]).toBe("button:Work");

    await page.keyboard.press("Enter");
    // Focus stays on the trigger; the panel's links are the next tab stops.
    await page.keyboard.press("Tab");
    expect((await describeFocus()).toLowerCase()).toContain("projects");

    // Escape closes the disclosure and returns focus to the trigger.
    await page.keyboard.press("Escape");
    expect(await describeFocus()).toBe("button:Work");
  });

  test("focus is visible on every interactive element", async ({ page }) => {
    await page.goto("/en");

    for (let index = 0; index < 10; index += 1) {
      await page.keyboard.press("Tab");

      const hasVisibleFocus = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return true;

        const style = window.getComputedStyle(element);
        // The design system uses a branded outline; `outline: none` anywhere would be
        // a regression against an explicit requirement.
        return style.outlineStyle !== "none" || style.boxShadow !== "none";
      });

      expect(hasVisibleFocus).toBe(true);
    }
  });

  test("the mobile drawer restores focus on close", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");

    const trigger = page.getByRole("button", { name: /open navigation menu/i });
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");

    // Native <dialog> restores focus to the invoker.
    await expect(trigger).toBeFocused();
  });
});

test.describe("zoom and reflow", () => {
  test("usable at 200% zoom without horizontal scrolling", async ({ page }) => {
    // WCAG 1.4.10 reflow: 320 CSS px wide at 400% is equivalent to 1280 at 100%.
    // Emulating 200% on a 1280 viewport gives an effective 640px.
    await page.setViewportSize({ width: 640, height: 512 });
    await page.goto("/en");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("Khmer content reflows without overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });

    for (const path of ["/km", "/km/about", "/km/education", "/km/contact"]) {
      await page.goto(path);

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("reduced motion", () => {
  test("no animation runs when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en");

    const animating = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("*")).some((element) => {
        const style = window.getComputedStyle(element);
        const duration = Number.parseFloat(style.animationDuration);
        // The global rule collapses durations to 0.01ms.
        return Number.isFinite(duration) && duration > 0.1;
      });
    });

    expect(animating).toBe(false);
  });
});

test.describe("images", () => {
  test("every content image has an alt attribute", async ({ page }) => {
    for (const path of ["/en", "/en/about", "/en/projects"]) {
      await page.goto(path);

      const missing = await page.locator("img:not([alt])").count();
      expect(missing, `${path} has images without alt`).toBe(0);
    }
  });

  test("images declare dimensions or a fixed aspect box to avoid layout shift", async ({
    page,
  }) => {
    await page.goto("/en");

    const unsized = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("img")).filter((img) => {
        if (img.getAttribute("width") && img.getAttribute("height")) return false;
        // next/image `fill` sets position: absolute inside a sized parent.
        return window.getComputedStyle(img).position !== "absolute";
      }).length;
    });

    expect(unsized).toBe(0);
  });
});
