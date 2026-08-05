import { localePath, type Locale } from "@/i18n/config";

/**
 * Pure view-model helpers for the About page.
 *
 * The public loaders remain the security boundary: every row passed here has
 * already crossed the anonymous RLS/public-view filters. This module only
 * curates those published records into a short personal narrative; it never
 * invents dates, claims, metrics or prose in place of missing CMS content.
 */

export type AboutText = {
  id: string;
  text: string;
  contentLocale: Locale | null;
};

export type AboutChapterInput = {
  id: string;
  slug: string;
  featured: boolean;
  title: string;
  summary: string | null;
  periodLabel: string | null;
  year: string | null;
  eventDate: string | null;
  categorySlug: string | null;
  contentLocale: Locale | null;
  cover: {
    src: string;
    width: number | null;
    height: number | null;
    alt: string;
    objectPosition: string | null;
    blurDataURL?: string | null;
  } | null;
};

export type AboutEducationInput = {
  id: string;
  slug: string;
  kind: string;
  institution: string;
  qualification: string | null;
  fieldOfStudy: string | null;
  description: string | null;
  periodLabel: string | null;
  isCurrent: boolean;
  contentLocale: Locale | null;
};

export type AboutExperienceInput = {
  id: string;
  slug: string;
  kind: string;
  roleTitle: string;
  organization: string;
  summary: string | null;
  description: string | null;
  periodLabel: string | null;
  isCurrent: boolean;
  contentLocale: Locale | null;
};

export type AboutProjectInput = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  problem: string | null;
  role: string | null;
  liveUrl: string | null;
  yearLabel: string | null;
  contentLocale: Locale | null;
};

export type AboutFocusItem = {
  id: string;
  kind: "study" | "practice" | "product";
  title: string;
  description: string | null;
  period: string | null;
  href: string;
  contentLocale: Locale | null;
};

export type AboutChapterEvidence = {
  id: string;
  title: string;
  summary: string;
  period: string;
  href: string;
  contentLocale: Locale | null;
};

type SingleChapterKind = "foundation" | "product" | "fieldwork";

type SingleChapter = {
  kind: SingleChapterKind;
  id: string;
  title: string;
  evidence: readonly [AboutChapterEvidence];
  cover: AboutChapterInput["cover"];
};

type DualStudyChapter = {
  kind: "dual-study";
  id: "dual-study";
  title: string;
  evidence: readonly [AboutChapterEvidence, AboutChapterEvidence];
  cover: null;
};

export type AboutChapterView = SingleChapter | DualStudyChapter;

