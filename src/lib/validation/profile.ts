import { z } from "zod";

/**
 * The site owner's public profile — schema and error labels.
 *
 * These live here rather than beside the Server Action that uses them because a
 * `"use server"` module may only export async functions. Next enforces that when
 * the module is loaded to run an action, and a schema object exported from one
 * makes *every* action in that file fail with:
 *
 *   A "use server" file can only export async functions, found object.
 *
 * The failure never appears in development and never appears on a GET — it
 * surfaces only when an action is actually invoked in a production build, which
 * is the worst possible place to discover it. Keeping non-function values in a
 * plain module makes the mistake structurally impossible.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

function isAllowedPortraitUrl(value: string): boolean {
  if (value.startsWith("/image/") && !value.includes("..")) return true;

  let candidate: URL;
  try {
    candidate = new URL(value);
  } catch {
    return false;
  }

  if (candidate.protocol !== "https:") return false;

  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabase) {
    try {
      const base = new URL(supabase);
      if (
        candidate.origin === base.origin &&
        candidate.pathname.startsWith("/storage/v1/object/public/")
      ) {
        return true;
      }
    } catch {
      // An invalid deployment variable must not broaden the allowlist.
    }
  }

  const r2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (r2) {
    try {
      const base = new URL(r2);
      const basePath = base.pathname.replace(/\/+$/, "");
      if (
        candidate.origin === base.origin &&
        candidate.pathname.startsWith(`${basePath}/public-media/`)
      ) {
        return true;
      }
    } catch {
      // An invalid deployment variable must not broaden the allowlist.
    }
  }

  return false;
}

export const ownerProfileSchema = z.object({
  display_name: z.string().trim().min(1, { message: "nameRequired" }).max(120),
  public_headline_en: optionalText(300),
  public_headline_km: optionalText(300),
  public_bio_en: optionalText(6000),
  public_bio_km: optionalText(6000),
  public_location: optionalText(200),
  /**
   * Either a media asset chosen from the library or an empty string. Stored
   * alongside the resolved URL so "which upload is this?" stays answerable.
   */
  avatar_media_id: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine(
      (value) =>
        value === null ||
        value === undefined ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
      { message: "invalidMediaId" },
    ),
  /**
   * A legacy `/image/portrait.jpg` path or a URL on the configured public
   * Supabase/R2 image origin. This mirrors next/image's allowlist instead of
   * accepting a URL the public page cannot render.
   * Root-relative is allowed because the migrated portrait still lives in
   * `public/`; refusing it would mean pretending the file is not there.
   */
  public_avatar_url: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine(
      (value) =>
        value === null ||
        value === undefined ||
        isAllowedPortraitUrl(value),
      { message: "avatarUrlFormat" },
    )
    .refine((value) => value === null || value === undefined || !value.startsWith("//"), {
      message: "avatarUrlFormat",
    }),
});

export const profileErrorLabels: Record<string, string> = {
  nameRequired: "A display name is required.",
  invalidMediaId: "Choose a portrait from the media library, or leave it unset.",
  avatarUrlFormat:
    "Use a legacy /image/ path or choose a public image from the configured media library.",
};

export type OwnerProfileInput = z.infer<typeof ownerProfileSchema>;
