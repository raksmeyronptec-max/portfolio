import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { DesktopNav } from "@/components/nav/desktop-nav";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { MobileNav } from "@/components/nav/mobile-nav";
import { primaryNav, secondaryNav } from "@/components/nav/nav-items";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { HeaderScrollSync } from "./header-shell";
import { getDictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";

/**
 * Site header.
 *
 * Mostly a Server Component: only the scroll chrome, the active-route
 * highlighting, the drawer, the theme and the language control are client
 * children, so the header's markup and copy still cost no client JavaScript.
 *
 * What changed from v2, all from the brief's "the desktop header is too
 * crowded":
 *   • The wordmark's second line (a long uppercase subtitle) is gone. It
 *     duplicated the hero's eyebrow two hundred pixels below itself.
 *   • The resume call to action is a small pill outline button, not a filled
 *     block. It is a secondary action everywhere except the resume page.
 *   • Language is a text pair and theme is a ghost icon — neither is boxed.
 *   • The bar is transparent over the hero and only gains a background once
 *     the visitor scrolls past it (see HeaderShell).
 */
export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const primary = primaryNav(locale, t);
  const secondary = secondaryNav(locale, t);
  const resumeHref = localePath(locale, "resume");

  const themeLabels = {
    toggle: t.a11y.toggleTheme,
    toLight: t.a11y.themeLight,
    toDark: t.a11y.themeDark,
  };

  return (
    /*
     * A plain server-rendered <header>. The scroll state is applied to these
     * same two attributes from an effect by HeaderScrollSync — see the note
     * there for why the element must not itself live in a client boundary.
     *
     * The initial values are the correct ones for a fresh page load: every page
     * loads at scroll 0, where the header floats over the dark opening band and
     * therefore needs the ink scope.
     */
    <header
      data-site-header
      data-print="hide"
      data-scrolled="false"
      data-scheme="ink"
      className="header-bar sticky top-0 z-40"
    >
      <HeaderScrollSync />

      <div
        className="container-content flex items-center justify-between gap-4"
        style={{ height: "var(--header-height)" }}
      >
        {/* ── Wordmark ───────────────────────────────────────────────────── */}
        <Link
          href={localePath(locale)}
          className="flex items-center gap-2.5 rounded-(--radius-sm)"
        >
          <Wordmark />
          <span className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-foreground">
            {t.meta.siteName}
          </span>
        </Link>

        {/* ── Primary navigation ─────────────────────────────────────────── */}
        <DesktopNav locale={locale} items={primary} label={t.a11y.mainNavigation} />

        {/* ── Utilities ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 lg:flex">
            <LanguageSwitcher
              currentLocale={locale}
              label={t.a11y.switchLanguage}
              variant="minimal"
            />

            <span aria-hidden="true" className="h-5 w-px bg-border" />

            <ThemeToggle labels={themeLabels} variant="ghost" />

            <ButtonLink
              href={resumeHref}
              variant="outline"
              size="sm"
              iconStart="download"
              className="ml-1 min-h-10 rounded-(--radius-full) px-4"
            >
              {t.nav.resume}
            </ButtonLink>
          </div>

          {/* Theme stays reachable on mobile without opening the drawer. */}
          <div className="lg:hidden">
            <ThemeToggle labels={themeLabels} variant="ghost" />
          </div>

          <MobileNav
            locale={locale}
            primary={primary}
            secondary={secondary}
            resumeHref={resumeHref}
            labels={{
              open: t.a11y.openMenu,
              close: t.a11y.closeMenu,
              title: t.a11y.mainNavigation,
              language: t.a11y.switchLanguage,
              downloadResume: t.nav.downloadResume,
            }}
          />
        </div>
      </div>
    </header>
  );
}

/**
 * Wordmark: a summation sign, carried over from v1's logo idea because it says
 * "mathematics" in one glyph.
 *
 * Redrawn on the new palette as a rounded tile with a primary→secondary
 * gradient, and marked decorative — the adjacent name is the accessible name.
 * The gradient id is namespaced so the header and footer wordmarks on one page
 * cannot collide.
 */
function Wordmark() {
  return (
    <svg
      viewBox="0 0 36 36"
      width={34}
      height={34}
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="wordmark-tile-header" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--secondary)" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="11" fill="url(#wordmark-tile-header)" />
      <path
        d="M23.5 10.5H13l6.2 7.5-6.2 7.5h10.5"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
