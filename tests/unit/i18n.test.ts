import { describe, expect, it } from "vitest";

import {
  isLocale,
  localePath,
  negotiateLocale,
  otherLocales,
  stripLocaleFromPath,
  switchLocaleInPath,
} from "@/i18n/config";
import {
  formatDuration,
  formatFileSize,
  getDictionary,
  interpolate,
  plural,
} from "@/i18n/dictionary";
import { en } from "@/i18n/messages/en";
import { km } from "@/i18n/messages/km";

describe("locale helpers", () => {
  it("recognises supported locales and rejects everything else", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("km")).toBe(true);
    // A plausible-looking locale must not be accepted; the routes 404 on it.
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("builds locale-prefixed paths without double slashes", () => {
    expect(localePath("en")).toBe("/en");
    expect(localePath("en", "")).toBe("/en");
    expect(localePath("km", "projects")).toBe("/km/projects");
    expect(localePath("km", "/projects/")).toBe("/km/projects");
    expect(localePath("en", "projects/krusmart")).toBe("/en/projects/krusmart");
  });

  it("swaps the locale segment while preserving the rest of the path", () => {
    expect(switchLocaleInPath("/en/projects/krusmart", "km")).toBe(
      "/km/projects/krusmart",
    );
    expect(switchLocaleInPath("/km", "en")).toBe("/en");
    expect(switchLocaleInPath("/", "km")).toBe("/km");
    // An unprefixed path gains a prefix rather than losing its first segment.
    expect(switchLocaleInPath("/projects", "en")).toBe("/en/projects");
  });

  it("strips the locale prefix", () => {
    expect(stripLocaleFromPath("/km/projects/krusmart")).toBe("projects/krusmart");
    expect(stripLocaleFromPath("/en")).toBe("");
    expect(stripLocaleFromPath("/projects")).toBe("projects");
  });

  it("lists the other locales", () => {
    expect(otherLocales("en")).toEqual(["km"]);
    expect(otherLocales("km")).toEqual(["en"]);
  });
});

describe("negotiateLocale", () => {
  it("falls back to English when no header is present", () => {
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("")).toBe("en");
  });

  it("picks Khmer when it is preferred", () => {
    expect(negotiateLocale("km,en;q=0.8")).toBe("km");
    expect(negotiateLocale("km-KH")).toBe("km");
  });

  it("respects quality values rather than header order", () => {
    // en has the higher q despite appearing second.
    expect(negotiateLocale("km;q=0.3,en;q=0.9")).toBe("en");
  });

  it("ignores unsupported languages", () => {
    expect(negotiateLocale("fr-FR,de;q=0.9")).toBe("en");
    // Khmer is still found further down the list.
    expect(negotiateLocale("fr-FR,km;q=0.5")).toBe("km");
  });

  it("does not crash on a malformed header", () => {
    expect(negotiateLocale(",,;q=")).toBe("en");
    expect(negotiateLocale("en;q=notanumber")).toBe("en");
  });
});

describe("dictionaries", () => {
  it("returns the requested catalogue", () => {
    expect(getDictionary("en").nav.projects).toBe("Projects");
    expect(getDictionary("km").nav.projects).toBe("គម្រោង");
  });

  /**
   * The real guarantee: km must have every key en has. The type system enforces this
   * at compile time, but this test also catches a key that exists with an empty
   * string — which would type-check yet render as nothing.
   */
  it("has no missing or empty Khmer translations", () => {
    const missing: string[] = [];

    function walk(a: unknown, b: unknown, path: string) {
      if (typeof a === "string") {
        if (typeof b !== "string" || b.trim() === "") missing.push(path);
        return;
      }

      if (a && typeof a === "object") {
        for (const key of Object.keys(a as Record<string, unknown>)) {
          walk(
            (a as Record<string, unknown>)[key],
            (b as Record<string, unknown> | undefined)?.[key],
            path ? `${path}.${key}` : key,
          );
        }
      }
    }

    walk(en, km, "");

    expect(missing).toEqual([]);
  });
});

describe("interpolate", () => {
  it("substitutes named placeholders", () => {
    expect(interpolate("Page {current} of {total}", { current: 2, total: 5 })).toBe(
      "Page 2 of 5",
    );
  });

  it("leaves an unknown placeholder in place rather than printing undefined", () => {
    // A visible `{missing}` during review is better than a silent "undefined".
    expect(interpolate("Hello {missing}", {})).toBe("Hello {missing}");
  });

  it("does not evaluate anything — it only substitutes", () => {
    const input = "{a}{b}";
    expect(interpolate(input, { a: "<script>", b: "alert(1)" })).toBe(
      "<script>alert(1)",
    );
    // The output is a plain string; escaping is React's job at render time.
    expect(typeof interpolate(input, { a: "x", b: "y" })).toBe("string");
  });

  it("handles repeated placeholders", () => {
    expect(interpolate("{x} and {x}", { x: "one" })).toBe("one and one");
  });
});

describe("plural", () => {
  it("selects the singular for exactly one", () => {
    expect(plural(1, "{count} project", "{count} projects")).toBe("1 project");
  });

  it("selects the plural for zero and many", () => {
    expect(plural(0, "{count} project", "{count} projects")).toBe("0 projects");
    expect(plural(7, "{count} project", "{count} projects")).toBe("7 projects");
  });
});

describe("formatters", () => {
  it("formats file sizes in readable units", () => {
    expect(formatFileSize(512, "en")).toBe("512 B");
    expect(formatFileSize(2048, "en")).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024, "en")).toBe("5 MB");
  });

  it("formats countdown durations", () => {
    expect(formatDuration(45, "en")).toBe("45s");
    expect(formatDuration(60, "en")).toBe("1m");
    expect(formatDuration(150, "en")).toBe("2m 30s");
    // A negative remaining time is clamped rather than rendered as "-3s".
    expect(formatDuration(-3, "en")).toBe("0s");
  });
});
