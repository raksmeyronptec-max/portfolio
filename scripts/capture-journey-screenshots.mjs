/**
 * End-to-end walkthrough of the Journey feature, capturing screenshots.
 *
 * This is a DEVELOPMENT tool, not part of the test suite. It drives the real
 * admin interface — import, attach, privacy review, publish — against the local
 * Supabase stack, so a clean run is evidence that the whole chain works, not just
 * that the units do.
 *
 * The demo content it creates is synthetic (abstract gradients that depict
 * nobody) and is removed by `scripts/cleanup-journey-demo.mjs`, which must be run
 * afterwards. Neither script may be pointed at a real database.
 *
 * Note: unset the R2_* variables before running, or the demo images are written
 * to the configured Cloudflare bucket rather than to local storage. `.env.local`
 * redirects Supabase to the local stack but does not unset R2.
 *
 * Usage:
 *   npm run build && npx next start --port 3100 &
 *   node scripts/capture-journey-screenshots.mjs
 */

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@localhost.test";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "LocalDevPassword123!";
const OUT = "docs/journey-screenshots";

const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

mkdirSync(OUT, { recursive: true });

let step = 0;
async function shot(page, name, fullPage = true) {
  step += 1;
  const file = `${OUT}/${String(step).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage });
  console.log(`  📸 ${file}`);
}

function log(message) {
  console.log(`\n▸ ${message}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: DESKTOP });
const page = await context.newPage();

page.on("pageerror", (error) => console.error("  ! page error:", error.message));

