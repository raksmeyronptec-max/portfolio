import { Icon } from "@/components/ui/icon";
import { SmartLink, StatusDot, Tag } from "@/components/ui/primitives";
import { ExperiencePhotos } from "@/components/public/experience-photos";
import { JourneyStoryLinks } from "@/components/public/journey-story-links";
import { langAttribute } from "@/lib/content/translation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import type { LinkedJourneyStory } from "@/lib/data/journey";
import {
  PRIMARY_CONTRIBUTION_LIMIT,
  type ExperienceView,
} from "@/lib/content/experience-view";
import { cn } from "@/lib/utils/cn";
import { kindMark, trackMark } from "./marks";

/**
 * One experience entry, at one of two weights.
 *
 * ── Why two weights and not two components ─────────────────────────────────
 * The old page gave five entries identical treatment, which is what made it
 * read as a feed: nothing on it said which work mattered most. The obvious fix
 * — a "featured" section above the timeline — would have printed the same role
 * twice under two headings, and the second copy always drifts.
 *
 * So the hierarchy lives *in* the chronology. The current role on each track
 * renders at editorial weight, in place, and everything else renders compact.
 * One data source, one rendering, one place to fix a typo.
 *
 * ── What is on the card, and what is behind the disclosure ─────────────────
 * The card carries what a reader scanning the page needs: when, what, where,
 * two sentences, up to three contributions and up to three skills. Everything
 * else — the full narrative, the remaining contributions and skills, the linked
 * products, the organisation link — is in a `<details>` panel.
 *
 * `<details>` rather than a React accordion, deliberately. It supplies the
 * button semantics, `aria-expanded` and the control/panel association natively,
 * it works before hydration and without JavaScript at all, and its content
 * stays in the server-rendered HTML — so the full text is still indexed and
 * still findable with the browser's own search.
 */

