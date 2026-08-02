import { describe, expect, it } from "vitest";

import { en } from "@/i18n/messages/en";
import { km } from "@/i18n/messages/km";
import {
  compareByPeriod,
  formatExperiencePeriod,
  formatNumeral,
  parseExperiencePeriod,
} from "@/lib/content/experience-period";
import {
  dedupeTags,
  resolveTag,
  tagKey,
  trackForKind,
} from "@/lib/content/experience-taxonomy";
import {
  buildEvidenceThemes,
  buildExperienceFilters,
  buildExperienceSummary,
  buildExperienceViews,
  projectsNamedIn,
  splitContributions,
  type ExperienceInput,
  type ProjectInput,
  type PublicationInput,
} from "@/lib/content/experience-view";

/**
 * The Experience page's derivations.
 *
 * These are the parts that used to be wrong in ways nothing could catch: the
 * page ordered five roles 2023 → 2025 → 2024 → 2025 → 2024 because it sorted on
 * a hand-maintained column, and the Khmer page printed the English word
 * "present" because the label was copied between locales. Both are now derived,
 * so both are testable, and these are the tests.
 */

// ── Fixtures ────────────────────────────────────────────────────────────────

function entry(overrides: Partial<ExperienceInput> = {}): ExperienceInput {
  return {
    id: overrides.id ?? "id",
    slug: overrides.slug ?? "slug",
    kind: "teaching",
    roleTitle: "Role",
    organization: "Organisation",
    organizationUrl: null,
    location: null,
    summary: null,
    description: null,
    achievements: null,
    periodLabel: null,
    startedOn: null,
    endedOn: null,
    isCurrent: false,
    tags: [],
    contentLocale: "en",
    cover: null,
    gallery: [],
    sortOrder: 0,
    ...overrides,
  };
}

const projects: ProjectInput[] = [
  {
    id: "p1",
    slug: "krusmart",
    title: "KruSmart — Digital Teacher Assistant",
    summary: null,
    liveUrl: "https://www.krusmart.org/",
    technologies: [{ slug: "firebase" }],
    categories: [{ slug: "education-technology", name: "Education Technology" }],
  },
  {
    id: "p2",
    slug: "ptec-digital-library",
    title: "PTEC Digital Library",
    summary: null,
    liveUrl: "https://library.ptec.edu.kh/",
    technologies: [{ slug: "nextjs" }, { slug: "supabase" }],
    categories: [{ slug: "academic-repository", name: "Academic Repository" }],
  },
];

// ── Period parsing ──────────────────────────────────────────────────────────

describe("parseExperiencePeriod", () => {
  it("prefers stored dates over the display label", () => {
    const period = parseExperiencePeriod({
      startedOn: "2019-09-01",
      endedOn: "2021-06-30",
      isCurrent: false,
      periodLabel: "2024–2025",
    });

    expect(period).toMatchObject({ startYear: 2019, endYear: 2021 });
  });

  it("reads years out of the label when no dates are stored", () => {
    // The exact string on the live content, category prefix and all.
    const period = parseExperiencePeriod({
      startedOn: null,
      endedOn: null,
      isCurrent: false,
      periodLabel: "First-year practicum · 2024–2025",
    });

    expect(period).toEqual({
      startYear: 2024,
      endYear: 2025,
      isOngoing: false,
      precision: "year",
    });
  });

  it("reads Khmer numerals", () => {
    const period = parseExperiencePeriod({
      startedOn: null,
      endedOn: null,
      isCurrent: false,
      periodLabel: "កម្មសិក្សាបង្រៀនឆ្នាំទី១ · ២០២៤–២០២៥",
    });

    expect(period).toMatchObject({ startYear: 2024, endYear: 2025 });
  });

  it("does not read a single year as both ends of an open period", () => {
    const period = parseExperiencePeriod({
      startedOn: null,
      endedOn: null,
      isCurrent: true,
      periodLabel: "2023 — present",
    });

    expect(period).toEqual({
      startYear: 2023,
      endYear: null,
      isOngoing: true,
      precision: "year",
    });
  });

  it("treats a Khmer ongoing marker the same as the English one", () => {
    const period = parseExperiencePeriod({
      startedOn: null,
      endedOn: null,
      // `is_current` deliberately false, so only the label can carry it.
      isCurrent: false,
      periodLabel: "២០២៣ — បច្ចុប្បន្ន",
    });

    expect(period.isOngoing).toBe(true);
  });

  it("keeps a known end year on a role that is also current", () => {
    // The second-year practicum: is_current, and labelled through to 2026.
    // Both facts survive — the range shows the end, the chip shows "current".
    const period = parseExperiencePeriod({
      startedOn: null,
      endedOn: null,
      isCurrent: true,
      periodLabel: "Second-year practicum · 2025–2026",
    });

    expect(period).toMatchObject({
      startYear: 2025,
      endYear: 2026,
      isOngoing: true,
    });
  });

  it("reports unknown rather than inventing a year", () => {
    const period = parseExperiencePeriod({
      startedOn: null,
      endedOn: null,
      isCurrent: false,
      periodLabel: null,
    });

    expect(period.precision).toBe("unknown");
    expect(period.startYear).toBeNull();
  });

  it("does not mistake a programme name for a year", () => {
    const period = parseExperiencePeriod({
      startedOn: null,
      endedOn: null,
      isCurrent: false,
      periodLabel: "12+4 Programme",
    });

    expect(period.precision).toBe("unknown");
  });

  it("drops an end year that precedes the start rather than reversing it", () => {
    const period = parseExperiencePeriod({
      startedOn: "2025-01-01",
      endedOn: "2020-01-01",
      isCurrent: false,
      periodLabel: null,
    });

    expect(period).toMatchObject({ startYear: 2025, endYear: null });
  });
});

