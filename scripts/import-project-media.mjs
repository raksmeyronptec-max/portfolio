#!/usr/bin/env node
/**
 * Project screenshot capture and import.
 *
 *   node scripts/import-project-media.mjs [--dry-run]
 *
 * Captures the three live platforms, processes the captures exactly the way the
 * admin upload route does, uploads them to the `public-media` bucket, registers
 * them in `media_assets`, and links them to their project as a cover plus
 * gallery entries.
 *
 * Why a script and not a migration
 *   Image binaries do not belong in SQL. A migration that carried base64 PNGs
 *   would be unreviewable, would bloat every clone of the repository forever,
 *   and could not re-capture a site after it was redesigned. This can be re-run.
 *
 * Idempotence
 *   Storage paths are deterministic (`projects/<slug>/<key>.webp`), uploads use
 *   upsert, and `media_assets` is keyed on (bucket_id, storage_path). Re-running
 *   replaces the image in place instead of accumulating orphans. The project
 *   links are replaced, not appended.
 *
 * Edit safety
 *   A project whose `needs_review` flag has been cleared by a human is skipped
 *   entirely — same rule the SQL content import uses. And a cover that has
 *   already been set to some *other* asset is never overwritten.
 *
 * ── Privacy rules this script enforces ──────────────────────────────────────
 *   1. Only unauthenticated, public pages are ever visited. There is no login
 *      step, no cookie, no stored session, and no credential of any kind.
 *   2. The KruSmart capture is its public sign-in screen with empty fields.
 *      Nothing is typed into it. No authenticated screen is captured, because
 *      no test account was supplied — see docs/PROJECT-RESEARCH-2026-07-31.md.
 *   3. Nothing behind an account, and nothing from /admin, /dashboard, /profile
 *      or any private-list route, is in the URL list below. Adding one would be
 *      a privacy decision, not a config change.
 *   4. sharp re-encodes every capture to WebP, which strips metadata.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "public-media";

/*
 * Derivative widths and encoder settings are copied from src/lib/media/process.ts
 * rather than imported: that module is `server-only` and uses the `@/` path
 * alias, neither of which survives outside Next. Keep the two in step.
 */
const DERIVATIVES = [
  { suffix: "thumb", width: 200, quality: 72, column: "thumbnail_path" },
  { suffix: "card", width: 800, quality: 80, column: "card_path" },
  { suffix: "preview", width: 1600, quality: 80, column: "preview_path" },
];
const MAX_DIMENSION = 2400;

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 2 };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true };

/**
 * What to capture.
 *
 * `cover` marks the single shot used as the project's cover image and social
 * preview. Everything else becomes a gallery entry on the case-study page.
 * Alt text is written for both locales here rather than left null, because the
 * database has a content-health index looking for exactly that omission.
 */
