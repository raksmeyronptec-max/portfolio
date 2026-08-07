import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Icon, toIconName } from "@/components/ui/icon";
import { SmartLink, StatusDot, Tag } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/reveal";
import { HeroLens } from "@/components/public/hero-lens";
import { HeroPortrait } from "@/components/public/hero-portrait";
import { OutboundLink } from "@/components/public/outbound-link";
import { ProjectShowcase } from "@/components/public/project-showcase";
import { CertificateCard } from "@/components/public/certificate-card";
import { interpolate, type Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { langAttribute } from "@/lib/content/translation";
import type { CapabilityGroup, EducationEntry, ExperienceEntry, Testimonial } from "@/lib/data/cv";
import { PublicationCard } from "./publication-card";
import type { PublicationSummary } from "@/lib/content/publication";
import type { JourneyEntrySummary } from "@/lib/content/journey";
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
  settings: _settings,
  profile,
}: {
  locale: Locale;
  t: Dictionary;
  settings: SiteSettings;
  profile: OwnerProfile | null;
}) {
  const portrait = profile?.avatarUrl ?? "/image/portrait-keyed.webp";
  const labels =
    locale === "km"
      ? {
          viewWork: "មើលស្នាដៃរបស់ខ្ញុំ",
          contact: "ទាក់ទងមកខ្ញុំ",
          availability: "បើកចំហសម្រាប់កិច្ចសហការផ្នែកអប់រំ និងផលិតផលឌីជីថល",
          proof: "វេទិកា ៣ កំពុងដំណើរការ",
          stats: [
            { value: "3", label: "គម្រោងបានបោះពុម្ព" },
            { value: "114+", label: "ធនធានឌីជីថលបានផ្តល់ជូន" },
            { value: "26", label: "មេរៀនថ្នាក់រៀនបានបង្កើត" },
          ],
        }
      : {
          viewWork: "View my work",
          contact: "Get in touch",
          availability: "Open to education and digital-product collaborations",
          proof: "3 platforms in production",
          stats: [
            { value: "3", label: "published projects" },
            { value: "114+", label: "digital resources served" },
            { value: "26", label: "classroom modules built" },
          ],
        };

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
          className="home-hero-layout"
          style={{ paddingTop: "calc(var(--header-height) + clamp(1.75rem, 4vw, 3.25rem))" }}
        >
          <div className="home-hero-copy">
            <HeroLens locale={locale} />

            <div className="home-hero-actions">
              <Link href="#work" className="home-hero-action home-hero-action--primary">
                {labels.viewWork}
              </Link>
              <Link
                href={localePath(locale, "contact")}
                className="home-hero-action home-hero-action--secondary"
              >
                {labels.contact}
              </Link>
            </div>

            <p className="home-hero-availability">
              <span aria-hidden="true">●</span>
              {labels.availability}
            </p>
          </div>

          <Reveal delay={120}>
            <HeroPortrait
              src={portrait}
              alt={profile?.displayName ?? t.home.hero.portraitAlt}
              proofLabel={labels.proof}
            />
          </Reveal>
        </div>

        <dl className="home-hero-stats" aria-label={locale === "km" ? "ស្ថិតិសង្ខេប" : "Impact at a glance"}>
          {labels.stats.map((stat) => (
            <div key={stat.label}>
              <dd>{stat.value}</dd>
              <dt>{stat.label}</dt>
            </div>
          ))}
        </dl>
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
  location,
  languages,
}: {
  t: Dictionary;
  counts: SiteCounts;
  /** Moved down out of the hero — see the note on the hero's availability row. */
  location?: string | null;
  languages?: SpokenLanguage[];
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

          {/* ── Supporting metadata ─────────────────────────────────────────
              Location and spoken languages, relocated from the hero. They are
              real facts worth stating, but stating them beside the value
              proposition made a visitor weigh six things at once. Both are
              dropped entirely when the CMS has not recorded them, rather than
              rendering a label with nothing after it. */}
          {location || (languages && languages.length > 0) ? (
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-6 text-small text-foreground-muted">
              {location ? (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="mapPin" size={15} aria-hidden />
                  {interpolate(t.home.hero.basedIn, { location })}
                </span>
              ) : null}

              {languages && languages.length > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="languages" size={15} aria-hidden />
                  <span className="sr-only">{t.home.hero.speaks}: </span>
                  {languages.map((language) => language.name).join(" · ")}
                </span>
              ) : null}
            </div>
          ) : null}

          <p className="mt-6 text-[0.8125rem] text-foreground-subtle">
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
      id="work"
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

