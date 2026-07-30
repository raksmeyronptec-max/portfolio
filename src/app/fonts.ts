import { Inter, Noto_Sans_Khmer } from "next/font/google";

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

export const notoSansKhmer = Noto_Sans_Khmer({
  subsets: ["khmer"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-khmer",
  // Khmer is a large subset; only preload it where it is the primary script.
  preload: true,
});

export const fontVariables = `${inter.variable} ${notoSansKhmer.variable}`;
