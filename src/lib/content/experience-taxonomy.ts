/**
 * The Experience page's vocabulary: tracks, canonical tag keys and themes.
 *
 * ── Two tracks, derived not stored ─────────────────────────────────────────
 * The page's argument is that teaching and engineering are one direction, which
 * needs each entry assigned to a side. There is no `track` column and adding one
 * would mean a migration plus an admin field for a value that is already
 * implied by `kind`. So it is derived here, in one place, and documented — the
 * moment the CMS grows a real column this function becomes a one-line lookup.
 *
 * ── Canonical keys, not rewritten content ──────────────────────────────────
 * The live content carries `Teaching Practicum` while the seed carries
 * `Practicum`; `12+4 Programme` and `12+4 System` are the same programme. Two
 * spellings of one concept read as sloppiness on the page and split the evidence
 * map in half.
 *
 * The fix is deliberately *not* a table of English replacement strings. That
 * would silently drop `label_km` for every aliased tag, which is exactly the
 * class of bug this codebase exists to remove. Instead an alias resolves to a
 * **dictionary key**, so the canonical form is translated like every other piece
 * of UI chrome. Tags with no alias render the editor's own words, untouched.
 *
 * Only exact-concept duplicates are aliased. `Mathematics` and `Primary
 * Mathematics` are *not* merged: the second is more specific and the editor
 * meant it. They are grouped under one theme instead, which is what themes are
 * for.
 */

import type { Dictionary } from "@/i18n/messages/en";

// ── Tracks ──────────────────────────────────────────────────────────────────

export type ExperienceTrack = "education" | "product";

/**
 * `experiences.kind` values that belong to the product track.
 *
 * Everything else — teaching, practicum, tutoring, volunteer, leadership,
 * other — is education practice. Defaulting that way is the safe direction: an
 * unrecognised kind lands on the track that carries the classroom evidence,
 * which is where a new teaching-adjacent kind almost certainly belongs, and it
 * can never silently claim engineering work that was not done.
 */
const PRODUCT_KINDS = new Set(["development", "engineering", "product"]);

export function trackForKind(kind: string): ExperienceTrack {
  return PRODUCT_KINDS.has(kind.toLowerCase()) ? "product" : "education";
}

// ── Tag keys ────────────────────────────────────────────────────────────────

/**
 * A stable, locale-independent key for a tag.
 *
 * Derived from the *English* label, because that is the one field every tag on
 * this site has — `label_km` is null throughout the live content. Matching on
 * the localised label would make the Khmer page group differently from the
 * English one, which is the sort of divergence nobody notices until it is old.
 */
