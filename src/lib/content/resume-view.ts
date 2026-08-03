import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import {
  compareByPeriod,
  formatExperiencePeriod,
  formatNumeral,
  parseExperiencePeriod,
  type ExperiencePeriod,
} from "./experience-period";
import { dedupeTags, resolveTag, trackForKind } from "./experience-taxonomy";
import { splitContributions } from "./experience-view";
import { trackForSlug } from "./education-view";

/**
 * The Resume page's view model.
 *
 * ── Why a résumé needs its own derivation ──────────────────────────────────
 * The résumé reads the same CMS rows as Experience and Education — it always
 * did, and that part was right. What it lacked was their *normalisation*: it
 * printed `period_label` verbatim, so a reader saw "2023 — 2028 (expected)",
 * "First-year practicum · 2024–2025" and a Khmer page carrying Latin digits,
 * all in one document. Everything here reuses the two pages' existing
 * derivations rather than restating them, and adds only what a résumé needs
 * that a portfolio page does not: reverse-chronological order, condensed
 * contributions, and one capability summary.
 *
 * ── Reverse chronological, deliberately ────────────────────────────────────
 * The Experience page reads oldest-first, because it argues that classroom
 * practice led to product work. A résumé is scanned by someone deciding
 * whether to keep reading, so the most recent role has to be first. Same
 * comparator, reversed — not a second sort with its own opinion.
 */

// ── Inputs ──────────────────────────────────────────────────────────────────

/** Structural shapes — see the note in experience-view.ts on server-only. */
export type ResumeExperienceInput = {
  id: string;
  slug: string;
  kind: string;
  roleTitle: string;
  organization: string;
  location: string | null;
  summary: string | null;
  achievements: string | null;
  periodLabel: string | null;
  startedOn: string | null;
  endedOn: string | null;
  isCurrent: boolean;
  tags: Array<{ id: string; slug: string; label: string; labelEn: string }>;
  sortOrder: number;
};

export type ResumeEducationInput = {
  id: string;
  slug: string;
  institution: string;
  qualification: string | null;
  fieldOfStudy: string | null;
  periodLabel: string | null;
  scheduleLabel: string | null;
  startedOn: string | null;
  endedOn: string | null;
  isCurrent: boolean;
  gradeValue: string | null;
  gradeScale: string | null;
};

export type ResumeProjectInput = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  liveUrl: string | null;
  role: string | null;
  technologies: Array<{ slug: string; name: string }>;
  categories: Array<{ slug: string; name: string }>;
};

export type ResumePublicationInput = {
  id: string;
  slug: string;
  href: string;
  title: string;
  subject: string | null;
  year: number | null;
  contentLanguage: string | null;
  typeName: string | null;
};

// ── Outputs ─────────────────────────────────────────────────────────────────

export type ResumeExperienceEntry = {
  id: string;
  slug: string;
  /** Deep link into the Experience page's own entry. */
  href: string;
  track: "education" | "product";
  categoryLabel: string;
  roleTitle: string;
  organization: string;
  location: string | null;
  period: ExperiencePeriod;
  periodLabel: string | null;
  isCurrent: boolean;
  summary: string | null;
  /** Capped: a résumé entry earns four lines, not seven. */
  contributions: string[];
  /** Projects this role's own prose names, as evidence chips. */
  evidence: Array<{ id: string; label: string; href: string }>;
};

export type ResumeEducationEntry = {
  id: string;
  slug: string;
  institution: string;
  qualification: string | null;
  fieldOfStudy: string | null;
  periodLabel: string | null;
  scheduleLabel: string | null;
  isCurrent: boolean;
  gradeValue: string | null;
  gradeScale: string | null;
};

export type CapabilityGroup = {
  id: "education" | "product" | "engineering" | "quality";
  label: string;
  items: string[];
};

export type ResumeContactLink = {
  id: string;
  label: string;
  /** What the reader sees — never a raw tracking URL. */
  display: string;
  href: string;
  icon: "mail" | "telegram" | "globe" | "linkedin" | "mapPin";
  /** Printed after the label on paper, where a link cannot be followed. */
  printValue: string | null;
};

