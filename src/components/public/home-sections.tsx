import Image from "next/image";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Icon, toIconName } from "@/components/ui/icon";
import {
  Badge,
  Card,
  CardBody,
  Divider,
  SectionHeading,
  SmartLink,
  StatusDot,
  Tag,
} from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { OutboundLink } from "@/components/public/outbound-link";
import { ProjectCard } from "@/components/public/project-card";
import { CertificateCard } from "@/components/public/certificate-card";
import { interpolate, type Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { langAttribute } from "@/lib/content/translation";
import type { CapabilityGroup, EducationEntry, ExperienceEntry, Testimonial } from "@/lib/data/cv";
import type { CertificateCardData } from "@/lib/data/certificates";
import type { ProjectCardData } from "@/lib/data/projects";
import type { OwnerProfile, SiteCounts, SiteSettings, SocialLink, SpokenLanguage } from "@/lib/data/site";
import { resolveImage } from "@/lib/content/media";
import { cn } from "@/lib/utils/cn";

/* ═══════════════════════════════════════════════════════════════════════════
   Homepage sections.

   All server-rendered. The only client JavaScript on the homepage comes from the
   header controls, the outbound-click links and the page-view tracker.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Hero ────────────────────────────────────────════════════════════════════

export function Hero({
  locale,
  t,
  settings,
  profile,
  languages,
}: {
  locale: Locale;
  t: Dictionary;
  settings: SiteSettings;
  profile: OwnerProfile | null;
  languages: SpokenLanguage[];
}) {
  const headline = settings.heroHeadline ?? profile?.headline ?? t.about.positioningHeading;
  const subheadline = settings.heroSubheadline ?? profile?.bio ?? null;
  const location = settings.location ?? profile?.location ?? null;
  const portrait = profile?.avatarUrl ?? "/image/MyPF.jpg";

  return (
    <section className="relative overflow-hidden border-b border-border">
      {/*
        A single, very low-contrast radial wash instead of v1's three animated
        blobs plus a permanent requestAnimationFrame canvas. It is a static
        gradient: no paint cost after the first frame, and nothing to disable for
        reduced motion.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,var(--primary-subtle),transparent_60%)] opacity-70"
      />

      <div className="container-content grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-6">
          <p className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-accent-subtle-foreground">
            {t.home.hero.eyebrow}
          </p>

          <h1 className="text-display max-w-[24ch] font-bold">{headline}</h1>

          {subheadline ? (
            <p className="max-w-[58ch] text-body-lg text-foreground-muted">
              {subheadline}
            </p>
          ) : null}

          {/* ── Status line ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-small text-foreground-muted">
            <span className="inline-flex items-center gap-2 rounded-[--radius-full] border border-border bg-surface px-3 py-1.5">
              <StatusDot tone={settings.isAvailableForWork ? "success" : "neutral"} />
              {settings.availabilityStatus ??
                (settings.isAvailableForWork
                  ? t.home.hero.availableForWork
                  : t.home.hero.notAvailable)}
            </span>

            {location ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="mapPin" size={15} />
                {interpolate(t.home.hero.basedIn, { location })}
              </span>
            ) : null}

            {languages.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="languages" size={15} />
                <span className="sr-only">{t.home.hero.speaks}: </span>
                {languages.map((language) => language.name).join(" · ")}
              </span>
            ) : null}
          </div>

          {/* ── Actions ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            <ButtonLink
              href={localePath(locale, "projects")}
              variant="primary"
              size="lg"
              iconEnd="arrowRight"
            >
              {t.home.hero.viewProjects}
            </ButtonLink>

            <ButtonLink
              href={localePath(locale, "resume")}
              variant="outline"
              size="lg"
              iconStart="download"
            >
              {t.home.hero.downloadResume}
            </ButtonLink>

            <ButtonLink
              href={localePath(locale, "contact")}
              variant="ghost"
              size="lg"
              iconStart="mail"
            >
              {t.home.hero.contactMe}
            </ButtonLink>
          </div>
        </div>

        {/* ── Portrait ──────────────────────────────────────────────────── */}
        <div className="order-first lg:order-none">
          <div className="relative mx-auto w-full max-w-[22rem]">
            <div
              aria-hidden="true"
              className="absolute -inset-3 -z-10 rounded-[--radius-xl] border border-border bg-surface-muted/60"
            />
            {/*
              The single `priority` image on the page. Explicit width/height plus
              an aspect-ratio wrapper means the space is reserved before the file
              arrives, so this cannot contribute to layout shift.
            */}
            <div className="relative aspect-[4/5] overflow-hidden rounded-[--radius-lg] border border-border bg-surface-muted">
              <Image
                src={portrait}
                alt={profile?.displayName ?? t.home.hero.portraitAlt}
                fill
                sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
                priority
                className="object-cover object-top"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Credibility strip ───────────────────────────════════════════════════════

