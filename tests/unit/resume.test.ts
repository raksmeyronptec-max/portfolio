import { describe, expect, it } from "vitest";

import { en } from "@/i18n/messages/en";
import { km } from "@/i18n/messages/km";
import { resumeDownloadFilename } from "@/lib/content/resume-file";
import {
  buildResumeCapabilities,
  buildResumeContact,
  buildResumeEducation,
  buildResumeExperience,
  buildResumePublications,
  stripTrackingParams,
  type ResumeEducationInput,
  type ResumeExperienceInput,
  type ResumeProjectInput,
} from "@/lib/content/resume-view";

/**
 * The Resume page's derivations.
 *
 * A résumé is an application document, so the risks here are different from a
 * portfolio page's: a role in the wrong order, an in-progress degree that
 * reads as awarded, a tracking URL printed on paper, or a file that lands in
 * someone's downloads folder called `cv_ron_raksmey.pdf`. Each is a function,
 * so each is a test.
 */

function experience(
  overrides: Partial<ResumeExperienceInput> = {},
): ResumeExperienceInput {
  return {
    id: "id",
    slug: "slug",
    kind: "teaching",
    roleTitle: "Role",
    organization: "Organisation",
    location: null,
    summary: null,
    achievements: null,
    periodLabel: null,
    startedOn: null,
    endedOn: null,
    isCurrent: false,
    tags: [],
    sortOrder: 0,
    ...overrides,
  };
}

function education(
  overrides: Partial<ResumeEducationInput> = {},
): ResumeEducationInput {
  return {
    id: "id",
    slug: "slug",
    institution: "Institution",
    qualification: null,
    fieldOfStudy: null,
    periodLabel: null,
    scheduleLabel: null,
    startedOn: null,
    endedOn: null,
    isCurrent: false,
    gradeValue: null,
    gradeScale: null,
    ...overrides,
  };
}

const PROJECTS: ResumeProjectInput[] = [
  {
    id: "p1",
    slug: "krusmart",
    title: "KruSmart",
    summary: null,
    liveUrl: "https://www.krusmart.org/",
    role: "Product design",
    technologies: [{ slug: "firebase", name: "Firebase" }],
    categories: [{ slug: "education-technology", name: "Education Technology" }],
  },
  {
    id: "p2",
    slug: "ptec-digital-library",
    title: "PTEC Digital Library",
    summary: null,
    liveUrl: "https://library.ptec.edu.kh/",
    role: "Full-stack development",
    technologies: [
      { slug: "nextjs", name: "Next.js" },
      { slug: "supabase", name: "Supabase" },
    ],
    categories: [{ slug: "academic-repository", name: "Academic Repository" }],
  },
];

// ── Experience ──────────────────────────────────────────────────────────────

describe("buildResumeExperience", () => {
  const entries = [
    experience({
      id: "student",
      slug: "student-teacher-ptec",
      periodLabel: "2023 — present",
      isCurrent: true,
      sortOrder: 10,
    }),
    experience({
      id: "tutor",
      slug: "private-home-tutor",
      periodLabel: "2025 — 2026",
      sortOrder: 20,
    }),
    experience({
      id: "dev",
      slug: "full-stack-product-builder",
      kind: "development",
      periodLabel: "2024 — present",
      isCurrent: true,
      sortOrder: 50,
      achievements:
        "Built PTEC Digital Library.\nDesigned KruSmart.\nThree.\nFour.\nFive.",
    }),
  ];

  const built = buildResumeExperience({
    entries,
    projects: PROJECTS,
    locale: "en",
    t: en,
  });

  it("reads most recent first, unlike the Experience page", () => {
    // The Experience page argues chronologically and reads oldest-first; a
    // résumé is scanned, so the newest role has to lead.
    expect(built.map((e) => e.id)).toEqual(["tutor", "dev", "student"]);
  });

  it("normalises every period to one form", () => {
    expect(built.map((e) => e.periodLabel)).toEqual([
      "2025—2026",
      "2024—Present",
      "2023—Present",
    ]);
  });

  it("localises the period and its numerals together", () => {
    const kmBuilt = buildResumeExperience({
      entries,
      projects: PROJECTS,
      locale: "km",
      t: km,
    });
    expect(kmBuilt.find((e) => e.id === "student")?.periodLabel).toBe(
      "២០២៣—បច្ចុប្បន្ន",
    );
  });

  it("caps contributions so one role cannot fill the page", () => {
    expect(built.find((e) => e.id === "dev")?.contributions).toHaveLength(4);
  });

  it("links only the products a role's own words name", () => {
    expect(built.find((e) => e.id === "dev")?.evidence.map((x) => x.label)).toEqual([
      "KruSmart",
      "PTEC Digital Library",
    ]);
    expect(built.find((e) => e.id === "tutor")?.evidence).toEqual([]);
  });

  it("deep-links each role into the Experience page", () => {
    expect(built.find((e) => e.id === "dev")?.href).toBe(
      "/en/experience#experience-full-stack-product-builder",
    );
  });
});