/** A résumé entry shows at most this many contributions. */
export const RESUME_CONTRIBUTION_LIMIT = 4;

// ── Experience ──────────────────────────────────────────────────────────────

export function buildResumeExperience({
  entries,
  projects,
  locale,
  t,
}: {
  entries: ResumeExperienceInput[];
  projects: ResumeProjectInput[];
  locale: Locale;
  t: Dictionary;
}): ResumeExperienceEntry[] {
  const kindLabels = t.experience.kind as Record<string, string | undefined>;

  const built = entries.map((entry) => {
    const period = parseExperiencePeriod(entry);

    /*
     * Evidence links reuse the Experience page's rule: a project is linked only
     * when this entry's own achievements name it. Matching is on the slug, so
     * the Khmer résumé links the same products — their names appear in Latin
     * script in both catalogues.
     */
    const haystack = `${entry.summary ?? ""}\n${entry.achievements ?? ""}`
      .toLowerCase()
      .replace(/\s+/g, " ");

    const evidence = projects
      .filter((project) => {
        const needle = project.slug.replace(/-/g, " ").toLowerCase();
        return needle.length >= 4 && haystack.includes(needle);
      })
      .map((project) => ({
        id: project.id,
        label: project.title,
        href: localePath(locale, `projects/${project.slug}`),
      }));

    return {
      id: entry.id,
      slug: entry.slug,
      href: `${localePath(locale, "experience")}#experience-${entry.slug}`,
      track: trackForKind(entry.kind),
      categoryLabel: kindLabels[entry.kind] ?? entry.kind,
      roleTitle: entry.roleTitle,
      organization: entry.organization,
      location: entry.location,
      period,
      periodLabel: formatExperiencePeriod(period, locale, t.common.present),
      isCurrent: entry.isCurrent,
      summary: entry.summary,
      contributions: splitContributions(entry.achievements).slice(
        0,
        RESUME_CONTRIBUTION_LIMIT,
      ),
      evidence,
      sortOrder: entry.sortOrder,
    };
  });

  // Most recent first — the same comparator the Experience page uses, reversed.
  return built
    .sort((a, b) => compareByPeriod(b, a))
    .map(({ sortOrder: _sortOrder, ...entry }) => entry);
}

// ── Education ───────────────────────────────────────────────────────────────

/**
 * Education split into current study and completed qualifications.
 *
 * The two are different claims and a résumé must not blur them: an in-progress
 * degree with an expected year is not a qualification held. The Education
 * page's own `trackForSlug` orders the current programmes so both pages agree
 * on which degree leads.
 */
export function buildResumeEducation({
  entries,
  locale,
  t,
}: {
  entries: ResumeEducationInput[];
  locale: Locale;
  t: Dictionary;
}): { current: ResumeEducationEntry[]; completed: ResumeEducationEntry[] } {
  const current: ResumeEducationEntry[] = [];
  const completed: ResumeEducationEntry[] = [];

  const completedYears = new Map<string, number>();

  for (const entry of entries) {
    const period = parseExperiencePeriod(entry);
    if (period.startYear !== null) completedYears.set(entry.id, period.startYear);

    let periodLabel: string | null;
    if (entry.isCurrent && period.startYear !== null && period.endYear !== null) {
      // "2023—Expected 2028" — the word carries the whole distinction.
      periodLabel = t.education.status.expectedRange
        .replace("{start}", formatNumeral(period.startYear, locale))
        .replace("{end}", formatNumeral(period.endYear, locale));
    } else {
      periodLabel = formatExperiencePeriod(period, locale, t.common.present);
    }

    const built: ResumeEducationEntry = {
      id: entry.id,
      slug: entry.slug,
      institution: entry.institution,
      qualification: entry.qualification,
      fieldOfStudy: entry.fieldOfStudy,
      periodLabel,
      scheduleLabel: entry.scheduleLabel,
      isCurrent: entry.isCurrent,
      gradeValue: entry.gradeValue,
      gradeScale: entry.gradeScale,
    };

    if (entry.isCurrent) current.push(built);
    else completed.push(built);
  }

  // Teacher education leads, matching the Education page; completed
  // qualifications read newest first, as a résumé expects.
  current.sort(
    (a, b) =>
      Number(trackForSlug(b.slug) === "teacher") -
      Number(trackForSlug(a.slug) === "teacher"),
  );

  /*
   * Newest qualification first, sorted on the parsed year rather than the
   * rendered label — a Khmer label sorts by codepoint, which is not a
   * chronology.
   */
  completed.sort(
    (a, b) => (completedYears.get(b.id) ?? 0) - (completedYears.get(a.id) ?? 0),
  );

  return { current, completed };
}

