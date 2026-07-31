/**
 * Logical storage buckets, and where they actually live.
 *
 * The four bucket names below are a *stable, logical* vocabulary. They are what
 * `media_assets.bucket_id` has always stored, and nothing here changes that —
 * which is the point. Moving the bytes to Cloudflare R2 must not invalidate a
 * single existing row, a single foreign key, or any of the CHECK constraints
 * that make "a certificate original is private" a database invariant rather
 * than an application convention.
 *
 * What changes is only the mapping from a logical bucket to a physical one.
 *
 * ── Why two R2 buckets ──────────────────────────────────────────────────────
 * R2 has no per-object access control. Public access is a property of the whole
 * bucket: turn on a custom domain or the public development URL and *every*
 * object in it is readable by anyone who can guess or enumerate its key. There
 * is no equivalent of the Supabase storage policies this project relied on.
 *
 * Certificate originals are scans that may carry a national ID number. Putting
 * them in the same bucket as the project screenshots would mean a single toggle
 * in the Cloudflare dashboard silently publishes them. So the split is physical:
 *
 *   porfolio           public  — served directly from the public URL
 *   portfolio-private  private — no public URL; reached only by a signed request
 *                                or a server-side read
 *
 * The private bucket must never be given a custom domain or a public
 * development URL. That is the whole reason it exists.
 */

export const storageBuckets = [
  "public-media",
  "certificate-previews",
  "certificate-originals",
  "resumes",
] as const;

export type StorageBucket = (typeof storageBuckets)[number];

export function isStorageBucket(value: string): value is StorageBucket {
  return (storageBuckets as readonly string[]).includes(value);
}

/**
 * Buckets whose contents are servable from a permanent public URL.
 *
 * Kept as an explicit allowlist rather than derived from a naming convention:
 * a typo in a bucket name should fail closed, not accidentally publish a scan.
 */
const PUBLIC_BUCKETS = new Set<StorageBucket>([
  "public-media",
  "certificate-previews",
]);

export function isPublicBucket(bucket: string): boolean {
  return PUBLIC_BUCKETS.has(bucket as StorageBucket);
}

/**
 * Which physical R2 bucket a logical bucket maps to.
 *
 * Public and private are separate buckets; the logical name then becomes a key
 * prefix inside whichever one it lands in, so the object layout stays readable
 * in the Cloudflare dashboard and a stray object cannot be mistaken for another
 * kind of asset.
 */
export function r2BucketFor(
  bucket: StorageBucket,
  buckets: { publicBucket: string; privateBucket: string },
): string {
  return isPublicBucket(bucket) ? buckets.publicBucket : buckets.privateBucket;
}

/**
 * The object key inside the physical bucket.
 *
 * The logical bucket is preserved as the first path segment. That keeps
 * `media_assets.storage_path` meaning exactly what it always meant — a path
 * *within* its logical bucket — so no row has to be rewritten.
 */
export function r2KeyFor(bucket: StorageBucket, storagePath: string): string {
  return `${bucket}/${storagePath}`;
}

/** Where the bytes for a given media row live. */
export const storageProviders = ["supabase", "r2"] as const;
export type StorageProvider = (typeof storageProviders)[number];

export function isStorageProvider(value: string): value is StorageProvider {
  return (storageProviders as readonly string[]).includes(value);
}
