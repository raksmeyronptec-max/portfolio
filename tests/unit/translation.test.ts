import { describe, expect, it } from "vitest";

import {
  langAttribute,
  missingLocales,
  pickLocalized,
  pickExactLocale,
  resolveTranslation,
  translationStatus,
} from "@/lib/content/translation";

/**
 * Translation fallback is the behaviour most likely to produce a subtly wrong page:
 * an English paragraph announced to a screen reader as Khmer, or an empty page where
 * a fallback should have been used. These tests pin both halves.
 */

type Row = { locale: string; title: string };

describe("resolveTranslation", () => {
  const en: Row = { locale: "en", title: "English" };
  const km: Row = { locale: "km", title: "ខ្មែរ" };

  it("returns the exact locale when present", () => {
    const result = resolveTranslation([en, km], "km");
    expect(result.row).toBe(km);
    expect(result.actualLocale).toBe("km");
    expect(result.isFallback).toBe(false);
  });

  it("falls back to English and reports that it did", () => {
    const result = resolveTranslation([en], "km");
    expect(result.row).toBe(en);
    expect(result.actualLocale).toBe("en");
    // The caller needs this to set `lang` correctly on the rendered prose.
    expect(result.isFallback).toBe(true);
  });

  it("falls back to whatever exists when English is absent", () => {
    const result = resolveTranslation([km], "en");
    expect(result.row).toBe(km);
    expect(result.actualLocale).toBe("km");
    expect(result.isFallback).toBe(true);
  });

  it("returns null for an empty or missing set", () => {
    expect(resolveTranslation([], "en").row).toBeNull();
    expect(resolveTranslation(null, "en").row).toBeNull();
    expect(resolveTranslation(undefined, "en").actualLocale).toBeNull();
  });
});

describe("langAttribute", () => {
  it("omits the attribute when the content matches the page language", () => {
    expect(langAttribute("en", "en")).toBeUndefined();
    expect(langAttribute("km", "km")).toBeUndefined();
  });

  it("emits the attribute when the content is in a different language", () => {
    // This is what stops a screen reader reading English prose with Khmer phonetics.
    expect(langAttribute("km", "en")).toBe("en");
    expect(langAttribute("en", "km")).toBe("km");
  });

  it("omits the attribute when the content language is unknown", () => {
    expect(langAttribute("en", null)).toBeUndefined();
  });
});

describe("pickLocalized", () => {
  it("prefers the requested locale", () => {
    expect(pickLocalized("km", "English", "ខ្មែរ")).toBe("ខ្មែរ");
    expect(pickLocalized("en", "English", "ខ្មែរ")).toBe("English");
  });

  it("falls back to the other language when the preferred one is missing", () => {
    expect(pickLocalized("km", "English", null)).toBe("English");
    expect(pickLocalized("en", null, "ខ្មែរ")).toBe("ខ្មែរ");
  });

  it("treats whitespace-only values as missing", () => {
    // A field the editor blanked out should fall back, not render as empty.
    expect(pickLocalized("km", "English", "   ")).toBe("English");
    expect(pickLocalized("km", "  ", "  ")).toBeNull();
  });

  it("returns null when neither language has a value", () => {
    expect(pickLocalized("en", null, undefined)).toBeNull();
  });
});

describe("pickExactLocale", () => {
  it("never mixes personal prose across locales", () => {
    expect(pickExactLocale("km", "English biography", null)).toBeNull();
    expect(pickExactLocale("en", null, "ជីវប្រវត្តិ")).toBeNull();
    expect(pickExactLocale("km", "English biography", "ជីវប្រវត្តិ")).toBe(
      "ជីវប្រវត្តិ",
    );
  });

  it("treats blank requested prose as absent", () => {
    expect(pickExactLocale("km", "English biography", "   ")).toBeNull();
  });

  it("rejects prose saved in the wrong script even when the locale field is non-empty", () => {
    expect(pickExactLocale("km", "English biography", "English headline")).toBeNull();
    expect(pickExactLocale("en", "ជីវប្រវត្តិ", "ជីវប្រវត្តិ")).toBeNull();
  });
});

describe("translationStatus", () => {
  it("reports complete only when every locale is present", () => {
    expect(translationStatus([{ locale: "en" }, { locale: "km" }])).toBe("complete");
  });

  it("reports partial when one locale is missing", () => {
    expect(translationStatus([{ locale: "en" }])).toBe("partial");
    expect(translationStatus([{ locale: "km" }])).toBe("partial");
  });

  it("reports missing for no rows", () => {
    expect(translationStatus([])).toBe("missing");
    expect(translationStatus(null)).toBe("missing");
  });
});

describe("missingLocales", () => {
  it("names the absent locales so the admin can act on it", () => {
    expect(missingLocales([{ locale: "en" }])).toEqual(["km"]);
    expect(missingLocales([{ locale: "km" }])).toEqual(["en"]);
    expect(missingLocales([{ locale: "en" }, { locale: "km" }])).toEqual([]);
    expect(missingLocales([])).toEqual(["en", "km"]);
  });
});
