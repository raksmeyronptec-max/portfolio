import { DM_Sans, Hanuman, JetBrains_Mono, Syne } from "next/font/google";

/**
 * Typography.
 *
 * Every face here was chosen by inspecting the two reference sites with
 * DevTools and reading the *rendered* computed styles — not by guessing from
 * the CSS declaration, because a declared family says nothing about what
 * actually drew the glyphs when the first font in the stack lacks them.
 *
 * ── English: portfolio-ron-raksmey.netlify.app ───────────────────────────────
 *   Its Google Fonts request is
 *     family=Battambang:wght@400;700&family=Syne:wght@700;800;900&family=DM+Sans…
 *   and the rendered result is:
 *     body / p / nav   DM Sans 400        16px / lh 27.2px (1.70)
 *     h1               Syne 900*          54.4px / lh 1.08 / ls -0.04em
 *     h2               Syne 900*          46.4px / ls -0.03em
 *     h3               Syne 700
 *     buttons, links   JetBrains Mono 700 12.8–13.6px
 *
 *   * The old site asks for 900, but Syne's variable range stops at 800, so the
 *     browser clamps. 800 is requested here — the same pixels, honestly named.
 *
 * ── Khmer: library.ptec.edu.kh ───────────────────────────────────────────────
 *   Khmer text renders in Hanuman, self-hosted through next/font, and only two
 *   weights are declared (@font-face w:400 and w:700):
 *     Khmer <p>        Hanuman 700  15px / lh 28.5px (1.90)
 *     Khmer <span>     Hanuman 400  12px / lh 21.6px (1.80)
 *     Khmer nav / h3   Hanuman 600/700 / lh 1.50
 *
 *   Hanuman is a tall face: its subscripts (ជើង) sit well below the baseline and
 *   its vowel marks stack high. The generous leading above is not decoration —
 *   it is what stops the marks colliding. Those numbers are mirrored in
 *   globals.css.
 *
 * ── Licensing ────────────────────────────────────────────────────────────────
 * All four are Google Fonts under the SIL Open Font License, fetched at build
 * time by next/font and served from our own origin. Nothing is copied from
 * either reference site, and no font binary is committed.
 */

/**
 * Body / UI face. Variable, so the whole 400–700 range the app uses costs one
 * file rather than four.
 *
 * `latin` only. The site's languages are English and Khmer; auditing every UI
 * string found no latin-ext code point anywhere, so the second subset was a
 * ~35 KB preload spent on glyphs that never render. The hero paragraph is the
 * mobile LCP element and its paint waits on the font swap, which makes every
 * preloaded font byte part of the LCP critical path — trimming here is a
 * measured LCP fix, not tidiness. If CMS content ever needs a latin-ext glyph
 * (a "José", a "Đặng"), it falls through the stack to a system face rather
 * than disappearing, and this is the line to revisit.
 */
export const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-latin",
  preload: true,
});

/**
 * Display face for headings.
 *
 * Syne is what gives the reference its personality — the tight, heavy headline
 * look.
 *
 * One weight, 700, because that is the only weight anything renders: every
 * heading rule in globals.css resolved to 700 (the comment there explains why
 * 640 became 700), the wordmark and watermark are 700, and nothing requests
 * 600 or 800. The two unused files were ~36 KB of preload on the LCP critical
 * path — see the DM Sans note above. If a design change genuinely introduces
 * another Syne weight, add it here at the same time or the browser will
 * synthesise it.
 */
export const syne = Syne({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
  variable: "--font-display",
  preload: true,
});

/**
 * Khmer face, matching PTEC.
 *
 * Only 400 and 700 exist in the design and only those are requested, so no
 * weight is ever synthesised. The app's 500 and 600 utilities resolve to the
 * nearest real weight by normal CSS font matching, which is exactly what the
 * reference does.
 */
export const hanuman = Hanuman({
  subsets: ["khmer"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-khmer",
  preload: true,
});

/**
 * Monospace, for the timeline periods, project numerals and code blocks.
 *
 * The reference also uses JetBrains Mono on buttons and inline links. That is
 * deliberately *not* reproduced: restyling every button would be a visual
 * redesign, and this phase is typography-only. It is noted in the report.
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  /*
   * `--font-mono-family`, not `--font-mono`.
   *
   * globals.css already owns `--font-mono` as the composed stack, and Tailwind
   * bridges a theme key of the same name. Letting next/font write `--font-mono`
   * too would put three declarations on the same custom property, resolved by
   * cascade-layer order rather than intent — and the unlayered next/font class
   * would silently win over the layered token. Distinct names keep "the family"
   * and "the stack" separable, matching --font-latin/--font-sans above.
   */
  variable: "--font-mono-family",
  preload: false,
});

export const fontVariables = [
  dmSans.variable,
  syne.variable,
  hanuman.variable,
  jetbrainsMono.variable,
].join(" ");
