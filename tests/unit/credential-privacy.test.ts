import { describe, expect, it } from "vitest";

import { usableAltText } from "@/lib/content/media";

/**
 * Credential privacy guards.
 *
 * Every case here comes from an audit of the ten credentials published on the
 * live site, not from imagination. Where a value was found leaking, the leaked
 * shape is the test — with the sensitive parts replaced by structurally
 * identical stand-ins, because a test fixture is a public file too.
 */

describe("usableAltText — filename detection", () => {
  /*
   * The regression. The live certificates page announced a credential preview
   * as "ptec_certificate_(21-11-2024)": the guard's character class did not
   * include brackets, so the string was judged prose and read out verbatim to
   * screen-reader users. The identical string without brackets was blanked
   * correctly, which is what made the hole easy to miss.
   */
  it("rejects a filename whose brackets used to defeat the character class", () => {
    expect(usableAltText("ptec_certificate_(21-11-2024)")).toBe("");
    expect(usableAltText("ptec_certificate_21-11-2024")).toBe("");
    expect(usableAltText("scan_[final]_v2")).toBe("");
  });

  it("rejects filenames by extension and by separator convention", () => {
    for (const value of [
      "IMG_4570.JPG",
      "certificate.pdf",
      "cover_seq",
      "krusmart-1",
      "Certificate_at_techno",
    ]) {
      expect(usableAltText(value), value).toBe("");
    }
  });

  /*
   * The counter-cases that stop this guard becoming its own accessibility bug.
   * Khmer is written without spaces between words, so any rule resting on
   * "prose contains whitespace" would blank essentially every Khmer alt string
   * on the site — a far worse regression than the one being fixed.
   */
  it("never blanks non-ASCII prose, which is how Khmer alt text survives", () => {
    const khmer = "លោករុនរស្មីកំពុងបង្ហាញសកម្មភាពគណិតវិទ្យា";
    expect(usableAltText(khmer)).toBe(khmer);
  });

  it("keeps human prose, including bracketed prose", () => {
    for (const value of [
      "Redacted public preview of the Action Research completion certificate",
      "Report (final)",
      "Grade 12 Completion Letter of Commendation",
    ]) {
      expect(usableAltText(value), value).toBe(value);
    }
  });

  it("treats blank and missing values as absent rather than throwing", () => {
    expect(usableAltText(null)).toBe("");
    expect(usableAltText(undefined)).toBe("");
    expect(usableAltText("   ")).toBe("");
  });
});

/**
 * The public document description is the text alternative to the redacted
 * preview, so it is the one field most likely to be written by transcribing the
 * original document — which is exactly how the live site came to publish a date
 * of birth and a gender on two school certificates.
 *
 * `describesSafely` is the check that refuses that shape at publication time.
 * The fixtures below mirror the real leaked sentences structurally; the actual
 * personal values are replaced.
 */
describe("public document description — sensitive-shape detection", () => {
  it("rejects a description that states gender and date of birth", async () => {
    const { describesSafely } = await import("@/lib/validation/certificate");

    const leaked =
      "Provisional Upper Secondary Education Certificate issued to A Person " +
      "(male, born January 1, 2000). Overall Grade: A (Score: 11.111).";

    const result = describesSafely(leaked);
    expect(result.safe).toBe(false);
    expect(result.reasons).toContain("gender");
    expect(result.reasons).toContain("dateOfBirth");
    expect(result.reasons).toContain("exactScore");
  });

  it("rejects candidate, registration and examination identifiers", async () => {
    const { describesSafely } = await import("@/lib/validation/certificate");

    expect(describesSafely("Candidate number 12345.").reasons).toContain(
      "identifier",
    );
    expect(describesSafely("Registration No. 998877").reasons).toContain(
      "identifier",
    );
    // A long bare digit run is an examination number whatever it is called.
    expect(describesSafely("Serial 012345678901234567890").reasons).toContain(
      "identifier",
    );
  });

  it("accepts the safe rewrite of the same credential", async () => {
    const { describesSafely } = await import("@/lib/validation/certificate");

    const safe =
      "A redacted Upper Secondary Education Certificate confirming completion " +
      "of the Science-track Bac II examination with an overall Grade A. " +
      "Personal identifiers have been removed from the public preview.";

    expect(describesSafely(safe)).toEqual({ safe: true, reasons: [] });
  });

  it("does not flag an ordinary issue date", async () => {
    const { describesSafely } = await import("@/lib/validation/certificate");

    // "Issued on 12 July 2026" is a date, but not a *birth* date. Flagging every
    // date would make the guard unusable and train the owner to override it.
    expect(describesSafely("Issued on 12 July 2026 by the Ministry.").safe).toBe(
      true,
    );
  });

  it("treats an empty description as safe rather than as a violation", async () => {
    const { describesSafely } = await import("@/lib/validation/certificate");
    expect(describesSafely(null).safe).toBe(true);
    expect(describesSafely("").safe).toBe(true);
  });
});

/**
 * The guard has to be wired into the gate, not merely exist. A pure function
 * nobody calls is the most common way a privacy check fails to prevent anything.
 */
describe("publish gate — the description guard is actually enforced", () => {
  async function blockersFor(imageSummary: string) {
    const { certificatePublishBlockers } = await import(
      "@/lib/validation/certificate"
    );

    return certificatePublishBlockers({
      slug: "a-credential",
      status: "published",
      issuer_en: "An Issuer",
      issued_on: "2024-01-01",
      preview_media_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      privacy_review_confirmed: true,
      contains_sensitive_data: false,
      allow_public_download: false,
      needs_review: false,
      translations: [
        { locale: "en", title: "A credential", image_summary: imageSummary },
      ],
    } as unknown as Parameters<typeof certificatePublishBlockers>[0]);
  }

  it("refuses to publish a description containing a date of birth", async () => {
    const blockers = await blockersFor(
      "Certificate issued to A Person (male, born January 1, 2000).",
    );

    expect(blockers).toContain("description_dateOfBirth");
    expect(blockers).toContain("description_gender");
  });

  it("permits the safe rewrite", async () => {
    const blockers = await blockersFor(
      "A redacted certificate confirming completion of the Science-track examination with an overall Grade A.",
    );

    expect(blockers).toEqual([]);
  });
});