/**
 * Every figure is counted from published CMS rows by the `public_site_counts`
 * view. Zero values are dropped rather than displayed, because "0 certificates"
 * is not a credibility signal — and because nothing here may be a hardcoded
 * claim, which is exactly what v1's "2 Dual Degrees" was.
 */
export function CredibilityStrip({
  t,
  counts,
}: {
  t: Dictionary;
  counts: SiteCounts;
}) {
  const items = [
    { key: "projects", value: counts.publishedProjects, label: t.home.credibility.publishedProjects },
    { key: "certificates", value: counts.publishedCertificates, label: t.home.credibility.certificates },
    { key: "experiences", value: counts.publishedExperiences, label: t.home.credibility.experiences },
    { key: "years", value: counts.yearsOnJourney, label: t.home.credibility.yearsJourney },
    { key: "languages", value: counts.languages, label: t.home.credibility.languages },
  ].filter((item): item is { key: string; value: number; label: string } =>
    typeof item.value === "number" && item.value > 0,
  );

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="credibility-heading" className="border-b border-border bg-surface">
      <div className="container-content py-8">
        <h2 id="credibility-heading" className="sr-only">
          {t.home.credibility.heading}
        </h2>

        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <div key={item.key} className="flex flex-col gap-1">
              <dd className="text-h2 font-bold tabular-nums text-primary">
                {item.value}
              </dd>
              <dt className="text-[0.8125rem] leading-snug text-foreground-muted">
                {item.label}
              </dt>
            </div>
          ))}
        </dl>

        <p className="mt-5 text-[0.8125rem] text-foreground-subtle">
          {t.home.credibility.note}
        </p>
      </div>
    </section>
  );
}

// ── Featured projects ───────────────────────────════════════════════════════

