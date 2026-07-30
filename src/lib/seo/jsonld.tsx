import { absoluteUrl } from "@/lib/supabase/env";
import { localePath, type Locale } from "@/i18n/config";

/**
 * JSON-LD structured data.
 *
 * Rules applied throughout:
 *  - Only properties defined by schema.org for the type in question. No invented
 *    keys, which would simply be ignored — or flagged as an error.
 *  - Nullable inputs are dropped rather than emitted as null or as a guess. An
 *    absent `award` is better than an unverifiable one.
 *  - Stable `@id` values so the graph nodes on different pages refer to the same
 *    Person rather than describing a new one each time.
 */

type JsonValue = string | number | boolean | JsonObject | JsonValue[] | null;
type JsonObject = { [key: string]: JsonValue | undefined };

/**
 * Recursively strip undefined, null and empty values.
 *
 * Exported and applied inside each builder rather than only at render time, so a
 * builder's return value is already the final shape. That matters because
 * `graph([...])` output is inspected by tests and composed by callers — a node
 * carrying `jobTitle: undefined` would be misleading even though it serialises away.
 */
export function prune<T extends JsonObject>(input: T): JsonObject {
  const output: JsonObject = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;

    if (Array.isArray(value)) {
      const cleaned = value
        .map((item) =>
          typeof item === "object" && item !== null && !Array.isArray(item)
            ? prune(item as JsonObject)
            : item,
        )
        .filter(
          (item) =>
            item !== undefined &&
            item !== null &&
            !(typeof item === "object" && Object.keys(item).length === 0),
        );
      if (cleaned.length > 0) output[key] = cleaned as JsonValue[];
      continue;
    }

    if (typeof value === "object") {
      const cleaned = prune(value as JsonObject);
      if (Object.keys(cleaned).length > 0) output[key] = cleaned;
      continue;
    }

    output[key] = value;
  }

  return output;
}

/**
 * Renders a JSON-LD script tag.
 *
 * `JSON.stringify` output is escaped for `</script>` sequences. The data comes
 * from our own database, but escaping here means a CMS field containing markup
 * cannot break out of the script element regardless.
 */
export function JsonLd({ data }: { data: JsonObject | JsonObject[] }) {
  const payload = JSON.stringify(Array.isArray(data) ? data.map(prune) : prune(data))
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return (
    <script
      type="application/ld+json"
      /*
       * eslint react/no-danger is disabled here deliberately.
       *
       * A `application/ld+json` block has no other way to be emitted: React
       * escapes text children as HTML entities, which produces invalid JSON-LD
       * that crawlers reject. `payload` is `JSON.stringify` output with `<`, `>`
       * and `&` additionally escaped to \\uXXXX above, so no CMS field can close
       * the script element or introduce markup.
       */
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: payload }}
    />
  );
}

// ── Stable node ids ─────────────────────────────────────────────────────────

export const personId = () => `${absoluteUrl("/")}#person`;
export const websiteId = () => `${absoluteUrl("/")}#website`;

// ── Person ──────────────────────────────────────────────────────────────────

export function personSchema({
  name,
  headline,
  description,
  location,
  imageUrl,
  email,
  sameAs,
  knowsLanguage,
  alumniOf,
  locale,
}: {
  name: string;
  headline?: string | null;
  description?: string | null;
  location?: string | null;
  imageUrl?: string | null;
  email?: string | null;
  sameAs?: string[];
  knowsLanguage?: string[];
  alumniOf?: Array<{ name: string; url?: string | null }>;
  locale: Locale;
}): JsonObject {
  return prune({
    "@type": "Person",
    "@id": personId(),
    name,
    url: absoluteUrl(localePath(locale)),
    jobTitle: headline ?? undefined,
    description: description ?? undefined,
    image: imageUrl ?? undefined,
    // `email` is only emitted when the CMS has it as a deliberately public value.
    email: email ? `mailto:${email}` : undefined,
    address: location
      ? { "@type": "PostalAddress", addressLocality: location }
      : undefined,
    sameAs: sameAs && sameAs.length > 0 ? sameAs : undefined,
    knowsLanguage:
      knowsLanguage && knowsLanguage.length > 0 ? knowsLanguage : undefined,
    alumniOf:
      alumniOf && alumniOf.length > 0
        ? alumniOf.map((org) => ({
            "@type": "EducationalOrganization",
            name: org.name,
            url: org.url ?? undefined,
          }))
        : undefined,
  });
}

// ── WebSite ─────────────────────────────────────────────────────────────────

