import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  importDirectory,
  scanImportDirectory,
  sharpSupportsHeic,
  type ScanResult,
} from "@/lib/media/import-scan";

/**
 * The initial folder scan, run on the server when the import page renders.
 *
 * Doing it here rather than from an effect in the client component means the
 * first paint already shows the file list — and, more usefully, means the client
 * has no mount-time data fetch at all. Re-scanning is a button, which is a real
 * user event.
 *
 * Read through the RLS-constrained client rather than the service role. The
 * checksums come from `media_assets`, which an authenticated admin can already
 * read; using the service role would work identically and would therefore mask a
 * broken policy. It is also outside the service-role import allowlist in
 * `eslint.config.mjs`, which is the same rule stated mechanically.
 */
export async function scanImportFolder(): Promise<ScanResult> {
  const directory = importDirectory();

  if (!directory) {
    return {
      available: false,
      directory: null,
      files: [],
      videos: [],
      skipped: [],
      truncated: false,
      heicSupported: sharpSupportsHeic(),
    };
  }

  let checksums = new Set<string>();

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();

      // One query for every checksum in the library, so an already-imported file
      // is flagged rather than silently offered again. Re-importing the same
      // photograph is the easiest way to end up with two rows pointing at one
      // picture and two divergent sets of alt text.
      const { data } = await supabase
        .from("media_assets")
        .select("checksum_sha256")
        .not("checksum_sha256", "is", null)
        .is("deleted_at", null);

      checksums = new Set(
        (data ?? [])
          .map((row) => row.checksum_sha256)
          .filter((value): value is string => typeof value === "string"),
      );
    } catch {
      // A failed lookup only costs the "already imported" hint; the scan itself
      // is still worth showing.
    }
  }

  return scanImportDirectory(checksums);
}
