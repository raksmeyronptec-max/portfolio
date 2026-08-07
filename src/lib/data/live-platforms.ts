/**
 * Verified live platforms, used *only* as an empty-state fallback.
 *
 * Why this exists
 *   A portfolio whose Projects page says "there are no published projects yet"
 *   reads as abandoned. These three platforms are real, public and in daily
 *   use, so when the CMS has nothing published the public pages link to them
 *   instead of showing an apology.
 *
 * What this is NOT
 *   This is not project content and it must never become project content. It
 *   carries only facts that can be verified by opening the URL: the product
 *   name, the URL, and a one-line description of what the site is. There are no
 *   metrics, no user counts, no team sizes, no technology claims and no dates —
 *   those live in the CMS, entered by a human who can confirm them.
 *
 * Precedence
 *   Published CMS projects always win. The moment `projects` returns a row,
 *   none of this is rendered. Seeded rows for these same three platforms exist
 *   in supabase/seed.sql, so in a normally-populated environment this file is
 *   dead weight — which is the intended steady state.
 */

/**
 * Placeholder cover screenshots, keyed by project slug.
 *
 * These are real captures of the live sites, committed as optimised WebP under
 * `public/image/projects/`. They exist so a project that has no cover uploaded
 * yet still renders as a shipped product rather than as a grey placeholder box.
 *
 * A CMS cover always wins — see `coverFallbackFor`, which is only consulted
 * when `project.cover` resolves to nothing. Uploading a cover in the admin
 * media manager therefore replaces these with no code change.
 *
 * They are screenshots, not claims: nothing here asserts a feature, a metric or
 * a date. Re-capture them if a platform is redesigned.
 */
const coverFallbacks: Record<string, string> = {
  krusmart: "/image/projects/krusmart.webp",
  "ptec-digital-library": "/image/projects/ptec-digital-library.webp",
  "ptec-storage": "/image/projects/ptec-storage.webp",
};

/*
 * Tiny, pre-blurred versions of the committed screenshots. Static imports
 * would generate these automatically, but the fallback is selected by a CMS
 * slug at runtime, so the images are addressed by public URL instead. Keeping
 * the LQIPs beside that lookup preserves the same blur-up behaviour as an
 * uploaded CMS cover without sending another request.
 */
const coverFallbackBlurData: Record<string, string> = {
  krusmart:
    "data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAACQAQCdASoQAAoABIByJZwAAudUwMAA/vNrvj4/sAAAAA==",
  "ptec-digital-library":
    "data:image/webp;base64,UklGRj4AAABXRUJQVlA4IDIAAADwAQCdASoQAAoABIByJYwCdAEKk1wLkgAA/ryP1XaXI8/1hgCiSlyM2np+IUwTcsAQAA==",
  "ptec-storage":
    "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoQAAoABIByJaQAA3AA/vDeAAA=",
};

/**
 * The placeholder screenshot for a project slug, or null when there is none.
 *
 * `alt` is intentionally generic and descriptive of what the image *is* — a
 * screenshot of the home page — rather than describing content the screenshot
 * may no longer show after the platform is redesigned.
 */
export function coverFallbackFor(
  slug: string,
  altTemplate: string,
): { src: string; alt: string; blurDataURL: string | null } | null {
  const src = coverFallbacks[slug];
  if (!src) return null;

  const platform = livePlatforms.find((entry) => entry.key === slug);
  return {
    src,
    alt: altTemplate.replace("{name}", platform?.name ?? slug),
    blurDataURL: coverFallbackBlurData[slug] ?? null,
  };
}

export type LivePlatform = {
  key: string;
  name: string;
  url: string;
  /** Category label. Kept generic; the CMS row carries the real taxonomy. */
  kind: { en: string; km: string };
  blurb: { en: string; km: string };
};

export const livePlatforms: readonly LivePlatform[] = [
  {
    key: "krusmart",
    name: "KruSmart",
    url: "https://www.krusmart.org/",
    kind: { en: "Education Technology", km: "បច្ចេកវិទ្យាអប់រំ" },
    blurb: {
      en: "A digital platform supporting teachers and teaching practice.",
      km: "វេទិកាឌីជីថលគាំទ្រគ្រូបង្រៀន និងការអនុវត្តការបង្រៀន។",
    },
  },
  {
    // Keys match the CMS project slugs so `coverFallbackFor` can look either up.
    key: "ptec-digital-library",
    name: "PTEC Digital Library",
    url: "https://library.ptec.edu.kh/",
    kind: { en: "Academic Repository", km: "ឃ្លាំងឯកសារសិក្សា" },
    blurb: {
      en: "An academic repository and digital library for the college.",
      km: "ឃ្លាំងឯកសារសិក្សា និងបណ្ណាល័យឌីជីថលសម្រាប់មហាវិទ្យាល័យ។",
    },
  },
  {
    key: "ptec-storage",
    name: "PTEC Storage",
    url: "https://storage-ptec.online/",
    kind: { en: "Storage Infrastructure", km: "ហេដ្ឋារចនាសម្ព័ន្ធផ្ទុក" },
    blurb: {
      en: "Internal file and media storage supporting the college's platforms.",
      km: "ការផ្ទុកឯកសារ និងមេឌៀផ្ទៃក្នុងសម្រាប់វេទិការបស់មហាវិទ្យាល័យ។",
    },
  },
] as const;
