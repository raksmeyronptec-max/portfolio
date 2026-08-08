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
 * Four passes over the raw RGB, no dependencies beyond sharp:
 *
 *   1. **Matte.** `greenness = G - max(R, B)` separates backdrop from subject
 *      far more reliably than distance to a reference colour, because it is
 *      indifferent to how brightly any given part of the screen is lit — and
 *      this screen is much brighter behind the head than at the corners.
 *      Alpha ramps linearly between two thresholds instead of switching at
 *      one, which is what keeps hair edges soft rather than jagged.
 *
 *   2. **The vignette.** Greenness alone is not enough, and the first version of
 *      this script shipped an asset that proved it: the backdrop is lit as a
 *      large radial glow, so its outer ring and corners fall away to near-black
 *      — measured at rgb(3,5,2), greenness 2. That is not green by any
 *      threshold, so it survived the matte as a hard rectangular slab of black
 *      framing the subject, which is the "pasted on" look the brief complains
 *      about. Dark backdrop is cleared by a second rule, `luminance < DARK_MAX
 *      && greenness >= DARK_GREEN_MIN`.
 *
 *      The greenness floor on that rule is load-bearing. The suit is also dark
 *      — and also reaches down to luminance 0 — so a rule keyed on darkness
 *      alone dissolves it and leaves the buttons and shirt cuffs floating. It
 *      is invisible against a dark page and obvious against a light one.
 *      Measured over 120k pixels: dark suit and hair are *negative* greenness
 *      and produce zero hits at this floor, while the dark backdrop sits at +3
 *      and above.
 *
 *   3. **Connectivity.** Both rules above are per-pixel, so neither can tell the
 *      near-black corner from a shadow inside a lapel. The subject is one
 *      connected blob: flood-fill the backdrop inward from the frame border,
 *      then keep only the largest surviving component. Islands — the speckle
 *      the corners break into, and any enclosed patch of screen — are backdrop
 *      by construction and get cleared. This is also what makes the darkness
 *      rule safe: it can only ever reach pixels that connect to the border.
 *
 *   4. **Despill.** Any pixel that survives but still leans green has its green
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
 *
 * ── After running it, clear the image cache ────────────────────────────────
 *   rm -rf .next/dev/cache/images
 *
 * The optimiser caches on the request URL, not on the bytes behind it, so a
 * rebuilt asset at the same path keeps serving the previous encode — through a
 * dev-server restart, because the cache is on disk. This is worth knowing
 * because of how it fails: the page renders the *old* matte, which looks
 * exactly like the script having had no effect, and the obvious next move is to
 * go change thresholds that were never the problem. Note the path is
 * `.next/dev/cache/images`, not `.next/cache/images`.
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

/*
 * The unlit outer ring of the backdrop, which is too dark to key on colour.
 *
 * Measured over sample blocks of the source (pixels with luminance < 17):
 *   suit chest    5223 negative greenness,      0 at >= +3
 *   suit lower   64641 negative greenness,      0 at >= +3
 *   hair          3214 dark pixels,             0 at >= +3
 *   corner TL                                6285 at >= +3
 *   corner BR                               10116 at >= +3
 *
 * Zero false positives on the subject at a +3 floor, which is why the floor is
 * here at all — see note 2 in the header.
 */
const DARK_MAX = 17;
const DARK_GREEN_MIN = 3;

/*
 * Width of the soft edge where cleared backdrop meets the subject. It matters
 * only along the bottom, where dark suit sits directly against dark backdrop
 * and there is no bright green to drive the matte ramp; elsewhere pass 1
 * already feathers the boundary. Beyond this distance the fill has proved the
 * pixel is backdrop, so it clears outright rather than leaving a half-opaque
 * grey ring — which an earlier revision did, at 24% of the frame.
 */
const FEATHER = 8;

const dryRun = process.argv.includes("--dry");

const source = await readFile(INPUT);
const { data, info } = await sharp(source)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height } = info;
const total = width * height;
const out = Buffer.alloc(total * 4);

const neighbours = (p) => {
  const x = p % width;
  const y = (p - x) / width;
  const list = [];
  if (x > 0) list.push(p - 1);
  if (x < width - 1) list.push(p + 1);
  if (y > 0) list.push(p - width);
  if (y < height - 1) list.push(p + width);
  return list;
};

const greenness = new Int16Array(total);
const luminance = new Uint8Array(total);
for (let p = 0; p < total; p++) {
  const r = data[p * 3];
  const g = data[p * 3 + 1];
  const b = data[p * 3 + 2];
  greenness[p] = g - Math.max(r, b);
  luminance[p] = (r + g + b) / 3;
}

// Anything the two per-pixel rules consider backdrop. Membership here is not
// yet a decision — pass 3 still has to prove the pixel reaches the border.
const candidate = new Uint8Array(total);
for (let p = 0; p < total; p++) {
  candidate[p] =
    greenness[p] > KEEP_BELOW ||
    (luminance[p] < DARK_MAX && greenness[p] >= DARK_GREEN_MIN)
      ? 1
      : 0;
}

