import { Brand } from "./brand";
import { ButtonLink } from "@/components/ui/button";
import { DesktopNav } from "@/components/nav/desktop-nav";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { MobileNav } from "@/components/nav/mobile-nav";
import { headerNav, secondaryNav } from "@/components/nav/nav-items";
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
  const primary = headerNav(locale, t);
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
     * The homepage pulls its ink hero beneath this bar, so the header uses the
     * same ink tokens. When it becomes opaque on scroll it remains a compact
     * dark navigation surface, keeping every label at AA contrast over both
     * the hero and the light editorial sections below.
     */
    <header
      data-site-header
      data-scheme="ink"
      data-print="hide"
      data-scrolled="false"
      className="header-bar sticky top-0 z-40"
    >
      <HeaderScrollSync />

      <div
        className="container-content flex items-center justify-between gap-4"
        style={{ height: "var(--header-height)" }}
      >
        {/* ── Brand ─────────────────────────────────────────────────────────
            The mark steps down to 34px below `sm` so the bar stays compact on
            a phone, where the menu button and theme toggle share the row. */}
        <Brand
          locale={locale}
          gradientId="brand-header"
          showSubtitle
          className="[&>span:first-child>svg]:size-9 sm:[&>span:first-child>svg]:size-10"
        />

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
