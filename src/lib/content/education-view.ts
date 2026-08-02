import { localePath, type Locale } from "@/i18n/config";
import { interpolate } from "@/i18n/dictionary";
import type { Dictionary } from "@/i18n/messages/en";
import {
  formatNumeral,
  parseExperiencePeriod,
  type ExperiencePeriod,
} from "./experience-period";

/**
 * The Education page's view model.
 *
 * The page tells one story — two active degrees feeding one educational
 * mission — and everything it renders is derived here, once, from the CMS
 * rows. Components receive finished values and make no decisions of their own,
 * which is what keeps the spotlight, the week visualisation and the timeline
 * agreeing on the same facts.
 *
 * Isomorphic for the same reason `experience-view.ts` is: no query and no
 * privileged configuration, so types can flow to both sides. Everything on
 * this page renders on the server.
 *
 * ── Programmes and milestones are different things ─────────────────────────
 * The four rows are not four of the same kind. Two are degrees being studied
 * *now*; two are school examinations passed years ago. The old page gave all
 * four the same card, which is exactly how an in-progress bachelor's degree
 * ends up looking like a certificate from 2020. The split is derived, not
 * stored: a current row is a programme, everything else is a milestone.
 */

// ── Inputs ──────────────────────────────────────────────────────────────────

/** Structural shape of `EducationEntry` — see the note in experience-view.ts. */
export type EducationInput = {
  id: string;
  slug: string;
  kind: string;
  institution: string;
  institutionUrl: string | null;
  qualification: string | null;
  fieldOfStudy: string | null;
  description: string | null;
  achievements: string | null;
  periodLabel: string | null;
  scheduleLabel: string | null;
  startedOn: string | null;
  endedOn: string | null;
  isCurrent: boolean;
  gradeValue: string | null;
  gradeScale: string | null;
  contentLocale: Locale | null;
  sortOrder: number;
};

// ── Tracks ──────────────────────────────────────────────────────────────────

/**
 * Which academic path a programme belongs to.
 *
 * Derived from the slug, because it is the only locale-independent text the
 * row carries — `field_of_study` arrives already translated, so matching on it
 * would classify the Khmer page differently from the English one. An
 * unmatched current programme falls to `teacher`: that is the gold accent,
 * and a new programme showing up gold-marked is a visible prompt to extend
 * this list, while a programme silently claiming the mathematics track would
 * assert a subject it may not have.
 */
export type EducationTrack = "teacher" | "mathematics";

export function trackForSlug(slug: string): EducationTrack {
  return /math/i.test(slug) ? "mathematics" : "teacher";
}

// ── Schedules ───────────────────────────────────────────────────────────────

/**
 * Weekday or weekend study, read off the stored schedule label.
 *
 * The CMS stores one localised label per row ("Monday – Friday", "សៅរ៍ –
 * អាទិត្យ"). The week visualisation needs to know which *days* that means, and
 * the honest source is the label's own first day — both catalogues are
 * matched, so the classification is identical on both pages. A label that
 * names neither pattern classifies as null and the visualisation simply does
 * not render, rather than guessing.
 */
export type ScheduleKind = "weekday" | "weekend" | null;

export function classifySchedule(label: string | null): ScheduleKind {
  if (!label) return null;
  if (/monday|ចន្ទ/i.test(label)) return "weekday";
  if (/saturday|សៅរ៍/i.test(label)) return "weekend";
  return null;
}

// ── Views ───────────────────────────────────────────────────────────────────

export type ProgrammeView = {
  id: string;
  slug: string;
  anchorId: string;
  track: EducationTrack;
  institution: string;
  /** Official site only — the CMS stores one and the panel is where it goes. */
  institutionUrl: string | null;
  qualification: string | null;
  fieldOfStudy: string | null;
  description: string | null;
  achievements: string | null;
  scheduleLabel: string | null;
  scheduleKind: ScheduleKind;
  period: ExperiencePeriod;
  /** One normalised range: "2023—Expected 2028", localised. */
  periodLabel: string | null;
  /** "Expected completion: 2028", localised. Null when no end year is known. */
  expectedLabel: string | null;
  /** Focus areas for the default chips. Dictionary labels, capped by caller. */
  focus: string[];
  contentLocale: Locale | null;
};

export type MilestoneView = {
  id: string;
  slug: string;
  anchorId: string;
  institution: string;
  qualification: string | null;
  fieldOfStudy: string | null;
  description: string | null;
  achievements: string | null;
  period: ExperiencePeriod;
  /** The single evidenced year, in the reader's numerals. */
  yearLabel: string | null;
  gradeValue: string | null;
  gradeScale: string | null;
  /** True for the entry featured as the national academic milestone. */
  featured: boolean;
  contentLocale: Locale | null;
};

export type EducationViews = {
  programmes: ProgrammeView[];
  milestones: MilestoneView[];
  /** The graded national result, when one exists. Also present in milestones. */
  nationalMilestone: MilestoneView | null;
};

