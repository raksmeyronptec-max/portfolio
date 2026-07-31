import "server-only";

import type { Metadata } from "next";

import { absoluteUrl, siteUrl } from "@/lib/supabase/env";
import { publicStorageUrl, type MediaAsset } from "@/lib/content/media";
import { localeMeta, localePath, locales, type Locale } from "@/i18n/config";

/**
 * Metadata construction.
 *
 * Fixes three concrete v1 defects:
 *  1. The canonical URL and `og:url` pointed at `ron-raksmey.vercel.app` while
 *     the site was served from Netlify. Everything here derives from one origin.
 *  2. `og:image` was a relative path, so social previews had no image. All image
 *     URLs are made absolute.
 *  3. There were no alternate-language URLs at all. Every page emits an
 *     `hreflang` pair plus `x-default`.
 */

/** Fallback social image: the existing portrait, kept from v1. */
const FALLBACK_OG_IMAGE = "/image/MyPF.jpg";

export type PageMetadataInput = {
  locale: Locale;
  /** Locale-relative path, e.g. "projects/krusmart". Empty string for home. */
  path?: string;
  title: string;
  description?: string | null;
  /** Overrides the derived canonical. Only for genuinely duplicated content. */
  canonicalOverride?: string | null;
  ogImage?: MediaAsset | null;
  ogImageUrl?: string | null;
  /** "website" for listings, "article" for a case study. */
  type?: "website" | "article" | "profile";
  publishedTime?: string | null;
  modifiedTime?: string | null;
  noIndex?: boolean;
  /** Appended as "· Ron Raksmey" unless the title already ends with it. */
  suffixSiteName?: boolean;
};

export function buildPageMetadata({
  locale,
  path = "",
  title,
  description,
  canonicalOverride,
  ogImage,
  ogImageUrl,
  type = "website",
  publishedTime,
  modifiedTime,
  noIndex = false,
  suffixSiteName = true,
}: PageMetadataInput): Metadata {
  const siteName = locale === "km" ? "រុន រស្មី" : "Ron Raksmey";

  const fullTitle =
    suffixSiteName && !title.includes(siteName) ? `${title} · ${siteName}` : title;

  const canonical = canonicalOverride ?? absoluteUrl(localePath(locale, path));

  // hreflang for every locale plus x-default, which tells search engines what to
  // serve when no language matches.
  const languages: Record<string, string> = {};
  for (const alternateLocale of locales) {
    languages[localeMeta[alternateLocale].tag] = absoluteUrl(
      localePath(alternateLocale, path),
    );
  }
  languages["x-default"] = absoluteUrl(localePath("en", path));

  const imageUrl =
    ogImageUrl ?? resolveOgImageUrl(ogImage) ?? absoluteUrl(FALLBACK_OG_IMAGE);

  /*
   * Dimensions are declared only when they are actually known — i.e. when the
   * image is a CMS asset that recorded its width and height on upload. Asserting
   * 1200×630 for an arbitrary image (as is commonly copy-pasted) makes social
   * platforms letterbox or crop it wrongly, so an unknown size is left unstated
   * and the platform detects it.
   */
  const knownDimensions =
    ogImage && ogImage.visibility === "public" && ogImage.width && ogImage.height
      ? { width: ogImage.width, height: ogImage.height }
      : null;

  const trimmedDescription = description?.trim() || undefined;

  return {
    title: fullTitle,
    description: trimmedDescription,
    alternates: { canonical, languages },
    robots: noIndex
      ? { index: false, follow: false, nocache: true }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, "max-image-preview": "large" },
        },
    openGraph: {
      type: type === "profile" ? "profile" : type,
      title: fullTitle,
      description: trimmedDescription,
      url: canonical,
      siteName,
      locale: locale === "km" ? "km_KH" : "en_GB",
      alternateLocale: locales
        .filter((l) => l !== locale)
        .map((l) => (l === "km" ? "km_KH" : "en_GB")),
      images: [{ url: imageUrl, alt: fullTitle, ...(knownDimensions ?? {}) }],
      ...(type === "article" && publishedTime
        ? { publishedTime, modifiedTime: modifiedTime ?? publishedTime }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: trimmedDescription,
      images: [imageUrl],
    },
  };
}

/** Absolute URL for a media asset used as a social image, or null. */
function resolveOgImageUrl(asset: MediaAsset | null | undefined): string | null {
  if (!asset || asset.visibility !== "public") return null;
  return publicStorageUrl(
    asset.bucket_id,
    asset.preview_path ?? asset.storage_path,
    asset.storage_provider,
  );
}

/**
 * Trim a description to the length search engines actually display.
 *
 * Breaks on a word boundary rather than mid-word. Khmer does not use spaces
 * between words, so for Khmer the string is cut at the limit and an ellipsis is
 * appended — breaking on a space would either do nothing or cut in the wrong
 * place entirely.
 */
export function truncateDescription(
  text: string | null | undefined,
  locale: Locale,
  max = 155,
): string | undefined {
  if (!text) return undefined;

  const normalised = text.replace(/\s+/g, " ").trim();
  if (normalised.length <= max) return normalised;

  if (locale === "km") {
    return `${normalised.slice(0, max - 1).trimEnd()}…`;
  }

  const cut = normalised.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Root metadata shared by every page. */
export function buildRootMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    applicationName: "Ron Raksmey",
    authors: [{ name: "Ron Raksmey" }],
    creator: "Ron Raksmey",
    publisher: "Ron Raksmey",
    formatDetection: { telephone: false, email: false, address: false },
    icons: {
      icon: [{ url: "/image/MyPF.jpg", type: "image/jpeg" }],
      apple: [{ url: "/image/MyPF.jpg" }],
    },
    referrer: "strict-origin-when-cross-origin",
  };
}