function usable(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function firstUsable(...values: Array<string | null | undefined>): string | null {
  return values.find(usable) ?? null;
}

/** Keep the authored biography first, then add only published supporting prose. */
export function buildAboutStory({
  biography,
  locale,
  education,
  experiences,
}: {
  biography: string | null;
  locale: Locale;
  education: AboutEducationInput[];
  experiences: AboutExperienceInput[];
}): AboutText[] {
  const candidates: AboutText[] = [];

  if (usable(biography)) {
    candidates.push({ id: "profile-biography", text: biography, contentLocale: locale });
  }

  for (const entry of education.filter((item) => item.isCurrent).slice(0, 2)) {
    if (!usable(entry.description)) continue;
    candidates.push({
      id: `education-${entry.id}`,
      text: entry.description,
      contentLocale: entry.contentLocale,
    });
  }

  const practice =
    experiences.find(
      (entry) =>
        entry.isCurrent &&
        usable(entry.description) &&
        /product|develop|engineer|full-stack|software/i.test(
          `${entry.kind} ${entry.slug} ${entry.roleTitle}`,
        ),
    ) ??
    experiences.find((entry) => entry.isCurrent && usable(entry.description));
  if (practice?.description) {
    candidates.push({
      id: `experience-${practice.id}`,
      text: practice.description,
      contentLocale: practice.contentLocale,
    });
  }

  const seen = new Set<string>();
  return candidates
    .filter((item) => {
      const key = item.text.replace(/\s+/g, " ").trim().toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

/**
 * Curate the four records that explain the identity arc instead of treating the
 * newest four Journey rows as a biography. The preferred sequence is:
 * academic foundation -> two current study paths -> product practice -> fieldwork.
 * Every paragraph and date remains the value stored on its source record.
 */
export function buildAboutChapters({
  locale,
  journey,
  education,
  experiences,
  currentStudiesTitle,
  undatedLabel,
}: {
  locale: Locale;
  journey: AboutChapterInput[];
  education: AboutEducationInput[];
  experiences: AboutExperienceInput[];
  currentStudiesTitle: string;
  undatedLabel: string;
}): AboutChapterView[] {
  const educationEvidence = (
    entry: AboutEducationInput,
  ): AboutChapterEvidence | null => {
    if (!usable(entry.description) || !usable(entry.periodLabel)) return null;
    return {
      id: `education-${entry.id}`,
      title: entry.qualification ?? entry.fieldOfStudy ?? entry.institution,
      summary: entry.description,
      period: entry.periodLabel,
      href: localePath(locale, `education#education-${entry.slug}`),
      contentLocale: entry.contentLocale,
    };
  };

  const experienceEvidence = (
    entry: AboutExperienceInput,
  ): AboutChapterEvidence | null => {
    const summary = firstUsable(entry.summary, entry.description);
    if (!summary || !usable(entry.periodLabel)) return null;
    return {
      id: `experience-${entry.id}`,
      title: entry.roleTitle,
      summary,
      period: entry.periodLabel,
      href: localePath(locale, `experience#experience-${entry.slug}`),
      contentLocale: entry.contentLocale,
    };
  };

  const journeyEvidence = (entry: AboutChapterInput): AboutChapterEvidence | null => {
    if (!usable(entry.summary)) return null;
    return {
      id: `journey-${entry.id}`,
      title: entry.title,
      summary: entry.summary,
      period: entry.periodLabel ?? entry.year ?? undatedLabel,
      href: localePath(locale, `journey/${entry.slug}`),
      contentLocale: entry.contentLocale,
    };
  };

  const foundationSource = education.find(
    (entry) =>
      !entry.isCurrent &&
      (entry.slug === "cambodia-japan-friendship-high-school" ||
        entry.kind === "high_school"),
  );
  const foundation = foundationSource ? educationEvidence(foundationSource) : null;

  const ptecSource = education.find(
    (entry) =>
      entry.isCurrent &&
      (entry.slug === "ptec-teacher-education" ||
        /teacher.?education/i.test(`${entry.kind} ${entry.slug}`)),
  );
  const mathematicsSource = education.find(
    (entry) =>
      entry.isCurrent &&
      (entry.slug === "khemarak-university-mathematics" ||
        /math/i.test(`${entry.kind} ${entry.slug} ${entry.fieldOfStudy ?? ""}`)),
  );
  const ptec = ptecSource ? educationEvidence(ptecSource) : null;
  const mathematics = mathematicsSource ? educationEvidence(mathematicsSource) : null;

  const productSource = experiences.find(
    (entry) =>
      entry.isCurrent &&
      (entry.slug === "full-stack-product-builder" || entry.kind === "development"),
  );
  const product = productSource ? experienceEvidence(productSource) : null;

  const fieldworkSource = journey.find(
    (entry) =>
      entry.slug === "ptom-plp-fieldwork-kakoh-primary-school" ||
      entry.categorySlug === "fieldwork",
  );
  const fieldwork = fieldworkSource ? journeyEvidence(fieldworkSource) : null;

  const chapters: AboutChapterView[] = [];
  if (foundation) {
    chapters.push({
      kind: "foundation",
      id: "academic-foundation",
      title: foundation.title,
      evidence: [foundation],
      cover: null,
    });
  }
  if (ptec && mathematics && ptec.id !== mathematics.id) {
    chapters.push({
      kind: "dual-study",
      id: "dual-study",
      title: currentStudiesTitle,
      evidence: [ptec, mathematics],
      cover: null,
    });
  }
  if (product) {
    chapters.push({
      kind: "product",
      id: "product-practice",
      title: product.title,
      evidence: [product],
      cover: null,
    });
  }
  if (fieldwork && fieldworkSource) {
    chapters.push({
      kind: "fieldwork",
      id: "classroom-fieldwork",
      title: fieldwork.title,
      evidence: [fieldwork],
      cover: fieldworkSource.cover,
    });
  }

  return chapters;
}

const PURPOSE_ORDER = ["krusmart", "ptec-digital-library", "ptec-storage"];

export function orderPurposeProjects<T extends AboutProjectInput>(projects: T[]): T[] {
  return projects
    .filter((project) => PURPOSE_ORDER.includes(project.slug))
    .sort(
      (a, b) => PURPOSE_ORDER.indexOf(a.slug) - PURPOSE_ORDER.indexOf(b.slug),
    );
}

/** Current focus is derived only from explicit `isCurrent` structured records. */
export function buildCurrentFocus({
  locale,
  education,
  experiences,
}: {
  locale: Locale;
  education: AboutEducationInput[];
  experiences: AboutExperienceInput[];
}): AboutFocusItem[] {
  const studies: AboutFocusItem[] = education
    .filter((entry) => entry.isCurrent)
    .slice(0, 2)
    .map((entry) => ({
      id: `study-${entry.id}`,
      kind: "study",
      title: entry.fieldOfStudy ?? entry.qualification ?? entry.institution,
      description: entry.description ?? entry.institution,
      period: entry.periodLabel,
      href: localePath(locale, `education#education-${entry.slug}`),
      contentLocale: entry.contentLocale,
    }));

  const currentExperiences = experiences.filter((entry) => entry.isCurrent);
  const classroom = currentExperiences.find((entry) =>
    entry.kind === "practicum" || /teach|tutor|practic|classroom/i.test(
      `${entry.kind} ${entry.slug} ${entry.roleTitle}`,
    ),
  );
  const product = currentExperiences.find((entry) =>
    entry.kind === "development" || /product|develop|engineer|full-stack|software/i.test(
      `${entry.kind} ${entry.slug} ${entry.roleTitle}`,
    ),
  );

  const selectedExperiences = [classroom, product]
    .filter((entry): entry is AboutExperienceInput => Boolean(entry))
    .filter((entry, index, all) => all.findIndex((item) => item.id === entry.id) === index);

  const practice: AboutFocusItem[] = selectedExperiences.map((entry) => ({
      id: `practice-${entry.id}`,
      kind: entry.id === product?.id ? "product" : "practice",
      title: entry.roleTitle,
      description: firstUsable(entry.summary, entry.description, entry.organization),
      period: entry.periodLabel,
      href: localePath(locale, `experience#experience-${entry.slug}`),
      contentLocale: entry.contentLocale,
    }));

  return [...studies, ...practice];
}

/** Human-facing contact labels: never print a raw Telegram URL. */
export function readableSocialLabel(input: {
  platform: string;
  label: string;
  handle: string | null;
  url: string;
}): string {
  if (input.platform === "email" || input.url.startsWith("mailto:")) {
    return input.handle ?? input.url.replace(/^mailto:/, "");
  }

  if (input.platform === "telegram") {
    const raw = input.handle?.trim() || input.url;
    try {
      const path = new URL(raw).pathname.replace(/^\/+|\/+$/g, "");
      if (path) return `@${path.replace(/^@/, "")}`;
    } catch {
      const handle = raw.replace(/^@/, "").trim();
      if (handle && !handle.includes("/")) return `@${handle}`;
    }
  }

  return input.handle?.trim() || input.label;
}
