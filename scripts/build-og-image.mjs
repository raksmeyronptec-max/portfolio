#!/usr/bin/env node
/**
 * Compose the fallback social card.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `FALLBACK_OG_IMAGE` in src/lib/seo/metadata.ts pointed at
 * `public/image/MyPF.jpg` — carried over from v1 and never revisited when the
 * portrait was keyed. Two things were wrong with it, and both are invisible
 * from inside the site because nothing renders that file on a page:
 *
 *   1. It is the *unkeyed* studio original, so every link ever shared to
 *      Telegram, Facebook, LinkedIn or X previewed Ron on a bright green
 *      screen — the one image the rest of the pipeline exists to avoid.
 *   2. It is 1024×1536, a 2:3 portrait, declared as `summary_large_image`,
 *      which wants 1.91:1. Every scraper centre-cropped it to a band across
 *      the chest.
 *
 * ── Why it is generated rather than hand-made ──────────────────────────────
 * The card is derived from assets already in the repo, so it can be rebuilt
 * whenever the portrait is re-keyed instead of drifting away from it. It is
 * also deliberately text-free: the site's typefaces come from `next/font`,
 * which only exists as hashed build output, so any text baked in here would
 * render with whatever fallback font the running machine happened to have and
 * would not be reproducible. The title and description reach the card through
 * `og:title` and `og:description`, which every platform renders in its own
 * type anyway.
 *
 * Colours are read from the dark theme in globals.css: --ink-950 for the
 * field, and the two identity glows. Keep them in step if that palette moves.
 *
 * Usage:
 *   node scripts/build-og-image.mjs
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PORTRAIT = "public/image/portrait-keyed.webp";
const OUTPUT = "public/image/og-default.jpg";

/** `summary_large_image` / `og:image` — 1.91:1. */
const WIDTH = 1200;
const HEIGHT = 630;

/** Dark theme: --ink-950, --glow-primary, --glow-secondary. */
const FIELD = "#080a12";
const GLOW_INDIGO = "139 140 255";
const GLOW_CYAN = "107 214 218";

/*
 * The subject's alpha bounding box, so the composition is anchored to the
 * person rather than to the frame the camera happened to give us. Recomputed
 * here rather than hard-coded, because re-keying the portrait moves it.
 */
const { data, info } = await sharp(PORTRAIT)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

let minX = info.width;
let maxX = 0;
let minY = info.height;
let maxY = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * info.channels + 3] > 40) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const subjectWidth = maxX - minX + 1;
const subjectHeight = maxY - minY + 1;

/*
 * Bleed the subject off the bottom edge rather than floating it in the middle:
 * the portrait is cut at the chest, and a floating torso reads as a mistake.
 * 0.92 leaves a little field above the head.
 */
const targetHeight = Math.round(HEIGHT * 0.92);
const scale = targetHeight / subjectHeight;
const scaledWidth = Math.round(subjectWidth * scale);

const subject = await sharp(PORTRAIT)
  .extract({ left: minX, top: minY, width: subjectWidth, height: subjectHeight })
  .resize({ width: scaledWidth, height: targetHeight })
  .toBuffer();

// Right-weighted, leaving the left two-thirds as quiet field.
const left = Math.round(WIDTH * 0.62);
const top = HEIGHT - targetHeight;

const background = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <defs>
      <radialGradient id="indigo" cx="0.74" cy="0.22" r="0.62">
        <stop offset="0%" stop-color="rgb(${GLOW_INDIGO})" stop-opacity="0.40" />
        <stop offset="100%" stop-color="rgb(${GLOW_INDIGO})" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="cyan" cx="0.16" cy="0.78" r="0.60">
        <stop offset="0%" stop-color="rgb(${GLOW_CYAN})" stop-opacity="0.26" />
        <stop offset="100%" stop-color="rgb(${GLOW_CYAN})" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${FIELD}" />
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#indigo)" />
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#cyan)" />
  </svg>`,
);

await sharp(background)
  .composite([{ input: subject, left, top }])
  // JPEG, not WebP: the card is fetched by scrapers rather than browsers, and
  // several still treat WebP as an unknown type and drop the preview entirely.
  .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
  .toFile(OUTPUT);

const written = await sharp(OUTPUT).metadata();
console.log(
  `wrote ${OUTPUT} — ${written.width}×${written.height}, ` +
    `${Math.round((await readFile(OUTPUT)).byteLength / 1024)}KB`,
);
console.log(`subject bbox ${subjectWidth}×${subjectHeight} at (${minX},${minY}), scaled ${scale.toFixed(3)}`);
console.log(path.resolve(OUTPUT));