/**
 * Focus areas per track.
 *
 * These are dictionary labels, not CMS fields — the rows carry their topics
 * only inside prose ("…pedagogy, lesson planning, student assessment,
 * educational research and primary-school classroom practice."). The lists
 * below name exactly the topics that prose states, so the chips summarise the
 * stored description rather than extend it. If the CMS ever grows a real
 * focus-area table, these lookups are what it replaces.
 */
const TRACK_FOCUS: Record<
  EducationTrack,
  ReadonlyArray<keyof Dictionary["education"]["topics"]>
> = {
  teacher: [
    "pedagogy",
    "lessonPlanning",
    "assessment",
    "classroomPractice",
    "educationalResearch",
  ],
  mathematics: ["reasoning", "algebra", "geometry", "analysis"],
};

function programmePeriodLabel(
  period: ExperiencePeriod,
  locale: Locale,
  t: Dictionary,
): string | null {
  if (period.startYear === null) return null;
  const start = formatNumeral(period.startYear, locale);

  /*
   * An in-progress programme with a stated end year has an *expected* end, and
   * the label must say so — "2023—2028" alone reads as a completed degree,
   * which is the misrepresentation the brief calls out. A finished programme
   * would render the plain range; today's data has none, but the branch is
   * what makes that state safe to add.
   */
  if (period.endYear !== null) {
    const end = formatNumeral(period.endYear, locale);
    return period.isOngoing
      ? interpolate(t.education.status.expectedRange, { start, end })
      : `${start}—${end}`;
  }

  return period.isOngoing
    ? `${start}—${t.common.present}`
    : start;
}

export function buildEducationViews({
  entries,
  locale,
  t,
}: {
  entries: EducationInput[];
  locale: Locale;
  t: Dictionary;
}): EducationViews {
  const programmes: ProgrammeView[] = [];
  const milestones: MilestoneView[] = [];

  for (const entry of entries) {
    const period = parseExperiencePeriod(entry);
    const anchorId = `education-${entry.slug}`;

    if (entry.isCurrent) {
      const track = trackForSlug(entry.slug);

      programmes.push({
        id: entry.id,
        slug: entry.slug,
        anchorId,
        track,
        institution: entry.institution,
        institutionUrl: entry.institutionUrl,
        qualification: entry.qualification,
        fieldOfStudy: entry.fieldOfStudy,
        description: entry.description,
        achievements: entry.achievements,
        scheduleLabel: entry.scheduleLabel,
        scheduleKind: classifySchedule(entry.scheduleLabel),
        period,
        periodLabel: programmePeriodLabel(period, locale, t),
        expectedLabel:
          period.isOngoing && period.endYear !== null
            ? interpolate(t.education.status.expectedCompletion, {
                year: formatNumeral(period.endYear, locale),
              })
            : null,
        focus: TRACK_FOCUS[track].map((key) => t.education.topics[key]),
        contentLocale: entry.contentLocale,
      });
    } else {
      milestones.push({
        id: entry.id,
        slug: entry.slug,
        anchorId,
        institution: entry.institution,
        qualification: entry.qualification,
        fieldOfStudy: entry.fieldOfStudy,
        description: entry.description,
        achievements: entry.achievements,
        period,
        yearLabel:
          period.startYear !== null
            ? formatNumeral(period.startYear, locale)
            : null,
        gradeValue: entry.gradeValue,
        gradeScale: entry.gradeScale,
        featured: false,
        contentLocale: entry.contentLocale,
      });
    }
  }

  /*
   * Programmes keep the editor's order — PTEC first is a deliberate choice,
   * and with no comparable dates between two parallel degrees there is no
   * chronology to prefer over it. Milestones sort oldest first, because the
   * timeline reads as the run-up to the current degrees.
   */
  milestones.sort(
    (a, b) => (a.period.startYear ?? 9999) - (b.period.startYear ?? 9999),
  );

  /*
   * The national milestone is the entry carrying a graded national result.
   * Derived rather than flagged: the grade *is* the fact that makes it
   * featured, and a second graded entry appearing later would surface as a
   * choice to make here rather than silently competing.
   */
  const nationalMilestone =
    milestones.find((milestone) => milestone.gradeValue !== null) ?? null;
  if (nationalMilestone) nationalMilestone.featured = true;

  return { programmes, milestones, nationalMilestone };
}

// ── Convergence applications ────────────────────────────────────────────────

export type ApplicationLink = {
  id: string;
  label: string;
  href: string;
};

export type ConvergenceApplication = {
  id: "practice" | "publications" | "teacherTools" | "repositories";
  label: string;
  detail: string;
  links: ApplicationLink[];
};

/** What the convergence builder needs from the other content types. */
export type ApplicationEvidence = {
  experiences: Array<{ id: string; slug: string; kind: string; roleTitle: string }>;
  projects: Array<{
    id: string;
    slug: string;
    title: string;
    categories: Array<{ slug: string }>;
  }>;
  publications: Array<{ id: string; href: string; title: string }>;
};

