/**
 * Remove the demonstration content created by `capture-journey-screenshots.mjs`.
 *
 * Deletes, in this order:
 *   1. the objects from whichever storage backend actually holds them,
 *   2. the `journey_media` attachments (media_id is ON DELETE RESTRICT),
 *   3. the `media_assets` rows,
 *   4. and reverts the seeded story to its original draft state.
 *
 * Scoped strictly to assets whose `original_filename` matches the synthetic
 * demo pattern, so it cannot touch the owner's real media.
 *
 * Usage:  node scripts/cleanup-journey-demo.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";
import { readFileSync } from "node:fs";

/** Minimal .env reader — this script runs outside Next, which normally loads them. */
function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      const [, key, raw] = match;
      if (process.env[key] !== undefined) continue; // first file wins
      process.env[key] = raw.trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* optional */
  }
}

loadEnv(".env.local");
loadEnv(".env");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Supabase env vars are missing.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

/**
 * The synthetic demo files, and nothing else.
 *
 * Two independent narrowings, because this script deletes storage objects and a
 * mistake here is not recoverable:
 *
 *   · the filename prefix, overridable so the same script can clear the
 *     batch-upload probe's files as well as the importer's;
 *   · the media kind, which is NOT overridable — the demo scripts only ever
 *     create these two, so nothing the owner uploaded by hand for a project,
 *     certificate, resume or profile can be matched however the pattern is set.
 */
const DEMO_FILENAME_PATTERN = process.env.DEMO_PATTERN ?? "IMG_45%";
const DEMO_KINDS = ["journey_photo", "video_poster"];

if (!DEMO_FILENAME_PATTERN.endsWith("%") || DEMO_FILENAME_PATTERN.length < 4) {
  // A bare "%" would match the whole library. Refuse rather than trust the caller.
  console.error(
    `Refusing to run: DEMO_PATTERN "${DEMO_FILENAME_PATTERN}" is too broad. ` +
      "Use a specific prefix such as 'IMG_45%'.",
  );
  process.exit(1);
}

console.log(`Supabase: ${SUPABASE_URL}`);

const { data: assets, error } = await supabase
  .from("media_assets")
  .select(
    "id, bucket_id, storage_path, thumbnail_path, card_path, preview_path, storage_provider, original_filename",
  )
  .in("kind", DEMO_KINDS)
  .like("original_filename", DEMO_FILENAME_PATTERN);

if (error) {
  console.error("Could not list demo assets:", error.message);
  process.exit(1);
}

if (!assets || assets.length === 0) {
  console.log("No demo assets found. Nothing to remove.");
} else {
  console.log(`Found ${assets.length} demo asset(s).`);

  // ── 1. Storage objects ────────────────────────────────────────────────────
  const r2 = process.env.R2_ACCESS_KEY_ID
    ? new AwsClient({
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        service: "s3",
        region: "auto",
      })
    : null;

  const r2Endpoint = process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : null;

  let removed = 0;
  let failed = 0;

  for (const asset of assets) {
    const paths = [
      asset.storage_path,
      asset.thumbnail_path,
      asset.card_path,
      asset.preview_path,
    ].filter(Boolean);

    for (const path of paths) {
      if (asset.storage_provider === "r2") {
        if (!r2 || !r2Endpoint) {
          console.warn(`  ! no R2 credentials; cannot remove ${path}`);
          failed += 1;
          continue;
        }

        // The logical bucket is the first key segment inside the physical bucket.
        const key = `${asset.bucket_id}/${path}`;
        const url = `${r2Endpoint}/${process.env.R2_BUCKET_NAME}/${key}`;

        try {
          const response = await r2.fetch(url, { method: "DELETE" });
          if (response.ok || response.status === 404) removed += 1;
          else {
            console.warn(`  ! R2 ${response.status} for ${key}`);
            failed += 1;
          }
        } catch (cause) {
          console.warn(`  ! R2 delete failed for ${key}: ${cause.message}`);
          failed += 1;
        }
      } else {
        const { error: removeError } = await supabase.storage
          .from(asset.bucket_id)
          .remove([path]);
        if (removeError) failed += 1;
        else removed += 1;
      }
    }
  }

  console.log(`  storage objects removed: ${removed}${failed ? `, failed: ${failed}` : ""}`);

  // ── 2. Attachments, then assets ───────────────────────────────────────────
  const ids = assets.map((asset) => asset.id);

  const { error: attachmentError } = await supabase
    .from("journey_media")
    .delete()
    .in("media_id", ids);
  if (attachmentError) console.warn("  ! attachments:", attachmentError.message);

  const { error: assetError } = await supabase
    .from("media_assets")
    .delete()
    .in("id", ids);
  if (assetError) console.warn("  ! assets:", assetError.message);
  else console.log(`  removed ${ids.length} media_assets row(s)`);
}

// ── 3. Revert the seeded story ──────────────────────────────────────────────
const { error: revertError } = await supabase
  .from("journey_entries")
  .update({
    status: "draft",
    featured: false,
    needs_review: true,
    cover_media_id: null,
  })
  .eq("slug", "science-fair-activities");

if (revertError) console.warn("  ! revert:", revertError.message);
else console.log("  reverted science-fair-activities to a needs-review draft");

const { error: translationError } = await supabase
  .from("journey_entry_translations")
  .update({ summary: null, story: null, highlights: null })
  .eq("locale", "en")
  .in(
    "journey_entry_id",
    (
      await supabase
        .from("journey_entries")
        .select("id")
        .eq("slug", "science-fair-activities")
    ).data?.map((row) => row.id) ?? [],
  );

if (translationError) console.warn("  ! translation:", translationError.message);

console.log("\n✓ Demo content removed.");
