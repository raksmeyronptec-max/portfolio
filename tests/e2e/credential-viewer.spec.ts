import { expect, test, type Page } from "@playwright/test";

/**
 * The credential document viewer.
 *
 * A credential is a document, and the accessibility contract around opening one
 * full-screen is the part most image viewers get wrong — usually focus
 * restoration, or leaving the closed dialog in the accessibility tree.
 *
 * These navigate to whichever credential is published rather than to a fixture
 * slug, and skip with a reason when the environment has none. Seeding a
 * fabricated credential to make the suite green would put an invented document
 * on the site.
 */
async function openFirstCredential(page: Page): Promise<boolean> {
  await page.goto("/en/certificates");

  const link = page.locator('a[href*="/en/certificates/"]').first();
  if ((await link.count()) === 0) return false;

  /*
   * Navigate by URL rather than by clicking.
   *
   * Clicking here raced hydration: the anchor is present in the server-rendered
   * HTML, so the click lands, but Next's router has not taken over yet and the
   * navigation is a no-op — and `waitForLoadState("domcontentloaded")` returns
   * immediately for the page already loaded, so the helper reported success
   * while still sitting on the listing.
   */
  const href = await link.getAttribute("href");
  if (!href) return false;
  await page.goto(href);

  // Not every credential has a preview, and the viewer is only offered when
  // there is a document to open.
  return (
    (await page.getByRole("button", { name: /open the document larger/i }).count()) > 0
  );
}

test.describe("credential document viewer", () => {
  test.beforeEach(async ({ page }) => {
    const ready = await openFirstCredential(page);
    test.skip(!ready, "No published credential with a document preview here.");
  });

  test("opens, traps focus, and restores focus on Escape", async ({ page }) => {
    const opener = page.getByRole("button", { name: /open the document larger/i });
    await opener.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Tab");
    const trapped = await page.evaluate(() => {
      const d = document.querySelector("dialog[open]");
      return Boolean(d && document.activeElement && d.contains(document.activeElement));
    });
    expect(trapped).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("zooms with the keyboard and announces the level", async ({ page }) => {
    await page.getByRole("button", { name: /open the document larger/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // The visible indicator and the polite live region are separate elements on
    // purpose: sighted users read the number, screen-reader users are told it
    // changed even though focus never left the button they pressed.
    const indicator = page.getByText("100%", { exact: true });
    const announcement = page.getByText(/^Zoom \d+%$/);

    await expect(indicator).toBeVisible();
    await expect(announcement).toHaveText("Zoom 100%");

    await page.keyboard.press("+");
    await expect(page.getByText("150%", { exact: true })).toBeVisible();
    await expect(announcement).toHaveText("Zoom 150%");

    await page.keyboard.press("0");
    await expect(page.getByText("100%", { exact: true })).toBeVisible();
  });

  test("zoom controls are real buttons at 44px and disable at the limits", async ({ page }) => {
    await page.getByRole("button", { name: /open the document larger/i }).click();

    const zoomOut = page.getByRole("button", { name: /^zoom out$/i });
    await expect(zoomOut).toBeDisabled();

    const zoomIn = page.getByRole("button", { name: /^zoom in$/i });
    const box = await zoomIn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);

    await zoomIn.click();
    await expect(zoomOut).toBeEnabled();
  });

  test("the closed viewer is not in the accessibility tree", async ({ page }) => {
    // Never opened on this page load: a closed <dialog> must be display:none, or
    // it becomes an invisible full-viewport layer that swallows clicks.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const reachable = await page.evaluate(() => {
      const d = document.querySelector("dialog");
      if (!d) return "no dialog element";
      return getComputedStyle(d).display;
    });
    expect(reachable).toBe("none");
  });

  test("serves only the redacted preview, never a private original", async ({ page }) => {
    await page.getByRole("button", { name: /open the document larger/i }).click();
    const src = await page.locator("dialog[open] img").getAttribute("src");
    expect(src).toBeTruthy();
    expect(src).not.toContain("certificate-originals");
    expect(src).toContain("certificate-previews");
  });
});
