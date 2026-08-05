import { describe, expect, it } from "vitest";

import {
  buildAboutChapters,
  buildAboutStory,
  buildCurrentFocus,
  orderPurposeProjects,
  readableSocialLabel,
  type AboutChapterInput,
  type AboutEducationInput,
  type AboutExperienceInput,
} from "@/lib/content/about-view";

const education = (
  input: Partial<AboutEducationInput> & Pick<AboutEducationInput, "id" | "slug">,
): AboutEducationInput => ({
  kind: "university",
  institution: "Institution",
  qualification: null,
  fieldOfStudy: null,
  description: `Description ${input.id}`,
  periodLabel: "2024 — present",
  isCurrent: true,
  contentLocale: "en",
  ...input,
});

const experience = (
  input: Partial<AboutExperienceInput> & Pick<AboutExperienceInput, "id" | "slug">,
): AboutExperienceInput => ({
  kind: "teaching",
  roleTitle: "Teacher",
  organization: "School",
  summary: `Summary ${input.id}`,
  description: `Description ${input.id}`,
  periodLabel: "2024 — present",
  isCurrent: true,
  contentLocale: "en",
  ...input,
});

const journey = (
  input: Partial<AboutChapterInput> & Pick<AboutChapterInput, "id" | "slug">,
): AboutChapterInput => ({
  featured: false,
  title: input.id,
  summary: `Summary ${input.id}`,
  periodLabel: "7 July 2025",
  year: "2025",
  eventDate: "2025-07-07",
  categorySlug: null,
  contentLocale: "en",
  cover: null,
  ...input,
});

describe("About view model", () => {
  it("keeps authored biography first and preserves product prose after two studies", () => {
    const story = buildAboutStory({
      biography: "Authored biography",
      locale: "en",
      education: [1, 2, 3].map((number) =>
        education({ id: String(number), slug: String(number) }),
      ),
      experiences: [
        experience({
          id: "product",
          slug: "full-stack-product-builder",
          kind: "development",
          roleTitle: "Product builder",
          description: "Product practice",
        }),
      ],
    });

    expect(story.map((item) => item.text)).toEqual([
      "Authored biography",
      "Description 1",
      "Description 2",
      "Product practice",
    ]);
  });

  it("builds the fixed academic, dual-study, product and fieldwork arc", () => {
    const chapters = buildAboutChapters({
      locale: "en",
      currentStudiesTitle: "Two current academic paths",
      undatedLabel: "Date to be confirmed",
      // Deliberately shuffled: selection must be semantic, not loader-order based.
      education: [
        education({
          id: "math",
          slug: "khemarak-university-mathematics",
          fieldOfStudy: "Applied Mathematics",
          periodLabel: "Year 3 — expected 2027",
        }),
        education({
          id: "school",
          slug: "cambodia-japan-friendship-high-school",
          kind: "high_school",
          qualification: "National High School Diploma",
          periodLabel: "2023",
          isCurrent: false,
        }),
        education({
          id: "ptec",
          slug: "ptec-teacher-education",
          kind: "teacher_education",
          fieldOfStudy: "Primary Teacher Education",
          periodLabel: "2023 — 2028 (expected)",
        }),
      ],
      experiences: [
        experience({
          id: "product",
          slug: "full-stack-product-builder",
          kind: "development",
          roleTitle: "Full-Stack Developer & Product Designer",
          periodLabel: "2024 — present",
          summary: "",
          description: "Builds practical education products.",
        }),
      ],
      journey: [
        journey({
          id: "grade",
          slug: "outstanding-student-grade-a-recognition",
          title: "Grade A Recognition",
          periodLabel: "January 2023",
        }),
        journey({
          id: "fieldwork",
          slug: "ptom-plp-fieldwork-kakoh-primary-school",
          categorySlug: "fieldwork",
          title: "PTOM and PLP Fieldwork at Kakoh Primary School",
        }),
      ],
    });

    expect(chapters.map((chapter) => chapter.kind)).toEqual([
      "foundation",
      "dual-study",
      "product",
      "fieldwork",
    ]);
    expect(chapters[1]?.evidence.map((item) => item.period)).toEqual([
      "2023 — 2028 (expected)",
      "Year 3 — expected 2027",
    ]);
    expect(chapters[1]?.evidence.map((item) => item.href)).toEqual([
      "/en/education#education-ptec-teacher-education",
      "/en/education#education-khemarak-university-mathematics",
    ]);
    expect(chapters[2]?.evidence[0]?.summary).toBe(
      "Builds practical education products.",
    );
    expect(chapters.flatMap((chapter) => chapter.evidence.map((item) => item.id)))
      .not.toContain("journey-grade");
  });

  it("returns fewer chapters rather than filling a missing source with unrelated history", () => {
    const chapters = buildAboutChapters({
      locale: "km",
      currentStudiesTitle: "ផ្លូវសិក្សាបច្ចុប្បន្នពីរ",
      undatedLabel: "កាលបរិច្ឆេទត្រូវបញ្ជាក់",
      education: [],
      experiences: [],
      journey: [
        journey({ id: "unrelated", slug: "unrelated-award", title: "Other" }),
      ],
    });

    expect(chapters).toEqual([]);
  });

  it("orders purpose stories by teacher workflow, access and infrastructure", () => {
    const base = {
      summary: null,
      problem: null,
      role: null,
      liveUrl: null,
      yearLabel: null,
      contentLocale: "en" as const,
    };
    const result = orderPurposeProjects([
      { ...base, id: "1", slug: "ptec-storage", title: "Storage" },
      { ...base, id: "2", slug: "ptec-digital-library", title: "Library" },
      { ...base, id: "3", slug: "krusmart", title: "KruSmart" },
    ]);
    expect(result.map((item) => item.slug)).toEqual([
      "krusmart",
      "ptec-digital-library",
      "ptec-storage",
    ]);
  });

  it("keeps two studies plus classroom and product work in current focus", () => {
    const focus = buildCurrentFocus({
      locale: "en",
      education: [1, 2, 3].map((number) =>
        education({ id: `study-${number}`, slug: `study-${number}` }),
      ),
      experiences: [
        experience({ id: "classroom", slug: "classroom-practicum", kind: "practicum" }),
        experience({
          id: "product",
          slug: "full-stack-product-builder",
          kind: "development",
        }),
      ],
    });

    expect(focus.map((item) => item.kind)).toEqual([
      "study",
      "study",
      "practice",
      "product",
    ]);
  });

  it("turns Telegram URLs into readable handles", () => {
    expect(
      readableSocialLabel({
        platform: "telegram",
        label: "Telegram",
        handle: "https://t.me/Ron_Raksmey",
        url: "https://t.me/Ron_Raksmey",
      }),
    ).toBe("@Ron_Raksmey");
  });
});