export function websiteSchema({
  name,
  description,
  locale,
}: {
  name: string;
  description?: string | null;
  locale: Locale;
}): JsonObject {
  return prune({
    "@type": "WebSite",
    "@id": websiteId(),
    name,
    description: description ?? undefined,
    url: absoluteUrl(localePath(locale)),
    inLanguage: locale,
    publisher: { "@id": personId() },
    // No SearchAction: there is no site-wide search endpoint, and declaring one
    // that does not exist is exactly the sort of unsupported claim to avoid.
  });
}

// ── ProfilePage ─────────────────────────────────────────────────────────────

export function profilePageSchema({
  locale,
  path = "",
  name,
  description,
  dateModified,
}: {
  locale: Locale;
  path?: string;
  name: string;
  description?: string | null;
  dateModified?: string | null;
}): JsonObject {
  return prune({
    "@type": "ProfilePage",
    "@id": `${absoluteUrl(localePath(locale, path))}#profilepage`,
    url: absoluteUrl(localePath(locale, path)),
    name,
    description: description ?? undefined,
    inLanguage: locale,
    dateModified: dateModified ?? undefined,
    mainEntity: { "@id": personId() },
    isPartOf: { "@id": websiteId() },
  });
}

// ── Project ─────────────────────────────────────────────────────────────────

/**
 * A deployed web application is a `SoftwareApplication`; anything else is a
 * `CreativeWork`. `applicationCategory` is only emitted for the former, because
 * it is not a valid property of `CreativeWork`.
 */
export function projectSchema({
  locale,
  slug,
  title,
  description,
  imageUrl,
  liveUrl,
  repositoryUrl,
  datePublished,
  dateModified,
  technologies,
  organizationName,
  isSoftware,
}: {
  locale: Locale;
  slug: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  liveUrl?: string | null;
  repositoryUrl?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  technologies?: string[];
  organizationName?: string | null;
  isSoftware: boolean;
}): JsonObject {
  const url = absoluteUrl(localePath(locale, `projects/${slug}`));

  const base: JsonObject = {
    "@type": isSoftware ? "SoftwareApplication" : "CreativeWork",
    "@id": `${url}#work`,
    name: title,
    description: description ?? undefined,
    url,
    image: imageUrl ?? undefined,
    inLanguage: locale,
    datePublished: datePublished ?? undefined,
    dateModified: dateModified ?? undefined,
    creator: { "@id": personId() },
    author: { "@id": personId() },
    isPartOf: { "@id": websiteId() },
    sameAs: [liveUrl, repositoryUrl].filter((value): value is string => Boolean(value)),
    keywords:
      technologies && technologies.length > 0 ? technologies.join(", ") : undefined,
    publisher: organizationName
      ? { "@type": "Organization", name: organizationName }
      : undefined,
  };

  if (isSoftware) {
    base.applicationCategory = "WebApplication";
    base.operatingSystem = "Web browser";
    // `installUrl` is the canonical way to point at a hosted web app.
    base.installUrl = liveUrl ?? undefined;
  }

  return prune(base);
}

// ── Credential ──────────────────────────────────────────────────────────────

export function credentialSchema({
  locale,
  slug,
  title,
  description,
  issuerName,
  issuerUrl,
  issuedOn,
  expiresOn,
  credentialId,
  imageUrl,
  categoryName,
}: {
  locale: Locale;
  slug: string;
  title: string;
  description?: string | null;
  issuerName: string;
  issuerUrl?: string | null;
  issuedOn?: string | null;
  expiresOn?: string | null;
  credentialId?: string | null;
  imageUrl?: string | null;
  categoryName?: string | null;
}): JsonObject {
  const url = absoluteUrl(localePath(locale, `certificates/${slug}`));

  return prune({
    "@type": "EducationalOccupationalCredential",
    "@id": `${url}#credential`,
    name: title,
    description: description ?? undefined,
    url,
    image: imageUrl ?? undefined,
    inLanguage: locale,
    credentialCategory: categoryName ?? undefined,
    identifier: credentialId ?? undefined,
    dateCreated: issuedOn ?? undefined,
    expires: expiresOn ?? undefined,
    recognizedBy: {
      "@type": "Organization",
      name: issuerName,
      url: issuerUrl ?? undefined,
    },
    about: { "@id": personId() },
  });
}

// ── BreadcrumbList ──────────────────────────────────────────────────────────

export function breadcrumbSchema(
  items: ReadonlyArray<{ name: string; url: string }>,
): JsonObject {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ── ItemList, for the listing pages ─────────────────────────────────────────

export function itemListSchema({
  name,
  items,
}: {
  name: string;
  items: ReadonlyArray<{ name: string; url: string }>;
}): JsonObject {
  return {
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

/** Wrap nodes in a single `@graph`, which is one script tag instead of many. */
export function graph(nodes: JsonObject[]): JsonObject {
  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
}
