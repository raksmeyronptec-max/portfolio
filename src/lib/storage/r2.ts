import "server-only";

import { AwsClient } from "aws4fetch";

import {
  isPublicBucket,
  r2BucketFor,
  r2KeyFor,
  type StorageBucket,
} from "./buckets";

/**
 * Cloudflare R2 object storage.
 *
 * R2 speaks the S3 API, so every call here is an ordinary HTTPS request signed
 * with AWS SigV4. `aws4fetch` does the signing — about 10 KB, purpose-built for
 * exactly this — rather than the AWS SDK, which is three orders of magnitude
 * larger for the four operations this project actually needs and would land on
 * the cold-start path of every media request.
 *
 * Server-only, and deliberately so: `R2_SECRET_ACCESS_KEY` grants read and write
 * to both buckets. The only R2 value that may reach the browser is
 * `NEXT_PUBLIC_R2_PUBLIC_URL`, which is a public host name.
 */

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBucket: string;
  privateBucket: string;
  /** Origin serving the public bucket. No trailing slash. */
  publicUrl: string;
};

function trimEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  // Values pasted from a dashboard routinely arrive wrapped in quotes.
  const value = raw.trim().replace(/^["']|["']$/g, "");
  return value === "" ? null : value;
}

let cached: R2Config | null | undefined;

/**
 * Resolved R2 configuration, or null when R2 is not set up.
 *
 * Returning null rather than throwing is what lets this project run against
 * Supabase storage alone — a checkout with no R2 credentials still boots, still
 * serves existing media, and still passes its tests.
 */
export function r2Config(): R2Config | null {
  if (cached !== undefined) return cached;

  const accountId = trimEnv("R2_ACCOUNT_ID");
  const accessKeyId = trimEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = trimEnv("R2_SECRET_ACCESS_KEY");
  const publicBucket = trimEnv("R2_BUCKET_NAME");
  const publicUrl = trimEnv("NEXT_PUBLIC_R2_PUBLIC_URL");

  if (!accountId || !accessKeyId || !secretAccessKey || !publicBucket || !publicUrl) {
    cached = null;
    return cached;
  }

  cached = {
    accountId,
    accessKeyId,
    secretAccessKey,
    publicBucket,
    // Defaults to "<public>-private" so a deployment that sets only the four
    // required values still gets a genuinely separate private bucket rather
    // than silently sharing the public one.
    privateBucket: trimEnv("R2_PRIVATE_BUCKET_NAME") ?? `${publicBucket}-private`,
    publicUrl: publicUrl.replace(/\/+$/, ""),
  };

  return cached;
}

export function isR2Configured(): boolean {
  return r2Config() !== null;
}

/** Test seam: forget the memoised config after the environment changes. */
export function resetR2ConfigCache(): void {
  cached = undefined;
}

let client: AwsClient | null = null;

function r2Client(config: R2Config): AwsClient {
  if (!client) {
    client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      // R2 ignores the region but SigV4 requires one in the credential scope.
      region: "auto",
      service: "s3",
    });
  }
  return client;
}

function endpointFor(config: R2Config, bucket: StorageBucket, storagePath: string): string {
  const physical = r2BucketFor(bucket, config);
  const key = r2KeyFor(bucket, storagePath)
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  return `https://${config.accountId}.r2.cloudflarestorage.com/${physical}/${key}`;
}

// ── Public URLs ─────────────────────────────────────────────────────────────

/**
 * Permanent public URL for an object, or null when there cannot be one.
 *
 * Null for anything in a private bucket. That is not a convenience — it is the
 * same refusal `publicStorageUrl` has always made for Supabase private buckets,
 * and it is what stops a caller from rendering a certificate scan into a page by
 * accident.
 */
export function r2PublicUrl(
  bucket: string,
  storagePath: string | null | undefined,
  config: R2Config | null = r2Config(),
): string | null {
  if (!storagePath || !config) return null;
  if (!isPublicBucket(bucket)) return null;

  const key = r2KeyFor(bucket as StorageBucket, storagePath)
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  return `${config.publicUrl}/${key}`;
}

// ── Operations ──────────────────────────────────────────────────────────────

export type PutObjectInput = {
  bucket: StorageBucket;
  storagePath: string;
  body: Uint8Array;
  contentType: string;
  /** Defaults to one year: every object key already carries a random segment. */
  cacheControl?: string;
};

export async function r2PutObject(input: PutObjectInput): Promise<void> {
  const config = r2Config();
  if (!config) throw new Error("R2 is not configured.");

  const response = await r2Client(config).fetch(
    endpointFor(config, input.bucket, input.storagePath),
    {
      method: "PUT",
      // A fresh copy: aws4fetch hashes the body, and a Uint8Array view over a
      // larger ArrayBuffer would otherwise be signed over the wrong bytes.
      body: new Uint8Array(input.body),
      headers: {
        "Content-Type": input.contentType,
        "Cache-Control": input.cacheControl ?? "public, max-age=31536000, immutable",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `R2 upload failed for ${input.bucket}/${input.storagePath}: ${response.status}`,
    );
  }
}

export async function r2DeleteObject(
  bucket: StorageBucket,
  storagePath: string,
): Promise<void> {
  const config = r2Config();
  if (!config) throw new Error("R2 is not configured.");

  const response = await r2Client(config).fetch(
    endpointFor(config, bucket, storagePath),
    { method: "DELETE" },
  );

  // 404 means the object is already gone, which is the state the caller wanted.
  if (!response.ok && response.status !== 404) {
    throw new Error(
      `R2 delete failed for ${bucket}/${storagePath}: ${response.status}`,
    );
  }
}

export type R2Object = {
  body: ArrayBuffer;
  contentType: string | null;
  contentLength: number | null;
};

/**
 * Read an object server-side.
 *
 * This is how private files are served without ever handing a URL to the
 * browser: the resume download route reads the bytes here and streams them
 * through itself, so the storage path stays out of the client entirely.
 */
export async function r2GetObject(
  bucket: StorageBucket,
  storagePath: string,
): Promise<R2Object | null> {
  const config = r2Config();
  if (!config) return null;

  const response = await r2Client(config).fetch(
    endpointFor(config, bucket, storagePath),
    { method: "GET" },
  );

  if (!response.ok) return null;

  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type"),
    contentLength: Number(response.headers.get("content-length")) || null,
  };
}

/**
 * A time-limited URL for a private object.
 *
 * Used for exactly one thing: letting the owner open a certificate original in
 * a new tab. The expiry is short by design and the caller audit-logs every
 * request, so "who looked at this scan, and when" stays answerable.
 *
 * Signed into the query string rather than the Authorization header, because
 * the browser will be following this URL on its own.
 */
export async function r2SignedUrl(
  bucket: StorageBucket,
  storagePath: string,
  expiresInSeconds: number,
): Promise<string | null> {
  const config = r2Config();
  if (!config) return null;

  const url = new URL(endpointFor(config, bucket, storagePath));
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));

  const signed = await r2Client(config).sign(
    new Request(url, { method: "GET" }),
    { aws: { signQuery: true } },
  );

  return signed.url;
}
