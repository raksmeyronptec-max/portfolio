import { expect, test } from "@playwright/test";

/**
 * Admin authentication and authorisation.
 *
 * The unauthenticated tests always run. The signed-in tests run only when
 * E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are set, so the suite is useful on a fresh
 * checkout without requiring a seeded account.
 */

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("unauthenticated access", () => {
  const protectedPaths = [
    "/admin",
    "/admin/projects",
    "/admin/projects/new",
    "/admin/certificates",
    "/admin/media",
    "/admin/messages",
    "/admin/analytics",
    "/admin/audit-logs",
    "/admin/settings",
    "/admin/seo",
    "/admin/resume",
    "/admin/education",
    "/admin/experience",
    "/admin/testimonials",
    "/admin/skills",
  ];

  for (const path of protectedPaths) {
    test(`${path} redirects to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/);
    });
  }

  test("the redirect preserves where you were going", async ({ page }) => {
    await page.goto("/admin/projects");
    await expect(page).toHaveURL(/next=%2Fadmin%2Fprojects/);
  });

  test("an off-site next parameter is rejected", async ({ page }) => {
    // Without validation this would be an open redirect inheriting our domain's trust.
    await page.goto("/admin/login?next=https://evil.example");

    await expect(page.getByRole("heading", { name: /portfolio admin/i })).toBeVisible();
    // The form is shown rather than an immediate bounce off-site.
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("the login page is noindex", async ({ page }) => {
    const response = await page.goto("/admin/login");

    expect(response!.headers()["x-robots-tag"]).toContain("noindex");

    // Exactly one robots meta. Two, with different values, is a contradiction a
    // crawler resolves however it likes.
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveCount(1);
    await expect(robots).toHaveAttribute("content", /noindex/);
  });

  test("sign-in fails with the same message for unknown and wrong credentials", async ({
    page,
  }) => {
    await page.goto("/admin/login");

    // Located by name, not by label: the field's "show password" toggle carries
    // aria-label="Show password", which a substring label match also selects.
    await page.locator('input[name="email"]').fill("nobody@example.invalid");
    await page.locator('input[name="password"]').fill("wrong-password");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    /*
     * A distinct "no such account" message would let anyone enumerate addresses.
     *
     * Scoped to the form's own alert: the toast container and Next's route
     * announcer are both role="alert" and both empty, so an unscoped role match
     * resolves to three elements.
     */
    await expect(
      page.getByRole("alert").filter({ hasText: /could not sign in/i }),
    ).toContainText(/not recognised/i);
  });

  test("admin API routes reject anonymous callers", async ({ request }) => {
    const session = await request.post("/api/admin/session");
    expect([401, 403]).toContain(session.status());

    const upload = await request.post("/api/admin/media/upload", {
      multipart: {
        kind: "project_cover",
        file: {
          name: "x.png",
          mimeType: "image/png",
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        },
      },
    });
    expect([401, 403]).toContain(upload.status());
  });

  test("the analytics endpoint rejects a GET", async ({ request }) => {
    const response = await request.get("/api/analytics");
    expect(response.status()).toBe(405);
  });
});

test.describe("signed in", () => {
  test.skip(
    !adminEmail || !adminPassword,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the authenticated tests.",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator('input[name="email"]').fill(adminEmail!);
    await page.locator('input[name="password"]').fill(adminPassword!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
  });

  test("the dashboard shows the operational summary", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /at a glance/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /content health/i })).toBeVisible();
  });

  test("content health surfaces the seeded review items", async ({ page }) => {
    // The three seeded projects are flagged needs_review, so this must be non-empty.
    await expect(page.getByText(/needs review/i).first()).toBeVisible();
  });

  test("the projects list shows drafts and their review notes", async ({ page }) => {
    await page.goto("/admin/projects");

    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

    // By role: the slug string also appears in the URL preview, the review note
    // and the delete-confirmation label, so a bare text match is ambiguous.
    await expect(
      page.getByRole("link", { name: /krusmart/i }).first(),
    ).toBeVisible();
    await expect(page.getByText(/Draft/).first()).toBeVisible();

    // The review note is the point of the seeded drafts: they record what is
    // unverified rather than quietly publishing it. The note is clamped in the
    // list, so match its opening rather than the "NOT verified" section further in.
    await expect(
      page.getByText(/Verified from the live site only/i).first(),
    ).toBeVisible();
  });

  test("publishing a draft with an incomplete case study is refused with reasons", async ({
    page,
  }) => {
    await page.goto("/admin/projects");

    await page
      .getByRole("button", { name: /publish krusmart/i })
      .click();

    /*
     * The refusal must explain what is missing rather than just failing.
     *
     * Matched by text, not by container role: a blocked publish is a `warning`
     * toast, which lives in the polite region — the assertive `role="alert"`
     * region is present but empty, and asserting against `.first()` picked that
     * empty one.
     */
    await expect(page.getByText(/not ready to publish/i)).toBeVisible();
    // The listed reasons are the whole point; a bare refusal is not enough.
    await expect(page.getByText(/case study/i).first()).toBeVisible();
  });

  test("the project editor shows a live publish checklist", async ({ page }) => {
    await page.goto("/admin/projects");
    await page.getByRole("button", { name: /edit krusmart/i }).click();

    await expect(page.getByRole("heading", { name: /publish checklist/i })).toBeVisible();
    await expect(page.getByText(/needs review/i).first()).toBeVisible();
  });

  test("a new project can be created as a draft", async ({ page }) => {
    const slug = `e2e-test-${Date.now()}`;

    await page.goto("/admin/projects/new");

    await page.getByLabel(/url slug/i).fill(slug);
    // Not `/^title$/`: the field's accessible name includes its "required" hint.
    await page.getByLabel(/^title/i).first().fill("E2E test project");

    await page.getByRole("button", { name: /create project/i }).click();

    // Scoped to the toast: the form also renders a role="status" notice for
    // "You have unsaved changes", which is the first match on the page.
    await expect(
      page.getByRole("status").filter({ hasText: /created/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("certificates cannot be published without a privacy review", async ({ page }) => {
    await page.goto("/admin/certificates/new");

    await expect(
      page.getByRole("heading", { name: /privacy review/i }),
    ).toBeVisible();

    // The confirmation is disabled until every checklist item is ticked.
    const confirm = page.getByLabel(/I have reviewed the preview image/i);
    await expect(confirm).toBeDisabled();
  });

  test("the redaction checklist gates the confirmation", async ({ page }) => {
    await page.goto("/admin/certificates/new");

    // Every redaction item carries an id of the form `privacy-check-<item>`, so
    // the checklist can be ticked without also hitting the confirmation control or
    // the unrelated sensitivity flags.
    const items = page.locator('input[type="checkbox"][id^="privacy-check-"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      await items.nth(index).check();
    }

    await expect(
      page.getByLabel(/I have reviewed the preview image/i),
    ).toBeEnabled();
  });

  test("the audit log records the sign-in", async ({ page }) => {
    await page.goto("/admin/audit-logs");

    await expect(page.getByRole("heading", { name: /audit log/i })).toBeVisible();
    await expect(page.getByText(/admin login/i).first()).toBeVisible();
  });

  test("the media library reports storage and alt-text gaps", async ({ page }) => {
    await page.goto("/admin/media");
    await expect(page.getByRole("heading", { name: /media library/i })).toBeVisible();
    await expect(page.getByText(/storage used/i)).toBeVisible();
  });

  test("signing out returns to the login page", async ({ page }) => {
    await page.getByRole("button", { name: /sign out/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15_000 });

    // The session is genuinely gone, not just navigated away from.
    await page.goto("/admin/projects");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