// ── Capabilities ────────────────────────────────────────────────────────────

/**
 * Capability groups, derived from evidence rather than declared.
 *
 * `skill_categories` is empty in production, so the old page's Skills section
 * silently rendered nothing. Rather than hand-write a list — which would be a
 * claim with no backing — these are assembled from vocabulary the CMS already
 * holds: the tags on experience entries and the technologies and categories on
 * published projects. Every item therefore traces to a role or a product that
 * exists.
 *
 * The four buckets are the résumé's own framing of that vocabulary. A term
 * matching nothing is dropped, and an empty group is not rendered.
 */
const CAPABILITY_KEYS: Record<CapabilityGroup["id"], readonly string[]> = {
  education: [
    "primary-education",
    "teacher-education",
    "pedagogy",
    "lesson-planning",
    "classroom-management",
    "student-assessment",
    "alias:teachingPracticum",
    "alias:privateTutoring",
    "mathematics",
  ],
  product: [
    "alias:uxUiDesign",
    "education-technology",
    "digital-libraries",
    "academic-repository",
    "storage-infrastructure",
  ],
  engineering: [
    "next-js",
    "react",
    "typescript",
    "supabase",
    "postgresql",
    "firebase",
    "cloudflare",
  ],
  quality: ["accessibility", "technical-seo", "web-application"],
};

/** Items per group. A résumé summarises a capability; it does not inventory it. */
const CAPABILITY_ITEM_LIMIT = 6;

export function buildResumeCapabilities({
  experiences,
  projects,
  t,
}: {
  experiences: ResumeExperienceInput[];
  projects: ResumeProjectInput[];
  t: Dictionary;
}): CapabilityGroup[] {
  /*
   * One vocabulary, keyed by canonical tag key.
   *
   * Both sources are resolved through `resolveTag` on their *display name*,
   * which is what collapses the near-duplicates the two tables genuinely
   * contain: the experience tag "Next.js" and the technology slug `nextjs`
   * both key to `next-js`, and the tag "UX/UI" and the project category
   * "UX/UI" both alias to one canonical label. Keying projects by their raw
   * slug instead printed "Next.js" twice and "UX/UI Design" beside "UX/UI".
   */
  const vocabulary = new Map<string, string>();

  const add = (labelEn: string, label: string) => {
    const resolved = resolveTag({ labelEn, label }, t);
    if (!vocabulary.has(resolved.key)) vocabulary.set(resolved.key, resolved.label);
  };

  for (const entry of experiences) {
    for (const tag of dedupeTags(entry.tags.map((tag) => resolveTag(tag, t)))) {
      if (!vocabulary.has(tag.key)) vocabulary.set(tag.key, tag.label);
    }
  }

  for (const project of projects) {
    for (const item of [...project.technologies, ...project.categories]) {
      add(item.name, item.name);
    }
  }

  return (Object.keys(CAPABILITY_KEYS) as Array<CapabilityGroup["id"]>)
    .map((id) => ({
      id,
      label: t.resume.capabilities[id],
      items: CAPABILITY_KEYS[id]
        .map((key) => vocabulary.get(key))
        .filter((label): label is string => Boolean(label))
        .slice(0, CAPABILITY_ITEM_LIMIT),
    }))
    .filter((group) => group.items.length > 0);
}

// ── Contact ─────────────────────────────────────────────────────────────────

