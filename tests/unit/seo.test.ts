import { describe, expect, it } from "vitest";

import { absoluteUrl, siteUrl } from "@/lib/supabase/env";
import {
  breadcrumbSchema,
  credentialSchema,
  graph,
  itemListSchema,
  personSchema,
  projectSchema as projectJsonLd,
  websiteSchema,
} from "@/lib/seo/jsonld";
import { buildPageMetadata, truncateDescription } from "@/lib/seo/metadata";

/**
 * SEO tests.
 *
 * These pin the three concrete defects the audit found in v1:
 *  1. A canonical URL pointing at a host the site was not served from.
 *  2. A relative `og:image`, which meant no social preview image at all.
 *  3. No alternate-language URLs, so the Khmer content was invisible.
 */

describe("URL helpers", () => {
  it("uses the configured site origin with no trailing slash", () => {
    expect(siteUrl()).toBe("https://portfolio.test");
  });

  it("builds absolute URLs", () => {
    expect(absoluteUrl("/en/projects")).toBe("https://portfolio.test/en/projects");
    // A path without a leading slash still produces a valid URL.
    expect(absoluteUrl("en")).toBe("https://portfolio.test/en");
    expect(absoluteUrl("/")).toBe("https://portfolio.test/");
  });
});

describe("buildPageMetadata", () => {
  it("derives the canonical from the configured origin, not a hardcoded host", () => {
    const metadata = buildPageMetadata({
      locale: "en",
      path: "projects",
      title: "Projects",
    });

    expect(metadata.alternates?.canonical).toBe("https://portfolio.test/en/projects");
  });

  it("emits hreflang for every locale plus x-default", () => {
    const metadata = buildPageMetadata({ locale: "km", path: "about", title: "About" });
    const languages = metadata.alternates?.languages as Record<string, string>;

    expect(languages.en).toBe("https://portfolio.test/en/about");
    expect(languages.km).toBe("https://portfolio.test/km/about");
    // x-default tells search engines what to serve when no language matches.
    expect(languages["x-default"]).toBe("https://portfolio.test/en/about");
  });

  it("makes the Open Graph image absolute", () => {
    const metadata = buildPageMetadata({ locale: "en", title: "Home" });
    const images = metadata.openGraph?.images as Array<{ url: string }>;

    expect(images[0]?.url.startsWith("https://")).toBe(true);
  });

  it("does not assert image dimensions it does not know", () => {
    // Declaring 1200x630 for an arbitrary image makes platforms crop it wrongly.
    const metadata = buildPageMetadata({ locale: "en", title: "Home" });
    const images = metadata.openGraph?.images as Array<Record<string, unknown>>;

    expect(images[0]).not.toHaveProperty("width");
    expect(images[0]).not.toHaveProperty("height");
  });

  it("suffixes the site name once, and not twice", () => {
    expect(buildPageMetadata({ locale: "en", title: "Projects" }).title).toBe(
      "Projects · Ron Raksmey",
    );

    // Already contains the name, so it is left alone.
    expect(
      buildPageMetadata({ locale: "en", title: "Ron Raksmey — Educator" }).title,
    ).toBe("Ron Raksmey — Educator");
  });

  it("uses the Khmer site name on Khmer pages", () => {
    expect(buildPageMetadata({ locale: "km", title: "គម្រោង" }).title).toBe(
      "គម្រោង · រុន រស្មី",
    );
  });

  it("sets the correct Open Graph locale and alternate", () => {
    const metadata = buildPageMetadata({ locale: "km", title: "គម្រោង" });
    expect(metadata.openGraph?.locale).toBe("km_KH");
    expect(metadata.openGraph?.alternateLocale).toEqual(["en_GB"]);
  });

  it("emits noindex when asked", () => {
    const metadata = buildPageMetadata({ locale: "en", title: "Draft", noIndex: true });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("allows indexing by default with a large image preview", () => {
    const metadata = buildPageMetadata({ locale: "en", title: "Home" });
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it("honours a canonical override", () => {
    const metadata = buildPageMetadata({
      locale: "en",
      title: "Home",
      canonicalOverride: "https://example.test/custom",
    });
    expect(metadata.alternates?.canonical).toBe("https://example.test/custom");
  });

  it("adds article timestamps only for the article type", () => {
    const article = buildPageMetadata({
      locale: "en",
      title: "Case study",
      type: "article",
      publishedTime: "2026-01-01T00:00:00Z",
      modifiedTime: "2026-02-01T00:00:00Z",
    });
    expect(article.openGraph).toHaveProperty("publishedTime");

    const website = buildPageMetadata({
      locale: "en",
      title: "Home",
      publishedTime: "2026-01-01T00:00:00Z",
    });
    expect(website.openGraph).not.toHaveProperty("publishedTime");
  });
});

describe("truncateDescription", () => {
  it("leaves a short description untouched", () => {
    expect(truncateDescription("Short enough.", "en")).toBe("Short enough.");
  });

  it("truncates English on a word boundary", () => {
    const result = truncateDescription("word ".repeat(60), "en", 50);
    expect(result!.length).toBeLessThanOrEqual(50);
    expect(result!.endsWith("…")).toBe(true);
    // Not cut mid-word.
    expect(result).not.toMatch(/wor…$/);
  });

  it("truncates Khmer at the character limit, since Khmer has no word spaces", () => {
    const khmer = "ក".repeat(300);
    const result = truncateDescription(khmer, "km", 100);
    expect(result!.length).toBeLessThanOrEqual(100);
    expect(result!.endsWith("…")).toBe(true);
  });

  it("collapses whitespace", () => {
    expect(truncateDescription("a\n\n  b\tc", "en")).toBe("a b c");
  });

  it("returns undefined for empty input", () => {
    expect(truncateDescription(null, "en")).toBeUndefined();
    expect(truncateDescription(undefined, "en")).toBeUndefined();
  });
});

describe("JSON-LD", () => {
  it("drops null, undefined and empty values rather than emitting them", () => {
    const person = personSchema({
      locale: "en",
      name: "Ron Raksmey",
      headline: null,
      description: "",
      location: undefined,
      imageUrl: null,
      email: null,
      sameAs: [],
      knowsLanguage: [],
      alumniOf: [],
    });

    // An absent property is valid; a null one is an error in structured data.
    expect(person).not.toHaveProperty("jobTitle");
    expect(person).not.toHaveProperty("description");
    expect(person).not.toHaveProperty("address");
    expect(person).not.toHaveProperty("sameAs");
    expect(person).not.toHaveProperty("email");
    expect(person["@type"]).toBe("Person");
  });

  it("keeps the values that are present", () => {
    const person = personSchema({
      locale: "en",
      name: "Ron Raksmey",
      headline: "Educator",
      location: "Phnom Penh, Cambodia",
      email: "x@example.com",
      sameAs: ["https://t.me/example"],
      knowsLanguage: ["km", "en"],
      alumniOf: [{ name: "PTEC", url: "https://www.ptec.edu.kh/home/" }],
    });

    expect(person.jobTitle).toBe("Educator");
    expect(person.email).toBe("mailto:x@example.com");
    expect(person.knowsLanguage).toEqual(["km", "en"]);
    expect(person.address).toMatchObject({ addressLocality: "Phnom Penh, Cambodia" });
  });

  it("uses stable @id values so nodes on different pages refer to one Person", () => {
    const a = personSchema({ locale: "en", name: "Ron Raksmey" });
    const b = personSchema({ locale: "km", name: "រុន រស្មី" });
    expect(a["@id"]).toBe(b["@id"]);
  });

  it("describes a deployed web app as SoftwareApplication and others as CreativeWork", () => {
    const software = projectJsonLd({
      locale: "en",
      slug: "krusmart",
      title: "KruSmart",
      liveUrl: "https://www.krusmart.org/",
      isSoftware: true,
    });
    expect(software["@type"]).toBe("SoftwareApplication");
    expect(software.applicationCategory).toBe("WebApplication");

    const creative = projectJsonLd({
      locale: "en",
      slug: "essay",
      title: "An essay",
      isSoftware: false,
    });
    expect(creative["@type"]).toBe("CreativeWork");
    // applicationCategory is not a valid CreativeWork property.
    expect(creative).not.toHaveProperty("applicationCategory");
  });

  it("emits a valid credential node", () => {
    const credential = credentialSchema({
      locale: "en",
      slug: "bacii",
      title: "BacII Certificate",
      issuerName: "Ministry of Education, Youth and Sport",
      issuedOn: "2023-09-01",
      categoryName: "BacII Certificate",
    });

    expect(credential["@type"]).toBe("EducationalOccupationalCredential");
    expect(credential.recognizedBy).toMatchObject({ "@type": "Organization" });
    expect(credential.credentialCategory).toBe("BacII Certificate");
  });

  it("numbers breadcrumb positions from one", () => {
    const crumbs = breadcrumbSchema([
      { name: "Home", url: "https://portfolio.test/en" },
      { name: "Projects", url: "https://portfolio.test/en/projects" },
    ]);

    const items = crumbs.itemListElement as Array<{ position: number; name: string }>;
    expect(items[0]?.position).toBe(1);
    expect(items[1]?.position).toBe(2);
  });

  it("reports the real item count in an ItemList", () => {
    const list = itemListSchema({
      name: "Projects",
      items: [
        { name: "A", url: "https://portfolio.test/en/projects/a" },
        { name: "B", url: "https://portfolio.test/en/projects/b" },
      ],
    });
    expect(list.numberOfItems).toBe(2);
  });

  it("does not declare a SearchAction, because no search endpoint exists", () => {
    const site = websiteSchema({ locale: "en", name: "Ron Raksmey" });
    expect(site).not.toHaveProperty("potentialAction");
  });

  it("wraps nodes in a single @graph with a context", () => {
    const result = graph([
      personSchema({ locale: "en", name: "Ron Raksmey" }),
      websiteSchema({ locale: "en", name: "Ron Raksmey" }),
    ]);

    expect(result["@context"]).toBe("https://schema.org");
    expect(Array.isArray(result["@graph"])).toBe(true);
    expect((result["@graph"] as unknown[]).length).toBe(2);
  });
});
