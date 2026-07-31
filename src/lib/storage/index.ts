import "server-only";

import {
  isR2Configured,
  r2DeleteObject,
  r2GetObject,
  r2PutObject,
  r2SignedUrl,
} from "./r2";
import type { StorageBucket, StorageProvider } from "./buckets";

/**
 * One way to reach stored bytes, whichever backend holds them.
 *
 * Two backends are live at once, on purpose:
 *
 *   • Anything uploaded before the move to Cloudflare is still in Supabase
 *     storage and still works. Nothing had to be migrated for this to be true.
 *   • Anything uploaded from now on goes to R2, when R2 is configured.
 *
 * Which one a given file uses is recorded on its `media_assets` row rather than
 * guessed, so the two can coexist indefinitely and a half-migrated library is a
 * legal state rather than a broken one.
 *
 * The Supabase admin client is passed in rather than imported, which keeps this
 * module free of a dependency on request-scoped auth and makes it callable from
 * a route handler, a Server Action or a script without changing shape.
 */

/**
 * Just the storage surface this module uses.
 *
 * Structural rather than `SupabaseClient<Database>`: the generated database
 * generics are large, change whenever a migration lands, and have nothing to do
 * with reading and writing objects. Depending on the four methods actually
 * called keeps this module stable across schema changes.
 */
type AdminClient = {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Uint8Array,
        options: { contentType: string; upsert: boolean; cacheControl: string },
      ): Promise<{ error: { message: string } | null }>;
      remove(paths: string[]): Promise<unknown>;
      download(path: string): Promise<{ data: Blob | null; error: unknown }>;
      createSignedUrl(
        path: string,
        expiresIn: number,
        options: { download: boolean },
      ): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  };
};

/**
 * Where new uploads should go.
 *
 * R2 when it is configured, Supabase otherwise. Deliberately not a feature flag
 * anyone has to remember to set: configuring R2 *is* the intent to use it.
 */
export function activeStorageProvider(): StorageProvider {
  return isR2Configured() ? "r2" : "supabase";
}

export type PutResult = { provider: StorageProvider; error: string | null };

export async function putStorageObject(input: {
  bucket: StorageBucket;
  storagePath: string;
  body: Uint8Array;
  contentType: string;
  /** Private objects are read through the server, so caching them is pointless. */
  cacheControl?: string;
  admin: AdminClient;
}): Promise<PutResult> {
  const provider = activeStorageProvider();

  if (provider === "r2") {
    try {
      await r2PutObject({
        bucket: input.bucket,
        storagePath: input.storagePath,
        body: input.body,
        contentType: input.contentType,
        cacheControl: input.cacheControl,
      });
      return { provider, error: null };
    } catch (error) {
      return {
        provider,
        error: error instanceof Error ? error.message : "R2 upload failed.",
      };
    }
  }

  const { error } = await input.admin.storage
    .from(input.bucket)
    .upload(input.storagePath, input.body, {
      contentType: input.contentType,
      upsert: false,
      cacheControl: (input.cacheControl ?? "").includes("max-age=0")
        ? "0"
        : "31536000",
    });

  return { provider, error: error?.message ?? null };
}

export async function deleteStorageObject(input: {
  provider: StorageProvider;
  bucket: StorageBucket;
  storagePath: string;
  admin: AdminClient;
}): Promise<void> {
  if (input.provider === "r2") {
    await r2DeleteObject(input.bucket, input.storagePath);
    return;
  }

  await input.admin.storage.from(input.bucket).remove([input.storagePath]);
}

/**
 * Read an object server-side.
 *
 * This is what lets a private file be served without its URL ever reaching the
 * browser — the caller streams the bytes through its own route, so the storage
 * path stays server-side.
 */
export async function readStorageObject(input: {
  provider: StorageProvider;
  bucket: StorageBucket;
  storagePath: string;
  admin: AdminClient;
}): Promise<ArrayBuffer | null> {
  if (input.provider === "r2") {
    const object = await r2GetObject(input.bucket, input.storagePath);
    return object?.body ?? null;
  }

  const { data, error } = await input.admin.storage
    .from(input.bucket)
    .download(input.storagePath);

  if (error || !data) return null;
  return data.arrayBuffer();
}

/**
 * A short-lived URL for a private object.
 *
 * Used only where the browser has to fetch the file itself — currently just the
 * owner opening a certificate original in a new tab. Everything else streams
 * through the server instead.
 */
export async function signStorageUrl(input: {
  provider: StorageProvider;
  bucket: StorageBucket;
  storagePath: string;
  expiresInSeconds: number;
  admin: AdminClient;
}): Promise<string | null> {
  if (input.provider === "r2") {
    return r2SignedUrl(input.bucket, input.storagePath, input.expiresInSeconds);
  }

  const { data, error } = await input.admin.storage
    .from(input.bucket)
    .createSignedUrl(input.storagePath, input.expiresInSeconds, { download: false });

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export { isR2Configured } from "./r2";
export * from "./buckets";
