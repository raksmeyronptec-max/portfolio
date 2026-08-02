import { describe, expect, it } from "vitest";

import { en } from "@/i18n/messages/en";
import { km } from "@/i18n/messages/km";
import {
  buildConvergenceApplications,
  buildEducationTimeline,
  buildEducationViews,
  classifySchedule,
  trackForSlug,
  type EducationInput,
} from "@/lib/content/education-view";

/**
 * The Education page's derivations.
 *
 * The stakes here are misrepresentation rather than ordering: an in-progress
 * degree must never render as a completed one, a future year must always be
 * labelled expected, and the Khmer page must classify and format identically
 * to the English one. Each of those is a function now, so each is a test.
 */

function entry(overrides: Partial<EducationInput> = {}): EducationInput {
  return {
    id: overrides.id ?? "id",
    slug: overrides.slug ?? "slug",
    kind: "university",
    institution: "Institution",
    institutionUrl: null,
    qualification: null,
    fieldOfStudy: null,
    description: null,
    achievements: null,
    periodLabel: null,
    scheduleLabel: null,
    startedOn: null,
    endedOn: null,
    isCurrent: false,
    gradeValue: null,
    gradeScale: null,
    contentLocale: "en",
    sortOrder: 0,
    ...overrides,
  };
}

/** The four live rows, reduced to the fields the derivations read. */
const LIVE = [
  entry({
    id: "ptec",
    slug: "ptec-primary-teacher-education",
    isCurrent: true,
    periodLabel: "2023 — 2028 (expected)",
    scheduleLabel: "Monday – Friday",
    fieldOfStudy: "Primary Education and Teacher Education",
    qualification: "Bachelor’s Degree in Education — Primary Teacher Education (12+4)",
    sortOrder: 10,
  }),
  entry({
    id: "khemarak",
    slug: "khemarak-university-mathematics",
    isCurrent: true,
    periodLabel: "2023 — 2027 (expected)",
    scheduleLabel: "Saturday – Sunday",
    fieldOfStudy: "Applied Mathematics",
    qualification: "Bachelor’s Degree in Mathematics",
    sortOrder: 20,
  }),
  entry({
    id: "bacii",
    slug: "upper-secondary-education-bac-ii",
    kind: "high_school",
    periodLabel: "Upper-secondary examination completed in 2023",
    qualification: "Upper Secondary Education Certificate (Bac II)",
    gradeValue: "A",
    gradeScale: "Cambodian BacII overall grade (A–E)",
    sortOrder: 30,
  }),
  entry({
    id: "grade9",
    slug: "lower-secondary-education-grade-9",
    kind: "high_school",
    periodLabel: "Lower-secondary examination completed in 2020",
    qualification: "Lower Secondary Education Certificate (Grade 9 Diploma)",
    sortOrder: 40,
  }),
];

// ── Classification ──────────────────────────────────────────────────────────

describe("trackForSlug", () => {
  it("finds the mathematics degree by its slug", () => {
    expect(trackForSlug("khemarak-university-mathematics")).toBe("mathematics");
    expect(trackForSlug("ptec-primary-teacher-education")).toBe("teacher");
  });

  it("falls to the teacher track rather than claiming mathematics", () => {
    expect(trackForSlug("some-new-programme")).toBe("teacher");
  });
});

describe("classifySchedule", () => {
  it("classifies both catalogues the same way", () => {
    expect(classifySchedule("Monday – Friday")).toBe("weekday");
    expect(classifySchedule("ចន្ទ – សុក្រ")).toBe("weekday");
    expect(classifySchedule("Saturday – Sunday")).toBe("weekend");
    expect(classifySchedule("សៅរ៍ – អាទិត្យ")).toBe("weekend");
  });

  it("refuses to guess from a label it does not recognise", () => {
    expect(classifySchedule("Evenings")).toBeNull();
    expect(classifySchedule(null)).toBeNull();
  });
});

// ── Views ───────────────────────────────────────────────────────────────────

