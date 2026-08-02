#!/usr/bin/env node
/**
 * Give the R2 buckets a CORS policy, so the browser may upload to them.
 *
 * ── Why this is needed ─────────────────────────────────────────────────────
 * A publication file goes straight from the browser to a presigned R2 URL,
 * because the hosting platform caps request bodies at 4.5 MB and a typeset book
 * is routinely larger. That PUT is a cross-origin request, and R2 rejects the
 * preflight unless the bucket carries a CORS policy naming the site origin.
 *
 * A bucket with no policy answers `NoSuchCORSConfiguration`, the preflight
 * fails, and the browser reports only "Failed to fetch" — no status, no body,
 * nothing in any server log, because the request never reached a server of ours.
 *
 * ── What this grants, and what it does not ─────────────────────────────────
 * `PUT` and `HEAD` from the origins you name, and nothing else. In particular:
 *
 *   · no `GET`. Reads still go through the application, which is what keeps a
 *     private bucket private — a CORS policy is not an access grant, but there
 *     is no reason to widen it beyond what the uploader uses.
 *   · no `*` origin. A wildcard would let any site on the internet drive an
 *     upload with a URL it had somehow obtained.
 *   · nothing about who may obtain a presigned URL. That is decided by
 *     `/api/admin/media/direct-upload`, which checks the session first.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *   node scripts/configure-r2-cors.mjs --origin https://your-site.example
 *   node scripts/configure-r2-cors.mjs --origin https://a.example --origin https://b.example
 *   node scripts/configure-r2-cors.mjs --show      # print the current policy
 *
 * Credentials come from the environment (.env), the same ones the application
 * signs with. Nothing is printed that could identify them.
 */

import fs from "node:fs";
import path from "node:path";
import { AwsClient } from "aws4fetch";

// ── Environment ─────────────────────────────────────────────────────────────

function loadEnv() {
  const merged = { ...process.env };

  // `.env` then `.env.local`, matching how Next resolves them: later wins.
  for (const file of [".env", ".env.local"]) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;

    for (const line of fs.readFileSync(full, "utf8").split("\n")) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue;
      const index = line.indexOf("=");
      const key = line.slice(0, index).trim();
      const value = line
        .slice(index + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (value) merged[key] = value;
    }
  }

  return merged;
}

const env = loadEnv();

const required = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PRIVATE_BUCKET_NAME",
];

const missing = required.filter((key) => !env[key]);
if (missing.length > 0) {
  console.error(`Missing environment: ${missing.join(", ")}`);
  process.exit(1);
}

// ── Arguments ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const showOnly = args.includes("--show");

const origins = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--origin" && args[i + 1]) origins.push(args[i + 1]);
}

/*
 * Local development is always included. The dev and preview servers are the
 * ones a developer will actually be uploading from while working on this, and
 * leaving them out produces the same opaque "Failed to fetch" the whole script
 * exists to prevent.
 */
const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3100",
  "http://127.0.0.1:3100",
];

const client = new AwsClient({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const buckets = [env.R2_BUCKET_NAME, env.R2_PRIVATE_BUCKET_NAME];

function endpoint(bucket) {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}?cors`;
}

async function show(bucket) {
  const response = await client.fetch(endpoint(bucket), { method: "GET" });
  const body = await response.text();

  if (response.status === 404) {
    console.log(`  ${bucket}: no CORS policy — browser uploads will be refused`);
    return;
  }

  console.log(`  ${bucket}: ${response.status}`);
  console.log(
    body
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n"),
  );
}

async function apply(bucket, allowed) {
  const rules = allowed
    .map(
      (origin) =>
        `<CORSRule>` +
        `<AllowedOrigin>${origin}</AllowedOrigin>` +
        `<AllowedMethod>PUT</AllowedMethod>` +
        `<AllowedMethod>HEAD</AllowedMethod>` +
        `<AllowedHeader>content-type</AllowedHeader>` +
        `<MaxAgeSeconds>3600</MaxAgeSeconds>` +
        `</CORSRule>`,
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration>${rules}</CORSConfiguration>`;

  const response = await client.fetch(endpoint(bucket), {
    method: "PUT",
    headers: { "Content-Type": "application/xml" },
    body: xml,
  });

  if (!response.ok) {
    console.error(`  ${bucket}: FAILED (${response.status})`);
    console.error((await response.text()).slice(0, 400));
    return false;
  }

  console.log(`  ${bucket}: policy applied`);
  return true;
}

// ── Run ─────────────────────────────────────────────────────────────────────

console.log(`R2 account ${env.R2_ACCOUNT_ID.slice(0, 6)}…\n`);

if (showOnly) {
  console.log("Current CORS policy:");
  for (const bucket of buckets) await show(bucket);
  process.exit(0);
}

if (origins.length === 0) {
  console.error(
    "No --origin given. Pass the site origin, e.g.\n" +
      "  node scripts/configure-r2-cors.mjs --origin https://your-site.vercel.app\n\n" +
      "Local development origins are always included.",
  );
  process.exit(1);
}

const allowed = [...new Set([...origins, ...DEV_ORIGINS])];

console.log("Allowing PUT and HEAD from:");
for (const origin of allowed) console.log(`  ${origin}`);
console.log("");

let ok = true;
for (const bucket of buckets) {
  if (!(await apply(bucket, allowed))) ok = false;
}

console.log("");
console.log(
  ok
    ? "Done. Browser uploads of publication files will now be accepted."
    : "One or more buckets could not be updated — see the errors above.",
);
process.exit(ok ? 0 : 1);