export function ExperienceEntryCard({
  locale,
  t,
  view,
  stories,
}: {
  locale: Locale;
  t: Dictionary;
  view: ExperienceView;
  stories: LinkedJourneyStory[] | undefined;
}) {
  const contentLang = langAttribute(locale, view.contentLocale);

  /*
   * The featured card shows every contribution — it is the editorial treatment
   * and the list is the substance of it. A compact card shows three and the
   * panel continues from there, so nothing is printed twice.
   */
  const visibleContributions = view.featured
    ? view.contributions
    : view.contributions.slice(0, PRIMARY_CONTRIBUTION_LIMIT);
  const remainingContributions = view.contributions.slice(
    visibleContributions.length,
  );
  const remainingTags = view.tags.slice(view.primaryTags.length);

  const hasPanel =
    Boolean(view.description) ||
    remainingContributions.length > 0 ||
    remainingTags.length > 0 ||
    view.relatedProjects.length > 0 ||
    Boolean(view.organizationUrl) ||
    (stories?.length ?? 0) > 0;

  const media =
    view.cover !== null ? (
      <ExperiencePhotos
        locale={locale}
        t={t}
        cover={view.cover}
        gallery={view.gallery}
        entryLabel={view.roleTitle}
      />
    ) : null;

  const body = (
    <>
      {view.summary ? (
        <p
          className={cn(
            "max-w-[62ch] text-foreground-muted",
            view.featured ? "text-body-lg" : "text-body",
          )}
          lang={contentLang}
        >
          {view.summary}
        </p>
      ) : null}

      {visibleContributions.length > 0 ? (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-eyebrow font-semibold uppercase text-foreground-subtle">
            {t.experience.card.contributions}
          </p>
          <ContributionList
            items={visibleContributions}
            lang={contentLang}
            mark={kindMark(view.kind, view.track)}
          />
        </div>
      ) : null}
    </>
  );

  return (
    <article
      id={view.anchorId}
      className={cn(
        "group/entry relative scroll-mt-24 overflow-hidden rounded-(--radius-xl)",
        "border border-border bg-surface shadow-(--shadow-xs)",
        "transition-[border-color,box-shadow] hover:border-border-strong",
        view.featured ? "p-5 sm:p-7 lg:p-8" : "p-5 sm:p-6",
      )}
    >
      {/*
        The category mark: a one-pixel top edge, not a coloured card. It is
        redundant with the track name printed directly underneath it, so it
        carries no meaning of its own.
      */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, ${kindMark(view.kind, view.track)}, transparent 72%)`,
        }}
      />

      <div className="flex flex-col gap-4">
        <EntryHeader locale={locale} t={t} view={view} />

        {view.featured && media ? (
          /*
            Featured: the photograph shares the row with the prose on wide
            screens and stacks above it below `lg`. It is never the first thing
            in the DOM — the role and what was done are the evidence; the
            photograph corroborates them.
          */
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8">
            <div className="flex flex-col gap-4 lg:order-2">{body}</div>
            <div className="lg:order-1">{media}</div>
          </div>
        ) : (
          <>
            {body}
            {media}
          </>
        )}

        {view.primaryTags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {view.primaryTags.map((tag) => (
              <li key={tag.key}>
                <Tag>{tag.label}</Tag>
              </li>
            ))}
          </ul>
        ) : null}

        {hasPanel ? (
          <EntryDetails
            locale={locale}
            t={t}
            view={view}
            stories={stories}
            contentLang={contentLang}
            remainingContributions={remainingContributions}
            remainingTags={remainingTags}
          />
        ) : null}
      </div>
    </article>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

function EntryHeader({
  locale,
  t,
  view,
}: {
  locale: Locale;
  t: Dictionary;
  view: ExperienceView;
}) {
  const organisation = [view.organization, view.location]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" · ");

  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/*
          Date first, in one standardised form, with the category next to it
          rather than inside it. The CMS still stores strings like "First-year
          practicum · 2024–2025"; the category half of that is this chip, and
          the date half is normalised by `formatExperiencePeriod`.
        */}
        <span className="font-mono text-[0.8125rem] text-foreground-subtle">
          {view.periodLabel ?? t.experience.timeline.undated}
        </span>

        <span
          className="experience-mark text-eyebrow font-semibold uppercase"
          style={{ "--mark-color": trackMark(view.track) } as object}
        >
          {t.experience.tracks[view.track].label}
        </span>

        <span
          className="experience-chip inline-flex items-center rounded-(--radius-full) border px-2.5 py-0.5 text-[0.75rem] font-medium"
          style={{ "--mark-color": kindMark(view.kind, view.track) } as object}
        >
          {view.categoryLabel}
        </span>

        {view.isCurrent ? <CurrentStatus t={t} kind={view.kind} /> : null}
      </div>

      <h3
        className={cn(
          "font-semibold text-balance",
          view.featured ? "text-h3" : "text-h4",
        )}
        lang={langAttribute(locale, view.contentLocale)}
      >
        {view.roleTitle}
      </h3>

      {organisation ? (
        <p className="text-small font-medium text-foreground-muted">
          {view.organizationUrl ? (
            <SmartLink
              href={view.organizationUrl}
              newTabHint={t.a11y.opensInNewTab}
              className="underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
            >
              {organisation}
            </SmartLink>
          ) : (
            organisation
          )}
        </p>
      ) : null}
    </header>
  );
}

/**
 * The current-role marker.
 *
 * The words say it; the dot only repeats them. A green pill with no text would
 * be meaningless to anyone who cannot distinguish it, and green is used nowhere
 * else on this page so it cannot be mistaken for decoration.
 */
function CurrentStatus({ t, kind }: { t: Dictionary; kind: string }) {
  const label =
    kind.toLowerCase() === "practicum"
      ? t.experience.status.currentPracticum
      : t.experience.status.currentRole;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-(--radius-full) bg-success-subtle px-2.5 py-0.5 text-[0.75rem] font-semibold text-success-foreground">
      <StatusDot tone="success" className="size-1.5" />
      {label}
    </span>
  );
}

// ── Contributions ───────────────────────────────────────────────────────────

/**
 * Contributions as a real list.
 *
 * The CMS stores them as one newline-separated string and the old page printed
 * that string as a single grey paragraph — five separate claims run together
 * into something nobody finishes. They are separate statements, so they get
 * separate list items.
 */
function ContributionList({
  items,
  lang,
  mark,
}: {
  items: string[];
  lang: string | undefined;
  mark: string;
}) {
  return (
    <ul className="flex flex-col gap-1.5" lang={lang}>
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-small text-foreground-muted">
          <span
            aria-hidden="true"
            className="mt-[0.55em] size-1.5 shrink-0 rounded-full"
            style={{ background: mark }}
          />
          <span className="max-w-[64ch]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Disclosure ──────────────────────────────────────────────────────────────

function EntryDetails({
  locale,
  t,
  view,
  stories,
  contentLang,
  remainingContributions,
  remainingTags,
}: {
  locale: Locale;
  t: Dictionary;
  view: ExperienceView;
  stories: LinkedJourneyStory[] | undefined;
  contentLang: string | undefined;
  remainingContributions: string[];
  remainingTags: ExperienceView["tags"];
}) {
  return (
    <details className="experience-details group/details border-t border-border pt-4">
      <summary
        className={cn(
          "inline-flex min-h-11 items-center gap-2 text-small font-semibold",
          "text-foreground transition-colors hover:text-primary",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
        )}
      >
        <Icon
          name="chevronDown"
          size={16}
          className="experience-details__chevron"
        />
        {t.experience.card.viewFull}
      </summary>

      <div className="flex flex-col gap-5 pt-5">
        {view.description ? (
          <section className="flex flex-col gap-2">
            <h4 className="text-eyebrow font-semibold uppercase text-foreground-subtle">
              {t.experience.card.about}
            </h4>
            <p
              className="max-w-[66ch] text-small text-foreground-muted"
              lang={contentLang}
            >
              {view.description}
            </p>
          </section>
        ) : null}

        {remainingContributions.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h4 className="text-eyebrow font-semibold uppercase text-foreground-subtle">
              {t.experience.card.allContributions}
            </h4>
            <ContributionList
              items={remainingContributions}
              lang={contentLang}
              mark={kindMark(view.kind, view.track)}
            />
          </section>
        ) : null}

        {remainingTags.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h4 className="text-eyebrow font-semibold uppercase text-foreground-subtle">
              {t.experience.card.skills}
            </h4>
            <ul className="flex flex-wrap gap-1.5">
              {remainingTags.map((tag) => (
                <li key={tag.key}>
                  <Tag>{tag.label}</Tag>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {view.relatedProjects.length > 0 ? (
          <RelatedProjects t={t} view={view} />
        ) : null}

        {view.organizationUrl ? (
          <p>
            <SmartLink
              href={view.organizationUrl}
              newTabHint={t.a11y.opensInNewTab}
              showExternalIcon
              className="inline-flex min-h-11 items-center text-small font-medium text-primary underline underline-offset-4"
            >
              {t.experience.card.organisation}
            </SmartLink>
          </p>
        ) : null}

        <JourneyStoryLinks locale={locale} t={t} stories={stories} />
      </div>
    </details>
  );
}

/**
 * The products built during a role.
 *
 * These links exist only because the entry's own achievements name the
 * products — see `projectsNamedIn`. Nothing here restates a project's case
 * study; it names the product, its own categories, and gets out of the way.
 */
function RelatedProjects({
  t,
  view,
}: {
  t: Dictionary;
  view: ExperienceView;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h4 className="text-eyebrow font-semibold uppercase text-foreground-subtle">
        {t.experience.card.relatedProjects}
      </h4>

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {view.relatedProjects.map((project) => (
          <li key={project.id}>
            <div className="flex h-full flex-col gap-1.5 rounded-(--radius-lg) border border-border bg-surface-muted/60 p-3.5">
              {/*
                Not a stretched link. The tile carries two destinations — the
                case study and the live site — and an overlay covering the whole
                tile would swallow the second one for pointer users while
                leaving it in the tab order, which is worse than two plain
                links.
              */}
              <p className="text-small font-semibold text-foreground">
                {project.title}
              </p>

              {project.categoryLabel ? (
                <p className="text-[0.8125rem] text-foreground-subtle">
                  {project.categoryLabel}
                </p>
              ) : null}

              <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1.5">
                <SmartLink
                  href={project.href}
                  className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary underline underline-offset-4"
                >
                  {t.experience.card.viewProject}
                </SmartLink>

                {project.liveUrl ? (
                  <SmartLink
                    href={project.liveUrl}
                    newTabHint={t.a11y.opensInNewTab}
                    showExternalIcon
                    className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-foreground-muted underline underline-offset-4"
                  >
                    {t.experience.card.visitLive}
                  </SmartLink>
                ) : null}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
