/**
 * Capture reproducible visual evidence for the About redesign.
 *
 * Usage after starting the production server on port 3100:
 *   node scripts/capture-about-screenshots.mjs
 */

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = new URL(process.env.BASE_URL ?? "http://127.0.0.1:3100");
const loopback = ["127.0.0.1", "localhost", "::1"].includes(base.hostname);

if (!loopback && process.env.ALLOW_REMOTE_SCREENSHOTS !== "1") {
  throw new Error(
    "Refusing to capture a remote site. Set ALLOW_REMOTE_SCREENSHOTS=1 only after reviewing the target.",
  );
}

const output = "docs/about-screenshots";
const captures = [
  { locale: "en", theme: "light", width: 390, height: 844 },
  { locale: "en", theme: "dark", width: 1440, height: 1000 },
  { locale: "km", theme: "light", width: 1440, height: 1000 },
  { locale: "km", theme: "dark", width: 390, height: 844 },
];

mkdirSync(output, { recursive: true });

const browser = await chromium.launch();

try {
  for (const capture of captures) {
    const context = await browser.newContext({
      viewport: { width: capture.width, height: capture.height },
      reducedMotion: "reduce",
      colorScheme: capture.theme,
    });
    await context.addInitScript((theme) => {
      localStorage.setItem("portfolio-theme", theme);
    }, capture.theme);

    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(new URL(`/${capture.locale}/about`, base).toString(), {
      waitUntil: "networkidle",
    });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((image) =>
          image.complete ? image.decode().catch(() => undefined) : Promise.resolve(),
        ),
      );
    });

    const file = `${output}/about-${capture.locale}-${capture.theme}-${capture.width}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);

    if (errors.length > 0) {
      throw new Error(`Page errors while capturing ${file}: ${errors.join("; ")}`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}