export function tagKey(labelEn: string): string {
  return labelEn
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Dictionary keys under `experience.tagAliases`. */
export type TagAliasKey = keyof Dictionary["experience"]["tagAliases"];

/**
 * Tag keys that denote the same concept, and the canonical name for it.
 *
 * Both spellings map to the same alias, so whichever the editor typed the page
 * shows one term — and the evidence map counts them once.
 */
const TAG_ALIASES: Record<string, TagAliasKey> = {
  practicum: "teachingPracticum",
  "teaching-practicum": "teachingPracticum",
  "12-4-system": "programme12Plus4",
  "12-4-programme": "programme12Plus4",
  "ux-ui": "uxUiDesign",
  "ui-design": "uxUiDesign",
  "ux-ui-design": "uxUiDesign",
  tutoring: "privateTutoring",
  "private-tutoring": "privateTutoring",
};

export type ResolvedTag = {
  /** Stable identity for React keys and de-duplication. */
  key: string;
  /** What the reader sees, already localised. */
  label: string;
};

/**
 * Resolve one CMS tag to its canonical key and localised display label.
 *
 * When a tag is aliased the canonical key is the alias — so `Practicum` and
 * `Teaching Practicum` collapse to one entry — and the label comes from the
 * dictionary, so Khmer readers get Khmer. Otherwise the editor's own label is
 * used verbatim, which is the case for the overwhelming majority of tags.
 */
export function resolveTag(
  tag: { labelEn: string; label: string },
  t: Dictionary,
): ResolvedTag {
  const key = tagKey(tag.labelEn);
  const alias = TAG_ALIASES[key];

  if (alias) {
    return { key: `alias:${alias}`, label: t.experience.tagAliases[alias] };
  }

  return { key, label: tag.label };
}

/** De-duplicate resolved tags, keeping first-seen order (the CMS's order). */
export function dedupeTags(tags: ResolvedTag[]): ResolvedTag[] {
  const seen = new Set<string>();
  const output: ResolvedTag[] = [];

  for (const tag of tags) {
    if (seen.has(tag.key)) continue;
    seen.add(tag.key);
    output.push(tag);
  }

  return output;
}

// ── Themes ──────────────────────────────────────────────────────────────────

/**
 * The themes the evidence map is organised by.
 *
 * A theme is a lens, not a taxonomy of everything: it collects the tags,
 * technologies and project categories that all point at one capability, so the
 * page can answer "what evidences this?" with real links instead of a
 * self-assessed score.
 *
 * Each theme lists the keys it matches. Those keys are drawn from three real
 * vocabularies that happen to share a slug space:
 *
 *   · `experience_tags.label_en`      → via `tagKey`
 *   · `technologies.slug`             → already slugs
 *   · `project_categories.slug`       → already slugs
 *
 * Both spellings are listed where the two vocabularies disagree (`next-js` from
 * a tag, `nextjs` from the technology table). A theme with no evidence is not
 * rendered, so an empty CMS produces an absent section rather than a hollow one.
 */
export type ExperienceThemeId =
  | "mathematics"
  | "lessonPlanning"
  | "classroomPractice"
  | "learnerSupport"
  | "productDesign"
  | "engineering"
  | "academicSystems";

export type ExperienceTheme = {
  id: ExperienceThemeId;
  track: ExperienceTrack;
  keys: readonly string[];
  /** Publications count as evidence only where the subject really matches. */
  matchesPublicationSubject?: (subject: string) => boolean;
};

export const EXPERIENCE_THEMES: readonly ExperienceTheme[] = [
  {
    id: "mathematics",
    track: "education",
    keys: ["mathematics", "primary-mathematics", "mathematics-instruction"],
    // The four published books are mathematics texts; their `subject_en` values
    // are "Mathematics", "Mathematical Analysis" and "Functions and
    // Mathematical Analysis". A prefix test covers all three without listing
    // them, and refuses anything that is not a mathematics subject.
    matchesPublicationSubject: (subject) => /mathemat/i.test(subject),
  },
  {
    id: "lessonPlanning",
    track: "education",
    keys: ["lesson-planning", "pedagogy", "teacher-education"],
  },
  {
    id: "classroomPractice",
    track: "education",
    keys: [
      "classroom-management",
      "classroom-observation",
      "student-assessment",
      "primary-education",
    ],
  },
  {
    id: "learnerSupport",
    track: "education",
    keys: [
      "student-support",
      "individualised-learning",
      "alias:privateTutoring",
    ],
  },
  {
    id: "productDesign",
    track: "product",
    keys: ["alias:uxUiDesign", "ux-ui", "education-technology"],
  },
  {
    id: "engineering",
    track: "product",
    keys: [
      "next-js",
      "nextjs",
      "supabase",
      "postgresql",
      "react",
      "typescript",
      "accessibility",
      "technical-seo",
      "firebase",
      "cloudflare",
      "cloudflare-r2",
    ],
  },
  {
    id: "academicSystems",
    track: "product",
    keys: [
      "digital-libraries",
      "academic-repository",
      "storage-infrastructure",
      "web-application",
    ],
  },
];

/** Does any of `keys` belong to this theme? */
export function themeMatches(
  theme: ExperienceTheme,
  keys: readonly string[],
): boolean {
  return keys.some((key) => theme.keys.includes(key));
}
