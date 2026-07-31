import { Inter, Noto_Sans_Khmer, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Fonts, shared by the public and admin root layouts.
 *
 * Both are self-hosted by next/font: the files are fetched at build time and
 * served from our own origin. Three wins over v1, which pulled four families and
 * eleven weights from Google's CDN in a single blocking request:
 *   • no third-party connection on the critical path
 *   • `font-src 'self'` suffices, so the CSP stays tight
 *   • `display: swap` means text paints immediately instead of going invisible
 *
 * Weight selection is deliberately narrow. Inter is variable, so it costs one
 * file for the whole range. Noto Sans Khmer is loaded in only the three weights
 * the design uses — Khmer fonts are large, and loading seven weights of one would
 * dwarf every other asset on the page.
 */

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-latin",
  preload: true,
});

/**
 * Display face, used for headings and the hero.
 *
 * Inter is an excellent UI face but a deliberately neutral one; at hero size it
 * reads as a system font rather than as somebody's portfolio. Plus Jakarta Sans
 * is geometric and slightly humanist, so it carries personality at 6rem while
 * still pairing cleanly with Inter for body copy. Variable, so the whole weight
 * range costs one file.
 */
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-display",
  preload: true,
});

export const notoSansKhmer = Noto_Sans_Khmer({
  subsets: ["khmer"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-khmer",
  // Khmer is a large subset; only preload it where it is the primary script.
  preload: true,
});

export const fontVariables = `${inter.variable} ${plusJakarta.variable} ${notoSansKhmer.variable}`;