// ── Period formatting ───────────────────────────────────────────────────────

describe("formatExperiencePeriod", () => {
  const ongoing = {
    startYear: 2023,
    endYear: null,
    isOngoing: true,
    precision: "year" as const,
  };

  it("uses one dash style and the English 'Present'", () => {
    expect(formatExperiencePeriod(ongoing, "en", en.common.present)).toBe(
      "2023—Present",
    );
  });

  it("localises both the numerals and 'Present' for Khmer", () => {
    // This is the defect the page shipped with: `period_label_km` on two rows
    // literally read "2023 — present", in English, on the Khmer page.
    expect(formatExperiencePeriod(ongoing, "km", km.common.present)).toBe(
      "២០២៣—បច្ចុប្បន្ន",
    );
  });

  it("renders a closed range with the same dash", () => {
    expect(
      formatExperiencePeriod(
        { startYear: 2024, endYear: 2025, isOngoing: false, precision: "year" },
        "en",
        en.common.present,
      ),
    ).toBe("2024—2025");
  });

  it("collapses a single-year period to one year", () => {
    expect(
      formatExperiencePeriod(
        { startYear: 2024, endYear: 2024, isOngoing: false, precision: "year" },
        "en",
        en.common.present,
      ),
    ).toBe("2024");
  });

  it("returns null when nothing is known, so the caller can say so", () => {
    expect(
      formatExperiencePeriod(
        { startYear: null, endYear: null, isOngoing: false, precision: "unknown" },
        "en",
        en.common.present,
      ),
    ).toBeNull();
  });
});

describe("formatNumeral", () => {
  it("never groups a year", () => {
    expect(formatNumeral(2023, "en")).toBe("2023");
  });

  it("uses Khmer digits, which km-KH alone does not select", () => {
    expect(formatNumeral(5, "km")).toBe("៥");
    expect(formatNumeral(2023, "km")).toBe("២០២៣");
  });

  /*
   * The portability requirement, stated as a test.
   *
   * `Intl.NumberFormat("km-KH-u-nu-khmr")` resolves to `khmr` on Node and to
   * `latn` on Chromium, so a page rendered on one and hydrated on the other
   * mismatched and the digits flipped after hydration. Anything derived from
   * `Intl` here would pass in Vitest and fail in the browser, which is why this
   * asserts against literals rather than against another formatter.
   */
  it("does not depend on the runtime's numbering-system data", () => {
    expect(formatNumeral(0, "km")).toBe("០");
    expect(formatNumeral(1990, "km")).toBe("១៩៩០");
  });
});

// ── Ordering ────────────────────────────────────────────────────────────────

