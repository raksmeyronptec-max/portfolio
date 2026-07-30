import "server-only";

import { publicStorageUrl } from "@/lib/content/media";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { FormOption } from "./admin-forms";

/**
 * Loader for the owner-profile editor.
 *
 * Reads through the RLS-constrained client and filters on the caller's own id, so
 * the editor can only ever load the row the caller is permitted to update.
 */

export type OwnerProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  public_headline_en: string | null;
  public_headline_km: string | null;
  public_bio_en: string | null;
  public_bio_km: string | null;
  public_location: string | null;
  public_avatar_url: string | null;
  avatar_media_id: string | null;
  is_site_owner: boolean;
};

export async function getOwnerProfileRow(
  userId: string,
): Promise<OwnerProfileRow | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("profiles")
      .select(
        `id, email, display_name, public_headline_en, public_headline_km,
         public_bio_en, public_bio_km, public_location,
         public_avatar_url, avatar_media_id, is_site_owner`,
      )
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return data as OwnerProfileRow;
  } catch {
    return null;
  }
}

/**
 * Public image assets offerable as a portrait, each carrying the resolved public
 * URL so the form can keep `public_avatar_url` and `avatar_media_id` in step
 * without a second round trip.
 */
export type PortraitOption = FormOption & { url: string | null };

export async function listPortraitOptions(): Promise<PortraitOption[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("media_assets")
      .select(
        `id, bucket_id, storage_path, card_path, original_filename,
         alt_text_en, width, height`,
      )
      .eq("visibility", "public")
      .in("kind", ["profile_image", "open_graph_image", "other"])
      .neq("mime_type", "application/pdf")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data) return [];

    return data.map((row) => {
      const dimensions =
        row.width && row.height ? ` · ${row.width}×${row.height}` : "";

      return {
        id: row.id,
        label: `${row.alt_text_en ?? row.original_filename}${dimensions}`,
        url: publicStorageUrl(row.bucket_id, row.card_path ?? row.storage_path),
      };
    });
  } catch {
    return [];
  }
}
