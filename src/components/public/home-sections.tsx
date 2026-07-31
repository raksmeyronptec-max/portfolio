import Image from "next/image";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Icon, toIconName } from "@/components/ui/icon";
import { SmartLink, StatusDot, Tag } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/reveal";
import { RotatingWords } from "@/components/motion/rotating-words";
import { OutboundLink } from "@/components/public/outbound-link";
import { ProjectShowcase } from "@/components/public/project-showcase";
import { CertificateCard } from "@/components/public/certificate-card";
import { interpolate, type Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { langAttribute } from "@/lib/content/translation";
import type { CapabilityGroup, EducationEntry, ExperienceEntry, Testimonial } from "@/lib/data/cv";
import type { CertificateCardData } from "@/lib/data/certificates";
import type { ProjectCardData } from "@/lib/data/projects";
import { livePlatforms } from "@/lib/data/live-platforms";
import type { OwnerProfile, SiteCounts, SiteSettings, SocialLink, SpokenLanguage } from "@/lib/data/site";
import { resolveImage } from "@/lib/content/media";
import { cn } from "@/lib/utils/cn";

/* ═══════════════════════════════════════════════════════════════════════════
   Homepage sections.

   All server-rendered except three small client leaves: the scroll-reveal
   wrapper, the hero's rotating word, and the outbound-click links. Everything
   else — all copy, all CMS content — costs no client JavaScript.

   Section rhythm alternates deliberately rather than stacking identical
   bordered blocks, which is what the brief rejected:

     Hero            ink, full-bleed, decorated
     Credibility     ink, continues the hero band
     Featured work   light editorial, alternating full-width showcases
     About           light editorial, asymmetric
     Capabilities    tinted, marquee + compact groups
     Certificates    light editorial, gallery
     Journey         tinted, hairline timeline
     Testimonials    light editorial
     Contact CTA     ink, closes the page into the footer
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Hero ────────────────────────────────────════════════════════════════════

export function Hero({
  locale,
  t,
  settings,
  profile,
  languages,
  socialLinks,
}: {
  locale: Locale;
  t: Dictionary;
  settings: SiteSettings;
  profile: OwnerProfile | null;
  languages: SpokenLanguage[];
  socialLinks: SocialLink[];
}) {
  // CMS content wins; the dictionary only supplies a floor so the hero is never
  // empty on a fresh install.
  const headline = settings.heroHeadline ?? profile?.headline ?? null;
  const subheadline = settings.heroSubheadline ?? profile?.bio ?? t.home.hero.intro;
  const location = settings.location ?? profile?.location ?? null;
  const portrait = profile?.avatarUrl ?? "/image/MyPF.jpg";

  /*
   * The hero name prefers `settings.siteName` over `profile.displayName`.
   *
   * `site_settings` stores site_name_en / site_name_km, so it resolves to
   * "រុន រស្មី" on the Khmer site. `profiles.display_name` is a single
   * locale-independent column, so it is always the Latin spelling — which meant
   * the Khmer homepage showed "Ron Raksmey" as the <h1> while the header and
   * footer beside it said "រុន រស្មី". `displayName` is still the right value
   * for the portrait's alt text, where the Latin spelling is harmless.
   */
  const displayName = settings.siteName ?? profile?.displayName;

  const builds = [
    t.home.hero.builds.libraries,
    t.home.hero.builds.platforms,
    t.home.hero.builds.tools,
    t.home.hero.builds.systems,
  ];

  return (
    <section
      data-scheme="ink"
      className="decorated relative bg-background text-foreground"
      /*
       * The header is `position: sticky`, so it occupies layout space and would
       * otherwise sit above the hero on the page background — leaving the
       * ink-scoped (light) header text on a light surface. Pulling the hero up
       * by exactly the header height puts it underneath the transparent header,
       * which is what the ink scope assumes. The grid's paddingTop below gives
       * the space back, so nothing is hidden.
       */
      style={{ marginTop: "calc(-1 * var(--header-height))" }}
    >
      {/* ── Decoration ──────────────────────────────────────────────────────
          Three cheap, static layers: a grid, a large primary wash behind the
          portrait, and a smaller warm wash on the opposite side. No canvas, no
          animation loop — v1 ran a permanent requestAnimationFrame here. */}
      <div aria-hidden="true" className="grid-lines" />
      <div
        aria-hidden="true"
        className="glow"
        style={{ "--glow-x": "72%", "--glow-y": "18%", "--glow-alpha": "0.22" } as object}
      />
      <div
        aria-hidden="true"
        className="glow"
        style={
          {
            "--glow-x": "8%",
            "--glow-y": "78%",
            "--glow-size": "45%",
            "--glow-color": "var(--glow-accent)",
            "--glow-alpha": "0.12",
          } as object
        }
      />

      <div className="container-content">
        <div
          className="grid items-center gap-12 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-24"
          // Clears the transparent fixed header without a magic number.
          style={{ paddingTop: "calc(var(--header-height) + clamp(2.5rem, 6vw, 5rem))" }}
        >
          {/* ── Copy ─────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-7">
            <Reveal className="flex flex-col gap-3">
              <p className="text-eyebrow font-semibold uppercase text-accent">
                {t.home.hero.greeting}
              </p>

              <h1 className="text-hero font-bold">{displayName}</h1>
            </Reveal>

            <Reveal delay={80} className="flex flex-col gap-4">
              {/*
                The positioning statement. If the CMS carries a hero headline it
                is used verbatim; otherwise the two-line dictionary version is
                shown. Either way this is an ordinary paragraph, not a second
                <h1>.
              */}
              {headline ? (
                <p className="max-w-[22ch] text-display font-semibold text-foreground">
                  {headline}
                </p>
              ) : (
                <p className="max-w-[22ch] text-display font-semibold text-foreground">
                  <span className="block">{t.home.hero.roleLine1}</span>
                  <span className="block text-foreground-muted">
                    {t.home.hero.roleLine2}
                  </span>
                </p>
              )}

              <p className="max-w-[54ch] text-body-lg text-foreground-muted">
                {subheadline}
              </p>
            </Reveal>

            {/* ── "I build …" ────────────────────────────────────────────── */}
            <Reveal delay={140}>
              <p className="flex flex-wrap items-baseline gap-x-3 text-h3 font-semibold">
                <span className="text-foreground-muted">{t.home.hero.buildsLabel}</span>
                <RotatingWords words={builds} />
              </p>
            </Reveal>

            {/* ── Status line ─────────────────────────────────────────────── */}
            <Reveal
              delay={200}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 text-small text-foreground-muted"
            >
              <span className="inline-flex items-center gap-2 rounded-(--radius-full) border border-border bg-surface px-3 py-1.5">
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
            </Reveal>

            {/* ── Actions ─────────────────────────────────────────────────── */}
            <Reveal delay={260} className="flex flex-wrap items-center gap-3">
              <ButtonLink
                href={localePath(locale, "projects")}
                variant="accent"
                size="lg"
                iconEnd="arrowRight"
                className="group rounded-(--radius-full) px-6"
              >
                {t.home.hero.exploreWork}
              </ButtonLink>

              <ButtonLink
                href={localePath(locale, "resume")}
                variant="outline"
                size="lg"
                iconStart="download"
                className="rounded-(--radius-full) px-6"
              >
                {t.home.hero.downloadResume}
              </ButtonLink>

              <ButtonLink
                href={localePath(locale, "contact")}
                variant="ghost"
                size="lg"
                iconStart="mail"
                className="rounded-(--radius-full) px-5"
              >
                {t.home.hero.contactMe}
              </ButtonLink>
            </Reveal>

            {/* ── Social ──────────────────────────────────────────────────── */}
            {socialLinks.length > 0 ? (
              <Reveal delay={320}>
                <ul className="flex flex-wrap items-center gap-2">
                  {socialLinks.map((link) => (
                    <li key={link.id}>
                      <OutboundLink
                        href={link.url}
                        newTabHint={t.a11y.opensInNewTab}
                        event={{
                          name: "social_link_click",
                          locale,
                          properties: { url: link.url, platform: link.platform },
                        }}
                        className="inline-flex size-11 items-center justify-center rounded-(--radius-full) border border-border bg-surface text-foreground-muted transition-colors duration-200 hover:border-border-interactive hover:bg-surface-muted hover:text-foreground"
                      >
                        <Icon name={toIconName(link.icon, "globe")} size={18} />
                        <span className="sr-only">{link.label}</span>
                      </OutboundLink>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ) : null}
          </div>

          {/* ── Portrait ─────────────────────────────────────────────────────
              Not a plain square card, per the brief. The portrait sits in a
              squircle with a gradient ring, over its own glow, with a soft
              accent blob behind one corner. */}
          <Reveal delay={160} className="order-first lg:order-none">
            <div className="relative mx-auto w-full max-w-[26rem]">
              {/* Glow directly behind the portrait. */}
              <div
                aria-hidden="true"
                className="absolute -inset-8 -z-10 rounded-full opacity-70 blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle at 50% 45%, rgb(var(--glow-primary) / 0.5), transparent 68%)",
                }}
              />

              {/* Organic accent shape, offset so it reads as depth rather than
                  a second frame. */}
              <div
                aria-hidden="true"
                className="absolute -bottom-6 -left-8 -z-10 size-40 rounded-full opacity-60 blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle, rgb(var(--glow-accent) / 0.55), transparent 70%)",
                }}
              />

              {/* Gradient ring: a padded wrapper whose background is the
                  gradient, so the ring follows the squircle exactly. */}
              <div
                className="rounded-[2.5rem] p-px"
                style={{
                  background:
                    "linear-gradient(150deg, rgb(var(--glow-primary) / 0.7), rgb(var(--glow-secondary) / 0.35) 45%, rgb(var(--glow-accent) / 0.55))",
                }}
              >
                <div className="relative aspect-[4/5] overflow-hidden rounded-[calc(2.5rem-1px)] bg-surface-raised">
                  {/*
                    The single `priority` image on the page. `fill` inside a
                    fixed aspect-ratio box reserves the space before the file
                    arrives, so this cannot contribute to layout shift.
                  */}
                  <Image
                    src={portrait}
                    alt={profile?.displayName ?? t.home.hero.portraitAlt}
                    fill
                    sizes="(min-width: 1024px) 26rem, (min-width: 640px) 60vw, 88vw"
                    priority
                    className="object-cover object-top"
                  />

                  {/* Grounds the portrait into the dark band instead of ending
                      at a hard edge. */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent"
                  />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── Credibility strip ───────────────────────════════════════════════════════

/**
 * Every figure is counted from published CMS rows by the `public_site_counts`
 * view. Zero values are dropped rather than displayed, because "0 certificates"
 * is not a credibility signal — and because nothing here may be a hardcoded
 * claim, which is exactly what v1's "2 Dual Degrees" was.
 *
 * Visually this continues the hero's ink band rather than starting a new white
 * one, so the page opens as a single dark chapter.
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
    <section
      data-scheme="ink"
      aria-labelledby="credibility-heading"
      className="bg-background text-foreground"
    >
      <div className="container-content pb-16">
        <h2 id="credibility-heading" className="sr-only">
          {t.home.credibility.heading}
        </h2>

        <Reveal>
          <hr className="rule-fade mb-10" />

          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((item) => (
              <div key={item.key} className="flex flex-col gap-1.5">
                <dd className="text-h1 font-bold tabular-nums text-gradient">
                  {item.value}
                </dd>
                <dt className="text-[0.8125rem] leading-snug text-foreground-muted">
                  {item.label}
                </dt>
              </div>
            ))}
          </dl>

          <p className="mt-8 text-[0.8125rem] text-foreground-subtle">
            {t.home.credibility.note}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ── Section heading ─────────────────────────════════════════════════════════

/**
 * Local section header for the homepage.
 *
 * Distinct from the shared `SectionHeading` primitive: this one carries the
 * large faint watermark numeral that gives the page its rhythm, and it keeps
 * the eyebrow, title and action on one line at desktop width.
 */
function SectionHead({
  id,
  eyebrow,
  title,
  description,
  action,
  watermark,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Decorative numeral, e.g. "01". */
  watermark?: string;
}) {
  return (
    <div className="relative flex flex-col gap-5">
      {watermark ? (
        <span
          aria-hidden="true"
          className="watermark -top-8 right-0 text-[7rem] sm:text-[10rem]"
        >
          {watermark}
        </span>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-[46ch] flex-col gap-3">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {eyebrow}
          </p>

          <h2 id={id} className="text-h2">
            {title}
          </h2>
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {description ? (
        <p className="max-w-[62ch] text-body-lg text-foreground-muted">{description}</p>
      ) : null}
    </div>
  );
}

// ── Featured projects ───────────────────────════════════════════════════════

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
    <section
      aria-labelledby="featured-projects-heading"
      className="decorated section-y"
    >
      <div className="container-content flex flex-col gap-14">
        <Reveal>
          <SectionHead
            id="featured-projects-heading"
            eyebrow={t.home.featured.eyebrow}
            title={t.home.featured.heading}
            description={t.home.featured.description}
            /* No watermark here: each showcase already carries its own large
               numeral, and a second "01" in the corner read as a duplicate. */
            action={
              projects.length > 0 ? (
                <ButtonLink
                  href={localePath(locale, "projects")}
                  variant="outline"
                  iconEnd="arrowRight"
                  className="group rounded-(--radius-full) px-5"
                >
                  {t.home.featured.viewAll}
                </ButtonLink>
              ) : undefined
            }
          />
        </Reveal>

        {projects.length === 0 ? (
          <LivePlatformsFallback locale={locale} t={t} />
        ) : (
          <div className="flex flex-col gap-20 lg:gap-28">
            {projects.map((project, index) => (
              <Reveal key={project.id}>
                <ProjectShowcase
                  project={project}
                  locale={locale}
                  t={t}
                  index={index}
                  priority={index === 0}
                />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Empty-state for the featured-projects section.
 *
 * The brief is explicit that "there are no published projects yet" makes the
 * portfolio look unfinished. These platforms are live, so the empty state links
 * to them and frames the gap accurately: the case studies are what is missing,
 * not the work.
 */
export function LivePlatformsFallback({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h3 className="text-h3">{t.home.featured.emptyHeading}</h3>
        <p className="max-w-[56ch] text-body-lg text-foreground-muted">
          {t.home.featured.emptyBody}
        </p>
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {livePlatforms.map((platform, index) => (
          <li key={platform.key} className="flex">
            <Reveal
              delay={index * 70}
              className="lift group flex flex-1 flex-col gap-4 rounded-(--radius-lg) border border-border bg-surface p-6 hover:border-border-interactive hover:shadow-(--shadow-lg)"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-[0.8125rem] text-foreground-muted">
                  <StatusDot tone="success" />
                  {t.home.featured.liveNow}
                </span>
                <Icon
                  name="externalLink"
                  size={16}
                  className="text-foreground-subtle transition-colors group-hover:text-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <h4 className="text-h4 font-semibold">
                  <OutboundLink
                    href={platform.url}
                    newTabHint={t.a11y.opensInNewTab}
                    event={{
                      name: "project_live_link_click",
                      locale,
                      properties: { url: platform.url, source: "empty_state" },
                    }}
                    className="after:absolute after:inset-0 after:content-[''] hover:text-primary"
                  >
                    {platform.name}
                  </OutboundLink>
                </h4>
                <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-foreground-subtle">
                  {platform.kind[locale]}
                </p>
              </div>

              <p className="text-small text-foreground-muted">{platform.blurb[locale]}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── About preview ───────────────────────════════════════════════════════════

/**
 * Asymmetric about block: story on the left, a short fact list on the right.
 *
 * Replaces v2's four large bordered capability cards, which the brief singled
 * out. Facts come from the CMS where they exist and are simply dropped when
 * they do not — none of them is invented.
 */
export function AboutPreview({
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
  const story = profile?.bio ?? settings.positioning ?? t.home.about.body;
  const location = settings.location ?? profile?.location ?? null;

  const facts = [
    location ? { key: "location", label: t.home.about.locationLabel, value: location } : null,
    languages.length > 0
      ? {
          key: "languages",
          label: t.home.about.languagesLabel,
          value: languages.map((language) => language.name).join(" · "),
        }
      : null,
    settings.availabilityStatus
      ? { key: "focus", label: t.home.about.focusHeading, value: settings.availabilityStatus }
      : null,
  ].filter((fact): fact is { key: string; label: string; value: string } => fact !== null);

  return (
    <section aria-labelledby="about-preview-heading" className="decorated section-y">
      <div
        aria-hidden="true"
        className="glow"
        style={
          {
            "--glow-x": "12%",
            "--glow-y": "30%",
            "--glow-size": "42%",
            "--glow-color": "var(--glow-secondary)",
            "--glow-alpha": "0.1",
          } as object
        }
      />

      <div className="container-content grid gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-20">
        <Reveal className="flex flex-col gap-6">
          <SectionHead
            id="about-preview-heading"
            eyebrow={t.home.about.eyebrow}
            title={t.home.about.heading}
            watermark="01"
          />

          {/* The profile view returns bio already resolved for this locale, so
              no `lang` override is needed here. */}
          <p className="max-w-[60ch] text-body-lg leading-relaxed text-foreground-muted">
            {story}
          </p>

          <div>
            <Link
              href={localePath(locale, "about")}
              className="group inline-flex items-center gap-2 text-body font-semibold text-primary"
            >
              {t.home.about.readMore}
              <Icon name="arrowRight" size={17} className="travel" />
            </Link>
          </div>
        </Reveal>

        {facts.length > 0 ? (
          <Reveal delay={120} className="lg:pt-4">
            {/*
              The heading sits *outside* the <dl>. A definition list may only
              directly contain dt, dd, div, script or template — a <p> in there
              is invalid markup, and axe flags it as a serious violation.
            */}
            <p className="mb-5 text-eyebrow font-semibold uppercase text-foreground-subtle">
              {t.home.about.factsHeading}
            </p>

            <dl className="flex flex-col">
              {facts.map((fact) => (
                <div
                  key={fact.key}
                  className="flex flex-col gap-1 border-t border-border py-4 first-of-type:border-t-0 first-of-type:pt-0"
                >
                  <dt className="text-[0.8125rem] font-medium uppercase tracking-wide text-foreground-subtle">
                    {fact.label}
                  </dt>
                  <dd className="text-body font-medium text-foreground">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

// ── Capabilities ────────────────────────════════════════════════════════════

/**
 * Capabilities, without the checklist.
 *
 * v2 rendered every skill as a checkmark row with an "evidenced by" line under
 * it, which produced the wall of ticks the brief rejected. This keeps the same
 * honest data model — no self-assessed percentages, ever — but presents it as
 * a scrolling strip of skill names plus four compact groups. The evidence links
 * still exist; they now live on the group, where there is room for them.
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

  // Flattened for the marquee. Duplicated once in the markup below so the
  // translation loops seamlessly; the copy is aria-hidden.
  const allSkills = groups.flatMap((group) => group.skills.map((skill) => skill.name));

  // Distinct projects per group, so a project referenced by three skills in the
  // same group is only listed once. Zipped onto the group here rather than held
  // in a parallel array, so the two can never fall out of step.
  const groupsWithEvidence = groups.map((group) => {
    const seen = new Map<string, { id: string; slug: string; title: string }>();
    for (const skill of group.skills) {
      for (const project of skill.projects) {
        if (!seen.has(project.id)) seen.set(project.id, project);
      }
    }
    return { group, evidence: Array.from(seen.values()) };
  });

  return (
    <section
      aria-labelledby="capabilities-heading"
      className="decorated section-y border-y border-border bg-surface-muted/40"
    >
      <div className="flex flex-col gap-12">
        <div className="container-content">
          <Reveal>
            <SectionHead
              id="capabilities-heading"
              eyebrow={t.home.capabilities.eyebrow}
              title={t.home.capabilities.heading}
              description={t.home.capabilities.description}
              watermark="02"
            />
          </Reveal>
        </div>

        {/* ── Skill marquee ────────────────────────────────────────────────
            Full-bleed, so it reads as a band rather than another boxed row.
            Paused on hover and focus (see `.marquee` in globals.css). */}
        {allSkills.length > 0 ? (
          <div
            className="marquee"
            style={{ "--marquee-gap": "0.75rem", "--marquee-duration": "58s" } as object}
          >
            {[0, 1].map((copy) => (
              <ul
                key={copy}
                className="marquee__track"
                // The second copy is decorative: it exists only so the
                // translation loops without a visible seam.
                aria-hidden={copy === 1 ? "true" : undefined}
              >
                {allSkills.map((skill, index) => (
                  <li key={`${copy}-${skill}-${index}`}>
                    <span className="inline-flex whitespace-nowrap rounded-(--radius-full) border border-border bg-surface px-4 py-2 text-small font-medium text-foreground-muted">
                      {skill}
                    </span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        ) : null}

        {/* ── Groups ───────────────────────────────────────────────────── */}
        <div className="container-content">
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {groupsWithEvidence.map(({ group, evidence }, index) => (
              <li key={group.id}>
                <Reveal delay={index * 70} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-(--radius-md) bg-primary-subtle text-primary-subtle-foreground">
                      <Icon name={toIconName(group.icon, "target")} size={20} />
                    </span>
                    <h3 className="text-h4 font-semibold">{group.name}</h3>
                  </div>

                  {group.description ? (
                    <p className="text-small text-foreground-muted">{group.description}</p>
                  ) : null}

                  {/* Skill names as plain inline text, not a ticked list. */}
                  <p className="text-small leading-relaxed text-foreground-muted">
                    {group.skills.map((skill) => skill.name).join(" · ")}
                  </p>

                  {evidence.length > 0 ? (
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.8125rem] text-foreground-subtle">
                      <span>{t.home.capabilities.evidencedBy}:</span>
                      {evidence.map((project, projectIndex, list) => (
                        <span key={project.id}>
                          <Link
                            href={localePath(locale, `projects/${project.slug}`)}
                            className="text-primary underline underline-offset-2 hover:decoration-2"
                          >
                            {project.title}
                          </Link>
                          {projectIndex < list.length - 1 ? "," : null}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </Reveal>
              </li>
            ))}
          </ul>
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
      <div className="container-content flex flex-col gap-10">
        <Reveal>
          <SectionHead
            id="certificates-preview-heading"
            eyebrow={t.home.certificates.eyebrow}
            title={t.home.certificates.heading}
            watermark="03"
            action={
              certificates.length > 0 ? (
                <ButtonLink
                  href={localePath(locale, "certificates")}
                  variant="outline"
                  iconEnd="arrowRight"
                  className="group rounded-(--radius-full) px-5"
                >
                  {t.home.certificates.viewAll}
                </ButtonLink>
              ) : undefined
            }
          />
        </Reveal>

        {certificates.length === 0 ? (
          // Compact and calm, per the brief — not a full-width bordered box.
          <Reveal className="flex max-w-[52ch] flex-col gap-2 rounded-(--radius-lg) bg-surface-muted/60 p-8">
            <h3 className="flex items-center gap-2.5 text-h4 font-semibold">
              <Icon name="shield" size={20} className="text-secondary" />
              {t.home.certificates.emptyHeading}
            </h3>
            <p className="text-small text-foreground-muted">
              {t.home.certificates.emptyBody}
            </p>
          </Reveal>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {certificates.map((certificate, index) => (
              <li key={certificate.id} className="flex">
                <Reveal delay={index * 60} className="flex flex-1">
                  <CertificateCard certificate={certificate} locale={locale} t={t} />
                </Reveal>
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
 * Rebuilt as a hairline timeline: each entry is now type on a rule with a node,
 * not a bordered card. That is the brief's "do not turn each experience into a
 * heavy dashboard card", and it also lets the year column carry the hierarchy.
 *
 * Uses the `periodLabel` when present — the honest precision for migrated v1
 * content — and only formats a stored date when no label exists.
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
      className="decorated section-y border-y border-border bg-surface-muted/40"
    >
      <div className="container-content flex flex-col gap-12">
        <Reveal>
          <SectionHead
            id="journey-heading"
            eyebrow={t.home.journey.eyebrow}
            title={t.home.journey.heading}
            watermark="04"
            action={
              <ButtonLink
                href={localePath(locale, "experience")}
                variant="outline"
                iconEnd="arrowRight"
                className="group rounded-(--radius-full) px-5"
              >
                {t.home.journey.viewAll}
              </ButtonLink>
            }
          />
        </Reveal>

        <Timeline locale={locale} t={t} items={items} />
      </div>
    </section>
  );
}

/**
 * Shared hairline timeline, also used by the experience page.
 *
 * Desktop lays out as `year | rule | content` via a subgrid-free three-column
 * grid; mobile collapses to the rule and content only, with the period moving
 * above the title.
 */
export function Timeline({
  locale,
  t,
  items,
}: {
  locale: Locale;
  t: Dictionary;
  items: Array<{
    id: string;
    kind: "education" | "experience";
    title: string;
    organization: string;
    organizationUrl: string | null;
    period: string | null;
    description: string | null;
    detail: string | null;
    isCurrent: boolean;
    contentLocale: Locale | null;
    tags: string[];
  }>;
}) {
  return (
    <ol className="flex flex-col">
      {items.map((item, index) => (
        <li key={item.id}>
          <Reveal
            delay={Math.min(index, 6) * 50}
            className="grid gap-x-8 sm:grid-cols-[8rem_1fr]"
          >
            {/* ── Year column (desktop) ──────────────────────────────────── */}
            <div className="hidden pt-8 sm:block">
              {item.period ? (
                <p className="font-mono text-[0.8125rem] leading-relaxed text-foreground-subtle">
                  {item.period}
                </p>
              ) : null}
            </div>

            {/* ── Rule + content ─────────────────────────────────────────── */}
            <div
              className={cn(
                "relative flex flex-col gap-2.5 border-s border-border py-8 ps-7",
                // The last entry's rule stops at its content rather than
                // running into the section padding.
                index === items.length - 1 && "border-s-transparent",
              )}
            >
              {/* Re-draws the rule for the final item, stopping at the node. */}
              {index === items.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute -start-px top-0 h-[2.75rem] w-px bg-border"
                />
              ) : null}

              <span
                aria-hidden="true"
                className={cn(
                  "absolute -start-[5px] top-[2.15rem] size-2.5 rounded-full ring-4",
                  item.isCurrent
                    ? "bg-accent ring-surface-muted"
                    : "bg-border-strong ring-surface-muted",
                )}
              />

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {/* Period repeats on mobile, where the year column is hidden. */}
                {item.period ? (
                  <span className="font-mono text-[0.8125rem] text-foreground-subtle sm:hidden">
                    {item.period}
                  </span>
                ) : null}

                <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-foreground-subtle">
                  <Icon
                    name={item.kind === "education" ? "graduation" : "briefcase"}
                    size={14}
                  />
                  {item.kind === "education" ? t.education.title : t.experience.title}
                </span>

                {item.isCurrent ? (
                  <span className="inline-flex items-center gap-1.5 rounded-(--radius-full) bg-success-subtle px-2.5 py-0.5 text-[0.75rem] font-semibold text-success-foreground">
                    <StatusDot tone="success" className="size-1.5" />
                    {t.home.journey.present}
                  </span>
                ) : null}
              </div>

              <h3
                className="text-h4 font-semibold"
                lang={langAttribute(locale, item.contentLocale)}
              >
                {item.title}
              </h3>

              <p className="text-small font-medium text-foreground-muted">
                {item.organizationUrl ? (
                  <SmartLink
                    href={item.organizationUrl}
                    newTabHint={t.a11y.opensInNewTab}
                    className="underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
                  >
                    {item.organization}
                  </SmartLink>
                ) : (
                  item.organization
                )}
              </p>

              {item.description ? (
                <p
                  className="max-w-[68ch] text-small text-foreground-muted"
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
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
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
      <div className="container-content flex flex-col gap-10">
        <Reveal>
          <SectionHead
            id="testimonials-heading"
            eyebrow={t.home.testimonials.eyebrow}
            title={t.home.testimonials.heading}
            watermark="05"
          />
        </Reveal>

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => {
            const avatar = resolveImage(testimonial.avatar, locale, "thumbnail");

            return (
              <li key={testimonial.id} className="flex">
                <Reveal delay={index * 70} className="flex flex-1">
                  <figure className="lift flex flex-1 flex-col gap-5 rounded-(--radius-lg) border border-border bg-surface p-6 hover:border-border-interactive hover:shadow-(--shadow-md)">
                    <Icon name="lightbulb" size={20} className="text-accent-subtle-foreground" />

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
                              className="underline decoration-transparent underline-offset-2 hover:decoration-current"
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
                  </figure>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ── Contact CTA ─────────────────════════════════════════════════════════════

/**
 * Closing call to action.
 *
 * Ink-scoped and decorated so it and the footer read as one dark closing
 * chapter rather than a coloured band followed by an unrelated directory.
 */
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
      data-scheme="ink"
      aria-labelledby="contact-cta-heading"
      className="decorated bg-background text-foreground"
    >
      <div aria-hidden="true" className="grid-lines" style={{ "--grid-alpha": "0.04" } as object} />
      <div
        aria-hidden="true"
        className="glow"
        style={{ "--glow-x": "50%", "--glow-y": "12%", "--glow-size": "62%", "--glow-alpha": "0.2" } as object}
      />

      <div className="container-content flex flex-col items-center gap-7 py-24 text-center">
        <Reveal className="flex flex-col items-center gap-5">
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-(--radius-lg) border border-border bg-surface text-accent"
          >
            <Icon name="send" size={24} />
          </span>

          <h2 id="contact-cta-heading" className="text-display max-w-[20ch] font-bold">
            {t.home.cta.heading}
          </h2>

          <p className="max-w-[54ch] text-body-lg text-foreground-muted">
            {t.home.cta.description}
          </p>
        </Reveal>

        <Reveal delay={120} className="flex flex-wrap justify-center gap-3 pt-2">
          <ButtonLink
            href={localePath(locale, "contact")}
            variant="accent"
            size="lg"
            iconStart="send"
            className="rounded-(--radius-full) px-6"
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
              className="inline-flex min-h-12 items-center gap-2 rounded-(--radius-full) border border-border-strong bg-surface px-6 text-[1.0625rem] font-medium transition-colors hover:bg-surface-muted"
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
              className="inline-flex min-h-12 items-center gap-2 rounded-(--radius-full) border border-border-strong bg-surface px-6 text-[1.0625rem] font-medium transition-colors hover:bg-surface-muted"
            >
              <Icon name="telegram" size={18} />
              {t.home.cta.telegram}
            </OutboundLink>
          ) : null}
        </Reveal>

        {/* Sets an honest expectation instead of implying an instant reply. */}
        <p className="pt-2 text-small text-foreground-subtle">{t.contact.responseTime}</p>
      </div>
    </section>
  );
}