export function FeaturedProjects({
  locale,
  t,
  projects,
}: {
  locale: Locale;
  t: Dictionary;
  projects: ProjectCardData[];
}) {
  return (
    <section aria-labelledby="featured-projects-heading" className="section-y">
      <div className="container-content flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            id="featured-projects-heading"
            eyebrow={t.home.featured.eyebrow}
            title={t.home.featured.heading}
            description={t.home.featured.description}
          />

          <ButtonLink
            href={localePath(locale, "projects")}
            variant="outline"
            iconEnd="arrowRight"
            className="shrink-0"
          >
            {t.home.featured.viewAll}
          </ButtonLink>
        </div>

        {projects.length === 0 ? (
          <EmptyState icon="layers" title={t.home.featured.empty} />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, index) => (
              <li key={project.id} className="flex">
                <ProjectCard
                  project={project}
                  locale={locale}
                  t={t}
                  priority={index === 0}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ── Capabilities ────────────────────────════════════════════════════════════

/**
 * Replaces v1's four cards of percentage bars.
 *
 * There is no score anywhere. Each capability instead links to the published
 * projects that demonstrate it, and a capability with no linked project says so
 * plainly rather than claiming a number.
 */
export function Capabilities({
  locale,
  t,
  groups,
}: {
  locale: Locale;
  t: Dictionary;
  groups: CapabilityGroup[];
}) {
  if (groups.length === 0) return null;

  return (
    <section
      aria-labelledby="capabilities-heading"
      className="section-y border-y border-border bg-surface-muted/40"
    >
      <div className="container-content flex flex-col gap-8">
        <SectionHeading
          id="capabilities-heading"
          eyebrow={t.home.capabilities.eyebrow}
          title={t.home.capabilities.heading}
          description={t.home.capabilities.description}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.id} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[--radius-md] bg-primary-subtle text-primary-subtle-foreground">
                    <Icon name={toIconName(group.icon, "target")} size={20} />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-h4 font-semibold">{group.name}</h3>
                    {group.description ? (
                      <p className="text-small text-foreground-muted">
                        {group.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <Divider />

                <ul className="flex flex-col gap-3">
                  {group.skills.map((skill) => (
                    <li key={skill.id} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline gap-2">
                        <Icon
                          name="check"
                          size={15}
                          className="mt-1 shrink-0 text-secondary"
                        />
                        <span className="text-small font-medium">{skill.name}</span>
                      </div>

                      {skill.projects.length > 0 ? (
                        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pl-6 text-[0.8125rem] text-foreground-muted">
                          <span>{t.home.capabilities.evidencedBy}:</span>
                          {skill.projects.map((project, index) => (
                            <span key={project.id}>
                              <Link
                                href={localePath(locale, `projects/${project.slug}`)}
                                className="text-primary underline underline-offset-2 hover:decoration-2"
                              >
                                {project.title}
                              </Link>
                              {index < skill.projects.length - 1 ? "," : null}
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Certificates preview ────────────────════════════════════════════════════

export function CertificatesPreview({
  locale,
  t,
  certificates,
}: {
  locale: Locale;
  t: Dictionary;
  certificates: CertificateCardData[];
}) {
  return (
    <section aria-labelledby="certificates-preview-heading" className="section-y">
      <div className="container-content flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            id="certificates-preview-heading"
            eyebrow={t.home.certificates.eyebrow}
            title={t.home.certificates.heading}
          />

          <ButtonLink
            href={localePath(locale, "certificates")}
            variant="outline"
            iconEnd="arrowRight"
            className="shrink-0"
          >
            {t.home.certificates.viewAll}
          </ButtonLink>
        </div>

        {certificates.length === 0 ? (
          <EmptyState icon="award" title={t.home.certificates.empty} />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {certificates.map((certificate) => (
              <li key={certificate.id} className="flex">
                <CertificateCard certificate={certificate} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ── Journey timeline ────────────────════════════════════════════════════════

/**
 * Education and experience merged into one readable timeline.
 *
 * Uses the `periodLabel` when present — which is the honest precision for
 * migrated v1 content — and only formats a stored date when no label exists.
 */
export function Journey({
  locale,
  t,
  education,
  experiences,
}: {
  locale: Locale;
  t: Dictionary;
  education: EducationEntry[];
  experiences: ExperienceEntry[];
}) {
  type TimelineItem = {
    id: string;
    kind: "education" | "experience";
    title: string;
    organization: string;
    organizationUrl: string | null;
    period: string | null;
    description: string | null;
    detail: string | null;
    isCurrent: boolean;
    sortKey: string;
    contentLocale: Locale | null;
    tags: string[];
  };

  const items: TimelineItem[] = [
    ...education.map((entry) => ({
      id: `education-${entry.id}`,
      kind: "education" as const,
      title: entry.qualification ?? entry.institution,
      organization: entry.institution,
      organizationUrl: entry.institutionUrl,
      period: entry.periodLabel,
      description: entry.description,
      detail:
        entry.gradeValue && entry.gradeScale
          ? `${t.education.grade}: ${entry.gradeValue} (${entry.gradeScale})`
          : null,
      isCurrent: entry.isCurrent,
      sortKey: entry.startedOn ?? entry.endedOn ?? "0000",
      contentLocale: entry.contentLocale,
      tags: [t.education.kind[entry.kind as keyof typeof t.education.kind] ?? entry.kind],
    })),
    ...experiences.map((entry) => ({
      id: `experience-${entry.id}`,
      kind: "experience" as const,
      title: entry.roleTitle,
      organization: entry.organization,
      organizationUrl: entry.organizationUrl,
      period: entry.periodLabel,
      description: entry.summary ?? entry.description,
      detail: null,
      isCurrent: entry.isCurrent,
      sortKey: entry.startedOn ?? "0000",
      contentLocale: entry.contentLocale,
      tags: entry.tags.map((tag) => tag.label),
    })),
  ].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return b.sortKey.localeCompare(a.sortKey);
  });

  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="journey-heading"
      className="section-y border-y border-border bg-surface-muted/40"
    >
      <div className="container-content flex flex-col gap-8">
        <SectionHeading
          id="journey-heading"
          eyebrow={t.home.journey.eyebrow}
          title={t.home.journey.heading}
        />

        <ol className="relative flex flex-col gap-6 border-s border-border ps-6 sm:ps-8">
          {items.map((item) => (
            <li key={item.id} className="relative">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -start-[calc(1.5rem+5px)] top-2 size-2.5 rounded-full border-2 border-background sm:-start-[calc(2rem+5px)]",
                  item.isCurrent ? "bg-accent" : "bg-border-strong",
                )}
              />

              <Card>
                <CardBody className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {item.period ? (
                      <span className="font-mono text-[0.8125rem] text-foreground-muted">
                        {item.period}
                      </span>
                    ) : null}

                    {item.isCurrent ? (
                      <Badge tone="success">{t.home.journey.present}</Badge>
                    ) : null}

                    <Badge tone="neutral" icon={item.kind === "education" ? "graduation" : "briefcase"}>
                      {item.kind === "education" ? t.education.title : t.experience.title}
                    </Badge>
                  </div>

                  <h3
                    className="text-h4 font-semibold"
                    lang={langAttribute(locale, item.contentLocale)}
                  >
                    {item.title}
                  </h3>

                  <p className="text-small text-foreground-muted">
                    {item.organizationUrl ? (
                      <SmartLink
                        href={item.organizationUrl}
                        newTabHint={t.a11y.opensInNewTab}
                        className="underline underline-offset-2 hover:decoration-2"
                      >
                        {item.organization}
                      </SmartLink>
                    ) : (
                      item.organization
                    )}
                  </p>

                  {item.description ? (
                    <p
                      className="text-small text-foreground-muted"
                      lang={langAttribute(locale, item.contentLocale)}
                    >
                      {item.description}
                    </p>
                  ) : null}

                  {item.detail ? (
                    <p className="text-small font-medium text-secondary-subtle-foreground">
                      {item.detail}
                    </p>
                  ) : null}

                  {item.tags.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5 pt-1">
                      {item.tags.map((tag) => (
                        <li key={tag}>
                          <Tag>{tag}</Tag>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── Testimonials ────────────────════════════════════════════════════════════

/**
 * Professional reference cards.
 *
 * No star ratings — they were invented decoration on real people's words. No
 * private contact details: the schema has nowhere to store the mobile number v1
 * published, so it cannot reappear.
 */
export function Testimonials({
  locale,
  t,
  testimonials,
}: {
  locale: Locale;
  t: Dictionary;
  testimonials: Testimonial[];
}) {
  if (testimonials.length === 0) return null;

  return (
    <section aria-labelledby="testimonials-heading" className="section-y">
      <div className="container-content flex flex-col gap-8">
        <SectionHeading
          id="testimonials-heading"
          eyebrow={t.home.testimonials.eyebrow}
          title={t.home.testimonials.heading}
        />

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => {
            const avatar = resolveImage(testimonial.avatar, locale, "thumbnail");

            return (
              <li key={testimonial.id} className="flex">
                <Card as="figure" className="flex flex-1 flex-col">
                  <CardBody className="flex flex-1 flex-col gap-4">
                    <Icon
                      name="lightbulb"
                      size={20}
                      className="text-accent-subtle-foreground"
                    />

                    <blockquote
                      className="flex-1 text-small leading-relaxed text-foreground"
                      lang={langAttribute(locale, testimonial.contentLocale)}
                    >
                      {testimonial.quote}
                    </blockquote>

                    <figcaption className="flex items-center gap-3 border-t border-border pt-4">
                      {avatar ? (
                        <Image
                          src={avatar.src}
                          alt={avatar.alt || testimonial.authorName}
                          width={44}
                          height={44}
                          sizes="44px"
                          loading="lazy"
                          className="size-11 shrink-0 rounded-full border border-border object-cover object-top"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-foreground-subtle"
                        >
                          <Icon name="user" size={20} />
                        </span>
                      )}

                      <div className="flex min-w-0 flex-col">
                        <p className="text-small font-semibold">
                          {testimonial.authorUrl ? (
                            <SmartLink
                              href={testimonial.authorUrl}
                              newTabHint={t.a11y.opensInNewTab}
                              className="underline underline-offset-2 hover:decoration-2"
                            >
                              {testimonial.authorName}
                            </SmartLink>
                          ) : (
                            testimonial.authorName
                          )}
                        </p>

                        <p className="truncate text-[0.8125rem] text-foreground-muted">
                          {[testimonial.authorRole, testimonial.organization]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </figcaption>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ── Contact CTA ─────────────────════════════════════════════════════════════

export function ContactCta({
  locale,
  t,
  settings,
  socialLinks,
}: {
  locale: Locale;
  t: Dictionary;
  settings: SiteSettings;
  socialLinks: SocialLink[];
}) {
  const telegram = socialLinks.find((link) => link.platform === "telegram");

  return (
    <section
      aria-labelledby="contact-cta-heading"
      className="border-t border-border bg-surface-inverse text-foreground-inverse"
    >
      <div className="container-content flex flex-col items-center gap-6 py-16 text-center">
        <h2 id="contact-cta-heading" className="text-h1 max-w-[34ch] font-bold">
          {t.home.cta.heading}
        </h2>

        <p className="max-w-[56ch] text-body-lg opacity-90">{t.home.cta.description}</p>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <ButtonLink
            href={localePath(locale, "contact")}
            variant="accent"
            size="lg"
            iconStart="send"
          >
            {t.home.cta.openContactForm}
          </ButtonLink>

          {settings.contactEmail ? (
            <OutboundLink
              href={`mailto:${settings.contactEmail}`}
              event={{
                name: "email_click",
                locale,
                properties: { url: `mailto:${settings.contactEmail}` },
              }}
              className="inline-flex min-h-12 items-center gap-2 rounded-[--radius-md] border border-current/30 px-5 text-[1.0625rem] font-medium hover:bg-white/10"
            >
              <Icon name="mail" size={18} />
              {t.home.cta.emailMe}
            </OutboundLink>
          ) : null}

          {telegram ? (
            <OutboundLink
              href={telegram.url}
              newTabHint={t.a11y.opensInNewTab}
              event={{
                name: "telegram_click",
                locale,
                properties: { url: telegram.url },
              }}
              className="inline-flex min-h-12 items-center gap-2 rounded-[--radius-md] border border-current/30 px-5 text-[1.0625rem] font-medium hover:bg-white/10"
            >
              <Icon name="telegram" size={18} />
              {t.home.cta.telegram}
            </OutboundLink>
          ) : null}
        </div>

        {/* Sets an honest expectation instead of implying an instant reply. */}
        <p className="pt-2 text-small opacity-75">{t.contact.responseTime}</p>
      </div>
    </section>
  );
}