// ── Education ───────────────────────────────────────────────────────────────

describe("buildResumeEducation", () => {
  const entries = [
    education({
      id: "ptec",
      slug: "ptec-primary-teacher-education",
      isCurrent: true,
      periodLabel: "2023 — 2028 (expected)",
      qualification: "Bachelor’s Degree in Education",
    }),
    education({
      id: "khemarak",
      slug: "khemarak-university-mathematics",
      isCurrent: true,
      periodLabel: "2023 — 2027 (expected)",
      qualification: "Bachelor’s Degree in Mathematics",
    }),
    education({
      id: "bacii",
      slug: "upper-secondary-education-bac-ii",
      periodLabel: "Upper-secondary examination completed in 2023",
      qualification: "Upper Secondary Education Certificate (Bac II)",
      gradeValue: "A",
      gradeScale: "Cambodian BacII overall grade (A–E)",
    }),
    education({
      id: "grade9",
      slug: "lower-secondary-education-grade-9",
      periodLabel: "Lower-secondary examination completed in 2020",
      qualification: "Lower Secondary Education Certificate",
    }),
  ];

  const built = buildResumeEducation({ entries, locale: "en", t: en });

  it("separates study in progress from qualifications held", () => {
    expect(built.current.map((e) => e.id)).toEqual(["ptec", "khemarak"]);
    expect(built.completed.map((e) => e.id)).toEqual(["bacii", "grade9"]);
  });

  it("never lets an in-progress degree read as awarded", () => {
    for (const entry of built.current) {
      expect(entry.periodLabel).toContain("Expected");
    }
  });

  it("localises the expected wording and numerals", () => {
    const kmBuilt = buildResumeEducation({ entries, locale: "km", t: km });
    expect(kmBuilt.current[0]?.periodLabel).toBe("២០២៣—រំពឹងបញ្ចប់ ២០២៨");
  });

  it("orders completed qualifications newest first, by year not by label", () => {
    // The Khmer labels sort differently by codepoint; the parsed year is what
    // must drive the order, so both locales agree.
    const kmBuilt = buildResumeEducation({ entries, locale: "km", t: km });
    expect(kmBuilt.completed.map((e) => e.id)).toEqual(["bacii", "grade9"]);
  });
});

// ── Capabilities ────────────────────────────────────────────────────────────

describe("buildResumeCapabilities", () => {
  const experiences = [
    experience({
      tags: [
        { id: "1", slug: "lesson-planning", labelEn: "Lesson Planning", label: "Lesson Planning" },
        { id: "2", slug: "practicum", labelEn: "Practicum", label: "Practicum" },
        { id: "3", slug: "next-js", labelEn: "Next.js", label: "Next.js" },
        { id: "4", slug: "accessibility", labelEn: "Accessibility", label: "Accessibility" },
      ],
    }),
  ];

  const groups = buildResumeCapabilities({ experiences, projects: PROJECTS, t: en });

  it("builds groups from CMS vocabulary, not a hand-written list", () => {
    const byId = Object.fromEntries(groups.map((g) => [g.id, g.items]));
    expect(byId.education).toContain("Lesson Planning");
    // "Practicum" resolves through the shared alias, so both spellings of the
    // one concept produce the canonical label exactly once.
    expect(byId.education).toContain("Teaching Practicum");
    expect(byId.engineering).toContain("Next.js");
    expect(byId.quality).toContain("Accessibility");
  });

  it("picks up project technologies and categories", () => {
    const byId = Object.fromEntries(groups.map((g) => [g.id, g.items]));
    expect(byId.engineering).toContain("Supabase");
    expect(byId.product).toContain("Education Technology");
  });

  it("renders no group when there is no vocabulary behind it", () => {
    expect(
      buildResumeCapabilities({ experiences: [], projects: [], t: en }),
    ).toEqual([]);
  });
});

// ── Contact ─────────────────────────────────────────────────────────────────