describe("compareByPeriod", () => {
  function at(startYear: number, endYear: number | null, sortOrder = 0) {
    return {
      period: {
        startYear,
        endYear,
        isOngoing: endYear === null,
        precision: "year" as const,
      },
      sortOrder,
    };
  }

  it("orders oldest first", () => {
    const sorted = [at(2025, 2026), at(2023, null), at(2024, 2025)].sort(
      compareByPeriod,
    );
    expect(sorted.map((item) => item.period.startYear)).toEqual([
      2023, 2024, 2025,
    ]);
  });

  it("puts the placement that ends sooner before the role that runs on", () => {
    const sorted = [at(2024, null), at(2024, 2025)].sort(compareByPeriod);
    expect(sorted.map((item) => item.period.endYear)).toEqual([2025, null]);
  });

  it("falls back to the editor's order for an exact tie", () => {
    const sorted = [at(2024, 2025, 20), at(2024, 2025, 10)].sort(
      compareByPeriod,
    );
    expect(sorted.map((item) => item.sortOrder)).toEqual([10, 20]);
  });

  it("sorts undated entries last rather than to the beginning", () => {
    const undated = {
      period: {
        startYear: null,
        endYear: null,
        isOngoing: false,
        precision: "unknown" as const,
      },
      sortOrder: 0,
    };

    const sorted = [undated, at(2024, 2025)].sort(compareByPeriod);
    expect(sorted[0]?.period.startYear).toBe(2024);
  });
});

// ── Taxonomy ────────────────────────────────────────────────────────────────

