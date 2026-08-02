import { expect, test } from "@playwright/test";

/**
 * The media uploader must offer what the endpoint will accept.
 *
 * This exists because the two drifted: the upload route learned the publication
 * kinds and the form did not, so choosing "Publication PDF" left every PDF
 * greyed out in the file picker. The upload was impossible from the UI while
 * being perfectly valid at the endpoint, and nothing failed — there was simply
 * no way to select the file.
 *
 * Skipped unless E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are set, matching
 * admin.spec.ts, so the suite stays useful on a fresh checkout.
 */

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe("media uploader accepts what the server accepts", () => {
  test.skip(!email || !password, "needs E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

  async function signIn(page: import("@playwright/test").Page) {
    await page.goto("/admin/login");

    /*
     * Wait for hydration before touching the form. Clicking an un-hydrated form
     * makes the browser perform a native GET, which does not sign in — and puts
     * the password in the query string on the way.
     */
    await page.waitForLoadState("networkidle");

    const emailField = page.locator('input[name="email"]');
    const passwordField = page.locator('input[name="password"]');

    await emailField.fill(email!);
    await expect(emailField).toHaveValue(email!);
    await passwordField.fill(password!);
    await expect(passwordField).toHaveValue(password!);

    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/\/admin(?!\/login)/, { timeout: 30_000 });
  }

  test("Publication PDF makes PDFs selectable and states the 25 MB ceiling", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/media");

    const kindSelect = page.locator("select").first();
    const fileInput = page.locator('input[type="file"]');

    // An image kind must not offer a PDF.
    expect(await fileInput.getAttribute("accept")).not.toContain("application/pdf");

    await kindSelect.selectOption("publication_pdf");
    await expect(fileInput).toHaveAttribute("accept", /application\/pdf/);

    // A book is routinely larger than the 10 MB ceiling every other kind uses.
    await expect(page.getByText(/25\.0 MB|25 MB/).first()).toBeVisible();
  });

  test("Publication LaTeX source offers only a ZIP", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/media");
    await page.locator("select").first().selectOption("publication_source");

    const accept = await page.locator('input[type="file"]').getAttribute("accept");
    expect(accept).toContain("application/zip");
    // A PDF here would fill a slot whose database CHECK requires an archive.
    expect(accept).not.toContain("application/pdf");
  });
});
