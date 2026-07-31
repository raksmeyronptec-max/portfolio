import { describe, expect, it } from "vitest";

import {
  formatList,
  publishBlockerLabels,
  publishBlockerShortLabels,
  publishBlockers,
} from "@/lib/validation/project";

/**
 * "This project is not ready to publish yet" was the entire message an editor
 * got when a publish was refused. It named nothing, so the only way to find the
 * gap was to guess. These tests pin the two things that fixed it: every blocker
 * has a short label, and the labels compose into a readable sentence.
 */

const emptyProject = {
  slug: "example",
  status: "published" as const,
  project_status: "live" as const,
  featured: false,
  sort_order: 0,
  needs_review: false,
  categoryIds: [],
  technologyIds: [],
  features: [],
  metrics: [],
  cover_media_id: null,
  translations: [{ locale: "en" as const, title: "Example" }],
};

describe("publish blocker messages", () => {
  it("phrases every short label as an action, so they compose in one list", () => {
    /*
     * They complete "Still to do: …". A noun phrase breaks the moment
     * `needsReview` joins the list — it is not a missing field, and "still
     * missing: the needs-review flag" reads as nonsense.
     */
    for (const [code, label] of Object.entries(publishBlockerShortLabels)) {
      expect(label, `${code} should start with a verb`).toMatch(
        /^(add|write|choose|clear|give)\b/,
      );
    }
  });

  it("gives every blocker code both a sentence and a short label", () => {
    // A code with no short label would render as a raw identifier such as
    // "seoDescriptionMissing" in the toast.
    for (const code of Object.keys(publishBlockerLabels)) {
      expect(publishBlockerShortLabels[code], `missing short label for ${code}`)
        .toBeTruthy();
    }
    expect(Object.keys(publishBlockerShortLabels).sort()).toEqual(
      Object.keys(publishBlockerLabels).sort(),
    );
  });

  it("names every gap on a project that is missing everything", () => {
    const codes = publishBlockers(emptyProject);

    expect(codes).toContain("summaryMissing");
    expect(codes).toContain("overviewMissing");
    expect(codes).toContain("problemMissing");
    expect(codes).toContain("solutionMissing");
    expect(codes).toContain("seoDescriptionMissing");
    expect(codes).toContain("coverMissing");

    const sentence = `Still to do: ${formatList(
      codes.map((code) => publishBlockerShortLabels[code] ?? code),
    )}.`;

    expect(sentence).toContain("add a short summary");
    expect(sentence).toContain("choose a cover image");
    // Reads as prose, not as a code dump.
    expect(sentence).not.toMatch(/Missing$|[A-Z][a-z]+Missing/);
    expect(sentence.endsWith(".")).toBe(true);
  });

  it("reports nothing once the checklist is satisfied", () => {
    expect(
      publishBlockers({
        ...emptyProject,
        cover_media_id: "11111111-1111-4111-8111-111111111111",
        translations: [
          {
            locale: "en",
            title: "Example",
            summary: "A summary.",
            overview: "An overview.",
            problem: "A problem.",
            solution: "A solution.",
            seo_description: "x".repeat(60),
          },
        ],
      }),
    ).toEqual([]);
  });
});

describe("formatList", () => {
  it("reads as a sentence at every length", () => {
    expect(formatList([])).toBe("");
    expect(formatList(["a"])).toBe("a");
    expect(formatList(["a", "b"])).toBe("a and b");
    expect(formatList(["a", "b", "c"])).toBe("a, b and c");
  });
});