/**
 * Contact rows, with display text that is never a raw URL.
 *
 * The old page printed `https://t.me/Ron_Raksmey` as the visible Telegram
 * value and the projects section printed three bare product URLs as body text.
 * On paper a URL is the only way to follow a link, so it is kept — but as a
 * print-only value beside a readable label, not as the label itself.
 *
 * Nothing is emitted that the CMS does not hold, and tracking parameters are
 * stripped from the stored LinkedIn URL rather than shown to a reader.
 */
export function buildResumeContact({
  settings,
  locale,
  t,
  siteUrl,
}: {
  settings: {
    contactEmail: string | null;
    telegramHandle: string | null;
    linkedinUrl: string | null;
    location: string | null;
  };
  locale: Locale;
  t: Dictionary;
  siteUrl: string;
}): ResumeContactLink[] {
  const links: ResumeContactLink[] = [];

  if (settings.contactEmail) {
    links.push({
      id: "email",
      label: t.contact.directEmail,
      display: settings.contactEmail,
      href: `mailto:${settings.contactEmail}`,
      icon: "mail",
      printValue: null,
    });
  }

  if (settings.telegramHandle) {
    // Stored as a full t.me URL; the handle is what a reader recognises.
    const handle = settings.telegramHandle
      .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "")
      .replace(/^@/, "");
    const href = /^https?:\/\//i.test(settings.telegramHandle)
      ? settings.telegramHandle
      : `https://t.me/${handle}`;

    links.push({
      id: "telegram",
      label: t.contact.directTelegram,
      display: `@${handle}`,
      href,
      icon: "telegram",
      printValue: href,
    });
  }

  if (settings.linkedinUrl) {
    const cleaned = stripTrackingParams(settings.linkedinUrl);
    links.push({
      id: "linkedin",
      label: t.resume.contact.linkedin,
      display: t.resume.contact.linkedinDisplay,
      href: cleaned,
      icon: "linkedin",
      printValue: cleaned,
    });
  }

  const portfolio = `${siteUrl.replace(/\/$/, "")}${localePath(locale)}`;
  links.push({
    id: "portfolio",
    label: t.resume.contact.portfolio,
    display: portfolio.replace(/^https?:\/\//, ""),
    href: portfolio,
    icon: "globe",
    printValue: null,
  });

  return links;
}

/**
 * Drop share/analytics parameters from a stored profile URL.
 *
 * The LinkedIn URL in the CMS arrived from a mobile share sheet and carries
 * `utm_*` and `utm_content` values. They identify how the link was shared, add
 * nothing for a reader, and look unprofessional printed on a résumé.
 */
export function stripTrackingParams(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_|^ref$|^trk$/i.test(key)) url.searchParams.delete(key);
    }
    url.search = url.searchParams.toString();
    return url.toString();
  } catch {
    return rawUrl;
  }
}

// ── Publications ────────────────────────────────────────────────────────────

export type ResumePublicationEntry = {
  id: string;
  title: string;
  href: string;
  /** "Mathematics · Khmer · 2026", already localised and de-nulled. */
  meta: string;
};

/**
 * Selected publications, in a compact citation-like line.
 *
 * Capped at three: the résumé's job is to establish that authored work exists
 * and point at the full list, not to be the catalogue.
 */
export function buildResumePublications({
  publications,
  locale,
  t,
}: {
  publications: ResumePublicationInput[];
  locale: Locale;
  t: Dictionary;
}): ResumePublicationEntry[] {
  const languageLabels: Record<string, string | undefined> = {
    km: t.resume.publications.khmer,
    en: t.resume.publications.english,
    bilingual: t.resume.publications.bilingual,
  };

  return publications.slice(0, 3).map((publication) => ({
    id: publication.id,
    title: publication.title,
    href: publication.href,
    meta: [
      publication.typeName,
      publication.subject,
      publication.contentLanguage
        ? languageLabels[publication.contentLanguage]
        : null,
      publication.year !== null ? formatNumeral(publication.year, locale) : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
  }));
}