// Pass 3a: flood the backdrop inward from the frame border.
const backdrop = new Uint8Array(total);
{
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  while (stack.length > 0) {
    const p = stack.pop();
    if (backdrop[p] === 1 || candidate[p] === 0) continue;
    backdrop[p] = 1;
    for (const q of neighbours(p)) stack.push(q);
  }
}

// Pass 3b: of what survived, keep only the largest connected component. The
// subject is one blob; everything else is unkeyed backdrop.
const component = new Int32Array(total).fill(-1);
let subjectId = -1;
let subjectSize = 0;
let componentCount = 0;
for (let seed = 0; seed < total; seed++) {
  if (backdrop[seed] === 1 || component[seed] !== -1) continue;
  const id = componentCount++;
  let size = 0;
  const stack = [seed];
  component[seed] = id;
  while (stack.length > 0) {
    const p = stack.pop();
    size++;
    for (const q of neighbours(p)) {
      if (backdrop[q] === 0 && component[q] === -1) {
        component[q] = id;
        stack.push(q);
      }
    }
  }
  if (size > subjectSize) {
    subjectSize = size;
    subjectId = id;
  }
}

let islands = 0;
for (let p = 0; p < total; p++) {
  if (backdrop[p] === 0 && component[p] !== subjectId) {
    backdrop[p] = 1;
    islands++;
  }
}

// Distance from the subject, capped at FEATHER — the soft edge of pass 2.
const distance = new Uint8Array(total).fill(255);
{
  let frontier = [];
  for (let p = 0; p < total; p++) {
    if (backdrop[p] === 0) {
      distance[p] = 0;
      frontier.push(p);
    }
  }
  for (let d = 1; d <= FEATHER && frontier.length > 0; d++) {
    const next = [];
    for (const p of frontier) {
      for (const q of neighbours(p)) {
        if (distance[q] === 255) {
          distance[q] = d;
          next.push(q);
        }
      }
    }
    frontier = next;
  }
}

let dropped = 0;
let partial = 0;

for (let p = 0; p < total; p++) {
  const i = p * 3;
  const o = p * 4;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const green = greenness[p];

  let alpha;
  if (green <= KEEP_BELOW) alpha = 255;
  else if (green >= DROP_ABOVE) alpha = 0;
  else alpha = Math.round(255 * (1 - (green - KEEP_BELOW) / (DROP_ABOVE - KEEP_BELOW)));

  if (backdrop[p] === 1) {
    alpha =
      distance[p] > FEATHER
        ? 0
        : Math.min(alpha, Math.round(255 * (1 - distance[p] / (FEATHER + 1))));
  }

  if (alpha === 0) dropped++;
  else if (alpha < 255) partial++;

  // Despill: pull green back toward the red/blue average, scaled by how much
  // of this pixel is being kept. A fully transparent pixel needs no despill;
  // a half-transparent hair edge needs most of it.
  let gOut = g;
  if (green > 0 && alpha > 0) {
    const neutral = (r + b) / 2;
    const strength = alpha / 255;
    gOut = Math.round(g - (g - neutral) * strength);
  }

  out[o] = r;
  out[o + 1] = gOut;
  out[o + 2] = b;
  out[o + 3] = alpha;
}

console.log(`source      ${width}×${height} (${INPUT})`);
console.log(`subject     ${((subjectSize / total) * 100).toFixed(1)}% of frame`);
console.log(`islands     ${islands} px cleared across ${componentCount - 1} stray components`);
console.log(`fully keyed ${((dropped / total) * 100).toFixed(1)}% of pixels`);
console.log(`soft edge   ${((partial / total) * 100).toFixed(2)}% of pixels`);

/*
 * The corners are what regressed last time, so assert on them rather than
 * trusting a glance at a dark-on-dark preview.
 */
for (const [name, x0, y0] of [
  ["top-left", 0, 0],
  ["top-right", width - 180, 0],
  ["bottom-left", 0, height - 180],
  ["bottom-right", width - 180, height - 180],
]) {
  let opaque = 0;
  for (let y = y0; y < y0 + 180; y++) {
    for (let x = x0; x < x0 + 180; x++) {
      if (out[(y * width + x) * 4 + 3] > 240) opaque++;
    }
  }
  const pct = (opaque / (180 * 180)) * 100;
  console.log(`corner      ${name.padEnd(13)} ${pct.toFixed(1)}% opaque`);
  if (pct > 1) {
    throw new Error(
      `Backdrop survived in the ${name} corner (${pct.toFixed(1)}% opaque). ` +
        `The vignette is not being keyed — check DARK_MAX / DARK_GREEN_MIN.`,
    );
  }
}

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
