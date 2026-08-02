import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import type { ExperiencePhoto } from "./experience-media";
import {
  compareByPeriod,
  formatExperiencePeriod,
  formatNumeral,
  parseExperiencePeriod,
  type ExperiencePeriod,
} from "./experience-period";
import {
  dedupeTags,
  EXPERIENCE_THEMES,
  resolveTag,
  themeMatches,
  trackForKind,
  type ExperienceThemeId,
  type ExperienceTrack,
  type ResolvedTag,
} from "./experience-taxonomy";

/**
 * The Experience page's view model.
 *
 * Everything the page renders is computed once, here, from the CMS rows — the
 * components receive finished values and make no decisions of their own. That is
 * what keeps the timeline, the featured sections and the evidence map showing
 * the *same* facts: there is one derivation, not three.
 *
 * Isomorphic on purpose. The filter bar and the evidence map are Client
 * Components and need these types; nothing here queries or reads privileged
 * configuration, so both sides can import it.
 */

// ── Inputs ──────────────────────────────────────────────────────────────────

/**
 * Structural shapes rather than imports from `lib/data/*`.
 *
 * Those modules are `server-only`. A type-only import would be erased and would
 * technically work, but declaring what this module actually needs keeps the
 * boundary obvious and stops the client bundle from ever growing a path to a
 * server module through a careless edit.
 */
export type ExperienceInput = {
  id: string;
  slug: string;
  kind: string;
  roleTitle: string;
  organization: string;
  organizationUrl: string | null;
  location: string | null;
  summary: string | null;
  description: string | null;
  achievements: string | null;
  periodLabel: string | null;
  startedOn: string | null;
  endedOn: string | null;
  isCurrent: boolean;
  tags: Array<{ id: string; slug: string; label: string; labelEn: string }>;
  contentLocale: Locale | null;
  cover: ExperiencePhoto | null;
  gallery: ExperiencePhoto[];
  sortOrder: number;
};

export type ProjectInput = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  liveUrl: string | null;
  technologies: Array<{ slug: string }>;
  categories: Array<{ slug: string; name: string }>;
};

export type PublicationInput = {
  id: string;
  slug: string;
  href: string;
  title: string;
  subject: string | null;
};

// ── Outputs ─────────────────────────────────────────────────────────────────

export type RelatedProject = {
  id: string;
  slug: string;
  title: string;
  /** The project's own category names, as its contribution label. */
  categoryLabel: string | null;
  href: string;
  liveUrl: string | null;
};

export type ExperienceView = {
  id: string;
  slug: string;
  /** Deep-link target. Journey stories already link to this exact id. */
  anchorId: string;
  track: ExperienceTrack;
  kind: string;
  /** Localised `kind`, falling back to the raw value for an unknown one. */
  categoryLabel: string;
  roleTitle: string;
  organization: string;
  organizationUrl: string | null;
  location: string | null;
  period: ExperiencePeriod;
  /** Normalised, localised range. Null when no date could be established. */
  periodLabel: string | null;
  isCurrent: boolean;
  summary: string | null;
  description: string | null;
  /** `achievements` split into discrete lines. Never contains blanks. */
  contributions: string[];
  tags: ResolvedTag[];
  /** The first three, in the editor's own order. */
  primaryTags: ResolvedTag[];
  /** Space-separated tokens the CSS filter matches with `~=`. */
  facets: string[];
  cover: ExperiencePhoto | null;
  gallery: ExperiencePhoto[];
  photoCount: number;
  relatedProjects: RelatedProject[];
  contentLocale: Locale | null;
  /** Rendered at editorial weight rather than compact. At most one per track. */
  featured: boolean;
};

/** How many skills a card shows before the rest move into the detail panel. */
export const PRIMARY_TAG_LIMIT = 3;

/** How many contributions a compact card shows. */
export const PRIMARY_CONTRIBUTION_LIMIT = 3;

// ── Contributions ───────────────────────────────────────────────────────────

