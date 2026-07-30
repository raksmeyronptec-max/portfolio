import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/ui/navigation";
import { Card, CardBody, SectionHeading } from "@/components/ui/primitives";
import { Icon, toIconName } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
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

      <div className="container-content flex flex-col gap-8 py-10 sm:py-14">
        <Breadcrumbs
          items={[
            { label: t.nav.home, href: localePath(locale) },
            { label: t.nav.contact },
          ]}
          label={t.a11y.breadcrumb}
        />

        <SectionHeading
          headingLevel={1}
          title={t.contact.title}
          description={t.contact.description}
        />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-14">
          {/* ── Form ─────────────────────────────────────────────────────── */}
          <section aria-labelledby="contact-form-heading">
            <h2 id="contact-form-heading" className="text-h3 font-semibold">
              {t.contact.formHeading}
            </h2>

            <div className="mt-5">
              {settings.contactFormEnabled ? (
                <ContactForm locale={locale} t={t} />
              ) : (
                // Disabling the form must not leave visitors with no way to make
                // contact, so the direct channels are surfaced instead.
                <Notice tone="info">
                  <p>{t.contact.directHeading}</p>
                </Notice>
              )}
            </div>
          </section>

          {/* ── Direct channels ──────────────────────────────────────────── */}
          <section aria-labelledby="contact-direct-heading" className="flex flex-col gap-4">
            <h2 id="contact-direct-heading" className="text-h3 font-semibold">
              {t.contact.directHeading}
            </h2>

            <ul className="flex flex-col gap-3">
              {socialLinks.map((link) => (
                <li key={link.id}>
                  <Card interactive>
                    <CardBody className="p-4">
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
                        className="flex items-center gap-3"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-[--radius-md] bg-primary-subtle text-primary-subtle-foreground">
                          <Icon name={toIconName(link.icon, "globe")} size={18} />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="text-small font-semibold">{link.label}</span>
                          {link.handle ? (
                            <span className="truncate text-[0.8125rem] text-foreground-muted">
                              {link.handle}
                            </span>
                          ) : null}
                        </span>
                      </OutboundLink>
                    </CardBody>
                  </Card>
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
        </div>
      </div>
    </>
  );
}
