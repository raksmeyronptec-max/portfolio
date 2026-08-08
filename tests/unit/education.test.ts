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

describe("programmeProgress", () => {
  /**
   * A progress bar is a quantitative claim, so these tests are mostly about
   * the states that must produce *no* claim at all. Each `toBeNull` below is a
   * shape of missing or incoherent data the CMS can genuinely hold.
   */
  const progressFor = (
    overrides: Partial<EducationInput>,
    now: Date,
  ) =>
    buildEducationViews({
      entries: [entry({ id: "p", isCurrent: true, ...overrides })],
      locale: "en",
      t: en,
      now,
    }).programmes[0]?.progress ?? null;

  it("counts the year from the evidenced start and end", () => {
    const progress = progressFor(
      { periodLabel: "2023 — 2028 (expected)" },
      new Date("2026-08-08T00:00:00Z"),
    );

    // 2023 start, five-year span, three years elapsed.
    expect(progress?.label).toBe("Year 4 of 5");
    expect(progress?.percent).toBe(60);
  });

  it("localises the numerals in the label", () => {
    const progress = buildEducationViews({
      entries: [entry({ id: "p", isCurrent: true, periodLabel: "2023 — 2028 (expected)" })],
      locale: "km",
      t: km,
      now: new Date("2026-08-08T00:00:00Z"),
    }).programmes[0]?.progress;

    expect(progress?.label).toBe("ឆ្នាំទី ៤ ក្នុងចំណោម ៥ ឆ្នាំ");
  });

  it("claims nothing when the programme has no end year", () => {
    // The live mathematics row is stored exactly this way.
    expect(progressFor({ periodLabel: "2023" }, new Date("2026-08-08T00:00:00Z"))).toBeNull();
  });

  it("claims nothing when no year could be parsed at all", () => {
    expect(progressFor({ periodLabel: "Dates to be confirmed" }, new Date())).toBeNull();
  });

  it("claims nothing when the start year is still in the future", () => {
    // Clamping to zero here would render "Year 1", asserting that a programme
    // beginning next year has already started.
    expect(
      progressFor({ periodLabel: "2030 — 2034 (expected)" }, new Date("2026-08-08T00:00:00Z")),
    ).toBeNull();
  });

  it("claims nothing when the stored dates run backwards", () => {
    /*
     * Reachable only through the date columns: `yearsFromLabel` sorts, so a
     * reversed *label* is normalised before it arrives here, but startedOn and
     * endedOn are read straight off the row and a transposed pair is an
     * ordinary data-entry mistake.
     */
    expect(
      progressFor(
        { startedOn: "2028-01-01", endedOn: "2023-01-01" },
        new Date("2026-08-08T00:00:00Z"),
      ),
    ).toBeNull();
  });

  it("never exceeds the final year once the end has passed", () => {
    const progress = progressFor(
      { periodLabel: "2023 — 2028 (expected)" },
      new Date("2031-08-08T00:00:00Z"),
    );

    expect(progress?.percent).toBe(100);
    expect(progress?.label).toBe("Year 5 of 5");
  });
});

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

describe("timeline grades", () => {
  const points = buildEducationTimeline({
    views: buildEducationViews({ entries: LIVE, locale: "en", t: en }),
    locale: "en",
    t: en,
  });

  it("carries a stored result onto its timeline point, with its scale", () => {
    const bacii = points.find((p) => p.id === "completed-bacii");
    expect(bacii?.grade).toEqual({
      value: "A",
      scale: "Cambodian BacII overall grade (A–E)",
    });
  });

  it("leaves ungraded points without a result rather than an empty badge", () => {
    // Grade 9 is stored with no result; starts and expected completions cannot
    // have one yet. None of them may invent a mark.
    expect(points.find((p) => p.id === "completed-grade9")?.grade).toBeNull();
    expect(points.find((p) => p.id === "started-ptec")?.grade).toBeNull();
    expect(points.find((p) => p.id === "expected-ptec")?.grade).toBeNull();
  });
});

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