/**
 * Split the `achievements` blob into discrete contributions.
 *
 * The CMS stores one newline-separated string, and the old page rendered the
 * whole thing as a single grey paragraph — five separate claims run together
 * into something nobody reads. They are separate statements and belong in a
 * list.
 *
 * Leading bullet characters are stripped because editors add them by habit and
 * a real `<li>` supplies its own marker; doubling them looks like a mistake.
 */
export function splitContributions(achievements: string | null): string[] {
  if (!achievements) return [];

  return achievements
    .split(/\r?\n+/)
    .map((line) => line.replace(/^\s*[•·\-–—*]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

// ── Project links ───────────────────────────────────────────────────────────

/**
 * Projects an experience entry's own prose names.
 *
 * There is no experience↔project relation in the schema, and inventing one in
 * a component would be exactly the fabricated relationship the brief rules out.
 * But the product role's achievements already say, in the owner's words,
 * "Designed and developed KruSmart…", "Built PTEC Digital Library…", "Developed
 * PTEC Storage…". Linking those is surfacing a stated fact, not asserting a new
 * one — and an entry that names nothing links to nothing.
 *
 * Matching is on the project *slug* rather than its translated title: the
 * product names appear in Latin script in both catalogues ("បានបង្កើត PTEC
 * Digital Library…"), so the slug matches on the Khmer page too, while a
 * translated title would not.
 */
export function projectsNamedIn(
  text: string,
  projects: ProjectInput[],
  locale: Locale,
): RelatedProject[] {
  const haystack = text.toLowerCase().replace(/\s+/g, " ");

  return projects
    .filter((project) => {
      const needle = project.slug.replace(/-/g, " ").toLowerCase();
      // Four characters is short enough for "krusmart" and long enough that a
      // one-word slug like "ui" could never match incidental prose.
      return needle.length >= 4 && haystack.includes(needle);
    })
    .map((project) => ({
      id: project.id,
      slug: project.slug,
      title: project.title,
      categoryLabel:
        project.categories.length > 0
          ? project.categories.map((category) => category.name).join(" · ")
          : null,
      href: localePath(locale, `projects/${project.slug}`),
      liveUrl: project.liveUrl,
    }));
}

// ── Build ───────────────────────────────────────────────────────────────────

function categoryLabelFor(kind: string, t: Dictionary): string {
  const labels = t.experience.kind as Record<string, string | undefined>;
  return labels[kind] ?? kind;
}

/**
 * Which filter chips an entry answers to.
 *
 * Emitted as data attributes and matched in CSS, so filtering never removes an
 * entry from the server-rendered HTML — a crawler and a reader with no
 * JavaScript both get every entry, which is the whole reason not to filter in
 * React state.
 */
function facetsFor(
  entry: ExperienceInput,
  track: ExperienceTrack,
  tagKeys: string[],
): string[] {
  const facets = new Set<string>([track]);

  if (entry.kind.toLowerCase() === "practicum") facets.add("practicum");

  const mathematics = EXPERIENCE_THEMES.find(
    (theme) => theme.id === "mathematics",
  );
  if (mathematics && themeMatches(mathematics, tagKeys)) {
    facets.add("mathematics");
  }

  return [...facets];
}

/**
 * `sortOrder` is needed to break ties and nothing else, so it lives on an
 * internal shape rather than leaking into every component's props.
 */
type SortableView = ExperienceView & { sortOrder: number };

export function buildExperienceViews({
  entries,
  projects,
  locale,
  t,
}: {
  entries: ExperienceInput[];
  projects: ProjectInput[];
  locale: Locale;
  t: Dictionary;
}): ExperienceView[] {
  const withPeriod: SortableView[] = entries.map((entry) => {
    const period = parseExperiencePeriod(entry);
    const track = trackForKind(entry.kind);
    const tags = dedupeTags(entry.tags.map((tag) => resolveTag(tag, t)));
    const tagKeys = tags.map((tag) => tag.key);
    const contributions = splitContributions(entry.achievements);

    const relatedProjects = projectsNamedIn(
      [entry.description ?? "", entry.achievements ?? ""].join("\n"),
      projects,
      locale,
    );

    const view: SortableView = {
      id: entry.id,
      slug: entry.slug,
      anchorId: `experience-${entry.slug}`,
      track,
      kind: entry.kind,
      categoryLabel: categoryLabelFor(entry.kind, t),
      roleTitle: entry.roleTitle,
      organization: entry.organization,
      organizationUrl: entry.organizationUrl,
      location: entry.location,
      period,
      periodLabel: formatExperiencePeriod(period, locale, t.common.present),
      isCurrent: entry.isCurrent,
      summary: entry.summary,
      description: entry.description,
      contributions,
      tags,
      primaryTags: tags.slice(0, PRIMARY_TAG_LIMIT),
      facets: facetsFor(entry, track, tagKeys),
      cover: entry.cover,
      gallery: entry.gallery,
      photoCount: entry.cover ? entry.gallery.length + 1 : 0,
      relatedProjects,
      contentLocale: entry.contentLocale,
      featured: false,
      sortOrder: entry.sortOrder,
    };

    return view;
  });

  const sorted = withPeriod.sort(compareByPeriod);

  /*
   * One featured entry per track: the most recent role that is actually running
   * and has something to show for itself.
   *
   * Derived rather than a `featured` column, because the answer is already
   * implied by the data and a stale flag on a finished placement would present
   * old work as current. "Something to show" means photographs, linked projects
   * or written contributions — featuring an entry with none of those would
   * produce a large empty panel.
   */
  for (const track of ["education", "product"] as const) {
    const candidates = sorted.filter(
      (view) =>
        view.track === track &&
        view.isCurrent &&
        (view.cover !== null ||
          view.relatedProjects.length > 0 ||
          view.contributions.length > 0),
    );

    const chosen = candidates[candidates.length - 1];
    if (chosen) chosen.featured = true;
  }

  return sorted.map(({ sortOrder: _sortOrder, ...view }) => view);
}

// ── Summary strip ───────────────────────────────────────────────────────────

export type SummaryItem = { id: string; label: string; value: string };

/**
 * The hero's summary figures.
 *
 * Every value is derived from the entries that are actually published. A track
 * with no entries produces no item, so the strip shrinks rather than printing a
 * zero, and no figure here is a claim the timeline underneath cannot support.
 *
 * The two spans are the earliest year evidenced on a track through either its
 * latest end year or, when something on that track is still running, the
 * localised "Present".
 */
export function buildExperienceSummary({
  views,
  locale,
  t,
}: {
  views: ExperienceView[];
  locale: Locale;
  t: Dictionary;
}): SummaryItem[] {
  const items: SummaryItem[] = [];

  for (const track of ["education", "product"] as const) {
    const dated = views.filter(
      (view) => view.track === track && view.period.startYear !== null,
    );
    if (dated.length === 0) continue;

    const startYear = Math.min(
      ...dated.map((view) => view.period.startYear as number),
    );
    const ongoing = dated.some((view) => view.period.isOngoing);
    const endYear = ongoing
      ? null
      : Math.max(
          ...dated.map(
            (view) => view.period.endYear ?? (view.period.startYear as number),
          ),
        );

    const value = formatExperiencePeriod(
      { startYear, endYear, isOngoing: ongoing, precision: "year" },
      locale,
      t.common.present,
    );
    if (!value) continue;

    items.push({
      id: `${track}-span`,
      label:
        track === "education"
          ? t.experience.summary.educationSpan
          : t.experience.summary.productSpan,
      value,
    });
  }

  if (views.length > 0) {
    items.push({
      id: "entries",
      label: t.experience.summary.entries,
      value: formatNumeral(views.length, locale),
    });
  }

  const products = new Set(
    views.flatMap((view) => view.relatedProjects.map((project) => project.id)),
  );
  if (products.size > 0) {
    items.push({
      id: "products",
      label: t.experience.summary.products,
      value: formatNumeral(products.size, locale),
    });
  }

  return items;
}

// ── Filters ─────────────────────────────────────────────────────────────────

export type ExperienceFacet =
  | "all"
  | "education"
  | "practicum"
  | "product"
  | "mathematics";

/** Below this, a filter bar is furniture over a list you can already see. */
const FILTERS_FROM = 4;

/**
 * The filter chips worth offering.
 *
 * Returns fewer than two entries — which the timeline reads as "do not render a
 * filter bar" — when the page is short enough to scan whole, or when only one
 * facet actually has entries behind it. A chip that filters nothing out is a
 * control that does nothing.
 */
export function buildExperienceFilters({
  views,
  t,
}: {
  views: ExperienceView[];
  t: Dictionary;
}): Array<{ value: ExperienceFacet; label: string; count: number }> {
  if (views.length < FILTERS_FROM) return [];

  const facets: Array<{ value: ExperienceFacet; label: string }> = [
    { value: "education", label: t.experience.filters.education },
    { value: "practicum", label: t.experience.filters.practicum },
    { value: "product", label: t.experience.filters.product },
    { value: "mathematics", label: t.experience.filters.mathematics },
  ];

  const available = facets
    .map((facet) => ({
      ...facet,
      count: views.filter((view) => view.facets.includes(facet.value)).length,
    }))
    // A facet everything matches narrows nothing, so it is dropped too.
    .filter((facet) => facet.count > 0 && facet.count < views.length);

  if (available.length < 2) return [];

  return [
    { value: "all", label: t.experience.filters.all, count: views.length },
    ...available,
  ];
}

// ── Evidence map ────────────────────────────────────────────────────────────

export type EvidenceItem = {
  id: string;
  label: string;
  /** Secondary line: the organisation, the project category, the subject. */
  detail: string | null;
  href: string;
  kind: "experience" | "project" | "publication";
};

export type EvidenceTheme = {
  id: ExperienceThemeId;
  track: ExperienceTrack;
  label: string;
  description: string;
  items: EvidenceItem[];
};

/**
 * Themes with the real work that evidences them.
 *
 * This is the replacement for a skills list with percentage bars: a capability
 * is worth stating only if something can be pointed at, so a theme that collects
 * nothing is dropped rather than rendered empty. Nothing here asserts a level of
 * proficiency, because nothing in the CMS measures one.
 */
export function buildEvidenceThemes({
  views,
  projects,
  publications,
  locale,
  t,
}: {
  views: ExperienceView[];
  projects: ProjectInput[];
  publications: PublicationInput[];
  locale: Locale;
  t: Dictionary;
}): EvidenceTheme[] {
  return EXPERIENCE_THEMES.map((theme) => {
    const items: EvidenceItem[] = [];

    for (const view of views) {
      if (!themeMatches(theme, view.tags.map((tag) => tag.key))) continue;
      items.push({
        id: `experience:${view.id}`,
        label: view.roleTitle,
        detail: view.organization || null,
        href: `#${view.anchorId}`,
        kind: "experience",
      });
    }

    for (const project of projects) {
      const keys = [
        ...project.technologies.map((technology) => technology.slug),
        ...project.categories.map((category) => category.slug),
      ];
      if (!themeMatches(theme, keys)) continue;
      items.push({
        id: `project:${project.id}`,
        label: project.title,
        detail:
          project.categories.length > 0
            ? project.categories.map((category) => category.name).join(" · ")
            : null,
        href: localePath(locale, `projects/${project.slug}`),
        kind: "project",
      });
    }

    if (theme.matchesPublicationSubject) {
      for (const publication of publications) {
        if (!publication.subject) continue;
        if (!theme.matchesPublicationSubject(publication.subject)) continue;
        items.push({
          id: `publication:${publication.id}`,
          label: publication.title,
          detail: publication.subject,
          href: publication.href,
          kind: "publication",
        });
      }
    }

    return {
      id: theme.id,
      track: theme.track,
      label: t.experience.themes[theme.id].label,
      description: t.experience.themes[theme.id].description,
      items,
    };
  }).filter((theme) => theme.items.length > 0);
}