// ── Selected moments ────────────────────────────────────────────────────────

/**
 * The homepage's curated strip of journey stories.
 *
 * Distinct from `Journey` below, which is the education/experience timeline —
 * that one answers "what has he done", this one answers "what did it look like".
 *
 * Four to six entries, never the whole collection. The homepage is a summary and
 * the point of the Journey page is that it holds the rest; putting a wall of
 * photographs here would make the homepage a feed, which is the outcome the whole
 * information architecture is arranged to avoid.
 *
 * Renders nothing at all when no story is featured. An empty state here would be
 * a box announcing an absence on the most important page of the site.
 */
export function SelectedMoments({
  locale,
  t,
  entries,
}: {
  locale: Locale;
  t: Dictionary;
  entries: JourneyEntrySummary[];
}) {
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="moments-heading" className="section-y">
      <div className="container-content flex flex-col gap-10">
        <Reveal>
          <SectionHead
            id="moments-heading"
            eyebrow={t.home.moments.eyebrow}
            title={t.home.moments.heading}
            description={t.home.moments.description}
            watermark="04"
            action={
              <ButtonLink
                href={localePath(locale, "journey")}
                variant="outline"
                iconEnd="arrowRight"
                className="group rounded-(--radius-full) px-5"
              >
                {t.home.moments.viewAll}
              </ButtonLink>
            }
          />
        </Reveal>

        {/*
          Three across on desktop, two on a tablet, one on a phone. Six featured
          entries therefore fill exactly two rows, which is why the data layer
          caps at six.
        */}
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, index) => (
            <li key={entry.id} className="flex">
              <Reveal delay={index * 60} className="flex flex-1">
                <MomentCard locale={locale} t={t} entry={entry} />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function MomentCard({
  locale,
  t,
  entry,
}: {
  locale: Locale;
  t: Dictionary;
  entry: JourneyEntrySummary;
}) {
  const href = localePath(locale, `journey/${entry.slug}`);
  const lang = langAttribute(locale, entry.isFallback ? entry.contentLocale : null);

  return (
    <article className="group flex flex-1 flex-col gap-3">
      {entry.cover ? (
        <Link
          href={href}
          tabIndex={-1}
          // Excluded from the tab order: the heading below links to the same
          // place, and two adjacent tab stops to one destination is noise.
          aria-hidden="true"
          className={cn(
            "relative block aspect-[4/3] overflow-hidden rounded-(--radius-lg)",
            "border border-border bg-surface-muted",
          )}
        >
          <Image
            src={entry.cover.src}
            alt=""
            fill
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 100vw"
            loading="lazy"
            placeholder={entry.cover.blurDataURL ? "blur" : undefined}
            blurDataURL={entry.cover.blurDataURL ?? undefined}
            style={
              entry.cover.objectPosition
                ? { objectPosition: entry.cover.objectPosition }
                : undefined
            }
            className={cn(
              "object-cover transition-transform duration-500 group-hover:scale-[1.02]",
              "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
            )}
          />

          {entry.videoCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent"
            >
              <span className="flex size-11 items-center justify-center rounded-(--radius-full) bg-white/90 text-black">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              </span>
            </span>
          ) : null}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem]">
        {entry.year ? (
          <span className="font-mono text-foreground-subtle tabular-nums">
            {entry.year}
          </span>
        ) : null}
        {entry.category ? (
          <>
            {entry.year ? (
              <span aria-hidden="true" className="text-foreground-subtle">
                ·
              </span>
            ) : null}
            <span className="text-foreground-muted">{entry.category.name}</span>
          </>
        ) : null}
      </div>

      <h3 className="text-[1.0625rem] font-semibold leading-snug text-balance">
        <Link
          href={href}
          lang={lang}
          className={cn(
            "underline decoration-transparent underline-offset-4 transition-colors",
            "hover:decoration-current",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
          )}
        >
          {entry.title}
        </Link>
      </h3>

      {entry.summary ? (
        <p
          lang={lang}
          className="line-clamp-3 text-small leading-relaxed text-foreground-muted"
        >
          {entry.summary}
        </p>
      ) : null}

      <p className="mt-auto pt-1">
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-foreground-muted transition-colors group-hover:text-foreground"
        >
          {t.home.moments.viewStory}
          <Icon name="arrowRight" size={14} />
        </Link>
      </p>
    </article>
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
/**
 * Selected publications.
 *
 * Three or four authored books, never the whole shelf. Deliberately does NOT
 * mount a PDF viewer or a download control: the homepage's job is to establish
 * that these exist, and a reader who wants the book goes to its page, where the
 * download policy and the file size can be stated properly.
 *
 * Renders nothing when nothing is featured, like every other optional section
 * here — an empty band with a heading is worse than no band.
 */
export function SelectedPublications({
  locale,
  t,
  publications,
}: {
  locale: Locale;
  t: Dictionary;
  publications: PublicationSummary[];
}) {
  if (publications.length === 0) return null;

  return (
    <section aria-labelledby="publications-heading" className="section-y">
      <div className="container-content flex flex-col gap-10">
        <Reveal>
          <SectionHead
            id="publications-heading"
            eyebrow={t.home.publications.eyebrow}
            title={t.home.publications.heading}
            description={t.home.publications.description}
            watermark="05"
            action={
              <ButtonLink
                href={localePath(locale, "publications")}
                variant="outline"
                iconEnd="arrowRight"
                className="group rounded-(--radius-full) px-5"
              >
                {t.home.publications.viewAll}
              </ButtonLink>
            }
          />
        </Reveal>

        {/*
          Three across on desktop. The data layer caps at four, so a fourth book
          wraps to a second row rather than being silently dropped.
        */}
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {publications.map((publication, index) => (
            <li key={publication.id} className="flex">
              <Reveal delay={index * 60} className="flex flex-1">
                <PublicationCard
                  publication={publication}
                  locale={locale}
                  headingLevel="h3"
                />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

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

  /*
   * Curated, not complete.
   *
   * This rendered every published education and experience row — nine entries
   * on the live site, running from two current degrees down to a Grade 9
   * diploma. That is the Experience page's job. A homepage timeline that long
   * stops being a summary and starts being a second copy of a dedicated page,
   * which is the specific thing the brief asks the homepage not to do.
   *
   * Five, taken off a sort that already puts current roles first and then works
   * backwards, keeps both degrees in progress and the most recent placements
   * while dropping school-leaving certificates that the credentials section
   * covers anyway. "View full experience" below reaches the rest.
   */
  const visible = items.slice(0, 5);
  const hiddenCount = items.length - visible.length;

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

        <Timeline locale={locale} t={t} items={visible} />

        {hiddenCount > 0 ? (
          <p className="text-small text-foreground-subtle">
            {interpolate(t.home.journey.moreEntries, {
              count: String(hiddenCount),
            })}
          </p>
        ) : null}
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
 *
 * `media` is an optional slot rather than a photo prop. The timeline is shared
 * with the homepage, which renders no photographs at all, and a `photos` prop
 * would drag the gallery's client bundle into a page that never uses it. Passing
 * a node keeps the homepage exactly as it was.
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
    /** Rendered after the prose and before the tags. Omitted when absent. */
    media?: ReactNode;
    /**
     * DOM id for deep-linking. A journey story links back to the specific role
     * or institution it evidences, and Experience/Education have no per-entry
     * page — the anchor is what makes "View the related experience" land on the
     * right entry rather than the top of the listing.
     */
    anchorId?: string;
    /** Rendered after the tags. Used for the journey cross-links. */
    footer?: ReactNode;
  }>;
}) {
  return (
    <ol className="flex flex-col">
      {items.map((item, index) => (
        <li key={item.id} id={item.anchorId} className={item.anchorId ? "scroll-mt-24" : undefined}>
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

              {/*
                Photographs sit after the prose deliberately. The role, the
                organisation and what was done are the professional evidence;
                the image corroborates it and must not be read first.
              */}
              {item.media ?? null}

              {item.tags.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5 pt-1">
                  {/*
                    Deduplicated, because the tag list is the entry's kind label
                    followed by its own tags — and an entry of kind "Practicum"
                    that is also tagged "Practicum" produced two children with
                    the same key. React warns about it, and the duplicate chip
                    was visible on the page.
                  */}
                  {[...new Set(item.tags)].map((tag) => (
                    <li key={tag}>
                      <Tag>{tag}</Tag>
                    </li>
                  ))}
                </ul>
              ) : null}

              {/*
                After the tags: the journey cross-link is a way *out* of this
                entry, so it comes last. Putting it above the tags would interrupt
                the entry's own description with a link to a different page.
              */}
              {item.footer ?? null}
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
