import Link from "next/link";

import { Icon, toIconName } from "@/components/ui/icon";
import { SmartLink, StatusDot } from "@/components/ui/primitives";
import { getDictionary, interpolate } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { primaryNav } from "@/components/nav/nav-items";
import type { SiteSettings, SocialLink } from "@/lib/data/site";

/**
 * Site footer.
 *
 * Rebuilt from v2's four-column directory, which restated the whole navigation
 * a second time and ran to roughly 400px of height. The brief asked for
 * something compact and expressive that reads as the end of the page rather
 * than as a sitemap.
 *
 * Structure now: identity and availability on the left, a single row of social
 * icons, one compact link row, and a thin legal strip. The nav row is the
 * primary items only — the secondary ones (home, education, resume) are all
 * reachable from the pages already listed, so repeating them here was noise.
 *
 * Two absences carried over from v2, both deliberate:
 *  - No link to `/admin`. Admin routes are not advertised in public navigation.
 *  - No phone numbers. Only channels the CMS marks as public are surfaced.
 */
export function SiteFooter({
  locale,
  settings,
  socialLinks,
}: {
  locale: Locale;
  settings: SiteSettings;
  socialLinks: SocialLink[];
}) {
  const t = getDictionary(locale);
  const primary = primaryNav(locale, t);
  const year = new Date().getFullYear();

  const hasEmailLink = socialLinks.some(
    (link) => link.platform === "email" || link.url.startsWith("mailto:"),
  );

  return (
    <footer
      data-site-footer
      data-print="hide"
      data-scheme="ink"
      className="decorated mt-auto bg-background text-foreground"
    >
      {/* Ties the footer visually to the CTA band directly above it. */}
      <div
        aria-hidden="true"
        className="glow"
        style={
          {
            "--glow-x": "50%",
            "--glow-y": "0%",
            "--glow-size": "70%",
            "--glow-alpha": "0.1",
          } as object
        }
      />

      <div className="container-content py-14">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          {/* ── Identity ─────────────────────────────────────────────────── */}
          <div className="flex max-w-[38ch] flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <Wordmark />
              <p className="text-h4 font-semibold">{settings.siteName}</p>
            </div>

            <p className="text-small text-foreground-muted">
              {settings.tagline ?? t.footer.tagline}
            </p>

            {settings.isAvailableForWork ? (
              <p className="inline-flex w-fit items-center gap-2 rounded-(--radius-full) border border-border bg-surface px-3 py-1.5 text-[0.8125rem] text-foreground-muted">
                <StatusDot tone="success" />
                {settings.availabilityStatus ?? t.footer.availability}
              </p>
            ) : null}

            {/* ── Social ─────────────────────────────────────────────────
                Icon-only, so each link carries its label as visually hidden
                text rather than relying on the icon alone for its name. */}
            {socialLinks.length > 0 ? (
              <ul className="mt-1 flex flex-wrap items-center gap-2">
                {socialLinks.map((link) => (
                  <li key={link.id}>
                    <SmartLink
                      href={link.url}
                      newTabHint={t.a11y.opensInNewTab}
                      className="inline-flex size-11 items-center justify-center rounded-(--radius-full) border border-border bg-surface text-foreground-muted transition-colors duration-200 hover:border-border-interactive hover:bg-surface-muted hover:text-foreground"
                    >
                      <Icon name={toIconName(link.icon, "globe")} size={18} />
                      <span className="sr-only">
                        {link.label}
                        {link.handle ? ` ${link.handle}` : ""}
                      </span>
                    </SmartLink>
                  </li>
                ))}

                {/*
                  Only add a mailto tile when the CMS social links do not
                  already carry one — otherwise the footer shows two identical
                  envelope icons pointing at the same address.
                */}
                {settings.contactEmail && !hasEmailLink ? (
                  <li>
                    <SmartLink
                      href={`mailto:${settings.contactEmail}`}
                      className="inline-flex size-11 items-center justify-center rounded-(--radius-full) border border-border bg-surface text-foreground-muted transition-colors duration-200 hover:border-border-interactive hover:bg-surface-muted hover:text-foreground"
                    >
                      <Icon name="mail" size={18} />
                      <span className="sr-only">
                        {t.contact.directEmail} {settings.contactEmail}
                      </span>
                    </SmartLink>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>

          {/* ── Compact navigation ───────────────────────────────────────── */}
          <nav aria-labelledby="footer-nav-heading" className="lg:text-right">
            <p
              id="footer-nav-heading"
              className="text-eyebrow font-semibold uppercase text-foreground-subtle"
            >
              {t.footer.navHeading}
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-0.5 lg:flex-col lg:items-end">
              {primary.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    // min-h-9 is not decoration: WCAG 2.2 AA 2.5.8 requires a
                    // 24×24px target, and these links at `text-small` in a
                    // 10px-gap column were 20px tall. axe flagged every page.
                    className="link-underline inline-flex min-h-9 items-center text-small text-foreground-muted transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={localePath(locale, "resume")}
                  className="link-underline text-small text-foreground-muted transition-colors hover:text-foreground"
                >
                  {t.nav.resume}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* ── Legal strip ────────────────────────────────────────────────── */}
        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-foreground-subtle">
            {interpolate(t.footer.copyright, { year })}
          </p>

          <div className="flex items-center gap-5">
            <p className="text-[0.8125rem] text-foreground-subtle">
              {t.footer.builtWith}
            </p>

            {/*
              Back to top is a plain in-page anchor, not a scroll script: `main`
              carries id="main-content" and tabIndex={-1}, so this moves focus
              as well as the viewport. A JS handler would have moved only the
              viewport and left a keyboard user's focus at the bottom.
            */}
            <a
              href="#main-content"
              className="group inline-flex items-center gap-1.5 rounded-(--radius-xs) text-[0.8125rem] text-foreground-muted transition-colors hover:text-foreground"
            >
              {t.footer.backToTop}
              <Icon
                name="arrowRight"
                size={14}
                className="-rotate-90 transition-transform duration-200 group-hover:-translate-y-0.5"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Decorative mark; the adjacent name is the accessible name. */
function Wordmark() {
  return (
    <svg
      viewBox="0 0 36 36"
      width={28}
      height={28}
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="wordmark-tile-footer" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--secondary)" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="11" fill="url(#wordmark-tile-footer)" />
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