describe("tag taxonomy", () => {
  it("derives a stable key from an English label", () => {
    expect(tagKey("UX/UI")).toBe("ux-ui");
    expect(tagKey("12+4 Programme")).toBe("12-4-programme");
  });

  it("collapses two spellings of one concept onto one key", () => {
    // The seed says "Practicum", the live content says "Teaching Practicum".
    const a = resolveTag({ labelEn: "Practicum", label: "Practicum" }, en);
    const b = resolveTag(
      { labelEn: "Teaching Practicum", label: "Teaching Practicum" },
      en,
    );

    expect(a.key).toBe(b.key);
    expect(a.label).toBe("Teaching Practicum");
  });

  it("translates an aliased tag rather than forcing English on it", () => {
    const resolved = resolveTag({ labelEn: "Practicum", label: "កម្មសិក្សា" }, km);
    expect(resolved.label).toBe(km.experience.tagAliases.teachingPracticum);
  });

  it("leaves an unaliased tag exactly as the editor wrote it", () => {
    const resolved = resolveTag(
      { labelEn: "Primary Mathematics", label: "គណិតវិទ្យាបឋម" },
      km,
    );
    expect(resolved.label).toBe("គណិតវិទ្យាបឋម");
  });

  it("does not merge a more specific tag into a broader one", () => {
    const broad = resolveTag({ labelEn: "Mathematics", label: "Mathematics" }, en);
    const specific = resolveTag(
      { labelEn: "Primary Mathematics", label: "Primary Mathematics" },
      en,
    );
    expect(broad.key).not.toBe(specific.key);
  });

  it("de-duplicates while keeping the editor's order", () => {
    const deduped = dedupeTags([
      resolveTag({ labelEn: "Practicum", label: "Practicum" }, en),
      resolveTag({ labelEn: "Mathematics", label: "Mathematics" }, en),
      resolveTag(
        { labelEn: "Teaching Practicum", label: "Teaching Practicum" },
        en,
      ),
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped[0]?.label).toBe("Teaching Practicum");
  });

  it("puts every non-development kind on the education track", () => {
    expect(trackForKind("development")).toBe("product");
    expect(trackForKind("practicum")).toBe("education");
    expect(trackForKind("tutoring")).toBe("education");
    // An unrecognised kind must not silently claim engineering work.
    expect(trackForKind("something-new")).toBe("education");
  });
});

// ── Contributions ───────────────────────────────────────────────────────────

describe("splitContributions", () => {
  it("splits the newline blob into discrete statements", () => {
    expect(splitContributions("One.\nTwo.\nThree.")).toEqual([
      "One.",
      "Two.",
      "Three.",
    ]);
  });

  it("strips bullets an editor typed by habit, and blank lines", () => {
    expect(splitContributions("• One\n\n- Two\n   \n— Three")).toEqual([
      "One",
      "Two",
      "Three",
    ]);
  });

  it("returns nothing for nothing", () => {
    expect(splitContributions(null)).toEqual([]);
    expect(splitContributions("   ")).toEqual([]);
  });
});

// ── Project links ───────────────────────────────────────────────────────────

describe("projectsNamedIn", () => {
  it("links a project the prose actually names", () => {
    const linked = projectsNamedIn(
      "Built PTEC Digital Library to organise learning resources.",
      projects,
      "en",
    );

    expect(linked.map((project) => project.slug)).toEqual([
      "ptec-digital-library",
    ]);
    expect(linked[0]?.href).toBe("/en/projects/ptec-digital-library");
  });

  it("matches on the slug, so Khmer prose linking a Latin product name works", () => {
    const linked = projectsNamedIn(
      "បានរចនា និងអភិវឌ្ឍ KruSmart ជាបណ្ណាល័យ។",
      projects,
      "km",
    );

    expect(linked.map((project) => project.slug)).toEqual(["krusmart"]);
    expect(linked[0]?.href).toBe("/km/projects/krusmart");
  });

  it("links nothing when nothing is named", () => {
    expect(
      projectsNamedIn("Built a teacher assistant platform.", projects, "en"),
    ).toEqual([]);
  });
});

// ── View model ──────────────────────────────────────────────────────────────

describe("buildExperienceViews", () => {
  const entries = [
    entry({
      id: "student-teacher",
      slug: "student-teacher",
      kind: "teaching",
      periodLabel: "2023 — present",
      isCurrent: true,
      sortOrder: 10,
      achievements: "One\nTwo\nThree\nFour",
      tags: [
        { id: "t1", slug: "primary-education", labelEn: "Primary Education", label: "Primary Education" },
        { id: "t2", slug: "mathematics", labelEn: "Mathematics", label: "Mathematics" },
        { id: "t3", slug: "pedagogy", labelEn: "Pedagogy", label: "Pedagogy" },
        { id: "t4", slug: "12-4-programme", labelEn: "12+4 Programme", label: "12+4 Programme" },
      ],
    }),
    entry({
      id: "tutor",
      slug: "tutor",
      kind: "teaching",
      periodLabel: "2025 — 2026",
      sortOrder: 20,
    }),
    entry({
      id: "practicum-1",
      slug: "practicum-1",
      kind: "practicum",
      periodLabel: "First-year practicum · 2024–2025",
      sortOrder: 30,
    }),
    entry({
      id: "practicum-2",
      slug: "practicum-2",
      kind: "practicum",
      periodLabel: "Second-year practicum · 2025–2026",
      isCurrent: true,
      sortOrder: 40,
      achievements: "Planned lessons",
    }),
    entry({
      id: "developer",
      slug: "developer",
      kind: "development",
      periodLabel: "2024 — present",
      isCurrent: true,
      sortOrder: 50,
      achievements: "Built PTEC Digital Library and KruSmart.",
    }),
  ];

  const views = buildExperienceViews({ entries, projects, locale: "en", t: en });

  it("reorders the page chronologically instead of by sort_order", () => {
    // sort_order gave 2023, 2025, 2024, 2025, 2024 — which is what shipped.
    expect(views.map((view) => view.id)).toEqual([
      "student-teacher",
      "practicum-1",
      "developer",
      "tutor",
      "practicum-2",
    ]);
  });

  it("assigns a track to every entry", () => {
    expect(views.find((view) => view.id === "developer")?.track).toBe("product");
    expect(views.find((view) => view.id === "practicum-1")?.track).toBe(
      "education",
    );
  });

  it("features the most recent current entry on each track, and only one", () => {
    const featured = views.filter((view) => view.featured).map((v) => v.id);
    expect(featured.sort()).toEqual(["developer", "practicum-2"]);
  });

  it("does not feature an entry with nothing to show", () => {
    const [only] = buildExperienceViews({
      entries: [entry({ id: "bare", isCurrent: true, periodLabel: "2024" })],
      projects,
      locale: "en",
      t: en,
    });
    expect(only?.featured).toBe(false);
  });

  it("caps the card's skills at three and keeps the rest reachable", () => {
    const view = views.find((item) => item.id === "student-teacher");
    expect(view?.primaryTags).toHaveLength(3);
    expect(view?.tags).toHaveLength(4);
  });

  it("emits the facets the CSS filter matches on", () => {
    const practicum = views.find((view) => view.id === "practicum-1");
    expect(practicum?.facets).toContain("education");
    expect(practicum?.facets).toContain("practicum");

    const student = views.find((view) => view.id === "student-teacher");
    expect(student?.facets).toContain("mathematics");
    expect(student?.facets).not.toContain("practicum");
  });

  it("links only the products an entry's own words name", () => {
    const developer = views.find((view) => view.id === "developer");
    expect(developer?.relatedProjects.map((p) => p.slug).sort()).toEqual([
      "krusmart",
      "ptec-digital-library",
    ]);

    const tutor = views.find((view) => view.id === "tutor");
    expect(tutor?.relatedProjects).toEqual([]);
  });

  it("normalises every period to one form", () => {
    expect(views.map((view) => view.periodLabel)).toEqual([
      "2023—Present",
      "2024—2025",
      "2024—Present",
      "2025—2026",
      "2025—2026",
    ]);
  });

  // ── Summary ───────────────────────────────────────────────────────────────

  it("derives the summary figures from the entries", () => {
    const summary = buildExperienceSummary({ views, locale: "en", t: en });
    const byId = Object.fromEntries(summary.map((i) => [i.id, i.value]));

    expect(byId["education-span"]).toBe("2023—Present");
    expect(byId["product-span"]).toBe("2024—Present");
    expect(byId["entries"]).toBe("5");
    expect(byId["products"]).toBe("2");
  });

  it("omits a summary figure it cannot compute", () => {
    const educationOnly = buildExperienceViews({
      entries: [entry({ id: "a", periodLabel: "2024", isCurrent: false })],
      projects,
      locale: "en",
      t: en,
    });

    const summary = buildExperienceSummary({
      views: educationOnly,
      locale: "en",
      t: en,
    });

    expect(summary.map((item) => item.id)).not.toContain("product-span");
    expect(summary.map((item) => item.id)).not.toContain("products");
  });

  // ── Filters ───────────────────────────────────────────────────────────────

  it("offers filters once there is enough to filter", () => {
    const options = buildExperienceFilters({ views, t: en });
    expect(options[0]?.value).toBe("all");
    expect(options.map((option) => option.value)).toContain("practicum");
    expect(options.map((option) => option.value)).toContain("product");
  });

  it("offers no filters over a list short enough to read whole", () => {
    const few = buildExperienceViews({
      entries: entries.slice(0, 3),
      projects,
      locale: "en",
      t: en,
    });
    expect(buildExperienceFilters({ views: few, t: en })).toEqual([]);
  });

  it("drops a facet that every entry matches, since it narrows nothing", () => {
    const allEducation = buildExperienceViews({
      entries: entries.filter((item) => item.kind !== "development"),
      projects,
      locale: "en",
      t: en,
    });

    const options = buildExperienceFilters({ views: allEducation, t: en });
    expect(options.map((option) => option.value)).not.toContain("education");
  });

  // ── Evidence map ──────────────────────────────────────────────────────────

  it("builds themes from real evidence and drops the ones with none", () => {
    const publications: PublicationInput[] = [
      {
        id: "pub1",
        slug: "sequences",
        href: "/en/publications/sequences",
        title: "Sequences of Real Numbers",
        subject: "Mathematical Analysis",
      },
      {
        id: "pub2",
        slug: "other",
        href: "/en/publications/other",
        title: "Something Else",
        subject: "History",
      },
    ];

    const themes = buildEvidenceThemes({
      views,
      projects,
      publications,
      locale: "en",
      t: en,
    });

    expect(themes.every((theme) => theme.items.length > 0)).toBe(true);

    const mathematics = themes.find((theme) => theme.id === "mathematics");
    // The tagged role and the mathematics book, and not the history one.
    expect(mathematics?.items.map((item) => item.id)).toEqual([
      "experience:student-teacher",
      "publication:pub1",
    ]);

    // Matched on the project's own `academic-repository` category, not on a
    // hand-written list of slugs.
    const academic = themes.find((theme) => theme.id === "academicSystems");
    expect(academic?.items.map((item) => item.id)).toEqual(["project:p2"]);
  });

  it("produces no themes at all when there is no evidence", () => {
    expect(
      buildEvidenceThemes({
        views: [],
        projects: [],
        publications: [],
        locale: "en",
        t: en,
      }),
    ).toEqual([]);
  });
});