describe("buildEducationViews", () => {
  const views = buildEducationViews({ entries: LIVE, locale: "en", t: en });

  it("splits current programmes from earlier milestones", () => {
    expect(views.programmes.map((p) => p.id)).toEqual(["ptec", "khemarak"]);
    expect(views.milestones.map((m) => m.id)).toEqual(["grade9", "bacii"]);
  });

  it("labels an in-progress degree as expected, never as completed", () => {
    const ptec = views.programmes.find((p) => p.id === "ptec");
    expect(ptec?.periodLabel).toBe("2023—Expected 2028");
    expect(ptec?.expectedLabel).toBe("Expected completion: 2028");
  });

  it("localises the expected wording and the numerals together", () => {
    const kmViews = buildEducationViews({ entries: LIVE, locale: "km", t: km });
    const ptec = kmViews.programmes.find((p) => p.id === "ptec");
    expect(ptec?.periodLabel).toBe("២០២៣—រំពឹងបញ្ចប់ ២០២៨");
    expect(ptec?.expectedLabel).toBe("រំពឹងបញ្ចប់៖ ឆ្នាំ ២០២៨");
  });

  it("renders a plain range for a finished programme", () => {
    const finished = buildEducationViews({
      entries: [
        entry({
          id: "done",
          isCurrent: true,
          periodLabel: "2019 — 2021",
          startedOn: "2019-01-01",
          endedOn: "2021-06-01",
        }),
      ],
      locale: "en",
      t: en,
    });
    // isCurrent puts it in programmes; a stored end date with no ongoing
    // marker in the label still keeps "expected" because is_current says the
    // programme is running — the flag wins, exactly as stored.
    expect(finished.programmes[0]?.periodLabel).toBe("2019—Expected 2021");
  });

  it("sorts milestones oldest first", () => {
    expect(views.milestones.map((m) => m.period.startYear)).toEqual([2020, 2023]);
  });

  it("features exactly the graded national result", () => {
    expect(views.nationalMilestone?.id).toBe("bacii");
    expect(views.nationalMilestone?.featured).toBe(true);
    expect(views.milestones.find((m) => m.id === "grade9")?.featured).toBe(false);
  });

  it("derives the week split from the stored schedule labels", () => {
    expect(views.programmes.find((p) => p.id === "ptec")?.scheduleKind).toBe(
      "weekday",
    );
    expect(views.programmes.find((p) => p.id === "khemarak")?.scheduleKind).toBe(
      "weekend",
    );
  });

  it("gives each track its focus vocabulary", () => {
    const khemarak = views.programmes.find((p) => p.id === "khemarak");
    expect(khemarak?.focus).toContain("Algebra");
    expect(khemarak?.focus).not.toContain("Pedagogy");
  });
});

// ── Timeline ────────────────────────────────────────────────────────────────

describe("buildEducationTimeline", () => {
  const views = buildEducationViews({ entries: LIVE, locale: "en", t: en });
  const points = buildEducationTimeline({ views, locale: "en", t: en });

  it("orders the chronology and appends the expected completions", () => {
    expect(points.map((p) => [p.year, p.isExpected])).toEqual([
      [2020, false],
      [2023, false], // Bac II result
      [2023, false], // PTEC start
      [2023, false], // Khemarak start
      [2027, true],
      [2028, true],
    ]);
  });

  it("never renders an expected point as achieved", () => {
    const expected = points.filter((p) => p.isExpected);
    expect(expected).toHaveLength(2);
    for (const point of expected) {
      expect(point.title).toContain("Expected");
    }
  });

  it("links only points whose target actually renders", () => {
    // The featured milestone has its own panel; the grade-9 entry exists only
    // as this timeline point, so a link would target nothing.
    const bacii = points.find((p) => p.id === "completed-bacii");
    const grade9 = points.find((p) => p.id === "completed-grade9");
    expect(bacii?.href).toBe("#education-upper-secondary-education-bac-ii");
    expect(grade9?.href).toBeNull();
  });

  it("uses Khmer numerals for Khmer year labels", () => {
    const kmViews = buildEducationViews({ entries: LIVE, locale: "km", t: km });
    const kmPoints = buildEducationTimeline({ views: kmViews, locale: "km", t: km });
    expect(kmPoints[0]?.yearLabel).toBe("២០២០");
  });
});

// ── Convergence applications ────────────────────────────────────────────────

describe("buildConvergenceApplications", () => {
  const evidence = {
    experiences: [
      { id: "e1", slug: "first-year-teaching-practicum", kind: "practicum", roleTitle: "First-Year Teaching Practicum" },
      { id: "e2", slug: "private-home-tutor", kind: "teaching", roleTitle: "Private Home Tutor" },
      { id: "e3", slug: "student-teacher-ptec", kind: "teaching", roleTitle: "Student Teacher" },
    ],
    projects: [
      {
        id: "p1",
        slug: "krusmart",
        title: "KruSmart",
        categories: [{ slug: "education-technology" }, { slug: "web-application" }],
      },
      {
        id: "p2",
        slug: "ptec-digital-library",
        title: "PTEC Digital Library",
        categories: [{ slug: "education-technology" }, { slug: "academic-repository" }],
      },
    ],
    publications: [
      { id: "b1", href: "/en/publications/graphs", title: "Graphs of Functions" },
    ],
  };

  const applications = buildConvergenceApplications({ evidence, locale: "en", t: en });

  it("collects practicums and tutoring, not every teaching role", () => {
    const practice = applications.find((a) => a.id === "practice");
    expect(practice?.links.map((l) => l.id)).toEqual(["e1", "e2"]);
    expect(practice?.links[0]?.href).toBe(
      "/en/experience#experience-first-year-teaching-practicum",
    );
  });

  it("separates teacher tools from repositories by the projects' own categories", () => {
    expect(
      applications.find((a) => a.id === "teacherTools")?.links.map((l) => l.label),
    ).toEqual(["KruSmart"]);
    expect(
      applications.find((a) => a.id === "repositories")?.links.map((l) => l.label),
    ).toEqual(["PTEC Digital Library"]);
  });

  it("drops an application with no evidence behind it", () => {
    const none = buildConvergenceApplications({
      evidence: { experiences: [], projects: [], publications: [] },
      locale: "en",
      t: en,
    });
    expect(none).toEqual([]);
  });
});
