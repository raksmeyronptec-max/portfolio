import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { DesktopNav } from "@/components/nav/desktop-nav";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { MobileNav } from "@/components/nav/mobile-nav";
import { primaryNav, secondaryNav } from "@/components/nav/nav-items";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getDictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";

/**
 * Site header.
 *
 * A Server Component: the interactive bits (active-route highlighting, drawer,
 * theme, language) are isolated in small client children, so the header's markup
 * and copy cost no client JavaScript.
 *
 * Sticky, but only 4rem tall and with `scroll-padding-top` set in globals.css, so
 * it never covers the heading of an anchored section — the audit flagged that as
 * a risk in v1.
 */
export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const primary = primaryNav(locale, t);
  const secondary = secondaryNav(locale, t);
  const resumeHref = localePath(locale, "resume");

  return (
    <header
      data-site-header
      data-print="hide"
      className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm"
      style={{ minHeight: "var(--header-height)" }}
    >
      <div className="container-content flex h-16 items-center justify-between gap-3">
        {/* ── Wordmark ─────────────────────────────────────────────────── */}
        <Link
          href={localePath(locale)}
          className="flex items-center gap-2.5 rounded-[--radius-sm] py-1"
        >
          <Wordmark />
          <span className="flex flex-col leading-tight">
            <span className="text-[0.9375rem] font-semibold text-foreground">
              {t.meta.siteName}
            </span>
            <span className="hidden text-[0.6875rem] uppercase tracking-[0.08em] text-foreground-subtle sm:block">
              {t.home.hero.eyebrow}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <DesktopNav locale={locale} items={primary} label={t.a11y.mainNavigation} />

          <div className="hidden items-center gap-2 lg:flex">
            <LanguageSwitcher
              currentLocale={locale}
              label={t.a11y.switchLanguage}
            />
            <ThemeToggle
              labels={{
                toggle: t.a11y.toggleTheme,
                toLight: t.a11y.themeLight,
                toDark: t.a11y.themeDark,
              }}
            />
            <ButtonLink
              href={resumeHref}
              variant="primary"
              size="sm"
              iconStart="download"
              className="min-h-10"
            >
              {t.nav.downloadResume}
            </ButtonLink>
          </div>

          {/* Theme stays reachable on mobile without opening the drawer. */}
          <div className="lg:hidden">
            <ThemeToggle
              labels={{
                toggle: t.a11y.toggleTheme,
                toLight: t.a11y.themeLight,
                toDark: t.a11y.themeDark,
              }}
            />
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
 * "mathematics" in one glyph. Redrawn on the new palette and marked decorative —
 * the adjacent text is the accessible name.
 */
function Wordmark() {
  return (
    <svg
      viewBox="0 0 36 36"
      width={32}
      height={32}
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <rect width="36" height="36" rx="9" fill="var(--primary)" />
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
