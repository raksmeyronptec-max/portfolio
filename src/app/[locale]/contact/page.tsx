import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StatusDot } from "@/components/ui/primitives";
import { Icon, toIconName } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/page-header";
import { ContactForm } from "@/components/public/contact-form";
import { OutboundLink } from "@/components/public/outbound-link";
import { getDictionary } from "@/i18n/dictionary";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/supabase/env";
import { getSeoOverride, getSiteSettings, getSocialLinks } from "@/lib/data/site";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema, graph } from "@/lib/seo/jsonld";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const override = await getSeoOverride("contact", locale);

  return buildPageMetadata({
    locale,
    path: "contact",
    title: override?.title ?? t.contact.title,
    description: override?.description ?? t.contact.description,
    canonicalOverride: override?.canonicalUrl,
    ogImage: override?.ogImage,
    noIndex: override ? !override.isIndexable : false,
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = getDictionary(locale);
  const [settings, socialLinks] = await Promise.all([
    getSiteSettings(locale),
    getSocialLinks(locale),
  ]);

  const structuredData = graph([
    breadcrumbSchema([
      { name: t.nav.home, url: absoluteUrl(localePath(locale)) },
      { name: t.nav.contact, url: absoluteUrl(localePath(locale, "contact")) },
    ]),
  ]);

  return (
    <>
      <JsonLd data={structuredData} />

      <PageHeader
        title={t.home.cta.heading}
        description={t.contact.description}
        eyebrow={t.nav.contact}
        breadcrumbs={[
          { label: t.nav.home, href: localePath(locale) },
          { label: t.nav.contact },
        ]}
        breadcrumbLabel={t.a11y.breadcrumb}
        watermark="@"
      />

      <div className="container-content py-14 sm:py-16">
        {/*
          Invitation on the left, form on the right. v2 put the form first and
          then a column of outlined cards, which read as a support ticket queue;
          the brief asked for something warmer, with the direct channels easy to
          find rather than boxed.
        */}
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          {/* ── Invitation and direct channels ───────────────────────────── */}
          <section
            aria-labelledby="contact-direct-heading"
            className="flex flex-col gap-7 lg:sticky lg:top-28 lg:self-start"
          >
            <div className="flex flex-col gap-3">
              <h2 id="contact-direct-heading" className="text-h3">
                {t.contact.directHeading}
              </h2>
              <p className="max-w-[44ch] text-body-lg text-foreground-muted">
                {t.contact.responseTime}
              </p>
            </div>

            {settings.isAvailableForWork ? (
              <p className="inline-flex w-fit items-center gap-2 rounded-(--radius-full) border border-border bg-surface px-3.5 py-2 text-small text-foreground-muted">
                <StatusDot tone="success" />
                {settings.availabilityStatus ?? t.home.hero.availableForWork}
              </p>
            ) : null}

            {/* Plain rows on hairlines rather than a stack of cards. */}
            <ul className="flex flex-col">
              {socialLinks.map((link) => (
                <li key={link.id} className="border-b border-border first:border-t">
                  <OutboundLink
                    href={link.url}
                    newTabHint={t.a11y.opensInNewTab}
                    event={{
                      name:
                        link.platform === "telegram"
                          ? "telegram_click"
                          : link.platform === "email"
                            ? "email_click"
                            : "social_link_click",
                      locale,
                      entityType: "social_link",
                      entityId: link.id,
                      properties: { url: link.url },
                    }}
                    className="group flex min-h-14 items-center gap-4 py-3 transition-colors hover:text-primary"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-(--radius-full) border border-border bg-surface-muted text-foreground-muted transition-colors group-hover:border-border-interactive group-hover:text-primary">
                      <Icon name={toIconName(link.icon, "globe")} size={17} />
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-small font-semibold">{link.label}</span>
                      {link.handle ? (
                        <span className="truncate text-[0.8125rem] text-foreground-muted">
                          {link.handle}
                        </span>
                      ) : null}
                    </span>

                    <Icon
                      name="arrowRight"
                      size={16}
                      className="travel shrink-0 text-foreground-subtle"
                    />
                  </OutboundLink>
                </li>
              ))}
            </ul>

            {settings.location ? (
              <p className="flex items-center gap-2 text-small text-foreground-muted">
                <Icon name="mapPin" size={16} />
                {settings.location}
              </p>
            ) : null}
          </section>

          {/* ── Form ─────────────────────────────────────────────────────── */}
          <section aria-labelledby="contact-form-heading" className="flex flex-col gap-5">
            <h2 id="contact-form-heading" className="text-h3">
              {t.contact.formHeading}
            </h2>

            {settings.contactFormEnabled ? (
              <ContactForm locale={locale} t={t} />
            ) : (
              // Disabling the form must not leave visitors with no way to make
              // contact, so the direct channels above remain the route in.
              <Notice tone="info">
                <p>{t.contact.directHeading}</p>
              </Notice>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
