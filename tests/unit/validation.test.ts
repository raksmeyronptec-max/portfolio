import { describe, expect, it } from "vitest";

import {
  contactSubmissionSchema,
  collectFieldErrors,
  scoreSpam,
} from "@/lib/validation/contact";
import {
  projectSchema,
  publishBlockers,
  slugify,
  type ProjectInput,
} from "@/lib/validation/project";
import {
  certificatePublishBlockers,
  certificateSchema,
  PRIVACY_CHECKLIST,
} from "@/lib/validation/certificate";
import { educationSchema, testimonialSchema } from "@/lib/validation/cv";

// ── Contact form ────────────────────────────────────────────────────────────

const validContact = {
  name: "Sok Dara",
  email: "dara@example.com",
  message: "I would like to discuss a mathematics tutoring arrangement.",
  consent: true as const,
  locale: "en" as const,
};

describe("contact submission schema", () => {
  it("accepts a valid submission", () => {
    expect(contactSubmissionSchema.safeParse(validContact).success).toBe(true);
  });

  it("requires consent", () => {
    const result = contactSubmissionSchema.safeParse({
      ...validContact,
      consent: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(collectFieldErrors(result.error).consent).toBe("consentRequired");
    }
  });

  it("rejects a message that is too short to act on", () => {
    const result = contactSubmissionSchema.safeParse({ ...validContact, message: "hi" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(collectFieldErrors(result.error).message).toBe("messageTooShort");
    }
  });

  it("rejects an invalid email", () => {
    const result = contactSubmissionSchema.safeParse({
      ...validContact,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(collectFieldErrors(result.error).email).toBe("emailInvalid");
    }
  });

  it("enforces the same length caps as the database CHECK constraints", () => {
    expect(
      contactSubmissionSchema.safeParse({
        ...validContact,
        message: "x".repeat(2001),
      }).success,
    ).toBe(false);

    expect(
      contactSubmissionSchema.safeParse({ ...validContact, name: "x".repeat(101) })
        .success,
    ).toBe(false);
  });

  it("rejects a filled honeypot", () => {
    // A real user never sees this field.
    expect(
      contactSubmissionSchema.safeParse({
        ...validContact,
        website: "http://spam.example",
      }).success,
    ).toBe(false);
  });

  it("returns error CODES, not sentences, so the client can localise them", () => {
    const result = contactSubmissionSchema.safeParse({ ...validContact, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = collectFieldErrors(result.error);
      expect(errors.name).toBe("nameRequired");
      // A code contains no spaces; a sentence would.
      expect(errors.name).not.toContain(" ");
    }
  });
});

describe("scoreSpam", () => {
  const base = {
    name: "Sok Dara",
    email: "dara@example.com",
    message: "Hello, I would like to ask about tutoring for my daughter.",
    honeypotFilled: false,
  };

  it("scores a genuine enquiry low", () => {
    expect(scoreSpam(base)).toBeLessThan(20);
  });

  it("scores a filled honeypot high", () => {
    expect(scoreSpam({ ...base, honeypotFilled: true })).toBeGreaterThanOrEqual(60);
  });

  it("penalises submissions faster than a human could type", () => {
    expect(scoreSpam({ ...base, elapsedMs: 500 })).toBeGreaterThan(scoreSpam(base));
  });

  it("penalises link-heavy messages", () => {
    const linky = {
      ...base,
      message: "https://a.example https://b.example https://c.example",
    };
    expect(scoreSpam(linky)).toBeGreaterThan(scoreSpam(base));
  });

  it("penalises known spam vocabulary", () => {
    expect(
      scoreSpam({ ...base, message: "We offer an seo service and backlink packages." }),
    ).toBeGreaterThan(scoreSpam(base));
  });

  it("never exceeds 100", () => {
    expect(
      scoreSpam({
        name: "https://spam.example",
        email: "x@y.z",
        message: "BUY NOW CRYPTO CASINO https://a https://b https://c seo service",
        elapsedMs: 100,
        honeypotFilled: true,
      }),
    ).toBeLessThanOrEqual(100);
  });
});

// ── Slugs ───────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("lower-cases and hyphenates", () => {
    expect(slugify("PTEC Digital Library")).toBe("ptec-digital-library");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("Ron's  Portfolio -- 2026!")).toBe("rons-portfolio-2026");
  });

  it("removes accents rather than dropping the letters", () => {
    expect(slugify("Café Résumé")).toBe("cafe-resume");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --hello--  ")).toBe("hello");
  });

  it("returns an empty string for Khmer-only input, so the caller must handle it", () => {
    // Khmer has no case and no ASCII transliteration. The database `slugify()`
    // function generates a hash-based fallback; the client version returns empty so
    // the editor is prompted to type a slug rather than being given a hash.
    expect(slugify("បណ្ណាល័យឌីជីថល")).toBe("");
  });

  it("caps the length", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

// ── Projects ────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<ProjectInput> = {}): ProjectInput {
  return {
    slug: "example-project",
    status: "draft",
    project_status: "live",
    featured: false,
    sort_order: 0,
    needs_review: false,
    categoryIds: [],
    technologyIds: [],
    translations: [
      {
        locale: "en",
        title: "Example project",
        summary: "A short summary.",
        overview: "An overview.",
        problem: "The problem.",
        solution: "The solution.",
        seo_description: "x".repeat(80),
      },
      { locale: "km", title: "គម្រោងឧទាហរណ៍" },
    ],
    cover_media_id: "11111111-1111-4111-8111-111111111111",
    ...overrides,
  } as ProjectInput;
}

describe("project schema", () => {
  it("accepts a minimal draft", () => {
    const result = projectSchema.safeParse(makeProject());
    expect(result.success).toBe(true);
  });

  it("rejects a slug with invalid characters", () => {
    expect(projectSchema.safeParse(makeProject({ slug: "Not A Slug" })).success).toBe(
      false,
    );
    expect(projectSchema.safeParse(makeProject({ slug: "with_underscore" })).success).toBe(
      false,
    );
  });

  it("requires absolute URLs", () => {
    expect(
      projectSchema.safeParse(makeProject({ live_url: "krusmart.org" })).success,
    ).toBe(false);
    expect(
      projectSchema.safeParse(makeProject({ live_url: "https://krusmart.org" })).success,
    ).toBe(true);
  });

  it("treats an empty optional string as null rather than as a value", () => {
    const result = projectSchema.safeParse(makeProject({ live_url: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.live_url).toBeNull();
  });

  it("mirrors the database SEO description bounds", () => {
    const tooShort = makeProject();
    tooShort.translations[0]!.seo_description = "too short";
    expect(projectSchema.safeParse(tooShort).success).toBe(false);

    const tooLong = makeProject();
    tooLong.translations[0]!.seo_description = "x".repeat(161);
    expect(projectSchema.safeParse(tooLong).success).toBe(false);
  });
});

describe("publishBlockers", () => {
  it("reports nothing for a complete project", () => {
    expect(publishBlockers(makeProject())).toEqual([]);
  });

  it("blocks on a missing case study", () => {
    const project = makeProject();
    project.translations[0]!.overview = null;
    expect(publishBlockers(project)).toContain("overviewMissing");
  });

  it("blocks on a missing cover image", () => {
    expect(publishBlockers(makeProject({ cover_media_id: null }))).toContain(
      "coverMissing",
    );
  });

  it("blocks while the needs-review flag is set", () => {
    // This is what stops the migrated seed data being published unexamined.
    expect(publishBlockers(makeProject({ needs_review: true }))).toContain("needsReview");
  });

  it("blocks on a missing SEO description", () => {
    const project = makeProject();
    project.translations[0]!.seo_description = null;
    expect(publishBlockers(project)).toContain("seoDescriptionMissing");
  });
});

// ── Certificates ────────────────────────────────────────────────────────────

const validCertificate = {
  slug: "bacii-certificate",
  status: "draft" as const,
  credential_status: "active" as const,
  featured: false,
  sort_order: 0,
  issuer_en: "Ministry of Education, Youth and Sport",
  allow_public_download: false,
  contains_sensitive_data: true,
  privacy_review_confirmed: false,
  needs_review: false,
  skills: [],
  relatedProjectIds: [],
  translations: [
    {
      locale: "en" as const,
      title: "BacII Certificate",
      image_summary: "A national diploma showing an overall grade of A.",
    },
  ],
  preview_media_id: "22222222-2222-4222-8222-222222222222",
  issued_on: "2023-09-01",
};

describe("certificate schema", () => {
  it("accepts a valid draft", () => {
    expect(certificateSchema.safeParse(validCertificate).success).toBe(true);
  });

  it("refuses a public download while the document is flagged sensitive", () => {
    // Mirrors the database trigger, so the user gets a readable message instead of a
    // raw check violation.
    const result = certificateSchema.safeParse({
      ...validCertificate,
      allow_public_download: true,
      contains_sensitive_data: true,
    });
    expect(result.success).toBe(false);
  });

  it("allows a public download once the sensitive flag is cleared", () => {
    expect(
      certificateSchema.safeParse({
        ...validCertificate,
        allow_public_download: true,
        contains_sensitive_data: false,
      }).success,
    ).toBe(true);
  });

  it("rejects an expiry date before the issue date", () => {
    expect(
      certificateSchema.safeParse({
        ...validCertificate,
        issued_on: "2023-09-01",
        expires_on: "2022-01-01",
      }).success,
    ).toBe(false);
  });
});

describe("certificatePublishBlockers", () => {
  it("blocks without a recorded privacy review", () => {
    const parsed = certificateSchema.parse(validCertificate);
    expect(certificatePublishBlockers(parsed)).toContain("privacyReviewMissing");
  });

  it("blocks without a redacted preview image", () => {
    const parsed = certificateSchema.parse({
      ...validCertificate,
      preview_media_id: null,
    });
    expect(certificatePublishBlockers(parsed)).toContain("previewMissing");
  });

  it("blocks without a text description of the document", () => {
    // The scan is unreadable to a screen reader, so this is an accessibility gate.
    const parsed = certificateSchema.parse({
      ...validCertificate,
      translations: [{ locale: "en" as const, title: "BacII Certificate" }],
    });
    expect(certificatePublishBlockers(parsed)).toContain("imageSummaryMissing");
  });

  it("clears once the review is confirmed and everything is present", () => {
    const parsed = certificateSchema.parse({
      ...validCertificate,
      privacy_review_confirmed: true,
    });
    expect(certificatePublishBlockers(parsed)).toEqual([]);
  });
});

describe("privacy checklist", () => {
  it("covers the identifiers a Cambodian credential typically carries", () => {
    const ids = PRIVACY_CHECKLIST.map((item) => item.id);
    expect(ids).toContain("national-id");
    expect(ids).toContain("date-of-birth");
    expect(ids).toContain("signature");
    expect(ids).toContain("qr-code");
    expect(ids).toContain("student-number");
  });

  it("gives every item an explanation, not just a label", () => {
    for (const item of PRIVACY_CHECKLIST) {
      expect(item.detail.length).toBeGreaterThan(10);
    }
  });
});

// ── Education and testimonials ──────────────────────────────────────────────

describe("education schema", () => {
  const base = {
    slug: "ptec",
    status: "draft" as const,
    kind: "teacher_education" as const,
    sort_order: 0,
    is_current: true,
    needs_review: false,
    translations: [{ locale: "en" as const, institution: "PTEC" }],
  };

  it("refuses a grade without its scale", () => {
    // The direct answer to v1 printing "3.79" and "A" with nothing to interpret them.
    const result = educationSchema.safeParse({ ...base, grade_value: "A" });
    expect(result.success).toBe(false);
  });

  it("accepts a grade together with its scale", () => {
    expect(
      educationSchema.safeParse({
        ...base,
        grade_value: "A",
        grade_scale: "Cambodian BacII overall grade (A–E)",
      }).success,
    ).toBe(true);
  });

  it("refuses an end date on a current programme", () => {
    expect(
      educationSchema.safeParse({ ...base, is_current: true, ended_on: "2028-06-01" })
        .success,
    ).toBe(false);
  });
});

describe("testimonial schema", () => {
  const base = {
    slug: "colleague",
    status: "draft" as const,
    featured: false,
    sort_order: 0,
    author_name_en: "Ron Saroeun",
    consent_confirmed: false,
    translations: [{ locale: "en" as const, quote: "A dedicated educator." }],
  };

  it("accepts a draft without consent", () => {
    // Drafts must be storable; only publishing is gated.
    expect(testimonialSchema.safeParse(base).success).toBe(true);
  });

  it("has no field for a rating", () => {
    const parsed = testimonialSchema.parse(base);
    expect("rating" in parsed).toBe(false);
    expect("stars" in parsed).toBe(false);
  });

  it("has no field for a phone number", () => {
    // v1 published a referee's mobile number; the schema makes that impossible.
    const parsed = testimonialSchema.parse(base) as Record<string, unknown>;
    expect(Object.keys(parsed).some((key) => /phone|mobile|tel/i.test(key))).toBe(false);
  });

  it("caps quote length in line with the database constraint", () => {
    expect(
      testimonialSchema.safeParse({
        ...base,
        translations: [{ locale: "en" as const, quote: "x".repeat(1201) }],
      }).success,
    ).toBe(false);
  });
});