const TARGETS = [
  {
    slug: "ptec-digital-library",
    shots: [
      {
        key: "home-desktop",
        url: "https://library.ptec.edu.kh/",
        viewport: DESKTOP,
        variant: "desktop_screenshot",
        cover: true,
        altEn: "The PTEC Digital Library home page on a desktop browser.",
        altKm: "ទំព័រដើមបណ្ណាល័យឌីជីថល PTEC នៅលើកុំព្យូទ័រ។",
        captionEn: "The home page, in its English version.",
        captionKm: "ទំព័រដើម ជាភាសាអង់គ្លេស។",
      },
      {
        key: "books-desktop",
        url: "https://library.ptec.edu.kh/books",
        viewport: DESKTOP,
        variant: "desktop_screenshot",
        altEn: "The book catalogue listing, showing covers, filters and search.",
        altKm: "ទំព័របញ្ជីសៀវភៅ ដែលបង្ហាញគម្រប តម្រង និងការស្វែងរក។",
        captionEn: "Browsing the digital book collection.",
        captionKm: "ការរុករកឯកសារសៀវភៅឌីជីថល។",
      },
      {
        key: "record-desktop",
        url: "https://library.ptec.edu.kh/books/pisa-d",
        viewport: DESKTOP,
        variant: "desktop_screenshot",
        altEn:
          "A book record page, with its description and the reading and reviews tabs.",
        altKm: "ទំព័រកំណត់ត្រាសៀវភៅ ជាមួយការពិពណ៌នា និងផ្ទាំងអាន និងមតិយោបល់។",
        captionEn: "A record opens on its description; reading and reviews sit alongside.",
        captionKm: "កំណត់ត្រាបើកចេញជាមួយការពិពណ៌នា ដោយមានផ្ទាំងអាន និងមតិយោបល់នៅជាប់គ្នា។",
      },
      {
        key: "home-mobile-km",
        url: "https://library.ptec.edu.kh/km",
        viewport: MOBILE,
        variant: "mobile_screenshot",
        altEn: "The library home page in Khmer on a phone-sized screen.",
        altKm: "ទំព័រដើមបណ្ណាល័យជាភាសាខ្មែរនៅលើអេក្រង់ទូរស័ព្ទ។",
        captionEn: "The Khmer version on a phone, with the persistent bottom bar.",
        captionKm: "ភាសាខ្មែរនៅលើទូរស័ព្ទ ជាមួយរបារខាងក្រោមថេរ។",
      },
    ],
  },
  {
    slug: "krusmart",
    shots: [
      {
        // The public sign-in screen. Fields are left empty and nothing is typed.
        key: "signin-desktop",
        url: "https://www.krusmart.org/",
        viewport: DESKTOP,
        variant: "desktop_screenshot",
        cover: true,
        altEn:
          "The KruSmart sign-in screen, in Khmer, with empty email and password fields.",
        altKm: "អេក្រង់ចូលគណនី KruSmart ជាភាសាខ្មែរ ដោយវាលអុីមែល និងពាក្យសម្ងាត់នៅទទេ។",
        captionEn:
          "The account gate. Everything past this point is private, so nothing past it is shown.",
        captionKm:
          "ច្រកចូលគណនី។ អ្វីៗនៅខាងក្រោយចំណុចនេះជាឯកជន ដូច្នេះមិនបង្ហាញអ្វីទាំងអស់។",
      },
      {
        key: "signin-mobile",
        url: "https://www.krusmart.org/",
        viewport: MOBILE,
        variant: "mobile_screenshot",
        altEn: "The KruSmart sign-in screen on a phone-sized screen.",
        altKm: "អេក្រង់ចូលគណនី KruSmart នៅលើអេក្រង់ទូរស័ព្ទ។",
        captionEn: "The same screen on a phone — the size the product is mostly used at.",
        captionKm: "អេក្រង់ដដែលនៅលើទូរស័ព្ទ — ជាទំហំដែលផលិតផលនេះត្រូវបានប្រើភាគច្រើន។",
      },
    ],
  },
  {
    slug: "ptec-storage",
    shots: [
      {
        key: "landing-desktop",
        url: "https://storage-ptec.online/",
        viewport: DESKTOP,
        variant: "desktop_screenshot",
        cover: true,
        altEn:
          "The PTEC Storage landing page: a single card reading “File delivery service for library.ptec.edu.kh. There is nothing to see here.”",
        altKm:
          "ទំព័រដើម PTEC Storage៖ កាតតែមួយសរសេរថា «សេវាបញ្ជូនឯកសារសម្រាប់ library.ptec.edu.kh។ គ្មានអ្វីត្រូវមើលនៅទីនេះទេ។»",
        captionEn: "The entire user interface. That is the design, not an omission.",
        captionKm: "នេះជាផ្ទាំងប្រើប្រាស់ទាំងមូល។ វាជាការរចនា មិនមែនជាការភ្លេចទេ។",
      },
    ],
  },
];

// ── Environment ─────────────────────────────────────────────────────────────

