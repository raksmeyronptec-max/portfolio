import type { Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import type { IconName } from "@/components/ui/icon";

export type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: IconName;
};

/**
 * Primary navigation.
 *
 * Single source of truth for the header, the mobile drawer and the footer, so
 * the three can never disagree. Note what is absent compared with v1: there is no
 * "Back to PTEC" link in the primary navigation. Sending visitors off the
 * portfolio from the top-left of the header was the audit's clearest UX problem;
 * that link now lives in the KruSmart case study, where it is relevant.
 */
export function primaryNav(locale: Locale, t: Dictionary): NavItem[] {
  return [
    { key: "projects", href: localePath(locale, "projects"), label: t.nav.projects, icon: "layers" },
    {
      key: "certificates",
      href: localePath(locale, "certificates"),
      label: t.nav.certificates,
      icon: "award",
    },
    {
      key: "experience",
      href: localePath(locale, "experience"),
      label: t.nav.experience,
      icon: "briefcase",
    },
    /*
     * Journey sits next to Experience rather than in the secondary nav, because
     * it is the visual counterpart to it — Experience states what the roles were,
     * Journey shows what they looked like — and a visitor who wants one usually
     * wants the other.
     */
    {
      key: "journey",
      href: localePath(locale, "journey"),
      label: t.nav.journey,
      icon: "mapPin",
    },
    { key: "about", href: localePath(locale, "about"), label: t.nav.about, icon: "user" },
    { key: "contact", href: localePath(locale, "contact"), label: t.nav.contact, icon: "mail" },
  ];
}

/** Secondary links, surfaced in the footer and the mobile drawer. */
export function secondaryNav(locale: Locale, t: Dictionary): NavItem[] {
  return [
    { key: "home", href: localePath(locale), label: t.nav.home, icon: "layoutDashboard" },
    {
      key: "education",
      href: localePath(locale, "education"),
      label: t.nav.education,
      icon: "graduation",
    },
    { key: "resume", href: localePath(locale, "resume"), label: t.nav.resume, icon: "fileText" },
  ];
}

/**
 * Is `href` the active route?
 *
 * The home route needs an exact match; every other route matches its subtree so
 * a project detail page still highlights "Projects".
 */
export function isActiveRoute(pathname: string, href: string, locale: Locale): boolean {
  const home = localePath(locale);
  if (href === home) return pathname === home || pathname === `${home}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}