describe("buildResumeContact", () => {
  const links = buildResumeContact({
    settings: {
      contactEmail: "raksmeyron97@gmail.com",
      telegramHandle: "https://t.me/Ron_Raksmey",
      linkedinUrl:
        "https://www.linkedin.com/in/ron-raksmey?utm_source=share_via&utm_content=profile&utm_medium=member_ios",
      location: "Phnom Penh, Cambodia",
    },
    locale: "en",
    t: en,
    siteUrl: "https://portfolio-beige-rho-51.vercel.app",
  });

  it("shows a Telegram handle, never the raw t.me URL", () => {
    const telegram = links.find((l) => l.id === "telegram");
    expect(telegram?.display).toBe("@Ron_Raksmey");
    expect(telegram?.href).toBe("https://t.me/Ron_Raksmey");
  });

  it("keeps a real mailto for the email", () => {
    expect(links.find((l) => l.id === "email")?.href).toBe(
      "mailto:raksmeyron97@gmail.com",
    );
  });

  it("strips share tracking from the stored LinkedIn URL", () => {
    const linkedin = links.find((l) => l.id === "linkedin");
    expect(linkedin?.href).toBe("https://www.linkedin.com/in/ron-raksmey");
    expect(linkedin?.display).not.toMatch(/https?:/);
  });

  it("offers the portfolio without its scheme as the visible label", () => {
    const portfolio = links.find((l) => l.id === "portfolio");
    expect(portfolio?.href).toBe("https://portfolio-beige-rho-51.vercel.app/en");
    expect(portfolio?.display).toBe("portfolio-beige-rho-51.vercel.app/en");
  });

  it("omits a channel the CMS does not hold", () => {
    const sparse = buildResumeContact({
      settings: {
        contactEmail: null,
        telegramHandle: null,
        linkedinUrl: null,
        location: null,
      },
      locale: "en",
      t: en,
      siteUrl: "https://example.test",
    });
    // Only the portfolio, which is always derivable.
    expect(sparse.map((l) => l.id)).toEqual(["portfolio"]);
  });
});

describe("stripTrackingParams", () => {
  it("removes utm and ref parameters but keeps real ones", () => {
    expect(
      stripTrackingParams("https://x.test/p?utm_source=a&id=7&trk=b"),
    ).toBe("https://x.test/p?id=7");
  });

  it("returns a malformed URL untouched rather than throwing", () => {
    expect(stripTrackingParams("not a url")).toBe("not a url");
  });
});

// ── Publications ────────────────────────────────────────────────────────────

describe("buildResumePublications", () => {
  const publications = [
    { id: "b1", slug: "graphs", href: "/en/publications/graphs", title: "Graphs of Functions", subject: "Functions", year: 2026, contentLanguage: "km", typeName: "Textbook" },
    { id: "b2", slug: "seq", href: "/en/publications/seq", title: "Sequences", subject: null, year: null, contentLanguage: null, typeName: null },
    { id: "b3", slug: "c", href: "/en/publications/c", title: "C", subject: "Mathematics", year: 2025, contentLanguage: "en", typeName: null },
    { id: "b4", slug: "d", href: "/en/publications/d", title: "D", subject: null, year: 2024, contentLanguage: null, typeName: null },
  ];

  it("caps the résumé at three and builds a compact citation line", () => {
    const built = buildResumePublications({ publications, locale: "en", t: en });
    expect(built).toHaveLength(3);
    expect(built[0]?.meta).toBe("Textbook · Functions · Khmer · 2026");
  });

  it("omits every element it does not know rather than printing a gap", () => {
    const built = buildResumePublications({ publications, locale: "en", t: en });
    expect(built[1]?.meta).toBe("");
  });

  it("uses Khmer numerals for the year on the Khmer résumé", () => {
    const built = buildResumePublications({ publications, locale: "km", t: km });
    expect(built[0]?.meta).toContain("២០២៦");
  });
});

// ── Download filename ───────────────────────────────────────────────────────

describe("resumeDownloadFilename", () => {
  it("names the file for the person, the language and the version year", () => {
    expect(
      resumeDownloadFilename({
        versionLabel: "2026 Portfolio Resume — English",
        locale: "en",
        originalFilename: "cv_ron_raksmey.pdf",
      }),
    ).toBe("Ron-Raksmey-Resume-EN-2026.pdf");
  });

  it("uses the document's own locale, not the page's", () => {
    expect(
      resumeDownloadFilename({
        versionLabel: "2026 Portfolio Resume — Khmer",
        locale: "km",
        originalFilename: null,
      }),
    ).toBe("Ron-Raksmey-Resume-KM-2026.pdf");
  });

  it("keeps the stored name when the version label carries no year", () => {
    expect(
      resumeDownloadFilename({
        versionLabel: "Draft",
        locale: "en",
        originalFilename: "cv_ron_raksmey.pdf",
      }),
    ).toBe("cv_ron_raksmey.pdf");
  });
});