/** Minimal .env reader — no dependency, and it never logs a value. */
function loadEnvFile(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  } catch {
    // Absent file is fine: the variables may come from the real environment.
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Set them in .env.local (git-ignored) or in the environment.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Image processing ────────────────────────────────────────────────────────

async function processCapture(input) {
  const checksum = createHash("sha256").update(input).digest("hex");
  const meta = await sharp(input).metadata();
  const sourceWidth = meta.width ?? 0;

  const main = await sharp(input)
    .resize({ width: Math.min(sourceWidth, MAX_DIMENSION), withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const derivatives = [];
  for (const derivative of DERIVATIVES) {
    if (derivative.width > sourceWidth * 1.1) continue;
    const result = await sharp(input)
      .resize({ width: derivative.width, withoutEnlargement: true })
      .webp({ quality: derivative.quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    derivatives.push({ ...derivative, buffer: result.data });
  }

  let blurDataUrl = null;
  try {
    const blur = await sharp(input)
      .resize(16, 16, { fit: "inside" })
      .webp({ quality: 40 })
      .toBuffer();
    blurDataUrl = `data:image/webp;base64,${blur.toString("base64")}`;
  } catch {
    // Cosmetic only.
  }

  return {
    checksum,
    blurDataUrl,
    main: { buffer: main.data, width: main.info.width, height: main.info.height },
    derivatives,
  };
}

// ── Import ──────────────────────────────────────────────────────────────────

async function upload(storagePath, buffer) {
  if (DRY_RUN) return;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "31536000",
    });
  if (error) throw new Error(`upload ${storagePath}: ${error.message}`);
}

async function run() {
  const browser = await chromium.launch();
  const summary = [];

  try {
    for (const target of TARGETS) {
      const { data: project, error } = await supabase
        .from("projects")
        .select("id, slug, needs_review, review_note, cover_media_id")
        .eq("slug", target.slug)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) throw new Error(`lookup ${target.slug}: ${error.message}`);
      if (!project) {
        console.warn(`· ${target.slug}: no such project, skipped`);
        continue;
      }

      // Same guard as the SQL content import: once a human has reviewed the
      // project, automation stops touching it.
      const stillImported =
        project.needs_review &&
        (project.review_note === null || project.review_note.startsWith("Verified from"));

      if (!stillImported) {
        console.log(`· ${target.slug}: reviewed by a human, left alone`);
        continue;
      }

      const mediaIds = [];
      let coverId = null;

      for (const [index, shot] of target.shots.entries()) {
        const context = await browser.newContext({
          viewport: { width: shot.viewport.width, height: shot.viewport.height },
          deviceScaleFactor: shot.viewport.deviceScaleFactor,
          isMobile: Boolean(shot.viewport.isMobile),
          hasTouch: Boolean(shot.viewport.isMobile),
          // No storageState: every capture starts with an empty, anonymous
          // browser profile. There is nothing to sign in with and nothing to
          // carry over between shots.
          locale: "en-US",
        });

        const page = await context.newPage();
        console.log(`  capturing ${shot.url} @ ${shot.viewport.width}px`);

        await page.goto(shot.url, { waitUntil: "networkidle", timeout: 60_000 });
        // Let webfonts settle and any entry animation finish, so the capture is
        // not of a half-painted page.
        await page.waitForTimeout(2500);

        const capture = await page.screenshot({ type: "png", fullPage: false });
        await context.close();

        const processed = await processCapture(capture);
        const base = `projects/${target.slug}/${shot.key}`;

        await upload(`${base}.webp`, processed.main.buffer);
        const derivativePaths = {};
        for (const derivative of processed.derivatives) {
          const derivativePath = `${base}-${derivative.suffix}.webp`;
          await upload(derivativePath, derivative.buffer);
          derivativePaths[derivative.column] = derivativePath;
        }

        const row = {
          bucket_id: BUCKET,
          storage_path: `${base}.webp`,
          kind: shot.cover ? "project_cover" : "project_screenshot",
          visibility: "public",
          original_filename: `${target.slug}-${shot.key}.webp`,
          mime_type: "image/webp",
          file_size_bytes: processed.main.buffer.byteLength,
          checksum_sha256: processed.checksum,
          width: processed.main.width,
          height: processed.main.height,
          blur_data_url: processed.blurDataUrl,
          thumbnail_path: null,
          card_path: null,
          preview_path: null,
          ...derivativePaths,
          alt_text_en: shot.altEn,
          alt_text_km: shot.altKm,
          caption_en: shot.captionEn,
          caption_km: shot.captionKm,
          credit: `Screenshot of ${new URL(shot.url).host}, captured ${new Date().toISOString().slice(0, 10)}.`,
          requires_privacy_review: false,
        };

        if (DRY_RUN) {
          console.log(`    would register ${row.storage_path} (${row.width}×${row.height})`);
          continue;
        }

        const { data: asset, error: assetError } = await supabase
          .from("media_assets")
          .upsert(row, { onConflict: "bucket_id,storage_path" })
          .select("id")
          .single();

        if (assetError) throw new Error(`media_assets ${base}: ${assetError.message}`);

        mediaIds.push({ id: asset.id, variant: shot.variant, sort: index });
        if (shot.cover) coverId = asset.id;
      }

      if (DRY_RUN) continue;

      // Replace this project's gallery rather than appending to it, so a re-run
      // cannot leave a stale screenshot of a redesigned site behind.
      await supabase.from("project_media").delete().eq("project_id", project.id);

      const { error: linkError } = await supabase.from("project_media").insert(
        mediaIds.map((media) => ({
          project_id: project.id,
          media_id: media.id,
          variant: media.variant,
          sort_order: media.sort,
        })),
      );
      if (linkError) throw new Error(`project_media ${target.slug}: ${linkError.message}`);

      /*
       * Set the cover only if there is not already a different one. An admin who
       * uploaded a real cover in the media manager has made a decision, and a
       * capture script does not get to overrule it.
       */
      if (coverId && (!project.cover_media_id || project.cover_media_id === coverId)) {
        const { error: coverError } = await supabase
          .from("projects")
          .update({ cover_media_id: coverId, og_image_media_id: coverId })
          .eq("id", project.id);
        if (coverError) throw new Error(`cover ${target.slug}: ${coverError.message}`);
      }

      summary.push(`${target.slug}: ${mediaIds.length} images`);
    }
  } finally {
    await browser.close();
  }

  console.log(DRY_RUN ? "\nDry run complete." : `\nDone. ${summary.join(" · ")}`);
}

run().catch((error) => {
  console.error(`\nFailed: ${error.message}`);
  process.exit(1);
});
