#!/usr/bin/env node
/**
 * Chroma-key the hero portrait's studio backdrop.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `public/image/MyPF.jpg` is a studio shot on a bright green screen. Every
 * attempt to tame that in CSS failed, and each failure taught the same lesson
 * from a different angle:
 *
 *   saturate(0.3) over the whole frame   killed the green, and the skin with
 *                                        it — the face is the one region that
 *                                        was already correctly exposed
 *   mix-blend-color masked to an ellipse green halo on the mask boundary, and
 *                                        a blue suit, because the shoulders
 *                                        reach the frame edge
 *   edge-anchored colour washes          never reached the middle: the glow is
 *                                        a large radial centred behind the
 *                                        head, not a rim light
 *
 * The backdrop is a separate object from the subject, so the fix is to treat it
 * as one and remove it. With the green gone, the portrait's environment becomes
 * ordinary CSS layers behind a transparent PNG, which is what the brief asks
 * for and what makes the lighting tunable without touching the photograph.
 *
 * ── How the key works ──────────────────────────────────────────────────────
 * Two passes over the raw RGB, no dependencies beyond sharp:
 *
 *   1. **Matte.** `greenness = G - max(R, B)` separates backdrop from subject
 *      far more reliably than distance to a reference colour, because it is
 *      indifferent to how brightly any given part of the screen is lit — and
 *      this screen is much brighter behind the head than at the corners.
 *      Alpha ramps linearly between two thresholds instead of switching at
 *      one, which is what keeps hair edges soft rather than jagged.
 *
 *   2. **Despill.** Any pixel that survives but still leans green has its green
 *      channel pulled back to the average of red and blue, proportionally to
 *      how much alpha it kept. Without this every edge keeps a green rim that
 *      is far more obvious against a navy background than it was against the
 *      screen it came from.
 *
 * Output is WebP. The alpha channel is the entire point, and WebP carries it —
 * losslessly encoding the same matte as PNG produced a 2.6 MB file, which is a
 * poor thing to commit and a worse thing to make the largest contentful paint
 * depend on. `next/image` re-encodes and resizes on delivery anyway, so what
 * matters here is that the file in git is small and the alpha survives.
 *
 * Usage:
 *   node scripts/key-portrait.mjs                 # writes the default output
 *   node scripts/key-portrait.mjs --dry           # report coverage, write nothing
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const INPUT = "public/image/MyPF.jpg";
const OUTPUT = "public/image/portrait-keyed.webp";

/*
 * Thresholds, chosen against measured values rather than by eye.
 *
 * Subject greenness, sampled from the source:
 *   skin   111 − max(141, 94) = −30
 *   suit    15 − max( 17, 19) =  −4
 *   shirt                     ≈   0
 *
 * Backdrop greenness:
 *   bright centre             ≈ +38
 *   dim outer ring   51 − 19  = +32
 *
 * The whole subject sits at or below zero and the whole backdrop above +30, so
 * the ramp can be tight without risking the person. A first pass used 12/46 and
 * left the dim outer ring at 41% opacity — a visible olive halo once the bright
 * centre was gone, which is the artefact these numbers exist to remove.
 */
/** Below this greenness a pixel is fully subject. */
const KEEP_BELOW = 5;
/** Above this greenness a pixel is fully backdrop. */
const DROP_ABOVE = 22;

const dryRun = process.argv.includes("--dry");

const source = await readFile(INPUT);
const { data, info } = await sharp(source)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height } = info;
const out = Buffer.alloc(width * height * 4);

let dropped = 0;
let partial = 0;

for (let i = 0, o = 0; i < data.length; i += 3, o += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];

  const greenness = g - Math.max(r, b);

  let alpha;
  if (greenness <= KEEP_BELOW) alpha = 255;
  else if (greenness >= DROP_ABOVE) alpha = 0;
  else {
    alpha = Math.round(255 * (1 - (greenness - KEEP_BELOW) / (DROP_ABOVE - KEEP_BELOW)));
    partial++;
  }

  if (alpha === 0) dropped++;

  // Despill: pull green back toward the red/blue average, scaled by how much
  // of this pixel is being kept. A fully transparent pixel needs no despill;
  // a half-transparent hair edge needs most of it.
  let gOut = g;
  if (greenness > 0 && alpha > 0) {
    const neutral = (r + b) / 2;
    const strength = alpha / 255;
    gOut = Math.round(g - (g - neutral) * strength);
  }

  out[o] = r;
  out[o + 1] = gOut;
  out[o + 2] = b;
  out[o + 3] = alpha;
}

const total = width * height;
console.log(`source      ${width}×${height} (${INPUT})`);
console.log(`fully keyed ${((dropped / total) * 100).toFixed(1)}% of pixels`);
console.log(`soft edge   ${((partial / total) * 100).toFixed(2)}% of pixels`);

if (dryRun) {
  console.log("\n--dry: nothing written.");
  process.exit(0);
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toFile(OUTPUT);

const written = await sharp(OUTPUT).metadata();
console.log(
  `\nwrote ${OUTPUT} — ${written.width}×${written.height}, ` +
    `${Math.round((await readFile(OUTPUT)).byteLength / 1024)}KB, alpha=${written.hasAlpha}`,
);
console.log(path.resolve(OUTPUT));
