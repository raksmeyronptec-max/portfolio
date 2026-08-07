import Link from "next/link";

import { Icon, toIconName } from "@/components/ui/icon";
import { SmartLink, StatusDot } from "@/components/ui/primitives";
import { getDictionary, interpolate } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { BrandMark } from "./brand";
import type { SiteSettings, SocialLink } from "@/lib/data/site";

/**
 * Site footer.
 *
 * Two columns — identity on the left, link columns on the right — over a thin
 * legal strip. Replaces v2's four-column directory, which restated the whole
 * navigation a second time and ran to roughly 400px of height.
 *
 * The link columns are Work and Connect, not a sitemap: Work points at the two
 * things the page has just spent its length arguing for (the case studies and
 * the authored books), and Connect is however the CMS says he can be reached.
 * Everything else on the site is reachable from the header.
 *
 * ── Why nothing here is hardcoded ──────────────────────────────────────────
 * The social links, the email, the tagline and the availability line all come
 * from `site_settings` / `social_links`. A placeholder profile URL in a footer
 * is the kind of thing that ships and stays shipped, and the CMS exists so
 * these can be corrected without a deploy. A link that is not in the CMS is not
 * rendered.
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
  const year = new Date().getFullYear();

  const emailLink = socialLinks.find(
    (link) => link.platform === "email" || link.url.startsWith("mailto:"),
  );
  // Only added when the CMS social links do not already carry one, or the
  // column shows the same address twice.
  const showsMailto = Boolean(settings.contactEmail) && !emailLink;

  const externalLinks = socialLinks.filter((link) => link !== emailLink);

  return (
    <footer
      data-site-footer
      data-print="hide"
      data-scheme="ink"
      className="site-footer decorated mt-auto bg-background text-foreground"
    >
      {/* Ties the footer visually to the contact section directly above it. */}
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

      <div className="mx-auto max-w-[960px] px-6 pb-6 pt-12">
        <div className="footer-inner">
          {/* ── Identity ─────────────────────────────────────────────────── */}
          <div>
            <div className="footer-brand">
              <BrandMark gradientId="brand-footer" size={28} />
              {/* `font-display` is not decoration: a <span> does not pick up
                  the display stack the way a heading does, and without it the
                  same brand name rendered in two different typefaces at
                  opposite ends of the page. */}
              <span className="footer-name brand-wordmark font-display tracking-[-0.02em]">
                {settings.siteName}
              </span>
            </div>

            <p className="footer-tagline leading-khmer">
              {settings.tagline ?? t.footer.tagline}
            </p>

            {settings.isAvailableForWork ? (
              <p className="mt-4 inline-flex w-fit items-center gap-2 rounded-(--radius-full) border border-border bg-surface px-3 py-1.5 text-[0.8125rem] text-foreground-muted">
                <StatusDot tone="success" />
                {settings.availabilityStatus ?? t.footer.availability}
              </p>
            ) : null}
          </div>

          {/* ── Link columns ─────────────────────────────────────────────── */}
          <nav aria-label={t.footer.navHeading} className="footer-links">
            <ul className="footer-col">
              <li className="footer-col-title">{t.footer.workHeading}</li>
              <li>
                <Link href={localePath(locale, "projects")}>
                  {t.footer.caseStudies}
                </Link>
              </li>
              <li>
                <Link href={localePath(locale, "publications")}>
                  {t.footer.teachingMaterials}
                </Link>
              </li>
              <li>
                <Link href={localePath(locale, "resume")}>{t.nav.resume}</Link>
              </li>
            </ul>

            <ul className="footer-col">
              <li className="footer-col-title">{t.footer.connectHeading}</li>

              {showsMailto ? (
                <li>
                  <a href={`mailto:${settings.contactEmail}`}>
                    <FooterLinkIcon name="mail" />
                    {t.contact.directEmail}
                  </a>
                </li>
              ) : null}

              {emailLink ? (
                <li>
                  <a href={emailLink.url}>
                    <FooterLinkIcon name={toIconName(emailLink.icon, "mail")} />
                    {emailLink.label}
                  </a>
                </li>
              ) : null}

              {/* `SmartLink` adds rel="noopener noreferrer" and the
                  "opens in a new tab" hint for external destinations, so the
                  target attribute is never set by hand here. */}
              {externalLinks.map((link) => (
                <li key={link.id}>
                  <SmartLink href={link.url} newTabHint={t.a11y.opensInNewTab}>
                    <FooterLinkIcon name={toIconName(link.icon, "globe")} />
                    {link.label}
                  </SmartLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* ── Legal strip ────────────────────────────────────────────────── */}
        <div className="footer-bottom">
          <span>{interpolate(t.footer.copyright, { year })}</span>

          <span className="flex items-center gap-5">
            {t.footer.builtWith}

            {/*
              Back to top is a plain in-page anchor, not a scroll script: `main`
              carries id="main-content" and tabIndex={-1}, so this moves focus
              as well as the viewport. A JS handler would have moved only the
              viewport and left a keyboard user's focus at the bottom.
            */}
            <a
              href="#main-content"
              className="group inline-flex min-h-9 items-center gap-1.5 rounded-(--radius-xs) text-foreground-muted transition-colors hover:text-foreground"
            >
              {t.footer.backToTop}
              <Icon
                name="arrowRight"
                size={13}
                aria-hidden
                className="-rotate-90 transition-transform duration-200 group-hover:-translate-y-0.5"
              />
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}

/**
 * Decorative mark beside a Connect link. Always `aria-hidden`: the link text
 * next to it is the accessible name, and announcing "Telegram Telegram" is
 * what happens when an icon in a labelled link is given one of its own.
 */
function FooterLinkIcon({ name }: { name: Parameters<typeof Icon>[0]["name"] }) {
  return <Icon name={name} size={15} aria-hidden className="mr-2 shrink-0" />;
}