try {
  // ── Sign in ───────────────────────────────────────────────────────────────
  log("Signing in to the admin");
  await page.goto(`${BASE}/admin/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);

  /*
   * Filled and then verified before submitting. In dev the form hydrates after
   * first paint, and a fill that lands before hydration is discarded when React
   * takes over the inputs — which presents as an empty form and a submit that
   * does nothing.
   */
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.waitForTimeout(500);
    const value = await page.locator('input[name="email"]').inputValue();
    if (value === EMAIL) break;
  }

  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 30_000 });
  console.log("  signed in");

  // ── Bulk importer ─────────────────────────────────────────────────────────
  log("Bulk media importer");
  await page.goto(`${BASE}/admin/media/import`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);
  await shot(page, "admin-media-importer");

  const selectAll = page.getByRole("button", { name: /select all in this folder/i });
  const importButton = page.getByRole("button", { name: /^Import \d+ selected/ });

  if ((await selectAll.count()) > 0) {
    await selectAll.first().click();
    await page.waitForTimeout(500);
    await shot(page, "admin-media-importer-selected");
  }

  // Skipped when everything in the folder has already been imported — the
  // duplicate guard makes those rows non-selectable, so the button stays at 0.
  const importable = await importButton.isEnabled().catch(() => false);

  if (importable) {
    await importButton.click();

    /*
     * Wait for the import to finish rather than guessing at a duration.
     *
     * The button's label reverts from "Importing N of M…" to "Import N selected"
     * only when the last batch has come back, so that is the signal. Image
     * processing is CPU-bound and six 1600px photographs take a while.
     */
    await page
      .getByRole("button", { name: /^Import \d+ selected/ })
      .waitFor({ state: "visible", timeout: 180_000 });
    await page.waitForTimeout(3000);
    await shot(page, "admin-media-imported");
  } else {
    console.log("  (nothing to import — already imported, or folder empty)");
  }

  // ── Journey list ──────────────────────────────────────────────────────────
  log("Journey admin list");
  await page.goto(`${BASE}/admin/journey`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);
  await shot(page, "admin-journey-list");

  // ── Edit the science-fair story ───────────────────────────────────────────
  log("Journey story editor");
  await page.getByRole("link", { name: /Science Fair Activities/i }).first().click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);

  // Fill in enough to publish. Wording kept generic and non-factual — this is a
  // demo record, and the seeded review note lists what a real one still needs.
  const summary = page
    .getByLabel(/^Summary \(English\)/)
    .or(page.locator("textarea").nth(1));
  await summary.first().fill(
    "A demonstration record used to verify the Journey feature end to end. " +
      "Replace this with the real account before publishing anything.",
  );

  const story = page.getByLabel(/^Story \(English\)/);
  if ((await story.count()) > 0) {
    await story.first().fill(
      "This is placeholder prose written to exercise the rendering path.\n\n" +
        "The paragraphs, the gallery below and the related-record links all come " +
        "from the CMS rather than from anything hardcoded in a component.",
    );
  }

  const highlights = page.getByLabel(/^Highlights \(English\)/);
  if ((await highlights.count()) > 0) {
    await highlights.first().fill(
      "Demonstrates the editorial timeline\nDemonstrates the accessible gallery\nDemonstrates the poster-first video facade",
    );
  }

  // Clear the review flag — the database refuses to publish while it is set.
  const needsReview = page.getByLabel(/still needs review/i);
  if (await needsReview.isChecked()) await needsReview.uncheck();

  await page.getByLabel(/^Featured$/).check();
  await page.locator("select").filter({ hasText: /Draft|Published/ }).first()
    .selectOption({ label: "Published — visible on the site" });

  await shot(page, "admin-journey-editor");

  await page.getByRole("button", { name: /^Save story$/ }).click();
  await page.waitForTimeout(3000);

  // ── Attach and review media ───────────────────────────────────────────────
  log("Attaching photographs and recording the privacy review");
  const url = page.url();
  const id = url.match(/journey\/([0-9a-f-]{36})/)?.[1];
  if (!id) throw new Error("Could not determine the story id from " + url);

  await page.goto(`${BASE}/admin/journey/${id}/media`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: /add photographs/i }).click();
  await page.waitForTimeout(800);

  // Attach up to five imported photographs.
  for (let index = 0; index < 5; index += 1) {
    /*
     * Matched on the ORIGINAL camera filename, which is what the library shows.
     * The semantic name is the storage key; `original_filename` deliberately keeps
     * the owner's own reference back to the file on their laptop.
     */
    const options = page
      .locator("dialog button:not([disabled])")
      .filter({ hasText: /IMG_45/ });
    if ((await options.count()) === 0) break;
    await options.first().click();
    await page.waitForTimeout(2500);
    if (index < 4) {
      await page.getByRole("button", { name: /add photographs/i }).click();
      await page.waitForTimeout(800);
    }
  }

  await page.goto(`${BASE}/admin/journey/${id}/media`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);
  await shot(page, "admin-journey-media-pending");

  /*
   * Approve each attachment through the real checklist.
   *
   * Driven by "is there still a row showing Pending review?" rather than by an
   * index, because the list re-sorts after every save — an index-based loop
   * re-edits the row it has just approved.
   */
  for (let pass = 0; pass < 12; pass += 1) {
    const pending = page.locator("li").filter({ hasText: "Pending review" });
    if ((await pending.count()) === 0) break;

    await pending.first().getByRole("button", { name: /^Edit /i }).click();
    await page.waitForTimeout(900);

    const dialog = page.locator("dialog[open]");

    await dialog
      .getByLabel(/^Caption \(English\)/)
      .fill("Placeholder caption for the demonstration record.");
    await dialog
      .getByLabel(/^Alt text \(English\)/)
      .fill(
        "An abstract gradient standing in for a photograph in this demonstration record.",
      );
    await dialog.getByLabel(/^Caption \(Khmer\)/).fill("អត្ថបទពិពណ៌នាសាកល្បង។");

    // The checklist gates the "Approved" option — tick every statement.
    const boxes = dialog.locator('input[type="checkbox"]');
    const boxCount = await boxes.count();
    for (let b = 0; b < boxCount; b += 1) await boxes.nth(b).check();

    if (pass === 0) await shot(page, "admin-privacy-review", false);

    const selects = dialog.locator("select");
    await selects.nth(0).selectOption({ label: "Approved for publication" });
    await selects.nth(1).selectOption({ label: "Not required — nobody is identifiable" });
    await selects.nth(2).selectOption({ label: "Public — shown on the journey story" });

    await dialog.getByRole("button", { name: /^Save$/ }).click();
    await page.waitForTimeout(3000);

    await page.goto(`${BASE}/admin/journey/${id}/media`);
    await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);
    console.log(`  approved ${pass + 1}`);
  }

  await page.goto(`${BASE}/admin/journey/${id}/media`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);
  await shot(page, "admin-journey-media-approved");

  // ── Public pages ──────────────────────────────────────────────────────────
  log("Public journey pages");
  const publicPage = await context.newPage();

  await publicPage.goto(`${BASE}/en/journey`);
  await publicPage.waitForLoadState("domcontentloaded");
  await publicPage.waitForTimeout(1500);
  await shot(publicPage, "public-journey-en-desktop");

  await publicPage.goto(`${BASE}/km/journey`);
  await publicPage.waitForLoadState("domcontentloaded");
  await publicPage.waitForTimeout(1500);
  await shot(publicPage, "public-journey-km-desktop");

  await publicPage.goto(`${BASE}/en/journey/science-fair-activities`);
  await publicPage.waitForLoadState("domcontentloaded");
  await publicPage.waitForTimeout(1500);
  await shot(publicPage, "public-journey-detail-en");

  await publicPage.goto(`${BASE}/km/journey/science-fair-activities`);
  await publicPage.waitForLoadState("domcontentloaded");
  await publicPage.waitForTimeout(1500);
  await shot(publicPage, "public-journey-detail-km");

  // The gallery, opened.
  await publicPage.goto(`${BASE}/en/journey/science-fair-activities`);
  await publicPage.waitForLoadState("domcontentloaded");
  await publicPage.waitForTimeout(1500);
  const opener = publicPage.getByRole("button", { name: /^Open:/i });
  if ((await opener.count()) > 0) {
    await opener.first().click();
    await publicPage.waitForTimeout(1200);
    await shot(publicPage, "public-journey-gallery-open", false);
    await publicPage.keyboard.press("Escape");
  }

  // Homepage section.
  await publicPage.goto(`${BASE}/en`);
  await publicPage.waitForLoadState("domcontentloaded");
  await publicPage.waitForTimeout(1500);
  const moments = publicPage.locator("#moments-heading");
  if ((await moments.count()) > 0) {
    await moments.scrollIntoViewIfNeeded();
    await publicPage.waitForTimeout(800);
    await shot(publicPage, "public-homepage-moments", false);
  }

  // Experience page with the related-story link.
  await publicPage.goto(`${BASE}/en/experience`);
  await publicPage.waitForLoadState("domcontentloaded");
  await publicPage.waitForTimeout(1500);
  await shot(publicPage, "public-experience-with-journey");

  // ── Mobile ────────────────────────────────────────────────────────────────
  log("Mobile");
  const mobileContext = await browser.newContext({ viewport: MOBILE });
  const mobile = await mobileContext.newPage();

  await mobile.goto(`${BASE}/en/journey`);
  await mobile.waitForLoadState("domcontentloaded");
  await mobile.waitForTimeout(1500);
  await shot(mobile, "public-journey-en-mobile");

  await mobile.goto(`${BASE}/km/journey`);
  await mobile.waitForLoadState("domcontentloaded");
  await mobile.waitForTimeout(1500);
  await shot(mobile, "public-journey-km-mobile");

  await mobile.goto(`${BASE}/en/journey/science-fair-activities`);
  await mobile.waitForLoadState("domcontentloaded");
  await mobile.waitForTimeout(1500);
  await shot(mobile, "public-journey-detail-mobile");

  await mobileContext.close();

  console.log(`\n✓ Captured ${step} screenshots into ${OUT}/`);
} catch (error) {
  console.error("\n✗ Walkthrough failed:", error.message);
  await shot(page, "FAILURE", false).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
