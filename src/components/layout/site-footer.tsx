import Link from "next/link";

import { Icon, toIconName } from "@/components/ui/icon";
import { SmartLink } from "@/components/ui/primitives";
import { getDictionary, interpolate } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { primaryNav, secondaryNav } from "@/components/nav/nav-items";
import type { SiteSettings, SocialLink } from "@/lib/data/site";

/**
 * Site footer.
 *
 * Note the absences, both deliberate:
 *  - No link to `/admin`. Admin routes are not advertised in public navigation.
 *  - No phone numbers. v1 published a referee's mobile number; this footer only
 *    surfaces channels the CMS marks as public.
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
  const secondary = secondaryNav(locale, t);
  const year = new Date().getFullYear();

  return (
    <footer
      data-site-footer
      data-print="hide"
      className="mt-auto border-t border-border bg-surface-muted/40"
    >
      <div className="container-content py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* ── Identity ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 lg:col-span-2">
            <p className="text-h4 font-semibold">{settings.siteName}</p>
            <p className="max-w-[42ch] text-small text-foreground-muted">
              {settings.tagline ?? t.footer.tagline}
            </p>

            {settings.location ? (
              <p className="flex items-center gap-1.5 text-small text-foreground-muted">
                <Icon name="mapPin" size={15} />
                {settings.location}
              </p>
            ) : null}

            {settings.contactEmail ? (
              <SmartLink
                href={`mailto:${settings.contactEmail}`}
                className="inline-flex w-fit items-center gap-1.5 text-small text-primary underline underline-offset-2 hover:decoration-2"
              >
                <Icon name="mail" size={15} />
                {settings.contactEmail}
              </SmartLink>
            ) : null}
          </div>

          {/* ── Pages ────────────────────────────────────────────────────── */}
          <nav aria-labelledby="footer-nav-heading">
            <p
              id="footer-nav-heading"
              className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-foreground-muted"
            >
              {t.footer.navHeading}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {[...secondary, ...primary].map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="text-small text-foreground-muted underline decoration-transparent underline-offset-2 transition-colors hover:text-foreground hover:decoration-current"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Connect ──────────────────────────────────────────────────── */}
          <nav aria-labelledby="footer-connect-heading">
            <p
              id="footer-connect-heading"
              className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-foreground-muted"
            >
              {t.footer.connectHeading}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {socialLinks.map((link) => (
                <li key={link.id}>
                  {/*
                    `flex-wrap` and `break-all` on the handle matter: the label and
                    the handle together ("Telegram @Ron_Raksmey") are wider than
                    this footer column at 1024px, and an unwrapped inline-flex
                    pushed the document 15px wider than the viewport. Wrapping the
                    handle onto its own line keeps the layout inside the viewport at
                    every width instead of only the ones that happen to fit.
                  */}
                  <SmartLink
                    href={link.url}
                    newTabHint={t.a11y.opensInNewTab}
                    className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-small text-foreground-muted underline decoration-transparent underline-offset-2 transition-colors hover:text-foreground hover:decoration-current"
                  >
                    <Icon name={toIconName(link.icon, "globe")} size={15} />
                    {link.label}
                    {link.handle ? (
                      <span className="break-all text-foreground-subtle">
                        {link.handle}
                      </span>
                    ) : null}
                  </SmartLink>
                </li>
              ))}
              <li>
                <Link
                  href={localePath(locale, "resume")}
                  className="inline-flex items-center gap-2 text-small text-foreground-muted underline decoration-transparent underline-offset-2 transition-colors hover:text-foreground hover:decoration-current"
                >
                  <Icon name="download" size={15} />
                  {t.nav.downloadResume}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-foreground-subtle">
            {interpolate(t.footer.copyright, { year })}
          </p>
          <p className="text-[0.8125rem] text-foreground-subtle">
            {t.footer.builtWith}
          </p>
        </div>
      </div>
    </footer>
  );
}