/**
 * Where the two degrees are actually applied — each application backed by
 * links to records that exist, or not rendered at all.
 *
 * The matching uses the projects' own category vocabulary rather than
 * hard-coded slugs: an academic repository is anything the CMS categorises as
 * one, and a teacher tool is education technology that is *not* a repository.
 * Experiences match on their kind, plus the tutoring slug — tutoring is
 * stored as `kind: "teaching"`, so the kind alone cannot find it.
 *
 * Nothing here claims a university endorses these products. The section's own
 * copy says "applied through", which is the relationship the data supports:
 * the person studying these subjects is the person who did this work.
 */
export function buildConvergenceApplications({
  evidence,
  locale,
  t,
}: {
  evidence: ApplicationEvidence;
  locale: Locale;
  t: Dictionary;
}): ConvergenceApplication[] {
  const experiencePath = (slug: string) =>
    `${localePath(locale, "experience")}#experience-${slug}`;
  const projectPath = (slug: string) => localePath(locale, `projects/${slug}`);

  const practice = evidence.experiences
    .filter(
      (entry) => entry.kind === "practicum" || /tutor/i.test(entry.slug),
    )
    .map((entry) => ({
      id: entry.id,
      label: entry.roleTitle,
      href: experiencePath(entry.slug),
    }));

  const repositories = evidence.projects
    .filter((project) =>
      project.categories.some((category) => category.slug === "academic-repository"),
    )
    .map((project) => ({
      id: project.id,
      label: project.title,
      href: projectPath(project.slug),
    }));

  const teacherTools = evidence.projects
    .filter(
      (project) =>
        project.categories.some(
          (category) => category.slug === "education-technology",
        ) &&
        !project.categories.some(
          (category) => category.slug === "academic-repository",
        ),
    )
    .map((project) => ({
      id: project.id,
      label: project.title,
      href: projectPath(project.slug),
    }));

  const publications = evidence.publications.slice(0, 3).map((publication) => ({
    id: publication.id,
    label: publication.title,
    href: publication.href,
  }));

  const applications: ConvergenceApplication[] = (
    [
      { id: "practice", links: practice },
      { id: "publications", links: publications },
      { id: "teacherTools", links: teacherTools },
      { id: "repositories", links: repositories },
    ] as const
  ).map(({ id, links }) => ({
    id,
    label: t.education.convergence.applications[id].label,
    detail: t.education.convergence.applications[id].detail,
    links: [...links],
  }));

  // An application with nothing behind it is an assertion, not evidence.
  return applications.filter((application) => application.links.length > 0);
}

// ── Timeline ────────────────────────────────────────────────────────────────

export type TimelinePoint = {
  id: string;
  /** Sortable year. Expected points sort by their expected year. */
  year: number;
  yearLabel: string;
  /** True renders the "Expected" marker and never a completed style. */
  isExpected: boolean;
  title: string;
  detail: string | null;
  /** In-page anchor of the entry this point summarises. */
  href: string | null;
};

/**
 * The compact chronology: completed qualifications, programme starts, and
 * expected completions — every point derived from a stored row, and every
 * future point labelled as expected rather than drawn as achieved.
 */
export function buildEducationTimeline({
  views,
  locale,
  t,
}: {
  views: EducationViews;
  locale: Locale;
  t: Dictionary;
}): TimelinePoint[] {
  const points: TimelinePoint[] = [];

  for (const milestone of views.milestones) {
    if (milestone.period.startYear === null) continue;
    points.push({
      id: `completed-${milestone.id}`,
      year: milestone.period.startYear,
      yearLabel: formatNumeral(milestone.period.startYear, locale),
      isExpected: false,
      title: milestone.qualification ?? milestone.institution,
      detail: milestone.qualification ? milestone.institution : null,
      /*
       * Only the featured milestone renders its own panel; the others exist
       * solely as timeline points, so a link would target an anchor that is
       * not on the page.
       */
      href: milestone.featured ? `#${milestone.anchorId}` : null,
    });
  }

  for (const programme of views.programmes) {
    if (programme.period.startYear !== null) {
      points.push({
        id: `started-${programme.id}`,
        year: programme.period.startYear,
        yearLabel: formatNumeral(programme.period.startYear, locale),
        isExpected: false,
        title: interpolate(t.education.timeline.started, {
          programme: programme.fieldOfStudy ?? programme.qualification ?? "",
        }),
        detail: programme.institution,
        href: `#${programme.anchorId}`,
      });
    }

    if (programme.period.isOngoing && programme.period.endYear !== null) {
      points.push({
        id: `expected-${programme.id}`,
        year: programme.period.endYear,
        yearLabel: formatNumeral(programme.period.endYear, locale),
        isExpected: true,
        title: interpolate(t.education.timeline.expected, {
          programme: programme.fieldOfStudy ?? programme.qualification ?? "",
        }),
        detail: programme.institution,
        href: `#${programme.anchorId}`,
      });
    }
  }

  // Stable within a year: completed results before programme starts, which is
  // the order the year actually happened in (the Bac II result preceded
  // enrolment).
  return points.sort(
    (a, b) => a.year - b.year || Number(a.isExpected) - Number(b.isExpected),
  );
}
